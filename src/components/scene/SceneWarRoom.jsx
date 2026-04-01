// components/scene/SceneWarRoom.jsx
import { useRef, useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RAYON, PI, lineVertexShader, fondVertexShader, fondFrag, creerTexture } from '../../shaders/globe.js'
import { extraireSegments, bboxPlanPays } from '../../utils/geo.js'

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
  const groupRef=useRef()
  const texture=useMemo(()=>creerTexture(),[])
  const uFond=useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture])
  const uMonde=useMemo(()=>({uTransition:{value:1},uRadius:{value:RAYON}}),[])
  const geoMonde=useMemo(()=>geoData?extraireSegments(geoData.features,null):null,[geoData])

  const featuresPays=useMemo(()=>{
    if(!geoData||!cfg)return null
    return geoData.features.filter(f=>f.properties?.NAME===cfg.NAME)
  },[geoData,cfg])

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
    </group>
  )
}
