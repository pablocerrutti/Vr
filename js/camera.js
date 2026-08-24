class CameraController {
  constructor() {
    this.videos = document.querySelectorAll('.camera-stream');
    this.stream = null;
  }

  async init() {
    const constraints = {
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      // Fallback a cualquier cámara disponible si falla 'environment'
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    this.videos.forEach(video => {
      video.srcObject = this.stream;
    });

    this.applyHardwareEnhancements();
  }

  applyHardwareEnhancements() {
    const track = this.stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    // Forzar exposición o antorcha si el dispositivo lo soporta
    let constraintsToApply = {};
    if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
      constraintsToApply.exposureMode = 'continuous';
    }
    
    if (Object.keys(constraintsToApply).length > 0) {
      track.applyConstraints({ advanced: [constraintsToApply] }).catch(() => {});
    }
  }
}
