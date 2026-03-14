import { useState, useEffect, useCallback } from "react";
import type { Message, SageResponse } from "@/components/sage/types";
import {
  fetchThreadsPage,
  createThread as createThreadInDB,
  updateThreadTitle as updateThreadTitleInDB,
  deleteThread as deleteThreadInDB,
  loadThreadMessages as loadThreadMessagesFromDB,
  saveMessage as saveMessageToDB,
  removeItemsFromMessageResponse as removeItemsFromDB,
} from "@/lib/backend";

export type { ChatThread } from "@/lib/backend";
import type { ChatThread } from "@/lib/backend";

export function useChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [page, setPage] = useState(0);

  const fetchThreads = useCallback(async (pageNum = 0) => {
    setLoadingThreads(true);
    try {
      const result = await fetchThreadsPage(pageNum);
      setHasMore(result.has_more);
      if (pageNum === 0) {
        setThreads(result.threads);
      } else {
        setThreads((prev) => [...prev, ...result.threads]);
      }
      setPage(pageNum);
    } catch (err) {
      console.error("fetchThreads error:", err);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads(0);
  }, [fetchThreads]);

  const loadMore = useCallback(() => {
    fetchThreads(page + 1);
  }, [fetchThreads, page]);

  const createThread = useCallback(async (): Promise<string | null> => {
    const data = await createThreadInDB("New Chat");
    if (!data) return null;
    setThreads((prev) => [data, ...prev]);
    return data.id;
  }, []);

  const updateThreadTitle = useCallback(async (threadId: string, title: string) => {
    await updateThreadTitleInDB(threadId, title);
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title } : t))
    );
  }, []);

  const deleteThread = useCallback(async (threadId: string) => {
    // Optimistic remove first for instant UI feedback
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    try {
      await deleteThreadInDB(threadId);
    } catch (err) {
      console.error("deleteThread failed:", err);
      // Re-fetch to restore correct state if delete failed
      fetchThreads(0);
    }
  }, [fetchThreads]);

  const refreshThreads = useCallback(() => fetchThreads(0), [fetchThreads]);

  return {
    threads,
    hasMore,
    loadingThreads,
    loadMore,
    createThread,
    updateThreadTitle,
    deleteThread,
    refreshThreads,
  };
}

/** Load messages for a given thread. */
export async function loadThreadMessages(threadId: string): Promise<Message[]> {
  return loadThreadMessagesFromDB(threadId);
}

/** Persist a single message. */
export async function saveMessage(
  threadId: string,
  userId: string,
  msg: Pick<Message, "id" | "type" | "content" | "response" | "voice" | "receipt">
): Promise<void> {
  return saveMessageToDB(threadId, userId, msg);
}

/** Remove deleted expense IDs from a stored message's collection node. */
export async function removeItemsFromMessageResponse(
  messageId: string,
  removedIds: string[],
  threadId?: string,
): Promise<SageResponse | null> {
  return removeItemsFromDB(threadId || "", messageId, removedIds);
}

/** Derive a short, clean title from the first user message */
export function deriveTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > 52 ? cleaned.slice(0, 50) + "…" : cleaned;
}
