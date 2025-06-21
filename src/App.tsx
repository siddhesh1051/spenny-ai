import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar } from "@/components/sidebar";
import { HomePage } from "@/pages/HomePage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface Expense {
  amount: number;
  category: string;
  description: string;
  date: string;
}

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedExpenses = localStorage.getItem("expenses");
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses));
      }
    } catch (error) {
      console.error("Error parsing expenses from local storage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("expenses", JSON.stringify(expenses));
    } catch (error) {
      console.error("Error saving expenses to local storage:", error);
    }
  }, [expenses]);

  const addExpenses = (newExpenses: Omit<Expense, "date">[]) => {
    const expensesWithDate = newExpenses.map((e) => ({
      ...e,
      date: new Date().toISOString(),
    }));
    setExpenses((prevExpenses) => [...prevExpenses, ...expensesWithDate]);
  };

  const clearAllExpenses = () => {
    setExpenses([]);
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
    if (!GEMINI_API_KEY) {
      setError("Gemini API key is not set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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
    if (!GEMINI_API_KEY) {
      setError("Gemini API key is not set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Welcome Back, Janice!</h1>
          <ModeToggle />
        </div>
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
              />
            }
          />
          <Route
            path="/analytics"
            element={<AnalyticsPage expenses={expenses} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
