// utils/hex.js — constantes et géométrie de la grille hexagonale
export const HEX_R       = 7
export const COLS        = 240
export const ROWS        = 170
export const W3          = Math.sqrt(3)
export const VB_W        = 3000
export const VB_H        = 1800
export const SEUIL_TERRE = 0.55
export const DY          = 2
export const DX          = 1

export function hexCenter(col, row) {
  const x = col * W3 * HEX_R + (row % 2 === 1 ? W3 / 2 * HEX_R : 0) + W3 * HEX_R
  const y = row * 1.5 * HEX_R + HEX_R + 5
  return [x, y]
}

export function hexCorners(col, row) {
  const [cx, cy] = hexCenter(col, row)
  return Array.from({ length: 6 }, (_, k) => {
    const a = -Math.PI / 2 + k * Math.PI / 3
    return [cx + HEX_R * Math.cos(a), cy + HEX_R * Math.sin(a)]
  })
}

export function hexCornersOff(col, row, ox, oy) {
  const [cx, cy] = hexCenter(col, row)
  return Array.from({ length: 6 }, (_, k) => {
    const a = -Math.PI / 2 + k * Math.PI / 3
    return [cx + HEX_R * Math.cos(a) + ox, cy + HEX_R * Math.sin(a) + oy]
  })
}

export function hexPath(col, row) {
  const pts = hexCorners(col, row)
  return pts.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z'
}

export function hexEdge(col, row, k) {
  const pts = hexCorners(col, row)
  const [x0, y0] = pts[k]
  const [x1, y1] = pts[(k + 1) % 6]
  return `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`
}

export function ptsToPath(pts) {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z'
}

export function voisin(col, row, k) {
  const D = [
    [[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]],
    [[1,-1],[1,0],[1,1],[0,1], [-1,0],[0,-1] ],
  ]
  const [dc, dr] = D[row % 2][k]
  return [col + dc, row + dr]
}
