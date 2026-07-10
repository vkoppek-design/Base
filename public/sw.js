const CACHE_NAME = "lms-pwa-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/pwa-icon-512.png",
  "/favicon.ico"
];

// Install Event - Pre-cache core shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline shell");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Handle offline requests
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests, hot reloads, Chrome extensions, and Supabase API calls
  if (
    request.method !== "GET" ||
    url.pathname.includes("webpack-hmr") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Network-First strategy for HTML pages (documents) to ensure fresh content when online
  if (request.mode === "navigate" || request.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response and save it to cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to cached dashboard first (better offline UX), then to root page
            return caches.match("/dashboard").then((dashResponse) => {
              return dashResponse || caches.match("/");
            });
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static resources (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Silent catch for network errors when offline
        });

      // Return cached response immediately, or wait for fetch if not cached
      return cachedResponse || fetchPromise;
    })
  );
});
