import React, { useEffect, useState } from "react";

interface ShareTargetPageProps {
  handleExpenseImage: (file: File) => void;
}

const ShareTargetPage: React.FC<ShareTargetPageProps> = ({
  handleExpenseImage,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run on mount
    if (
      window.location.pathname === "/share-target" &&
      window.location.search === ""
    ) {
      // Try to extract file from POST (PWA share)
      // This only works if the browser supports the Web Share Target API
      // and the page is loaded as a POST with form data
      // Chrome on Android supports this
      (async () => {
        try {
          const launchQueue = (window as any).launchQueue;
          if (launchQueue) {
            launchQueue.setConsumer(async (launchParams: any) => {
              if (!launchParams.files || launchParams.files.length === 0) {
                setError("No image file was shared.");
                return;
              }
              const fileHandle = launchParams.files[0];
              const file = await fileHandle.getFile();
              setFileName(file.name);
              const url = URL.createObjectURL(file);
              setImageUrl(url);
              handleExpenseImage(file);
            });
            return;
          }

          // Fallback: try to get file from form POST
          if (
            "formData" in window &&
            (window as any).formData instanceof FormData
          ) {
            const formData = (window as any).formData as FormData;
            const files = formData.getAll("files");
            if (
              Array.isArray(files) &&
              files.length > 0 &&
              files[0] instanceof File
            ) {
              const file = files[0] as File;
              setFileName(file.name);
              const url = URL.createObjectURL(file);
              setImageUrl(url);
              handleExpenseImage(file);
              return;
            }
          }

          // Fallback: try to parse from document.forms
          const form = document.forms[0];
          if (form) {
            const filesInput = form.elements.namedItem(
              "files"
            ) as HTMLInputElement | null;
            if (filesInput && filesInput.files && filesInput.files.length > 0) {
              const file = filesInput.files[0];
              setFileName(file.name);
              const url = URL.createObjectURL(file);
              setImageUrl(url);
              handleExpenseImage(file);
              return;
            }
          }

          setError("No image file was shared.");
        } catch (e) {
          setError("Failed to process shared image.");
        }
      })();
    }
  }, [handleExpenseImage]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <h2 className="text-2xl font-bold mb-4">Share Image to Spenny AI</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={fileName || "Shared image"}
            className="max-h-80 rounded-lg shadow border mb-2"
            style={{ objectFit: "contain" }}
          />
          <div className="text-xs text-muted-foreground mb-4">{fileName}</div>
          <div className="text-green-600 font-semibold">
            Image shared successfully!
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground">
          <p>
            To use this feature, open your gallery or file manager, select an
            image, tap share, and choose <b>Spenny AI</b> from the share menu.
          </p>
          <p className="mt-2">
            The shared image will appear here and be processed automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default ShareTargetPage;
