// Spenny-specific types. Generic UI node types live in domino-ui.
import type { UiResponse } from "domino-ui";

export type Intent = "query" | "expense" | "insights" | "conversation";

// Domain types (Spenny-specific, used in legacy response fields and adapters)

export interface DbExpense {
  id?: string;
  date: string;
  description: string;
  category: string;
  amount: number;
}

export interface LoggedExpense {
  id?: string;
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

// Spenny message / chat types

export interface VoiceData {
  audioUrl: string;
  waveformData: number[];
  duration: number;
}

export interface ReceiptData {
  imageUrl: string;
  fileName: string;
}

export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  response?: SageResponse;
  voice?: VoiceData;
  receipt?: ReceiptData;
  timestamp: Date;
}

// Spenny AI response (from sage-chat edge function)
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
  // SDK-driven generic UI layout (preferred path)
  uiResponse?: UiResponse | null;
}
