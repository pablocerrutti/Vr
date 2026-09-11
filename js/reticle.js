class ReticleController {
  constructor() {
    this.canvases = document.querySelectorAll('.reticle-canvas');
    this.ctxs = Array.from(this.canvases).map(c => c.getContext('2d'));

    // Referencia fija de campo: torso humano aproximado observado a 30 m.
    // No pretende sustituir un telémetro; sirve para reconocer la escala angular.
    this.referenceDistanceMeters = 30;
    this.referenceTorsoWidthMeters = 0.50;
    this.referenceTorsoHeightMeters = 0.72;

    // FOV horizontal aproximado del sistema de cámara trasera del teléfono.
    // Se mantiene fijo para que la referencia de 30 m sea estable.
    this.horizontalFovDeg = 65;

    this.horizonEnabled = true;
    this.heading = null;
    this.pitch = 0;
    this.roll = 0;
    this.sensorReady = false;
    this.lastOrientation = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.canvases.forEach(canvas => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  setOrientation(alpha, beta, gamma, absolute = false) {
    let heading = null;

    // iOS Safari ofrece el rumbo magnético directamente.
    if (typeof window.__webkitCompassHeading === 'number') {
      heading = window.__webkitCompassHeading;
    } else if (typeof alpha === 'number') {
      // Aproximación Android/Web Orientation.
      const screenAngle = (screen.orientation && typeof screen.orientation.angle === 'number')
        ? screen.orientation.angle : (window.orientation || 0);
      heading = (360 - alpha + screenAngle) % 360;
    }

    if (heading !== null && Number.isFinite(heading)) {
      this.heading = (heading + 360) % 360;
    }

    if (typeof beta === 'number') this.pitch = beta;
    if (typeof gamma === 'number') this.roll = gamma;
    this.sensorReady = true;
  }

  // Ángulo aparente de una dimensión conocida a una distancia fija.
  angularSizeDeg(sizeMeters) {
    return (2 * Math.atan(sizeMeters / (2 * this.referenceDistanceMeters))) * 180 / Math.PI;
  }

  // Convierte ángulo a píxeles según el FOV de cámara utilizado.
  angularToPixels(angleDeg, widthPx) {
    const fovRad = this.horizontalFovDeg * Math.PI / 180;
    const angleRad = angleDeg * Math.PI / 180;
    return widthPx * Math.tan(angleRad) / (2 * Math.tan(fovRad / 2));
  }

  draw() {
    this.canvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 3;

      this.drawHorizon(ctx, w, h, cx, cy);
      this.drawCompass(ctx, w);
      this.drawReticle(ctx, cx, cy);
      this.drawTorsoReference(ctx, cx, cy, w);

      ctx.restore();
    });
  }

  drawReticle(ctx, cx, cy) {
    // Retícula central limpia para apuntado/observación.
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 7, cy);
    ctx.moveTo(cx + 7, cy); ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 7);
    ctx.moveTo(cx, cy + 7); ctx.lineTo(cx, cy + 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawTorsoReference(ctx, cx, cy, w) {
    const torsoWidthPx = Math.max(4, this.angularToPixels(this.angularSizeDeg(this.referenceTorsoWidthMeters), w));
    const torsoHeightPx = Math.max(7, torsoWidthPx * (this.referenceTorsoHeightMeters / this.referenceTorsoWidthMeters));

    const x = cx - torsoWidthPx / 2;
    const y = cy - torsoHeightPx / 2;

    // Marco de referencia muy fino: no tapa el objetivo real.
    ctx.save();
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x, y, torsoWidthPx, torsoHeightPx);
    ctx.setLineDash([]);

    // Hombros y línea de cintura para que sea reconocible como torso.
    const shoulderY = y + torsoHeightPx * 0.18;
    const waistY = y + torsoHeightPx * 0.82;
    ctx.beginPath();
    ctx.moveTo(x, shoulderY); ctx.lineTo(x + torsoWidthPx, shoulderY);
    ctx.moveTo(x, waistY); ctx.lineTo(x + torsoWidthPx, waistY);
    ctx.stroke();

    ctx.font = '10px monospace';
    ctx.fillText('TORSO 30M', x + torsoWidthPx + 5, y + 10);
    ctx.restore();
  }

  drawHorizon(ctx, w, h, cx, cy) {
    if (!this.horizonEnabled) return;

    // La línea representa el horizonte/verticalidad del teléfono.
    // Roll se expresa como inclinación; pitch desplaza suavemente la línea.
    const rollRad = (this.roll || 0) * Math.PI / 180;
    const pitchShift = Math.max(-h * 0.32, Math.min(h * 0.32, (this.pitch || 0) * h / 90));
    const y = cy + pitchShift;
    const len = w * 0.38;

    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(rollRad);
    ctx.lineWidth = Math.abs(this.roll) < 1.5 ? 2.2 : 1.2;
    ctx.globalAlpha = Math.abs(this.roll) < 1.5 ? 0.95 : 0.65;

    ctx.beginPath();
    ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0);
    ctx.stroke();

    // Indicador central de nivel.
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(0, -5); ctx.lineTo(12, 0);
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.font = '10px monospace';
    ctx.globalAlpha = 0.8;
    const levelText = Math.abs(this.roll) < 1.5 ? 'NIVELADO' : `INCLINADO ${Math.round(this.roll)}°`;
    ctx.fillText(levelText, cx - 40, y - 7);
    ctx.restore();
  }

  drawCompass(ctx, w) {
    const y = 22;
    const center = w / 2;
    const span = w * 0.72;
    const heading = this.heading === null ? 0 : this.heading;

    ctx.save();
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1;

    // Línea base.
    ctx.beginPath();
    ctx.moveTo(center - span / 2, y); ctx.lineTo(center + span / 2, y);
    ctx.stroke();

    // Escala de 360° desplazándose con el rumbo.
    const pxPerDeg = span / 120;
    for (let d = -60; d <= 60; d += 5) {
      const x = center + d * pxPerDeg;
      const absoluteDeg = (heading + d + 360) % 360;
      const major = absoluteDeg % 45 === 0;
      const cardinal = Math.round(absoluteDeg) % 90 === 0;
      const tick = cardinal ? 11 : (major ? 8 : 5);

      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x, y + tick);
      ctx.stroke();

      if (cardinal) {
        const labels = ['N', 'E', 'S', 'O'];
        const index = Math.round(absoluteDeg / 90) % 4;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(labels[index], x - 4, y + 23);
      }
    }

    // Dirección actual, siempre fija en el centro.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center, y - 5); ctx.lineTo(center - 5, y + 3); ctx.lineTo(center + 5, y + 3); ctx.closePath();
    ctx.stroke();

    ctx.font = '10px monospace';
    const hdg = this.heading === null ? '---' : `${Math.round(this.heading).toString().padStart(3, '0')}°`;
    ctx.fillText(`RUMBO ${hdg}`, center - 31, y + 37);
    ctx.restore();
  }
}
