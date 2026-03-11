import { useRef, useState, useEffect } from "react";
import { ChevronDown, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatThread } from "@/hooks/useChatThreads";

interface ThreadSwitcherProps {
  currentTitle: string;
  threads: ChatThread[];
  hasMore: boolean;
  loadingThreads: boolean;
  onLoadMore: () => void;
  onSelectThread: (threadId: string) => void;
}

function timeAgo(dateStr: string): string {
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

export function ThreadSwitcher({
  currentTitle,
  threads,
  hasMore,
  loadingThreads,
  onLoadMore,
  onSelectThread,
}: ThreadSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex items-center justify-center">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 select-none",
          "text-foreground hover:bg-muted",
          open && "bg-muted"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[160px] sm:max-w-[240px] truncate leading-snug">
          {currentTitle}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown — centered on the trigger button, not the viewport */}
      {open && (
        <div
          className="absolute top-full mt-1.5 w-72 sm:w-80 z-50"
          style={{ left: "50%", transform: "translateX(-50%)" }}
        >
        <div
          className={cn(
            "w-full",
            "bg-popover border border-border rounded-xl shadow-lg",
            "overflow-hidden",
            "thread-switcher-in"
          )}
          role="listbox"
        >
          {/* Header label */}
          <div className="px-4 pt-3 pb-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Recent chats
            </p>
          </div>

          {/* Thread list */}
          <div className="max-h-72 overflow-y-auto overscroll-contain px-2 pb-2 thread-scroll">
            {threads.length === 0 && !loadingThreads && (
              <p className="text-xs text-muted-foreground text-center py-6 px-4">
                No conversations yet.
              </p>
            )}

            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setOpen(false);
                  onSelectThread(thread.id);
                }}
                className="flex items-start gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
                role="option"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate leading-snug">
                    {thread.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {timeAgo(thread.updated_at)}
                  </p>
                </div>
              </button>
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={loadingThreads}
                className="flex items-center justify-center gap-2 w-full mt-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {loadingThreads && <Loader2 className="h-3 w-3 animate-spin" />}
                {loadingThreads ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </div>
        </div>
      )}

      <style>{`
        .thread-switcher-in {
          animation: tswIn 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: top center;
        }
        @keyframes tswIn {
          from { opacity: 0; transform: scale(0.97) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .thread-scroll::-webkit-scrollbar { width: 3px; }
        .thread-scroll::-webkit-scrollbar-track { background: transparent; }
        .thread-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 99px; }
      `}</style>
    </div>
  );
}
