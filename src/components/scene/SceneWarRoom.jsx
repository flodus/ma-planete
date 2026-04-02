// components/scene/SceneWarRoom.jsx
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RAYON, PI, lineVertexShader, fondVertexShader, fondFrag, neonFrag, creerTexture } from '../../shaders/globe.js'
import { extraireSegments, extraireSegmentsNeon, bboxPlanPays, couleurNeon } from '../../utils/geo.js'

// Vertex shader néon mercator (uTransition=1 → toujours plan, vScan depuis position sphère)
const neonMorphVert = `
attribute vec3 aPlane;
uniform float uTransition;
varying float vScan;
void main() {
  vScan = atan(position.x, position.z);
  vec3 pos = mix(position, aPlane, uTransition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`

// Recentre la caméra sur le pays sélectionné
function CentreWarRoom({ features, cfg, groupRef }) {
  const { camera } = useThree()
  useEffect(()=>{
    if(!features||!groupRef.current)return
    const { cx, cy, w, h } = bboxPlanPays(features, cfg.mainland)
    groupRef.current.position.set(-cx,-cy,0)
    const z = Math.max(Math.max(w,h)*1.6, 1.5)
    camera.position.set(0,0,z)
    camera.rotation.set(0,0,0); camera.up.set(0,1,0); camera.lookAt(0,0,0)
  },[features,cfg,camera,groupRef])
  return null
}

export default function SceneWarRoom({ geoData, cfg }) {
  const groupRef = useRef()
  const texture  = useMemo(()=>creerTexture(),[])
  const uFond    = useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture])
  const uMonde   = useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON}}),[])

  const geoMonde = useMemo(()=>geoData?extraireSegments(geoData.features,null):null,[geoData])

  const featuresPays = useMemo(()=>{
    if(!geoData||!cfg) return null
    return geoData.features.filter(f=>f.properties?.NAME===cfg.NAME)
  },[geoData,cfg])

  // Néon du pays sélectionné (avec mainland si défini)
  const neonMat = useMemo(()=>{
    if(!cfg) return null
    const c = couleurNeon(cfg.NAME)
    return new THREE.ShaderMaterial({
      vertexShader: neonMorphVert,
      fragmentShader: neonFrag(c.r, c.g, c.b),
      uniforms: { uTime:{value:0}, uTransition:{value:1} },
      transparent: true, depthWrite: false,
    })
  },[cfg])

  const geoNeon = useMemo(()=>{
    if(!featuresPays?.length||!cfg) return null
    return extraireSegmentsNeon(featuresPays, cfg.mainland)
  },[featuresPays, cfg])

  useFrame((_,delta)=>{
    if(neonMat) neonMat.uniforms.uTime.value += delta
  })

  return (
    <group ref={groupRef}>
    <CentreWarRoom features={featuresPays} cfg={cfg} groupRef={groupRef}/>
    <mesh renderOrder={0}>
      <planeGeometry args={[RAYON*2*PI,RAYON*PI,32,16]}/>
      <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
        uniforms={uFond} side={THREE.DoubleSide}/>
    </mesh>
    {geoMonde && (
      <lineSegments geometry={geoMonde} renderOrder={1}>
        <shaderMaterial vertexShader={lineVertexShader}
          fragmentShader={`void main(){gl_FragColor=vec4(0.03,0.45,0.70,0.20);}`}
          uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}
    {/* Néon pays sélectionné */}
    {geoNeon && neonMat && (
      <lineSegments geometry={geoNeon} material={neonMat} renderOrder={10}/>
    )}
    </group>
  )
}
