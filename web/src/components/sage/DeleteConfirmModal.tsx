import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  threadTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ threadTitle, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // autofocus cancel button (safer default)
  useEffect(() => {
    setTimeout(() => cancelRef.current?.focus(), 60);
  }, []);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm delete-confirm-overlay-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="relative w-full max-w-sm mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden delete-confirm-modal-in">
        {/* Icon */}
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1.5">Delete conversation?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/80">"{threadTitle}"</span>
            {" "}will be permanently deleted. This cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <style>{`
        .delete-confirm-overlay-in {
          animation: dcOverlayIn 0.15s ease both;
        }
        @keyframes dcOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .delete-confirm-modal-in {
          animation: dcModalIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes dcModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
