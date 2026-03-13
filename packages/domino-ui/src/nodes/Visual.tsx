import { useState } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector,
  AreaChart, Area,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { UiVisualNode } from "../types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

type TipItem = {
  name?: string | number;
  value?: number;
  color?: string;
  payload?: { share?: number; fill?: string };
};

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TipItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div style={{
      minWidth: "8rem",
      borderRadius: "0.5rem",
      border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
      background: "var(--background)",
      padding: "0.375rem 0.625rem",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      fontSize: "0.75rem",
      color: "var(--foreground)",
      display: "grid",
      gap: "0.375rem",
    }}>
      {label != null && (
        <div style={{ fontWeight: 600 }}>{label}</div>
      )}
      <div style={{ display: "grid", gap: "0.25rem" }}>
        {payload.map((item, i) => {
          const dotColor = item.color || item.payload?.fill || "var(--chart-1)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
              <span style={{
                width: "0.625rem",
                height: "0.625rem",
                borderRadius: "2px",
                flexShrink: 0,
                background: dotColor,
              }} />
              <div style={{ display: "flex", flex: 1, justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <span style={{ color: "var(--muted-foreground)", textTransform: "capitalize" }}>
                  {item.name}
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {item.value?.toLocaleString() ?? ""}
                  {item.payload?.share != null && (
                    <span style={{ fontWeight: 400, color: "var(--muted-foreground)", marginLeft: "0.25rem" }}>
                      ({item.payload.share}%)
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderActiveShape(props: unknown) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as {
    cx?: number; cy?: number; innerRadius?: number; outerRadius?: number;
    startAngle?: number; endAngle?: number; fill?: string;
  };
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius ?? 0) + 4}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

export function Visual({ node }: { node: UiVisualNode }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!node.points?.length) return null;

  const isPie = node.variant === "pie" || (node.variant as string) === "donut";
  const isArea = node.variant === "area";
  const data = node.points;

  return (
    <div style={{
      marginTop: "1rem",
      marginBottom: "1rem",
      borderRadius: "0.75rem",
      border: "1px solid var(--border)",
      background: "var(--card)",
      padding: "0.875rem",
    }}>
      <div style={{ height: "14rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          {isPie ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                stroke="var(--background)"
                strokeWidth={2}
                {...(activeIndex != null ? { activeIndex } : {})}
                activeShape={renderActiveShape}
                onMouseEnter={(_: unknown, idx: number) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.label}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                  />
                ))}
              </Pie>
              <Tooltip content={(props) => <ChartTip {...props} />} />
            </PieChart>
          ) : isArea ? (
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.696 0.17 162.48)" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="oklch(0.696 0.17 162.48)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="color-mix(in srgb, var(--muted-foreground) 12%, transparent)"
                vertical={false}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
                tickCount={5}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                width={48}
              />
              <Tooltip content={(props) => <ChartTip {...props} />} cursor={{ stroke: "oklch(0.696 0.17 162.48)", strokeWidth: 1, strokeDasharray: "4 2" }} />
              <Area
                dataKey="value"
                type="natural"
                fill="url(#areaFill)"
                fillOpacity={1}
                stroke="oklch(0.696 0.17 162.48)"
                strokeWidth={2}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              onMouseLeave={() => setActiveIndex(null)}>
              <CartesianGrid stroke="color-mix(in srgb, var(--muted-foreground) 12%, transparent)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                width={48}
              />
              <Tooltip content={(props) => <ChartTip {...props} />} cursor={false} />
              <Bar dataKey="value" radius={[4, 4, 2, 2]} maxBarSize={40}
                onMouseEnter={(_: unknown, idx: number) => setActiveIndex(idx)}>
                {data.map((entry, index) => (
                  <Cell key={`bar-${entry.label}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.35} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend — pie chart only */}
      {isPie && (
        <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem 1rem", justifyContent: "center" }}>
          {data.map((p, i) => {
            const isActive = activeIndex === i;
            return (
              <button
                key={p.label}
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  fontSize: "0.75rem", background: "none", border: "none",
                  cursor: "default", padding: 0,
                  opacity: activeIndex === null || isActive ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span style={{
                  display: "inline-block", width: "0.625rem", height: "0.625rem",
                  borderRadius: "50%", flexShrink: 0,
                  background: COLORS[i % COLORS.length],
                  transform: isActive ? "scale(1.35)" : "scale(1)",
                  transition: "transform 0.15s",
                }} />
                <span style={{
                  textTransform: "capitalize", fontWeight: 500,
                  color: isActive ? COLORS[i % COLORS.length] : "var(--muted-foreground)",
                  transition: "color 0.15s",
                }}>
                  {p.label}
                </span>
                {p.share != null && (
                  <span style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", opacity: 0.6 }}>
                    {p.share}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
