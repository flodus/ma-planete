// components/scene/GlobeFictif.jsx — globe fictif : sphère sombre + contours néon royaumes
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { neonVertexShader, neonFrag } from '../../shaders/globe.js'
import { useContoursFictifs } from '../../hooks/useContoursFictifs.js'
import { RAYON_GLOBE } from '../../hooks/useHexagonesGlobe.js'

export default function GlobeFictif({ seed }) {
  const groupRef = useRef()
  const contours  = useContoursFictifs(seed)

  // Matériaux néon — un par royaume, recréés quand les contours changent
  const mats = useMemo(() =>
    contours.map(({ couleur }) => {
      const c = new THREE.Color(couleur)
      return new THREE.ShaderMaterial({
        vertexShader:   neonVertexShader,
        fragmentShader: neonFrag(c.r.toFixed(4), c.g.toFixed(4), c.b.toFixed(4)),
        uniforms:       { uTime: { value: 0 } },
        transparent:    true,
        depthWrite:     false,
      })
    })
  , [contours])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006
    mats.forEach(mat => { mat.uniforms.uTime.value += delta })
  })

  return (
    <group ref={groupRef}>
      {/* Sphère sombre — occultation + ambiance, quasi invisible */}
      <mesh>
        <sphereGeometry args={[RAYON_GLOBE - 0.02, 64, 32]} />
        <meshStandardMaterial
          color={new THREE.Color(0x020508)}
          roughness={1.0} metalness={0.0}
          emissive={new THREE.Color(0x010204)} emissiveIntensity={1.0}
        />
      </mesh>

      {/* Contours néon des royaumes */}
      {contours.map(({ id, geo }, i) => mats[i] && (
        <lineSegments key={id} geometry={geo} material={mats[i]} renderOrder={10} />
      ))}

      {/* Lumières douces */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.5} color="#c8d8ff" />
    </group>
  )
}
