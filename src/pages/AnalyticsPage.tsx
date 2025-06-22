"use client";

import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "@/components/theme-provider";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#AF19FF",
  "#FF1919",
];

interface TooltipPayload {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-background border border-border rounded-lg shadow-lg">
        <p className="label font-bold">{`${label || payload[0].name}`}</p>
        <p className="intro text-primary">{`₹${payload[0].value.toFixed(
          2
        )}`}</p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-background border border-border rounded-lg shadow-lg">
        <p className="label font-bold">{`${label}`}</p>
        <p className="intro text-primary">{`Amount: ₹${payload[0].value.toFixed(
          2
        )}`}</p>
      </div>
    );
  }
  return null;
};

interface Expense {
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function AnalyticsPage({ expenses }: { expenses: Expense[] }) {
  const { theme } = useTheme();
  const tickColor = theme === "dark" ? "#FFFFFF" : "#000000";

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

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">
        Analytics Dashboard
      </h1>
      {expenses.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No data to display. Add some expenses first.
        </p>
      ) : (
        <div className="grid gap-4 md:gap-6">
          <div className="grid gap-4 md:gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">
                  ₹{totalExpense.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Daily Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">
                  ₹{averageDailySpend.toFixed(2)}
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
                      <span>₹{category.value.toFixed(2)}</span>
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
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={expenseDataForPieChart}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      innerRadius={60}
                      paddingAngle={5}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      isAnimationActive={true}
                    >
                      {expenseDataForPieChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={expenseDataForBarChart}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#8884d8"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8884d8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fill: tickColor }}
                      tickLine={{ stroke: tickColor }}
                    />
                    <YAxis
                      tick={{ fill: tickColor }}
                      tickLine={{ stroke: tickColor }}
                    />
                    <Tooltip
                      content={<CustomBarTooltip />}
                      cursor={{ fill: "hsla(var(--muted), 0.5)" }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="url(#colorUv)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
