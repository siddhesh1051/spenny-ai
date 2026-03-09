"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MessageSquare, Mic, Camera, FileText, BarChart2, Download, Check, ArrowRight, MessageCircle } from "lucide-react";

const SAGE_GREEN = "#1a8a5a";
const SAGE_LIGHT = "#3dd68c";

/* ── Visual panels for each feature ── */

function VisualConversation() {
  const messages = [
    { role: "user", text: "Spent ₹200 on dinner, ₹50 Uber, ₹80 coffee" },
    {
      role: "sage", items: [
        { label: "Dinner", cat: "Food & Dining", amt: "₹200", icon: "🍽️" },
        { label: "Uber", cat: "Transport", amt: "₹50", icon: "🚗" },
        { label: "Coffee", cat: "Cafes", amt: "₹80", icon: "☕" },
      ]
    },
    { role: "user", text: "Actually remove coffee" },
    { role: "sage", text: "Done — coffee removed. ₹250 total logged." },
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden h-full"
      style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.2)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(26,138,90,0.12)", background: "rgba(3,43,34,0.3)" }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1a8a5a,#0f5e3c)" }}>
          <span className="text-[9px] text-white font-bold">S</span>
        </div>
        <span className="text-xs font-semibold text-white">Sage</span>
        <div className="w-1.5 h-1.5 rounded-full ml-auto animate-pulse" style={{ background: SAGE_LIGHT }} />
      </div>
      {/* Messages */}
      <div className="p-3 space-y-2.5 text-xs">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "sage" && (
              <div className="w-5 h-5 rounded-full flex-shrink-0 mr-1.5 mt-0.5 flex items-center justify-center" style={{ background: "rgba(26,138,90,0.2)" }}>
                <span className="text-[8px] font-bold" style={{ color: SAGE_LIGHT }}>S</span>
              </div>
            )}
            <div
              className="max-w-[85%] rounded-xl px-3 py-2"
              style={msg.role === "user"
                ? { background: "rgba(26,138,90,0.15)", border: "1px solid rgba(26,138,90,0.25)", color: "var(--text-primary)" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }
              }
            >
              {msg.text && <p>{msg.text}</p>}
              {msg.items && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: SAGE_LIGHT }}>✓ Logged</p>
                  {msg.items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: "rgba(26,138,90,0.08)", border: "1px solid rgba(26,138,90,0.15)" }}>
                      <span className="mr-1.5">{item.icon}</span>
                      <div className="flex-1">
                        <p className="text-white font-medium" style={{ fontSize: "10px" }}>{item.label}</p>
                        <p style={{ fontSize: "9px", color: "var(--text-muted)" }}>{item.cat}</p>
                      </div>
                      <span className="font-semibold" style={{ color: SAGE_LIGHT, fontSize: "10px" }}>{item.amt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Mic size={11} style={{ color: "var(--text-muted)" }} />
          <span className="flex-1 text-[10px] text-[var(--text-muted)]">Tell Sage anything...</span>
          <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: SAGE_GREEN }}>
            <ArrowRight size={9} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualReceiptScan() {
  const items = [
    { name: "Butter Chicken", qty: 1, price: "₹380" },
    { name: "Naan (×3)", qty: 3, price: "₹120" },
    { name: "Mango Lassi", qty: 2, price: "₹180" },
    { name: "Service Charge", qty: 1, price: "₹68" },
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Receipt card */}
      <div className="rounded-2xl overflow-hidden flex-1" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.2)" }}>
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(26,138,90,0.12)", background: "rgba(3,43,34,0.3)" }}>
          <Camera size={12} style={{ color: SAGE_LIGHT }} />
          <span className="text-xs font-semibold text-white">Receipt Scanned</span>
          <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(26,138,90,0.15)", color: SAGE_LIGHT, border: "1px solid rgba(26,138,90,0.25)" }}>Vision AI</span>
        </div>
        <div className="p-3 space-y-1.5">
          {items.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-[var(--text-secondary)]">{item.name}</span>
              <span className="font-semibold text-white">{item.price}</span>
            </motion.div>
          ))}
          <div className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 mt-1" style={{ background: "rgba(26,138,90,0.08)", border: "1px solid rgba(26,138,90,0.2)" }}>
            <span className="font-bold text-white">Total</span>
            <span className="font-bold" style={{ color: SAGE_LIGHT }}>₹748</span>
          </div>
        </div>
      </div>
      {/* Bank statement mini */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.15)" }}>
        <FileText size={16} style={{ color: SAGE_LIGHT }} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">HDFC Statement · Feb 2025</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>47 transactions parsed · ₹38,200 total</p>
        </div>
        <Check size={14} style={{ color: SAGE_LIGHT }} />
      </div>
    </div>
  );
}

function PieChart({ slices }: { slices: { pct: number; color: string }[] }) {
  const cx = 60; const cy = 60; const r = 48; const gap = 2.5;
  let cumulative = 0;
  const paths = slices.map((s) => {
    const start = cumulative;
    cumulative += s.pct;
    const startAngle = (start / 100) * 360 - 90;
    const endAngle = (cumulative / 100) * 360 - 90;
    const gapAngle = (gap / (2 * Math.PI * r)) * 360;
    const a1 = ((startAngle + gapAngle) * Math.PI) / 180;
    const a2 = ((endAngle - gapAngle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: s.color };
  });
  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r + 4} fill="rgba(255,255,255,0.02)" />
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.9} />
      ))}
      {/* Donut hole */}
      <circle cx={cx} cy={cy} r={26} fill="rgba(5,12,8,0.95)" />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">Food</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#3dd68c" fontSize={9}>42%</text>
    </svg>
  );
}

function VisualAnalytics() {
  const categories = [
    { label: "Food", pct: 42, amt: "₹9,360", color: SAGE_LIGHT },
    { label: "Transport", pct: 24, amt: "₹5,400", color: "#22b572" },
    { label: "Shopping", pct: 20, amt: "₹7,200", color: SAGE_GREEN },
    { label: "Utilities", pct: 9, amt: "₹3,600", color: "#0f5e3c" },
    { label: "Health", pct: 5, amt: "₹2,400", color: "rgba(26,138,90,0.4)" },
  ];
  const metrics = [
    { label: "Total spent", value: "₹27,960", change: "-8%" },
    { label: "Transactions", value: "84", change: "+3" },
    { label: "Top category", value: "Food", change: "42%" },
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Metric cards row */}
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="rounded-xl p-2.5" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.18)" }}>
            <p className="text-[9px] text-[var(--text-muted)] mb-0.5">{m.label}</p>
            <p className="text-sm font-bold text-white">{m.value}</p>
            <p className="text-[9px]" style={{ color: SAGE_LIGHT }}>{m.change}</p>
          </motion.div>
        ))}
      </div>

      {/* Pie + Bars side by side */}
      <div className="rounded-2xl p-3 flex-1 flex gap-4" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.15)" }}>
        {/* Left: pie chart */}
        <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: "44%" }}>
          <p className="text-[10px] font-semibold text-white mb-2 self-start">Spending by Category</p>
          <PieChart slices={categories.map(c => ({ pct: c.pct, color: c.color }))} />
          {/* Legend dots */}
          <div className="mt-2 space-y-1 w-full">
            {categories.slice(0, 3).map((c) => (
              <div key={c.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="text-[9px] text-[var(--text-muted)]">{c.label}</span>
                <span className="text-[9px] font-semibold ml-auto" style={{ color: c.color }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch" style={{ background: "rgba(26,138,90,0.12)" }} />

        {/* Right: progress bars */}
        <div className="flex-1 flex flex-col justify-center gap-2.5">
          {categories.map((b, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--text-muted)]">{b.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: b.color }}>{b.amt}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${b.pct * 2.1}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${b.color}, ${b.color}88)` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight pill */}
      <div className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: "rgba(3,43,34,0.5)", border: "1px solid rgba(26,138,90,0.2)", color: "var(--sage-300)" }}>
        💡 Food spending is 42% of total — ₹2,100 above last month average
      </div>
    </div>
  );
}

function VisualExport() {
  const formats = [
    { name: "CSV Export", desc: "All transactions · Mar 2025", icon: "📊", ready: true },
    { name: "PDF Report", desc: "Category summary · Q1 2025", icon: "📄", ready: true },
    { name: "WhatsApp", desc: "Sent to +91 98XX XXXXX", icon: "💬", ready: false },
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      {formats.map((f, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
          className="rounded-2xl px-4 py-4 flex items-center gap-3" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.18)" }}>
          <span className="text-2xl">{f.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{f.name}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{f.desc}</p>
          </div>
          {f.ready && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(26,138,90,0.15)", border: "1px solid rgba(26,138,90,0.3)" }}>
              <Check size={11} style={{ color: SAGE_LIGHT }} />
            </div>
          )}
        </motion.div>
      ))}
      {/* Filter pills */}
      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(5,12,8,0.8)", border: "1px solid rgba(26,138,90,0.12)" }}>
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Filters applied</p>
        <div className="flex flex-wrap gap-1.5">
          {["Last 30 days", "Food + Transport", "All accounts"].map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(26,138,90,0.1)", color: SAGE_LIGHT, border: "1px solid rgba(26,138,90,0.2)" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    id: "conversation",
    eyebrow: "Core Feature",
    title: "Log expenses the way you speak",
    description: "Just tell Sage what you spent — in a single message or a conversation. Sage extracts multiple expenses from one sentence, auto-assigns categories (Food, Transport, Groceries, Shopping, Utilities, Rent, Entertainment, Health, and more), sets the date, and saves everything instantly. Change your mind? One-tap undo per item.",
    bullets: [
      "Natural language: 'Spent 200 on dinner and 50 for Uber'",
      "Voice input via Whisper — tap mic, speak naturally",
      "Multi-expense extraction from a single message",
      "12+ auto-detected categories",
      "Per-item undo within the chat",
    ],
    visual: <VisualConversation />,
    flip: false,
  },
  {
    id: "receipt",
    eyebrow: "Vision AI",
    title: "Receipts, screenshots & bank statements",
    description: "Snap a receipt, share a payment screenshot, or upload a full bank statement PDF. Llama Vision extracts merchant names, line items, amounts, and dates. For PDFs, Sage parses every debit transaction, categorises them, and lets you review before importing — with a 10-second undo window.",
    bullets: [
      "Receipt & payment screenshot scanning",
      "Bank statement PDF upload (HDFC, ICICI, SBI, Axis, Paytm…)",
      "Debit-only extraction — ignores credits/refunds",
      "Clean merchant names, no transaction IDs",
      "Bulk import with instant rollback",
    ],
    visual: <VisualReceiptScan />,
    flip: true,
  },
  {
    id: "analytics",
    eyebrow: "Generative UI",
    title: "Ask anything about your spending",
    description: "Sage doesn't return text — it returns a live UI layout. Ask 'What did I spend on food last month?' and get metric cards, a category bar chart, a transaction table, and a personalised insight callout — all composed uniquely per query. Every response is different, shaped by your actual data.",
    bullets: [
      "Month-over-month comparison metrics",
      "Category donut & bar charts (Recharts)",
      "Filterable transaction tables",
      "AI-generated insight callouts",
      "Follow-up questions in the same conversation",
    ],
    visual: <VisualAnalytics />,
    flip: false,
  },
  {
    id: "export",
    eyebrow: "Export",
    title: "Export any slice of your data",
    description: "Generate CSV or PDF exports filtered by any time range, category, account, or amount threshold. Export directly from the dashboard, via Sage chat, or through WhatsApp. Exports include all transaction fields: date, amount, category, description, payment method, and source.",
    bullets: [
      "CSV export for spreadsheet analysis",
      "PDF report with category summaries",
      "Custom date range & category filters",
      "Export via WhatsApp or Telegram",
      "Programmatic access via API keys",
    ],
    visual: <VisualExport />,
    flip: true,
  },
];

function FeatureRow({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5 }}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-16 ${index < features.length - 1 ? "border-b" : ""
        }`}
      style={{ borderColor: "rgba(26,138,90,0.08)" }}
    >
      {/* Text side */}
      <motion.div
        initial={{ opacity: 0, x: feature.flip ? 30 : -30 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        className={feature.flip ? "lg:order-2" : "lg:order-1"}
      >
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-4"
          style={{
            background: "rgba(3,43,34,0.5)",
            border: "1px solid rgba(26,138,90,0.25)",
            color: "var(--sage-300)",
          }}
        >
          {feature.eyebrow}
        </div>
        <h3 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
          {feature.title}
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-6 text-sm md:text-base">
          {feature.description}
        </p>
        <ul className="space-y-2.5">
          {feature.bullets.map((b, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.07 }}
              className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]"
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(26,138,90,0.15)" }}
              >
                <Check size={9} style={{ color: SAGE_LIGHT }} />
              </div>
              {b}
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Visual side */}
      <motion.div
        initial={{ opacity: 0, x: feature.flip ? -30 : 30, scale: 0.97 }}
        animate={inView ? { opacity: 1, x: 0, scale: 1 } : {}}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className={`${feature.flip ? "lg:order-1" : "lg:order-2"} min-h-[340px]`}
      >
        <div
          className="rounded-3xl overflow-hidden h-full p-4 relative"
          style={{
            background: "linear-gradient(135deg, rgba(3,43,34,0.25) 0%, rgba(5,12,8,0.4) 100%)",
            border: "1px solid rgba(26,138,90,0.18)",
            minHeight: "340px",
          }}
        >
          {/* Top gradient accent */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(26,138,90,0.4), transparent)" }}
          />
          <div className="h-full">{feature.visual}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative py-16 px-4 overflow-hidden"
    >
      {/* Per-section background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--section-features)" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-4"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{
              background: "rgba(3,43,34,0.5)",
              border: "1px solid rgba(26,138,90,0.25)",
              color: "var(--sage-300)",
            }}
          >
            <MessageSquare size={11} />
            What Sage can do
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-white">Every way to log.</span>
            <br />
            <span className="gradient-text-sage">Every way to understand.</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Sage adapts to you — not the other way around.
          </p>
        </motion.div>

        {/* Alternating feature rows */}
        <div>
          {features.map((feature, i) => (
            <FeatureRow key={feature.id} feature={feature} index={i} />
          ))}
        </div>

        {/* Zero friction callout */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 rounded-3xl px-8 py-10 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(3,43,34,0.3) 0%, rgba(5,12,8,0.4) 100%)",
            border: "1px solid rgba(26,138,90,0.15)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(61,214,140,0.35), transparent)" }}
          />
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--sage-400)" }}>
            Zero friction logging
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
            No forms. No dropdowns.{" "}
            <span className="gradient-text-sage">Just say it.</span>
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
            Adding an expense is as natural as texting a friend. Sage understands context, figures out the category,
            and logs everything — you never touch a dropdown.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {[
              { icon: <MessageCircle size={14} />, text: "\"Paid ₹18 for lunch at Chipotle\"" },
              { icon: <Mic size={14} />, text: "Speak it — Sage transcribes & categorises" },
              { icon: <Camera size={14} />, text: "Snap a receipt — done in 2 seconds" },
            ].map((ex, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(26,138,90,0.12)",
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ color: "var(--sage-400)" }}>{ex.icon}</span>
                <span>{ex.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
