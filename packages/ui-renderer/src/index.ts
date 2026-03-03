// Main component
export { UiRenderer } from "./UiRenderer";

// Recursive node renderer (useful if consumers want to render individual nodes)
export { renderNode } from "./renderNode";

// Individual node components
export { Block } from "./nodes/Block";
export { Summary } from "./nodes/Summary";
export { Visual } from "./nodes/Visual";
export { Table } from "./nodes/Table";
export { Collection } from "./nodes/Collection";
export { Row } from "./nodes/Row";
export { Column } from "./nodes/Column";

// All types
export type {
  UiNode,
  UiLayout,
  UiResponse,
  UiRendererProps,
  UiRendererCallbacks,
  UiSentiment,
  UiBlockNode,
  UiSummaryNode,
  UiVisualNode,
  UiVisualPoint,
  UiTableNode,
  UiTableRow,
  UiCollectionNode,
  UiCollectionItem,
  UiRowNode,
  UiColumnNode,
} from "./types";
