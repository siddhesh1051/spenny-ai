// Generic UI schema for JSON-driven dashboards

export type ChartType = "bar" | "line" | "area" | "pie";

export type UiBlock =
  | {
      kind: "text";
      id?: string;
      title?: string;
      body: string;
    }
  | {
      kind: "metrics";
      id?: string;
      title?: string;
      items: {
        label: string;
        value: string;
        change?: string;
        tone?: "good" | "bad" | "neutral";
      }[];
    }
  | {
      kind: "table";
      id?: string;
      title?: string;
      columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
      rows: Record<string, string | number | null>[];
    }
  | {
      kind: "chart";
      id?: string;
      title?: string;
      chartType: ChartType;
      xKey?: string;
      series: { key: string; label?: string }[];
      data: Record<string, string | number | null>[];
    };

export interface UiSpec {
  version: "1";
  layout?: {
    variant?: "auto" | "single" | "two-column";
  };
  blocks: UiBlock[];
}

