/**
 * main.js — App entry point, coordinates all modules
 */

import { CONFIG }      from './config.js';
import { HandTracker } from './handTracker.js';
import { Renderer }    from './renderer.js';
import { UI }          from './ui.js';
import { FPSCounter, downloadCanvas } from './utils.js';

class HandARApp {
  constructor() {
    this.canvas = document.getElementById('cvs');
    this.video  = document.getElementById('vid');

    this._mode    = CONFIG.DEFAULTS.MODE;
    this._paused  = false;
    this._hands   = [];
    this._stats   = { gesture: '—', spread: 0, conf: 0 };
    this._fps     = new FPSCounter(CONFIG.PERF.FPS_SAMPLES);

    this._init();
  }

  _init() {
    // 1. Renderer (needs canvas + video element)
    this.renderer = new Renderer(this.canvas, this.video);

    // 2. UI (wires DOM — renderer must exist first so settings apply immediately)
    this.ui = new UI({
      onSetting:    (key, val) => this._onSetting(key, val),
      onClear:      ()         => this.renderer.clear(),
      onScreenshot: ()         => downloadCanvas(this.canvas),
      onUndo:       ()         => this.renderer.undo(),
      onRedo:       ()         => this.renderer.redo(),
    });

    // 3. Hand tracker
    this.tracker = new HandTracker({
      onResults: data => this._onResults(data),
      onGesture: name => this.ui.showGesture(name),
      onError:   err  => {
        console.error(err);
        this.ui.showError('Camera error: ' + (err.message || String(err)));
        this.ui.hideLoading();
      },
    });

    window.addEventListener('resize', () => this.renderer.onResize());
    this._start();
  }

  // ─── Setting changes from UI ──────────────────────────────────
  _onSetting(key, val) {
    if (key === 'mode') {
      if (this._mode === 'freedraw') this.renderer.commitFreeDraw();
      this._mode = val;
    } else if (key === 'paused') {
      this._paused = val;
    } else {
      this.renderer.set(key, val);
    }
  }

  // ─── Boot sequence ────────────────────────────────────────────
  async _start() {
    this.ui.showLoading('Requesting camera permission…');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.ui.showError('Camera API not supported. Open via localhost or HTTPS.');
      this.ui.hideLoading();
      return;
    }

    try {
      // Wait for MediaPipe CDN scripts to finish loading
      if (!window.Hands || !window.Camera) {
        this.ui.showLoading('Loading MediaPipe models…');
        await this._waitFor(() => window.Hands && window.Camera, 20000);
      }

      this.ui.showLoading('Starting hand tracking…');
      await this.tracker.init(this.video);
      this.ui.hideLoading();

      // Start the render loop
      requestAnimationFrame(() => this._loop());

    } catch (err) {
      console.error(err);
      this.ui.showError('Failed to start: ' + (err.message || String(err)));
      this.ui.hideLoading();
    }
  }

  _waitFor(cond, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const t0   = Date.now();
      const poll = () => {
        if (cond()) return resolve();
        if (Date.now() - t0 > timeout)
          return reject(new Error('MediaPipe load timeout — check internet connection'));
        setTimeout(poll, 200);
      };
      poll();
    });
  }

  // ─── Hand results callback ────────────────────────────────────
  _onResults({ hands }) {
    if (this._paused) return;
    this._hands = hands;
    if (hands.length) {
      const h = hands[0];
      this._stats.gesture = h.gesture;
      this._stats.spread  = h.spread;
      this._stats.conf    = h.conf;
    } else {
      this._stats.gesture = '—';
      this._stats.spread  = 0;
      this._stats.conf    = 0;
    }
  }

  // ─── rAF render loop ─────────────────────────────────────────
  _loop() {
    this._fps.tick();
    this.renderer.render(this._hands, this._mode);
    this.ui.updateHUD({
      fps:     this._fps.fps,
      hands:   this._hands.length,
      gesture: this._stats.gesture,
      spread:  this._stats.spread,
      conf:    this._stats.conf,
    });
    requestAnimationFrame(() => this._loop());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new HandARApp();
});
