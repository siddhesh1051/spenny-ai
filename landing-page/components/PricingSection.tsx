"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, X, ArrowRight } from "lucide-react";

const SAGE_LIGHT = "#3dd68c";
const SAGE_GREEN = "#1a8a5a";

const featureRows = [
  { label: "Sage AI chat",             free: true,  pro: true  },
  { label: "Natural language logging", free: true,  pro: true  },
  { label: "Voice input",              free: true,  pro: true  },
  { label: "Receipt scanning",         free: true,  pro: true  },
  { label: "Bank statement PDF",       free: true,  pro: true  },
  { label: "Spending Q&A",             free: true,  pro: true  },
  { label: "CSV & PDF export",         free: true,  pro: true  },
  { label: "WhatsApp integration",     free: false, pro: true, highlight: true },
  { label: "Gmail auto-sync",          free: false, pro: true, highlight: true },
  { label: "Telegram integration",     free: false, pro: true, highlight: true },
  { label: "Priority AI model",        free: false, pro: true  },
];

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (value === true)
    return (
      <div className="flex justify-center">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: highlight ? "rgba(61,214,140,0.15)" : "rgba(26,138,90,0.12)" }}
        >
          <Check size={10} style={{ color: highlight ? SAGE_LIGHT : SAGE_GREEN }} />
        </div>
      </div>
    );
  if (value === false)
    return (
      <div className="flex justify-center">
        <X size={12} style={{ color: "var(--text-muted)" }} />
      </div>
    );
  return (
    <div className="flex justify-center">
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{
          background: highlight ? "rgba(61,214,140,0.1)" : "rgba(26,138,90,0.08)",
          color: highlight ? SAGE_LIGHT : SAGE_GREEN,
          border: `1px solid ${highlight ? "rgba(61,214,140,0.2)" : "rgba(26,138,90,0.15)"}`,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PricingSection({ onOpenWaitlist, onOpenProWaitlist }: { onOpenWaitlist: () => void; onOpenProWaitlist: () => void }) {
  return (
    <section id="pricing" className="relative py-28 px-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--section-pricing)" }} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: "rgba(3,43,34,0.5)", border: "1px solid rgba(26,138,90,0.25)", color: "var(--sage-300)" }}
          >
            <Sparkles size={11} />
            Simple pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-white">Start free.</span>{" "}
            <span className="gradient-text-sage">Upgrade when ready.</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            Sage is free forever. Pro unlocks automatic ingestion via WhatsApp, Gmail, and Telegram.
          </p>
        </motion.div>

        {/* ── MOBILE: two stacked cards ── */}
        <div className="md:hidden space-y-4">
          {/* Free card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(26,138,90,0.15)", background: "rgba(5,12,8,0.7)" }}
          >
            <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(26,138,90,0.1)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Free</p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-black text-white">Free</span>
                <span className="text-sm text-[var(--text-muted)]">forever</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">Everything to get started.</p>
              <button
                onClick={onOpenWaitlist}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Join Waitlist
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {featureRows.map((row, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{row.label}</span>
                  <Cell value={row.free} />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Pro card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl overflow-hidden relative"
            style={{
              border: "1px solid rgba(26,138,90,0.3)",
              background: "linear-gradient(160deg, rgba(3,43,34,0.6) 0%, rgba(5,12,8,0.8) 100%)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, rgba(61,214,140,0.6), transparent)" }} />
            <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(26,138,90,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SAGE_LIGHT }}>Pro</p>
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "linear-gradient(135deg,#1a8a5a,#0f5e3c)", color: "white" }}
                >
                  <Sparkles size={8} /> Popular
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-black text-white">$9</span>
                <span className="text-sm text-[var(--text-muted)]">/month</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">Automatic ingestion.</p>
              <button
                onClick={onOpenProWaitlist}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer"
                style={{ background: "linear-gradient(135deg, #1a8a5a, #0f5e3c)", boxShadow: "0 0 20px rgba(26,138,90,0.25)" }}
              >
                Show Interest
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {featureRows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-2 -mx-2 py-1"
                  style={{ background: row.highlight ? "rgba(3,43,34,0.3)" : "transparent" }}
                >
                  <span className={`text-sm ${row.highlight ? "text-white font-medium" : "text-[var(--text-secondary)]"}`}>
                    {row.label}
                    {row.highlight && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                        PRO
                      </span>
                    )}
                  </span>
                  <Cell value={row.pro} highlight={row.highlight} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── DESKTOP: 3-column comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hidden md:block rounded-3xl overflow-hidden"
          style={{ border: "1px solid rgba(26,138,90,0.15)", background: "rgba(5,12,8,0.6)" }}
        >
          {/* Column headers */}
          <div className="grid grid-cols-3">
            <div className="px-8 py-8 border-r border-b" style={{ borderColor: "rgba(26,138,90,0.1)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Features</p>
            </div>

            <div className="px-8 py-8 border-r border-b" style={{ borderColor: "rgba(26,138,90,0.1)", background: "rgba(8,15,11,0.5)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">Free</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-4xl font-black text-white">Free</span>
                <span className="text-sm text-[var(--text-muted)]">forever</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-6">Everything to get started.</p>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onOpenWaitlist(); }}
                className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Join Waitlist
              </a>
            </div>

            <div
              className="px-8 py-8 border-b relative overflow-hidden"
              style={{ borderColor: "rgba(26,138,90,0.2)", background: "linear-gradient(160deg, rgba(3,43,34,0.6) 0%, rgba(5,12,8,0.8) 100%)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, rgba(61,214,140,0.6), transparent)" }} />
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SAGE_LIGHT }}>Pro</p>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "linear-gradient(135deg,#1a8a5a,#0f5e3c)", color: "white" }}>
                  <Sparkles size={8} /> Popular
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-white">$9</span>
                <span className="text-sm text-[var(--text-muted)]">/month</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-6">Automatic ingestion.</p>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onOpenProWaitlist(); }}
                className="block w-full text-center py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer"
                style={{ background: "linear-gradient(135deg, #1a8a5a, #0f5e3c)", boxShadow: "0 0 20px rgba(26,138,90,0.25)" }}
              >
                Show Interest
              </a>
            </div>
          </div>

          {featureRows.map((row, i) => {
            const isLast = i === featureRows.length - 1;
            return (
              <div
                key={i}
                className="grid grid-cols-3"
                style={{
                  borderBottom: isLast ? "none" : "1px solid rgba(26,138,90,0.07)",
                  background: row.highlight ? "rgba(3,43,34,0.15)" : "transparent",
                }}
              >
                <div className="px-8 py-4 flex items-center border-r" style={{ borderColor: "rgba(26,138,90,0.07)" }}>
                  <span className={`text-sm ${row.highlight ? "text-white font-medium" : "text-[var(--text-secondary)]"}`}>
                    {row.label}
                    {row.highlight && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                        PRO
                      </span>
                    )}
                  </span>
                </div>
                <div className="px-8 py-4 flex items-center justify-center border-r" style={{ borderColor: "rgba(26,138,90,0.07)", background: "rgba(8,15,11,0.3)" }}>
                  <Cell value={row.free} />
                </div>
                <div className="px-8 py-4 flex items-center justify-center" style={{ background: "rgba(3,43,34,0.08)" }}>
                  <Cell value={row.pro} highlight={row.highlight} />
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-xs text-[var(--text-muted)] mt-6"
        >
          No credit card required · Cancel anytime · Prices in USD
        </motion.p>
      </div>
    </section>
  );
}
