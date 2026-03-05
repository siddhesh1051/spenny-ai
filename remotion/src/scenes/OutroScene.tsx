import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { useDesignConfig } from "../useDesignConfig";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";
import { MicIcon, ImageIcon, SparklesIcon, MessageCircleIcon, SmartphoneIcon, BanknoteIcon } from "../Icons";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const SageClover: React.FC<{ size: number }> = ({ size }) => {
  const r = size * 0.28;
  const cx = size / 2;
  const cy = size / 2;
  const offset = size * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="leafOutro" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafOutro)" opacity={0.92} />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafOutro)" opacity={0.92} />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafOutro)" opacity={0.92} />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafOutro)" opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// Feature pill that floats in
const FeaturePill: React.FC<{
  text: string;
  icon: React.ReactNode;
  frame: number;
  fps: number;
  appearFrame: number;
  x: number;
  y: number;
  floatPhase?: number;
}> = ({ text, icon, frame, fps, appearFrame, x, y, floatPhase = 0 }) => {
  if (frame < appearFrame) return null;

  const progress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 16, stiffness: 180 },
  });

  const floatY = Math.sin((frame / fps) * Math.PI * 0.7 + floatPhase) * 5;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + floatY,
        transform: `scale(${progress})`,
        opacity: progress,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 99,
        padding: "8px 16px",
        fontSize: 13,
        color: "rgba(255,255,255,0.8)",
        fontWeight: 500,
        whiteSpace: "nowrap",
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span> {text}
    </div>
  );
};


export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useDesignConfig();

  // Scene: 5.5s = 165 frames
  const sceneOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [fps * 4.5, fps * 5.2], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 1.0);

  // Logo: spring in + slow spin
  const logoScale = spring({ frame, fps, config: { damping: 10, stiffness: 90, mass: 1.2 } });
  const logoOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const logoFloat = Math.sin((frame / fps) * Math.PI * 0.5) * 5;
  const ringRotate = interpolate(frame, [0, fps * 5.5], [0, 360], { extrapolateRight: "clamp" });

  // Text reveals
  const sageOpacity = interpolate(frame, [fps * 0.5, fps * 0.9], [0, 1], { extrapolateRight: "clamp" });
  const sageY = interpolate(frame, [fps * 0.5, fps * 0.9], [24, 0], {
    extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });

  const tagOpacity = interpolate(frame, [fps * 0.9, fps * 1.3], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [fps * 0.9, fps * 1.3], [16, 0], {
    extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });

  // CTA button
  const ctaOpacity = interpolate(frame, [fps * 1.5, fps * 2.0], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: Math.max(0, frame - fps * 1.5), fps, config: { damping: 14, stiffness: 140 } });
  // CTA shimmer
  const ctaShimmer = interpolate(frame, [fps * 2.2, fps * 2.7], [0, 100], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // URL reveal
  const urlOpacity = interpolate(frame, [fps * 2.4, fps * 2.9], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(160deg, #050d08 0%, #071510 45%, #060e0b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        opacity: sceneOpacity * fadeOut,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Layered ambient glows */}
      <div style={{
        position: "absolute",
        width: 900,
        height: 900,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(34,197,94,${0.06 + pulse * 0.04}) 0%, transparent 60%)`,
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 40% 30% at 15% 20%, rgba(16,185,129,0.05) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 35% 25% at 85% 80%, rgba(99,102,241,0.04) 0%, transparent 60%)",
      }} />

      {/* Feature pills — 3 left, 3 right, evenly spaced vertically */}
      {/* Left column */}
      <FeaturePill text="Chat to log"          icon={<MessageCircleIcon size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 1.8} x={44} y={height * 0.22} floatPhase={0}   />
      <FeaturePill text="Voice input"          icon={<MicIcon           size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 2.0} x={44} y={height * 0.46} floatPhase={2.1}  />
      <FeaturePill text="WhatsApp Integration" icon={<SmartphoneIcon    size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 2.2} x={44} y={height * 0.70} floatPhase={1.5}  />
      {/* Right column */}
      <FeaturePill text="Upload receipt"       icon={<ImageIcon         size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 2.0} x={width - 258} y={height * 0.22} floatPhase={1.2} />
      <FeaturePill text="Bank statement"       icon={<BanknoteIcon      size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 2.2} x={width - 264} y={height * 0.46} floatPhase={0.8} />
      <FeaturePill text="Live insights"        icon={<SparklesIcon      size={15} color="rgba(255,255,255,0.8)" />} frame={frame} fps={fps} appearFrame={fps * 2.4} x={width - 264} y={height * 0.70} floatPhase={0.4} />

      {/* Center content — everything stacked, truly centered */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", zIndex: 2, position: "relative",
      }}>
        {/* Logo + orbit ring — wrapped together so ring stays on logo */}
        <div style={{
          position: "relative",
          width: 240, height: 240,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 12,
        }}>
          {/* Orbit ring — absolutely centered on this container */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `1.5px solid rgba(34,197,94,${0.12 + pulse * 0.08})`,
            transform: `rotate(${ringRotate}deg)`,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%", background: "#22c55e",
              position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)",
              boxShadow: `0 0 16px 5px rgba(34,197,94,${0.4 + pulse * 0.3})`,
            }} />
          </div>
          {/* Inner ring */}
          <div style={{
            position: "absolute",
            width: 180, height: 180,
            borderRadius: "50%",
            border: `1px dashed rgba(34,197,94,${0.06 + pulse * 0.04})`,
            transform: `rotate(${-ringRotate * 0.6}deg)`,
          }} />
          {/* Logo — centered inside the ring container */}
          <div style={{
            transform: `scale(${logoScale}) translateY(${logoFloat}px)`,
            opacity: logoOpacity,
            filter: `drop-shadow(0 0 ${28 + pulse * 20}px rgba(34,197,94,${0.5 + pulse * 0.15}))`,
          }}>
            <SageClover size={110} />
          </div>
        </div>

        {/* Wordmark */}
        <div style={{
          fontSize: 100,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "#f0fdf4",
          lineHeight: 1,
          opacity: sageOpacity,
          transform: `translateY(${sageY}px)`,
          marginBottom: 10,
        }}>
          Sage
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 20,
          color: "rgba(240,253,244,0.5)",
          fontWeight: 400,
          letterSpacing: "0.04em",
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          marginBottom: 32,
        }}>
          Expense tracking, reimagined
        </div>

        {/* CTA button with shimmer */}
        <div style={{
          position: "relative",
          transform: `scale(${ctaScale})`,
          opacity: ctaOpacity,
          marginBottom: 14,
          overflow: "hidden",
          borderRadius: 99,
        }}>
          <div style={{
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            borderRadius: 99,
            padding: "15px 52px",
            fontSize: 17,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.02em",
            boxShadow: `0 10px 36px rgba(34,197,94,${0.32 + pulse * 0.12}), 0 2px 8px rgba(0,0,0,0.4)`,
            position: "relative",
          }}>
            Try Sage — it&apos;s free
            {/* Shimmer sweep */}
            <div style={{
              position: "absolute",
              top: 0, bottom: 0,
              width: 60,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              left: `${ctaShimmer - 30}%`,
              opacity: ctaShimmer > 0 && ctaShimmer < 100 ? 1 : 0,
            }} />
          </div>
        </div>

        {/* Visit URL */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          opacity: urlOpacity,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(74,222,128,0.5)" }} />
          <span style={{
            fontSize: 14,
            color: "rgba(74,222,128,0.55)",
            fontWeight: 500,
            letterSpacing: "0.08em",
          }}>
            visit spennyai.com
          </span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(74,222,128,0.5)" }} />
        </div>
      </div>
    </div>
  );
};
