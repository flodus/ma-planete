// src/views/ExplorateurMondeFictif.jsx — Globe 3D avec les MÊMES hexagones que la vue mercator
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mulberry32 } from '../utils/tectonique.js';
import MondeFictif from './MondeFictif';
import { CURSEUR_GRAB, CURSEUR_GRABBING, CURSEUR_POINTER } from '../utils/curseurs';

const RAYON = 3.8;
const PI = Math.PI;

// ─── FONCTIONS DE GÉNÉRATION (copiées depuis MondeFictif) ───────────────────

function hash2(x, y, s) {
  let h = (x * 1619 + y * 31337 + s * 1000003) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h >>> 0) / 4294967296;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
  return hash2(xi, yi, s) * (1 - xf) * (1 - yf)
  + hash2(xi + 1, yi, s) * xf * (1 - yf)
  + hash2(xi, yi + 1, s) * (1 - xf) * yf
  + hash2(xi + 1, yi + 1, s) * xf * yf;
}

function fbm(x, y, s) {
  return valueNoise(x, y, s) * 0.50
  + valueNoise(x * 2, y * 2, s + 1111) * 0.30
  + valueNoise(x * 4, y * 4, s + 2222) * 0.20;
}

const BIOMES = [
  { seuil: 0.30, couleur: '#020a18' },
{ seuil: 0.42, couleur: '#041422' },
{ seuil: 0.55, couleur: '#0d2235' },
{ seuil: 0.65, couleur: '#1a3045' },
{ seuil: 0.72, couleur: '#1e3a40' },
{ seuil: 0.80, couleur: '#243545' },
{ seuil: 0.90, couleur: '#2a3050' },
{ seuil: Infinity, couleur: '#1e2a38' },
];

function biomeCouleur(h) {
  for (const { seuil, couleur } of BIOMES) if (h < seuil) return couleur;
  return BIOMES[BIOMES.length - 1].couleur;
}

function couleurOcean(d) {
  if (d === 0) return '#0d2a4a';
  if (d === 1) return '#0a2240';
  return '#071a30';
}

// ─── Conversion hexagone en 3D sur sphère ───────────────────────────────────

function lonLatToXYZ(lon, lat, radius) {
  const phi = (90 - lat) * PI / 180;
  const theta = lon * PI / 180;
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

function createHexagonMesh(lon, lat, radius, color) {
  const [cx, cy, cz] = lonLatToXYZ(lon, lat, radius);
  const nx = cx / radius;
  const ny = cy / radius;
  const nz = cz / radius;

  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3(nx, ny, nz);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, axis);

  const shape = new THREE.Shape();
  const angleStep = PI * 2 / 6;
  const hexRadius = 0.19;
  for (let i = 0; i < 6; i++) {
    const angle = -PI / 2 + i * angleStep;
    const x = Math.cos(angle) * hexRadius;
    const y = Math.sin(angle) * hexRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.computeVertexNormals();
  geometry.rotateX(PI / 2);
  geometry.rotateZ(PI);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const centerX = (box.min.x + box.max.x) / 2;
  const centerY = (box.min.y + box.max.y) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  geometry.translate(-centerX, -centerY, -centerZ);

  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(cx, cy, cz);
  mesh.quaternion.copy(quaternion);

  return mesh;
}

// ─── GÉNÉRATION DES HEXAGONES (exactement comme MondeFictif) ────────────────

function useHexagonesGlobe(seed) {
  const [hexMeshes, setHexMeshes] = useState([]);

  useEffect(() => {
    const generateHexGrid = () => {
      const meshes = [];

      // Paramètres identiques à MondeFictif
      const COLS = 240;
      const ROWS = 170;
      const SEUIL_TERRE = 0.55;

      // Générer la heightmap (identique)
      const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h = fbm(c / COLS * 3.8, r / ROWS * 3.8, seed);
        const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15);
        return h * fade;
      })
      );

      // Calculer les masses terrestres (identique)
      const massIdx = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1));
      const masses = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (heights[r][c] < SEUIL_TERRE || massIdx[r][c] !== -1) continue;
          const masse = [];
          const q = [[c, r]];
          massIdx[r][c] = masses.length;
          while (q.length) {
            const [qc, qr] = q.shift();
            masse.push([qc, qr]);
            const D = [
              [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]],
              [[1,-1],[1,0],[1,1],[0,1], [-1,0],[0,-1]],
            ];
            for (let k = 0; k < 6; k++) {
              const [dc, dr] = D[qr % 2][k];
              const nc = qc + dc, nr = qr + dr;
              if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
              if (heights[nr][nc] < SEUIL_TERRE || massIdx[nr][nc] !== -1) continue;
              massIdx[nr][nc] = masses.length;
              q.push([nc, nr]);
            }
          }
          masses.push(masse);
        }
      }
      masses.forEach(m => {
        if (m.length < 60) m.forEach(([c, r]) => { massIdx[r][c] = -1; });
      });

      // Pour chaque cellule terrestre, créer un hexagone sur le globe
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (massIdx[r][c] === -1) continue;

          const h = heights[r][c];
          const color = biomeCouleur(h);

          // Conversion coordonnées hexagonales (col, row) → longitude/latitude
          // La carte Mercator s'étend de -180° à 180° en longitude et -90° à 90° en latitude
          const lon = (c / COLS) * 360 - 180;
          const lat = 90 - (r / ROWS) * 180;

          try {
            const mesh = createHexagonMesh(lon, lat, RAYON + 0.025, color);
            meshes.push(mesh);
          } catch (e) {}
        }
      }

      setHexMeshes(meshes);
    };

    generateHexGrid();
  }, [seed]);

  return hexMeshes;
}

// ─── Texture océan (comme le globe réel) ─────────────────────────────────────

function createOceanTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1a5a8a');
  grad.addColorStop(0.5, '#0e4a7a');
  grad.addColorStop(1, '#0a3a6a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(120, 200, 255, ${Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 512, Math.random() * 4 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(100, 180, 240, 0.25)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 1024; i += 35) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i / 2);
    ctx.lineTo(1024, i / 2);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

// ─── Composant Globe avec les MÊMES hexagones ────────────────────────────────

function Globe3D({ seed }) {
  const groupRef = useRef();
  const oceanTexture = useMemo(() => createOceanTexture(), []);
  const hexMeshes = useHexagonesGlobe(seed);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.006;
  });

  return (
    <>
    <mesh>
    <sphereGeometry args={[RAYON - 0.02, 128, 64]} />
    <meshStandardMaterial
    map={oceanTexture}
    roughness={0.4}
    metalness={0.2}
    color="#1a5a8a"
    />
    </mesh>

    <group ref={groupRef}>
    {hexMeshes.map((mesh, idx) => (
      <primitive key={idx} object={mesh} />
    ))}
    </group>

    <ambientLight intensity={0.5} />
    <directionalLight position={[8, 12, 6]} intensity={1.0} color="#fff5e8" />
    <pointLight position={[-5, 4, 6]} intensity={0.5} color="#88aaff" />
    </>
  );
}

// ─── Styles UI ───────────────────────────────────────────────────────────────

const btnStyle = {
  padding: '8px 16px',
  background: 'rgba(8, 18, 28, 0.85)',
  border: '1px solid rgba(80, 180, 255, 0.5)',
  borderRadius: '4px',
  color: 'rgba(100, 200, 255, 0.95)',
  cursor: CURSEUR_POINTER,
  fontSize: '0.88rem',
  fontFamily: 'monospace',
  letterSpacing: '0.06em',
  backdropFilter: 'blur(4px)',
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function ExplorateurMondeFictif({ seed = 42, onMondeReel }) {
  const [vue, setVue] = useState('globe');
  const [paysSelectionne, setPaysSelectionne] = useState(null);
  const [localSeed, setLocalSeed] = useState(seed);

  const nouveauMonde = () => {
    setLocalSeed(Math.floor(Math.random() * 99999));
    setVue('globe');
    setPaysSelectionne(null);
  };

  if (vue === 'mercator') {
    return (
      <MondeFictif
      seed={localSeed}
      onRetour={() => setVue('globe')}
      onPaysDoubleClick={idx => { setPaysSelectionne(idx); setVue('warroom'); }}
      />
    );
  }

  if (vue === 'warroom') {
    return (
      <MondeFictif
      seed={localSeed}
      paysSelectionne={paysSelectionne}
      onRetour={() => { setPaysSelectionne(null); setVue('mercator'); }}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#010108' }}
    onDoubleClick={() => setVue('mercator')}>

    <Canvas camera={{ position: [0, 0, RAYON * 4.2], fov: 42 }}>
    <color attach="background" args={['#010108']} />
    <Stars radius={150} depth={70} count={50000} factor={5} saturation={0.2} fade speed={0.3} />
    <Globe3D seed={localSeed} />
    <OrbitControls
    enableZoom={true}
    enablePan={false}
    rotateSpeed={0.8}
    zoomSpeed={1.0}
    />
    </Canvas>

    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
    <div style={{ position: 'absolute', top: '20px', left: '20px',
      display: 'flex', gap: '12px', alignItems: 'center', pointerEvents: 'all' }}
      onPointerDown={e => e.stopPropagation()}>
      <button style={btnStyle} onClick={onMondeReel}>← MONDE RÉEL</button>
      <button style={btnStyle} onClick={nouveauMonde}>⟳ NOUVEAU MONDE</button>
      <span style={{ padding: '6px 18px', background: 'rgba(8, 18, 28, 0.85)',
        border: '1px solid rgba(80, 180, 255, 0.45)', borderRadius: '3px',
          color: 'rgba(100, 200, 255, 0.9)', fontSize: '0.78rem',
          fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          MONDE #{localSeed}
          </span>
          </div>

          <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(100, 200, 255, 0.6)', fontSize: '0.7rem', fontFamily: 'monospace',
          letterSpacing: '0.12em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          DOUBLE-CLIC → PLANISPHÈRE
          </div>
          </div>
          </div>
  );
}
