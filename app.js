/* =========================================
   NIGHT VISION
   Aplicación de cámara offline
   V1.1.0
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


const distanceScale =
    document.getElementById(
        "distanceScale"
    );


const distanceHud =
    document.getElementById(
        "distanceHud"
    );


const distanceInstruction =
    document.getElementById(
        "distanceInstruction"
    );


/* =========================================
   CONFIGURACIÓN
========================================= */

const DISTANCE_CONFIG = {

    /*
     * Altura de la cámara respecto
     * al suelo.
     */
    cameraHeight: 1.65,


    /*
     * Altura de referencia corporal.
     */
    targetHeight: 1.70,


    /*
     * Anchura de referencia corporal.
     */
    targetWidth: 0.45,


    /*
     * Distancia máxima de la escala.
     */
    maxDistance: 100,


    /*
     * FOV VERTICAL INICIAL.
     *
     * Es un valor de calibración.
     *
     * Se podrá ajustar posteriormente
     * con pruebas reales.
     */

    verticalFovPortrait: 50,

    verticalFovLandscape: 37

};


/*
 * Distancias que aparecerán
 * en la retícula.
 */

const DISTANCE_MARKS = [

    10,
    15,
    20,
    25,
    30,
    40,
    50,
    60,
    80,
    100

];


/* =========================================
   VARIABLES
========================================= */

let stream = null;

let cameraFacing =
    "environment";

let nightVisionEnabled =
    true;

let reticleEnabled =
    false;

let animationFrame =
    null;


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

    generarEscalaDistancia();

    window.addEventListener(
        "resize",
        () => {

            ajustarCanvas();

            if (reticleEnabled) {

                generarEscalaDistancia();

            }

        }
    );


    window.addEventListener(
        "orientationchange",
        () => {

            setTimeout(
                () => {

                    ajustarCanvas();

                    if (reticleEnabled) {

                        generarEscalaDistancia();

                    }

                },
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

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "La cámara no está disponible."
            );

        }


        stream =
            await navigator
                .mediaDevices
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


        loading
            .querySelector(
                ".loading-text"
            )
            .textContent =
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


    stream
        .getTracks()
        .forEach(
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
         * Mantener proporción
         * object-fit: cover.
         */

        if (
            videoRatio >
            canvasRatio
        ) {

            drawHeight =
                canvas.height;


            drawWidth =
                drawHeight *
                videoRatio;


            offsetX =
                (
                    canvas.width -
                    drawWidth
                ) / 2;


        } else {

            drawWidth =
                canvas.width;


            drawHeight =
                drawWidth /
                videoRatio;


            offsetY =
                (
                    canvas.height -
                    drawHeight
                ) / 2;

        }


        ctx.drawImage(
            video,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
        );


        if (
            nightVisionEnabled
        ) {

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

        const r =
            data[i];


        const g =
            data[i + 1];


        const b =
            data[i + 2];


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
            (
                luminance -
                20
            ) * 1.45;


        value =
            Math.max(
                0,
                Math.min(
                    255,
                    value
                )
            );


        /*
         * Tonalidad verde.
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
   FOV VERTICAL
========================================= */

function obtenerFovVertical() {

    if (
        window.innerWidth >
        window.innerHeight
    ) {

        return DISTANCE_CONFIG
            .verticalFovLandscape;

    }


    return DISTANCE_CONFIG
        .verticalFovPortrait;

}


/* =========================================
   CONVERSIÓN DE ÁNGULOS
========================================= */

function gradosARadianes(
    grados
) {

    return (
        grados *
        Math.PI /
        180
    );

}


/* =========================================
   DISTANCIA → ÁNGULO
========================================= */

function calcularAnguloParaDistancia(
    distancia
) {

    return Math.atan(
        DISTANCE_CONFIG.cameraHeight /
        distancia
    );

}


/* =========================================
   ÁNGULO → DISTANCIA
========================================= */

function calcularDistanciaDesdeAngulo(
    angulo
) {

    if (
        angulo <= 0
    ) {

        return Infinity;

    }


    return (
        DISTANCE_CONFIG.cameraHeight /
        Math.tan(angulo)
    );

}


/* =========================================
   POSICIÓN DE LA MARCA
========================================= */

/*
 * Devuelve la posición vertical
 * de una distancia dentro de la
 * retícula.
 *
 * 0.5 = centro óptico.
 *
 * La base de un objeto sobre el suelo
 * aparece por debajo del centro porque
 * la cámara está a 1.65 m.
 */

function obtenerPosicionMarca(
    distancia
) {

    const fov =
        gradosARadianes(
            obtenerFovVertical()
        );


    const medioFov =
        fov / 2;


    const angulo =
        calcularAnguloParaDistancia(
            distancia
        );


    /*
     * Relación angular respecto
     * al centro de la imagen.
     */

    const proporcion =
        Math.tan(angulo) /
        Math.tan(medioFov);


    /*
     * Convertir a porcentaje.
     *
     * 0.5 = centro.
     *
     * 1.0 = parte inferior.
     */

    const posicion =
        0.5 +
        proporcion * 0.5;


    return posicion;

}


/* =========================================
   ESCALA DE DISTANCIA
========================================= */

function generarEscalaDistancia() {

    if (!distanceScale) {

        return;

    }


    distanceScale.innerHTML =
        "";


    DISTANCE_MARKS.forEach(
        distancia => {

            const posicion =
                obtenerPosicionMarca(
                    distancia
                );


            /*
             * Si la marca queda fuera
             * de la pantalla, no se dibuja.
             */

            if (
                posicion < 0 ||
                posicion > 1
            ) {

                return;

            }


            const mark =
                document.createElement(
                    "div"
                );


            mark.className =
                "distance-mark";


            mark.dataset.distance =
                distancia;


            mark.style.top =
                `${posicion * 100}%`;


            /*
             * Marcas mayores cada
             * 10 metros.
             */

            const esMayor =
                distancia % 10 === 0;


            mark.innerHTML = `

                <span
                    class="distance-line
                    ${esMayor
                        ? "major"
                        : ""}"
                ></span>

                <span
                    class="distance-label
                    ${esMayor
                        ? "major"
                        : ""}"
                >
                    ${distancia}
                </span>

            `;


            distanceScale.appendChild(
                mark
            );

        }
    );

}


/* =========================================
   ACTUALIZAR HUD
========================================= */

function actualizarHudDistancia(
    distancia
) {

    if (!distanceHud) {

        return;

    }


    if (
        !isFinite(distancia)
    ) {

        distanceHud.textContent =
            "DIST: -- m";

        return;

    }


    if (
        distancia >
        DISTANCE_CONFIG.maxDistance
    ) {

        distanceHud.textContent =
            "DIST: >100 m";

        return;

    }


    distanceHud.textContent =
        `DIST: ${Math.round(distancia)} m`;

}


/* =========================================
   CÁLCULO DESDE POSICIÓN
========================================= */

/*
 * Esta función convierte la posición
 * vertical de un punto seleccionado
 * en distancia.
 *
 * Actualmente la escala funciona
 * visualmente sin necesidad de tocar
 * la pantalla.
 */

function calcularDistanciaPorPosicion(
    posicionNormalizada
) {

    /*
     * Distancia respecto al centro
     * óptico.
     */

    const diferencia =
        posicionNormalizada -
        0.5;


    if (
        diferencia <= 0
    ) {

        return Infinity;

    }


    const fov =
        gradosARadianes(
            obtenerFovVertical()
        );


    const medioFov =
        fov / 2;


    /*
     * Ángulo hacia abajo.
     */

    const tangente =
        (
            diferencia * 2
        ) *
        Math.tan(
            medioFov
        );


    const angulo =
        Math.atan(
            tangente
        );


    return calcularDistanciaDesdeAngulo(
        angulo
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


            loading
                .querySelector(
                    ".loading-text"
                )
                .textContent =
                "Cámara detenida";


        } else {

            loading.classList.remove(
                "hidden"
            );


            loading
                .querySelector(
                    ".loading-text"
                )
                .textContent =
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


        if (
            reticleEnabled
        ) {

            generarEscalaDistancia();


            distanceHud.textContent =
                "DIST: -- m";


            distanceInstruction
                .textContent =
                "BASE DEL OBJETO";

        }

    }
);


/* =========================================
   INTERACCIÓN CON LA RETÍCULA
========================================= */

/*
 * Al tocar la pantalla sobre la retícula,
 * se puede seleccionar la posición de la
 * base del objeto.
 *
 * Esto permite que el cálculo sea real:
 *
 * cámara = 1.65 m
 * ↓
 * ángulo hacia la base
 * ↓
 * distancia.
 */

reticle.addEventListener(
    "click",
    event => {

        if (!reticleEnabled) {

            return;

        }


        const rect =
            reticle.getBoundingClientRect();


        const y =
            event.clientY -
            rect.top;


        const posicion =
            y /
            rect.height;


        const distancia =
            calcularDistanciaPorPosicion(
                posicion
            );


        actualizarHudDistancia(
            distancia
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


        loading
            .querySelector(
                ".loading-text"
            )
            .textContent =
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