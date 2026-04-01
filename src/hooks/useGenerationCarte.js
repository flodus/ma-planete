// hooks/useGenerationCarte.js — génération procédurale de la carte hex fictive
import { useMemo } from 'react'
import { mulberry32 } from '../utils/tectonique.js'
import { fbm } from '../utils/bruit.js'
import { COLS, ROWS, VB_W, VB_H, SEUIL_TERRE, DX, DY, voisin, hexCornersOff, hexPath, hexEdge, ptsToPath } from '../utils/hex.js'
import { biomeCouleur, couleurOcean, shuffler, nbCouchesTerre, nbCouchesOcean, eclairir } from '../utils/palette.js'

export function useGenerationCarte(localSeed) {
  return useMemo(() => {
    const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h = fbm(c / COLS * 3.8, r / ROWS * 3.8, localSeed)
        const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15)
        return h * fade
      })
    )

    // ─── Détection des masses terrestres ─────────────────────────────────────
    const massIdx = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1))
    const masses  = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (heights[r][c] < SEUIL_TERRE || massIdx[r][c] !== -1) continue
        const masse = []
        const q = [[c, r]]
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
    masses.forEach(m => {
      if (m.length < 60) m.forEach(([c, r]) => { massIdx[r][c] = -1 })
    })
    const massesFiltrees = masses.filter(m => m.length >= 60)

    // ─── Assignation des pays par voronoi ─────────────────────────────────────
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

    // ─── Distance côtière (pour dégradé océan) ────────────────────────────────
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

    // ─── Construction des paths SVG ───────────────────────────────────────────
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
            const pts = hexCornersOff(c, r, -i * DX, -i * DY)
            ajout(terreSurfD[i], eclairir(baseCouleur, 1 + i * 0.18), ptsToPath(pts))
          }
          if (p !== -1) paysD[p] = (paysD[p] || '') + hexPath(c, r)
        } else {
          const dcVal       = dCote[r][c]
          const baseCouleur = couleurOcean(dcVal >= 0 ? Math.min(dcVal, 2) : 3)
          ajout(oceanSurfD[0], baseCouleur, ptsToPath(hexCornersOff(c, r, 0, 0)))
          const n = nbCouchesOcean(h)
          for (let i = 1; i <= n; i++) {
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

    // ─── Centres des pays (pour centrage caméra) ──────────────────────────────
    const paysCentres = {}
    for (let ri = 0; ri < ROWS; ri++) {
      for (let ci = 0; ci < COLS; ci++) {
        const pi = paysCarte[ri][ci]
        if (pi === -1) continue
        if (!paysCentres[pi]) paysCentres[pi] = { sumC: 0, sumR: 0, n: 0 }
        paysCentres[pi].sumC += ci
        paysCentres[pi].sumR += ri
        paysCentres[pi].n++
      }
    }

    return {
      oceanSurfD, oceanFaceD, oceanGradD,
      terreSurfD, terreFaceD, terreGradD,
      paysD, frontD, coteD: coteSegs.join(''),
      particules, nRoyaumes: nbPays, paysCentres,
    }
  }, [localSeed])
}
