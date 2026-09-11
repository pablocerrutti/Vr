class CameraController {
  constructor() {
    this.videos = document.querySelectorAll('.camera-stream');
    this.stream = null;
    this.fixedZoom = 0.9;
  }

  async init() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 3840, min: 1280 },
        height: { ideal: 2160, min: 720 },
        frameRate: { ideal: 30, min: 15 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch (_) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    }

    this.videos.forEach(video => {
      video.srcObject = this.stream;
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.play().catch(() => {});
    });

    await this.maximizeCameraQuality();
    await this.applyFixedCameraSettings();
  }

  async maximizeCameraQuality() {
    if (!this.stream) return;

    const track = this.stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    if (capabilities.width && capabilities.height) {
      const maxWidth = Number(capabilities.width.max);
      const maxHeight = Number(capabilities.height.max);

      if (Number.isFinite(maxWidth) && Number.isFinite(maxHeight)) {
        try {
          await track.applyConstraints({
            width: { ideal: maxWidth },
            height: { ideal: maxHeight }
          });
        } catch (_) {}
      }
    }

    const current = track.getSettings ? track.getSettings() : {};
    if (Number(current.width || 0) < 1920 || Number(current.height || 0) < 1080) {
      try {
        await track.applyConstraints({
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      } catch (_) {}
    }
  }

  async applyFixedCameraSettings() {
    if (!this.stream) return;

    const track = this.stream.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const advanced = {};

    if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
      advanced.exposureMode = 'continuous';
    }

    // Zoom fijo 0.9x. No habrá control de zoom durante el uso.
    if (capabilities.zoom) {
      const minZoom = Number.isFinite(Number(capabilities.zoom.min)) ? Number(capabilities.zoom.min) : 1;
      const maxZoom = Number.isFinite(Number(capabilities.zoom.max)) ? Number(capabilities.zoom.max) : 1;
      advanced.zoom = Math.max(minZoom, Math.min(maxZoom, this.fixedZoom));
    }

    if (Object.keys(advanced).length) {
      try {
        await track.applyConstraints({ advanced: [advanced] });
      } catch (_) {
        if (Object.prototype.hasOwnProperty.call(advanced, 'zoom')) {
          try {
            await track.applyConstraints({ zoom: advanced.zoom });
          } catch (__) {}
        }
      }
    }

    try {
      console.info('[VR] Cámara:', track.getSettings ? track.getSettings() : {});
    } catch (_) {}
  }
}
