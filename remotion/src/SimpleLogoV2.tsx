/**
 * SimpleLogoV2 — geometric two-block mark for Spenny AI
 * Variants: dark, mirrored-dark, mirrored-light, mirrored-sharp (no rounded corners)
 */

const BG    = "#030c07";
const WHITE = "#f5f5f0";
const G1    = "#3dd68c";
const G2    = "#1a8a5a";
const G3    = "#0a3d22";

// ─────────────────────────────────────────────────────────────────────────────
// Core SVG — parameterised by direction, light/dark, and corner radius
// ─────────────────────────────────────────────────────────────────────────────

type MarkProps = {
  size?: number;
  mirrored?: boolean;   // false = top-left / bottom-right, true = top-right / bottom-left
  light?: boolean;      // false = green on dark, true = dark on light bg
  sharp?: boolean;      // true = no rounded corners on the blocks
};

function MarkSVG({ size = 512, mirrored = false, light = false, sharp = false }: MarkProps) {
  const bg     = light ? WHITE : BG;
  const blockRx = sharp ? 0 : 8;
  const bgRx    = sharp ? 0 : 22;

  // unique ids per variant
  const uid = `${mirrored ? "m" : "o"}-${light ? "l" : "d"}-${sharp ? "s" : "r"}`;
  const lgId   = `lg-${uid}`;
  const rgId   = `rg-${uid}`;
  const clipId = `cl-${uid}`;

  // gradient direction: top-left→bottom-right for normal, top-right→bottom-left for mirrored
  const lgX1 = mirrored ? "90" : "10";
  const lgX2 = mirrored ? "10" : "90";

  // block positions
  const topX    = mirrored ? 36 : 14;
  const botX    = mirrored ? 14 : 36;
  const connX   = mirrored ? 50 : 36;

  // gradient colors: green-on-dark vs dark-on-light
  const c1 = light ? BG    : G1;
  const c2 = light ? G3    : G2;
  const c3 = light ? "#010603" : G3;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={lgId} x1={lgX1} y1="10" x2={lgX2} y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor={c1} />
          <stop offset="0.5" stopColor={c2} />
          <stop offset="1" stopColor={c3} />
        </linearGradient>
        <radialGradient id={rgId} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={G2} stopOpacity={light ? "0.12" : "0.22"} />
          <stop offset="100%" stopColor={G2} stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          {/* Top block */}
          <rect x={topX}  y="14" width="50" height="30" rx={blockRx} />
          {/* Bottom block */}
          <rect x={botX}  y="56" width="50" height="30" rx={blockRx} />
          {/* Connector */}
          <rect x={connX} y="36" width="14" height="28" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx={bgRx} fill={bg} />
      <rect width="100" height="100" rx={bgRx} fill={`url(#${rgId})`} />

      {/* Shape — clip reveals true bg through the notch */}
      <rect width="100" height="100" fill={`url(#${lgId})`} clipPath={`url(#${clipId})`} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

const wrap = (child: React.ReactNode, bg: string) => (
  <div style={{ width: 512, height: 512, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {child}
  </div>
);

// Original (kept for reference)
export const SimpleLogoV2Icon: React.FC = () =>
  wrap(<MarkSVG size={512} />, BG);

// Mirrored — dark bg
export const SimpleLogoV2Mirrored: React.FC = () =>
  wrap(<MarkSVG size={512} mirrored />, BG);

// Mirrored — light bg (dark shape on white)
export const SimpleLogoV2MirroredLight: React.FC = () =>
  wrap(<MarkSVG size={512} mirrored light />, WHITE);

// Mirrored — no rounded corners, dark bg
export const SimpleLogoV2MirroredSharp: React.FC = () =>
  wrap(<MarkSVG size={512} mirrored sharp />, BG);

// Unused legacy exports (kept so Root.tsx doesn't break)
export const SimpleLogoV2Light: React.FC = () =>
  wrap(<MarkSVG size={512} light />, WHITE);
export const SimpleLogoV2Sheet: React.FC = () =>
  wrap(<MarkSVG size={512} />, BG);
