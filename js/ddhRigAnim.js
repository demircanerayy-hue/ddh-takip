/**
 * DDH TAKIP — Rig Animation Engine 3.0
 * Dependency-free Canvas 2D renderer. ES module, browser only.
 * Compatible: mount, start, pause, resume, destroy, resize, setStatus,
 * setDepth, setPlannedDepth, getDepth, newHole.
 * New: setOptions, setSpeed, getState, theme, quality, speed,
 * coreEveryRods, onDepthChange, onPhaseChange, onComplete, onNewHole.
 * Events: rig:depth, rig:phase, rig:complete, rig:newhole (on canvas).
 * autoAdvance is illustrative simulation; use false for real telemetry.
 * Cross-section is schematic, not a geological model or scaled log.
 */
(function (global) {
  "use strict";

  const LOGICAL_W = 200;
  const LOGICAL_H = 320;
  const DPR_MAX = 3;
  const GROUND_Y = 242;
  const BASE_X = 66;
  const BASE_Y = 244;
  const LEAN_DEG = 8;
  const TILT_DOWN = 62;       // mast yatık konum açısı (ek)
  const ROD_METERS = 3;
  const STATES = new Set(["aktif", "durak", "pasif"]);
  const RAD = Math.PI / 180;

  const PIT = { x: 8, y: 247, w: 34, h: 14 };       // çamur havuzu
  const TRAY = { x: 156, y: 248, w: 38, h: 11 };    // karot tepsisi

  /* ---------- yardımcılar ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hexToRgb(hex) {
    const raw = String(hex || "#f5b942").replace("#", "");
    const full = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return {
      r: Number.isNaN(r) ? 245 : r,
      g: Number.isNaN(g) ? 185 : g,
      b: Number.isNaN(b) ? 66 : b
    };
  }
  const colA = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };
  const shade = (hex, f) => {
    const c = hexToRgb(hex);
    const m = v => clamp(Math.round(v * f), 0, 255);
    return `rgb(${m(c.r)},${m(c.g)},${m(c.b)})`;
  };
  const normalizeStatus = s => (STATES.has(s) ? s : "pasif");
  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const PALETTES = {
    light: { sky: "#f7fafb", horizon: "#e2ecee", mountain: "#c9d9da", far: "#e0e9eb", ground: "#b4c2be", rock: ["#d3cdb8", "#aebbbb", "#889aa0"], ink: "#20333b", muted: "#647b83", panel: "rgba(255,255,255,.86)", line: "rgba(43,70,77,.13)", water: "#539da8" },
    dark: { sky: "#101d27", horizon: "#1c3440", mountain: "#314852", far: "#223843", ground: "#506462", rock: ["#4a5148", "#354751", "#263b47"], ink: "#e6f0f1", muted: "#90a9b2", panel: "rgba(12,25,35,.88)", line: "rgba(174,202,212,.14)", water: "#4ca9b9" }
  };
  function line(c, pts, color, width = 1) {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]); for (const pt of pts.slice(1)) c.lineTo(pt[0], pt[1]); c.stroke();
  }
  function poly(c, pts, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(pts[0][0],pts[0][1]);
    for (const pt of pts.slice(1)) c.lineTo(pt[0],pt[1]); c.closePath(); c.fill();
  }
  function box(c, x,y,w,h,r,color) { c.fillStyle=color; rr(c,x,y,w,h,r); c.fill(); }
  function bolt(c,x,y,r=1) { c.fillStyle="#82949d"; c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill(); }
  function label(c,t,x,y,size,color,weight=500) { c.font=`${weight} ${size}px system-ui, sans-serif`;c.fillStyle=color;c.fillText(t,x,y); }
  function fitText(c,t,width) { t=String(t);if(c.measureText(t).width<=width)return t;while(t.length&&c.measureText(t+"…").width>width)t=t.slice(0,-1);return t+"…"; }

  function seedFrom(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
  }

  const motionQuery = typeof global.matchMedia === "function" ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let REDUCED = !!(motionQuery && motionQuery.matches);
  const Ticker = {
    set: new Set(), raf: 0, last: 0,
    wake() {
      if (this.raf || REDUCED || (typeof document !== "undefined" && document.hidden)) return;
      if (![...this.set].some(c => c.visible && !c.destroyed)) return;
      this.last = performance.now(); this.raf = requestAnimationFrame(this.tick);
    },
    add(c) { this.set.add(c); this.wake(); },
    remove(c) { this.set.delete(c); if (!this.set.size) this.stop(); },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
    tick(now) {
      Ticker.raf = 0;
      const dt = clamp((now - Ticker.last) / 1000, 0, 0.05); Ticker.last = now;
      for (const c of Ticker.set) if (c.visible && !c.destroyed) c.frame(dt);
      if (!REDUCED && !document.hidden && [...Ticker.set].some(c => c.visible && !c.destroyed)) Ticker.raf = requestAnimationFrame(Ticker.tick);
    }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.hidden ? Ticker.stop() : Ticker.wake());
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener("change", e => {
    REDUCED = e.matches;
    if (REDUCED) { Ticker.stop(); for (const c of Ticker.set) c.renderFrame(); } else Ticker.wake();
  });
  const IO = (typeof IntersectionObserver !== "undefined")
    ? new IntersectionObserver(entries => {
        for (const e of entries) {
          const c = e.target.__rigController;
          if (c) { c.visible = e.isIntersecting; if (c.visible) Ticker.wake(); }
        }
      }, { threshold: 0.02 })
    : null;

  /* ---------- delgi çevrimi fazları ---------- */
  const PHASES = {
    drill:    { dur: 3.4 },
    lift:     { dur: 0.7 },
    wl_down:  { dur: 0.55 },
    wl_grab:  { dur: 0.3 },
    wl_up:    { dur: 1.1 },
    core_transfer: { dur: 3.6 },
    rodswing: { dur: 1.1 },
    clamp:    { dur: 0.35 }
  };
  const HEAD_BOT = -56;

  // operasyon (yaşam döngüsü) faz etiketleri — HUD'da gösterilir
  class RigController {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      if (!this.ctx) throw new Error("RigAnim requires a Canvas 2D context.");
      if (canvas.__rigController) canvas.__rigController.destroy();
      canvas.__rigController = this;

      this.opts = {
        status: normalizeStatus(options.status || "pasif"),
        machineName: String(options.machineName || "DDH RIG"),
        color: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(options.color || "") ? options.color : "#f5b942",
        showDepth: options.showDepth !== false,
        initialDepth: Math.max(0, finite(options.initialDepth)),
        plannedDepth: Math.max(0, finite(options.plannedDepth)),
        autoAdvance: options.autoAdvance !== false,
        autoCycle: options.autoCycle !== false,
        theme: options.theme === "dark" ? "dark" : "light",
        speed: clamp(finite(options.speed, 1), 0.1, 8),
        quality: options.quality === "low" ? "low" : "high",
        coreEveryRods: Math.max(1, Math.round(finite(options.coreEveryRods, 1))),
        onDepthChange: options.onDepthChange, onPhaseChange: options.onPhaseChange,
        onComplete: options.onComplete, onNewHole: options.onNewHole
      };

      this.status = this.opts.status;
      this.depth = this.opts.initialDepth;
      this.displayDepth = this.depth;
      this.depthFlash = 0;

      this.time = 0;
      this.spin = 0;
      this.spinSpeed = 0;
      this.headY = -120;
      this.phase = "drill";
      this.phaseT = 0;
      this.rodCount = Math.floor(this.depth / ROD_METERS);
      this.completed = false;
      this.completionPending = false;
      this._reportedDepth = this.depth;
      this._reportedPhase = "";
      this.rackRods = 4;
      this.coreCount = 0;

      // operasyon yaşam döngüsü
      this.opPhase = "work";
      this.opT = 0;
      this.erect = this.status === "pasif" ? 0 : 1;  // 0 = yatık, 1 = dik
      this.walkX = 0;
      this.rodVis = 1;                                // yeraltı tij görünürlüğü

      // operatör
      this.man = { x: 44, tx: 44, step: 0, trayTimer: 0 };

      this.chips = []; this.dust = []; this.smoke = []; this.sparks = [];
      this.ripples = []; this.flow = [0, 0.25, 0.5, 0.75];

      const rnd = seedFrom(this.opts.machineName);
      this.v = {
        mastLen: 188 + rnd() * 14,
        bodyW: 100 + rnd() * 12,
        stripe: rnd() > 0.5
      };

      this.visible = true;
      this.destroyed = false;
      this.running = false;
      this._staticDirty = true;

      this.resize();
      if (typeof ResizeObserver !== "undefined") {
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(canvas);
      }
      if (IO) IO.observe(canvas);

      if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
      this._ownsAria = !canvas.hasAttribute("aria-label");
      this.renderFrame(); this.start();
    }

    /* ---------- yaşam döngüsü ---------- */
    resize() {
      if (this.destroyed) return;
      const dpr = Math.min(global.devicePixelRatio || 1, DPR_MAX);
      this.dpr = dpr;
      const cs = global.getComputedStyle(this.canvas);
      // Only replace the browser's unsized 300 × 150 default; respect CSS sizing.
      if (!this.canvas.style.width && !this.canvas.style.height &&
          !this.canvas.getAttribute("width") && !this.canvas.getAttribute("height") &&
          cs.width === "300px" && cs.height === "150px") {
        this.canvas.style.width = LOGICAL_W + "px";
        this.canvas.style.height = LOGICAL_H + "px";
      }
      const rect = this.canvas.getBoundingClientRect();
      const cssW = rect.width || LOGICAL_W, cssH = rect.height || LOGICAL_H;
      const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
      if (this.canvas.width !== w) this.canvas.width = w;
      if (this.canvas.height !== h) this.canvas.height = h;
      this.scaleX = this.scaleY = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H);
      this.offsetX = (cssW - LOGICAL_W * this.scaleX) / 2;
      this.offsetY = (cssH - LOGICAL_H * this.scaleY) / 2;
      this._staticDirty = true;
      this.renderFrame();
    }

    start() {
      if (this.destroyed || this.running) return;
      this.running = true;
      Ticker.add(this);
    }
    pause() { this.running = false; Ticker.remove(this); this.renderFrame(); }
    resume() { this.start(); }

    destroy() {
      if (this.destroyed) return;
      this.pause();
      this.destroyed = true;
      if (this._ro) this._ro.disconnect();
      if (IO) IO.unobserve(this.canvas);
      this.canvas.__rigController = null;
      this.chips.length = this.dust.length = this.smoke.length =
        this.sparks.length = this.ripples.length = 0;
      this.ctx && this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setStatus(s) {
      s = normalizeStatus(s); if (this.destroyed || s === this.status) return;
      this.status = this.opts.status = s;
      this._staticDirty = true; this.notifyPhase(); this.renderFrame();
    }
    setDepth(m) {
      if (this.destroyed || !Number.isFinite(Number(m))) return;
      this.depth = Math.max(0, Number(m)); this.rodCount = Math.floor(this.depth / ROD_METERS);
      this.displayDepth = this.depth; this.depthFlash = 1;
      this.reportDepth(true); this.renderFrame();
    }
    setPlannedDepth(m) {
      if (this.destroyed || !Number.isFinite(Number(m))) return;
      this.opts.plannedDepth = Math.max(0, Number(m)); this.renderFrame();
    }
    getDepth() { return this.depth; }
    setSpeed(speed) { this.opts.speed = clamp(finite(speed, this.opts.speed), 0.1, 8); }
    setOptions(options = {}) {
      if (this.destroyed) return;
      if (options.status !== undefined) this.setStatus(options.status);
      if (options.plannedDepth !== undefined) this.setPlannedDepth(options.plannedDepth);
      if (options.initialDepth !== undefined) this.setDepth(options.initialDepth);
      if (options.speed !== undefined) this.setSpeed(options.speed);
      for (const key of ["autoAdvance","autoCycle","showDepth"]) if (key in options) this.opts[key] = !!options[key];
      if (options.machineName !== undefined) this.opts.machineName = String(options.machineName);
      if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(options.color || "")) this.opts.color = options.color;
      if (options.theme !== undefined) this.opts.theme = options.theme === "dark" ? "dark" : "light";
      if (options.quality !== undefined) this.opts.quality = options.quality === "low" ? "low" : "high";
      if (options.coreEveryRods !== undefined) this.opts.coreEveryRods = Math.max(1, Math.round(finite(options.coreEveryRods, 1)));
      for (const key of ["onDepthChange","onPhaseChange","onComplete","onNewHole"]) if (key in options) this.opts[key] = options[key];
      this._staticDirty = true; this.renderFrame();
    }
    getState() {
      const label = this.status === "pasif" ? "PARK HALİNDE" : this.status === "durak" ? "BEKLEME" : "AKTİF";
      const drilling = this.isDrilling();
      return { status:this.status, phase:this.phase, operation:this.opPhase, phaseLabel:label,
        depth:this.depth, plannedDepth:this.opts.plannedDepth, progress:this.opts.plannedDepth > 0 ? clamp(this.depth / this.opts.plannedDepth,0,1) : null,
        coreCount:this.coreCount, rodCount:this.rodCount, completed:this.completed,
        running:this.running, simulation:this.opts.autoAdvance, speed:this.opts.speed,
        telemetry:{ simulated:true, rpm:drilling?Math.round(680+Math.sin(this.time*2)*18):0, pressure:drilling?+(42+Math.sin(this.time*1.7)*1.4).toFixed(1):0, flow:drilling?+(28+Math.sin(this.time*2.3)*0.8).toFixed(1):0 } };
    }
    emitEvent(type, callback) {
      if (this.destroyed) return;
      const state = this.getState();
      if (typeof this.opts[callback] === "function") { try { this.opts[callback](state); } catch (e) { console.error("RigAnim callback:", e); } }
      if (typeof global.CustomEvent === "function") this.canvas.dispatchEvent(new CustomEvent("rig:"+type,{detail:state}));
    }
    reportDepth(force = false) {
      if (force && this.depth !== this._reportedDepth || Math.abs(this.depth-this._reportedDepth)>=0.02 || this.depth===this.opts.plannedDepth && this.depth!==this._reportedDepth) {
        this._reportedDepth=this.depth; this.emitEvent("depth","onDepthChange");
      }
    }
    notifyPhase() {
      const key=this.status+":"+this.opPhase+":"+this.phase;
      if (key!==this._reportedPhase) { this._reportedPhase=key; this.emitEvent("phase","onPhaseChange"); }
    }
    newHole(plannedDepth) {
      if (this.destroyed) return;
      if (Number.isFinite(Number(plannedDepth))) this.opts.plannedDepth=Math.max(0,Number(plannedDepth));
      this.depth=this.displayDepth=this.coreCount=this.rodCount=0;
      this.completed=this.completionPending=false;this._reportedDepth=0;
      this.rodVis=1;this.walkX=0;this.erect=0;this.rackRods=4;
      this.man.x=44;this.man.trayTimer=0;
      this.opPhase="raise";this.opT=0;this.phase="drill";this.phaseT=0;
      this.headY=this.headTop();this.chips=[];this.dust=[];this.smoke=[];this.sparks=[];
      this.emitEvent("newhole","onNewHole");this.notifyPhase();this.renderFrame();
    }

    /* ---------- geometri yardımcıları ---------- */
    erectEase() { return easeInOut(clamp(this.erect, 0, 1)); }
    curMastLen() { return this.v.mastLen * (0.55 + 0.45 * this.erectEase()); }
    headTop() { return -(this.curMastLen() - 46); }
    mastSway() {
      return this.isDrilling() ? Math.sin(this.time * 7.1) * 0.045 : 0;
    }
    mastAngleDeg() {
      return LEAN_DEG + this.mastSway() + (1 - this.erectEase()) * TILT_DOWN;
    }
    headWorld() {
      const a = this.mastAngleDeg() * RAD;
      return {
        x: BASE_X + this.walkX - this.headY * Math.sin(a),
        y: BASE_Y + this.headY * Math.cos(a)
      };
    }
    isDrilling() {
      return this.status === "aktif" && this.opPhase === "work" &&
        this.phase === "drill" && this.erect > 0.985;
    }

    /* ---------- güncelleme ---------- */
    frame(dt) {
      if (!this.running || this.destroyed) return;
      this.update(dt * this.opts.speed);
      if (this.visible) this.renderFrame();
    }

    update(dt) {
      dt = clamp(finite(dt), 0, 0.4);
      this.time += dt;
      this.displayDepth = lerp(this.displayDepth, this.depth, clamp(dt * 6, 0, 1));
      this.depthFlash = Math.max(0, this.depthFlash - dt * 1.6);

      // mast kurulum/indirme hedefi
      const wantUp = this.status !== "pasif" &&
        !["lower", "walkout", "walkin"].includes(this.opPhase);
      const target = wantUp ? 1 : 0;
      this.erect += clamp(target - this.erect, -dt / 2.4, dt / 2.4);

      const targetSpin = this.isDrilling() ? 10 : 0;
      this.spinSpeed = lerp(this.spinSpeed, targetSpin, clamp(dt * 4, 0, 1));
      this.spin += this.spinSpeed * dt;

      // operasyon yaşam döngüsü
      if (this.status === "aktif") this.updateOp(dt);

      if (this.status === "aktif" && this.opPhase === "work" && this.erect > 0.985) {
        this.updateCycle(dt);
      } else if (this.status !== "durak") {
        const park = (this.status === "durak" && this.erect > 0.97) ? -112 : this.headTop();
        this.headY = lerp(this.headY, park, clamp(dt * 3, 0, 1));
      }

      // efekt üretimi
      if (this.isDrilling()) {
        if (this.opts.quality !== "low") {
          this.emit("chip", this.chips, dt, 4, 10, () => this.mkChip());
          this.emit("dust", this.dust, dt, 1, 8, () => this.mkDust());
        }
        this._accRip = (this._accRip || 0) + dt * 1.6;
        if (this._accRip >= 1 && this.ripples.length < 4) {
          this._accRip = 0;
          this.ripples.push({ age: 0, life: 1.3 });
        }

        // dönüş suyu akışı
        for (let i = 0; i < this.flow.length; i++)
          this.flow[i] = (this.flow[i] + dt * 0.55) % 1;
      }
      const walking = this.opPhase === "walkout" || this.opPhase === "walkin";
      if (walking) {
        this.emit("wdust", this.dust, dt, 6, 10, () => this.mkWalkDust());
      }
      if (this.status !== "pasif" && this.opts.quality !== "low" && this.opPhase !== "done") {
        const rate = (this.status === "aktif" && this.opPhase !== "done") ? 3.6 : 1.1;
        this.emit("smoke", this.smoke, dt, rate, 12, () => this.mkSmoke());
      }
      this.stepParticles(dt);
      this.updateOperator(dt);
      this.reportDepth();this.notifyPhase();
    }

    updateOp(dt) {
      switch (this.opPhase) {
        case "work": break;
        case "tripout": {
          this.opT += dt;
          const t = clamp(this.opT / 3.0, 0, 1);
          this.rodVis = 1 - t;
          this.rackRods = Math.min(4, 1 + Math.floor(t * 4));
          if (t >= 1) {
            this.rodVis = 0;
            this.opPhase = this.opts.autoCycle ? "lower" : "done";
            this.opT = 0;
          }
          break;
        }
        case "lower":
          if (this.erect <= 0.01) { this.opPhase = "walkout"; this.opT = 0; }
          break;
        case "walkout":
          this.walkX += dt * 34;
          if (this.walkX > 210) {
            // yeni kuyu: sahaya soldan giriş
            this.depth = 0; this.displayDepth = 0;
            this.coreCount = 0; this.rodCount = 0;
            this.completed=false;this.completionPending=false;this._reportedDepth=0;
            this.emitEvent("newhole","onNewHole");
            this.walkX = -210;
            this.opPhase = "walkin";
          }
          break;
        case "walkin":
          this.walkX += dt * 40;
          if (this.walkX >= 0) {
            this.walkX = 0;
            this.rodVis = 1;
            this.opPhase = "raise";
          }
          break;
        case "raise":
          if (this.erect >= 0.99) {
            this.opPhase = "work";
            this.phase = "drill"; this.phaseT = 0;
          }
          break;
        case "done": break;
      }
    }

    updateCycle(dt) {
      let remaining=dt;
      while (remaining>0.000001 && this.opPhase==="work") {
        const def=PHASES[this.phase], step=Math.min(remaining,Math.max(0,def.dur-this.phaseT));
        this.phaseT+=step;remaining-=step;
        const t=clamp(this.phaseT/def.dur,0,1),top=this.headTop();
        if (this.phase==="drill") {
          this.headY=lerp(top,HEAD_BOT,easeInOut(t));
          if (this.opts.autoAdvance) {
            this.depth+=ROD_METERS/def.dur*step;
            if (this.opts.plannedDepth>0 && this.depth>=this.opts.plannedDepth-1e-8) {
              this.depth=this.opts.plannedDepth;this.completionPending=true;
              this.phaseT=def.dur;
            }
          }
        } else if (this.phase==="lift") this.headY=lerp(HEAD_BOT,top,easeOutCubic(t));
        else this.headY=top;
        if (this.phaseT+1e-8<def.dur) break;
        this.phaseT=0;
        if (this.phase==="drill") {
          this.rodCount++;this.phase="lift";
        } else if (this.phase==="lift") this.phase=(this.completionPending || this.rodCount%this.opts.coreEveryRods===0)?"wl_down":"rodswing";
        else if (this.phase==="wl_down") this.phase="wl_grab";
        else if (this.phase==="wl_grab") this.phase="wl_up";
        else if (this.phase==="wl_up") { this.phase="core_transfer";this.man.trayTimer=PHASES.core_transfer.dur;this.depthFlash=1; }
        else if (this.phase==="core_transfer") {
          this.coreCount++;this.man.trayTimer=0;
          if (this.completionPending) {
            this.completed=true;this.depthFlash=1;this.opPhase="tripout";this.opT=0;
            this.emitEvent("complete","onComplete");
          } else this.phase="rodswing";
        } else if (this.phase==="rodswing") { this.rackRods=this.rackRods>1?this.rackRods-1:4;this.phase="clamp"; }
        else if (this.phase==="clamp") this.phase="drill";
        this.notifyPhase();
      }
    }

    /* ---------- operatör ---------- */
    updateOperator(dt) {
      const m = this.man;
      if (this.status === "aktif") m.trayTimer = Math.max(0, m.trayTimer - dt);

      const walking = ["lower", "walkout", "walkin", "raise"].includes(this.opPhase);
      m.present = this.status !== "pasif" && !walking && this.opPhase !== "done";

      if (!m.present) return;
      if (this.status === "durak") { m.moving=false; return; }

      if (this.phase === "core_transfer" && this.status === "aktif") m.tx = TRAY.x + 8;                  // karot taşıma
      else if (this.status === "durak") m.tx = 52;               // yaslanma
      else if (this.opPhase === "tripout") m.tx = 58;            // mast dibi
      else if (this.phase === "rodswing") m.tx = 58;
      else m.tx = 42;                                            // kumanda paneli

      const dx = m.tx - m.x;
      const sp = clamp(dx, -dt * 48, dt * 48);
      m.x += sp;
      m.moving = Math.abs(dx) > 1;
      if (m.moving) m.step += dt * 9;
    }

    /* ---------- parçacıklar ---------- */
    emit(key, arr, dt, rate, cap, mk) {
      const k = "_acc_" + key;
      this[k] = (this[k] || 0) + dt * rate;
      while (this[k] >= 1) {
        this[k] -= 1;
        if (arr.length < cap) arr.push(mk());
      }
    }
    mkChip() {
      const ang = (70 + Math.random() * 110) * RAD;
      const sp = 5 + Math.random() * 9;
      return { x: BASE_X, y: BASE_Y, vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp * 0.7,
        age: 0, life: 0.7 + Math.random() * 0.5, r: 0.45 + Math.random() * 0.5,
        c: Math.random() > 0.45 ? "#b59a76" : "#5d646f" };
    }
    mkDust() {
      return { x: BASE_X + (Math.random() * 18 - 9), y: BASE_Y - 2,
        vx: Math.random() * 8 - 4, vy: -7 - Math.random() * 7,
        age: 0, life: 1.4 + Math.random() * 0.9, r: 3 + Math.random() * 4 };
    }
    mkWalkDust() {
      const w = this.v.bodyW + 14;
      const x0 = 96 - w / 2 + 14 + this.walkX;
      const rear = this.opPhase === "walkout" ? x0 : x0 + w;
      return { x: rear + (Math.random() * 10 - 5), y: 236 + Math.random() * 4,
        vx: (this.opPhase === "walkout" ? -1 : 1) * (6 + Math.random() * 8),
        vy: -4 - Math.random() * 5,
        age: 0, life: 0.9 + Math.random() * 0.6, r: 2.5 + Math.random() * 3 };
    }
    mkSmoke() {
      return { x: 96 + this.v.bodyW / 2 + 14 - 19 + this.walkX + Math.random() * 2, y: 150,
        vx: -3 + Math.random() * 7, vy: -13 - Math.random() * 9,
        age: 0, life: 1.6 + Math.random() * 1.1, r: 2.6 + Math.random() * 4 };
    }
    mkSpark() {
      const ang = (60 + Math.random() * 60) * RAD;
      const sp = 50 + Math.random() * 55;
      return { x: BASE_X, y: BASE_Y, vx: Math.cos(ang) * sp * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.sin(ang) * sp, age: 0, life: 0.22 + Math.random() * 0.2 };
    }
    stepParticles(dt) {
      for (const p of this.chips) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; }
      for (const d of this.dust) { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += dt * 4; }
      for (const s of this.smoke) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 4.5; }
      for (const k of this.sparks) { k.age += dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 160 * dt; }
      for (const r of this.ripples) r.age += dt;
      this.chips = this.chips.filter(p => p.age < p.life);
      this.dust = this.dust.filter(p => p.age < p.life);
      this.smoke = this.smoke.filter(p => p.age < p.life);
      this.sparks = this.sparks.filter(p => p.age < p.life);
      this.ripples = this.ripples.filter(p => p.age < p.life);
    }

    /* ---------- statik katman ---------- */
    buildStatic() {
      if (!this._static) this._static=document.createElement("canvas");
      const c=this._static.getContext("2d"),P=PALETTES[this.opts.theme];
      this._static.width=this.canvas.width;this._static.height=this.canvas.height;
      c.fillStyle=P.sky;c.fillRect(0,0,this._static.width,this._static.height);
      c.setTransform(this.dpr*this.scaleX,0,0,this.dpr*this.scaleY,this.offsetX*this.dpr,this.offsetY*this.dpr);
      const sky=c.createLinearGradient(0,0,0,GROUND_Y);sky.addColorStop(0,P.sky);sky.addColorStop(1,P.horizon);c.fillStyle=sky;c.fillRect(0,0,200,320);
      c.fillStyle=P.line;
      for(let y=46;y<220;y+=12)for(let x=8;x<200;x+=12)c.fillRect(x,y,.6,.6);
      poly(c,[[0,210],[15,191],[39,203],[76,164],[98,182],[121,173],[157,199],[185,186],[200,195],[200,242],[0,242]],P.far);
      poly(c,[[0,225],[30,209],[49,216],[86,195],[112,213],[145,200],[168,217],[200,207],[200,243],[0,243]],P.mountain);
      poly(c,[[76,164],[98,182],[88,177],[79,183],[74,178],[64,183]],this.opts.theme==="dark"?"#42606b":"#edf4f3");
      poly(c,[[30,209],[49,216],[40,225],[25,222],[0,236],[0,225]],P.ground);
      const terrain=c.createLinearGradient(0,227,0,246);terrain.addColorStop(0,P.ground);terrain.addColorStop(1,P.rock[0]);c.fillStyle=terrain;c.fillRect(0,237,200,9);
      // Schematic strata. Geometry represents no specific lithology or scale.
      poly(c,[[0,245],[200,245],[200,257],[155,260],[110,255],[70,263],[0,256]],P.rock[0]);
      poly(c,[[0,256],[70,263],[110,255],[155,260],[200,257],[200,279],[136,274],[84,284],[0,271]],P.rock[1]);
      poly(c,[[0,271],[84,284],[136,274],[200,279],[200,320],[0,320]],P.rock[2]);
      line(c,[[0,256],[70,263],[110,255],[155,260],[200,257]],P.line,.6);
      line(c,[[0,271],[84,284],[136,274],[200,279]],P.line,.6);
      const rnd=seedFrom(this.opts.machineName+"geology");
      for(let i=0;i<110;i++) { const x=rnd()*200,y=246+rnd()*43;c.fillStyle=P.line;c.fillRect(x,y,.5+rnd(),.5); }
      line(c,[[120,248],[131,261],[140,278],[145,288]],this.opts.theme==="dark"?"#b49a61":"#ac9972",2.5);
      line(c,[[126,254],[119,264],[125,272]],this.opts.theme==="dark"?"#b49a61":"#ac9972",1);
      line(c,[[0,243],[200,243]],P.line,1);
      c.save();c.translate(BASE_X,BASE_Y);c.rotate(LEAN_DEG*RAD);
      box(c,-4,0,8,44,2,"#15232b");line(c,[[-4,0],[-4,43]],"#607987",.6);
      box(c,-5.5,-9,11,12,1.5,"#334750");box(c,-5.5,-7,11,2,1,this.opts.color);
      c.restore();
      box(c,PIT.x,PIT.y,PIT.w,PIT.h,3,"#203c44");
      line(c,[[PIT.x,PIT.y+1],[PIT.x+PIT.w,PIT.y+1]],"#92adb0",1.2);
      box(c,TRAY.x,TRAY.y,TRAY.w,TRAY.h,1.5,"#75878b");box(c,TRAY.x+1.5,TRAY.y+1.5,TRAY.w-3,TRAY.h-3,1,"#d0c4a1");
      for(let i=1;i<6;i++)line(c,[[TRAY.x+i*TRAY.w/6,TRAY.y+1],[TRAY.x+i*TRAY.w/6,TRAY.y+TRAY.h-1]],"#7a816e",.6);
      for(const x of [12,188]) { box(c,x-2,233,4,9,1,"#f68a40");box(c,x-2,236,4,1.5,0,"#ffe7cb");box(c,x-3.5,241,7,1.5,1,"#334850"); }
      line(c,[[91,273],[111,273]],P.muted,.5);label(c,"ŞEMATİK KESİT",114,275,4.1,P.muted,600);
      this._staticDirty=false;
    }

    renderFrame() {
      if (this.destroyed) return;
      const ctx = this.ctx;
      if (this._staticDirty) this.buildStatic();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this._static, 0, 0);
      ctx.setTransform(this.dpr * this.scaleX, 0, 0, this.dpr * this.scaleY, this.offsetX * this.dpr, this.offsetY * this.dpr);

      ctx.save();ctx.beginPath();ctx.rect(0,0,LOGICAL_W,LOGICAL_H);ctx.clip();

      this.drawLightCone(ctx);
      this.drawMudPit(ctx);
      this.drawCores(ctx);
      this.drawSuctionHose(ctx);
      this.drawCrawler(ctx);
      this.drawBody(ctx);
      this.drawCylinder(ctx);
      this.drawMast(ctx);
      this.drawDeliveryHose(ctx);
      this.drawHoleString(ctx);
      this.drawReturnFlow(ctx);
      this.drawEffects(ctx);
      this.drawOperator(ctx);


      this.drawHUD(ctx);
      ctx.restore();
    }

    mastTransform(ctx) {
      ctx.translate(BASE_X + this.walkX, BASE_Y);
      ctx.rotate(this.mastAngleDeg() * RAD);
    }
    walkBob() {
      const walking = this.opPhase === "walkout" || this.opPhase === "walkin";
      return walking ? Math.sin(this.walkX * 0.45) * 0.7 : 0;
    }

    drawLightCone(ctx) {
      if (this.status === "pasif" || this.erect < 0.97) return;
      if (["lower", "walkout", "walkin"].includes(this.opPhase)) return;
      const L = this.curMastLen();
      ctx.save();
      this.mastTransform(ctx);
      const flicker = this.status === "aktif" ? 0.1 + Math.sin(this.time * 7.3) * 0.015 : 0.06;
      const g = ctx.createLinearGradient(0, -L + 14, 0, 0);
      g.addColorStop(0, `rgba(245,217,138,${flicker + 0.05})`);
      g.addColorStop(1, "rgba(245,217,138,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(6, -L + 14);
      ctx.lineTo(40, 2);
      ctx.lineTo(-34, 2);
      ctx.lineTo(2, -L + 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const pool = ctx.createRadialGradient(BASE_X, BASE_Y + 2, 2, BASE_X, BASE_Y + 2, 40);
      pool.addColorStop(0, `rgba(245,217,138,${this.status === "aktif" ? 0.12 : 0.06})`);
      pool.addColorStop(1, "rgba(245,217,138,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(BASE_X, BASE_Y + 2, 40, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- çamur sistemi --- */
    drawMudPit(ctx) {
      const drilling = this.isDrilling();
      const lvlY = PIT.y + 3.5;
      const amp = drilling ? 0.8 : 0.25;
      // sıvı yüzeyi (dalgalı)
      const g = ctx.createLinearGradient(0, lvlY, 0, PIT.y + PIT.h);
      g.addColorStop(0, "#7ca3a4");
      g.addColorStop(1, "#3f6b76");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(PIT.x + 1.5, lvlY);
      for (let x = 0; x <= PIT.w - 3; x += 3) {
        const wy = lvlY + Math.sin(this.time * 2.4 + x * 0.5) * amp;
        ctx.lineTo(PIT.x + 1.5 + x, wy);
      }
      ctx.lineTo(PIT.x + PIT.w - 1.5, PIT.y + PIT.h - 1.5);
      ctx.lineTo(PIT.x + 1.5, PIT.y + PIT.h - 1.5);
      ctx.closePath();
      ctx.fill();
      // yüzey parlaması
      ctx.strokeStyle = "rgba(220,190,140,.18)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(PIT.x + 2, lvlY);
      ctx.lineTo(PIT.x + PIT.w - 2, lvlY + Math.sin(this.time * 2.4 + 4) * amp);
      ctx.stroke();
      // kabarcık
      if (drilling && Math.sin(this.time * 3.7) > 0.93) {
        ctx.strokeStyle = "rgba(220,190,140,.3)";
        ctx.beginPath();
        ctx.arc(PIT.x + 8 + (this.time * 7) % (PIT.w - 16), lvlY + 2, 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawSuctionHose(ctx) {
      if (["lower","walkout","walkin","raise"].includes(this.opPhase) || this.status === "pasif") return;
      // havuz → makine pompası (emiş hattı)
      const w = this.v.bodyW + 14;
      const x0 = 96 - w / 2 + 14 + this.walkX;
      ctx.strokeStyle = "#262e3d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(PIT.x + 6, PIT.y + 4);
      ctx.quadraticCurveTo(PIT.x + 16, 238, x0 + 8, 212);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PIT.x + 6, PIT.y + 3);
      ctx.quadraticCurveTo(PIT.x + 16, 237, x0 + 8, 211);
      ctx.stroke();
    }

    drawDeliveryHose(ctx) {
      // pompa → delici kafa (basma hattı), kafayla birlikte hareket eder
      if (this.erect < 0.5 || ["lower","walkout","walkin"].includes(this.opPhase)) return;
      const hw = this.headWorld();
      const w = this.v.bodyW + 14;
      const x0 = 96 - w / 2 + 14 + this.walkX;
      const drilling = this.isDrilling();
      const jit = drilling ? Math.sin(this.time * 21) * 1.4 : 0;
      const cx = (x0 + 24 + hw.x) / 2 + 14 + jit;
      const cy = Math.max(hw.y, 168) + 26;
      ctx.strokeStyle = "#2e3a4d";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x0 + 22, 172);
      ctx.quadraticCurveTo(cx, cy, hw.x + 4, hw.y + 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(126,184,216,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 22, 171);
      ctx.quadraticCurveTo(cx, cy - 1, hw.x + 4, hw.y + 1);
      ctx.stroke();
    }

    drawReturnFlow(ctx) {
      if (!this.isDrilling()) return;
      // kuyudan dönen kırıntılı su — kanal boyunca damlalar
      const p0 = { x: BASE_X - 6, y: BASE_Y + 1 };
      const pc = { x: 52, y: 250 };
      const p1 = { x: PIT.x + PIT.w - 2, y: PIT.y + 4 };
      for (const t of this.flow) {
        const a = lerp(p0.x, pc.x, t), b = lerp(pc.x, p1.x, t);
        const x = lerp(a, b, t);
        const ay = lerp(p0.y, pc.y, t), by = lerp(pc.y, p1.y, t);
        const y = lerp(ay, by, t);
        ctx.fillStyle = "rgba(150,120,80,.55)";
        ctx.beginPath();
        ctx.ellipse(x, y, 1.8, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawCores(ctx) {
      for (let i = 0; i < Math.min(this.coreCount, 6); i++) {
        const g = ctx.createLinearGradient(0, TRAY.y + 2, 0, TRAY.y + 9);
        g.addColorStop(0, "#e8c97e");
        g.addColorStop(1, "#8a6b38");
        ctx.fillStyle = g;
        rr(ctx, TRAY.x + 2 + i * (TRAY.w / 6), TRAY.y + 2.5, 4.4, 7, 2);
        ctx.fill();
      }
    }

    drawCrawler(ctx) {
      const w=this.v.bodyW+14,x0=96-w/2+14;
      const walking=["walkout","walkin"].includes(this.opPhase);
      ctx.save();ctx.translate(this.walkX,this.walkBob());
      const shadow=ctx.createRadialGradient(x0+w/2,240,2,x0+w/2,240,w*.6);shadow.addColorStop(0,"rgba(10,23,28,.35)");shadow.addColorStop(1,"rgba(10,23,28,0)");
      ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(x0+w/2,240,w*.7,8,0,0,Math.PI*2);ctx.fill();
      box(ctx,x0+8,210,w-5,21,10,"#293d46");
      box(ctx,x0,216,w,24,11,"#17262e");box(ctx,x0+3,219,w-6,18,8,"#40545d");box(ctx,x0+5,220,w-10,15,7,"#243942");
      const shift=walking?((this.walkX*1.6)%7+7)%7:0;
      ctx.save();rr(ctx,x0,216,w,24,11);ctx.clip();
      for(let x=x0-7-shift;x<x0+w+7;x+=7) {
        line(ctx,[[x,217],[x+2,220]],"#70828a",1.2);line(ctx,[[x,237],[x+2,240]],"#536771",1.1);
      }ctx.restore();
      for(let i=0;i<6;i++) {
        const x=x0+11+i*(w-22)/5;ctx.fillStyle="#5f737c";ctx.beginPath();ctx.arc(x,228,6.8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#344b56";ctx.beginPath();ctx.arc(x,228,4.9,0,Math.PI*2);ctx.fill();
        ctx.save();ctx.translate(x,228);ctx.rotate(walking?this.walkX*.25:0);
        for(let j=0;j<4;j++){ctx.rotate(Math.PI/2);line(ctx,[[2,0],[4,0]],"#8ea0a7",.7);}bolt(ctx,0,0,1.7);ctx.restore();
      }
      // Retracting stabilizer feet.
      const extension=this.erectEase()*15;
      for(const x of [x0+2,x0+w-2]) {
        box(ctx,x-2,207,4,10,1,"#2b414c");line(ctx,[[x,214],[x,218+extension]],"#9bafb7",2);
        box(ctx,x-6,217+extension,12,3,1,"#263942");
      }
      ctx.restore();
    }

    drawBody(ctx) {
      const accent=this.opts.color,w=this.v.bodyW,x0=96-w/2+14,off=this.status==="pasif";
      ctx.save();ctx.translate(this.walkX,this.walkBob());
      // Chassis depth, steel steps and bevelled engine enclosure.
      poly(ctx,[[x0-2,206],[x0+8,201],[x0+w+8,201],[x0+w+3,214],[x0-2,216]],"#223641");
      box(ctx,x0-2,207,w+6,8,2,"#3d525b");line(ctx,[[x0+2,208],[x0+w,208]],"#7f959d",.8);
      const body=ctx.createLinearGradient(0,167,0,205);body.addColorStop(0,shade(accent,off?.72:1.15));body.addColorStop(.5,shade(accent,off?.58:.96));body.addColorStop(1,shade(accent,off?.4:.7));
      box(ctx,x0+27,169,w-29,35,3,body);
      poly(ctx,[[x0+27,169],[x0+34,163],[x0+w+5,163],[x0+w-2,169]],shade(accent,1.24));
      poly(ctx,[[x0+w-2,169],[x0+w+5,163],[x0+w+5,199],[x0+w-2,204]],shade(accent,.55));
      box(ctx,x0+34,175,26,22,2,"#21343f");
      for(let y=178;y<195;y+=3)line(ctx,[[x0+37,y],[x0+57,y]],"#526b75",1);
      for(const x of [x0+29,x0+w-6])for(const y of [172,201])bolt(ctx,x,y,.9);
      line(ctx,[[x0+65,172],[x0+65,201]],colA("#0e1e28",.3),.7);
      box(ctx,x0+68,177,11,2,.8,"#334853");
      ctx.font = "800 5.5px system-ui, sans-serif";
      label(ctx,fitText(ctx,this.opts.machineName,w-68),x0+69,194,5.5,shade(accent,.3),800);
      box(ctx,x0+29,199,w-33,3,0,"#253840");
      for(let x=x0+34;x<x0+w-5;x+=8)poly(ctx,[[x,199],[x+3,199],[x+1,202],[x-2,202]],"#d1b85c");
      // Operator station, emergency stop and valve bank.
      box(ctx,x0+3,179,22,23,2,"#324b58");poly(ctx,[[x0+3,179],[x0+8,174],[x0+29,174],[x0+25,179]],"#536e7a");
      box(ctx,x0+6,181,8,6,1,off?"#263941":"#6bc4cb");
      line(ctx,[[x0+8,184],[x0+9,183],[x0+11,185],[x0+12,182]],"#163c48",.65);
      for(let i=0;i<3;i++){line(ctx,[[x0+7+i*6,194],[x0+7+i*6,188]],"#9fb3bb",.9);bolt(ctx,x0+7+i*6,188,1.5);}
      ctx.fillStyle="#ea6b57";ctx.beginPath();ctx.arc(x0+20,183,1.6,0,Math.PI*2);ctx.fill();
      box(ctx,x0+6,202,19,3,1,"#778c94");box(ctx,x0+8,210,18,2,1,"#82979d");
      // Pump + hydraulic lines.
      box(ctx,x0+29,206,17,8,2,"#20343e");const pst=this.isDrilling()?Math.sin(this.time*14)*2:0;
      box(ctx,x0+33+pst,208,5,4,1,"#9faeb4");
      for(let i=0;i<3;i++)line(ctx,[[x0+18+i*2,199],[x0+20+i*2,205],[x0+29,207+i]],"#182f3c",.7);
      // Exhaust, tank, lifting points.
      box(ctx,x0+w-21,151,4,16,1,"#2d454f");box(ctx,x0+w-23,150,8,3,1,"#5b717a");
      box(ctx,x0+39,161,21,3,1,"#5d7179");box(ctx,x0+45,158,7,3,1,"#2b4049");
      for(const x of [x0+31,x0+w-10]) {ctx.strokeStyle="#4b626e";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,163,2.2,Math.PI,0);ctx.stroke();}
      // Canopy and amber beacon.
      line(ctx,[[x0+2,179],[x0+2,158],[x0+27,158],[x0+27,172]],"#2c444f",2);
      poly(ctx,[[x0-3,157],[x0+4,153],[x0+34,153],[x0+28,157]],"#5d7681");box(ctx,x0-3,157,31,2,1,"#263e49");
      const beacon=!off && this.opPhase!=="done" && Math.sin(this.time*5)>-.3;
      box(ctx,x0+16,149,5,4,1,beacon?"#ffc45c":"#8c7043");
      if(beacon){const g=ctx.createRadialGradient(x0+18.5,151,0,x0+18.5,151,8);g.addColorStop(0,"rgba(255,184,66,.38)");g.addColorStop(1,"rgba(255,184,66,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x0+18.5,151,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }

    drawCylinder(ctx) {
      // hidrolik kurulum silindiri: gövde → mast (dünya koordinatlarında)
      if (this.erect <= 0.001 && this.status === "pasif") {
        // tam yatıkken görünmez kadar kısa, yine de çiz
      }
      const a = this.mastAngleDeg() * RAD;
      const anchor = { x: BASE_X + this.walkX + 36, y: 213 + this.walkBob() };
      // mast üzerindeki bağlantı noktası: local (0,-58)
      const m = {
        x: BASE_X + this.walkX + 58 * Math.sin(a),
        y: BASE_Y - 58 * Math.cos(a)
      };
      const dx = m.x - anchor.x, dy = m.y - anchor.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      // dış tüp (sabit kısım)
      const tube = Math.min(26, len * 0.55);
      ctx.strokeStyle = "#3a465c";
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(anchor.x + ux * tube, anchor.y + uy * tube);
      ctx.stroke();
      // piston rodu (uzayan kısım)
      ctx.strokeStyle = "#8b99ad";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(anchor.x + ux * tube, anchor.y + uy * tube);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      // mafsallar
      ctx.fillStyle = "#222b3c";
      ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    drawMast(ctx) {
      const L=this.curMastLen(),accent=this.opts.color;
      ctx.save();this.mastTransform(ctx);
      poly(ctx,[[-7,-L],[0,-L-3],[11,-L-3],[7,-L]],"#667d88");
      poly(ctx,[[7,-L],[11,-L-3],[11,-14],[7,-10]],"#243e4b");
      box(ctx,-7,-L,14,L-10,1.5,"#1c303c");
      for(let y=-19;y>-L+11;y-=13) {
        line(ctx,[[-5,y],[5,y-11]],"#587481",1.1);line(ctx,[[5,y],[-5,y-11]],"#304e5d",.8);
        bolt(ctx,-5,y,.65);bolt(ctx,5,y,.65);
      }
      line(ctx,[[-7,-11],[-7,-L]],shade(accent,.82),2.2);
      line(ctx,[[7,-11],[7,-L]],"#9bb0b9",1.5);line(ctx,[[9,-16],[9,-L+5]],"#496472",1);
      // Feed chain, pulley and service light.
      line(ctx,[[-2,-L+12],[-2,-16]],"#738994",.6);
      for(let y=-20;y>-L+16;y-=4)line(ctx,[[-3,y],[-1,y]],"#b7c4c9",.6);
      box(ctx,-8,-L-10,16,12,2,"#3e5966");
      ctx.fillStyle="#1b3340";ctx.beginPath();ctx.arc(0,-L-5,4,0,Math.PI*2);ctx.fill();bolt(ctx,0,-L-5,1.1);
      ctx.strokeStyle="#718d9b";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-L-5,4,0,Math.PI*2);ctx.stroke();
      box(ctx,7,-L+8,6,4,1,this.status==="pasif"?"#627682":"#fff2c0");
      // Rod cradle, solid steel rods and collars.
      for(let i=0;i<this.rackRods;i++) {
        line(ctx,[[-15-i*3,-16],[-12-i*3,-Math.min(98,L*.65)]],"#788e97",2.1);
        line(ctx,[[-14.6-i*3,-16],[-11.6-i*3,-Math.min(98,L*.65)]],"#c4d0d3",.55);
      }
      line(ctx,[[-27,-24],[-8,-24]],"#2a414d",2);line(ctx,[[-22,-83],[-8,-83]],"#2a414d",2);
      if(this.erect>.9) {
        box(ctx,-9,-9,18,8,2,"#4e6773");box(ctx,-6,-7,12,4,1,this.phase==="clamp"?shade(accent,.9):"#213b48");
        bolt(ctx,-7,-5,.9);bolt(ctx,7,-5,.9);
      }
      line(ctx,[[0,-L-5],[0,this.headY-9]],"rgba(190,208,217,.6)",.7);
      this.drawHead(ctx,this.headY);this.drawRodSwing(ctx,this.headY);ctx.restore();
    }

    drawHead(ctx, headY) {
      const drilling = this.isDrilling();
      const jx = drilling ? Math.sin(this.time * 46) * 0.6 : 0;

      ctx.save();
      ctx.translate(jx, headY);

      // tij dizisi (mast dikken)
      if (this.erect > 0.97 && this.opPhase !== "raise") {
        const alpha = this.opPhase === "tripout" ? 0.25 + this.rodVis * 0.75 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#39404e";
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(-jx * 0.5, -headY - 2); ctx.stroke();
        ctx.fillStyle = "#5d6b80";
        for (let y = 22; y < -headY - 4; y += 26) {
          rr(ctx, -3.6, y, 7.2, 4, 1.5); ctx.fill();
        }
        ctx.restore();
      }

      const hg = ctx.createLinearGradient(-15, -10, -15, 10);
      hg.addColorStop(0, "#33405a");
      hg.addColorStop(1, "#1c2330");
      ctx.fillStyle = hg;
      rr(ctx, -15, -10, 30, 19, 4); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(11, -6); ctx.stroke();
      ctx.fillStyle = colA(this.opts.color, this.status === "pasif" ? 0.3 : 0.9);
      rr(ctx, -15, -2, 3, 8, 1); ctx.fill();

      ctx.save();
      ctx.translate(0, 13);
      ctx.rotate(this.spin);
      ctx.fillStyle = "#5a6a82";
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1c2330"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI * 2 / 3);
        ctx.fillStyle = "#7a8aa3";
        rr(ctx, 4.5, -1.7, 4, 3.4, 1); ctx.fill();
      }
      ctx.restore();
      ctx.restore();
    }

    drawRodSwing(ctx, headY) {
      if (this.status !== "aktif" || this.opPhase !== "work" || this.erect < 0.985) return;
      const t = clamp(this.phaseT / PHASES.rodswing.dur, 0, 1);

      if (this.phase === "rodswing") {
        const e = easeInOut(t);
        const x = lerp(-12, 0, e);
        const rot = lerp(-0.16, 0, e);
        const y = lerp(-60, headY + 20, e);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.strokeStyle = "#6b7a92";
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 13); ctx.stroke();
        ctx.restore();
      }

      if (this.phase === "wl_down" || this.phase === "wl_grab" || this.phase === "wl_up") {
        const holeBot = 8 + (this.opts.plannedDepth > 0 ? clamp(this.depth / this.opts.plannedDepth,0,1) : clamp(this.depth/150,0,1)) * 31;
        let y;
        if (this.phase === "wl_down") y = lerp(headY + 14, holeBot, easeInOut(clamp(this.phaseT / PHASES.wl_down.dur, 0, 1)));
        else if (this.phase === "wl_grab") y = holeBot;
        else y = lerp(holeBot, headY + 14, easeInOut(clamp(this.phaseT / PHASES.wl_up.dur, 0, 1)));

        ctx.strokeStyle = "rgba(190,200,215,.55)";
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(0, headY + 9); ctx.lineTo(0, y - 8); ctx.stroke();

        if (this.phase === "wl_up") {
          const cg = ctx.createLinearGradient(-3, y - 8, 3, y + 10);
          cg.addColorStop(0, "#f0d68c");
          cg.addColorStop(1, "#8a6b38");
          ctx.fillStyle = cg;
          rr(ctx, -3.2, y - 8, 6.4, 18, 3); ctx.fill();
        } else {
          ctx.fillStyle = "#7a8aa3";
          rr(ctx, -2.6, y - 7, 5.2, 12, 2.5); ctx.fill();
        }
      }
    }

    drawHoleString(ctx) {
      if(this.rodVis<=.01 || this.erect<.97 || ["walkout","walkin","raise"].includes(this.opPhase)) return;
      const prog=this.opts.plannedDepth>0?clamp(this.displayDepth/this.opts.plannedDepth,0,1):clamp(this.displayDepth/150,0,1);
      const bitY=lerp(4,8+prog*31,this.rodVis),drilling=this.isDrilling();
      ctx.save();ctx.translate(BASE_X,BASE_Y);ctx.rotate(LEAN_DEG*RAD);
      line(ctx,[[0,2],[0,bitY-2]],"#9baeb4",2.1);line(ctx,[[-.65,2],[-.65,bitY-2]],"#e1e7e7",.4);
      for(let y=9;y<bitY-3;y+=10)box(ctx,-1.6,y,3.2,1,.3,"#597785");
      // Downward annular flush and upward return: conceptual cutaway.
      if(drilling){for(let i=0;i<3;i++){
        let y=3+((this.time*13+i*11)%Math.max(4,bitY-4));line(ctx,[[-2.7,y-2],[-2.7,y+1]],"#62bacd",.7);
        y=bitY-((this.time*11+i*9)%Math.max(4,bitY-2));line(ctx,[[2.7,y+1],[2.7,y-2]],"#d2b481",.7);
      }}
      box(ctx,-2,bitY-3,4,5,.7,this.opts.color);line(ctx,[[-2,bitY+2],[2,bitY+2]],"#deeced",.9);
      if(drilling){const g=ctx.createRadialGradient(0,bitY,0,0,bitY,7);g.addColorStop(0,colA(this.opts.color,.24));g.addColorStop(1,colA(this.opts.color,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,bitY,7,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }

    drawEffects(ctx) {
      const drilling = this.isDrilling();

      for (const r of this.ripples) {
        const t = r.age / r.life;
        ctx.strokeStyle = `rgba(150,120,80,${(1 - t) * 0.32})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(BASE_X, BASE_Y + 1, 7 + t * 17, 2 + t * 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (drilling) {
        const vib = Math.abs(Math.sin(this.time * 3.4));
        ctx.strokeStyle = colA(this.opts.color, 0.1 + vib * 0.12);
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.ellipse(BASE_X, BASE_Y, 16 + i * 9 + vib * 3, 3.5 + i, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      for (const d of this.dust) {
        const a = (1 - d.age / d.life) * 0.14;
        ctx.fillStyle = `rgba(181,154,118,${a})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of this.chips) {
        ctx.fillStyle = colA(p.c, 1 - p.age / p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const s of this.smoke) {
        const a = (1 - s.age / s.life) * 0.18;
        ctx.fillStyle = `rgba(168,176,188,${a})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * 1.3, s.r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.sparks.length) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const k of this.sparks) {
          const a = 1 - k.age / k.life;
          ctx.strokeStyle = `rgba(255,214,130,${a})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(k.x, k.y);
          ctx.lineTo(k.x - k.vx * 0.02, k.y - k.vy * 0.02);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    /* --- operatör --- */
    drawOperator(ctx) {
      const m = this.man;
      if (!m.present) return;
      if (this.status === "durak") { m.moving=false; return; }
      const x = m.x;
      const footY = 241;
      const lean = this.status === "durak" && !m.moving;
      const crouch = m.trayTimer > 0 && m.trayTimer < 1.2 && !m.moving;
      const carrying = this.phase === "core_transfer" && m.moving;

      const bodyH = crouch ? 8 : 11;
      const headCY = footY - bodyH - 5.5 - (crouch ? -1 : 0);
      const tilt = lean ? -0.12 : 0;

      ctx.save();
      ctx.translate(x, footY);
      ctx.rotate(tilt);
      ctx.scale(1.15, 1.15);

      // bacaklar
      const sw = m.moving ? Math.sin(m.step) * 2.6 : 0;
      ctx.strokeStyle = "#1c2330";
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -bodyH + 2); ctx.lineTo(-1.4 + sw, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -bodyH + 2); ctx.lineTo(1.4 - sw, 0); ctx.stroke();
      // gövde (reflektörlü yelek)
      ctx.fillStyle = "#f59739";
      rr(ctx, -2.4, -bodyH - 4, 4.8, bodyH, 2); ctx.fill();
      ctx.strokeStyle = "rgba(245,217,138,.65)";
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(-2.4, -bodyH + 1); ctx.lineTo(2.4, -bodyH + 1); ctx.stroke();
      // kollar
      ctx.strokeStyle = "#2e3a4d";
      ctx.lineWidth = 1.6;
      if (carrying) {
        // karot tüpü taşıyor
        ctx.beginPath(); ctx.moveTo(0, -bodyH - 1); ctx.lineTo(4.5, -bodyH - 4); ctx.stroke();
        const cg = ctx.createLinearGradient(3, -bodyH - 8, 7, -bodyH - 1);
        cg.addColorStop(0, "#e8c97e"); cg.addColorStop(1, "#8a6b38");
        ctx.fillStyle = cg;
        rr(ctx, 3.4, -bodyH - 9, 2.6, 8, 1.2); ctx.fill();
      } else if (this.phase === "rodswing" && this.opPhase === "work" && this.status === "aktif") {
        ctx.beginPath(); ctx.moveTo(0, -bodyH - 1); ctx.lineTo(3.6, -bodyH - 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -bodyH - 1); ctx.lineTo(-3, -bodyH - 5); ctx.stroke();
      } else if (lean) {
        ctx.beginPath(); ctx.moveTo(0, -bodyH - 1); ctx.lineTo(3.4, -bodyH + 2); ctx.stroke();
      } else {
        // panelde: bir kol önde
        ctx.beginPath(); ctx.moveTo(0, -bodyH - 1); ctx.lineTo(3.8, -bodyH - 1.5); ctx.stroke();
      }
      // kafa + baret (makine renginde)
      ctx.fillStyle = "#c9a079";
      ctx.beginPath(); ctx.arc(0, -bodyH - 6.5, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.opts.color;
      ctx.beginPath(); ctx.arc(0, -bodyH - 7, 2.2, Math.PI, 0); ctx.fill();
      ctx.restore();
    }

    drawHUD(ctx) {
      const P=PALETTES[this.opts.theme],state=this.getState();
      if(this._ownsAria && this.canvas.getAttribute("aria-label")!==this.opts.machineName)this.canvas.setAttribute("aria-label",this.opts.machineName);
      if(!this.opts.showDepth)return;
      box(ctx,7,288,186,26,4,P.panel);
      const percent=state.progress===null?null:Math.round(state.progress*100);
      label(ctx,"DERİNLİK",14,296,4.3,P.muted,700);
      ctx.font="700 10px ui-monospace,Consolas,monospace";ctx.fillStyle=P.ink;ctx.fillText(this.displayDepth.toFixed(1),14,308);
      const length=ctx.measureText(this.displayDepth.toFixed(1)).width;label(ctx,"m",16+length,308,5.8,P.muted,600);
      ctx.textAlign="right";label(ctx,this.opts.plannedDepth>0?"HEDEF "+this.opts.plannedDepth.toFixed(0)+" m":"HEDEF TANIMSIZ",185,296,4.3,P.muted,600);
      label(ctx,percent===null?"—":percent+"%",185,307,8,P.ink,700);ctx.textAlign="left";
      box(ctx,80,304,75,2.5,1,P.line);if(state.progress!==null)box(ctx,80,304,75*state.progress,2.5,1,this.opts.color);
    }
  }

  const RigAnim = {
    version: "3.0.0",
    mount(canvasElement, options) {
      if (!canvasElement || !canvasElement.getContext) {
        throw new Error("RigAnim.mount requires a canvas element.");
      }
      return new RigController(canvasElement, options);
    }
  };

  global.RigAnim = RigAnim;
  if (typeof module !== "undefined" && module.exports) module.exports = RigAnim;
})(typeof window !== "undefined" ? window : globalThis);

export const RigAnim = globalThis.RigAnim;
export default globalThis.RigAnim;
