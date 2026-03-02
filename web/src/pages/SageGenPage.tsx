import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/components/theme-provider";
import { SageChatContainer, type SageResponse } from "@spenny/sage-chat-sdk";

type SageGenPageProps = {
  onSend?: () => void;
};

function resolveMode(theme: "dark" | "light" | "system"): "dark" | "light" {
  if (theme === "dark" || theme === "light") return theme;
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export default function SageGenPage({ onSend }: SageGenPageProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sageResponse, setSageResponse] = useState<SageResponse | null>(null);
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!SUPABASE_URL) {
      toast.error("SUPABASE URL missing. Set VITE_SUPABASE_URL in your .env.");
      return;
    }

    setLoading(true);
    onSend?.();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Not authenticated");

      const sageRes = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!sageRes.ok) {
        const text = await sageRes.text();
        throw new Error(`sage-chat HTTP ${sageRes.status}: ${text}`);
      }

      const sageData: SageResponse = await sageRes.json();
      setSageResponse(sageData);
    } catch (err) {
      console.error("Sage request failed:", err);
      toast.error("Something went wrong talking to Sage. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 md:p-6 gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Sage</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Ask anything about your spending and get a tailored dashboard.
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-2 md:gap-3 items-stretch md:items-center"
      >
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. “Show my monthly expenses by category”"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !prompt.trim()} className="whitespace-nowrap">
          {loading ? "Thinking…" : "Ask Sage"}
        </Button>
      </form>

      <main className="flex-1 min-h-0 border rounded-3xl bg-card overflow-hidden">
        {sageResponse ? (
          <div className="h-full overflow-auto p-4 md:p-6">
            <SageChatContainer response={sageResponse} mode={resolveMode(theme)} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
            Ask Sage a question to generate an interactive dashboard or summary based on your real expenses.
          </div>
        )}
      </main>
    </div>
  );
}

