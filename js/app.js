const video = document.getElementById("camera");
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d", { alpha: false });

const $ = id => document.getElementById(id);

let stream = null;
let track = null;
let raf = 0;
let last = performance.now();
let frames = 0;

let mode = 0;
let vr = false;
let cross = true;
let mirror = false;
let torch = false;


/* =========================================
   CONFIGURACIÓN
   ========================================= */
const state = {
  brightness: 1.2,
  contrast: 1.35,
  gain: 1,
  zoom: 0.8
};

console.log("NIGHTVISION APP NUEVA - ZOOM 0.8");
alert("APP NUEVA - ZOOM 0.8");


/* =========================================
   CARGAR CONFIGURACIÓN
   ========================================= */

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
      "No se pudo cargar la configuración:",
      e
    );

  }


  /*
  El zoom nunca puede ser inferior a 0.8
  */

  if (
    !Number.isFinite(state.zoom) ||
    state.zoom < 0.8
  ) {

    state.zoom = 0.8;

  }


  /*
  Actualizar controles
  */

  for (
    const k of Object.keys(state)
  ) {

    const control = $(k);

    if (control) {

      control.value = state[k];

    }

  }


  /*
  Actualizar indicadores
  */

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


/* =========================================
   GUARDAR CONFIGURACIÓN
   ========================================= */

function saveState() {

  try {

    localStorage.setItem(
      "nvvr_v3",
      JSON.stringify(state)
    );

  } catch (e) {

    console.warn(
      "No se pudo guardar la configuración:",
      e
    );

  }

}


/* =========================================
   INICIALIZAR
   ========================================= */

loadState();


/* =========================================
   INICIAR CÁMARA
   ========================================= */

async function startCamera() {

  try {

    if (!window.isSecureContext) {

      throw new Error(
        "La cámara del navegador necesita HTTPS o localhost."
      );

    }


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1920
          },

          height: {
            ideal: 1080
          }

        },

        audio: false

      });


    video.srcObject = stream;

    await video.play();


    track =
      stream.getVideoTracks()[0];


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

    cancelAnimationFrame(raf);

    last =
      performance.now();

    frames = 0;

    render();


  } catch (e) {

    console.error(e);

    if ($("status")) {

      $("status").textContent =
        "ERROR";

    }

    alert(
      e.message ||
      "No se pudo acceder a la cámara. Revisa los permisos del navegador."
    );

  }

}


/* =========================================
   REDIMENSIONAR CANVAS
   ========================================= */

function resize() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.max(
      640,
      Math.floor(innerWidth * dpr)
    );


  canvas.height =
    Math.max(
      360,
      Math.floor(innerHeight * dpr)
    );

}


addEventListener(
  "resize",
  resize
);


/* =========================================
   PROCESAR FRAME
   ========================================= */

function processFrame() {

  if (!video.videoWidth) {

    return;

  }


  const w =
    canvas.width;

  const h =
    canvas.height;

  const vw =
    video.videoWidth;

  const vh =
    video.videoHeight;


  const aspect =
    w / h;

  const srcAspect =
    vw / vh;


  /*
  0.8 = mayor campo de visión
  1.0 = referencia
  >1.0 = ampliación
  */

  const zoom =
    Math.max(
      0.8,
      Number(state.zoom) || 0.8
    );


  let sw;
  let sh;
  let sx;
  let sy;


  if (
    srcAspect > aspect
  ) {

    sh =
      vh / zoom;

    sw =
      sh * aspect;

  } else {

    sw =
      vw / zoom;

    sh =
      sw / aspect;

  }


  /*
  Evitar salir de los límites de la imagen
  */

  sw =
    Math.min(
      sw,
      vw
    );

  sh =
    Math.min(
      sh,
      vh
    );


  /*
  Centrar imagen
  */

  sx =
    (vw - sw) / 2;

  sy =
    (vh - sh) / 2;


  /*
  Limitar coordenadas
  */

  sx =
    Math.max(
      0,
      Math.min(
        sx,
        vw - sw
      )
    );

  sy =
    Math.max(
      0,
      Math.min(
        sy,
        vh - sh
      )
    );


  ctx.save();


  /* =======================================
     ESPEJO
     ======================================= */

  if (mirror) {

    ctx.translate(
      w,
      0
    );

    ctx.scale(
      -1,
      1
    );

  }


  /* =======================================
     VR
     ======================================= */

  if (vr) {

    drawEye(
      sx,
      sy,
      sw,
      sh,
      0,
      w / 2,
      h
    );


    drawEye(
      sx,
      sy,
      sw,
      sh,
      w / 2,
      w / 2,
      h
    );

  } else {

    drawEye(
      sx,
      sy,
      sw,
      sh,
      0,
      w,
      h
    );

  }


  ctx.restore();

}


/* =========================================
   PROCESAR IMAGEN
   ========================================= */

function drawEye(
  sx,
  sy,
  sw,
  sh,
  dx,
  dw,
  dh
) {

  const temp =
    document.createElement(
      "canvas"
    );


  temp.width =
    Math.max(
      1,
      Math.floor(dw)
    );


  temp.height =
    Math.max(
      1,
      Math.floor(dh)
    );


  const t =
    temp.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  t.drawImage(
    video,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    temp.width,
    temp.height
  );


  const img =
    t.getImageData(
      0,
      0,
      temp.width,
      temp.height
    );


  const d =
    img.data;


  const brightness =
    Number(state.brightness);

  const gain =
    Number(state.gain);

  const contrast =
    Number(state.contrast);


  for (
    let i = 0;
    i < d.length;
    i += 4
  ) {

    /*
    Luminancia
    */

    let y =
      (
        0.2126 * d[i] +
        0.7152 * d[i + 1] +
        0.0722 * d[i + 2]
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
    Brillo y ganancia
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


    /* =====================================
       VERDE
       ===================================== */

    if (mode === 0) {

      d[i] =
        y * 105;

      d[i + 1] =
        y * 255;

      d[i + 2] =
        y * 115;

    }


    /* =====================================
       BLANCO Y NEGRO
       ===================================== */

    else if (mode === 1) {

      const q =
        y * 255;

      d[i] =
        q;

      d[i + 1] =
        q;

      d[i + 2] =
        q;

    }


    /* =====================================
       ROJO
       ===================================== */

    else if (mode === 2) {

      d[i] =
        y * 255;

      d[i + 1] =
        y * 65;

      d[i + 2] =
        y * 30;

    }


    /* =====================================
       INVERSO
       ===================================== */

    else {

      const q =
        (1 - y) * 255;

      d[i] =
        q;

      d[i + 1] =
        q;

      d[i + 2] =
        q;

    }

  }


  t.putImageData(
    img,
    0,
    0
  );


  ctx.drawImage(
    temp,
    dx,
    0,
    dw,
    dh
  );

}


/* =========================================
   RENDER
   ========================================= */

function render() {

  processFrame();

  frames++;


  const now =
    performance.now();


  if (
    now - last > 1000
  ) {

    if ($("fps")) {

      $("fps").textContent =
        frames + " FPS";

    }


    frames = 0;

    last = now;

  }


  raf =
    requestAnimationFrame(
      render
    );

}


/* =========================================
   BOTÓN CÁMARA
   ========================================= */

if ($("startBtn")) {

  $("startBtn").onclick =
    startCamera;

}


/* =========================================
   MENÚ
   ========================================= */

if ($("menuBtn")) {

  $("menuBtn").onclick = () => {

    if ($("controls")) {

      $("controls")
        .classList
        .remove("hidden");

    }

  };

}


/* =========================================
   CERRAR MENÚ
   ========================================= */

if ($("closeBtn")) {

  $("closeBtn").onclick = () => {

    if ($("controls")) {

      $("controls")
        .classList
        .add("hidden");

    }

  };

}


/* =========================================
   CONTROLES
   ========================================= */

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


  control.oninput = () => {

    state[id] =
      Number(
        control.value
      );


    /*
    Zoom mínimo 0.8
    */

    if (
      id === "zoom" &&
      state.zoom < 0.8
    ) {

      state.zoom =
        0.8;

      control.value =
        0.8;

    }


    const output =
      $(`${id}Out`);


    if (output) {

      if (
        id === "zoom"
      ) {

        output.textContent =
          state.zoom.toFixed(1) +
          "×";

      } else {

        output.textContent =
          state[id].toFixed(2);

      }

    }


    saveState();

  };

}


/* =========================================
   ACCIONES
   ========================================= */

document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(btn => {

    btn.onclick =
      async () => {

        const a =
          btn.dataset.action;


        /* MODO */

        if (
          a === "mode"
        ) {

          mode =
            (mode + 1) % 4;


          btn.textContent =
            [
              "MODO: VERDE",
              "MODO: B/N",
              "MODO: ROJO",
              "MODO: INVERSO"
            ][mode];

        }


        /* VR */

        if (
          a === "vr"
        ) {

          vr =
            !vr;


          btn.textContent =
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


        /* RETÍCULA */

        if (
          a === "crosshair"
        ) {

          cross =
            !cross;


          if ($("crosshair")) {

            $("crosshair").style.display =
              cross
                ? ""
                : "none";

          }


          btn.textContent =
            "RETÍCULA: " +
            (
              cross
                ? "ON"
                : "OFF"
            );

        }


        /* ESPEJO */

        if (
          a === "mirror"
        ) {

          mirror =
            !mirror;


          btn.textContent =
            "ESPEJO: " +
            (
              mirror
                ? "ON"
                : "OFF"
            );

        }


        /* PANTALLA COMPLETA */

        if (
          a === "fullscreen"
        ) {

          try {

            if (
              document.fullscreenElement
            ) {

              await document.exitFullscreen?.();

            } else {

              await document
                .documentElement
                .requestFullscreen?.();

            }

          } catch (e) {

            console.warn(
              "Fullscreen no disponible:",
              e
            );

          }

        }


        /* LINTERNA */

        if (
          a === "torch" &&
          track
        ) {

          try {

            const caps =
              track.getCapabilities?.();


            if (
              caps?.torch
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


              btn.textContent =
                "LINTERNA: " +
                (
                  torch
                    ? "ON"
                    : "OFF"
                );

            } else {

              alert(
                "La cámara de este teléfono/navegador no expone control de linterna."
              );

            }

          } catch (e) {

            console.warn(
              "No se pudo controlar la linterna:",
              e
            );

          }

        }

      };

  });


/* =========================================
   RESTABLECER
   ========================================= */

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


    for (
      const k of Object.keys(state)
    ) {

      if ($(k)) {

        $(k).value =
          state[k];

      }

    }


    if ($("brightnessOut")) {

      $("brightnessOut").textContent =
        "1.20";

    }


    if ($("contrastOut")) {

      $("contrastOut").textContent =
        "1.35";

    }


    if ($("gainOut")) {

      $("gainOut").textContent =
        "1.00";

    }


    if ($("zoomOut")) {

      $("zoomOut").textContent =
        "0.8×";

    }

  };

}


/* =========================================
   DOBLE TOQUE → PANTALLA COMPLETA
   ========================================= */

document.addEventListener(
  "dblclick",
  () => {

    document
      .documentElement
      .requestFullscreen?.();

  }
);


/* =========================================
   DETENER CÁMARA
   ========================================= */

window.addEventListener(
  "pagehide",
  () => {

    if (stream) {

      stream
        .getTracks()
        .forEach(
          t => t.stop()
        );

    }

  }
);


/* =========================================
   SERVICE WORKER
   ========================================= */

if (
  "serviceWorker" in navigator
) {

  navigator.serviceWorker
    .register("./sw.js")
    .catch(
      e =>
        console.warn(
          "Service Worker:",
          e
        )
    );

}
