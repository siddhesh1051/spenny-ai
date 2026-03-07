"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight, Check } from "lucide-react";

const REFERRAL_OPTIONS = [
  "LinkedIn",
  "Twitter / X",
  "Product Hunt",
  "Friend or colleague",
  "Google search",
  "Reddit",
  "Other",
];

interface Props {
  open: boolean;
  onClose: () => void;
  interestedInPro?: boolean;
}

export default function WaitlistModal({ open, onClose, interestedInPro = false }: Props) {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [referral, setReferral] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Reset form when modal opens fresh
  useEffect(() => {
    if (open) {
      setEmail("");
      setMobile("");
      setReferral("");
      setStatus("idle");
      setErrorMsg("");
    }
  }, [open]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          mobile: mobile || undefined,
          referral: referral || undefined,
          interestedInPro,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-md rounded-3xl p-8 pointer-events-auto"
              style={{
                background: interestedInPro
                  ? "linear-gradient(145deg, rgba(3,25,16,0.99) 0%, rgba(3,10,7,0.99) 100%)"
                  : "linear-gradient(145deg, rgba(5,20,14,0.98) 0%, rgba(3,10,7,0.99) 100%)",
                border: interestedInPro
                  ? "1px solid rgba(61,214,140,0.3)"
                  : "1px solid rgba(26,138,90,0.25)",
                boxShadow: "0 0 80px rgba(26,138,90,0.12), 0 40px 80px rgba(0,0,0,0.7)",
              }}
            >
              {/* Top glow line */}
              <div
                className="absolute top-0 left-8 right-8 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(61,214,140,0.5), transparent)" }}
              />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl transition-colors cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>

              {status === "success" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: "rgba(26,138,90,0.15)", border: "1px solid rgba(26,138,90,0.3)" }}
                  >
                    <Check size={24} style={{ color: "#3dd68c" }} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {interestedInPro ? "Interest noted!" : "You're on the list!"}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {interestedInPro
                      ? "We've noted your interest in Spenny Pro. We'll reach out with early Pro access and pricing details."
                      : "We'll notify you the moment Spenny AI is ready for you. Keep an eye on your inbox."}
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 px-6 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
                    style={{
                      background: "rgba(26,138,90,0.15)",
                      border: "1px solid rgba(26,138,90,0.25)",
                      color: "#3dd68c",
                    }}
                  >
                    Close
                  </button>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
                      style={{
                        background: interestedInPro
                          ? "linear-gradient(135deg, rgba(26,138,90,0.2), rgba(15,94,60,0.2))"
                          : "rgba(3,43,34,0.6)",
                        border: interestedInPro
                          ? "1px solid rgba(61,214,140,0.3)"
                          : "1px solid rgba(26,138,90,0.2)",
                        color: "var(--sage-300)",
                      }}
                    >
                      <Sparkles size={10} />
                      {interestedInPro ? "Pro early access" : "Early access"}
                    </div>

                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {interestedInPro ? "Show interest in Pro" : "Join the waitlist"}
                    </h2>
                    <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {interestedInPro
                        ? "Tell us you're interested in Pro and we'll reach out with early access details."
                        : "Be first to try Spenny AI — the expense tracker you talk to."}
                    </p>

                    {/* Pro plan context pill */}
                    {interestedInPro && (
                      <div
                        className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(26,138,90,0.08)", border: "1px solid rgba(26,138,90,0.2)" }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#1a8a5a,#0f5e3c)" }}
                        >
                          <Sparkles size={12} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white leading-none mb-0.5">Spenny Pro · $9/mo</p>
                          <p className="text-[10px] leading-none" style={{ color: "var(--text-muted)" }}>
                            WhatsApp · Gmail sync · Telegram · Priority AI
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Email <span style={{ color: "#3dd68c" }}>*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(26,138,90,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                    </div>

                    {/* Mobile */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Mobile number <span className="opacity-40 font-normal">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="+1 555 000 0000"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(26,138,90,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                    </div>

                    {/* Referral */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        How did you hear about us? <span className="opacity-40 font-normal">(optional)</span>
                      </label>
                      <select
                        value={referral}
                        onChange={(e) => setReferral(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: referral ? "white" : "rgba(255,255,255,0.3)",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(26,138,90,0.5)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      >
                        <option value="" disabled style={{ background: "#050f08" }}>Select an option</option>
                        {REFERRAL_OPTIONS.map((o) => (
                          <option key={o} value={o} style={{ background: "#050f08" }}>{o}</option>
                        ))}
                      </select>
                    </div>

                    {errorMsg && (
                      <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all mt-2"
                      style={{
                        background: status === "loading"
                          ? "rgba(26,138,90,0.4)"
                          : "linear-gradient(135deg, #1a8a5a 0%, #0f5e3c 100%)",
                        boxShadow: status === "loading" ? "none" : "0 0 30px rgba(26,138,90,0.2), 0 4px 16px rgba(0,0,0,0.3)",
                        cursor: status === "loading" ? "not-allowed" : "pointer",
                      }}
                    >
                      {status === "loading" ? (
                        <span className="opacity-70">Submitting...</span>
                      ) : (
                        <>
                          {interestedInPro ? "Show Interest in Pro" : "Join Waitlist"}
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>

                    <p className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
                      No spam. We&apos;ll only email you when access is ready.
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
