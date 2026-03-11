/**
 * LogoV2 — The chosen mark: mirrored sharp two-block shape
 *
 * Variants:
 *   logo-v2-dark          green gradient on dark bg (primary)
 *   logo-v2-light         green gradient on off-white bg
 *   logo-v2-black-white   pure black bg, pure white shape
 *   logo-v2-white-black   pure white bg, pure black shape
 *   logo-v2-transparent   transparent bg, green gradient shape (SVG only)
 *   logo-v2-sheet         all variants on one sheet
 *   logo-v2-lockup        icon + wordmark horizontal lockup
 */

import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", { weights: ["800"], subsets: ["latin"] });

// ── Colors ───────────────────────────────────────────────────────────────────
const BG    = "#030c07";
const WHITE = "#f5f5f0";
const G1    = "#3dd68c";
const G2    = "#1a8a5a";
const G3    = "#0a3d22";

// ── The mark SVG ─────────────────────────────────────────────────────────────
// Sharp mirrored two-block shape (top-right + bottom-left, no rounded corners)

type FillMode = "gradient" | "white" | "black";

function MarkSVG({
  size = 512,
  fill = "gradient",
  bg = BG,
  transparent = false,
}: {
  size?: number;
  fill?: FillMode;
  bg?: string;
  transparent?: boolean;
}) {
  const uid     = `lv2-${fill}-${transparent ? "t" : "o"}`;
  const lgId    = `lg-${uid}`;
  const rgId    = `rg-${uid}`;
  const clipId  = `cl-${uid}`;

  const shapeFill =
    fill === "gradient" ? `url(#${lgId})` :
    fill === "white"    ? "#f0f0ee"        : "#1a1a18";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Gradient: top-right → bottom-left (matches mirrored shape) */}
        <linearGradient id={lgId} x1="90" y1="10" x2="10" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.5" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
        {/* Subtle radial ambient */}
        <radialGradient id={rgId} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={G2} stopOpacity="0.2" />
          <stop offset="100%" stopColor={G2} stopOpacity="0" />
        </radialGradient>
        {/* Clip = top-right block + bottom-left block + connector (all sharp) */}
        <clipPath id={clipId}>
          <rect x="36" y="14" width="50" height="30" />
          <rect x="14" y="56" width="50" height="30" />
          <rect x="50" y="36" width="14" height="28" />
        </clipPath>
      </defs>

      {/* Background */}
      {!transparent && <rect width="100" height="100" fill={bg} />}
      {!transparent && fill === "gradient" && (
        <rect width="100" height="100" fill={`url(#${rgId})`} />
      )}

      {/* Shape */}
      <rect width="100" height="100" fill={shapeFill} clipPath={`url(#${clipId})`} />
    </svg>
  );
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────

function Canvas({ size = 512, bg, children }: { size?: number; bg?: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: size, height: size,
      background: bg ?? "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
    </div>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

/** Primary — gradient green on near-black */
export const LogoV2Dark: React.FC = () => (
  <Canvas size={512} bg={BG}>
    <MarkSVG size={512} fill="gradient" bg={BG} />
  </Canvas>
);

/** Green gradient on off-white */
export const LogoV2Light: React.FC = () => (
  <Canvas size={512} bg={WHITE}>
    <MarkSVG size={512} fill="gradient" bg={WHITE} />
  </Canvas>
);

/** Off-white shape on off-black */
export const LogoV2BlackWhite: React.FC = () => (
  <Canvas size={512} bg="#111110">
    <MarkSVG size={512} fill="white" bg="#111110" />
  </Canvas>
);

/** Off-black shape on off-white */
export const LogoV2WhiteBlack: React.FC = () => (
  <Canvas size={512} bg="#f0f0ee">
    <MarkSVG size={512} fill="black" bg="#f0f0ee" />
  </Canvas>
);

/** Transparent bg — gradient shape, no background */
export const LogoV2Transparent: React.FC = () => (
  <MarkSVG size={512} fill="gradient" transparent />
);

// ── Brand Sheet ───────────────────────────────────────────────────────────────

export const LogoV2Sheet: React.FC = () => {
  const S = 160;
  const variants: { el: React.ReactNode; label: string; border?: string }[] = [
    { el: <MarkSVG size={S} fill="gradient" bg={BG} />,        label: "Dark (primary)",    border: "rgba(61,214,140,0.12)" },
    { el: <MarkSVG size={S} fill="gradient" bg={WHITE} />,     label: "Light",             border: "rgba(0,0,0,0.08)" },
    { el: <MarkSVG size={S} fill="white"    bg="#111110" />,   label: "Dark / Light",      border: "rgba(255,255,255,0.08)" },
    { el: <MarkSVG size={S} fill="black"    bg="#f0f0ee" />,   label: "Light / Dark",      border: "rgba(0,0,0,0.1)" },
    { el: <MarkSVG size={S} fill="gradient" transparent />,    label: "Transparent",       border: "rgba(61,214,140,0.1)" },
  ];

  const bgs = [BG, WHITE, "#111110", "#f0f0ee", undefined];

  return (
    <div style={{
      width: 1300, height: 440,
      background: "#0a0f0b",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Header */}
      <div style={{
        color: "rgba(255,255,255,0.2)", fontSize: 11,
        letterSpacing: "0.2em", textTransform: "uppercase",
        fontFamily: "monospace", marginBottom: 36,
      }}>
        Spenny AI — Logo V2 · All Variants
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {variants.map(({ el, label }, i) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{
              width: S, height: S,
              background: bgs[i] ?? "transparent",
              backgroundImage: bgs[i] === undefined
                ? "repeating-conic-gradient(#1a2a1e 0% 25%, #111811 0% 50%)"
                : undefined,
              backgroundSize: bgs[i] === undefined ? "16px 16px" : undefined,
              border: `1px solid ${variants[i].border ?? "transparent"}`,
              overflow: "hidden",
            }}>
              {el}
            </div>
            <span style={{
              color: "rgba(255,255,255,0.3)", fontSize: 11,
              letterSpacing: "0.04em", fontFamily: "monospace",
            }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Color tokens row */}
      <div style={{
        display: "flex", gap: 24, marginTop: 36,
        alignItems: "center",
      }}>
        {[
          { c: G1,    n: "#3DD68C", label: "Sage Light" },
          { c: G2,    n: "#1A8A5A", label: "Sage" },
          { c: G3,    n: "#0A3D22", label: "Sage Deep" },
          { c: BG,    n: "#030C07", label: "Background", border: true },
        ].map(({ c, n, label, border }) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 22, height: 22, background: c,
              border: border ? "1px solid rgba(255,255,255,0.12)" : "none",
            }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace" }}>{label}</div>
              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "monospace" }}>{n}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Lockup (icon + wordmark) ──────────────────────────────────────────────────

export const LogoV2Lockup: React.FC = () => (
  <div style={{
    width: 960, height: 260,
    background: BG,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 36, padding: "0 60px",
  }}>
    <MarkSVG size={148} fill="gradient" bg={BG} />
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
        <span style={{
          fontSize: 84, fontWeight: 800, color: "#ffffff",
          letterSpacing: "-4px", lineHeight: 1, fontFamily,
        }}>Spenny</span>
        <span style={{
          fontSize: 84, fontWeight: 800, letterSpacing: "-4px", lineHeight: 1, fontFamily,
          background: `linear-gradient(135deg, ${G1}, ${G2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>AI</span>
      </div>
      <span style={{
        fontSize: 17, fontWeight: 400,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.22em", textTransform: "uppercase",
        marginTop: 8, fontFamily,
      }}>Agentic Expense Tracker</span>
    </div>
  </div>
);

/** Lockup — icon transparent bg only (still has dark canvas) */
export const LogoV2LockupTransparent: React.FC = () => (
  <div style={{
    width: 960, height: 260,
    background: BG,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 28, padding: "0 60px",
  }}>
    <MarkSVG size={148} fill="gradient" transparent />
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
        <span style={{
          fontSize: 84, fontWeight: 800, color: "#ffffff",
          letterSpacing: "-4px", lineHeight: 1, fontFamily,
        }}>Spenny</span>
        <span style={{
          fontSize: 84, fontWeight: 800, letterSpacing: "-4px", lineHeight: 1, fontFamily,
          background: `linear-gradient(135deg, ${G1}, ${G2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>AI</span>
      </div>
      <span style={{
        fontSize: 17, fontWeight: 400,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.22em", textTransform: "uppercase",
        marginTop: 8, fontFamily,
      }}>Agentic Expense Tracker</span>
    </div>
  </div>
);

/** Lockup — fully transparent PNG (no background at all, works on any color) */
export const LogoV2LockupFullTransparent: React.FC = () => (
  <div style={{
    width: 960, height: 260,
    background: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 28, padding: "0 60px",
  }}>
    <MarkSVG size={148} fill="gradient" transparent />
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
        <span style={{
          fontSize: 84, fontWeight: 800, color: "#ffffff",
          letterSpacing: "-4px", lineHeight: 1, fontFamily,
        }}>Spenny</span>
        <span style={{
          fontSize: 84, fontWeight: 800, letterSpacing: "-4px", lineHeight: 1, fontFamily,
          background: `linear-gradient(135deg, ${G1}, ${G2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>AI</span>
      </div>
      <span style={{
        fontSize: 17, fontWeight: 400,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: "0.22em", textTransform: "uppercase",
        marginTop: 8, fontFamily,
      }}>Agentic Expense Tracker</span>
    </div>
  </div>
);
