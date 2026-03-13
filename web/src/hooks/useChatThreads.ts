import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Message, SageResponse } from "@/components/sage/types";

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 10;

export function useChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [page, setPage] = useState(0);

  const fetchThreads = useCallback(async (pageNum = 0) => {
    setLoadingThreads(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .range(from, to + 1); // fetch one extra to detect hasMore

    setLoadingThreads(false);
    if (error || !data) return;

    const hasMoreRows = data.length > PAGE_SIZE;
    const slice = hasMoreRows ? data.slice(0, PAGE_SIZE) : data;

    setHasMore(hasMoreRows);
    if (pageNum === 0) {
      setThreads(slice);
    } else {
      setThreads((prev) => [...prev, ...slice]);
    }
    setPage(pageNum);
  }, []);

  useEffect(() => {
    fetchThreads(0);
  }, [fetchThreads]);

  const loadMore = useCallback(() => {
    fetchThreads(page + 1);
  }, [fetchThreads, page]);

  /** Create a new thread and return its id. Title starts as "New Chat" and is
   *  updated to the real title after the first AI reply. */
  const createThread = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: session.user.id, title: "New Chat" })
      .select("id, title, created_at, updated_at")
      .single();

    if (error || !data) return null;

    setThreads((prev) => [data as ChatThread, ...prev]);
    return data.id as string;
  }, []);

  /** Update thread title (called after first AI reply) */
  const updateThreadTitle = useCallback(async (threadId: string, title: string) => {
    await supabase
      .from("chat_threads")
      .update({ title })
      .eq("id", threadId);

    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title } : t))
    );
  }, []);

  /** Delete a thread */
  const deleteThread = useCallback(async (threadId: string) => {
    await supabase.from("chat_threads").delete().eq("id", threadId);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  const refreshThreads = useCallback(() => fetchThreads(0), [fetchThreads]);

  return { threads, hasMore, loadingThreads, loadMore, createThread, updateThreadTitle, deleteThread, refreshThreads };
}

/** Load messages for a given thread — ordered by server-assigned seq */
export async function loadThreadMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, response, voice, receipt, created_at")
    .eq("thread_id", threadId)
    .order("seq", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    type: row.role as "user" | "assistant",
    content: row.content as string,
    response: row.response as SageResponse | undefined,
    voice: row.voice as Message["voice"],
    receipt: row.receipt as Message["receipt"],
    timestamp: new Date(row.created_at as string),
  }));
}

/** Persist a single message to Supabase.
 *  seq is assigned automatically by the DB trigger — no client involvement. */
export async function saveMessage(
  threadId: string,
  userId: string,
  msg: Pick<Message, "id" | "type" | "content" | "response" | "voice" | "receipt">,
): Promise<void> {
  const voicePayload = msg.voice
    ? { waveformData: msg.voice.waveformData, duration: msg.voice.duration }
    : null;

  await supabase.from("chat_messages").insert({
    id: msg.id,
    thread_id: threadId,
    user_id: userId,
    role: msg.type,
    content: msg.content,
    response: msg.response ?? null,
    voice: voicePayload,
    receipt: msg.receipt ?? null,
  });
}

/** Remove undone expense IDs from the collection node in a stored message response.
 *  Updates Supabase and returns the updated response for immediate UI sync. */
export async function removeItemsFromMessageResponse(
  messageId: string,
  removedIds: string[],
): Promise<SageResponse | null> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("response")
    .eq("id", messageId)
    .single();

  if (error || !data?.response) return null;

  // Deep-clone and strip removed IDs from every collection node
  const response = JSON.parse(JSON.stringify(data.response)) as SageResponse;
  const stripFromLayout = (node: Record<string, unknown>) => {
    if (node.kind === "collection" && Array.isArray(node.items)) {
      node.items = (node.items as { id?: string }[]).filter(
        (item) => !item.id || !removedIds.includes(item.id)
      );
    }
    if (Array.isArray(node.children)) {
      (node.children as Record<string, unknown>[]).forEach(stripFromLayout);
    }
  };
  if (response.uiResponse?.layout) stripFromLayout(response.uiResponse.layout as unknown as Record<string, unknown>);

  await supabase
    .from("chat_messages")
    .update({ response })
    .eq("id", messageId);

  return response;
}

/** Derive a short, clean title from the first user message */
export function deriveTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > 52 ? cleaned.slice(0, 50) + "…" : cleaned;
}
