/* ============================================================
   DDH TAKIP — Rig Animation Engine v2.1
   RigAnim.mount(canvas, options) — v1/v2 API uyumlu
   v2.1 yenilikleri:
   - OPERASYON YAŞAM DÖNGÜSÜ: mast kurulumu (hidrolik silindirle),
     kuyu bitince tij çekme (trip-out), mast indirme, paletlerle
     yeni lokasyona yürüyüş, yeniden kurulum (autoCycle)
   - ÇAMUR SİSTEMİ: çamur havuzu, emiş + basma hortumu (kafa ile
     birlikte hareket eder), kuyudan dönen kırıntılı su akışı
   - OPERATÖR: delgide panelde, tij ekmede mastta, karot alımında
     tepsiye yürür, durakta makineye yaslanır
   options: { status, machineName, color, showDepth, initialDepth,
              plannedDepth, autoAdvance, autoCycle }
   ============================================================ */
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
    return {
      r: parseInt(full.slice(0, 2), 16) || 245,
      g: parseInt(full.slice(2, 4), 16) || 185,
      b: parseInt(full.slice(4, 6), 16) || 66
    };
  }
  const colA = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };
  const shade = (hex, f) => {
    const c = hexToRgb(hex);
    const m = v => clamp(Math.round(v * f), 0, 255);
    return `rgb(${m(c.r)},${m(c.g)},${m(c.b)})`;
  };
  const normalizeStatus = s => (STATES.has(s) ? s : "pasif");

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

  const REDUCED = typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- paylaşımlı ticker ---------- */
  const Ticker = {
    set: new Set(),
    raf: 0,
    last: 0,
    add(c) {
      this.set.add(c);
      if (!this.raf && !REDUCED) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.tick);
      }
    },
    remove(c) {
      this.set.delete(c);
      if (!this.set.size && this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    },
    tick: (now) => {
      Ticker.raf = 0;
      const dt = clamp((now - Ticker.last) / 1000, 0, 0.05);
      Ticker.last = now;
      for (const c of Ticker.set) c.frame(dt);
      if (Ticker.set.size) Ticker.raf = requestAnimationFrame(Ticker.tick);
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (Ticker.raf) { cancelAnimationFrame(Ticker.raf); Ticker.raf = 0; }
      } else if (Ticker.set.size && !Ticker.raf && !REDUCED) {
        Ticker.last = performance.now();
        Ticker.raf = requestAnimationFrame(Ticker.tick);
      }
    });
  }
  const IO = (typeof IntersectionObserver !== "undefined")
    ? new IntersectionObserver(entries => {
        for (const e of entries) {
          const c = e.target.__rigController;
          if (c) c.visible = e.isIntersecting;
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
    rodswing: { dur: 0.9 },
    clamp:    { dur: 0.35 }
  };
  const HEAD_BOT = -56;

  // operasyon (yaşam döngüsü) faz etiketleri — HUD'da gösterilir
  const OP_LABEL = {
    work: null,
    tripout: "TİJ ÇEKİLİYOR",
    lower: "MAST İNDİRİLİYOR",
    walkout: "YENİ LOKASYONA",
    walkin: "YENİ LOKASYONA",
    raise: "MAST KURULUYOR",
    done: "TAMAMLANDI"
  };

  class RigController {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      canvas.__rigController = this;

      this.opts = {
        status: normalizeStatus(options.status || "pasif"),
        machineName: options.machineName || "DDH RIG",
        color: options.color || "#f5b942",
        showDepth: options.showDepth !== false,
        initialDepth: Number(options.initialDepth || 0),
        plannedDepth: Number(options.plannedDepth || 0),
        autoAdvance: options.autoAdvance !== false,
        autoCycle: options.autoCycle !== false
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
      this.rodCount = 0;
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

      if (REDUCED) this.renderFrame();
      else this.start();
    }

    /* ---------- yaşam döngüsü ---------- */
    resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, DPR_MAX);
      this.dpr = dpr;
      const cs = getComputedStyle(this.canvas);
      const cssW = parseFloat(cs.width) || LOGICAL_W;
      const cssH = parseFloat(cs.height) || LOGICAL_H;
      if (!this.canvas.style.width) this.canvas.style.width = LOGICAL_W + "px";
      if (!this.canvas.style.height) this.canvas.style.height = LOGICAL_H + "px";
      const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
      if (this.canvas.width !== w) this.canvas.width = w;
      if (this.canvas.height !== h) this.canvas.height = h;
      this.scaleX = cssW / LOGICAL_W;
      this.scaleY = cssH / LOGICAL_H;
      this._staticDirty = true;
      if (REDUCED) this.renderFrame();
    }

    start() {
      if (this.destroyed || this.running || REDUCED) return;
      this.running = true;
      Ticker.add(this);
    }
    pause() { this.running = false; Ticker.remove(this); }
    resume() { this.start(); }

    destroy() {
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
      s = normalizeStatus(s);
      if (s === this.status) return;
      this.status = s;
      if (s === "aktif" && this.opPhase === "work") { this.phase = "drill"; this.phaseT = 0; }
      this._staticDirty = true;
      if (REDUCED) this.renderFrame();
    }
    setDepth(m) {
      const v = Number(m);
      if (Number.isFinite(v)) this.depth = v;
      if (REDUCED) { this.displayDepth = this.depth; this.renderFrame(); }
    }
    setPlannedDepth(m) {
      const v = Number(m);
      if (Number.isFinite(v)) { this.opts.plannedDepth = v; if (REDUCED) this.renderFrame(); }
    }
    getDepth() { return this.depth; }
    /** Kuyu tamamlandı durumundan yeni kuyuya manuel geçiş */
    newHole(plannedDepth) {
      if (Number.isFinite(Number(plannedDepth))) this.opts.plannedDepth = Number(plannedDepth);
      this.depth = 0; this.displayDepth = 0; this.coreCount = 0;
      this.rodVis = 1;
      this.opPhase = "raise"; this.opT = 0;
      this.phase = "drill"; this.phaseT = 0;
    }

    /* ---------- geometri yardımcıları ---------- */
    erectEase() { return easeInOut(clamp(this.erect, 0, 1)); }
    curMastLen() { return this.v.mastLen * (0.55 + 0.45 * this.erectEase()); }
    headTop() { return -(this.curMastLen() - 46); }
    mastSway() {
      return (this.status === "durak" && this.erect > 0.97)
        ? Math.sin(this.time * 2.1) * 0.6 : 0;
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
      this.update(dt);
      if (this.visible) this.renderFrame();
    }

    update(dt) {
      this.time += dt;
      this.displayDepth = lerp(this.displayDepth, this.depth, clamp(dt * 6, 0, 1));
      this.depthFlash = Math.max(0, this.depthFlash - dt * 1.6);

      // mast kurulum/indirme hedefi
      const wantUp = this.status !== "pasif" &&
        !["lower", "walkout", "walkin", "done"].includes(this.opPhase);
      const target = wantUp ? 1 : 0;
      this.erect += clamp(target - this.erect, -dt / 2.4, dt / 2.4);

      const targetSpin = this.isDrilling() ? 10 : 0;
      this.spinSpeed = lerp(this.spinSpeed, targetSpin, clamp(dt * 4, 0, 1));
      this.spin += this.spinSpeed * dt;

      // operasyon yaşam döngüsü
      if (this.status === "aktif") this.updateOp(dt);

      if (this.status === "aktif" && this.opPhase === "work" && this.erect > 0.985) {
        this.updateCycle(dt);
      } else {
        const park = (this.status === "durak" && this.erect > 0.97) ? -112 : this.headTop();
        this.headY = lerp(this.headY, park, clamp(dt * 3, 0, 1));
      }

      // efekt üretimi
      if (this.isDrilling()) {
        this.emit("chip", this.chips, dt, 9, 10, () => this.mkChip());
        this.emit("dust", this.dust, dt, 3.5, 8, () => this.mkDust());
        this._accRip = (this._accRip || 0) + dt * 1.6;
        if (this._accRip >= 1 && this.ripples.length < 4) {
          this._accRip = 0;
          this.ripples.push({ age: 0, life: 1.3 });
        }
        if (Math.random() < dt * 0.9)
          for (let i = 0; i < 4; i++) this.sparks.push(this.mkSpark());
        // dönüş suyu akışı
        for (let i = 0; i < this.flow.length; i++)
          this.flow[i] = (this.flow[i] + dt * 0.55) % 1;
      }
      const walking = this.opPhase === "walkout" || this.opPhase === "walkin";
      if (walking) {
        this.emit("wdust", this.dust, dt, 6, 10, () => this.mkWalkDust());
      }
      if (this.status !== "pasif") {
        const rate = (this.status === "aktif" && this.opPhase !== "done") ? 3.6 : 1.1;
        this.emit("smoke", this.smoke, dt, rate, 12, () => this.mkSmoke());
      }
      this.stepParticles(dt);
      this.updateOperator(dt);
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
          if (this.walkX > 96) {
            // yeni kuyu: sahaya soldan giriş
            this.depth = 0; this.displayDepth = 0;
            this.coreCount = 0; this.rodCount = 0;
            this.walkX = -150;
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
      this.phaseT += dt;
      const def = PHASES[this.phase];
      const t = clamp(this.phaseT / def.dur, 0, 1);
      const top = this.headTop();

      switch (this.phase) {
        case "drill":
          this.headY = lerp(top, HEAD_BOT, easeInOut(clamp(t * 1.04, 0, 1)));
          if (this.opts.autoAdvance) this.depth += (ROD_METERS / def.dur) * dt;
          break;
        case "lift":
          this.headY = lerp(HEAD_BOT, top, easeOutCubic(t));
          break;
        default:
          this.headY = top;
      }

      if (t >= 1) {
        this.phaseT = 0;
        if (this.phase === "drill") {
          this.rodCount++;
          // kuyu bitti mi?
          if (this.opts.plannedDepth > 0 && this.depth >= this.opts.plannedDepth) {
            this.depth = this.opts.plannedDepth;
            this.depthFlash = 1;
            this.opPhase = "tripout"; this.opT = 0;
            this.phase = "clamp";
            return;
          }
          this.phase = "lift";
        } else if (this.phase === "lift") {
          this.phase = (this.rodCount % 4 === 0) ? "wl_down" : "rodswing";
        } else if (this.phase === "wl_down") this.phase = "wl_grab";
        else if (this.phase === "wl_grab") this.phase = "wl_up";
        else if (this.phase === "wl_up") {
          this.coreCount = (this.coreCount % 6) + 1;
          this.depthFlash = 1;
          this.man.trayTimer = 2.4;   // operatör tepsiye gider
          this.phase = "rodswing";
        } else if (this.phase === "rodswing") {
          this.rackRods = this.rackRods > 1 ? this.rackRods - 1 : 4;
          this.phase = "clamp";
        } else if (this.phase === "clamp") this.phase = "drill";
      }
    }

    /* ---------- operatör ---------- */
    updateOperator(dt) {
      const m = this.man;
      m.trayTimer = Math.max(0, m.trayTimer - dt);

      const walking = ["lower", "walkout", "walkin", "raise"].includes(this.opPhase);
      m.present = this.status !== "pasif" && !walking && this.opPhase !== "done";

      if (!m.present) return;

      if (m.trayTimer > 0.6) m.tx = TRAY.x + 8;                  // karot taşıma
      else if (this.status === "durak") m.tx = 52;               // yaslanma
      else if (this.opPhase === "tripout") m.tx = 58;            // mast dibi
      else if (this.phase === "rodswing") m.tx = 58;
      else m.tx = 42;                                            // kumanda paneli

      const dx = m.tx - m.x;
      const sp = clamp(dx, -dt * 24, dt * 24);
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
      const sp = 30 + Math.random() * 34;
      return { x: BASE_X, y: BASE_Y, vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp * 0.7,
        age: 0, life: 0.7 + Math.random() * 0.5, r: 1.2 + Math.random() * 1.6,
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
      return { x: 148 + this.walkX + Math.random() * 4, y: 158,
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
      if (!this._static) this._static = document.createElement("canvas");
      const s = this._static;
      s.width = this.canvas.width;
      s.height = this.canvas.height;
      const ctx = s.getContext("2d");
      ctx.setTransform(this.dpr * this.scaleX, 0, 0, this.dpr * this.scaleY, 0, 0);

      // gökyüzü
      const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
      sky.addColorStop(0, "#f8fafc");
      sky.addColorStop(0.7, "#eef4fb");
      sky.addColorStop(1, "#e8eef6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      ctx.fillStyle = "rgba(93,105,125,.08)";
      for (let y = 12; y < GROUND_Y - 8; y += 16)
        for (let x = 8; x < LOGICAL_W; x += 16)
          ctx.fillRect(x, y, 1, 1);

      ctx.fillStyle = "#dfe7f0";
      ctx.beginPath();
      ctx.moveTo(0, 226);
      ctx.lineTo(36, 214); ctx.lineTo(78, 224); ctx.lineTo(120, 210);
      ctx.lineTo(160, 222); ctx.lineTo(200, 212); ctx.lineTo(200, GROUND_Y);
      ctx.lineTo(0, GROUND_Y);
      ctx.closePath(); ctx.fill();

      const gr = ctx.createLinearGradient(0, GROUND_Y, 0, LOGICAL_H);
      gr.addColorStop(0, "#edf2f7");
      gr.addColorStop(1, "#d8e1eb");
      ctx.fillStyle = gr;
      ctx.fillRect(0, GROUND_Y, LOGICAL_W, LOGICAL_H - GROUND_Y);
      ctx.strokeStyle = "rgba(100,116,139,.22)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(LOGICAL_W, GROUND_Y); ctx.stroke();

      const rnd = seedFrom(this.opts.machineName + "rocks");
      ctx.fillStyle = "#c3ccd8";
      for (let i = 0; i < 14; i++) {
        const x = rnd() * LOGICAL_W, y = GROUND_Y + 6 + rnd() * 60, w = 1 + rnd() * 2.4;
        ctx.fillRect(x, y, w, w * 0.7);
      }

      // yeraltı kuyu kesiti
      ctx.save();
      ctx.translate(BASE_X, BASE_Y);
      ctx.rotate(LEAN_DEG * RAD);
      const holeG = ctx.createLinearGradient(0, 0, 0, 76);
      holeG.addColorStop(0, "#06080c");
      holeG.addColorStop(1, "#0a0d13");
      ctx.fillStyle = holeG;
      rr(ctx, -4, 0, 8, 78, 3); ctx.fill();
      ctx.strokeStyle = "rgba(245,185,66,.22)";
      ctx.lineWidth = 0.8;
      for (let y = 12; y < 76; y += 16) {
        ctx.beginPath(); ctx.moveTo(-6.5, y); ctx.lineTo(-4, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(6.5, y); ctx.stroke();
      }
      ctx.fillStyle = "#39404e";
      rr(ctx, -5.5, -9, 11, 11, 2); ctx.fill();
      ctx.fillStyle = colA(this.opts.color, 0.75);
      ctx.fillRect(-5.5, -6, 11, 2.2);
      ctx.restore();

      // dönüş suyu kanalı (kuyu → havuz)
      ctx.strokeStyle = "rgba(60,50,34,.85)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(BASE_X - 6, BASE_Y + 1);
      ctx.quadraticCurveTo(52, 250, PIT.x + PIT.w - 2, PIT.y + 4);
      ctx.stroke();

      // çamur havuzu (kazı + kenar)
      ctx.fillStyle = "#0c0f15";
      rr(ctx, PIT.x, PIT.y, PIT.w, PIT.h, 3); ctx.fill();
      ctx.strokeStyle = "rgba(150,170,205,.22)";
      ctx.lineWidth = 0.9;
      rr(ctx, PIT.x, PIT.y, PIT.w, PIT.h, 3); ctx.stroke();

      // karot tepsisi
      ctx.fillStyle = "#1b2230";
      rr(ctx, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 2); ctx.fill();
      ctx.strokeStyle = "rgba(150,170,205,.2)"; ctx.lineWidth = 0.8;
      rr(ctx, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 2); ctx.stroke();
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(TRAY.x + i * (TRAY.w / 6), TRAY.y);
        ctx.lineTo(TRAY.x + i * (TRAY.w / 6), TRAY.y + TRAY.h);
        ctx.stroke();
      }

      this._staticDirty = false;
    }

    /* ---------- çizim ---------- */
    renderFrame() {
      const ctx = this.ctx;
      if (this._staticDirty) this.buildStatic();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this._static, 0, 0);
      ctx.setTransform(this.dpr * this.scaleX, 0, 0, this.dpr * this.scaleY, 0, 0);

      const off = this.status === "pasif";

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

      if (off) {
        ctx.fillStyle = "rgba(248,250,252,.42)";
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }
      this.drawHUD(ctx);
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
      g.addColorStop(0, "#6b5638");
      g.addColorStop(1, "#403322");
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
      if (this.erect < 0.5) return;
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
      for (let i = 0; i < this.coreCount; i++) {
        const g = ctx.createLinearGradient(0, TRAY.y + 2, 0, TRAY.y + 9);
        g.addColorStop(0, "#e8c97e");
        g.addColorStop(1, "#8a6b38");
        ctx.fillStyle = g;
        rr(ctx, TRAY.x + 2 + i * (TRAY.w / 6), TRAY.y + 2.5, 4.4, 7, 2);
        ctx.fill();
      }
    }

    drawCrawler(ctx) {
      const w = this.v.bodyW + 14;
      const x0 = 96 - w / 2 + 14;
      const walking = this.opPhase === "walkout" || this.opPhase === "walkin";
      ctx.save();
      ctx.translate(this.walkX, this.walkBob());

      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.beginPath();
      ctx.ellipse(x0 + w / 2, 238, w * 0.56, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c2330";
      rr(ctx, x0, 216, w, 22, 10); ctx.fill();
      ctx.fillStyle = "#11161f";
      rr(ctx, x0 + 4, 220, w - 8, 15, 7); ctx.fill();

      // pabuçlar — yürürken kayar
      const treadOff = walking ? (this.walkX * 1.4) % 9 : 0;
      ctx.strokeStyle = "rgba(255,255,255,.1)";
      ctx.lineWidth = 1;
      for (let x = x0 + 4 - treadOff; x < x0 + w - 4; x += 9) {
        if (x < x0 + 2) continue;
        ctx.beginPath(); ctx.moveTo(x, 217); ctx.lineTo(x - 3, 237); ctx.stroke();
      }
      const wheelSpin = walking ? this.walkX * 0.3 : 0;
      for (const fx of [0.18, 0.5, 0.82]) {
        const cx = x0 + w * fx;
        ctx.fillStyle = "#3a465c";
        ctx.beginPath(); ctx.arc(cx, 227, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#202938";
        ctx.save();
        ctx.translate(cx, 227);
        ctx.rotate(wheelSpin);
        ctx.fillRect(-1, -4.5, 2, 9);
        ctx.restore();
        ctx.fillStyle = "#202938";
        ctx.beginPath(); ctx.arc(cx, 227, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawBody(ctx) {
      const accent = this.opts.color;
      const w = this.v.bodyW;
      const x0 = 96 - w / 2 + 14;
      const active = this.status === "aktif";
      const off = this.status === "pasif";
      const walking = this.opPhase === "walkout" || this.opPhase === "walkin";

      ctx.save();
      ctx.translate(this.walkX, this.walkBob());

      ctx.fillStyle = "#141a26";
      rr(ctx, x0 - 2, 207, w + 4, 10, 3); ctx.fill();

      const body = ctx.createLinearGradient(x0, 164, x0, 210);
      body.addColorStop(0, shade(accent, off ? 0.55 : 1.12));
      body.addColorStop(0.6, shade(accent, off ? 0.4 : 0.86));
      body.addColorStop(1, shade(accent, off ? 0.28 : 0.5));
      ctx.fillStyle = body;
      rr(ctx, x0, 168, w, 41, 5); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1;
      rr(ctx, x0, 168, w, 41, 5); ctx.stroke();
      if (this.v.stripe) {
        ctx.fillStyle = "rgba(12,15,22,.55)";
        ctx.fillRect(x0 + 4, 196, w - 8, 5);
      }

      // motor panjuru
      ctx.fillStyle = "#1d2433";
      rr(ctx, x0 + 6, 175, 26, 26, 3); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 0.9;
      for (let y = 179; y < 199; y += 4.4) {
        ctx.beginPath(); ctx.moveTo(x0 + 9, y); ctx.lineTo(x0 + 29, y); ctx.stroke();
      }

      // çamur pompası (piston animasyonlu)
      const pumpOn = this.isDrilling();
      ctx.fillStyle = "#222b3c";
      rr(ctx, x0 + 14, 204, 16, 9, 2); ctx.fill();
      const pst = pumpOn ? Math.sin(this.time * 14) * 2 : 0;
      ctx.fillStyle = pumpOn ? "#7a8aa3" : "#3a465c";
      rr(ctx, x0 + 18 + pst, 206, 5, 5, 1); ctx.fill();

      // kabin + cam
      const cabX = x0 + w - 36;
      ctx.fillStyle = "#222b3c";
      rr(ctx, cabX, 172, 30, 32, 3); ctx.fill();
      const glow = off ? 0 : (walking ? 1 : (active ? 0.85 : 0.4));
      const win = ctx.createLinearGradient(cabX + 3, 176, cabX + 3, 190);
      win.addColorStop(0, `rgba(255,222,140,${0.16 + glow * 0.5})`);
      win.addColorStop(1, `rgba(160,190,235,${0.1 + glow * 0.22})`);
      ctx.fillStyle = win;
      rr(ctx, cabX + 4, 176, 22, 13, 2); ctx.fill();

      // çakar lamba — yürüyüşte ve durakta yanıp söner
      const beaconOn = (this.status === "durak" || walking)
        ? (Math.sin(this.time * 5.2) > 0)
        : active;
      ctx.fillStyle = "#39404e";
      rr(ctx, cabX + 11, 166, 8, 6, 1.5); ctx.fill();
      ctx.fillStyle = beaconOn ? "#ffb347" : "#5d4a26";
      rr(ctx, cabX + 12.5, 162, 5, 5, 2); ctx.fill();
      if (beaconOn && !off) {
        const bg = ctx.createRadialGradient(cabX + 15, 164, 1, cabX + 15, 164, 12);
        bg.addColorStop(0, "rgba(255,179,71,.5)");
        bg.addColorStop(1, "rgba(255,179,71,0)");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(cabX + 15, 164, 12, 0, Math.PI * 2); ctx.fill();
      }

      // egzoz bacası
      ctx.fillStyle = "#1a212e";
      rr(ctx, 147, 152, 6, 18, 2); ctx.fill();
      ctx.fillStyle = "#2b3445";
      rr(ctx, 145.5, 150, 9, 4, 1.5); ctx.fill();

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
      const L = this.curMastLen();
      const accent = this.opts.color;
      ctx.save();
      this.mastTransform(ctx);

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.fillStyle = "#161c28";
      rr(ctx, -8, -L, 16, L - 8, 2); ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "#3a465c";
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-6, -L + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(6, -L + 2); ctx.stroke();
      ctx.strokeStyle = "#2b3445";
      ctx.lineWidth = 1.3;
      for (let y = -16; y > -L + 8; y -= 13) {
        ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y - 6.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(-6, y - 6.5); ctx.stroke();
      }
      ctx.strokeStyle = colA(accent, this.status === "pasif" ? 0.35 : 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-8.5, -12); ctx.lineTo(-8.5, -L + 4); ctx.stroke();

      // tepe makarası + projektör
      ctx.fillStyle = "#39404e";
      rr(ctx, -7, -L - 12, 14, 14, 3); ctx.fill();
      ctx.fillStyle = "#11161f";
      ctx.beginPath(); ctx.arc(0, -L - 5, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#5a6a82"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -L - 5, 4.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = this.status === "pasif" ? "#3a3f4c" : "#f5d98a";
      rr(ctx, 5, -L + 8, 7, 5, 1.5); ctx.fill();

      // tij rafı (mast üstünde taşınır)
      for (let i = 0; i < this.rackRods; i++) {
        ctx.strokeStyle = i % 2 ? "#4b5563" : "#5d6b80";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-13 - i * 3, -14);
        ctx.lineTo(-10 - i * 3, -Math.min(96, L * 0.5));
        ctx.stroke();
      }

      // ayak kelepçesi (foot clamp)
      if (this.erect > 0.9) {
        ctx.fillStyle = "#2b3445";
        rr(ctx, -9, -7, 18, 6, 2); ctx.fill();
      }

      const headY = this.headY;
      ctx.strokeStyle = "rgba(190,200,215,.5)";
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, -L - 5); ctx.lineTo(0, headY - 9); ctx.stroke();

      this.drawHead(ctx, headY);
      this.drawRodSwing(ctx, headY);
      ctx.restore();
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
        const holeBot = 58;
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
      if (this.rodVis <= 0.01) return;
      const planned = this.opts.plannedDepth;
      const prog = planned > 0 ? clamp(this.displayDepth / planned, 0, 1) : 0.5;
      const fullBitY = 16 + prog * 52;
      const bitY = lerp(4, fullBitY, this.rodVis);   // trip-out'ta uç yukarı çekilir
      const drilling = this.isDrilling();

      ctx.save();
      ctx.translate(BASE_X, BASE_Y);
      ctx.rotate(LEAN_DEG * RAD);
      ctx.strokeStyle = `rgba(120,135,158,${0.4 * this.rodVis})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, bitY - 4); ctx.stroke();

      const pulse = drilling ? 0.55 + Math.abs(Math.sin(this.time * 9)) * 0.45 : 0.25;
      ctx.fillStyle = colA(this.opts.color, pulse * this.rodVis);
      ctx.beginPath();
      ctx.moveTo(-3.4, bitY - 4);
      ctx.lineTo(3.4, bitY - 4);
      ctx.lineTo(0, bitY + 3);
      ctx.closePath(); ctx.fill();
      if (drilling) {
        const g = ctx.createRadialGradient(0, bitY, 1, 0, bitY, 9);
        g.addColorStop(0, colA(this.opts.color, 0.4));
        g.addColorStop(1, colA(this.opts.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, bitY, 9, 0, Math.PI * 2); ctx.fill();
      }
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
      const x = m.x;
      const footY = 241;
      const lean = this.status === "durak" && !m.moving;
      const crouch = m.trayTimer > 0 && m.trayTimer < 1.2 && !m.moving;
      const carrying = m.trayTimer > 1.2;

      const bodyH = crouch ? 8 : 11;
      const headCY = footY - bodyH - 5.5 - (crouch ? -1 : 0);
      const tilt = lean ? -0.12 : 0;

      ctx.save();
      ctx.translate(x, footY);
      ctx.rotate(tilt);

      // bacaklar
      const sw = m.moving ? Math.sin(m.step) * 2.6 : 0;
      ctx.strokeStyle = "#1c2330";
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -bodyH + 2); ctx.lineTo(-1.4 + sw, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -bodyH + 2); ctx.lineTo(1.4 - sw, 0); ctx.stroke();
      // gövde (reflektörlü yelek)
      ctx.fillStyle = "#2e3a4d";
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
      const off = this.status === "pasif";
      const done = this.opPhase === "done";
      const ledColors = { aktif: "#5dd97c", durak: "#ffb347", pasif: "#5d6470" };
      const led = done ? "#5dd97c" : ledColors[this.status];
      const blink = done ? 1 : (this.status === "aktif"
        ? 0.6 + Math.abs(Math.sin(this.time * 3)) * 0.4
        : this.status === "durak" ? (Math.sin(this.time * 5.2) > 0 ? 1 : 0.3) : 0.7);
      ctx.fillStyle = led;
      ctx.globalAlpha = blink;
      ctx.beginPath(); ctx.arc(15, 17, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      if (!this.opts.showDepth) return;

      const flash = this.depthFlash;
      ctx.textAlign = "right";
      ctx.font = "700 15px ui-monospace, 'IBM Plex Mono', Consolas, monospace";
      ctx.fillStyle = flash > 0
        ? `rgba(${lerp(245, 255, flash)},${lerp(185, 255, flash)},${lerp(66, 230, flash)},1)`
        : (off ? "rgba(150,160,175,.85)" : "#f5b942");
      ctx.fillText(this.displayDepth.toFixed(1) + " m", 190, 22);

      ctx.textAlign = "left";
    }
  }

  const RigAnim = {
    version: "2.1.0",
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
