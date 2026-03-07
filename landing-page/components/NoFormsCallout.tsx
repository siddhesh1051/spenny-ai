"use client";

import { motion } from "framer-motion";
import { MessageCircle, Mic, Camera } from "lucide-react";

const examples = [
  { icon: <MessageCircle size={15} />, text: "\"Paid 18 bucks for lunch at Chipotle\"" },
  { icon: <Mic size={15} />, text: "Speak it — Sage transcribes and categorises" },
  { icon: <Camera size={15} />, text: "Snap a receipt — done in 2 seconds" },
];

export default function NoFormsCallout() {
  return (
    <section className="relative py-16 px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(26,138,90,0.04) 0%, transparent 70%)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative max-w-3xl mx-auto text-center"
      >
        {/* Headline */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--sage-400)" }}>
          Zero friction logging
        </p>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
          No forms. No categories to pick.{" "}
          <span className="gradient-text-sage">Just say it.</span>
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-10 max-w-xl mx-auto">
          Adding an expense is as natural as texting a friend. Sage understands context, figures out the category,
          and logs everything automatically — you never touch a dropdown.
        </p>

        {/* Examples row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {examples.map((ex, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(26,138,90,0.15)",
                color: "var(--text-secondary)",
              }}
            >
              <span style={{ color: "var(--sage-400)" }}>{ex.icon}</span>
              <span>{ex.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
