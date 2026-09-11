document.addEventListener('DOMContentLoaded', async () => {
  const camera = new CameraController();
  const reticle = new ReticleController();
  const body = document.body;
  const normalView = document.getElementById('normal-view');
  const vrView = document.getElementById('vr-view');
  const menuToggle = document.getElementById('menu-toggle');
  const menuPanel = document.getElementById('menu-panel');
  const sensorStatus = document.getElementById('sensor-status');
  let vrMode = false;

  const filterNames = {
    normal: 'NORMAL', green: 'VERDE FÓSFORO', thermal: 'TÉRMICO PSEUDO', bw: 'BLANCO/NEGRO'
  };

  const setSensorStatus = text => {
    if (sensorStatus) sensorStatus.textContent = `SENSORES: ${text}`;
  };

  async function requestMotionPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') { setSensorStatus('PERMISO DENEGADO'); return false; }
      }
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      setSensorStatus('ACTIVOS');
      return true;
    } catch (_) { setSensorStatus('NO DISPONIBLES'); return false; }
  }

  function handleOrientation(event) {
    if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
      window.__webkitCompassHeading = event.webkitCompassHeading;
    }
    reticle.setOrientation(event.alpha, event.beta, event.gamma, event.absolute);
  }

  function applyImageControls() {
    const brightness = Number(document.getElementById('brightness').value);
    const contrast = Number(document.getElementById('contrast').value);
    const gain = Number(document.getElementById('gain').value);
    const saturation = Number(document.getElementById('saturation').value);
    const filter = document.getElementById('filter-select').value;

    document.getElementById('brightness-value').textContent = `${brightness}%`;
    document.getElementById('contrast-value').textContent = `${contrast}%`;
    document.getElementById('gain-value').textContent = `${gain}%`;
    document.getElementById('saturation-value').textContent = `${saturation}%`;

    body.dataset.filter = filter;
    document.querySelectorAll('.mode-val').forEach(el => el.textContent = filterNames[filter]);

    document.querySelectorAll('.camera-stream').forEach(video => {
      video.style.setProperty('--brightness', `${brightness * gain / 100}%`);
      video.style.setProperty('--contrast', `${contrast}%`);
      video.style.setProperty('--saturation', `${saturation}%`);
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
  }

  function exitVR() {
    vrMode = false;
    vrView.hidden = true;
    normalView.hidden = false;
    body.classList.remove('mode-vr');
    body.classList.add('mode-normal');
    document.getElementById('btn-vr').textContent = 'ENTRAR EN VR';
  }

  try {
    await camera.init();
  } catch (_) {
    setSensorStatus('CÁMARA NO DISPONIBLE');
  }

  // El mismo stream se muestra en la vista normal y en los dos ojos VR.
  const normalVideo = document.getElementById('video-normal');
  const vrVideos = document.querySelectorAll('#vr-view .camera-stream');
  if (camera.stream) {
    normalVideo.srcObject = camera.stream;
    vrVideos.forEach(video => video.srcObject = camera.stream);
    normalVideo.play().catch(() => {});
    vrVideos.forEach(video => video.play().catch(() => {}));
  }

  document.querySelectorAll('#brightness,#contrast,#gain,#saturation,#filter-select').forEach(el => {
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
  document.getElementById('btn-horizon').addEventListener('click', () => {
    reticle.horizonEnabled = !reticle.horizonEnabled;
    document.getElementById('btn-horizon').textContent = reticle.horizonEnabled ? 'HORIZONTE ON' : 'HORIZONTE OFF';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('brightness').value = 220;
    document.getElementById('contrast').value = 180;
    document.getElementById('gain').value = 100;
    document.getElementById('saturation').value = 100;
    document.getElementById('filter-select').value = 'normal';
    reticle.horizonEnabled = true;
    document.getElementById('btn-horizon').textContent = 'HORIZONTE ON';
    applyImageControls();
  });

  const loop = () => { reticle.draw(); requestAnimationFrame(loop); };
  loop();

  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'v') vrMode ? exitVR() : enterVR();
    if (e.key.toLowerCase() === 'm') menuPanel.hidden = !menuPanel.hidden;
    if (e.key.toLowerCase() === 'h') reticle.horizonEnabled = !reticle.horizonEnabled;
  });

  const orientationWarning = document.getElementById('orientation-warning');
  const updateOrientationWarning = () => {
    orientationWarning.style.display = window.matchMedia('(orientation: landscape)').matches ? 'none' : 'flex';
  };
  window.addEventListener('resize', updateOrientationWarning);
  window.addEventListener('orientationchange', updateOrientationWarning);
  updateOrientationWarning();

  applyImageControls();
});
