import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Share2,
  Star,
  Plus,
  ArrowUp,
  Send,
  TrendingUp,
  TrendingDown,
  UtensilsCrossed,
  Car,
  ShoppingCart,
  PiggyBank,
  BarChart2,
  CalendarDays,
  Repeat2,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
type ExpenseCategory = "Food" | "Travel" | "Groceries" | "Entertainment" | "Utilities" | "Rent" | "Other";

interface Expense {
  description: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
}

interface AIResponse {
  title: string;
  summary: string;
  expenses: Expense[];
  insight: string;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  data?: AIResponse;
  timestamp: Date;
}

// ── constants ──────────────────────────────────────────────────────────────
const DEMO_RESPONSE: AIResponse = {
  title: "Your top expenses this month",
  summary:
    "You've spent ₹12,399 so far in February across 5 categories. Food & dining is your biggest spend at ₹3,850 (31%), followed by travel at ₹2,800. You're tracking 18% over your usual February budget — mainly driven by dining out.",
  expenses: [
    { description: "Swiggy orders",    category: "Food",          amount: "₹2,340", date: "25 Feb 2026" },
    { description: "Uber & Ola rides", category: "Travel",        amount: "₹1,890", date: "24 Feb 2026" },
    { description: "Big Basket",       category: "Groceries",     amount: "₹3,210", date: "22 Feb 2026" },
    { description: "Netflix + Hotstar",category: "Entertainment", amount: "₹1,149", date: "20 Feb 2026" },
    { description: "Electricity bill", category: "Utilities",     amount: "₹1,800", date: "18 Feb 2026" },
    { description: "Zomato Pro",       category: "Food",          amount: "₹799",   date: "15 Feb 2026" },
  ],
  insight:
    "You've spent ₹3,139 on food this month — 34% more than last month. Your biggest spike is weekday Swiggy orders (avg ₹380/order). Cooking just 3 meals a week at home could save you ~₹1,200/month.",
};

const LOADING_STEPS = [
  "Scanning your expenses...",
  "Analyzing spending patterns...",
  "Crunching the numbers...",
];

const QUICK_QUESTIONS = [
  { icon: BarChart2,      text: "What did I spend most on this month?" },
  { icon: TrendingUp,     text: "How does this month compare to last?" },
  { icon: UtensilsCrossed,text: "Show my food & dining expenses" },
  { icon: TrendingDown,   text: "Where can I cut down spending?" },
  { icon: Repeat2,        text: "Show all recurring subscriptions" },
  { icon: ShoppingCart,   text: "What did I spend on groceries?" },
  { icon: PiggyBank,      text: "How much have I saved this month?" },
  { icon: CalendarDays,   text: "Break down expenses by week" },
  { icon: Car,            text: "How much did I spend on travel?" },
];


// ── Sub-components ─────────────────────────────────────────────────────────
function CloverIcon({ size = 32, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={spinning ? { animation: "raySpinLogo 1.4s linear infinite" } : undefined}
    >
      <rect x="18" y="1"  width="12" height="20" rx="6" fill="#16a34a" />
      <rect x="27" y="18" width="20" height="12" rx="6" fill="#16a34a" />
      <rect x="18" y="27" width="12" height="20" rx="6" fill="#16a34a" />
      <rect x="1"  y="18" width="20" height="12" rx="6" fill="#16a34a" />
    </svg>
  );
}

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const s: Record<ExpenseCategory, string> = {
    Food:          "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Travel:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Groceries:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Entertainment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    Utilities:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Rent:          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Other:         "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s[category]}`}>
      {category}
    </span>
  );
}

function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <CloverIcon size={22} spinning />
      <span key={step} className="text-green-600 font-medium text-sm ray-fade-text">
        {LOADING_STEPS[step % LOADING_STEPS.length]}
      </span>
    </div>
  );
}

function ResponseCard({ data, visible }: { data: AIResponse; visible: boolean }) {
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.45s ease, transform 0.45s ease" }}>
      <h3 className="font-bold text-base mb-1">{data.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{data.summary}</p>

      <div className="rounded-xl border overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {["Description", "Category", "Amount", "Date"].map((h, i) => (
                <th
                  key={h}
                  className={`text-left px-4 py-2.5 font-medium text-muted-foreground ${i >= 3 ? "hidden sm:table-cell" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((exp, i) => (
              <tr
                key={i}
                className="border-t hover:bg-muted/20 transition-colors"
                style={{ animation: "rayRowIn 0.3s ease forwards", animationDelay: `${i * 70}ms`, opacity: 0 }}
              >
                <td className="px-4 py-3 font-medium">{exp.description}</td>
                <td className="px-4 py-3"><CategoryBadge category={exp.category} /></td>
                <td className="px-4 py-3 font-medium tabular-nums">{exp.amount}</td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{exp.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-4 mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Star className="h-4 w-4 text-emerald-600 fill-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Sage Insight</span>
        </div>
        <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">{data.insight}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SagePage() {
  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [isThinking, setIsThinking]         = useState(false);
  const [thinkingStep, setThinkingStep]     = useState(0);
  const [userName, setUserName]             = useState("there");
  const [responseVisible, setResponseVisible] = useState(false);
  const [chatMode, setChatMode]             = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

  const inputRef       = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const raw =
          session.user?.user_metadata?.full_name?.split(" ")[0] ||
          session.user?.email?.split("@")[0] ||
          "there";
        setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const stopThinking = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    if (!chatMode) {
      setWelcomeLeaving(true);
      await new Promise(r => setTimeout(r, 260));
      setChatMode(true);
      setWelcomeLeaving(false);
    }

    const userMsg: Message = { id: crypto.randomUUID(), type: "user", content: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);
    setThinkingStep(0);
    setResponseVisible(false);

    let step = 0;
    intervalRef.current = setInterval(() => { step += 1; setThinkingStep(step); }, 1800);

    await new Promise(r => setTimeout(r, 4200));
    stopThinking();
    setIsThinking(false);

    const aiMsg: Message = { id: crypto.randomUUID(), type: "assistant", content: "", data: DEMO_RESPONSE, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setTimeout(() => setResponseVisible(true), 80);
  }, [isThinking, chatMode, stopThinking]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── WELCOME ──────────────────────────────────────────────────── */}
      {!chatMode && (
        <div
          className="ray-mesh-bg flex flex-col items-center justify-center h-full px-5 text-center"
          style={{
            opacity: welcomeLeaving ? 0 : 1,
            transform: welcomeLeaving ? "scale(0.97) translateY(-8px)" : "scale(1) translateY(0)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
          }}
        >
          <div className="flex flex-col items-center w-full max-w-xl">

            {/* 1 — Logo */}
            <div className="mb-4 ray-fi-1">
              <CloverIcon size={52} />
            </div>

            {/* 2 — Greeting */}
            <p className="text-sm font-medium text-muted-foreground mb-3 tracking-wide ray-fi-2">
              {greeting}, {userName}
            </p>

            {/* 3 — Heading */}
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 ray-fi-3 leading-tight">
              What can I do for you today?
            </h2>

            {/* 4 — Tall input */}
            <form
              onSubmit={handleSubmit}
              className="w-full ray-fi-4 mb-5"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            >
              <div className="relative bg-background border border-border rounded-2xl shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all overflow-hidden">
                <textarea
                  ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="What did I spend most on this month?"
                  rows={3}
                  className="w-full px-5 pt-4 pb-14 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 resize-none text-sm leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* 5 — Horizontal-scrolling quick questions */}
            <div className="w-full ray-fi-5">
              <div
                className="flex gap-2.5 overflow-x-auto pb-1 ray-hscroll"
                style={{ scrollbarWidth: "none" }}
              >
                {QUICK_QUESTIONS.map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.text)}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-background text-sm text-muted-foreground whitespace-nowrap hover:border-primary/40 hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {q.text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT VIEW ────────────────────────────────────────────────── */}
      {chatMode && (
        <div className="flex flex-col h-full ray-chat-enter">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={msg.id}>
                  {msg.type === "user" ? (
                    <div className="flex justify-end ray-msg-in">
                      <div className="bg-muted text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : msg.data ? (
                    <div className="ray-msg-in">
                      <ResponseCard
                        data={msg.data}
                        visible={idx === messages.length - 1 ? responseVisible : true}
                      />
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1">
                          {[ThumbsUp, ThumbsDown, Copy, Share2].map((Icon, i) => (
                            <button key={i} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                              <Icon className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">Just now</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {isThinking && <ThinkingIndicator step={thinkingStep} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom input bar */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t bg-background ray-input-in">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-3xl mx-auto">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-muted transition-colors text-muted-foreground shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isThinking}
                className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:opacity-50 transition-all"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isThinking}
                className="rounded-full shrink-0 w-9 h-9 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Styles ───────────────────────────────────────────────────── */}
      <style>{`
        /* ── Subtle gradient — light & dark mode ── */
        .ray-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%,   rgba(99,102,241,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.05) 0%, transparent 60%);
        }
        .dark .ray-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%,   rgba(99,102,241,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.08) 0%, transparent 60%);
        }

        /* ── Staggered fade-up on welcome ── */
        .ray-fi-1 { animation: rayFadeUp 0.5s ease both 0.00s; }
        .ray-fi-2 { animation: rayFadeUp 0.5s ease both 0.08s; }
        .ray-fi-3 { animation: rayFadeUp 0.5s ease both 0.16s; }
        .ray-fi-4 { animation: rayFadeUp 0.5s ease both 0.24s; }
        .ray-fi-5 { animation: rayFadeUp 0.5s ease both 0.34s; }

        @keyframes rayFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ── Horizontal scroll hide scrollbar ── */
        .ray-hscroll::-webkit-scrollbar { display: none; }

        /* ── Spinning logo ── */
        @keyframes raySpinLogo { to { transform: rotate(360deg); } }

        /* ── Loading text ── */
        .ray-fade-text { animation: rayTextFade 0.35s ease both; }
        @keyframes rayTextFade {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0);    }
        }

        /* ── Chat view enters ── */
        .ray-chat-enter { animation: rayFadeIn 0.3s ease both; }
        @keyframes rayFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ── Message bubbles ── */
        .ray-msg-in { animation: rayMsgIn 0.3s ease both; }
        @keyframes rayMsgIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ── Bottom input slides in ── */
        .ray-input-in { animation: rayInputIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both 0.05s; }
        @keyframes rayInputIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ── Table rows stagger ── */
        @keyframes rayRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}
