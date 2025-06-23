import React, { useEffect, useState } from "react";

const APP_NAME = "Spenny AI";
const APP_URL = "spenny.ai"; // Change if you have a custom domain
const ICON_SRC = "/icon-192.png";

// Utility to detect mobile devices
function isMobileDevice() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  // iOS, Android, Windows Phone
  return (
    /android|iphone|ipad|ipod|windows phone/i.test(ua) ||
    window.innerWidth <= 600
  );
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if (!isMobileDevice()) return;
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handler as EventListener
      );
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => handleClose(), 5000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") handleClose();
    }
  };

  const handleClose = () => {
    setAnimateOut(true);
    setTimeout(() => {
      setVisible(false);
      setAnimateOut(false);
    }, 400); // match animation duration
  };

  if ((!visible && !animateOut) || !isMobileDevice()) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 z-50 w-[95vw]  max-w-xl  rounded-2xl bg-zinc-900 shadow-2xl flex items-center p-4 border border-zinc-700 transition-transform duration-400 ease-in-out
        ${animateOut ? "animate-slide-up" : "animate-slide-down"}`}
      style={{ willChange: "transform, opacity" }}
    >
      <style>{`
        @keyframes slide-down {
          0% { transform: translate(-50%, -100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slide-up {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -100%); opacity: 0; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.4,0,0.2,1) forwards;
        }
      `}</style>
      <img
        src={ICON_SRC}
        alt="App Icon"
        className="w-12 h-12 rounded-full mr-4 border border-zinc-700 bg-zinc-800"
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-lg text-white truncate">
          Install {APP_NAME}
        </div>
        <div className="text-zinc-400 text-sm truncate">www.{APP_URL}</div>
      </div>
      <button
        onClick={handleInstall}
        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition"
      >
        Install
      </button>
      <button
        onClick={handleClose}
        className="ml-2 text-zinc-400 hover:text-zinc-200 text-xl font-bold"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default PWAInstallPrompt;
