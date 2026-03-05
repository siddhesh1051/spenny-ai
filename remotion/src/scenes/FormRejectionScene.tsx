import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from "remotion";
import { useDesignConfig } from "../useDesignConfig";
import { loadFont } from "@remotion/google-fonts/FunnelDisplay";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// Individual form field
const FormField: React.FC<{
  label: string;
  value: string;
  error?: string;
  errorFrame: number;
  shakeFrame: number;
  frame: number;
  fps: number;
  entryFrame: number;
}> = ({ label, value, error, errorFrame, shakeFrame, frame, fps, entryFrame }) => {
  const entryProgress = interpolate(frame, [entryFrame, entryFrame + fps * 0.35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const hasError = frame >= errorFrame;
  const shaking = frame >= shakeFrame && frame < shakeFrame + fps * 0.5;

  const shakeX = shaking
    ? interpolate(
        frame,
        [
          shakeFrame,
          shakeFrame + fps * 0.05,
          shakeFrame + fps * 0.1,
          shakeFrame + fps * 0.15,
          shakeFrame + fps * 0.2,
          shakeFrame + fps * 0.25,
          shakeFrame + fps * 0.3,
          shakeFrame + fps * 0.35,
          shakeFrame + fps * 0.4,
          shakeFrame + fps * 0.5,
        ],
        [0, -8, 8, -6, 6, -4, 4, -2, 2, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  const errorOpacity = interpolate(frame, [errorFrame, errorFrame + fps * 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: entryProgress,
        transform: `translateY(${interpolate(entryProgress, [0, 1], [12, 0])}px) translateX(${shakeX}px)`,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: hasError ? "#f87171" : "rgba(255,255,255,0.5)",
          marginBottom: 5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          transition: "none",
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: hasError ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${hasError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          color: hasError ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{value}</span>
        {hasError && (
          <span style={{ opacity: errorOpacity, color: "#f87171", fontSize: 16 }}>✕</span>
        )}
      </div>
      {hasError && error && (
        <div
          style={{
            fontSize: 11,
            color: "#f87171",
            marginTop: 4,
            opacity: errorOpacity,
            paddingLeft: 2,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

// Big red rejection stamp
const RejectionStamp: React.FC<{ frame: number; fps: number; stampFrame: number }> = ({
  frame,
  fps,
  stampFrame,
}) => {
  const stampProgress = spring({
    frame: frame - stampFrame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 1.2 },
  });

  const opacity = interpolate(frame, [stampFrame, stampFrame + fps * 0.15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotate = interpolate(stampProgress, [0, 1], [-22, -14]);

  if (frame < stampFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${stampProgress}) rotate(${rotate}deg)`,
        opacity,
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          border: "5px solid rgba(239,68,68,0.85)",
          borderRadius: 10,
          padding: "10px 28px",
          color: "rgba(239,68,68,0.85)",
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow: "0 0 0 2px rgba(239,68,68,0.2), inset 0 0 0 2px rgba(239,68,68,0.08)",
          textShadow: "0 0 20px rgba(239,68,68,0.4)",
        }}
      >
        REJECTED
      </div>
    </div>
  );
};

export const FormRejectionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height } = useDesignConfig();

  // Scene fade in
  const sceneOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Header text
  const headerOpacity = interpolate(frame, [fps * 0.2, fps * 0.7], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Form card entry
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const cardOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Form darkens when rejected
  const stampFrame = fps * 2.8;
  const formDimOpacity = interpolate(
    frame,
    [stampFrame, stampFrame + fps * 0.3],
    [0, 0.45],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(135deg, #0d0d0d 0%, #0f0a0a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Label above */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(239,68,68,0.7)",
          marginBottom: 20,
          opacity: headerOpacity,
        }}
      >
        The old way
      </div>

      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          marginBottom: 36,
          opacity: headerOpacity,
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        Filling forms to log an expense?
      </div>

      {/* Form card */}
      <div
        style={{
          position: "relative",
          width: 420,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "28px 28px 24px",
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Form dim overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 20,
            background: "rgba(0,0,0,0.5)",
            opacity: formDimOpacity,
            zIndex: 10,
          }}
        />

        {/* Form title */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 20,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Add Expense
        </div>

        <FormField
          label="Description"
          value="Dinner"
          frame={frame}
          fps={fps}
          entryFrame={fps * 0.5}
          errorFrame={fps * 1.8}
          shakeFrame={fps * 2.1}
          error="Description must be at least 10 characters"
        />
        <FormField
          label="Amount (₹)"
          value="200"
          frame={frame}
          fps={fps}
          entryFrame={fps * 0.75}
          errorFrame={fps * 2.0}
          shakeFrame={fps * 2.2}
          error="Amount must include category"
        />
        <FormField
          label="Category"
          value=""
          frame={frame}
          fps={fps}
          entryFrame={fps * 1.0}
          errorFrame={fps * 2.1}
          shakeFrame={fps * 2.3}
          error="Category is required"
        />
        <FormField
          label="Date"
          value="03/05/2026"
          frame={frame}
          fps={fps}
          entryFrame={fps * 1.2}
          errorFrame={-1}
          shakeFrame={-1}
        />

        {/* Submit button */}
        <div
          style={{
            marginTop: 8,
            opacity: interpolate(frame, [fps * 1.4, fps * 1.8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              background:
                frame >= fps * 2.0
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(34,197,94,0.15)",
              border: `1.5px solid ${frame >= fps * 2.0 ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.3)"}`,
              borderRadius: 10,
              padding: "11px 0",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 600,
              color: frame >= fps * 2.0 ? "#f87171" : "#4ade80",
              letterSpacing: "0.04em",
            }}
          >
            {frame >= fps * 2.0 ? "Form has errors" : "Save Expense"}
          </div>
        </div>

        {/* Rejection stamp */}
        <RejectionStamp frame={frame} fps={fps} stampFrame={stampFrame} />
      </div>

      {/* Frustrated caption */}
      <Sequence from={Math.round(fps * 3.2)} layout="none">
        <div
          style={{
            marginTop: 28,
            fontSize: 18,
            color: "rgba(255,255,255,0.5)",
            fontStyle: "italic",
            opacity: interpolate(frame - fps * 3.2, [0, fps * 0.5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          There has to be a better way...
        </div>
      </Sequence>
    </div>
  );
};
