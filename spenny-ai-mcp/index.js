#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// Supabase configuration (hardcoded for NPM package)
const SUPABASE_URL = "https://imtnhobztjbgnlgnhlvs.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdG5ob2J6dGpiZ25sZ25obHZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDYyMTI3MCwiZXhwIjoyMDY2MTk3MjcwfQ.ZLMkOgj6YQ4b0RerFHnRV1kdUYEos_TqWPYCeX-xXnI";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Utility functions for Indian currency formatting
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat("en-IN").format(num);
};

class SpennyMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "spenny-ai",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  // Validate API key and get user_id
  async validateApiKey(apiKey) {
    if (!apiKey) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "API key is required. Please provide your Spenny AI API key."
      );
    }

    // Query the api_keys table to validate the key and get user_id
    const { data, error } = await supabase
      .from("api_keys")
      .select("user_id, is_active, expires_at, last_used_at")
      .eq("key_hash", this.hashApiKey(apiKey))
      .single();

    if (error || !data) {
      throw new McpError(
        ErrorCode.Unauthorized,
        "Invalid API key. Please check your Spenny AI API key."
      );
    }

    if (!data.is_active) {
      throw new McpError(
        ErrorCode.Unauthorized,
        "API key has been deactivated. Please generate a new key from your Spenny AI account."
      );
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new McpError(
        ErrorCode.Unauthorized,
        "API key has expired. Please generate a new key from your Spenny AI account."
      );
    }

    // Update last_used_at timestamp
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", this.hashApiKey(apiKey));

    return data.user_id;
  }

  // Hash API key for secure storage
  hashApiKey(apiKey) {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_transactions",
            description:
              "Get your transactions with optional filters for date range, category, amount range, etc.",
            inputSchema: {
              type: "object",
              properties: {
                start_date: {
                  type: "string",
                  description: "Start date for filtering (YYYY-MM-DD format)",
                },
                end_date: {
                  type: "string",
                  description: "End date for filtering (YYYY-MM-DD format)",
                },
                category: {
                  type: "string",
                  description: "Category to filter by",
                },
                min_amount: {
                  type: "number",
                  description: "Minimum amount to filter by",
                },
                max_amount: {
                  type: "number",
                  description: "Maximum amount to filter by",
                },
                limit: {
                  type: "number",
                  description: "Number of records to return (default: 50)",
                },
              },
              required: [],
            },
          },
          {
            name: "get_transaction_summary",
            description:
              "Get your transaction summary statistics for a time period",
            inputSchema: {
              type: "object",
              properties: {
                start_date: {
                  type: "string",
                  description: "Start date for summary (YYYY-MM-DD format)",
                },
                end_date: {
                  type: "string",
                  description: "End date for summary (YYYY-MM-DD format)",
                },
                group_by: {
                  type: "string",
                  enum: ["category", "month", "week"],
                  description: "How to group the summary",
                },
              },
              required: [],
            },
          },
          {
            name: "get_monthly_transactions",
            description: "Get your transactions for a specific month",
            inputSchema: {
              type: "object",
              properties: {
                year: {
                  type: "number",
                  description: "Year (default: current year)",
                },
                month: {
                  type: "number",
                  description: "Month (1-12, default: current month)",
                },
              },
              required: [],
            },
          },
          {
            name: "get_category_breakdown",
            description:
              "Get your transaction breakdown by category for a time period",
            inputSchema: {
              type: "object",
              properties: {
                start_date: {
                  type: "string",
                  description: "Start date (YYYY-MM-DD format)",
                },
                end_date: {
                  type: "string",
                  description: "End date (YYYY-MM-DD format)",
                },
              },
              required: [],
            },
          },
          {
            name: "search_transactions",
            description:
              "Search your transactions by description or other text fields",
            inputSchema: {
              type: "object",
              properties: {
                search_term: {
                  type: "string",
                  description: "Search term to look for in descriptions",
                },
                limit: {
                  type: "number",
                  description: "Number of records to return (default: 20)",
                },
              },
              required: ["search_term"],
            },
          },
          {
            name: "get_spending_insights",
            description:
              "Get intelligent spending insights and patterns analysis for your account",
            inputSchema: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  enum: ["week", "month", "quarter", "year"],
                  description: "Time period for analysis (default: month)",
                },
                include_trends: {
                  type: "boolean",
                  description: "Include spending trends and comparisons",
                },
              },
              required: [],
            },
          },
          {
            name: "get_budget_analysis",
            description:
              "Analyze your spending against typical Indian household budgets",
            inputSchema: {
              type: "object",
              properties: {
                monthly_income: {
                  type: "number",
                  description:
                    "Monthly income in INR for budget percentage calculations",
                },
                period_months: {
                  type: "number",
                  description: "Number of months to analyze (default: 3)",
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Get API key from environment variable
        const apiKey = process.env.SPENNY_API_KEY;
        if (!apiKey) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Spenny AI API key not configured. Please add SPENNY_API_KEY to your environment variables."
          );
        }

        // Validate API key and get user_id
        const user_id = await this.validateApiKey(apiKey);

        // Add user_id to args for all requests
        const argsWithUserId = { ...args, user_id };

        switch (name) {
          case "get_transactions":
            return await this.getTransactions(argsWithUserId);
          case "get_transaction_summary":
            return await this.getTransactionSummary(argsWithUserId);
          case "get_monthly_transactions":
            return await this.getMonthlyTransactions(argsWithUserId);
          case "get_category_breakdown":
            return await this.getCategoryBreakdown(argsWithUserId);
          case "search_transactions":
            return await this.searchTransactions(argsWithUserId);
          case "get_spending_insights":
            return await this.getSpendingInsights(argsWithUserId);
          case "get_budget_analysis":
            return await this.getBudgetAnalysis(argsWithUserId);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error.message}`
        );
      }
    });
  }

  async getTransactions(args) {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", args.user_id) // Always filter by user_id
      .order("date", { ascending: false });

    // Apply other filters
    if (args.start_date) {
      query = query.gte("date", args.start_date);
    }
    if (args.end_date) {
      query = query.lte("date", args.end_date);
    }
    if (args.category) {
      query = query.eq("category", args.category);
    }
    if (args.min_amount) {
      query = query.gte("amount", args.min_amount);
    }
    if (args.max_amount) {
      query = query.lte("amount", args.max_amount);
    }

    const limit = args.limit || 50;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const totalAmount = data.reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              transactions: data,
              count: data.length,
              total_amount: totalAmount,
              total_amount_formatted: formatINR(totalAmount),
              summary: {
                average_transaction:
                  data.length > 0 ? totalAmount / data.length : 0,
                average_transaction_formatted:
                  data.length > 0
                    ? formatINR(totalAmount / data.length)
                    : formatINR(0),
                date_range:
                  data.length > 0
                    ? {
                        from: data[data.length - 1].date,
                        to: data[0].date,
                      }
                    : null,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getTransactionSummary(args) {
    let query = supabase
      .from("transactions")
      .select("amount, category, date")
      .eq("user_id", args.user_id); // Always filter by user_id

    if (args.start_date) {
      query = query.gte("date", args.start_date);
    }
    if (args.end_date) {
      query = query.lte("date", args.end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const totalAmount = data.reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalCount = data.length;
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    let groupedData = {};
    if (args.group_by === "category") {
      groupedData = data.reduce((acc, transaction) => {
        const key = transaction.category || "Uncategorized";
        if (!acc[key]) {
          acc[key] = { amount: 0, count: 0 };
        }
        acc[key].amount += transaction.amount;
        acc[key].count += 1;
        return acc;
      }, {});
    } else if (args.group_by === "month") {
      groupedData = data.reduce((acc, transaction) => {
        const date = new Date(transaction.date);
        const key = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        if (!acc[key]) {
          acc[key] = { amount: 0, count: 0 };
        }
        acc[key].amount += transaction.amount;
        acc[key].count += 1;
        return acc;
      }, {});
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              summary: {
                total_amount: totalAmount,
                total_amount_formatted: formatINR(totalAmount),
                total_count: totalCount,
                average_amount: avgAmount,
                average_amount_formatted: formatINR(avgAmount),
                grouped_data: groupedData,
                period_analysis:
                  args.start_date && args.end_date
                    ? {
                        start_date: args.start_date,
                        end_date: args.end_date,
                        days: Math.ceil(
                          (new Date(args.end_date) -
                            new Date(args.start_date)) /
                            (1000 * 60 * 60 * 24)
                        ),
                        daily_average: formatINR(
                          totalAmount /
                            Math.ceil(
                              (new Date(args.end_date) -
                                new Date(args.start_date)) /
                                (1000 * 60 * 60 * 24)
                            )
                        ),
                      }
                    : null,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getMonthlyTransactions(args) {
    const now = new Date();
    const year = args.year || now.getFullYear();
    const month = args.month || now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", args.user_id) // Always filter by user_id
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const totalAmount = data.reduce((sum, transaction) => sum + transaction.amount, 0);
    const daysInMonth = new Date(year, month, 0).getDate();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              month: `${year}-${String(month).padStart(2, "0")}`,
              month_name: new Date(year, month - 1).toLocaleDateString(
                "en-IN",
                { month: "long", year: "numeric" }
              ),
              transactions: data,
              total_amount: totalAmount,
              total_amount_formatted: formatINR(totalAmount),
              count: data.length,
              daily_average: formatINR(totalAmount / daysInMonth),
              top_transaction:
                data.length > 0
                  ? {
                      ...data.reduce((max, transaction) =>
                        transaction.amount > max.amount ? transaction : max
                      ),
                      amount_formatted: formatINR(
                        data.reduce((max, transaction) =>
                          transaction.amount > max.amount ? transaction : max
                        ).amount
                      ),
                    }
                  : null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getCategoryBreakdown(args) {
    let query = supabase
      .from("transactions")
      .select("category, amount")
      .eq("user_id", args.user_id); // Always filter by user_id

    if (args.start_date) {
      query = query.gte("date", args.start_date);
    }
    if (args.end_date) {
      query = query.lte("date", args.end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const breakdown = data.reduce((acc, transaction) => {
      const category = transaction.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = { amount: 0, count: 0 };
      }
      acc[category].amount += transaction.amount;
      acc[category].count += 1;
      return acc;
    }, {});

    const totalAmount = Object.values(breakdown).reduce(
      (sum, cat) => sum + cat.amount,
      0
    );

    // Sort by amount descending
    const sortedBreakdown = Object.entries(breakdown)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .reduce((acc, [category, data]) => {
        acc[category] = {
          ...data,
          amount_formatted: formatINR(data.amount),
          percentage: ((data.amount / totalAmount) * 100).toFixed(1),
        };
        return acc;
      }, {});

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              category_breakdown: sortedBreakdown,
              total_categories: Object.keys(sortedBreakdown).length,
              total_amount: totalAmount,
              total_amount_formatted: formatINR(totalAmount),
              top_category: Object.keys(sortedBreakdown)[0] || null,
              spending_insights: {
                highest_category: Object.keys(sortedBreakdown)[0],
                lowest_category:
                  Object.keys(sortedBreakdown)[
                    Object.keys(sortedBreakdown).length - 1
                  ],
                most_frequent: Object.entries(sortedBreakdown).sort(
                  ([, a], [, b]) => b.count - a.count
                )[0]?.[0],
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async searchTransactions(args) {
    const { search_term, limit = 20, user_id } = args;

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user_id) // Always filter by user_id
      .ilike("description", `%${search_term}%`)
      .order("date", { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const totalAmount = data.reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              search_term,
              results: data,
              count: data.length,
              total_amount: totalAmount,
              total_amount_formatted: formatINR(totalAmount),
              average_amount:
                data.length > 0
                  ? formatINR(totalAmount / data.length)
                  : formatINR(0),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getSpendingInsights(args) {
    const period = args.period || "month";
    const now = new Date();

    // Calculate date ranges based on period
    let startDate, endDate, compareStartDate, compareEndDate;

    switch (period) {
      case "week":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate = weekStart.toISOString().split("T")[0];
        endDate = new Date().toISOString().split("T")[0];
        compareStartDate = new Date(weekStart.setDate(weekStart.getDate() - 7))
          .toISOString()
          .split("T")[0];
        compareEndDate = new Date(weekStart.setDate(weekStart.getDate() + 6))
          .toISOString()
          .split("T")[0];
        break;
      case "quarter":
        const quarterStart = new Date(
          now.getFullYear(),
          Math.floor(now.getMonth() / 3) * 3,
          1
        );
        startDate = quarterStart.toISOString().split("T")[0];
        endDate = new Date().toISOString().split("T")[0];
        compareStartDate = new Date(
          quarterStart.setMonth(quarterStart.getMonth() - 3)
        )
          .toISOString()
          .split("T")[0];
        compareEndDate = new Date(
          quarterStart.setMonth(quarterStart.getMonth() + 2, 0)
        )
          .toISOString()
          .split("T")[0];
        break;
      case "year":
        startDate = `${now.getFullYear()}-01-01`;
        endDate = new Date().toISOString().split("T")[0];
        compareStartDate = `${now.getFullYear() - 1}-01-01`;
        compareEndDate = `${now.getFullYear() - 1}-12-31`;
        break;
      default: // month
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          "0"
        )}-01`;
        endDate = new Date().toISOString().split("T")[0];
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        compareStartDate = `${lastMonth.getFullYear()}-${String(
          lastMonth.getMonth() + 1
        ).padStart(2, "0")}-01`;
        compareEndDate = new Date(
          lastMonth.getFullYear(),
          lastMonth.getMonth() + 1,
          0
        )
          .toISOString()
          .split("T")[0];
    }

    // Get current period data
    let currentQuery = supabase
      .from("transactions")
      .select("amount, category, date")
      .eq("user_id", args.user_id) // Always filter by user_id
      .gte("date", startDate)
      .lte("date", endDate);

    const { data: currentData, error: currentError } = await currentQuery;

    if (currentError) {
      throw new Error(`Supabase error: ${currentError.message}`);
    }

    // Get comparison period data if trends requested
    let compareData = [];
    if (args.include_trends) {
      let compareQuery = supabase
        .from("transactions")
        .select("amount, category, date")
        .eq("user_id", args.user_id) // Always filter by user_id
        .gte("date", compareStartDate)
        .lte("date", compareEndDate);

      const { data: compareResult, error: compareError } = await compareQuery;
      if (!compareError) {
        compareData = compareResult;
      }
    }

    // Calculate insights
    const currentTotal = currentData.reduce((sum, trans) => sum + trans.amount, 0);
    const compareTotal = compareData.reduce((sum, trans) => sum + trans.amount, 0);
    const change =
      compareTotal > 0
        ? ((currentTotal - compareTotal) / compareTotal) * 100
        : 0;

    // Category analysis
    const categoryTotals = currentData.reduce((acc, trans) => {
      const cat = trans.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + trans.amount;
      return acc;
    }, {});

    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    // Daily spending pattern
    const dailySpending = currentData.reduce((acc, trans) => {
      const day = new Date(trans.date).toLocaleDateString("en-IN", {
        weekday: "long",
      });
      acc[day] = (acc[day] || 0) + trans.amount;
      return acc;
    }, {});

    const insights = {
      period_summary: {
        period,
        start_date: startDate,
        end_date: endDate,
        total_amount: currentTotal,
        total_amount_formatted: formatINR(currentTotal),
        transaction_count: currentData.length,
        average_transaction:
          currentData.length > 0
            ? formatINR(currentTotal / currentData.length)
            : formatINR(0),
      },
      trends: args.include_trends
        ? {
            previous_period_total: compareTotal,
            previous_period_formatted: formatINR(compareTotal),
            change_percentage: change.toFixed(1),
            change_direction:
              change > 0 ? "increased" : change < 0 ? "decreased" : "same",
            change_amount: formatINR(Math.abs(currentTotal - compareTotal)),
          }
        : null,
      category_insights: {
        top_category: topCategory
          ? {
              name: topCategory[0],
              amount: topCategory[1],
              amount_formatted: formatINR(topCategory[1]),
              percentage: ((topCategory[1] / currentTotal) * 100).toFixed(1),
            }
          : null,
        category_distribution: Object.entries(categoryTotals)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amount]) => ({
            name,
            amount,
            amount_formatted: formatINR(amount),
            percentage: ((amount / currentTotal) * 100).toFixed(1),
          })),
      },
      spending_patterns: {
        daily_average: formatINR(
          currentTotal /
            Math.max(
              1,
              Math.ceil(
                (new Date(endDate) - new Date(startDate)) /
                  (1000 * 60 * 60 * 24)
              )
            )
        ),
        highest_spending_day:
          Object.entries(dailySpending).sort(([, a], [, b]) => b - a)[0] ||
          null,
        most_frequent_amount_range: this.getFrequentAmountRange(currentData),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(insights, null, 2),
        },
      ],
    };
  }

  async getBudgetAnalysis(args) {
    const monthsToAnalyze = args.period_months || 3;
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthsToAnalyze + 1,
      1
    )
      .toISOString()
      .split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("transactions")
      .select("amount, category, date")
      .eq("user_id", args.user_id) // Always filter by user_id
      .gte("date", startDate)
      .lte("date", endDate);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const totalSpent = data.reduce((sum, trans) => sum + trans.amount, 0);
    const monthlyAverage = totalSpent / monthsToAnalyze;

    // Indian household budget recommendations (as percentages of income)
    const idealBudget = {
      Food: { min: 20, max: 30, priority: "essential" },
      Housing: { min: 25, max: 35, priority: "essential" },
      Transportation: { min: 10, max: 15, priority: "necessary" },
      Healthcare: { min: 5, max: 10, priority: "essential" },
      Education: { min: 10, max: 15, priority: "important" },
      Entertainment: { min: 5, max: 10, priority: "lifestyle" },
      Shopping: { min: 5, max: 15, priority: "lifestyle" },
      Savings: { min: 20, max: 30, priority: "essential" },
    };

    // Categorize expenses
    const categorySpending = data.reduce((acc, trans) => {
      const cat = trans.category || "Other";
      acc[cat] = (acc[cat] || 0) + trans.amount;
      return acc;
    }, {});

    const analysis = {
      analysis_period: {
        months_analyzed: monthsToAnalyze,
        start_date: startDate,
        end_date: endDate,
        total_spent: totalSpent,
        total_spent_formatted: formatINR(totalSpent),
        monthly_average: monthlyAverage,
        monthly_average_formatted: formatINR(monthlyAverage),
      },
      income_analysis: args.monthly_income
        ? {
            monthly_income: args.monthly_income,
            monthly_income_formatted: formatINR(args.monthly_income),
            spending_ratio: (
              (monthlyAverage / args.monthly_income) *
              100
            ).toFixed(1),
            savings_potential: formatINR(args.monthly_income - monthlyAverage),
            savings_rate: (
              ((args.monthly_income - monthlyAverage) / args.monthly_income) *
              100
            ).toFixed(1),
          }
        : null,
      category_budget_analysis: Object.entries(categorySpending)
        .map(([category, amount]) => {
          const monthlyAmount = amount / monthsToAnalyze;
          const ideal = idealBudget[category];
          let status = "untracked";
          let recommendation = "Monitor spending in this category";

          if (ideal && args.monthly_income) {
            const percentage = (monthlyAmount / args.monthly_income) * 100;
            if (percentage < ideal.min) {
              status = "under_budget";
              recommendation = `Consider allocating more to ${category.toLowerCase()} (currently ${percentage.toFixed(
                1
              )}%, recommended ${ideal.min}-${ideal.max}%)`;
            } else if (percentage > ideal.max) {
              status = "over_budget";
              recommendation = `Consider reducing ${category.toLowerCase()} expenses (currently ${percentage.toFixed(
                1
              )}%, recommended ${ideal.min}-${ideal.max}%)`;
            } else {
              status = "within_budget";
              recommendation = `${category} spending is within recommended range`;
            }
          }

          return {
            category,
            monthly_amount: monthlyAmount,
            monthly_amount_formatted: formatINR(monthlyAmount),
            total_amount_formatted: formatINR(amount),
            percentage_of_income: args.monthly_income
              ? ((monthlyAmount / args.monthly_income) * 100).toFixed(1)
              : null,
            status,
            recommendation,
            ideal_range: ideal ? `${ideal.min}-${ideal.max}%` : "N/A",
            priority: ideal?.priority || "unclassified",
          };
        })
        .sort((a, b) => b.monthly_amount - a.monthly_amount),
      recommendations: this.generateBudgetRecommendations(
        categorySpending,
        monthsToAnalyze,
        args.monthly_income
      ),
      indian_context: {
        cost_of_living_note:
          "Budget recommendations are based on typical Indian household spending patterns",
        savings_culture:
          "Indian households typically aim for 20-30% savings rate",
        family_expenses:
          "Consider joint family expenses and festival spending in your budget",
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  getFrequentAmountRange(transactions) {
    const ranges = {
      "Under ₹100": 0,
      "₹100-500": 0,
      "₹500-1000": 0,
      "₹1000-2000": 0,
      "₹2000-5000": 0,
      "Above ₹5000": 0,
    };

    transactions.forEach((trans) => {
      if (trans.amount < 100) ranges["Under ₹100"]++;
      else if (trans.amount < 500) ranges["₹100-500"]++;
      else if (trans.amount < 1000) ranges["₹500-1000"]++;
      else if (trans.amount < 2000) ranges["₹1000-2000"]++;
      else if (trans.amount < 5000) ranges["₹2000-5000"]++;
      else ranges["Above ₹5000"]++;
    });

    return (
      Object.entries(ranges).sort(([, a], [, b]) => b - a)[0]?.[0] || "No data"
    );
  }

  generateBudgetRecommendations(categorySpending, months, monthlyIncome) {
    const monthlySpending = Object.fromEntries(
      Object.entries(categorySpending).map(([cat, amount]) => [
        cat,
        amount / months,
      ])
    );

    const recommendations = [];

    // High spending categories
    const topCategories = Object.entries(monthlySpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topCategories.length > 0) {
      recommendations.push(
        `Your top expense categories are: ${topCategories
          .map(([cat, amt]) => `${cat} (${formatINR(amt)})`)
          .join(", ")}`
      );
    }

    // Savings recommendation
    if (monthlyIncome) {
      const totalMonthlySpending = Object.values(monthlySpending).reduce(
        (sum, amt) => sum + amt,
        0
      );
      const savingsRate =
        ((monthlyIncome - totalMonthlySpending) / monthlyIncome) * 100;

      if (savingsRate < 20) {
        recommendations.push(
          "Consider increasing your savings rate to at least 20% of income for financial security"
        );
      } else if (savingsRate > 30) {
        recommendations.push(
          "Excellent savings rate! Consider investing surplus funds for better returns"
        );
      }
    }

    // Category-specific recommendations
    if (monthlySpending["Food"] && monthlySpending["Food"] > 15000) {
      recommendations.push(
        "Food expenses seem high. Consider meal planning and cooking at home more often"
      );
    }

    if (
      monthlySpending["Entertainment"] &&
      monthlySpending["Entertainment"] > 8000
    ) {
      recommendations.push(
        "Entertainment expenses are significant. Look for free or low-cost activities"
      );
    }

    return recommendations;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Spenny-AI MCP server running on stdio");
  }
}

const server = new SpennyMCPServer();
server.run().catch(console.error);
