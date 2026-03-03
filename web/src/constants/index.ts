import { 
    TrendingUp,
    TrendingDown,
    UtensilsCrossed,
    Car,
    ShoppingCart,
    PiggyBank,
    BarChart2,
    CalendarDays,
    Repeat2
  } from "lucide-react";

export const CATEGORY_EMOJI: Record<string, string> = {
    food: "🍔",
    travel: "✈️",
    groceries: "🛒",
    entertainment: "🎬",
    utilities: "💡",
    rent: "🏠",
    other: "📦",
  };
  
export const CATEGORY_STYLES: Record<string, string> = {
    food: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    travel: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    groceries: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    entertainment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    utilities: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    rent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  

export const LOADING_STEPS = [
    "Scanning your receipt…",
    "Transcribing your voice…",
    "Scanning your expenses…",
    "Analyzing spending patterns…",
    "Crunching the numbers…",
    "Generating insights…",
  ];
  
 export const QUICK_QUESTIONS = [
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