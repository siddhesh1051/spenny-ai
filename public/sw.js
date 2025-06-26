// public/sw.js
const CACHE_NAME = "spenny-ai-v1";
const SHARED_CACHE = "spenny-shared-images";

// Install event
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting(); // Force activation
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(self.clients.claim()); // Take control immediately
});

// Fetch event - This is crucial for intercepting the share target
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  console.log("SW intercepted:", event.request.method, url.pathname);

  // Handle share target POST request
  if (url.pathname === "/share-target" && event.request.method === "POST") {
    console.log("Handling share target request");
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Handle all other requests normally
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback for offline scenarios
      return caches.match(event.request);
    })
  );
});

// Handle share target
async function handleShareTarget(request) {
  console.log("Processing share target...");

  try {
    const formData = await request.formData();
    console.log("FormData entries:", [...formData.entries()]);

    const files = formData.getAll("files");
    const title = formData.get("title") || "";
    const text = formData.get("text") || "";
    const url = formData.get("url") || "";

    console.log("Files received:", files.length);

    if (files && files.length > 0) {
      const file = files[0];
      console.log("Processing file:", file.name, file.type, file.size);

      if (file instanceof File && file.type.startsWith("image/")) {
        // Create a unique identifier for this share
        const shareId = `share-${Date.now()}`;

        // Store file info and content
        const cache = await caches.open(SHARED_CACHE);

        // Store metadata
        const metadataResponse = new Response(
          JSON.stringify({
            shareId: shareId,
            name: file.name,
            type: file.type,
            size: file.size,
            title: title,
            text: text,
            url: url,
            timestamp: Date.now(),
          })
        );
        await cache.put(`metadata-${shareId}`, metadataResponse);

        // Store the actual file
        const fileResponse = new Response(file);
        await cache.put(`file-${shareId}`, fileResponse);

        console.log("Stored shared file with ID:", shareId);

        // Notify all clients
        const clients = await self.clients.matchAll({
          includeUncontrolled: true,
        });

        console.log("Notifying clients:", clients.length);

        clients.forEach((client) => {
          client.postMessage({
            type: "SHARED_IMAGE",
            shareId: shareId,
            metadata: {
              name: file.name,
              type: file.type,
              size: file.size,
              title: title,
              text: text,
              timestamp: Date.now(),
            },
          });
        });

        // Redirect to main app with success indicator
        return Response.redirect("/?shared=true", 302);
      } else {
        console.log("Invalid file type or no file");
        return Response.redirect("/?error=invalid-file", 302);
      }
    } else {
      console.log("No files in form data");
      return Response.redirect("/?error=no-file", 302);
    }
  } catch (error) {
    console.error("Error handling share target:", error);
    return Response.redirect("/?error=share-failed", 302);
  }
}

// Listen for messages from the main app
self.addEventListener("message", (event) => {
  console.log("SW received message:", event.data);

  if (event.data.type === "GET_SHARED_FILE") {
    handleGetSharedFile(event);
  }
});

// Handle requests for shared files
async function handleGetSharedFile(event) {
  try {
    const { shareId } = event.data;
    const cache = await caches.open(SHARED_CACHE);

    // Get file
    const fileResponse = await cache.match(`file-${shareId}`);
    if (fileResponse) {
      const blob = await fileResponse.blob();

      // Send file back to client
      event.ports[0].postMessage({
        success: true,
        file: blob,
      });

      // Clean up
      await cache.delete(`metadata-${shareId}`);
      await cache.delete(`file-${shareId}`);
    } else {
      event.ports[0].postMessage({
        success: false,
        error: "File not found",
      });
    }
  } catch (error) {
    console.error("Error getting shared file:", error);
    event.ports[0].postMessage({
      success: false,
      error: error.message,
    });
  }
}
