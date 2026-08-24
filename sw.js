/* =========================================================
   LONWOLF NIGHTVISION VR
   SERVICE WORKER V5
   ========================================================= */

const CACHE =
  "nightvision-vr-v5";


const ASSETS = [

  "./",

  "./index.html",

  "./css/style.css",

  "./js/app.js?v=5",

  "./manifest.json"

];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE)

        .then(
          cache =>
            cache.addAll(
              ASSETS
            )
        )

        .then(
          () =>
            self.skipWaiting()
        )

    );

  }
);


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()

        .then(
          keys =>

            Promise.all(

              keys

                .filter(
                  key =>
                    key !== CACHE
                )

                .map(
                  key =>
                    caches.delete(
                      key
                    )
                )

            )

        )

        .then(
          () =>
            self.clients.claim()
        )

    );

  }
);


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener(
  "fetch",
  event => {

    if (
      event.request.method !==
      "GET"
    ) {

      return;

    }


    event.respondWith(

      fetch(
        event.request
      )

        .then(
          response => {

            /*
               Guardar la versión
               nueva.
            */

            const copy =
              response.clone();


            caches
              .open(CACHE)
              .then(
                cache => {

                  cache.put(
                    event.request,
                    copy
                  );

                }
              );


            return response;

          }
        )

        .catch(
          () =>

            caches.match(
              event.request
            )

        )

    );

  }
);