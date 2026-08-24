const video=document.getElementById("camera"),canvas=document.getElementById("view"),ctx=canvas.getContext("2d",{alpha:false});
const $=id=>document.getElementById(id);
let stream=null,track=null,raf=0,last=performance.now(),frames=0,mode=0,vr=false,cross=true,mirror=false,torch=false;
const state={brightness:1.2,contrast:1.35,gain:1,zoom:0.8};

function loadState(){try{Object.assign(state,JSON.parse(localStorage.getItem("nvvr")||"{}"))}catch{}; for(const k of Object.keys(state)){if($(k))$(k).value=state[k];}}
function saveState(){localStorage.setItem("nvvr",JSON.stringify(state))}
loadState();

async function startCamera(){
  try{
    if(!window.isSecureContext){throw new Error("La cámara del navegador necesita HTTPS o localhost.")}
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
    video.srcObject=stream; await video.play(); track=stream.getVideoTracks()[0];
    $("startPanel").classList.add("hidden"); $("status").textContent="CÁMARA ACTIVA";
    resize(); cancelAnimationFrame(raf); render();
  }catch(e){$("status").textContent="ERROR"; alert(e.message||"No se pudo acceder a la cámara. Revisa los permisos del navegador.")}
}
function resize(){canvas.width=Math.max(640,innerWidth*devicePixelRatio);canvas.height=Math.max(360,innerHeight*devicePixelRatio)}
addEventListener("resize",resize);

function processFrame(){
  if(!video.videoWidth)return;
  const w=canvas.width,h=canvas.height;
  const vw=video.videoWidth,vh=video.videoHeight;
  const aspect=w/h, srcAspect=vw/vh;
  let sw,sh,sx,sy;
  if(srcAspect>aspect){sh=vh/state.zoom;sw=sh*aspect}else{sw=vw/state.zoom;sh=sw/aspect}
  sx=(vw-sw)/2;sy=(vh-sh)/2;
  ctx.save();
  ctx.translate(mirror?w:0,0);ctx.scale(mirror?-1:1,1);
  if(vr){drawEye(sx,sy,sw,sh,0,w/2,h);drawEye(sx,sy,sw,sh,w/2,w/2,h)}
  else drawEye(sx,sy,sw,sh,0,w,h);
  ctx.restore();
}
function drawEye(sx,sy,sw,sh,dx,dw,dh){
  const temp=document.createElement("canvas");temp.width=dw;temp.height=dh;const t=temp.getContext("2d");
  t.drawImage(video,sx,sy,sw,sh,0,0,dw,dh);
  const img=t.getImageData(0,0,dw,dh),d=img.data,b=state.brightness,g=state.gain,c=state.contrast;
  for(let i=0;i<d.length;i+=4){
    let y=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255;
    y=Math.max(0,Math.min(1,((y-.5)*c+.5)*b*g));
    if(mode===0){d[i]=y*105;d[i+1]=y*255;d[i+2]=y*115}
    else if(mode===1){const q=y*255;d[i]=d[i+1]=d[i+2]=q}
    else if(mode===2){d[i]=y*255;d[i+1]=y*65;d[i+2]=y*30}
    else {const q=(1-y)*255;d[i]=d[i+1]=d[i+2]=q}
  }
  t.putImageData(img,0,0);ctx.drawImage(temp,dx,0,dw,dh);
}
function render(){processFrame();frames++;const now=performance.now();if(now-last>1000){$("fps").textContent=frames+" FPS";frames=0;last=now}raf=requestAnimationFrame(render)}

$("startBtn").onclick=startCamera;
$("menuBtn").onclick=()=>$("controls").classList.remove("hidden");
$("closeBtn").onclick=()=>$("controls").classList.add("hidden");

for(const id of ["brightness","contrast","gain","zoom"]){
  $(id).oninput=()=>{state[id]=+$(id).value;$(`${id}Out`).textContent=id==="zoom"?state[id].toFixed(1)+"×":state[id].toFixed(2);saveState()}
}
document.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=async()=>{
 const a=btn.dataset.action;
 if(a==="mode"){mode=(mode+1)%4;btn.textContent=["MODO: VERDE","MODO: B/N","MODO: ROJO","MODO: INVERSO"][mode]}
 if(a==="vr"){vr=!vr;btn.textContent="VR: "+(vr?"ON":"OFF");$("vrLabel").textContent="VR "+(vr?"ON":"OFF")}
 if(a==="crosshair"){cross=!cross;$("crosshair").style.display=cross?"":"none";btn.textContent="RETÍCULA: "+(cross?"ON":"OFF")}
 if(a==="mirror"){mirror=!mirror;btn.textContent="ESPEJO: "+(mirror?"ON":"OFF")}
 if(a==="fullscreen"){document.documentElement.requestFullscreen?.()}
 if(a==="torch" && track){
   const caps=track.getCapabilities?.(); if(caps?.torch){torch=!torch;await track.applyConstraints({advanced:[{torch}]});btn.textContent="LINTERNA: "+(torch?"ON":"OFF")}
   else alert("La cámara de este teléfono/navegador no expone control de linterna.")
 }
});
$("resetBtn").onclick=()=>{Object.assign(state,{brightness:1.2,contrast:1.35,gain:1,zoom:1});loadState();saveState()};
document.addEventListener("dblclick",()=>document.documentElement.requestFullscreen?.());
window.addEventListener("pagehide",()=>stream?.getTracks().forEach(t=>t.stop()));

if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
