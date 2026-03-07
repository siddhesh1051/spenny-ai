"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Integrations", href: "#integrations" },
    { label: "Pricing", href: "#pricing" },
  ],
  Company: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ],
};

function LogoIcon({ size = 24 }: { size?: number }) {
  const BG = "#030c07";
  const G1 = "#3dd68c";
  const G2 = "#1a8a5a";
  const G3 = "#0a3d22";
  const bubble = "M 50,14 A 30,30 0 1,1 24,60 C 18,70 11,78 8,88 C 20,80 32,72 38,68 A 30,30 0 0,1 50,74 A 30,30 0 0,1 50,14 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="footer-cg" x1="10" y1="5" x2="90" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor={G1} />
          <stop offset="0.55" stopColor={G2} />
          <stop offset="1" stopColor={G3} />
        </linearGradient>
        <radialGradient id="footer-rg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={G2} stopOpacity="0.2" />
          <stop offset="100%" stopColor={G2} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={BG} />
      <rect width="100" height="100" rx="22" fill="url(#footer-rg)" />
      <path d={bubble} fill="url(#footer-cg)" opacity="0.15" />
      <path d={bubble} fill="none" stroke="url(#footer-cg)" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="50" cy="44" r="20" fill="none" stroke={G1} strokeWidth="1.4" strokeOpacity="0.22" />
      <circle cx="38" cy="44" r="3.8" fill="url(#footer-cg)" />
      <circle cx="50" cy="44" r="3.8" fill="url(#footer-cg)" />
      <circle cx="62" cy="44" r="3.8" fill="url(#footer-cg)" />
    </svg>
  );
}

export default function Footer({ onOpenWaitlist }: { onOpenWaitlist: () => void }) {
  return (
    <footer
      className="relative border-t overflow-hidden"
      style={{ borderColor: "rgba(26,138,90,0.12)" }}
    >
      {/* CTA Banner */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto my-14 max-w-7xl rounded-3xl p-10 md:p-16 text-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(3,43,34,0.5) 0%, rgba(5,12,8,0.6) 100%)",
          border: "1px solid rgba(26,138,90,0.2)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(26,138,90,0.08) 0%, transparent 60%)" }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(26,138,90,0.4), transparent)" }}
        />
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: "rgba(3,43,34,0.5)", border: "1px solid rgba(26,138,90,0.25)", color: "var(--sage-300)" }}
          >
            <Sparkles size={10} />
            Free forever — no credit card needed
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Stop entering expenses.
            <br />
            <span className="gradient-text-sage">Start talking to Sage.</span>
          </h2>
          <p className="text-[var(--text-secondary)] max-w-lg mx-auto mb-8 text-sm">
            Join early users who replaced spreadsheets and form-based trackers with a single AI conversation.
          </p>
          <button
            onClick={onOpenWaitlist}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #1a8a5a, #0f5e3c)",
              boxShadow: "0 0 35px rgba(26,138,90,0.25), 0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            Join Waitlist
            <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>

      {/* Footer links */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-2">
            <a href="#" className="flex items-center gap-2 mb-4">
              <LogoIcon size={24} />
              <span className="font-semibold text-white">
                Spenny <span className="gradient-text-sage">AI</span>
              </span>
            </a>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3 max-w-xs">
              The agentic expense tracker. Powered by Sage — an advanced AI model that understands your money.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid rgba(26,138,90,0.1)" }}
        >
          <p className="text-xs text-[var(--text-muted)]">
            © {new Date().getFullYear()} Spenny AI. All rights reserved.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Powered by an advanced AI model &mdash; built for real people.
          </p>
        </div>
      </div>
    </footer>
  );
}
