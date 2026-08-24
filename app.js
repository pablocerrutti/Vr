/* =========================================
   NIGHT VISION
   Aplicación de cámara offline
========================================= */


/* =========================================
   ELEMENTOS
========================================= */

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


/* =========================================
   VARIABLES
========================================= */

let stream = null;

let cameraFacing = "environment";

let nightVisionEnabled = true;

let reticleEnabled = false;

let animationFrame = null;


/* =========================================
   INICIAR
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        iniciarAplicacion();

    }
);


/* =========================================
   APLICACIÓN
========================================= */

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
                300
            );

        }
    );


    await iniciarCamara();

}


/* =========================================
   CANVAS
========================================= */

function ajustarCanvas() {

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        Math.floor(
            window.innerWidth * dpr
        );

    canvas.height =
        Math.floor(
            window.innerHeight * dpr
        );

}


/* =========================================
   CÁMARA
========================================= */

async function iniciarCamara() {

    detenerCamara();

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            throw new Error(
                "La cámara no está disponible."
            );

        }


        stream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            ideal:
                                cameraFacing
                        },

                        width: {
                            ideal: 1920
                        },

                        height: {
                            ideal: 1080
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


        cameraStatus.textContent =
            "CAM OK";

        loading.classList.add(
            "hidden"
        );


        comenzarProcesamiento();


    } catch (error) {

        console.error(error);

        cameraStatus.textContent =
            "SIN CÁMARA";

        loading.querySelector(
            ".loading-text"
        ).textContent =
            "Permite el acceso a la cámara";

    }

}


/* =========================================
   DETENER CÁMARA
========================================= */

function detenerCamara() {

    if (!stream) {
        return;
    }

    stream.getTracks().forEach(
        track => track.stop()
    );

    stream = null;

}


/* =========================================
   PROCESAMIENTO
========================================= */

function comenzarProcesamiento() {

    if (animationFrame) {

        cancelAnimationFrame(
            animationFrame
        );

    }

    procesarImagen();

}


/* =========================================
   VISIÓN NOCTURNA
========================================= */

function procesarImagen() {

    if (
        video.readyState >= 2 &&
        canvas.width > 0 &&
        canvas.height > 0
    ) {

        const videoRatio =
            video.videoWidth /
            video.videoHeight;

        const canvasRatio =
            canvas.width /
            canvas.height;


        let drawWidth =
            canvas.width;

        let drawHeight =
            canvas.height;

        let offsetX = 0;

        let offsetY = 0;


        /*
         * Mantener proporción tipo
         * object-fit: cover.
         */

        if (videoRatio > canvasRatio) {

            drawHeight =
                canvas.height;

            drawWidth =
                drawHeight *
                videoRatio;

            offsetX =
                (canvas.width -
                 drawWidth) / 2;

        } else {

            drawWidth =
                canvas.width;

            drawHeight =
                drawWidth /
                videoRatio;

            offsetY =
                (canvas.height -
                 drawHeight) / 2;

        }


        ctx.drawImage(
            video,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
        );


        if (nightVisionEnabled) {

            aplicarVisionNocturna();

        }

    }


    animationFrame =
        requestAnimationFrame(
            procesarImagen
        );

}


/* =========================================
   EFECTO VISIÓN NOCTURNA
========================================= */

function aplicarVisionNocturna() {

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

        const r = data[i];

        const g = data[i + 1];

        const b = data[i + 2];


        /*
         * Luminancia.
         */

        const luminance =
            0.299 * r +
            0.587 * g +
            0.114 * b;


        /*
         * Amplificación de sombras.
         */

        let value =
            (luminance - 20) *
            1.45;

        value =
            Math.max(
                0,
                Math.min(
                    255,
                    value
                )
            );


        /*
         * Tonalidad verde tipo
         * visión nocturna digital.
         */

        data[i] =
            value * 0.12;

        data[i + 1] =
            value * 1.00;

        data[i + 2] =
            value * 0.18;

    }


    ctx.putImageData(
        image,
        0,
        0
    );

}


/* =========================================
   BOTÓN CÁMARA
========================================= */

cameraButton.addEventListener(
    "click",
    async () => {

        if (stream) {

            detenerCamara();

            cameraStatus.textContent =
                "PAUSADA";

            loading.classList.remove(
                "hidden"
            );

            loading.querySelector(
                ".loading-text"
            ).textContent =
                "Cámara detenida";

        } else {

            loading.classList.remove(
                "hidden"
            );

            loading.querySelector(
                ".loading-text"
            ).textContent =
                "Iniciando cámara...";

            await iniciarCamara();

        }

    }
);


/* =========================================
   VISIÓN NOCTURNA
========================================= */

nightButton.addEventListener(
    "click",
    () => {

        nightVisionEnabled =
            !nightVisionEnabled;

        nightButton.classList.toggle(
            "active",
            nightVisionEnabled
        );

    }
);


/* =========================================
   RETÍCULA
========================================= */

reticleButton.addEventListener(
    "click",
    () => {

        reticleEnabled =
            !reticleEnabled;

        reticle.classList.toggle(
            "hidden",
            !reticleEnabled
        );

        reticleButton.classList.toggle(
            "active",
            reticleEnabled
        );

    }
);


/* =========================================
   CAMBIAR CÁMARA
========================================= */

switchButton.addEventListener(
    "click",
    async () => {

        cameraFacing =
            cameraFacing ===
            "environment"

                ? "user"

                : "environment";


        loading.classList.remove(
            "hidden"
        );

        loading.querySelector(
            ".loading-text"
        ).textContent =
            "Cambiando cámara...";


        await iniciarCamara();

    }
);


/* =========================================
   LIMPIEZA
========================================= */

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