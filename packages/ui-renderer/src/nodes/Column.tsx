import React from "react";
import type { UiColumnNode, UiRendererCallbacks } from "../types";

interface ColumnProps {
  node: UiColumnNode;
  renderNode: (node: UiColumnNode["children"][number], key: React.Key, callbacks?: UiRendererCallbacks) => React.ReactNode;
  callbacks?: UiRendererCallbacks;
  style?: React.CSSProperties;
}

export function Column({ node, renderNode, callbacks, style }: ColumnProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", ...style }}>
      {node.children.map((child, idx) => renderNode(child, idx, callbacks))}
    </div>
  );
}
