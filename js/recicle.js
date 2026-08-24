class ReticleController {
  constructor() {
    this.canvases = document.querySelectorAll('.reticle-canvas');
    this.ctxs = Array.from(this.canvases).map(c => c.getContext('2d'));
    
    // Parámetros telemétricos por defecto
    this.knownTargetHeightMeters = 1.7; // Altura objetivo en metros (ej. persona)
    this.reticleMilSize = 50;           // Mils que cubre la retícula visual
    this.calculatedDistance = 0;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.canvases.forEach(canvas => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    });
  }

  // Fórmulas de cálculo de distancia estadiamétrica
  calculateDistance() {
    // Distancia = (Tamaño Objeto / Mils) * 1000
    this.calculatedDistance = Math.round((this.knownTargetHeightMeters * 1000) / this.reticleMilSize);
    return this.calculatedDistance;
  }

  draw() {
    this.canvases.forEach((canvas, index) => {
      const ctx = this.ctxs[index];
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.lineWidth = 1.5;

      // Cruz Central
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
      ctx.stroke();

      // Escala Telemétrica Estadiamétrica (Marcas verticales)
      const gap = this.reticleMilSize;
      ctx.beginPath();
      // Guía superior e inferior
      ctx.moveTo(cx - 30, cy - gap); ctx.lineTo(cx + 30, cy - gap);
      ctx.moveTo(cx - 30, cy + gap); ctx.lineTo(cx + 30, cy + gap);
      
      // Submarcas Mils
      for(let i = -gap; i <= gap; i += gap / 4) {
        ctx.moveTo(cx - 5, cy + i);
        ctx.lineTo(cx + 5, cy + i);
      }
      ctx.stroke();

      // Lectura en pantalla de la retícula
      ctx.font = '12px monospace';
      ctx.fillText(`OBJ: ${this.knownTargetHeightMeters.toFixed(1)}m`, cx + 35, cy - 10);
      ctx.fillText(`MILS: ${this.reticleMilSize}`, cx + 35, cy + 10);
    });
  }
}
