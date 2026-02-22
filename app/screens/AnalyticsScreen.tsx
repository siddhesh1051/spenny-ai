import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { PieChart, BarChart } from "react-native-gifted-charts";
import { useTheme } from "../context/ThemeContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Same chart colors as the web app
const CHART_COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#AF19FF",
  "#FF1919",
  "#36B0FF",
];

const BAR_COLOR = "#a1a1aa"; // zinc-400 — subtle, matches web

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface AnalyticsScreenProps {
  expenses: Expense[];
  isLoading: boolean;
}

function StatRow({ title, value }: { title: string; value: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.statCard}>
      <View style={styles.statRow}>
        <Text style={[styles.statTitle, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>{title}</Text>
        <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      </View>
    </Card>
  );
}

export default function AnalyticsScreen({ expenses, isLoading }: AnalyticsScreenProps) {
  const { colors, isDark } = useTheme();

  const analytics = useMemo(() => {
    const totalExpense = expenses.reduce((a, e) => a + e.amount, 0);
    const totalTransactions = expenses.length;

    const dailySpend: Record<string, number> = {};
    const monthlySpend: Record<string, number> = {};
    const categorySpend: Record<string, number> = {};

    expenses.forEach((e) => {
      const day = new Date(e.date).toLocaleDateString();
      const month = new Date(e.date).toLocaleString("en-US", { month: "short", year: "numeric" });
      const cat = e.category || "other";

      dailySpend[day] = (dailySpend[day] || 0) + e.amount;
      monthlySpend[month] = (monthlySpend[month] || 0) + e.amount;
      categorySpend[cat] = (categorySpend[cat] || 0) + e.amount;
    });

    const avgDaily = Object.keys(dailySpend).length > 0
      ? totalExpense / Object.keys(dailySpend).length
      : 0;

    const pieData = Object.entries(categorySpend)
      .map(([name, value], i) => ({
        value,
        label: name,
        color: CHART_COLORS[i % CHART_COLORS.length],
        text: name,
      }))
      .sort((a, b) => b.value - a.value);

    const topCategories = Object.entries(categorySpend)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const barData = Object.entries(monthlySpend)
      .map(([month, value]) => ({ label: month.split(" ")[0], value, frontColor: "#7c3aed" }))
      .sort((a, b) => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months.indexOf(a.label) - months.indexOf(b.label);
      })
      .slice(-6);

    return { totalExpense, totalTransactions, avgDaily, pieData, topCategories, barData };
  }, [expenses]);

  if (isLoading && expenses.length === 0) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Skeleton height={110} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton height={200} borderRadius={12} style={{ marginBottom: 16 }} />
        <Skeleton height={200} borderRadius={12} />
      </ScrollView>
    );
  }

  if (expenses.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No data yet</Text>
        <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
          Add some expenses to see your analytics.
        </Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - 64;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Stat Rows */}
      <View style={styles.statsGroup}>
        <StatRow title="Total Expenses" value={`₹${analytics.totalExpense.toFixed(0)}`} />
        <StatRow title="Avg Daily Spend" value={`₹${analytics.avgDaily.toFixed(0)}`} />
        <StatRow title="Transactions" value={String(analytics.totalTransactions)} />
      </View>

      {/* Top Categories */}
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topCategories.map((cat, i) => {
            const pct = analytics.totalExpense > 0 ? (cat.value / analytics.totalExpense) * 100 : 0;
            return (
              <View key={cat.name} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <View
                    style={[styles.categoryDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]}
                  />
                  <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <Text style={[styles.categoryAmount, { color: colors.textMuted }]}>
                    ₹{cat.value.toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </CardContent>
      </Card>

      {/* Pie Chart */}
      {analytics.pieData.length > 0 && (
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent style={{ alignItems: "center" }}>
            <PieChart
              data={analytics.pieData}
              donut
              radius={90}
              innerRadius={55}
              innerCircleColor={colors.card}
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Total</Text>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                    ₹{analytics.totalExpense.toFixed(0)}
                  </Text>
                </View>
              )}
              labelsPosition="outward"
              showText={false}
              strokeWidth={2}
              strokeColor={colors.background}
            />
            {/* Legend */}
            <View style={styles.legend}>
              {analytics.pieData.map((item, i) => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {/* Bar Chart */}
      {analytics.barData.length > 0 && (
        <Card style={{ ...(styles.card as object), marginBottom: 32 } as any}>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={analytics.barData}
              width={chartWidth}
              height={180}
              barWidth={Math.max(20, Math.min(44, chartWidth / (analytics.barData.length * 1.8)))}
              spacing={Math.max(12, chartWidth / (analytics.barData.length * 3))}
              noOfSections={4}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              hideRules={false}
              rulesColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
              isAnimated
              animationDuration={500}
              frontColor={BAR_COLOR}
              barBorderRadius={3}
              maxValue={
                Math.ceil(
                  Math.max(...analytics.barData.map((d) => d.value)) * 1.2
                )
              }
            />
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { alignItems: "center", justifyContent: "center" },
  statsGroup: { gap: 6, marginBottom: 16 },
  statCard: { marginBottom: 0, paddingVertical: 12, paddingHorizontal: 16 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  statTitle: { fontSize: 14 },
  statValue: { fontSize: 15, fontWeight: "700" },
  card: { marginBottom: 16 },
  categoryRow: { marginBottom: 14 },
  categoryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: "500", textTransform: "capitalize" },
  categoryAmount: { fontSize: 13, fontWeight: "500" },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, maxWidth: 70 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center" },
});
