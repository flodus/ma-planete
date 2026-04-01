// components/scene/SceneGlobeMercator.jsx
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RAYON, PI, lineVertexShader, fragMonde, fondVertexShader, fondFrag, creerTexture } from '../../shaders/globe.js'
import { extraireSegments, trouverPays, couleurNeon } from '../../utils/geo.js'
import { useGlobeOrbit } from '../../hooks/useGlobeOrbit.js'
import { useMercatorZoom } from '../../hooks/useMercatorZoom.js'

// Réinitialise la caméra lors du passage en vue mercator
export function ResetCameraPlan({ actif }) {
  const { camera } = useThree()
  useEffect(()=>{
    if(!actif)return
    camera.position.set(0,0,RAYON*3)
    camera.rotation.set(0,0,0); camera.up.set(0,1,0); camera.lookAt(0,0,0)
  },[actif,camera])
  return null
}

// Hitbox invisible sur le globe pour détecter les clics/survols
function HitboxSphere({ features, onClic, onSurvol, groupRef }) {
  const detecter = e => {
    let pt = e.point.clone()
    if (groupRef?.current) pt = groupRef.current.worldToLocal(pt)
    pt.normalize()
    const lat=Math.asin(THREE.MathUtils.clamp(pt.y,-1,1))*(180/PI)
    const lon=Math.atan2(pt.x,pt.z)*(180/PI)
    const found=trouverPays(lon, lat, features||[])
    return found ? (found.properties?.NAME||found.properties?.ADMIN||'') : null
  }
  return (
    <mesh
      onClick={e=>onClic(detecter(e))}
      onPointerMove={e=>onSurvol?.(detecter(e))}
      onPointerOut={()=>onSurvol?.(null)}>
      <sphereGeometry args={[RAYON+0.05,32,32]}/>
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.FrontSide}/>
    </mesh>
  )
}

export default function SceneGlobeMercator({
  geoData, isPlanar, paysSurvolé, onClickGlobe, onSurvolMercator,
  onEntrerMercator, mercatorInstantane = false
}) {
  const groupRef=useRef()
  const texture=useMemo(()=>creerTexture(),[])

  const transLerp = useRef(mercatorInstantane ? 1 : 0)

  const uFond=useMemo(()=>({uTransition:{value: mercatorInstantane?1:0},uRadius:{value:RAYON},uTexture:{value:texture}}),[texture]) // eslint-disable-line
  const uMonde=useMemo(()=>({uTransition:{value: mercatorInstantane?1:0},uRadius:{value:RAYON}}),[]); // eslint-disable-line

  const highlightMat=useRef(null)
  if(!highlightMat.current){
    highlightMat.current=new THREE.ShaderMaterial({
      vertexShader:lineVertexShader,
      fragmentShader:`uniform float uTime; uniform vec3 uCouleur;
void main(){
  float p=clamp(0.80+0.20*sin(uTime*5.0),0.60,1.0);
  gl_FragColor=vec4(uCouleur*p,1.0);
}`,
      uniforms:{
        uTransition:{value:0}, uRadius:{value:RAYON},
        uTime:{value:0}, uCouleur:{value:new THREE.Vector3(1,1,1)},
      },
      transparent:true, depthWrite:false,
    })
  }

  useEffect(()=>{
    if(!highlightMat.current) return
    const c = paysSurvolé ? couleurNeon(paysSurvolé) : new THREE.Color('#ffffff')
    highlightMat.current.uniforms.uCouleur.value.set(c.r,c.g,c.b)
  },[paysSurvolé])

  const geos=useMemo(()=>{
    if(!geoData)return{}
    return { monde: extraireSegments(geoData.features, null) }
  },[geoData])

  const geoHighlight=useMemo(()=>{
    if(!paysSurvolé||!geoData) return null
    const feats=geoData.features.filter(f=>f.properties?.NAME===paysSurvolé||f.properties?.ADMIN===paysSurvolé||f.properties?.nom===paysSurvolé)
    return feats.length ? extraireSegments(feats, null) : null
  },[paysSurvolé,geoData])

  const globeOrbit = useGlobeOrbit(groupRef, !isPlanar)

  useFrame((_, delta) => {
    const cible = isPlanar ? 1 : 0
    transLerp.current += (cible - transLerp.current) * Math.min(1, delta * 2.5)
    const t = transLerp.current

    uFond.uTransition.value  = t
    uMonde.uTransition.value = t

    if (highlightMat.current) {
      highlightMat.current.uniforms.uTime.value += delta
      highlightMat.current.uniforms.uTransition.value = t
    }

    if (groupRef.current) {
      if (!isPlanar) {
        const s = globeOrbit.current
        groupRef.current.rotation.y += s.velY + (!s.dragging ? delta * 0.08 : 0)
        groupRef.current.rotation.x += s.velX
        groupRef.current.rotation.z  = 23.5 * PI / 180
        if (s.dragging) { s.velY = 0; s.velX = 0 }
        else { s.velY *= 0.88; s.velX *= 0.88 }
        groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.08)
      } else {
        groupRef.current.rotation.y += (0 - groupRef.current.rotation.y) * Math.min(1, delta * 3.5 * t)
        groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * Math.min(1, delta * 3.5 * t)
        groupRef.current.rotation.z += (0 - groupRef.current.rotation.z) * Math.min(1, delta * 3.5 * t)
      }
    }
  })

  useMercatorZoom(isPlanar)

  return (
    <group ref={groupRef}>
    <group>
    <mesh renderOrder={0}>
      <planeGeometry args={[RAYON*2*PI,RAYON*PI,64,32]}/>
      <shaderMaterial vertexShader={fondVertexShader} fragmentShader={fondFrag}
        uniforms={uFond} side={THREE.DoubleSide}/>
    </mesh>

    {geos.monde && (
      <lineSegments geometry={geos.monde} renderOrder={2}>
        <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
          uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}

    {geoHighlight && (
      <lineSegments geometry={geoHighlight} material={highlightMat.current} renderOrder={15}/>
    )}

    {!isPlanar && <HitboxSphere features={geoData?.features||[]} onClic={onClickGlobe} onSurvol={onClickGlobe} groupRef={groupRef}/>}

    {isPlanar && (
      <mesh renderOrder={20} position={[0,0,0.4]}
        onClick={e=>{
          const lon=e.point.x*180/(RAYON*PI)
          const lat=e.point.y*90/(RAYON*PI/2)
          const found=trouverPays(lon,lat,geoData?.features||[])
          const name=found?(found.properties?.NAME||found.properties?.ADMIN||''):null
          onSurvolMercator(name)
        }}
        onPointerMove={e=>{
          const lon=e.point.x*180/(RAYON*PI)
          const lat=e.point.y*90/(RAYON*PI/2)
          const found=trouverPays(lon,lat,geoData?.features||[])
          const name=found?(found.properties?.NAME||found.properties?.ADMIN||''):null
          onSurvolMercator(name)
        }}
        onPointerOut={()=>onSurvolMercator(null)}
        onDoubleClick={e=>{
          const lon=e.point.x*180/(RAYON*PI)
          const lat=e.point.y*90/(RAYON*PI/2)
          const found=trouverPays(lon,lat,geoData?.features||[])
          if(!found) return
          const name=found.properties?.NAME||''
          if(name) onEntrerMercator(name)
        }}>
        <planeGeometry args={[RAYON*2*PI,RAYON*PI]}/>
        <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
      </mesh>
    )}
    </group>
    </group>
  )
}
