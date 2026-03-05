import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";
import { StarIcon } from "../Icons";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// 4-leaf clover matching the app
const SageClover: React.FC<{ size: number }> = ({ size }) => {
  const r = size * 0.28;
  const cx = size / 2;
  const cy = size / 2;
  const offset = size * 0.18;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="leafChat" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy - offset} r={r} fill="url(#leafChat)" opacity={0.92} />
      <circle cx={cx + offset} cy={cy} r={r} fill="url(#leafChat)" opacity={0.92} />
      <circle cx={cx} cy={cy + offset} r={r} fill="url(#leafChat)" opacity={0.92} />
      <circle cx={cx - offset} cy={cy} r={r} fill="url(#leafChat)" opacity={0.92} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#15803d" />
    </svg>
  );
};

// Typewriter text that types out character by character
const Typewriter: React.FC<{
  text: string;
  frame: number;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}> = ({ text, frame, startFrame, charsPerFrame = 0.7, style }) => {
  const localFrame = Math.max(0, frame - startFrame);
  const charCount = Math.floor(localFrame * charsPerFrame);
  const visible = text.slice(0, Math.min(charCount, text.length));
  const showCursor = charCount < text.length;

  return (
    <span style={style}>
      {visible}
      {showCursor && (
        <span
          style={{
            borderRight: "2px solid currentColor",
            marginLeft: 1,
            opacity: Math.round(localFrame / 8) % 2 === 0 ? 1 : 0,
          }}
        />
      )}
    </span>
  );
};

// User chat bubble
const UserBubble: React.FC<{
  text: string;
  frame: number;
  appearFrame: number;
  fps: number;
}> = ({ text, frame, appearFrame, fps }) => {
  if (frame < appearFrame) return null;

  const entryProgress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 18, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 12,
        transform: `translateY(${interpolate(entryProgress, [0, 1], [12, 0])}px)`,
        opacity: entryProgress,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "18px 18px 4px 18px",
          padding: "10px 16px",
          fontSize: 15,
          color: "rgba(255,255,255,0.9)",
          maxWidth: "75%",
          lineHeight: 1.5,
        }}
      >
        <Typewriter
          text={text}
          frame={frame}
          startFrame={appearFrame + 2}
          charsPerFrame={1.2}
        />
      </div>
    </div>
  );
};

// Thinking dots indicator
const ThinkingDots: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <SageClover size={22} />
      <div style={{ display: "flex", gap: 5, alignItems: "center", paddingLeft: 2 }}>
        {[0, 1, 2].map((i) => {
          const bounce = Math.sin((frame / fps) * Math.PI * 2.5 + i * 1.1);
          return (
            <div
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.7)",
                transform: `translateY(${bounce * 4}px)`,
                opacity: 0.6 + bounce * 0.4,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// Collection item — logged expense card
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
  const delay = index * fps * 0.12;
  const itemFrame = Math.max(0, frame - appearFrame - delay);
  const entryProgress = spring({
    frame: itemFrame,
    fps,
    config: { damping: 15, stiffness: 180 },
  });

  if (frame < appearFrame + delay) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        marginBottom: 6,
        transform: `scale(${entryProgress}) translateY(${interpolate(entryProgress, [0, 1], [8, 0])}px)`,
        opacity: entryProgress,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(34,197,94,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
            {category}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>{amount}</div>
    </div>
  );
};

// Summary metric card (matches domino-ui "summary" node)
const SummaryCard: React.FC<{
  heading: string;
  primary: string;
  secondary: string;
  sentiment: "up" | "down" | "neutral";
  frame: number;
  fps: number;
  appearFrame: number;
  index: number;
}> = ({ heading, primary, secondary, sentiment, frame, fps, appearFrame, index }) => {
  const delay = index * fps * 0.15;
  const localFrame = Math.max(0, frame - appearFrame - delay);
  const entryProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 160 },
  });

  if (frame < appearFrame + delay) return null;

  const sentimentColor =
    sentiment === "up" ? "#4ade80" : sentiment === "down" ? "#f87171" : "rgba(255,255,255,0.5)";

  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "12px 14px",
        transform: `translateY(${interpolate(entryProgress, [0, 1], [14, 0])}px)`,
        opacity: entryProgress,
      }}
    >
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {heading}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4", lineHeight: 1 }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontSize: 12, color: sentimentColor, marginTop: 4, fontWeight: 500 }}>
          {secondary}
        </div>
      )}
    </div>
  );
};

// Mini donut chart (matches domino-ui "visual" node)
const DonutChart: React.FC<{
  frame: number;
  fps: number;
  appearFrame: number;
  data: { label: string; value: number; color: string }[];
}> = ({ frame, fps, appearFrame, data }) => {
  const localFrame = Math.max(0, frame - appearFrame);
  const progress = interpolate(localFrame, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  if (frame < appearFrame) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 110;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = -90;
  const segments = data.map((d) => {
    const angle = (d.value / total) * 360 * progress;
    const dashLength = (angle / 360) * circumference;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { ...d, dashLength, startAngle, angle };
  });

  const opacity = interpolate(localFrame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const dashOffset = -((seg.startAngle + 90) / 360) * circumference;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth - 2}
              strokeDasharray={`${seg.dashLength} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100 * progress);
          const legendOpacity = interpolate(localFrame, [fps * 0.2 + i * fps * 0.1, fps * 0.5 + i * fps * 0.1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, opacity: legendOpacity }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {d.label}{" "}
                <span style={{ color: d.color, fontWeight: 700 }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Sage assistant response block
const AssistantBlock: React.FC<{
  frame: number;
  fps: number;
  appearFrame: number;
  children: React.ReactNode;
}> = ({ frame, fps, appearFrame, children }) => {
  if (frame < appearFrame) return null;

  const entryProgress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 12,
        opacity: entryProgress,
        transform: `translateY(${interpolate(entryProgress, [0, 1], [10, 0])}px)`,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <SageClover size={22} />
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

// ── Scene 1: logging expenses ─────────────────────────────────────────────────
export const SageChatLogScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, fps * 0.35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const USER_MSG_FRAME = fps * 0.3;
  const THINKING_START = fps * 1.0;
  const THINKING_END = fps * 2.2;
  const RESPONSE_FRAME = fps * 2.2;

  const showThinking = frame >= THINKING_START && frame < THINKING_END;

  // Transition text
  const transitionOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(135deg, #080f0a 0%, #0a100c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Ambient */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 65%)",
          top: -200,
          right: -200,
          pointerEvents: "none",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(74,222,128,0.6)",
          opacity: transitionOpacity,
        }}
      >
        The Sage way — just tell it
      </div>

      {/* Chat window */}
      <div
        style={{
          width: 480,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SageClover size={18} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
              Sage
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ padding: "16px 16px 12px" }}>
          {/* User message */}
          <UserBubble
            text="Spent 200 on dinner and 50 for Uber"
            frame={frame}
            appearFrame={USER_MSG_FRAME}
            fps={fps}
          />

          {/* Thinking */}
          {showThinking && <ThinkingDots frame={frame} fps={fps} />}

          {/* Sage response — collection of logged expenses */}
          <AssistantBlock frame={frame} fps={fps} appearFrame={RESPONSE_FRAME}>
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 10,
                  lineHeight: 1.5,
                  opacity: interpolate(
                    frame,
                    [RESPONSE_FRAME, RESPONSE_FRAME + fps * 0.4],
                    [0, 1],
                    { extrapolateRight: "clamp" }
                  ),
                }}
              >
                Got it! Logged 2 expenses ✓
              </div>

              <ExpenseItem
                label="Dinner"
                category="Food & Dining"
                amount="₹200"
                icon="🍽️"
                frame={frame}
                fps={fps}
                appearFrame={RESPONSE_FRAME + fps * 0.3}
                index={0}
              />
              <ExpenseItem
                label="Uber"
                category="Transport"
                amount="₹50"
                icon="🚗"
                frame={frame}
                fps={fps}
                appearFrame={RESPONSE_FRAME + fps * 0.3}
                index={1}
              />

              {/* Undo hint */}
              <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.0)} layout="none">
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    textAlign: "right",
                    opacity: interpolate(
                      frame - (RESPONSE_FRAME + fps * 1.0),
                      [0, fps * 0.4],
                      [0, 1],
                      { extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  Tap any item to undo
                </div>
              </Sequence>
            </div>
          </AssistantBlock>
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99,
              padding: "8px 14px",
              fontSize: 13,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Ask anything about your spending…
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.2)",
              border: "1px solid rgba(34,197,94,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            🎤
          </div>
        </div>
      </div>

      {/* No forms badge */}
      <Sequence from={Math.round(RESPONSE_FRAME + fps * 1.2)} layout="none">
        <div
          style={{
            position: "absolute",
            bottom: 52,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: interpolate(
              frame - (RESPONSE_FRAME + fps * 1.2),
              [0, fps * 0.5],
              [0, 1],
              { extrapolateRight: "clamp" }
            ),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 99,
              padding: "7px 18px",
              fontSize: 13,
              color: "#4ade80",
              fontWeight: 500,
            }}
          >
            <span>✓</span> No forms. No categories to pick. Just talk.
          </div>
        </div>
      </Sequence>
    </div>
  );
};

// ── Scene 2: spending query with charts ───────────────────────────────────────
export const SageChatQueryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, fps * 0.35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const USER_MSG_FRAME = fps * 0.3;
  const THINKING_START = fps * 0.9;
  const THINKING_END = fps * 2.1;
  const RESPONSE_FRAME = fps * 2.1;
  const CARDS_FRAME = RESPONSE_FRAME + fps * 0.4;
  const CHART_FRAME = RESPONSE_FRAME + fps * 0.8;
  const INSIGHT_FRAME = RESPONSE_FRAME + fps * 2.2;

  const showThinking = frame >= THINKING_START && frame < THINKING_END;

  const donutData = [
    { label: "Food", value: 4820, color: "#4ade80" },
    { label: "Transport", value: 2340, color: "#60a5fa" },
    { label: "Shopping", value: 3100, color: "#f472b6" },
    { label: "Other", value: 1840, color: "#fb923c" },
  ];

  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(135deg, #080f0a 0%, #0a100c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Ambient */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.09) 0%, transparent 65%)",
          bottom: -200,
          left: -150,
          pointerEvents: "none",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(74,222,128,0.6)",
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Ask anything — get live data
      </div>

      {/* Chat window */}
      <div
        style={{
          width: 520,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SageClover size={18} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
              Sage
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ padding: "16px 16px 12px" }}>
          {/* User message */}
          <UserBubble
            text="How much did I spend this month?"
            frame={frame}
            appearFrame={USER_MSG_FRAME}
            fps={fps}
          />

          {/* Thinking */}
          {showThinking && <ThinkingDots frame={frame} fps={fps} />}

          {/* Sage response */}
          <AssistantBlock frame={frame} fps={fps} appearFrame={RESPONSE_FRAME}>
            <div>
              {/* Subheading */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: 10,
                  opacity: interpolate(
                    frame,
                    [RESPONSE_FRAME, RESPONSE_FRAME + fps * 0.4],
                    [0, 1],
                    { extrapolateRight: "clamp" }
                  ),
                }}
              >
                March 2026
              </div>

              {/* Summary cards row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <SummaryCard
                  heading="Total Spent"
                  primary="₹12,100"
                  secondary="↑ 14% vs last month"
                  sentiment="down"
                  frame={frame}
                  fps={fps}
                  appearFrame={CARDS_FRAME}
                  index={0}
                />
                <SummaryCard
                  heading="Transactions"
                  primary="38"
                  secondary="across 4 categories"
                  sentiment="neutral"
                  frame={frame}
                  fps={fps}
                  appearFrame={CARDS_FRAME}
                  index={1}
                />
              </div>

              {/* Donut chart */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                <DonutChart
                  frame={frame}
                  fps={fps}
                  appearFrame={CHART_FRAME}
                  data={donutData}
                />
              </div>

              {/* Insight callout */}
              <Sequence from={Math.round(INSIGHT_FRAME)} layout="none">
                <div
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: interpolate(
                      frame - INSIGHT_FRAME,
                      [0, fps * 0.5],
                      [0, 1],
                      { extrapolateRight: "clamp" }
                    ),
                  }}
                >
                  {/* Label row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StarIcon size={12} color="#86efac" strokeWidth={2} />
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "rgba(134,239,172,0.7)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}>
                      Sage Insight
                    </span>
                  </div>
                  {/* Insight text */}
                  <div style={{ fontSize: 12, color: "#86efac", lineHeight: 1.55, paddingLeft: 18 }}>
                    Food accounts for 40% of spending — highest this year.
                  </div>
                </div>
              </Sequence>
            </div>
          </AssistantBlock>
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99,
              padding: "8px 14px",
              fontSize: 13,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Ask anything about your spending…
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.2)",
              border: "1px solid rgba(34,197,94,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            🎤
          </div>
        </div>
      </div>
    </div>
  );
};
