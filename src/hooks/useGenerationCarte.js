// hooks/useGenerationCarte.js — génération procédurale de la carte hex fictive
import { useMemo } from 'react'
import { mulberry32 } from '../utils/tectonique.js'
import { fbm } from '../utils/bruit.js'
import { COLS, ROWS, VB_W, VB_H, SEUIL_TERRE, DX, DY, voisin, hexCornersOff, hexPath, hexEdge, ptsToPath } from '../utils/hex.js'
import { biomeCouleur, couleurOcean, shuffler, nbCouchesTerre, nbCouchesOcean, eclairir, assombrir } from '../utils/palette.js'

// ─── Noms procéduraux ─────────────────────────────────────────────────────────
const SYLLABES = ['ar','el','an','or','en','al','ir','on','eth','un','ath','ul','os','is','ur','im','az','ev','ix','ow']
const SUFFIXES = ['ia','or','um','an','eth','ar','is','ath','orn','on']

function genererNom(rng) {
  const n = 2 + Math.floor(rng() * 2)
  let nom = ''
  for (let i = 0; i < n; i++) nom += SYLLABES[Math.floor(rng() * SYLLABES.length)]
  nom += SUFFIXES[Math.floor(rng() * SUFFIXES.length)]
  return nom.charAt(0).toUpperCase() + nom.slice(1)
}

// ─── Biome dominant par hauteur moyenne ──────────────────────────────────────
function biomeParHauteur(h) {
  if (h < 0.65) return 'Plaines'
  if (h < 0.72) return 'Forêts'
  if (h < 0.80) return 'Collines'
  if (h < 0.90) return 'Montagnes'
  return 'Hauts sommets'
}

// ─── Quad SVG pour face isométrique ──────────────────────────────────────────
function facePath(a, b, c, d) {
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}L${c[0].toFixed(1)},${c[1].toFixed(1)}L${d[0].toFixed(1)},${d[1].toFixed(1)}Z`
}

// Avec offset (-DX,-DY) vers haut-gauche, les faces visibles sont sur k=1,2,3
const EDGES_FACES_VISIBLES = [1, 2, 3]

export function useGenerationCarte(localSeed) {
  return useMemo(() => {

    // ─── Heightmap ────────────────────────────────────────────────────────────
    const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h = fbm(c / COLS * 3.8, r / ROWS * 3.8, localSeed)
        const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15)
        return h * fade
      })
    )

    // ─── Masses terrestres ────────────────────────────────────────────────────
    const massIdx = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1))
    const masses  = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (heights[r][c] < SEUIL_TERRE || massIdx[r][c] !== -1) continue
        const masse = [], q = [[c, r]]
        massIdx[r][c] = masses.length
        while (q.length) {
          const [qc, qr] = q.shift()
          masse.push([qc, qr])
          for (let k = 0; k < 6; k++) {
            const [nc, nr] = voisin(qc, qr, k)
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
            if (heights[nr][nc] < SEUIL_TERRE || massIdx[nr][nc] !== -1) continue
            massIdx[nr][nc] = masses.length
            q.push([nc, nr])
          }
        }
        masses.push(masse)
      }
    }
    masses.forEach(m => { if (m.length < 60) m.forEach(([c, r]) => { massIdx[r][c] = -1 }) })
    const massesFiltrees = masses.filter(m => m.length >= 60)

    // ─── Assignation pays (voronoï) ───────────────────────────────────────────
    const paysCarte = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1))
    const rng = mulberry32((localSeed * 6971 + 12345) | 0)
    let nbPays = 0
    massesFiltrees.forEach(masse => {
      const n = Math.max(1, Math.floor(masse.length / 280))
      const q = []
      shuffler(masse, rng).slice(0, n).forEach(([c, r]) => {
        paysCarte[r][c] = nbPays++
        q.push([c, r])
      })
      while (q.length) {
        const [qc, qr] = q.shift()
        const p = paysCarte[qr][qc]
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(qc, qr, k)
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
          if (massIdx[nr][nc] === -1 || paysCarte[nr][nc] !== -1) continue
          paysCarte[nr][nc] = p
          q.push([nc, nr])
        }
      }
    })

    // ─── Distance côtière (dégradé océan) ─────────────────────────────────────
    const dCote = Array.from({ length: ROWS }, () => new Int8Array(COLS).fill(-1))
    const qCote = []
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (massIdx[r][c] !== -1) continue
        let adjTerre = false
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(c, r, k)
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && massIdx[nr][nc] !== -1) { adjTerre = true; break }
        }
        if (adjTerre) { dCote[r][c] = 0; qCote.push([c, r]) }
      }
    while (qCote.length) {
      const [c, r] = qCote.shift()
      if (dCote[r][c] >= 4) continue
      for (let k = 0; k < 6; k++) {
        const [nc, nr] = voisin(c, r, k)
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
        if (massIdx[nr][nc] !== -1 || dCote[nr][nc] !== -1) continue
        dCote[nr][nc] = dCote[r][c] + 1
        qCote.push([nc, nr])
      }
    }

    // ─── Buffers SVG ──────────────────────────────────────────────────────────
    const oceanSurfD = [{}, {}, {}, {}]
    const oceanFaceD = [{}, {}, {}, {}]
    const oceanGradD = ['', '', '', '']
    const terreSurfD = [{}, {}, {}, {}, {}, {}, {}]
    const terreFaceD = [{}, {}, {}, {}, {}, {}, {}]
    const terreGradD = ['', '', '', '', '', '', '']
    const paysD  = {}
    const frontD = {}
    const coteSegs = []

    function ajout(obj, couleur, path) {
      obj[couleur] = (obj[couleur] || '') + path
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h        = heights[r][c]
        const estTerre = massIdx[r][c] !== -1
        const p        = paysCarte[r][c]
        const hexId    = r * COLS + c

        if (estTerre) {
          const n           = nbCouchesTerre(h)
          const baseCouleur = biomeCouleur(h)

          for (let i = 0; i < n; i++) {
            // Optimisation : couches intérieures cachées → skip
            if (i > 0) {
              let visible = false
              for (let k = 0; k < 6; k++) {
                const [nc, nr] = voisin(c, r, k)
                if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) { visible = true; break }
                if (massIdx[nr][nc] === -1) { visible = true; break }
                if (nbCouchesTerre(heights[nr][nc]) < i + 1) { visible = true; break }
              }
              if (!visible) continue
            }
            ajout(terreSurfD[i], eclairir(baseCouleur, 1 + i * 0.18), ptsToPath(hexCornersOff(c, r, -i * DX, -i * DY)))
          }

          // Faces isométriques (murs visibles entre niveaux)
          if (n >= 2) {
            const faceCouleur  = assombrir(baseCouleur, 0.70)
            const cornersHaut  = hexCornersOff(c, r, -DX, -DY)
            const cornersBas   = hexCornersOff(c, r,   0,   0)
            for (const k of EDGES_FACES_VISIBLES) {
              const [nc, nr] = voisin(c, r, k)
              const nCouches = (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && massIdx[nr][nc] !== -1)
                ? nbCouchesTerre(heights[nr][nc]) : 0
              if (nCouches >= 2) continue
              const k1 = (k + 1) % 6
              ajout(terreFaceD[1], faceCouleur,
                facePath(cornersHaut[k], cornersHaut[k1], cornersBas[k1], cornersBas[k]))
            }
          }

          if (p !== -1) paysD[p] = (paysD[p] || '') + hexPath(c, r)

        } else {
          const dcVal       = dCote[r][c]
          const baseCouleur = couleurOcean(dcVal >= 0 ? Math.min(dcVal, 2) : 3)
          ajout(oceanSurfD[0], baseCouleur, ptsToPath(hexCornersOff(c, r, 0, 0)))
          const n = nbCouchesOcean(h)
          for (let i = 1; i <= n; i++) {
            if (dcVal === 0 && i === 1) continue  // plage : skip première couche de profondeur
            ajout(oceanSurfD[i], eclairir(baseCouleur, 1 - i * 0.15), ptsToPath(hexCornersOff(c, r, i * DX, i * DY)))
          }
        }

        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(c, r, k)
          const inB    = nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS
          const nId    = inB ? nr * COLS + nc : -1
          const lowest = !inB || hexId < nId
          const nTerre = inB && massIdx[nr][nc] !== -1
          const nP     = inB ? paysCarte[nr][nc] : -1

          if (lowest && estTerre !== nTerre) coteSegs.push(hexEdge(c, r, k))
          if (lowest && estTerre && nTerre && p !== -1 && nP !== -1 && p !== nP) {
            const seg = hexEdge(c, r, k)
            frontD[p]  = (frontD[p]  || '') + seg
            frontD[nP] = (frontD[nP] || '') + seg
          }
        }
      }
    }

    // ─── Particules décoratives ───────────────────────────────────────────────
    const rngP = mulberry32((localSeed * 9973 + 54321) | 0)
    const particules = Array.from({ length: 200 }, () => ({
      x: (rngP() * VB_W).toFixed(1),
      y: (rngP() * VB_H).toFixed(1),
    }))

    // ─── Centres + stats + noms des pays ─────────────────────────────────────
    const paysCentres = {}
    for (let ri = 0; ri < ROWS; ri++) {
      for (let ci = 0; ci < COLS; ci++) {
        const pi = paysCarte[ri][ci]
        if (pi === -1) continue
        if (!paysCentres[pi]) paysCentres[pi] = { sumC: 0, sumR: 0, sumH: 0, n: 0 }
        paysCentres[pi].sumC += ci
        paysCentres[pi].sumR += ri
        paysCentres[pi].sumH += heights[ri][ci]
        paysCentres[pi].n++
      }
    }

    const rngNoms = mulberry32((localSeed * 4457 + 7919) | 0)
    const nomsPays   = {}
    const biomesPays = {}
    for (let i = 0; i < nbPays; i++) {
      nomsPays[i]   = genererNom(rngNoms)
      if (paysCentres[i])
        biomesPays[i] = biomeParHauteur(paysCentres[i].sumH / paysCentres[i].n)
    }

    return {
      oceanSurfD, oceanFaceD, oceanGradD,
      terreSurfD, terreFaceD, terreGradD,
      paysD, frontD, coteD: coteSegs.join(''),
      particules, nRoyaumes: nbPays, paysCentres,
      nomsPays, biomesPays,
    }
  }, [localSeed])
}
