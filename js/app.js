/* =========================================================
   LONWOLF NIGHTVISION VR
   APP.JS V8
   ========================================================= */

const video =
  document.getElementById("camera");

const canvas =
  document.getElementById("view");

const $ =
  id => document.getElementById(id);


/* =========================================================
   ESTADO
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

let motionActive = false;

let pitch = 0;
let calibratedPitch = 0;


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const state = {

  brightness: 1.2,
  contrast: 1.35,
  gain: 1,
  zoom: 0.8,
  height: 1.65

};


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadState() {

  try {

    const saved =
      localStorage.getItem(
        "lonwolf_nv_v8"
      );

    if (saved) {

      Object.assign(
        state,
        JSON.parse(saved)
      );

    }

  } catch (e) {

    console.warn(e);

  }


  state.zoom =
    Math.max(
      0.8,
      Math.min(
        4,
        Number(state.zoom) || 0.8
      )
    );


  state.height =
    Math.max(
      0.5,
      Math.min(
        2.5,
        Number(state.height) || 1.65
      )
    );


  updateControls();

}


function saveState() {

  try {

    localStorage.setItem(
      "lonwolf_nv_v8",
      JSON.stringify(state)
    );

  } catch (e) {}

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

      powerPreference:
        "high-performance"

    }
  );


if (!gl) {

  alert(
    "WebGL no está disponible."
  );

  throw new Error(
    "WebGL unavailable"
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


void main() {

  vec2 uv =
    v_texCoord;


  /*
     CORRECCIÓN DE ORIENTACIÓN

     La textura proveniente de Safari/WebGL
     se invierte verticalmente aquí.

     Esto evita utilizar UNPACK_FLIP_Y_WEBGL.
  */

  uv.y =
    1.0 - uv.y;


  /*
     ESPEJO
  */

  if (
    u_mirror > 0.5
  ) {

    uv.x =
      1.0 - uv.x;

  }


  /*
     ASPECT RATIO
  */

  float sourceRatio =
    u_sourceAspect.x /
    u_sourceAspect.y;

  float outputRatio =
    u_outputAspect.x /
    u_outputAspect.y;


  vec2 centered =
    uv - 0.5;


  if (
    sourceRatio >
    outputRatio
  ) {

    centered.x *=
      outputRatio /
      sourceRatio;

  } else {

    centered.y *=
      sourceRatio /
      outputRatio;

  }


  /*
     ZOOM

     0.8 = campo ligeramente
     más amplio que 1.0
  */

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


  /*
     FRAME
  */

  vec3 color =
    texture2D(
      u_texture,
      uv
    ).rgb;


  /*
     LUMINANCIA
  */

  float y =
    dot(
      color,
      vec3(
        0.2126,
        0.7152,
        0.0722
      )
    );


  /*
     CONTRASTE
  */

  y =
    (
      (y - 0.5) *
      u_contrast
    ) + 0.5;


  /*
     BRILLO
  */

  y *=
    u_brightness *
    u_gain;


  y =
    clamp(
      y,
      0.0,
      1.0
    );


  /*
     MODO VERDE
  */

  if (
    u_mode < 0.5
  ) {

    color =
      vec3(
        y * 0.35,
        y,
        y * 0.40
      );

  }


  /*
     B/N
  */

  else if (
    u_mode < 1.5
  ) {

    color =
      vec3(y);

  }


  /*
     ROJO
  */

  else if (
    u_mode < 2.5
  ) {

    color =
      vec3(
        y,
        y * 0.22,
        y * 0.08
      );

  }


  /*
     TÉRMICO SIMULADO

     negro
       ↓
     azul
       ↓
     violeta
       ↓
     rojo
       ↓
     naranja
       ↓
     amarillo
       ↓
     blanco
  */

  else if (
    u_mode < 3.5
  ) {

    float r;
    float g;
    float b;


    if (y < 0.20) {

      float t =
        y / 0.20;

      r = 0.0;
      g = 0.0;
      b = t;

    }

    else if (y < 0.40) {

      float t =
        (y - 0.20) / 0.20;

      r = t;
      g = 0.0;
      b = 1.0;

    }

    else if (y < 0.60) {

      float t =
        (y - 0.40) / 0.20;

      r = 1.0;
      g = 0.0;
      b = 1.0 - t;

    }

    else if (y < 0.78) {

      float t =
        (y - 0.60) / 0.18;

      r = 1.0;
      g = t;
      b = 0.0;

    }

    else {

      float t =
        (y - 0.78) / 0.22;

      r = 1.0;
      g = 1.0;
      b = t;

    }


    color =
      vec3(
        r,
        g,
        b
      );

  }


  /*
     INVERSO
  */

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

    console.error(
      gl.getShaderInfoLog(
        shader
      )
    );

    throw new Error(
      "Error compilando WebGL."
    );

  }

  return shader;

}


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
   PROGRAMA
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
    gl.getProgramInfoLog(
      program
    )
  );

}

gl.useProgram(program);


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
   TEXTURA

   SIN UNPACK_FLIP_Y_WEBGL
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
   TEXTURA CÁMARA
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

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      1.5
    );


  canvas.width =
    Math.floor(
      window.innerWidth *
      dpr
    );


  canvas.height =
    Math.floor(
      window.innerHeight *
      dpr
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
   CÁMARA
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


    stream =
      await navigator
        .mediaDevices
        .getUserMedia({

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


    try {

      await track.applyConstraints({

        frameRate: {
          ideal: 30,
          max: 30
        }

      });

    } catch (e) {

      console.warn(
        "No se pudo fijar 30 FPS",
        e
      );

    }


    $("startPanel")
      ?.classList
      .add("hidden");


    $("status")
      .textContent =
      "CÁMARA ACTIVA";


    lastFrame =
      performance.now();

    fpsTime =
      performance.now();

    fpsCounter = 0;


    cancelAnimationFrame(
      animationFrame
    );


    animationFrame =
      requestAnimationFrame(
        render
      );


  } catch (e) {

    console.error(e);

    $("status")
      .textContent =
      "ERROR";

    alert(
      e.message ||
      "No se pudo acceder a la cámara."
    );

  }

}


/* =========================================================
   RENDER
   ========================================================= */

function drawFrame() {

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {

    return;

  }


  gl.activeTexture(
    gl.TEXTURE0
  );

  gl.bindTexture(
    gl.TEXTURE_2D,
    cameraTexture
  );


  gl.texImage2D(

    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    video

  );


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
      state.zoom
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
     VR
  */

  if (vr) {

    const half =
      canvas.width / 2;


    gl.viewport(
      0,
      0,
      half,
      canvas.height
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


    gl.viewport(
      half,
      0,
      half,
      canvas.height
    );


    gl.drawArrays(
      gl.TRIANGLES,
      0,
      6
    );


  } else {

    gl.viewport(
      0,
      0,
      canvas.width,
      canvas.height
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


function render(timestamp) {

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


  if (
    timestamp -
    fpsTime >=
    1000
  ) {

    $("fps").textContent =
      fpsCounter +
      " FPS";

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
   CONTROLES
   ========================================================= */

function updateControls() {

  if ($("brightness"))
    $("brightness").value =
      state.brightness;

  if ($("contrast"))
    $("contrast").value =
      state.contrast;

  if ($("gain"))
    $("gain").value =
      state.gain;

  if ($("zoom"))
    $("zoom").value =
      state.zoom;

  if ($("height"))
    $("height").value =
      state.height;


  if ($("brightnessOut"))
    $("brightnessOut").textContent =
      state.brightness.toFixed(2);

  if ($("contrastOut"))
    $("contrastOut").textContent =
      state.contrast.toFixed(2);

  if ($("gainOut"))
    $("gainOut").textContent =
      state.gain.toFixed(2);

  if ($("zoomOut"))
    $("zoomOut").textContent =
      state.zoom.toFixed(1) +
      "×";

  if ($("heightOut"))
    $("heightOut").textContent =
      state.height.toFixed(2) +
      " m";

}


[
  "brightness",
  "contrast",
  "gain",
  "zoom",
  "height"

].forEach(id => {

  $(id)?.addEventListener(
    "input",
    () => {

      state[id] =
        Number(
          $(id).value
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

      }


      updateControls();
      saveState();

    }
  );

});


/* =========================================================
   RETÍCULAS
   ========================================================= */

function updateCrosshair() {

  const left =
    document.querySelector(
      ".crosshair-eye.left"
    );

  const right =
    document.querySelector(
      ".crosshair-eye.right"
    );


  if (!cross) {

    left.style.display =
      "none";

    right.style.display =
      "none";

    return;

  }


  if (vr) {

    left.style.display =
      "";

    right.style.display =
      "";

  } else {

    left.style.display =
      "";

    right.style.display =
      "none";

  }

}


updateCrosshair();


/* =========================================================
   CAMBIO DE MODO
   ========================================================= */

function setMode() {

  mode =
    (mode + 1) % 5;


  const names = [

    "MODO: VERDE",
    "MODO: B/N",
    "MODO: ROJO",
    "MODO: TÉRMICO",
    "MODO: INVERSO"

  ];


  const labels = [

    "NIGHT VISION",
    "BLACK & WHITE",
    "RED VISION",
    "THERMAL",
    "INVERSE"

  ];


  document
    .querySelector(
      '[data-action="mode"]'
    )
    .textContent =
    names[mode];


  $("modeLabel")
    .textContent =
    labels[mode];

}


/* =========================================================
   SENSORES
   ========================================================= */

async function enableMotion() {

  try {

    /*
       iPhone / iOS
    */

    if (
      typeof DeviceOrientationEvent
        .requestPermission ===
      "function"
    ) {

      const permission =
        await DeviceOrientationEvent
          .requestPermission();


      if (
        permission !==
        "granted"
      ) {

        throw new Error(
          "Permiso de sensores rechazado."
        );

      }

    }


    window.addEventListener(
      "deviceorientation",
      handleOrientation,
      true
    );


    motionActive = true;


    $("status")
      .textContent =
      "SENSORES ACTIVOS";


  } catch (e) {

    console.error(e);

    alert(
      e.message ||
      "No se pudieron activar los sensores."
    );

  }

}


function handleOrientation(event) {

  /*
     beta:
     inclinación frontal.

     gamma:
     inclinación lateral.
  */

  if (
    typeof event.beta !==
    "number"
  ) {

    return;

  }


  /*
     Convertimos beta en
     inclinación relativa.

     La calibración permite
     definir qué posición
     consideramos horizontal.
  */

  pitch =
    event.beta -
    calibratedPitch;

}


/* =========================================================
   CALIBRAR HORIZONTAL
   ========================================================= */

function calibrateHorizontal() {

  if (!motionActive) {

    alert(
      "Primero activa los sensores."
    );

    return;

  }


  /*
     Tomamos la posición
     actual como horizontal.
  */

  calibratedPitch =
    pitch +
    calibratedPitch;


  pitch = 0;


  alert(
    "Horizontal calibrada.\n\n" +
    "Mantén el teléfono en la posición " +
    "que deseas utilizar como referencia."
  );

}


/* =========================================================
   MEDICIÓN
   ========================================================= */

function measureDistance() {

  if (!motionActive) {

    alert(
      "Activa primero los sensores."
    );

    return;

  }


  /*
     Ángulo respecto de horizontal.
  */

  const angle =
    Math.abs(pitch);


  /*
     Si el ángulo es demasiado pequeño,
     la distancia tendería a infinito.
  */

  if (
    angle < 0.15
  ) {

    showDistance(
      null,
      pitch
    );

    return;

  }


  /*
     CONVERSIÓN A RADIANES
  */

  const radians =
    angle *
    Math.PI /
    180;


  /*
     D = H / tan(theta)
  */

  let distance =
    state.height /
    Math.tan(radians);


  /*
     Limitar valores extremos
  */

  if (
    !Number.isFinite(distance)
  ) {

    distance = null;

  }


  if (
    distance !== null &&
    distance > 1000
  ) {

    distance = null;

  }


  showDistance(
    distance,
    pitch
  );

}


/* =========================================================
   MOSTRAR DISTANCIA
   ========================================================= */

function showDistance(
  distance,
  angle
) {

  $("distanceHud")
    .classList
    .remove("hidden");


  if (
    distance === null
  ) {

    $("distanceValue")
      .textContent =
      "> 100 m";

  } else {

    $("distanceValue")
      .textContent =
      distance.toFixed(1) +
      " m";

  }


  $("angleValue")
    .textContent =
    "ÁNGULO " +
    angle.toFixed(2) +
    "°";


  $("heightValue")
    .textContent =
    "ALTURA " +
    state.height.toFixed(2) +
    " m";

}


/* =========================================================
   BOTONES
   ========================================================= */

$("startBtn")
  ?.addEventListener(
    "click",
    startCamera
  );


$("menuBtn")
  ?.addEventListener(
    "click",
    () => {

      $("controls")
        .classList
        .remove("hidden");

    }
  );


$("closeBtn")
  ?.addEventListener(
    "click",
    () => {

      $("controls")
        .classList
        .add("hidden");

    }
  );


/* =========================================================
   ACCIONES
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


        /* MODO */

        if (
          action === "mode"
        ) {

          setMode();

        }


        /* VR */

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


          $("vrLabel")
            .textContent =
            "VR " +
            (
              vr
                ? "ON"
                : "OFF"
            );


          document.body
            .classList
            .toggle(
              "vr-mode",
              vr
            );


          updateCrosshair();

        }


        /* RETÍCULA */

        else if (
          action === "crosshair"
        ) {

          cross =
            !cross;


          button.textContent =
            "RETÍCULA: " +
            (
              cross
                ? "ON"
                : "OFF"
            );


          updateCrosshair();

        }


        /* ESPEJO */

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


        /* MEDIR */

        else if (
          action === "measure"
        ) {

          measureDistance();

        }


        /* CALIBRAR */

        else if (
          action === "calibrate"
        ) {

          calibrateHorizontal();

        }


        /* SENSORES */

        else if (
          action === "sensors"
        ) {

          await enableMotion();

        }


        /* FULLSCREEN */

        else if (
          action === "fullscreen"
        ) {

          try {

            if (
              document.fullscreenElement
            ) {

              await document
                .exitFullscreen();

            } else {

              await document
                .documentElement
                .requestFullscreen();

            }

          } catch (e) {

            console.warn(e);

          }

        }


        /* LINTERNA */

        else if (
          action === "torch"
        ) {

          if (!track) {

            alert(
              "Activa primero la cámara."
            );

            return;

          }


          try {

            const caps =
              track.getCapabilities?.();


            if (
              caps?.torch
            ) {

              torch =
                !torch;


              await track
                .applyConstraints({

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
                "Este teléfono/navegador no permite controlar la linterna."
              );

            }

          } catch (e) {

            console.warn(e);

          }

        }

      }
    );

  });


/* =========================================================
   BOTÓN MEDIR VR
   ========================================================= */

$("measureVrBtn")
  ?.addEventListener(
    "click",
    measureDistance
  );


/* =========================================================
   TECLADO

   Si un mando Bluetooth o teclado
   entrega una tecla, podemos usar:

   M = medir
   + = medir
   ========================================================= */

window.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "m" ||
      event.key === "M" ||
      event.key === "+"
    ) {

      measureDistance();

    }

  }
);


/* =========================================================
   RESTABLECER
   ========================================================= */

$("resetBtn")
  ?.addEventListener(
    "click",
    () => {

      Object.assign(

        state,

        {

          brightness: 1.2,
          contrast: 1.35,
          gain: 1,
          zoom: 0.8,
          height: 1.65

        }

      );


      saveState();

      updateControls();

    }
  );


/* =========================================================
   FULLSCREEN DOBLE CLICK

   Se mantiene únicamente como
   función secundaria.

   En VR usamos MEDIR.
   ========================================================= */

document.addEventListener(
  "dblclick",
  () => {

    if (vr) {

      return;

    }


    document
      .documentElement
      .requestFullscreen?.();

  }
);


/* =========================================================
   PAGE HIDE
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

  navigator
    .serviceWorker
    .register(
      "./sw.js"
    )
    .catch(
      e =>
        console.warn(
          "Service Worker:",
          e
        )
    );

}