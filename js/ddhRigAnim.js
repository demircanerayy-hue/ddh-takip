const LOGICAL_W = 200;
const LOGICAL_H = 320;
const DPR_MAX = 3;
const DRILL_X = 66;
const MAST_LEAN_DEG = 9;
const STATES = new Set(["aktif", "durak", "pasif"]);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const raw = String(hex || "#e2c870").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw;
  return {
    r: parseInt(full.slice(0, 2), 16) || 226,
    g: parseInt(full.slice(2, 4), 16) || 200,
    b: parseInt(full.slice(4, 6), 16) || 112
  };
}

function colorAlpha(hex, a) {
  const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function normalizeStatus(status) { return STATES.has(status) ? status : "pasif"; }

class RigController {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = {
      status: normalizeStatus(options.status || "pasif"),
      machineName: options.machineName || "DDH RIG",
      color: options.color || "#e2c870",
      showDepth: options.showDepth !== false,
      initialDepth: Number(options.initialDepth || 0)
    };

    this.status = this.options.status;
    this.prevStatus = this.status;
    this.transition = 1;
    this.depth = this.options.initialDepth;
    this.displayDepth = this.depth;
    this.running = false;
    this.destroyed = false;
    this.raf = 0;
    this.last = 0;
    this.time = 0;
    this.rodOffset = 0;
    this.particles = [];
    this.smoke = [];
    this.vibration = 0;
    this.groundChips = Array.from({ length: 26 }, (_, i) => ({
      x: DRILL_X - 22 + ((i * 13) % 46),
      y: 241 + ((i * 7) % 13),
      w: 1 + (i % 3) * 0.5,
      c: i % 4 === 0 ? "#5a5a5a" : "#c4a882"
    }));

    this.resize();
    this.start();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    this.dpr = dpr;
    const cssW = parseFloat(getComputedStyle(this.canvas).width) || LOGICAL_W;
    const cssH = parseFloat(getComputedStyle(this.canvas).height) || LOGICAL_H;
    if (!this.canvas.style.width) this.canvas.style.width = `${LOGICAL_W}px`;
    if (!this.canvas.style.height) this.canvas.style.height = `${LOGICAL_H}px`;
    this.canvas.width = Math.round((cssW || LOGICAL_W) * dpr);
    this.canvas.height = Math.round((cssH || LOGICAL_H) * dpr);
    this.scaleX = (cssW || LOGICAL_W) / LOGICAL_W;
    this.scaleY = (cssH || LOGICAL_H) / LOGICAL_H;
  }

  start() {
    if (this.destroyed || this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume() { this.start(); }

  destroy() {
    this.pause();
    this.destroyed = true;
    this.particles.length = 0;
    this.smoke.length = 0;
    const ctx = this.ctx;
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setStatus(state) {
    state = normalizeStatus(state);
    if (state === this.status) return;
    this.prevStatus = this.status;
    this.status = state;
    this.transition = 0;
  }

  setDepth(meters) {
    const v = Number(meters);
    if (Number.isFinite(v)) this.depth = v;
  }

  loop = (now) => {
    if (!this.running || this.destroyed) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  isActive() { return this.status === "aktif"; }

  update(dt) {
    this.time += dt;
    this.transition = clamp(this.transition + dt / 0.4, 0, 1);
    this.displayDepth = lerp(this.displayDepth, this.depth, clamp(dt * 6, 0, 1));

    if (this.status === "aktif") {
      this.depth += dt * 0.18;
      this.rodOffset = (this.rodOffset + dt * 38) % 28;
      this.vibration = Math.sin(this.time * Math.PI * 2 / 1.8);
      this.spawnChips(dt);
    }

    if (this.status !== "pasif") this.spawnSmoke(dt);
    this.updateParticles(dt);
  }

  spawnChips(dt) {
    this._chipAcc = (this._chipAcc || 0) + dt * 10;
    while (this._chipAcc >= 1 && this.particles.length < 8) {
      this._chipAcc -= 1;
      const ang = (80 + Math.random() * 100) * Math.PI / 180;
      const speed = 32 + Math.random() * 30;
      this.particles.push({
        x: DRILL_X,
        y: 244,
        vx: Math.cos(ang) * speed,
        vy: -Math.sin(ang) * speed * 0.62,
        age: 0,
        life: 0.75 + Math.random() * 0.45,
        r: 1.3 + Math.random() * 1.7,
        c: Math.random() > 0.45 ? "#c4a882" : "#5a5a5a"
      });
    }
  }

  spawnSmoke(dt) {
    this._smokeAcc = (this._smokeAcc || 0) + dt * 3.2;
    while (this._smokeAcc >= 1 && this.smoke.length < 12) {
      this._smokeAcc -= 1;
      this.smoke.push({
        x: 154 + Math.random() * 4,
        y: 158,
        vx: -4 + Math.random() * 8,
        vy: -12 - Math.random() * 10,
        age: 0,
        life: 1.5 + Math.random() * 1.1,
        r: 3 + Math.random() * 5
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 72 * dt;
    }
    for (const s of this.smoke) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += dt * 5;
    }
    this.particles = this.particles.filter(p => p.age < p.life);
    this.smoke = this.smoke.filter(s => s.age < s.life);
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr * this.scaleX, 0, 0, dpr * this.scaleY, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.drawBackground(ctx);
    this.drawGround(ctx);
    this.drawCrawler(ctx);
    this.drawMachineBody(ctx);
    this.drawMast(ctx);
    this.drawDrillAssembly(ctx);
    this.drawEffects(ctx);
    this.drawLabels(ctx);

    if (this.transition < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - this.transition) * 0.12;
      ctx.fillStyle = this.prevStatus === "aktif" ? "#e2c870" : "#111827";
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }
  }

  drawBackground(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, "#f8fafc");
    bg.addColorStop(0.62, "#e8edf4");
    bg.addColorStop(1, "#d8dee8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  drawGround(ctx) {
    ctx.fillStyle = "#e3e7ee";
    ctx.fillRect(0, 240, LOGICAL_W, 80);
    ctx.fillStyle = "#d7dce5";
    ctx.beginPath();
    ctx.moveTo(0, 238);
    const pts = [[18,236],[34,242],[50,235],[70,240],[86,236],[104,244],[124,238],[144,241],[164,236],[184,242],[200,238]];
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(LOGICAL_W, LOGICAL_H);
    ctx.lineTo(0, LOGICAL_H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0b0907";
    rr(ctx, DRILL_X - 3, 244, 6, 76, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(226,200,112,.34)";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(DRILL_X - 5, 244); ctx.lineTo(DRILL_X - 5, 320); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DRILL_X + 5, 244); ctx.lineTo(DRILL_X + 5, 320); ctx.stroke();

    ctx.fillStyle = "#5a5a5a";
    ctx.beginPath();
    ctx.ellipse(DRILL_X, 246, 19, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const chip of this.groundChips) {
      ctx.fillStyle = chip.c;
      ctx.fillRect(chip.x, chip.y, chip.w, chip.w);
    }
  }

  drawCrawler(ctx) {
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.beginPath();
    ctx.ellipse(98, 236, 64, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a202c";
    rr(ctx, 42, 214, 112, 17, 7);
    ctx.fill();
    ctx.fillStyle = "#111827";
    rr(ctx, 50, 227, 96, 14, 6);
    ctx.fill();

    for (let row = 0; row < 2; row++) {
      const y = row ? 229 : 216;
      for (let x = 38; x < 158; x += 12) {
        ctx.fillStyle = row ? "#202938" : "#2b3445";
        rr(ctx, x, y, 8, 10, 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 1;
    for (let x = 44; x < 154; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, 215); ctx.lineTo(x + 9, 231); ctx.stroke();
    }

    for (const x of [58, 98, 138]) {
      ctx.fillStyle = "#4a5568";
      ctx.beginPath(); ctx.arc(x, 224, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#718096"; ctx.stroke();
    }

    ctx.strokeStyle = "rgba(226,200,112,.42)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(48, 213); ctx.lineTo(150, 213); ctx.stroke();
  }

  drawMachineBody(ctx) {
    const accent = this.options.color;
    ctx.fillStyle = "#111827";
    rr(ctx, 48, 205, 112, 9, 3);
    ctx.fill();

    const body = ctx.createLinearGradient(50, 164, 154, 213);
    body.addColorStop(0, "#f4c542");
    body.addColorStop(0.58, accent);
    body.addColorStop(1, "#916b16");
    ctx.fillStyle = body;
    rr(ctx, 52, 166, 104, 43, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "#2d3748";
    rr(ctx, 58, 174, 28, 27, 3);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    rr(ctx, 62, 177, 20, 14, 2);
    ctx.fill();

    ctx.fillStyle = "#c79018";
    rr(ctx, 92, 174, 54, 28, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.lineWidth = 0.9;
    for (let x = 96; x < 144; x += 7) {
      ctx.beginPath(); ctx.moveTo(x, 176); ctx.lineTo(x, 200); ctx.stroke();
    }
    for (let y = 179; y < 200; y += 6) {
      ctx.beginPath(); ctx.moveTo(94, y); ctx.lineTo(146, y); ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.beginPath(); ctx.moveTo(56, 168); ctx.lineTo(150, 168); ctx.stroke();

    ctx.fillStyle = "#111827";
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(59 + i * 9, 207, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#1a202c";
    rr(ctx, 148, 153, 6, 30, 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    rr(ctx, 32, 198, 4, 35, 2);
    rr(ctx, 164, 195, 4, 38, 2);
    ctx.fill();
    ctx.strokeStyle = "#718096";
    ctx.beginPath(); ctx.moveTo(34, 232); ctx.lineTo(25, 238); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(166, 232); ctx.lineTo(176, 238); ctx.stroke();
    this.drawSmoke(ctx);
  }

  drawSmoke(ctx) {
    for (const s of this.smoke) {
      const a = 1 - s.age / s.life;
      ctx.fillStyle = `rgba(180,185,190,${0.16 * a})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r * 1.35, s.r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMast(ctx) {
    const sway = this.status === "durak" ? Math.sin(this.time * Math.PI * 2 / 3) * 1.5 : 0;
    ctx.save();
    ctx.translate(68, 198);
    ctx.rotate((MAST_LEAN_DEG + sway) * Math.PI / 180);
    ctx.translate(-68, -198);

    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.strokeStyle = "#1a202c";
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(57, 216); ctx.lineTo(84, 27); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = this.options.color;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(58, 215); ctx.lineTo(84, 28); ctx.stroke();

    ctx.strokeStyle = "#10151f";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(52, 215); ctx.lineTo(78, 29); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(66, 217); ctx.lineTo(92, 32); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(61, 209); ctx.lineTo(86, 35); ctx.stroke();

    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y1 = 184 - i * 48;
      const y2 = y1 - 34;
      ctx.beginPath(); ctx.moveTo(56, y1); ctx.lineTo(84, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(70, y1 + 2); ctx.lineTo(72, y2 - 2); ctx.stroke();
    }

    ctx.fillStyle = "#718096";
    rr(ctx, 76, 22, 18, 14, 3);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(85, 29, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#c4a882";
    rr(ctx, 48, 122, 5, 68, 2);
    ctx.fill();
    ctx.fillStyle = "#e2c870";
    rr(ctx, 49, 150 + Math.sin(this.time * 1.6) * 3, 3, 33, 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(17,24,39,.85)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(84, 35);
    ctx.bezierCurveTo(63, 74, 69, 132, 58, 202);
    ctx.stroke();

    this.drawRotaryAndRod(ctx);
    ctx.restore();
  }

  headTravel() {
    if (this.status === "pasif") return 64;
    if (this.status === "durak") return 132;
    const p = easeInOut((Math.sin(this.time * Math.PI * 2 / 1.8 - Math.PI / 2) + 1) / 2);
    return 124 + p * 8;
  }

  drawRotaryAndRod(ctx) {
    const active = this.status === "aktif";
    const headY = this.headTravel();
    const headX = DRILL_X;
    const spin = active ? this.time * Math.PI * 1.15 : 0;
    const coreLift = active ? (this.time * 11) % 30 : 0;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.fillStyle = "#1f2937";
    rr(ctx, -14, -10, 28, 20, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-11, -7); ctx.lineTo(11, -7); ctx.stroke();

    ctx.save();
    ctx.globalAlpha = active ? 0.9 : 0.35;
    ctx.translate(0, 8 - coreLift);
    const core = ctx.createLinearGradient(-4, -16, 4, 8);
    core.addColorStop(0, "#f6e08d");
    core.addColorStop(0.45, "#d4a853");
    core.addColorStop(1, "#8a6b38");
    ctx.fillStyle = core;
    rr(ctx, -4, -16, 8, 24, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(73,50,18,.45)";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -16, 4, 1.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 8, 4, 1.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(spin);
    ctx.fillStyle = "#5a6a7a";
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.strokeStyle = "#111827";
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.fillStyle = "#718096";
      rr(ctx, 7, -2, 4, 4, 1);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(0, active ? Math.sin(this.time * 48) : 0);
    ctx.strokeStyle = "rgba(17,24,39,.55)";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(headX, headY + 10); ctx.lineTo(headX, 247); ctx.stroke();
    for (let y = headY + 12 - this.rodOffset; y < 247; y += 28) {
      const alt = Math.floor(y / 28) % 2;
      ctx.fillStyle = alt ? "#4b5563" : "#6b7280";
      rr(ctx, headX - 2.5, y, 5, 24, 2);
      ctx.fill();
      ctx.fillStyle = "#718096";
      rr(ctx, headX - 4, y + 22, 8, 4, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawDrillAssembly(ctx) {
    const active = this.status === "aktif";
    const bitX = DRILL_X + (active ? Math.sin(this.time * 70) : 0);
    const bitY = 238 + (active ? Math.cos(this.time * 64) : 0);
    ctx.save();
    ctx.strokeStyle = active ? "rgba(226,200,112,.28)" : "rgba(107,114,128,.18)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bitX, 202);
    ctx.lineTo(bitX, bitY - 8);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(bitX, bitY);
    ctx.rotate(active ? this.time * Math.PI * 6 : 0);
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "#d4a853";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8a6b38";
    for (const [x, y] of [[0, -2], [-4, 4], [4, 4]]) {
      ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawEffects(ctx) {
    if (this.status === "aktif") {
      const a = 0.18 + Math.abs(this.vibration) * 0.18;
      ctx.strokeStyle = `rgba(226,200,112,${a})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(DRILL_X, 244, 18 + i * 9 + Math.abs(this.vibration) * 3, 4 + i, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(196,168,130,${0.18 + Math.abs(this.vibration) * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(DRILL_X, 244, 15 + Math.abs(this.vibration) * 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      ctx.fillStyle = colorAlpha(p.c, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLabels(ctx) {
    ctx.font = "600 11px Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.fillText(this.options.machineName, 14, 22);

    if (this.options.showDepth) {
      ctx.font = "700 15px 'IBM Plex Mono', Consolas, monospace";
      ctx.fillStyle = "#e2c870";
      const text = `${this.displayDepth.toFixed(1)} m`;
      ctx.fillText(text, 122, 38);
    }
  }
}

export const RigAnim = {
  mount(canvasElement, options) {
    if (!canvasElement || !canvasElement.getContext) {
      throw new Error("RigAnim.mount requires a canvas element.");
    }
    return new RigController(canvasElement, options);
  }
};

export default RigAnim;
