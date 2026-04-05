// components/scene/SphereBase.jsx — sphère de base partagée (seule source de vérité)
// Utilisée par PlanetCanvas ET GlobeFictif
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fondVertexShader, fondFrag, creerTexture } from '../../shaders/globe.js'

export default function SphereBase({ rayon, transitionRef = null }) {
  const texture  = useMemo(() => creerTexture(), [])
  const uniforms = useMemo(() => ({
    uTransition: { value: 0 },
    uRadius:     { value: rayon },
    uTexture:    { value: texture },
  }), [rayon, texture])

  // Sync uTransition depuis le parent (evite re-render)
  useFrame(() => {
    if (transitionRef !== null) uniforms.uTransition.value = transitionRef.current
  })

  return (
    <mesh renderOrder={0}>
      <planeGeometry args={[rayon * 2 * Math.PI, rayon * Math.PI, 64, 32]} />
      <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
        uniforms={uniforms} side={THREE.DoubleSide} />
    </mesh>
  )
}
