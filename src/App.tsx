import type { Session } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import { Routes, Route, useNavigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import { Sidebar } from "./components/sidebar";
import { ModeToggle } from "./components/mode-toggle";
import { Button } from "./components/ui/button";
import { X, Menu } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ShareTargetPage from "./pages/ShareTargetPage";
import ShareTargetHandler from "./pages/ShareTargetHandler";

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
        // Fetch profile again on auth change, e.g. login
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
    } catch (error: any) {
      setError(error.message);
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
                    text: "You are an AI that extracts structured expense data from an image of an order history. From the attached image, return a JSON array of {amount, category, description}. Make sure the category is one of the following: food, travel, groceries, entertainment, utilities, rent, other.",
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
      if (data.candidates && data.candidates.length > 0) {
        const responseText = data.candidates[0].content.parts[0].text;
        const cleanedJson = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "");
        const structuredExpenses = JSON.parse(cleanedJson);
        addExpenses(structuredExpenses);
      } else {
        setError("Could not extract expenses from the image.");
      }
    } catch (error) {
      setError("Error getting structured expenses from image.");
      console.error("Error getting structured expenses from image:", error);
    }
    setIsLoading(false);
  };

  const handleExpenseImage = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(",")[1];
      if (base64String) {
        getStructuredExpensesFromImage(base64String, file.type);
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
            <Route path="/share-target" element={<ShareTargetPage />} />
            <Route path="/upload" element={<ShareTargetHandler />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;
