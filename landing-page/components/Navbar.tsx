"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
];

function CloverIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2C16 2 16 9 16 9C16 9 9 9 9 16C9 16 9 23 16 23C16 23 16 30 16 30C16 30 23 30 23 23C23 23 30 23 30 16C30 16 30 9 23 9C23 9 23 2 16 2Z"
        fill="url(#clover-grad)"
        opacity="0.9"
      />
      <path
        d="M16 9C16 9 9 9 9 16C9 16 2 16 2 16C2 16 2 9 9 9C9 9 9 2 16 2C16 2 16 9 16 9Z"
        fill="url(#clover-grad2)"
        opacity="0.7"
      />
      <defs>
        <linearGradient id="clover-grad" x1="9" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3dd68c" />
          <stop offset="1" stopColor="#0f5e3c" />
        </linearGradient>
        <linearGradient id="clover-grad2" x1="2" y1="2" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3dd68c" />
          <stop offset="1" stopColor="#1a8a5a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface NavbarProps {
  onOpenWaitlist: () => void;
}

export default function Navbar({ onOpenWaitlist }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
      >
        <div
          className={`w-full max-w-7xl rounded-2xl transition-all duration-400 ${
            scrolled
              ? "glass-card shadow-2xl shadow-black/60"
              : "bg-transparent border border-transparent"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-3">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2.5 cursor-pointer">
              <CloverIcon size={28} />
              <span className="font-semibold text-lg tracking-tight text-white">
                Spenny <span className="gradient-text-sage">AI</span>
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors duration-200 rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Single CTA */}
            <div className="hidden md:flex">
              <button
                onClick={onOpenWaitlist}
                className="group flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-all duration-200 relative overflow-hidden cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #1a8a5a, #0f5e3c)",
                  boxShadow: "0 0 20px rgba(26,138,90,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                Join Waitlist
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Mobile button */}
            <button
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 top-20 z-40 glass-card rounded-2xl p-4 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => { setMobileOpen(false); onOpenWaitlist(); }}
                  className="block w-full px-4 py-3 text-sm font-semibold text-center rounded-xl text-white transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #1a8a5a, #0f5e3c)" }}
                >
                  Join Waitlist
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
