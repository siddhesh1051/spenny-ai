import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// 4-leaf clover — matches the product LocalCloverIcon
const SageClover: React.FC<{ size: number; opacity?: number }> = ({ size, opacity = 1 }) => {
  const r = size * 0.28;
  const cx = size / 2;
  const cy = size / 2;
  const offset = size * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }}>
      <defs>
        <radialGradient id="leafIntro" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <filter id="glowIntro">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafIntro)" opacity={0.92} filter="url(#glowIntro)" />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafIntro)" opacity={0.92} filter="url(#glowIntro)" />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafIntro)" opacity={0.92} filter="url(#glowIntro)" />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafIntro)" opacity={0.92} filter="url(#glowIntro)" />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// Animated particle that floats up
const Particle: React.FC<{ frame: number; fps: number; x: number; delay: number; size: number }> = ({
  frame, fps, x, delay, size,
}) => {
  const localFrame = Math.max(0, frame - delay);
  const totalDur = fps * 3;
  if (localFrame > totalDur) return null;

  const progress = localFrame / totalDur;
  const y = interpolate(progress, [0, 1], [0, -180], { extrapolateRight: "clamp" });
  const opacity = interpolate(progress, [0, 0.15, 0.7, 1], [0, 0.6, 0.3, 0], { extrapolateRight: "clamp" });
  const drift = Math.sin(localFrame * 0.08 + x) * 12;

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(74,222,128,0.9) 0%, rgba(34,197,94,0.4) 100%)",
        left: x,
        bottom: 80,
        transform: `translateY(${y}px) translateX(${drift}px)`,
        opacity,
        boxShadow: "0 0 8px 2px rgba(74,222,128,0.4)",
      }}
    />
  );
};

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // — Timeline —
  // 0–0.3s: background fades in
  // 0.2–0.7s: logo springs in
  // 0.6–1.0s: "Sage" slides up
  // 1.0–1.5s: tagline reveals
  // 1.6–2.1s: by Spenny badge
  // Whole scene: 4.5s = 135 frames

  const bgOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({
    frame: Math.max(0, frame - fps * 0.15),
    fps,
    config: { damping: 10, stiffness: 110, mass: 1 },
  });
  const logoOpacity = interpolate(frame, [fps * 0.15, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });

  // Logo gentle float
  const logoFloat = Math.sin((frame / fps) * Math.PI * 0.6) * 4;

  // Glow ring rotation
  const ring1Rot = interpolate(frame, [0, fps * 4.5], [0, 360], { extrapolateRight: "clamp" });
  const ring2Rot = interpolate(frame, [0, fps * 4.5], [0, -270], { extrapolateRight: "clamp" });

  // Pulse glow
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 1.0);

  // Text reveals
  const sageOpacity = interpolate(frame, [fps * 0.6, fps * 1.0], [0, 1], { extrapolateRight: "clamp" });
  const sageY = interpolate(frame, [fps * 0.6, fps * 1.0], [28, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const tagOpacity = interpolate(frame, [fps * 1.0, fps * 1.5], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [fps * 1.0, fps * 1.5], [18, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const byOpacity = interpolate(frame, [fps * 1.7, fps * 2.1], [0, 1], { extrapolateRight: "clamp" });
  const byScale = spring({
    frame: Math.max(0, frame - fps * 1.7),
    fps,
    config: { damping: 14, stiffness: 180 },
  });

  // Particles
  const particles = [
    { x: width * 0.18, delay: fps * 0.5, size: 4 },
    { x: width * 0.32, delay: fps * 0.8, size: 3 },
    { x: width * 0.55, delay: fps * 0.3, size: 5 },
    { x: width * 0.68, delay: fps * 1.0, size: 3 },
    { x: width * 0.78, delay: fps * 0.6, size: 4 },
    { x: width * 0.42, delay: fps * 1.3, size: 3 },
  ];

  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(160deg, #070d09 0%, #0a1510 40%, #060d0b 70%, #080e0c 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily,
        overflow: "hidden",
        opacity: bgOpacity,
        position: "relative",
      }}
    >
      {/* Deep ambient gradient blobs */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 60% at 50% 20%, rgba(34,197,94,${0.07 + pulse * 0.04}) 0%, transparent 70%)`,
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 40% at 80% 80%, rgba(99,102,241,0.05) 0%, transparent 65%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 40% 30% at 10% 70%, rgba(16,185,129,0.04) 0%, transparent 60%)",
      }} />

      {/* Horizontal scan line that sweeps through once */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.3), transparent)",
        top: `${interpolate(frame, [fps * 0.3, fps * 1.2], [10, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
        opacity: interpolate(frame, [fps * 0.3, fps * 0.5, fps * 1.0, fps * 1.2], [0, 0.6, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        pointerEvents: "none",
      }} />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <Particle key={i} frame={frame} fps={fps} x={p.x} delay={p.delay} size={p.size} />
      ))}

      {/* Logo container */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        {/* Outer orbit ring */}
        <div style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: "1px solid rgba(34,197,94,0.12)",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${ring1Rot}deg)`,
          opacity: logoOpacity * 0.8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
            position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)",
            boxShadow: `0 0 12px 4px rgba(74,222,128,${0.5 + pulse * 0.3})`,
          }} />
        </div>

        {/* Inner orbit ring */}
        <div style={{
          position: "absolute",
          width: 150,
          height: 150,
          borderRadius: "50%",
          border: "1px dashed rgba(74,222,128,0.08)",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${ring2Rot}deg)`,
          opacity: logoOpacity * 0.5,
        }}>
          <div style={{
            width: 4, height: 4, borderRadius: "50%", background: "rgba(74,222,128,0.7)",
            position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
          }} />
        </div>

        {/* Logo */}
        <div style={{
          transform: `scale(${logoScale}) translateY(${logoFloat}px)`,
          opacity: logoOpacity,
          filter: `drop-shadow(0 0 ${20 + pulse * 20}px rgba(34,197,94,${0.4 + pulse * 0.15}))`,
        }}>
          <SageClover size={108} />
        </div>
      </div>

      {/* SAGE wordmark */}
      <div style={{
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: "#f0fdf4",
        opacity: sageOpacity,
        transform: `translateY(${sageY}px)`,
        lineHeight: 1,
        marginBottom: 10,
      }}>
        Sage
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 21,
        color: "rgba(240,253,244,0.5)",
        fontWeight: 400,
        letterSpacing: "0.06em",
        opacity: tagOpacity,
        transform: `translateY(${tagY}px)`,
        marginBottom: 28,
      }}>
        Your AI expense assistant
      </div>

      {/* "by Spenny" badge */}
      <div style={{
        opacity: byOpacity,
        transform: `scale(${byScale})`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 99,
        padding: "6px 16px",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px 2px rgba(74,222,128,0.5)" }} />
        <span style={{
          fontSize: 13,
          color: "rgba(74,222,128,0.85)",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}>
          by Spenny AI
        </span>
      </div>
    </div>
  );
};
