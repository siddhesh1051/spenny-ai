// Service Worker for PWA Share Target

const DB_NAME = "spenny-share-target";
const STORE_NAME = "shared-images";

function openDB() {
  return (
    new Promise() <
    IDBDatabase >
    ((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })
  );
}

async function storeImage(file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, "latest");
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get("files");
          if (file && file instanceof File) {
            await storeImage(file);
          }
        } catch (e) {
          // Ignore errors
        }
        // Redirect to /share-target (GET)
        return Response.redirect("/share-target", 303);
      })()
    );
  }
});
