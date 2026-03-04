import React from "react";
import type { UiSummaryNode } from "../types";

export function Summary({ node }: { node: UiSummaryNode }) {
  const secondaryColor =
    node.sentiment === "up"
      ? "#10b981"
      : node.sentiment === "down"
        ? "#f97316"
        : "var(--muted-foreground)";

  return (
    <div style={{
      borderRadius: "0.75rem",
      border: "1px solid var(--border)",
      background: "var(--card)",
      padding: "0.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem",
      flex: 1,
    }}>
      <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.heading}
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.25 }}>
        {node.primary}
      </div>
      {node.secondary && (
        <div style={{ fontSize: "0.75rem", color: secondaryColor }}>
          {node.secondary}
        </div>
      )}
    </div>
  );
}
