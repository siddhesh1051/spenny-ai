import { useVideoConfig, useCurrentFrame } from "remotion";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "./useDesignConfig";
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

// Scene durations in seconds — fps-independent.
// Actual frame counts are derived at runtime from useVideoConfig().fps.
const SCENE_SECONDS = {
  intro:        4.5,
  formReject:   5.0,
  chatLog:      5.5,
  receiptScan:  7.0,
  voice:        7.0,
  bankStatement:7.5,
  chatQuery:    6.5,
  outro:        5.5,
};
// Transition was 40 frames at 60fps ≈ 0.667s
const TRANSITION_SECONDS = 40 / 60;

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

// Scenes are authored at DESIGN_WIDTH×DESIGN_HEIGHT (1280×720).
// We scale the entire canvas so pixel sizes stay identical and
// transitions/slides work correctly at any output resolution.

export const SageTrailer: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  // Derive all frame counts from fps so the video plays at the correct
  // wall-clock duration regardless of whether we render at 60, 120fps, etc.
  const s = (seconds: number) => Math.round(seconds * fps);
  const TRANSITION_FRAMES = Math.round(TRANSITION_SECONDS * fps);
  const fade20 = fade();
  const fadeTiming = linearTiming({ durationInFrames: TRANSITION_FRAMES });
  const slideTiming = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES });

  return (
    <div style={{ width, height, background: "#000", overflow: "hidden", position: "relative" }}>
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
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.intro)}>
            <IntroScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={fade20} timing={fadeTiming} />

          {/* ── 2. Form Rejection ────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.formReject)}>
            <FormRejectionScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={slideTiming} />

          {/* ── 3. Sage Chat — Log Expenses ───────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.chatLog)}>
            <SageChatLogScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={slideTiming} />

          {/* ── 4. Receipt Scan ───────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.receiptScan)}>
            <ReceiptScanScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={slideTiming} />

          {/* ── 5. Voice Recording ───────────────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.voice)}>
            <VoiceScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={slideTiming} />

          {/* ── 6. Bank Statement ─────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.bankStatement)}>
            <BankStatementScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={slideTiming} />

          {/* ── 7. Sage Chat — Spending Query ─────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.chatQuery)}>
            <SageChatQueryScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition presentation={fade20} timing={fadeTiming} />

          {/* ── 8. Outro ──────────────────────────────── */}
          <TransitionSeries.Sequence durationInFrames={s(SCENE_SECONDS.outro)}>
            <OutroScene />
          </TransitionSeries.Sequence>
        </TransitionSeries>

        <Vignette width={DESIGN_WIDTH} height={DESIGN_HEIGHT} />
        <Grain width={DESIGN_WIDTH} height={DESIGN_HEIGHT} />
      </div>
    </div>
  );
};
