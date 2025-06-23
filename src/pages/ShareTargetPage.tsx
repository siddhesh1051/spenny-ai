import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const UPLOAD_SERVER_URL = "http://localhost:5000/upload"; // Change to your deployed server URL

const ShareTargetPage: React.FC = () => {
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const [noImage, setNoImage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const imageUrl = params.get("url");
    const title = params.get("title");
    const text = params.get("text");
    if (imageUrl) {
      setSharedImage(imageUrl);
      setSharedTitle(title);
      setSharedText(text);
      setNoImage(false);
      return;
    }
    // Fallback: try to get file from launchQueue (PWA share target)
    if ("launchQueue" in window) {
      // @ts-expect-error: launchQueue is not yet typed in TypeScript
      window.launchQueue.setConsumer(async (launchParams: any) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const file = launchParams.files[0];
          setLoading(true);
          const formData = new FormData();
          formData.append("image", file);
          formData.append("title", launchParams.title || "");
          formData.append("text", launchParams.text || "");
          try {
            const response = await fetch(UPLOAD_SERVER_URL, {
              method: "POST",
              body: formData,
            });
            const data = await response.json();
            if (data.url) {
              setSharedImage(data.url);
              setSharedTitle(data.title);
              setSharedText(data.text);
              setNoImage(false);
            } else {
              setNoImage(true);
            }
          } catch (err) {
            setNoImage(true);
          } finally {
            setLoading(false);
          }
        } else {
          setNoImage(true);
        }
      });
    } else {
      setNoImage(true);
    }
  }, [location.search]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Shared to Spenny AI</h1>
      {sharedTitle && <h2>{sharedTitle}</h2>}
      {sharedText && <p>{sharedText}</p>}
      {loading && <p>Uploading image...</p>}
      {sharedImage && (
        <div>
          <img
            src={sharedImage}
            alt="Shared"
            style={{ maxWidth: 300, display: "block", marginBottom: 8 }}
          />
        </div>
      )}
      {noImage && <p>No valid image shared.</p>}
    </div>
  );
};

export default ShareTargetPage;
