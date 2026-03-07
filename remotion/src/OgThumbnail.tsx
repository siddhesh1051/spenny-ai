import { staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// ── Design constants (1200×630 OG size) ────────────────────────────────────
const W = 1200;
const H = 630;

// ── Dots logo (matches Navbar/favicon) ──────────────────────────────────────
const DotsLogo: React.FC<{ size: number }> = ({ size }) => {
  const BG = "#030c07";
  const G1 = "#3dd68c";
  const G2 = "#1a8a5a";
  const G3 = "#0a3d22";
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="115" fill={BG} />
      <radialGradient id="og-dl-glow" cx="50%" cy="38%" r="56%">
        <stop offset="0%" stopColor={G2} stopOpacity="0.35" />
        <stop offset="100%" stopColor={BG} stopOpacity="0" />
      </radialGradient>
      <rect width="512" height="512" rx="115" fill="url(#og-dl-glow)" />
      <circle cx="262" cy="216" r="155" fill="url(#og-dl-cf)" />
      <circle cx="262" cy="216" r="123" fill="none" stroke={BG} strokeWidth="5" opacity="0.15" />
      <path d="M178 352 C156 384 124 420 100 458 C146 440 200 412 228 388 C218 376 196 364 178 352Z" fill="url(#og-dl-cf)" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={196 + i * 66} cy="218" r="24" fill={BG} opacity="0.86" />
      ))}
      <defs>
        <linearGradient id="og-dl-cf" x1="107" y1="62" x2="417" y2="460" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ── Feature pills ─────────────────────────────────────────────────────────
const pills = ["Chat", "Voice", "Receipt", "WhatsApp", "Gmail sync"];

export const OgThumbnail: React.FC = () => {
  return (
    <div
      style={{
        width: W,
        height: H,
        fontFamily,
        position: "relative",
        overflow: "hidden",
        background: "#030c07",
      }}
    >
      {/* ── Background radial glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 80% at 30% 50%, rgba(3,43,34,0.95) 0%, rgba(3,12,7,0.98) 60%, #030c07 100%)",
        }}
      />

      {/* ── Subtle dot grid ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(26,138,90,0.18) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />

      {/* ── Left green accent glow orb ── */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -120,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(26,138,90,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Right glow behind screenshot ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: -60,
          transform: "translateY(-50%)",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(26,138,90,0.12) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* ── Top border line ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(61,214,140,0.6) 40%, rgba(61,214,140,0.3) 70%, transparent 100%)",
        }}
      />

      {/* ══════════════════════════════════════════
          LEFT COLUMN  (0 → 560px)
      ══════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 560,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 56px",
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <DotsLogo size={38} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "white",
              letterSpacing: "-0.3px",
            }}
          >
            Spenny{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #3dd68c, #1a8a5a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AI
            </span>
          </span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(3,43,34,0.7)",
            border: "1px solid rgba(26,138,90,0.35)",
            borderRadius: 100,
            padding: "5px 14px",
            marginBottom: 22,
            alignSelf: "flex-start",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#3dd68c",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#3dd68c",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Agentic Expense Tracker
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.07,
            letterSpacing: "-1.5px",
            marginBottom: 20,
          }}
        >
          <span style={{ color: "white" }}>Track expenses</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #3dd68c 0%, #1a8a5a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            the way you speak
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.55,
            margin: "0 0 22px 0",
            maxWidth: 420,
          }}
        >
          Meet Sage — log expenses from chat, voice, receipts & bank emails. Ask{" "}
          <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
            &ldquo;where did my money go?&rdquo;
          </span>
          {" "}and get instant insights.{" "}
          <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
            No forms. Ever.
          </span>
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 }}>
          {pills.map((label) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#3dd68c",
                background: "rgba(26,138,90,0.12)",
                border: "1px solid rgba(26,138,90,0.28)",
                borderRadius: 100,
                padding: "4px 11px",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT COLUMN — UI screenshot
      ══════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: 36,
          transform: "translateY(-50%)",
          width: 560,
          height: 500,
        }}
      >
        {/* Glass card frame */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid rgba(26,138,90,0.25)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(26,138,90,0.08)",
            position: "relative",
          }}
        >
          {/* Window chrome bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              background: "rgba(8,15,11,0.97)",
              borderBottom: "1px solid rgba(26,138,90,0.12)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 100,
                  padding: "2px 12px",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                app.spenny.ai/sage
              </div>
            </div>
          </div>

          {/* Screenshot fill */}
          <div style={{ position: "relative", flex: 1, overflow: "hidden", height: "calc(100% - 34px)" }}>
            <Img
              src={staticFile("screenshot-sage.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                display: "block",
              }}
            />
            {/* Bottom gradient fade to blend into bg */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 120,
                background: "linear-gradient(to top, #030c07, transparent)",
              }}
            />
          </div>
        </div>

        {/* ── Floating spend badge (top-left of frame) ── */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: -52,
            background: "rgba(10,20,14,0.97)",
            border: "1px solid rgba(26,138,90,0.3)",
            borderRadius: 14,
            padding: "11px 16px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            minWidth: 130,
          }}
        >
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginBottom: 3 }}>TOTAL THIS MONTH</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: "-0.5px", marginBottom: 2 }}>₹24,800</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#3dd68c", fontWeight: 700 }}>↓ 12%</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>vs last month</span>
          </div>
        </div>

        {/* ── Floating Insights card (bottom-right of frame) ── */}
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: -44,
            background: "rgba(10,20,14,0.97)",
            border: "1px solid rgba(26,138,90,0.28)",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.65)",
            width: 188,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.04em" }}>
              EXPENSE INSIGHTS
            </span>
            <span style={{ fontSize: 9, color: "#3dd68c", fontWeight: 600 }}>Mar 2025</span>
          </div>

          {/* Mini bar chart — 7 day bars */}
          {(() => {
            const bars = [38, 62, 45, 80, 55, 70, 48];
            const days = ["M", "T", "W", "T", "F", "S", "S"];
            const maxBar = Math.max(...bars);
            return (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 42, marginBottom: 12 }}>
                {bars.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div
                      style={{
                        width: "100%",
                        height: Math.round((h / maxBar) * 34),
                        borderRadius: 3,
                        background: i === 3
                          ? "linear-gradient(180deg, #3dd68c, #1a8a5a)"
                          : "rgba(26,138,90,0.28)",
                      }}
                    />
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.28)" }}>{days[i]}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Category rows */}
          {[
            { emoji: "🍽️", label: "Food", pct: 42, color: "#3dd68c" },
            { emoji: "🚗", label: "Travel", pct: 28, color: "#60a5fa" },
            { emoji: "🛍️", label: "Shopping", pct: 18, color: "#a78bfa" },
          ].map(({ emoji, label, pct, color }) => (
            <div key={label} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10 }}>{emoji}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{label}</span>
                </div>
                <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 100, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 100, background: color, opacity: 0.75 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom URL watermark ── */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 56,
          fontSize: 13,
          color: "rgba(255,255,255,0.2)",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        spenny.ai
      </div>
    </div>
  );
};
