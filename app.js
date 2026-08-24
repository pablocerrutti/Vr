/* =========================================
   LONEWOLF NIGHTVISION VR
   V1.2

   Cámara trasera
   Visión nocturna digital
   Verde / B-N / Térmico
   Brillo / Contraste / Ganancia / Zoom
   VR Box
   Retícula
   Medición tangencial 30-100 m
   Referencia 50 x 50 cm
========================================= */


/* =========================================
   ELEMENTOS
========================================= */

const video =
    document.getElementById("camera");

const canvas =
    document.getElementById("view");

const ctx =
    canvas.getContext(
        "2d",
        {
            alpha: false,
            willReadFrequently: true
        }
    );


const $ =
    id =>
        document.getElementById(id);


/* =========================================
   ESTADO
========================================= */

let stream = null;

let track = null;

let raf = 0;

let lastTime =
    performance.now();

let frames = 0;


/*
 * Modos:
 *
 * 0 = verde
 * 1 = blanco/negro
 * 2 = térmico
 */

let mode = 0;


/*
 * VR Box
 */

let vr = false;


/*
 * Retícula
 */

let cross = true;


/*
 * Espejo
 */

let mirror = false;


/*
 * Linterna
 */

let torch = false;


/* =========================================
   CONFIGURACIÓN ÓPTICA
========================================= */

const MEASUREMENT = {

    /*
     * Altura de la cámara
     * respecto al suelo.
     */

    cameraHeight: 1.65,


    /*
     * Tamaño conocido del objeto.
     */

    targetWidth: 0.50,

    targetHeight: 0.50,


    /*
     * Rango útil.
     */

    minDistance: 30,

    maxDistance: 100,


    /*
     * FOV vertical inicial
     * de referencia.
     *
     * Se podrá calibrar
     * posteriormente.
     */

    verticalFov:
        50

};


/* =========================================
   MARCAS DE DISTANCIA
========================================= */

const DISTANCES = [

    30,
    35,
    40,
    45,
    50,
    55,
    60,
    65,
    70,
    75,
    80,
    85,
    90,
    95,
    100

];


/* =========================================
   CONFIGURACIÓN DE IMAGEN
========================================= */

const state = {

    brightness: 1.20,

    contrast: 1.35,

    gain: 1.00,

    zoom: 0.8

};


/* =========================================
   CARGAR ESTADO
========================================= */

function loadState() {

    try {

        const saved =
            localStorage.getItem(
                "lonewolf_nvvr_v4"
            );


        if (saved) {

            Object.assign(
                state,
                JSON.parse(saved)
            );

        }

    } catch (error) {

        console.warn(
            "No se pudo cargar configuración:",
            error
        );

    }


    if (
        !Number.isFinite(
            state.zoom
        ) ||
        state.zoom < 0.8
    ) {

        state.zoom = 0.8;

    }


    updateControls();

}


/* =========================================
   GUARDAR ESTADO
========================================= */

function saveState() {

    try {

        localStorage.setItem(
            "lonewolf_nvvr_v4",
            JSON.stringify(state)
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar configuración:",
            error
        );

    }

}


/* =========================================
   ACTUALIZAR CONTROLES
========================================= */

function updateControls() {

    Object.keys(state)
        .forEach(
            key => {

                const control =
                    $(key);

                if (control) {

                    control.value =
                        state[key];

                }

            }
        );


    if ($("brightnessOut")) {

        $("brightnessOut")
            .textContent =
            Number(
                state.brightness
            ).toFixed(2);

    }


    if ($("contrastOut")) {

        $("contrastOut")
            .textContent =
            Number(
                state.contrast
            ).toFixed(2);

    }


    if ($("gainOut")) {

        $("gainOut")
            .textContent =
            Number(
                state.gain
            ).toFixed(2);

    }


    if ($("zoomOut")) {

        $("zoomOut")
            .textContent =
            Number(
                state.zoom
            ).toFixed(1)
            + "×";

    }

}


/* =========================================
   INICIO
========================================= */

loadState();

generarEscala();


/* =========================================
   REDIMENSIONAR
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
            Math.floor(
                window.innerWidth *
                dpr
            )
        );


    canvas.height =
        Math.max(
            360,
            Math.floor(
                window.innerHeight *
                dpr
            )
        );


    generarEscala();

}


window.addEventListener(
    "resize",
    resize
);


window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            resize,
            300
        );

    }
);


/* =========================================
   INICIAR CÁMARA
========================================= */

async function startCamera() {

    try {

        if (
            !window.isSecureContext
        ) {

            throw new Error(
                "La cámara necesita HTTPS o localhost."
            );

        }


        /*
         * Si ya existe una cámara,
         * detenerla primero.
         */

        stopCamera();


        /*
         * SOLO CÁMARA TRASERA.
         */

        stream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            exact:
                                "environment"
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

                    audio: false

                });


        video.srcObject =
            stream;


        await video.play();


        track =
            stream
                .getVideoTracks()[0];


        if ($("startPanel")) {

            $("startPanel")
                .classList
                .add("hidden");

        }


        if ($("status")) {

            $("status")
                .textContent =
                "CÁMARA ACTIVA";

        }


        resize();


        cancelAnimationFrame(
            raf
        );


        lastTime =
            performance.now();


        frames = 0;


        render();


    } catch (error) {

        console.error(
            error
        );


        if ($("status")) {

            $("status")
                .textContent =
                "ERROR CÁMARA";

        }


        alert(
            error.message ||
            "No se pudo acceder a la cámara trasera."
        );

    }

}


/* =========================================
   DETENER CÁMARA
========================================= */

function stopCamera() {

    if (!stream) {

        return;

    }


    stream
        .getTracks()
        .forEach(
            track =>
                track.stop()
        );


    stream = null;

    track = null;

}


/* =========================================
   PROCESAMIENTO PRINCIPAL
========================================= */

function processFrame() {

    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {

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

    const sourceAspect =
        vw / vh;


    const zoom =
        Math.max(
            0.8,
            Number(
                state.zoom
            ) || 0.8
        );


    let sw;

    let sh;


    /*
     * Zoom manteniendo
     * relación de aspecto.
     */

    if (
        sourceAspect >
        aspect
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


    const sx =
        Math.max(
            0,
            (vw - sw) / 2
        );


    const sy =
        Math.max(
            0,
            (vh - sh) / 2
        );


    ctx.clearRect(
        0,
        0,
        w,
        h
    );


    /*
     * VR
     */

    if (vr) {

        drawEye(
            sx,
            sy,
            sw,
            sh,
            0,
            0,
            w / 2,
            h
        );


        drawEye(
            sx,
            sy,
            sw,
            sh,
            0,
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
            0,
            w,
            h
        );

    }

}


/* =========================================
   DIBUJAR OJO
========================================= */

function drawEye(
    sx,
    sy,
    sw,
    sh,
    unused,
    dx,
    dw,
    dh
) {

    /*
     * Canvas temporal.
     */

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
                willReadFrequently:
                    true
            }
        );


    /*
     * Espejo
     */

    if (mirror) {

        t.save();

        t.translate(
            temp.width,
            0
        );

        t.scale(
            -1,
            1
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

        t.restore();

    } else {

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

    }


    /*
     * Datos de imagen.
     */

    const img =
        t.getImageData(
            0,
            0,
            temp.width,
            temp.height
        );


    const data =
        img.data;


    const brightness =
        Number(
            state.brightness
        );


    const gain =
        Number(
            state.gain
        );


    const contrast =
        Number(
            state.contrast
        );


    /*
     * Procesar cada píxel.
     */

    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {

        let y =
            (
                0.2126 *
                data[i]

                +

                0.7152 *
                data[i + 1]

                +

                0.0722 *
                data[i + 2]
            ) / 255;


        /*
         * Contraste.
         */

        y =
            (
                (y - 0.5) *
                contrast
            ) + 0.5;


        /*
         * Brillo y ganancia.
         */

        y *=
            brightness *
            gain;


        /*
         * Limitar.
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
         * Aplicar modo.
         */

        if (
            mode === 0
        ) {

            /*
             * VERDE
             */

            data[i] =
                y * 75;

            data[i + 1] =
                y * 255;

            data[i + 2] =
                y * 95;

        }


        else if (
            mode === 1
        ) {

            /*
             * BLANCO / NEGRO
             */

            const q =
                y * 255;


            data[i] =
                q;

            data[i + 1] =
                q;

            data[i + 2] =
                q;

        }


        else {

            /*
             * MAPA TÉRMICO
             *
             * Pseudocolor.
             */

            const rgb =
                thermalColor(
                    y
                );


            data[i] =
                rgb.r;

            data[i + 1] =
                rgb.g;

            data[i + 2] =
                rgb.b;

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
   MAPA TÉRMICO PSEUDOCOLOR
========================================= */

function thermalColor(
    value
) {

    value =
        Math.max(
            0,
            Math.min(
                1,
                value
            )
        );


    /*
     * Azul → cian → verde
     * → amarillo → rojo → blanco
     */

    let r = 0;

    let g = 0;

    let b = 0;


    if (
        value < 0.20
    ) {

        const t =
            value / 0.20;

        r = 0;

        g =
            Math.floor(
                60 * t
            );

        b =
            Math.floor(
                150 +
                105 * t
            );

    }


    else if (
        value < 0.40
    ) {

        const t =
            (
                value -
                0.20
            ) / 0.20;

        r = 0;

        g =
            Math.floor(
                60 +
                195 * t
            );

        b =
            255 -
            Math.floor(
                180 * t
            );

    }


    else if (
        value < 0.60
    ) {

        const t =
            (
                value -
                0.40
            ) / 0.20;

        r =
            Math.floor(
                255 * t
            );

        g = 255;

        b =
            Math.floor(
                75 *
                (1 - t)
            );

    }


    else if (
        value < 0.80
    ) {

        const t =
            (
                value -
                0.60
            ) / 0.20;

        r = 255;

        g =
            255 -
            Math.floor(
                180 * t
            );

        b = 0;

    }


    else {

        const t =
            (
                value -
                0.80
            ) / 0.20;

        r = 255;

        g =
            Math.floor(
                75 * t
            );

        b =
            Math.floor(
                75 * t
            );

    }


    return {
        r,
        g,
        b
    };

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
        now -
        lastTime >=
        1000
    ) {

        if ($("fps")) {

            $("fps")
                .textContent =
                frames +
                " FPS";

        }


        frames = 0;

        lastTime = now;

    }


    raf =
        requestAnimationFrame(
            render
        );

}


/* =========================================
   ÁNGULOS
========================================= */

function degreesToRadians(
    degrees
) {

    return (
        degrees *
        Math.PI /
        180
    );

}


/* =========================================
   DISTANCIA → ÁNGULO
========================================= */

/*
 * Para la medición tangencial
 * de la BASE del objeto:
 *
 * D = H / tan(theta)
 *
 * H = 1.65 m
 */

function distanceToAngle(
    distance
) {

    return Math.atan(
        MEASUREMENT.cameraHeight /
        distance
    );

}


/* =========================================
   ÁNGULO → DISTANCIA
========================================= */

function angleToDistance(
    angle
) {

    if (
        angle <= 0
    ) {

        return Infinity;

    }


    return (
        MEASUREMENT.cameraHeight /
        Math.tan(angle)
    );

}


/* =========================================
   ÁNGULO DE TAMAÑO DEL OBJETO
========================================= */

/*
 * Ángulo vertical que ocupa
 * un objeto de 50 cm.
 */

function targetAngularSize(
    distance
) {

    return 2 *
        Math.atan(
            (
                MEASUREMENT.targetHeight /
                2
            ) /
            distance
        );

}


/* =========================================
   POSICIÓN DE BASE
========================================= */

/*
 * La línea de base de un objetivo
 * colocado en el suelo.
 *
 * La cámara está a 1.65 m.
 */

function distanceToScreenY(
    distance
) {

    const fov =
        degreesToRadians(
            MEASUREMENT.verticalFov
        );


    const halfFov =
        fov / 2;


    const angle =
        distanceToAngle(
            distance
        );


    /*
     * Proyección aproximada
     * sobre el eje vertical.
     */

    const normalized =
        Math.tan(angle) /
        Math.tan(halfFov);


    /*
     * Centro = 0.5
     * Abajo = valores mayores.
     */

    return (
        0.5 +
        normalized *
        0.5
    );

}


/* =========================================
   ALTURA DEL OBJETO EN PANTALLA
========================================= */

function targetScreenHeight(
    distance
) {

    const fov =
        degreesToRadians(
            MEASUREMENT.verticalFov
        );


    const halfFov =
        fov / 2;


    const angular =
        targetAngularSize(
            distance
        );


    return (
        Math.tan(
            angular
        ) /
        Math.tan(
            halfFov
        )
    );

}


/* =========================================
   GENERAR ESCALA
========================================= */

function generarEscala() {

    const left =
        $("distanceScaleLeft");

    const right =
        $("distanceScaleRight");


    if (
        !left ||
        !right
    ) {

        return;

    }


    left.innerHTML =
        "";

    right.innerHTML =
        "";


    DISTANCES.forEach(
        distance => {

            const y =
                distanceToScreenY(
                    distance
                );


            if (
                y < 0 ||
                y > 1
            ) {

                return;

            }


            createDistanceMark(
                left,
                distance,
                y
            );


            createDistanceMark(
                right,
                distance,
                y
            );

        }
    );

}


/* =========================================
   CREAR MARCA
========================================= */

function createDistanceMark(
    container,
    distance,
    normalizedY
) {

    const mark =
        document.createElement(
            "div"
        );


    mark.className =
        "distance-mark";


    mark.style.top =
        (
            normalizedY *
            100
        ) + "%";


    const major =
        distance %
        10 ===
        0;


    mark.innerHTML = `

        <span
            class="distance-line
            ${major ? "major" : ""}"
        ></span>

        <span
            class="distance-label
            ${major ? "major" : ""}"
        >
            ${distance}
        </span>

    `;


    container.appendChild(
        mark
    );

}


/* =========================================
   MEDICIÓN TANGENCIAL POR TOQUE
========================================= */

/*
 * El usuario puede tocar una posición
 * vertical dentro de la zona de retícula.
 *
 * Esa posición representa la BASE del
 * objeto.
 */

$("reticleHUD")
    .addEventListener(
        "click",
        event => {

            if (!cross) {

                return;

            }


            const y =
                event.clientY /
                window.innerHeight;


            /*
             * Solo tiene sentido medir
             * debajo del horizonte.
             */

            if (
                y <= 0.5
            ) {

                return;

            }


            const fov =
                degreesToRadians(
                    MEASUREMENT.verticalFov
                );


            const normalized =
                (
                    y -
                    0.5
                ) * 2;


            const angle =
                Math.atan(
                    normalized *
                    Math.tan(
                        fov / 2
                    )
                );


            const distance =
                angleToDistance(
                    angle
                );


            if (
                distance <
                MEASUREMENT.minDistance
            ) {

                setDistance(
                    MEASUREMENT.minDistance
                );

                return;

            }


            if (
                distance >
                MEASUREMENT.maxDistance
            ) {

                setDistanceText(
                    ">100 M"
                );

                return;

            }


            setDistance(
                distance
            );

        }
    );


/* =========================================
   MOSTRAR DISTANCIA
========================================= */

function setDistance(
    distance
) {

    if (
        !Number.isFinite(
            distance
        )
    ) {

        return;

    }


    setDistanceText(
        Math.round(
            distance
        ) + " M"
    );

}


/* =========================================
   TEXTO DISTANCIA
========================================= */

function setDistanceText(
    text
) {

    const hud =
        $("distanceHud");


    if (!hud) {

        return;

    }


    hud.textContent =
        "DIST: " +
        text;

}


/* =========================================
   BOTÓN INICIO
========================================= */

if ($("startBtn")) {

    $("startBtn")
        .onclick =
        startCamera;

}


/* =========================================
   MENÚ
========================================= */

if ($("menuBtn")) {

    $("menuBtn")
        .onclick =
        () => {

            $("controls")
                .classList
                .remove(
                    "hidden"
                );

        };

}


/* =========================================
   CERRAR MENÚ
========================================= */

if ($("closeBtn")) {

    $("closeBtn")
        .onclick =
        () => {

            $("controls")
                .classList
                .add(
                    "hidden"
                );

        };

}


/* =========================================
   SLIDERS
========================================= */

[
    "brightness",
    "contrast",
    "gain",
    "zoom"

].forEach(
    id => {

        const control =
            $(id);


        if (!control) {

            return;

        }


        control.oninput =
            () => {

                state[id] =
                    Number(
                        control.value
                    );


                const output =
                    $(
                        id +
                        "Out"
                    );


                if (output) {

                    if (
                        id ===
                        "zoom"
                    ) {

                        output.textContent =
                            state[id]
                                .toFixed(1)
                            +
                            "×";

                    } else {

                        output.textContent =
                            state[id]
                                .toFixed(2);

                    }

                }


                saveState();

            };

    }
);


/* =========================================
   ACCIONES
========================================= */

document
    .querySelectorAll(
        "[data-action]"
    )
    .forEach(
        button => {

            button.onclick =
                async () => {

                    const action =
                        button
                            .dataset
                            .action;


                    /* =========================
                       MODOS
                    ========================= */

                    if (
                        action ===
                        "mode"
                    ) {

                        mode =
                            (
                                mode +
                                1
                            ) % 3;


                        const labels = [

                            "MODO: VERDE",

                            "MODO: B/N",

                            "MODO: TÉRMICO"

                        ];


                        button
                            .textContent =
                            labels[
                                mode
                            ];


                        if (
                            $("modeLabel")
                        ) {

                            $("modeLabel")
                                .textContent =
                                labels[
                                    mode
                                ]
                                .replace(
                                    "MODO: ",
                                    ""
                                );

                        }

                    }


                    /* =========================
                       VR
                    ========================= */

                    if (
                        action ===
                        "vr"
                    ) {

                        vr =
                            !vr;


                        document
                            .body
                            .classList
                            .toggle(
                                "vr-mode",
                                vr
                            );


                        button
                            .textContent =
                            "VR: " +
                            (
                                vr
                                    ? "ON"
                                    : "OFF"
                            );


                        if (
                            $("vrLabel")
                        ) {

                            $("vrLabel")
                                .textContent =
                                "VR " +
                                (
                                    vr
                                        ? "ON"
                                        : "OFF"
                                );

                        }

                    }


                    /* =========================
                       RETÍCULA
                    ========================= */

                    if (
                        action ===
                        "crosshair"
                    ) {

                        cross =
                            !cross;


                        $("reticleHUD")
                            .style
                            .display =
                            cross
                                ? ""
                                : "none";


                        button
                            .textContent =
                            "RETÍCULA: " +
                            (
                                cross
                                    ? "ON"
                                    : "OFF"
                            );

                    }


                    /* =========================
                       ESPEJO
                    ========================= */

                    if (
                        action ===
                        "mirror"
                    ) {

                        mirror =
                            !mirror;


                        button
                            .textContent =
                            "ESPEJO: " +
                            (
                                mirror
                                    ? "ON"
                                    : "OFF"
                            );

                    }


                    /* =========================
                       PANTALLA COMPLETA
                    ========================= */

                    if (
                        action ===
                        "fullscreen"
                    ) {

                        try {

                            if (
                                document
                                    .fullscreenElement
                            ) {

                                await document
                                    .exitFullscreen();

                            } else {

                                await document
                                    .documentElement
                                    .requestFullscreen();

                            }

                        } catch (
                            error
                        ) {

                            console.warn(
                                "Fullscreen:",
                                error
                            );

                        }

                    }


                    /* =========================
                       LINTERNA
                    ========================= */

                    if (
                        action ===
                        "torch"
                    ) {

                        if (!track) {

                            alert(
                                "La cámara no está activa."
                            );

                            return;

                        }


                        try {

                            const capabilities =
                                track
                                    .getCapabilities?.();


                            if (
                                capabilities &&
                                capabilities.torch
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


                                button
                                    .textContent =
                                    "LINTERNA: " +
                                    (
                                        torch
                                            ? "ON"
                                            : "OFF"
                                    );

                            } else {

                                alert(
                                    "Este iPhone/navegador no expone control de linterna mediante la cámara web."
                                );

                            }

                        } catch (
                            error
                        ) {

                            console.warn(
                                "Linterna:",
                                error
                            );

                        }

                    }

                };

        }
    );


/* =========================================
   RESTABLECER
========================================= */

if ($("resetBtn")) {

    $("resetBtn")
        .onclick =
        () => {

            state.brightness =
                1.20;

            state.contrast =
                1.35;

            state.gain =
                1.00;

            state.zoom =
                0.8;


            saveState();

            updateControls();

        };

}


/* =========================================
   DOBLE TOQUE
========================================= */

document.addEventListener(
    "dblclick",
    async () => {

        try {

            if (
                !document
                    .fullscreenElement
            ) {

                await document
                    .documentElement
                    .requestFullscreen();

            }

        } catch (
            error
        ) {

            console.warn(
                "Fullscreen:",
                error
            );

        }

    }
);


/* =========================================
   DETENER CÁMARA
========================================= */

window.addEventListener(
    "pagehide",
    stopCamera
);