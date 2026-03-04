// Generic UI node types for the AI-driven JSON renderer.
// No domain knowledge (no finance/expense concepts) — consumers map their domain data
// into these shapes before passing to <UiRenderer />.

// ── Primitives ────────────────────────────────────────────────────────────────

export type UiSentiment = "up" | "down" | "neutral";

// ── Table / Collection item shapes ────────────────────────────────────────────

/** A single row in a `table` node. */
export interface UiTableRow {
  id?: string;
  /** Primary text shown in the first column */
  label: string;
  /** Optional badge text (e.g. a category name) */
  badge?: string;
  /** Primary numeric or formatted value */
  value: string | number;
  /** Optional secondary text (e.g. a date) */
  secondary?: string;
}

/** A single item in a `collection` node (list of just-created items with undo). */
export interface UiCollectionItem {
  id?: string;
  /** Primary label/title of the item */
  label: string;
  /** Optional badge (e.g. category) */
  badge?: string;
  /** Formatted display value */
  value: string | number;
  /** Optional emoji or icon hint */
  icon?: string;
}

/** A single data point in a `visual` node. */
export interface UiVisualPoint {
  label: string;
  value: number;
  /** Optional share/percentage (0-100) */
  share?: number | null;
}

// ── Node types ────────────────────────────────────────────────────────────────

export interface UiBlockNode {
  kind: "block";
  /** "subheading": small uppercase label; "body": regular paragraph; "insight": highlighted callout */
  style: "subheading" | "body" | "insight";
  text: string;
}

export interface UiSummaryNode {
  kind: "summary";
  id: string;
  heading: string;
  primary: string;
  secondary?: string | null;
  sentiment?: UiSentiment;
}

export interface UiVisualNode {
  kind: "visual";
  /** "donut": pie/donut chart; "bars": bar chart */
  variant: "donut" | "bars";
  /** Key name for x-axis (informational, not used by renderer) */
  x?: string;
  /** Key name for y-axis (informational, not used by renderer) */
  y?: string;
  points: UiVisualPoint[];
}

export interface UiTableNode {
  kind: "table";
  variant: "records";
  rows: UiTableRow[];
  /** Column headers override (default: ["Item", "Category", "Value", "Date"]) */
  columns?: [string, string, string, string];
}

export interface UiCollectionNode {
  kind: "collection";
  variant: "items";
  /** Header/confirmation text shown above the list */
  text: string;
  items: UiCollectionItem[];
}

export interface UiRowNode {
  kind: "row";
  children: UiNode[];
}

export interface UiColumnNode {
  kind: "column";
  children: UiNode[];
}

export type UiNode =
  | UiBlockNode
  | UiSummaryNode
  | UiVisualNode
  | UiTableNode
  | UiCollectionNode
  | UiRowNode
  | UiColumnNode;

// ── Layout root ───────────────────────────────────────────────────────────────

export interface UiLayout {
  kind: "column";
  children: UiNode[];
}

export interface UiResponse {
  layout: UiLayout;
}

// ── Renderer callbacks ────────────────────────────────────────────────────────

export interface UiRendererCallbacks {
  /** Called when the user clicks undo on a collection item. IDs are the item.id values. */
  onUndo?: (ids: string[]) => Promise<void>;
}

// ── Renderer props ────────────────────────────────────────────────────────────

export interface UiRendererProps {
  layout: UiLayout;
  callbacks?: UiRendererCallbacks;
  className?: string;
}
