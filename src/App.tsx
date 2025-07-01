import type { Session } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import { Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import { Sidebar } from "./components/sidebar";
import { ModeToggle } from "./components/mode-toggle";
import { Button } from "./components/ui/button";
import { X, Menu } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { toast } from "sonner";
import ShareTargetPage from "./pages/ShareTargetPage";
import ApiKeysPage from "./pages/ApiKeysPage";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

// Your server URL - UPDATE THIS!
const SERVER_URL = "https://spenny-ai.onrender.com";

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

  // Handle shared files from server
  useEffect(() => {
    const shareId = searchParams.get("shareId");
    const errorParam = searchParams.get("error");

    if (shareId) {
      console.log("📦 Share ID detected:", shareId);
      toast.info("Processing shared image...");

      // Fetch the shared file from the server
      const fetchSharedFile = async () => {
        try {
          const response = await fetch(
            `${SERVER_URL}/api/shared-file/${shareId}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include", // Important for CORS
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.success && data.file) {
            console.log("📷 Shared file received:", data.file.name);

            // Convert data URL back to File object
            const dataUrl = data.file.dataUrl;
            const response2 = await fetch(dataUrl);
            const blob = await response2.blob();
            const file = new File([blob], data.file.name, {
              type: data.file.type,
            });

            // Process the image
            handleExpenseImage(file);
            toast.success("Image received! Processing with AI...");
          } else {
            console.error("❌ Failed to get shared file:", data.error);
            toast.error("Failed to retrieve shared image");
          }
        } catch (error: unknown) {
          console.error("❌ Error fetching shared file:", error);
          toast.error(
            `Error processing shared image: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      };

      fetchSharedFile();

      // Clean up URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("shareId");
      navigate({ search: newSearchParams.toString() }, { replace: true });
    }

    if (errorParam) {
      let errorMessage = "Failed to process shared content";
      switch (errorParam) {
        case "no-file":
          errorMessage = "No image file was shared.";
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
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
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
      toast.success(`Added ${data.length} expense(s) from document!`);
      console.log("✅ Expenses added successfully:", data);
    } catch (error: unknown) {
      console.error("❌ Failed to add expenses:", error);
      setError(error instanceof Error ? error.message : String(error));
      toast.error("Failed to save expenses");
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
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
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
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
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleMicClick = () => {
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

    recognition.onresult = (event: unknown) => {
      type SpeechResult = { transcript: string };
      type SpeechEvent = { results: SpeechResult[][] };
      if (
        typeof event === "object" &&
        event !== null &&
        "results" in event &&
        Array.isArray((event as SpeechEvent).results) &&
        (event as SpeechEvent).results[0] &&
        (event as SpeechEvent).results[0][0]
      ) {
        const speechResult = (event as SpeechEvent).results[0][0].transcript;
        getStructuredExpenses(speechResult);
      }
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      console.error("❌ Error in Gemini API call:", error);
      setError("Error getting structured expenses from image.");
    }
    setIsLoading(false);
  };

  const getStructuredExpensesFromPDF = async (pdfText: string) => {
    const apiKey = userGeminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API key is not set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      console.log("🤖 Calling Gemini API for PDF bank statement analysis...");

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
                    text: `You are an AI that extracts structured expense data from bank statement text. From the following bank statement text, identify and extract only DEBIT transactions (money going out) as expenses. 

Instructions:
1. Only extract DEBIT transactions (outgoing money)
2. Skip CREDIT transactions (incoming money like salary, deposits)
3. Skip internal transfers between accounts
4. For each expense, determine the most appropriate category from: food, travel, groceries, entertainment, utilities, rent, other
5. Use transaction descriptions to create meaningful expense descriptions
6. Return a JSON array of {amount, category, description}

Bank Statement Text:
${pdfText}`,
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
        console.log("📊 Parsed expenses from PDF:", structuredExpenses);

        if (structuredExpenses.length > 0) {
          addExpenses(structuredExpenses);
        } else {
          toast.info("No expense transactions found in the bank statement.");
        }
      } else {
        console.log("❌ No candidates in Gemini response");
        setError("Could not extract expenses from the bank statement.");
      }
    } catch (error: unknown) {
      console.error("❌ Error in Gemini API call:", error);
      setError("Error getting structured expenses from PDF.");
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

  const handlePDFUpload = async (file: File) => {
    console.log("📄 Processing PDF bank statement:", file.name, file.size);

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }

    // Check file size (limit to 5MB for better performance)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("PDF file is too large. Please use a file smaller than 5MB.");
      return;
    }

    setIsLoading(true);
    toast.info("Processing PDF bank statement...");

    try {
      // Simple approach: Convert PDF file directly to base64 and send to Gemini Vision
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1]; // Remove data:application/pdf;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log(
        "📄 PDF converted to base64, sending to Gemini Vision API..."
      );

      // Use Gemini Vision API to process the PDF directly
      await getStructuredExpensesFromPDFVision(base64Pdf);
    } catch (error: unknown) {
      console.error("❌ Error processing PDF:", error);

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes("invalid") ||
          errorMessage.includes("corrupted")
        ) {
          toast.error(
            "Invalid or corrupted PDF file. Please ensure the file is a valid PDF."
          );
        } else if (
          errorMessage.includes("password") ||
          errorMessage.includes("encrypted")
        ) {
          toast.error(
            "Password-protected PDF detected. Please use an unprotected PDF file."
          );
        } else if (
          errorMessage.includes("memory") ||
          errorMessage.includes("size")
        ) {
          toast.error(
            "PDF file is too complex. Try with a simpler or smaller file."
          );
        } else {
          toast.error(
            "Failed to process PDF. Please try with a different file."
          );
        }
      } else {
        toast.error("Unexpected error processing PDF. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStructuredExpensesFromPDFVision = async (base64Pdf: string) => {
    const apiKey = userGeminiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API key is not set.");
      return;
    }

    try {
      console.log("🤖 Calling Gemini Vision API for PDF analysis...");

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
                    text: `You are an AI that extracts structured expense data from a bank statement PDF. 

IMPORTANT INSTRUCTIONS:
1. Only extract DEBIT transactions (money going OUT of the account)
2. Skip CREDIT transactions (money coming IN like salary, deposits, refunds)
3. Skip internal transfers between accounts
4. Skip bank fees, interest earned, or account maintenance charges
5. Focus on actual purchases and payments that represent expenses
6. For each expense, determine the most appropriate category from: food, travel, groceries, entertainment, utilities, rent, other
7. Create SHORT, CLEAN descriptions (max 50 characters) - extract the merchant name or main purpose
8. Return a JSON array of {amount, category, description}
9. If no expense transactions found, return an empty array []

DESCRIPTION RULES:
- Keep descriptions SHORT and CLEAN (under 50 characters)
- Extract merchant/business name only (e.g., "Starbucks", "Amazon", "Uber")
- Remove transaction IDs, reference numbers, timestamps
- Remove unnecessary words like "PURCHASE", "PAYMENT", "DEBIT"
- For ATM: use "ATM Withdrawal" 
- For online: use just the merchant name
- For bills: use service name (e.g., "Electric Bill", "Internet Bill")

Examples of GOOD descriptions:
- "Starbucks Coffee"
- "Amazon Purchase"
- "Uber Ride"
- "ATM Withdrawal"
- "Electric Bill"
- "Grocery Store"

Examples of BAD descriptions (avoid these):
- "DEBIT CARD PURCHASE 12345 STARBUCKS STORE #1234 NEW YORK NY"
- "ELECTRONIC WITHDRAWAL 567890 AMAZON.COM AMZN.COM/BILL WA"

Examples of what TO extract:
- ATM withdrawals
- Card payments to merchants  
- Online purchases
- Bill payments (utilities, rent, etc.)
- Restaurant/food purchases
- Shopping transactions

Examples of what NOT to extract:
- Salary deposits
- Interest earned
- Refunds received
- Transfers from savings
- Bank fees
- Account opening bonuses

Please analyze this bank statement PDF and extract only expense transactions with clean, short descriptions:`,
                  },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: base64Pdf,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      console.log("🤖 Gemini Vision API response:", data);

      if (data.candidates && data.candidates.length > 0) {
        const responseText = data.candidates[0].content.parts[0].text;
        console.log("📄 Raw response text:", responseText);

        const cleanedJson = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        console.log("🧹 Cleaned JSON:", cleanedJson);

        const structuredExpenses = JSON.parse(cleanedJson);
        console.log("📊 Parsed expenses from PDF:", structuredExpenses);

        if (
          Array.isArray(structuredExpenses) &&
          structuredExpenses.length > 0
        ) {
          // Validate and clean the expenses with enhanced description sanitization
          const validExpenses = structuredExpenses
            .filter((expense) => {
              return (
                expense &&
                typeof expense.amount === "number" &&
                expense.amount > 0 &&
                typeof expense.category === "string" &&
                typeof expense.description === "string" &&
                expense.description.trim().length > 0
              );
            })
            .map((expense) => ({
              amount: Math.abs(expense.amount), // Ensure positive
              category: expense.category.toLowerCase(),
              description: sanitizeDescription(expense.description.trim()),
            }));

          if (validExpenses.length > 0) {
            await addExpenses(validExpenses);
            toast.success(
              `Successfully extracted ${validExpenses.length} expense transactions from bank statement!`
            );
          } else {
            toast.info(
              "No valid expense transactions found in the bank statement."
            );
          }
        } else {
          toast.info(
            "No expense transactions found in the bank statement. The PDF might contain only credit transactions or account summaries."
          );
        }
      } else {
        console.log("❌ No candidates in Gemini response");
        setError("Could not extract expenses from the bank statement PDF.");
      }
    } catch (error: unknown) {
      console.error("❌ Error in Gemini Vision API call:", error);
      if (error instanceof Error && error.message.includes("JSON")) {
        toast.error(
          "Could not parse bank statement data. Please ensure this is a proper bank statement PDF."
        );
      } else {
        setError("Error processing bank statement PDF with AI.");
      }
    }
  };

  // Helper function to sanitize and shorten descriptions
  const sanitizeDescription = (description: string): string => {
    if (!description || description.trim().length === 0) {
      return "Transaction";
    }

    let cleaned = description.trim();

    // Remove common bank prefixes and suffixes
    const prefixesToRemove = [
      /^DEBIT CARD PURCHASE\s*/i,
      /^DEBIT CARD\s*/i,
      /^CARD PURCHASE\s*/i,
      /^PURCHASE\s*/i,
      /^PAYMENT\s*/i,
      /^ELECTRONIC WITHDRAWAL\s*/i,
      /^ONLINE TRANSFER\s*/i,
      /^RECURRING PAYMENT\s*/i,
      /^DIRECT DEBIT\s*/i,
      /^WITHDRAWAL\s*/i,
      /^POS\s*/i,
      /^ATM\s*/i,
    ];

    // Remove suffixesToRemove patterns
    const suffixesToRemove = [
      /\s+\d{2}\/\d{2}\/\d{4}.*$/i, // Remove dates
      /\s+\d{2}\/\d{2}.*$/i, // Remove short dates
      /\s+#\d+.*$/i, // Remove reference numbers
      /\s+REF\s*\d+.*$/i, // Remove reference numbers
      /\s+[A-Z]{2}\s*\d+.*$/i, // Remove state codes and numbers
      /\s+\d{4,}.*$/i, // Remove long numbers (transaction IDs)
      /\s+AUTH.*$/i, // Remove authorization codes
      /\s+PENDING.*$/i, // Remove pending status
      /\s+\$\d+.*$/i, // Remove duplicate amounts
    ];

    // Apply prefix removal
    prefixesToRemove.forEach((regex) => {
      cleaned = cleaned.replace(regex, "");
    });

    // Apply suffix removal
    suffixesToRemove.forEach((regex) => {
      cleaned = cleaned.replace(regex, "");
    });

    // Remove extra spaces and clean up
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // Extract merchant name patterns
    const merchantPatterns = [
      // Amazon patterns
      /AMAZON\.?COM/i,
      /AMZN\.?COM/i,
      // Common food chains
      /STARBUCKS/i,
      /MCDONALDS/i,
      /SUBWAY/i,
      /DOMINOS/i,
      /PIZZA HUT/i,
      // Uber/Lyft
      /UBER/i,
      /LYFT/i,
      // Gas stations
      /SHELL/i,
      /EXXON/i,
      /CHEVRON/i,
      /BP /i,
      // Grocery stores
      /WALMART/i,
      /TARGET/i,
      /COSTCO/i,
      /SAFEWAY/i,
      // Utilities
      /ELECTRIC/i,
      /WATER/i,
      /GAS COMPANY/i,
      /INTERNET/i,
      /PHONE/i,
    ];

    // Check for known merchant patterns
    for (const pattern of merchantPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let merchantName = match[0];
        // Clean up common merchant names
        if (merchantName.toLowerCase().includes("amazon")) {
          return "Amazon Purchase";
        }
        if (merchantName.toLowerCase().includes("starbucks")) {
          return "Starbucks";
        }
        if (merchantName.toLowerCase().includes("uber")) {
          return "Uber Ride";
        }
        if (merchantName.toLowerCase().includes("lyft")) {
          return "Lyft Ride";
        }
        if (merchantName.toLowerCase().includes("electric")) {
          return "Electric Bill";
        }
        return (
          merchantName.charAt(0).toUpperCase() +
          merchantName.slice(1).toLowerCase()
        );
      }
    }

    // ATM withdrawal detection
    if (/ATM|CASH/i.test(cleaned)) {
      return "ATM Withdrawal";
    }

    // Bill payment detection
    if (/BILL|UTILITY|ELECTRIC|WATER|GAS|PHONE|INTERNET/i.test(cleaned)) {
      return "Bill Payment";
    }

    // Online purchase detection
    if (/ONLINE|WEB|\.COM/i.test(cleaned)) {
      return "Online Purchase";
    }

    // If still too long, take first meaningful part
    if (cleaned.length > 50) {
      const words = cleaned.split(" ");
      // Try to get first 2-3 meaningful words
      let shortDesc = words.slice(0, 3).join(" ");
      if (shortDesc.length > 50) {
        shortDesc = words.slice(0, 2).join(" ");
      }
      if (shortDesc.length > 50) {
        shortDesc = words[0];
      }
      cleaned = shortDesc;
    }

    // Final cleanup
    cleaned = cleaned.replace(/[^\w\s-]/g, "").trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // If still empty or too short, provide a default
    if (cleaned.length < 3) {
      return "Transaction";
    }

    return cleaned.length > 50 ? cleaned.substring(0, 47) + "..." : cleaned;
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
                  handlePDFUpload={handlePDFUpload}
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
            <Route path="/api-keys" element={<ApiKeysPage />} />
            <Route
              path="/share-target"
              element={
                <ShareTargetPage handleExpenseImage={handleExpenseImage} />
              }
            />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;
