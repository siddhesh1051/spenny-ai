"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
];

function LogoIcon({ size = 28 }: { size?: number }) {
  const BG = "#030c07";
  const G1 = "#3dd68c";
  const G2 = "#1a8a5a";
  const G3 = "#0a3d22";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nav-cg" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
        <radialGradient id="nav-rg" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor={G2} stopOpacity="0.18" />
          <stop offset="100%" stopColor={G2} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={BG} />
      <rect width="64" height="64" rx="14" fill="url(#nav-rg)" />
      <g transform="translate(32,32) scale(0.76) translate(-32,-31)">
        {/* Coin fill */}
        <circle cx="32" cy="28" r="22" fill="url(#nav-cg)" opacity="0.13" />
        {/* Coin outer ring */}
        <circle cx="32" cy="28" r="22" fill="none" stroke="url(#nav-cg)" strokeWidth="2.5" />
        {/* Inner ring */}
        <circle cx="32" cy="28" r="15" fill="none" stroke={G1} strokeWidth="1" strokeOpacity="0.22" />
        {/* Chat tail */}
        <path d="M22 50 C18 57 12 61 8 63 C17 60 27 55 33 48" fill="url(#nav-cg)" />
        {/* Three dots */}
        <circle cx="25" cy="28" r="2.6" fill="url(#nav-cg)" />
        <circle cx="32" cy="28" r="2.6" fill="url(#nav-cg)" />
        <circle cx="39" cy="28" r="2.6" fill="url(#nav-cg)" />
      </g>
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
              <LogoIcon size={28} />
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
