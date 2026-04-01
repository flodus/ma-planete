// src/components/MorphingCanvas.jsx
// Phase 1 — Globe décoratif (identique à PlanetCanvas : axe 23.5°, néons, rotation)
// Phase 2 — Morph globe → mercator (déclenché par morphPret)
// Phase 3 — Pause 0.5s puis fondu au noir → onMorphFini

import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CURSEUR_DEFAUT } from '../utils/curseurs.js';

const RAYON = 5;
const PI    = Math.PI;

const DUREE_MORPH = 2.2;
const DUREE_PAUSE = 0.5;
const DUREE_FONDU = 0.5;

// ─── Config néons (identique à PlanetCanvas) ──────────────────────────────────
const PAYS_NEON = {
  france:    { NAME:'France',                  mainland:[-5.5, 41.0,  9.6, 51.2] },
  usa:       { NAME:'United States of America',mainland:[-125, 24.0,-66.0, 50.0] },
  chine:     { NAME:'China',                   mainland:null },
  russie:    { NAME:'Russia',                  mainland:null },
  bresil:    { NAME:'Brazil',                  mainland:null },
  inde:      { NAME:'India',                   mainland:null },
  allemagne: { NAME:'Germany',                 mainland:null },
  japon:     { NAME:'Japan',                   mainland:null },
  nigeria:   { NAME:'Nigeria',                 mainland:null },
  arabie:    { NAME:'Saudi Arabia',            mainland:null },
};

// ─── Shaders ─────────────────────────────────────────────────────────────────

// Frontières monde — lon/lat → sphère ou plan selon uTransition
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

// Fond — sphère → plan selon uTransition
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

// Néons — positions sphère pré-calculées, s'effacent via uAlpha
const neonVertexShader = `
varying float vScan;
void main() {
  vScan = atan(position.x, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const neonFrag = (r, g, b) =>
  `uniform float uTime; uniform float uAlpha; varying float vScan;
void main(){
  float p=clamp(0.25+0.15*sin(vScan-uTime*0.5),0.10,0.38);
  gl_FragColor=vec4(${r},${g},${b},p*uAlpha);
}`;

const NEON_COLORS = {
  france:    neonFrag(1.0,  0.05, 0.55),
  usa:       neonFrag(0.45, 0.10, 1.0),
  chine:     neonFrag(1.0,  0.15, 0.15),
  russie:    neonFrag(0.65, 0.20, 1.0),
  bresil:    neonFrag(0.15, 1.0,  0.30),
  inde:      neonFrag(1.0,  0.50, 0.0),
  allemagne: neonFrag(1.0,  0.80, 0.0),
  japon:     neonFrag(1.0,  0.0,  0.75),
  nigeria:   neonFrag(0.85, 1.0,  0.0),
  arabie:    neonFrag(0.90, 0.75, 0.10),
};

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

// ─── Extraction géométries ────────────────────────────────────────────────────

// Frontières monde en lon/lat (pour le morph shader)
function extraireSegmentsLonLat(features) {
  const pts = [];
  const ajouterRing = ring => {
    for(let i=0;i<ring.length-1;i++)
      pts.push(new THREE.Vector3(ring[i][0],ring[i][1],0),
               new THREE.Vector3(ring[i+1][0],ring[i+1][1],0));
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon') g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

// Néons — positions sphère pré-calculées (comme PlanetCanvas)
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
    if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon') g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  if(!sphere.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sphere), 3));
  return geo;
}

function smoothstep(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

// ─── Scène ────────────────────────────────────────────────────────────────────
function SceneGlobeMorph({ geoData, morphPretRef, onMorphFiniRef, fonduDivRef }) {
  const groupRef   = useRef();
  const transLerp  = useRef(0);
  const cible      = useRef(0);
  const morphTemps = useRef(0);
  const morphFiniSignale = useRef(false);

  const texture = useMemo(()=>creerTexture(),[]);
  const uFond   = useMemo(()=>({uTransition:{value:0},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture]);
  const uMonde  = useMemo(()=>({uTransition:{value:0},uRadius:{value:RAYON}}),[]);

  // Matériaux néons (avec uAlpha pour le fondu)
  const neonMats = useRef(null);
  if (!neonMats.current) {
    neonMats.current = {};
    for (const id of Object.keys(PAYS_NEON))
      neonMats.current[id] = new THREE.ShaderMaterial({
        vertexShader: neonVertexShader,
        fragmentShader: NEON_COLORS[id],
        uniforms: { uTime:{value:0}, uAlpha:{value:1} },
        transparent: true, depthWrite: false,
      });
  }

  const geos = useMemo(()=>{
    if (!geoData) return {};
    const features = geoData.features;
    return {
      monde: extraireSegmentsLonLat(features),
      ...Object.fromEntries(Object.entries(PAYS_NEON).map(([id,cfg])=>[
        id, extraireSegmentsNeon(features.filter(f=>f.properties?.NAME===cfg.NAME), cfg.mainland)
      ])),
    };
  },[geoData]);

  useFrame((_,delta)=>{
    const morphActif = morphPretRef.current;

    if (morphActif) {
      morphTemps.current += delta;
      cible.current = smoothstep(Math.min(1, morphTemps.current / DUREE_MORPH));

      // Fondu au noir après la pause
      const tFondu = morphTemps.current - DUREE_MORPH - DUREE_PAUSE;
      const f = smoothstep(tFondu / DUREE_FONDU);
      if (fonduDivRef.current) fonduDivRef.current.style.opacity = String(Math.max(0, f));

      if (tFondu >= DUREE_FONDU && !morphFiniSignale.current) {
        morphFiniSignale.current = true;
        onMorphFiniRef.current?.();
      }
    }

    // Lerp fluide vers la cible
    transLerp.current += (cible.current - transLerp.current) * Math.min(1, delta * 3.5);
    const t = transLerp.current;

    uFond.uTransition.value  = t;
    uMonde.uTransition.value = t;

    // Néons : s'effacent dans la première moitié du morph
    const neonAlpha = Math.max(0, 1 - t * 2.5);
    for (const id of Object.keys(PAYS_NEON)) {
      neonMats.current[id].uniforms.uTime.value  += delta;
      neonMats.current[id].uniforms.uAlpha.value  = neonAlpha;
    }

    if (groupRef.current) {
      if (!morphActif) {
        // Phase globe : rotation + inclinaison axiale 23.5° (comme PlanetCanvas)
        groupRef.current.rotation.y += delta * 0.08;
        groupRef.current.rotation.z  = 23.5 * PI / 180;
        groupRef.current.position.y  = -0.8;
      } else {
        // Phase morph : ramener axe et position vers neutre
        groupRef.current.rotation.y += delta * 0.08 * (1 - t);
        groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * Math.min(1, delta * 3.5 * t);
        groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * Math.min(1, delta * 3.5 * t);
        groupRef.current.position.y += (0 - groupRef.current.position.y) * Math.min(1, delta * 3.5 * t);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <mesh renderOrder={0}>
        <planeGeometry args={[RAYON*2*PI,RAYON*PI,64,32]}/>
        <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
          uniforms={uFond} side={THREE.DoubleSide}/>
      </mesh>
      {geos.monde&&(
        <lineSegments geometry={geos.monde} renderOrder={2}>
          <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false}/>
        </lineSegments>
      )}
      {Object.keys(PAYS_NEON).map(id=>geos[id]&&(
        <lineSegments key={id} geometry={geos[id]} material={neonMats.current[id]} renderOrder={10}/>
      ))}
    </group>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function MorphingCanvas({ progress = 0, morphPret, onMorphFini }) {
  const [geoData, setGeoData] = useState(null);
  useEffect(()=>{
    fetch('/geojson/ne_110m_admin_0_countries.geojson')
      .then(r=>r.json()).then(setGeoData).catch(()=>{});
  },[]);

  const morphPretRef     = useRef(false);
  morphPretRef.current   = morphPret;
  const onMorphFiniRef   = useRef(onMorphFini);
  onMorphFiniRef.current = onMorphFini;
  const fonduDivRef      = useRef(null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{position:[0,0,RAYON*3.3],fov:45}} gl={{antialias:true}} style={{width:'100%',height:'100%',cursor:CURSEUR_DEFAUT}}>
        <color attach="background" args={['#020208']}/>
        <ambientLight intensity={0.1}/>
        <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.3}/>
        <SceneGlobeMorph
          geoData={geoData}
          morphPretRef={morphPretRef}
          onMorphFiniRef={onMorphFiniRef}
          fonduDivRef={fonduDivRef}
        />
      </Canvas>

      {/* Barre de progression — en haut, comme ARIA */}
      {!morphPret && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '3px',
          background: 'rgba(20,30,44,0.9)',
          borderBottom: '1px solid rgba(200,164,74,0.15)',
          pointerEvents: 'none',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'rgba(200,164,74,0.85)',
            transition: 'width 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}/>
        </div>
      )}

      {/* L'histoire se réécrit — en bas */}
      <div style={{
        position: 'absolute', bottom: '8vh', left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(14,20,36,0.45)',
          border: '1px solid rgba(200,164,74,0.22)',
          borderRadius: '2px', padding: '0.8rem 2.8rem',
          backdropFilter: 'blur(6px)',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.52rem', letterSpacing: '0.25em',
            color: 'rgba(200,164,74,0.85)',
          }}>
            L'HISTOIRE SE RÉÉCRIT...
          </span>
        </div>
      </div>

      {/* Fondu au noir — mis à jour directement depuis useFrame */}
      <div ref={fonduDivRef} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(2,2,8,1)',
        opacity: 0,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
