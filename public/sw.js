// public/sw.js
const CACHE_NAME = "spenny-ai-v1";
const urlsToCache = [
  "/",
  "/static/js/bundle.js",
  "/static/css/main.css",
  "/manifest.json",
];

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle share target POST request
  if (url.pathname === "/share-target" && event.request.method === "POST") {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Regular fetch handling
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle share target
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const title = formData.get("title") || "";
    const text = formData.get("text") || "";

    if (image && image instanceof File) {
      // Store the shared image data
      const imageData = {
        file: image,
        title: title,
        text: text,
        timestamp: Date.now(),
      };

      // Store in Cache API or IndexedDB for the React app to access
      const cache = await caches.open("shared-images");
      const response = new Response(
        JSON.stringify({
          name: image.name,
          type: image.type,
          size: image.size,
          title: title,
          text: text,
          timestamp: Date.now(),
        })
      );

      await cache.put(`shared-image-${Date.now()}`, response);

      // Also store the actual file
      const fileResponse = new Response(image);
      await cache.put(`shared-file-${Date.now()}`, fileResponse);

      // Notify all clients about the shared image
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: "SHARED_IMAGE",
          data: {
            name: image.name,
            type: image.type,
            size: image.size,
            title: title,
            text: text,
            timestamp: Date.now(),
          },
        });
      });
    }

    // Redirect to the main app
    return Response.redirect("/?shared=true", 302);
  } catch (error) {
    console.error("Error handling share target:", error);
    return Response.redirect("/?error=share-failed", 302);
  }
}
