import { useState, useRef, useEffect, useCallback } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ThumbsUp,
  ThumbsDown,
  Plus,
  ArrowUp,
  Send,
  RotateCcw,
  Mic,
  Square,
  X,
  Image as LucideImage,
  FileText,
} from "lucide-react";
import type {
  DbExpense,
  Message,
  SageResponse,
} from "@/components/sage/types";
import { AssistantResponse, CopyButton, InlineExportButtons, LocalCloverIcon, LocalTip, ReceiptBubble, ThinkingIndicator, VoiceMessageBubble } from "@/components/sage/widgets";
import { QUICK_QUESTIONS } from "@/constants";
import { formatDuration } from "@/utils/sage";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SagePage({
  onSend,
  deleteExpense,
}: {
  onSend?: () => void;
  deleteExpense?: (id: string) => Promise<void>;
}) {
  const { formatAmount } = useCurrency();
  const onUndoLoggedExpenses = useCallback(
    async (ids: string[]) => {
      if (!deleteExpense) return;
      for (const id of ids) await deleteExpense(id);
    },
    [deleteExpense]
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [userName, setUserName] = useState("there");
  const [lastMsgVisible, setLastMsgVisible] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

  // ── Voice recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(Array(40).fill(0));

  // ── Receipt / attach state ──
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [scanningMsgId, setScanningMsgId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef2 = useRef<HTMLDivElement>(null);
  const glowWrapRef = useRef<HTMLDivElement>(null);

  // ── Voice recording refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const waveformSamplesRef = useRef<number[]>([]);
  const isCancelledRef = useRef(false);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const raw =
          session.user?.user_metadata?.full_name?.split(" ")[0] ||
          session.user?.email?.split("@")[0] ||
          "there";
        setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Focus input when chat mode activates
  useEffect(() => {
    if (chatMode) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatMode]);

  // Close attach menu when clicking outside either anchor
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inMenu1 = attachMenuRef.current?.contains(t);
      const inMenu2 = attachMenuRef2.current?.contains(t);
      if (!inMenu1 && !inMenu2) setShowAttachMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachMenu]);

  const stopThinking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Voice recording ───────────────────────────────────────────────────────

  /** Downsample a large array of amplitude samples to `targetLen` bars */
  const downsampleWaveform = (samples: number[], targetLen: number): number[] => {
    if (!samples.length) return Array(targetLen).fill(0.15);
    const step = Math.max(1, Math.floor(samples.length / targetLen));
    return Array.from({ length: targetLen }, (_, i) => {
      const slice = samples.slice(i * step, (i + 1) * step);
      return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
    });
  };

  const transcribeAndSend = useCallback(
    async (blob: Blob, waveformData: number[], duration: number) => {
      onSend?.();

      // Switch to chat mode if on welcome screen
      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const audioUrl = URL.createObjectURL(blob);
      const msgId = crypto.randomUUID();

      // Add voice bubble immediately (transcript fills in later)
      const voiceMsg: Message = {
        id: msgId,
        type: "user",
        content: "",
        voice: { audioUrl, waveformData, duration },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, voiceMsg]);
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string || "";

        // 1. Transcribe audio via FastAPI backend
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");

        const transcribeRes = await fetch(`${BACKEND_URL}/api/audio/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        if (!transcribeRes.ok) throw new Error(`Transcription HTTP ${transcribeRes.status}`);
        const { transcript, error: transcriptErr } = await transcribeRes.json();

        if (transcriptErr || !transcript?.trim()) {
          throw new Error("Could not understand the audio. Please try again.");
        }

        // 2. Update voice bubble with transcript
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: transcript } : m))
        );

        // 3. Send transcript to Sage agent
        const sageRes = await fetch(`${BACKEND_URL}/api/sage/chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: transcript, stream: false }),
        });

        stopThinking();
        setIsThinking(false);

        if (!sageRes.ok) throw new Error(`Sage chat HTTP ${sageRes.status}`);
        const response: SageResponse = await sageRes.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: response.text ?? "",
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        const errText = String(err).includes("understand")
          ? "I couldn't understand the audio. Please speak clearly and try again."
          : "Something went wrong processing your voice. Please try again.";
        toast.error(errText);
        const errMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: errText,
          response: { intent: "conversation", text: errText },
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [chatMode, stopThinking, onSend]
  );

  const startRecording = useCallback(async () => {
    if (isThinking || isRecording) return;
    isCancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Web Audio API for live waveform
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLen = analyser.frequencyBinCount; // 64
      const dataArr = new Uint8Array(bufferLen);
      const LIVE_BARS = 40;

      waveformSamplesRef.current = [];
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      // Animate live waveform
      const animate = () => {
        analyser.getByteFrequencyData(dataArr);
        const bars = Array.from({ length: LIVE_BARS }, (_, i) => {
          const idx = Math.floor((i / LIVE_BARS) * bufferLen);
          return dataArr[idx] / 255;
        });
        setLiveWaveform(bars);
        // Store amplitude samples for static waveform
        const avg = bars.reduce((s, v) => s + v, 0) / LIVE_BARS;
        waveformSamplesRef.current.push(avg);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Duration counter
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        clearInterval(durationTimerRef.current!);
        audioCtx.close();
        stream.getTracks().forEach((t) => t.stop());

        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          setIsRecording(false);
          setRecordingDuration(0);
          setLiveWaveform(Array(LIVE_BARS).fill(0));
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const dur = (Date.now() - startTimeRef.current) / 1000;
        const waveform = downsampleWaveform(waveformSamplesRef.current, 50);

        setIsRecording(false);
        setRecordingDuration(0);
        setLiveWaveform(Array(LIVE_BARS).fill(0));

        if (blob.size > 0) {
          await transcribeAndSend(blob, waveform, dur);
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      audioContextRef.current = audioCtx;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      toast.error("Could not access microphone. Please check your browser permissions.");
    }
  }, [isThinking, isRecording, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    isCancelledRef.current = false;
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(durationTimerRef.current!);
    audioContextRef.current?.close();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    } else {
      setIsRecording(false);
      setRecordingDuration(0);
      setLiveWaveform(Array(40).fill(0));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(durationTimerRef.current!);
      audioContextRef.current?.close();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Receipt upload ─────────────────────────────────────────────────────────

  const uploadReceipt = useCallback(
    async (file: File) => {
      if (isThinking) return;
      onSend?.();

      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const imageUrl = URL.createObjectURL(file);
      const msgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          type: "user",
          content: "",
          receipt: { imageUrl, fileName: file.name },
          timestamp: new Date(),
        },
      ]);
      setScanningMsgId(msgId);
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        setThinkingStep(step);
      }, 1800);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string || "";
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`${BACKEND_URL}/api/receipt/extract`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            content: response.text ?? "",
            response,
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);
        console.error("[uploadReceipt]", err);
        const errText =
          "Couldn't extract expenses from that image. Please try a clearer, well-lit photo.";
        toast.error(errText);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            content: errText,
            response: { intent: "conversation", text: errText },
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [isThinking, chatMode, stopThinking, onSend]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadReceipt(file);
      e.target.value = "";
    },
    [uploadReceipt]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      onSend?.();

      // Animate out welcome screen, switch to chat
      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        type: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);
      setThinkingStep(0);
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) throw new Error("Not authenticated");

        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string || "";
        const res = await fetch(`${BACKEND_URL}/api/sage/chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: trimmed, stream: false }),
        });

        stopThinking();
        setIsThinking(false);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: (response as SageResponse).text ?? "",
          response: response as SageResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        console.error("sage-chat error:", err);
        toast.error("Something went wrong. Please try again.");

        const errMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: "Sorry, I ran into an issue. Please try again!",
          response: { intent: "conversation", text: "Sorry, I ran into an issue. Please try again!" },
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);
      }
    },
    [isThinking, chatMode, stopThinking, onSend]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setIsThinking(false);
    setLastMsgVisible(false);
    setChatMode(false);
  };

  const getMessageCopyText = (msg: Message): string => {
    if (!msg.response) return msg.content;
    const r = msg.response;
    const parts: string[] = [];
    if (r.title) parts.push(r.title);
    if (r.text) parts.push(r.text);
    if (r.expenses?.length) {
      parts.push(
        r.expenses.map((e) => `${e.description} (${e.category}): ${formatAmount(e.amount)}`).join("\n")
      );
    }
    if (r.loggedExpenses?.length) {
      parts.push(r.loggedExpenses.map((e) => `${e.description}: ${formatAmount(e.amount)}`).join("\n"));
    }
    return parts.join("\n\n");
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── WELCOME SCREEN ───────────────────────────────────────────── */}
      {!chatMode && (
        <div
          className="sage-mesh-bg flex flex-col items-center justify-center h-full px-5 text-center"
          style={{
            opacity: welcomeLeaving ? 0 : 1,
            transform: welcomeLeaving ? "scale(0.97) translateY(-8px)" : "scale(1) translateY(0)",
            transition: "opacity 0.26s ease, transform 0.26s ease",
          }}
        >
          <div className="flex flex-col items-center w-full max-w-xl">

            {/* Logo */}
            <div className="mb-4 sage-fi-1">
              <LocalCloverIcon size={52} />
            </div>

            {/* Greeting */}
            <p className="text-sm font-medium text-muted-foreground mb-3 tracking-wide sage-fi-2">
              {greeting}, {userName}
            </p>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 sage-fi-3 leading-tight">
              What can I help you with?
            </h2>

            {/* Tall input */}
            <form
              onSubmit={handleSubmit}
              className="w-full sage-fi-4 mb-5"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            >
              {/* Outer wrapper = the glowing border (1px padding reveals gradient as border) */}
              <div
                ref={glowWrapRef}
                className="rounded-2xl p-px shadow-sm sage-border-idle"
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  el.style.background = `radial-gradient(500px circle at ${x}% ${y}%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.18) 100%)`;
                  el.style.animation = "none";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.animation = "";
                }}
              >
                {/* Inner = actual card background */}
                <div className="relative bg-background rounded-[calc(1rem-1px)] focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your spending, log an expense, or get insights…"
                    rows={3}
                    className="w-full px-5 pt-4 pb-16 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 resize-none text-sm leading-relaxed"
                  />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    {/* Left: attach + mic */}
                    <div className="flex items-center gap-1">
                      {/* Attach menu */}
                      <div className="relative" ref={attachMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowAttachMenu((v) => !v)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                            showAttachMenu
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
                          )}
                          title="Attach receipt"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {showAttachMenu && (
                          <div className="absolute bottom-9 left-0 bg-popover border rounded-xl shadow-lg py-1 min-w-[180px] z-50 sage-attach-menu">
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.click();
                                setShowAttachMenu(false);
                              }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors text-left rounded-lg"
                            >
                              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <LucideImage className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground text-xs">Receipt / Screenshot</div>
                                <div className="text-[10px] text-muted-foreground">JPG, PNG, WebP</div>
                              </div>
                            </button>
                            <button
                              type="button"
                              disabled
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs opacity-45 cursor-not-allowed text-left rounded-lg"
                            >
                              <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                <FileText className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground text-xs">PDF Receipt</div>
                                <div className="text-[10px] text-muted-foreground">Coming soon</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Mic — switches to chat mode then starts recording */}
                      {!input.trim() && (
                        <button
                          type="button"
                          onClick={async () => {
                            setWelcomeLeaving(true);
                            await new Promise((r) => setTimeout(r, 260));
                            setChatMode(true);
                            setWelcomeLeaving(false);
                            setTimeout(() => startRecording(), 80);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                          title="Send voice message"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Right: send */}
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground disabled:opacity-30 transition-all active:scale-95"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>{/* inner card */}
              </div>{/* glow border wrapper */}
            </form>

            {/* Quick questions */}
            <div className="w-full sage-fi-5">
              <div
                className="flex gap-2.5 overflow-x-auto pb-1 sage-hscroll"
                style={{ scrollbarWidth: "none" }}
              >
                {QUICK_QUESTIONS.map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.text)}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-background text-sm text-muted-foreground whitespace-nowrap hover:border-primary/40 hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {q.text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT VIEW ────────────────────────────────────────────────── */}
      {chatMode && (
        <div className="flex flex-col h-full sage-chat-enter">

          {/* Slim top bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <LocalCloverIcon size={18} />
              <span className="text-sm font-semibold">Sage</span>
            </div>
            <button
              onClick={resetChat}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
              title="New chat"
            >
              <RotateCcw className="h-3 w-3" />
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, idx) => {
                const isLastAssistant =
                  msg.type === "assistant" && idx === messages.length - 1;
                const visible = isLastAssistant ? lastMsgVisible : true;

                return (
                  <div key={msg.id}>
                    {msg.type === "user" ? (
                      <div className="flex justify-end sage-msg-in">
                        {msg.receipt ? (
                          /* ── Receipt / image upload bubble ── */
                          <ReceiptBubble {...msg.receipt} isScanning={scanningMsgId === msg.id} />
                        ) : msg.voice ? (
                          /* ── Voice message bubble ── */
                          <div className="flex flex-col items-end gap-1.5">
                            <VoiceMessageBubble {...msg.voice} />
                            {msg.content && (
                              <p className="text-xs text-muted-foreground/60 italic max-w-[260px] text-right px-1 leading-relaxed">
                                "{msg.content}"
                              </p>
                            )}
                          </div>
                        ) : (
                          /* ── Text message bubble ── */
                          <div className="bg-muted text-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                            {msg.content}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 sage-msg-in">
                        <div className="mt-0.5 shrink-0">
                          <LocalCloverIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {msg.response ? (
                            <AssistantResponse
                              response={msg.response}
                              visible={visible}
                              onUndoLoggedExpenses={deleteExpense ? onUndoLoggedExpenses : undefined}
                            />
                          ) : (
                            <div
                              style={{
                                opacity: visible ? 1 : 0,
                                transition: "opacity 0.3s ease",
                              }}
                              className="text-sm leading-relaxed"
                            >
                              {msg.content}
                            </div>
                          )}

                          {/* Message actions */}
                          {visible && (
                            <div className="flex items-center gap-0.5 mt-3">
                              <CopyButton text={getMessageCopyText(msg)} />
                              <LocalTip label="Helpful">
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                              </LocalTip>
                              <LocalTip label="Not helpful">
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </LocalTip>

                              {/* Export icons — only for responses with expense data */}
                              {msg.response && (() => {
                                const r = msg.response!;
                                const expenses: DbExpense[] =
                                  r.expenses ??
                                  (r.loggedExpenses ?? []).map((e) => ({
                                    date: new Date().toISOString(),
                                    description: e.description,
                                    category: e.category,
                                    amount: e.amount,
                                  }));
                                if (!expenses.length) return null;
                                return (
                                  <InlineExportButtons
                                    expenses={expenses}
                                    title={r.title}
                                    totalAmount={r.totalAmount}
                                  />
                                );
                              })()}

                              <span className="ml-auto text-xs text-muted-foreground/60">
                                {msg.timestamp.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isThinking && <ThinkingIndicator step={thinkingStep} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom input bar */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t bg-background sage-input-in">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">

              {isRecording ? (
                /* ── Recording mode ── */
                <>
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-muted transition-colors text-muted-foreground shrink-0"
                    title="Cancel recording"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Live waveform pill */}
                  <div className="flex-1 flex items-center gap-2.5 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm tabular-nums text-red-600 dark:text-red-400 font-medium w-8 shrink-0">
                      {formatDuration(recordingDuration)}
                    </span>
                    <div className="flex-1 flex items-center gap-[2px] h-6 overflow-hidden">
                      {liveWaveform.map((v, i) => (
                        <div
                          key={i}
                          className="shrink-0 rounded-full bg-red-500/70"
                          style={{
                            width: "3px",
                            height: `${Math.max(2, v * 22)}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stop → send */}
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shrink-0 transition-colors shadow-sm active:scale-95"
                    title="Stop and send"
                  >
                    <Square className="h-3.5 w-3.5" style={{ fill: "white" }} />
                  </button>
                </>
              ) : (
                /* ── Normal input mode ── */
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center gap-2 w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                >
                  {/* ── Attach menu ── */}
                  <div className="relative shrink-0" ref={attachMenuRef2}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu((v) => !v)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full border transition-colors text-muted-foreground",
                        showAttachMenu
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "hover:bg-muted"
                      )}
                      title="Attach receipt or image"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* Dropdown */}
                    {showAttachMenu && (
                      <div className="absolute bottom-10 left-0 bg-popover border rounded-xl shadow-lg py-1 min-w-[180px] z-50 sage-attach-menu">
                        {/* Receipt image */}
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowAttachMenu(false);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors text-left rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <LucideImage className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">Receipt / Screenshot</div>
                            <div className="text-[10px] text-muted-foreground">JPG, PNG, WebP</div>
                          </div>
                        </button>

                        {/* PDF — coming soon */}
                        <button
                          type="button"
                          disabled
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs opacity-45 cursor-not-allowed text-left rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                            <FileText className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-xs">PDF Receipt</div>
                            <div className="text-[10px] text-muted-foreground">Coming soon</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={chatInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about your spending…"
                    disabled={isThinking}
                    className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:opacity-50 transition-all"
                  />
                  {/* Mic button — shows only when input is empty */}
                  {!input.trim() && (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isThinking}
                      className="w-9 h-9 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0 disabled:opacity-40 active:scale-95"
                      title="Send voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  )}
                  {/* Send button — shows only when there's text */}
                  {input.trim() && (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isThinking}
                      className="rounded-full shrink-0 w-9 h-9 disabled:opacity-30"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </form>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground/50 mt-2">
              {isRecording ? "Tap the red square to send · X to cancel" : "Sage can make mistakes. Double-check important numbers."}
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input — always mounted so it works from both welcome & chat screens */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Animations & styles ───────────────────────────────────────── */}
      <style>{`
        /* Cursor pointer on every interactive element */
        button, [role="button"], [role="tab"], [role="checkbox"],
        input[type="file"], input[type="submit"], input[type="button"],
        select, label[for], a {
          cursor: pointer !important;
        }

        /* Gradient background */
        .sage-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.05) 0%, transparent 60%);
        }
        .dark .sage-mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.08) 0%, transparent 60%);
        }

        /* Welcome stagger */
        .sage-fi-1 { animation: sageFadeUp 0.5s ease both 0.00s; }
        .sage-fi-2 { animation: sageFadeUp 0.5s ease both 0.08s; }
        .sage-fi-3 { animation: sageFadeUp 0.5s ease both 0.16s; }
        .sage-fi-4 { animation: sageFadeUp 0.5s ease both 0.24s; }
        .sage-fi-5 { animation: sageFadeUp 0.5s ease both 0.34s; }

        @keyframes sageFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Hide scrollbar */
        .sage-hscroll::-webkit-scrollbar { display: none; }

        /* Clover spin */
        @keyframes sageSpin { to { transform: rotate(360deg); } }

        /* Loading text fade */
        .sage-text-fade { animation: sageTextFade 0.35s ease both; }
        @keyframes sageTextFade {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Chat view enter */
        .sage-chat-enter { animation: sageFadeIn 0.28s ease both; }
        @keyframes sageFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Messages */
        .sage-msg-in { animation: sageMsgIn 0.32s ease both; }
        @keyframes sageMsgIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Bottom input slides in */
        .sage-input-in { animation: sageInputIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both 0.06s; }
        @keyframes sageInputIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Table rows stagger */
        .sage-row-in {
          animation: sageRowIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Category bars stagger */
        .sage-bar-in {
          animation: sageBarIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageBarIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Logged expense cards */
        .sage-logged-in {
          animation: sageLoggedIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageLoggedIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* Metric cards */
        .sage-metric-in {
          animation: sageMetricIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageMetricIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Voice bubble pop-in */
        .sage-voice-bubble {
          animation: sageVoiceIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageVoiceIn {
          from { opacity: 0; transform: scale(0.88) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Recording waveform bars — live height transitions */
        .sage-rec-bar { transition: height 60ms linear; }

        /* Receipt image bubble pop-in */
        .sage-receipt-in {
          animation: sageReceiptIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageReceiptIn {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Scanning sweep line */
        .sage-scan-sweep {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #34d399 30%, #6ee7b7 50%, #34d399 70%, transparent 100%);
          box-shadow: 0 0 8px 2px rgba(52,211,153,0.55);
          animation: sageScanSweep 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          position: absolute;
          left: 12px; right: 12px;
        }
        @keyframes sageScanSweep {
          0%   { top: 8%;  opacity: 0.7; }
          10%  { opacity: 1; }
          45%  { top: 85%; opacity: 1; }
          55%  { top: 85%; opacity: 1; }
          90%  { top: 8%;  opacity: 1; }
          100% { top: 8%;  opacity: 0.7; }
        }

        /* Pulsing text / icon during scan */
        .sage-scan-pulse {
          animation: sageScanPulse 1.4s ease-in-out infinite;
        }
        @keyframes sageScanPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        /* ── Fullscreen receipt modal ── */
        .sage-fs-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          animation: sageFsBackdropIn 0.28s ease both;
        }
        .sage-fs-out {
          animation: sageFsBackdropOut 0.28s ease both;
        }
        @keyframes sageFsBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sageFsBackdropOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .sage-fs-content {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          animation: sageFsZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .sage-fs-content-out {
          animation: sageFsZoomOut 0.26s cubic-bezier(0.55, 0, 0.45, 1) both;
        }
        @keyframes sageFsZoomIn {
          from { opacity: 0; transform: scale(0.78); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sageFsZoomOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.82); }
        }

        /* Attach menu slide-up */
        .sage-attach-menu {
          animation: sageAttachIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: bottom left;
        }
        @keyframes sageAttachIn {
          from { opacity: 0; transform: scale(0.93) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* ── Main input border glow ── */

        /* Idle: visible uniform border, pulses softly */
        .sage-border-idle {
          background: rgba(255,255,255,0.22);
          animation: sageBorderPulse 4s ease-in-out infinite;
        }
        @keyframes sageBorderPulse {
          0%, 100% { background: rgba(255,255,255,0.18); }
          50%       { background: rgba(255,255,255,0.32); }
        }
      `}</style>
    </div>
  );
}
