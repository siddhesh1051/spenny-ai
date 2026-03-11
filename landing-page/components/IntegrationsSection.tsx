"use client";

import { motion } from "framer-motion";
import { Check, Key, Sparkles } from "lucide-react";

const SAGE_GREEN = "#1a8a5a";
const SAGE_LIGHT = "#3dd68c";

/* ── Demo message components ── */
function WAMessage({ role, text }: { role: "user" | "bot"; text: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[88%] rounded-xl px-2.5 py-1.5 text-[10px] leading-relaxed whitespace-pre-line"
        style={
          role === "user"
            ? { background: "rgba(37,211,102,0.15)", color: "#86efac", border: "1px solid rgba(37,211,102,0.2)" }
            : { background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }
        }
      >
        {text}
      </div>
    </div>
  );
}

function GmailRow({ amount, merchant, bank }: { amount: string; merchant: string; bank: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <p className="text-[11px] font-medium text-white">{merchant}</p>
        <p className="text-[9px] text-[var(--text-muted)]">{bank}</p>
      </div>
      <span className="text-[11px] font-semibold" style={{ color: SAGE_LIGHT }}>{amount}</span>
    </div>
  );
}

export default function IntegrationsSection() {
  return (
    <section id="integrations" className="relative py-28 px-4 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--section-integrations)" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{
              background: "rgba(3,43,34,0.5)",
              border: "1px solid rgba(26,138,90,0.25)",
              color: "var(--sage-300)",
            }}
          >
            <Sparkles size={11} />
            Integrations
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-white">Log from anywhere.</span>
            <br />
            <span className="gradient-text-sage">Automatically.</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            Connect the tools you already use. Spenny captures expenses without changing your habits.
          </p>
        </motion.div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

          {/* WhatsApp — 7/12 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="md:col-span-7 rounded-3xl p-6 relative overflow-hidden"
            style={{
              background: "rgba(5,12,8,0.85)",
              border: "1px solid rgba(37,211,102,0.2)",
              boxShadow: "0 0 50px rgba(37,211,102,0.04)",
            }}
          >
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(37,211,102,0.4), transparent)" }} />
            {/* Pro badge */}
            <div
              className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              ✦ PRO
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.2)" }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#25d366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">WhatsApp</h3>
                <p className="text-xs text-[var(--text-secondary)]">Log expenses from your chat</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Description */}
              <div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                  Link your WhatsApp number (OTP verified) and message the Spenny bot to log expenses, ask spending questions, or export your data — without opening the app.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Log by message", "Spending queries", "CSV/PDF export", "OTP-verified"].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(37,211,102,0.08)", color: "#86efac", border: "1px solid rgba(37,211,102,0.15)" }}>{tag}</span>
                  ))}
                </div>
              </div>
              {/* Demo chat */}
              <div className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(37,211,102,0.1)" }}>
                <p className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: "rgba(37,211,102,0.5)" }}>WhatsApp chat</p>
                <WAMessage role="user" text="Spent ₹500 on groceries and ₹200 cab" />
                <WAMessage role="bot" text={"✅ Logged!\n• Groceries · ₹500\n• Transport · ₹200\nTotal today: ₹700"} />
                <WAMessage role="user" text="How much did I spend this week?" />
                <WAMessage role="bot" text={"📊 This week: ₹4,280\nFood 42% · Transport 28% · Other 30%"} />
              </div>
            </div>
          </motion.div>

          {/* Telegram — 5/12 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-5 rounded-3xl p-5 relative overflow-hidden"
            style={{
              background: "rgba(5,12,8,0.85)",
              border: "1px solid rgba(44,165,224,0.18)",
            }}
          >
            <div
              className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(26,138,90,0.1)", color: SAGE_LIGHT, border: "1px solid rgba(26,138,90,0.2)" }}
            >
              Free
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(44,165,224,0.12)", border: "1px solid rgba(44,165,224,0.2)" }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#2CA5E0">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Telegram</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
              Same natural language Sage interface in Telegram. Log, query, and export
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Natural language", "Spending queries", "Coming soon"].map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(44,165,224,0.08)", color: "#7ec8e3", border: "1px solid rgba(44,165,224,0.15)" }}>{tag}</span>
              ))}
            </div>
          </motion.div>

          {/* Gmail Auto-Sync — 7/12 (slightly less than half+, wider than half) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="md:col-span-7 rounded-3xl p-6 relative overflow-hidden"
            style={{
              background: "rgba(5,12,8,0.85)",
              border: "1px solid rgba(234,67,53,0.18)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(234,67,53,0.35), transparent)" }} />
            <div
              className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              ✦ PRO
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,67,53,0.1)", border: "1px solid rgba(234,67,53,0.18)" }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.148C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Gmail Auto-Sync</h3>
                <p className="text-xs text-[var(--text-secondary)]">Automatic expense import from bank emails</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                  Connect Gmail (read-only). Sage scans bank and payment alert emails from HDFC, ICICI, SBI, Axis, Kotak, Paytm, UPI, NEFT, IMPS and more — extracts amounts, merchants, and categories with AI, and imports them. Email content is never stored.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["12+ bank parsers", "AI classification", "Incremental sync", "10s undo", "Debit-only"].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(234,67,53,0.08)", color: "#fca5a5", border: "1px solid rgba(234,67,53,0.15)" }}>{tag}</span>
                  ))}
                </div>
              </div>
              {/* Sync results */}
              <div className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(234,67,53,0.1)" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "rgba(234,67,53,0.6)" }}>Last sync · 47 imported</p>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: SAGE_LIGHT }} />
                    <span className="text-[9px]" style={{ color: SAGE_LIGHT }}>Live</span>
                  </div>
                </div>
                <GmailRow amount="₹1,240" merchant="Swiggy Order" bank="HDFC · Debit" />
                <GmailRow amount="₹350" merchant="Ola Cab" bank="ICICI · UPI" />
                <GmailRow amount="₹2,800" merchant="Amazon" bank="SBI · NetBanking" />
                <GmailRow amount="₹180" merchant="Zepto Groceries" bank="Axis · UPI" />
              </div>
            </div>
          </motion.div>

          {/* MCP & API — 5/12 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-5 rounded-3xl p-5 relative overflow-hidden"
            style={{
              background: "rgba(5,12,8,0.85)",
              border: "1px solid rgba(26,138,90,0.18)",
            }}
          >
            <div
              className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(26,138,90,0.1)", color: SAGE_LIGHT, border: "1px solid rgba(26,138,90,0.2)" }}
            >
              Free
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(26,138,90,0.12)", border: "1px solid rgba(26,138,90,0.2)" }}>
              <Key size={18} style={{ color: SAGE_LIGHT }} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">MCP & API Keys</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
              Integrate with Claude Desktop via MCP server or build on top of Spenny with programmatic API access - coming soon.
            </p>
            <ul className="space-y-1.5">
              {["Claude Desktop integration", "RESTful API access", "Free on all plans"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Check size={10} style={{ color: SAGE_LIGHT, flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
