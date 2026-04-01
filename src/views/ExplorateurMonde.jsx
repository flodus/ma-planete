// src/views/ExplorateurMonde.jsx
// Globe GeoJSON → Mercator → WarRoom pays
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CURSEUR_DEFAUT, CURSEUR_POINTER, CURSEUR_GRAB, CURSEUR_GRABBING } from '../utils/curseurs.js';


const RAYON = 2;
const PI    = Math.PI;

// ─── Shaders ─────────────────────────────────────────────────────────────────

const lineVertexShader = `
uniform float uTransition;
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r = uRadius + 0.08;
  vec3 sphere = vec3(r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon));
  vec3 plane  = vec3(
    position.x / 180.0 * (uRadius * 3.14159265),
                     position.y / 90.0  * (uRadius * 3.14159265 / 2.0),
                     0.06);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(sphere, plane, uTransition), 1.0);
}`;


const fragMonde = `void main() { gl_FragColor = vec4(0.03, 0.55, 0.80, 0.40); }`;

const fondVertexShader = `
uniform float uTransition; uniform float uRadius; varying vec2 vUv;
void main(){
  vUv=uv;
  float lon=(uv.x*2.0-1.0)*3.14159265; float lat=(uv.y-0.5)*3.14159265;
  vec3 sphere=vec3(uRadius*cos(lat)*sin(lon),uRadius*sin(lat),uRadius*cos(lat)*cos(lon));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(sphere,position,uTransition),1.0);
}`;
const fondFrag = `varying vec2 vUv; uniform sampler2D uTexture;
void main(){gl_FragColor=texture2D(uTexture,vUv);}`;

// ─── Texture cyber ────────────────────────────────────────────────────────────
function creerTexture() {
  const c=document.createElement('canvas'); c.width=1024; c.height=512;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(512,256,10,512,256,620);
  g.addColorStop(0,'#060c1e'); g.addColorStop(1,'#02030a');
  ctx.fillStyle=g; ctx.fillRect(0,0,1024,512);
  ctx.strokeStyle='rgba(0,180,255,0.06)'; ctx.lineWidth=0.5;
  for(let i=0;i<1024;i+=32){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i/2);ctx.lineTo(1024,i/2);ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// ─── Extraction segments — tous types GeoJSON ────────────────────────────────
function extraireSegmentsNeon(features, mainland, r=RAYON+0.08) {
  const sphere=[], plane=[];
  const ajouterRing = ring => {
    if(mainland){
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++){
      const la0=ring[i][1]*PI/180,   lo0=ring[i][0]*PI/180;
      const la1=ring[i+1][1]*PI/180, lo1=ring[i+1][0]*PI/180;
      sphere.push(r*Math.cos(la0)*Math.sin(lo0), r*Math.sin(la0), r*Math.cos(la0)*Math.cos(lo0),
                  r*Math.cos(la1)*Math.sin(lo1), r*Math.sin(la1), r*Math.cos(la1)*Math.cos(lo1));
      plane.push(ring[i][0]/180*RAYON*PI,   ring[i][1]/90*RAYON*PI/2,   0.06,
                 ring[i+1][0]/180*RAYON*PI, ring[i+1][1]/90*RAYON*PI/2, 0.06);
    }
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='LineString')         ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  if(!sphere.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sphere), 3));
  geo.setAttribute('aPlane',   new THREE.BufferAttribute(new Float32Array(plane),  3));
  return geo;
}

function extraireSegmentsWarRoom(features, mainland) {
  const pts = [];
  const ajouterRing = ring => {
    if(mainland){
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++){
      const [lon0,lat0]=ring[i], [lon1,lat1]=ring[i+1];
      pts.push(lon0/180*RAYON*PI, lat0/90*RAYON*PI/2, lon0*PI/180,
               lon1/180*RAYON*PI, lat1/90*RAYON*PI/2, lon1*PI/180);
    }
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='LineString')         ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  if(!pts.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

function extraireSegments(features, mainland) {
  const pts = [];
  const ajouterRing = ring => {
    if (mainland) {
      let sx=0,sy=0;
      ring.forEach(p=>{sx+=p[0];sy+=p[1];});
      sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++){
      pts.push(ring[i][0],ring[i][1],0, ring[i+1][0],ring[i+1][1],0);
    }
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='LineString')         ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  if(!pts.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}


// ─── BBox plan pays ───────────────────────────────────────────────────────────
function bboxPlanPays(features, mainland) {
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    polys.forEach(p=>p.forEach(ring=>{
      if(mainland){
        let sx=0,sy=0; ring.forEach(pt=>{sx+=pt[0];sy+=pt[1];});
        sx/=ring.length; sy/=ring.length;
        if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
      }
      ring.forEach(pt=>{
        const x=pt[0]/180*RAYON*PI, y=pt[1]/90*RAYON*PI/2;
        xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);
        yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);
      });
    }));
  });
  return { cx:(xMin+xMax)/2, cy:(yMin+yMax)/2, w:xMax-xMin, h:yMax-yMin };
}

// ─── Couleur néon déterministe (tous pays) ────────────────────────────────────
function couleurNeon(nom) {
  let h = 0;
  for (let i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) & 0xffff;
  // Éviter 165-265° (cyan / bleu proche du fond monde)
  const zones = [[0, 160], [270, 360]];
  const total = zones.reduce((s,[a,b])=>s+b-a, 0);
  let v = h % total, acc = 0, hue = 0;
  for (const [a,b] of zones) {
    if (v < acc+(b-a)) { hue = a+(v-acc); break; }
    acc += b-a;
  }
  return new THREE.Color().setHSL(hue/360, 1.0, 0.55);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useGlobeOrbit(groupRef, actif) {
  const { gl, camera } = useThree();
  const state = useRef({ dragging:false, velY:0, velX:0, lastX:0, lastY:0 });
  useEffect(()=>{
    if(!actif) return;
    const el=gl.domElement;
    const s=state.current;
    const dn=e=>{s.dragging=true;s.lastX=e.clientX;s.lastY=e.clientY;el.style.cursor=CURSEUR_GRABBING;};
    const mv=e=>{
      if(!s.dragging)return;
      s.velY+=(e.clientX-s.lastX)*0.007;
      s.velX+=(e.clientY-s.lastY)*0.004;
      s.lastX=e.clientX; s.lastY=e.clientY;
    };
    const up=()=>{s.dragging=false;el.style.cursor=CURSEUR_GRAB;};
    const wh=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.01,3.5,14);};
    el.style.cursor=CURSEUR_GRAB;
    el.addEventListener('mousedown',dn); window.addEventListener('mousemove',mv);
    window.addEventListener('mouseup',up); el.addEventListener('wheel',wh,{passive:true});
    return ()=>{
      el.style.cursor='';
      el.removeEventListener('mousedown',dn); window.removeEventListener('mousemove',mv);
      window.removeEventListener('mouseup',up); el.removeEventListener('wheel',wh);
    };
  },[gl,camera,actif]);
  return state;
}


function useMercatorZoom(actif, zMin=3, zMax=60) {
  const { gl, camera } = useThree();
  useEffect(()=>{
    if(!actif) return;
    const el=gl.domElement;
    const wh=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.02,zMin,zMax);};
    el.addEventListener('wheel',wh,{passive:true});
    return ()=>{ el.removeEventListener('wheel',wh); };
  },[gl,camera,actif,zMin,zMax]);
}

function ResetCameraPlan({ actif }) {
  const { camera } = useThree();
  useEffect(()=>{
    if(!actif)return;
    camera.position.set(0,0,RAYON*3);
    camera.rotation.set(0,0,0); camera.up.set(0,1,0); camera.lookAt(0,0,0);
  },[actif,camera]);
  return null;
}

function CentreWarRoom({ features, cfg, groupRef }) {
  const { camera } = useThree();
  useEffect(()=>{
    if(!features||!groupRef.current)return;
    const { cx, cy, w, h } = bboxPlanPays(features, cfg.mainland);
    groupRef.current.position.set(-cx,-cy,0);
    const z = Math.max(Math.max(w,h)*1.6, 1.5);
    camera.position.set(0,0,z);
    camera.rotation.set(0,0,0); camera.up.set(0,1,0); camera.lookAt(0,0,0);
  },[features,cfg,camera,groupRef]);
  return null;
}

// ─── Raycasting mercator ──────────────────────────────────────────────────────
function pointDansRing(x, y, ring) {
  let inside = false;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if (((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

function trouverPays(lon, lat, features) {
  for (const f of features) {
    const g=f.geometry; if(!g) continue;
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for (const poly of polys)
      if (poly[0] && pointDansRing(lon, lat, poly[0])) return f;
  }
  return null;
}

// ─── Hitboxes ─────────────────────────────────────────────────────────────────
function HitboxSphere({ features, onClic, onSurvol, groupRef }) {
  const detecter = e => {
    let pt = e.point.clone();
    if (groupRef?.current) pt = groupRef.current.worldToLocal(pt);
    pt.normalize();
    const lat=Math.asin(THREE.MathUtils.clamp(pt.y,-1,1))*(180/PI);
    const lon=Math.atan2(pt.x,pt.z)*(180/PI);
    const found=trouverPays(lon, lat, features||[]);
    return found ? (found.properties?.NAME||found.properties?.ADMIN||'') : null;
  };
  return (
    <mesh
      onClick={e=>onClic(detecter(e))}
      onPointerMove={e=>onSurvol?.(detecter(e))}
      onPointerOut={()=>onSurvol?.(null)}>
    <sphereGeometry args={[RAYON+0.05,32,32]}/>
    <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.FrontSide}/>
    </mesh>
  );
}

// ─── Ligne de scan ────────────────────────────────────────────────────────────
function LigneScan({ couleur }) {
  const ref=useRef();
  useEffect(()=>{
    let s=null;
    const loop=t=>{if(!s)s=t;const p=((t-s)%6000)/6000;if(ref.current){ref.current.style.top=`${p*100}vh`;ref.current._r=requestAnimationFrame(loop);}};
    ref.current._r=requestAnimationFrame(loop);
    return ()=>{ if(ref.current) cancelAnimationFrame(ref.current._r); };
  },[]);
  return <div ref={ref} style={{position:'absolute',left:0,right:0,height:'1px',
    background:`linear-gradient(90deg,transparent 5%,${couleur} 35%,${couleur} 65%,transparent 95%)`,
    boxShadow:`0 0 3px ${couleur}`,pointerEvents:'none',zIndex:50}}/>;
}


// ─── Scène Globe / Mercator ────────────────────────────────────────────────────
function SceneGlobeMercator({
  geoData, isPlanar, paysSurvolé, onClickGlobe, onSurvolMercator,
  onEntrerMercator, mercatorInstantane = false
}) {
  const groupRef=useRef();
  const texture=useMemo(()=>creerTexture(),[]);

  const transLerp = useRef(mercatorInstantane ? 1 : 0);

  const uFond=useMemo(()=>({uTransition:{value: mercatorInstantane?1:0},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture]); // eslint-disable-line
  const uMonde=useMemo(()=>({uTransition:{value: mercatorInstantane?1:0},uRadius:{value:RAYON}}),[]); // eslint-disable-line

  const highlightMat=useRef(null);
  if(!highlightMat.current){
    highlightMat.current=new THREE.ShaderMaterial({
      vertexShader:lineVertexShader,
      fragmentShader:`uniform float uTime; uniform vec3 uCouleur;
void main(){
  float p=clamp(0.80+0.20*sin(uTime*5.0),0.60,1.0);
  gl_FragColor=vec4(uCouleur*p,1.0);
}`,
      uniforms:{
        uTransition:{value:0}, uRadius:{value:RAYON},
        uTime:{value:0}, uCouleur:{value:new THREE.Vector3(1,1,1)},
      },
      transparent:true, depthWrite:false,
    });
  }

  useEffect(()=>{
    if(!highlightMat.current) return;
    const c = paysSurvolé ? couleurNeon(paysSurvolé) : new THREE.Color('#ffffff');
    highlightMat.current.uniforms.uCouleur.value.set(c.r,c.g,c.b);
  },[paysSurvolé]);

  const geos=useMemo(()=>{
    if(!geoData)return{};
    return { monde: extraireSegments(geoData.features, null) };
  },[geoData]);

  const geoHighlight=useMemo(()=>{
    if(!paysSurvolé||!geoData) return null;
    const feats=geoData.features.filter(f=>f.properties?.NAME===paysSurvolé||f.properties?.ADMIN===paysSurvolé||f.properties?.nom===paysSurvolé);
    return feats.length ? extraireSegments(feats, null) : null;
  },[paysSurvolé,geoData]);

  const globeOrbit = useGlobeOrbit(groupRef, !isPlanar);

  // Animation frame — lerp transition globe↔mercator + rotation axiale
  useFrame((_, delta) => {
    const cible = isPlanar ? 1 : 0;
    transLerp.current += (cible - transLerp.current) * Math.min(1, delta * 2.5);
    const t = transLerp.current;

    uFond.uTransition.value  = t;
    uMonde.uTransition.value = t;

    if (highlightMat.current) {
      highlightMat.current.uniforms.uTime.value += delta;
      highlightMat.current.uniforms.uTransition.value = t;
    }

    if (groupRef.current) {
      if (!isPlanar) {
        // Globe : rotation pilotée par drag + auto-rotation + inclinaison 23.5°
        const s = globeOrbit.current;
        groupRef.current.rotation.y += s.velY + (!s.dragging ? delta * 0.08 : 0);
        groupRef.current.rotation.x += s.velX;
        groupRef.current.rotation.z  = 23.5 * PI / 180;
        if (s.dragging) { s.velY = 0; s.velX = 0; }
        else { s.velY *= 0.88; s.velX *= 0.88; }
        groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.08);
      } else {
        // Transition vers mercator : ramener tous les axes à 0
        groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * Math.min(1, delta * 3.5 * t);
        groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * Math.min(1, delta * 3.5 * t);
        groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * Math.min(1, delta * 3.5 * t);
      }
    }
  });

  useMercatorZoom(isPlanar);
  return (
    <group ref={groupRef}>
    <group>
    <mesh renderOrder={0}>
    <planeGeometry args={[RAYON*2*PI,RAYON*PI,64,32]}/>
    <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
    uniforms={uFond} side={THREE.DoubleSide}/>
    </mesh>

    {geos.monde && (
      <lineSegments geometry={geos.monde} renderOrder={2}>
      <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
      uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}

    {geoHighlight && (
      <lineSegments geometry={geoHighlight} material={highlightMat.current} renderOrder={15}/>
    )}

    {!isPlanar && <HitboxSphere features={geoData?.features||[]} onClic={onClickGlobe} onSurvol={onClickGlobe} groupRef={groupRef}/>}

    {isPlanar && (
      <mesh renderOrder={20} position={[0,0,0.4]}
      onClick={e=>{
        const lon=e.point.x*180/(RAYON*PI);
        const lat=e.point.y*90/(RAYON*PI/2);
        const found=trouverPays(lon,lat,geoData?.features||[]);
        const name=found?(found.properties?.NAME||found.properties?.ADMIN||''):null;
        onSurvolMercator(name);
      }}
      onPointerMove={e=>{
        const lon=e.point.x*180/(RAYON*PI);
        const lat=e.point.y*90/(RAYON*PI/2);
        const found=trouverPays(lon,lat,geoData?.features||[]);
        const name=found?(found.properties?.NAME||found.properties?.ADMIN||''):null;
        onSurvolMercator(name);
      }}
      onPointerOut={()=>onSurvolMercator(null)}
      onDoubleClick={e=>{
        const lon=e.point.x*180/(RAYON*PI);
        const lat=e.point.y*90/(RAYON*PI/2);
        const found=trouverPays(lon,lat,geoData?.features||[]);
        if(!found) return;
        const name=found.properties?.NAME||'';
        if(name) onEntrerMercator(name);
      }}>
      <planeGeometry args={[RAYON*2*PI,RAYON*PI]}/>
      <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
      </mesh>
    )}
    </group>
    </group>
  );
}

// ─── Scène WarRoom ────────────────────────────────────────────────────────────
function SceneWarRoom({ geoData, cfg }) {
  const groupRef=useRef();
  const texture=useMemo(()=>creerTexture(),[]);
  const uFond=useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture]);
  const uMonde=useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON}}),[]);
  const geoMonde=useMemo(()=>geoData?extraireSegments(geoData.features,null):null,[geoData]);

  const featuresPays=useMemo(()=>{
    if(!geoData||!cfg)return null;
    return geoData.features.filter(f=>f.properties?.NAME===cfg.NAME);
  },[geoData,cfg]);

  return (
    <group ref={groupRef}>
    <CentreWarRoom features={featuresPays} cfg={cfg} groupRef={groupRef}/>
    <mesh renderOrder={0}>
    <planeGeometry args={[RAYON*2*PI,RAYON*PI,32,16]}/>
    <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
    uniforms={uFond} side={THREE.DoubleSide}/>
    </mesh>
    {geoMonde && (
      <lineSegments geometry={geoMonde} renderOrder={1}>
      <shaderMaterial vertexShader={lineVertexShader}
      fragmentShader={`void main(){gl_FragColor=vec4(0.03,0.45,0.70,0.20);}`}
      uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}
    </group>
  );
}

// ─── UI Styles ────────────────────────────────────────────────────────────────
const ui={
  c:  {position:'absolute',inset:0,pointerEvents:'none',zIndex:100},
  btn:{position:'absolute',top:'20px',left:'20px',pointerEvents:'all',
    padding:'8px 16px',background:'rgba(0,15,35,0.75)',
    border:'1px solid rgba(0,200,255,0.3)',borderRadius:'4px',
    color:'rgba(0,210,255,0.85)',cursor:CURSEUR_POINTER,fontSize:'0.88rem',fontFamily:'monospace',letterSpacing:'0.06em'},
  badge:{position:'absolute',top:'22px',left:'50%',transform:'translateX(-50%)',
    padding:'6px 18px',background:'rgba(0,10,25,0.8)',border:'1px solid',borderRadius:'3px',
    fontSize:'0.78rem',fontFamily:'monospace',letterSpacing:'0.2em',textTransform:'uppercase',whiteSpace:'nowrap'},
  ind:{position:'absolute',bottom:'28px',left:'50%',transform:'translateX(-50%)',
    color:'rgba(0,200,255,0.35)',fontSize:'0.78rem',fontFamily:'monospace',
    letterSpacing:'0.08em',textTransform:'uppercase',whiteSpace:'nowrap',pointerEvents:'none'},
};

// ─── Composant principal ──────────────────────────────────────────────────────
export function ExplorateurMonde({ initialVue = 'globe', sansTransition = false }) {
  const [vue, setVue] = useState(initialVue);
  const [paysFocus, setPaysFocus] = useState(null);
  const [paysSurvolé, setPaysSurvolé] = useState(null);
  const [geo110, setGeo110] = useState(null);
  const [geo50, setGeo50] = useState(null);
  const [geo10, setGeo10] = useState(null);
  useEffect(()=>{
    fetch('/geojson/ne_110m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo110).catch(console.error);
    fetch('/geojson/ne_50m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo50).catch(console.error);
    fetch('/geojson/ne_10m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo10).catch(console.error);
  },[]);

  const changerVue = useCallback((v) => {
    if (v === vue) return;
    setVue(v);
    setPaysSurvolé(null);
  }, [vue]);

  const estGlobe   = vue === 'globe';
  const estMercator = vue === 'mercator';
  const estWarRoom  = vue === 'warroom';

  const geoActuel = estMercator ? geo50 : geo110;
  const cfg = paysFocus ? { NAME: paysFocus, mainland: null } : null;

  return (
    <div style={{position:'fixed', inset:0, overflow:'hidden', backgroundColor:'#000'}}>
    {!estWarRoom && (
      <div style={{width:'100%', height:'100%'}}
      onDoubleClick={estGlobe ? () => changerVue('mercator') : undefined}>
      <Canvas camera={{position:[0,0,RAYON*3], fov:45}}>
      <color attach="background" args={['#020208']}/>
      <ambientLight intensity={0.15}/>
      <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.4}/>
      <ResetCameraPlan actif={estMercator}/>
      <SceneGlobeMercator
      geoData={geoActuel}
      isPlanar={estMercator}
      paysSurvolé={paysSurvolé}
      onClickGlobe={id => setPaysSurvolé(id)}
      onSurvolMercator={id => setPaysSurvolé(id)}
      onEntrerMercator={name => {
        setPaysFocus(name);
        setVue('warroom');
      }}
      mercatorInstantane={sansTransition && initialVue === 'mercator'}
      />
      </Canvas>
      </div>
    )}

    {estWarRoom && cfg && (
      <>
      <Canvas camera={{position:[0,0,RAYON*3], fov:45}}>
      <color attach="background" args={['#020208']}/>
      <ambientLight intensity={0.1}/>
      <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.2}/>
      <SceneWarRoom geoData={geo10} cfg={cfg}/>
      </Canvas>
      </>
    )}

    {/* UI */}
    <div style={ui.c}>
    {estGlobe && (
      <>
      {paysSurvolé && (()=>{
        const c = couleurNeon(paysSurvolé);
        const hex = `#${c.getHexString()}`;
        const rgba = `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0.3)`;
        return <div style={{...ui.badge, color:hex, borderColor:rgba}}>
          {paysSurvolé}
        </div>;
      })()}
      <div style={ui.ind}>double-clic → planisphère · clic sur un pays pour le voir</div>
</>
    )}
    {estMercator && (
      <>
      <button style={ui.btn} onClick={() => changerVue('globe')}>← Globe</button>
      <div style={ui.ind}>
      {paysSurvolé
        ? <><span style={{color:'#00e5ff'}}>{paysSurvolé}</span>{' — double-clic pour entrer'}</>
        : 'clic → pays · double-clic → entrer'
      }
      </div>
      </>
    )}
    {estWarRoom && cfg && (
      <>
      <button style={ui.btn} onClick={() => changerVue('mercator')}>← Planisphère</button>
      <div style={{...ui.badge, color:'rgba(0,210,255,0.85)', borderColor:'rgba(0,200,255,0.3)'}}>
      ▶ {cfg.NAME} — WAR ROOM
      </div>
      <div style={ui.ind}>drag + molette</div>
      </>
    )}
    </div>
    </div>
  );
}
