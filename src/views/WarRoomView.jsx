// src/views/WarRoomView.jsx
// Vue cockpit — fond néon + frontières GeoJSON + panneau burger escamotable
import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, KeyboardControls } from '@react-three/drei';
import { WarRoomMap } from '../components/canvas/WarRoomMap';
import * as THREE from 'three';

const RAYON_WAR = 5;

const vertRempliWar = `
uniform float uRadius;
void main() {
  float x = position.x / 180.0 * (uRadius * 3.14159265);
  float y = position.y / 90.0  * (uRadius * 3.14159265 / 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.03, 1.0);
}`;
const fragRempliWar = `void main(){ gl_FragColor = vec4(0.04, 0.22, 0.42, 0.55); }`;

function extraireRemplissage(features) {
  const pos = [];
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    polys.forEach(poly=>{
      if(!poly.length||poly[0].length<4) return;
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

function FondRempli() {
  const [geoData, setGeoData] = useState(null);
  useEffect(()=>{
    fetch('/countries.geojson').then(r=>r.json()).then(setGeoData).catch(()=>{});
  },[]);
  const fill = useMemo(()=>geoData ? extraireRemplissage(geoData.features) : null, [geoData]);
  const u    = useMemo(()=>({uRadius:{value:RAYON_WAR}}),[]);
  if(!fill) return null;
  return (
    <mesh renderOrder={1}>
      <primitive object={fill} attach="geometry"/>
      <shaderMaterial vertexShader={vertRempliWar} fragmentShader={fragRempliWar}
        uniforms={u} transparent depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
  );
}

// KeyboardControls requis par WarRoomMap (useKeyboardControls interne)
const touchesClavier = [
  { name: 'forward',  keys: ['ArrowUp', 'z'] },
  { name: 'backward', keys: ['ArrowDown', 's'] },
  { name: 'left',     keys: ['ArrowLeft', 'q'] },
  { name: 'right',    keys: ['ArrowRight', 'd'] },
];

export function WarRoomView({ pays, onBack }) {
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* Canvas Three.js — fond néon */}
      <KeyboardControls map={touchesClavier}>
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
          <color attach="background" args={['#020202']} />
          <ambientLight intensity={0.3} />
          <Stars radius={100} factor={4} />
          <FondRempli />
          <WarRoomMap radius={5} isPlanar={true} />
        </Canvas>
      </KeyboardControls>

      {/* Bouton retour */}
      <button
        onClick={onBack}
        style={styles.boutonRetour}
      >
        ← Carte
      </button>

      {/* Bouton burger ☰ */}
      <button
        onClick={() => setPanneauOuvert(v => !v)}
        style={styles.boutonBurger}
        title={panneauOuvert ? 'Fermer le panneau' : 'Ouvrir le panneau'}
      >
        ☰
      </button>

      {/* Panneau latéral escamotable */}
      <div style={{
        ...styles.panneau,
        transform: panneauOuvert ? 'translateX(0)' : 'translateX(100%)',
      }}>
        <div style={styles.panneauTitre}>CountryPanel</div>
        <div style={styles.panneauSousTitre}>
          {pays ? pays : '— aucun pays sélectionné —'}
        </div>
        {/* Contenu à implémenter */}
      </div>

    </div>
  );
}

const styles = {
  boutonRetour: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 100,
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
  },
  boutonBurger: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    zIndex: 100,
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    fontSize: '1.2rem',
    lineHeight: 1,
  },
  panneau: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '320px',
    height: '100%',
    zIndex: 90,
    background: 'rgba(8, 10, 28, 0.92)',
    borderLeft: '1px solid rgba(255,20,147,0.25)',
    backdropFilter: 'blur(8px)',
    transition: 'transform 0.3s ease',
    padding: '72px 24px 24px',
    boxSizing: 'border-box',
  },
  panneauTitre: {
    color: '#ff1493',
    fontSize: '1rem',
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  panneauSousTitre: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
  },
};
