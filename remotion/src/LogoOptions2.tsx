/**
 * LogoOptions2 — 5 fresh logo directions with the original glowy green
 *
 * All use the gradient G1→G2→G3 + radial ambient glow from the original logo.
 *
 * E: Hexagon outline — thin ring with gradient stroke + inner glow
 * F: Two arcs forming a circular "C" / crescent, like a loading ring
 * G: Three rising bars (chart/finance) with gradient fill + glow
 * H: Bold leaf / teardrop shape — organic yet geometric
 * I: Circle with a cut wedge (like a pie chart with one slice missing)
 */

const BG  = "#030c07";
const G1  = "#3dd68c";
const G2  = "#1a8a5a";
const G3  = "#0a3d22";

// ─────────────────────────────────────────────────────────────────────────────
// Shared defs factory (unique id per instance)
// ─────────────────────────────────────────────────────────────────────────────

function Defs({ id }: { id: string }) {
  return (
    <defs>
      {/* Main diagonal gradient */}
      <linearGradient id={`lg-${id}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="0.55" stopColor={G2} />
        <stop offset="1" stopColor={G3} />
      </linearGradient>
      {/* Radial ambient glow — same as original */}
      <radialGradient id={`rg-${id}`} cx="50%" cy="42%" r="55%">
        <stop offset="0%" stopColor={G2} stopOpacity="0.22" />
        <stop offset="100%" stopColor={G2} stopOpacity="0" />
      </radialGradient>
      {/* Soft inner glow for strokes */}
      <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function BgRect({ id, rx = 14 }: { id: string; rx?: number }) {
  return (
    <>
      <rect width="64" height="64" rx={rx} fill={BG} />
      <rect width="64" height="64" rx={rx} fill={`url(#rg-${id})`} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// E — Hexagon outline ring + solid center dot
// ─────────────────────────────────────────────────────────────────────────────

function OptionE_SVG({ id, size = 512 }: { id: string; size?: number }) {
  // Regular hexagon centered at (32,32), radius 22
  const r = 22;
  const cx = 32, cy = 32;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

  const ri = 14;
  const ptsI = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + ri * Math.cos(a)},${cy + ri * Math.sin(a)}`;
  }).join(" ");

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id={id} />
      <BgRect id={id} />
      {/* Outer hex ring — filled with semi-transparent gradient */}
      <polygon points={pts} fill={`url(#lg-${id})`} opacity="0.12" />
      <polygon points={pts} fill="none" stroke={`url(#lg-${id})`} strokeWidth="2.4" filter={`url(#glow-${id})`} />
      {/* Inner hex — solid fill, darker */}
      <polygon points={ptsI} fill={`url(#lg-${id})`} opacity="0.08" />
      <polygon points={ptsI} fill="none" stroke={G1} strokeWidth="1" strokeOpacity="0.2" />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r="3.5" fill={`url(#lg-${id})`} filter={`url(#glow-${id})`} />
    </svg>
  );
}

export const LogoOptionE: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionE_SVG id="e" size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// F — Bold rising bars (finance / spending chart)
//     Three bars at 40%, 65%, 100% height, thick, gradient + glow
// ─────────────────────────────────────────────────────────────────────────────

function OptionF_SVG({ id, size = 512 }: { id: string; size?: number }) {
  const bars = [
    { x: 10, h: 20, y: 34 },
    { x: 25, h: 30, y: 24 },
    { x: 40, h: 42, y: 12 },
  ];
  const bw = 13;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id={id} />
      <BgRect id={id} />
      {/* Bars — gradient fill, slight glow */}
      {bars.map(({ x, h, y }) => (
        <rect
          key={x}
          x={x} y={y} width={bw} height={h} rx="3.5"
          fill={`url(#lg-${id})`}
          filter={`url(#glow-${id})`}
        />
      ))}
      {/* Baseline */}
      <rect x="10" y="55" width="43" height="2" rx="1" fill={G1} opacity="0.25" />
    </svg>
  );
}

export const LogoOptionF: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionF_SVG id="f" size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// G — Coin / circle with gradient stroke + orbit arc
//     Clean, minimal, finance/crypto feel
// ─────────────────────────────────────────────────────────────────────────────

function OptionG_SVG({ id, size = 512 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id={id} />
      <BgRect id={id} />
      {/* Main ring */}
      <circle cx="32" cy="32" r="22" stroke={`url(#lg-${id})`} strokeWidth="2.8" fill="none" />
      {/* Inner ring — with padding from dots */}
      <circle cx="32" cy="32" r="15.5" stroke={`url(#lg-${id})`} strokeWidth="1" strokeOpacity="0.35" fill="none" />
      {/* Three dots — smaller, spaced with padding from inner ring */}
      <circle cx="24" cy="32" r="2.2" fill={`url(#lg-${id})`} />
      <circle cx="32" cy="32" r="2.2" fill={`url(#lg-${id})`} />
      <circle cx="40" cy="32" r="2.2" fill={`url(#lg-${id})`} />
    </svg>
  );
}

export const LogoOptionG: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionG_SVG id="g" size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// H — Leaf / teardrop mark
//     A single bold organic shape — top-right point, rounded base
// ─────────────────────────────────────────────────────────────────────────────

function OptionH_SVG({ id, size = 512 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id={id} />
      <BgRect id={id} />
      {/* Outer leaf — filled */}
      <path
        d="M32 10 C50 10 54 30 54 38 C54 50 44 56 32 56 C20 56 10 50 10 38 C10 30 14 10 32 10 Z"
        fill={`url(#lg-${id})`}
        opacity="0.13"
      />
      {/* Outer leaf stroke */}
      <path
        d="M32 10 C50 10 54 30 54 38 C54 50 44 56 32 56 C20 56 10 50 10 38 C10 30 14 10 32 10 Z"
        fill="none"
        stroke={`url(#lg-${id})`}
        strokeWidth="2.4"
        filter={`url(#glow-${id})`}
      />
      {/* Inner stem */}
      <line x1="32" y1="20" x2="32" y2="50" stroke={G1} strokeWidth="1" strokeOpacity="0.25" strokeLinecap="round" />
      {/* Side vein left */}
      <path d="M32 30 Q22 34 20 42" stroke={G1} strokeWidth="1" strokeOpacity="0.2" strokeLinecap="round" fill="none" />
      {/* Side vein right */}
      <path d="M32 30 Q42 34 44 42" stroke={G1} strokeWidth="1" strokeOpacity="0.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export const LogoOptionH: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionH_SVG id="h" size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// I — Two concentric arcs (open ring / speed dial)
//     A thick outer arc + thinner inner arc, both with gradient + glow
//     Simple, premium, tech feel — like a monitoring gauge
// ─────────────────────────────────────────────────────────────────────────────

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function OptionI_SVG({ id, size = 512 }: { id: string; size?: number }) {
  const cx = 32, cy = 34;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id={id} />
      <BgRect id={id} />

      {/* Outer arc — 220° sweep, gap at top */}
      <path
        d={arc(cx, cy, 20, 160, 380)}
        stroke={`url(#lg-${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter={`url(#glow-${id})`}
      />
      {/* Inner arc — slightly shorter sweep */}
      <path
        d={arc(cx, cy, 12, 175, 365)}
        stroke={G1}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.25"
        fill="none"
      />
      {/* Dot at tip of outer arc */}
      <circle
        cx={cx + 20 * Math.cos((380 * Math.PI) / 180)}
        cy={cy + 20 * Math.sin((380 * Math.PI) / 180)}
        r="2.2"
        fill={G1}
        filter={`url(#glow-${id})`}
      />
    </svg>
  );
}

export const LogoOptionI: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionI_SVG id="i" size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON SHEET — all 5 side by side, 2 rows
// ─────────────────────────────────────────────────────────────────────────────

export const LogoOptions2Sheet: React.FC = () => {
  const SIZE = 180;
  const options = [
    { el: <OptionE_SVG id="se" size={SIZE} />, label: "E — Hexagon" },
    { el: <OptionF_SVG id="sf" size={SIZE} />, label: "F — Rising Bars" },
    { el: <OptionG_SVG id="sg" size={SIZE} />, label: "G — Coin / $ Ring" },
    { el: <OptionH_SVG id="sh" size={SIZE} />, label: "H — Leaf" },
    { el: <OptionI_SVG id="si" size={SIZE} />, label: "I — Arc Gauge" },
  ];

  return (
    <div style={{
      width: 1400, height: 420,
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        color: "rgba(255,255,255,0.18)", fontSize: 11,
        letterSpacing: "0.18em", textTransform: "uppercase",
        fontFamily: "monospace", marginBottom: 32,
      }}>
        Spenny AI — New Logo Options (glowy green)
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        {options.map(({ el, label }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{
              width: SIZE, height: SIZE, background: BG,
              borderRadius: 24, overflow: "hidden",
              border: "1px solid rgba(61,214,140,0.08)",
            }}>
              {el}
            </div>
            <span style={{
              color: "rgba(255,255,255,0.35)", fontSize: 12,
              letterSpacing: "0.05em", fontFamily: "monospace",
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
