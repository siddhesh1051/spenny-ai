// src/SageChatContainer.tsx
import { useMemo, useState } from "react";
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
  CartesianGrid
} from "recharts";
import { jsx, jsxs } from "react/jsx-runtime";
var PIE_COLORS = [
  "var(--chart-1, #10b981)",
  "var(--chart-2, #3b82f6)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #a855f7)",
  "var(--chart-5, #ef4444)",
  "var(--primary, #111827)",
  "var(--muted-foreground, #64748b)"
];
function detectMode() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function formatMoney(amount, currencySymbol) {
  return `${currencySymbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function Surface({
  title,
  subtitle,
  children,
  right
}) {
  return /* @__PURE__ */ jsxs("section", { className: "rounded-3xl bg-muted/35 dark:bg-muted/20 shadow-sm", children: [
    /* @__PURE__ */ jsxs("div", { className: "px-4 pt-4 pb-2 flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider", children: title }),
        subtitle && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground mt-1 truncate", children: subtitle })
      ] }),
      right && /* @__PURE__ */ jsx("div", { className: "shrink-0", children: right })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "px-4 pb-4", children })
  ] });
}
function ChartTooltipBox({
  active,
  payload,
  label,
  currencySymbol
}) {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  const name = label ?? first?.name ?? first?.payload?.name ?? "";
  const value = typeof first?.value === "number" ? first.value : void 0;
  return /* @__PURE__ */ jsxs("div", { className: "p-2.5 rounded-2xl bg-background/90 dark:bg-background/80 backdrop-blur border border-border/40 shadow-lg", children: [
    /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-foreground", children: String(name) }),
    value !== void 0 && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground mt-0.5 tabular-nums", children: formatMoney(value, currencySymbol) })
  ] });
}
function buildMonthlySeries(expenses) {
  const buckets = /* @__PURE__ */ new Map();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
  }
  return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, amount]) => {
    const [yStr, mStr] = key.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const label = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" }) : key;
    return { month: label, amount };
  });
}
function buildDailySeries(expenses) {
  const buckets = /* @__PURE__ */ new Map();
  for (const e of expenses) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
  }
  return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, amount]) => ({
    day: new Date(day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    amount
  }));
}
function MetricsGrid({ metrics }) {
  if (!metrics.length) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: metrics.length === 1 ? "grid grid-cols-1 gap-3 mb-4" : metrics.length === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-3 mb-4" : "grid grid-cols-1 md:grid-cols-3 gap-3 mb-4",
      children: metrics.map((m, i) => /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-border/40 bg-background/60 p-3.5 shadow-sm flex flex-col gap-1", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground", children: m.label }),
        /* @__PURE__ */ jsx("div", { className: "font-bold text-base leading-tight", children: m.value }),
        m.change && /* @__PURE__ */ jsx("div", { className: m.positive ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-orange-500 dark:text-orange-400", children: m.change })
      ] }, i))
    }
  );
}
function CategoryBreakdown({
  breakdown,
  total,
  currencySymbol
}) {
  if (!breakdown.length) return null;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    breakdown.map((item) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-sm mb-1.5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium capitalize", children: item.category }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
            item.count,
            " items"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "font-semibold tabular-nums", children: formatMoney(item.total, currencySymbol) }),
          /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground w-7 text-right tabular-nums", children: [
            item.percentage,
            "%"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-1.5 w-full rounded-full bg-muted overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-emerald-500", style: { width: `${item.percentage}%` } }) })
    ] }, item.category)),
    /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-muted-foreground mt-1.5", children: [
      /* @__PURE__ */ jsx("span", { children: "Total" }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-foreground", children: formatMoney(total, currencySymbol) })
    ] })
  ] });
}
function ExpensesTable({
  expenses,
  currencySymbol
}) {
  if (!expenses.length) return null;
  return /* @__PURE__ */ jsx("div", { className: "rounded-2xl bg-background overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full border-collapse text-sm", children: [
    /* @__PURE__ */ jsx("thead", { className: "bg-muted/60", children: /* @__PURE__ */ jsxs("tr", { children: [
      /* @__PURE__ */ jsx("th", { className: "text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide", children: "Description" }),
      /* @__PURE__ */ jsx("th", { className: "text-left px-2 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide", children: "Category" }),
      /* @__PURE__ */ jsx("th", { className: "text-right px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide", children: "Amount" }),
      /* @__PURE__ */ jsx("th", { className: "text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide", children: "Date" })
    ] }) }),
    /* @__PURE__ */ jsx("tbody", { children: expenses.map((e) => /* @__PURE__ */ jsxs("tr", { className: "border-t border-border/20", children: [
      /* @__PURE__ */ jsx("td", { className: "px-4 py-2.5 font-medium", children: e.description }),
      /* @__PURE__ */ jsx("td", { className: "px-2 py-2.5 text-xs capitalize text-muted-foreground", children: e.category }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2.5 text-right font-semibold tabular-nums", children: formatMoney(e.amount, currencySymbol) }),
      /* @__PURE__ */ jsx("td", { className: "px-4 py-2.5 text-right text-xs text-muted-foreground", children: new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) })
    ] }, e.id)) })
  ] }) });
}
function SageChatContainer({
  response,
  mode: forcedMode,
  className,
  currencySymbol = "\u20B9"
}) {
  const mode = forcedMode ?? detectMode();
  const tickColor = mode === "dark" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)";
  const gridStroke = mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const hoverCursorFill = mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const hoverLineStroke = mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
  const blocks = useMemo(() => new Set(response.uiPlan?.blocks ?? []), [response.uiPlan]);
  const expenses = response.expenses ?? [];
  const breakdown = response.categoryBreakdown ?? [];
  const total = response.totalAmount ?? expenses.reduce((s, e) => s + e.amount, 0);
  const monthlySeries = useMemo(() => buildMonthlySeries(expenses), [expenses]);
  const dailySeries = useMemo(() => buildDailySeries(expenses), [expenses]);
  const pieData = useMemo(() => breakdown.map((c) => ({ name: c.category, value: c.total })), [breakdown]);
  const [activePieIndex, setActivePieIndex] = useState(0);
  const hasBlocks = blocks.size > 0;
  const show = (b, fallback) => hasBlocks ? blocks.has(b) : fallback;
  if (response.intent === "conversation") {
    return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsxs("div", { className: "max-w-2xl mx-auto", children: [
      response.title && /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold mb-2", children: response.title }),
      /* @__PURE__ */ jsx("p", { className: "text-sm leading-relaxed text-foreground", children: response.text })
    ] }) });
  }
  if (response.intent === "expense") {
    const logged = response.loggedExpenses ?? [];
    const showLogged = show("logged_table", logged.length > 0);
    const showText2 = show("insight_text", true);
    const loggedTotal = response.totalAmount ?? logged.reduce((s, e) => s + e.amount, 0);
    return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsxs("div", { className: "max-w-2xl mx-auto space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-border/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-medium text-emerald-800 dark:text-emerald-300", children: showText2 ? response.text || "Expenses logged successfully." : "Expenses logged successfully." }),
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold text-emerald-900 dark:text-emerald-200", children: formatMoney(loggedTotal, currencySymbol) })
      ] }),
      showLogged && logged.length > 0 && /* @__PURE__ */ jsx(
        ExpensesTable,
        {
          currencySymbol,
          expenses: logged.map((e) => ({
            id: e.id ?? e.description,
            date: (/* @__PURE__ */ new Date()).toISOString(),
            description: e.description,
            category: e.category,
            amount: e.amount
          }))
        }
      )
    ] }) });
  }
  if (response.intent === "insights") {
    const showMetrics = show("metrics", true);
    const showBreakdown2 = show("category_breakdown", true);
    const showPie2 = show("category_pie", false);
    const showText2 = show("insight_text", true);
    return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsxs("div", { className: "max-w-4xl mx-auto space-y-4", children: [
      response.title && /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold mb-1", children: response.title }),
      showMetrics && response.metrics && /* @__PURE__ */ jsx(MetricsGrid, { metrics: response.metrics }),
      showBreakdown2 && breakdown.length > 0 && /* @__PURE__ */ jsx(Surface, { title: "Spending breakdown", subtitle: "Last 90 days", children: /* @__PURE__ */ jsx(CategoryBreakdown, { currencySymbol, breakdown, total: breakdown.reduce((s, c) => s + c.total, 0) }) }),
      showPie2 && breakdown.length > 0 && /* @__PURE__ */ jsx(Surface, { title: "Category share", subtitle: "Distribution", children: /* @__PURE__ */ jsx("div", { className: "h-60", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(RechartsPieChart, { children: [
        /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(ChartTooltipBox, { currencySymbol }) }),
        /* @__PURE__ */ jsx(
          Pie,
          {
            data: pieData,
            dataKey: "value",
            nameKey: "name",
            innerRadius: 52,
            outerRadius: 86,
            paddingAngle: 3,
            stroke: "transparent",
            children: pieData.map((_, idx) => /* @__PURE__ */ jsx(Cell, { fill: PIE_COLORS[idx % PIE_COLORS.length] }, idx))
          }
        )
      ] }) }) }) }),
      showText2 && response.text && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-sm leading-relaxed", children: response.text })
    ] }) });
  }
  const hasExpenses = expenses.length > 0;
  const hasBreakdown = breakdown.length > 0;
  if (!hasExpenses) {
    return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsxs("div", { className: "max-w-2xl mx-auto text-center space-y-3", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: response.title ?? "No results" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: response.text })
    ] }) });
  }
  const showTable = show("table", true);
  const showMonthly = show("monthly_spend", true);
  const showDaily = show("daily_trend", false);
  const showBreakdown = show("category_breakdown", hasBreakdown);
  const showPie = show("category_pie", false);
  const showText = show("insight_text", !!response.text);
  return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsxs("div", { className: "max-w-5xl mx-auto space-y-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row md:items-end md:justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: response.title ?? "Your expenses" }),
        response.filters && /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: [
          response.filters.startDate && response.filters.endDate ? `From ${response.filters.startDate} to ${response.filters.endDate}` : response.filters.startDate ? `Since ${response.filters.startDate}` : response.filters.endDate ? `Until ${response.filters.endDate}` : "All time",
          response.filters.category ? ` \xB7 Category: ${response.filters.category}` : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-right text-sm", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-muted-foreground", children: [
          expenses.length,
          " transaction",
          expenses.length !== 1 ? "s" : ""
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "font-semibold", children: [
          "Total: ",
          formatMoney(total, currencySymbol)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
        showTable && /* @__PURE__ */ jsxs("section", { className: "rounded-3xl bg-muted/35 dark:bg-muted/20 shadow-sm overflow-hidden", children: [
          /* @__PURE__ */ jsxs("div", { className: "px-4 pt-4 pb-2 flex items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider", children: "Expenses" }),
            /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted-foreground", children: [
              expenses.length,
              " txn",
              expenses.length !== 1 ? "s" : ""
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "px-2 pb-2", children: /* @__PURE__ */ jsx(ExpensesTable, { currencySymbol, expenses }) })
        ] }),
        (showMonthly || showDaily) && /* @__PURE__ */ jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [
          showMonthly && /* @__PURE__ */ jsx(Surface, { title: "Monthly spend", subtitle: "Aggregated by month", children: /* @__PURE__ */ jsx("div", { className: "h-56", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(BarChart, { data: monthlySeries, margin: { left: 4, right: 4, top: 8, bottom: 0 }, children: [
            /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "sageBarFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [
              /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "var(--primary)", stopOpacity: 0.9 }),
              /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "var(--primary)", stopOpacity: 0.2 })
            ] }) }),
            /* @__PURE__ */ jsx(CartesianGrid, { stroke: gridStroke, strokeDasharray: "6 6" }),
            /* @__PURE__ */ jsx(XAxis, { dataKey: "month", tick: { fill: tickColor, fontSize: 11 }, axisLine: false, tickLine: false }),
            /* @__PURE__ */ jsx(YAxis, { tick: { fill: tickColor, fontSize: 11 }, axisLine: false, tickLine: false, width: 34 }),
            /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(ChartTooltipBox, { currencySymbol }), cursor: { fill: hoverCursorFill } }),
            /* @__PURE__ */ jsx(
              Bar,
              {
                dataKey: "amount",
                fill: "url(#sageBarFill)",
                radius: [10, 10, 10, 10],
                stroke: "transparent",
                activeBar: { fill: "url(#sageBarFill)", stroke: "transparent", opacity: 1 }
              }
            )
          ] }) }) }) }),
          showDaily && /* @__PURE__ */ jsx(Surface, { title: "Daily trend", subtitle: "Aggregated by day", children: /* @__PURE__ */ jsx("div", { className: "h-56", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(LineChart, { data: dailySeries, margin: { left: 4, right: 10, top: 8, bottom: 0 }, children: [
            /* @__PURE__ */ jsx(CartesianGrid, { stroke: gridStroke, strokeDasharray: "6 6" }),
            /* @__PURE__ */ jsx(XAxis, { dataKey: "day", tick: { fill: tickColor, fontSize: 11 }, axisLine: false, tickLine: false }),
            /* @__PURE__ */ jsx(YAxis, { tick: { fill: tickColor, fontSize: 11 }, axisLine: false, tickLine: false, width: 34 }),
            /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(ChartTooltipBox, { currencySymbol }), cursor: { stroke: hoverLineStroke, strokeWidth: 1 } }),
            /* @__PURE__ */ jsx(
              Line,
              {
                type: "monotone",
                dataKey: "amount",
                stroke: "var(--foreground)",
                strokeOpacity: 0.85,
                strokeWidth: 2.5,
                dot: false,
                activeDot: { r: 4, fill: "var(--background)", stroke: "var(--foreground)", strokeWidth: 2 }
              }
            )
          ] }) }) }) })
        ] })
      ] }),
      (showBreakdown || showPie) && /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
        showBreakdown && hasBreakdown && /* @__PURE__ */ jsx(Surface, { title: "By category", subtitle: "Share of total spend", children: /* @__PURE__ */ jsx(CategoryBreakdown, { currencySymbol, breakdown, total }) }),
        showPie && hasBreakdown && /* @__PURE__ */ jsx(Surface, { title: "Category share", subtitle: "Distribution", children: /* @__PURE__ */ jsx("div", { className: "h-60", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(RechartsPieChart, { children: [
          /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(ChartTooltipBox, { currencySymbol }) }),
          /* @__PURE__ */ jsx(
            Pie,
            {
              data: pieData,
              dataKey: "value",
              nameKey: "name",
              activeIndex: activePieIndex,
              onMouseEnter: (_, idx) => setActivePieIndex(idx),
              activeShape: (props) => /* @__PURE__ */ jsx(
                Sector,
                {
                  cx: props.cx,
                  cy: props.cy,
                  innerRadius: props.innerRadius,
                  outerRadius: props.outerRadius + 4,
                  startAngle: props.startAngle,
                  endAngle: props.endAngle,
                  fill: props.fill,
                  stroke: "transparent"
                }
              ),
              innerRadius: 52,
              outerRadius: 86,
              paddingAngle: 3,
              stroke: "transparent",
              children: pieData.map((_, idx) => /* @__PURE__ */ jsx(Cell, { fill: PIE_COLORS[idx % PIE_COLORS.length] }, idx))
            }
          )
        ] }) }) }) })
      ] })
    ] }),
    showText && response.text && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-sm leading-relaxed", children: response.text })
  ] }) });
}
export {
  SageChatContainer
};
