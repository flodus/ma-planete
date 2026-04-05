// components/scene/GlobeFictif.jsx — globe fictif : sphère partagée + contours néon royaumes + morph
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { neonMorphVert, neonFrag } from '../../shaders/globe.js'
import { useContoursFictifs } from '../../hooks/useContoursFictifs.js'
import { RAYON_GLOBE } from '../../hooks/useHexagonesGlobe.js'
import SphereBase from './SphereBase.jsx'

export default function GlobeFictif({ seed, isPlanar = false }) {
  const groupRef    = useRef()
  const transLerp   = useRef(0)   // valeur courante de la transition (0=globe, 1=mercator)
  const contours    = useContoursFictifs(seed)

  // Matériau néon — même bleu cyan que globe réel, avec morph sphère→mercator
  const neonMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   neonMorphVert,
    fragmentShader: neonFrag(0.03, 0.55, 0.80),
    uniforms:       { uTime: { value: 0 }, uTransition: { value: 0 } },
    transparent:    true,
    depthWrite:     false,
  }), [])

  useFrame((_, delta) => {
    // Lerp de la transition
    const cible = isPlanar ? 1 : 0
    transLerp.current += (cible - transLerp.current) * Math.min(1, delta * 3)
    const t = transLerp.current

    neonMat.uniforms.uTime.value       += delta
    neonMat.uniforms.uTransition.value  = t

    if (groupRef.current) {
      if (!isPlanar) {
        // Rotation automatique en mode globe
        groupRef.current.rotation.y += delta * 0.006
      } else {
        // Ramener la rotation à 0 en mode mercator
        groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * Math.min(1, delta * 3.5 * t)
        groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * Math.min(1, delta * 3.5 * t)
        groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * Math.min(1, delta * 3.5 * t)
      }
    }
  })

  return (
    <group ref={groupRef}>
      {/* Sphère — même rendu que globe réel, avec morph */}
      <SphereBase rayon={RAYON_GLOBE} transitionRef={transLerp} />

      {/* Contours néon des royaumes */}
      {contours.map(({ id, geo }) => (
        <lineSegments key={id} geometry={geo} material={neonMat} renderOrder={10} />
      ))}
    </group>
  )
}
