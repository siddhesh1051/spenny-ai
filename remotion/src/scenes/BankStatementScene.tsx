import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";
import { MicIcon, FileTextIcon, BarChart2Icon, CheckIcon, BanknoteIcon, PlusIcon } from "../Icons";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const SageClover: React.FC<{ size: number }> = ({ size }) => {
  const r = size * 0.28;
  const cx = size / 2;
  const cy = size / 2;
  const offset = size * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="leafBank" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafBank)" opacity={0.92} />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafBank)" opacity={0.92} />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafBank)" opacity={0.92} />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafBank)" opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// PDF/CSV file icon
const FileIcon: React.FC<{ type: "pdf" | "csv"; size?: number }> = ({ type, size = 48 }) => {
  const isPdf = type === "pdf";
  const color = isPdf ? "#f87171" : "#34d399";
  const bg = isPdf ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.12)";
  const border = isPdf ? "rgba(239,68,68,0.3)" : "rgba(52,211,153,0.3)";

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.18,
      background: bg, border: `1.5px solid ${border}`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 3,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isPdf
          ? <FileTextIcon size={size * 0.32} color={color} strokeWidth={1.8} />
          : <BarChart2Icon size={size * 0.32} color={color} strokeWidth={1.8} />}
      </div>
      <span style={{
        fontSize: size * 0.18, fontWeight: 800, color,
        letterSpacing: "0.06em", lineHeight: 1,
      }}>{isPdf ? "PDF" : "CSV"}</span>
    </div>
  );
};

// Bank statement document with scanning overlay — same sageScanSweep approach as ReceiptScanScene
const BankStatementDoc: React.FC<{
  frame: number;
  fps: number;
  scanStartFrame: number;
  scanEndFrame: number;
  fileType: "pdf" | "csv";
}> = ({ frame, fps, scanStartFrame, scanEndFrame, fileType }) => {
  const entryProgress = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const isScanning = frame >= scanStartFrame && frame < scanEndFrame;

  const scanCycle = ((frame - scanStartFrame) / fps) % 1.8;
  const scanTop = (() => {
    const t = scanCycle / 1.8;
    if (t < 0.1) return 8;
    if (t < 0.45) return interpolate(t, [0.1, 0.45], [8, 88]);
    if (t < 0.55) return 88;
    if (t < 0.9) return interpolate(t, [0.55, 0.9], [88, 8]);
    return 8;
  })();

  const scanOpacity = isScanning
    ? interpolate(scanCycle / 1.8, [0, 0.1, 0.45, 0.55, 0.9, 1], [0.7, 1, 1, 1, 1, 0.7])
    : 0;

  const cornerColor = isScanning ? "rgba(52,211,153,0.9)" : "rgba(74,222,128,0.3)";
  const cornerSize = 14;
  const cornerThick = 2.5;

  // Rows that progressively "highlight" as scan passes them
  const rows = [
    { date: "01 Mar", desc: "Zomato", debit: "₹340" },
    { date: "03 Mar", desc: "Amazon Pay", debit: "₹1,299" },
    { date: "04 Mar", desc: "HDFC CC Bill", debit: "₹12,400" },
    { date: "05 Mar", desc: "Ola Cabs", debit: "₹230" },
    { date: "06 Mar", desc: "Netflix", debit: "₹649" },
    { date: "07 Mar", desc: "Swiggy", debit: "₹480" },
    { date: "08 Mar", desc: "Blinkit", debit: "₹320" },
  ];

  return (
    <div style={{
      position: "relative",
      width: 300,
      transform: `scale(${entryProgress})`,
      opacity: entryProgress,
    }}>
      {/* Document card */}
      <div style={{
        background: "linear-gradient(160deg, #1a2a1e 0%, #0f1a12 100%)",
        border: `1.5px solid ${isScanning ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: isScanning
          ? "0 0 0 1px rgba(52,211,153,0.15), 0 16px 48px rgba(0,0,0,0.5)"
          : "0 16px 48px rgba(0,0,0,0.5)",
        position: "relative",
      }}>
        {/* Document header */}
        <div style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(255,255,255,0.02)",
        }}>
          <FileIcon type={fileType} size={36} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              HDFC_Statement_Mar26.{fileType}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              HDFC Bank · Savings Account ··4821
            </div>
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: "flex", padding: "6px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}>
          {["Date", "Description", "Amount"].map((h, i) => (
            <div key={i} style={{
              fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.1em", textTransform: "uppercase",
              flex: i === 1 ? 2 : 1,
              textAlign: i === 2 ? "right" : "left",
            }}>{h}</div>
          ))}
        </div>

        {/* Table rows */}
        <div style={{ padding: "4px 0" }}>
          {rows.map((row, i) => {
            const rowYPct = 10 + (i / (rows.length - 1)) * 78;
            const isHighlighted = isScanning && Math.abs(scanTop - rowYPct) < 12;
            const rowOpacity = isScanning
              ? interpolate(frame - scanStartFrame, [i * 4, i * 4 + 10], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
              : 0.55;

            return (
              <div key={i} style={{
                display: "flex", padding: "5px 14px",
                background: isHighlighted ? "rgba(52,211,153,0.08)" : "transparent",
                borderLeft: isHighlighted ? "2px solid rgba(52,211,153,0.6)" : "2px solid transparent",
                opacity: rowOpacity,
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flex: 1 }}>{row.date}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 500, flex: 2 }}>{row.desc}</div>
                <div style={{ fontSize: 10, color: "#f87171", fontWeight: 600, flex: 1, textAlign: "right" }}>{row.debit}</div>
              </div>
            );
          })}
        </div>

        {/* Balance footer */}
        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "rgba(255,255,255,0.02)",
        }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Closing Balance</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>₹1,24,602</span>
        </div>

        {/* Scanning sweep line */}
        {isScanning && (
          <div style={{
            position: "absolute",
            left: 12, right: 12,
            height: 2,
            top: `${scanTop}%`,
            background: "linear-gradient(90deg, transparent 0%, #34d399 30%, #6ee7b7 50%, #34d399 70%, transparent 100%)",
            boxShadow: "0 0 8px 2px rgba(52,211,153,0.55)",
            opacity: scanOpacity,
          }} />
        )}

        {/* Green tint during scan */}
        {isScanning && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(52,211,153,0.03)" }} />
        )}
      </div>

      {/* Corner brackets */}
      <div style={{ position: "absolute", top: 6, left: 6 }}>
        <div style={{ width: cornerSize, height: cornerThick, background: cornerColor, borderRadius: 1 }} />
        <div style={{ width: cornerThick, height: cornerSize, background: cornerColor, borderRadius: 1, marginTop: -cornerThick }} />
      </div>
      <div style={{ position: "absolute", top: 6, right: 6 }}>
        <div style={{ width: cornerSize, height: cornerThick, background: cornerColor, borderRadius: 1, marginLeft: "auto" }} />
        <div style={{ width: cornerThick, height: cornerSize, background: cornerColor, borderRadius: 1, marginTop: -cornerThick, marginLeft: "auto" }} />
      </div>
      <div style={{ position: "absolute", bottom: 6, left: 6 }}>
        <div style={{ width: cornerThick, height: cornerSize, background: cornerColor, borderRadius: 1 }} />
        <div style={{ width: cornerSize, height: cornerThick, background: cornerColor, borderRadius: 1, marginTop: -cornerThick }} />
      </div>
      <div style={{ position: "absolute", bottom: 6, right: 6 }}>
        <div style={{ width: cornerThick, height: cornerSize, background: cornerColor, borderRadius: 1, marginLeft: "auto" }} />
        <div style={{ width: cornerSize, height: cornerThick, background: cornerColor, borderRadius: 1, marginTop: -cornerThick, marginLeft: "auto" }} />
      </div>
    </div>
  );
};

// Thinking dots
const ThinkingDots: React.FC<{ frame: number; fps: number; label?: string }> = ({ frame, fps, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <SageClover size={22} />
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map((i) => {
        const bounce = Math.sin((frame / fps) * Math.PI * 2.5 + i * 1.1);
        return (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "rgba(74,222,128,0.7)",
            transform: `translateY(${bounce * 4}px)`,
            opacity: 0.6 + bounce * 0.4,
          }} />
        );
      })}
    </div>
    {label && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>{label}</span>}
  </div>
);

// Expense item card
const ExpenseItem: React.FC<{
  label: string; category: string; amount: string; icon: string;
  frame: number; fps: number; appearFrame: number; index: number;
}> = ({ label, category, amount, icon, frame, fps, appearFrame, index }) => {
  const delay = index * fps * 0.09;
  const itemFrame = Math.max(0, frame - appearFrame - delay);
  const prog = spring({ frame: itemFrame, fps, config: { damping: 15, stiffness: 180 } });
  if (frame < appearFrame + delay) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 11px",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, marginBottom: 5,
      transform: `scale(${prog}) translateY(${interpolate(prog, [0, 1], [8, 0])}px)`,
      opacity: prog,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "rgba(34,197,94,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{label}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>{category}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>-{amount}</div>
    </div>
  );
};

// Upload animation — file drops into chat
const UploadBubble: React.FC<{
  frame: number; fps: number; appearFrame: number; fileType: "pdf" | "csv";
}> = ({ frame, fps, appearFrame, fileType }) => {
  if (frame < appearFrame) return null;
  const prog = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 18, stiffness: 200 },
  });
  const isPdf = fileType === "pdf";
  const accentColor = isPdf ? "rgba(239,68,68,0.35)" : "rgba(52,211,153,0.35)";
  const accentBg = isPdf ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)";

  return (
    <div style={{
      display: "flex", justifyContent: "flex-end", marginBottom: 12,
      transform: `translateY(${interpolate(prog, [0, 1], [12, 0])}px)`,
      opacity: prog,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px 12px 4px 12px",
        padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: accentBg, border: `1px solid ${accentColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isPdf
            ? <FileTextIcon size={14} color={isPdf ? "#f87171" : "#34d399"} />
            : <BarChart2Icon size={14} color="#34d399" />}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
            HDFC_Statement_Mar26.{fileType}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
            {isPdf ? "PDF" : "CSV"} · 47 transactions
          </div>
        </div>
      </div>
    </div>
  );
};

export const BankStatementScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene: 7.5s = 225 frames
  const sceneOpacity = interpolate(frame, [0, fps * 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Timeline
  const DOC_APPEARS = fps * 0.3;
  const SCAN_START = fps * 0.9;
  const SCAN_END = fps * 3.4;
  const UPLOAD_BUBBLE = fps * 0.3;
  const THINKING_START = fps * 3.4;
  const THINKING_END = fps * 4.5;
  const RESPONSE_FRAME = fps * 4.5;

  const isScanning = frame >= SCAN_START && frame < SCAN_END;
  const showThinking = frame >= THINKING_START && frame < THINKING_END;

  // Toggle PDF/CSV — starts as PDF, label can be either
  const fileType: "pdf" | "csv" = "pdf";

  return (
    <div style={{
      width, height,
      background: "linear-gradient(135deg, #080f0a 0%, #0a100c 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily,
      opacity: sceneOpacity,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 65%)",
        top: -200, right: -200, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 65%)",
        bottom: -150, left: -150, pointerEvents: "none",
      }} />

      {/* Scene label */}
      <div style={{
        position: "absolute", top: 48, left: 0, right: 0, textAlign: "center",
        fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(74,222,128,0.6)",
        opacity: interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Drop a bank statement — Sage imports everything
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>

        {/* Bank statement document */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {frame >= DOC_APPEARS && (
            <BankStatementDoc
              frame={frame - DOC_APPEARS}
              fps={fps}
              scanStartFrame={SCAN_START - DOC_APPEARS}
              scanEndFrame={SCAN_END - DOC_APPEARS}
              fileType={fileType}
            />
          )}

          {/* PDF / CSV toggle pills */}
          <div style={{
            display: "flex", gap: 6, marginTop: 4,
            opacity: interpolate(frame, [DOC_APPEARS, DOC_APPEARS + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {(["pdf", "csv"] as const).map((t) => (
              <div key={t} style={{
                padding: "4px 12px", borderRadius: 99,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                background: t === fileType ? (t === "pdf" ? "rgba(239,68,68,0.15)" : "rgba(52,211,153,0.15)") : "rgba(255,255,255,0.04)",
                border: `1px solid ${t === fileType ? (t === "pdf" ? "rgba(239,68,68,0.4)" : "rgba(52,211,153,0.4)") : "rgba(255,255,255,0.08)"}`,
                color: t === fileType ? (t === "pdf" ? "#f87171" : "#34d399") : "rgba(255,255,255,0.3)",
              }}>{t.toUpperCase()}</div>
            ))}
          </div>

          {/* Scan status */}
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: isScanning ? "#34d399" : frame >= SCAN_END ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)",
            letterSpacing: "0.06em",
            opacity: interpolate(frame, [DOC_APPEARS, DOC_APPEARS + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {isScanning ? (
              <>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", display: "inline-block",
                  background: "#34d399",
                  boxShadow: "0 0 6px 2px rgba(52,211,153,0.5)",
                  opacity: 0.7 + 0.3 * Math.sin((frame / fps) * Math.PI * 4),
                }} />
                Parsing transactions…
              </>
            ) : frame >= SCAN_END ? "✓ 47 transactions found" : "Bank statement"}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{
          width: 320,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)",
        }}>
          {/* Top bar */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SageClover size={18} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Sage</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ padding: "16px 16px 12px" }}>
            {/* Upload bubble */}
            <UploadBubble frame={frame} fps={fps} appearFrame={UPLOAD_BUBBLE} fileType={fileType} />

            {/* Thinking */}
            {showThinking && <ThinkingDots frame={frame} fps={fps} label="Parsing transactions…" />}

            {/* Sage response */}
            {frame >= RESPONSE_FRAME && (() => {
              const prog = spring({
                frame: frame - RESPONSE_FRAME,
                fps,
                config: { damping: 20, stiffness: 150 },
              });
              return (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12,
                  opacity: prog,
                  transform: `translateY(${interpolate(prog, [0, 1], [10, 0])}px)`,
                }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}><SageClover size={22} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 10, lineHeight: 1.5,
                      opacity: interpolate(frame, [RESPONSE_FRAME, RESPONSE_FRAME + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                    }}>
                      Imported 47 transactions ✓
                    </div>

                    <ExpenseItem label="Zomato" category="Food & Dining" amount="₹340" icon="🍕" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={0} />
                    <ExpenseItem label="Netflix" category="Entertainment" amount="₹649" icon="🎬" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={1} />
                    <ExpenseItem label="Ola Cabs" category="Transport" amount="₹230" icon="🚗" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={2} />
                    <ExpenseItem label="HDFC CC Bill" category="Bills" amount="₹12,400" icon="💳" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={3} />

                    {/* Summary pill */}
                    <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.0)} layout="none">
                      <div style={{
                        marginTop: 8,
                        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10, padding: "8px 12px",
                        display: "flex", alignItems: "center", gap: 8,
                        opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.0), [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                      }}>
                        <BarChart2Icon size={14} color="#86efac" />
                        <span style={{ fontSize: 12, color: "#86efac", lineHeight: 1.5 }}>
                          ₹15,398 in expenses across 6 categories
                        </span>
                      </div>
                    </Sequence>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Input bar */}
          <div style={{
            padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><PlusIcon size={14} color="rgba(255,255,255,0.5)" /></div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, padding: "8px 14px",
              fontSize: 13, color: "rgba(255,255,255,0.25)",
            }}>
              Ask anything about your spending…
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><MicIcon size={14} color="#4ade80" /></div>
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.5)} layout="none">
        <div style={{
          position: "absolute", bottom: 48, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.5), [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 99, padding: "7px 18px",
            fontSize: 13, color: "#4ade80", fontWeight: 500,
          }}>
            <BanknoteIcon size={14} color="#4ade80" /> PDF or CSV — Sage reads any bank statement
          </div>
        </div>
      </Sequence>
    </div>
  );
};
