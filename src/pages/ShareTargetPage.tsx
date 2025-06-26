// src/pages/ShareTargetPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ShareTargetPageProps {
  onImageReceived: (file: File) => void;
}

const ShareTargetPage: React.FC<ShareTargetPageProps> = ({
  onImageReceived,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing shared content...");
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleShare = async () => {
      try {
        console.log("🔍 Checking for shared data...");
        setStatus("Checking for shared data...");

        // Method 1: Check for Web Share Target API (launchQueue) - Most reliable for files
        if ("launchQueue" in window) {
          console.log("📱 Using Web Share Target API (launchQueue)");
          setStatus("Processing shared files...");

          // @ts-expect-error - launchQueue is experimental but supported
          window.launchQueue.setConsumer(async (launchParams: any) => {
            console.log("📦 Launch params received:", launchParams);

            if (launchParams.files && launchParams.files.length > 0) {
              const file = launchParams.files[0];
              console.log("📷 File received:", file.name, file.type, file.size);

              if (file.type.startsWith("image/")) {
                setStatus("Processing image with AI...");
                setIsProcessing(false);

                // Process the image
                onImageReceived(file);

                // Navigate back to main app
                setTimeout(() => {
                  navigate("/?shared=success");
                }, 1000);
              } else {
                console.log("❌ Invalid file type:", file.type);
                setStatus("Invalid file type. Please share an image.");
                setIsProcessing(false);
                setTimeout(() => navigate("/?error=invalid-file"), 3000);
              }
            } else {
              console.log("❌ No files in launch params");
              setStatus("No files received. Please try sharing an image.");
              setIsProcessing(false);
              setTimeout(() => navigate("/?error=no-file"), 3000);
            }
          });

          // Give launchQueue some time to process
          setTimeout(() => {
            if (isProcessing) {
              console.log("⏰ launchQueue timeout, checking URL params...");
              checkUrlParams();
            }
          }, 2000);
        } else {
          console.log("❌ launchQueue not supported, checking URL params...");
          checkUrlParams();
        }
      } catch (error) {
        console.error("❌ Error in handleShare:", error);
        setStatus("Error processing shared content");
        setIsProcessing(false);
        setTimeout(() => navigate("/?error=share-failed"), 3000);
      }
    };

    const checkUrlParams = () => {
      console.log("🔗 Checking URL parameters...");
      const title = searchParams.get("title");
      const text = searchParams.get("text");
      const url = searchParams.get("url");

      console.log("📋 URL params:", { title, text, url });

      if (title || text || url) {
        // We have some shared content, but no file
        // This might be a text/url share, not image
        setStatus(
          "Text content received, but we need an image to process expenses."
        );
        setIsProcessing(false);
        setTimeout(() => navigate("/?info=text-received"), 3000);
      } else {
        // No content at all
        setStatus("No shared content detected. Please try sharing an image.");
        setIsProcessing(false);
        setTimeout(() => navigate("/?error=no-content"), 3000);
      }
    };

    handleShare();
  }, [navigate, onImageReceived, searchParams, isProcessing]);

  const handleManualReturn = () => {
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center max-w-md">
        {isProcessing ? (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📱</span>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4">
          {isProcessing
            ? "Processing Shared Content"
            : "Share Processing Complete"}
        </h2>

        <p className="text-muted-foreground mb-6">{status}</p>

        {!isProcessing && (
          <div className="space-y-3">
            <Button onClick={handleManualReturn} className="w-full">
              Return to Spenny AI
            </Button>

            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                💡 <strong>Tip:</strong> To share expense images:
              </p>
              <ol className="text-left space-y-1 ml-4">
                <li>1. Open your gallery/photos app</li>
                <li>2. Select a receipt or expense image</li>
                <li>3. Tap "Share" and choose "Spenny AI"</li>
                <li>4. We'll automatically extract the expenses!</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareTargetPage;
