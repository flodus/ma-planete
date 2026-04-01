// src/views/GlobeView.jsx
// Globe GeoJSON — vraie sphereGeometry + frontières + néons pays
// + Mode monde fictif avec hexagones en relief
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MondeFictif from './MondeFictif.jsx'; // Import du composant hexagones

const RAYON = 5;
const PI    = Math.PI;

const PAYS = {
  france: { label:'FRANCE',    couleur:'#ff0d8c', NAME:'France',   mainland:[-5.5,41.0,9.6,51.2], bbox:[-5.5,41.0,9.6,51.2] },
  italie: { label:'ITALIE',    couleur:'#aaff00', NAME:'Italy',    mainland:null,                  bbox:[6.6,35.5,18.5,47.1] },
  tha:    { label:'THAÏLANDE', couleur:'#00ccff', NAME:'Thailand', mainland:null,                  bbox:[97.4,5.6,105.7,20.4] },
};

// Vertex shader sphère — pas de morphing, r fixe
const vertSphere = `
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r   = uRadius + 0.03;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(
    r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon), 1.0
  );
}`;

// Remplissage sphère — r légèrement en dessous des frontières
const vertSphereRempli = `
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r   = uRadius + 0.01;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(
    r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon), 1.0
  );
}`;

const fragMonde       = `void main(){ gl_FragColor = vec4(0.02, 0.45, 0.65, 0.28); }`;
const fragRemplissage = `void main(){ gl_FragColor = vec4(0.04, 0.22, 0.42, 0.55); }`;

const fragNeon = {
  france: `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4);    gl_FragColor=vec4(1.0,0.05,0.55,p); }`,
  italie: `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4+1.2); gl_FragColor=vec4(0.67,1.0,0.0,p); }`,
  tha:    `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4+0.6); gl_FragColor=vec4(0.0,0.78,1.0,p); }`,
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

function SceneGlobe({ geoData, onClickPays, inversé }) {
  const texture = useMemo(()=>creerTexture(),[]);
  const uMonde  = useMemo(()=>({uRadius:{value:RAYON}}),[]);

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
      monde:     extraireSegments(features, null),
                       mondeFill: extraireRemplissage(features, null),
                       ...Object.fromEntries(Object.entries(PAYS).map(([id,cfg])=>[
                         id, extraireSegments(features.filter(f=>f.properties?.NAME===cfg.NAME), cfg.mainland)
                       ])),
    };
  },[geoData]);

  useFrame((_,delta)=>{
    for(const id of Object.keys(PAYS))
      uPays.current[id].uTime.value += delta;
  });

  const handleClick = e => {
    const pt  = e.point.clone().normalize();
    const lat = Math.asin(THREE.MathUtils.clamp(pt.y,-1,1)) * (180/PI);
    const lon = Math.atan2(pt.x, pt.z) * (180/PI);
    const trouve = Object.entries(PAYS).find(([,c])=>{
      const [l,b,r,t]=c.bbox; return lon>=l&&lon<=r&&lat>=b&&lat<=t;
    });
    onClickPays(trouve?.[0] ?? null);
  };

  const s = inversé ? -1 : 1;

  return (
    <group scale={[s, s, 1]}>
    <mesh>
    <sphereGeometry args={[RAYON, 64, 32]}/>
    <meshBasicMaterial map={texture}/>
    </mesh>

    {geos.mondeFill&&(
      <mesh renderOrder={1}>
      <primitive object={geos.mondeFill} attach="geometry"/>
      <shaderMaterial vertexShader={vertSphereRempli} fragmentShader={fragRemplissage}
      uniforms={uMonde} transparent depthWrite={false} side={THREE.DoubleSide}/>
      </mesh>
    )}

    {geos.monde&&(
      <lineSegments geometry={geos.monde} renderOrder={2}>
      <shaderMaterial vertexShader={vertSphere} fragmentShader={fragMonde}
      uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}

    {Object.entries(PAYS).map(([id])=>geos[id]&&(
      <lineSegments key={id} geometry={geos[id]} renderOrder={5}>
      <shaderMaterial vertexShader={vertSphere} fragmentShader={fragNeon[id]}
      uniforms={uPays.current[id]} transparent depthTest={false} depthWrite={false}/>
      </lineSegments>
    ))}

    <mesh onClick={handleClick}>
    <sphereGeometry args={[RAYON+0.05, 32, 32]}/>
    <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>
    </group>
  );
}

export function GlobeView({ onEnter }) {
  const [geoData,     setGeoData]     = useState(null);
  const [paysSurvolé, setPaysSurvolé] = useState(null);
  const [inversé,     setInversé]     = useState(false);
  const [modeFictif,  setModeFictif]  = useState(false);
  const [seed, setSeed] = useState(42);

  useEffect(()=>{
    fetch('/geojson/ne_110m_admin_0_countries.geojson')
    .then(r=>r.json()).then(setGeoData).catch(console.error);
  },[]);

  // Si mode fictif, afficher les hexagones en relief
  if (modeFictif) {
    return (
      <MondeFictif
      seed={seed}
      onMondeReel={() => setModeFictif(false)}
      onRetour={() => setModeFictif(false)}
      onPaysDoubleClick={() => {}}
      paysSelectionne={null}
      />
    );
  }

  return (
    <div style={{width:'100vw',height:'100vh'}} onDoubleClick={onEnter}>
    <Canvas camera={{position:[0,0,RAYON*3],fov:45}}>
    <color attach="background" args={['#020208']}/>
    <ambientLight intensity={0.15}/>
    <Stars radius={130} depth={60} count={7000} factor={4} saturation={0} fade speed={0.4}/>
    <OrbitControls makeDefault enablePan={false}/>
    <SceneGlobe geoData={geoData} onClickPays={setPaysSurvolé} inversé={inversé}/>
    </Canvas>

    <button onClick={()=>setInversé(v=>!v)} style={ui.btnInv}>
    {inversé ? '↻ normal' : '↕↔ inverser'}
    </button>

    <button onClick={()=>setModeFictif(true)} style={ui.btnFictif}>
    🌍 NOUVEAU MONDE
    </button>

    {paysSurvolé&&(
      <div style={{...ui.badge, color:PAYS[paysSurvolé].couleur, borderColor:`${PAYS[paysSurvolé].couleur}55`}}>
      {PAYS[paysSurvolé].label}
      </div>
    )}
    <div style={ui.ind}>
    {paysSurvolé ? `${PAYS[paysSurvolé].label} · double-clic → planisphère` : 'double-clic → planisphère · clic sur un pays'}
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
  btnFictif: {
    position:'absolute',bottom:'20px',left:'20px',
    padding:'8px 16px',background:'rgba(0,15,35,0.75)',
    border:'1px solid rgba(0,200,255,0.3)',borderRadius:'4px',
    color:'rgba(0,210,255,0.85)',cursor:'pointer',
    fontSize:'0.88rem',fontFamily:'monospace',letterSpacing:'0.06em',
  },
  badge: {
    position:'absolute',top:'22px',left:'50%',transform:'translateX(-50%)',
    padding:'6px 18px',background:'rgba(0,10,25,0.8)',border:'1px solid',
    borderRadius:'3px',fontSize:'0.78rem',fontFamily:'monospace',
    letterSpacing:'0.2em',textTransform:'uppercase',whiteSpace:'nowrap',
  },
  ind: {
    position:'absolute',bottom:'28px',left:'50%',transform:'translateX(-50%)',
    color:'rgba(0,200,255,0.35)',fontSize:'0.78rem',fontFamily:'monospace',
    letterSpacing:'0.08em',textTransform:'uppercase',pointerEvents:'none',whiteSpace:'nowrap',
  },
};
