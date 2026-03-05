import { useState, useEffect, useCallback } from "react";
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
import { Mail, RefreshCw, CheckCircle2, AlertCircle, Info, Unlink } from "lucide-react";

interface SyncResult {
  inserted: number;
  skipped: number;
  total_processed: number;
  message: string;
}

interface SyncState {
  last_synced_at: string | null;
}

export default function GmailSyncPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [hasGmailAccess, setHasGmailAccess] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(true);

  const checkGmailAccess = useCallback(async () => {
    setIsLoadingState(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setHasGmailAccess(false);
        return;
      }

      // Check if the provider token has gmail scope by trying to list 1 message
      const providerToken = session.provider_token;
      if (providerToken) {
        const testRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1",
          { headers: { Authorization: `Bearer ${providerToken}` } }
        );
        setHasGmailAccess(testRes.ok);
      } else {
        setHasGmailAccess(false);
      }

      // Load last sync state
      const { data: stateData } = await supabase
        .from("gmail_sync_state")
        .select("last_synced_at")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setSyncState(stateData ? { last_synced_at: stateData.last_synced_at } : null);
    } catch {
      setHasGmailAccess(false);
    } finally {
      setIsLoadingState(false);
    }
  }, []);

  useEffect(() => {
    checkGmailAccess();
  }, [checkGmailAccess]);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "email profile https://www.googleapis.com/auth/gmail.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: `${window.location.origin}/gmail-sync`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(`Failed to connect Gmail: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      // Clear the sync state from DB so next connect starts fresh
      if (userId) {
        await supabase.from("gmail_sync_state").delete().eq("user_id", userId);
      }

      // Sign out completely, then sign back in with basic Google scopes only
      // This drops the provider_token with gmail scope
      await supabase.auth.signOut();

      // Re-authenticate with Google but without gmail scope
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "email profile",
          queryParams: {
            prompt: "select_account",
          },
          redirectTo: `${window.location.origin}/gmail-sync`,
        },
      });

      setHasGmailAccess(false);
      setSyncState(null);
      setSyncResult(null);
      toast.success("Gmail disconnected successfully.");
    } catch (error: any) {
      toast.error(`Failed to disconnect: ${error.message}`);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        toast.error("Please sign in first.");
        return;
      }

      const providerToken = session.provider_token;
      if (!providerToken) {
        toast.error("Gmail not connected. Please connect Gmail first.");
        setHasGmailAccess(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-gmail-expenses", {
        body: { gmail_access_token: providerToken },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data as SyncResult;
      setSyncResult(result);

      // Refresh sync state
      if (session?.user?.id) {
        const { data: stateData } = await supabase
          .from("gmail_sync_state")
          .select("last_synced_at")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setSyncState(stateData ? { last_synced_at: stateData.last_synced_at } : null);
      }

      if (result.inserted > 0) {
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

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString();
  };

  if (isLoadingState) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded animate-pulse mt-1" />
          </CardHeader>
          <CardContent>
            <div className="h-10 w-40 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
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
              <li>First sync covers the last 90 days; subsequent syncs fetch only new emails</li>
              <li>Your email content is never stored — only the extracted expense data</li>
            </ul>
          </div>

          {/* Connection status */}
          {hasGmailAccess ? (
            <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
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
                      This will revoke Spenny's access to your Gmail and clear your sync history. You'll need to reconnect to sync emails again. Your already-imported expenses won't be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnectGmail}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Gmail not connected. Sign in with Google to enable email sync.
            </div>
          )}

          {/* Last sync info */}
          {syncState?.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Last synced: {formatDate(syncState.last_synced_at)}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {!hasGmailAccess ? (
              <Button onClick={handleConnectGmail} disabled={isConnecting} className="gap-2">
                <Mail className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Gmail"}
              </Button>
            ) : (
              <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing emails..." : "Sync Now"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync result card */}
      {syncResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{syncResult.inserted}</p>
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
