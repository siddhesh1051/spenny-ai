# Spenny AI — Remotion Trailer

Animated promo/trailer video for **Spenny AI**, built with [Remotion](https://www.remotion.dev/) — a React-based framework for programmatic video creation.

---

## Overview

The video is a ~44-second product trailer called **Sage Trailer** (`SageTrailer` composition). It walks through the core features of Spenny AI using animated scenes, transitions, and cinematic overlays (vignette + film grain).

**Output specs:**
- Resolution: `2560 × 1440` (2K)
- Frame rate: `60 fps`
- Total duration: ~43.8 seconds

Scenes are authored at a fixed design resolution of `1280 × 720` and scaled up to the output resolution at render time — so all pixel sizes stay crisp regardless of output resolution.

---

## Scenes

The trailer is composed of 8 scenes connected by fade and slide transitions:

| # | Scene | Duration | File | Description |
|---|-------|----------|------|-------------|
| 1 | **Intro** | 4.5s | `IntroScene.tsx` | Spenny logo and tagline reveal with animated 4-leaf clover (Sage icon) |
| 2 | **Form Rejection** | 5.0s | `FormRejectionScene.tsx` | "Most expense trackers are forms" — crossed-out form UI contrasted with Sage |
| 3 | **Sage Chat — Log Expenses** | 5.5s | `SageChatScene.tsx` | Animated chat UI showing natural language expense logging |
| 4 | **Receipt Scan** | 7.0s | `ReceiptScanScene.tsx` | Camera scan animation → AI extracting line items from a receipt |
| 5 | **Voice Input** | 7.0s | `VoiceScene.tsx` | Microphone waveform → Whisper transcription → Sage response |
| 6 | **Bank Statement / Gmail Sync** | 7.5s | `BankStatementScene.tsx` | Gmail sync pipeline: emails → AI classification → expenses imported |
| 7 | **Sage Chat — Spending Query** | 6.5s | `SageChatScene.tsx` | Chat query ("How much did I spend this month?") → chart + metric cards |
| 8 | **Outro** | 5.5s | `OutroScene.tsx` | Call-to-action with product URL and Sage branding |

**Transitions:**
- Scenes 1→2 and 7→8: `fade` (linear, ~0.67s)
- All other scene transitions: `slide (from-right)` (spring physics, ~0.67s)

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `remotion` | 4.0.432 | Core video framework |
| `@remotion/cli` | 4.0.432 | Studio dev server and render CLI |
| `@remotion/transitions` | 4.0.432 | `TransitionSeries`, `fade`, `slide` |
| `@remotion/google-fonts` | 4.0.432 | `FunnelDisplay` font (used in IntroScene) |
| `@remotion/tailwind-v4` | 4.0.432 | Tailwind CSS 4 inside Remotion |
| `react` | 19.2.3 | Component model |
| `tailwindcss` | 4.0.0 | Utility styling |
| `typescript` | 5.9.3 | Type safety |

---

## Project Structure

```
remotion/
├── src/
│   ├── Root.tsx               # Remotion root — registers the SageTrailer composition
│   ├── SageTrailer.tsx        # Main composition — TransitionSeries, vignette, film grain
│   ├── useDesignConfig.ts     # Design constants (DESIGN_WIDTH=1280, DESIGN_HEIGHT=720)
│   ├── Icons.tsx              # Shared SVG icons (SageClover, etc.)
│   └── scenes/
│       ├── IntroScene.tsx         # Scene 1 — Logo + tagline reveal
│       ├── FormRejectionScene.tsx # Scene 2 — "Forms vs conversation" contrast
│       ├── SageChatScene.tsx      # Scenes 3 & 7 — Chat log and spending query
│       ├── ReceiptScanScene.tsx   # Scene 4 — Receipt scan animation
│       ├── VoiceScene.tsx         # Scene 5 — Voice input flow
│       ├── BankStatementScene.tsx # Scene 6 — Gmail sync pipeline
│       └── OutroScene.tsx         # Scene 8 — CTA and outro
├── remotion.config.ts         # Remotion configuration
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
cd remotion
npm install
```

### Open Remotion Studio (dev server)

```bash
npm run dev
```

Opens the Remotion Studio at `http://localhost:3000`. You can scrub through any frame, preview transitions, and hot-reload scene changes.

### Render to video

```bash
# Render the full trailer to MP4
npx remotion render SageTrailer out/sage-trailer.mp4

# Render a specific frame range (e.g. frames 0–120 for the intro)
npx remotion render SageTrailer out/intro.mp4 --frames=0-120

# Render a single frame as PNG (for thumbnail / social card)
npx remotion still SageTrailer out/thumbnail.png --frame=30
```

### Bundle (for Remotion Lambda / Cloud rendering)

```bash
npm run build
```

---

## Architecture Notes

### Design resolution scaling

All scenes are authored at `1280 × 720` (`DESIGN_WIDTH` / `DESIGN_HEIGHT` from `useDesignConfig.ts`). `SageTrailer.tsx` wraps them in a `div` scaled by `width / DESIGN_WIDTH`, so the output resolution (`2560 × 1440`) does not affect scene layout — pixel sizes, font sizes, and positions are always relative to the `1280 × 720` design grid.

### Cinematic overlays

Two overlays are composited on top of all scenes in `SageTrailer.tsx`:

- **Vignette** — a `radial-gradient` ellipse that darkens the edges (opacity blend mode, `z-index: 100`)
- **Film Grain** — an SVG `feTurbulence` noise texture that shifts position every frame (`frame * 13 % 100`), giving a subtle organic texture (opacity: `0.02`, `z-index: 99`)

### FPS-independent durations

All scene and transition durations are defined in **seconds** in `SCENE_SECONDS` (not frames). Frame counts are derived at runtime via `Math.round(seconds * fps)` from `useVideoConfig()`, so the video plays at the same wall-clock duration if you change the FPS.

---

## Customisation

| What | Where |
|------|-------|
| Change output resolution | `Root.tsx` — `width` and `height` props on `<Composition>` |
| Change FPS | `Root.tsx` — `fps` prop and `const FPS` |
| Change scene durations | `SageTrailer.tsx` — `SCENE_SECONDS` object |
| Change transition type/duration | `SageTrailer.tsx` — `fade20`, `fadeTiming`, `slideTiming` |
| Add a new scene | Create `scenes/MyScene.tsx`, add a `<TransitionSeries.Sequence>` in `SageTrailer.tsx` |
| Change design resolution | `useDesignConfig.ts` — `DESIGN_WIDTH` / `DESIGN_HEIGHT` |
