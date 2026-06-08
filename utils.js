/**
 * utils.js — Pure helper functions (no DOM, no state)
 */

/** Euclidean distance between two {x,y} points */
export function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Linear interpolation */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** Clamp value between lo and hi */
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Random float in [min, max) */
export function rnd(min, max) { return Math.random() * (max - min) + min; }

/** Map value from one range to another */
export function mapRange(v, a0, a1, b0, b1) {
  return b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
}

/**
 * Convert a MediaPipe normalised landmark {x,y} → canvas pixel {x,y}.
 * Mirrors horizontally (x = 1 - lm.x) for natural selfie-camera feel.
 */
export function toPx(lm, W, H) {
  return { x: (1 - lm.x) * W, y: lm.y * H };
}

/** Smooth a 2D point toward target using lerp factor t ∈ (0,1] */
export function smoothPt(cur, tgt, t) {
  return { x: lerp(cur.x, tgt.x, t), y: lerp(cur.y, tgt.y, t) };
}

/** Centroid of an array of {x,y} points */
export function centroid(pts) {
  const n = pts.length;
  return pts.reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });
}

/** Distance between current and previous position (returns 0 if no prev) */
export function speed(prev, curr) { return prev ? dist(prev, curr) : 0; }

/** Save value to localStorage (silently ignores errors) */
export function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
}

/** Load value from localStorage, returns defaultVal on miss/error */
export function load(key, defaultVal = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : defaultVal;
  } catch (_) { return defaultVal; }
}

/** Trigger a PNG download of a canvas element */
export function downloadCanvas(canvas, name = 'hand-ar.png') {
  const a = document.createElement('a');
  a.download = name;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/** Rolling-window FPS counter */
export class FPSCounter {
  constructor(samples = 20) {
    this._n   = samples;
    this._buf = [];
    this.fps  = 0;
  }
  tick() {
    const now = performance.now();
    this._buf.push(now);
    if (this._buf.length > this._n) this._buf.shift();
    if (this._buf.length >= 2) {
      const elapsed = this._buf[this._buf.length - 1] - this._buf[0];
      this.fps = Math.round((this._buf.length - 1) / elapsed * 1000);
    }
  }
}
