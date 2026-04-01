// src/views/MercatorView.jsx
// Planisphère GeoJSON — fond plat + frontières + néons pays + drag/zoom
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

const RAYON = 5;
const PI    = Math.PI;

const PAYS = {
  france: { label:'FRANCE',    couleur:'#ff0d8c', scan:'rgba(255,13,140,0.25)',  NAME:'France',   mainland:[-5.5,41.0,9.6,51.2], bbox:[-5.5,41.0,9.6,51.2] },
  italie: { label:'ITALIE',    couleur:'#aaff00', scan:'rgba(170,255,0,0.25)',   NAME:'Italy',    mainland:null,                  bbox:[6.6,35.5,18.5,47.1] },
  tha:    { label:'THAÏLANDE', couleur:'#00ccff', scan:'rgba(0,200,255,0.25)',   NAME:'Thailand', mainland:null,                  bbox:[97.4,5.6,105.7,20.4] },
};

// Vertex shader mercator — frontières (z=0.06) et remplissages (z=0.03)
const vertPlan = `
uniform float uRadius;
void main() {
  float x = position.x / 180.0 * (uRadius * 3.14159265);
  float y = position.y / 90.0  * (uRadius * 3.14159265 / 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.06, 1.0);
}`;

const vertRempli = `
uniform float uRadius;
void main() {
  float x = position.x / 180.0 * (uRadius * 3.14159265);
  float y = position.y / 90.0  * (uRadius * 3.14159265 / 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.03, 1.0);
}`;

const fragMonde      = `void main(){ gl_FragColor = vec4(0.02, 0.45, 0.65, 0.28); }`;
const fragRemplissage= `void main(){ gl_FragColor = vec4(0.04, 0.22, 0.42, 0.55); }`;

const fragNeon = {
  france: `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4);    gl_FragColor=vec4(1.0,0.05,0.55,p); }`,
  italie: `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4+1.2); gl_FragColor=vec4(0.67,1.0,0.0,p); }`,
  tha:    `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4+0.6); gl_FragColor=vec4(0.0,0.78,1.0,p); }`,
};
const fragNeonRempli = {
  france: `uniform float uTime; void main(){ float p=0.18+0.07*sin(uTime*2.4);    gl_FragColor=vec4(1.0,0.05,0.55,p); }`,
  italie: `uniform float uTime; void main(){ float p=0.18+0.07*sin(uTime*2.4+1.2); gl_FragColor=vec4(0.67,1.0,0.0,p); }`,
  tha:    `uniform float uTime; void main(){ float p=0.18+0.07*sin(uTime*2.4+0.6); gl_FragColor=vec4(0.0,0.78,1.0,p); }`,
};

function creerTexture() {
  const c = document.createElement('canvas'); c.width=1024; c.height=512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(512,256,10,512,256,620);
  g.addColorStop(0,'#0e1a40'); g.addColorStop(1,'#03040c');
  ctx.fillStyle=g; ctx.fillRect(0,0,1024,512);
  ctx.strokeStyle='rgba(0,180,255,0.06)'; ctx.lineWidth=0.5;
  for(let i=0;i<1024;i+=32){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i/2);ctx.lineTo(1024,i/2);ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// Triangulation directe via ShapeUtils — robuste sur polygones complexes (USA, Russie...)
function extraireRemplissage(features, mainland) {
  const pos = [];
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    polys.forEach(poly=>{
      if(!poly.length||poly[0].length<4) return;
      if(mainland){
        let sx=0,sy=0; poly[0].forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=poly[0].length; sy/=poly[0].length;
        if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
      }
      try{
        const contour = poly[0].map(p=>new THREE.Vector2(p[0],p[1]));
        const holes   = poly.slice(1).map(h=>h.map(p=>new THREE.Vector2(p[0],p[1])));
        THREE.ShapeUtils.triangulateShape(contour,holes).forEach(tri=>
          tri.forEach(idx=>pos.push(contour[idx].x, contour[idx].y, 0))
        );
      }catch(_){}
    });
  });
  if(!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return geo;
}

function extraireSegments(features, mainland) {
  const pts = [];
  const ajouterRing = ring => {
    if(mainland) {
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++)
      pts.push(new THREE.Vector3(ring[i][0],ring[i][1],0), new THREE.Vector3(ring[i+1][0],ring[i+1][1],0));
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='LineString')          ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

// Hook drag + zoom (doit être appelé depuis un composant dans Canvas)
function useDragZoom(groupRef, zMin=3, zMax=60) {
  const { gl, camera } = useThree();
  useEffect(()=>{
    const el = gl.domElement;
    let on=false, ox=0, oy=0;
    const dn = e=>{on=true;ox=e.clientX;oy=e.clientY;el.style.cursor='grabbing';};
    const mv = e=>{
      if(!on||!groupRef.current) return;
      const f = camera.position.z * 0.002;
      groupRef.current.position.x += (e.clientX-ox)*f;
      groupRef.current.position.y -= (e.clientY-oy)*f;
      ox=e.clientX; oy=e.clientY;
    };
    const up = ()=>{on=false;el.style.cursor='grab';};
    const wh = e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.02,zMin,zMax);};
    el.style.cursor='grab';
    el.addEventListener('mousedown',dn); window.addEventListener('mousemove',mv);
    window.addEventListener('mouseup',up); el.addEventListener('wheel',wh,{passive:true});
    return ()=>{
      el.style.cursor='';
      el.removeEventListener('mousedown',dn); window.removeEventListener('mousemove',mv);
      window.removeEventListener('mouseup',up); el.removeEventListener('wheel',wh);
    };
  },[gl,camera,groupRef,zMin,zMax]);
}

function SceneMercator({ geoData, onClic, onDbl, inversé }) {
  const groupRef = useRef();
  const texture  = useMemo(()=>creerTexture(),[]);
  const uMonde   = useMemo(()=>({uRadius:{value:RAYON}}),[]);

  const uPays = useRef(null);
  if(!uPays.current) {
    uPays.current = {};
    for(const id of Object.keys(PAYS))
      uPays.current[id] = { uRadius:{value:RAYON}, uTime:{value:0} };
  }

  const geos = useMemo(()=>{
    if(!geoData) return {};
    const features = geoData.features;
    return {
      monde:      extraireSegments(features, null),
      mondeFill:  extraireRemplissage(features, null),
      ...Object.fromEntries(Object.entries(PAYS).flatMap(([id,cfg])=>{
        const feat = features.filter(f=>f.properties?.NAME===cfg.NAME);
        return [
          [id,          extraireSegments(feat, cfg.mainland)],
          [id+'Fill',   extraireRemplissage(feat, cfg.mainland)],
        ];
      })),
    };
  },[geoData]);

  useDragZoom(groupRef);

  useFrame((_,delta)=>{
    for(const id of Object.keys(PAYS))
      uPays.current[id].uTime.value += delta;
  });

  const s = inversé ? -1 : 1;

  return (
    <group ref={groupRef} position={[0,-1.5,0]}>
      <group scale={[s, s, 1]}>
        {/* Fond plan */}
        <mesh>
          <planeGeometry args={[RAYON*2*PI, RAYON*PI]}/>
          <meshBasicMaterial map={texture}/>
        </mesh>

        {/* Remplissage monde — z=0.03, sous les frontières */}
        {geos.mondeFill&&(
          <mesh geometry={geos.mondeFill} renderOrder={1}>
            <shaderMaterial vertexShader={vertRempli} fragmentShader={fragRemplissage}
              uniforms={uMonde} transparent depthWrite={false} side={THREE.DoubleSide}/>
          </mesh>
        )}

        {/* Frontières mondiales */}
        {geos.monde&&(
          <lineSegments geometry={geos.monde} renderOrder={2}>
            <shaderMaterial vertexShader={vertPlan} fragmentShader={fragMonde}
              uniforms={uMonde} transparent depthWrite={false}/>
          </lineSegments>
        )}

        {/* Remplissage pays néon — z=0.03, juste sous les lignes */}
        {Object.entries(PAYS).map(([id])=>geos[id+'Fill']&&(
          <mesh key={id+'Fill'} geometry={geos[id+'Fill']} renderOrder={3}>
            <shaderMaterial vertexShader={vertRempli} fragmentShader={fragNeonRempli[id]}
              uniforms={uPays.current[id]} transparent depthWrite={false} side={THREE.DoubleSide}/>
          </mesh>
        ))}

        {/* Néons pays — frontières, z=0.06 > plan à z=0, toujours devant */}
        {Object.entries(PAYS).map(([id])=>geos[id]&&(
          <lineSegments key={id} geometry={geos[id]} renderOrder={5}>
            <shaderMaterial vertexShader={vertPlan} fragmentShader={fragNeon[id]}
              uniforms={uPays.current[id]} transparent depthTest={false} depthWrite={false}/>
          </lineSegments>
        ))}

        {/* Hitboxes pays — clic = highlight, double-clic = entrer */}
        {Object.entries(PAYS).map(([id,cfg])=>{
          const [l,b,r,t] = cfg.bbox;
          const cx = ((l+r)/2)/180*RAYON*PI, cy = ((b+t)/2)/90*RAYON*PI/2;
          const w  = Math.abs(r-l)/180*RAYON*PI, h  = Math.abs(t-b)/90*RAYON*PI/2;
          return(
            <mesh key={id} position={[cx,cy,0.3]}
              onClick={e=>{e.stopPropagation();onClic(id);}}
              onDoubleClick={e=>{e.stopPropagation();onDbl(id);}}>
              <planeGeometry args={[w,h]}/>
              <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export function MercatorView({ onEnter, onBack }) {
  const [geoData,     setGeoData]     = useState(null);
  const [paysSurvolé, setPaysSurvolé] = useState(null);
  const [inversé,     setInversé]     = useState(false);

  useEffect(()=>{
    fetch('/geojson/ne_50m_admin_0_countries.geojson')
      .then(r=>r.json()).then(setGeoData).catch(console.error);
  },[]);

  return (
    <div style={{width:'100vw',height:'100vh'}}>
      <Canvas camera={{position:[0,0,RAYON*3],fov:45}}>
        <color attach="background" args={['#020208']}/>
        <ambientLight intensity={0.15}/>
        <Stars radius={130} depth={60} count={5000} factor={4} saturation={0} fade speed={0.3}/>
        <SceneMercator
          geoData={geoData}
          onClic={setPaysSurvolé}
          onDbl={onEnter}
          inversé={inversé}
        />
      </Canvas>

      <button onClick={onBack} style={ui.btn}>← Globe</button>
      <button onClick={()=>setInversé(v=>!v)} style={ui.btnInv}>
        {inversé ? '↻ normal' : '↕↔ inverser'}
      </button>

      <div style={ui.ind}>
        {paysSurvolé
          ? <><span style={{color:PAYS[paysSurvolé].couleur}}>{PAYS[paysSurvolé].label}</span> — double-clic pour entrer</>
          : Object.values(PAYS).map((c,i)=>(
              <span key={i}><span style={{color:c.couleur}}>{c.label}</span>{i<2?' / ':''}</span>
            ))
        }
      </div>
    </div>
  );
}

const ui = {
  btnInv: {
    position:'absolute',bottom:'20px',right:'20px',
    padding:'8px 16px',background:'rgba(0,15,35,0.75)',
    border:'1px solid rgba(0,200,255,0.3)',borderRadius:'4px',
    color:'rgba(0,210,255,0.85)',cursor:'pointer',
    fontSize:'0.88rem',fontFamily:'monospace',letterSpacing:'0.06em',
  },
  btn: {
    position:'absolute',top:'20px',left:'20px',
    padding:'8px 16px',background:'rgba(0,15,35,0.75)',
    border:'1px solid rgba(0,200,255,0.3)',borderRadius:'4px',
    color:'rgba(0,210,255,0.85)',cursor:'pointer',
    fontSize:'0.88rem',fontFamily:'monospace',letterSpacing:'0.06em',
  },
  ind: {
    position:'absolute',bottom:'28px',left:'50%',transform:'translateX(-50%)',
    color:'rgba(0,200,255,0.35)',fontSize:'0.78rem',fontFamily:'monospace',
    letterSpacing:'0.08em',textTransform:'uppercase',pointerEvents:'none',whiteSpace:'nowrap',
  },
};
