const CACHE_VERSION = "visor-nocturno-3";

const CACHE_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];

// INSTALACIÓN
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(CACHE_FILES))
            .then(() => self.skipWaiting())
    );
});

// ACTIVACIÓN
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key => key !== CACHE_VERSION)
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// PETICIONES
self.addEventListener("fetch", event => {

    // No interceptar cámara, blobs ni APIs externas
    if (
        event.request.url.startsWith("blob:") ||
        event.request.method !== "GET"
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {

                        if (
                            response &&
                            response.status === 200 &&
                            response.type === "basic"
                        ) {
                            const copy = response.clone();

                            caches.open(CACHE_VERSION)
                                .then(cache => {
                                    cache.put(event.request, copy);
                                });
                        }

                        return response;
                    });
            })
    );
});