import type { ChartConfig as UiChartConfig } from "@/components/ui/chart";

export type Intent = "query" | "expense" | "insights" | "conversation";

export interface DbExpense {
  id?: string;
  date: string;
  description: string;
  category: string;
  amount: number;
}

export interface CategoryItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MetricItem {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export interface LoggedExpense {
  id?: string;
  description: string;
  category: string;
  amount: number;
}


export interface VoiceData {
  audioUrl: string;
  waveformData: number[]; // 50 bars, each 0-1
  duration: number;       // seconds
}

export interface ReceiptData {
  imageUrl: string;
  fileName: string;
}

export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;         // transcript for voice messages, text for regular
  response?: SageResponse;
  voice?: VoiceData;       // present when message was sent as voice
  receipt?: ReceiptData;   // present when message was sent as image upload
  timestamp: Date;
}


export type ChartKind = "category_pie" | "category_bar";

export interface ChartConfig {
  kind: ChartKind;
  xKey: string;
  yKey: string;
  data: { name: string; value: number; percentage?: number }[];
}

export type UiSentiment = "up" | "down" | "neutral";

export interface UiSummaryNode {
  kind: "summary";
  id: string;
  heading: string;
  primary: string;
  secondary: string | null;
  sentiment: UiSentiment;
}

export interface UiBlockNode {
  kind: "block";
  style: "subheading" | "body" | "insight";
  text: string;
}

export interface UiVisualNode {
  kind: "visual";
  variant: "donut" | "bars";
  x: string;
  y: string;
  points: { label: string; value: number; share: number | null }[];
}

export interface UiCollectionNode {
  kind: "collection";
  variant: "items";
  text: string;
  items: LoggedExpense[];
}

export interface UiTableNode {
  kind: "table";
  variant: "records";
  rows: DbExpense[];
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
  | UiSummaryNode
  | UiBlockNode
  | UiVisualNode
  | UiCollectionNode
  | UiTableNode
  | UiRowNode
  | UiColumnNode;

export interface UiLayout {
  kind: "column";
  children: UiNode[];
}

export interface UiResponse {
  layout: UiLayout;
}

export interface SageResponse {
  intent: Intent;
  title?: string;
  text: string;
  expenses?: DbExpense[];
  categoryBreakdown?: CategoryItem[];
  groupBy?: string | null;
  totalAmount?: number;
  metrics?: MetricItem[];
  loggedExpenses?: LoggedExpense[];
  filters?: { startDate?: string | null; endDate?: string | null; category?: string | null };
  chart?: ChartConfig | null;
  uiResponse?: UiResponse | null;
}

// Re-export for convenience when using shadcn chart config alongside our own
export type ShadcnChartConfig = UiChartConfig;

