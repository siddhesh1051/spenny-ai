/**
 * LogoOptions — 4 distinct new logo directions for Spenny AI
 *
 * A: Bold diamond / gem mark with inner cutout
 * B: Three staggered horizontal bars (flow / Xflow inspired)
 * C: Geometric bold "S" letterform — single solid path
 * D: Two overlapping pill shapes with negative space overlap
 */

const BG = "#030c07";
const G1 = "#3dd68c";

// ─────────────────────────────────────────────────────────────────────────────
// OPTION A — Diamond gem with inner triangle cutout
// Bold, confident, unique. Clean at any size.
// ─────────────────────────────────────────────────────────────────────────────

function OptionA_SVG({ size = 512, dark = true }: { size?: number; dark?: boolean }) {
  const fill = dark ? G1 : BG;
  const bg = dark ? BG : G1;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill={bg} />
      {/* Outer diamond */}
      <path
        d="M50 10 L88 42 L50 90 L12 42 Z"
        fill={fill}
      />
      {/* Inner cutout — inverted triangle to create gem facet */}
      <path
        d="M50 28 L74 46 L50 70 L26 46 Z"
        fill={bg}
      />
      {/* Top cap — small solid triangle above the cutout */}
      <path
        d="M50 10 L88 42 L50 42 L12 42 Z"
        fill={fill}
        opacity="0"
      />
    </svg>
  );
}

export const LogoOptionA: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionA_SVG size={512} dark />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// OPTION B — Three bold horizontal bars, staggered left
// Clean, minimal, flows like a spending graph / Xflow-inspired
// ─────────────────────────────────────────────────────────────────────────────

function OptionB_SVG({ size = 512, dark = true }: { size?: number; dark?: boolean }) {
  const fill = dark ? G1 : BG;
  const bg = dark ? BG : G1;
  const barH = 14;
  const r = 7;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill={bg} />
      {/* Top bar — full width */}
      <rect x="14" y="22" width="72" height={barH} rx={r} fill={fill} />
      {/* Middle bar — shorter, shifted right */}
      <rect x="28" y="43" width="58" height={barH} rx={r} fill={fill} />
      {/* Bottom bar — shortest, shifted further right */}
      <rect x="42" y="64" width="44" height={barH} rx={r} fill={fill} />
    </svg>
  );
}

export const LogoOptionB: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionB_SVG size={512} dark />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// OPTION C — Two bold squares / blocks, one rotated 45°
// Simple geometric mark — a square + a diamond overlapping
// ─────────────────────────────────────────────────────────────────────────────

function OptionC_SVG({ size = 512, dark = true }: { size?: number; dark?: boolean }) {
  const fill = dark ? G1 : BG;
  const bg = dark ? BG : G1;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill={bg} />
      {/* Left upright square */}
      <rect x="12" y="28" width="40" height="44" rx="8" fill={fill} />
      {/* Right diamond (square rotated 45°) — centered on right half */}
      <rect
        x="48" y="28" width="40" height="44" rx="8" fill={fill}
        transform="rotate(45 68 50)"
      />
    </svg>
  );
}

export const LogoOptionC: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionC_SVG size={512} dark />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// OPTION D — Bold geometric "S" using a single clean SVG path
// Not two offset boxes — an actual letterform, very blocky / modern
// ─────────────────────────────────────────────────────────────────────────────

function OptionD_SVG({ size = 512, dark = true }: { size?: number; dark?: boolean }) {
  const fill = dark ? G1 : BG;
  const bg = dark ? BG : G1;
  // A clean, boxy "S" using only right-angle corners + rounded caps
  // Built as: top cap bar + upper-left vertical + middle bar + lower-right vertical + bottom cap bar
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill={bg} />

      {/* Top horizontal cap */}
      <rect x="22" y="14" width="56" height="16" rx="8" fill={fill} />

      {/* Upper-left vertical leg */}
      <rect x="22" y="14" width="16" height="38" rx="0" fill={fill} />
      <rect x="22" y="14" width="16" height="8" rx="8" fill={fill} />

      {/* Middle horizontal bar */}
      <rect x="22" y="42" width="56" height="16" rx="8" fill={fill} />

      {/* Lower-right vertical leg */}
      <rect x="62" y="42" width="16" height="38" rx="0" fill={fill} />
      <rect x="62" y="72" width="16" height="8" rx="8" fill={fill} />

      {/* Bottom horizontal cap */}
      <rect x="22" y="70" width="56" height="16" rx="8" fill={fill} />
    </svg>
  );
}

export const LogoOptionD: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <OptionD_SVG size={512} dark />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON SHEET — all 4 side by side
// ─────────────────────────────────────────────────────────────────────────────

export const LogoOptionsSheet: React.FC = () => {
  const options = [
    { svg: <OptionA_SVG size={180} dark />, label: "A — Gem Diamond" },
    { svg: <OptionB_SVG size={180} dark />, label: "B — Stacked Bars" },
    { svg: <OptionC_SVG size={180} dark />, label: "C — Square + Diamond" },
    { svg: <OptionD_SVG size={180} dark />, label: 'D — Boxy "S"' },
  ];

  return (
    <div
      style={{
        width: 1200,
        height: 420,
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        flexDirection: "column",
      }}
    >
      <div style={{
        color: "rgba(255,255,255,0.18)",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontFamily: "monospace",
        marginBottom: 32,
      }}>
        Spenny AI — Logo Options
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        {options.map(({ svg, label }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {svg}
            <span style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 12,
              letterSpacing: "0.06em",
              fontFamily: "monospace",
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
