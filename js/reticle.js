class ReticleController {
  constructor(){
    this.canvases=Array.from(document.querySelectorAll('.reticle-canvas'));
    this.referenceDistanceMeters=30;
    this.referenceTorsoWidthMeters=.50;
    this.referenceTorsoHeightMeters=.72;
    this.horizontalFovDeg=65;
    this.heading=null;
    this.displayHeading=null;
    this.sensorReady=false;
    this.gpsReady=false;
    this.gpsAccuracy=null;
    this.gpsSpeed=null;
    this.gpsCourse=null;
  }
  normalize(v){return(v%360+360)%360}
  clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  shortestAngle(target,current){return((target-current+540)%360)-180}
  getScreenAngle(){
    if(screen.orientation&&Number.isFinite(screen.orientation.angle))return this.normalize(screen.orientation.angle);
    if(Number.isFinite(window.orientation))return this.normalize(window.orientation);
    return 0;
  }
  resizeCanvas(canvas){
    const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:r.width,h:r.height};
  }
  setOrientation(alpha,beta,gamma,absolute,webkitHeading=null){
    let newHeading=null;
    if(Number.isFinite(webkitHeading))newHeading=this.normalize(webkitHeading);
    else if(Number.isFinite(alpha))newHeading=this.normalize(360-alpha+this.getScreenAngle());
    if(Number.isFinite(newHeading)){
      this.heading=newHeading;
      if(this.displayHeading===null)this.displayHeading=newHeading;
      else this.displayHeading=this.normalize(this.displayHeading+this.shortestAngle(newHeading,this.displayHeading)*.78);
    }
    this.sensorReady=true;
  }
  setGPS(accuracy,speed,course){
    this.gpsReady=true;
    this.gpsAccuracy=Number.isFinite(accuracy)?accuracy:null;
    this.gpsSpeed=Number.isFinite(speed)?speed:null;
    this.gpsCourse=Number.isFinite(course)?this.normalize(course):null;
    if(this.heading===null&&this.gpsCourse!==null&&this.gpsSpeed!==null&&this.gpsSpeed>=1.5){this.heading=this.gpsCourse;this.displayHeading=this.gpsCourse}
  }
  angularSizeDeg(size){return 2*Math.atan(size/(2*this.referenceDistanceMeters))*180/Math.PI}
  verticalFovDeg(width,height){
    const hf=this.horizontalFovDeg*Math.PI/180;
    return 2*Math.atan(Math.tan(hf/2)*(height/Math.max(1,width)))*180/Math.PI;
  }
  angularToPixels(angleDeg,pixels,fovDeg){
    const f=fovDeg*Math.PI/180,a=angleDeg*Math.PI/180;
    return pixels*Math.tan(a)/(2*Math.tan(f/2));
  }
  draw(){
    this.canvases.forEach(canvas=>{
      const{ctx,w,h}=this.resizeCanvas(canvas),cx=w/2,cy=h/2;
      ctx.clearRect(0,0,w,h);ctx.save();
      ctx.strokeStyle='#00ff00';ctx.fillStyle='#00ff00';ctx.shadowColor='#00ff00';ctx.shadowBlur=3;ctx.lineWidth=1.5;
      this.drawCompass(ctx,w,h);
      this.drawReticle(ctx,cx,cy);
      this.drawTorsoReference(ctx,cx,cy,w,h);
      this.drawSensorInfo(ctx,w,h);
      ctx.restore();
    });
  }
  drawCompass(ctx,w,h){
    const top=5;
    const barH=Math.min(66,Math.max(58,h*.20));
    const left=7,right=w-7,center=w/2,span=right-left;
    const heading=this.displayHeading===null?(this.heading===null?0:this.heading):this.displayHeading;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.90)';ctx.strokeStyle='rgba(0,255,0,.95)';ctx.lineWidth=1.5;
    ctx.fillRect(left,top,span,barH);ctx.strokeRect(left,top,span,barH);
    // Escala completa de 360°: 0° a 359° siempre representados en la regla.
    const baseY=top+28;
    ctx.beginPath();ctx.moveTo(left+3,baseY);ctx.lineTo(right-3,baseY);ctx.stroke();
    for(let deg=0;deg<360;deg+=5){
      const x=left+3+(deg/359)*(span-6);
      const cardinal=deg===0||deg===90||deg===180||deg===270;
      const major=deg%30===0;
      const tick=cardinal?22:(major?16:deg%10===0?11:6);
      ctx.lineWidth=cardinal?2.5:(major?1.7:1);
      ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x,baseY+tick);ctx.stroke();
      if(major){
        ctx.font=cardinal?'bold 15px monospace':'bold 9px monospace';
        ctx.textAlign='center';
        ctx.fillText(({0:'N',90:'E',180:'S',270:'O'})[deg]||String(deg).padStart(3,'0'),x,top+56);
      }
    }
    // Indicador central: el rumbo real queda siempre bajo el vértice.
    ctx.strokeStyle='#00ff00';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(center,top+1);ctx.lineTo(center-8,top+12);ctx.lineTo(center+8,top+12);ctx.closePath();ctx.stroke();
    ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(this.heading===null?'BRÚJULA ESPERANDO':`RUMBO ${Math.round(heading).toString().padStart(3,'0')}°`,center,top+barH-4);
    ctx.restore();
  }
  drawReticle(ctx,cx,cy){
    ctx.save();ctx.lineWidth=1.7;
    ctx.beginPath();ctx.moveTo(cx-28,cy);ctx.lineTo(cx-8,cy);ctx.moveTo(cx+8,cy);ctx.lineTo(cx+28,cy);ctx.moveTo(cx,cy-28);ctx.lineTo(cx,cy-8);ctx.moveTo(cx,cy+8);ctx.lineTo(cx,cy+28);ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  drawTorsoReference(ctx,cx,cy,w,h){
    // 0.50 m de ancho x 0.72 m de alto a 30 m, calculados por separado
    // usando el FOV horizontal y el FOV vertical equivalente al aspecto de pantalla.
    const hf=this.horizontalFovDeg;
    const vf=this.verticalFovDeg(w,h);
    const widthAngle=this.angularSizeDeg(this.referenceTorsoWidthMeters);
    const heightAngle=this.angularSizeDeg(this.referenceTorsoHeightMeters);
    const width=this.angularToPixels(widthAngle,w,hf);
    const height=this.angularToPixels(heightAngle,h,vf);
    const x=cx-width/2,y=cy-height/2;
    ctx.save();ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(x,y,width,height);ctx.setLineDash([]);
    ctx.font='bold 9px monospace';ctx.textAlign='left';ctx.fillText('TORSO 30M · 0,50 × 0,72 M',x+width+5,y+10);ctx.restore();
  }
  drawSensorInfo(ctx,w,h){
    ctx.save();ctx.font='bold 9px monospace';ctx.textAlign='right';
    const c=this.sensorReady?'BRÚJULA OK':'BRÚJULA OFF';
    const g=this.gpsReady?`GPS OK${this.gpsAccuracy!==null?' ±'+Math.round(this.gpsAccuracy)+'M':''}`:'GPS OFF';
    ctx.fillText(`${c} | ${g}`,w-7,h-7);ctx.restore();
  }
}