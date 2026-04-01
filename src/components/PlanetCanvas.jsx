// src/components/PlanetCanvas.jsx
//
// Globe 3D décoratif pour l'écran d'init :
// - Rotation automatique (pas d'OrbitControls)
// - Néons 10 pays : France, USA, Chine, Russie, Brésil, Inde, Allemagne, Japon, Nigeria, Arabie Saoudite
// - Non interactif

import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CURSEUR_DEFAUT } from '../utils/curseurs.js';

const RAYON = 5;
const PI    = Math.PI;

// ─── Config pays ──────────────────────────────────────────────────────────────
// mainland : [lonMin, latMin, lonMax, latMax] pour exclure les territoires d'outre-mer
const PAYS = {
  france:  { NAME:'France',                 mainland:[-5.5, 41.0,   9.6, 51.2] },
  usa:     { NAME:'United States of America',mainland:[-125, 24.0, -66.0, 50.0] },
  chine:   { NAME:'China',                  mainland:null },
  russie:  { NAME:'Russia',                 mainland:null },
  bresil:  { NAME:'Brazil',                 mainland:null },
  inde:    { NAME:'India',                  mainland:null },
  allemagne:{ NAME:'Germany',               mainland:null },
  japon:   { NAME:'Japan',                  mainland:null },
  nigeria: { NAME:'Nigeria',                mainland:null },
  arabie:  { NAME:'Saudi Arabia',           mainland:null },
};

// ─── Shaders ─────────────────────────────────────────────────────────────────

// Frontières monde — lon/lat → sphère en GLSL
const lineVertexShader = `
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r = uRadius + 0.08;
  vec3 sphere = vec3(r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(sphere, 1.0);
}`;

// Néons — positions sphère pré-calculées, vScan = longitude
const neonVertexShader = `
varying float vScan;
void main() {
  vScan = atan(position.x, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragMonde = `void main() { gl_FragColor = vec4(0.03, 0.55, 0.80, 0.35); }`;

// Génère un fragment shader néon avec la couleur donnée
const neonFrag = (r, g, b) =>
  `uniform float uTime; varying float vScan;
void main(){ float p=clamp(0.25+0.15*sin(vScan-uTime*0.5),0.10,0.38); gl_FragColor=vec4(${r},${g},${b},p); }`;

const NEON_COLORS = {
  france:   neonFrag(1.0,  0.05, 0.55),  // rose
  usa:      neonFrag(0.45, 0.10, 1.0),   // indigo
  chine:    neonFrag(1.0,  0.15, 0.15),  // rouge
  russie:   neonFrag(0.65, 0.20, 1.0),   // violet
  bresil:   neonFrag(0.15, 1.0,  0.30),  // vert lime
  inde:     neonFrag(1.0,  0.50, 0.0),   // orange
  allemagne:neonFrag(1.0,  0.80, 0.0),   // ambre
  japon:    neonFrag(1.0,  0.0,  0.75),  // magenta
  nigeria:  neonFrag(0.85, 1.0,  0.0),   // chartreuse
  arabie:   neonFrag(0.90, 0.75, 0.10),  // or
};

const globeVertexShader = `
uniform float uRadius; varying vec2 vUv;
void main(){
  vUv=uv;
  float lon=(uv.x*2.0-1.0)*3.14159265; float lat=(uv.y-0.5)*3.14159265;
  vec3 sphere=vec3(uRadius*cos(lat)*sin(lon),uRadius*sin(lat),uRadius*cos(lat)*cos(lon));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(sphere,1.0);
}`;
const globeFrag = `varying vec2 vUv; uniform sampler2D uTexture;
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

// ─── Extraction segments ──────────────────────────────────────────────────────
function extraireSegmentsNeon(features, mainland, r=RAYON+0.08) {
  const sphere=[];
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
  return geo;
}

function extraireSegments(features, mainland) {
  const pts = [];
  const ajouterRing = ring => {
    if(mainland){
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++)
      pts.push(new THREE.Vector3(ring[i][0],ring[i][1],0),
               new THREE.Vector3(ring[i+1][0],ring[i+1][1],0));
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='LineString')         ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')       g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')  g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

// ─── Scène globe décoratif ────────────────────────────────────────────────────
function ScenePlanet({ geoData, rotationX = 0.0005 }) {
  const groupRef = useRef();
  const texture  = useMemo(()=>creerTexture(),[]);
  const uGlobe   = useMemo(()=>({uRadius:{value:RAYON},uTexture:{value:texture}}),[texture]);
  const uMonde   = useMemo(()=>({uRadius:{value:RAYON}}),[]);

  const neonMats = useRef(null);
  if(!neonMats.current){
    neonMats.current = {};
    for(const id of Object.keys(PAYS))
      neonMats.current[id] = new THREE.ShaderMaterial({
        vertexShader: neonVertexShader,
        fragmentShader: NEON_COLORS[id],
        uniforms: { uTime:{value:0} },
        transparent: true, depthWrite: false,
      });
  }

  const geos = useMemo(()=>{
    if(!geoData) return {};
    const features = geoData.features;
    return {
      monde: extraireSegments(features, null),
      ...Object.fromEntries(Object.entries(PAYS).map(([id,cfg])=>[
        id, extraireSegmentsNeon(features.filter(f=>f.properties?.NAME===cfg.NAME), cfg.mainland)
      ])),
    };
  },[geoData]);

  useFrame((_,delta)=>{
    if(groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
      groupRef.current.rotation.z  = 23.5 * PI / 180; // inclinaison axiale terrestre
      groupRef.current.position.y  = -0.8;
    }
    for(const id of Object.keys(PAYS))
      neonMats.current[id].uniforms.uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <mesh renderOrder={0}>
        <planeGeometry args={[RAYON*2*PI,RAYON*PI,64,32]}/>
        <shaderMaterial vertexShader={globeVertexShader} fragmentShader={globeFrag}
          uniforms={uGlobe} side={THREE.DoubleSide}/>
      </mesh>
      {geos.monde&&(
        <lineSegments geometry={geos.monde} renderOrder={1}>
          <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false}/>
        </lineSegments>
      )}
      {Object.entries(PAYS).map(([id])=>geos[id]&&(
        <lineSegments key={id} geometry={geos[id]} material={neonMats.current[id]} renderOrder={10}/>
      ))}
    </group>
  );
}

// ─── Composant exporté ────────────────────────────────────────────────────────
export default function PlanetCanvas() {
  const [geoData, setGeoData] = useState(null);

  useEffect(()=>{
    fetch('/geojson/ne_110m_admin_0_countries.geojson')
      .then(r=>r.json()).then(setGeoData).catch(()=>{});
  },[]);

  return (
    <Canvas
      camera={{ position:[0,0,RAYON*3.3], fov:45 }}
      style={{ width:'100%', height:'100%', cursor:CURSEUR_DEFAUT }}
      gl={{ antialias:true }}
    >
      <color attach="background" args={['#020208']}/>
      <ambientLight intensity={0.1}/>
      <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.3}/>
      <ScenePlanet geoData={geoData}/>
    </Canvas>
  );
}
