/**
 * handTracker.js — MediaPipe Hands wrapper + 12-gesture recognition
 *
 * Gesture detection is wrist-distance-ratio based, making it
 * rotation-proof (works when hand is tilted, sideways, upside-down).
 */

import { CONFIG } from './config.js';
import { dist, centroid } from './utils.js';

export class HandTracker {
  /**
   * @param {object} opts
   * @param {function} opts.onResults  - Called each frame with processed hand data
   * @param {function} opts.onGesture  - Called when a stable gesture is held
   * @param {function} opts.onError    - Called on init failure
   */
  constructor({ onResults, onGesture, onError }) {
    this.onResults = onResults;
    this.onGesture = onGesture || (() => {});
    this.onError   = onError   || console.error;

    this._mp      = null;   // MediaPipe Hands instance
    this._cam     = null;   // MediaPipe Camera instance
    this.running  = false;

    // Gesture debounce
    this._gBuf     = [];
    this._lastGest = '';
  }

  // ─── Initialise MediaPipe and start camera ───────────────────
  async init(videoEl) {
    try {
      this._mp = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });

      this._mp.setOptions({
        maxNumHands:            CONFIG.MEDIAPIPE.MAX_NUM_HANDS,
        modelComplexity:        CONFIG.MEDIAPIPE.MODEL_COMPLEXITY,
        minDetectionConfidence: CONFIG.MEDIAPIPE.MIN_DETECTION_CONFIDENCE,
        minTrackingConfidence:  CONFIG.MEDIAPIPE.MIN_TRACKING_CONFIDENCE,
      });

      this._mp.onResults(r => this._process(r));

      this._cam = new window.Camera(videoEl, {
        onFrame: async () => {
          if (this._mp && this.running)
            await this._mp.send({ image: videoEl });
        },
        width:  CONFIG.MEDIAPIPE.CAMERA_WIDTH,
        height: CONFIG.MEDIAPIPE.CAMERA_HEIGHT,
      });

      await this._cam.start();
      this.running = true;
    } catch (err) {
      this.onError(err);
    }
  }

  stop() {
    this.running = false;
    this._cam?.stop();
  }

  // ─── Process raw MediaPipe results ───────────────────────────
  _process(results) {
    const hands = [];

    if (results.multiHandLandmarks?.length) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const lm      = results.multiHandLandmarks[i];
        const handed  = results.multiHandedness[i];
        // MediaPipe returns mirrored labels → flip for natural display
        const label   = handed.label === 'Left' ? 'Right' : 'Left';
        const conf    = handed.score;
        const fingers = this._fingers(lm);
        const gesture = this._gesture(lm, fingers);
        const spread  = this._spread(lm);

        hands.push({ label, conf, lm, fingers, gesture, spread });
      }

      // Debounce: fire onGesture only after DEBOUNCE_FRAMES identical frames
      const key = hands.map(h => h.gesture).join('+');
      this._gBuf.push(key);
      if (this._gBuf.length > CONFIG.GESTURES.DEBOUNCE_FRAMES)
        this._gBuf.shift();

      const stable = this._gBuf.length === CONFIG.GESTURES.DEBOUNCE_FRAMES
                  && this._gBuf.every(g => g === key);
      if (stable && key !== this._lastGest) {
        this._lastGest = key;
        this.onGesture(key, hands);
      }
      if (!stable) this._lastGest = '';
    } else {
      this._gBuf     = [];
      this._lastGest = '';
    }

    this.onResults({ hands, ts: performance.now() });
  }

  // ─── Finger extension states ──────────────────────────────────
  // Wrist-distance ratio method: rotation-proof for all hand orientations
  _fingers(lm) {
    const L = CONFIG.LM;
    const w = lm[L.WRIST];

    // A finger is extended if tip is ≥ EXTEND_RATIO × farther from wrist than PIP
    const ext = (ti, pi) =>
      dist(lm[ti], w) > dist(lm[pi], w) * CONFIG.GESTURES.EXTEND_RATIO;

    // Thumb: lateral separation from index MCP OR tip farther than MCP from wrist
    const tTip = lm[L.THUMB_TIP];
    const tMcp = lm[L.THUMB_MCP];
    const iMcp = lm[L.INDEX_MCP];
    const thumb = dist(tTip, w) > dist(tMcp, w) * CONFIG.GESTURES.THUMB_EXTEND
               || dist(tTip, iMcp) > CONFIG.GESTURES.THUMB_LATERAL;

    return {
      thumb,
      index:  ext(L.INDEX_TIP,  L.INDEX_PIP),
      middle: ext(L.MIDDLE_TIP, L.MIDDLE_PIP),
      ring:   ext(L.RING_TIP,   L.RING_PIP),
      pinky:  ext(L.PINKY_TIP,  L.PINKY_PIP),
    };
  }

  // ─── Gesture classification (12 gestures) ────────────────────
  _gesture(lm, f) {
    const L = CONFIG.LM;
    const pinch = dist(lm[L.THUMB_TIP], lm[L.INDEX_TIP]);

    // Pinch variants (check before others to avoid false positives)
    if (pinch < CONFIG.GESTURES.PINCH_DIST) {
      if (!f.middle && !f.ring && !f.pinky) return 'Pinch 🤌';
      if ( f.middle &&  f.ring &&  f.pinky) return 'OK 👌';
    }

    const { thumb: T, index: I, middle: M, ring: R, pinky: P } = f;

    if (!T && !I && !M && !R && !P) return 'Fist ✊';

    if (T && !I && !M && !R && !P) {
      // Distinguish thumbs up vs down by y-position
      return lm[L.THUMB_TIP].y < lm[L.INDEX_MCP].y
        ? 'Thumbs Up 👍'
        : 'Thumbs Down 👎';
    }

    if (!T && I && M && !R && !P) return 'Peace ✌️';
    if (!T && I && !M && !R && !P) return 'Point ☝️';
    if (!T && I && !M && !R &&  P) return 'Rock On 🤘';
    if ( T && !I && !M && !R &&  P) return 'Call Me 🤙';
    if (!T && I && M && R && !P) return 'Three 🤟';
    if (!T && I && M && R &&  P) return 'Four 🖖';
    if ( T && I && M && R &&  P) return 'Open 🖐';

    return 'Custom';
  }

  // ─── Finger spread metric (0=closed → 1=fully open) ─────────
  _spread(lm) {
    const tips = CONFIG.FINGERTIPS.map(i => lm[i]);
    const c    = centroid(tips);
    const avg  = tips.reduce((s, t) => s + dist(t, c), 0) / tips.length;
    const ref  = dist(lm[CONFIG.LM.WRIST], lm[CONFIG.LM.MIDDLE_MCP]);
    return ref > 0 ? Math.min(1, avg / ref) : 0;
  }
}
