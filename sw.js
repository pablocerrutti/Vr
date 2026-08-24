const CACHE_NAME = "lonewolf-nightvision-v1.3";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];


/* =========================================
   INSTALACIÓN
========================================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches
            .open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(
                    FILES_TO_CACHE
                );

            })

    );


    /*
     * Hace que la nueva versión quede
     * disponible inmediatamente.
     */

    self.skipWaiting();

});


/* =========================================
   ACTIVACIÓN
========================================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches
            .keys()
            .then(keys => {

                return Promise.all(

                    keys
                        .filter(key =>
                            key !== CACHE_NAME
                        )
                        .map(key =>
                            caches.delete(key)
                        )

                );

            })

    );


    /*
     * Toma inmediatamente el control
     * de las páginas abiertas.
     */

    self.clients.claim();

});


/* =========================================
   FETCH
========================================= */

self.addEventListener("fetch", event => {

    /*
     * Solo solicitudes GET.
     */

    if (
        event.request.method !== "GET"
    ) {

        return;

    }


    /*
     * Para los archivos de la aplicación:
     *
     * NETWORK FIRST
     *
     * Esto permite que cuando haya
     * Internet se descargue la versión
     * nueva.
     *
     * Si no hay Internet se utiliza
     * la copia almacenada.
     */

    const url =
        new URL(
            event.request.url
        );


    const isAppFile =
        url.pathname.endsWith(
            "/index.html"
        ) ||

        url.pathname.endsWith(
            "/app.js"
        ) ||

        url.pathname.endsWith(
            "/style.css"
        ) ||

        url.pathname.endsWith(
            "/manifest.json"
        );


    if (isAppFile) {

        event.respondWith(

            fetch(
                event.request,
                {
                    cache: "no-store"
                }
            )
            .then(response => {

                /*
                 * Guardar la versión nueva.
                 */

                if (
                    response.ok
                ) {

                    const copy =
                        response.clone();


                    caches
                        .open(
                            CACHE_NAME
                        )
                        .then(cache => {

                            cache.put(
                                event.request,
                                copy
                            );

                        });

                }


                return response;

            })
            .catch(() => {

                /*
                 * Sin Internet:
                 * utilizar versión offline.
                 */

                return caches.match(
                    event.request
                );

            })

        );


        return;

    }


    /*
     * Imágenes, iconos y demás:
     *
     * CACHE FIRST
     */

    event.respondWith(

        caches
            .match(
                event.request
            )
            .then(cached => {

                if (cached) {

                    return cached;

                }


                return fetch(
                    event.request
                )
                .then(response => {

                    if (
                        response.ok
                    ) {

                        const copy =
                            response.clone();


                        caches
                            .open(
                                CACHE_NAME
                            )
                            .then(cache => {

                                cache.put(
                                    event.request,
                                    copy
                                );

                            });

                    }


                    return response;

                });

            })

    );

});