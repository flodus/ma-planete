// src/views/ExplorateurMonde.jsx
// Globe GeoJSON → Mercator → WarRoom pays
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { CURSEUR_POINTER } from '../utils/curseurs.js'
import { RAYON } from '../shaders/globe.js'
import { couleurNeon, couleurScan, mainlandDuPays, appliquerFusions } from '../utils/geo.js'
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

// Panneau de confirmation de fusion (saisie du nom)
function PanneauFusion({ paysA, paysB, onConfirmer, onAnnuler }) {
  const [nom, setNom] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
      background:'rgba(0,8,22,0.95)', border:'1px solid rgba(0,200,255,0.3)', borderRadius:'6px',
      padding:'28px 36px', display:'flex', flexDirection:'column', gap:'16px',
      fontFamily:'monospace', pointerEvents:'all', minWidth:'300px', zIndex:200 }}>
      <div style={{ color:'rgba(0,200,255,0.5)', fontSize:'0.72rem', letterSpacing:'0.25em', textTransform:'uppercase' }}>
        Fusion
      </div>
      <div style={{ color:'rgba(0,210,255,0.75)', fontSize:'0.82rem' }}>
        <span style={{color:'#00e5ff'}}>{paysA}</span> + <span style={{color:'#00e5ff'}}>{paysB}</span>
      </div>
      <input
        ref={inputRef}
        value={nom}
        onChange={e => setNom(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && nom.trim()) onConfirmer(nom.trim()); if (e.key === 'Escape') onAnnuler() }}
        placeholder="Nom du nouveau pays"
        style={{ background:'rgba(0,15,35,0.8)', border:'1px solid rgba(0,200,255,0.25)',
          borderRadius:'4px', padding:'8px 14px', color:'rgba(0,210,255,0.9)',
          fontFamily:'monospace', fontSize:'0.88rem', outline:'none' }}
      />
      <div style={{ display:'flex', gap:'10px' }}>
        <button onClick={() => nom.trim() && onConfirmer(nom.trim())}
          disabled={!nom.trim()}
          style={{ flex:1, padding:'8px', background:'rgba(0,200,255,0.12)',
            border:'1px solid rgba(0,200,255,0.4)', borderRadius:'4px',
            color:'rgba(0,210,255,0.9)', cursor:nom.trim()?CURSEUR_POINTER:'default',
            fontFamily:'monospace', fontSize:'0.82rem', letterSpacing:'0.1em' }}>
          Fusionner
        </button>
        <button onClick={onAnnuler}
          style={{ padding:'8px 14px', background:'transparent',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px',
            color:'rgba(255,255,255,0.4)', cursor:CURSEUR_POINTER,
            fontFamily:'monospace', fontSize:'0.82rem' }}>
          ✕
        </button>
      </div>
    </div>
  )
}

export function ExplorateurMonde({ initialVue = 'globe', sansTransition = false }) {
  const [vue, setVue] = useState(initialVue)
  const [paysFocus, setPaysFocus] = useState(null)
  const [paysSurvolé, setPaysSurvolé] = useState(null)
  const [geo110, setGeo110] = useState(null)
  const [geo50,  setGeo50]  = useState(null)
  const [geo10,  setGeo10]  = useState(null)

  // État fusion
  const [modeFusion, setModeFusion]   = useState(false)
  const [fusionA,    setFusionA]      = useState(null)
  const [fusionB,    setFusionB]      = useState(null)
  const [fusions,    setFusions]      = useState([]) // [{noms, nomFusion}]

  useEffect(()=>{
    const base = import.meta.env.BASE_URL
    fetch(`${base}geojson/ne_110m_admin_0_countries.geojson`).then(r=>r.json()).then(setGeo110).catch(console.error)
    fetch(`${base}geojson/ne_50m_admin_0_countries.geojson`).then(r=>r.json()).then(setGeo50).catch(console.error)
    fetch(`${base}geojson/ne_10m_admin_0_countries.geojson`).then(r=>r.json()).then(setGeo10).catch(console.error)
  },[])

  // GeoJSON avec fusions appliquées (recalculé quand fusions ou données changent)
  const geo110mod = useMemo(() => appliquerFusions(geo110, fusions), [geo110, fusions])
  const geo50mod  = useMemo(() => appliquerFusions(geo50,  fusions), [geo50,  fusions])
  const geo10mod  = useMemo(() => appliquerFusions(geo10,  fusions), [geo10,  fusions])

  const changerVue = useCallback((v) => {
    if (v === vue) return
    setVue(v)
    setPaysSurvolé(null)
  }, [vue])

  const annulerFusion = useCallback(() => {
    setModeFusion(false); setFusionA(null); setFusionB(null)
  }, [])

  const confirmerFusion = useCallback((nomFusion) => {
    setFusions(prev => [...prev, { noms: [fusionA, fusionB], nomFusion }])
    annulerFusion()
    setPaysSurvolé(null)
  }, [fusionA, fusionB, annulerFusion])

  // Clic pays en mode fusion
  const handleClickFusion = useCallback((nom) => {
    if (!nom) return
    if (!fusionA) { setFusionA(nom); return }
    if (nom === fusionA) return
    setFusionB(nom)
  }, [fusionA])

  const estGlobe    = vue === 'globe'
  const estMercator = vue === 'mercator'
  const estWarRoom  = vue === 'warroom'

  const geoActuel = estMercator ? geo50mod : geo110mod
  const cfg = paysFocus ? { NAME: paysFocus, mainland: mainlandDuPays(paysFocus) } : null
  const hexScan = paysFocus ? `#${couleurScan(paysFocus).getHexString()}` : '#00e5ff'

  // En mode fusion : override des handlers de clic
  const handleClickGlobe      = modeFusion ? handleClickFusion : (id => setPaysSurvolé(id))
  const handleSurvolMercator  = modeFusion ? (id => setPaysSurvolé(id)) : (id => setPaysSurvolé(id))
  const handleEntrerMercator  = modeFusion
    ? (name => handleClickFusion(name))
    : (name => { setPaysFocus(name); setVue('warroom') })

  return (
    <div style={{position:'fixed', inset:0, overflow:'hidden', backgroundColor:'#000'}}>
    {!estWarRoom && (
      <div style={{width:'100%', height:'100%'}}
        onDoubleClick={estGlobe && !modeFusion ? () => changerVue('mercator') : undefined}>
        <Canvas camera={{position:[0,0,RAYON*3], fov:45}}>
          <color attach="background" args={['#020208']}/>
          <ambientLight intensity={0.15}/>
          <Stars radius={130} depth={60} count={45000} factor={5} saturation={0} fade speed={0.4}/>
          <ResetCameraPlan actif={estMercator}/>
          <SceneGlobeMercator
            geoData={geoActuel}
            isPlanar={estMercator}
            paysSurvolé={paysSurvolé}
            onClickGlobe={handleClickGlobe}
            onSurvolMercator={handleSurvolMercator}
            onEntrerMercator={handleEntrerMercator}
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
        <SceneWarRoom geoData={geo10mod} cfg={cfg}/>
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

      {estMercator && !modeFusion && (
        <>
        <button style={ui.btn} onClick={() => changerVue('globe')}>← Globe</button>
        <button style={{...ui.btn, left:'auto', right:'20px'}}
          onClick={() => { setModeFusion(true); setFusionA(null); setFusionB(null) }}>
          ⊕ Fusionner
        </button>
        <div style={ui.ind}>
          {paysSurvolé
            ? <><span style={{color:'#00e5ff'}}>{paysSurvolé}</span>{' — double-clic pour entrer'}</>
            : 'clic → pays · double-clic → entrer'
          }
        </div>
        </>
      )}

      {estMercator && modeFusion && !fusionB && (
        <>
        <button style={ui.btn} onClick={annulerFusion}>✕ Annuler</button>
        <div style={ui.ind}>
          {fusionA
            ? <><span style={{color:'#00e5ff'}}>{fusionA}</span>{' sélectionné — clic sur un 2e pays'}</>
            : 'clic sur le 1er pays à fusionner'
          }
        </div>
        </>
      )}

      {estMercator && modeFusion && fusionB && (
        <PanneauFusion
          paysA={fusionA} paysB={fusionB}
          onConfirmer={confirmerFusion}
          onAnnuler={annulerFusion}
        />
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
