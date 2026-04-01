// components/scene/GlobeFictif.jsx — globe 3D avec hexagones procéduraux
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useHexagonesGlobe, RAYON_GLOBE } from '../../hooks/useHexagonesGlobe.js'

function createOceanTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 512
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0,   '#1a5a8a')
  grad.addColorStop(0.5, '#0e4a7a')
  grad.addColorStop(1,   '#0a3a6a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1024, 512)
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(120, 200, 255, ${Math.random() * 0.2})`
    ctx.beginPath()
    ctx.arc(Math.random() * 1024, Math.random() * 512, Math.random() * 4 + 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(100, 180, 240, 0.25)'; ctx.lineWidth = 0.6
  for (let i = 0; i < 1024; i += 35) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i / 2); ctx.lineTo(1024, i / 2); ctx.stroke()
  }
  return new THREE.CanvasTexture(canvas)
}

export default function GlobeFictif({ seed }) {
  const groupRef     = useRef()
  const oceanTexture = useMemo(() => createOceanTexture(), [])
  const hexMeshes    = useHexagonesGlobe(seed)

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006
  })

  return (
    <>
      <mesh>
        <sphereGeometry args={[RAYON_GLOBE - 0.02, 128, 64]} />
        <meshStandardMaterial map={oceanTexture} roughness={0.4} metalness={0.2} color="#1a5a8a" />
      </mesh>
      <group ref={groupRef}>
        {hexMeshes.map((mesh, idx) => <primitive key={idx} object={mesh} />)}
      </group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 12, 6]} intensity={1.0} color="#fff5e8" />
      <pointLight position={[-5, 4, 6]} intensity={0.5} color="#88aaff" />
    </>
  )
}
