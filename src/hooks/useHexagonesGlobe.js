// hooks/useHexagonesGlobe.js — génération des hexagones 3D sur le globe fictif
import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { fbm } from '../utils/bruit.js'
import { COLS, ROWS, SEUIL_TERRE, voisin } from '../utils/hex.js'
import { biomeCouleur } from '../utils/palette.js'

const RAYON_GLOBE = 3.8
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

function createHexagonMesh(lon, lat, color) {
  const [cx, cy, cz] = lonLatToXYZ(lon, lat, RAYON_GLOBE + 0.025)
  const axis = new THREE.Vector3(cx, cy, cz).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)

  const shape = new THREE.Shape()
  const hexRadius = 0.19
  for (let i = 0; i < 6; i++) {
    const angle = -PI / 2 + i * PI * 2 / 6
    const x = Math.cos(angle) * hexRadius
    const y = Math.sin(angle) * hexRadius
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
  }
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 1, depth: 0.04,
    bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2,
  })
  geometry.computeVertexNormals()
  geometry.rotateX(PI / 2)
  geometry.rotateZ(PI)

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -(box.min.z + box.max.z) / 2,
  )

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: 0.1,
  }))
  mesh.position.set(cx, cy, cz)
  mesh.quaternion.copy(quaternion)
  return mesh
}

export function useHexagonesGlobe(seed) {
  const [hexMeshes, setHexMeshes] = useState([])

  useEffect(() => {
    const heights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h    = fbm(c / COLS * 3.8, r / ROWS * 3.8, seed)
        const fade = Math.min(1, c / 25, (COLS - 1 - c) / 25, r / 15, (ROWS - 1 - r) / 15)
        return h * fade
      })
    )

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

    const meshes = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (massIdx[r][c] === -1) continue
        const lon = (c / COLS) * 360 - 180
        const lat = 90 - (r / ROWS) * 180
        try { meshes.push(createHexagonMesh(lon, lat, biomeCouleur(heights[r][c]))) } catch (e) {}
      }
    }
    setHexMeshes(meshes)
  }, [seed])

  return hexMeshes
}

export { RAYON_GLOBE }
