import { useVideoConfig, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./scenes/IntroScene";
import { FormRejectionScene } from "./scenes/FormRejectionScene";
import { SageChatLogScene, SageChatQueryScene } from "./scenes/SageChatScene";
import { ReceiptScanScene } from "./scenes/ReceiptScanScene";
import { VoiceScene } from "./scenes/VoiceScene";
import { BankStatementScene } from "./scenes/BankStatementScene";
import { OutroScene } from "./scenes/OutroScene";

// ── Scene durations (seconds × 60fps) ────────────────────────────────────────
// 1. Intro:           4.5s = 270 frames
// 2. FormRejection:   5.0s = 300 frames
// 3. SageChatLog:     5.5s = 330 frames  (text chat)
// 4. ReceiptScan:     7.0s = 420 frames  (upload receipt + scan)
// 5. Voice:           7.0s = 420 frames  (voice recording)
// 6. BankStatement:   7.5s = 450 frames  (bank statement PDF/CSV)
// 7. SageChatQuery:   6.5s = 390 frames  (spending insights)
// 8. Outro:           5.5s = 330 frames
//
// Transitions: 7 × 40 frames = 280 frames removed
// Total = (270+300+330+420+420+450+390+330) - 280 = 2910 - 280 = 2630 frames ≈ 43.8s

const TRANSITION_FRAMES = 40;

const fade20 = fade();
const fadeTiming = linearTiming({ durationInFrames: TRANSITION_FRAMES });
const slideTiming = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES });

// Letterbox vignette overlay — uses design dimensions, not video config
const Vignette: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 100,
      background:
        "radial-gradient(ellipse 88% 82% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)",
      width,
      height,
    }}
  />
);

// Subtle film-grain texture — uses design dimensions, not video config
const Grain: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 13) % 100;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        opacity: 0.02,
        pointerEvents: "none",
        zIndex: 99,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        backgroundPosition: `${offset}px ${offset}px`,
      }}
    />
  );
};

// Scenes are authored at 1280×720. We scale the entire canvas so pixel sizes
// stay identical and transitions/slides work correctly at any output resolution.
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

export const SageTrailer: React.FC = () => {
  const { width, height } = useVideoConfig();
  const scale = width / DESIGN_WIDTH; // 2.0 at 2K, 1.0 at 720p

  return (
    // Outer shell fills the actual render canvas
    <div style={{ width, height, background: "#000", overflow: "hidden", position: "relative" }}>
      {/* Scaled design surface — everything inside renders at 1280×720 then scales up */}
      <div style={{
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        position: "absolute",
        top: 0,
        left: 0,
        overflow: "hidden",
      }}>
        <TransitionSeries>
          {/* ── 1. Intro ─────────────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={270}>
            <IntroScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade20}
            timing={fadeTiming}
          />

          {/* ── 2. Form Rejection ────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={300}>
            <FormRejectionScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={slideTiming}
          />

          {/* ── 3. Sage Chat — Log Expenses (text) ───── */}
          <TransitionSeries.Sequence durationInFrames={330}>
            <SageChatLogScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={slideTiming}
          />

          {/* ── 4. Receipt Scan ───────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={420}>
            <ReceiptScanScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={slideTiming}
          />

          {/* ── 5. Voice Recording ───────────────────── */}
          <TransitionSeries.Sequence durationInFrames={420}>
            <VoiceScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={slideTiming}
          />

          {/* ── 6. Bank Statement ─────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={450}>
            <BankStatementScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={slideTiming}
          />

          {/* ── 7. Sage Chat — Spending Query ─────────── */}
          <TransitionSeries.Sequence durationInFrames={390}>
            <SageChatQueryScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade20}
            timing={fadeTiming}
          />

          {/* ── 8. Outro ──────────────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={330}>
            <OutroScene />
          </TransitionSeries.Sequence>
        </TransitionSeries>

        {/* Global overlays at design resolution */}
        <Vignette width={DESIGN_WIDTH} height={DESIGN_HEIGHT} />
        <Grain width={DESIGN_WIDTH} height={DESIGN_HEIGHT} />
      </div>
    </div>
  );
};
