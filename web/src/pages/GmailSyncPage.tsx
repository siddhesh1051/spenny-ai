import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  Unlink,
  RotateCcw,
  Trash2,
  CalendarDays,
  Clock,
} from "lucide-react";

const UNDO_SECONDS = 10;

interface SyncResult {
  inserted: number;
  skipped: number;
  total_processed: number;
  gmail_email: string | null;
  message: string;
  inserted_ids?: string[];
  processed_message_ids?: string[];
  previous_synced_message_ids?: string[];
  previous_last_synced_at?: string | null;
}

interface SyncState {
  last_synced_at: string | null;
  gmail_email: string | null;
  connected: boolean;
}

export default function GmailSyncPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);

  // Undo countdown state
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [undoProgress, setUndoProgress] = useState(100); // 100 → 0
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoRafRef = useRef<number | null>(null);
  const undoStartRef = useRef<number>(0);
  const insertedIdsRef = useRef<string[]>([]);
  // Snapshot of sync state before the last sync — used to fully revert on undo
  const undoSyncMetaRef = useRef<{
    previousSyncedMessageIds: string[];
    previousLastSyncedAt: string | null;
  } | null>(null);

  const connected = !!(syncState?.connected && syncState?.gmail_email);

  // ── Clear undo timer on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      if (undoRafRef.current) cancelAnimationFrame(undoRafRef.current);
    };
  }, []);

  // ── Start undo countdown ─────────────────────────────────────────────────
  const startUndoCountdown = useCallback((ids: string[]) => {
    insertedIdsRef.current = ids;
    setUndoSecondsLeft(UNDO_SECONDS);
    setUndoProgress(100);
    undoStartRef.current = performance.now();

    // Smooth progress bar via rAF
    const animate = (now: number) => {
      const elapsed = now - undoStartRef.current;
      const remaining = Math.max(0, 100 - (elapsed / (UNDO_SECONDS * 1000)) * 100);
      setUndoProgress(remaining);
      if (remaining > 0) {
        undoRafRef.current = requestAnimationFrame(animate);
      }
    };
    undoRafRef.current = requestAnimationFrame(animate);

    // Seconds countdown
    undoTimerRef.current = setInterval(() => {
      setUndoSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(undoTimerRef.current!);
          undoTimerRef.current = null;
          // Time's up — dismiss undo
          setSyncResult((r) => r ? { ...r, inserted_ids: [] } : r);
          insertedIdsRef.current = [];
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Cancel undo countdown ────────────────────────────────────────────────
  const cancelUndoCountdown = useCallback(() => {
    if (undoTimerRef.current) { clearInterval(undoTimerRef.current); undoTimerRef.current = null; }
    if (undoRafRef.current) { cancelAnimationFrame(undoRafRef.current); undoRafRef.current = null; }
    setUndoSecondsLeft(0);
    setUndoProgress(0);
    insertedIdsRef.current = [];
  }, []);

  // ── Handle undo ──────────────────────────────────────────────────────────
  const handleUndo = async () => {
    const ids = insertedIdsRef.current;
    if (!ids.length) return;
    cancelUndoCountdown();
    setIsUndoing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      // 1. Delete the inserted expenses
      const { error: delError } = await supabase
        .from("expenses")
        .delete()
        .in("id", ids);
      if (delError) throw delError;

      // 2. Revert the gmail_sync_state to what it was BEFORE this sync
      const meta = undoSyncMetaRef.current;
      if (userId && meta) {
        await supabase.from("gmail_sync_state").upsert({
          user_id: userId,
          last_synced_at: meta.previousLastSyncedAt,
          synced_message_ids: meta.previousSyncedMessageIds,
        });
        // Update local state to reflect the revert
        setSyncState((s) =>
          s
            ? { ...s, last_synced_at: meta.previousLastSyncedAt }
            : s
        );
      }

      setSyncResult(null);
      undoSyncMetaRef.current = null;
      toast.success(`Removed ${ids.length} synced expense${ids.length > 1 ? "s" : ""}. Sync rolled back.`);
    } catch (e: any) {
      toast.error(`Undo failed: ${e.message}`);
    } finally {
      setIsUndoing(false);
    }
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Default since date = 90 days ago; user can change for first sync
  const defaultSinceDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  })();
  const [sinceDate, setSinceDate] = useState(defaultSinceDate);

  const handleDeleteAllSynced = async () => {
    setIsDeletingAll(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", userId)
        .not("gmail_message_id", "is", null);
      if (error) throw error;

      // Also reset the sync state so emails can be re-imported
      await supabase.from("gmail_sync_state").upsert({
        user_id: userId,
        last_synced_at: null,
        synced_message_ids: [],
      });
      setSyncState((s) => s ? { ...s, last_synced_at: null } : s);
      setSyncResult(null);
      cancelUndoCountdown();
      toast.success("All Gmail-synced expenses deleted.");
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const loadSyncState = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("gmail_sync_state")
      .select("last_synced_at, gmail_email")
      .eq("user_id", userId)
      .maybeSingle();

    setSyncState(
      data
        ? { last_synced_at: data.last_synced_at, gmail_email: data.gmail_email, connected: !!data.gmail_email }
        : { last_synced_at: null, gmail_email: null, connected: false }
    );
  }, []);

  const checkAndInit = useCallback(async () => {
    setIsLoadingState(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { setSyncState(null); return; }

      const isJustConnected = localStorage.getItem("gmail_sync_connecting") === "1";

      const { data: dbState } = await supabase
        .from("gmail_sync_state")
        .select("last_synced_at, gmail_email")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (isJustConnected && session.provider_token) {
        localStorage.removeItem("gmail_sync_connecting");
        try {
          const profileRes = await fetch(
            "https://www.googleapis.com/gmail/v1/users/me/profile",
            { headers: { Authorization: `Bearer ${session.provider_token}` } }
          );
          if (profileRes.ok) {
            const pd = await profileRes.json();
            const gmailEmail: string = pd.emailAddress;
            if (gmailEmail) {
              await supabase.from("gmail_sync_state").upsert({
                user_id: session.user.id,
                gmail_email: gmailEmail,
                last_synced_at: dbState?.last_synced_at ?? null,
                synced_message_ids: [],
              });
              setSyncState({ last_synced_at: dbState?.last_synced_at ?? null, gmail_email: gmailEmail, connected: true });
              toast.success(`Gmail connected: ${gmailEmail}`);
              return;
            }
          }
        } catch { /* non-fatal */ }
      }

      if (!dbState) {
        setSyncState({ last_synced_at: null, gmail_email: null, connected: false });
        return;
      }

      setSyncState({
        last_synced_at: dbState.last_synced_at,
        gmail_email: dbState.gmail_email,
        connected: !!dbState.gmail_email,
      });
    } catch {
      setSyncState(null);
    } finally {
      setIsLoadingState(false);
    }
  }, [loadSyncState]);

  useEffect(() => { checkAndInit(); }, [checkAndInit]);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      localStorage.setItem("gmail_sync_connecting", "1");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "email profile https://www.googleapis.com/auth/gmail.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/gmail-sync`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      localStorage.removeItem("gmail_sync_connecting");
      toast.error(`Failed to connect Gmail: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setIsDisconnecting(true);
    cancelUndoCountdown();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        await supabase.from("gmail_sync_state").delete().eq("user_id", userId);
      }
      setSyncState({ last_synced_at: null, gmail_email: null, connected: false });
      setSyncResult(null);
      toast.success("Gmail disconnected. Your imported expenses are kept.");
    } catch (error: any) {
      toast.error(`Failed to disconnect: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    cancelUndoCountdown();
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { toast.error("Please sign in first."); return; }

      const providerToken = session.provider_token;
      if (!providerToken) {
        toast.error("Gmail not connected. Please connect Gmail first.");
        setSyncState((s) => s ? { ...s, connected: false } : null);
        return;
      }

      // Pass since_date for first-time syncs; subsequent syncs use last_synced_at from server
      const isFirstSync = !syncState?.last_synced_at;
      const { data, error } = await supabase.functions.invoke("sync-gmail-expenses", {
        body: {
          gmail_access_token: providerToken,
          ...(isFirstSync ? { since_date: sinceDate } : {}),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data as SyncResult;
      setSyncResult(result);
      await loadSyncState(session.user.id);

      if (result.inserted > 0) {
        // Fetch the IDs of just-inserted expenses for undo
        const { data: recentRows } = await supabase
          .from("expenses")
          .select("id")
          .eq("user_id", session.user.id)
          .not("gmail_message_id", "is", null)
          .order("date", { ascending: false })
          .limit(result.inserted);

        const ids = recentRows?.map((r: { id: string }) => r.id) ?? [];
        setSyncResult({ ...result, inserted_ids: ids });

        // Store pre-sync state snapshot so undo can fully revert
        undoSyncMetaRef.current = {
          previousSyncedMessageIds: result.previous_synced_message_ids ?? [],
          previousLastSyncedAt: result.previous_last_synced_at ?? null,
        };

        startUndoCountdown(ids);
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : "Never";

  const showUndo = undoSecondsLeft > 0 && (syncResult?.inserted ?? 0) > 0;

  if (isLoadingState) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded animate-pulse mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-14 w-full bg-muted rounded animate-pulse" />
            <div className="h-14 w-full bg-muted rounded animate-pulse" />
            <div className="h-10 w-40 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle>Gmail Auto-Sync</CardTitle>
              <CardDescription>
                Automatically import expenses from your bank and payment emails.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* How it works */}
          <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
              How it works
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Spenny reads bank alert emails (HDFC, ICICI, SBI, Kotak, Axis, Paytm, UPI, etc.)</li>
              <li>AI extracts only debit transactions — credits and refunds are ignored</li>
              <li>Each email is processed once — no duplicates on subsequent syncs</li>
              <li>Choose your start date for the first sync — all matching emails from that date are processed</li>
              <li>Your email content is never stored — only the extracted expense data</li>
            </ul>
          </div>

          {/* Connection status */}
          {connected ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Gmail connected
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove Spenny's Gmail access and clear your sync history.
                        You'll need to reconnect to sync emails again.
                        Your already-imported expenses won't be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectGmail}
                        disabled={isDisconnecting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="font-medium truncate">{syncState?.gmail_email}</span>
              </div>
              {syncState?.last_synced_at && (
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  Last synced: {formatDate(syncState.last_synced_at)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Gmail not connected. Connect your Gmail account to start syncing bank emails.
            </div>
          )}

          {/* First-sync date picker — only shown before first sync */}
          {connected && !syncState?.last_synced_at && (
            <div className="rounded-lg border border-dashed px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                Choose start date
                <span className="ml-1 text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  First sync only
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={sinceDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSinceDate(e.target.value)}
                  className="text-sm bg-background border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  All bank emails from this date will be processed. Larger ranges take longer — a 6-month range typically takes 1–3 min.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {!connected ? (
              <Button onClick={handleConnectGmail} disabled={isConnecting} className="gap-2">
                <Mail className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Gmail"}
              </Button>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Processing emails…" : "Sync Now"}
                  </Button>
                  {isSyncing && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      This may take a minute or two for large ranges — hang tight
                    </span>
                  )}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={isDeletingAll || isSyncing}
                      className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete all synced expenses
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all Gmail-synced expenses?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete every expense imported from Gmail and reset the sync history, so they can be re-imported on next sync. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAllSynced}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeletingAll ? "Deleting..." : "Delete all"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync result card with undo */}
      {syncResult && (syncResult.inserted > 0 || syncResult.total_processed > 0) && (
        <div className="relative rounded-xl overflow-hidden">
          {/* Progress border that drains left-to-right */}
          {showUndo && (
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-white/70 transition-none rounded-full"
              style={{ width: `${undoProgress}%` }}
            />
          )}

          <Card className="rounded-xl border-0 ring-1 ring-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Sync Results</CardTitle>
                  {syncResult.gmail_email && (
                    <CardDescription className="flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3.5 w-3.5" />
                      {syncResult.gmail_email}
                    </CardDescription>
                  )}
                </div>

                {/* Undo button — visible only during countdown */}
                {showUndo && (
                  <button
                    onClick={handleUndo}
                    disabled={isUndoing}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${isUndoing ? "animate-spin" : ""}`} />
                    {isUndoing ? "Undoing..." : `Undo all (${undoSecondsLeft}s)`}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{syncResult.inserted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Expenses Added</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{syncResult.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Non-Expense Emails</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{syncResult.total_processed}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Emails Processed</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{syncResult.message}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Privacy notice */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium">Privacy:</span> Spenny requests read-only access to your Gmail to search for bank/payment alert emails. Your emails are processed in real-time and never stored on Spenny servers. Only the extracted expense data (amount, category, description, date) is saved to your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
