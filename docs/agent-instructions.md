# Agent Instructions for UI Design: Beacon (Uptime Monitor)

This document provides absolute guidelines and code references to replicate the nautical-themed Beacon UI design in `apps/web`. The design mimics a maritime command center or ship watchtower using deep ocean blues, parchment paper colors, brass/gold accents, and dynamic animations.

---

## 1. Design System & CSS Variables

Ensure these variables are defined in the global stylesheet (`globals.css` or equivalent) and applied consistently:

```css
:root {
  /* Colors */
  --bg-deep: #091624;
  --bg-deep-2: #0d2236;
  --parchment: #f3e8cb;
  --parchment-edge: #e6d3a4;
  --parchment-shadow: #cdb985;
  --ink: #3a2c18;
  --ink-soft: #6e5a3c;
  --gold: #c9a35c;
  --rope: #b88a4f;
  --rope-dark: #8a6435;
  --lh-red: #bf3b2c;
  --lh-white: #f3ece0;
  --beacon-green: #5fae6e;
  --beacon-green-bright: #a8e6b4;
  --beam: #fff3cf;
  --calm: #5fae6e;
  --rough: #e0a23c;
  --storm: #d9534f;
  --harbor: #46b3a8;
  --text-secondary: #a9bbcd;

  /* Form inputs */
  --input-bg: #16314a;
  --input-text: #eee6cf;
  --input-placeholder: #8ca0b4;
}
```

### Typography
- **Headings / Logo / Buttons**: `'Cinzel', serif` (Weights: 500, 600, 700)
- **Body / Labels / Secondary UI**: `'Inter', system-ui, sans-serif` (Weights: 400, 500, 600, 700)

### Backgrounds
- **Landing page**:
  `radial-gradient(ellipse at 50% -10%, #16344e 0%, var(--bg-deep) 55%, #060e18 100%)`
- **Auth/Sign-in page**:
  `radial-gradient(ellipse at 50% 0%, #15324c 0%, var(--bg-deep) 55%, #060e18 100%)`

---

## 2. Animation Keyframes

The dynamic feel of the application depends on these custom animations. Include them in the CSS:

```css
/* Twinkling Stars */
@keyframes twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* Lighthouse Sweeping Beam */
@keyframes sweep {
  0%, 100% { transform: rotate(-30deg); }
  50% { transform: rotate(34deg); }
}

/* Radar Conic Spin */
@keyframes radar-spin {
  to { transform: rotate(360deg); }
}

/* Radar Blip Pulse */
@keyframes blip-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.3); }
}

/* Ship Bobbing (Calm / Degraded) */
@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-4px) rotate(-2deg); }
}

/* Ship Bobbing (Storm Alert) */
@keyframes bob-storm {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-3px) rotate(3deg); }
}

/* SOS Flashing */
@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

/* Signal Flow Connector (Horizontal) */
@keyframes travel {
  0% { left: 0; opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { left: calc(100% - 8px); opacity: 0; }
}

/* Signal Flow Connector (Vertical - Mobile) */
@keyframes travel-v {
  0% { top: 0; opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { top: calc(100% - 8px); opacity: 0; }
}

/* Radar/Chart Scan Line */
@keyframes scan {
  0% { left: -60px; }
  100% { left: 100%; }
}

/* Sailing boat along path */
@keyframes sail {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}

/* Compass Needle Drift */
@keyframes drift {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}

/* Spinning Wheel/Rudder */
@keyframes wheel-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Button Pulse Glow */
@keyframes harbor-hum {
  0%, 100% { box-shadow: 0 0 10px 1px rgba(95,174,110,0.35); }
  50% { box-shadow: 0 0 26px 8px rgba(95,174,110,0.55); }
}
```

---

## 3. UI Components

### 3.1 Starfield Background
Place a background element containing random twinkling stars.
- Markup:
  ```html
  <div class="stars" aria-hidden="true"></div>
  <div class="star" style="top:5%; left:34%; animation-delay:0s;" aria-hidden="true"></div>
  <div class="star" style="top:11%; left:62%; animation-delay:0.9s;" aria-hidden="true"></div>
  ...
  ```
- CSS:
  `stars` has a repeating background-image with `radial-gradient(1.5px 1.5px at X% Y%, var(--parchment) 50%, transparent 51%)` to create a dense sky. `star` is absolute with size `3px` by `3px`, `border-radius: 50%`, background `var(--parchment)`, and twinkling animation.

### 3.2 Main Navigation Brand Logo
Nautical Lighthouse Icon:
```html
<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 36h8l-1-6h-6z" fill="currentColor" opacity=".5"/>
  <path d="M14 30h12l-2-18h-8z" fill="currentColor"/>
  <rect x="15" y="18" width="10" height="3" fill="var(--lh-red)"/>
  <rect x="16" y="11" width="8" height="6" fill="currentColor" opacity=".5"/>
  <path d="M14 11l6-7 6 7z" fill="var(--lh-red)"/>
</svg>
```

### 3.3 Hero Visual Container
Combines three elements:
1. **Radar Grid**: Overlay with linear-gradient grid background.
2. **Lighthouse with Sweeping Beam**:
   - Beam: `clip-path: polygon(50% 100%, 18% 0%, 82% 0%)` filled with a soft golden vertical gradient. Rotating pivot element animated with `sweep`.
   - Lighthouse tower: drawn in SVG (alternating white body and `--lh-red` stripes).
3. **Radar Screen**: Concentric circles with conic-gradient sweep spinning at `6s` and absolute-positioned `.radar-blip` elements pulsing in green.

### 3.4 Voyage Stages (Status cards)
Four stages layout, horizontally aligned on desktop, vertically on mobile:
- **Calm seas** (Green status, Bobbing ship with green hull)
- **Rough waters** (Orange status, Bobbing ship with orange waves)
- **Storm warning** (Red status, SOS warning flags, broken ship)
- **Safe harbor** (Teal status, ship docked safely, red flags at anchor)
- **Connectors**: Dotted lines (`border-top: 2px dotted`) with absolute children (`.signal`) that travel across the track.

### 3.5 Intelligence Panels
1. **Storm Tracking**: Dot grid background overlayed with red pulsing storm cells.
2. **Response latency chart**: SVG area chart with a scan line sweeping across.
3. **Harbor mastery path**: Boat sailing along an SVG path using CSS `offset-path` and `offset-rotate: 0deg`.

### 3.6 Parchment-textured Authentication Card
Sign in / sign up card style:
- Background: `var(--parchment)` with a cross-hatch texture:
  `repeating-linear-gradient(135deg, rgba(184,138,79,.05) 0 2px, transparent 2px 26px), repeating-linear-gradient(45deg, rgba(184,138,79,.05) 0 2px, transparent 2px 26px)`
- Dashed Inner Border: `inset: 10px; border: 1px dashed rgba(110,90,60,.25);`
- Input inputs: Background `var(--input-bg)`, font colors matching `--input-text`, focus border highlighting `var(--beacon-green)` with glow.
- Enter Harbor button: Golden steering wheel (rudder) spin and lighthouse pulse effect on hover. Transitioning from brown gradient to green gradient.
- Footer: Sailing vessel SVG, drifting needle compass, and mirror sailing vessel.
