"use client";

import { motion } from "framer-motion";
import { MessageSquare, Cpu, PieChart, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Tell Sage anything",
    description: "Type a message, speak out loud, upload a receipt or bank statement — Sage understands every input format without you adapting your behaviour.",
    examples: ['"Spent ₹800 at Swiggy"', "Upload receipt", '"Paid rent ₹15,000"', "WhatsApp message"],
    color: "#1a8a5a",
  },
  {
    number: "02",
    icon: Cpu,
    title: "Sage processes with AI",
    description: "Groq's Llama 3.3 classifies intent, extracts amounts, merchants, dates and categories — then builds a custom UI layout to show the result.",
    examples: ["Intent classification", "Amount extraction", "Category tagging", "UI composition"],
    color: "#22b572",
  },
  {
    number: "03",
    icon: PieChart,
    title: "See rich, live insights",
    description: "Every response is a unique composition of charts, metric cards, tables and insight callouts. Ask follow-ups, compare months, export — all in conversation.",
    examples: ["Category breakdown", "Month comparison", "Insight callouts", "CSV/PDF export"],
    color: "#3dd68c",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-28 px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(3,43,34,0.2) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
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
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="text-white">Three steps to</span>
            <br />
            <span className="gradient-text-sage">effortless tracking</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
            From input to insight in seconds. No setup, no categories to configure.
          </p>
        </motion.div>

        {/* Connector line */}
        <div className="relative">
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 w-[calc(100%-200px)] h-px hidden lg:block"
            style={{ background: "linear-gradient(90deg, transparent, rgba(26,138,90,0.2), rgba(61,214,140,0.3), transparent)" }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 36 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: i * 0.13 }}
                  className="relative"
                >
                  {i < steps.length - 1 && (
                    <div className="absolute -right-5 top-9 z-10 hidden lg:block">
                      <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}

                  <div
                    className="relative rounded-3xl p-7 h-full"
                    style={{ background: "rgba(8,15,11,0.85)", border: "1px solid rgba(26,138,90,0.15)" }}
                  >
                    <div
                      className="text-8xl font-black leading-none select-none absolute top-4 right-5"
                      style={{ color: step.color, opacity: 0.07 }}
                    >
                      {step.number}
                    </div>

                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                      style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}
                    >
                      <Icon size={20} style={{ color: step.color }} />
                    </div>

                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: step.color }}>
                      Step {step.number}
                    </div>

                    <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">{step.description}</p>

                    <div className="flex flex-wrap gap-1.5">
                      {step.examples.map((ex) => (
                        <span
                          key={ex}
                          className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                          style={{ background: `${step.color}0d`, color: step.color, border: `1px solid ${step.color}20` }}
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
