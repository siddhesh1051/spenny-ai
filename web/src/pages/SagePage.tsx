import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Mic,
  Square,
  X,
  Image as LucideImage,
  FileText,
  MessageSquare,
  Trash2,
  Share2,
} from "lucide-react";
import type {
  DbExpense,
  Message,
  SageResponse,
} from "@/components/sage/types";
import {
  AssistantResponse,
  CopyButton,
  InlineExportButtons,
  LocalCloverIcon,
  LocalTip,
  ReceiptBubble,
  ThinkingIndicator,
  VoiceMessageBubble,
} from "@/components/sage/widgets";
import { ThreadSwitcher } from "@/components/sage/ThreadSwitcher";
import { AllThreadsModal } from "@/components/sage/AllThreadsModal";
import { DeleteConfirmModal } from "@/components/sage/DeleteConfirmModal";
import { QUICK_QUESTIONS, type PromptType } from "@/constants";
import { formatDuration } from "@/utils/sage";
import {
  useChatThreads,
  loadThreadMessages,
  saveMessage,
  deriveTitle,
} from "@/hooks/useChatThreads";

// ── Helpers ───────────────────────────────────────────────────────────────────

function recentTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SagePage({
  onSend,
  deleteExpense,
}: {
  onSend?: () => void;
  deleteExpense?: (id: string) => Promise<void>;
}) {
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId?: string }>();

  const onUndoLoggedExpenses = useCallback(
    async (ids: string[]) => {
      if (!deleteExpense) return;
      for (const id of ids) await deleteExpense(id);
    },
    [deleteExpense]
  );

  // ── Thread state ──
  const { threads, hasMore, loadingThreads, loadMore, createThread, deleteThread, refreshThreads } =
    useChatThreads();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  // Ref mirrors activeThreadId synchronously so the routeThreadId effect can
  // guard against re-loading a thread we just created in the same render cycle.
  // Initialized to null so the mount effect always loads when routeThreadId present.
  const activeThreadIdRef = useRef<string | null>(null);
  const [activeThreadTitle, setActiveThreadTitle] = useState("New Chat");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Chat state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [thinkingPromptType, setThinkingPromptType] = useState<PromptType>("text");
  const [userName, setUserName] = useState("there");
  const [lastMsgVisible, setLastMsgVisible] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

  // Track if title has been AI-refined for current thread
  const titleRefinedRef = useRef(false);
  // In-flight thread creation promise — prevents duplicate threads on rapid sends
  const threadCreationRef = useRef<Promise<string | null> | null>(null);

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

  // userId cache
  const userIdRef = useRef<string | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  // ── Auth & username ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        userIdRef.current = session.user.id;
        const raw =
          session.user?.user_metadata?.full_name?.split(" ")[0] ||
          session.user?.email?.split("@")[0] ||
          "there";
        setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
      }
    });
  }, []);

  // ── Load thread from URL param ───────────────────────────────────────────
  useEffect(() => {
    // Use the ref (not state) for the guard — state updates are async so
    // routeThreadId !== activeThreadId would be briefly true even when we
    // just created the thread ourselves via ensureThread.
    if (routeThreadId && routeThreadId !== activeThreadIdRef.current) {
      loadThread(routeThreadId);
    } else if (!routeThreadId && activeThreadIdRef.current !== null) {
      // Navigated back to "/" — reset to welcome screen
      activeThreadIdRef.current = null;
      threadCreationRef.current = null;
      setMessages([]);
      setInput("");
      setIsThinking(false);
      setLastMsgVisible(false);
      setChatMode(false);
      setActiveThreadId(null);
      setActiveThreadTitle("New Chat");
      titleRefinedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeThreadId]);

  const loadThread = useCallback(async (threadId: string) => {
    // Reset all chat state for the incoming thread
    setMessages([]);
    setInput("");
    setIsThinking(false);
    setLastMsgVisible(false);
    setLoadingMessages(true);
    setChatMode(true);
    titleRefinedRef.current = true;

    // Mark synchronously so ensureThread's navigate doesn't re-trigger this.
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);

    // Fetch messages and thread title in parallel
    const [msgs, threadRow] = await Promise.all([
      loadThreadMessages(threadId),
      supabase
        .from("chat_threads")
        .select("title")
        .eq("id", threadId)
        .single()
        .then(({ data }) => data),
    ]);

    setLoadingMessages(false);
    setActiveThreadTitle((threadRow as { title: string } | null)?.title ?? "Chat");
    setMessages(msgs);
    // All loaded messages are historical — make them immediately visible.
    setLastMsgVisible(true);
  }, []);

  // Update active thread title when threads list loads
  useEffect(() => {
    if (activeThreadId) {
      const found = threads.find((t) => t.id === activeThreadId);
      if (found) setActiveThreadTitle(found.title);
    }
  }, [threads, activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (chatMode) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatMode]);

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

  // ── Thread helpers ────────────────────────────────────────────────────────

  /**
   * Ensure a thread row exists in the DB. Does NOT navigate — the caller
   * navigates after the AI response arrives so the URL change never
   * interrupts an in-flight fetch.
   */
  const ensureThread = useCallback(
    async (): Promise<string | null> => {
      if (activeThreadIdRef.current) return activeThreadIdRef.current;

      // If creation is already in-flight (rapid double-send), await the same promise.
      if (threadCreationRef.current) return threadCreationRef.current;

      threadCreationRef.current = createThread().then((threadId) => {
        threadCreationRef.current = null;
        if (!threadId) return null;
        activeThreadIdRef.current = threadId;
        setActiveThreadId(threadId);
        titleRefinedRef.current = false;
        return threadId;
      });

      return threadCreationRef.current;
    },
    [createThread]
  );

  /**
   * Called once after the first AI reply — sets the visible title derived
   * from the user's first message and persists it to the DB.
   */
  const maybeSharpenTitle = useCallback(
    async (threadId: string, firstUserText: string, aiText: string) => {
      if (titleRefinedRef.current) return;
      titleRefinedRef.current = true;

      const title = deriveTitle(firstUserText || aiText);
      // Update UI immediately so the user sees the title right after the reply
      setActiveThreadTitle(title);
      await supabase.from("chat_threads").update({ title }).eq("id", threadId);
      refreshThreads();
    },
    [refreshThreads]
  );

  const persistMsg = useCallback(
    async (threadId: string, msg: Message) => {
      const userId = userIdRef.current;
      if (!userId) return;
      await saveMessage(threadId, userId, msg);
    },
    []
  );

  // ── Thread navigation ─────────────────────────────────────────────────────

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      navigate(`/chat/${threadId}`);
    },
    [navigate]
  );

  const handleNewChat = useCallback(() => {
    activeThreadIdRef.current = null;
    threadCreationRef.current = null;
    setMessages([]);
    setInput("");
    setIsThinking(false);
    setLastMsgVisible(false);
    setChatMode(false);
    setActiveThreadId(null);
    setActiveThreadTitle("New Chat");
    titleRefinedRef.current = false;
    navigate("/", { replace: true });
  }, [navigate]);

  const handleDeleteThread = useCallback(() => {
    if (!activeThreadIdRef.current) return;
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    const threadId = activeThreadIdRef.current;
    if (!threadId) return;
    await deleteThread(threadId);
    // Reset to welcome screen after deletion
    activeThreadIdRef.current = null;
    threadCreationRef.current = null;
    setMessages([]);
    setInput("");
    setIsThinking(false);
    setLastMsgVisible(false);
    setChatMode(false);
    setActiveThreadId(null);
    setActiveThreadTitle("New Chat");
    titleRefinedRef.current = false;
    navigate("/", { replace: true });
  }, [deleteThread, navigate]);

  const handleShareThread = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: activeThreadTitle, url }).catch(() => { });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied to clipboard");
      });
    }
  }, [activeThreadTitle]);

  // ── Voice recording ───────────────────────────────────────────────────────

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

      if (!chatMode) {
        setWelcomeLeaving(true);
        await new Promise((r) => setTimeout(r, 260));
        setChatMode(true);
        setWelcomeLeaving(false);
      }

      const audioUrl = URL.createObjectURL(blob);
      const msgId = crypto.randomUUID();

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
      setThinkingPromptType("audio");
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");

        const transcribeRes = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        if (!transcribeRes.ok) throw new Error(`Transcription HTTP ${transcribeRes.status}`);
        const { transcript, error: transcriptErr } = await transcribeRes.json();

        if (transcriptErr || !transcript?.trim()) {
          throw new Error("Could not understand the audio. Please try again.");
        }

        const updatedVoiceMsg: Message = { ...voiceMsg, content: transcript };
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? updatedVoiceMsg : m))
        );

        const threadId = await ensureThread();

        const sageRes = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: transcript }),
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

        if (threadId) {
          navigate(`/chat/${threadId}`, { replace: true });
          persistMsg(threadId, { ...updatedVoiceMsg, content: transcript });
          persistMsg(threadId, aiMsg);
          maybeSharpenTitle(threadId, transcript, response.text ?? "");
        }
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        const existingThreadId = activeThreadIdRef.current;
        if (existingThreadId) navigate(`/chat/${existingThreadId}`, { replace: true });
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
    [chatMode, stopThinking, onSend, ensureThread, persistMsg, maybeSharpenTitle, navigate]
  );

  const startRecording = useCallback(async () => {
    if (isThinking || isRecording) return;
    isCancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLen = analyser.frequencyBinCount;
      const dataArr = new Uint8Array(bufferLen);
      const LIVE_BARS = 40;

      waveformSamplesRef.current = [];
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const animate = () => {
        analyser.getByteFrequencyData(dataArr);
        const bars = Array.from({ length: LIVE_BARS }, (_, i) => {
          const idx = Math.floor((i / LIVE_BARS) * bufferLen);
          return dataArr[idx] / 255;
        });
        setLiveWaveform(bars);
        const avg = bars.reduce((s, v) => s + v, 0) / LIVE_BARS;
        waveformSamplesRef.current.push(avg);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

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

      const receiptMsg: Message = {
        id: msgId,
        type: "user",
        content: "",
        receipt: { imageUrl, fileName: file.name },
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, receiptMsg]);
      setScanningMsgId(msgId);
      setIsThinking(true);
      setThinkingStep(0);
      setThinkingPromptType("image");
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        setThinkingStep(step);
      }, 1800);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const threadId = await ensureThread();

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-receipt`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: response.text ?? "",
          response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);

        if (threadId) {
          navigate(`/chat/${threadId}`, { replace: true });
          persistMsg(threadId, { ...receiptMsg, receipt: { imageUrl: "", fileName: file.name } });
          persistMsg(threadId, aiMsg);
          maybeSharpenTitle(threadId, `Receipt: ${file.name}`, response.text ?? "");
        }
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        setScanningMsgId(null);
        console.error("[uploadReceipt]", err);
        const existingThreadId = activeThreadIdRef.current;
        if (existingThreadId) navigate(`/chat/${existingThreadId}`, { replace: true });
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
    [isThinking, chatMode, stopThinking, onSend, ensureThread, persistMsg, maybeSharpenTitle, navigate]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadReceipt(file);
      e.target.value = "";
    },
    [uploadReceipt]
  );

  // ── Send text message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      onSend?.();

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
      const isLogIntent = /\b(log|add|spent|paid|bought|record|track|expense)\b/i.test(trimmed);

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);
      setThinkingStep(0);
      setThinkingPromptType(isLogIntent ? "log" : "text");
      setLastMsgVisible(false);

      let step = 0;
      intervalRef.current = setInterval(() => {
        step += 1;
        setThinkingStep(step);
      }, 1800);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Create the thread row but do NOT navigate yet — navigating mid-fetch
        // would remount this component and lose all in-flight state.
        const threadId = await ensureThread();

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: trimmed }),
        });

        stopThinking();
        setIsThinking(false);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: SageResponse = await res.json();

        const aiMsg: Message = {
          id: crypto.randomUUID(),
          type: "assistant",
          content: response.text ?? "",
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => setLastMsgVisible(true), 60);

        if (threadId) {
          // Navigate immediately after response renders — before the DB writes
          // so the URL updates without any perceptible delay.
          navigate(`/chat/${threadId}`, { replace: true });
          // Fire-and-forget persistence — don't block the UI on these awaits.
          persistMsg(threadId, userMsg);
          persistMsg(threadId, aiMsg);
          maybeSharpenTitle(threadId, trimmed, response.text ?? "");
        }
      } catch (err) {
        stopThinking();
        setIsThinking(false);
        console.error("sage-chat error:", err);
        toast.error("Something went wrong. Please try again.");

        // Still navigate if thread was created before the error.
        const existingThreadId = activeThreadIdRef.current;
        if (existingThreadId) {
          navigate(`/chat/${existingThreadId}`, { replace: true });
        }

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
    [isThinking, chatMode, stopThinking, onSend, ensureThread, persistMsg, maybeSharpenTitle, navigate]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
                    <div className="flex items-center gap-1">
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

                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground disabled:opacity-30 transition-all active:scale-95"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
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

            {/* Recent threads */}
            {threads.filter((t) => t.title !== "New Chat").slice(0, 3).length > 0 && (
              <div className="w-full mt-6 sage-fi-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                    Recent chats
                  </p>
                  <button
                    onClick={() => setShowAllThreads(true)}
                    className="text-[11px] font-medium text-primary/70 hover:text-primary transition-colors"
                  >
                    Show all ({threads.filter((t) => t.title !== "New Chat").length})
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {threads.filter((t) => t.title !== "New Chat").slice(0, 3).map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => handleSelectThread(thread.id)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left hover:bg-muted/60 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </div>
                      <span className="flex-1 text-sm text-foreground/80 group-hover:text-foreground truncate">
                        {thread.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">
                        {recentTimeAgo(thread.updated_at)}
                      </span>
                    </button>
                  ))}
                </div>
                {threads.filter((t) => t.title !== "New Chat").length > 3 && (
                  <button
                    onClick={() => setShowAllThreads(true)}
                    className="mt-1.5 w-full py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    + {threads.filter((t) => t.title !== "New Chat").length - 3} more chats
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT VIEW ────────────────────────────────────────────────── */}
      {chatMode && (
        <div className="flex flex-col h-full sage-chat-enter">

          {/* Slim top bar */}
          <div className="shrink-0 flex items-center px-3 py-2 border-b bg-background">
            {/* Left spacer — mirrors the right action so the title stays centered */}
            <div className="flex-1" />

            {/* Center: thread title + history dropdown */}
            <ThreadSwitcher
              currentTitle={activeThreadTitle}
              threads={threads}
              hasMore={hasMore}
              loadingThreads={loadingThreads}
              onLoadMore={loadMore}
              onSelectThread={handleSelectThread}
            />

            {/* Right: Share, Delete, New chat */}
            <div className="flex-1 flex justify-end items-center gap-1">
              {/* Share */}
              <div className="sage-tooltip-wrap">
                <button
                  onClick={handleShareThread}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                <span className="sage-tooltip">Share thread</span>
              </div>
              {/* Delete */}
              <div className="sage-tooltip-wrap">
                <button
                  onClick={handleDeleteThread}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="sage-tooltip sage-tooltip-danger">Delete thread</span>
              </div>
              <div className="w-px h-4 bg-border mx-0.5" />
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Loading conversation…
                </div>
              </div>
            ) : (
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
                            <ReceiptBubble {...msg.receipt} isScanning={scanningMsgId === msg.id} />
                          ) : msg.voice ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <VoiceMessageBubble {...msg.voice} />
                              {msg.content && (
                                <p className="text-xs text-muted-foreground/60 italic max-w-[260px] text-right px-1 leading-relaxed">
                                  "{msg.content}"
                                </p>
                              )}
                            </div>
                          ) : (
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

                {isThinking && <ThinkingIndicator step={thinkingStep} promptType={thinkingPromptType} />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom input bar */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t bg-background sage-input-in">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">

              {isRecording ? (
                <>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-muted transition-colors text-muted-foreground shrink-0"
                    title="Cancel recording"
                  >
                    <X className="h-4 w-4" />
                  </button>

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

                    {showAttachMenu && (
                      <div className="absolute bottom-10 left-0 bg-popover border rounded-xl shadow-lg py-1 min-w-[180px] z-50 sage-attach-menu">
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

                  <input
                    ref={chatInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about your spending…"
                    disabled={isThinking}
                    className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 disabled:opacity-50 transition-all"
                  />
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Animations & styles ───────────────────────────────────────── */}
      <style>{`
        button, [role="button"], [role="tab"], [role="checkbox"],
        input[type="file"], input[type="submit"], input[type="button"],
        select, label[for], a {
          cursor: pointer !important;
        }

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

        .sage-fi-1 { animation: sageFadeUp 0.5s ease both 0.00s; }
        .sage-fi-2 { animation: sageFadeUp 0.5s ease both 0.08s; }
        .sage-fi-3 { animation: sageFadeUp 0.5s ease both 0.16s; }
        .sage-fi-4 { animation: sageFadeUp 0.5s ease both 0.24s; }
        .sage-fi-5 { animation: sageFadeUp 0.5s ease both 0.34s; }
        .sage-fi-6 { animation: sageFadeUp 0.5s ease both 0.44s; }

        @keyframes sageFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sage-hscroll::-webkit-scrollbar { display: none; }

        @keyframes sageSpin { to { transform: rotate(360deg); } }

        .sage-text-fade { animation: sageTextFade 0.35s ease both; }
        @keyframes sageTextFade {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .sage-chat-enter { animation: sageFadeIn 0.28s ease both; }
        @keyframes sageFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .sage-msg-in { animation: sageMsgIn 0.32s ease both; }
        @keyframes sageMsgIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sage-input-in { animation: sageInputIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both 0.06s; }
        @keyframes sageInputIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sage-row-in {
          animation: sageRowIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sage-bar-in {
          animation: sageBarIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageBarIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .sage-logged-in {
          animation: sageLoggedIn 0.3s ease forwards;
          opacity: 0;
        }
        @keyframes sageLoggedIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }

        .sage-metric-in {
          animation: sageMetricIn 0.35s ease forwards;
          opacity: 0;
        }
        @keyframes sageMetricIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sage-voice-bubble {
          animation: sageVoiceIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageVoiceIn {
          from { opacity: 0; transform: scale(0.88) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .sage-rec-bar { transition: height 60ms linear; }

        .sage-receipt-in {
          animation: sageReceiptIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes sageReceiptIn {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

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

        .sage-scan-pulse {
          animation: sageScanPulse 1.4s ease-in-out infinite;
        }
        @keyframes sageScanPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

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

        .sage-attach-menu {
          animation: sageAttachIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: bottom left;
        }
        @keyframes sageAttachIn {
          from { opacity: 0; transform: scale(0.93) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .sage-border-idle {
          background: rgba(255,255,255,0.22);
          animation: sageBorderPulse 4s ease-in-out infinite;
        }
        @keyframes sageBorderPulse {
          0%, 100% { background: rgba(255,255,255,0.18); }
          50%       { background: rgba(255,255,255,0.32); }
        }

        /* ── Icon button tooltips ── */
        .sage-tooltip-wrap {
          position: relative;
          display: flex;
        }
        .sage-tooltip {
          pointer-events: none;
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          background: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
          border: 1px solid hsl(var(--border));
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .sage-tooltip-danger {
          color: hsl(var(--destructive));
        }
        .sage-tooltip-wrap:hover .sage-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>

      {/* All Threads Modal */}
      {showAllThreads && (
        <AllThreadsModal
          threads={threads.filter((t) => t.title !== "New Chat")}
          onSelectThread={handleSelectThread}
          onClose={() => setShowAllThreads(false)}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          threadTitle={activeThreadTitle}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
