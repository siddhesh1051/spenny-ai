/**
 * LogoFresh — fresh geometric shapes, same style as SimpleLogoV2Icon
 * (dark bg #030c07, sage gradient #3dd68c→#1a8a5a→#0a3d22, radial ambient)
 *
 * J: Bold upward chevron / arrow — confidence, growth
 * K: Rounded plus/cross with cutouts — balance, precision  
 * L: Shield with horizontal slot cutout — protection, finance
 * M: Bold pill split by a diagonal cut — movement, speed
 * N: Four-pointed spark / compass star — intelligence, AI
 */

const BG = "#030c07";
const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const G3 = "#0a3d22";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`lg-${id}`} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="0.5" stopColor={G2} />
        <stop offset="1" stopColor={G3} />
      </linearGradient>
      <radialGradient id={`rg-${id}`} cx="50%" cy="45%" r="58%">
        <stop offset="0%" stopColor={G2} stopOpacity="0.22" />
        <stop offset="100%" stopColor={G2} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// J — Bold upward chevron (two thick strokes meeting at a point)
// ─────────────────────────────────────────────────────────────────────────────

function J_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="j" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-j)" />
      {/* Left arm of chevron */}
      <path
        d="M16 72 L50 22 L50 42 L28 72 Z"
        fill="url(#lg-j)"
      />
      {/* Right arm of chevron */}
      <path
        d="M84 72 L50 22 L50 42 L72 72 Z"
        fill="url(#lg-j)"
      />
      {/* Round the tip */}
      <circle cx="50" cy="22" r="6" fill="url(#lg-j)" />
      {/* Round the bases */}
      <rect x="16" y="60" width="12" height="12" rx="6" fill="url(#lg-j)" />
      <rect x="72" y="60" width="12" height="12" rx="6" fill="url(#lg-j)" />
    </svg>
  );
}

export const LogoJ: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <J_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// K — Rounded plus / cross — four equal arms, bold
// ─────────────────────────────────────────────────────────────────────────────

function K_SVG({ size = 512 }: { size?: number }) {
  const arm = 20; // arm length from center
  const w = 16;   // arm width
  const cx = 50, cy = 50;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="k" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-k)" />
      {/* Vertical arm */}
      <rect x={cx - w/2} y={cy - arm - w/2} width={w} height={arm * 2 + w} rx={w/2} fill="url(#lg-k)" />
      {/* Horizontal arm */}
      <rect x={cx - arm - w/2} y={cy - w/2} width={arm * 2 + w} height={w} rx={w/2} fill="url(#lg-k)" />
    </svg>
  );
}

export const LogoK: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <K_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// L — Shield with a horizontal pill cutout inside
// ─────────────────────────────────────────────────────────────────────────────

function L_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="l" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-l)" />
      {/* Shield shape */}
      <path
        d="M50 14 L82 26 L82 52 C82 68 66 80 50 86 C34 80 18 68 18 52 L18 26 Z"
        fill="url(#lg-l)"
      />
      {/* Horizontal pill cutout */}
      <rect x="32" y="44" width="36" height="12" rx="6" fill={BG} />
    </svg>
  );
}

export const LogoL: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <L_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// M — Two bold rounded rectangles side by side, slight vertical offset
//     Like a bar chart with 2 bars — clean, finance, minimal
// ─────────────────────────────────────────────────────────────────────────────

function M_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="m" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-m)" />
      {/* Left bar — shorter */}
      <rect x="18" y="36" width="28" height="50" rx="10" fill="url(#lg-m)" />
      {/* Right bar — taller */}
      <rect x="54" y="14" width="28" height="72" rx="10" fill="url(#lg-m)" />
    </svg>
  );
}

export const LogoM: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <M_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// N — Single bold rounded square, rotated 45° (diamond) with inner ring cutout
//     Super clean, confident — like a gem or a tile
// ─────────────────────────────────────────────────────────────────────────────

function N_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="n" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-n)" />
      {/* Outer diamond — rounded square rotated 45° */}
      <rect
        x="21" y="21" width="58" height="58" rx="12"
        fill="url(#lg-n)"
        transform="rotate(45 50 50)"
      />
      {/* Inner cutout — smaller diamond */}
      <rect
        x="32" y="32" width="36" height="36" rx="8"
        fill={BG}
        transform="rotate(45 50 50)"
      />
    </svg>
  );
}

export const LogoN: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <N_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHEET
// ─────────────────────────────────────────────────────────────────────────────

export const LogoFreshSheet: React.FC = () => {
  const SIZE = 180;
  const items = [
    { el: <J_SVG size={SIZE} />, label: "J — Chevron" },
    { el: <K_SVG size={SIZE} />, label: "K — Plus" },
    { el: <L_SVG size={SIZE} />, label: "L — Shield" },
    { el: <M_SVG size={SIZE} />, label: "M — Two bars" },
    { el: <N_SVG size={SIZE} />, label: "N — Diamond ring" },
  ];

  return (
    <div style={{
      width: 1300, height: 380,
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        color: "rgba(255,255,255,0.16)", fontSize: 11,
        letterSpacing: "0.18em", textTransform: "uppercase",
        fontFamily: "monospace", marginBottom: 32,
      }}>
        Spenny AI — Fresh Shapes
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        {items.map(({ el, label }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{
              width: SIZE, height: SIZE,
              borderRadius: 22, overflow: "hidden",
              border: "1px solid rgba(61,214,140,0.07)",
            }}>
              {el}
            </div>
            <span style={{
              color: "rgba(255,255,255,0.3)", fontSize: 11,
              letterSpacing: "0.05em", fontFamily: "monospace",
            }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
