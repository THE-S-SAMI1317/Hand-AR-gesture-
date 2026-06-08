/**
 * ui.js — DOM bindings, control panel, HUD updates
 */

import { CONFIG }           from './config.js';
import { save, load, downloadCanvas } from './utils.js';

export class UI {
  constructor({ onSetting, onClear, onScreenshot, onUndo, onRedo }) {
    this.onSetting    = onSetting;
    this.onClear      = onClear;
    this.onScreenshot = onScreenshot;
    this.onUndo       = onUndo;
    this.onRedo       = onRedo;

    this._paused    = false;
    this._gTimer    = null;

    this._wire();
    // Defer loading saved prefs until next frame so renderer is fully ready
    requestAnimationFrame(() => this._loadPrefs());
  }

  // ─── Wire all controls ───────────────────────────────────────
  _wire() {
    // ── Visibility toggles ──
    this._toggle('tHands', 'showHands', CONFIG.DEFAULTS.SHOW_HANDS);
    this._toggle('tDots',  'showDots',  CONFIG.DEFAULTS.SHOW_DOTS);
    this._toggle('tBones', 'showBones', CONFIG.DEFAULTS.SHOW_BONES);

    // ── Mode buttons ──
    const MODES = [
      ['mConnect', 'connect'],
      ['mShape',   'shape'],
      ['mDraw',    'freedraw'],
    ];
    for (const [id, mode] of MODES) {
      document.getElementById(id)?.addEventListener('click', () => {
        MODES.forEach(([bid]) =>
          document.getElementById(bid)?.classList.remove('on'));
        document.getElementById(id)?.classList.add('on');
        this.onSetting('mode', mode);
        save('har_mode', mode);
      });
    }

    // ── Sliders ──
    this._slider('sldW', 'lineW',    CONFIG.DEFAULTS.LINE_WIDTH,  1);
    this._slider('sldG', 'glow',     CONFIG.DEFAULTS.GLOW,        1);
    this._slider('sldS', 'smoothing',Math.round(CONFIG.DEFAULTS.SMOOTHING * 100), 100);

    // ── Theme select ──
    document.getElementById('themeSelect')?.addEventListener('change', e => {
      this._applyTheme(e.target.value);
      this.onSetting('theme', e.target.value);
      save('har_theme', e.target.value);
    });

    // ── Action buttons ──
    document.getElementById('bPause')?.addEventListener('click', () => {
      this._paused = !this._paused;
      const btn = document.getElementById('bPause');
      btn?.classList.toggle('on', this._paused);
      if (btn) btn.textContent = this._paused ? '▶' : '⏸';
      this.onSetting('paused', this._paused);
    });

    document.getElementById('bUndo')       ?.addEventListener('click', () => this.onUndo());
    document.getElementById('bRedo')       ?.addEventListener('click', () => this.onRedo());
    document.getElementById('bClear')      ?.addEventListener('click', () => this.onClear());
    document.getElementById('bScreenshot') ?.addEventListener('click', () => this.onScreenshot());

    // ── Panel toggle ──
    document.getElementById('panelToggle')?.addEventListener('click', () => {
      const p = document.getElementById('panel');
      const b = document.getElementById('panelToggle');
      p?.classList.toggle('hidden');
      if (b) b.textContent = p?.classList.contains('hidden') ? '▶' : '◀';
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', e => {
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
      switch (e.key.toLowerCase()) {
        case 'c': this.onClear(); break;
        case 's': this.onScreenshot(); break;
        case ' ':
          e.preventDefault();
          document.getElementById('bPause')?.click();
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.onUndo(); }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.onRedo(); }
          break;
        case '1': document.getElementById('mConnect')?.click(); break;
        case '2': document.getElementById('mShape')?.click();   break;
        case '3': document.getElementById('mDraw')?.click();    break;
      }
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────
  _toggle(id, key, defaultOn) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let state = defaultOn;
    btn.classList.toggle('on', state);
    btn.addEventListener('click', () => {
      state = !state;
      btn.classList.toggle('on', state);
      this.onSetting(key, state);
    });
  }

  _slider(id, key, defaultVal, divisor = 1) {
    const sl = document.getElementById(id);
    const dv = document.getElementById(id + 'v');
    if (!sl) return;
    sl.value = defaultVal;
    if (dv) dv.textContent = defaultVal;
    sl.addEventListener('input', () => {
      const raw = parseFloat(sl.value);
      if (dv) dv.textContent = raw;
      this.onSetting(key, raw / divisor);
      save('har_' + key, raw);
    });
  }

  _applyTheme(name) {
    const t = CONFIG.THEMES[name]?.css;
    if (!t) return;
    const r = document.documentElement;
    r.style.setProperty('--c1', t.p);
    r.style.setProperty('--c2', t.s);
    r.style.setProperty('--ca', t.a);
  }

  // ─── Load saved preferences ───────────────────────────────────
  _loadPrefs() {
    const theme = load('har_theme', 'cyber');
    const sel   = document.getElementById('themeSelect');
    if (sel) sel.value = theme;
    this._applyTheme(theme);
    this.onSetting('theme', theme);

    const modeMap = { connect:'mConnect', shape:'mShape', freedraw:'mDraw' };
    const mode    = load('har_mode', 'connect');
    document.getElementById(modeMap[mode] || 'mConnect')?.click();

    // Restore sliders
    const sliders = [
      ['sldW', 'lineW',    1],
      ['sldG', 'glow',     1],
      ['sldS', 'smoothing',100],
    ];
    for (const [id, key, div] of sliders) {
      const saved = load('har_' + key);
      if (saved !== null) {
        const sl = document.getElementById(id);
        const dv = document.getElementById(id + 'v');
        if (sl) { sl.value = saved; if (dv) dv.textContent = saved; }
        this.onSetting(key, saved / div);
      }
    }
  }

  // ─── HUD update (called every frame) ────────────────────────
  updateHUD({ fps, hands, gesture, spread, conf }) {
    this._set('sHands',  hands);
    this._set('sGest',   gesture || '—');
    this._set('sSpread', Math.round((spread || 0) * 100) + '%');
    this._set('sConf',   Math.round((conf   || 0) * 100) + '%');

    const fEl = document.getElementById('sFPS');
    if (fEl) {
      fEl.textContent = fps;
      fEl.style.color = fps >= 50 ? '#00ff88' : fps >= 28 ? '#ffcc00' : '#ff4444';
    }
  }

  _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Overlays ─────────────────────────────────────────────────
  showLoading(msg) {
    const o = document.getElementById('loading');
    const m = document.getElementById('lmsg');
    if (o) o.classList.remove('gone', 'fade');
    if (m) m.textContent = msg;
  }

  hideLoading() {
    const o = document.getElementById('loading');
    if (!o) return;
    o.classList.add('fade');
    setTimeout(() => o.classList.add('gone'), 520);
  }

  showError(msg) {
    const e = document.getElementById('err');
    if (!e) return;
    e.textContent = msg;
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 7000);
  }

  showGesture(name) {
    const el = document.getElementById('gnotif');
    if (!el) return;
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(this._gTimer);
    this._gTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
}
