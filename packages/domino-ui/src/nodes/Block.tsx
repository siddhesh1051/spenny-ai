import { Star } from "lucide-react";
import type { UiBlockNode } from "../types";

export function Block({ node }: { node: UiBlockNode }) {
  if (node.style === "subheading") {
    return (
      <p style={{
        fontSize: "0.7rem",
        fontWeight: 500,
        color: "var(--muted-foreground)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: 0,
      }}>
        {node.text}
      </p>
    );
  }

  if (node.style === "insight") {
    return (
      <div style={{
        borderRadius: "0.75rem",
        background: "color-mix(in srgb, #10b981 8%, transparent)",
        border: "1px solid color-mix(in srgb, #10b981 20%, transparent)",
        padding: "1rem",
        marginTop: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <Star style={{ width: "0.875rem", height: "0.875rem", color: "#059669", fill: "#10b981", flexShrink: 0 }} />
          <span style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "#059669",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Sage Insight
          </span>
        </div>
        <p style={{
          fontSize: "0.875rem",
          color: "color-mix(in srgb, #059669 80%, var(--foreground))",
          lineHeight: 1.6,
          margin: 0,
        }}>
          {node.text}
        </p>
      </div>
    );
  }

  // body
  return (
    <p style={{
      fontSize: "0.875rem",
      color: "var(--muted-foreground)",
      lineHeight: 1.6,
      margin: 0,
    }}>
      {node.text}
    </p>
  );
}
