// src/utils/generationFictif.js — FBM pour texture globe fictif Three.js

export const SEUIL_TERRE = 0.55;

function hash2(x, y, s) {
  let h = (x * 1619 + y * 31337 + s * 1000003) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h >>> 0) / 4294967296;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
  return hash2(xi,   yi,   s) * (1 - xf) * (1 - yf)
       + hash2(xi+1, yi,   s) * xf       * (1 - yf)
       + hash2(xi,   yi+1, s) * (1 - xf) * yf
       + hash2(xi+1, yi+1, s) * xf       * yf;
}

function fbm(x, y, s) {
  return valueNoise(x,   y,   s)      * 0.50
       + valueNoise(x*2, y*2, s+1111) * 0.30
       + valueNoise(x*4, y*4, s+2222) * 0.20;
}

// Génère un canvas equirectangulaire 1024×512 pour la texture sphère
export function creerCanvasFictif(seed) {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h    = fbm(x / W * 3.8, y / H * 3.8, seed);
      const fade = Math.min(1, x / 25, (W - 1 - x) / 25, y / 15, (H - 1 - y) / 15);
      const hf   = h * fade;
      const i4   = (y * W + x) * 4;

      if (hf >= SEUIL_TERRE) {
        // Terre : vert-gris sombre → presque blanc au sommet
        const t = Math.min(1, (hf - SEUIL_TERRE) / 0.45);
        img.data[i4]   = Math.round(18  + t * 100);
        img.data[i4+1] = Math.round(45  + t * 55);
        img.data[i4+2] = Math.round(38  + t * 105);
      } else {
        // Océan : bleu profond → rivage légèrement plus clair
        const t = hf / SEUIL_TERRE;
        img.data[i4]   = Math.round(2   + t * 13);
        img.data[i4+1] = Math.round(10  + t * 32);
        img.data[i4+2] = Math.round(25  + t * 55);
      }
      img.data[i4+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}
