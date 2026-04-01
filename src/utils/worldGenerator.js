// src/utils/worldGenerator.js
// Génère un monde fictif reproductible à partir d'une seed.
// Pipeline : GeoJSON source → shuffle → groupes → translation → union → Voronoï → features

import * as turf from '@turf/turf';
import { Delaunay } from 'd3-delaunay';

// ─── Cache GeoJSON source ─────────────────────────────────────────────────────
let _cache110m = null;
let _cache50m  = null;

// ─── Cache résultats générés ──────────────────────────────────────────────────
const _mondesCache = new Map();

// ─── PRNG déterministe (Mulberry32) ──────────────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Centres continentaux bien répartis ──────────────────────────────────────
function genererCentres(nbMasses, rand) {
  const CONFIG = {
    1: [[  0,  20]],
    2: [[-60,  20], [ 80,  10]],
    3: [[-100, 25], [ 20,  30], [120,  10]],
    4: [[ -90, 25], [ 25,  35], [115,  10], [-20, -35]],
    5: [[-100, 30], [ 20,  45], [120,  30], [-60, -30], [100, -25]],
  };
  const base = CONFIG[Math.min(nbMasses, 5)] || CONFIG[3];
  return base.map(([lon, lat]) => [
    lon + (rand() - 0.5) * 20,
    Math.max(-60, Math.min(60, lat + (rand() - 0.5) * 15)),
  ]);
}

// ─── Translation d'un feature vers un centre cible (avec jitter) ─────────────
function translaterVersCentre(feature, lonCible, latCible, rand) {
  try {
    const centroide = turf.centroid(feature);
    const [lon0, lat0] = centroide.geometry.coordinates;
    const dLon = lonCible - lon0 + (rand() - 0.5) * 30;
    const dLat = latCible - lat0 + (rand() - 0.5) * 20;

    const deplacer = ring => ring.map(([lon, lat]) => {
      let newLon = lon + dLon;
      let newLat = Math.max(-89, Math.min(89, lat + dLat));
      while (newLon >  180) newLon -= 360;
      while (newLon < -180) newLon += 360;
      return [newLon, newLat];
    });

    const g = feature.geometry;
    if (g.type === 'Polygon') {
      feature.geometry = { ...g, coordinates: g.coordinates.map(deplacer) };
    } else if (g.type === 'MultiPolygon') {
      feature.geometry = { ...g, coordinates: g.coordinates.map(p => p.map(deplacer)) };
    }
  } catch { /* feature malformé, on ignore */ }
}

// ─── Chargement GeoJSON source (avec cache) ───────────────────────────────────
async function chargerGeoJSON(resolution) {
  if (resolution === '50m') {
    if (!_cache50m) {
      const r = await fetch('/geojson/ne_50m_admin_0_countries.geojson');
      _cache50m = await r.json();
    }
    return _cache50m;
  }
  if (!_cache110m) {
    const r = await fetch('/geojson/ne_110m_admin_0_countries.geojson');
    _cache110m = await r.json();
  }
  return _cache110m;
}

// ─── Noms procéduraux ─────────────────────────────────────────────────────────
const PREFIXES = ['Nord', 'Sud', 'Est', 'Ouest', 'Haut', 'Grand', 'Nouveau', 'Ancien'];
const RACINES  = ['Alvar', 'Morvai', 'Zephor', 'Calend', 'Thyran', 'Ossian', 'Veldur',
                  'Arkhen', 'Sylvae', 'Umbral', 'Caelum', 'Ferris', 'Ondur'];
const SUFFIXES = ['ia', 'land', 'ie', 'istan', 'heim', 'garde', 'onie', 'burg'];

function genererNom(rand) {
  const racine  = RACINES [Math.floor(rand() * RACINES.length)];
  const suffixe = SUFFIXES[Math.floor(rand() * SUFFIXES.length)];
  const prefixe = rand() < 0.3 ? PREFIXES[Math.floor(rand() * PREFIXES.length)] + ' ' : '';
  return prefixe + racine + suffixe;
}

// ─── Couleurs bien distribuées (golden angle) ─────────────────────────────────
function genererCouleur(index, rand) {
  const hue = (index * 137.508 + rand() * 20) % 360;
  const sat = 55 + rand() * 20;
  const lum = 35 + rand() * 20;
  return `hsl(${Math.round(hue)},${Math.round(sat)}%,${Math.round(lum)}%)`;
}

// ─── Convertit une cellule Voronoï (d3-delaunay) en feature GeoJSON ───────────
function voronoiCelluleToGeoJSON(voronoi, index) {
  const cell = voronoi.cellPolygon(index);
  if (!cell || cell.length < 4) return null;
  // cellPolygon retourne [[x,y], ...] avec le point de fermeture inclus
  return turf.polygon([cell]);
}

// ─── Fragmentation : découpe un pays en n×n cellules de grille ───────────────
function genererGrille(feature, n, rand) {
  const [minX, minY, maxX, maxY] = turf.bbox(feature);
  const wCell = (maxX - minX) / n;
  const hCell = (maxY - minY) / n;
  const fragments = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      try {
        const cellule = turf.bboxPolygon([
          minX + c * wCell, minY + r * hCell,
          minX + (c + 1) * wCell, minY + (r + 1) * hCell,
        ]);
        const inter = turf.intersect(turf.featureCollection([feature, cellule]));
        if (inter && turf.area(inter) > 1000) fragments.push(inter);
      } catch {}
    }
  }
  void rand;
  return fragments;
}

// ─── Pipeline principal (interne) ─────────────────────────────────────────────
async function _generer(seed, { type = '3', nbPaysMax = 6, resolution = '110m' } = {}) {
  const rand    = mulberry32(seed);
  const geoData = await chargerGeoJSON(resolution);

  // Nombre de pays source à échantillonner
  const NB_SOURCE = { pangee: 60, archipel: 15, '2': 45, '3': 40, '4': 35, '5': 30 };
  const nbSource  = NB_SOURCE[type] ?? 40;

  const features = geoData.features.filter(f => f.geometry &&
    (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));

  // Fragmentation : chaque pays source est découpé en 2×2 ou 3×3 fragments
  // → aucune forme reconnaissable, continents organiques
  const fragments = [];
  shuffleSeeded(features, rand).slice(0, nbSource).forEach(feature => {
    const nb = 2 + Math.floor(rand() * 2); // grille 2×2 ou 3×3
    genererGrille(JSON.parse(JSON.stringify(feature)), nb, rand)
      .forEach(frag => fragments.push(frag));
  });
  const selection = shuffleSeeded(fragments, rand);

  // Nombre de masses continentales
  const nbMasses = type === 'pangee' ? 1
                 : type === 'archipel' ? Math.max(2, Math.floor(nbPaysMax / 2))
                 : parseInt(type);

  const centres = genererCentres(nbMasses, rand);

  // Diviser la sélection en groupes
  const groupes = Array.from({ length: nbMasses }, () => []);
  if (type === 'pangee') {
    groupes[0] = selection.map(f => JSON.parse(JSON.stringify(f)));
  } else {
    const tailleGroupe = Math.ceil(selection.length / nbMasses);
    selection.forEach((f, i) => {
      const g = Math.min(Math.floor(i / tailleGroupe), nbMasses - 1);
      groupes[g].push(JSON.parse(JSON.stringify(f)));
    });
  }

  // Translater chaque groupe vers son centre, puis agrandir chaque feature
  groupes.forEach((groupe, i) => {
    const [lonCible, latCible] = centres[i];
    groupe.forEach(f => {
      translaterVersCentre(f, lonCible, latCible, rand);
      try {
        const centroid = turf.centroid(f);
        const facteur = 3; // ×3
        const agrandi = turf.transformScale(f, facteur, { origin: centroid });
        f.geometry = agrandi.geometry;
      } catch { /* feature malformée, on ignore */ }
    });
  });

  // Union par groupe → masse continentale
  const massesFeatures = [];
  const toutesFeatures = [];
  let paysIndex = 0;

  for (let i = 0; i < groupes.length; i++) {
    const groupe = groupes[i].filter(f => f.geometry);
    if (!groupe.length) continue;

    let masse = null;
    try {
      const simplified = groupe.map(f => {
        try { return turf.simplify(f, { tolerance: 0.5, highQuality: false }); }
        catch { return f; }
      });
      masse = turf.union(turf.featureCollection(simplified));
    } catch {
      try {
        masse = turf.union(turf.featureCollection(groupe));
      } catch {
        masse = groupe.reduce((acc, f) => acc ?? f, null);
      }
    }
    if (!masse) continue;

    try {
      masse = turf.simplify(masse, { tolerance: 0.3, highQuality: false });
    } catch {}

    const surface = (() => { try { return turf.area(masse) / 1e12; } catch { return 0; } })();
    masse.properties = { type: 'continent', id: `c${i}`, surface };
    massesFeatures.push({ masse, index: i });
    // Les continents ne sont pas poussés dans toutesFeatures — seuls les pays sont rendus
  }

  // Voronoï dans chaque masse → pays fictifs
  const surfaceTotal = massesFeatures.reduce((s, { masse }) => {
    try { return s + turf.area(masse); } catch { return s; }
  }, 0);

  for (const { masse, index: ci } of massesFeatures) {
    const surfaceMasse = (() => { try { return turf.area(masse); } catch { return 0; } })();
    const nb = Math.max(1, Math.round((surfaceMasse / (surfaceTotal || 1)) * nbPaysMax));
    const bbox = turf.bbox(masse);

    // Générer nb points dans le polygone
    const points = [];
    let attempts = 0;
    while (points.length < nb && attempts < nb * 80) {
      const lon = bbox[0] + rand() * (bbox[2] - bbox[0]);
      const lat = bbox[1] + rand() * (bbox[3] - bbox[1]);
      try {
        if (turf.booleanPointInPolygon(turf.point([lon, lat]), masse)) {
          points.push([lon, lat]);
        }
      } catch {}
      attempts++;
    }

    if (!points.length) continue;

    if (points.length === 1) {
      // Un seul pays = toute la masse
      const pays = JSON.parse(JSON.stringify(masse));
      pays.properties = {
        type: 'country', id: `p${paysIndex}`, continentId: `c${ci}`,
        nom: genererNom(rand),
        couleur: genererCouleur(paysIndex, rand),
        capitale: { lon: points[0][0], lat: points[0][1] },
      };
      toutesFeatures.push(pays);
      paysIndex++;
      continue;
    }

    // Voronoï clippé par la bbox élargie
    const bboxPadded = [bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2];
    const delaunay = Delaunay.from(points);
    const voronoi  = delaunay.voronoi(bboxPadded);

    for (let j = 0; j < points.length; j++) {
      try {
        const cellule = voronoiCelluleToGeoJSON(voronoi, j);
        if (!cellule) continue;
        const pays = turf.intersect(turf.featureCollection([cellule, masse]));
        if (!pays) continue;
        pays.properties = {
          type: 'country', id: `p${paysIndex}`, continentId: `c${ci}`,
          nom: genererNom(rand),
          couleur: genererCouleur(paysIndex, rand),
          capitale: { lon: points[j][0], lat: points[j][1] },
        };
        toutesFeatures.push(pays);
        paysIndex++;
      } catch { /* cellule invalide */ }
    }
  }

  return {
    type: 'FeatureCollection',
    seed,
    type_monde: type === 'pangee' ? 'pangee' : type === 'archipel' ? 'archipel' : `continents_${type}`,
    features: toutesFeatures,
  };
}

// ─── API publique ─────────────────────────────────────────────────────────────
export async function genererMonde(seed, options = {}) {
  const { resolution = '110m', type = '3' } = options;
  const cacheKey = `${seed}_${resolution}_${type}`;
  if (_mondesCache.has(cacheKey)) return _mondesCache.get(cacheKey);

  const result = await _generer(seed, options);
  _mondesCache.set(cacheKey, result);
  return result;
}

// ─── Sécession (structure prévue, non implémentée) ────────────────────────────
export function sécessionPays(monde, paysId, seed) {
  // TODO: Voronoï sur 2 points dans le polygone → 2 nouveaux pays
  void monde; void paysId; void seed;
}
