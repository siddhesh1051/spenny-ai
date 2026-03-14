/**
 * backend.ts — unified data layer.
 *
 * VITE_USE_PYTHON_BACKEND=true  → all calls go to Python FastAPI
 * VITE_USE_PYTHON_BACKEND=false → all calls go to Supabase directly
 *
 * Auth (sign-in / sign-out / session) always uses Supabase Auth — that never changes.
 * Only DB reads/writes are routed through this file.
 */

import { supabase } from "./supabase";
import type { Message, SageResponse } from "@/components/sage/types";

const USE_PYTHON = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";
const PYTHON_URL =
  (import.meta.env.VITE_PYTHON_BACKEND_URL as string) || "http://localhost:8000";

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${PYTHON_URL}/api${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<{
  full_name?: string;
  groq_api_key?: string;
  currency?: string;
}> {
  if (USE_PYTHON) {
    return apiFetch("/profile");
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase
    .from("profiles")
    .select("full_name, groq_api_key, currency")
    .eq("id", user.id)
    .single();
  return data || {};
}

export async function updateProfile(updates: {
  full_name?: string;
  groq_api_key?: string;
}): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch("/profile", { method: "PUT", body: JSON.stringify(updates) });
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").upsert({
    id: user.id,
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

export async function getCurrency(): Promise<string> {
  if (USE_PYTHON) {
    const r = await apiFetch<{ currency: string }>("/profile/currency");
    return r.currency || "INR";
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "INR";
  const { data } = await supabase
    .from("profiles")
    .select("currency")
    .eq("id", user.id)
    .single();
  return data?.currency || "INR";
}

export async function setCurrencyInDB(code: string): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch("/profile/currency", {
      method: "PUT",
      body: JSON.stringify({ currency: code }),
    });
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ currency: code, updated_at: new Date().toISOString() })
    .eq("id", user.id);
}

/** Ensure a profile row exists (called once on sign-in). */
export async function ensureProfile(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
  email?: string;
}): Promise<void> {
  if (USE_PYTHON) {
    // The Python backend creates profiles automatically on first /profile call.
    // Just call GET /profile to trigger upsert via Supabase service-role.
    try { await apiFetch("/profile"); } catch {}
    return;
  }
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;
  const fullName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    (user.email ? user.email.split("@")[0] : "");
  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    updated_at: new Date().toISOString(),
  });
}

// ── Chat threads ──────────────────────────────────────────────────────────────

export async function fetchThreadsPage(page = 0): Promise<{
  threads: ChatThread[];
  has_more: boolean;
  page: number;
}> {
  if (USE_PYTHON) {
    return apiFetch(`/threads?page=${page}`);
  }
  const PAGE_SIZE = 10;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error || !data) return { threads: [], has_more: false, page };
  const has_more = data.length > PAGE_SIZE;
  return { threads: has_more ? data.slice(0, PAGE_SIZE) : data, has_more, page };
}

export async function createThread(title = "New Chat"): Promise<ChatThread | null> {
  if (USE_PYTHON) {
    return apiFetch("/threads", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: session.user.id, title })
    .select("id, title, created_at, updated_at")
    .single();
  if (error || !data) return null;
  return data as ChatThread;
}

export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch(`/threads/${threadId}`, {
      method: "PUT",
      body: JSON.stringify({ title }),
    });
    return;
  }
  await supabase.from("chat_threads").update({ title }).eq("id", threadId);
}

export async function deleteThread(threadId: string): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch(`/threads/${threadId}`, { method: "DELETE" });
    return;
  }
  // Must delete messages first — FK constraint on chat_messages.thread_id
  await supabase.from("chat_messages").delete().eq("thread_id", threadId);
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId);
  if (error) throw new Error(error.message);
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function loadThreadMessages(threadId: string): Promise<Message[]> {
  let rows: any[];

  if (USE_PYTHON) {
    rows = await apiFetch(`/threads/${threadId}/messages`);
  } else {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, response, voice, receipt, created_at")
      .eq("thread_id", threadId)
      .order("seq", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    rows = data;
  }

  return rows.map((row) => ({
    id: row.id as string,
    type: row.role as "user" | "assistant",
    content: row.content as string,
    response: row.response as SageResponse | undefined,
    voice: row.voice as Message["voice"],
    receipt: row.receipt as Message["receipt"],
    timestamp: new Date(row.created_at as string),
  }));
}

export async function saveMessage(
  threadId: string,
  userId: string,
  msg: Pick<Message, "id" | "type" | "content" | "response" | "voice" | "receipt">
): Promise<void> {
  const voicePayload = msg.voice
    ? { waveformData: msg.voice.waveformData, duration: msg.voice.duration }
    : null;

  if (USE_PYTHON) {
    await apiFetch(`/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        id: msg.id,
        role: msg.type,
        content: msg.content,
        response: msg.response ?? null,
        voice: voicePayload,
        receipt: msg.receipt ?? null,
      }),
    });
    return;
  }
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

export async function removeItemsFromMessageResponse(
  threadId: string,
  messageId: string,
  removedIds: string[]
): Promise<SageResponse | null> {
  if (USE_PYTHON) {
    const result = await apiFetch<{ response: SageResponse | null }>(
      `/threads/${threadId}/messages/${messageId}/remove-items`,
      { method: "PATCH", body: JSON.stringify({ removed_ids: removedIds }) }
    );
    return result.response;
  }
  // Supabase path
  const { data, error } = await supabase
    .from("chat_messages")
    .select("response")
    .eq("id", messageId)
    .single();
  if (error || !data?.response) return null;

  const response = JSON.parse(JSON.stringify(data.response)) as SageResponse;
  const strip = (node: Record<string, unknown>) => {
    if (node.kind === "collection" && Array.isArray(node.items)) {
      node.items = (node.items as { id?: string }[]).filter(
        (item) => !item.id || !removedIds.includes(item.id)
      );
    }
    if (Array.isArray(node.children)) {
      (node.children as Record<string, unknown>[]).forEach(strip);
    }
  };
  if (response.uiResponse?.layout)
    strip(response.uiResponse.layout as unknown as Record<string, unknown>);

  await supabase.from("chat_messages").update({ response }).eq("id", messageId);
  return response;
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function fetchExpenses(): Promise<Expense[]> {
  if (USE_PYTHON) {
    return apiFetch("/expenses");
  }
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteExpense(id: string): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    return;
  }
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateExpense(
  id: string,
  fields: Partial<Omit<Expense, "id">>
): Promise<Expense> {
  if (USE_PYTHON) {
    return apiFetch(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    });
  }
  const { data, error } = await supabase
    .from("expenses")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function fetchApiKeys(): Promise<any[]> {
  if (USE_PYTHON) {
    return apiFetch("/api-keys");
  }
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createApiKey(keyName: string): Promise<any> {
  if (USE_PYTHON) {
    return apiFetch("/api-keys", {
      method: "POST",
      body: JSON.stringify({ key_name: keyName }),
    });
  }
  const { data, error } = await supabase.rpc("create_api_key", {
    key_name_param: keyName,
  });
  if (error) throw error;
  return (data || [])[0];
}

export async function revokeApiKey(keyId: string): Promise<void> {
  if (USE_PYTHON) {
    await apiFetch(`/api-keys/${keyId}`, { method: "DELETE" });
    return;
  }
  const { error } = await supabase.rpc("revoke_api_key", { key_id_param: keyId });
  if (error) throw error;
}
