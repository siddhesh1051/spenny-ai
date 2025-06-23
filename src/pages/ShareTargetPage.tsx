import React, { useEffect, useState } from "react";

// Define a type for launchParams
interface LaunchParams {
  files?: File[];
  title?: string;
  text?: string;
}

const ShareTargetPage: React.FC = () => {
  const [sharedImage, setSharedImage] = useState<string | null>(null);
  const [sharedTitle, setSharedTitle] = useState<string | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);

  useEffect(() => {
    // launchQueue is not yet typed in TypeScript
    if ("launchQueue" in window) {
      // @ts-expect-error: launchQueue is not yet typed in TypeScript
      window.launchQueue.setConsumer((launchParams: LaunchParams) => {
        if (launchParams.files && launchParams.files.length > 0) {
          for (const fileHandle of launchParams.files) {
            if (fileHandle.type && fileHandle.type.startsWith("image/")) {
              const url = URL.createObjectURL(fileHandle);
              setSharedImage(url);
            }
          }
        }
        setSharedTitle(launchParams.title || null);
        setSharedText(launchParams.text || null);
      });
    }
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Shared to Spenny AI</h1>
      {sharedTitle && <h2>{sharedTitle}</h2>}
      {sharedText && <p>{sharedText}</p>}
      {sharedImage && (
        <img src={sharedImage} alt="Shared" style={{ maxWidth: 300 }} />
      )}
      {!sharedImage && <p>No image shared.</p>}
    </div>
  );
};

export default ShareTargetPage;
