# ⟡ HandAR — Real-Time Hand Tracking AR

Browser-based AR hand tracking using **MediaPipe Hands**. Draw neon geometric shapes with your bare hands — no plugins, no hardware.

---

## 🚀 Quick Start

> **You MUST serve via HTTP — double-clicking index.html won't work.**
> MediaPipe uses WebAssembly which requires a real server origin.

### Python (easiest — no install needed)
```bash
cd HandAR
python3 -m http.server 8080
# Open: http://localhost:8080
```

### Node.js
```bash
npx serve HandAR
# or
npx http-server HandAR -p 8080
```

### VS Code
Install **Live Server** extension → right-click `index.html` → **Open with Live Server**

---

## 📁 File Structure

```
HandAR/
├── index.html      Main HTML — UI skeleton, CDN script tags
├── styles.css      Full cyberpunk UI (CSS variables, responsive)
├── config.js       All constants (landmark indices, colors, thresholds)
├── utils.js        Pure helpers (dist, lerp, FPSCounter, storage)
├── handTracker.js  MediaPipe Hands wrapper + 12-gesture recognition
├── renderer.js     Canvas engine (video feed, skeleton, particles)
├── ui.js           DOM bindings, sliders, HUD updates
├── main.js         App boot + rAF render loop
└── README.md       This file
```

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `Space` | Pause / Resume |
| `C` | Clear canvas |
| `S` | Screenshot (PNG download) |
| `1` | Connect mode |
| `2` | Shape mode |
| `3` | Free Draw mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

---

## ✋ Gestures (12 total)

| Gesture | Sign |
|---------|------|
| Fist | ✊ |
| Open Hand | 🖐 |
| Peace | ✌️ |
| Thumbs Up | 👍 |
| Thumbs Down | 👎 |
| Point | ☝️ |
| OK | 👌 |
| Pinch | 🤌 |
| Rock On | 🤘 |
| Call Me | 🤙 |
| Four | 🖖 |
| Three | 🤟 |

---

## 🎨 Drawing Modes

| Mode | How it works |
|------|-------------|
| **Connect** | Neon lines between all 5 fingertips. Both hands → rainbow beam |
| **Shape** | Filled polygon connecting fingertips |
| **Free Draw** | Your index fingertip traces a glowing path |

---

## ⚡ Performance Tips

If FPS is low, try:
1. In `config.js` set `MODEL_COMPLEXITY: 0` (lite model, much faster)
2. Lower the **Glow** slider to 0 — `shadowBlur` is the biggest GPU cost
3. In `config.js` set `CAMERA_WIDTH: 480, CAMERA_HEIGHT: 360`
4. On a very slow PC, try Chrome over Firefox (Chrome's Canvas2D is faster)

---

## 🔧 Customisation

### Add a new theme
In `config.js`, add to `THEMES`:
```js
myTheme: {
  css: { p: '#ff6b6b', s: '#ffd93d', a: '#6c63ff' },
  l:   '#ff6b6b',   // left hand
  r:   '#ffd93d',   // right hand
  cx:  '#6c63ff',   // cross-hand connector
}
```
Then add `<option value="myTheme">🎨 My Theme</option>` to the select in `index.html`.

### Adjust detection sensitivity
```js
MIN_DETECTION_CONFIDENCE: 0.45,  // lower = detects in worse lighting
MIN_TRACKING_CONFIDENCE:  0.40,
```

---

## 🌐 Browser Support

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Best performance |
| Edge 90+ | ✅ Full support |
| Firefox 89+ | ✅ Works well |
| Safari 15+ | ⚠️ May need camera permission toggle |
| Mobile Chrome | ✅ Works |
| Mobile Safari | ⚠️ Limited |

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| Black screen / no camera | Open via `localhost` not `file://`. Allow camera in browser settings. |
| "MediaPipe timeout" | Check internet connection — CDN files must download once. |
| Hands not detected | Improve lighting. Keep hands fully in frame. Try lowering confidence thresholds. |
| Low FPS | Lower Glow slider. Set `MODEL_COMPLEXITY: 0` in config.js. |
| Jittery tracking | Increase Smoothing slider toward 80+. |
