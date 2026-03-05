"use client";

import {
  XAxis,
  YAxis,
  Legend,
  Pie,
  Cell,
  BarChart,
  Bar,
  PieChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEffect, useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#AF19FF",
  "#FF1919",
];

interface Expense {
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function AnalyticsPage({
  expenses,
  isLoading,
}: {
  expenses: Expense[];
  isLoading: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const { formatAmount } = useCurrency();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const totalExpense = expenses.reduce(
    (acc, expense) => acc + expense.amount,
    0
  );
  const totalTransactions = expenses.length;

  const dailySpend = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date] += expense.amount;
    return acc;
  }, {} as { [key: string]: number });

  const monthlySpend = expenses.reduce((acc, expense) => {
    const month = new Date(expense.date).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += expense.amount;
    return acc;
  }, {} as { [key: string]: number });

  const averageDailySpend =
    Object.keys(dailySpend).length > 0
      ? totalExpense / Object.keys(dailySpend).length
      : 0;

  const expenseDataForPieChart = Object.entries(
    expenses.reduce((acc, expense) => {
      const category = expense.category || "other";
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += expense.amount;
      return acc;
    }, {} as { [key: string]: number })
  ).map(([name, value]) => ({ name, value }));

  const topSpendingCategories = [...expenseDataForPieChart]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const expenseDataForBarChart = Object.entries(monthlySpend)
    .map(([month, amount]) => ({
      month,
      amount,
    }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  // Limit bar chart data for mobile to last 6 months
  const limitedBarChartData = isMobile
    ? expenseDataForBarChart.slice(-6)
    : expenseDataForBarChart;

  const pieChartConfig = {
    value: {
      label: "Amount",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const barChartConfig = {
    amount: {
      label: "Amount",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <div>
      {expenses.length === 0 ? (
        isLoading ? (
          <div className="grid gap-4 md:gap-6">
            <div className="grid gap-4 md:gap-6 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32 mb-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-40 mb-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-40 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            No data to display. Add some expenses first.
          </p>
        )
      ) : (
        <div className="grid gap-4 md:gap-6">
          <div className="grid gap-4 md:gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">
                  {formatAmount(totalExpense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Daily Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">
                  {formatAmount(averageDailySpend)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">
                  {totalTransactions}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Top Spending Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topSpendingCategories.map((category) => (
                  <div key={category.name} className="space-y-1">
                    <div className="flex justify-between">
                      <span>{category.name}</span>
                      <span>{formatAmount(category.value)}</span>
                    </div>
                    <Progress
                      value={(category.value / totalExpense) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={pieChartConfig}
                  className="aspect-auto h-[300px] w-full"
                >
                  <PieChart>
                    <Pie
                      data={expenseDataForPieChart}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      innerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      isAnimationActive={true}
                    >
                      {expenseDataForPieChart.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={barChartConfig}
                  className={isMobile ? "aspect-auto h-[200px] w-full" : "aspect-auto h-[300px] w-full"}
                >
                  <BarChart
                    data={limitedBarChartData}
                    margin={
                      isMobile
                        ? { top: 10, right: 0, left: 0, bottom: 5 }
                        : { top: 16, right: 24, left: 12, bottom: 5 }
                    }
                  >
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} className="text-[11px]" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {limitedBarChartData.map((_entry, index) => (
                        <Cell
                          key={`bar-cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
