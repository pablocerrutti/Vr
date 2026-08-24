/* =========================================================
   LONWOLF NIGHTVISION VR
   APP.JS — WEBGL / GPU
   ========================================================= */

const video = document.getElementById("camera");
const canvas = document.getElementById("view");

const $ = id => document.getElementById(id);


/* =========================================================
   ESTADO
   ========================================================= */

let stream = null;
let track = null;

let raf = 0;

let lastRender = 0;
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

  } catch (error) {

    console.warn(
      "Error cargando configuración:",
      error
    );

  }


  state.zoom =
    Math.max(
      0.8,
      Math.min(
        4,
        Number(state.zoom) || 0.8
      )
    );


  updateControls();

}


/* =========================================================
   ACTUALIZAR CONTROLES
   ========================================================= */

function updateControls() {

  if ($("brightness")) {

    $("brightness").value =
      state.brightness;

  }

  if ($("contrast")) {

    $("contrast").value =
      state.contrast;

  }

  if ($("gain")) {

    $("gain").value =
      state.gain;

  }

  if ($("zoom")) {

    $("zoom").value =
      state.zoom;

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
   GUARDAR
   ========================================================= */

function saveState() {

  try {

    localStorage.setItem(
      "nvvr_v3",
      JSON.stringify(state)
    );

  } catch (error) {

    console.warn(
      "Error guardando configuración:",
      error
    );

  }

}


loadState();


/* =========================================================
   WEBGL
   ========================================================= */

const gl =
  canvas.getContext(
    "webgl",
    {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    }
  );


if (!gl) {

  alert(
    "Este navegador no soporta WebGL. Se necesita WebGL para el modo de alto rendimiento."
  );

  throw new Error(
    "WebGL no disponible"
  );

}


/* =========================================================
   VERTEX SHADER
   ========================================================= */

const vertexShaderSource = `

attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {

  gl_Position =
    vec4(
      a_position,
      0.0,
      1.0
    );

  v_texCoord =
    a_texCoord;

}

`;


/* =========================================================
   FRAGMENT SHADER
   ========================================================= */

const fragmentShaderSource = `

precision mediump float;

uniform sampler2D u_texture;

uniform float u_brightness;
uniform float u_contrast;
uniform float u_gain;

uniform float u_zoom;

uniform float u_mode;

uniform float u_mirror;

uniform vec2 u_sourceAspect;
uniform vec2 u_outputAspect;

varying vec2 v_texCoord;


/* ---------------------------------------------
   LUMINANCIA
   --------------------------------------------- */

float luminance(
  vec3 color
) {

  return
    dot(
      color,
      vec3(
        0.2126,
        0.7152,
        0.0722
      )
    );

}


/* ---------------------------------------------
   MAIN
   --------------------------------------------- */

void main() {

  vec2 uv =
    v_texCoord;


  /* -------------------------------------------
     ESPEJO
     ------------------------------------------- */

  if (
    u_mirror > 0.5
  ) {

    uv.x =
      1.0 - uv.x;

  }


  /* -------------------------------------------
     CORRECCIÓN DE ASPECT RATIO
     ------------------------------------------- */

  float sourceRatio =
    u_sourceAspect.x /
    u_sourceAspect.y;

  float outputRatio =
    u_outputAspect.x /
    u_outputAspect.y;


  vec2 centered =
    uv - 0.5;


  if (
    sourceRatio > outputRatio
  ) {

    float scale =
      outputRatio /
      sourceRatio;

    centered.x *= scale;

  }

  else {

    float scale =
      sourceRatio /
      outputRatio;

    centered.y *= scale;

  }


  /*
     Zoom.

     1.0 = referencia
     >1.0 = ampliación

     Para 0.8 buscamos
     mostrar el máximo campo disponible.
  */

  float effectiveZoom =
    max(
      u_zoom,
      0.8
    );


  centered /=
    effectiveZoom;


  uv =
    centered + 0.5;


  /*
     Evitar muestreo fuera de imagen
  */

  uv =
    clamp(
      uv,
      0.0,
      1.0
    );


  /* -------------------------------------------
     OBTENER COLOR
     ------------------------------------------- */

  vec3 color =
    texture2D(
      u_texture,
      uv
    ).rgb;


  /* -------------------------------------------
     LUMINANCIA
     ------------------------------------------- */

  float y =
    luminance(
      color
    );


  /* -------------------------------------------
     CONTRASTE
     ------------------------------------------- */

  y =
    (
      (y - 0.5) *
      u_contrast
    ) + 0.5;


  /* -------------------------------------------
     BRILLO + GANANCIA
     ------------------------------------------- */

  y *=
    u_brightness *
    u_gain;


  y =
    clamp(
      y,
      0.0,
      1.0
    );


  /* -------------------------------------------
     MODO VERDE
     ------------------------------------------- */

  if (
    u_mode < 0.5
  ) {

    color =
      vec3(
        y * 0.41,
        y,
        y * 0.45
      );

  }


  /* -------------------------------------------
     B/N
     ------------------------------------------- */

  else if (
    u_mode < 1.5
  ) {

    color =
      vec3(y);

  }


  /* -------------------------------------------
     ROJO
     ------------------------------------------- */

  else if (
    u_mode < 2.5
  ) {

    color =
      vec3(
        y,
        y * 0.25,
        y * 0.12
      );

  }


  /* -------------------------------------------
     INVERSO
     ------------------------------------------- */

  else {

    float inverseY =
      1.0 - y;

    color =
      vec3(
        inverseY
      );

  }


  gl_FragColor =
    vec4(
      color,
      1.0
    );

}

`;


/* =========================================================
   COMPILAR SHADER
   ========================================================= */

function compileShader(
  type,
  source
) {

  const shader =
    gl.createShader(type);


  gl.shaderSource(
    shader,
    source
  );


  gl.compileShader(
    shader
  );


  if (
    !gl.getShaderParameter(
      shader,
      gl.COMPILE_STATUS
    )
  ) {

    const log =
      gl.getShaderInfoLog(
        shader
      );

    gl.deleteShader(
      shader
    );

    throw new Error(
      "Shader error: " +
      log
    );

  }


  return shader;

}


/* =========================================================
   CREAR PROGRAMA
   ========================================================= */

const vertexShader =
  compileShader(
    gl.VERTEX_SHADER,
    vertexShaderSource
  );


const fragmentShader =
  compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );


const program =
  gl.createProgram();


gl.attachShader(
  program,
  vertexShader
);


gl.attachShader(
  program,
  fragmentShader
);


gl.linkProgram(
  program
);


if (
  !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  )
) {

  throw new Error(
    gl.getProgramInfoLog(
      program
    )
  );

}


gl.useProgram(
  program
);


/* =========================================================
   POSICIONES
   ========================================================= */

const positionBuffer =
  gl.createBuffer();


gl.bindBuffer(
  gl.ARRAY_BUFFER,
  positionBuffer
);


gl.bufferData(

  gl.ARRAY_BUFFER,

  new Float32Array([

    -1, -1,
     1, -1,
    -1,  1,

    -1,  1,
     1, -1,
     1,  1

  ]),

  gl.STATIC_DRAW

);


const positionLocation =
  gl.getAttribLocation(
    program,
    "a_position"
  );


gl.enableVertexAttribArray(
  positionLocation
);


gl.vertexAttribPointer(

  positionLocation,

  2,

  gl.FLOAT,

  false,

  0,

  0

);


/* =========================================================
   TEXTURAS
   ========================================================= */

const texCoordBuffer =
  gl.createBuffer();


gl.bindBuffer(
  gl.ARRAY_BUFFER,
  texCoordBuffer
);


gl.bufferData(

  gl.ARRAY_BUFFER,

  new Float32Array([

    0, 1,
    1, 1,
    0, 0,

    0, 0,
    1, 1,
    1, 0

  ]),

  gl.STATIC_DRAW

);


const texCoordLocation =
  gl.getAttribLocation(
    program,
    "a_texCoord"
  );


gl.enableVertexAttribArray(
  texCoordLocation
);


gl.vertexAttribPointer(

  texCoordLocation,

  2,

  gl.FLOAT,

  false,

  0,

  0

);


/* =========================================================
   TEXTURA DE CÁMARA
   ========================================================= */

const cameraTexture =
  gl.createTexture();


gl.bindTexture(
  gl.TEXTURE_2D,
  cameraTexture
);


gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MIN_FILTER,
  gl.LINEAR
);


gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MAG_FILTER,
  gl.LINEAR
);


gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_WRAP_S,
  gl.CLAMP_TO_EDGE
);


gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_WRAP_T,
  gl.CLAMP_TO_EDGE
);


/* =========================================================
   UNIFORMS
   ========================================================= */

const uniforms = {

  texture:
    gl.getUniformLocation(
      program,
      "u_texture"
    ),

  brightness:
    gl.getUniformLocation(
      program,
      "u_brightness"
    ),

  contrast:
    gl.getUniformLocation(
      program,
      "u_contrast"
    ),

  gain:
    gl.getUniformLocation(
      program,
      "u_gain"
    ),

  zoom:
    gl.getUniformLocation(
      program,
      "u_zoom"
    ),

  mode:
    gl.getUniformLocation(
      program,
      "u_mode"
    ),

  mirror:
    gl.getUniformLocation(
      program,
      "u_mirror"
    ),

  sourceAspect:
    gl.getUniformLocation(
      program,
      "u_sourceAspect"
    ),

  outputAspect:
    gl.getUniformLocation(
      program,
      "u_outputAspect"
    )

};


/* =========================================================
   TEXTURA UNIT 0
   ========================================================= */

gl.activeTexture(
  gl.TEXTURE0
);


gl.bindTexture(
  gl.TEXTURE_2D,
  cameraTexture
);


gl.uniform1i(
  uniforms.texture,
  0
);


/* =========================================================
   RESIZE WEBGL
   ========================================================= */

function resize() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.floor(
      innerWidth * dpr
    );


  canvas.height =
    Math.floor(
      innerHeight * dpr
    );


  gl.viewport(
    0,
    0,
    canvas.width,
    canvas.height
  );

}


window.addEventListener(
  "resize",
  resize
);


resize();


/* =========================================================
   INICIAR CÁMARA
   ========================================================= */

async function startCamera() {

  try {

    if (
      !window.isSecureContext
    ) {

      throw new Error(
        "La cámara necesita HTTPS o localhost."
      );

    }


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

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
       Intentar solicitar 30 FPS
    */

    try {

      await track.applyConstraints({

        frameRate: {

          ideal: 30,
          max: 30

        }

      });

    }

    catch (error) {

      console.warn(
        "No se pudo fijar frameRate:",
        error
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


    /*
       Reiniciar contador
    */

    lastRender =
      performance.now();

    fpsTime =
      performance.now();

    frames = 0;


    cancelAnimationFrame(
      raf
    );


    render();

  }

  catch (error) {

    console.error(
      error
    );


    if ($("status")) {

      $("status").textContent =
        "ERROR";

    }


    alert(
      error.message ||
      "No se pudo acceder a la cámara."
    );

  }

}


/* =========================================================
   RENDER GPU
   ========================================================= */

function render(timestamp) {

  if (!timestamp) {

    timestamp =
      performance.now();

  }


  /*
     Limitar a 30 FPS.
  */

  if (
    timestamp -
    lastRender >=
    FRAME_INTERVAL
  ) {

    lastRender =
      timestamp;


    if (
      video.readyState >=
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

      drawWebGL();

      frames++;

    }

  }


  /*
     Mostrar FPS
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
   DIBUJAR CÁMARA EN GPU
   ========================================================= */

function drawWebGL() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {

    return;

  }


  /*
     Subir frame de cámara a textura.
  */

  gl.bindTexture(
    gl.TEXTURE_2D,
    cameraTexture
  );


  gl.pixelStorei(
    gl.UNPACK_FLIP_Y_WEBGL,
    true
  );


  gl.texImage2D(

    gl.TEXTURE_2D,

    0,

    gl.RGBA,

    gl.RGBA,

    gl.UNSIGNED_BYTE,

    video

  );


  /*
     Parámetros
  */

  gl.uniform1f(
    uniforms.brightness,
    Number(
      state.brightness
    )
  );


  gl.uniform1f(
    uniforms.contrast,
    Number(
      state.contrast
    )
  );


  gl.uniform1f(
    uniforms.gain,
    Number(
      state.gain
    )
  );


  gl.uniform1f(
    uniforms.zoom,
    Math.max(
      0.8,
      Math.min(
        4,
        Number(state.zoom)
      )
    )
  );


  gl.uniform1f(
    uniforms.mode,
    mode
  );


  gl.uniform1f(
    uniforms.mirror,
    mirror
      ? 1
      : 0
  );


  gl.uniform2f(

    uniforms.sourceAspect,

    video.videoWidth,
    video.videoHeight

  );


  gl.uniform2f(

    uniforms.outputAspect,

    canvas.width,
    canvas.height

  );


  /*
     Limpiar
  */

  gl.clearColor(
    0,
    0,
    0,
    1
  );


  gl.clear(
    gl.COLOR_BUFFER_BIT
  );


  /*
     Dibujar.
  */

  if (vr) {

    /*
       Para VR necesitamos dos pasadas.
       Por ahora dibujamos la misma imagen
       en ambos lados.

       La GPU sigue haciendo el procesamiento.
    */

    gl.enable(
      gl.SCISSOR_TEST
    );


    /*
       Ojo izquierdo
    */

    gl.scissor(

      0,
      0,
      canvas.width / 2,
      canvas.height

    );


    gl.viewport(

      0,
      0,
      canvas.width / 2,
      canvas.height

    );


    gl.drawArrays(

      gl.TRIANGLES,
      0,
      6

    );


    /*
       Ojo derecho
    */

    gl.scissor(

      canvas.width / 2,
      0,
      canvas.width / 2,
      canvas.height

    );


    gl.viewport(

      canvas.width / 2,
      0,
      canvas.width / 2,
      canvas.height

    );


    gl.drawArrays(

      gl.TRIANGLES,
      0,
      6

    );


    gl.disable(
      gl.SCISSOR_TEST
    );


    gl.viewport(

      0,
      0,
      canvas.width,
      canvas.height

    );

  }

  else {

    gl.viewport(

      0,
      0,
      canvas.width,
      canvas.height

    );


    gl.drawArrays(

      gl.TRIANGLES,
      0,
      6

    );

  }

}


/* =========================================================
   BOTÓN ACTIVAR CÁMARA
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

  const element =
    $(id);


  if (!element) {

    continue;

  }


  element.addEventListener(
    "input",
    () => {

      state[id] =
        Number(
          element.value
        );


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


        element.value =
          state.zoom;

      }


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

        else if (
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

        else if (
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

        else if (
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
           FULLSCREEN
        --------------------------------- */

        else if (
          action === "fullscreen"
        ) {

          try {

            if (
              document.fullscreenElement
            ) {

              await document
                .exitFullscreen?.();

            }

            else {

              await document
                .documentElement
                .requestFullscreen?.();

            }

          }

          catch (error) {

            console.warn(
              "Fullscreen:",
              error
            );

          }

        }


        /* ---------------------------------
           LINTERNA
        --------------------------------- */

        else if (
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

          catch (error) {

            console.warn(
              "Linterna:",
              error
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
   DOBLE CLICK → FULLSCREEN
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
   DETENER CÁMARA
   ========================================================= */

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