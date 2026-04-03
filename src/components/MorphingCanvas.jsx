// src/components/MorphingCanvas.jsx
// Phase 1 — Globe décoratif (identique à PlanetCanvas : axe 23.5°, néons, rotation)
// Phase 2 — Morph globe → mercator (déclenché par morphPret)
// Phase 3 — Pause 0.5s puis fondu au noir → onMorphFini

import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Etoiles from './Etoiles.jsx';
import * as THREE from 'three';
import { CURSEUR_DEFAUT } from '../utils/curseurs.js';
import { lineVertexShader, fragMonde, fondVertexShader, fondFrag, neonVertexShader, neonFrag, creerTexture } from '../shaders/globe.js';
import { extraireSegments, extraireSegmentsNeon } from '../utils/geo.js';
import { ACCENT, accentRgba } from '../styles/theme.js';
import PAYS from '../data/pays.json';

const RAYON = 5;
const PI    = Math.PI;

const DUREE_MORPH = 2.2;
const DUREE_PAUSE = 0.5;
const DUREE_FONDU = 0.5;

const NEON_COLORS = Object.fromEntries(
  Object.entries(PAYS).map(([id, cfg]) => [id, neonFrag(...cfg.neon, true)])
);

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

  const texture = useMemo(() => creerTexture(), []);
  const uFond   = useMemo(() => ({ uTransition:{value:0}, uRadius:{value:RAYON}, uTexture:{value:texture} }), [texture]);
  const uMonde  = useMemo(() => ({ uTransition:{value:0}, uRadius:{value:RAYON} }), []);

  // Matériaux néons (avec uAlpha pour le fondu)
  const neonMats = useRef(null);
  if (!neonMats.current) {
    neonMats.current = {};
    for (const id of Object.keys(PAYS))
      neonMats.current[id] = new THREE.ShaderMaterial({
        vertexShader: neonVertexShader,
        fragmentShader: NEON_COLORS[id],
        uniforms: { uTime:{value:0}, uAlpha:{value:1} },
        transparent: true, depthWrite: false,
      });
  }

  const geos = useMemo(() => {
    if (!geoData) return {};
    const features = geoData.features;
    return {
      monde: extraireSegments(features, null),
      ...Object.fromEntries(Object.entries(PAYS).map(([id, cfg]) => [
        id, extraireSegmentsNeon(features.filter(f => f.properties?.NAME === cfg.NAME), cfg.mainland, RAYON + 0.08)
      ])),
    };
  }, [geoData]);

  useFrame((_, delta) => {
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
    for (const id of Object.keys(PAYS)) {
      neonMats.current[id].uniforms.uTime.value  += delta;
      neonMats.current[id].uniforms.uAlpha.value  = neonAlpha;
    }

    if (groupRef.current) {
      if (!morphActif) {
        // Phase globe : rotation + inclinaison axiale 23.5°
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
        <planeGeometry args={[RAYON*2*PI, RAYON*PI, 64, 32]}/>
        <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
          uniforms={uFond} side={THREE.DoubleSide}/>
      </mesh>
      {geos.monde && (
        <lineSegments geometry={geos.monde} renderOrder={2}>
          <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false}/>
        </lineSegments>
      )}
      {Object.keys(PAYS).map(id => geos[id] && (
        <lineSegments key={id} geometry={geos[id]} material={neonMats.current[id]} renderOrder={10}/>
      ))}
    </group>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function MorphingCanvas({ progress = 0, morphPret, onMorphFini }) {
  const [geoData, setGeoData] = useState(null);
  useEffect(() => {
    fetch('/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json()).then(setGeoData).catch(() => {});
  }, []);

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
        <Etoiles />
        <SceneGlobeMorph
          geoData={geoData}
          morphPretRef={morphPretRef}
          onMorphFiniRef={onMorphFiniRef}
          fonduDivRef={fonduDivRef}
        />
      </Canvas>

      {/* Barre de progression — en haut */}
      {!morphPret && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '3px',
          background: 'rgba(20,30,44,0.9)',
          borderBottom: `1px solid ${accentRgba(0.15)}`,
          pointerEvents: 'none',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: accentRgba(0.85),
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
          border: `1px solid ${accentRgba(0.22)}`,
          borderRadius: '2px', padding: '0.8rem 2.8rem',
          backdropFilter: 'blur(6px)',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.52rem', letterSpacing: '0.25em',
            color: accentRgba(0.85),
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
