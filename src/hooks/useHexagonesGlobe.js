// hooks/useHexagonesGlobe.js — globe fictif : un seul mesh mergé, plein résolution
import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm } from '../utils/bruit.js'
import { COLS, ROWS, SEUIL_TERRE, voisin } from '../utils/hex.js'
import { biomeCouleur } from '../utils/palette.js'

export const RAYON_GLOBE = 3.8
const PI = Math.PI

function lonLatToXYZ(lon, lat, radius) {
  const phi   = (90 - lat) * PI / 180
  const theta = lon * PI / 180
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

// Hexagone plat (ShapeGeometry) positionné sur la sphère avec vertex colors
function hexGeoSphere(lon, lat, hexColor) {
  const [cx, cy, cz] = lonLatToXYZ(lon, lat, RAYON_GLOBE + 0.03)

  const shape = new THREE.Shape()
  const r = 0.055  // rayon hex adapté à plein résolution
  for (let i = 0; i < 6; i++) {
    const a = -PI / 2 + i * PI / 3
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else         shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape, 1)

  // Orienter vers la surface de la sphère
  const axis = new THREE.Vector3(cx, cy, cz).normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
  const mat  = new THREE.Matrix4().makeRotationFromQuaternion(quat)
  mat.setPosition(cx, cy, cz)
  geo.applyMatrix4(mat)

  // Vertex colors
  const n = geo.attributes.position.count
  const cols = new Float32Array(n * 3)
  const c = new THREE.Color(hexColor)
  for (let i = 0; i < n; i++) { cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))

  return geo
}

// Retourne { mesh } — un seul Mesh fusionné pour tout le globe
export function useHexagonesGlobe(seed) {
  const [mesh, setMesh] = useState(null)

  useEffect(() => {
    const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h    = fbm(c / COLS * 3.8, r / ROWS * 3.8, seed)
        const fade = Math.min(1, c / 25, (COLS-1-c) / 25, r / 15, (ROWS-1-r) / 15)
        return h * fade
      })
    )

    // Filtrer les petites masses (îlots isolés)
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

    // Construire toutes les géométries hexagonales
    const geos = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (massIdx[r][c] === -1) continue
        const lon = (c / COLS) * 360 - 180
        const lat = 90 - (r / ROWS) * 180
        try { geos.push(hexGeoSphere(lon, lat, biomeCouleur(heights[r][c]))) } catch {}
      }
    }

    if (!geos.length) return

    const merged = mergeGeometries(geos, false)
    geos.forEach(g => g.dispose())

    const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.6, metalness: 0.05,
    }))
    setMesh(m)
  }, [seed])

  return mesh
}
