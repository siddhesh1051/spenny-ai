import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" /><path d="M12 8v4l3 3" />
        <path d="M8 3.5A9.96 9.96 0 0 0 2 12c0 2.4.85 4.6 2.25 6.33" /><path d="M16 3.5A9.96 9.96 0 0 1 22 12c0 2.4-.85 4.6-2.25 6.33" />
      </svg>
    ),
    text: "Track expenses your way — voice, chat, photo, PDF",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    text: "AI analytics & spending insights — ask Sage anything",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
    text: "WhatsApp & Telegram integration — log on the go",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 9h20" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
    text: "Gmail auto-sync — receipts imported automatically",
  },
];

export default function AuthPage() {
  const [tab, setTab] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const switchTab = (t: "signIn" | "signUp") => {
    setTab(t); setError(null); setConfirmMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null); setConfirmMsg(null);
    try {
      if (tab === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: email, groq_api_key: "" } },
        });
        if (error) throw error;
        setConfirmMsg("Check your email for the confirmation link!");
        toast.success("Check your email for the confirmation link!");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { scopes: "email profile", redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PWAInstallPrompt />
      <style>{`
        /* ── animations ── */
        @keyframes aFadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes aFadeIn {
          from { opacity:0; } to { opacity:1; }
        }
        @keyframes aOrb1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(30px,-20px) scale(1.08); }
        }
        @keyframes aOrb2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-20px,30px) scale(1.05); }
        }
        @keyframes aOrb3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(15px,20px) scale(1.1); }
        }
        .a-fi-0 { animation: aFadeUp .55s cubic-bezier(.22,1,.36,1) both .05s; }
        .a-fi-1 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .14s; }
        .a-fi-2 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .22s; }
        .a-fi-3 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .30s; }
        .a-fi-4 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .38s; }
        .a-fi-5 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .46s; }
        .a-fi-6 { animation: aFadeUp .5s  cubic-bezier(.22,1,.36,1) both .52s; }
        .a-left { animation: aFadeIn .7s ease both .1s; }

        /* ── orbs ── */
        .auth-orb1 { animation: aOrb1 12s ease-in-out infinite; }
        .auth-orb2 { animation: aOrb2 16s ease-in-out infinite; }
        .auth-orb3 { animation: aOrb3 10s ease-in-out infinite; }

        /* ── input focus ── */
        .auth-field:focus-within {
          border-color: rgba(22,163,74,.5) !important;
          box-shadow: 0 0 0 3px rgba(22,163,74,.1);
        }

        /* ── primary btn ── */
        .auth-primary {
          background: linear-gradient(135deg,#16a34a,#15803d);
          box-shadow: 0 2px 18px rgba(22,163,74,.35);
          position:relative; overflow:hidden;
          transition: box-shadow .2s, transform .12s;
        }
        .auth-primary:hover { box-shadow: 0 4px 28px rgba(22,163,74,.45); }
        .auth-primary:active { transform: scale(.985); }
        .auth-primary::after {
          content:""; position:absolute; inset:0;
          background: linear-gradient(90deg,transparent,rgba(255,255,255,.13),transparent);
          transform: translateX(-100%);
          transition: transform .55s ease;
        }
        .auth-primary:hover::after { transform: translateX(100%); }

        /* ── tab underline ── */
        .auth-tab-on::after {
          content:""; display:block; height:2px; border-radius:2px;
          background: linear-gradient(90deg,#16a34a,#4ade80);
          margin-top:5px;
        }

        /* ── feature pill ── */
        .auth-feature {
          animation: aFadeUp .45s ease both;
        }
      `}</style>

      <div
        className="flex overflow-hidden bg-background"
        style={{ height: "100dvh" }}
      >
        {/* ════════════════════════════════════════
            LEFT — brand panel (hidden on mobile)
        ════════════════════════════════════════ */}
        <div
          className={`hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-14
            ${mounted ? "a-left" : "opacity-0"}`}
          style={{
            background: "linear-gradient(155deg, #050e08 0%, #071a0f 40%, #0a2416 100%)",
          }}
        >
          {/* Animated orbs */}
          <div
            className="auth-orb1 absolute top-[-10%] left-[-8%] w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(22,163,74,.18) 0%, transparent 65%)", filter: "blur(50px)" }}
          />
          <div
            className="auth-orb2 absolute bottom-[-10%] right-[-5%] w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,.12) 0%, transparent 65%)", filter: "blur(60px)" }}
          />
          <div
            className="auth-orb3 absolute top-[40%] right-[10%] w-[280px] h-[280px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,.07) 0%, transparent 65%)", filter: "blur(40px)" }}
          />

          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #4ade80 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Top — wordmark */}
          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo.png" alt="Spenny AI" className="w-9 h-9 rounded-xl" />
            <div>
              <span className="text-white font-bold text-lg tracking-tight">
                Spenny<span style={{ color: "#4ade80" }}>AI</span>
              </span>
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium mt-[-1px]" style={{ color: "rgba(74,222,128,.55)" }}>
                Agentic Expense Tracker
              </p>
            </div>
          </div>

          {/* Middle — headline + features */}
          <div className="relative z-10">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-4">
              Track expenses<br />
              <span style={{ color: "#4ade80" }}>the way you speak</span>
            </h1>
            <p className="text-[15px] mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,.5)" }}>
              Meet Sage — your AI assistant that logs from conversation, voice, receipts, bank emails, and WhatsApp. No forms. Ever.
            </p>
            <div className="flex flex-col gap-3">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 auth-feature"
                  style={{ animationDelay: `${0.6 + i * 0.08}s` }}
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: "rgba(22,163,74,.15)", border: "1px solid rgba(74,222,128,.2)" }}
                  >
                    {f.icon}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,.75)" }}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — social proof */}
          <div className="relative z-10">
            <p className="text-xs" style={{ color: "rgba(255,255,255,.3)" }}>
              Trusted by early users tracking smarter
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════
            RIGHT — auth panel
        ════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-6 py-10 relative"
          style={{
            background: "radial-gradient(ellipse 90% 60% at 60% 20%, rgba(22,163,74,0.06) 0%, transparent 65%), var(--background)",
          }}
        >

          {/* Mobile logo (only visible < lg) */}
          <div className={`lg:hidden flex flex-col items-center mb-8 ${mounted ? "a-fi-0" : "opacity-0"}`}>
            <img src="/logo.png" alt="Spenny AI" className="w-12 h-12 rounded-2xl mb-2"
              style={{ boxShadow: "0 4px 20px rgba(22,163,74,.2)" }}
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Spenny<span style={{ color: "#16a34a" }}>AI</span>
            </span>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mt-0.5">
              Agentic Expense Tracker
            </p>
          </div>

          {/* Form container */}
          <div className="w-full max-w-[380px]">

            {/* Heading */}
            <div className={`mb-7 ${mounted ? "a-fi-1" : "opacity-0"}`}>
              <h2 className="text-2xl font-bold text-foreground">
                {tab === "signIn" ? "Welcome back" : "Get started"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {tab === "signIn"
                  ? "Sign in to your account"
                  : "Create your free account"}
              </p>
            </div>

            {/* Google first */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className={`w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2.5
                border border-border bg-background hover:bg-muted
                text-foreground transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                ${mounted ? "a-fi-2" : "opacity-0"}`}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className={`flex items-center gap-3 my-5 ${mounted ? "a-fi-3" : "opacity-0"}`}>
              <span className="flex-1 h-px bg-border" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className={`space-y-3 ${mounted ? "a-fi-4" : "opacity-0"}`}>
              <div className="auth-field rounded-xl border border-border bg-background transition-all duration-150 overflow-hidden">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-11 px-4"
                />
              </div>

              <div className="auth-field rounded-xl border border-border bg-background transition-all duration-150 flex items-center overflow-hidden">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  autoComplete={tab === "signIn" ? "current-password" : "new-password"}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-11 px-4 flex-1"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {error && (
                <p className="text-[13px] text-destructive px-1 leading-snug">{error}</p>
              )}
              {confirmMsg && (
                <p className="text-[13px] px-1 leading-snug" style={{ color: "#16a34a" }}>{confirmMsg}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="auth-primary w-full h-11 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Please wait…" : tab === "signIn" ? "Sign in" : "Create account"}
              </button>
            </form>

            {/* Tab switcher */}
            <p className={`text-center text-sm text-muted-foreground mt-6 ${mounted ? "a-fi-5" : "opacity-0"}`}>
              {tab === "signIn" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => switchTab(tab === "signIn" ? "signUp" : "signIn")}
                className="font-semibold cursor-pointer hover:underline transition-colors"
                style={{ color: "#16a34a" }}
              >
                {tab === "signIn" ? "Sign up" : "Sign in"}
              </button>
            </p>

            {/* Terms */}
            <p className={`text-center text-[11px] text-muted-foreground mt-4 leading-relaxed ${mounted ? "a-fi-6" : "opacity-0"}`}>
              By continuing you agree to our{" "}
              <a href="https://spennyai.in/terms" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors">Terms</a>
              {" & "}
              <a href="https://spennyai.in/privacy" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
