import React, { useState } from "react";
import { Check, Undo2 } from "lucide-react";
import type { UiCollectionNode, UiRendererCallbacks } from "../types";

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: "0.5rem", padding: "0.25rem 0.5rem", borderRadius: "0.375rem",
          background: "var(--popover)", border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)", fontSize: "0.6875rem",
          color: "var(--foreground)", whiteSpace: "nowrap", zIndex: 50,
          pointerEvents: "none",
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

export function Collection({ node, callbacks }: { node: UiCollectionNode; callbacks?: UiRendererCallbacks }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());

  const hasUndo = !!callbacks?.onUndo;
  const visible = node.items.filter(item => !item.id || !removedIds.has(item.id));
  const visibleTotal = visible.reduce((sum, item) => {
    const v = typeof item.value === "number" ? item.value : parseFloat(String(item.value)) || 0;
    return sum + v;
  }, 0);

  const handleUndoOne = async (id: string) => {
    if (!callbacks?.onUndo || undoingIds.has(id)) return;
    setUndoingIds(prev => new Set(prev).add(id));
    try {
      await callbacks.onUndo([id]);
      setRemovedIds(prev => new Set(prev).add(id));
    } finally {
      setUndoingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  if (visible.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
        <Check style={{ width: "1rem", height: "1rem", color: "#10b981", flexShrink: 0 }} />
        <span>Items removed.</span>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: "0.75rem", border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
      <div style={{ padding: "0.875rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={{
            width: "1.25rem", height: "1.25rem", borderRadius: "50%", background: "#10b981",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Check style={{ width: "0.75rem", height: "0.75rem", color: "white", strokeWidth: 2.5 }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#059669", flexShrink: 0 }}>
            {node.text}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visible.map((item, i) => {
            const undoing = !!item.id && undoingIds.has(item.id);
            return (
              <div
                key={item.id ?? i}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
                  background: "var(--background)", padding: "0.625rem 0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0, flex: 1 }}>
                  {item.icon && <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </div>
                    {item.badge && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "0.125rem 0.5rem",
                        borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500,
                        background: "var(--muted)", color: "var(--muted-foreground)", textTransform: "capitalize",
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {item.value}
                  </span>
                  {hasUndo && (
                    <Tip label="Undo">
                      <button
                        type="button"
                        onClick={() => item.id && handleUndoOne(item.id)}
                        disabled={undoing}
                        style={{
                          padding: "0.375rem", borderRadius: "0.375rem", border: "none",
                          background: "none", cursor: undoing ? "not-allowed" : "pointer",
                          color: "var(--muted-foreground)", opacity: undoing ? 0.5 : 1,
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <Undo2 style={{ width: "0.875rem", height: "0.875rem" }} />
                      </button>
                    </Tip>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visible.length > 1 && visibleTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.625rem", fontSize: "0.875rem", fontWeight: 700 }}>
            Total: {visibleTotal.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
