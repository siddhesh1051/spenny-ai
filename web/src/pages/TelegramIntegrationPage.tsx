import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiUrl, apiHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Unlink,
} from "lucide-react";

type LinkStep = "idle" | "generated" | "linked";

export default function TelegramIntegrationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<LinkStep>("idle");
  const [deepLink, setDeepLink] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [polling, setPolling] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        await checkLinkedStatus(user);
      }
      setLoading(false);
    };
    fetchUser();

    return () => {
      stopPolling();
      stopCountdown();
    };
  }, []);

  async function checkLinkedStatus(u?: User): Promise<boolean> {
    const currentUser = u || user;
    if (!currentUser) return false;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return false;

    try {
      const res = await fetch(apiUrl("/telegram/link", "action=status"), {
        headers: apiHeaders(token),
      });
      const data = await res.json();
      if (data.linked) {
        setStep("linked");
        return true;
      }
    } catch (err) {
      console.error("Status check error:", err);
    }
    return false;
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
  }

  function stopCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown(expiresAt: Date) {
    stopCountdown();
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        stopPolling();
        stopCountdown();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }

  function startPolling() {
    stopPolling();
    setPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      const linked = await checkLinkedStatus();
      if (linked) {
        // stop polling — linked state is already set inside checkLinkedStatus
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setPolling(false);
      }
    }, 3000);
  }

  const generateLink = async () => {
    if (!user) return;
    setIsSubmitting(true);
    stopPolling();
    stopCountdown();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(apiUrl("/telegram/link"), {
        method: "POST",
        headers: apiHeaders(token, { "Content-Type": "application/json" }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to generate link");
        return;
      }

      setDeepLink(data.deepLink);
      const expires = new Date(data.expiresAt);
      setStep("generated");
      startCountdown(expires);
      startPolling();
      toast.success("Link generated! Open it in Telegram.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate link");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Watch for linked status after polling confirms it
  useEffect(() => {
    if (step === "linked") {
      stopPolling();
      stopCountdown();
    }
  }, [step]);

  const unlinkTelegram = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(apiUrl("/telegram/link"), {
        method: "DELETE",
        headers: apiHeaders(token),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to unlink Telegram");
        return;
      }

      setStep("idle");
      setDeepLink("");
      setTimeLeft("");
      toast.success("Telegram unlinked successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to unlink Telegram");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInTelegram = () => {
    if (deepLink) window.open(deepLink, "_blank");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Connect your Telegram account to log expenses and query your spending
          via chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Linked state ── */}
        {step === "linked" && (
          <>
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 [&>svg]:static [&>svg]:inline [&>svg]:mr-2 [&>svg~*]:pl-0 flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <AlertTitle className="text-green-800 dark:text-green-300 leading-tight">
                  Telegram is connected
                </AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-400 text-xs mt-0.5">
                  Send expenses or ask questions directly from Telegram.
                </AlertDescription>
              </div>
            </Alert>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">
                What you can do
              </p>
              <ul className="space-y-1">
                <li>📝 <span className="italic">Spent 50 on coffee</span> — log expenses</li>
                <li>🎙️ Send a voice note to log by voice</li>
                <li>❓ <span className="italic">How much last month?</span> — ask questions</li>
                <li>📤 /export — download CSV or PDF</li>
                <li>💡 <span className="italic">Help me save money</span> — get insights</li>
              </ul>
            </div>

            <Button
              onClick={unlinkTelegram}
              variant="destructive"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect Telegram
                </>
              )}
            </Button>
          </>
        )}

        {/* ── Generated state: waiting for user to click link ── */}
        {step === "generated" && (
          <>
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm">
                Click the button below to open Telegram. The bot will confirm
                the connection automatically.
                {timeLeft && timeLeft !== "Expired" && (
                  <span className="ml-1 font-mono font-semibold">
                    ({timeLeft} remaining)
                  </span>
                )}
                {timeLeft === "Expired" && (
                  <span className="ml-1 text-red-600 dark:text-red-400 font-semibold">
                    Link expired — generate a new one.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <Button
                onClick={openInTelegram}
                disabled={timeLeft === "Expired"}
                className="bg-[#229ED9] hover:bg-[#1a8fc4] text-white"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Telegram
              </Button>

              {polling && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Waiting for confirmation…
                </p>
              )}

              <Button
                onClick={generateLink}
                variant="outline"
                disabled={isSubmitting}
                size="sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  "Generate new link"
                )}
              </Button>
            </div>
          </>
        )}

        {/* ── Idle state ── */}
        {step === "idle" && (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">
                How it works
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Click <strong>Connect Telegram</strong> below</li>
                <li>A link opens — tap <strong>Start</strong> in the bot chat</li>
                <li>Done! Log expenses and ask questions from Telegram</li>
              </ol>
            </div>

            <Button
              onClick={generateLink}
              disabled={isSubmitting}
              className="bg-[#229ED9] hover:bg-[#1a8fc4] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating link…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Connect Telegram
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
