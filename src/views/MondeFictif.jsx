// src/views/MondeFictif.jsx — avec nuages aléatoires sur toute la carte
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { mulberry32 } from '../utils/tectonique.js';
import { CURSEUR_POINTER } from '../utils/curseurs.js';

const HEX_R       = 7;
const COLS        = 240;
const ROWS        = 170;
const W3          = Math.sqrt(3);
const VB_W        = 3000;
const VB_H        = 1800;
const SEUIL_TERRE = 0.55;
const DY          = 2;
const DX          = 1;
const DIRS_SUD    = [2, 3, 4];
const DIRS_NORD   = [5, 0, 1];

const NUAGES_VISIBLE_MAX_SCALE = 1.5;

// ─── Géométrie hex ────────────────────────────────────────────────────────────

function hexCenter(col, row) {
  const x = col * W3 * HEX_R + (row % 2 === 1 ? W3 / 2 * HEX_R : 0) + W3 * HEX_R;
  const y = row * 1.5 * HEX_R + HEX_R + 5;
  return [x, y];
}

function hexCorners(col, row) {
  const [cx, cy] = hexCenter(col, row);
  return Array.from({ length: 6 }, (_, k) => {
    const a = -Math.PI / 2 + k * Math.PI / 3;
    return [cx + HEX_R * Math.cos(a), cy + HEX_R * Math.sin(a)];
  });
}

function hexCornersOff(col, row, ox, oy) {
  const [cx, cy] = hexCenter(col, row);
  return Array.from({ length: 6 }, (_, k) => {
    const a = -Math.PI / 2 + k * Math.PI / 3;
    return [cx + HEX_R * Math.cos(a) + ox, cy + HEX_R * Math.sin(a) + oy];
  });
}

function hexPath(col, row) {
  const pts = hexCorners(col, row);
  return pts.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z';
}

function hexEdge(col, row, k) {
  const pts = hexCorners(col, row);
  const [x0, y0] = pts[k];
  const [x1, y1] = pts[(k + 1) % 6];
  return `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`;
}

function ptsToPath(pts) {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z';
}

function voisin(col, row, k) {
  const D = [
    [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]],
    [[1,-1],[1,0],[1,1],[0,1], [-1,0],[0,-1] ],
  ];
  const [dc, dr] = D[row % 2][k];
  return [col + dc, row + dr];
}

// ─── Bruit ────────────────────────────────────────────────────────────────────

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
  return hash2(xi,   yi,   s) * (1-xf)*(1-yf)
  + hash2(xi+1, yi,   s) * xf    *(1-yf)
  + hash2(xi,   yi+1, s) * (1-xf)*yf
  + hash2(xi+1, yi+1, s) * xf    *yf;
}

function fbm(x, y, s) {
  return valueNoise(x,   y,   s)      * 0.50
  + valueNoise(x*2, y*2, s+1111) * 0.30
  + valueNoise(x*4, y*4, s+2222) * 0.20;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

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

function assombrir(hex, f = 0.6) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function neonPays(idx) {
  let hue = (idx * 47) % 360;
  if (hue >= 165 && hue <= 195) hue += 30;
  return `hsl(${hue},90%,65%)`;
}

function shuffler(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── ISO relief OPTIMISÉ (2 couches max) ─────────────────────────────────────

function nbCouchesTerre(h) {
  if (h >= 0.75) return 2;
  if (h >= 0.60) return 2;
  return 1;
}

function nbCouchesOcean(h) {
  if (h < 0.20) return 2;
  if (h < 0.42) return 1;
  return 0;
}

function eclairir(hexColor, factor) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(parseInt(hexColor.slice(1, 3), 16) * factor);
  const g = clamp(parseInt(hexColor.slice(3, 5), 16) * factor);
  const b = clamp(parseInt(hexColor.slice(5, 7), 16) * factor);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── NOUVEAUX NUAGES ALÉATOIRES (petits, moyens, gros, sur toute la carte) ───

const genererNuages = (largeur, hauteur) => {
  const nuages = [];
  const nombreNuages = 45;

  for (let i = 0; i < nombreNuages; i++) {
    // Taille aléatoire : petit (20-35), moyen (35-55), gros (55-80)
    let size;
    const rand = Math.random();
    if (rand < 0.4) size = 20 + Math.random() * 15;
    else if (rand < 0.7) size = 35 + Math.random() * 20;
    else size = 55 + Math.random() * 25;

    // Position Y : sur toute la hauteur de la carte
    const y = 30 + Math.random() * (hauteur - 60);

    // Position X initiale aléatoire
    const x = Math.random() * (largeur + 400) - 200;

    // Vitesse individuelle
    const speed = 0.6 + Math.random() * 1.2;

    // Opacité individuelle
    const opacity = 0.4 + Math.random() * 0.4;

    nuages.push({
      id: i,
      x: x,
      y: y,
      size: size,
      speed: speed,
      opacity: opacity,
    });
  }
  return nuages;
};

function createCloudPath(x, y, size) {
  const r = size;
  return `M${x},${y - r*0.5} Q${x + r*0.4},${y - r*0.7} ${x + r*0.8},${y - r*0.2} Q${x + r*1.0},${y - r*0.3} ${x + r*0.9},${y} Q${x + r*1.1},${y + r*0.2} ${x + r*0.7},${y + r*0.4} Q${x + r*0.5},${y + r*0.5} ${x + r*0.2},${y + r*0.4} Q${x},${y + r*0.6} ${x - r*0.2},${y + r*0.4} Q${x - r*0.5},${y + r*0.5} ${x - r*0.7},${y + r*0.4} Q${x - r*1.1},${y + r*0.2} ${x - r*0.9},${y} Q${x - r*1.0},${y - r*0.3} ${x - r*0.8},${y - r*0.2} Q${x - r*0.4},${y - r*0.7} ${x},${y - r*0.5}Z`;
}

// ─── Style partagé UI ─────────────────────────────────────────────────────────

const btnStyle = {
  padding: '8px 16px', background: 'rgba(0,10,28,0.85)',
  border: '1px solid rgba(0,200,255,0.35)', borderRadius: '4px',
  color: 'rgba(0,210,255,0.90)', cursor: CURSEUR_POINTER,
  fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.06em',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MondeFictif({ seed, onMondeReel, onRetour, onPaysDoubleClick, paysSelectionne = null }) {
  const [localSeed, setLocalSeed]   = useState(seed);
  const [hoveredPays, setHoveredPays] = useState(null);
  const [cloudOffset, setCloudOffset] = useState(0);
  const cloudAnimationRef = useRef(null);
  const [nuages, setNuages] = useState([]);
  const tempsRef = useRef(0);

  useEffect(() => { setLocalSeed(seed); }, [seed]);

  const wrapRef = useRef(null);
  const ptrDown = useRef(false);
  const lastXY  = useRef([0, 0]);

  const [xf, setXf] = useState(() => ({
    scale: 0.5,
    x: Math.round((window.innerWidth  - VB_W * 0.5) / 2),
                                      y: Math.round((window.innerHeight - VB_H * 0.5) / 2),
  }));

  // Génération des nuages aléatoires (change à chaque nouvelle carte)
  useEffect(() => {
    setNuages(genererNuages(VB_W, VB_H));
  }, [localSeed]);

  // Animation des nuages (défilement horizontal + variations)
  useEffect(() => {
    let lastTime = performance.now();
    function animateClouds(now) {
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      tempsRef.current += delta * 0.5;
      setCloudOffset(prev => (prev + delta * 0.8) % (VB_W * 2));
      cloudAnimationRef.current = requestAnimationFrame(animateClouds);
    }
    cloudAnimationRef.current = requestAnimationFrame(animateClouds);
    return () => {
      if (cloudAnimationRef.current) cancelAnimationFrame(cloudAnimationRef.current);
    };
  }, []);

  const lod = xf.scale < 0.7 ? 0 : xf.scale < 2.0 ? 1 : 2;
  const nuagesVisibles = xf.scale < NUAGES_VISIBLE_MAX_SCALE;
  const nuagesOpacity = nuagesVisibles ? Math.max(0, 1 - (xf.scale / NUAGES_VISIBLE_MAX_SCALE) * 0.7) : 0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const f  = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setXf(p => {
        const ns = Math.min(6, Math.max(0.4, p.scale * f));
        const sc = ns / p.scale;
        return { scale: ns, x: mx - sc * (mx - p.x), y: my - sc * (my - p.y) };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPtrDown = (e) => {
    ptrDown.current = true;
    lastXY.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPtrMove = (e) => {
    if (!ptrDown.current) return;
    const [lx, ly] = lastXY.current;
    setXf(p => ({ ...p, x: p.x + e.clientX - lx, y: p.y + e.clientY - ly }));
    lastXY.current = [e.clientX, e.clientY];
  };
  const onPtrUp = () => { ptrDown.current = false; };

  // ─── Génération de la carte (optimisée, 2 couches max) ───────────────────────

  const svgData = useMemo(() => {
    const heights = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const h = fbm(c / COLS * 3.8, r / ROWS * 3.8, localSeed);
      const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15);
      return h * fade;
    })
    );

    const massIdx = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1));
    const masses  = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (heights[r][c] < SEUIL_TERRE || massIdx[r][c] !== -1) continue;
        const masse = [];
        const q = [[c, r]];
        massIdx[r][c] = masses.length;
        while (q.length) {
          const [qc, qr] = q.shift();
          masse.push([qc, qr]);
          for (let k = 0; k < 6; k++) {
            const [nc, nr] = voisin(qc, qr, k);
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
    const massesFiltrees = masses.filter(m => m.length >= 60);

    const paysCarte = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1));
    const rng = mulberry32((localSeed * 6971 + 12345) | 0);
    let nbPays = 0;
    massesFiltrees.forEach(masse => {
      const n = Math.max(1, Math.floor(masse.length / 280));
      const q = [];
      shuffler(masse, rng).slice(0, n).forEach(([c, r]) => {
        paysCarte[r][c] = nbPays++;
        q.push([c, r]);
      });
      while (q.length) {
        const [qc, qr] = q.shift();
        const p = paysCarte[qr][qc];
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(qc, qr, k);
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          if (massIdx[nr][nc] === -1 || paysCarte[nr][nc] !== -1) continue;
          paysCarte[nr][nc] = p;
          q.push([nc, nr]);
        }
      }
    });

    const dCote = Array.from({ length: ROWS }, () => new Int8Array(COLS).fill(-1));
    const qCote = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (massIdx[r][c] !== -1) continue;
        let adjTerre = false;
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(c, r, k);
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && massIdx[nr][nc] !== -1) { adjTerre = true; break; }
        }
        if (adjTerre) { dCote[r][c] = 0; qCote.push([c, r]); }
      }
      while (qCote.length) {
        const [c, r] = qCote.shift();
        if (dCote[r][c] >= 4) continue;
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(c, r, k);
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          if (massIdx[nr][nc] !== -1 || dCote[nr][nc] !== -1) continue;
          dCote[nr][nc] = dCote[r][c] + 1;
          qCote.push([nc, nr]);
        }
      }

      const oceanSurfD = [{}, {}, {}, {}];
      const oceanFaceD = [{}, {}, {}, {}];
      const oceanGradD = ['', '', '', ''];
      const terreSurfD = [{}, {}, {}, {}, {}, {}, {}];
      const terreFaceD = [{}, {}, {}, {}, {}, {}, {}];
      const terreGradD = ['', '', '', '', '', '', ''];
      const paysD  = {};
      const frontD = {};
      const coteSegs = [];

      function ajout(obj, couleur, path) {
        obj[couleur] = (obj[couleur] || '') + path;
      }

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const h        = heights[r][c];
          const estTerre = massIdx[r][c] !== -1;
          const p        = paysCarte[r][c];
          const hexId    = r * COLS + c;

          if (estTerre) {
            const n          = nbCouchesTerre(h);
            const baseCouleur = biomeCouleur(h);

            for (let i = 0; i < n; i++) {
              const oX = -i * DX, oY = -i * DY;
              const pts = hexCornersOff(c, r, oX, oY);
              const surfFactor = 1 + i * 0.18;
              const surfCouleur = eclairir(baseCouleur, surfFactor);
              ajout(terreSurfD[i], surfCouleur, ptsToPath(pts));
            }

            if (p !== -1) paysD[p] = (paysD[p] || '') + hexPath(c, r);

          } else {
            const n          = nbCouchesOcean(h);
            const dcVal      = dCote[r][c];
            const baseCouleur = couleurOcean(dcVal >= 0 ? Math.min(dcVal, 2) : 3);

            ajout(oceanSurfD[0], baseCouleur, ptsToPath(hexCornersOff(c, r, 0, 0)));

            for (let i = 1; i <= n; i++) {
              const oX = i * DX, oY = i * DY;
              const pts = hexCornersOff(c, r, oX, oY);
              const surfFactor = 1 - i * 0.15;
              const surfCouleur = eclairir(baseCouleur, surfFactor);
              ajout(oceanSurfD[i], surfCouleur, ptsToPath(pts));
            }
          }

          for (let k = 0; k < 6; k++) {
            const [nc, nr] = voisin(c, r, k);
            const inB    = nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS;
            const nId    = inB ? nr * COLS + nc : -1;
            const lowest = !inB || hexId < nId;
            const nTerre = inB && massIdx[nr][nc] !== -1;
            const nP     = inB ? paysCarte[nr][nc] : -1;

            if (lowest && estTerre !== nTerre) coteSegs.push(hexEdge(c, r, k));

            if (lowest && estTerre && nTerre && p !== -1 && nP !== -1 && p !== nP) {
              const seg = hexEdge(c, r, k);
              frontD[p]  = (frontD[p]  || '') + seg;
              frontD[nP] = (frontD[nP] || '') + seg;
            }
          }
        }
      }

      const rngP = mulberry32((localSeed * 9973 + 54321) | 0);
      const particules = Array.from({ length: 200 }, () => ({
        x: (rngP() * VB_W).toFixed(1),
                                                            y: (rngP() * VB_H).toFixed(1),
      }));

      const paysCentres = {};
      for (let ri = 0; ri < ROWS; ri++) {
        for (let ci = 0; ci < COLS; ci++) {
          const pi = paysCarte[ri][ci];
          if (pi === -1) continue;
          if (!paysCentres[pi]) paysCentres[pi] = { sumC: 0, sumR: 0, n: 0 };
          paysCentres[pi].sumC += ci;
          paysCentres[pi].sumR += ri;
          paysCentres[pi].n++;
        }
      }

      return { oceanSurfD, oceanFaceD, oceanGradD,
        terreSurfD, terreFaceD, terreGradD,
        paysD, frontD, coteD: coteSegs.join(''),
                          particules, nRoyaumes: nbPays, paysCentres };
  }, [localSeed]);

  const { oceanSurfD, oceanFaceD, oceanGradD,
    terreSurfD, terreFaceD, terreGradD,
    paysD, frontD, coteD, particules, nRoyaumes, paysCentres } = svgData;

    useEffect(() => {
      if (paysSelectionne == null) return;
      const centre = paysCentres[paysSelectionne];
      if (!centre) return;
      const [svgX, svgY] = hexCenter(centre.sumC / centre.n, centre.sumR / centre.n);
      const scale = 3.0;
      setXf({
        scale,
        x: window.innerWidth  / 2 - svgX * scale,
        y: window.innerHeight / 2 - svgY * scale,
      });
    }, [paysSelectionne, paysCentres]);

    const nPart = lod === 2 ? 200 : 120;

    return (
      <div ref={wrapRef}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden',
        backgroundColor: '#061628', cursor: 'grab', userSelect: 'none' }}
        onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}>

        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'all' }}
          onPointerDown={e => e.stopPropagation()}>

          {onRetour
            ? <button onClick={onRetour} style={btnStyle}>
            {paysSelectionne !== null ? '← PLANISPHÈRE' : '← GLOBE'}
            </button>
            : <button onClick={onMondeReel} style={btnStyle}>← MONDE RÉEL</button>
          }

          {!onRetour && (
            <button onClick={() => setLocalSeed(Math.floor(Math.random() * 99999))}
            style={btnStyle}>
            ⟳ NOUVEAU MONDE
            </button>
          )}

          <span style={{ padding: '6px 18px', background: 'rgba(0,8,22,0.85)',
            border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
            color: 'rgba(0,210,255,0.85)', fontSize: '0.78rem',
            fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            MONDE #{localSeed}
            </span>

            {paysSelectionne !== null
              ? <span style={{ color: 'rgba(0,200,255,0.45)', fontSize: '0.75rem',
                fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                ROYAUME #{paysSelectionne}
                </span>
                : <span style={{ color: 'rgba(0,200,255,0.45)', fontSize: '0.75rem',
                  fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  {nRoyaumes} royaumes
                  </span>
            }

              <span style={{ color: 'rgba(0,200,255,0.25)', fontSize: '0.68rem',
                fontFamily: 'monospace' }}>
                {xf.scale.toFixed(2)}× | {COLS * ROWS} hex
              </span>
            </div>

              <div style={{
                position: 'absolute',
                transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.scale})`,
            transformOrigin: '0 0',
            width: `${VB_W}px`,
            height: `${VB_H}px`,
              }}>
              <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%' }}>

              <defs>
              <linearGradient id="ombre-couche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
              </linearGradient>
              <filter id="pays-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2"/>
              </filter>
              <filter id="cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3"/>
              </filter>
              <filter id="relief-shadow" x="-0.5" y="-0.5" width="2" height="2">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="3" dy="3" result="offsetblur"/>
              <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
              </feMerge>
              </filter>
              </defs>

              <rect width={VB_W} height={VB_H} fill="#061628" />

              {particules.slice(0, nPart).map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="0.8" fill="#1a3a5a" opacity="0.4" />
              ))}

              {[0, 1, 2, 3].map(i => (
                <React.Fragment key={`oi-${i}`}>
                {i > 0 && Object.entries(oceanFaceD[i]).map(([c, d]) => d &&
                  <path key={`of-${i}-${c}`} d={d} fill={c} stroke="none" />
                )}
                {i > 0 && oceanGradD[i] &&
                  <path key={`og-${i}`} d={oceanGradD[i]} fill="url(#ombre-couche)" stroke="none" />
                }
                {Object.entries(oceanSurfD[i]).map(([c, d]) => d &&
                  <path key={`os-${i}-${c}`} d={d} fill={c} stroke="none" />
                )}
                </React.Fragment>
              ))}

              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <React.Fragment key={`ti-${i}`}>
                {i > 0 && Object.entries(terreFaceD[i]).map(([c, d]) => d &&
                  <path key={`tf-${i}-${c}`} d={d} fill={c} stroke="none" />
                )}
                {i > 0 && terreGradD[i] &&
                  <path key={`tg-${i}`} d={terreGradD[i]} fill="url(#ombre-couche)" stroke="none" />
                }
                {Object.entries(terreSurfD[i]).map(([c, d]) => d &&
                  <path
                  key={`ts-${i}-${c}`}
                  d={d}
                  fill={c}
                  stroke="none"
                  filter={i === 1 ? "url(#relief-shadow)" : undefined}
                  />
                )}
                </React.Fragment>
              ))}

              {coteD &&
                <path d={coteD} stroke="rgba(0,210,245,0.50)" strokeWidth="0.9" fill="none" />
              }

              {Object.keys(frontD).map(idx => {
                const id  = +idx;
                const isH = hoveredPays === id;
                const col = neonPays(id);
                return (
                  <g key={`pays-${idx}`}>
                  <path d={frontD[idx]} stroke={col}
                  strokeWidth={isH ? '4' : '2'} fill="none"
                  filter="url(#pays-glow)" opacity={isH ? '0.55' : '0.08'} />
                  <path d={frontD[idx]} stroke={col}
                  strokeWidth={isH ? '1.5' : '0.5'} fill="none"
                  opacity={isH ? '0.9' : '0.2'} />
                  {paysD[idx] &&
                    <path d={paysD[idx]} fill={col}
                    fillOpacity={isH ? '0.08' : '0.001'} stroke="none"
                    onMouseEnter={() => setHoveredPays(id)}
                    onMouseLeave={() => setHoveredPays(null)}
                    onDoubleClick={() => onPaysDoubleClick?.(id)} />
                  }
                  </g>
                );
              })}

              {/* NOUVEAUX NUAGES - sur toute la carte, taille aléatoire */}
              {nuagesVisibles && nuages.map((cloud) => {
                const facteurVitesse = 80; // ← ajuste ici (30=lent, 80=moyen, 150=rapide)
                const xPos = (cloud.x + cloudOffset * cloud.speed * facteurVitesse) % (VB_W + 500) - 250;
                const path = createCloudPath(xPos, cloud.y, cloud.size);
                return (
                  <path
                  key={`cloud-${cloud.id}`}
                  d={path}
                  fill={`rgba(245, 248, 255, ${cloud.opacity * nuagesOpacity})`}
                  filter="url(#cloud-blur)"
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              </svg>
              </div>
              </div>
    );
}
