// src/views/SceneWarRoom.jsx — scène Three.js war room (s'utilise à l'intérieur d'un Canvas)
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const RAYON = 2;
const PI = Math.PI;

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

const fragMonde = `void main(){ gl_FragColor = vec4(0.02, 0.45, 0.65, 0.12); }`;

function hexGLSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}`;
}

// lon/lat degrés → coordonnées mercator Three.js
function lonLatVersXY(lon, lat) {
  const x = lon / 180.0 * (RAYON * PI);
  const y = lat / 90.0  * (RAYON * PI / 2.0);
  return [x, y];
}

function extraireSegments(features) {
  const pts = [];
  features.forEach(feat => {
    const g = feat.geometry; if (!g) return;
    const anneaux = g.type === 'Polygon'      ? g.coordinates :
                    g.type === 'MultiPolygon' ? g.coordinates.flat(1) : [];
    anneaux.forEach(ring => {
      for (let i = 0; i < ring.length - 1; i++)
        pts.push(new THREE.Vector3(ring[i][0], ring[i][1], 0),
                 new THREE.Vector3(ring[i + 1][0], ring[i + 1][1], 0));
    });
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

function extraireRemplissage(features) {
  const pos = [];
  features.forEach(feat => {
    const g = feat.geometry; if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach(poly => {
      if (!poly.length || poly[0].length < 4) return;
      try {
        const contour = poly[0].map(p => new THREE.Vector2(p[0], p[1]));
        const holes   = poly.slice(1).map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
        THREE.ShapeUtils.triangulateShape(contour, holes).forEach(tri =>
          tri.forEach(idx => pos.push(contour[idx].x, contour[idx].y, 0))
        );
      } catch (_) {}
    });
  });
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return geo;
}

// Crée une géométrie de coins (brackets) autour d'une bbox
function creerCoins(lonMin, latMin, lonMax, latMax) {
  const [x0, y0] = lonLatVersXY(lonMin, latMin);
  const [x1, y1] = lonLatVersXY(lonMax, latMax);
  const dx = (x1 - x0) * 0.18;
  const dy = (y1 - y0) * 0.18;
  const z = 0.12;
  // 4 coins — chacun fait un L
  const pts = [
    // bas-gauche
    new THREE.Vector3(x0, y0 + dy, z), new THREE.Vector3(x0, y0, z), new THREE.Vector3(x0, y0, z), new THREE.Vector3(x0 + dx, y0, z),
    // bas-droit
    new THREE.Vector3(x1 - dx, y0, z), new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y0 + dy, z),
    // haut-droit
    new THREE.Vector3(x1, y1 - dy, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(x1 - dx, y1, z),
    // haut-gauche
    new THREE.Vector3(x0 + dx, y1, z), new THREE.Vector3(x0, y1, z), new THREE.Vector3(x0, y1, z), new THREE.Vector3(x0, y1 - dy, z),
  ];
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function useDragZoom(groupRef) {
  const { gl, camera } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    let on = false, ox = 0, oy = 0;
    const dn = e => { on = true; ox = e.clientX; oy = e.clientY; el.style.cursor = 'grabbing'; };
    const mv = e => {
      if (!on || !groupRef.current) return;
      const f = camera.position.z * 0.002;
      groupRef.current.position.x += (e.clientX - ox) * f;
      groupRef.current.position.y -= (e.clientY - oy) * f;
      ox = e.clientX; oy = e.clientY;
    };
    const up = () => { on = false; el.style.cursor = 'grab'; };
    const wh = e => { camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.02, 0.5, 20); };
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', dn); window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up); el.addEventListener('wheel', wh, { passive: true });
    return () => {
      el.style.cursor = '';
      el.removeEventListener('mousedown', dn); window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up); el.removeEventListener('wheel', wh);
    };
  }, [gl, camera, groupRef]);
}

export default function SceneWarRoom({ geoData, cfg }) {
  const groupRef = useRef();
  const { camera } = useThree();
  const uMonde   = useMemo(() => ({ uRadius: { value: RAYON } }), []);
  const uPays    = useRef({ uRadius: { value: RAYON }, uTime: { value: 0 } });

  // Centrer et zoomer sur le pays sélectionné
  useEffect(() => {
    if (!cfg?.bbox) return;
    const [lonMin, latMin, lonMax, latMax] = cfg.bbox;
    const [cx, cy] = lonLatVersXY((lonMin + lonMax) / 2, (latMin + latMax) / 2);
    const [x0, y0] = lonLatVersXY(lonMin, latMin);
    const [x1, y1] = lonLatVersXY(lonMax, latMax);
    const wBox = Math.abs(x1 - x0);
    const hBox = Math.abs(y1 - y0);
    // Zoom pour que le pays occupe ~50% de la hauteur de l'écran (avec marge)
    const zCible = Math.max(wBox, hBox * 1.8) * 1.6;
    camera.position.set(cx, cy, THREE.MathUtils.clamp(zCible, 1.5, 12));
  }, [cfg, camera]);

  const geos = useMemo(() => {
    if (!geoData || !cfg) return {};
    const features = geoData.features;
    const featsPays = features.filter(f =>
      f.properties?.NAME === cfg.NAME || f.properties?.name === cfg.NAME
    );
    const coins = cfg.bbox ? creerCoins(...cfg.bbox) : null;
    return {
      monde:    extraireSegments(features),
      pays:     extraireSegments(featsPays),
      paysFill: extraireRemplissage(featsPays),
      coins,
    };
  }, [geoData, cfg]);

  const fragPays     = useMemo(() => cfg
    ? `uniform float uTime; void main(){ float p=0.7+0.3*sin(uTime*2.4); gl_FragColor=vec4(${hexGLSL(cfg.couleur)},p); }`
    : fragMonde, [cfg?.couleur]);

  const fragPaysFill = useMemo(() => cfg
    ? `uniform float uTime; void main(){ float p=0.15+0.08*sin(uTime*2.4); gl_FragColor=vec4(${hexGLSL(cfg.couleur)},p); }`
    : fragMonde, [cfg?.couleur]);

  const fragCoins = useMemo(() => cfg
    ? `uniform float uTime; void main(){ float p=0.6+0.4*sin(uTime*3.0+1.57); gl_FragColor=vec4(${hexGLSL(cfg.couleur)},p); }`
    : fragMonde, [cfg?.couleur]);

  useDragZoom(groupRef);
  useFrame((_, delta) => { uPays.current.uTime.value += delta; });

  if (!cfg) return null;

  return (
    <group ref={groupRef}>
      {geos.monde && (
        <lineSegments geometry={geos.monde} renderOrder={2}>
          <shaderMaterial vertexShader={vertPlan} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false} />
        </lineSegments>
      )}
      {geos.paysFill && (
        <mesh geometry={geos.paysFill} renderOrder={3}>
          <shaderMaterial vertexShader={vertRempli} fragmentShader={fragPaysFill}
            uniforms={uPays.current} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {geos.pays && (
        <lineSegments geometry={geos.pays} renderOrder={5}>
          <shaderMaterial vertexShader={vertPlan} fragmentShader={fragPays}
            uniforms={uPays.current} transparent depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
      {geos.coins && (
        <lineSegments geometry={geos.coins} renderOrder={6}>
          <shaderMaterial vertexShader={vertPlan} fragmentShader={fragCoins}
            uniforms={uPays.current} transparent depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}
