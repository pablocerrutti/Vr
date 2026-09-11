class ReticleController {
  constructor(){
    this.canvases=Array.from(document.querySelectorAll('.reticle-canvas'));
    this.referenceDistanceMeters=30;this.referenceTorsoWidthMeters=.50;this.referenceTorsoHeightMeters=.72;this.horizontalFovDeg=65;
    this.horizonEnabled=true;this.heading=null;this.displayHeading=null;this.pitch=0;this.roll=0;this.sensorReady=false;this.gpsReady=false;this.gpsAccuracy=null;this.gpsSpeed=null;this.gpsCourse=null;this.lastSize=new WeakMap();
  }
  normalize(v){return(v%360+360)%360}
  clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  shortestAngle(a,b){return((a-b+540)%360)-180}
  getScreenAngle(){if(screen.orientation&&Number.isFinite(screen.orientation.angle))return this.normalize(screen.orientation.angle);if(Number.isFinite(window.orientation))return this.normalize(window.orientation);return 0}
  resizeCanvas(canvas){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:r.width,h:r.height}}
  setOrientation(alpha,beta,gamma){
    if(Number.isFinite(window.__webkitCompassHeading)){this.heading=this.normalize(window.__webkitCompassHeading)}
    else if(Number.isFinite(alpha)){this.heading=this.normalize(360-alpha+this.getScreenAngle())}
    if(Number.isFinite(this.heading)){
      if(this.displayHeading===null)this.displayHeading=this.heading;
      else this.displayHeading=this.normalize(this.displayHeading+this.shortestAngle(this.heading,this.displayHeading)*.22);
    }
    if(Number.isFinite(beta)&&Number.isFinite(gamma)){const a=this.getScreenAngle();if(a===90){this.pitch=gamma;this.roll=-beta}else if(a===270){this.pitch=-gamma;this.roll=beta}else if(a===180){this.pitch=-beta;this.roll=-gamma}else{this.pitch=beta;this.roll=gamma}this.pitch=this.clamp(this.pitch,-90,90);this.roll=this.clamp(this.roll,-90,90)}
    this.sensorReady=true;
  }
  setGPS(accuracy,speed,course){this.gpsReady=true;this.gpsAccuracy=Number.isFinite(accuracy)?accuracy:null;this.gpsSpeed=Number.isFinite(speed)?speed:null;this.gpsCourse=Number.isFinite(course)?this.normalize(course):null;if(this.heading===null&&this.gpsCourse!==null&&this.gpsSpeed!==null&&this.gpsSpeed>=1.5){this.heading=this.gpsCourse;this.displayHeading=this.gpsCourse}}
  angularSizeDeg(size){return 2*Math.atan(size/(2*this.referenceDistanceMeters))*180/Math.PI}
  angularToPixels(angleDeg,width){const f=this.horizontalFovDeg*Math.PI/180,a=angleDeg*Math.PI/180;return width*Math.tan(a)/(2*Math.tan(f/2))}
  draw(){this.canvases.forEach(canvas=>{const{ctx,w,h}=this.resizeCanvas(canvas),cx=w/2,cy=h/2;ctx.clearRect(0,0,w,h);ctx.save();ctx.strokeStyle='#00ff00';ctx.fillStyle='#00ff00';ctx.shadowColor='#00ff00';ctx.shadowBlur=3;ctx.lineWidth=1.5;this.drawCompass(ctx,w,h);this.drawHorizon(ctx,w,h,cx,cy);this.drawReticle(ctx,cx,cy);this.drawTorsoReference(ctx,cx,cy,w);this.drawSensorInfo(ctx,w,h);ctx.restore()})}
  drawCompass(ctx,w,h){
    const top=7,span=Math.max(170,Math.min(w-18,w*.92)),center=w/2,left=center-span/2,right=center+span/2,barH=Math.min(64,Math.max(55,h*.20)),heading=this.displayHeading===null?(this.heading===null?0:this.heading):this.displayHeading,pxPerDeg=span/120;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.82)';ctx.strokeStyle='rgba(0,255,0,.9)';ctx.lineWidth=1.5;ctx.fillRect(left-5,top,span+10,barH);ctx.strokeRect(left-5,top,span+10,barH);
    ctx.beginPath();ctx.moveTo(left,top+25);ctx.lineTo(right,top+25);ctx.stroke();
    for(let d=-60;d<=60;d+=5){const x=center+d*pxPerDeg,deg=this.normalize(heading+d),rounded=Math.round(deg)%360,cardinal=rounded===0||rounded===90||rounded===180||rounded===270,major=rounded%15===0,tick=cardinal?18:(major?12:7);ctx.lineWidth=cardinal?2.3:(major?1.4:1);ctx.beginPath();ctx.moveTo(x,top+25);ctx.lineTo(x,top+25+tick);ctx.stroke();if(cardinal){ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText(({0:'N',90:'E',180:'S',270:'O'})[rounded],x,top+54)}else if(major){ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(String(rounded).padStart(3,'0')+'°',x,top+53)}}
    ctx.strokeStyle='#00ff00';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(center,top+2);ctx.lineTo(center-7,top+12);ctx.lineTo(center+7,top+12);ctx.closePath();ctx.stroke();ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(this.heading===null?'BRÚJULA ESPERANDO':`RUMBO ${Math.round(heading).toString().padStart(3,'0')}°`,center,top+barH-5);ctx.restore();
  }
  drawHorizon(ctx,w,h,cx,cy){if(!this.horizonEnabled)return;const roll=(this.roll||0)*Math.PI/180,shift=this.clamp((this.pitch||0)*h/90,-h*.38,h*.38),y=cy+shift,len=Math.min(Math.max(w*.42,150),w*.72);ctx.save();ctx.translate(cx,y);ctx.rotate(roll);ctx.strokeStyle='#00ff00';ctx.globalAlpha=Math.abs(this.roll)<1.5?.98:.82;ctx.lineWidth=Math.abs(this.roll)<1.5?2.8:1.7;ctx.beginPath();ctx.moveTo(-len/2,0);ctx.lineTo(len/2,0);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-5,0);ctx.moveTo(5,0);ctx.lineTo(18,0);ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();ctx.restore();ctx.save();ctx.globalAlpha=.95;ctx.font='bold 11px monospace';ctx.textAlign='center';let text='NIVEL HORIZONTE — SENSOR OFF';if(this.sensorReady){if(Math.abs(this.roll)<1.5)text='HORIZONTE NIVELADO 0°';else text=`HORIZONTE ${this.roll>0?'D':'I'} ${Math.round(Math.abs(this.roll))}°`}ctx.fillText(text,cx,this.clamp(y-11,topSafe(h),h-12));ctx.restore()}
  drawReticle(ctx,cx,cy){ctx.save();ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(cx-28,cy);ctx.lineTo(cx-8,cy);ctx.moveTo(cx+8,cy);ctx.lineTo(cx+28,cy);ctx.moveTo(cx,cy-28);ctx.lineTo(cx,cy-8);ctx.moveTo(cx,cy+8);ctx.lineTo(cx,cy+28);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.stroke();ctx.restore()}
  drawTorsoReference(ctx,cx,cy,w){const width=Math.max(4,this.angularToPixels(this.angularSizeDeg(this.referenceTorsoWidthMeters),w)),height=Math.max(7,width*(this.referenceTorsoHeightMeters/this.referenceTorsoWidthMeters)),x=cx-width/2,y=cy-height/2;ctx.save();ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(x,y,width,height);ctx.setLineDash([]);ctx.font='bold 9px monospace';ctx.textAlign='left';ctx.fillText('TORSO 30M',x+width+5,y+10);ctx.restore()}
  drawSensorInfo(ctx,w,h){ctx.save();ctx.font='bold 9px monospace';ctx.textAlign='right';const c=this.sensorReady?'BRÚJULA OK':'BRÚJULA OFF',g=this.gpsReady?`GPS OK${this.gpsAccuracy!==null?' ±'+Math.round(this.gpsAccuracy)+'M':''}`:'GPS OFF';ctx.fillText(`${c} | ${g}`,w-7,h-7);ctx.restore()}
}
function topSafe(h){return Math.min(112,h*.42)}
