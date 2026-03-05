import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { useDesignConfig } from "../useDesignConfig";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";
import { MicIcon, ImageIcon, CheckIcon, PlusIcon } from "../Icons";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// 4-leaf clover — matches the product
const SageClover: React.FC<{ size: number }> = ({ size }) => {
  const r = size * 0.28;
  const cx = size / 2;
  const cy = size / 2;
  const offset = size * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="leafReceipt" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafReceipt)" opacity={0.92} />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafReceipt)" opacity={0.92} />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafReceipt)" opacity={0.92} />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafReceipt)" opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// Receipt image with scanning animation — mirrors product's ReceiptBubble + sageScanSweep
const ReceiptWithScan: React.FC<{
  frame: number;
  fps: number;
  scanStartFrame: number;
  scanEndFrame: number;
}> = ({ frame, fps, scanStartFrame, scanEndFrame }) => {
  const entryProgress = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const isScanning = frame >= scanStartFrame && frame < scanEndFrame;

  // Scan sweep: mirrors sageScanSweep keyframes (0%→8%, 45%→85%, 55%→85%, 90%→8%)
  const scanCycle = ((frame - scanStartFrame) / fps) % 1.8; // 1.8s period
  const scanTop = (() => {
    const t = scanCycle / 1.8; // 0..1
    if (t < 0.1) return interpolate(t, [0, 0.1], [8, 8]);
    if (t < 0.45) return interpolate(t, [0.1, 0.45], [8, 85]);
    if (t < 0.55) return 85;
    if (t < 0.9) return interpolate(t, [0.55, 0.9], [85, 8]);
    return 8;
  })();

  const scanOpacity = isScanning
    ? interpolate(scanCycle / 1.8, [0, 0.1, 0.45, 0.55, 0.9, 1], [0.7, 1, 1, 1, 1, 0.7])
    : 0;

  // Corner markers (scan brackets)
  const cornerSize = 14;
  const cornerThickness = 2.5;
  const cornerColor = isScanning ? "rgba(52,211,153,0.9)" : "rgba(74,222,128,0.35)";

  return (
    <div
      style={{
        position: "relative",
        width: 200,
        height: 260,
        transform: `scale(${entryProgress})`,
        opacity: entryProgress,
      }}
    >
      {/* Receipt paper background */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 14,
          background: "linear-gradient(160deg, #1a2a1e 0%, #0f1a12 100%)",
          border: `1.5px solid ${isScanning ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.12)"}`,
          overflow: "hidden",
          position: "relative",
          boxShadow: isScanning
            ? "0 0 0 1px rgba(52,211,153,0.2), 0 12px 40px rgba(0,0,0,0.5)"
            : "0 12px 40px rgba(0,0,0,0.5)",
          transition: "box-shadow 0.3s",
        }}
      >
        {/* Receipt content lines */}
        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Store header */}
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "0.08em",
            }}>SWIGGY INSTAMART</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Tax Invoice</div>
            <div style={{
              height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0",
              backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 10px)",
            }} />
          </div>

          {/* Line items */}
          {[
            { name: "Apples (1kg)", amt: "₹89" },
            { name: "Bread", amt: "₹45" },
            { name: "Milk 500ml", amt: "₹28" },
            { name: "Eggs × 12", amt: "₹96" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              opacity: isScanning ? interpolate(frame - scanStartFrame, [i * 8, i * 8 + 15], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0.5,
            }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{item.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{item.amt}</span>
            </div>
          ))}

          <div style={{
            height: 1, margin: "4px 0",
            backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 10px)",
          }} />

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Total</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>₹258</span>
          </div>

          {/* Barcode lines at bottom */}
          <div style={{ display: "flex", gap: 2, marginTop: 8, justifyContent: "center", alignItems: "flex-end", height: 28 }}>
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} style={{
                width: i % 3 === 0 ? 3 : 2,
                height: i % 5 === 0 ? 28 : i % 3 === 0 ? 22 : 16,
                background: "rgba(255,255,255,0.35)",
                borderRadius: 1,
              }} />
            ))}
          </div>
        </div>

        {/* Scanning sweep line — exact replica of sageScanSweep from product */}
        {isScanning && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              height: 2,
              top: `${scanTop}%`,
              background: "linear-gradient(90deg, transparent 0%, #34d399 30%, #6ee7b7 50%, #34d399 70%, transparent 100%)",
              boxShadow: "0 0 8px 2px rgba(52,211,153,0.55)",
              opacity: scanOpacity,
            }}
          />
        )}

        {/* Scanning green tint overlay */}
        {isScanning && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(52,211,153,0.04)",
            animation: "none",
          }} />
        )}
      </div>

      {/* Scan corner brackets */}
      {/* Top-left */}
      <div style={{ position: "absolute", top: 6, left: 6 }}>
        <div style={{ width: cornerSize, height: cornerThickness, background: cornerColor, borderRadius: 1 }} />
        <div style={{ width: cornerThickness, height: cornerSize, background: cornerColor, borderRadius: 1, marginTop: -cornerThickness }} />
      </div>
      {/* Top-right */}
      <div style={{ position: "absolute", top: 6, right: 6 }}>
        <div style={{ width: cornerSize, height: cornerThickness, background: cornerColor, borderRadius: 1, marginLeft: "auto" }} />
        <div style={{ width: cornerThickness, height: cornerSize, background: cornerColor, borderRadius: 1, marginTop: -cornerThickness, marginLeft: "auto" }} />
      </div>
      {/* Bottom-left */}
      <div style={{ position: "absolute", bottom: 6, left: 6 }}>
        <div style={{ width: cornerThickness, height: cornerSize, background: cornerColor, borderRadius: 1 }} />
        <div style={{ width: cornerSize, height: cornerThickness, background: cornerColor, borderRadius: 1, marginTop: -cornerThickness }} />
      </div>
      {/* Bottom-right */}
      <div style={{ position: "absolute", bottom: 6, right: 6 }}>
        <div style={{ width: cornerThickness, height: cornerSize, background: cornerColor, borderRadius: 1, marginLeft: "auto" }} />
        <div style={{ width: cornerSize, height: cornerThickness, background: cornerColor, borderRadius: 1, marginTop: -cornerThickness, marginLeft: "auto" }} />
      </div>
    </div>
  );
};

// Thinking dots — matches product's ThinkingIndicator
const ThinkingDots: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <SageClover size={22} />
    <div style={{ display: "flex", gap: 5, alignItems: "center", paddingLeft: 2 }}>
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
    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>Extracting expenses…</span>
  </div>
);

// Expense item — matches product collection item
const ExpenseItem: React.FC<{
  label: string;
  category: string;
  amount: string;
  icon: string;
  frame: number;
  fps: number;
  appearFrame: number;
  index: number;
}> = ({ label, category, amount, icon, frame, fps, appearFrame, index }) => {
  const delay = index * fps * 0.1;
  const itemFrame = Math.max(0, frame - appearFrame - delay);
  const entryProgress = spring({ frame: itemFrame, fps, config: { damping: 15, stiffness: 180 } });
  if (frame < appearFrame + delay) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 12px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      marginBottom: 6,
      transform: `scale(${entryProgress}) translateY(${interpolate(entryProgress, [0, 1], [8, 0])}px)`,
      opacity: entryProgress,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(34,197,94,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{label}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{category}</div>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>{amount}</div>
    </div>
  );
};

export const ReceiptScanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useDesignConfig();

  // Scene: 7.0s = 210 frames
  const sceneOpacity = interpolate(frame, [0, fps * 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Timeline
  const RECEIPT_APPEARS = fps * 0.3;
  const SCAN_START = fps * 0.9;
  const SCAN_END = fps * 3.2;
  const THINKING_START = fps * 3.2;
  const THINKING_END = fps * 4.2;
  const RESPONSE_FRAME = fps * 4.2;

  const showThinking = frame >= THINKING_START && frame < THINKING_END;

  return (
    <div
      style={{
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
      }}
    >
      {/* Ambient */}
      <div style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 65%)",
        top: -150, left: -150, pointerEvents: "none",
      }} />

      {/* Scene label */}
      <div style={{
        position: "absolute", top: 48, left: 0, right: 0, textAlign: "center",
        fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(74,222,128,0.6)",
        opacity: interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Snap a receipt — Sage does the rest
      </div>

      {/* Main layout: receipt left, chat right */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 36, position: "relative" }}>

        {/* Receipt with scan animation */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {frame >= RECEIPT_APPEARS && (
            <ReceiptWithScan
              frame={frame - RECEIPT_APPEARS}
              fps={fps}
              scanStartFrame={SCAN_START - RECEIPT_APPEARS}
              scanEndFrame={SCAN_END - RECEIPT_APPEARS}
            />
          )}

          {/* Status label below receipt */}
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: frame >= SCAN_START && frame < SCAN_END ? "#34d399" : "rgba(255,255,255,0.3)",
            letterSpacing: "0.06em",
            opacity: interpolate(frame, [RECEIPT_APPEARS, RECEIPT_APPEARS + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {frame >= SCAN_START && frame < SCAN_END ? (
              <>
                <span style={{
                  display: "inline-block",
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#34d399",
                  boxShadow: "0 0 6px 2px rgba(52,211,153,0.5)",
                  opacity: 0.7 + 0.3 * Math.sin((frame / fps) * Math.PI * 4),
                }} />
                Scanning…
              </>
            ) : frame >= SCAN_END ? "✓ Scanned" : "Upload receipt"}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{
          width: 340,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)",
        }}>
          {/* Top bar */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
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
            {/* Receipt bubble — user message */}
            {frame >= RECEIPT_APPEARS && (() => {
              const bubbleProgress = spring({
                frame: frame - RECEIPT_APPEARS,
                fps,
                config: { damping: 18, stiffness: 200 },
              });
              return (
                <div style={{
                  display: "flex", justifyContent: "flex-end", marginBottom: 12,
                  transform: `translateY(${interpolate(bubbleProgress, [0, 1], [12, 0])}px)`,
                  opacity: bubbleProgress,
                }}>
                  <div style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px 12px 4px 12px",
                    padding: "8px 12px",
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 13, color: "rgba(255,255,255,0.8)",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "rgba(59,130,246,0.2)",
                      border: "1px solid rgba(59,130,246,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><ImageIcon size={14} color="rgba(96,165,250,0.9)" /></div>
                    <span>swiggy_receipt.png</span>
                  </div>
                </div>
              );
            })()}

            {/* Thinking */}
            {showThinking && <ThinkingDots frame={frame} fps={fps} />}

            {/* Sage response */}
            {frame >= RESPONSE_FRAME && (() => {
              const entryProgress = spring({
                frame: frame - RESPONSE_FRAME,
                fps,
                config: { damping: 20, stiffness: 150 },
              });
              return (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12,
                  opacity: entryProgress,
                  transform: `translateY(${interpolate(entryProgress, [0, 1], [10, 0])}px)`,
                }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    <SageClover size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 10, lineHeight: 1.5,
                      opacity: interpolate(frame, [RESPONSE_FRAME, RESPONSE_FRAME + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                    }}>
                      Found 4 expenses ✓
                    </div>

                    <ExpenseItem label="Apples" category="Groceries" amount="₹89" icon="🍎" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={0} />
                    <ExpenseItem label="Bread" category="Groceries" amount="₹45" icon="🍞" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={1} />
                    <ExpenseItem label="Milk" category="Groceries" amount="₹28" icon="🥛" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={2} />
                    <ExpenseItem label="Eggs" category="Groceries" amount="₹96" icon="🥚" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.2} index={3} />

                    <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.0)} layout="none">
                      <div style={{
                        marginTop: 8,
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10, padding: "8px 12px",
                        display: "flex", alignItems: "center", gap: 8,
                        opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.0), [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                      }}>
                        <CheckIcon size={13} color="#86efac" strokeWidth={2.5} />
                        <span style={{ fontSize: 12, color: "#86efac", lineHeight: 1.5 }}>
                          Total ₹258 logged to Groceries
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
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><PlusIcon size={14} color="rgba(255,255,255,0.5)" /></div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, padding: "8px 14px",
              fontSize: 13, color: "rgba(255,255,255,0.25)",
            }}>
              Ask anything about your spending…
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(34,197,94,0.2)",
              border: "1px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><MicIcon size={14} color="#4ade80" /></div>
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.5)} layout="none">
        <div style={{
          position: "absolute", bottom: 52, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.5), [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 99, padding: "7px 18px",
            fontSize: 13, color: "#4ade80", fontWeight: 500,
          }}>
            <ImageIcon size={14} color="#4ade80" /> Just snap a photo — Sage extracts & logs everything
          </div>
        </div>
      </Sequence>
    </div>
  );
};
