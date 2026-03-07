import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

const G1 = "#3dd68c";
const G2 = "#1a8a5a";
const BG = "#030c07";

// Option A: Leaf-S — organic leaf shape with a subtle "S" curve stroke inside
const LeafS: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="ls-g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    {/* Leaf body */}
    <path d="M32 6 C52 6 58 22 58 32 C58 50 44 60 32 60 C20 60 6 50 6 32 C6 22 12 6 32 6Z"
      fill="url(#ls-g)" opacity="0.15" />
    <path d="M32 6 C52 6 58 22 58 32 C58 50 44 60 32 60 C20 60 6 50 6 32 C6 22 12 6 32 6Z"
      fill="none" stroke="url(#ls-g)" strokeWidth="2.5" />
    {/* Subtle center vein */}
    <path d="M32 12 C32 12 32 52 32 56" stroke={G1} strokeWidth="1.2" strokeOpacity="0.3" />
    {/* S-curve accent */}
    <path d="M22 26 C22 20 42 20 42 27 C42 34 22 34 22 41 C22 48 42 48 42 42"
      stroke={G1} strokeWidth="2.8" strokeLinecap="round" fill="none" opacity="0.9" />
  </svg>
);

// Option B: Coin-chat with three dots center
const CoinChat: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="cc-g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    {/* Coin body fill */}
    <circle cx="32" cy="28" r="22" fill="url(#cc-g)" opacity="0.13" />
    {/* Coin outer ring */}
    <circle cx="32" cy="28" r="22" fill="none" stroke="url(#cc-g)" strokeWidth="2.5" />
    {/* Inner ring subtle */}
    <circle cx="32" cy="28" r="15" fill="none" stroke={G1} strokeWidth="1" strokeOpacity="0.22" />
    {/* Tail */}
    <path d="M22 50 C18 57 12 61 8 63 C17 60 27 55 33 48"
      fill="url(#cc-g)" />
    {/* Three dots */}
    <circle cx="25" cy="28" r="2.6" fill="url(#cc-g)" />
    <circle cx="32" cy="28" r="2.6" fill="url(#cc-g)" />
    <circle cx="39" cy="28" r="2.6" fill="url(#cc-g)" />
  </svg>
);

// Option C: Spark-S — a minimal spark/asterisk in a soft circle, like a "moment of insight"
const SparkS: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <radialGradient id="ss-rg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={G1} stopOpacity="0.18" />
        <stop offset="100%" stopColor={G2} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ss-g" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#ss-rg)" />
    <circle cx="32" cy="32" r="28" fill="none" stroke="url(#ss-g)" strokeWidth="1.5" strokeOpacity="0.4" />
    {/* 4 rays like a spark */}
    {[[32,10,32,26],[32,38,32,54],[10,32,26,32],[38,32,54,32]].map(([x1,y1,x2,y2],i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#ss-g)" strokeWidth="3" strokeLinecap="round" />
    ))}
    {/* 4 diagonal short rays */}
    {[[17,17,25,25],[39,39,47,47],[47,17,39,25],[17,47,25,39]].map(([x1,y1,x2,y2],i) => (
      <line key={i+4} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#ss-g)" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
    ))}
    <circle cx="32" cy="32" r="5" fill="url(#ss-g)" />
  </svg>
);

// Option D: Double-leaf / two-leaf (like a sprout) — feels growth + savings
const Sprout: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="sp-g" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    {/* Left leaf */}
    <path d="M32 42 C32 42 10 36 10 18 C18 18 32 28 32 42Z" fill="url(#sp-g)" opacity="0.85" />
    {/* Right leaf */}
    <path d="M32 42 C32 42 54 36 54 18 C46 18 32 28 32 42Z" fill="url(#sp-g)" opacity="0.65" />
    {/* Stem */}
    <path d="M32 42 L32 58" stroke={G1} strokeWidth="2.5" strokeLinecap="round" />
    {/* Ground line */}
    <path d="M22 58 L42 58" stroke={G2} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
  </svg>
);

// Option E: Minimal "S" in a soft circle — clean, legible, versatile
const CircleS: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="cs-g" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#cs-g)" opacity="0.1" />
    <circle cx="32" cy="32" r="28" fill="none" stroke="url(#cs-g)" strokeWidth="2" strokeOpacity="0.5" />
    {/* S letterform as path */}
    <path d="M40 22 C40 17 24 15 22 22 C20 29 42 29 42 38 C42 47 24 47 22 42"
      stroke="url(#cs-g)" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
);

// Option F: Chat-leaf — speech bubble with a leaf inside
const ChatLeaf: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <linearGradient id="cl-g" x1="6" y1="4" x2="58" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor={G1} />
        <stop offset="1" stopColor={G2} />
      </linearGradient>
    </defs>
    {/* Chat bubble */}
    <path d="M8 8 L56 8 L56 44 L20 44 L10 56 L14 44 L8 44 Z"
      fill="url(#cl-g)" opacity="0.13" stroke="url(#cl-g)" strokeWidth="2.2" strokeLinejoin="round" />
    {/* Leaf inside */}
    <path d="M32 16 C46 16 46 36 32 36 C18 36 18 16 32 16Z" fill="url(#cl-g)" opacity="0.7" />
    <path d="M32 16 L32 36" stroke="#030c07" strokeWidth="1.2" strokeOpacity="0.4" />
  </svg>
);

export const SubtleIconCompare: React.FC = () => {
  const options = [
    { Icon: LeafS,    label: "A · Leaf-S",     desc: "organic + letterform" },
    { Icon: CoinChat, label: "B · Coin-Chat",   desc: "no symbol, clean gradient" },
    { Icon: SparkS,   label: "C · Spark",       desc: "insight moment" },
    { Icon: Sprout,   label: "D · Sprout",      desc: "growth + savings" },
    { Icon: CircleS,  label: "E · Circle-S",    desc: "minimal, universal" },
    { Icon: ChatLeaf, label: "F · Chat-Leaf",   desc: "conversation + nature" },
  ];

  return (
    <div style={{
      width: 1200, height: 420, background: "#06100a",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily, gap: 40,
    }}>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>
        Subtle icon concepts — Spenny AI
      </p>
      <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
        {options.map(({ Icon, label, desc }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {/* 72px size as it would appear in navbar/favicon */}
            <Icon size={72} />
            {/* Also show at navbar scale */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              <Icon size={24} />
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700 }}>Spenny</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700 }}>{label}</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
