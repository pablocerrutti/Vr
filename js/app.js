document.addEventListener('DOMContentLoaded',async()=>{
  const camera=new CameraController();
  const reticle=new ReticleController();
  const body=document.body;
  const normalView=document.getElementById('normal-view');
  const vrView=document.getElementById('vr-view');
  const menuToggle=document.getElementById('menu-toggle');
  const menuPanel=document.getElementById('menu-panel');
  const sensorStatus=document.getElementById('sensor-status');
  let vrMode=false;
  let gpsWatchId=null;
  let orientationListening=false;

  const filterNames={normal:'NORMAL',green:'VERDE FÓSFORO',thermal:'TÉRMICO PSEUDO',bw:'BLANCO/NEGRO'};
  const status=t=>{sensorStatus.textContent=`SENSORES: ${t}`;};

  function startGPS(){
    if(!navigator.geolocation){status('BRÚJULA ACTIVA / GPS NO DISPONIBLE');return false;}
    if(gpsWatchId!==null)navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId=navigator.geolocation.watchPosition(p=>{
      const c=p.coords;
      reticle.setGPS(c.accuracy,c.speed,c.heading);
      const acc=Number.isFinite(c.accuracy)?` ±${Math.round(c.accuracy)}M`:'';
      status(`BRÚJULA ACTIVA / GPS OK${acc}`);
    },()=>status('BRÚJULA ACTIVA / GPS SIN SEÑAL'),{enableHighAccuracy:true,maximumAge:1000,timeout:10000});
    return true;
  }

  function handleOrientation(e){
    if(Number.isFinite(e.webkitCompassHeading))window.__webkitCompassHeading=e.webkitCompassHeading;
    reticle.setOrientation(e.alpha,e.beta,e.gamma);
  }

  async function requestMotionPermission(){
    let compass=true;
    try{
      if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
        const result=await DeviceOrientationEvent.requestPermission();
        compass=result==='granted';
      }
    }catch(_){compass=false;}

    if(compass&&!orientationListening){
      window.addEventListener('deviceorientation',handleOrientation,true);
      window.addEventListener('deviceorientationabsolute',handleOrientation,true);
      orientationListening=true;
      reticle.sensorReady=true;
    }

    const gps=startGPS();
    if(compass&&gps)status('BRÚJULA + GPS ACTIVOS');
    else if(compass)status('BRÚJULA ACTIVA / GPS NO DISPONIBLE');
    else if(gps)status('GPS ACTIVO / BRÚJULA DENEGADA');
    else status('PERMISOS NO CONCEDIDOS');
  }

  function applyImageControls(){
    const b=Number(document.getElementById('brightness').value);
    const c=Number(document.getElementById('contrast').value);
    const g=Number(document.getElementById('gain').value);
    const s=Number(document.getElementById('saturation').value);
    const f=document.getElementById('filter-select').value;
    document.getElementById('brightness-value').textContent=`${b}%`;
    document.getElementById('contrast-value').textContent=`${c}%`;
    document.getElementById('gain-value').textContent=`${g}%`;
    document.getElementById('saturation-value').textContent=`${s}%`;
    body.dataset.filter=f;
    document.querySelectorAll('.camera-stream').forEach(v=>{
      v.style.setProperty('--brightness',`${b*g/100}%`);
      v.style.setProperty('--contrast',`${c}%`);
      v.style.setProperty('--saturation',`${s}%`);
    });
  }

  function enterVR(){
    vrMode=true;normalView.hidden=true;vrView.hidden=false;
    body.classList.remove('mode-normal');body.classList.add('mode-vr');
    document.getElementById('btn-vr').textContent='SALIR DE VR';
    menuPanel.hidden=true;menuToggle.setAttribute('aria-expanded','false');
    requestAnimationFrame(()=>reticle.draw());
  }

  function exitVR(){
    vrMode=false;vrView.hidden=true;normalView.hidden=false;
    body.classList.remove('mode-vr');body.classList.add('mode-normal');
    document.getElementById('btn-vr').textContent='ENTRAR EN VR';
    requestAnimationFrame(()=>reticle.draw());
  }

  try{await camera.init();}catch(_){status('CÁMARA NO DISPONIBLE');}

  const normalVideo=document.getElementById('video-normal');
  const vrVideos=document.querySelectorAll('#vr-view .camera-stream');
  if(camera.stream){
    normalVideo.srcObject=camera.stream;
    vrVideos.forEach(v=>v.srcObject=camera.stream);
    normalVideo.play().catch(()=>{});vrVideos.forEach(v=>v.play().catch(()=>{}));
  }

  document.querySelectorAll('#brightness,#contrast,#gain,#saturation,#filter-select').forEach(el=>{
    el.addEventListener('input',applyImageControls);el.addEventListener('change',applyImageControls);
  });

  menuToggle.addEventListener('click',()=>{
    const open=menuPanel.hidden;
    menuPanel.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));
  });
  document.getElementById('btn-vr').addEventListener('click',()=>vrMode?exitVR():enterVR());
  document.getElementById('btn-sensors').addEventListener('click',requestMotionPermission);
  document.getElementById('btn-horizon').addEventListener('click',()=>{
    reticle.horizonEnabled=!reticle.horizonEnabled;
    document.getElementById('btn-horizon').textContent=reticle.horizonEnabled?'HORIZONTE ON':'HORIZONTE OFF';
  });
  document.getElementById('btn-reset').addEventListener('click',()=>{
    document.getElementById('brightness').value=220;
    document.getElementById('contrast').value=180;
    document.getElementById('gain').value=100;
    document.getElementById('saturation').value=100;
    document.getElementById('filter-select').value='normal';
    reticle.horizonEnabled=true;
    document.getElementById('btn-horizon').textContent='HORIZONTE ON';
    applyImageControls();
  });

  const updateLandscape=()=>{
    const landscape=window.innerWidth>window.innerHeight;
    document.getElementById('orientation-warning').style.display=landscape?'none':'flex';
    requestAnimationFrame(()=>reticle.draw());
  };
  window.addEventListener('resize',updateLandscape);
  window.addEventListener('orientationchange',()=>setTimeout(updateLandscape,120));
  if(screen.orientation)screen.orientation.addEventListener('change',()=>setTimeout(updateLandscape,120));

  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='v')vrMode?exitVR():enterVR();
    if(k==='m')menuToggle.click();
    if(k==='h')document.getElementById('btn-horizon').click();
  });

  applyImageControls();
  updateLandscape();
  const loop=()=>{reticle.draw();requestAnimationFrame(loop);};
  loop();
});
