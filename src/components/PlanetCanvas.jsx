// src/components/PlanetCanvas.jsx
// Globe 3D décoratif pour l'écran d'init :
// - Rotation automatique (pas d'OrbitControls)
// - Néons 10 pays : France, USA, Chine, Russie, Brésil, Inde, Allemagne, Japon, Nigeria, Arabie Saoudite
// - Non interactif

import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CURSEUR_DEFAUT } from '../utils/curseurs.js';
import { lineVertexShader, fragMonde, fondVertexShader, fondFrag, neonVertexShader, neonFrag, creerTexture } from '../shaders/globe.js';
import { extraireSegments, extraireSegmentsNeon } from '../utils/geo.js';
import PAYS from '../data/pays.json';

const RAYON = 5;
const PI    = Math.PI;

const NEON_COLORS = Object.fromEntries(
  Object.entries(PAYS).map(([id, cfg]) => [id, neonFrag(...cfg.neon)])
);

// ─── Scène globe décoratif ────────────────────────────────────────────────────
function ScenePlanet({ geoData }) {
  const groupRef = useRef();
  const texture  = useMemo(() => creerTexture(), []);
  const uGlobe   = useMemo(() => ({ uTransition:{value:0}, uRadius:{value:RAYON}, uTexture:{value:texture} }), [texture]);
  const uMonde   = useMemo(() => ({ uTransition:{value:0}, uRadius:{value:RAYON} }), []);

  const neonMats = useRef(null);
  if (!neonMats.current) {
    neonMats.current = {};
    for (const id of Object.keys(PAYS))
      neonMats.current[id] = new THREE.ShaderMaterial({
        vertexShader: neonVertexShader,
        fragmentShader: NEON_COLORS[id],
        uniforms: { uTime:{value:0} },
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
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
      groupRef.current.rotation.z  = 23.5 * PI / 180;
      groupRef.current.position.y  = -0.8;
    }
    for (const id of Object.keys(PAYS))
      neonMats.current[id].uniforms.uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <mesh renderOrder={0}>
        <planeGeometry args={[RAYON*2*PI, RAYON*PI, 64, 32]}/>
        <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
          uniforms={uGlobe} side={THREE.DoubleSide}/>
      </mesh>
      {geos.monde && (
        <lineSegments geometry={geos.monde} renderOrder={1}>
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

// ─── Composant exporté ────────────────────────────────────────────────────────
export default function PlanetCanvas() {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json()).then(setGeoData).catch(() => {});
  }, []);

  return (
    <Canvas
      camera={{ position:[0, 0, RAYON*3.3], fov:45 }}
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
