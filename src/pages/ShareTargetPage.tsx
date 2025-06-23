import React, { useEffect, useState } from "react";

// Define a type for launchParams
interface LaunchParams {
  files?: File[];
  title?: string;
  text?: string;
}

const ShareTargetPage: React.FC = () => {
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<number | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const [noImage, setNoImage] = useState<boolean>(false);

  useEffect(() => {
    // launchQueue is not yet typed in TypeScript
    if ("launchQueue" in window) {
      // @ts-expect-error: launchQueue is not yet typed in TypeScript
      window.launchQueue.setConsumer((launchParams: LaunchParams) => {
        let foundImage = false;
        if (launchParams.files && launchParams.files.length > 0) {
          for (const fileHandle of launchParams.files) {
            if (fileHandle.type && fileHandle.type.startsWith("image/")) {
              const url = URL.createObjectURL(fileHandle);
              setSharedImage(url);
              setImageName(fileHandle.name);
              setImageSize(fileHandle.size);
              foundImage = true;
              break; // Only show the first image
            }
          }
        }
        setSharedTitle(launchParams.title || null);
        setSharedText(launchParams.text || null);
        setNoImage(!foundImage);
      });
    }
  }, []);

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
          <div style={{ fontSize: 14, color: "#555" }}>
            <div>File: {imageName}</div>
            <div>Size: {imageSize ? (imageSize / 1024).toFixed(1) : 0} KB</div>
          </div>
        </div>
      )}
      {noImage && <p>No valid image shared.</p>}
    </div>
  );
};

export default ShareTargetPage;
