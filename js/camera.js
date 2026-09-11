class CameraController {
  constructor() {
    this.videos = document.querySelectorAll('.camera-stream');
    this.stream = null;
    this.initialZoom = 0.9;
  }

  async init() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    this.videos.forEach(video => {
      video.srcObject = this.stream;
      video.play().catch(() => {});
    });

    await this.applyHardwareEnhancements();
  }

  async applyHardwareEnhancements() {
    if (!this.stream) return;

    const track = this.stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const advanced = {};

    if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
      advanced.exposureMode = 'continuous';
    }

    // Zoom 0.9x cuando el navegador expone el control óptico/digital.
    // Si el teléfono no permite valores inferiores a 1, se deja la cámara en su mínimo.
    if (capabilities.zoom) {
      const minZoom = Number.isFinite(capabilities.zoom.min) ? capabilities.zoom.min : 1;
      const maxZoom = Number.isFinite(capabilities.zoom.max) ? capabilities.zoom.max : 1;
      if (maxZoom > 0) {
        advanced.zoom = Math.max(minZoom, Math.min(maxZoom, this.initialZoom));
      }
    }

    if (Object.keys(advanced).length > 0) {
      try {
        await track.applyConstraints({ advanced: [advanced] });
      } catch (e) {
        // Algunos navegadores exponen las capacidades pero rechazan zoom/exposición.
        try {
          delete advanced.zoom;
          if (Object.keys(advanced).length) {
            await track.applyConstraints({ advanced: [advanced] });
          }
        } catch (_) {}
      }
    }
  }
}
