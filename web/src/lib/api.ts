/**
 * API base URL helper.
 *
 * VITE_USE_PYTHON_BACKEND=true  → calls the Python FastAPI backend
 * VITE_USE_PYTHON_BACKEND=false → calls Supabase Edge Functions (default)
 *
 * Path mapping (same component code, different base):
 *   Supabase:  {supabaseUrl}/functions/v1/{functionName}
 *   Python:    {pythonUrl}/api/{endpoint}
 *
 * Use `apiUrl(path)` to get the full URL for a given endpoint path.
 * The path should be the Python-style path (e.g. "/sage/chat").
 * The helper automatically translates to the Supabase function name when needed.
 */

const USE_PYTHON = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";
const PYTHON_URL = (import.meta.env.VITE_PYTHON_BACKEND_URL as string) || "http://localhost:8000";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Maps Python API paths → Supabase function names
const SUPABASE_FUNCTION_MAP: Record<string, string> = {
  "/sage/chat": "sage-chat",
  "/audio/transcribe": "transcribe-audio",
  "/receipt/extract": "extract-receipt",
  "/gmail/sync": "sync-gmail-expenses",
  "/whatsapp/otp/send": "send-whatsapp-otp",
  "/whatsapp/otp/verify": "verify-whatsapp-otp",
  "/telegram/link": "telegram-link",
  "/telegram/webhook": "telegram-webhook",
};

/**
 * Get the full URL for an API endpoint.
 * @param path  Python-style path, e.g. "/sage/chat"
 * @param query Optional query string params (used for Supabase GET endpoints)
 */
export function apiUrl(path: string, query?: string): string {
  if (USE_PYTHON) {
    const base = `${PYTHON_URL}/api${path}`;
    return query ? `${base}?${query}` : base;
  }
  // Supabase Edge Function URL
  const fnName = SUPABASE_FUNCTION_MAP[path] ?? path.replace(/^\//, "").replace(/\//g, "-");
  const base = `${SUPABASE_URL}/functions/v1/${fnName}`;
  return query ? `${base}?${query}` : base;
}

/**
 * Convenience: build default fetch headers including Authorization.
 */
export function apiHeaders(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(USE_PYTHON ? {} : { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string }),
  };
  return { ...base, ...extra };
}
