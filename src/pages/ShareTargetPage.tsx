import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShareTargetPage() {
  const [status, setStatus] = useState("Processing shared image...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleShare() {
      if (window.location.pathname !== "/share-target") return;
      if ("launchQueue" in window) {
        // @ts-ignore
        window.launchQueue.setConsumer(async (launchParams) => {
          if (!launchParams.files || launchParams.files.length === 0) {
            setError("No image received.");
            setStatus("");
            return;
          }
          const file = launchParams.files[0].file;
          if (!file.type.startsWith("image/")) {
            setError("Shared file is not an image.");
            setStatus("");
            return;
          }
          setStatus("Uploading image...");
          // Upload to Supabase Storage (bucket: 'screenshots', path: Date.now()+filename)
          const filePath = `screenshots/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("screenshots")
            .upload(filePath, file);
          if (uploadError) {
            setError("Failed to upload image: " + uploadError.message);
            setStatus("");
            return;
          }
          setStatus("Image uploaded! Processing...");

          // Fetch the uploaded image as base64
          const { data: downloadData, error: downloadError } =
            await supabase.storage.from("screenshots").download(filePath);
          if (downloadError || !downloadData) {
            setError("Failed to download uploaded image for processing.");
            setStatus("");
            return;
          }
          const blob = downloadData;
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result?.toString().split(",")[1];
            if (!base64String) {
              setError("Failed to read image as base64.");
              setStatus("");
              return;
            }
            // Call Gemini API (same as getStructuredExpensesFromImage)
            setStatus("Processing image with AI...");
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
              setError("Gemini API key is not set.");
              setStatus("");
              return;
            }
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
                              mimeType: file.type,
                              data: base64String,
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
                // Add expenses to Supabase (assume user_id is not available here)
                const expensesWithDate = structuredExpenses.map((e: any) => ({
                  ...e,
                  date: new Date().toISOString(),
                }));
                const { error: insertError } = await supabase
                  .from("expenses")
                  .insert(expensesWithDate);
                if (insertError) {
                  setError("Failed to save expenses: " + insertError.message);
                  setStatus("");
                  return;
                }
                setStatus(
                  "Expenses extracted and saved! You can close this window."
                );
              } else {
                setError("Could not extract expenses from the image.");
                setStatus("");
              }
            } catch (err) {
              setError("Error processing image with AI.");
              setStatus("");
            }
          };
          reader.readAsDataURL(blob);
        });
      } else {
        setError("Web Share Target API not supported in this browser.");
        setStatus("");
      }
    }
    handleShare();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-2xl font-bold mb-4">Share to Spenny AI</h1>
      {status && <p className="mb-2 text-green-400">{status}</p>}
      {error && <p className="mb-2 text-red-500">{error}</p>}
      <p className="text-xs text-zinc-400">
        You can close this window when done.
      </p>
    </div>
  );
}
