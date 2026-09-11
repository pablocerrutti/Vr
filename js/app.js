document.addEventListener('DOMContentLoaded', async () => {
  const camera = new CameraController();
  const reticle = new ReticleController();

  const modes = ['filter-green', 'filter-thermal', 'filter-bw'];
  const modeNames = ['VERDE FÓSFORO', 'TÉRMICO PSEUDO', 'BLANCO/NEGRO'];
  let currentModeIdx = 0;

  const sensorStatus = document.getElementById('sensor-status');

  function setSensorStatus(text) {
    if (sensorStatus) sensorStatus.textContent = `SENSORES: ${text}`;
  }

  async function requestMotionPermission() {
    try {
      // iOS exige que la solicitud se realice desde una acción del usuario.
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          setSensorStatus('PERMISO DENEGADO');
          return false;
        }
      }

      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      setSensorStatus('ACTIVOS');
      return true;
    } catch (e) {
      setSensorStatus('NO DISPONIBLES');
      return false;
    }
  }

  function handleOrientation(event) {
    if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
      window.__webkitCompassHeading = event.webkitCompassHeading;
    }
    reticle.setOrientation(event.alpha, event.beta, event.gamma, event.absolute);
  }

  try {
    await camera.init();
  } catch (e) {
    setSensorStatus('CÁMARA NO DISPONIBLE');
  }

  const applyMode = () => {
    document.body.className = modes[currentModeIdx];
    document.querySelectorAll('.mode-val').forEach(el => el.textContent = modeNames[currentModeIdx]);
  };

  // Renderizado continuo de retícula, horizonte y brújula.
  const loop = () => {
    reticle.draw();
    requestAnimationFrame(loop);
  };
  loop();

  document.getElementById('btn-sensors').addEventListener('click', requestMotionPermission);

  document.getElementById('btn-mode').addEventListener('click', () => {
    currentModeIdx = (currentModeIdx + 1) % modes.length;
    applyMode();
  });

  document.getElementById('btn-horizon').addEventListener('click', () => {
    reticle.horizonEnabled = !reticle.horizonEnabled;
    document.getElementById('btn-horizon').textContent = reticle.horizonEnabled
      ? 'Horizonte ON'
      : 'Horizonte OFF';
  });

  // Cualquier primer toque también intenta habilitar los sensores en dispositivos compatibles.
  window.addEventListener('touchstart', () => {
    if (!reticle.sensorReady) requestMotionPermission();
  }, { once: true, passive: true });

  // Atajos con mando Bluetooth / teclado externo.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'h') {
      reticle.horizonEnabled = !reticle.horizonEnabled;
    } else if (e.key === ' ' || e.key.toLowerCase() === 'f') {
      currentModeIdx = (currentModeIdx + 1) % modes.length;
      applyMode();
    } else if (e.key.toLowerCase() === 's') {
      requestMotionPermission();
    }
  });

  // Aviso de orientación del dispositivo.
  const orientationWarning = document.getElementById('orientation-warning');
  const updateOrientationWarning = () => {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    orientationWarning.style.display = landscape ? 'none' : 'flex';
  };
  window.addEventListener('resize', updateOrientationWarning);
  window.addEventListener('orientationchange', updateOrientationWarning);
  updateOrientationWarning();

  applyMode();
});
