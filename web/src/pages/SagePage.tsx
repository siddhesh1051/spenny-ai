import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Plus,
  ArrowUp,
  Send,
  TrendingUp,
  TrendingDown,
  UtensilsCrossed,
  Car,
  ShoppingCart,
  PiggyBank,
  BarChart2,
  CalendarDays,
  Repeat2,
  Star,
  RotateCcw,
  Undo2,
  Mic,
  Square,
  Play,
  Pause,
  X,
  Image as LucideImage,
  FileText,
  ScanLine,
  Maximize2,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { createPortal } from "react-dom";
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
  type ChartConfig as UiChartConfig,
} from "@/components/ui/chart";

// ── Types ─────────────────────────────────────────────────────────────────────

type Intent = "query" | "expense" | "insights" | "conversation";

interface DbExpense {
  id?: string;
  date: string;
  description: string;
  category: string;
  amount: number;
}

interface CategoryItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface MetricItem {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

interface LoggedExpense {
  id?: string;
  description: string;
  category: string;
  amount: number;
}

type ChartKind = "category_pie" | "category_bar";

interface ChartConfig {
  kind: ChartKind;
  xKey: string;
  yKey: string;
  data: { name: string; value: number; percentage?: number }[];
}

interface SageResponse {
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
}

interface VoiceData {
  audioUrl: string;
  waveformData: number[]; // 50 bars, each 0-1
  duration: number;       // seconds
}

interface ReceiptData {
  imageUrl: string;
  fileName: string;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;         // transcript for voice messages, text for regular
  response?: SageResponse;
  voice?: VoiceData;       // present when message was sent as voice
  receipt?: ReceiptData;   // present when message was sent as image upload
  timestamp: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔",
  travel: "✈️",
  groceries: "🛒",
  entertainment: "🎬",
  utilities: "💡",
  rent: "🏠",
  other: "📦",
};

const CATEGORY_STYLES: Record<string, string> = {
  food: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  travel: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  groceries: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  entertainment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  utilities: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  rent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const LOADING_STEPS = [
  "Scanning your receipt…",
  "Transcribing your voice…",
  "Scanning your expenses…",
  "Analyzing spending patterns…",
  "Crunching the numbers…",
  "Generating insights…",
];

const QUICK_QUESTIONS = [
  { icon: BarChart2, text: "What did I spend most on this month?" },
  { icon: TrendingUp, text: "How does this month compare to last?" },
  { icon: UtensilsCrossed, text: "Show my food & dining expenses" },
  { icon: TrendingDown, text: "Where can I cut down spending?" },
  { icon: Repeat2, text: "Show all recurring subscriptions" },
  { icon: ShoppingCart, text: "What did I spend on groceries?" },
  { icon: PiggyBank, text: "How much have I saved this month?" },
  { icon: CalendarDays, text: "Break down expenses by week" },
  { icon: Car, text: "How much did I spend on travel?" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function CloverIcon({ size = 32, spinning = false }: { size?: number; spinning?: boolean }) {
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

function CategoryBadge({ category }: { category: string }) {
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

function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-start gap-3 py-2 sage-msg-in">
      <div className="mt-0.5 shrink-0">
        <CloverIcon size={20} spinning />
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

function MetricsRow({ metrics }: { metrics: MetricItem[] }) {
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

function CategoryBreakdownSection({ breakdown }: { breakdown: CategoryItem[] }) {
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

function CategoryChart({ chart }: { chart: ChartConfig }) {
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
      {isPie && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {data.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.name}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors",
                  isActive ? "bg-muted/80 text-foreground" : "bg-transparent text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="truncate capitalize">{item.name}</span>
                </div>
                <span className="tabular-nums">
                  {typeof item.percentage === "number" ? `${item.percentage}%` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpenseTableSection({ expenses }: { expenses: DbExpense[] }) {
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
          {expenses.map((exp, i) => (
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
    </div>
  );
}

function InsightBox({ text }: { text: string }) {
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

function ExpenseLoggedSection({
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

  const visibleExpenses = loggedExpenses.filter((e) => !e.id || !removedIds.has(e.id));
  const visibleTotal = visibleExpenses.reduce((sum, e) => sum + e.amount, 0);
  const hasUndo = !!onUndo;

  const handleUndoOne = async (id: string) => {
    if (!onUndo || undoingIds.has(id)) return;
    setUndoingIds((prev) => new Set(prev).add(id));
    try {
      await onUndo([id]);
      setRemovedIds((prev) => new Set(prev).add(id));
    } catch {
      toast.error("Couldn’t remove expense. Try again.");
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
        <span>Expenses removed.</span>
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
          <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 shrink-0">{text}</span>
        </div>
        <div className="space-y-2">
          {visibleExpenses.map((exp, i) => {
            const canUndoThis = !!exp.id && hasUndo;
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
                    <Tip label="Undo expense">
                      <button
                        type="button"
                        onClick={() => handleUndoOne(exp.id!)}
                        disabled={undoing}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    </Tip>
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

function AssistantResponse({
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
    return (
      <div style={style} className="text-sm leading-relaxed text-foreground">
        {response.text}
      </div>
    );
  }

  // ── Expense logged ──
  if (response.intent === "expense") {
    const logged = response.loggedExpenses ?? [];
    const ids = logged.map((e) => e.id).filter((id): id is string => !!id);
    return (
      <div style={style}>
        <ExpenseLoggedSection
          loggedExpenses={logged}
          text={response.text}
          onUndo={onUndoLoggedExpenses && ids.length > 0 ? (idsToUndo) => onUndoLoggedExpenses(idsToUndo) : undefined}
        />
      </div>
    );
  }

  // ── Query ──
  if (response.intent === "query") {
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
    const hasChart = !!response.chart && response.chart.data.length > 0;

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

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-popover border border-border shadow-md text-[11px] text-foreground whitespace-nowrap z-50 opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100 transition-all duration-150 origin-bottom">
        {label}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Tip label={copied ? "Copied!" : "Copy"}>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </Tip>
  );
}

function InlineExportButtons({
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
      <Tip label={csvDone ? "Saved!" : "Download CSV"}>
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
      </Tip>
      <Tip label={pdfDone ? "Opened!" : "Export PDF"}>
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
      </Tip>
    </>
  );
}

// ── Voice helpers ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoiceMessageBubble({ audioUrl, waveformData, duration }: VoiceData) {
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

function ReceiptBubble({
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SagePage({
  onSend,
  deleteExpense,
}: {
  onSend?: () => void;
  deleteExpense?: (id: string) => Promise<void>;
}) {
  const onUndoLoggedExpenses = useCallback(
    async (ids: string[]) => {
      if (!deleteExpense) return;
      for (const id of ids) await deleteExpense(id);
    },
    [deleteExpense]
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [userName, setUserName] = useState("there");
  const [lastMsgVisible, setLastMsgVisible] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

  // ── Voice recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(Array(40).fill(0));

  // ── Receipt / attach state ──
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [scanningMsgId, setScanningMsgId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef2 = useRef<HTMLDivElement>(null);
  const glowWrapRef = useRef<HTMLDivElement>(null);

  // ── Voice recording refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const waveformSamplesRef = useRef<number[]>([]);
  const isCancelledRef = useRef(false);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const raw =
          session.user?.user_metadata?.full_name?.split(" ")[0] ||
          session.user?.email?.split("@")[0] ||
          "there";
        setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Focus input when chat mode activates
  useEffect(() => {
    if (chatMode) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatMode]);

  // Close attach menu when clicking outside either anchor
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inMenu1 = attachMenuRef.current?.contains(t);
      const inMenu2 = attachMenuRef2.current?.contains(t);
      if (!inMenu1 && !inMenu2) setShowAttachMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachMenu]);

  const stopThinking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Voice recording ───────────────────────────────────────────────────────

  /** Downsample a large array of amplitude samples to `targetLen` bars */
  const downsampleWaveform = (samples: number[], targetLen: number): number[] => {
    if (!samples.length) return Array(targetLen).fill(0.15);
    const step = Math.max(1, Math.floor(samples.length / targetLen));
    return Array.from({ length: targetLen }, (_, i) => {
      const slice = samples.slice(i * step, (i + 1) * step);
      return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
    });
  };

  const transcribeAndSend = useCallback(
    async (blob: Blob, waveformData: number[], duration: number) => {
      onSend?.();

      // Switch to chat mode if on welcome screen
      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const audioUrl = URL.createObjectURL(blob);
      const msgId = crypto.randomUUID();

      // Add voice bubble immediately (transcript fills in later)
      const voiceMsg: Message = {
        id: msgId,
        type: "user",
        content: "",
        voice: { audioUrl, waveformData, duration },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, voiceMsg]);
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

        // 1. Transcribe audio via edge function
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");

        const transcribeRes = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        if (!transcribeRes.ok) throw new Error(`Transcription HTTP ${transcribeRes.status}`);
        const { transcript, error: transcriptErr } = await transcribeRes.json();

        if (transcriptErr || !transcript?.trim()) {
          throw new Error("Could not understand the audio. Please try again.");
        }

        // 2. Update voice bubble with transcript
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: transcript } : m))
        );

        // 3. Send transcript to sage-chat
        const sageRes = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: transcript }),
        });

        stopThinking();
        setIsThinking(false);

        if (!sageRes.ok) throw new Error(`Sage chat HTTP ${sageRes.status}`);
        const response: SageResponse = await sageRes.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: response.text ?? "",
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        const errText = String(err).includes("understand")
          ? "I couldn't understand the audio. Please speak clearly and try again."
          : "Something went wrong processing your voice. Please try again.";
        toast.error(errText);
        const errMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: errText,
          response: { intent: "conversation", text: errText },
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [chatMode, stopThinking, onSend]
  );

  const startRecording = useCallback(async () => {
    if (isThinking || isRecording) return;
    isCancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Web Audio API for live waveform
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLen = analyser.frequencyBinCount; // 64
      const dataArr = new Uint8Array(bufferLen);
      const LIVE_BARS = 40;

      waveformSamplesRef.current = [];
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      // Animate live waveform
      const animate = () => {
        analyser.getByteFrequencyData(dataArr);
        const bars = Array.from({ length: LIVE_BARS }, (_, i) => {
          const idx = Math.floor((i / LIVE_BARS) * bufferLen);
          return dataArr[idx] / 255;
        });
        setLiveWaveform(bars);
        // Store amplitude samples for static waveform
        const avg = bars.reduce((s, v) => s + v, 0) / LIVE_BARS;
        waveformSamplesRef.current.push(avg);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Duration counter
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        clearInterval(durationTimerRef.current!);
        audioCtx.close();
        stream.getTracks().forEach((t) => t.stop());

        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          setIsRecording(false);
          setRecordingDuration(0);
          setLiveWaveform(Array(LIVE_BARS).fill(0));
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const dur = (Date.now() - startTimeRef.current) / 1000;
        const waveform = downsampleWaveform(waveformSamplesRef.current, 50);

        setIsRecording(false);
        setRecordingDuration(0);
        setLiveWaveform(Array(LIVE_BARS).fill(0));

        if (blob.size > 0) {
          await transcribeAndSend(blob, waveform, dur);
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      audioContextRef.current = audioCtx;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      toast.error("Could not access microphone. Please check your browser permissions.");
    }
  }, [isThinking, isRecording, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    isCancelledRef.current = false;
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(durationTimerRef.current!);
    audioContextRef.current?.close();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    } else {
      setIsRecording(false);
      setRecordingDuration(0);
      setLiveWaveform(Array(40).fill(0));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(durationTimerRef.current!);
      audioContextRef.current?.close();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Receipt upload ─────────────────────────────────────────────────────────

  const uploadReceipt = useCallback(
    async (file: File) => {
      if (isThinking) return;
      onSend?.();

      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const imageUrl = URL.createObjectURL(file);
      const msgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          type: "user",
          content: "",
          receipt: { imageUrl, fileName: file.name },
          timestamp: new Date(),
        },
      ]);
      setScanningMsgId(msgId);
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        setThinkingStep(step);
      }, 1800);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-receipt`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            content: response.text ?? "",
            response,
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);
        console.error("[uploadReceipt]", err);
        const errText =
          "Couldn't extract expenses from that image. Please try a clearer, well-lit photo.";
        toast.error(errText);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            content: errText,
            response: { intent: "conversation", text: errText },
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [isThinking, chatMode, stopThinking, onSend]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadReceipt(file);
      e.target.value = "";
    },
    [uploadReceipt]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      onSend?.();

      // Animate out welcome screen, switch to chat
      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        type: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) throw new Error("Not authenticated");

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: trimmed }),
        });

        stopThinking();
        setIsThinking(false);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: response.text ?? "",
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        console.error("sage-chat error:", err);
        toast.error("Something went wrong. Please try again.");

        const errMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: "Sorry, I ran into an issue. Please try again!",
          response: { intent: "conversation", text: "Sorry, I ran into an issue. Please try again!" },
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [isThinking, chatMode, stopThinking, onSend]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setIsThinking(false);
    setLastMsgVisible(false);
    setChatMode(false);
  };

  const getMessageCopyText = (msg: Message): string => {
    if (!msg.response) return msg.content;
    const r = msg.response;
    const parts: string[] = [];
    if (r.title) parts.push(r.title);
    if (r.text) parts.push(r.text);
    if (r.expenses?.length) {
      parts.push(
        r.expenses.map((e) => `${e.description} (${e.category}): ₹${e.amount}`).join("\n")
      );
    }
    if (r.loggedExpenses?.length) {
      parts.push(r.loggedExpenses.map((e) => `${e.description}: ₹${e.amount}`).join("\n"));
    }
    return parts.join("\n\n");
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── WELCOME SCREEN ───────────────────────────────────────────── */}
      {!chatMode && (
        <div
          className="sage-mesh-bg flex flex-col items-center justify-center h-full px-5 text-center"
          style={{
            opacity: welcomeLeaving ? 0 : 1,
            transform: welcomeLeaving ? "scale(0.97) translateY(-8px)" : "scale(1) translateY(0)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
          }}
        >
          <div className="flex flex-col items-center w-full max-w-xl">

            {/* Logo */}
            <div className="mb-4 sage-fi-1">
              <CloverIcon size={52} />
            </div>

            {/* Greeting */}
            <p className="text-sm font-medium text-muted-foreground mb-3 tracking-wide sage-fi-2">
              {greeting}, {userName}
            </p>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 sage-fi-3 leading-tight">
              What can I help you with?
            </h2>

            {/* Tall input */}
            <form
              onSubmit={handleSubmit}
              className="w-full sage-fi-4 mb-5"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            >
              {/* Outer wrapper = the glowing border (1px padding reveals gradient as border) */}
              <div
                ref={glowWrapRef}
                className="rounded-2xl p-px shadow-sm sage-border-idle"
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  el.style.background = `radial-gradient(500px circle at ${x}% ${y}%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.18) 100%)`;
                  el.style.animation = "none";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.animation = "";
                }}
              >
                {/* Inner = actual card background */}
                <div className="relative bg-background rounded-[calc(1rem-1px)] focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your spending, log an expense, or get insights…"
                    rows={3}
                    className="w-full px-5 pt-4 pb-16 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 resize-none text-sm leading-relaxed"
                  />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    {/* Left: attach + mic */}
                    <div className="flex items-center gap-1">
                      {/* Attach menu */}
                      <div className="relative" ref={attachMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowAttachMenu((v) => !v)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                            showAttachMenu
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
                          )}
                          title="Attach receipt"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {showAttachMenu && (
                          <div className="absolute bottom-9 left-0 bg-popover border rounded-xl shadow-lg py-1 min-w-[180px] z-50 sage-attach-menu">
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.click();
                                setShowAttachMenu(false);
                              }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors text-left rounded-lg"
                            >
                              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <LucideImage className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground text-xs">Receipt / Screenshot</div>
                                <div className="text-[10px] text-muted-foreground">JPG, PNG, WebP</div>
                              </div>
                            </button>
                            <button
                              type="button"
                              disabled
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs opacity-45 cursor-not-allowed text-left rounded-lg"
                            >
                              <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                <FileText className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground text-xs">PDF Receipt</div>
                                <div className="text-[10px] text-muted-foreground">Coming soon</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Mic — switches to chat mode then starts recording */}
                      {!input.trim() && (
                        <button
                          type="button"
                          onClick={async () => {
                            setWelcomeLeaving(true);
                            await new Promise((r) => setTimeout(r, 260));
                            setChatMode(true);
                            setWelcomeLeaving(false);
                            setTimeout(() => startRecording(), 80);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                          title="Send voice message"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Right: send */}
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground disabled:opacity-30 transition-all active:scale-95"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>{/* inner card */}
              </div>{/* glow border wrapper */}
            </form>

            {/* Quick questions */}
            <div className="w-full sage-fi-5">
              <div
                className="flex gap-2.5 overflow-x-auto pb-1 sage-hscroll"
                style={{ scrollbarWidth: "none" }}
              >
                {QUICK_QUESTIONS.map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.text)}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-background text-sm text-muted-foreground whitespace-nowrap hover:border-primary/40 hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {q.text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT VIEW ────────────────────────────────────────────────── */}
      {chatMode && (
        <div className="flex flex-col h-full sage-chat-enter">

          {/* Slim top bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <CloverIcon size={18} />
              <span className="text-sm font-semibold">Sage</span>
            </div>
            <button
              onClick={resetChat}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
              title="New chat"
            >
              <RotateCcw className="h-3 w-3" />
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, idx) => {
                const isLastAssistant =
                  msg.type === "assistant" && idx === messages.length - 1;
                const visible = isLastAssistant ? lastMsgVisible : true;

                return (
                  <div key={msg.id}>
                    {msg.type === "user" ? (
                      <div className="flex justify-end sage-msg-in">
                        {msg.receipt ? (
                          /* ── Receipt / image upload bubble ── */
                          <ReceiptBubble {...msg.receipt} isScanning={scanningMsgId === msg.id} />
                        ) : msg.voice ? (
                          /* ── Voice message bubble ── */
                          <div className="flex flex-col items-end gap-1.5">
                            <VoiceMessageBubble {...msg.voice} />
                            {msg.content && (
                              <p className="text-xs text-muted-foreground/60 italic max-w-[260px] text-right px-1 leading-relaxed">
                                "{msg.content}"
                              </p>
                            )}
                          </div>
                        ) : (
                          /* ── Text message bubble ── */
                          <div className="bg-muted text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                            {msg.content}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 sage-msg-in">
                        <div className="mt-0.5 shrink-0">
                          <CloverIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {msg.response ? (
                            <AssistantResponse
                              response={msg.response}
                              visible={visible}
                              onUndoLoggedExpenses={deleteExpense ? onUndoLoggedExpenses : undefined}
                            />
                          ) : (
                            <div
                              style={{
                                opacity: visible ? 1 : 0,
                                transition: "opacity 0.3s ease",
                              }}
                              className="text-sm leading-relaxed"
                            >
                              {msg.content}
                            </div>
                          )}

                          {/* Message actions */}
                          {visible && (
                            <div className="flex items-center gap-0.5 mt-3">
                              <CopyButton text={getMessageCopyText(msg)} />
                              <Tip label="Helpful">
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                              </Tip>
                              <Tip label="Not helpful">
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </Tip>

                              {/* Export icons — only for responses with expense data */}
                              {msg.response && (() => {
                                const r = msg.response!;
                                const expenses: DbExpense[] =
                                  r.expenses ??
                                  (r.loggedExpenses ?? []).map((e) => ({
                                    date: new Date().toISOString(),
                                    description: e.description,
                                    category: e.category,
                                    amount: e.amount,
                                  }));
                                if (!expenses.length) return null;
                                return (
                                  <InlineExportButtons
                                    expenses={expenses}
                                    title={r.title}
                                    totalAmount={r.totalAmount}
                                  />
                                );
                              })()}

                              <span className="ml-auto text-xs text-muted-foreground/60">
                                {msg.timestamp.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isThinking && <ThinkingIndicator step={thinkingStep} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom input bar */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t bg-background sage-input-in">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">

              {isRecording ? (
                /* ── Recording mode ── */
                <>
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-muted transition-colors text-muted-foreground shrink-0"
                    title="Cancel recording"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Live waveform pill */}
                  <div className="flex-1 flex items-center gap-2.5 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm tabular-nums text-red-600 dark:text-red-400 font-medium w-8 shrink-0">
                      {formatDuration(recordingDuration)}
                    </span>
                    <div className="flex-1 flex items-center gap-[2px] h-6 overflow-hidden">
                      {liveWaveform.map((v, i) => (
                        <div
                          key={i}
                          className="shrink-0 rounded-full bg-red-500/70"
                          style={{
                            width: "3px",
                            height: `${Math.max(2, v * 22)}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stop → send */}
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shrink-0 transition-colors shadow-sm active:scale-95"
                    title="Stop and send"
                  >
                    <Square className="h-3.5 w-3.5" style={{ fill: "white" }} />
                  </button>
                </>
              ) : (
                /* ── Normal input mode ── */
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center gap-2 w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                >
                  {/* ── Attach menu ── */}
                  <div className="relative shrink-0" ref={attachMenuRef2}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu((v) => !v)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full border transition-colors text-muted-foreground",
                        showAttachMenu
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "hover:bg-muted"
                      )}
                      title="Attach receipt or image"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* Dropdown */}
                    {showAttachMenu && (
                      <div className="absolute bottom-10 left-0 bg-popover border rounded-xl shadow-lg py-1 min-w-[180px] z-50 sage-attach-menu">
                        {/* Receipt image */}
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAttachMenu(false);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors text-left rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <LucideImage className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">Receipt / Screenshot</div>
                            <div className="text-[10px] text-muted-foreground">JPG, PNG, WebP</div>
                          </div>
                        </button>

                        {/* PDF — coming soon */}
                        <button
                          type="button"
                          disabled
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs opacity-45 cursor-not-allowed text-left rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                            <FileText className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">PDF Receipt</div>
                            <div className="text-[10px] text-muted-foreground">Coming soon</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={chatInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about your spending…"
                    disabled={isThinking}
                    className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:opacity-50 transition-all"
                  />
                  {/* Mic button — shows only when input is empty */}
                  {!input.trim() && (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isThinking}
                      className="w-9 h-9 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0 disabled:opacity-40 active:scale-95"
                      title="Send voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  )}
                  {/* Send button — shows only when there's text */}
                  {input.trim() && (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isThinking}
                      className="rounded-full shrink-0 w-9 h-9 disabled:opacity-30"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </form>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground/50 mt-2">
              {isRecording ? "Tap the red square to send · X to cancel" : "Sage can make mistakes. Double-check important numbers."}
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input — always mounted so it works from both welcome & chat screens */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Animations & styles ───────────────────────────────────────── */}
      <style>{`
        /* Cursor pointer on every interactive element */
        button, [role="button"], [role="tab"], [role="checkbox"],
        input[type="file"], input[type="submit"], input[type="button"],
        select, label[for], a {
          cursor: pointer !important;
        }

        /* Gradient background */
        .sage-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.05) 0%, transparent 60%);
        }
        .dark .sage-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.08) 0%, transparent 60%);
        }

        /* Welcome stagger */
        .sage-fi-1 { animation: sageFadeUp 0.5s ease both 0.00s; }
        .sage-fi-2 { animation: sageFadeUp 0.5s ease both 0.08s; }
        .sage-fi-3 { animation: sageFadeUp 0.5s ease both 0.16s; }
        .sage-fi-4 { animation: sageFadeUp 0.5s ease both 0.24s; }
        .sage-fi-5 { animation: sageFadeUp 0.5s ease both 0.34s; }

        @keyframes sageFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Hide scrollbar */
        .sage-hscroll::-webkit-scrollbar { display: none; }

        /* Clover spin */
        @keyframes sageSpin { to { transform: rotate(360deg); } }

        /* Loading text fade */
        .sage-text-fade { animation: sageTextFade 0.35s ease both; }
        @keyframes sageTextFade {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Chat view enter */
        .sage-chat-enter { animation: sageFadeIn 0.28s ease both; }
        @keyframes sageFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Messages */
        .sage-msg-in { animation: sageMsgIn 0.32s ease both; }
        @keyframes sageMsgIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Bottom input slides in */
        .sage-input-in { animation: sageInputIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both 0.06s; }
        @keyframes sageInputIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Table rows stagger */
        .sage-row-in {
          animation: sageRowIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Category bars stagger */
        .sage-bar-in {
          animation: sageBarIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageBarIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Logged expense cards */
        .sage-logged-in {
          animation: sageLoggedIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageLoggedIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* Metric cards */
        .sage-metric-in {
          animation: sageMetricIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageMetricIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Voice bubble pop-in */
        .sage-voice-bubble {
          animation: sageVoiceIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageVoiceIn {
          from { opacity: 0; transform: scale(0.88) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Recording waveform bars — live height transitions */
        .sage-rec-bar { transition: height 60ms linear; }

        /* Receipt image bubble pop-in */
        .sage-receipt-in {
          animation: sageReceiptIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageReceiptIn {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Scanning sweep line */
        .sage-scan-sweep {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #34d399 30%, #6ee7b7 50%, #34d399 70%, transparent 100%);
          box-shadow: 0 0 8px 2px rgba(52,211,153,0.55);
          animation: sageScanSweep 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          position: absolute;
          left: 12px; right: 12px;
        }
        @keyframes sageScanSweep {
          0%   { top: 8%;  opacity: 0.7; }
          10%  { opacity: 1; }
          45%  { top: 85%; opacity: 1; }
          55%  { top: 85%; opacity: 1; }
          90%  { top: 8%;  opacity: 1; }
          100% { top: 8%;  opacity: 0.7; }
        }

        /* Pulsing text / icon during scan */
        .sage-scan-pulse {
          animation: sageScanPulse 1.4s ease-in-out infinite;
        }
        @keyframes sageScanPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        /* ── Fullscreen receipt modal ── */
        .sage-fs-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          animation: sageFsBackdropIn 0.28s ease both;
        }
        .sage-fs-out {
          animation: sageFsBackdropOut 0.28s ease both;
        }
        @keyframes sageFsBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sageFsBackdropOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .sage-fs-content {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          animation: sageFsZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .sage-fs-content-out {
          animation: sageFsZoomOut 0.26s cubic-bezier(0.55, 0, 0.45, 1) both;
        }
        @keyframes sageFsZoomIn {
          from { opacity: 0; transform: scale(0.78); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sageFsZoomOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.82); }
        }

        /* Attach menu slide-up */
        .sage-attach-menu {
          animation: sageAttachIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: bottom left;
        }
        @keyframes sageAttachIn {
          from { opacity: 0; transform: scale(0.93) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Main input border glow ── */

        /* Idle: visible uniform border, pulses softly */
        .sage-border-idle {
          background: rgba(255,255,255,0.22);
          animation: sageBorderPulse 4s ease-in-out infinite;
        }
        @keyframes sageBorderPulse {
          0%, 100% { background: rgba(255,255,255,0.18); }
          50%       { background: rgba(255,255,255,0.32); }
        }
      `}</style>
    </div>
  );
}
