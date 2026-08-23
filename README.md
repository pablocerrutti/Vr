# NightVision VR

Visor nocturno digital para teléfono + VR Box. Proyecto web/PWA sin backend.

## Importante: cámara y HTTPS

Los navegadores modernos no permiten `getUserMedia()` desde una página `file://`.
Para probarlo debes servir esta carpeta mediante HTTPS o localhost.

### Prueba rápida en PC
Con Python:
```bash
python -m http.server 8080
```
Luego abre `http://localhost:8080`.

Para usarlo desde el teléfono, lo recomendable es publicarlo en GitHub Pages, Netlify u otro hosting HTTPS. Una vez cargado, el Service Worker guarda los archivos para uso posterior sin conexión.

## Uso
1. Abre la aplicación.
2. Autoriza la cámara.
3. Gira el teléfono a horizontal.
4. Activa VR desde CONTROLES.
5. Coloca el teléfono en el VR Box.
6. Ajusta brillo, contraste, ganancia y zoom.
7. Para salir, toca la pantalla/controles o usa el botón del navegador.

## Modos
- Verde
- Blanco y negro
- Rojo
- Inverso

## Limitaciones
El procesamiento digital puede mejorar la visibilidad con poca luz, pero no convierte una cámara normal en un sensor de visión nocturna infrarroja. En oscuridad total hace falta una fuente de iluminación o una cámara/sensor sensible a IR.

El control de linterna solo aparece si el navegador y el hardware exponen la capacidad `torch`.

## Próximas mejoras posibles
- Procesamiento WebGL para mayor FPS.
- Filtro de reducción de ruido temporal.
- Auto-gain.
- Histograma.
- Control de enfoque si el navegador lo permite.
- Corrección de distorsión del VR Box.
- Ajuste de distancia interpupilar.
- Retícula configurable.
- Grabación local de vídeo.
