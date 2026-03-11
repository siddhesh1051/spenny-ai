/**
 * SimpleLogoVariants — variations on the two-block offset shape
 * Same geometric language as SimpleLogoV2Icon, but with the sage gradient green.
 *
 * V1: Original proportions, gradient fill + radial ambient glow
 * V2: Thinner blocks (more letterform-like), gradient
 * V3: Blocks rotated — top-RIGHT, bottom-LEFT (mirror flip)
 * V4: Blocks with sharper notch — wider gap, bolder negative space
 */

const BG = "#030c07";
const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const G3 = "#0a3d22";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="0.5" stopColor={G2} />
        <stop offset="1" stopColor={G3} />
      </linearGradient>
      <radialGradient id={`rg-${id}`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor={G2} stopOpacity="0.2" />
        <stop offset="100%" stopColor={G2} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 — Original shape, sage gradient
// ─────────────────────────────────────────────────────────────────────────────

function V1_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="v1" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-v1)" />
      {/* Top-left block */}
      <rect x="14" y="14" width="50" height="30" rx="8" fill="url(#lg-v1)" />
      {/* Bottom-right block */}
      <rect x="36" y="56" width="50" height="30" rx="8" fill="url(#lg-v1)" />
      {/* Connector */}
      <rect x="36" y="36" width="14" height="28" rx="0" fill="url(#lg-v1)" />
      {/* Negative space */}
      <rect x="50" y="36" width="14" height="28" rx="0" fill={BG} />
    </svg>
  );
}

export const SimpleV1: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <V1_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// V2 — Thinner, taller blocks — more refined letterform feel
// ─────────────────────────────────────────────────────────────────────────────

function V2_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="v2" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-v2)" />
      {/* Top-left block — taller, narrower */}
      <rect x="14" y="12" width="52" height="26" rx="8" fill="url(#lg-v2)" />
      {/* Bottom-right block */}
      <rect x="34" y="62" width="52" height="26" rx="8" fill="url(#lg-v2)" />
      {/* Connector — thinner */}
      <rect x="34" y="30" width="12" height="40" rx="0" fill="url(#lg-v2)" />
      {/* Negative space */}
      <rect x="46" y="30" width="20" height="40" rx="0" fill={BG} />
    </svg>
  );
}

export const SimpleV2: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <V2_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// V3 — Mirrored: top-RIGHT block, bottom-LEFT block
// ─────────────────────────────────────────────────────────────────────────────

function V3_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="v3" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-v3)" />
      {/* Top-RIGHT block */}
      <rect x="36" y="14" width="50" height="30" rx="8" fill="url(#lg-v3)" />
      {/* Bottom-LEFT block */}
      <rect x="14" y="56" width="50" height="30" rx="8" fill="url(#lg-v3)" />
      {/* Connector — on right side */}
      <rect x="50" y="36" width="14" height="28" rx="0" fill="url(#lg-v3)" />
      {/* Negative space */}
      <rect x="36" y="36" width="14" height="28" rx="0" fill={BG} />
    </svg>
  );
}

export const SimpleV3: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <V3_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// V4 — Wider gap / bolder negative space — punchier look
// ─────────────────────────────────────────────────────────────────────────────

function V4_SVG({ size = 512 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Defs id="v4" />
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#rg-v4)" />
      {/* Top-left block — shorter, wider */}
      <rect x="12" y="14" width="54" height="28" rx="9" fill="url(#lg-v4)" />
      {/* Bottom-right block */}
      <rect x="34" y="58" width="54" height="28" rx="9" fill="url(#lg-v4)" />
      {/* Connector — same width as gap */}
      <rect x="34" y="34" width="12" height="32" rx="0" fill="url(#lg-v4)" />
      {/* Negative space — wider notch */}
      <rect x="46" y="34" width="22" height="32" rx="0" fill={BG} />
    </svg>
  );
}

export const SimpleV4: React.FC = () => (
  <div style={{ width: 512, height: 512, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <V4_SVG size={512} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHEET — all 4 side by side for comparison
// ─────────────────────────────────────────────────────────────────────────────

export const SimpleVariantsSheet: React.FC = () => {
  const SIZE = 190;
  const variants = [
    { el: <V1_SVG size={SIZE} />, label: "V1 — Original" },
    { el: <V2_SVG size={SIZE} />, label: "V2 — Thinner" },
    { el: <V3_SVG size={SIZE} />, label: "V3 — Mirrored" },
    { el: <V4_SVG size={SIZE} />, label: "V4 — Wide notch" },
  ];

  return (
    <div style={{
      width: 1100, height: 380,
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
        Spenny AI — Geometric Block Variants
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        {variants.map(({ el, label }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{
              width: SIZE, height: SIZE,
              borderRadius: 22, overflow: "hidden",
              border: "1px solid rgba(61,214,140,0.07)",
            }}>
              {el}
            </div>
            <span style={{
              color: "rgba(255,255,255,0.32)", fontSize: 11,
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
