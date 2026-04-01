// src/views/SceneGlobeDecoupé.jsx — globe éclaté en fragments (s'utilise à l'intérieur d'un Canvas)
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RAYON = 2;
const PI    = Math.PI;

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

const fragLigne = `void main(){ gl_FragColor = vec4(0.02, 0.45, 0.65, 0.45); }`;

// ─── Définition des quadrants ─────────────────────────────────────────────────
// 4 quadrants : NE, NW, SE, SW
const QUADRANTS_4 = [
  { lonMin:   0, lonMax: 180, latMin:  0, latMax:  90, cx:  90, cy: 45 },
  { lonMin:-180, lonMax:   0, latMin:  0, latMax:  90, cx: -90, cy: 45 },
  { lonMin:   0, lonMax: 180, latMin:-90, latMax:   0, cx:  90, cy:-45 },
  { lonMin:-180, lonMax:   0, latMin:-90, latMax:   0, cx: -90, cy:-45 },
];

// 8 octants : 4 tranches longitude × 2 hémisphères
const QUADRANTS_8 = [
  { lonMin:-180, lonMax: -90, latMin:  0, latMax:  90, cx:-135, cy: 45 },
  { lonMin: -90, lonMax:   0, latMin:  0, latMax:  90, cx: -45, cy: 45 },
  { lonMin:   0, lonMax:  90, latMin:  0, latMax:  90, cx:  45, cy: 45 },
  { lonMin:  90, lonMax: 180, latMin:  0, latMax:  90, cx: 135, cy: 45 },
  { lonMin:-180, lonMax: -90, latMin:-90, latMax:   0, cx:-135, cy:-45 },
  { lonMin: -90, lonMax:   0, latMin:-90, latMax:   0, cx: -45, cy:-45 },
  { lonMin:   0, lonMax:  90, latMin:-90, latMax:   0, cx:  45, cy:-45 },
  { lonMin:  90, lonMax: 180, latMin:-90, latMax:   0, cx: 135, cy:-45 },
];

// Direction 3D vers laquelle le fragment s'écarte
function dirVers3D(lon, lat) {
  const lonR = lon * PI / 180;
  const latR = lat * PI / 180;
  return new THREE.Vector3(
    Math.cos(latR) * Math.sin(lonR),
    Math.sin(latR),
    Math.cos(latR) * Math.cos(lonR)
  ).normalize();
}

// Extraction des segments appartenant à un quadrant (par centroïde de l'anneau)
function extraireSegmentsQuadrant(features, q) {
  const pts = [];
  features.forEach(feat => {
    const g = feat.geometry; if (!g) return;
    const anneaux = g.type === 'Polygon'      ? g.coordinates :
                    g.type === 'MultiPolygon' ? g.coordinates.flat(1) : [];
    anneaux.forEach(ring => {
      let sx = 0, sy = 0;
      ring.forEach(p => { sx += p[0]; sy += p[1]; });
      sx /= ring.length; sy /= ring.length;
      if (sx < q.lonMin || sx >= q.lonMax || sy < q.latMin || sy >= q.latMax) return;
      for (let i = 0; i < ring.length - 1; i++)
        pts.push(new THREE.Vector3(ring[i][0], ring[i][1], 0),
                 new THREE.Vector3(ring[i+1][0], ring[i+1][1], 0));
    });
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

// ─── Fragment individuel ──────────────────────────────────────────────────────
function Fragment({ geo, direction, ecartMax, délai, uniforms }) {
  const groupRef = useRef();
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta * 0.4;
    const avance  = Math.max(0, t.current - délai);
    const ecart   = Math.min(avance, 1) * ecartMax;
    if (groupRef.current)
      groupRef.current.position.copy(direction.clone().multiplyScalar(ecart));
  });

  if (!geo) return null;
  return (
    <group ref={groupRef}>
      <lineSegments geometry={geo}>
        <shaderMaterial vertexShader={vertSphere} fragmentShader={fragLigne}
          uniforms={uniforms} transparent depthWrite={false} />
      </lineSegments>
    </group>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────
export default function SceneGlobeDecoupé({ geoData, decoupage }) {
  const quadrants = decoupage?.type === '4puis8' ? QUADRANTS_8 : QUADRANTS_4;
  const perm      = decoupage?.type === '4puis8'
    ? (decoupage.perm8 || decoupage.perm4 || [0,1,2,3,4,5,6,7])
    : (decoupage?.perm4 || [0,1,2,3]);

  const uniforms = useMemo(() => ({ uRadius: { value: RAYON } }), []);

  const geos = useMemo(() => {
    if (!geoData) return [];
    return quadrants.map(q => extraireSegmentsQuadrant(geoData.features, q));
  }, [geoData, quadrants]);

  return (
    <>
      {quadrants.map((q, i) => (
        <Fragment
          key={`${decoupage?.type}-${i}`}
          geo={geos[i]}
          direction={dirVers3D(q.cx, q.cy)}
          ecartMax={1.8}
          délai={(perm[i % perm.length] ?? 0) * 0.2}
          uniforms={uniforms}
        />
      ))}
    </>
  );
}
