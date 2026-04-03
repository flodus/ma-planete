// src/components/Etoiles.jsx — remplace @react-three/drei <Stars> sans dépendance externe
import { useMemo } from 'react'
import * as THREE from 'three'

export default function Etoiles({ count = 45000, rayon = 130, taille = 0.15, opacite = 0.6 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribution sphérique uniforme
      const r = rayon * (0.5 + 0.5 * Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pts[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pts[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pts[i * 3 + 2] = r * Math.cos(phi)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return g
  }, [count, rayon])

  return (
    <points geometry={geo}>
      <pointsMaterial size={taille} color="#ffffff" transparent opacity={opacite} sizeAttenuation depthWrite={false}/>
    </points>
  )
}
