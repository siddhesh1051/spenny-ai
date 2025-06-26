// public/sw.js
const CACHE_NAME = "spenny-ai-v2";
const SHARED_CACHE = "spenny-shared-images-v2";

console.log("Service Worker script loaded");

// Install event
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing...");
  self.skipWaiting(); // Force activation immediately
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activating...");
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log("✅ Service Worker now controls all pages");
    })
  );
});

// CRITICAL: This must intercept the POST request
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Log ALL requests to debug
  console.log(`🌐 SW intercepted: ${event.request.method} ${url.pathname}`);

  // Handle share target POST request - THIS IS THE KEY PART
  if (url.pathname === "/share-target" && event.request.method === "POST") {
    console.log("🎯 INTERCEPTING SHARE TARGET POST REQUEST");
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Handle all other requests normally
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.log("❌ Fetch failed:", error);
      return caches.match(event.request);
    })
  );
});

// Handle share target
async function handleShareTarget(request) {
  console.log("📤 Processing share target request...");

  try {
    const formData = await request.formData();
    console.log("📋 FormData received");

    // Log all form entries for debugging
    for (let [key, value] of formData.entries()) {
      console.log(`📝 FormData: ${key} =`, value);
    }

    const files = formData.getAll("files");
    const title = formData.get("title") || "";
    const text = formData.get("text") || "";
    const url = formData.get("url") || "";

    console.log(`📁 Files received: ${files.length}`);

    if (files && files.length > 0) {
      const file = files[0];
      console.log(
        `📷 Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`
      );

      if (file instanceof File && file.type.startsWith("image/")) {
        const shareId = `share-${Date.now()}`;
        console.log(`💾 Storing with ID: ${shareId}`);

        try {
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

          console.log("✅ File stored successfully");

          // Notify all clients
          const clients = await self.clients.matchAll({
            includeUncontrolled: true,
            type: "window",
          });

          console.log(`📢 Notifying ${clients.length} clients`);

          const message = {
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
          };

          clients.forEach((client) => {
            console.log("📤 Sending message to client:", message);
            client.postMessage(message);
          });

          console.log("🔄 Redirecting to main app...");
          return Response.redirect("/?shared=true", 302);
        } catch (cacheError) {
          console.error("❌ Cache error:", cacheError);
          return Response.redirect("/?error=cache-failed", 302);
        }
      } else {
        console.log("❌ Invalid file type or not a file");
        return Response.redirect("/?error=invalid-file", 302);
      }
    } else {
      console.log("❌ No files in form data");
      return Response.redirect("/?error=no-file", 302);
    }
  } catch (error) {
    console.error("❌ Error handling share target:", error);
    return Response.redirect("/?error=share-failed", 302);
  }
}

// Listen for messages from the main app
self.addEventListener("message", (event) => {
  console.log("📨 SW received message:", event.data);

  if (event.data.type === "GET_SHARED_FILE") {
    handleGetSharedFile(event);
  } else if (event.data.type === "PING") {
    // Health check
    event.ports[0]?.postMessage({ type: "PONG", timestamp: Date.now() });
  }
});

// Handle requests for shared files
async function handleGetSharedFile(event) {
  try {
    const { shareId } = event.data;
    console.log(`📁 Getting shared file: ${shareId}`);

    const cache = await caches.open(SHARED_CACHE);

    // Get file
    const fileResponse = await cache.match(`file-${shareId}`);
    if (fileResponse) {
      const blob = await fileResponse.blob();
      console.log("✅ File retrieved successfully");

      // Send file back to client
      event.ports[0].postMessage({
        success: true,
        file: blob,
      });

      // Clean up
      await cache.delete(`metadata-${shareId}`);
      await cache.delete(`file-${shareId}`);
      console.log("🗑️ Cache cleaned up");
    } else {
      console.log("❌ File not found in cache");
      event.ports[0].postMessage({
        success: false,
        error: "File not found",
      });
    }
  } catch (error) {
    console.error("❌ Error getting shared file:", error);
    event.ports[0].postMessage({
      success: false,
      error: error.message,
    });
  }
}
