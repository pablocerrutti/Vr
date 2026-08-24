const CACHE = "nightvision-vr-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.json"
];


/* =========================================
   INSTALAR NUEVA VERSIÓN
   ========================================= */

self.addEventListener("install", event => {

  event.waitUntil(

    caches
      .open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())

  );

});


/* =========================================
   ACTIVAR NUEVA VERSIÓN
   ========================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches
      .keys()
      .then(keys => {

        return Promise.all(

          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))

        );

      })
      .then(() => self.clients.claim())

  );

});


/* =========================================
   SOLICITUDES
   ========================================= */

self.addEventListener("fetch", event => {

  /*
  Solo manejar solicitudes GET
  */

  if (event.request.method !== "GET") {
    return;
  }


  event.respondWith(

    fetch(event.request)

      .then(response => {

        /*
        Guardar la versión nueva en caché
        */

        const copy =
          response.clone();

        caches
          .open(CACHE)
          .then(cache => {

            cache.put(
              event.request,
              copy
            );

          });


        return response;

      })

      .catch(() => {

        /*
        Si estamos offline,
        utilizar la versión almacenada
        */

        return caches.match(
          event.request
        );

      })

  );

});