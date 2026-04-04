// utils/nuages.js — génération et rendu des nuages SVG
export const NUAGES_VISIBLE_MAX_SCALE = 1.5

export function genererNuages(largeur, hauteur) {
  const count = Math.floor(Math.random() * 16) + 15  // 15 à 30
  const nuages = []
  for (let i = 0; i < count; i++) {
    let baseSize
    const rand = Math.random()
    if (rand < 0.4)      baseSize = 20 + Math.random() * 15
    else if (rand < 0.7) baseSize = 35 + Math.random() * 20
    else                 baseSize = 55 + Math.random() * 25

    const baseY       = 30 + Math.random() * (hauteur - 60)
    const baseOpacity = 0.4 + Math.random() * 0.4
    const baseSpeed   = 0.6 + Math.random() * 1.2

    nuages.push({
      id:              i,
      phase:           Math.random() * Math.PI * 2,
      baseX:           Math.random() * (largeur + 400) - 200,
      baseY,
      baseSize,
      baseSpeed,
      baseOpacity,
      amplitudeY:      20 + Math.random() * 40,
      amplitudeSize:   8  + Math.random() * 20,
      amplitudeOpacity:0.15 + Math.random() * 0.25,
      speedVariation:  0.3 + Math.random() * 0.8,
      // valeurs courantes initialisées aux valeurs de base
      currentY:        baseY,
      currentSize:     baseSize,
      currentOpacity:  baseOpacity,
      currentSpeed:    baseSpeed,
    })
  }
  return nuages
}

export function createCloudPath(x, y, size) {
  const r = size
  return `M${x},${y - r*0.5} Q${x + r*0.4},${y - r*0.7} ${x + r*0.8},${y - r*0.2} Q${x + r*1.0},${y - r*0.3} ${x + r*0.9},${y} Q${x + r*1.1},${y + r*0.2} ${x + r*0.7},${y + r*0.4} Q${x + r*0.5},${y + r*0.5} ${x + r*0.2},${y + r*0.4} Q${x},${y + r*0.6} ${x - r*0.2},${y + r*0.4} Q${x - r*0.5},${y + r*0.5} ${x - r*0.7},${y + r*0.4} Q${x - r*1.1},${y + r*0.2} ${x - r*0.9},${y} Q${x - r*1.0},${y - r*0.3} ${x - r*0.8},${y - r*0.2} Q${x - r*0.4},${y - r*0.7} ${x},${y - r*0.5}Z`
}
