import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Plus, Upload, FileText, Check, X, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";


export function HomePage({
  isRecording,
  isLoading,
  handleMicClick,
  getStructuredExpenses,
  handleExpenseImage,
  handlePDFUpload,
  interimTranscript,
  pendingExpenses,
  confirmPendingExpenses,
  cancelPendingExpenses,
  editPendingExpense,
  stopAutoSaveTimer,
  isExpensesClosing,
}: {
  isRecording: boolean;
  isLoading: boolean;
  handleMicClick: () => void;
  getStructuredExpenses: (text: string) => Promise<void>;
  handleExpenseImage: (file: File) => void;
  handlePDFUpload: (file: File) => Promise<void>;
  interimTranscript?: string;
  pendingExpenses?: { amount: number; category: string; description: string }[] | null;
  confirmPendingExpenses?: () => void;
  cancelPendingExpenses?: () => void;
  editPendingExpense?: (index: number, field: "amount" | "category" | "description", value: string | number) => void;
  stopAutoSaveTimer?: () => void;
  isExpensesClosing?: boolean;
}) {
  const [textInput, setTextInput] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.imageUrl) {
        setLastImageUrl(e.detail.imageUrl);
      }
    };
    window.addEventListener("spenny-image-shared", handler);
    return () => window.removeEventListener("spenny-image-shared", handler);
  }, []);

  // Countdown timer for pending expenses
  useEffect(() => {
    if (pendingExpenses && pendingExpenses.length > 0 && editingIndex === null) {
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [pendingExpenses, editingIndex]);

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
    stopAutoSaveTimer?.();
  };

  const handleEditDone = () => {
    setEditingIndex(null);
  };

  const handleSaveTextExpense = async () => {
    if (textInput.trim()) {
      await getStructuredExpenses(textInput);
      setTextInput("");
      setIsAddDialogOpen(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleExpenseImage(file);
      const url = URL.createObjectURL(file);
      setLastImageUrl(url);
      window.dispatchEvent(
        new CustomEvent("spenny-image-shared", { detail: { imageUrl: url } })
      );
    }
    event.target.value = ""; // Reset file input
  };

  const handlePDFUploadInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handlePDFUpload(file);
    }
    event.target.value = ""; // Reset file input
  };

  return (
    <div>
      {lastImageUrl && (
        <div className="flex flex-col items-center mb-6">
          <img
            src={lastImageUrl}
            alt="Last uploaded or shared receipt"
            className="max-h-64 rounded-lg shadow border mb-2"
            style={{ objectFit: "contain" }}
          />
          <span className="text-xs text-muted-foreground">
            Last uploaded/shared image
          </span>
        </div>
      )}
      <div className="flex flex-col items-center justify-center h-auto md:h-[50vh] py-12 md:py-0">
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-center">
          Click the mic or button to start
        </h2>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="relative w-28 h-28 md:w-40 md:h-40 flex items-center justify-center">
            {isRecording && (
              <div className="absolute w-full h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-600 animate-spin-slow blur-xl"></div>
            )}
            <button
              onClick={handleMicClick}
              disabled={isLoading}
              className="cursor-pointer relative w-24 h-24 md:w-32 md:h-32 bg-[#1a0a30] rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div
                className="absolute w-full h-full rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(44,18,80,1) 0%, rgba(26,10,48,1) 60%)",
                }}
              ></div>
              <div className="relative z-10">
                {isLoading && isRecording ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </div>
            </button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-4 mt-4 max-w-4xl">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full shadow-lg transition-transform transform hover:scale-105 w-full lg:w-auto"
                disabled={isLoading}
              >
                Add Manually <Plus className="h-4 w-4 ml-2" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expenses Manually</DialogTitle>
                <DialogDescription>
                  Type your expenses in a single sentence. e.g., "Spent 10 on
                  coffee and 150 for groceries"
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Enter expenses here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveTextExpense();
                  }
                }}
              />
              <DialogFooter>
                <Button onClick={handleSaveTextExpense} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Expenses"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="lg"
            className="rounded-full shadow-lg transition-transform transform hover:scale-105 w-full lg:w-auto"
            disabled={isLoading}
          >
            <label
              htmlFor="image-upload"
              className="flex items-center cursor-pointer"
            >
              Upload Image
              {isLoading && !isRecording ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
              ) : (
                <Upload className="h-4 w-4 ml-2" />
              )}
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isLoading}
            />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="rounded-full shadow-lg transition-transform transform hover:scale-105 w-full lg:w-auto"
            disabled={isLoading}
          >
            <label
              htmlFor="pdf-upload"
              className="flex items-center cursor-pointer"
            >
              Upload PDF
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
              ) : (
                <FileText className="h-4 w-4 ml-2" />
              )}
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePDFUploadInput}
              disabled={isLoading}
            />
          </Button>
        </div>

        {/* Live Transcript Display */}
        {isRecording && interimTranscript && (
          <div className="mt-6 p-4 bg-primary/10 rounded-lg max-w-2xl w-full mx-auto border border-primary/20 animate-pulse">
            <p className="text-sm text-muted-foreground mb-1">You're saying:</p>
            <p className="text-lg font-medium">{interimTranscript}</p>
          </div>
        )}

        {/* Pending Expenses Confirmation */}
        {pendingExpenses && pendingExpenses.length > 0 && (
          <div 
            className="mt-6 max-w-3xl w-full mx-auto transition-all duration-300"
            style={{
              transform: isExpensesClosing ? 'scale(0.8)' : 'scale(1)',
              opacity: isExpensesClosing ? 0 : 1,
            }}
          >
            <div 
              className="relative p-6 bg-card rounded-lg shadow-lg transition-all duration-1000"
              style={{
                boxShadow: editingIndex === null 
                  ? `0 0 0 3px hsl(var(--primary))` 
                  : `0 0 0 2px hsl(var(--border))`,
                background: editingIndex === null
                  ? `linear-gradient(90deg, 
                      hsl(var(--card)) 0%, 
                      hsl(var(--card)) ${(countdown / 5) * 100}%, 
                      hsl(var(--card)) ${(countdown / 5) * 100}%, 
                      hsl(var(--card)) 100%)`
                  : 'hsl(var(--card))',
                borderWidth: '3px',
                borderStyle: 'solid',
                borderColor: 'transparent',
                borderImage: editingIndex === null
                  ? `linear-gradient(90deg, 
                      hsl(var(--primary)) 0%, 
                      hsl(var(--primary)) ${(countdown / 5) * 100}%, 
                      transparent ${(countdown / 5) * 100}%, 
                      transparent 100%) 1`
                  : 'none',
              }}
            >
              {/* Close button */}
              <button
                onClick={cancelPendingExpenses}
                className="cursor-pointer absolute top-4 right-4 p-1 hover:bg-muted rounded-full transition-colors z-10"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-4 pr-8">
                <h3 className="text-lg font-semibold">Adding these expenses:</h3>
              </div>

              <div className="space-y-3 mb-4">
                {pendingExpenses.map((expense, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-background rounded-lg border"
                  >
                    {editingIndex === index ? (
                      <>
                        <Input
                          type="number"
                          value={expense.amount}
                          onChange={(e) =>
                            editPendingExpense?.(index, "amount", e.target.value)
                          }
                          className="w-24"
                        />
                        <Input
                          value={expense.category}
                          onChange={(e) =>
                            editPendingExpense?.(index, "category", e.target.value)
                          }
                          className="w-32"
                        />
                        <Input
                          value={expense.description}
                          onChange={(e) =>
                            editPendingExpense?.(index, "description", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditDone}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-lg min-w-20">
                          ₹{expense.amount}
                        </span>
                        <span className="px-3 py-1 bg-primary/10 rounded-full text-sm capitalize min-w-28 text-center">
                          {expense.category}
                        </span>
                        <span className="flex-1">{expense.description}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {editingIndex !== null && (
                <Button
                  onClick={confirmPendingExpenses}
                  className="w-full"
                  size="lg"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm & Save
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
