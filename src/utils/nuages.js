// utils/nuages.js — génération et rendu des nuages SVG
export const NUAGES_VISIBLE_MAX_SCALE = 1.5

export function genererNuages(largeur, hauteur) {
  const nuages = []
  for (let i = 0; i < 45; i++) {
    let size
    const rand = Math.random()
    if (rand < 0.4)      size = 20 + Math.random() * 15
    else if (rand < 0.7) size = 35 + Math.random() * 20
    else                 size = 55 + Math.random() * 25

    nuages.push({
      id:      i,
      x:       Math.random() * (largeur + 400) - 200,
      y:       30 + Math.random() * (hauteur - 60),
      size,
      speed:   0.6 + Math.random() * 1.2,
      opacity: 0.4 + Math.random() * 0.4,
    })
  }
  return nuages
}

export function createCloudPath(x, y, size) {
  const r = size
  return `M${x},${y - r*0.5} Q${x + r*0.4},${y - r*0.7} ${x + r*0.8},${y - r*0.2} Q${x + r*1.0},${y - r*0.3} ${x + r*0.9},${y} Q${x + r*1.1},${y + r*0.2} ${x + r*0.7},${y + r*0.4} Q${x + r*0.5},${y + r*0.5} ${x + r*0.2},${y + r*0.4} Q${x},${y + r*0.6} ${x - r*0.2},${y + r*0.4} Q${x - r*0.5},${y + r*0.5} ${x - r*0.7},${y + r*0.4} Q${x - r*1.1},${y + r*0.2} ${x - r*0.9},${y} Q${x - r*1.0},${y - r*0.3} ${x - r*0.8},${y - r*0.2} Q${x - r*0.4},${y - r*0.7} ${x},${y - r*0.5}Z`
}
