/* =========================================================
   LONWOLF NIGHTVISION VR
   APP.JS V6
   WebGL optimizado para iPhone / Safari
   ========================================================= */


/* =========================================================
   ELEMENTOS
   ========================================================= */

const video = document.getElementById("camera");
const canvas = document.getElementById("view");

const $ = id => document.getElementById(id);


/* =========================================================
   ESTADO GENERAL
   ========================================================= */

let stream = null;
let track = null;

let animationFrame = 0;

let lastFrame = 0;
let fpsCounter = 0;
let fpsTime = performance.now();

const TARGET_FPS = 30;
const FRAME_TIME = 1000 / TARGET_FPS;

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
      localStorage.getItem("nvvr_v6");

    if (saved) {

      Object.assign(
        state,
        JSON.parse(saved)
      );

    }

  } catch (error) {

    console.warn(
      "No se pudo cargar la configuración:",
      error
    );

  }


  /*
     Seguridad:
     el zoom nunca puede bajar de 0.8
  */

  state.zoom = Math.max(
    0.8,
    Math.min(
      4,
      Number(state.zoom) || 0.8
    )
  );


  updateControls();

}


/* =========================================================
   GUARDAR CONFIGURACIÓN
   ========================================================= */

function saveState() {

  try {

    localStorage.setItem(
      "nvvr_v6",
      JSON.stringify(state)
    );

  } catch (error) {

    console.warn(
      "No se pudo guardar la configuración:",
      error
    );

  }

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
    "WebGL no está disponible en este navegador."
  );

  throw new Error(
    "WebGL unavailable"
  );

}


/* =========================================================
   SHADER VERTEX
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
   SHADER FRAGMENT
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
uniform float u_vrEye;

uniform vec2 u_sourceAspect;
uniform vec2 u_outputAspect;

varying vec2 v_texCoord;


void main() {

  vec2 uv = v_texCoord;


  /* =========================================
     ESPEJO
     ========================================= */

  if (u_mirror > 0.5) {

    uv.x =
      1.0 - uv.x;

  }


  /* =========================================
     VR
     ========================================= */

  if (u_vrEye > 0.5) {

    float eyeOffset;

    if (u_vrEye < 1.5) {

      eyeOffset = -0.012;

    } else {

      eyeOffset = 0.012;

    }

    uv.x += eyeOffset;

  }


  /* =========================================
     ASPECT RATIO
     ========================================= */

  float sourceRatio =
    u_sourceAspect.x /
    u_sourceAspect.y;

  float outputRatio =
    u_outputAspect.x /
    u_outputAspect.y;


  vec2 centered =
    uv - 0.5;


  if (sourceRatio > outputRatio) {

    centered.x *=
      outputRatio /
      sourceRatio;

  } else {

    centered.y *=
      sourceRatio /
      outputRatio;

  }


  /* =========================================
     ZOOM

     0.8 = campo más amplio
     1.0 = normal
     ========================================= */

  centered /=
    max(
      0.8,
      u_zoom
    );


  uv =
    centered + 0.5;


  uv =
    clamp(
      uv,
      0.0,
      1.0
    );


  /* =========================================
     IMAGEN DE CÁMARA
     ========================================= */

  vec3 color =
    texture2D(
      u_texture,
      uv
    ).rgb;


  /* =========================================
     LUMINANCIA
     ========================================= */

  float y =
    dot(
      color,
      vec3(
        0.2126,
        0.7152,
        0.0722
      )
    );


  /* =========================================
     CONTRASTE
     ========================================= */

  y =
    (
      (y - 0.5) *
      u_contrast
    ) + 0.5;


  /* =========================================
     BRILLO + GANANCIA
     ========================================= */

  y *=
    u_brightness *
    u_gain;


  y =
    clamp(
      y,
      0.0,
      1.0
    );


  /* =========================================
     MODO VERDE
     ========================================= */

  if (u_mode < 0.5) {

    color =
      vec3(
        y * 0.35,
        y,
        y * 0.40
      );

  }


  /* =========================================
     B/N
     ========================================= */

  else if (u_mode < 1.5) {

    color =
      vec3(y);

  }


  /* =========================================
     ROJO
     ========================================= */

  else if (u_mode < 2.5) {

    color =
      vec3(
        y,
        y * 0.22,
        y * 0.08
      );

  }


  /* =========================================
     INVERSO
     ========================================= */

  else {

    float inv =
      1.0 - y;

    color =
      vec3(inv);

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

function compileShader(type, source) {

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

    console.error(
      gl.getShaderInfoLog(shader)
    );

    throw new Error(
      "Error compilando shader WebGL"
    );

  }


  return shader;

}


/* =========================================================
   CREAR SHADERS
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


/* =========================================================
   CREAR PROGRAMA
   ========================================================= */

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
    gl.getProgramInfoLog(program)
  );

}


gl.useProgram(program);


/* =========================================================
   GEOMETRÍA
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
   COORDENADAS DE TEXTURA
   =========================================================

   IMPORTANTE:

   NO usamos UNPACK_FLIP_Y_WEBGL.

   Estas coordenadas están configuradas
   para mantener la imagen derecha.
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

    0, 0,
    1, 0,
    0, 1,

    0, 1,
    1, 0,
    1, 1

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

const u = {

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

  vrEye:
    gl.getUniformLocation(
      program,
      "u_vrEye"
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


gl.uniform1i(
  u.texture,
  0
);


/* =========================================================
   RESIZE
   ========================================================= */

function resize() {

  const maxWidth = 960;


  const width =
    Math.min(
      window.innerWidth,
      maxWidth
    );


  const height =
    width *
    (
      window.innerHeight /
      window.innerWidth
    );


  canvas.width =
    Math.max(
      640,
      Math.floor(width)
    );


  canvas.height =
    Math.max(
      360,
      Math.floor(height)
    );


  canvas.style.width =
    "100%";


  canvas.style.height =
    "100%";


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
   ACTIVAR CÁMARA
   ========================================================= */

async function startCamera() {

  try {

    if (
      !window.isSecureContext
    ) {

      throw new Error(
        "La cámara necesita HTTPS."
      );

    }


    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "Este navegador no permite acceder a la cámara."
      );

    }


    /*
       Cámara trasera.
       640x360 para reducir carga
       en iPhone.
    */

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 640,
            max: 640
          },

          height: {
            ideal: 360,
            max: 360
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
       Intentamos establecer 30 FPS.
    */

    try {

      await track.applyConstraints({

        width: {
          ideal: 640,
          max: 640
        },

        height: {
          ideal: 360,
          max: 360
        },

        frameRate: {
          ideal: 30,
          max: 30
        }

      });

    } catch (error) {

      console.warn(
        "El navegador no permitió ajustar los parámetros:",
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


    fpsCounter = 0;

    fpsTime =
      performance.now();

    lastFrame =
      performance.now();


    cancelAnimationFrame(
      animationFrame
    );


    animationFrame =
      requestAnimationFrame(
        render
      );


  } catch (error) {

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
   DIBUJAR FRAME
   ========================================================= */

function drawFrame() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {

    return;

  }


  /* -----------------------------------------
     TEXTURA
     ----------------------------------------- */

  gl.activeTexture(
    gl.TEXTURE0
  );


  gl.bindTexture(
    gl.TEXTURE_2D,
    cameraTexture
  );


  /*
     IMPORTANTE:

     NO usamos:

     gl.pixelStorei(
       gl.UNPACK_FLIP_Y_WEBGL,
       true
     );

     Eso provocaba que la imagen
     apareciera de cabeza en el iPhone.
  */


  gl.texImage2D(

    gl.TEXTURE_2D,

    0,

    gl.RGBA,

    gl.RGBA,

    gl.UNSIGNED_BYTE,

    video

  );


  /* -----------------------------------------
     CONTROLES DE IMAGEN
     ----------------------------------------- */

  gl.uniform1f(
    u.brightness,
    state.brightness
  );


  gl.uniform1f(
    u.contrast,
    state.contrast
  );


  gl.uniform1f(
    u.gain,
    state.gain
  );


  gl.uniform1f(
    u.zoom,
    Math.max(
      0.8,
      Math.min(
        4,
        state.zoom
      )
    )
  );


  gl.uniform1f(
    u.mode,
    mode
  );


  gl.uniform1f(
    u.mirror,
    mirror ? 1 : 0
  );


  gl.uniform2f(

    u.sourceAspect,

    video.videoWidth,
    video.videoHeight

  );


  /* -----------------------------------------
     LIMPIAR
     ----------------------------------------- */

  gl.disable(
    gl.SCISSOR_TEST
  );


  gl.clearColor(
    0,
    0,
    0,
    1
  );


  gl.clear(
    gl.COLOR_BUFFER_BIT
  );


  /* =========================================
     MODO VR
     ========================================= */

  if (vr) {

    const half =
      canvas.width / 2;


    gl.enable(
      gl.SCISSOR_TEST
    );


    /* ---------------------------------------
       OJO IZQUIERDO
       --------------------------------------- */

    gl.viewport(

      0,
      0,
      half,
      canvas.height

    );


    gl.scissor(

      0,
      0,
      half,
      canvas.height

    );


    gl.uniform1f(
      u.vrEye,
      1
    );


    gl.uniform2f(

      u.outputAspect,

      half,
      canvas.height

    );


    gl.drawArrays(

      gl.TRIANGLES,

      0,
      6

    );


    /* ---------------------------------------
       OJO DERECHO
       --------------------------------------- */

    gl.viewport(

      half,
      0,
      half,
      canvas.height

    );


    gl.scissor(

      half,
      0,
      half,
      canvas.height

    );


    gl.uniform1f(
      u.vrEye,
      2
    );


    gl.drawArrays(

      gl.TRIANGLES,

      0,
      6

    );


    gl.disable(
      gl.SCISSOR_TEST
    );


  } else {


    /* =======================================
       MODO NORMAL
       ======================================= */

    gl.viewport(

      0,
      0,
      canvas.width,
      canvas.height

    );


    gl.uniform1f(
      u.vrEye,
      0
    );


    gl.uniform2f(

      u.outputAspect,

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
   LOOP DE RENDER
   ========================================================= */

function render(timestamp) {

  if (
    timestamp === undefined
  ) {

    timestamp =
      performance.now();

  }


  /*
     Intentamos mantener 30 FPS.
  */

  if (
    timestamp -
    lastFrame >=
    FRAME_TIME
  ) {

    lastFrame =
      timestamp;


    drawFrame();


    fpsCounter++;

  }


  /*
     Actualizar contador.
  */

  if (
    timestamp -
    fpsTime >=
    1000
  ) {

    if ($("fps")) {

      $("fps").textContent =
        fpsCounter +
        " FPS";

    }


    fpsCounter = 0;

    fpsTime =
      timestamp;

  }


  animationFrame =
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

    if ($("controls")) {

      $("controls")
        .classList
        .remove("hidden");

    }

  };

}


/* =========================================================
   CERRAR MENÚ
   ========================================================= */

if ($("closeBtn")) {

  $("closeBtn").onclick = () => {

    if ($("controls")) {

      $("controls")
        .classList
        .add("hidden");

    }

  };

}


/* =========================================================
   SLIDERS
   ========================================================= */

[
  "brightness",
  "contrast",
  "gain",
  "zoom"

].forEach(id => {

  const element =
    $(id);


  if (!element) {

    return;

  }


  element.addEventListener(
    "input",
    () => {

      state[id] =
        Number(
          element.value
        );


      /* ---------------------------------------
         ZOOM MÍNIMO 0.8
         --------------------------------------- */

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

    }
  );

});


/* =========================================================
   BOTONES DE ACCIONES
   ========================================================= */

document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(button => {

    button.onclick =
      async () => {

        const action =
          button.dataset.action;


        /* =====================================
           CAMBIAR MODO
           ===================================== */

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


          if ($("modeLabel")) {

            $("modeLabel").textContent =
              [

                "NIGHT VISION",

                "BLACK & WHITE",

                "RED VISION",

                "INVERSE"

              ][mode];

          }

        }


        /* =====================================
           VR
           ===================================== */

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


        /* =====================================
           RETÍCULA
           ===================================== */

        else if (
          action === "crosshair"
        ) {

          cross =
            !cross;


          if ($("crosshair")) {

            $("crosshair")
              .style
              .display =
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


        /* =====================================
           ESPEJO
           ===================================== */

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


        /* =====================================
           PANTALLA COMPLETA
           ===================================== */

        else if (
          action === "fullscreen"
        ) {

          try {

            if (
              document.fullscreenElement
            ) {

              await document.exitFullscreen();

            } else {

              await document
                .documentElement
                .requestFullscreen();

            }

          } catch (error) {

            console.warn(
              "Fullscreen:",
              error
            );

          }

        }


        /* =====================================
           LINTERNA
           ===================================== */

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
              capabilities &&
              capabilities.torch
            ) {

              torch =
                !torch;


              await track.applyConstraints({

                advanced: [

                  {
                    torch:
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

            } else {

              alert(
                "La cámara de este teléfono/navegador no permite controlar la linterna."
              );

            }

          } catch (error) {

            console.warn(
              "Error controlando linterna:",
              error
            );

          }

        }

      };

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
   DOBLE TOQUE = FULLSCREEN
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
   DETENER CÁMARA AL SALIR
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
      error => {

        console.warn(
          "Service Worker:",
          error
        );

      }
    );

}