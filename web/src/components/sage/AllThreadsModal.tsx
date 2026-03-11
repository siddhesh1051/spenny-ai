import { useEffect, useRef, useState, useMemo } from "react";
import { MessageSquare, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatThread } from "@/hooks/useChatThreads";

interface Props {
  threads: ChatThread[];
  onSelectThread: (id: string) => void;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AllThreadsModal({ threads, onSelectThread, onClose }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // autofocus search on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm all-threads-overlay-in"
    >
      <div className="relative w-full max-w-lg mx-4 bg-popover border border-border rounded-2xl shadow-2xl flex flex-col all-threads-modal-in overflow-hidden"
        style={{ maxHeight: "min(80vh, 640px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-foreground">All chats</span>
            <span className="text-xs text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-full">
              {threads.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 bg-muted/60 rounded-xl px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search chats…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 all-threads-scroll">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/60">
              <Search className="h-8 w-8 opacity-40" />
              <p className="text-sm">No chats found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((thread, idx) => (
                <button
                  key={thread.id}
                  onClick={() => { onSelectThread(thread.id); onClose(); }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left hover:bg-muted/60 transition-colors group",
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary/70 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground/80 group-hover:text-foreground truncate">
                      {thread.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50">
                      {timeAgo(thread.updated_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .all-threads-overlay-in {
          animation: atOverlayIn 0.18s ease both;
        }
        @keyframes atOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .all-threads-modal-in {
          animation: atModalIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes atModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .all-threads-scroll::-webkit-scrollbar { width: 4px; }
        .all-threads-scroll::-webkit-scrollbar-track { background: transparent; }
        .all-threads-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 999px; }
      `}</style>
    </div>
  );
}
