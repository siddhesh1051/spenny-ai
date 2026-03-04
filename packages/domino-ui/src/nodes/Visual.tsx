import { useState } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector,
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

function ChartTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload?: { share?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{
      borderRadius: "0.5rem",
      border: "1px solid var(--border)",
      background: "var(--popover)",
      padding: "0.375rem 0.75rem",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      fontSize: "0.75rem",
      color: "var(--popover-foreground)",
    }}>
      <div style={{ fontWeight: 600, textTransform: "capitalize", marginBottom: "2px" }}>{item.name}</div>
      <div style={{ fontVariantNumeric: "tabular-nums" }}>{item.value?.toLocaleString() ?? ""}</div>
      {item.payload?.share != null && (
        <div style={{ color: "var(--muted-foreground)" }}>{item.payload.share}%</div>
      )}
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

  const isDonut = node.variant === "donut";
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
          {isDonut ? (
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
              <Tooltip content={<ChartTip />} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="color-mix(in srgb, var(--muted-foreground) 12%, transparent)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tickMargin={4}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" radius={[4, 4, 2, 2]} maxBarSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`bar-${entry.label}-${index}`}
                    fill={COLORS[index % COLORS.length]} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Custom legend — donut only */}
      {isDonut && (
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
