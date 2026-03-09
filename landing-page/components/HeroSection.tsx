"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onOpenWaitlist: () => void;
}

const AVATAR_URLS = [
  "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=80&q=80",
];

function WaitlistSocialProof() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist-count")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 10))
      .catch(() => setCount(10));
  }, []);

  const displayCount = count !== null ? `${count}+` : "10+";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="flex items-center justify-center gap-3 mb-4 mt-3"
    >
      {/* Overlapping avatar circles */}
      <div className="flex items-center">
        {AVATAR_URLS.slice(0, 5).map((url, i) => (
          <div
            key={i}
            className="rounded-full overflow-hidden flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              border: "2px solid rgba(5,12,8,1)",
              boxShadow: "0 0 0 1px rgba(26,138,90,0.2)",
              marginLeft: i === 0 ? 0 : -10,
              zIndex: 5 - i,
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              width={36}
              height={36}
              style={{ width: 36, height: 36, objectFit: "cover", display: "block" }}
            />
          </div>
        ))}
      </div>

      {/* Count */}
      <p style={{ color: "var(--text-secondary)", fontWeight: 400 }} className="text-sm font-semibold leading-none">
        {displayCount}{" "}
        <span>Joined</span>
      </p>
    </motion.div>
  );
}

export default function HeroSection({ onOpenWaitlist }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const screenshotY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const screenshotOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.4]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-28 pb-0 px-4"
    >
      {/* Per-section background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--section-hero)" }}
      />

      {/* Dot grid texture */}
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

      {/* Animated orbs */}
      <div
        className="absolute top-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full pointer-events-none animate-orb-pulse"
        style={{
          background: "radial-gradient(circle, rgba(3,43,34,0.6) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute top-[5%] right-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none animate-float"
        style={{
          background: "radial-gradient(circle, rgba(26,138,90,0.08) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* ── Text content ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-7"
        >
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(3,43,34,0.6)",
              border: "1px solid rgba(26,138,90,0.3)",
              color: "var(--sage-300)",
            }}
          >
            <Sparkles size={11} className="opacity-80" />
            Agentic Expense Tracker
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.04] mb-5"
        >
          <span className="text-white">Track expenses</span>
          <br />
          <span className="gradient-text-sage">the way you speak</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed mb-6"
        >
          Meet <span className="text-[var(--sage-300)] font-semibold">Sage</span> — your AI assistant that logs from conversation, voice, receipts, bank emails, and WhatsApp.{" "}
          <span className="text-white font-medium">No forms. Ever.</span>
        </motion.p>

        {/* Social proof — above CTA buttons */}
        <WaitlistSocialProof />

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <a
            href="#pricing"
            onClick={(e) => { e.preventDefault(); onOpenWaitlist(); }}
            className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all duration-200 relative cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #1a8a5a 0%, #0f5e3c 100%)",
              boxShadow: "0 0 35px rgba(26,138,90,0.25), 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            Join Waitlist
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#features"
            className="flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
            }}
          >
            See how it works
          </a>
        </motion.div>
      </div>

      {/* ── Product screenshot ── */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ y: screenshotY, opacity: screenshotOpacity }}
        className="relative z-10 w-full max-w-7xl mx-auto"
      >
        {/* Glow halo behind screenshot */}
        <div
          className="absolute -inset-8 rounded-3xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(26,138,90,0.12) 0%, transparent 65%)",
            filter: "blur(20px)",
          }}
        />

        {/* Browser chrome frame */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(26,138,90,0.2)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(26,138,90,0.06)",
          }}
        >
          {/* Window chrome bar */}
          <div
            className="flex items-center gap-1.5 px-4 py-2.5"
            style={{
              background: "rgba(8,15,11,0.95)",
              borderBottom: "1px solid rgba(26,138,90,0.12)",
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <div className="flex-1 flex justify-center">
              <div
                className="px-3 py-0.5 rounded-full text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-muted)",
                }}
              >
                app.spenny.ai/sage
              </div>
            </div>
          </div>

          {/* Screenshot */}
          <div className="relative" style={{ maxHeight: "650px", overflow: "hidden" }}>
            <Image
              src="/screenshot-sage.png"
              alt="Sage — AI chat interface"
              width={1280}
              height={800}
              className="w-full h-auto block"
              priority
            />
            {/* Bottom gradient fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{
                background: "linear-gradient(to top, var(--bg-primary), transparent)",
              }}
            />
          </div>
        </div>

        {/* Floating stat cards */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          className="absolute -left-6 top-24 z-20 rounded-2xl px-4 py-3 hidden lg:block"
          style={{
            background: "rgba(13,23,16,0.95)",
            border: "1px solid rgba(26,138,90,0.25)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          <p className="text-[10px] text-[var(--text-muted)] mb-0.5">This month</p>
          <p className="text-lg font-bold text-white">₹24,800</p>
          <p className="text-[10px] text-[var(--sage-400)]">↓ 12% vs last month</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.6, duration: 0.5 }}
          className="absolute -right-6 top-20 z-20 rounded-2xl px-4 py-3 hidden lg:block"
          style={{
            background: "rgba(13,23,16,0.95)",
            border: "1px solid rgba(26,138,90,0.25)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Biggest category</p>
          <div className="flex items-center gap-1.5">
            <span className="text-base">🍽️</span>
            <p className="text-sm font-bold text-white">Food</p>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">42% of spending</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.5 }}
          className="absolute -right-6 bottom-40 z-20 rounded-2xl px-4 py-3 hidden xl:block"
          style={{
            background: "rgba(13,23,16,0.95)",
            border: "1px solid rgba(26,138,90,0.25)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Logged via voice</p>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--sage-400)" }}
            />
            <p className="text-xs font-semibold text-white">₹350 — Uber</p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
