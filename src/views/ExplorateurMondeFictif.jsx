// src/views/ExplorateurMondeFictif.jsx
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Etoiles from '../components/Etoiles.jsx'
import { CURSEUR_POINTER } from '../utils/curseurs.js'
import { RAYON_GLOBE } from '../hooks/useHexagonesGlobe.js'
import GlobeFictif from '../components/scene/GlobeFictif.jsx'
import MondeFictif from './MondeFictif.jsx'

const btnStyle = {
  padding: '8px 16px', background: 'rgba(8,18,28,0.85)',
  border: '1px solid rgba(80,180,255,0.5)', borderRadius: '4px',
  color: 'rgba(100,200,255,0.95)', cursor: CURSEUR_POINTER,
  fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.06em',
  backdropFilter: 'blur(4px)',
}

export default function ExplorateurMondeFictif({ seed = 42, onMondeReel }) {
  const [vue, setVue]                   = useState('globe')
  const [paysSelectionne, setPays]      = useState(null)
  const [localSeed, setLocalSeed]       = useState(seed)

  const nouveauMonde = () => { setLocalSeed(Math.floor(Math.random() * 99999)); setVue('globe'); setPays(null) }

  if (vue === 'mercator') {
    return <MondeFictif seed={localSeed}
      onRetour={() => setVue('globe')}
      onPaysDoubleClick={idx => { setPays(idx); setVue('warroom') }} />
  }

  if (vue === 'warroom') {
    return <MondeFictif seed={localSeed} paysSelectionne={paysSelectionne}
      onRetour={() => { setPays(null); setVue('mercator') }} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#020208' }}
      onDoubleClick={() => setVue('mercator')}>

      <Canvas camera={{ position: [0, 0, RAYON_GLOBE * 4.2], fov: 42 }}>
        <color attach="background" args={['#020208']} />
        <Etoiles count={50000} rayon={150} />
        <GlobeFictif seed={localSeed} />
        <OrbitControls enableZoom enablePan={false} rotateSpeed={0.8} zoomSpeed={1.0} />
      </Canvas>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        <div style={{ position: 'absolute', top: '20px', left: '20px',
          display: 'flex', gap: '12px', alignItems: 'center', pointerEvents: 'all' }}
          onPointerDown={e => e.stopPropagation()}>
          <button style={btnStyle} onClick={onMondeReel}>← MONDE RÉEL</button>
          <button style={btnStyle} onClick={nouveauMonde}>⟳ NOUVEAU MONDE</button>
          <span style={{ padding: '6px 18px', background: 'rgba(8,18,28,0.85)',
            border: '1px solid rgba(80,180,255,0.45)', borderRadius: '3px',
            color: 'rgba(100,200,255,0.9)', fontSize: '0.78rem',
            fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            MONDE #{localSeed}
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(100,200,255,0.6)', fontSize: '0.7rem', fontFamily: 'monospace',
          letterSpacing: '0.12em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          DOUBLE-CLIC → PLANISPHÈRE
        </div>
      </div>
    </div>
  )
}
