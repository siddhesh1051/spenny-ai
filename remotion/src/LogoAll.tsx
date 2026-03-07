import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

const BG = "#030c07";
const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const G3 = "#0a3d22";

function Icon({
  id,
  size = 512,
  lightBg = false,
  children,
}: {
  id: string;
  size?: number;
  lightBg?: boolean;
  children: React.ReactNode;
}) {
  const bg = lightBg ? "#e8f7ef" : BG;
  const strokeColor = lightBg ? "#e8f7ef" : BG;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="115" fill={bg} />
      {!lightBg && (
        <>
          <radialGradient id={`glow${id}`} cx="50%" cy="38%" r="56%">
            <stop offset="0%" stopColor={G2} stopOpacity="0.35" />
            <stop offset="100%" stopColor={bg} stopOpacity="0" />
          </radialGradient>
          <rect width="512" height="512" rx="115" fill={`url(#glow${id})`} />
        </>
      )}
      <circle cx="262" cy="216" r="155" fill={`url(#cf${id})`} />
      <circle cx="262" cy="216" r="123" fill="none" stroke={strokeColor} strokeWidth="5" opacity={lightBg ? 0.12 : 0.15} />
      <path
        d="M178 352 C156 384 124 420 100 458 C146 440 200 412 228 388 C218 376 196 364 178 352Z"
        fill={`url(#cf${id})`}
      />
      <defs>
        <linearGradient id={`cf${id}`} x1="107" y1="62" x2="417" y2="460" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export const IconDots: React.FC<{ size?: number; light?: boolean }> = ({ size = 512, light = false }) => (
  <Icon id={`dots${light}`} size={size} lightBg={light}>
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={196 + i * 66} cy="218" r="24"
        fill={light ? "#e8f7ef" : BG} opacity="0.86" />
    ))}
  </Icon>
);

export const LockupDots: React.FC = () => (
  <div style={{
    width: 900, height: 260, background: BG,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 36, padding: "0 60px", fontFamily,
  }}>
    <IconDots size={148} />
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

export const SheetDots: React.FC = () => (
  <div style={{ width: 1200, height: 700, background: "#06100a", fontFamily, position: "relative" }}>
    <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Spenny AI — Brand Identity
      </span>
    </div>
    <div style={{ position: "absolute", top: 64, left: 64 }}>
      <IconDots size={220} />
    </div>
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
    <div style={{ position: "absolute", bottom: 60, left: 64, display: "flex", alignItems: "flex-end", gap: 32 }}>
      {[100, 72, 52, 40, 28].map((s) => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <IconDots size={s} />
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 10 }}>{s}px</span>
        </div>
      ))}
      <div style={{ width: 1, height: 80, background: "rgba(255,255,255,0.07)", alignSelf: "center" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ borderRadius: 16, overflow: "hidden" }}>
          <IconDots size={72} light={true} />
        </div>
        <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 10 }}>Light</span>
      </div>
    </div>
    <div style={{ position: "absolute", top: 76, right: 64, display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        { c: G1, n: "Sage Light", h: "#3DD68C" },
        { c: G2, n: "Sage",       h: "#1A8A5A" },
        { c: G3, n: "Sage Deep",  h: "#0A3D22" },
        { c: BG, n: "Background", h: "#030C07", border: true },
      ].map(({ c, n, h, border }) => (
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
