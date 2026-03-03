import { useEffect, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Check, Copy, Download, FileSpreadsheet, LucideImage, Maximize2, Pause, Play, ScanLine, Star, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryItem, ChartConfig, LoggedExpense, DbExpense, MetricItem, VoiceData, ReceiptData, SageResponse } from "./types";
import type { ChartConfig as UiChartConfig } from "@/components/ui/chart";
import { Skeleton } from "../ui/Skeleton";
import { CATEGORY_EMOJI, CATEGORY_STYLES, LOADING_STEPS } from "@/constants";
import { formatDuration } from "@/utils/sage";
import { createPortal } from "react-dom";
import { renderUiNode } from "./renderUiNode";


// If Tip is only used here, define it locally instead of importing
export function LocalTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-popover border border-border shadow-md text-[11px] text-foreground whitespace-nowrap z-50 opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100 transition-all duration-150 origin-bottom">
        {label}
      </div>
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const key = category.toLowerCase();
  const style = CATEGORY_STYLES[key] ?? CATEGORY_STYLES.other;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        style
      )}
    >
      {category}
    </span>
  );
}

export function InsightBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-4 mt-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Star className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500 shrink-0" />
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
          Sage Insight
        </span>
      </div>
      <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">{text}</p>
    </div>
  );
}

export function CategoryBreakdownSection({ breakdown }: { breakdown: CategoryItem[] }) {
  return (
    <div className="space-y-3">
      {breakdown.map((item, i) => (
        <div
          key={item.category}
          className="sage-bar-in"
          style={{ animationDelay: `${i * 65}ms`, opacity: 0 }}
        >
          <div className="flex items-center justify-between text-sm mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">
                {CATEGORY_EMOJI[item.category.toLowerCase()] ?? "📦"}
              </span>
              <span className="font-medium capitalize">{item.category}</span>
              <span className="text-xs text-muted-foreground">{item.count} items</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums text-sm">
                ₹{item.total.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">
                {item.percentage}%
              </span>
            </div>
          </div>
          <Progress value={item.percentage} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

export function ExpenseTableSection({ expenses }: { expenses: DbExpense[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleExpenses = expanded ? expenses : expenses.slice(0, 10);
  const canToggle = expenses.length > 10;

  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Description
            </TableHead>
            <TableHead className="py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Category
            </TableHead>
            <TableHead className="py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">
              Amount
            </TableHead>
            <TableHead className="pr-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">
              Date
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleExpenses.map((exp, i) => (
            <TableRow
              key={exp.id ?? i}
              className="sage-row-in"
              style={{ animationDelay: `${i * 55}ms`, opacity: 0 }}
            >
              <TableCell className="pl-4 py-2.5 font-medium text-sm">{exp.description}</TableCell>
              <TableCell className="py-2.5">
                <CategoryBadge category={exp.category} />
              </TableCell>
              <TableCell className="py-2.5 text-right font-semibold tabular-nums text-sm">
                ₹{exp.amount.toLocaleString("en-IN")}
              </TableCell>
              <TableCell className="pr-4 py-2.5 text-muted-foreground text-sm hidden sm:table-cell">
                {new Date(exp.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canToggle && (
        <div className="flex justify-center border-t bg-muted/40">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/90"
          >
            {expanded ? "Show less" : `Show ${expenses.length - 10} more`}
          </button>
        </div>
      )}
    </div>
  );
}

export function ExpenseLoggedSection({
  loggedExpenses,
  text,
  onUndo,
}: {
  loggedExpenses: LoggedExpense[];
  text: string;
  onUndo?: (ids: string[]) => Promise<void>;
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const hasUndo = !!onUndo;

  const visibleExpenses = loggedExpenses.filter((e) => !e.id || !removedIds.has(e.id));
  const visibleTotal = visibleExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleUndoOne = async (id: string) => {
    if (!onUndo || undoingIds.has(id)) return;
    setUndoingIds((prev) => new Set(prev).add(id));
    try {
      await onUndo([id]);
      setRemovedIds((prev) => new Set(prev).add(id));
    } finally {
      setUndoingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (visibleExpenses.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>Items removed.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 shrink-0">
            {text}
          </span>
        </div>
        <div className="space-y-2">
          {visibleExpenses.map((exp, i) => {
            const canUndoThis = hasUndo;
            const undoing = !!exp.id && undoingIds.has(exp.id);
            return (
              <div
                key={exp.id ?? i}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2.5 sage-logged-in"
                style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base leading-none shrink-0">
                    {CATEGORY_EMOJI[exp.category.toLowerCase()] ?? "📦"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{exp.description}</div>
                    <CategoryBadge category={exp.category} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums">
                    ₹{exp.amount.toLocaleString("en-IN")}
                  </span>
                  {canUndoThis && (
                    <LocalTip label="Undo">
                      <button
                        type="button"
                        onClick={() => exp.id && handleUndoOne(exp.id)}
                        disabled={undoing}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    </LocalTip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {visibleExpenses.length > 1 && (
          <div className="flex justify-end mt-2.5 text-sm font-bold text-foreground px-0.5">
            Total: ₹{visibleTotal.toLocaleString("en-IN")}
          </div>
        )}
      </div>
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div
      className={cn(
        "grid gap-3 mb-4",
        metrics.length === 1 ? "grid-cols-1" :
          metrics.length === 2 ? "grid-cols-2" :
            "grid-cols-3"
      )}
    >
      {metrics.map((m, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card/80 backdrop-blur-sm p-3 sage-metric-in"
          style={{ animationDelay: `${i * 90}ms`, opacity: 0 }}
        >
          <div className="text-xs text-muted-foreground mb-1 truncate">{m.label}</div>
          <div className="font-bold text-base leading-tight">{m.value}</div>
          {m.change && (
            <div
              className={cn(
                "text-xs mt-1",
                m.positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-orange-500 dark:text-orange-400"
              )}
            >
              {m.change}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


export function CategoryChart({ chart }: { chart: ChartConfig }) {
  if (!chart?.data?.length) return null;

  const isPie = chart.kind === "category_pie";
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--muted-foreground)",
  ];

  const data = chart.data;
  const chartConfig: UiChartConfig = {
    value: {
      label: "Amount",
      color: "var(--foreground)",
    },
  };
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 4}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <div className="mt-4 mb-4 rounded-xl border bg-card/80 backdrop-blur-sm p-3.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
          Category overview
        </p>
      </div>
      <div className="h-56">
        <ChartContainer config={chartConfig} className="w-full h-full">
          {isPie ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                stroke="var(--background)"
                strokeWidth={2}
                activeIndex={activeIndex ?? undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={isActive || activeIndex === null ? 1 : 0.35}
                    />
                  );
                })}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid
                stroke="color-mix(in srgb, var(--muted-foreground) 12%, transparent)"
                vertical={false}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="value"
                radius={[4, 4, 2, 2]}
                maxBarSize={40}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`bar-${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <LocalTip label={copied ? "Copied!" : "Copy"}>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </LocalTip>
  );
}

export function InlineExportButtons({
  expenses,
  title,
  totalAmount,
}: {
  expenses: DbExpense[];
  title?: string;
  totalAmount?: number;
}) {
  const [csvDone, setCsvDone] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);

  const slug = (title ?? "expenses").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);

  const handleCSV = () => {
    const header = ["Date", "Description", "Category", "Amount (INR)"];
    const rows = expenses.map((e) => [
      new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      `"${(e.description ?? "").replace(/"/g, '""')}"`,
      e.category,
      e.amount.toFixed(2),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCsvDone(true);
    setTimeout(() => setCsvDone(false), 2000);
  };

  const handlePDF = () => {
    const total = totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0);
    const rows = expenses.map((e) => `<tr>
      <td>${new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
      <td>${e.description ?? ""}</td>
      <td><span class="badge badge-${e.category}">${e.category}</span></td>
      <td class="amt">₹${e.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${title ?? "Expenses"} — Spenny</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:#111;background:#fff;padding:40px}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;border-bottom:2px solid #f0f0f0;padding-bottom:16px}
header h1{font-size:20px;font-weight:700}header span{font-size:12px;color:#888}
.meta{display:flex;gap:24px;margin-bottom:20px}
.meta-card{background:#f7f7f7;border-radius:10px;padding:12px 18px;min-width:140px}
.meta-card .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.meta-card .value{font-size:18px;font-weight:700}
table{width:100%;border-collapse:collapse}
thead th{background:#f7f7f7;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666;font-weight:600}
thead th.amt{text-align:right}
tbody tr{border-bottom:1px solid #f0f0f0}tbody tr:last-child{border-bottom:none}
td{padding:10px 12px;vertical-align:middle}td.amt{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500;text-transform:capitalize;background:#f0f0f0;color:#555}
.badge-food{background:#fef3c7;color:#92400e}.badge-travel{background:#dbeafe;color:#1e40af}
.badge-groceries{background:#dcfce7;color:#166534}.badge-entertainment{background:#f3e8ff;color:#7e22ce}
.badge-utilities{background:#e0f2fe;color:#0369a1}.badge-rent{background:#fee2e2;color:#991b1b}
.badge-other{background:#f1f5f9;color:#475569}
tfoot td{padding:10px 12px;font-weight:700;border-top:2px solid #e5e7eb}tfoot td.amt{text-align:right;font-size:15px}
footer{margin-top:32px;font-size:11px;color:#bbb;text-align:center}
@media print{body{padding:20px}}
</style></head><body>
<header><h1>${title ?? "Expense Report"}</h1><span>Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · Spenny AI</span></header>
<div class="meta">
<div class="meta-card"><div class="label">Total Spent</div><div class="value">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
<div class="meta-card"><div class="label">Transactions</div><div class="value">${expenses.length}</div></div>
</div>
<table>
<thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="amt">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">Total</td><td class="amt">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr></tfoot>
</table>
<footer>Exported from Spenny AI · ${dateStr}</footer>
<script>window.onload=()=>window.print()<\/script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 2000);
  };

  return (
    <>
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      <LocalTip label={csvDone ? "Saved!" : "Download CSV"}>
        <button
          type="button"
          onClick={handleCSV}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-emerald-600 active:scale-95"
        >
          {csvDone
            ? <Check className="h-3.5 w-3.5 text-emerald-500" />
            : <FileSpreadsheet className="h-3.5 w-3.5" />
          }
        </button>
      </LocalTip>
      <LocalTip label={pdfDone ? "Opened!" : "Export PDF"}>
        <button
          type="button"
          onClick={handlePDF}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-rose-500 active:scale-95"
        >
          {pdfDone
            ? <Check className="h-3.5 w-3.5 text-rose-400" />
            : <Download className="h-3.5 w-3.5" />
          }
        </button>
      </LocalTip>
    </>
  );
}

export function LocalCloverIcon({ size = 32, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={spinning ? { animation: "sageSpin 1.4s linear infinite" } : undefined}
    >
      <rect x="18" y="1" width="12" height="20" rx="6" fill="#16a34a" />
      <rect x="27" y="18" width="20" height="12" rx="6" fill="#16a34a" />
      <rect x="18" y="27" width="12" height="20" rx="6" fill="#16a34a" />
      <rect x="1" y="18" width="20" height="12" rx="6" fill="#16a34a" />
    </svg>
  );
}

export function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-start gap-3 py-2 sage-msg-in">
      <div className="mt-0.5 shrink-0">
        <LocalCloverIcon size={20} spinning />
      </div>
      <div className="flex-1 min-w-0">
        <span key={step} className="text-sm text-green-600 dark:text-green-500 font-medium sage-text-fade">
          {LOADING_STEPS[step % LOADING_STEPS.length]}
        </span>
        <div className="mt-2.5 space-y-2">
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}

export function VoiceMessageBubble({ audioUrl, waveformData, duration }: VoiceData) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const playedBars = Math.round(progress * waveformData.length);
  const displayTime = isPlaying && audioRef.current
    ? audioRef.current.currentTime
    : duration;

  return (
    <div className="flex items-center gap-2.5 bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-3 min-w-[220px] max-w-[280px] sage-voice-bubble">
      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center shrink-0 transition-colors active:scale-95"
      >
        {isPlaying
          ? <Pause className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
          : <Play className="h-3.5 w-3.5 ml-0.5" style={{ fill: "currentColor" }} />
        }
      </button>

      {/* Waveform bars */}
      <div className="flex items-center gap-[2px] flex-1 h-7 overflow-hidden">
        {waveformData.map((v, i) => (
          <div
            key={i}
            className="shrink-0 rounded-full"
            style={{
              width: "3px",
              height: `${Math.max(3, v * 28)}px`,
              backgroundColor: "currentColor",
              opacity: i < playedBars ? 1 : 0.35,
              transition: "opacity 0.05s",
            }}
          />
        ))}
      </div>

      {/* Duration */}
      <span className="text-xs tabular-nums opacity-75 shrink-0 min-w-[28px] text-right">
        {formatDuration(displayTime)}
      </span>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration > 0) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
      />
    </div>
  );
}

// ── Receipt image bubble ───────────────────────────────────────────────────────
export function ReceiptBubble({
  imageUrl,
  fileName,
  isScanning = false,
}: ReceiptData & { isScanning?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsClosing, setFsClosing] = useState(false);

  // Keep scan overlay mounted while it fades out
  const [overlayMounted, setOverlayMounted] = useState(isScanning);
  const [overlayVisible, setOverlayVisible] = useState(isScanning);

  useEffect(() => {
    if (isScanning) {
      setOverlayMounted(true);
      requestAnimationFrame(() => setOverlayVisible(true));
    } else {
      setOverlayVisible(false);
      const t = setTimeout(() => setOverlayMounted(false), 600);
      return () => clearTimeout(t);
    }
  }, [isScanning]);

  // Lock body scroll while fullscreen modal is open
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  const closeFullscreen = () => {
    setFsClosing(true);
    setTimeout(() => {
      setFsClosing(false);
      setFullscreen(false);
    }, 280);
  };

  // Close on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeFullscreen(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fullscreen]);

  return (
    <>
      {/* ── Thumbnail card ── */}
      <div className="max-w-[220px] rounded-2xl rounded-tr-sm overflow-hidden border bg-background shadow-sm sage-receipt-in">
        <div
          className="relative overflow-hidden cursor-pointer"
          style={{
            maxHeight: expanded && !isScanning ? "600px" : "170px",
            transition: "max-height 0.35s ease",
          }}
          onClick={() => !isScanning && setExpanded((v) => !v)}
        >
          <img
            src={imageUrl}
            alt={fileName}
            className="w-full object-cover object-top"
            style={{ display: "block" }}
          />

          {/* Fullscreen button — top-right, visible when not scanning */}
          {!isScanning && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/90 transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="View fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* ── Scanning overlay ── */}
          {overlayMounted && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: overlayVisible ? 1 : 0, transition: "opacity 0.55s ease" }}
            >
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute top-2.5 left-2.5 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
              <div className="absolute top-2.5 right-2.5 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
              <div className="absolute bottom-2.5 left-2.5 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
              <div className="absolute bottom-2.5 right-2.5 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />
              <div className="sage-scan-sweep absolute inset-x-3" />
              <div className="absolute bottom-3 inset-x-0 flex justify-center">
                <span className="text-[10px] font-medium text-emerald-300 tracking-widest uppercase sage-scan-pulse">
                  Scanning…
                </span>
              </div>
            </div>
          )}

          {!expanded && !isScanning && (
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
          <LucideImage className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">{fileName}</span>
          <ScanLine className={cn("h-3 w-3 shrink-0", isScanning ? "text-emerald-500 sage-scan-pulse" : "text-primary/60")} />
        </div>
      </div>

      {/* ── Fullscreen modal (portal) ── */}
      {fullscreen && createPortal(
        <div
          className={cn("sage-fs-backdrop", fsClosing && "sage-fs-out")}
          onClick={closeFullscreen}
        >
          <div
            className={cn("sage-fs-content", fsClosing && "sage-fs-content-out")}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              style={{ maxWidth: "min(92vw, 900px)", maxHeight: "88vh" }}
            />

            {/* Close button */}
            <button
              type="button"
              onClick={closeFullscreen}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Filename pill */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5">
              <LucideImage className="h-3.5 w-3.5 text-white/70 shrink-0" />
              <span className="text-xs text-white/80 max-w-[240px] truncate">{fileName}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function AssistantResponse({
  response,
  visible,
  onUndoLoggedExpenses,
}: {
  response: SageResponse;
  visible: boolean;
  onUndoLoggedExpenses?: (ids: string[]) => Promise<void>;
}) {
  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(14px)",
    transition: "opacity 0.4s ease, transform 0.4s ease",
  };

  // ── Conversation ──
  if (response.intent === "conversation") {
    if (response.uiResponse?.layout) {
      return (
        <div style={style} className="text-sm leading-relaxed text-foreground">
          {renderUiNode(response.uiResponse.layout, null)}
        </div>
      );
    }
    return (
      <div style={style} className="text-sm leading-relaxed text-foreground">
        {response.text}
      </div>
    );
  }

  // ── Expense logged ──
  if (response.intent === "expense") {
    if (response.uiResponse?.layout) {
      return (
        <div style={style} className="space-y-3">
          {renderUiNode(response.uiResponse.layout, undefined, undefined, onUndoLoggedExpenses)}
        </div>
      );
    }
    return null;
  }

  // ── Query ──
  if (response.intent === "query") {
    const hasUi = !!response.uiResponse?.layout;

    if (hasUi) {
      return (
        <div style={style} className="space-y-4">
          {renderUiNode(response.uiResponse!.layout, response.chart ?? null)}
        </div>
      );
    }

    const hasExpenses = (response.expenses?.length ?? 0) > 0;
    const hasBreakdown = (response.categoryBreakdown?.length ?? 0) > 1;
    const primaryIsBreakdown = response.groupBy === "category";
    const hasChart = !!response.chart && response.chart.data.length > 0;

    return (
      <div style={style}>
        {response.title && (
          <h3 className="font-bold text-base mb-2 text-foreground">{response.title}</h3>
        )}

        {/* No results */}
        {!hasExpenses && (
          <p className="text-sm text-muted-foreground">{response.text}</p>
        )}

        {/* Category breakdown as primary view */}
        {primaryIsBreakdown && hasBreakdown && hasExpenses && (
          <Tabs defaultValue="breakdown" className="w-full">
            <TabsList className="h-8 mb-3">
              <TabsTrigger value="breakdown" className="text-xs h-6 px-3">
                By Category
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs h-6 px-3">
                All Expenses
              </TabsTrigger>
            </TabsList>
            <TabsContent value="breakdown" className="mt-0 space-y-3">
              {hasChart ? (
                <CategoryChart chart={response.chart!} />
              ) : (
                <CategoryBreakdownSection breakdown={response.categoryBreakdown!} />
              )}
              {response.totalAmount !== undefined && (
                <div className="flex justify-between text-sm mt-3 px-0.5">
                  <span className="text-muted-foreground">{response.expenses!.length} transactions</span>
                  <span className="font-bold">Total: ₹{response.totalAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
            </TabsContent>
            <TabsContent value="list" className="mt-0">
              <ExpenseTableSection expenses={response.expenses!} />
              {response.totalAmount !== undefined && (
                <div className="flex justify-between text-sm mt-2 px-0.5">
                  <span className="text-muted-foreground">{response.expenses!.length} transactions</span>
                  <span className="font-bold">Total: ₹{response.totalAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Normal expense list */}
        {!primaryIsBreakdown && hasExpenses && (
          <>
            <ExpenseTableSection expenses={response.expenses!} />
            {response.totalAmount !== undefined && (
              <div className="flex justify-between items-center text-sm mt-2 px-0.5">
                <span className="text-muted-foreground">{response.expenses!.length} transaction{response.expenses!.length !== 1 ? "s" : ""}</span>
                <span className="font-bold">Total: ₹{response.totalAmount.toLocaleString("en-IN")}</span>
              </div>
            )}
            {hasBreakdown && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
                  Category Breakdown
                </p>
                {hasChart ? (
                  <CategoryChart chart={response.chart!} />
                ) : (
                  <CategoryBreakdownSection breakdown={response.categoryBreakdown!} />
                )}
              </div>
            )}
          </>
        )}

        {response.text && hasExpenses && <InsightBox text={response.text} />}

      </div>
    );
  }

  // ── Insights ──
  if (response.intent === "insights") {
    const hasUi = !!response.uiResponse?.layout;
    const hasChart = !!response.chart && response.chart.data.length > 0;

    if (hasUi) {
      return (
        <div style={style} className="space-y-4">
          {renderUiNode(response.uiResponse!.layout, response.chart ?? null)}
        </div>
      );
    }

    return (
      <div style={style}>
        {response.title && (
          <h3 className="font-bold text-base mb-3 text-foreground">{response.title}</h3>
        )}
        {response.metrics && response.metrics.length > 0 && (
          <MetricsRow metrics={response.metrics} />
        )}
        {(response.categoryBreakdown?.length ?? 0) > 0 && (
          <div className="mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
              Spending Breakdown (90 days)
            </p>
            {hasChart ? (
              <CategoryChart chart={response.chart!} />
            ) : (
              <CategoryBreakdownSection breakdown={response.categoryBreakdown!} />
            )}
          </div>
        )}
        {response.text && <InsightBox text={response.text} />}
      </div>
    );
  }

  return null;
}
