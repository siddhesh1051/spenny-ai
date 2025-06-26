import type { Session } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import { Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import ShareTargetPage from "./pages/ShareTargetPage";
import { Sidebar } from "./components/sidebar";
import { ModeToggle } from "./components/mode-toggle";
import { Button } from "./components/ui/button";
import { X, Menu } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { toast } from "sonner";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userGeminiKey, setUserGeminiKey] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const getSessionAndProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("gemini_api_key")
          .eq("id", session.user.id)
          .single();
        setUserGeminiKey(profile?.gemini_api_key || null);
      }
    };
    getSessionAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        const getProfile = async () => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("gemini_api_key")
            .eq("id", session.user.id)
            .single();
          setUserGeminiKey(profile?.gemini_api_key || null);
        };
        getProfile();
      } else {
        navigate("/");
        setUserGeminiKey(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle share results and notifications
  useEffect(() => {
    const shareResult = searchParams.get("shared");
    const errorParam = searchParams.get("error");
    const infoParam = searchParams.get("info");

    if (shareResult === "success") {
      toast.success("Image processed! Expenses extracted and saved.");
      // Clean up URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("shared");
      navigate({ search: newSearchParams.toString() }, { replace: true });
    }

    if (errorParam) {
      let errorMessage = "Failed to process shared content";
      switch (errorParam) {
        case "invalid-file":
          errorMessage = "Invalid file type. Please share an image file.";
          break;
        case "no-file":
          errorMessage = "No image file was shared.";
          break;
        case "no-content":
          errorMessage = "No shared content detected.";
          break;
        case "share-failed":
          errorMessage = "Failed to process shared content.";
          break;
      }

      toast.error(errorMessage);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("error");
      navigate({ search: newSearchParams.toString() }, { replace: true });
    }

    if (infoParam === "text-received") {
      toast.info(
        "Text content received, but we need an image to extract expenses."
      );
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("info");
      navigate({ search: newSearchParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchExpenses = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchExpenses();
    }
  }, [session]);

  const addExpenses = async (newExpenses: Omit<Expense, "id" | "date">[]) => {
    if (!session) return;
    try {
      console.log("💾 Adding expenses to database:", newExpenses);

      const expensesWithDateAndUser = newExpenses.map((e) => ({
        ...e,
        date: new Date().toISOString(),
        user_id: session.user.id,
      }));
      const { data, error } = await supabase
        .from("expenses")
        .insert(expensesWithDateAndUser)
        .select();
      if (error) throw error;
      setExpenses((prevExpenses) => [...data, ...prevExpenses]);
      toast.success(`Added ${data.length} expense(s) from shared image!`);
      console.log("✅ Expenses added successfully:", data);
    } catch (error: any) {
      console.error("❌ Failed to add expenses:", error);
      setError(error.message);
      toast.error("Failed to save expenses");
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (error: any) {
      setError(error.message);
    }
  };

  const updateExpense = async (id: string, updatedFields: Partial<Expense>) => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(updatedFields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      setExpenses(expenses.map((e) => (e.id === id ? data : e)));
    } catch (error: any) {
      setError(error.message);
    }
  };

  const clearAllExpenses = async () => {
    if (!session) return;
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", session.user.id);
      if (error) throw error;
      setExpenses([]);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleMicClick = () => {
    // @ts-ignore
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      getStructuredExpenses(speechResult);
    };

    recognition.start();
  };

  const getStructuredExpenses = async (text: string) => {
    const apiKey = userGeminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API key is not set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an AI that extracts structured expense data from natural language input. For the sentence: '${text}', return a JSON array of {amount, category, description}.`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const responseText = data.candidates[0].content.parts[0].text;
        const cleanedJson = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "");
        const structuredExpenses = JSON.parse(cleanedJson);
        addExpenses(structuredExpenses);
      } else {
        setError("Could not extract expenses from the provided text.");
      }
    } catch (error) {
      setError("Error getting structured expenses.");
      console.error("Error getting structured expenses:", error);
    }
    setIsLoading(false);
  };

  const getStructuredExpensesFromImage = async (
    base64Image: string,
    mimeType: string
  ) => {
    const apiKey = userGeminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API key is not set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      console.log("🤖 Calling Gemini API for image analysis...");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "You are an AI that extracts structured expense data from an image of an order history, receipt, or bill. From the attached image, return a JSON array of {amount, category, description}. Make sure the category is one of the following: food, travel, groceries, entertainment, utilities, rent, other. Extract all visible expenses/items from the image.",
                  },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      console.log("🤖 Gemini API response:", data);

      if (data.candidates && data.candidates.length > 0) {
        const responseText = data.candidates[0].content.parts[0].text;
        console.log("📄 Raw response text:", responseText);

        const cleanedJson = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "");
        console.log("🧹 Cleaned JSON:", cleanedJson);

        const structuredExpenses = JSON.parse(cleanedJson);
        console.log("📊 Parsed expenses:", structuredExpenses);

        addExpenses(structuredExpenses);
      } else {
        console.log("❌ No candidates in Gemini response");
        setError("Could not extract expenses from the image.");
      }
    } catch (error) {
      console.error("❌ Error in Gemini API call:", error);
      setError("Error getting structured expenses from image.");
    }
    setIsLoading(false);
  };

  const handleExpenseImage = (file: File) => {
    console.log(
      "📷 Processing expense image:",
      file.name,
      file.type,
      file.size
    );

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(",")[1];
      if (base64String) {
        console.log("📷 Image converted to base64, sending to Gemini...");
        getStructuredExpensesFromImage(base64String, file.type);
      } else {
        console.error("❌ Failed to convert image to base64");
        toast.error("Failed to process image");
      }
    };
    reader.readAsDataURL(file);
  };

  if (!session) {
    return <AuthPage />;
  }

  const userName =
    session.user?.user_metadata?.full_name || session.user?.email;

  return (
    <>
      <PWAInstallPrompt />
      <div className="flex h-screen bg-background text-foreground">
        <div className="md:flex">
          <Sidebar
            user={session.user}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
          />
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              <h1 className="text-lg md:text-2xl font-bold">
                Welcome Back, {userName}!
              </h1>
            </div>
            <ModeToggle />
          </div>
          <Toaster />
          {error && (
            <div className="bg-red-500 text-white p-4 rounded-md mb-4 flex justify-between items-center">
              {error}
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  expenses={expenses}
                  isRecording={isRecording}
                  isLoading={isLoading}
                  handleMicClick={handleMicClick}
                  clearAllExpenses={clearAllExpenses}
                  getStructuredExpenses={getStructuredExpenses}
                  handleExpenseImage={handleExpenseImage}
                  deleteExpense={deleteExpense}
                  updateExpense={updateExpense}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <AnalyticsPage expenses={expenses} isLoading={isLoading} />
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/share-target"
              element={<ShareTargetPage onImageReceived={handleExpenseImage} />}
            />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;
