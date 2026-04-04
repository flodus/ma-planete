// components/scene/GlobeFictif.jsx — globe fictif : sphère texturée + 1 mesh hex mergé
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fbm } from '../../utils/bruit.js'
import { SEUIL_TERRE } from '../../utils/hex.js'
import { useHexagonesGlobe, RAYON_GLOBE } from '../../hooks/useHexagonesGlobe.js'

function creerTextureFictive(seed) {
  const W = 1024, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h    = fbm(x / W * 3.8, y / H * 3.8, seed)
      const fade = Math.min(1, x / 25, (W - 1 - x) / 25, y / 15, (H - 1 - y) / 15)
      const hf   = h * fade
      const i4   = (y * W + x) * 4
      if (hf >= SEUIL_TERRE) {
        const t = Math.min(1, (hf - SEUIL_TERRE) / 0.45)
        img.data[i4]   = Math.round(18  + t * 100)
        img.data[i4+1] = Math.round(45  + t * 55)
        img.data[i4+2] = Math.round(38  + t * 105)
      } else {
        const t = hf / SEUIL_TERRE
        img.data[i4]   = Math.round(2   + t * 13)
        img.data[i4+1] = Math.round(10  + t * 32)
        img.data[i4+2] = Math.round(25  + t * 55)
      }
      img.data[i4+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

export default function GlobeFictif({ seed }) {
  const groupRef = useRef()
  const hexMesh  = useHexagonesGlobe(seed)
  const texture  = useMemo(() => creerTextureFictive(seed), [seed])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006
  })

  return (
    <group ref={groupRef}>
      {/* Sphère de base — ambiance sombre avec léger emissive pour éviter le noir total */}
      <mesh>
        <sphereGeometry args={[RAYON_GLOBE - 0.02, 64, 32]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.85} metalness={0.0}
          emissive={new THREE.Color(0x020510)} emissiveIntensity={0.5}
        />
      </mesh>
      {/* Hexagones terre — un seul mesh fusionné */}
      {hexMesh && <primitive object={hexMesh} />}
      {/* Lumières douces comme le globe réel */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.5} color="#c8d8ff" />
    </group>
  )
}
