import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

const BG = "#030c07";
const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const G3 = "#0a3d22";

// Core icon — coin circle + chat tail + three dots
function CoinChatSVG({ id, size = 512, lightBg = false }: { id: string; size?: number; lightBg?: boolean }) {
  const bg = lightBg ? "#e8f7ef" : BG;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`cg-${id}`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
        <radialGradient id={`rg-${id}`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor={G2} stopOpacity={lightBg ? "0.25" : "0.18"} />
          <stop offset="100%" stopColor={G2} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Background */}
      <rect width="64" height="64" rx="14" fill={bg} />
      <rect width="64" height="64" rx="14" fill={`url(#rg-${id})`} />
      {/* Icon content scaled to 76% and centered — adds ~7px padding all around */}
      <g transform="translate(32,32) scale(0.76) translate(-32,-31)">
        {/* Coin fill */}
        <circle cx="32" cy="28" r="22" fill={`url(#cg-${id})`} opacity="0.13" />
        {/* Coin outer ring */}
        <circle cx="32" cy="28" r="22" fill="none" stroke={`url(#cg-${id})`} strokeWidth="2.5" />
        {/* Inner ring subtle */}
        <circle cx="32" cy="28" r="15" fill="none" stroke={G1} strokeWidth="1" strokeOpacity="0.22" />
        {/* Chat tail */}
        <path d="M22 50 C18 57 12 61 8 63 C17 60 27 55 33 48" fill={`url(#cg-${id})`} />
        {/* Three dots */}
        <circle cx="25" cy="28" r="2.6" fill={`url(#cg-${id})`} />
        <circle cx="32" cy="28" r="2.6" fill={`url(#cg-${id})`} />
        <circle cx="39" cy="28" r="2.6" fill={`url(#cg-${id})`} />
      </g>
    </svg>
  );
}

// Standalone icon (no bg rect — for transparent use)
function CoinChatBare({ id, size = 512 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`cg-${id}`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="28" r="22" fill={`url(#cg-${id})`} opacity="0.13" />
      <circle cx="32" cy="28" r="22" fill="none" stroke={`url(#cg-${id})`} strokeWidth="2.5" />
      <circle cx="32" cy="28" r="15" fill="none" stroke={G1} strokeWidth="1" strokeOpacity="0.22" />
      <path d="M22 50 C18 57 12 61 8 63 C17 60 27 55 33 48" fill={`url(#cg-${id})`} />
      {/* Three dots */}
      <circle cx="25" cy="28" r="2.6" fill={`url(#cg-${id})`} />
      <circle cx="32" cy="28" r="2.6" fill={`url(#cg-${id})`} />
      <circle cx="39" cy="28" r="2.6" fill={`url(#cg-${id})`} />
    </svg>
  );
}

// ── Exports ─────────────────────────────────────────────────────────────────

export const IconCoinChat: React.FC<{ size?: number; light?: boolean }> = ({ size = 512, light = false }) => (
  <CoinChatSVG id={`icon${light}`} size={size} lightBg={light} />
);

export const LockupCoinChat: React.FC = () => (
  <div style={{
    width: 900, height: 260, background: BG,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 32, padding: "0 60px", fontFamily,
  }}>
    <CoinChatBare id="lockup" size={148} />
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontSize: 80, fontWeight: 800, color: "white", letterSpacing: "-3.5px", lineHeight: 1 }}>Spenny</span>
        <span style={{
          fontSize: 80, fontWeight: 800, letterSpacing: "-3.5px", lineHeight: 1,
          background: `linear-gradient(135deg,${G1},${G2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>AI</span>
      </div>
      <span style={{
        fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 6,
      }}>Agentic Expense Tracker</span>
    </div>
  </div>
);

export const SheetCoinChat: React.FC = () => (
  <div style={{ width: 1200, height: 700, background: "#06100a", fontFamily, position: "relative" }}>
    <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Spenny AI — Brand Identity
      </span>
    </div>
    {/* Large icon */}
    <div style={{ position: "absolute", top: 64, left: 64 }}>
      <CoinChatSVG id="sheet-main" size={220} />
    </div>
    {/* Wordmark */}
    <div style={{ position: "absolute", top: 104, left: 320, display: "flex", alignItems: "baseline" }}>
      <span style={{ fontSize: 100, fontWeight: 800, color: "white", letterSpacing: "-4px", lineHeight: 1 }}>Spenny</span>
      <span style={{
        fontSize: 100, fontWeight: 800, letterSpacing: "-4px", lineHeight: 1,
        background: `linear-gradient(135deg,${G1},${G2})`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>AI</span>
    </div>
    <span style={{
      position: "absolute", top: 234, left: 322,
      fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.28)",
      letterSpacing: "0.2em", textTransform: "uppercase",
    }}>Agentic Expense Tracker</span>
    {/* Size scale */}
    <div style={{ position: "absolute", bottom: 60, left: 64, display: "flex", alignItems: "flex-end", gap: 32 }}>
      {[100, 72, 52, 40, 28].map((s) => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <CoinChatBare id={`scale-${s}`} size={s} />
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 10 }}>{s}px</span>
        </div>
      ))}
      <div style={{ width: 1, height: 80, background: "rgba(255,255,255,0.07)", alignSelf: "center" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <CoinChatSVG id="sheet-light" size={72} lightBg={true} />
        <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 10 }}>Light bg</span>
      </div>
    </div>
    {/* Color palette */}
    <div style={{ position: "absolute", top: 76, right: 64, display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        { c: G1, n: "Sage Light", h: "#3DD68C" },
        { c: G2, n: "Sage",       h: "#1A8A5A" },
        { c: G3, n: "Sage Deep",  h: "#0A3D22" },
        { c: BG, n: "Background", h: "#030C07", border: true },
      ].map(({ c, n, h, border }: { c: string; n: string; h: string; border?: boolean }) => (
        <div key={h} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: c,
            border: border ? "1px solid rgba(255,255,255,0.1)" : "none",
          }} />
          <div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600 }}>{n}</div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontFamily: "monospace" }}>{h}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
