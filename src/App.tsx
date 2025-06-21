import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar } from "@/components/sidebar";
import { HomePage } from "@/pages/HomePage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [expenses, setExpenses] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const addExpenses = (newExpenses) => {
    setExpenses((prevExpenses) => [...prevExpenses, ...newExpenses]);
  };

  const clearAllExpenses = () => {
    setExpenses([]);
  };

  const handleMicClick = () => {
    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      getStructuredExpenses(speechResult);
    };

    recognition.start();
  };

  const getStructuredExpenses = async (text) => {
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
        addExpenses(
          structuredExpenses.map((e) => ({
            ...e,
            date: new Date().toISOString(),
          }))
        );
      } else {
        setError("Could not extract expenses from the provided text.");
      }
    } catch (error) {
      setError("Error getting structured expenses.");
      console.error("Error getting structured expenses:", error);
    }
    setIsLoading(false);
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
