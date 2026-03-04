import React from "react";
import type { UiRowNode, UiRendererCallbacks } from "../types";

interface RowProps {
  node: UiRowNode;
  renderNode: (node: UiRowNode["children"][number], key: React.Key, callbacks?: UiRendererCallbacks) => React.ReactNode;
  callbacks?: UiRendererCallbacks;
}

export function Row({ node, renderNode, callbacks }: RowProps) {
  return (
    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: `repeat(${node.children.length}, 1fr)` }}>
      {node.children.map((child, idx) => renderNode(child, idx, callbacks))}
    </div>
  );
}
