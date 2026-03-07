"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "What is Sage?",
    a: "Sage is the AI assistant at the core of Spenny. Instead of filling forms, you tell Sage what you spent — in natural language, by voice, via a receipt, or through WhatsApp. Sage extracts details, categorises them, and gives you rich visual answers.",
  },
  {
    q: "Do I need a Groq API key?",
    a: "No. Spenny provides server-side AI by default. You can optionally add your own Groq key in Settings for higher rate limits.",
  },
  {
    q: "How does Gmail sync work?",
    a: "Spenny connects with Gmail read-only permission and scans bank/payment alert emails from HDFC, ICICI, SBI, Axis, Kotak, Paytm, UPI, NEFT, IMPS and more. Expenses are extracted by AI, then imported. Email content is never stored — only amount, merchant, category, and date.",
  },
  {
    q: "Is my data safe?",
    a: "Expense data is stored in Supabase with Row Level Security — only you can access yours. Gmail email content is processed in-memory and immediately discarded. Only extracted fields are saved.",
  },
  {
    q: "Can I use Spenny on mobile?",
    a: "Yes. Spenny is a Progressive Web App — install it from Safari/Chrome on iOS or Android for a native-like experience. A React Native app is also in development.",
  },
  {
    q: "What does Pro unlock?",
    a: "Pro adds WhatsApp integration, Gmail auto-sync, and Telegram integration — all for automatic, hands-free expense ingestion. The core Sage chat experience is free forever.",
  },
];

function FAQItem({ faq, index }: { faq: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: open ? "rgba(3,43,34,0.3)" : "rgba(8,15,11,0.8)",
        border: `1px solid ${open ? "rgba(26,138,90,0.25)" : "rgba(26,138,90,0.1)"}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={15} style={{ color: open ? "var(--sage-300)" : "var(--text-muted)" }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div className="px-6 pb-5">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{faq.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQSection() {
  return (
    <section id="faq" className="relative py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-3">
            <span className="text-white">Common </span>
            <span className="gradient-text-sage">questions</span>
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">Everything you need to know.</p>
        </motion.div>

        <div className="space-y-2.5">
          {faqs.map((faq, i) => (
            <FAQItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
