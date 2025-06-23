import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const UPLOAD_SERVER_URL = "https://spenny-ai.onrender.com/upload"; // Change to your deployed backend if needed

const ShareTargetHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleShare = async () => {
      // For PWA share target (Android Chrome)
      if ("launchQueue" in window) {
        // @ts-expect-error
        window.launchQueue.setConsumer(async (launchParams: any) => {
          if (launchParams.files && launchParams.files.length > 0) {
            const file = launchParams.files[0];
            const formData = new FormData();
            formData.append("image", file);
            formData.append("title", launchParams.title || "");
            formData.append("text", launchParams.text || "");
            try {
              const response = await fetch(UPLOAD_SERVER_URL, {
                method: "POST",
                body: formData,
              });
              if (response.ok) {
                navigate("/share-target?success=1");
              } else {
                navigate("/share-target?error=1");
              }
            } catch (error) {
              navigate("/share-target?error=1");
            }
          } else {
            navigate("/share-target?error=1");
          }
        });
      } else {
        // Fallback: show error or redirect
        navigate("/share-target?error=1");
      }
    };
    handleShare();
  }, [navigate]);

  return <div>Processing shared content...</div>;
};

export default ShareTargetHandler;
