// utils/bruit.js — bruit procédural (value noise + fbm)
function hash2(x, y, s) {
  let h = (x * 1619 + y * 31337 + s * 1000003) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h >>> 0) / 4294967296
}

function smoothstep(t) { return t * t * (3 - 2 * t) }

function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi)
  return hash2(xi,   yi,   s) * (1-xf)*(1-yf)
       + hash2(xi+1, yi,   s) * xf    *(1-yf)
       + hash2(xi,   yi+1, s) * (1-xf)*yf
       + hash2(xi+1, yi+1, s) * xf    *yf
}

export function fbm(x, y, s) {
  return valueNoise(x,   y,   s)       * 0.50
       + valueNoise(x*2, y*2, s+1111)  * 0.30
       + valueNoise(x*4, y*4, s+2222)  * 0.20
}
