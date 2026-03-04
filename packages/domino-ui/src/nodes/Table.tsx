import React, { useState } from "react";
import type { UiTableNode } from "../types";

const DEFAULT_COLUMNS: [string, string, string, string] = ["Item", "Category", "Value", "Date"];

export function Table({ node }: { node: UiTableNode }) {
  const [expanded, setExpanded] = useState(false);
  const cols = node.columns ?? DEFAULT_COLUMNS;
  const visible = expanded ? node.rows : node.rows.slice(0, 10);
  const canToggle = node.rows.length > 10;

  const thStyle: React.CSSProperties = {
    padding: "0.625rem 0.75rem",
    textAlign: "left",
    fontSize: "0.7rem",
    fontWeight: 500,
    color: "var(--muted-foreground)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: "color-mix(in srgb, var(--muted) 50%, transparent)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ borderRadius: "0.75rem", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, paddingLeft: "1rem" }}>{cols[0]}</th>
              <th style={thStyle}>{cols[1]}</th>
              <th style={{ ...thStyle, textAlign: "right" }}>{cols[2]}</th>
              <th style={{ ...thStyle, paddingRight: "1rem" }}>{cols[3]}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.id ?? i}
                style={{ borderBottom: i < visible.length - 1 ? "1px solid color-mix(in srgb, var(--border) 50%, transparent)" : "none" }}
              >
                <td style={{ paddingLeft: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontWeight: 500 }}>
                  {row.label}
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  {row.badge && (
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "0.125rem 0.5rem", borderRadius: "9999px",
                      fontSize: "0.75rem", fontWeight: 500,
                      background: "var(--muted)", color: "var(--muted-foreground)",
                      textTransform: "capitalize",
                    }}>
                      {row.badge}
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {row.value}
                </td>
                <td style={{ paddingRight: "1rem", padding: "0.625rem 0.75rem", color: "var(--muted-foreground)" }}>
                  {row.secondary ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canToggle && (
        <div style={{ display: "flex", justifyContent: "center", borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--muted) 40%, transparent)" }}>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{
              padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 500,
              color: "var(--primary)", background: "none", border: "none", cursor: "pointer",
            }}
          >
            {expanded ? "Show less" : `Show ${node.rows.length - 10} more`}
          </button>
        </div>
      )}
    </div>
  );
}
