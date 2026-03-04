import React from "react";
import { renderNode } from "./renderNode";
import type { UiRendererProps } from "./types";

export function UiRenderer({ layout, callbacks, className, style }: UiRendererProps & { className?: string; style?: React.CSSProperties }) {
  if (!layout) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", ...style }} className={className}>
      {layout.children.map((child, idx) => renderNode(child, idx, callbacks))}
    </div>
  );
}
