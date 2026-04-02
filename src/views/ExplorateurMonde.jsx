// src/views/ExplorateurMonde.jsx
// Globe GeoJSON → Mercator → WarRoom pays
import { useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { CURSEUR_POINTER } from '../utils/curseurs.js'
import { RAYON } from '../shaders/globe.js'
import { couleurNeon, couleurScan, mainlandDuPays } from '../utils/geo.js'
import SceneGlobeMercator, { ResetCameraPlan } from '../components/scene/SceneGlobeMercator.jsx'
import SceneWarRoom from '../components/scene/SceneWarRoom.jsx'
import LigneScan from '../components/LigneScan.jsx'

const ui = {
  c:   { position:'absolute', inset:0, pointerEvents:'none', zIndex:100 },
  btn: { position:'absolute', top:'20px', left:'20px', pointerEvents:'all',
    padding:'8px 16px', background:'rgba(0,15,35,0.75)',
    border:'1px solid rgba(0,200,255,0.3)', borderRadius:'4px',
    color:'rgba(0,210,255,0.85)', cursor:CURSEUR_POINTER, fontSize:'0.88rem', fontFamily:'monospace', letterSpacing:'0.06em' },
  badge: { position:'absolute', top:'22px', left:'50%', transform:'translateX(-50%)',
    padding:'6px 18px', background:'rgba(0,10,25,0.8)', border:'1px solid', borderRadius:'3px',
    fontSize:'0.78rem', fontFamily:'monospace', letterSpacing:'0.2em', textTransform:'uppercase', whiteSpace:'nowrap' },
  ind: { position:'absolute', bottom:'28px', left:'50%', transform:'translateX(-50%)',
    color:'rgba(0,200,255,0.35)', fontSize:'0.78rem', fontFamily:'monospace',
    letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap', pointerEvents:'none' },
}

export function ExplorateurMonde({ initialVue = 'globe', sansTransition = false }) {
  const [vue, setVue] = useState(initialVue)
  const [paysFocus, setPaysFocus] = useState(null)
  const [paysSurvolé, setPaysSurvolé] = useState(null)
  const [geo110, setGeo110] = useState(null)
  const [geo50,  setGeo50]  = useState(null)
  const [geo10,  setGeo10]  = useState(null)

  useEffect(()=>{
    fetch('/geojson/ne_110m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo110).catch(console.error)
    fetch('/geojson/ne_50m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo50).catch(console.error)
    fetch('/geojson/ne_10m_admin_0_countries.geojson').then(r=>r.json()).then(setGeo10).catch(console.error)
  },[])

  const changerVue = useCallback((v) => {
    if (v === vue) return
    setVue(v)
    setPaysSurvolé(null)
  }, [vue])

  const estGlobe    = vue === 'globe'
  const estMercator = vue === 'mercator'
  const estWarRoom  = vue === 'warroom'

  const geoActuel = estMercator ? geo50 : geo110
  // mainland depuis pays.json si dispo (France, USA…) pour restreindre bbox et néon à la métropole
  const cfg = paysFocus ? { NAME: paysFocus, mainland: mainlandDuPays(paysFocus) } : null
  const hexScan = paysFocus ? `#${couleurScan(paysFocus).getHexString()}` : '#00e5ff'

  return (
    <div style={{position:'fixed', inset:0, overflow:'hidden', backgroundColor:'#000'}}>
    {!estWarRoom && (
      <div style={{width:'100%', height:'100%'}}
        onDoubleClick={estGlobe ? () => changerVue('mercator') : undefined}>
        <Canvas camera={{position:[0,0,RAYON*3], fov:45}}>
          <color attach="background" args={['#020208']}/>
          <ambientLight intensity={0.15}/>
          <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.4}/>
          <ResetCameraPlan actif={estMercator}/>
          <SceneGlobeMercator
            geoData={geoActuel}
            isPlanar={estMercator}
            paysSurvolé={paysSurvolé}
            onClickGlobe={id => setPaysSurvolé(id)}
            onSurvolMercator={id => setPaysSurvolé(id)}
            onEntrerMercator={name => { setPaysFocus(name); setVue('warroom') }}
            mercatorInstantane={sansTransition && initialVue === 'mercator'}
          />
        </Canvas>
      </div>
    )}

    {estWarRoom && cfg && (
      <>
      <Canvas camera={{position:[0,0,RAYON*3], fov:45}}>
        <color attach="background" args={['#020208']}/>
        <ambientLight intensity={0.1}/>
        <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.2}/>
        <SceneWarRoom geoData={geo10} cfg={cfg}/>
      </Canvas>
      <LigneScan couleur={hexScan} />
      </>
    )}

    {/* UI overlay */}
    <div style={ui.c}>
      {estGlobe && (
        <>
        {paysSurvolé && (()=>{
          const c = couleurNeon(paysSurvolé)
          const hex = `#${c.getHexString()}`
          const rgba = `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0.3)`
          return <div style={{...ui.badge, color:hex, borderColor:rgba}}>{paysSurvolé}</div>
        })()}
        <div style={ui.ind}>double-clic → planisphère · clic sur un pays pour le voir</div>
        </>
      )}
      {estMercator && (
        <>
        <button style={ui.btn} onClick={() => changerVue('globe')}>← Globe</button>
        <div style={ui.ind}>
          {paysSurvolé
            ? <><span style={{color:'#00e5ff'}}>{paysSurvolé}</span>{' — double-clic pour entrer'}</>
            : 'clic → pays · double-clic → entrer'
          }
        </div>
        </>
      )}
      {estWarRoom && cfg && (
        <>
        <button style={ui.btn} onClick={() => changerVue('mercator')}>← Planisphère</button>
        <div style={{...ui.badge, color:'rgba(0,210,255,0.85)', borderColor:'rgba(0,200,255,0.3)'}}>
          ▶ {cfg.NAME} — WAR ROOM
        </div>
        <div style={ui.ind}>drag + molette</div>
        </>
      )}
    </div>
    </div>
  )
}
