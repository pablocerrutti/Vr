/* =========================================================
   LONWOLF NIGHTVISION VR
   V9
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

let raf = 0;

let lastFrame = 0;
let fpsTime = performance.now();
let frames = 0;

const TARGET_FPS = 30;
const FRAME_TIME = 1000 / TARGET_FPS;

let mode = 0;

let vr = false;
let reticle = true;
let scale = true;
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
      localStorage.getItem(
        "lonwolf-v9"
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


  updateControls();

}


function saveState() {

  try {

    localStorage.setItem(
      "lonwolf-v9",
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

      powerPreference:
        "high-performance"

    }
  );


if (!gl) {

  alert(
    "Este navegador no dispone de WebGL."
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
     CORRECCIÓN VERTICAL
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


  vec2 p =
    uv - 0.5;


  if (
    sourceRatio >
    outputRatio
  ) {

    p.x *=
      outputRatio /
      sourceRatio;

  } else {

    p.y *=
      sourceRatio /
      outputRatio;

  }


  /*
     ZOOM

     0.8 mínimo
  */

  p /=
    max(
      0.8,
      u_zoom
    );


  uv =
    p + 0.5;


  uv =
    clamp(
      uv,
      0.0,
      1.0
    );


  /*
     IMAGEN
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
     BRILLO / GANANCIA
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
     VERDE
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
        (y - 0.20) /
        0.20;

      r = t;
      g = 0.0;
      b = 1.0;

    }

    else if (y < 0.60) {

      float t =
        (y - 0.40) /
        0.20;

      r = 1.0;
      g = 0.0;
      b = 1.0 - t;

    }

    else if (y < 0.78) {

      float t =
        (y - 0.60) /
        0.18;

      r = 1.0;
      g = t;
      b = 0.0;

    }

    else {

      float t =
        (y - 0.78) /
        0.22;

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

    color =
      vec3(
        1.0 - y
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
   SHADER
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
      "Error WebGL."
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


gl.useProgram(
  program
);


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

    -1,-1,
     1,-1,
    -1, 1,

    -1, 1,
     1,-1,
     1, 1

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

    0,0,
    1,0,
    0,1,

    0,1,
    1,0,
    1,1

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


gl.uniform1i(
  uniforms.texture,
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
      window.innerWidth * dpr
    );


  canvas.height =
    Math.floor(
      window.innerHeight * dpr
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
      stream
        .getVideoTracks()[0];


    try {

      await track
        .applyConstraints({

          frameRate: {
            ideal: 30,
            max: 30
          }

        });

    } catch (e) {}


    $("startPanel")
      .classList
      .add("hidden");


    $("status")
      .textContent =
      "CÁMARA ACTIVA";


    fpsTime =
      performance.now();

    frames = 0;

    lastFrame = 0;


    cancelAnimationFrame(
      raf
    );


    raf =
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
    uniforms.brightness,
    state.brightness
  );


  gl.uniform1f(
    uniforms.contrast,
    state.contrast
  );


  gl.uniform1f(
    uniforms.gain,
    state.gain
  );


  gl.uniform1f(
    uniforms.zoom,
    Math.max(
      0.8,
      state.zoom
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


  gl.clearColor(
    0,
    0,
    0,
    1
  );


  gl.clear(
    gl.COLOR_BUFFER_BIT
  );


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
      uniforms.outputAspect,
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

  }

  else {

    gl.viewport(
      0,
      0,
      canvas.width,
      canvas.height
    );


    gl.uniform2f(
      uniforms.outputAspect,
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

    frames++;

  }


  if (
    timestamp -
    fpsTime >=
    1000
  ) {

    $("fps")
      .textContent =
      frames +
      " FPS";


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
   CONTROLES
   ========================================================= */

function updateControls() {

  $("brightness").value =
    state.brightness;

  $("contrast").value =
    state.contrast;

  $("gain").value =
    state.gain;

  $("zoom").value =
    state.zoom;


  $("brightnessOut")
    .textContent =
    state.brightness.toFixed(2);

  $("contrastOut")
    .textContent =
    state.contrast.toFixed(2);

  $("gainOut")
    .textContent =
    state.gain.toFixed(2);

  $("zoomOut")
    .textContent =
    state.zoom.toFixed(1) +
    "×";

}


[
  "brightness",
  "contrast",
  "gain",
  "zoom"

].forEach(id => {

  $(id).addEventListener(
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
            state.zoom
          );

      }


      updateControls();

      saveState();

    }
  );

});


/* =========================================================
   RETÍCULA
   ========================================================= */

function updateReticle() {

  const normal =
    document.getElementById(
      "normalReticle"
    );

  const vrElement =
    document.getElementById(
      "vrReticle"
    );


  if (!reticle) {

    normal.style.display =
      "none";

    vrElement.style.display =
      "none";

    return;

  }


  if (vr) {

    normal.style.display =
      "none";

    vrElement.style.display =
      scale
        ? "block"
        : "block";

  }

  else {

    normal.style.display =
      "block";

    vrElement.style.display =
      "none";

  }


  document.getElementById(
    "rangeScale"
  ).style.display =
    scale
      ? "block"
      : "none";


  document
    .querySelectorAll(
      ".vr-scale"
    )
    .forEach(
      element => {

        element.style.display =
          scale
            ? "block"
            : "none";

      }
    );

}


updateReticle();


/* =========================================================
   MODOS
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


  document.body
    .classList
    .remove(
      "mode-red",
      "mode-white"
    );


  if (
    mode === 2
  ) {

    document.body
      .classList
      .add(
        "mode-red"
      );

  }

  else if (
    mode === 1 ||
    mode === 4
  ) {

    document.body
      .classList
      .add(
        "mode-white"
      );

  }

}


/* =========================================================
   ACCIONES
   ========================================================= */

$("startBtn")
  .addEventListener(
    "click",
    startCamera
  );


$("menuBtn")
  .addEventListener(
    "click",
    () => {

      $("controls")
        .classList
        .remove(
          "hidden"
        );

    }
  );


$("closeBtn")
  .addEventListener(
    "click",
    () => {

      $("controls")
        .classList
        .add(
          "hidden"
        );

    }
  );


document
  .querySelectorAll(
    "[data-action]"
  )
  .forEach(
    button => {

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


            updateReticle();

          }


          /* RETÍCULA */

          else if (
            action === "reticle"
          ) {

            reticle =
              !reticle;


            button.textContent =
              "RETÍCULA: " +
              (
                reticle
                  ? "ON"
                  : "OFF"
              );


            updateReticle();

          }


          /* ESCALA */

          else if (
            action === "scale"
          ) {

            scale =
              !scale;


            button.textContent =
              "ESCALA: " +
              (
                scale
                  ? "ON"
                  : "OFF"
              );


            updateReticle();

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


          /* FULLSCREEN */

          else if (
            action === "fullscreen"
          ) {

            try {

              await document
                .documentElement
                .requestFullscreen?.();

            } catch (e) {}

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

              const capabilities =
                track.getCapabilities?.();


              if (
                capabilities?.torch
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

              }

              else {

                alert(
                  "La cámara no permite controlar la linterna."
                );

              }

            } catch (e) {

              console.warn(e);

            }

          }

        }
      );

    }
  );


/* =========================================================
   RESTABLECER
   ========================================================= */

$("resetBtn")
  .addEventListener(
    "click",
    () => {

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

    }
  );


/* =========================================================
   DOBLE TOQUE
   ========================================================= */

document.addEventListener(
  "dblclick",
  () => {

    if (vr)
      return;

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

    stream
      ?.getTracks()
      .forEach(
        track =>
          track.stop()
      );

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
      () => {}
    );

}