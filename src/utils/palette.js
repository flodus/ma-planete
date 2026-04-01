// utils/palette.js — biomes, couleurs terrain/océan, helpers visuels
const BIOMES = [
  { seuil: 0.30, couleur: '#020a18' },
  { seuil: 0.42, couleur: '#041422' },
  { seuil: 0.55, couleur: '#0d2235' },
  { seuil: 0.65, couleur: '#1a3045' },
  { seuil: 0.72, couleur: '#1e3a40' },
  { seuil: 0.80, couleur: '#243545' },
  { seuil: 0.90, couleur: '#2a3050' },
  { seuil: Infinity, couleur: '#1e2a38' },
]

export function biomeCouleur(h) {
  for (const { seuil, couleur } of BIOMES) if (h < seuil) return couleur
  return BIOMES[BIOMES.length - 1].couleur
}

export function couleurOcean(d) {
  if (d === 0) return '#0d2a4a'
  if (d === 1) return '#0a2240'
  return '#071a30'
}

export function assombrir(hex, f = 0.6) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function neonPays(idx) {
  let hue = (idx * 47) % 360
  if (hue >= 165 && hue <= 195) hue += 30
  return `hsl(${hue},90%,65%)`
}

export function shuffler(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function nbCouchesTerre(h) {
  if (h >= 0.60) return 2
  return 1
}

export function nbCouchesOcean(h) {
  if (h < 0.20) return 2
  if (h < 0.42) return 1
  return 0
}

export function eclairir(hexColor, factor) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(parseInt(hexColor.slice(1, 3), 16) * factor)
  const g = clamp(parseInt(hexColor.slice(3, 5), 16) * factor)
  const b = clamp(parseInt(hexColor.slice(5, 7), 16) * factor)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
