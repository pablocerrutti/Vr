document.addEventListener('DOMContentLoaded', async () => {
  const camera = new CameraController();
  const reticle = new ReticleController();
  const body = document.body;
  const normalView = document.getElementById('normal-view');
  const vrView = document.getElementById('vr-view');
  const menuToggle = document.getElementById('menu-toggle');
  const menuPanel = document.getElementById('menu-panel');
  const sensorStatus = document.getElementById('sensor-status');
  const permissionStatus = document.getElementById('permission-status');
  let vrMode = false;
  let gpsWatchId = null;
  let orientationListening = false;
  let cameraReady = false;
  let sensorsReady = false;

  const status = text => { if (sensorStatus) sensorStatus.textContent = `SENSORES: ${text}`; };
  const permissionText = text => { if (permissionStatus) permissionStatus.textContent = text; };

  function startGPS() {
    if (!('geolocation' in navigator)) {
      status('BRÚJULA ACTIVA / GPS NO DISPONIBLE');
      return false;
    }
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = navigator.geolocation.watchPosition(position => {
      const c = position.coords;
      reticle.setGPS(c.accuracy, c.speed, c.heading);
      const acc = Number.isFinite(c.accuracy) ? ` ±${Math.round(c.accuracy)}M` : '';
      status(`BRÚJULA ACTIVA / GPS OK${acc}`);
    }, () => status('BRÚJULA ACTIVA / GPS SIN SEÑAL'), { enableHighAccuracy:true, maximumAge:1000, timeout:10000 });
    return true;
  }

  function handleOrientation(event) {
    reticle.setOrientation(event.alpha, event.beta, event.gamma, event.absolute, event.webkitCompassHeading);
  }

  async function requestMotionPermission() {
    let compassGranted = true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        compassGranted = result === 'granted';
      }
    } catch (_) {
      compassGranted = false;
    }

    if (compassGranted && !orientationListening) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      orientationListening = true;
      reticle.sensorReady = true;
    }

    const gps = startGPS();
    sensorsReady = compassGranted || gps;
    if (compassGranted && gps) status('BRÚJULA + GPS ACTIVOS');
    else if (compassGranted) status('BRÚJULA ACTIVA / GPS NO DISPONIBLE');
    else if (gps) status('GPS ACTIVO / BRÚJULA DENEGADA');
    else status('PERMISOS NO CONCEDIDOS');
    return sensorsReady;
  }

  async function requestCamera() {
    try {
      await camera.init();
      cameraReady = !!camera.stream;
      if (cameraReady) {
        const normalVideo = document.getElementById('video-normal');
        const vrVideos = document.querySelectorAll('#vr-view .camera-stream');
        normalVideo.srcObject = camera.stream;
        vrVideos.forEach(v => v.srcObject = camera.stream);
        normalVideo.play().catch(() => {});
        vrVideos.forEach(v => v.play().catch(() => {}));
      }
      return cameraReady;
    } catch (_) {
      cameraReady = false;
      status('CÁMARA NO DISPONIBLE');
      return false;
    }
  }

  async function requestAllPermissions() {
    permissionText('SOLICITANDO CÁMARA...');
    await requestCamera();
    permissionText('SOLICITANDO BRÚJULA Y MOVIMIENTO...');
    await requestMotionPermission();
    permissionText(cameraReady && sensorsReady ? 'CÁMARA + BRÚJULA + GPS ACTIVOS' : 'REVISAR PERMISOS EN EL NAVEGADOR');
  }

  function applyImageControls() {
    const b = Number(document.getElementById('brightness').value);
    const c = Number(document.getElementById('contrast').value);
    const g = Number(document.getElementById('gain').value);
    const f = document.getElementById('filter-select').value;
    document.getElementById('brightness-value').textContent = `${b}%`;
    document.getElementById('contrast-value').textContent = `${c}%`;
    document.getElementById('gain-value').textContent = `${g}%`;
    body.dataset.filter = f;
    document.querySelectorAll('.camera-stream').forEach(video => {
      video.style.setProperty('--brightness', `${b * g / 100}%`);
      video.style.setProperty('--contrast', `${c}%`);
      video.style.setProperty('--saturation', '100%');
    });
  }

  function enterVR() {
    vrMode = true;
    normalView.hidden = true;
    vrView.hidden = false;
    body.classList.remove('mode-normal');
    body.classList.add('mode-vr');
    document.getElementById('btn-vr').textContent = 'SALIR DE VR';
    menuPanel.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    requestAnimationFrame(() => reticle.draw());
  }

  function exitVR() {
    vrMode = false;
    vrView.hidden = true;
    normalView.hidden = false;
    body.classList.remove('mode-vr');
    body.classList.add('mode-normal');
    document.getElementById('btn-vr').textContent = 'ENTRAR EN VR';
    requestAnimationFrame(() => reticle.draw());
  }

  document.querySelectorAll('#brightness,#contrast,#gain,#filter-select').forEach(el => {
    el.addEventListener('input', applyImageControls);
    el.addEventListener('change', applyImageControls);
  });

  menuToggle.addEventListener('click', () => {
    const open = menuPanel.hidden;
    menuPanel.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('btn-vr').addEventListener('click', () => vrMode ? exitVR() : enterVR());
  document.getElementById('btn-sensors').addEventListener('click', requestMotionPermission);
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('brightness').value = 260;
    document.getElementById('contrast').value = 200;
    document.getElementById('gain').value = 120;
    document.getElementById('filter-select').value = 'normal';
    applyImageControls();
  });

  const updateLandscape = () => {
    const landscape = window.innerWidth > window.innerHeight;
    document.getElementById('orientation-warning').style.display = landscape ? 'none' : 'flex';
    requestAnimationFrame(() => reticle.draw());
  };
  window.addEventListener('resize', updateLandscape);
  window.addEventListener('orientationchange', () => setTimeout(updateLandscape, 120));
  if (screen.orientation) screen.orientation.addEventListener('change', () => setTimeout(updateLandscape, 120));

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'v') vrMode ? exitVR() : enterVR();
    if (k === 'm') menuToggle.click();
  });

  applyImageControls();
  updateLandscape();
  const loop = () => { reticle.draw(); requestAnimationFrame(loop); };
  loop();
  await requestAllPermissions();
});