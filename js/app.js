document.addEventListener('DOMContentLoaded', async () => {
  const camera = new CameraController();
  const reticle = new ReticleController();

  await camera.init();

  const modes = ['filter-green', 'filter-thermal', 'filter-bw'];
  let currentModeIdx = 0;

  const updateHUD = () => {
    const dist = reticle.calculateDistance();
    document.querySelectorAll('.dist-val').forEach(el => el.textContent = dist);
  };

  const applyMode = () => {
    document.body.className = modes[currentModeIdx];
    const modeNames = ['VERDE FÓSFORO', 'TÉRMICO PSEUDO', 'BLANCO/NEGRO'];
    document.querySelectorAll('.mode-val').forEach(el => el.textContent = modeNames[currentModeIdx]);
  };

  // Ciclo de renderizado de la retícula
  const loop = () => {
    reticle.draw();
    requestAnimationFrame(loop);
  };
  loop();

  // Escuchar eventos de control (Pantalla / Teclado / Control Bluetooth)
  document.getElementById('btn-mode').addEventListener('click', () => {
    currentModeIdx = (currentModeIdx + 1) % modes.length;
    applyMode();
  });

  document.getElementById('btn-size-up').addEventListener('click', () => {
    reticle.knownTargetHeightMeters += 0.1;
    updateHUD();
  });

  document.getElementById('btn-size-down').addEventListener('click', () => {
    if (reticle.knownTargetHeightMeters > 0.2) {
      reticle.knownTargetHeightMeters -= 0.1;
      updateHUD();
    }
  });

  // Atajos con mando Bluetooth en modo gamepad o teclado externo
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      reticle.reticleMilSize = Math.max(10, reticle.reticleMilSize - 2);
      updateHUD();
    } else if (e.key === 'ArrowDown') {
      reticle.reticleMilSize += 2;
      updateHUD();
    } else if (e.key === ' ') {
      currentModeIdx = (currentModeIdx + 1) % modes.length;
      applyMode();
    }
  });

  applyMode();
  updateHUD();
});
