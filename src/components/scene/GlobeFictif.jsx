// components/scene/GlobeFictif.jsx — globe fictif : sphère sombre + contours néon royaumes
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { neonVertexShader, creerTexture } from '../../shaders/globe.js'
import { useContoursFictifs } from '../../hooks/useContoursFictifs.js'
import { RAYON_GLOBE } from '../../hooks/useHexagonesGlobe.js'

export default function GlobeFictif({ seed }) {
  const groupRef = useRef()
  const contours  = useContoursFictifs(seed)
  const texture   = useMemo(() => creerTexture(), [])

  // Matériau néon unique — même bleu cyan que le globe réel
  const neonMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   neonVertexShader,
    fragmentShader: `uniform float uTime; varying float vScan;
void main(){ float p=clamp(0.25+0.15*sin(vScan-uTime*0.5),0.10,0.40); gl_FragColor=vec4(0.03,0.55,0.80,p); }`,
    uniforms:  { uTime: { value: 0 } },
    transparent: true, depthWrite: false,
  }), [])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006
    neonMat.uniforms.uTime.value += delta
  })

  return (
    <group ref={groupRef}>
      {/* Sphère sombre — occultation + ambiance, quasi invisible */}
      <mesh>
        <sphereGeometry args={[RAYON_GLOBE - 0.02, 64, 32]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.9} metalness={0.0}
          emissive={new THREE.Color(0x010204)} emissiveIntensity={0.6}
        />
      </mesh>

      {/* Contours néon des royaumes */}
      {contours.map(({ id, geo }) => (
        <lineSegments key={id} geometry={geo} material={neonMat} renderOrder={10} />
      ))}

      {/* Lumières douces */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.5} color="#c8d8ff" />
    </group>
  )
}
