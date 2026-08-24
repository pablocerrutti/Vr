/* =========================================
   SERVICE WORKER
   NIGHT VISION
========================================= */


/*
 * CAMBIA ESTA VERSIÓN CADA VEZ QUE PUBLIQUES
 * UNA MODIFICACIÓN.
 */

const CACHE_VERSION =
    "night-vision-v1.0.0";


const CACHE_FILES = [

    "./",

    "./index.html",

    "./style.css",

    "./app.js",

    "./manifest.json"

];


/* =========================================
   INSTALACIÓN
========================================= */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(
                CACHE_VERSION
            )

            .then(cache => {

                return cache.addAll(
                    CACHE_FILES
                );

            })

            /*
             * Permitir que la nueva versión
             * se active inmediatamente.
             */

            .then(() => {

                return self.skipWaiting();

            })

        );

    }
);


/* =========================================
   ACTIVACIÓN
========================================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()

            .then(keys => {

                return Promise.all(

                    keys
                        .filter(
                            key =>
                                key !==
                                CACHE_VERSION
                        )

                        .map(
                            key =>
                                caches.delete(
                                    key
                                )
                        )

                );

            })

            .then(() => {

                return self.clients.claim();

            })

        );

    }
);


/* =========================================
   MENSAJES
========================================= */

self.addEventListener(
    "message",
    event => {

        if (
            event.data &&
            event.data.type ===
                "SKIP_WAITING"
        ) {

            self.skipWaiting();

        }

    }
);


/* =========================================
   FETCH
========================================= */

self.addEventListener(
    "fetch",
    event => {

        /*
         * Solamente peticiones GET.
         */

        if (
            event.request.method !==
            "GET"
        ) {

            return;

        }


        /*
         * No intervenir en recursos
         * blob ni datos de cámara.
         */

        if (
            event.request.url.startsWith(
                "blob:"
            )
        ) {

            return;

        }


        event.respondWith(

            caches.match(
                event.request
            )

            .then(cached => {

                /*
                 * Si está en caché,
                 * utilizarlo inmediatamente.
                 */

                if (cached) {

                    return cached;

                }


                /*
                 * Si no está,
                 * descargarlo.
                 */

                return fetch(
                    event.request
                )

                .then(response => {

                    if (
                        !response ||
                        response.status !== 200
                    ) {

                        return response;

                    }


                    /*
                     * Guardar copia.
                     */

                    const copy =
                        response.clone();


                    caches.open(
                        CACHE_VERSION
                    )
                    .then(cache => {

                        cache.put(
                            event.request,
                            copy
                        );

                    });


                    return response;

                });

            })

        );

    }
);