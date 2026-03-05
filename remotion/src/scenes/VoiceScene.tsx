import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";
import { MicIcon, XIcon, CheckIcon } from "../Icons";

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
        <radialGradient id="leafVoice" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafVoice)" opacity={0.92} />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafVoice)" opacity={0.92} />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafVoice)" opacity={0.92} />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafVoice)" opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// Live waveform bars — mirrors the product's recording UI
// Product shows ~40 bars with heights driven by microphone frequency data
const LiveWaveform: React.FC<{
  frame: number;
  fps: number;
  barCount?: number;
  active: boolean;
}> = ({ frame, fps, barCount = 40, active }) => {
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (!active) {
      // Flat/idle
      return 0.08 + Math.sin(i * 0.5) * 0.04;
    }
    // Animated: multiple sin waves at different frequencies to mimic real voice
    const t = frame / fps;
    const v =
      0.15 +
      Math.abs(Math.sin(t * 8 + i * 0.4)) * 0.4 +
      Math.abs(Math.sin(t * 13 + i * 0.7)) * 0.25 +
      Math.abs(Math.sin(t * 5 + i * 0.2)) * 0.15;
    return Math.min(1, v * (0.6 + 0.4 * Math.sin(i * 0.3 + t * 3)));
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32, flex: 1 }}>
      {bars.map((v, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.max(3, v * 100)}%`,
            background: active ? "rgba(239,68,68,0.75)" : "rgba(255,255,255,0.15)",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

// Static waveform shown in voice message bubble after sending
// Mirrors VoiceMessageBubble from the product
const StaticWaveform: React.FC<{ barCount?: number }> = ({ barCount = 50 }) => {
  const heights = Array.from({ length: barCount }, (_, i) => {
    return 0.15 + Math.abs(Math.sin(i * 0.6) * 0.4 + Math.sin(i * 0.2) * 0.3);
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 28, flex: 1 }}>
      {heights.map((v, i) => (
        <div key={i} style={{
          width: 2.5,
          height: `${Math.max(10, v * 100)}%`,
          background: "rgba(255,255,255,0.5)",
          borderRadius: 2,
          opacity: 0.7 + v * 0.3,
        }} />
      ))}
    </div>
  );
};

// Recording UI — mirrors the product's isRecording state input bar
const RecordingBar: React.FC<{ frame: number; fps: number; active: boolean; duration: string }> = ({
  frame, fps, active, duration,
}) => {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px",
      background: "rgba(255,255,255,0.02)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Cancel button (X) */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.5)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}><XIcon size={14} color="rgba(255,255,255,0.5)" /></div>

      {/* Live waveform pill */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10,
        padding: "6px 14px",
        borderRadius: 99,
        border: "1px solid rgba(239,68,68,0.45)",
        background: "rgba(239,68,68,0.08)",
        overflow: "hidden",
      }}>
        {/* Pulse dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: "#ef4444",
          flexShrink: 0,
          boxShadow: `0 0 ${4 + Math.sin(frame * 0.3) * 3}px ${2 + Math.sin(frame * 0.3)}px rgba(239,68,68,0.5)`,
        }} />
        {/* Duration */}
        <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {duration}
        </span>
        {/* Live waveform bars */}
        <LiveWaveform frame={frame} fps={fps} active={active} />
      </div>

      {/* Stop button */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "#ef4444",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 4px 16px rgba(239,68,68,0.4)",
      }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: "#fff" }} />
      </div>
    </div>
  );
};

// Voice message bubble — mirrors VoiceMessageBubble from the product
const VoiceMessageBubble: React.FC<{
  frame: number;
  fps: number;
  appearFrame: number;
  transcript: string;
  showTranscript: boolean;
}> = ({ frame, fps, appearFrame, transcript, showTranscript }) => {
  if (frame < appearFrame) return null;
  const progress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 16, stiffness: 200 },
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 12,
      transform: `scale(${progress}) translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
      opacity: progress,
    }}>
      {/* Waveform bubble */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.09)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "18px 18px 4px 18px",
        padding: "10px 14px",
        minWidth: 180,
      }}>
        {/* Play button */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: "rgba(255,255,255,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><MicIcon size={11} color="rgba(255,255,255,0.7)" /></div>
        <StaticWaveform />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>0:04</span>
      </div>

      {/* Transcript line */}
      {showTranscript && (
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic",
          maxWidth: 240, textAlign: "right", padding: "3px 4px 0",
          opacity: interpolate(frame - (appearFrame + fps * 0.3), [0, fps * 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          "{transcript}"
        </p>
      )}
    </div>
  );
};

// Thinking dots
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
  </div>
);

// Expense item
const ExpenseItem: React.FC<{
  label: string; category: string; amount: string; icon: string;
  frame: number; fps: number; appearFrame: number; index: number;
}> = ({ label, category, amount, icon, frame, fps, appearFrame, index }) => {
  const delay = index * fps * 0.12;
  const itemFrame = Math.max(0, frame - appearFrame - delay);
  const prog = spring({ frame: itemFrame, fps, config: { damping: 15, stiffness: 180 } });
  if (frame < appearFrame + delay) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 12px",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, marginBottom: 6,
      transform: `scale(${prog}) translateY(${interpolate(prog, [0, 1], [8, 0])}px)`,
      opacity: prog,
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

export const VoiceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene: 7.0s = 210 frames
  const sceneOpacity = interpolate(frame, [0, fps * 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Timeline
  const RECORDING_START = fps * 0.3;
  const RECORDING_END = fps * 2.5;    // stop recording
  const BUBBLE_APPEARS = fps * 2.7;
  const TRANSCRIPT_SHOWN = fps * 3.0;
  const THINKING_START = fps * 2.9;
  const THINKING_END = fps * 4.0;
  const RESPONSE_FRAME = fps * 4.0;

  const isRecording = frame >= RECORDING_START && frame < RECORDING_END;
  const showThinking = frame >= THINKING_START && frame < THINKING_END;

  // Recording duration string (counts up while recording)
  const recSeconds = Math.max(0, Math.floor((frame - RECORDING_START) / fps));
  const recDuration = isRecording ? `0:0${Math.min(recSeconds, 9)}` : "0:04";

  // Mic button pulse while not recording
  const micPulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2);

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
      {/* Ambient */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 65%)",
        bottom: -250, right: -200, pointerEvents: "none",
      }} />

      {/* Mic ring pulse when recording */}
      {isRecording && (
        <>
          <div style={{
            position: "absolute", width: 280, height: 280, borderRadius: "50%",
            border: `1px solid rgba(239,68,68,${0.1 + micPulse * 0.15})`,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", width: 360, height: 360, borderRadius: "50%",
            border: `1px solid rgba(239,68,68,${0.05 + micPulse * 0.08})`,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }} />
        </>
      )}

      {/* Scene label */}
      <div style={{
        position: "absolute", top: 48, left: 0, right: 0, textAlign: "center",
        fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(74,222,128,0.6)",
        opacity: interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        Just speak — Sage listens
      </div>

      {/* Chat window */}
      <div style={{
        width: 460,
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
        <div style={{ padding: "16px 16px 12px", minHeight: 160 }}>
          {/* Voice message bubble */}
          <VoiceMessageBubble
            frame={frame}
            fps={fps}
            appearFrame={BUBBLE_APPEARS}
            transcript="Spent 450 on dinner and 120 for Ola cab"
            showTranscript={frame >= TRANSCRIPT_SHOWN}
          />

          {/* Thinking */}
          {showThinking && <ThinkingDots frame={frame} fps={fps} />}

          {/* Response */}
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
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  <SageClover size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 10, lineHeight: 1.5,
                    opacity: interpolate(frame, [RESPONSE_FRAME, RESPONSE_FRAME + fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                  }}>
                    Got it! Logged 2 expenses ✓
                  </div>
                  <ExpenseItem label="Dinner" category="Food & Dining" amount="₹450" icon="🍽️" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.3} index={0} />
                  <ExpenseItem label="Ola Cab" category="Transport" amount="₹120" icon="🚗" frame={frame} fps={fps} appearFrame={RESPONSE_FRAME + fps * 0.3} index={1} />

                  <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.0)} layout="none">
                    <div style={{
                      marginTop: 6, fontSize: 11,
                      color: "rgba(255,255,255,0.25)", textAlign: "right",
                      opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.0), [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
                    }}>
                      Tap any item to edit or undo
                    </div>
                  </Sequence>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Input bar — switches between recording mode and normal */}
        {isRecording ? (
          <RecordingBar frame={frame} fps={fps} active={isRecording} duration={recDuration} />
        ) : frame < BUBBLE_APPEARS ? (
          /* Normal bar with highlighted mic button before recording */
          <div style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, padding: "8px 14px",
              fontSize: 13, color: "rgba(255,255,255,0.25)",
            }}>
              Ask anything…
            </div>
            {/* Mic button — glowing, inviting tap */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: `rgba(34,197,94,${0.18 + micPulse * 0.12})`,
              border: `1.5px solid rgba(34,197,94,${0.4 + micPulse * 0.2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 ${12 + micPulse * 10}px rgba(34,197,94,${0.3 + micPulse * 0.2})`,
            }}>
              <MicIcon size={15} color="#4ade80" />
            </div>
          </div>
        ) : (
          /* Normal bar after recording */
          <div style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}>
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
        )}
      </div>

      {/* Bottom badge */}
      <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.3)} layout="none">
        <div style={{
          position: "absolute", bottom: 52, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          opacity: interpolate(frame - (RESPONSE_FRAME + fps * 1.3), [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 99, padding: "7px 18px",
            fontSize: 13, color: "#4ade80", fontWeight: 500,
          }}>
            <MicIcon size={14} color="#4ade80" /> Speak naturally — Sage understands everything
          </div>
        </div>
      </Sequence>
    </div>
  );
};
