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
      {/* Sphère — texture non éclairée comme le globe réel */}
      <mesh>
        <sphereGeometry args={[RAYON_GLOBE - 0.02, 64, 32]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Contours néon des royaumes */}
      {contours.map(({ id, geo }) => (
        <lineSegments key={id} geometry={geo} material={neonMat} renderOrder={10} />
      ))}
    </group>
  )
}
