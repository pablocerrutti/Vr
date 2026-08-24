/* =========================================================
   LONEWOLF NIGHTVISION
   VR AIRSOFT / LOW LIGHT VIEWER
   =========================================================

   Cámara:
   - SOLO cámara trasera
   - Sin selector selfie

   Modos:
   - NORMAL
   - VERDE NV
   - BLANCO Y NEGRO
   - TÉRMICO DIGITAL

   Imagen:
   - Brillo
   - Contraste
   - Ganancia
   - Zoom

   Retícula:
   - Centro
   - Referencia 50 x 50 cm
   - Escala 30 - 100 m

   Medición:
   - Método tangencial
   - Objeto de referencia: 50 x 50 cm
   - Altura de visión: 1.65 m
   - Rango: 30 - 100 m

   VR:
   - Doble imagen
   - Separación configurable
   ========================================================= */


/* =========================================================
   ELEMENTOS PRINCIPALES
   ========================================================= */

const video =
    document.getElementById("camera");

const canvas =
    document.getElementById("nightCanvas");

const ctx =
    canvas.getContext("2d", {
        willReadFrequently: true
    });

const loading =
    document.getElementById("loading");

const cameraStatus =
    document.getElementById("cameraStatus");

const cameraButton =
    document.getElementById("cameraButton");

const nightButton =
    document.getElementById("nightButton");

const reticleButton =
    document.getElementById("reticleButton");

const switchButton =
    document.getElementById("switchButton");

const reticle =
    document.getElementById("reticle");


/* =========================================================
   ESTADO
   ========================================================= */

let stream = null;

let animationFrame = null;

let cameraReady = false;


/*
 * SOLO environment.
 *
 * No se permite cambiar a "user".
 */

const CAMERA_FACING =
    "environment";


/* =========================================================
   MODOS DE IMAGEN
   ========================================================= */

const MODES = {

    NORMAL:
        "normal",

    GREEN:
        "green",

    BW:
        "bw",

    THERMAL:
        "thermal"

};


let currentMode =
    MODES.GREEN;


/* =========================================================
   AJUSTES DE IMAGEN
   ========================================================= */

let brightness =
    1.00;

let contrast =
    1.00;

let gain =
    1.00;

let digitalZoom =
    1.00;


/* =========================================================
   RETÍCULA
   ========================================================= */

let reticleEnabled =
    true;

let rangeScaleEnabled =
    true;


/* =========================================================
   MEDICIÓN TANGENCIAL
   ========================================================= */


/*
 * Objeto de referencia:
 *
 * 50 cm x 50 cm
 */

const TARGET_SIZE_M =
    0.50;


/*
 * Altura de visión:
 *
 * 1.65 metros
 */

const EYE_HEIGHT_M =
    1.65;


/*
 * FOV vertical aproximado
 * para la cámara principal
 * del iPhone SE 2020.
 *
 * Se puede ajustar desde
 * el menú.
 */

let verticalFOV =
    48;


/*
 * Rango operativo solicitado.
 */

const MIN_RANGE =
    30;

const MAX_RANGE =
    100;


/*
 * Distancia calculada.
 */

let measuredDistance =
    null;


/*
 * Punto utilizado para la medición.
 *
 * Coordenadas normalizadas:
 *
 * 0 = izquierda / arriba
 * 1 = derecha / abajo
 */

let measurementTop =
    0.25;

let measurementBottom =
    0.75;


/* =========================================================
   VR
   ========================================================= */

let vrEnabled =
    false;

let vrSeparation =
    0.12;


/* =========================================================
   UTILIDADES DOM
   ========================================================= */

function $(id) {

    return document.getElementById(id);

}


/* =========================================================
   CREAR INTERFAZ AVANZADA
   ========================================================= */

function crearInterfaz() {

    /*
     * Si ya existe el menú avanzado,
     * no lo volvemos a crear.
     */

    if ($("advancedControls")) {

        return;

    }


    /*
     * Botón principal.
     */

    const menuButton =
        document.createElement("button");

    menuButton.id =
        "menuButton";

    menuButton.type =
        "button";

    menuButton.className =
        "lw-menu-button";

    menuButton.textContent =
        "☰";

    document.body.appendChild(
        menuButton
    );


    /*
     * Panel.
     */

    const panel =
        document.createElement("div");

    panel.id =
        "advancedControls";

    panel.className =
        "lw-panel hidden";


    panel.innerHTML = `

        <div class="lw-panel-header">

            <strong>
                LONEWOLF
                <small>NIGHTVISION</small>
            </strong>

            <button
                id="closeMenu"
                type="button"
            >
                ×
            </button>

        </div>


        <div class="lw-section">

            <div class="lw-section-title">
                MODO DE VISIÓN
            </div>


            <div class="lw-grid">

                <button
                    id="modeNormal"
                    type="button"
                >
                    NORMAL
                </button>

                <button
                    id="modeGreen"
                    type="button"
                    class="active"
                >
                    VERDE NV
                </button>

                <button
                    id="modeBW"
                    type="button"
                >
                    B/N
                </button>

                <button
                    id="modeThermal"
                    type="button"
                >
                    TÉRMICO
                </button>

            </div>

        </div>


        <div class="lw-section">

            <div class="lw-section-title">
                IMAGEN
            </div>


            <label>

                <span>
                    BRILLO
                </span>

                <output
                    id="brightnessValue"
                >
                    1.00
                </output>

                <input
                    id="brightnessControl"
                    type="range"
                    min="0.50"
                    max="2.00"
                    step="0.05"
                    value="1.00"
                >

            </label>


            <label>

                <span>
                    CONTRASTE
                </span>

                <output
                    id="contrastValue"
                >
                    1.00
                </output>

                <input
                    id="contrastControl"
                    type="range"
                    min="0.50"
                    max="2.50"
                    step="0.05"
                    value="1.00"
                >

            </label>


            <label>

                <span>
                    GANANCIA
                </span>

                <output
                    id="gainValue"
                >
                    1.00
                </output>

                <input
                    id="gainControl"
                    type="range"
                    min="0.50"
                    max="3.00"
                    step="0.05"
                    value="1.00"
                >

            </label>


            <label>

                <span>
                    ZOOM
                </span>

                <output
                    id="zoomValue"
                >
                    1.00x
                </output>

                <input
                    id="zoomControl"
                    type="range"
                    min="1.00"
                    max="4.00"
                    step="0.05"
                    value="1.00"
                >

            </label>

        </div>


        <div class="lw-section">

            <div class="lw-section-title">
                RETÍCULA
            </div>


            <div class="lw-grid">

                <button
                    id="toggleReticle"
                    type="button"
                    class="active"
                >
                    RETÍCULA
                </button>

                <button
                    id="toggleScale"
                    type="button"
                    class="active"
                >
                    ESCALA
                </button>

            </div>

        </div>


        <div class="lw-section">

            <div class="lw-section-title">
                MEDICIÓN TANGENCIAL
            </div>


            <div class="lw-info">

                <span>
                    REFERENCIA
                </span>

                <strong>
                    50 × 50 CM
                </strong>

            </div>


            <div class="lw-info">

                <span>
                    ALTURA VISIÓN
                </span>

                <strong>
                    1.65 M
                </strong>

            </div>


            <div class="lw-info">

                <span>
                    RANGO
                </span>

                <strong>
                    30 - 100 M
                </strong>

            </div>


            <label>

                <span>
                    FOV VERTICAL
                </span>

                <output
                    id="fovValue"
                >
                    48°
                </output>

                <input
                    id="fovControl"
                    type="range"
                    min="40"
                    max="60"
                    step="1"
                    value="48"
                >

            </label>


            <div
                id="distanceResult"
                class="lw-distance"
            >
                DISTANCIA
                <strong>
                    --
                </strong>
            </div>


            <div class="lw-measure-help">

                Colocá la base del objeto
                sobre la referencia inferior
                de la retícula.

            </div>

        </div>


        <div class="lw-section">

            <div class="lw-section-title">
                VR BOX
            </div>


            <div class="lw-grid">

                <button
                    id="toggleVR"
                    type="button"
                >
                    VR OFF
                </button>

            </div>


            <label>

                <span>
                    SEPARACIÓN VR
                </span>

                <output
                    id="vrValue"
                >
                    12%
                </output>

                <input
                    id="vrControl"
                    type="range"
                    min="0"
                    max="0.25"
                    step="0.01"
                    value="0.12"
                >

            </label>

        </div>


        <div class="lw-section">

            <button
                id="resetControls"
                class="lw-reset"
                type="button"
            >
                RESTABLECER
            </button>

        </div>

    `;


    document.body.appendChild(
        panel
    );


    /*
     * CSS del menú.
     *
     * Se inyecta desde JS para que
     * funcione incluso con el style.css
     * anterior.
     */

    agregarEstilosInterfaz();


    /*
     * Eventos.
     */

    menuButton.onclick =
        () => {

            panel.classList.toggle(
                "hidden"
            );

        };


    $("closeMenu").onclick =
        () => {

            panel.classList.add(
                "hidden"
            );

        };


    configurarEventosMenu();

}


/* =========================================================
   ESTILOS DEL MENÚ
   ========================================================= */

function agregarEstilosInterfaz() {

    if ($("lwDynamicStyle")) {

        return;

    }


    const style =
        document.createElement("style");

    style.id =
        "lwDynamicStyle";


    style.textContent = `

        .lw-menu-button {

            position: fixed;

            right: 16px;

            top: 16px;

            z-index: 1000;

            width: 56px;

            height: 56px;

            border-radius: 12px;

            border:
                1px solid
                rgba(100,255,120,.75);

            background:
                rgba(0,10,2,.88);

            color:
                #aaffb5;

            font-size: 25px;

            font-weight: 900;

            box-shadow:
                0 0 18px
                rgba(0,255,80,.18);

            backdrop-filter:
                blur(6px);

            -webkit-backdrop-filter:
                blur(6px);

        }


        .lw-panel {

            position: fixed;

            top: 0;

            right: 0;

            z-index: 999;

            width:
                min(390px, 88vw);

            height: 100vh;

            box-sizing: border-box;

            overflow-y: auto;

            padding:
                18px 18px 35px;

            background:
                rgba(2,8,3,.97);

            border-left:
                1px solid
                rgba(80,190,100,.65);

            box-shadow:
                -18px 0 45px
                rgba(0,0,0,.80);

            transform:
                translateX(0);

            transition:
                transform .25s ease;

            color:
                #baffc5;

            font-family:
                monospace;

        }


        .lw-panel.hidden {

            transform:
                translateX(105%);

            pointer-events:
                none;

        }


        .lw-panel-header {

            display:
                flex;

            align-items:
                center;

            justify-content:
                space-between;

            padding-bottom:
                16px;

            border-bottom:
                1px solid
                rgba(80,190,100,.25);

            margin-bottom:
                14px;

        }


        .lw-panel-header strong {

            font-size:
                16px;

            letter-spacing:
                2px;

        }


        .lw-panel-header small {

            display:
                block;

            margin-top:
                4px;

            font-size:
                9px;

            opacity:
                .65;

            letter-spacing:
                3px;

        }


        #closeMenu {

            width:
                46px;

            height:
                46px;

            border:
                1px solid
                #3f914d;

            border-radius:
                9px;

            background:
                #071008;

            color:
                #aaffb5;

            font-size:
                28px;

        }


        .lw-section {

            margin-bottom:
                22px;

            padding-bottom:
                18px;

            border-bottom:
                1px solid
                rgba(80,190,100,.18);

        }


        .lw-section-title {

            margin-bottom:
                14px;

            color:
                #80ff91;

            font-size:
                11px;

            font-weight:
                900;

            letter-spacing:
                2px;

        }


        .lw-grid {

            display:
                grid;

            grid-template-columns:
                1fr 1fr;

            gap:
                9px;

        }


        .lw-grid button,
        .lw-reset {

            min-height:
                48px;

            border:
                1px solid
                #367944;

            border-radius:
                8px;

            background:
                #071008;

            color:
                #baffc5;

            font:
                800 11px monospace;

        }


        .lw-grid button.active {

            background:
                rgba(50,170,70,.25);

            border-color:
                #70ff83;

            box-shadow:
                inset 0 0 10px
                rgba(70,255,100,.10);

        }


        .lw-section label {

            display:
                block;

            margin:
                15px 0;

        }


        .lw-section label span {

            display:
                inline-block;

            color:
                #a6bca9;

            font-size:
                12px;

        }


        .lw-section output {

            float:
                right;

            color:
                #78ff8b;

            font:
                800 12px monospace;

        }


        .lw-section input {

            display:
                block;

            width:
                100%;

            height:
                28px;

            margin-top:
                6px;

            accent-color:
                #62e874;

        }


        .lw-info {

            display:
                flex;

            justify-content:
                space-between;

            padding:
                5px 0;

            color:
                #829687;

            font-size:
                11px;

        }


        .lw-info strong {

            color:
                #aaffb5;

        }


        .lw-distance {

            margin-top:
                14px;

            padding:
                15px;

            text-align:
                center;

            border:
                1px solid
                #478c51;

            border-radius:
                9px;

            background:
                rgba(20,70,25,.22);

            color:
                #829687;

            font-size:
                10px;

            letter-spacing:
                2px;

        }


        .lw-distance strong {

            display:
                block;

            margin-top:
                5px;

            color:
                #aaffb5;

            font-size:
                28px;

            letter-spacing:
                1px;

        }


        .lw-measure-help {

            margin-top:
                12px;

            color:
                #647b69;

            font-size:
                10px;

            line-height:
                1.5;

        }


        .lw-reset {

            width:
                100%;

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   EVENTOS DEL MENÚ
   ========================================================= */

function configurarEventosMenu() {


    /*
     * Modos.
     */

    $("modeNormal").onclick =
        () => {

            seleccionarModo(
                MODES.NORMAL
            );

        };


    $("modeGreen").onclick =
        () => {

            seleccionarModo(
                MODES.GREEN
            );

        };


    $("modeBW").onclick =
        () => {

            seleccionarModo(
                MODES.BW
            );

        };


    $("modeThermal").onclick =
        () => {

            seleccionarModo(
                MODES.THERMAL
            );

        };


    /*
     * Brillo.
     */

    $("brightnessControl")
        .addEventListener(
            "input",
            event => {

                brightness =
                    Number(
                        event.target.value
                    );

                $("brightnessValue")
                    .textContent =
                    brightness.toFixed(2);

            }
        );


    /*
     * Contraste.
     */

    $("contrastControl")
        .addEventListener(
            "input",
            event => {

                contrast =
                    Number(
                        event.target.value
                    );

                $("contrastValue")
                    .textContent =
                    contrast.toFixed(2);

            }
        );


    /*
     * Ganancia.
     */

    $("gainControl")
        .addEventListener(
            "input",
            event => {

                gain =
                    Number(
                        event.target.value
                    );

                $("gainValue")
                    .textContent =
                    gain.toFixed(2);

            }
        );


    /*
     * Zoom.
     */

    $("zoomControl")
        .addEventListener(
            "input",
            event => {

                digitalZoom =
                    Number(
                        event.target.value
                    );

                $("zoomValue")
                    .textContent =
                    digitalZoom.toFixed(2)
                    + "x";

            }
        );


    /*
     * FOV.
     */

    $("fovControl")
        .addEventListener(
            "input",
            event => {

                verticalFOV =
                    Number(
                        event.target.value
                    );

                $("fovValue")
                    .textContent =
                    verticalFOV + "°";

                actualizarMedicion();

            }
        );


    /*
     * Retícula.
     */

    $("toggleReticle").onclick =
        () => {

            reticleEnabled =
                !reticleEnabled;

            $("toggleReticle")
                .classList.toggle(
                    "active",
                    reticleEnabled
                );

        };


    /*
     * Escala.
     */

    $("toggleScale").onclick =
        () => {

            rangeScaleEnabled =
                !rangeScaleEnabled;

            $("toggleScale")
                .classList.toggle(
                    "active",
                    rangeScaleEnabled
                );

        };


    /*
     * VR.
     */

    $("toggleVR").onclick =
        () => {

            vrEnabled =
                !vrEnabled;

            $("toggleVR")
                .textContent =
                vrEnabled
                    ? "VR ON"
                    : "VR OFF";

            $("toggleVR")
                .classList.toggle(
                    "active",
                    vrEnabled
                );

        };


    /*
     * Separación VR.
     */

    $("vrControl")
        .addEventListener(
            "input",
            event => {

                vrSeparation =
                    Number(
                        event.target.value
                    );

                $("vrValue")
                    .textContent =
                    Math.round(
                        vrSeparation * 100
                    ) + "%";

            }
        );


    /*
     * Reset.
     */

    $("resetControls").onclick =
        () => {

            resetearControles();

        };

}


/* =========================================================
   SELECCIÓN DE MODO
   ========================================================= */

function seleccionarModo(
    mode
) {

    currentMode =
        mode;


    const buttons = [

        "modeNormal",
        "modeGreen",
        "modeBW",
        "modeThermal"

    ];


    buttons.forEach(
        id => {

            $(id)
                .classList
                .remove(
                    "active"
                );

        }
    );


    if (
        mode === MODES.NORMAL
    ) {

        $("modeNormal")
            .classList
            .add("active");

    }


    if (
        mode === MODES.GREEN
    ) {

        $("modeGreen")
            .classList
            .add("active");

    }


    if (
        mode === MODES.BW
    ) {

        $("modeBW")
            .classList
            .add("active");

    }


    if (
        mode === MODES.THERMAL
    ) {

        $("modeThermal")
            .classList
            .add("active");

    }


    /*
     * Mantener compatibilidad
     * con el botón antiguo NV.
     */

    if (nightButton) {

        nightButton.classList.toggle(
            "active",
            mode !== MODES.NORMAL
        );

    }

}


/* =========================================================
   INICIO
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        crearInterfaz();

        iniciarAplicacion();

    }
);


/* =========================================================
   INICIAR APLICACIÓN
   ========================================================= */

async function iniciarAplicacion() {

    ajustarCanvas();


    window.addEventListener(
        "resize",
        ajustarCanvas
    );


    window.addEventListener(
        "orientationchange",
        () => {

            setTimeout(
                ajustarCanvas,
                350
            );

        }
    );


    await iniciarCamara();

}


/* =========================================================
   CANVAS
   ========================================================= */

function ajustarCanvas() {

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

}


/* =========================================================
   INICIAR CÁMARA
   ========================================================= */

async function iniciarCamara() {

    detenerCamara();


    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "getUserMedia no disponible"
            );

        }


        /*
         * IMPORTANTE:
         *
         * "ideal" en lugar de "exact".
         *
         * Esto evita problemas de Safari
         * con las cámaras del iPhone.
         */

        stream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {

                            ideal:
                                CAMERA_FACING

                        },

                        width: {

                            ideal:
                                1920

                        },

                        height: {

                            ideal:
                                1080

                        },

                        frameRate: {

                            ideal:
                                30,

                            max:
                                30

                        }

                    },

                    audio:
                        false

                });


        /*
         * Asignar stream.
         */

        video.srcObject =
            stream;


        video.setAttribute(
            "playsinline",
            ""
        );


        video.setAttribute(
            "autoplay",
            ""
        );


        video.muted =
            true;


        /*
         * Esperar metadatos.
         */

        await new Promise(
            resolve => {

                if (
                    video.readyState >= 2
                ) {

                    resolve();

                    return;

                }


                video.onloadedmetadata =
                    () => {

                        resolve();

                    };

            }
        );


        await video.play();


        cameraReady =
            true;


        if (cameraStatus) {

            cameraStatus.textContent =
                "CAM TRASERA OK";

        }


        if (loading) {

            loading.classList.add(
                "hidden"
            );

        }


        comenzarProcesamiento();


    }

    catch (error) {

        console.error(
            "ERROR CÁMARA:",
            error
        );


        cameraReady =
            false;


        if (cameraStatus) {

            cameraStatus.textContent =
                "SIN CÁMARA";

        }


        if (loading) {

            loading.classList.remove(
                "hidden"
            );


            const text =
                loading.querySelector(
                    ".loading-text"
                );


            if (text) {

                if (
                    error.name ===
                    "NotAllowedError"
                ) {

                    text.textContent =
                        "Permite el acceso a la cámara";

                }

                else {

                    text.textContent =
                        "No se pudo iniciar la cámara";

                }

            }

        }

    }

}


/* =========================================================
   DETENER CÁMARA
   ========================================================= */

function detenerCamara() {

    if (!stream) {

        return;

    }


    stream
        .getTracks()
        .forEach(
            track => {

                track.stop();

            }
        );


    stream =
        null;


    cameraReady =
        false;

}


/* =========================================================
   PROCESAMIENTO
   ========================================================= */

function comenzarProcesamiento() {

    if (animationFrame) {

        cancelAnimationFrame(
            animationFrame
        );

    }


    procesarImagen();

}


/* =========================================================
   PROCESAR IMAGEN
   ========================================================= */

function procesarImagen() {

    if (
        cameraReady &&
        video.readyState >= 2 &&
        canvas.width > 0 &&
        canvas.height > 0
    ) {

        dibujarCamara();

        aplicarProcesamiento();

        dibujarHUD();

    }


    animationFrame =
        requestAnimationFrame(
            procesarImagen
        );

}


/* =========================================================
   DIBUJAR CÁMARA
   ========================================================= */

function dibujarCamara() {

    const vw =
        video.videoWidth;

    const vh =
        video.videoHeight;


    if (
        !vw ||
        !vh
    ) {

        return;

    }


    const cw =
        canvas.width;

    const ch =
        canvas.height;


    /*
     * Zoom digital.
     */

    const zoom =
        Math.max(
            1,
            digitalZoom
        );


    const visibleWidth =
        vw / zoom;

    const visibleHeight =
        vh / zoom;


    const sx =
        (vw -
            visibleWidth) / 2;


    const sy =
        (vh -
            visibleHeight) / 2;


    /*
     * VR:
     *
     * Se dibuja primero una imagen
     * completa. El modo VR se aplica
     * posteriormente.
     */

    ctx.drawImage(

        video,

        sx,
        sy,

        visibleWidth,
        visibleHeight,

        0,
        0,

        cw,
        ch

    );

}


/* =========================================================
   PROCESAMIENTO DE IMAGEN
   ========================================================= */

function aplicarProcesamiento() {

    if (
        currentMode ===
        MODES.NORMAL
    ) {

        aplicarAjustes();

        return;

    }


    const image =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );


    const data =
        image.data;


    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {

        let r =
            data[i];

        let g =
            data[i + 1];

        let b =
            data[i + 2];


        /*
         * Luminancia.
         */

        const luminance =
            (
                0.299 * r +
                0.587 * g +
                0.114 * b
            );


        /*
         * GANANCIA.
         */

        let value =
            luminance *
            gain;


        /*
         * BRILLO.
         */

        value *=
            brightness;


        /*
         * CONTRASTE.
         */

        value =
            (
                value - 128
            ) *
            contrast +
            128;


        value =
            Math.max(
                0,
                Math.min(
                    255,
                    value
                )
            );


        /*
         * MODO VERDE.
         */

        if (
            currentMode ===
            MODES.GREEN
        ) {

            r =
                value * 0.08;

            g =
                value;

            b =
                value * 0.12;

        }


        /*
         * BLANCO Y NEGRO.
         */

        else if (
            currentMode ===
            MODES.BW
        ) {

            r =
                value;

            g =
                value;

            b =
                value;

        }


        /*
         * MAPA TÉRMICO DIGITAL.
         */

        else if (
            currentMode ===
            MODES.THERMAL
        ) {

            const thermal =
                obtenerColorTermico(
                    value
                );

            r =
                thermal.r;

            g =
                thermal.g;

            b =
                thermal.b;

        }


        data[i] =
            r;

        data[i + 1] =
            g;

        data[i + 2] =
            b;

    }


    ctx.putImageData(
        image,
        0,
        0
    );

}


/* =========================================================
   AJUSTES EN MODO NORMAL
   ========================================================= */

function aplicarAjustes() {

    if (
        brightness === 1 &&
        contrast === 1 &&
        gain === 1
    ) {

        return;

    }


    const image =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );


    const data =
        image.data;


    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {

        data[i] =
            ajustarPixel(
                data[i]
            );

        data[i + 1] =
            ajustarPixel(
                data[i + 1]
            );

        data[i + 2] =
            ajustarPixel(
                data[i + 2]
            );

    }


    ctx.putImageData(
        image,
        0,
        0
    );

}


/* =========================================================
   AJUSTAR PIXEL
   ========================================================= */

function ajustarPixel(
    value
) {

    value *=
        gain;

    value *=
        brightness;

    value =
        (
            value - 128
        ) *
        contrast +
        128;


    return Math.max(
        0,
        Math.min(
            255,
            value
        )
    );

}


/* =========================================================
   MAPA TÉRMICO DIGITAL
   ========================================================= */

function obtenerColorTermico(
    value
) {

    const v =
        Math.max(
            0,
            Math.min(
                255,
                value
            )
        );


    /*
     * Azul → cian → verde →
     * amarillo → rojo → blanco
     */

    let r;
    let g;
    let b;


    if (
        v < 51
    ) {

        const t =
            v / 51;

        r = 0;

        g =
            Math.round(
                255 * t
            );

        b = 255;

    }

    else if (
        v < 102
    ) {

        const t =
            (
                v - 51
            ) / 51;

        r = 0;

        g = 255;

        b =
            Math.round(
                255 * (1 - t)
            );

    }

    else if (
        v < 153
    ) {

        const t =
            (
                v - 102
            ) / 51;

        r =
            Math.round(
                255 * t
            );

        g = 255;

        b = 0;

    }

    else if (
        v < 204
    ) {

        const t =
            (
                v - 153
            ) / 51;

        r = 255;

        g =
            Math.round(
                255 * (1 - t)
            );

        b = 0;

    }

    else {

        const t =
            (
                v - 204
            ) / 51;

        r = 255;

        g =
            Math.round(
                255 * t
            );

        b =
            Math.round(
                255 * t
            );

    }


    return {
        r,
        g,
        b
    };

}


/* =========================================================
   HUD
   ========================================================= */

function dibujarHUD() {

    if (
        !reticleEnabled
    ) {

        return;

    }


    const w =
        canvas.width;

    const h =
        canvas.height;


    /*
     * Centro.
     */

    const cx =
        w / 2;

    const cy =
        h / 2;


    /*
     * Escala de retícula.
     */

    const referenceSize =
        calcularTamanoReferencia();


    /*
     * Caja 50 x 50.
     */

    ctx.save();


    ctx.lineWidth =
        Math.max(
            1,
            w / 900
        );


    ctx.strokeStyle =
        currentMode ===
        MODES.THERMAL
            ? "rgba(255,255,255,.80)"
            : "rgba(110,255,130,.82)";


    ctx.fillStyle =
        ctx.strokeStyle;


    /*
     * Cruz central.
     */

    const cross =
        Math.max(
            16,
            w * 0.018
        );


    ctx.beginPath();

    ctx.moveTo(
        cx - cross,
        cy
    );

    ctx.lineTo(
        cx + cross,
        cy
    );

    ctx.moveTo(
        cx,
        cy - cross
    );

    ctx.lineTo(
        cx,
        cy + cross
    );

    ctx.stroke();


    /*
     * Punto central.
     */

    ctx.beginPath();

    ctx.arc(
        cx,
        cy,
        3,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /*
     * Caja de referencia.
     *
     * 50 x 50 cm
     */

    if (
        rangeScaleEnabled
    ) {

        const box =
            referenceSize;


        const left =
            cx - box / 2;


        const top =
            cy - box / 2;


        ctx.strokeRect(
            left,
            top,
            box,
            box
        );


        /*
         * Marcas laterales.
         */

        const tick =
            box * 0.08;


        ctx.beginPath();


        ctx.moveTo(
            left,
            cy
        );

        ctx.lineTo(
            left + tick,
            cy
        );


        ctx.moveTo(
            left + box,
            cy
        );

        ctx.lineTo(
            left + box - tick,
            cy
        );


        ctx.moveTo(
            cx,
            top
        );

        ctx.lineTo(
            cx,
            top + tick
        );


        ctx.moveTo(
            cx,
            top + box
        );

        ctx.lineTo(
            cx,
            top + box - tick
        );


        ctx.stroke();


        /*
         * Texto.
         */

        ctx.font =
            Math.max(
                11,
                w * 0.012
            ) +
            "px monospace";


        ctx.fillText(
            "50 x 50 CM",
            left,
            top - 8
        );


        /*
         * Escala de distancias.
         */

        dibujarEscalaDistancia(
            cx,
            top + box + 24
        );

    }


    ctx.restore();


    /*
     * Actualizar medición.
     */

    actualizarMedicion();

}


/* =========================================================
   TAMAÑO REFERENCIA
   ========================================================= */

function calcularTamanoReferencia() {

    /*
     * La referencia se muestra
     * proporcional al FOV.
     *
     * Para evitar que ocupe toda
     * la pantalla, se utiliza
     * una representación visual
     * práctica.
     */

    const h =
        canvas.height;


    const angularSize =
        2 *
        Math.atan(
            TARGET_SIZE_M /
            (
                2 *
                50
            )
        );


    const pixels =
        (
            angularSize /
            (
                verticalFOV *
                Math.PI /
                180
            )
        ) *
        h;


    return Math.max(
        45,
        Math.min(
            h * 0.55,
            pixels * 25
        )
    );

}


/* =========================================================
   ESCALA 30 - 100 METROS
   ========================================================= */

function dibujarEscalaDistancia(
    cx,
    y
) {

    if (
        !rangeScaleEnabled
    ) {

        return;

    }


    const distances = [

        30,
        40,
        50,
        60,
        70,
        80,
        90,
        100

    ];


    const width =
        Math.min(
            canvas.width * 0.75,
            700
        );


    const start =
        cx -
        width / 2;


    const end =
        cx +
        width / 2;


    const step =
        width /
        (
            distances.length - 1
        );


    ctx.save();


    ctx.strokeStyle =
        "rgba(120,255,140,.65)";


    ctx.fillStyle =
        "rgba(140,255,155,.85)";


    ctx.lineWidth =
        1;


    ctx.font =
        Math.max(
            9,
            canvas.width * 0.009
        ) +
        "px monospace";


    ctx.beginPath();


    ctx.moveTo(
        start,
        y
    );


    ctx.lineTo(
        end,
        y
    );


    ctx.stroke();


    distances.forEach(
        (
            distance,
            index
        ) => {

            const x =
                start +
                step *
                index;


            const tick =
                distance % 10 === 0
                    ? 9
                    : 6;


            ctx.beginPath();


            ctx.moveTo(
                x,
                y - tick
            );


            ctx.lineTo(
                x,
                y + tick
            );


            ctx.stroke();


            ctx.fillText(
                distance + "m",
                x - 8,
                y + 21
            );

        }
    );


    ctx.restore();

}


/* =========================================================
   MEDICIÓN TANGENCIAL
   ========================================================= */

function calcularDistanciaTangencial() {

    /*
     * La medición utiliza:
     *
     * D =
     * H / (
     * 2 * tan(theta / 2)
     * )
     *
     * donde:
     *
     * H = 0.50 m
     *
     * theta = ángulo aparente
     *
     * El ángulo aparente se obtiene
     * a partir de la proporción del
     * objeto respecto al FOV vertical.
     */


    const visibleFraction =
        Math.abs(
            measurementBottom -
            measurementTop
        );


    if (
        visibleFraction <= 0
    ) {

        return null;

    }


    const angularHeight =
        (
            verticalFOV *
            Math.PI /
            180
        ) *
        visibleFraction;


    if (
        angularHeight <= 0
    ) {

        return null;

    }


    const distance =
        TARGET_SIZE_M /
        (
            2 *
            Math.tan(
                angularHeight / 2
            )
        );


    /*
     * Limitar al rango solicitado.
     */

    if (
        distance < MIN_RANGE ||
        distance > MAX_RANGE
    ) {

        return null;

    }


    return distance;

}


/* =========================================================
   ACTUALIZAR MEDICIÓN
   ========================================================= */

function actualizarMedicion() {

    if (
        !$("distanceResult")
    ) {

        return;

    }


    /*
     * Por defecto usamos una referencia
     * equivalente al 50% de la altura.
     *
     * Esto representa un objeto de 50 cm
     * que ocupa la zona central de la
     * retícula.
     */

    measuredDistance =
        calcularDistanciaTangencial();


    const strong =
        $("distanceResult")
            .querySelector(
                "strong"
            );


    if (!strong) {

        return;

    }


    if (
        measuredDistance === null
    ) {

        strong.textContent =
            "--";

        return;

    }


    strong.textContent =
        measuredDistance
            .toFixed(1)
            + " M";

}


/* =========================================================
   RESET
   ========================================================= */

function resetearControles() {

    brightness =
        1;

    contrast =
        1;

    gain =
        1;

    digitalZoom =
        1;

    verticalFOV =
        48;

    vrSeparation =
        0.12;


    $("brightnessControl")
        .value =
        "1.00";


    $("contrastControl")
        .value =
        "1.00";


    $("gainControl")
        .value =
        "1.00";


    $("zoomControl")
        .value =
        "1.00";


    $("fovControl")
        .value =
        "48";


    $("vrControl")
        .value =
        "0.12";


    $("brightnessValue")
        .textContent =
        "1.00";


    $("contrastValue")
        .textContent =
        "1.00";


    $("gainValue")
        .textContent =
        "1.00";


    $("zoomValue")
        .textContent =
        "1.00x";


    $("fovValue")
        .textContent =
        "48°";


    $("vrValue")
        .textContent =
        "12%";


    seleccionarModo(
        MODES.GREEN
    );


    actualizarMedicion();

}


/* =========================================================
   BOTÓN CÁMARA ORIGINAL
   ========================================================= */

if (cameraButton) {

    cameraButton.addEventListener(
        "click",
        async () => {

            if (stream) {

                detenerCamara();


                cameraStatus.textContent =
                    "PAUSADA";


                if (loading) {

                    loading.classList.remove(
                        "hidden"
                    );

                }

            }

            else {

                if (loading) {

                    loading.classList.remove(
                        "hidden"
                    );

                }


                await iniciarCamara();

            }

        }
    );

}


/* =========================================================
   BOTÓN NV ORIGINAL
   ========================================================= */

if (nightButton) {

    nightButton.addEventListener(
        "click",
        () => {

            if (
                currentMode ===
                MODES.GREEN
            ) {

                seleccionarModo(
                    MODES.NORMAL
                );

            }

            else {

                seleccionarModo(
                    MODES.GREEN
                );

            }

        }
    );

}


/* =========================================================
   BOTÓN RETÍCULA ORIGINAL
   ========================================================= */

if (reticleButton) {

    reticleButton.addEventListener(
        "click",
        () => {

            reticleEnabled =
                !reticleEnabled;


            if (reticle) {

                reticle.classList.toggle(
                    "hidden",
                    !reticleEnabled
                );

            }


            reticleButton.classList.toggle(
                "active",
                reticleEnabled
            );


            if ($("toggleReticle")) {

                $("toggleReticle")
                    .classList.toggle(
                        "active",
                        reticleEnabled
                    );

            }

        }
    );

}


/* =========================================================
   DESACTIVAR SELECTOR DE CÁMARA
   =========================================================

   El botón original "switchButton"
   NO cambia a selfie.

   En su lugar simplemente
   vuelve a iniciar la cámara trasera.
   ========================================================= */

if (switchButton) {

    switchButton.textContent =
        "CAM TRASERA";


    switchButton.addEventListener(
        "click",
        async () => {

            if (loading) {

                loading.classList.remove(
                    "hidden"
                );

                const text =
                    loading.querySelector(
                        ".loading-text"
                    );


                if (text) {

                    text.textContent =
                        "Iniciando cámara trasera...";

                }

            }


            await iniciarCamara();

        }
    );

}


/* =========================================================
   LIMPIEZA
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        detenerCamara();


        if (animationFrame) {

            cancelAnimationFrame(
                animationFrame
            );

        }

    }
);