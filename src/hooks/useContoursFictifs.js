// hooks/useContoursFictifs.js — contours néon des royaumes fictifs pour le globe 3D
import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { fbm } from '../utils/bruit.js'
import { mulberry32 } from '../utils/tectonique.js'
import { COLS, ROWS, VB_W, VB_H, SEUIL_TERRE, voisin, hexCorners } from '../utils/hex.js'
import { neonPays, shuffler } from '../utils/palette.js'
import { RAYON_GLOBE } from './useHexagonesGlobe.js'

const PI = Math.PI
const R  = RAYON_GLOBE + 0.06

function svgVersSphere(sx, sy) {
  const lon = (sx / VB_W) * 360 - 180
  const lat = 90 - (sy / VB_H) * 180
  const la  = lat * PI / 180
  const lo  = lon * PI / 180
  return [R * Math.cos(la) * Math.sin(lo), R * Math.sin(la), R * Math.cos(la) * Math.cos(lo)]
}

export function useContoursFictifs(seed) {
  const [contours, setContours] = useState([])

  useEffect(() => {
    // ─── Heightmap ────────────────────────────────────────────────────────────
    const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h    = fbm(c / COLS * 3.8, r / ROWS * 3.8, seed)
        const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15)
        return h * fade
      })
    )

    // ─── Masses terrestres (même filtre que useGenerationCarte) ───────────────
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

    // ─── Voronoï royaumes ─────────────────────────────────────────────────────
    const paysCarte = Array.from({ length: ROWS }, () => new Int16Array(COLS).fill(-1))
    const rng = mulberry32((seed * 6971 + 12345) | 0)
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

    // ─── Extraction des arêtes frontières/côtes par royaume ───────────────────
    // segsByPays[id] = Float32Array points (x0,y0,z0, x1,y1,z1, ...)
    const segsByPays = {}
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = paysCarte[r][c]
        if (p === -1) continue
        const hexId  = r * COLS + c
        const coins  = hexCorners(c, r)
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = voisin(c, r, k)
          const inB      = nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS
          const nId      = inB ? nr * COLS + nc : -1
          // Traiter chaque arête une seule fois (hex avec id inférieur)
          if (inB && hexId > nId) continue
          const nP = inB ? paysCarte[nr][nc] : -1
          if (p === nP) continue // même royaume → pas de frontière
          // Convertir les 2 coins de l'arête en coords 3D sphère
          const [x0, y0] = coins[k]
          const [x1, y1] = coins[(k + 1) % 6]
          const s0 = svgVersSphere(x0, y0)
          const s1 = svgVersSphere(x1, y1)
          if (!segsByPays[p]) segsByPays[p] = []
          segsByPays[p].push(...s0, ...s1)
          // Côte côté voisin (autre royaume) → ajouter aussi à nP
          if (nP !== -1) {
            if (!segsByPays[nP]) segsByPays[nP] = []
            segsByPays[nP].push(...s0, ...s1)
          }
        }
      }
    }

    // ─── Construire les BufferGeometry par royaume ────────────────────────────
    const result = Object.entries(segsByPays).map(([idStr, pts]) => {
      const id  = Number(idStr)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
      return { id, geo, couleur: neonPays(id) }
    })

    setContours(prev => {
      prev.forEach(({ geo }) => geo.dispose())
      return result
    })
  }, [seed])

  return contours
}
