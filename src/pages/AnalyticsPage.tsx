import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Expense {
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function AnalyticsPage({ expenses }: { expenses: Expense[] }) {
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
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      {expenses.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No data to display. Add some expenses first.
        </p>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">₹{totalExpense.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Daily Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ₹{averageDailySpend.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalTransactions}</p>
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

          <div className="grid gap-6 md:grid-cols-2">
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
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                    >
                      {expenseDataForPieChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            [
                              "#0088FE",
                              "#00C49F",
                              "#FFBB28",
                              "#FF8042",
                              "#AF19FF",
                              "#FF1919",
                            ][index % 6]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `₹${value.toFixed(2)}`}
                    />
                    <Legend />
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
                  <BarChart data={expenseDataForBarChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => `₹${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Bar dataKey="amount" fill="#8884d8" />
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
