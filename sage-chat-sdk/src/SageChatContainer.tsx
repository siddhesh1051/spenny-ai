import React, { useMemo, useState } from "react";
import type { CategoryItem, DbExpense, MetricItem, SageResponse, UiBlock } from "./types";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Sector,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export type SageChatContainerMode = "light" | "dark";

export type SageChatContainerProps = {
  response: SageResponse;
  mode?: SageChatContainerMode;
  className?: string;
  currencySymbol?: string;
};

const PIE_COLORS = [
  "var(--chart-1, #10b981)",
  "var(--chart-2, #3b82f6)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #a855f7)",
  "var(--chart-5, #ef4444)",
  "var(--primary, #111827)",
  "var(--muted-foreground, #64748b)",
];

function detectMode(): SageChatContainerMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function formatMoney(amount: number, currencySymbol: string): string {
  return `${currencySymbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function Surface({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-muted/35 dark:bg-muted/20 shadow-sm">
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function ChartTooltipBox({
  active,
  payload,
  label,
  currencySymbol,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: any }>;
  label?: string;
  currencySymbol: string;
}) {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  const name = label ?? first?.name ?? first?.payload?.name ?? "";
  const value = typeof first?.value === "number" ? first.value : undefined;
  return (
    <div className="p-2.5 rounded-2xl bg-background/90 dark:bg-background/80 backdrop-blur border border-border/40 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{String(name)}</p>
      {value !== undefined && (
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {formatMoney(value, currencySymbol)}
        </p>
      )}
    </div>
  );
}

function buildMonthlySeries(expenses: DbExpense[]) {
  const buckets = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, amount]) => {
      const [yStr, mStr] = key.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const label =
        Number.isFinite(y) && Number.isFinite(m)
          ? new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" })
          : key;
      return { month: label, amount };
    });
}

function buildDailySeries(expenses: DbExpense[]) {
  const buckets = new Map<string, number>();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, amount]) => ({
      day: new Date(day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      amount,
    }));
}

function MetricsGrid({ metrics }: { metrics: MetricItem[] }) {
  if (!metrics.length) return null;
  return (
    <div
      className={
        metrics.length === 1
          ? "grid grid-cols-1 gap-3 mb-4"
          : metrics.length === 2
          ? "grid grid-cols-1 md:grid-cols-2 gap-3 mb-4"
          : "grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"
      }
    >
      {metrics.map((m, i) => (
        <div key={i} className="rounded-2xl border border-border/40 bg-background/60 p-3.5 shadow-sm flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">{m.label}</div>
          <div className="font-bold text-base leading-tight">{m.value}</div>
          {m.change && (
            <div className={m.positive ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-orange-500 dark:text-orange-400"}>
              {m.change}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdown({
  breakdown,
  total,
  currencySymbol,
}: {
  breakdown: CategoryItem[];
  total: number;
  currencySymbol: string;
}) {
  if (!breakdown.length) return null;
  return (
    <div className="space-y-3">
      {breakdown.map((item) => (
        <div key={item.category}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{item.category}</span>
              <span className="text-xs text-muted-foreground">{item.count} items</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                {formatMoney(item.total, currencySymbol)}
              </span>
              <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">{item.percentage}%</span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percentage}%` }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>Total</span>
        <span className="font-semibold text-foreground">{formatMoney(total, currencySymbol)}</span>
      </div>
    </div>
  );
}

function ExpensesTable({
  expenses,
  currencySymbol,
}: {
  expenses: DbExpense[];
  currencySymbol: string;
}) {
  if (!expenses.length) return null;
  return (
    <div className="rounded-2xl bg-background overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Description
            </th>
            <th className="text-left px-2 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Category
            </th>
            <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Amount
            </th>
            <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id} className="border-t border-border/20">
              <td className="px-4 py-2.5 font-medium">{e.description}</td>
              <td className="px-2 py-2.5 text-xs capitalize text-muted-foreground">{e.category}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {formatMoney(e.amount, currencySymbol)}
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SageChatContainer({
  response,
  mode: forcedMode,
  className,
  currencySymbol = "₹",
}: SageChatContainerProps) {
  const mode = forcedMode ?? detectMode();

  const tickColor = mode === "dark" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)";
  const gridStroke = mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const hoverCursorFill = mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const hoverLineStroke = mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";

  const blocks = useMemo(() => new Set<UiBlock>(response.uiPlan?.blocks ?? []), [response.uiPlan]);

  const expenses = response.expenses ?? [];
  const breakdown = response.categoryBreakdown ?? [];
  const total = response.totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0);

  const monthlySeries = useMemo(() => buildMonthlySeries(expenses), [expenses]);
  const dailySeries = useMemo(() => buildDailySeries(expenses), [expenses]);
  const pieData = useMemo(() => breakdown.map((c) => ({ name: c.category, value: c.total })), [breakdown]);

  const [activePieIndex, setActivePieIndex] = useState(0);

  const hasBlocks = blocks.size > 0;

  const show = (b: UiBlock, fallback: boolean) => (hasBlocks ? blocks.has(b) : fallback);

  if (response.intent === "conversation") {
    return (
      <div className={className}>
        <div className="max-w-2xl mx-auto">
          {response.title && <h2 className="text-lg font-semibold mb-2">{response.title}</h2>}
          <p className="text-sm leading-relaxed text-foreground">{response.text}</p>
        </div>
      </div>
    );
  }

  if (response.intent === "expense") {
    const logged = response.loggedExpenses ?? [];
    const showLogged = show("logged_table", logged.length > 0);
    const showText = show("insight_text", true);
    const loggedTotal = response.totalAmount ?? logged.reduce((s, e) => s + e.amount, 0);

    return (
      <div className={className}>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl border border-border/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {showText ? (response.text || "Expenses logged successfully.") : "Expenses logged successfully."}
            </div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {formatMoney(loggedTotal, currencySymbol)}
            </div>
          </div>

          {showLogged && logged.length > 0 && (
            <ExpensesTable
              currencySymbol={currencySymbol}
              expenses={logged.map((e) => ({
                id: e.id ?? e.description,
                date: new Date().toISOString(),
                description: e.description,
                category: e.category,
                amount: e.amount,
              }))}
            />
          )}
        </div>
      </div>
    );
  }

  if (response.intent === "insights") {
    const showMetrics = show("metrics", true);
    const showBreakdown = show("category_breakdown", true);
    const showPie = show("category_pie", false);
    const showText = show("insight_text", true);

    return (
      <div className={className}>
        <div className="max-w-4xl mx-auto space-y-4">
          {response.title && <h2 className="text-lg font-semibold mb-1">{response.title}</h2>}
          {showMetrics && response.metrics && <MetricsGrid metrics={response.metrics} />}

          {showBreakdown && breakdown.length > 0 && (
            <Surface title="Spending breakdown" subtitle="Last 90 days">
              <CategoryBreakdown currencySymbol={currencySymbol} breakdown={breakdown} total={breakdown.reduce((s, c) => s + c.total, 0)} />
            </Surface>
          )}

          {showPie && breakdown.length > 0 && (
            <Surface title="Category share" subtitle="Distribution">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip content={<ChartTooltipBox currencySymbol={currencySymbol} />} />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="transparent"
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </Surface>
          )}

          {showText && response.text && (
            <div className="rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-sm leading-relaxed">
              {response.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // intent === "query"
  const hasExpenses = expenses.length > 0;
  const hasBreakdown = breakdown.length > 0;

  if (!hasExpenses) {
    return (
      <div className={className}>
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <h2 className="text-lg font-semibold">{response.title ?? "No results"}</h2>
          <p className="text-sm text-muted-foreground">{response.text}</p>
        </div>
      </div>
    );
  }

  const showTable = show("table", true);
  const showMonthly = show("monthly_spend", true);
  const showDaily = show("daily_trend", false);
  const showBreakdown = show("category_breakdown", hasBreakdown);
  const showPie = show("category_pie", false);
  const showText = show("insight_text", !!response.text);

  return (
    <div className={className}>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{response.title ?? "Your expenses"}</h2>
            {response.filters && (
              <p className="text-xs text-muted-foreground mt-1">
                {response.filters.startDate && response.filters.endDate
                  ? `From ${response.filters.startDate} to ${response.filters.endDate}`
                  : response.filters.startDate
                  ? `Since ${response.filters.startDate}`
                  : response.filters.endDate
                  ? `Until ${response.filters.endDate}`
                  : "All time"}
                {response.filters.category ? ` · Category: ${response.filters.category}` : ""}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">
              {expenses.length} transaction{expenses.length !== 1 ? "s" : ""}
            </div>
            <div className="font-semibold">Total: {formatMoney(total, currencySymbol)}</div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            {showTable && (
              <section className="rounded-3xl bg-muted/35 dark:bg-muted/20 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Expenses
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {expenses.length} txn{expenses.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="px-2 pb-2">
                  <ExpensesTable currencySymbol={currencySymbol} expenses={expenses} />
                </div>
              </section>
            )}

            {(showMonthly || showDaily) && (
              <div className="grid gap-5 md:grid-cols-2">
                {showMonthly && (
                  <Surface title="Monthly spend" subtitle="Aggregated by month">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySeries} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sageBarFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.2} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="6 6" />
                          <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                          <Tooltip content={<ChartTooltipBox currencySymbol={currencySymbol} />} cursor={{ fill: hoverCursorFill }} />
                          <Bar
                            dataKey="amount"
                            fill="url(#sageBarFill)"
                            radius={[10, 10, 10, 10]}
                            stroke="transparent"
                            activeBar={{ fill: "url(#sageBarFill)", stroke: "transparent", opacity: 1 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>
                )}

                {showDaily && (
                  <Surface title="Daily trend" subtitle="Aggregated by day">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailySeries} margin={{ left: 4, right: 10, top: 8, bottom: 0 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="6 6" />
                          <XAxis dataKey="day" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                          <Tooltip content={<ChartTooltipBox currencySymbol={currencySymbol} />} cursor={{ stroke: hoverLineStroke, strokeWidth: 1 }} />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="var(--foreground)"
                            strokeOpacity={0.85}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4, fill: "var(--background)", stroke: "var(--foreground)", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>
                )}
              </div>
            )}
          </div>

          {(showBreakdown || showPie) && (
            <div className="space-y-5">
              {showBreakdown && hasBreakdown && (
                <Surface title="By category" subtitle="Share of total spend">
                  <CategoryBreakdown currencySymbol={currencySymbol} breakdown={breakdown} total={total} />
                </Surface>
              )}

              {showPie && hasBreakdown && (
                <Surface title="Category share" subtitle="Distribution">
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Tooltip content={<ChartTooltipBox currencySymbol={currencySymbol} />} />
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          activeIndex={activePieIndex}
                          onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                          activeShape={(props: any) => (
                            <Sector
                              cx={props.cx}
                              cy={props.cy}
                              innerRadius={props.innerRadius}
                              outerRadius={props.outerRadius + 4}
                              startAngle={props.startAngle}
                              endAngle={props.endAngle}
                              fill={props.fill}
                              stroke="transparent"
                            />
                          )}
                          innerRadius={52}
                          outerRadius={86}
                          paddingAngle={3}
                          stroke="transparent"
                        >
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </Surface>
              )}
            </div>
          )}
        </div>

        {showText && response.text && (
          <div className="rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            {response.text}
          </div>
        )}
      </div>
    </div>
  );
}

