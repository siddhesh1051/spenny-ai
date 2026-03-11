/**
 * LogoLoader — Spins continuously with irregular speed + zooms in/out simultaneously.
 * 90 frames @ 30fps = 3s loop
 */

import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const G3 = "#0a3d22";

function MarkSVG({ size = 100, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="ll-lg" x1="90" y1="10" x2="10" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.5" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
        <clipPath id="ll-cl">
          <rect x="36" y="14" width="50" height="30" />
          <rect x="14" y="56" width="50" height="30" />
          <rect x="50" y="36" width="14" height="28" />
        </clipPath>
      </defs>
      <rect width="100" height="100" fill="url(#ll-lg)" clipPath="url(#ll-cl)" />
    </svg>
  );
}

export const LogoLoader: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const loopFrame = frame % durationInFrames;
  const t = loopFrame / durationInFrames; // 0 → 1

  // Spin: linear — constant speed
  const rotation = interpolate(
    loopFrame,
    [0, durationInFrames],
    [0, 360],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Zoom: sine wave — 0.72 → 1.05 → 0.72 (slightly overshoots 1 for punch)
  const sinT = Math.sin(t * Math.PI * 2);
  const zoom = interpolate(sinT, [-1, 1], [0.80, 1.1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ghosts = [
    { offset: -22, opacity: 0.32, scale: 0.93 },
    { offset: -42, opacity: 0.14, scale: 0.86 },
    { offset: -62, opacity: 0.05, scale: 0.79 },
  ];

  const logoSize = 68;
  const canvasSize = 110;

  return (
    <div
      style={{
        width: canvasSize,
        height: canvasSize,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {ghosts.map(({ offset, opacity, scale }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: logoSize,
            height: logoSize,
            transform: `rotate(${rotation + offset}deg) scale(${zoom * scale})`,
            transformOrigin: "center",
          }}
        >
          <MarkSVG size={logoSize} opacity={opacity} />
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          width: logoSize,
          height: logoSize,
          transform: `rotate(${rotation}deg) scale(${zoom})`,
          transformOrigin: "center",
        }}
      >
        <MarkSVG size={logoSize} opacity={1} />
      </div>
    </div>
  );
};
