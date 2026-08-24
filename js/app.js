/* =========================================================
   LONWOLF NIGHTVISION VR
   APP.JS — OPTIMIZADO 30 FPS
   ========================================================= */

const video = document.getElementById("camera");
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d", {
  alpha: false
});

const $ = id => document.getElementById(id);


/* =========================================================
   ESTADO
   ========================================================= */

let stream = null;
let track = null;

let raf = 0;

let lastFrameTime = 0;
let fpsTime = performance.now();
let frames = 0;

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

let mode = 0;
let vr = false;
let cross = true;
let mirror = false;
let torch = false;


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const state = {

  brightness: 1.2,
  contrast: 1.35,
  gain: 1,
  zoom: 0.8

};


/* =========================================================
   CANVAS DE PROCESAMIENTO
   =========================================================

   IMPORTANTE:

   No procesamos toda la pantalla.

   Procesamos una imagen pequeña y luego
   la ampliamos.

   Esto reduce enormemente el trabajo
   de getImageData / putImageData.
   ========================================================= */

const workCanvas =
  document.createElement("canvas");

const workCtx =
  workCanvas.getContext("2d", {
    willReadFrequently: true
  });


/*
   Resolución máxima interna.

   640x360 es mucho más liviano que
   procesar 1920x1080 en cada frame.
*/

const WORK_WIDTH = 640;
const WORK_HEIGHT = 360;

workCanvas.width = WORK_WIDTH;
workCanvas.height = WORK_HEIGHT;


/* =========================================================
   CARGAR CONFIGURACIÓN
   ========================================================= */

function loadState() {

  try {

    const saved =
      localStorage.getItem("nvvr_v3");

    if (saved) {

      Object.assign(
        state,
        JSON.parse(saved)
      );

    }

  } catch (e) {

    console.warn(
      "No se pudo cargar la configuración",
      e
    );

  }


  /*
     Seguridad del zoom
  */

  if (
    !Number.isFinite(state.zoom) ||
    state.zoom < 0.8
  ) {

    state.zoom = 0.8;

  }


  if (state.zoom > 4) {

    state.zoom = 4;

  }


  updateControls();

}


/* =========================================================
   ACTUALIZAR CONTROLES
   ========================================================= */

function updateControls() {

  for (
    const key of Object.keys(state)
  ) {

    const element = $(key);

    if (element) {

      element.value =
        state[key];

    }

  }


  if ($("brightnessOut")) {

    $("brightnessOut").textContent =
      Number(state.brightness).toFixed(2);

  }


  if ($("contrastOut")) {

    $("contrastOut").textContent =
      Number(state.contrast).toFixed(2);

  }


  if ($("gainOut")) {

    $("gainOut").textContent =
      Number(state.gain).toFixed(2);

  }


  if ($("zoomOut")) {

    $("zoomOut").textContent =
      Number(state.zoom).toFixed(1) + "×";

  }

}


/* =========================================================
   GUARDAR CONFIGURACIÓN
   ========================================================= */

function saveState() {

  try {

    localStorage.setItem(
      "nvvr_v3",
      JSON.stringify(state)
    );

  } catch (e) {

    console.warn(
      "No se pudo guardar configuración",
      e
    );

  }

}


loadState();


/* =========================================================
   INICIAR CÁMARA
   ========================================================= */

async function startCamera() {

  try {

    if (!window.isSecureContext) {

      throw new Error(
        "La cámara requiere HTTPS o localhost."
      );

    }


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          /*
             Pedimos una resolución razonable.
          */

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          },

          frameRate: {
            ideal: 30,
            max: 30
          }

        },

        audio: false

      });


    video.srcObject =
      stream;


    await video.play();


    track =
      stream.getVideoTracks()[0];


    /*
       Intentar mantener 30 FPS
    */

    try {

      await track.applyConstraints({

        frameRate: {
          ideal: 30,
          max: 30
        }

      });

    } catch (e) {

      console.warn(
        "No se pudo fijar 30 FPS de cámara",
        e
      );

    }


    if ($("startPanel")) {

      $("startPanel")
        .classList
        .add("hidden");

    }


    if ($("status")) {

      $("status").textContent =
        "CÁMARA ACTIVA";

    }


    resize();


    cancelAnimationFrame(
      raf
    );


    lastFrameTime =
      performance.now();

    fpsTime =
      performance.now();

    frames = 0;


    render();

  }

  catch (e) {

    console.error(e);


    if ($("status")) {

      $("status").textContent =
        "ERROR";

    }


    alert(
      e.message ||
      "No se pudo acceder a la cámara."
    );

  }

}


/* =========================================================
   RESIZE
   ========================================================= */

function resize() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.max(
      640,
      Math.floor(
        innerWidth * dpr
      )
    );


  canvas.height =
    Math.max(
      360,
      Math.floor(
        innerHeight * dpr
      )
    );

}


window.addEventListener(
  "resize",
  resize
);


/* =========================================================
   CALCULAR ÁREA DE RECORTE
   ========================================================= */

function getSourceCrop() {

  const vw =
    video.videoWidth;

  const vh =
    video.videoHeight;


  const screenAspect =
    canvas.width /
    canvas.height;


  const sourceAspect =
    vw / vh;


  /*
     0.8 = campo más amplio
     1.0 = referencia
     >1 = zoom
  */

  const zoom =
    Math.max(
      0.8,
      Math.min(
        4,
        Number(state.zoom) || 0.8
      )
    );


  let sw;
  let sh;


  if (
    sourceAspect > screenAspect
  ) {

    sh =
      vh / zoom;

    sw =
      sh * screenAspect;

  } else {

    sw =
      vw / zoom;

    sh =
      sw / screenAspect;

  }


  /*
     Asegurar límites
  */

  sw =
    Math.min(
      vw,
      Math.max(
        1,
        sw
      )
    );


  sh =
    Math.min(
      vh,
      Math.max(
        1,
        sh
      )
    );


  const sx =
    (vw - sw) / 2;


  const sy =
    (vh - sh) / 2;


  return {
    sx,
    sy,
    sw,
    sh
  };

}


/* =========================================================
   PROCESAR IMAGEN
   ========================================================= */

function processImage() {

  if (!video.videoWidth) {

    return;

  }


  const crop =
    getSourceCrop();


  /*
     Dibujar cámara en canvas pequeño
  */

  workCtx.drawImage(

    video,

    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,

    0,
    0,
    WORK_WIDTH,
    WORK_HEIGHT

  );


  /*
     Obtener píxeles
  */

  const image =
    workCtx.getImageData(
      0,
      0,
      WORK_WIDTH,
      WORK_HEIGHT
    );


  const data =
    image.data;


  const brightness =
    Number(state.brightness);

  const contrast =
    Number(state.contrast);

  const gain =
    Number(state.gain);


  /*
     Procesamiento de color
  */

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {

    let y =

      (
        0.2126 * data[i] +
        0.7152 * data[i + 1] +
        0.0722 * data[i + 2]
      ) / 255;


    /*
       Contraste
    */

    y =
      (
        (y - 0.5) *
        contrast
      ) + 0.5;


    /*
       Brillo + ganancia
    */

    y *=
      brightness *
      gain;


    /*
       Limitar
    */

    y =
      Math.max(
        0,
        Math.min(
          1,
          y
        )
      );


    /*
       MODO VERDE
    */

    if (mode === 0) {

      data[i] =
        y * 105;

      data[i + 1] =
        y * 255;

      data[i + 2] =
        y * 115;

    }


    /*
       BLANCO Y NEGRO
    */

    else if (mode === 1) {

      const q =
        y * 255;

      data[i] =
        q;

      data[i + 1] =
        q;

      data[i + 2] =
        q;

    }


    /*
       ROJO
    */

    else if (mode === 2) {

      data[i] =
        y * 255;

      data[i + 1] =
        y * 65;

      data[i + 2] =
        y * 30;

    }


    /*
       INVERSO
    */

    else {

      const q =
        (1 - y) * 255;

      data[i] =
        q;

      data[i + 1] =
        q;

      data[i + 2] =
        q;

    }

  }


  /*
     Volver a poner los píxeles
  */

  workCtx.putImageData(
    image,
    0,
    0
  );


  /*
     Limpiar pantalla
  */

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
     Espejo
  */

  ctx.save();


  if (mirror) {

    ctx.translate(
      canvas.width,
      0
    );

    ctx.scale(
      -1,
      1
    );

  }


  /*
     VR
  */

  if (vr) {

    const half =
      canvas.width / 2;


    ctx.drawImage(

      workCanvas,

      0,
      0,
      WORK_WIDTH,
      WORK_HEIGHT,

      0,
      0,
      half,
      canvas.height

    );


    ctx.drawImage(

      workCanvas,

      0,
      0,
      WORK_WIDTH,
      WORK_HEIGHT,

      half,
      0,
      half,
      canvas.height

    );

  }

  else {

    ctx.drawImage(

      workCanvas,

      0,
      0,
      WORK_WIDTH,
      WORK_HEIGHT,

      0,
      0,
      canvas.width,
      canvas.height

    );

  }


  ctx.restore();

}


/* =========================================================
   RENDER A 30 FPS
   ========================================================= */

function render(timestamp) {

  if (!timestamp) {

    timestamp =
      performance.now();

  }


  /*
     Limitar a aproximadamente 30 FPS
  */

  if (
    timestamp -
    lastFrameTime >=
    FRAME_INTERVAL
  ) {

    lastFrameTime =
      timestamp;


    processImage();


    frames++;

  }


  /*
     Contador FPS
  */

  if (
    timestamp -
    fpsTime >=
    1000
  ) {

    if ($("fps")) {

      $("fps").textContent =
        frames + " FPS";

    }


    frames = 0;

    fpsTime =
      timestamp;

  }


  raf =
    requestAnimationFrame(
      render
    );

}


/* =========================================================
   BOTÓN ACTIVAR
   ========================================================= */

if ($("startBtn")) {

  $("startBtn").onclick =
    startCamera;

}


/* =========================================================
   MENÚ
   ========================================================= */

if ($("menuBtn")) {

  $("menuBtn").onclick = () => {

    $("controls")
      ?.classList
      .remove("hidden");

  };

}


/* =========================================================
   CERRAR MENÚ
   ========================================================= */

if ($("closeBtn")) {

  $("closeBtn").onclick = () => {

    $("controls")
      ?.classList
      .add("hidden");

  };

}


/* =========================================================
   SLIDERS
   ========================================================= */

for (
  const id of [
    "brightness",
    "contrast",
    "gain",
    "zoom"
  ]
) {

  const control =
    $(id);


  if (!control) {

    continue;

  }


  control.addEventListener(
    "input",
    () => {

      state[id] =
        Number(
          control.value
        );


      /*
         Protección zoom
      */

      if (
        id === "zoom"
      ) {

        state.zoom =
          Math.max(
            0.8,
            Math.min(
              4,
              state.zoom
            )
          );

      }


      /*
         Mostrar valor
      */

      const output =
        $(`${id}Out`);


      if (output) {

        output.textContent =

          id === "zoom"

            ? state.zoom.toFixed(1) + "×"

            : state[id].toFixed(2);

      }


      saveState();

    }
  );

}


/* =========================================================
   BOTONES DE ACCIÓN
   ========================================================= */

document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      async () => {

        const action =
          button.dataset.action;


        /* ---------------------------------
           MODO
        --------------------------------- */

        if (
          action === "mode"
        ) {

          mode =
            (mode + 1) % 4;


          button.textContent =
            [
              "MODO: VERDE",
              "MODO: B/N",
              "MODO: ROJO",
              "MODO: INVERSO"
            ][mode];

        }


        /* ---------------------------------
           VR
        --------------------------------- */

        if (
          action === "vr"
        ) {

          vr =
            !vr;


          button.textContent =
            "VR: " +
            (
              vr
                ? "ON"
                : "OFF"
            );


          if ($("vrLabel")) {

            $("vrLabel").textContent =
              "VR " +
              (
                vr
                  ? "ON"
                  : "OFF"
              );

          }

        }


        /* ---------------------------------
           RETÍCULA
        --------------------------------- */

        if (
          action === "crosshair"
        ) {

          cross =
            !cross;


          if ($("crosshair")) {

            $("crosshair").style.display =
              cross
                ? ""
                : "none";

          }


          button.textContent =
            "RETÍCULA: " +
            (
              cross
                ? "ON"
                : "OFF"
            );

        }


        /* ---------------------------------
           ESPEJO
        --------------------------------- */

        if (
          action === "mirror"
        ) {

          mirror =
            !mirror;


          button.textContent =
            "ESPEJO: " +
            (
              mirror
                ? "ON"
                : "OFF"
            );

        }


        /* ---------------------------------
           PANTALLA COMPLETA
        --------------------------------- */

        if (
          action === "fullscreen"
        ) {

          try {

            if (
              document.fullscreenElement
            ) {

              await document.exitFullscreen?.();

            }

            else {

              await document
                .documentElement
                .requestFullscreen?.();

            }

          }

          catch (e) {

            console.warn(
              "Fullscreen no disponible",
              e
            );

          }

        }


        /* ---------------------------------
           LINTERNA
        --------------------------------- */

        if (
          action === "torch"
        ) {

          if (!track) {

            alert(
              "Primero activa la cámara."
            );

            return;

          }


          try {

            const capabilities =
              track.getCapabilities?.();


            if (
              capabilities?.torch
            ) {

              torch =
                !torch;


              await track.applyConstraints({

                advanced: [
                  {
                    torch
                  }
                ]

              });


              button.textContent =
                "LINTERNA: " +
                (
                  torch
                    ? "ON"
                    : "OFF"
                );

            }

            else {

              alert(
                "La cámara de este teléfono/navegador no expone control de linterna."
              );

            }

          }

          catch (e) {

            console.warn(
              "No se pudo activar la linterna",
              e
            );

          }

        }

      }
    );

  });


/* =========================================================
   RESTABLECER
   ========================================================= */

if ($("resetBtn")) {

  $("resetBtn").onclick = () => {

    Object.assign(
      state,
      {
        brightness: 1.2,
        contrast: 1.35,
        gain: 1,
        zoom: 0.8
      }
    );


    saveState();

    updateControls();

  };

}


/* =========================================================
   DOBLE TOQUE → FULLSCREEN
   ========================================================= */

document.addEventListener(
  "dblclick",
  () => {

    document
      .documentElement
      .requestFullscreen?.();

  }
);


/* =========================================================
   CERRAR CÁMARA AL SALIR
   ========================================================= */

window.addEventListener(
  "pagehide",
  () => {

    if (stream) {

      stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

    }

  }
);


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
  "serviceWorker" in navigator
) {

  navigator.serviceWorker
    .register(
      "./sw.js"
    )
    .catch(
      error =>
        console.warn(
          "Service Worker:",
          error
        )
    );

}