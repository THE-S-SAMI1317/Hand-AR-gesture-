/**
 * renderer.js — Canvas drawing engine
 *
 * Performance principles applied throughout:
 *  • Camera feed drawn each frame (gives the AR look from the GIF)
 *  • shadowBlur set ONCE per batch pass, never inside loops
 *  • Two-pass skeleton: glow pass (thick+blurry) then crisp pass (thin+no blur)
 *  • Particles use globalAlpha only — no shadow
 *  • canvas context created with alpha:false (skips alpha compositing)
 *  • DPR capped at 2×
 */

import { CONFIG }  from './config.js';
import { toPx, smoothPt, dist, rnd, speed, clamp, mapRange } from './utils.js';

export class Renderer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video  = video;
    this.ctx    = canvas.getContext('2d', { alpha: false });

    // Smoothed per-hand landmark positions (label → array of {x,y})
    this._smooth   = {};
    this._prevWrist = {};

    // Particle pool
    this._particles = [];
    this._pFrame    = 0;

    // Free-draw strokes
    this._strokes     = [];
    this._live        = {};   // label → current stroke
    this._undoStack   = [];
    this._redoStack   = [];

    // Active settings (updated by UI)
    this.cfg = {
      lineW:      CONFIG.DEFAULTS.LINE_WIDTH,
      glow:       CONFIG.DEFAULTS.GLOW,
      smoothing:  CONFIG.DEFAULTS.SMOOTHING,
      showHands:  CONFIG.DEFAULTS.SHOW_HANDS,
      showDots:   CONFIG.DEFAULTS.SHOW_DOTS,
      showBones:  CONFIG.DEFAULTS.SHOW_BONES,
      theme:      CONFIG.DEFAULTS.THEME,
    };

    this.W = 0;
    this.H = 0;
    this._resize();
  }

  // ─── Canvas sizing ────────────────────────────────────────────
  _resize() {
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w    = Math.round(rect.width);
    const h    = Math.round(rect.height);
    if (this.W === w && this.H === h) return;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w;
    this.H = h;
  }

  onResize() { this._resize(); }

  // ─── MAIN RENDER (called every rAF) ──────────────────────────
  render(hands, mode) {
    this._resize(); // no-op if size unchanged
    const { ctx, W, H, video } = this;
    this._pFrame++;

    // 1. Camera feed — mirrored (this is what gives the AR look)
    if (video && video.readyState >= 2) {
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Dark vignette overlay so neon lines pop over any background
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(0, 0, W, H);

    // 3. Persistent free-draw strokes
    this._drawAllStrokes();

    // 4. Particles
    this._drawParticles();

    if (!hands || !hands.length) return;

    const theme = CONFIG.THEMES[this.cfg.theme] || CONFIG.THEMES.cyber;

    // 5. Per-hand rendering
    for (const hand of hands) {
      const color = theme[hand.label === 'Left' ? 'l' : 'r'];

      // Convert normalised landmarks → smoothed pixel coords
      const raw     = hand.lm.map(lm => toPx(lm, W, H));
      const pts     = this._smoothLandmarks(hand.label, raw);

      // Dynamic line width based on wrist movement speed
      const wrist = pts[CONFIG.LM.WRIST];
      const spd   = speed(this._prevWrist[hand.label], wrist);
      this._prevWrist[hand.label] = { x: wrist.x, y: wrist.y };
      const lw = clamp(this.cfg.lineW + mapRange(spd, 0, 25, 0, 2.5), 1, 10);

      if (this.cfg.showHands) {
        if (this.cfg.showBones) this._skeleton(pts, color, lw);
        if (this.cfg.showDots)  this._dots(pts, color);
      }

      if (mode === 'connect')  this._connectMode(pts, color, lw);
      if (mode === 'shape')    this._shapeMode(pts, color, lw);
      if (mode === 'freedraw') this._freeDraw(pts, color, lw, hand.label);

      // Spawn particles every Nth frame
      if (this._pFrame % CONFIG.PERF.PARTICLE_SKIP === 0) {
        this._spawnParticles(CONFIG.FINGERTIPS.map(i => pts[i]), color);
      }
    }

    // 6. Cross-hand beam
    if (hands.length === 2 && mode === 'connect') {
      this._crossBeam(hands, theme);
    }
  }

  // ─── Landmark smoothing ───────────────────────────────────────
  _smoothLandmarks(label, raw) {
    const t = 1 - this.cfg.smoothing;
    if (!this._smooth[label]) {
      this._smooth[label] = raw.map(p => ({ x: p.x, y: p.y }));
      return raw;
    }
    const prev = this._smooth[label];
    const out  = raw.map((p, i) => smoothPt(prev[i], p, t));
    this._smooth[label] = out;
    return out;
  }

  // ─── Skeleton ─────────────────────────────────────────────────
  _skeleton(pts, color, lw) {
    const { ctx } = this;

    // Pass A — glow (thick, blurry, low alpha) — ONE shadowBlur for ALL bones
    ctx.save();
    ctx.strokeStyle = color + '55';
    ctx.lineWidth   = lw * 2.2;
    ctx.lineCap     = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = this.cfg.glow * 1.8;
    ctx.beginPath();
    for (const [a, b] of CONFIG.CONNECTIONS) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();
    ctx.restore();

    // Pass B — crisp (thin, sharp, no blur) — zero shadowBlur cost
    ctx.save();
    ctx.strokeStyle = color + 'ee';
    ctx.lineWidth   = lw * 0.75;
    ctx.lineCap     = 'round';
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    for (const [a, b] of CONFIG.CONNECTIONS) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ─── Landmark dots ────────────────────────────────────────────
  _dots(pts, color) {
    const { ctx } = this;
    const g = this.cfg.glow;

    // Knuckle dots — no glow, all in one batched path
    ctx.save();
    ctx.fillStyle  = color + '88';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (CONFIG.FINGERTIPS.includes(i)) continue;
      ctx.moveTo(pts[i].x + 3, pts[i].y);
      ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // Fingertip glow rings — batched
    ctx.save();
    ctx.strokeStyle = color + '44';
    ctx.lineWidth   = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur  = g * 1.5;
    ctx.beginPath();
    for (const i of CONFIG.FINGERTIPS) {
      ctx.moveTo(pts[i].x + 11, pts[i].y);
      ctx.arc(pts[i].x, pts[i].y, 11, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();

    // Fingertip solid dots — batched with glow
    ctx.save();
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = g;
    ctx.beginPath();
    for (const i of CONFIG.FINGERTIPS) {
      ctx.moveTo(pts[i].x + 6, pts[i].y);
      ctx.arc(pts[i].x, pts[i].y, 6, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // White inner dot — no glow, batched
    ctx.save();
    ctx.fillStyle  = '#ffffffdd';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (const i of CONFIG.FINGERTIPS) {
      ctx.moveTo(pts[i].x + 2.5, pts[i].y);
      ctx.arc(pts[i].x, pts[i].y, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // ─── Connect mode (fingertip web) ────────────────────────────
  _connectMode(pts, color, lw) {
    const { ctx } = this;
    const tips = CONFIG.FINGERTIPS.map(i => pts[i]);
    const g    = this.cfg.glow;

    // Glow pass
    ctx.save();
    ctx.strokeStyle = color + '44';
    ctx.lineWidth   = lw * 2.5;
    ctx.lineCap     = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = g * 2;
    ctx.beginPath();
    for (let i = 0; i < tips.length; i++)
      for (let j = i + 1; j < tips.length; j++) {
        ctx.moveTo(tips[i].x, tips[i].y);
        ctx.lineTo(tips[j].x, tips[j].y);
      }
    ctx.stroke();
    ctx.restore();

    // Crisp pass
    ctx.save();
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    for (let i = 0; i < tips.length; i++)
      for (let j = i + 1; j < tips.length; j++) {
        ctx.moveTo(tips[i].x, tips[i].y);
        ctx.lineTo(tips[j].x, tips[j].y);
      }
    ctx.stroke();
    ctx.restore();
  }

  // ─── Shape mode (fingertip polygon) ──────────────────────────
  _shapeMode(pts, color, lw) {
    const { ctx }  = this;
    const tips = CONFIG.FINGERTIPS.map(i => pts[i]);
    const g    = this.cfg.glow;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = g * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(tips[0].x, tips[0].y);
    for (let i = 1; i < tips.length; i++) ctx.lineTo(tips[i].x, tips[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = color + '18';
    ctx.fill();
    ctx.restore();
  }

  // ─── Free draw (index fingertip trace) ───────────────────────
  _freeDraw(pts, color, lw, label) {
    const tip = pts[CONFIG.LM.INDEX_TIP];
    const key = 'fd_' + label;

    if (!this._live[key]) {
      this._live[key] = { pts: [{ x: tip.x, y: tip.y }], color, lw };
    } else {
      const s    = this._live[key];
      const last = s.pts[s.pts.length - 1];
      if (dist(last, tip) > 2) {
        s.pts.push({ x: tip.x, y: tip.y });
        if (s.pts.length > CONFIG.PERF.MAX_STROKE_PTS) {
          this._strokes.push({ ...s, pts: [...s.pts] });
          s.pts = [{ x: tip.x, y: tip.y }];
        }
      }
    }
  }

  _drawAllStrokes() {
    for (const s of this._strokes)              this._drawStroke(s);
    for (const s of Object.values(this._live))  this._drawStroke(s);
  }

  _drawStroke(s) {
    if (s.pts.length < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur  = this.cfg.glow;
    ctx.strokeStyle = s.color + 'ee';
    ctx.lineWidth   = s.lw;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i < s.pts.length; i++) {
      const mx = (s.pts[i - 1].x + s.pts[i].x) / 2;
      const my = (s.pts[i - 1].y + s.pts[i].y) / 2;
      ctx.quadraticCurveTo(s.pts[i - 1].x, s.pts[i - 1].y, mx, my);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ─── Cross-hand beam ─────────────────────────────────────────
  _crossBeam(hands, theme) {
    const { ctx } = this;
    const { W, H } = this;

    // Use already-smoothed coords
    const getSmoothedTip = h => {
      const s = this._smooth[h.label];
      return s ? s[CONFIG.LM.INDEX_TIP] : toPx(h.lm[CONFIG.LM.INDEX_TIP], W, H);
    };
    const p1 = getSmoothedTip(hands[0]);
    const p2 = getSmoothedTip(hands[1]);

    // Glow pass
    ctx.save();
    ctx.strokeStyle = theme.cx + '55';
    ctx.lineWidth   = this.cfg.lineW * 3;
    ctx.shadowColor = theme.cx;
    ctx.shadowBlur  = this.cfg.glow * 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();

    // Rainbow gradient pass
    ctx.save();
    const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
    grad.addColorStop(0,   theme.l);
    grad.addColorStop(0.5, theme.cx);
    grad.addColorStop(1,   theme.r);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = this.cfg.lineW * 1.5;
    ctx.shadowBlur  = 0;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  // ─── Particles ────────────────────────────────────────────────
  _spawnParticles(tips, color) {
    for (const tip of tips) {
      for (let i = 0; i < CONFIG.PARTICLES.PER_TIP; i++) {
        const angle = rnd(0, Math.PI * 2);
        const spd   = rnd(0.4, CONFIG.PARTICLES.SPEED);
        this._particles.push({
          x: tip.x, y: tip.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: CONFIG.PARTICLES.LIFETIME,
          max:  CONFIG.PARTICLES.LIFETIME,
          sz:   rnd(1, CONFIG.PARTICLES.MAX_SIZE),
          color,
        });
      }
    }
    if (this._particles.length > CONFIG.PARTICLES.CAP)
      this._particles.splice(0, this._particles.length - CONFIG.PARTICLES.CAP);
  }

  _drawParticles() {
    if (!this._particles.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.shadowBlur = 0;  // no shadow on particles — too expensive
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.life--;
      if (p.life <= 0) { this._particles.splice(i, 1); continue; }
      const a = p.life / p.max;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Canvas controls ──────────────────────────────────────────
  clear() {
    this._pushUndo();
    this._strokes   = [];
    this._live      = {};
    this._particles = [];
    this._smooth    = {};
  }

  commitFreeDraw() {
    for (const s of Object.values(this._live))
      if (s.pts.length > 1) this._strokes.push({ ...s, pts: [...s.pts] });
    this._live = {};
  }

  _pushUndo() {
    this._undoStack.push(JSON.stringify(this._strokes));
    this._redoStack = [];
    if (this._undoStack.length > CONFIG.PERF.MAX_UNDO) this._undoStack.shift();
  }

  undo() {
    if (!this._undoStack.length) return;
    this._redoStack.push(JSON.stringify(this._strokes));
    this._strokes = JSON.parse(this._undoStack.pop());
  }

  redo() {
    if (!this._redoStack.length) return;
    this._undoStack.push(JSON.stringify(this._strokes));
    this._strokes = JSON.parse(this._redoStack.pop());
  }

  set(key, value) { this.cfg[key] = value; }
}
