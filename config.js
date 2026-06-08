/**
 * config.js — All constants for HandAR
 * MediaPipe 21-point landmark indices (verified correct):
 *  0=WRIST
 *  1=THUMB_CMC  2=THUMB_MCP  3=THUMB_IP   4=THUMB_TIP
 *  5=INDEX_MCP  6=INDEX_PIP  7=INDEX_DIP  8=INDEX_TIP
 *  9=MIDDLE_MCP 10=MIDDLE_PIP 11=MIDDLE_DIP 12=MIDDLE_TIP
 * 13=RING_MCP  14=RING_PIP  15=RING_DIP  16=RING_TIP
 * 17=PINKY_MCP 18=PINKY_PIP 19=PINKY_DIP 20=PINKY_TIP
 */

export const CONFIG = {

  // ── MediaPipe ──────────────────────────────────────────────────
  MEDIAPIPE: {
    MAX_NUM_HANDS:            2,
    MODEL_COMPLEXITY:         1,     // 0=lite/fast  1=full/accurate
    MIN_DETECTION_CONFIDENCE: 0.55,
    MIN_TRACKING_CONFIDENCE:  0.50,
    CAMERA_WIDTH:             640,
    CAMERA_HEIGHT:            480,
  },

  // ── Landmark indices ───────────────────────────────────────────
  LM: {
    WRIST:       0,
    THUMB_CMC:   1,
    THUMB_MCP:   2,
    THUMB_IP:    3,
    THUMB_TIP:   4,
    INDEX_MCP:   5,
    INDEX_PIP:   6,
    INDEX_DIP:   7,
    INDEX_TIP:   8,
    MIDDLE_MCP:  9,
    MIDDLE_PIP:  10,
    MIDDLE_DIP:  11,
    MIDDLE_TIP:  12,
    RING_MCP:    13,
    RING_PIP:    14,
    RING_DIP:    15,
    RING_TIP:    16,
    PINKY_MCP:   17,
    PINKY_PIP:   18,
    PINKY_DIP:   19,
    PINKY_TIP:   20,
  },

  // Fingertip landmark indices
  FINGERTIPS: [4, 8, 12, 16, 20],

  // All bone connections for skeleton drawing
  CONNECTIONS: [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
  ],

  // ── Colors ────────────────────────────────────────────────────
  COLORS: {
    LEFT:      '#00f3ff',   // Cyan  — left hand
    RIGHT:     '#ff00ff',   // Magenta — right hand
    CONNECTOR: '#ffff00',   // Yellow — cross-hand beam
  },

  // ── Default UI settings ───────────────────────────────────────
  DEFAULTS: {
    LINE_WIDTH:   2,
    GLOW:         12,
    SMOOTHING:    0.65,     // 0=no smooth  1=frozen
    SHOW_HANDS:   true,
    SHOW_DOTS:    true,
    SHOW_BONES:   true,
    MODE:         'connect',  // connect | shape | freedraw
    THEME:        'cyber',
  },

  // ── Gesture thresholds ────────────────────────────────────────
  GESTURES: {
    PINCH_DIST:   0.06,   // normalized units (0-1)
    EXTEND_RATIO: 1.20,   // tip must be ≥ this × PIP dist from wrist
    THUMB_EXTEND: 1.30,
    THUMB_LATERAL:0.09,
    DEBOUNCE_FRAMES: 8,
  },

  // ── Particles ─────────────────────────────────────────────────
  PARTICLES: {
    PER_TIP:  2,
    LIFETIME: 28,
    SPEED:    1.8,
    MAX_SIZE: 3,
    CAP:      300,
  },

  // ── Performance ───────────────────────────────────────────────
  PERF: {
    FPS_SAMPLES:     20,
    MAX_STROKE_PTS:  120,
    MAX_UNDO:        20,
    PARTICLE_SKIP:   3,   // spawn particles every Nth frame
  },

  // ── Themes: CSS vars + canvas colors ─────────────────────────
  THEMES: {
    cyber:  { css:{ p:'#00f3ff', s:'#ff00ff', a:'#7000ff' }, l:'#00f3ff', r:'#ff00ff', cx:'#ffff00' },
    matrix: { css:{ p:'#00ff41', s:'#008f11', a:'#003b00' }, l:'#00ff41', r:'#00cc33', cx:'#88ff00' },
    fire:   { css:{ p:'#ff6b00', s:'#ff0040', a:'#ffcc00' }, l:'#ff6b00', r:'#ff0040', cx:'#ffcc00' },
    ice:    { css:{ p:'#a8edea', s:'#88ccff', a:'#4facfe' }, l:'#a8edea', r:'#88ccff', cx:'#ffffff' },
    gold:   { css:{ p:'#ffd700', s:'#ff8c00', a:'#ff4500' }, l:'#ffd700', r:'#ff8c00', cx:'#ffffff' },
  },
};
