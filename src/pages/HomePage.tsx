import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Plus, Upload, FileText } from "lucide-react";
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

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function HomePage({
  isRecording,
  isLoading,
  handleMicClick,
  getStructuredExpenses,
  handleExpenseImage,
  handlePDFUpload,
}: {
  isRecording: boolean;
  isLoading: boolean;
  handleMicClick: () => void;
  getStructuredExpenses: (text: string) => Promise<void>;
  handleExpenseImage: (file: File) => void;
  handlePDFUpload: (file: File) => Promise<void>;
}) {
  const [textInput, setTextInput] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.imageUrl) {
        setLastImageUrl(e.detail.imageUrl);
      }
    };
    window.addEventListener("spenny-image-shared", handler);
    return () => window.removeEventListener("spenny-image-shared", handler);
  }, []);

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
              className="relative w-24 h-24 md:w-32 md:h-32 bg-[#1a0a30] rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50"
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
      </div>
    </div>
  );
}
