class ReticleController {
  constructor() {
    this.canvases = document.querySelectorAll('.reticle-canvas');
    this.ctxs = Array.from(this.canvases).map(c => c.getContext('2d'));

    this.referenceDistanceMeters = 30;
    this.referenceTorsoWidthMeters = 0.50;
    this.referenceTorsoHeightMeters = 0.72;
    this.horizontalFovDeg = 65;

    this.horizonEnabled = true;
    this.heading = null;
    this.pitch = 0;
    this.roll = 0;
    this.sensorReady = false;
    this.gpsReady = false;
    this.gpsAccuracy = null;
    this.gpsSpeed = null;
    this.gpsCourse = null;
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

    if (typeof window.__webkitCompassHeading === 'number' && Number.isFinite(window.__webkitCompassHeading)) {
      heading = window.__webkitCompassHeading;
    } else if (typeof alpha === 'number' && Number.isFinite(alpha)) {
      const screenAngle = (screen.orientation && typeof screen.orientation.angle === 'number')
        ? screen.orientation.angle : (window.orientation || 0);
      heading = (360 - alpha + screenAngle) % 360;
    }

    if (heading !== null && Number.isFinite(heading)) {
      this.heading = this.normalize(heading);
    }

    if (typeof beta === 'number') this.pitch = beta;
    if (typeof gamma === 'number') this.roll = gamma;
    this.sensorReady = true;
  }

  setGPS(accuracy, speed, course) {
    this.gpsReady = true;
    this.gpsAccuracy = Number.isFinite(accuracy) ? accuracy : null;
    this.gpsSpeed = Number.isFinite(speed) ? speed : null;
    this.gpsCourse = Number.isFinite(course) ? this.normalize(course) : null;

    // El rumbo GPS solo se usa como apoyo cuando hay desplazamiento real.
    // No sustituye al magnetómetro estando quieto.
    if (this.gpsCourse !== null && this.gpsSpeed !== null && this.gpsSpeed >= 1.5) {
      if (this.heading === null) this.heading = this.gpsCourse;
    }
  }

  normalize(value) {
    return (value % 360 + 360) % 360;
  }

  shortestAngle(a, b) {
    return ((a - b + 540) % 360) - 180;
  }

  angularSizeDeg(sizeMeters) {
    return (2 * Math.atan(sizeMeters / (2 * this.referenceDistanceMeters))) * 180 / Math.PI;
  }

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
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 3;

      this.drawCompass(ctx, w);
      this.drawHorizon(ctx, w, h, cx, cy);
      this.drawReticle(ctx, cx, cy);
      this.drawTorsoReference(ctx, cx, cy, w);
      this.drawSensorInfo(ctx, w, h);

      ctx.restore();
    });
  }

  drawReticle(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 26, cy);
    ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 26);
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

    ctx.save();
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x, y, torsoWidthPx, torsoHeightPx);
    ctx.setLineDash([]);

    const shoulderY = y + torsoHeightPx * 0.18;
    const waistY = y + torsoHeightPx * 0.82;
    ctx.beginPath();
    ctx.moveTo(x, shoulderY); ctx.lineTo(x + torsoWidthPx, shoulderY);
    ctx.moveTo(x, waistY); ctx.lineTo(x + torsoWidthPx, waistY);
    ctx.stroke();

    ctx.font = 'bold 11px monospace';
    ctx.fillText('TORSO 30M', x + torsoWidthPx + 6, y + 12);
    ctx.restore();
  }

  drawHorizon(ctx, w, h, cx, cy) {
    if (!this.horizonEnabled) return;

    const rollRad = (this.roll || 0) * Math.PI / 180;
    const pitchShift = Math.max(-h * 0.32, Math.min(h * 0.32, (this.pitch || 0) * h / 90));
    const y = cy + pitchShift;
    const len = w * 0.38;

    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(rollRad);
    ctx.lineWidth = Math.abs(this.roll) < 1.5 ? 2.4 : 1.5;
    ctx.globalAlpha = Math.abs(this.roll) < 1.5 ? 0.95 : 0.7;

    ctx.beginPath();
    ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-13, 0); ctx.lineTo(0, -6); ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.globalAlpha = 0.9;
    const levelText = Math.abs(this.roll) < 1.5 ? 'NIVELADO' : `INCLINADO ${Math.round(this.roll)}°`;
    ctx.fillText(levelText, cx - 45, y - 9);
    ctx.restore();
  }

  drawCompass(ctx, w) {
    const top = 12;
    const center = w / 2;
    const span = Math.min(w * 0.82, 760);
    const left = center - span / 2;
    const right = center + span / 2;
    const heading = this.heading === null ? 0 : this.heading;
    const pxPerDeg = span / 120;

    ctx.save();
    ctx.shadowBlur = 5;
    ctx.lineWidth = 2;

    // Fondo para mantener la escala legible sobre cualquier escena.
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(left - 12, top - 8, span + 24, 72);
    ctx.strokeStyle = '#00ff00';
    ctx.strokeRect(left - 12, top - 8, span + 24, 72);
    ctx.fillStyle = '#00ff00';

    // Escala reglada de 120° visibles: marcas cada 5°, mayores cada 15°.
    ctx.beginPath();
    ctx.moveTo(left, top + 25); ctx.lineTo(right, top + 25);
    ctx.stroke();

    for (let d = -60; d <= 60; d += 5) {
      const x = center + d * pxPerDeg;
      const absoluteDeg = this.normalize(heading + d);
      const cardinal = Math.abs(this.shortestAngle(absoluteDeg, 0)) < 0.1 ||
                       Math.abs(this.shortestAngle(absoluteDeg, 90)) < 0.1 ||
                       Math.abs(this.shortestAngle(absoluteDeg, 180)) < 0.1 ||
                       Math.abs(this.shortestAngle(absoluteDeg, 270)) < 0.1;
      const major = Math.round(absoluteDeg) % 15 === 0;
      const tick = cardinal ? 18 : (major ? 13 : 8);

      ctx.lineWidth = cardinal ? 2.4 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x, top + 25); ctx.lineTo(x, top + 25 + tick);
      ctx.stroke();

      if (cardinal) {
        const labels = {0:'N',90:'E',180:'S',270:'O'};
        const key = Math.round(absoluteDeg) % 360;
        ctx.font = 'bold 17px monospace';
        ctx.fillText(labels[key], x - 6, top + 59);
      } else if (major) {
        ctx.font = 'bold 10px monospace';
        ctx.fillText(String(Math.round(absoluteDeg)).padStart(3,'0') + '°', x - 13, top + 57);
      }
    }

    // Índice fijo: la dirección que apunta el teléfono queda exactamente aquí.
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(center, top - 2);
    ctx.lineTo(center - 9, top + 12);
    ctx.lineTo(center + 9, top + 12);
    ctx.closePath();
    ctx.stroke();

    ctx.font = 'bold 14px monospace';
    const hdg = this.heading === null ? '---°' : `${Math.round(this.heading).toString().padStart(3, '0')}°`;
    const compassText = this.heading === null ? 'BRÚJULA ESPERANDO' : `RUMBO ${hdg}`;
    const tw = ctx.measureText(compassText).width;
    ctx.fillText(compassText, center - tw / 2, top + 80);
    ctx.restore();
  }

  drawSensorInfo(ctx, w, h) {
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ff00';
    const compass = this.sensorReady ? 'BRÚJULA OK' : 'BRÚJULA OFF';
    const gps = this.gpsReady
      ? `GPS OK${this.gpsAccuracy !== null ? ` ±${Math.round(this.gpsAccuracy)}M` : ''}`
      : 'GPS OFF';
    ctx.fillText(`${compass}  |  ${gps}`, w - 10, h - 12);
    ctx.restore();
  }
}

window.addEventListener('resize', () => {});