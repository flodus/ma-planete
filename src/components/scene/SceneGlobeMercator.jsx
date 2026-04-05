// components/scene/SceneGlobeMercator.jsx
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RAYON, PI, lineVertexShader, fragMonde, neonMorphVert, neonFrag } from '../../shaders/globe.js'
import SphereBase from './SphereBase.jsx'
import { extraireSegments, extraireSegmentsNeon, trouverPays, couleurNeon, estPaysDuJeu, mainlandDuPays } from '../../utils/geo.js'
import { useGlobeOrbit } from '../../hooks/useGlobeOrbit.js'
import { useMercatorZoom } from '../../hooks/useMercatorZoom.js'
import PAYS from '../../data/pays.json'

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
  onEntrerMercator, mercatorInstantane = false, fusionsActives = []
}) {
  const groupRef=useRef()

  const transLerp = useRef(mercatorInstantane ? 1 : 0)

  const uMonde=useMemo(()=>({uTransition:{value: mercatorInstantane?1:0},uRadius:{value:RAYON}}),[]); // eslint-disable-line

  // Matériaux néons permanents — 1 par pays hardcodé
  const neonMats = useRef(null)
  if (!neonMats.current) {
    neonMats.current = {}
    for (const [id, cfg] of Object.entries(PAYS)) {
      const [r, g, b] = cfg.neon
      neonMats.current[id] = new THREE.ShaderMaterial({
        vertexShader: neonMorphVert,
        fragmentShader: neonFrag(r, g, b),
        uniforms: { uTime:{value:0}, uTransition:{value:0} },
        transparent: true, depthWrite: false,
      })
    }
  }

  // Matériau highlight survol (pays hardcodés uniquement)
  const highlightMat=useRef(null)
  if(!highlightMat.current){
    highlightMat.current=new THREE.ShaderMaterial({
      vertexShader:lineVertexShader,
      fragmentShader:`uniform float uTime; uniform vec3 uCouleur;
void main(){
  float p=clamp(0.85+0.15*sin(uTime*6.0),0.70,1.0);
  gl_FragColor=vec4(uCouleur*p,1.0);
}`,
      uniforms:{
        uTransition:{value:0}, uRadius:{value:RAYON},
        uTime:{value:0}, uCouleur:{value:new THREE.Vector3(1,1,1)},
      },
      transparent:true, depthWrite:false,
    })
  }

  // Géométrie frontières monde
  const geos=useMemo(()=>{
    if(!geoData)return{}
    return { monde: extraireSegments(geoData.features, null) }
  },[geoData])

  // Géométries néons des 10 pays
  const neonGeos = useMemo(()=>{
    if(!geoData) return {}
    return Object.fromEntries(Object.entries(PAYS).map(([id, cfg]) => {
      const feats = geoData.features.filter(f =>
        f.properties?.NAME === cfg.NAME || f.properties?.ADMIN === cfg.NAME)
      return [id, extraireSegmentsNeon(feats, cfg.mainland)]
    }))
  },[geoData])

  // Néons des pays fusionnés (dynamiques)
  const neonFusionMats = useMemo(() =>
    fusionsActives.map(({ nomFusion }) => {
      const c = couleurNeon(nomFusion)
      return new THREE.ShaderMaterial({
        vertexShader: neonMorphVert,
        fragmentShader: neonFrag(c.r, c.g, c.b),
        uniforms: { uTime:{value:0}, uTransition:{value:isPlanar?1:0} },
        transparent: true, depthWrite: false,
      })
    })
  , [fusionsActives]) // eslint-disable-line

  const neonFusionGeos = useMemo(() => {
    if (!geoData) return []
    return fusionsActives.map(({ nomFusion }) => {
      const feats = geoData.features.filter(f =>
        f.properties?.NAME === nomFusion || f.properties?.ADMIN === nomFusion)
      return extraireSegmentsNeon(feats, null)
    })
  }, [geoData, fusionsActives])

  // Géométrie highlight du pays survolé (hardcodés uniquement, avec mainland)
  const geoHighlight=useMemo(()=>{
    if(!paysSurvolé||!geoData||!estPaysDuJeu(paysSurvolé)) return null
    const mainland = mainlandDuPays(paysSurvolé)
    const feats=geoData.features.filter(f=>
      f.properties?.NAME===paysSurvolé||f.properties?.ADMIN===paysSurvolé)
    return feats.length ? extraireSegments(feats, mainland) : null
  },[paysSurvolé,geoData])

  // Couleur highlight selon pays survolé
  useEffect(()=>{
    if(!highlightMat.current) return
    if(paysSurvolé && estPaysDuJeu(paysSurvolé)) {
      const c = couleurNeon(paysSurvolé)
      highlightMat.current.uniforms.uCouleur.value.set(c.r, c.g, c.b)
    }
  },[paysSurvolé])

  const globeOrbit = useGlobeOrbit(groupRef, !isPlanar)

  useFrame((_, delta) => {
    const cible = isPlanar ? 1 : 0
    transLerp.current += (cible - transLerp.current) * Math.min(1, delta * 2.5)
    const t = transLerp.current

    uMonde.uTransition.value = t

    // Animer tous les néons + synchro morph
    for (const mat of Object.values(neonMats.current)) {
      mat.uniforms.uTime.value       += delta
      mat.uniforms.uTransition.value  = t
    }
    for (const mat of neonFusionMats) {
      mat.uniforms.uTime.value       += delta
      mat.uniforms.uTransition.value  = t
    }

    if (highlightMat.current) {
      highlightMat.current.uniforms.uTime.value      += delta
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
    <SphereBase rayon={RAYON} transitionRef={transLerp} />

    {geos.monde && (
      <lineSegments geometry={geos.monde} renderOrder={2}>
        <shaderMaterial vertexShader={lineVertexShader} fragmentShader={fragMonde}
          uniforms={uMonde} transparent depthWrite={false}/>
      </lineSegments>
    )}

    {/* Néons permanents des 10 pays hardcodés */}
    {Object.entries(neonGeos).map(([id, geo]) => geo && (
      <lineSegments key={id} geometry={geo} material={neonMats.current[id]} renderOrder={10}/>
    ))}

    {/* Néons pays fusionnés */}
    {neonFusionGeos.map((geo, i) => geo && (
      <lineSegments key={`fusion-${i}`} geometry={geo} material={neonFusionMats[i]} renderOrder={10}/>
    ))}

    {/* Highlight survol (hardcodés uniquement) */}
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
