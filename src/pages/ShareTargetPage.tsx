import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const ShareTargetPage: React.FC = () => {
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const [noImage, setNoImage] = useState<boolean>(false);
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
    setNoImage(true);
  }, [location.search]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Shared to Spenny AI</h1>
      {sharedTitle && <h2>{sharedTitle}</h2>}
      {sharedText && <p>{sharedText}</p>}
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
