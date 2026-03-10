import React, { useEffect, useRef, useState } from "react";

const APP_NAME = "Spenny AI";
const ICON_SRC = "/logo.png";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  return (
    /android|iphone|ipad|ipod|windows phone/i.test(ua) ||
    window.innerWidth <= 768
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveDir, setLeaveDir] = useState<"up" | "right">("up");

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      if (!isMobileDevice()) return;
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 1500);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () =>
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => dismiss("up"), 8000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dismiss = (dir: "up" | "right" = "up") => {
    setLeaveDir(dir);
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, 340);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") dismiss("up");
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dx > 60 && Math.abs(dy) < 40) { dismiss("right"); return; }
    if (dy < -50 && Math.abs(dx) < 60) { dismiss("up"); return; }
  };

  if (!visible && !leaving) return null;
  if (!isMobileDevice()) return null;

  // Animate only the inner card — outer wrapper is just a static centered anchor
  const cardStyle: React.CSSProperties = {
    animation: leaving
      ? leaveDir === "right"
        ? "pwa-out-right 0.32s cubic-bezier(0.4,0,1,1) forwards"
        : "pwa-out-up 0.32s cubic-bezier(0.4,0,1,1) forwards"
      : "pwa-in 0.42s cubic-bezier(0.22,1.4,0.36,1) forwards",
    willChange: "transform, opacity",
  };

  return (
    <>
      <style>{`
        @keyframes pwa-in {
          0%   { transform: translateY(-24px); opacity: 0; }
          100% { transform: translateY(0px);   opacity: 1; }
        }
        @keyframes pwa-out-up {
          0%   { transform: translateY(0px);   opacity: 1; }
          100% { transform: translateY(-32px); opacity: 0; }
        }
        @keyframes pwa-out-right {
          0%   { transform: translateX(0px);    opacity: 1; }
          100% { transform: translateX(110vw);  opacity: 0; }
        }
      `}</style>

      {/* Static centering wrapper — never animates */}
      <div
        className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
      >
        {/* Animated card */}
        <div
          className="relative w-full max-w-sm pointer-events-auto"
          style={cardStyle}
          role="dialog"
          aria-label="Install app prompt"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* × corner button */}
          <button
            onClick={() => dismiss("up")}
            aria-label="Dismiss"
            className="absolute -top-2 -right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer"
            style={{
              background: "rgba(38,38,42,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.55)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Card body */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(16,16,18,0.92)",
              backdropFilter: "blur(28px) saturate(200%)",
              WebkitBackdropFilter: "blur(28px) saturate(200%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={ICON_SRC}
              alt=""
              className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                Add {APP_NAME} to home
              </p>
              <p className="text-xs mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.42)" }}>
                Instant native experience, works offline
              </p>
            </div>

            <button
              onClick={handleInstall}
              className="flex-shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 active:scale-95 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, rgba(26,138,90,0.92), rgba(15,94,60,0.92))",
                color: "#fff",
                border: "1px solid rgba(26,138,90,0.4)",
                boxShadow: "0 2px 10px rgba(26,138,90,0.28)",
              }}
            >
              Install
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PWAInstallPrompt;
