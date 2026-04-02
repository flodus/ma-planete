// src/views/MondeFictif.jsx
import { useState, useRef, useEffect } from 'react'
import { CURSEUR_POINTER } from '../utils/curseurs.js'
import { VB_W, VB_H, hexCenter } from '../utils/hex.js'
import { neonPays } from '../utils/palette.js'
import { NUAGES_VISIBLE_MAX_SCALE, genererNuages } from '../utils/nuages.js'
import { useGenerationCarte } from '../hooks/useGenerationCarte.js'
import CarteSVG from '../components/CarteSVG.jsx'

const btnStyle = {
  padding: '8px 16px', background: 'rgba(0,10,28,0.85)',
  border: '1px solid rgba(0,200,255,0.35)', borderRadius: '4px',
  color: 'rgba(0,210,255,0.90)', cursor: CURSEUR_POINTER,
  fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.06em',
}

export default function MondeFictif({ seed, onMondeReel, onRetour, onPaysDoubleClick, paysSelectionne = null }) {
  const [localSeed, setLocalSeed]     = useState(seed)
  const [hoveredPays, setHoveredPays] = useState(null)
  const [cloudOffset, setCloudOffset] = useState(0)
  const [nuages, setNuages]           = useState([])
  const [xf, setXf] = useState(() => ({
    scale: 0.5,
    x: Math.round((window.innerWidth  - VB_W * 0.5) / 2),
    y: Math.round((window.innerHeight - VB_H * 0.5) / 2),
  }))

  const wrapRef      = useRef(null)
  const ptrDown      = useRef(false)
  const lastXY       = useRef([0, 0])
  const cloudAnimRef = useRef(null)
  const tempsRef     = useRef(0)

  useEffect(() => { setLocalSeed(seed) }, [seed])
  useEffect(() => { setNuages(genererNuages(VB_W, VB_H)) }, [localSeed])

  useEffect(() => {
    let lastTime = performance.now()
    function animateClouds(now) {
      const delta = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      tempsRef.current += delta * 0.5
      setCloudOffset(prev => (prev + delta * 0.8) % (VB_W * 2))
      setNuages(prev => prev.map(c => ({
        ...c,
        currentY:       c.baseY       + Math.sin(tempsRef.current * 0.4 + c.phase * 1.3) * c.amplitudeY,
        currentSize:    c.baseSize    + Math.sin(tempsRef.current * 0.6 + c.phase)        * c.amplitudeSize,
        currentOpacity: Math.min(0.85, Math.max(0.3,
          c.baseOpacity + Math.sin(tempsRef.current * 0.7 + c.phase * 0.8) * c.amplitudeOpacity
        )),
        currentSpeed:   c.baseSpeed   + Math.sin(tempsRef.current * 0.3 + c.phase)        * c.speedVariation * 0.3,
      })))
      cloudAnimRef.current = requestAnimationFrame(animateClouds)
    }
    cloudAnimRef.current = requestAnimationFrame(animateClouds)
    return () => { if (cloudAnimRef.current) cancelAnimationFrame(cloudAnimRef.current) }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const f  = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setXf(p => {
        const ns = Math.min(6, Math.max(0.4, p.scale * f))
        const sc = ns / p.scale
        return { scale: ns, x: mx - sc * (mx - p.x), y: my - sc * (my - p.y) }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onPtrDown = (e) => { ptrDown.current = true; lastXY.current = [e.clientX, e.clientY]; e.currentTarget.setPointerCapture(e.pointerId) }
  const onPtrMove = (e) => {
    if (!ptrDown.current) return
    const [lx, ly] = lastXY.current
    setXf(p => ({ ...p, x: p.x + e.clientX - lx, y: p.y + e.clientY - ly }))
    lastXY.current = [e.clientX, e.clientY]
  }
  const onPtrUp = () => { ptrDown.current = false }

  const svgData = useGenerationCarte(localSeed)
  const { nRoyaumes, paysCentres, nomsPays, biomesPays } = svgData

  useEffect(() => {
    if (paysSelectionne == null) return
    const centre = paysCentres[paysSelectionne]
    if (!centre) return
    const [svgX, svgY] = hexCenter(centre.sumC / centre.n, centre.sumR / centre.n)
    const scale = 3.0
    setXf({ scale, x: window.innerWidth / 2 - svgX * scale, y: window.innerHeight / 2 - svgY * scale })
  }, [paysSelectionne, paysCentres])

  const lod            = xf.scale < 0.7 ? 0 : xf.scale < 2.0 ? 1 : 2
  const nuagesVisibles = xf.scale < NUAGES_VISIBLE_MAX_SCALE
  const nuagesOpacity  = nuagesVisibles ? Math.max(0, 1 - (xf.scale / NUAGES_VISIBLE_MAX_SCALE) * 0.7) : 0

  // Infos du pays survolé
  const infoHover = hoveredPays !== null ? {
    nom:   nomsPays?.[hoveredPays]   ?? `Royaume #${hoveredPays}`,
    biome: biomesPays?.[hoveredPays] ?? '—',
    taille: paysCentres?.[hoveredPays]?.n ?? 0,
    couleur: neonPays(hoveredPays),
  } : null

  return (
    <div ref={wrapRef}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden',
        backgroundColor: '#061628', cursor: 'grab', userSelect: 'none' }}
      onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}>

      {/* Toolbar */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10,
        display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'all' }}
        onPointerDown={e => e.stopPropagation()}>
        {onRetour
          ? <button onClick={onRetour} style={btnStyle}>{paysSelectionne !== null ? '← PLANISPHÈRE' : '← GLOBE'}</button>
          : <button onClick={onMondeReel} style={btnStyle}>← MONDE RÉEL</button>
        }
        {!onRetour && (
          <button onClick={() => setLocalSeed(Math.floor(Math.random() * 99999))} style={btnStyle}>⟳ NOUVEAU MONDE</button>
        )}
        <span style={{ padding: '6px 18px', background: 'rgba(0,8,22,0.85)',
          border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
          color: 'rgba(0,210,255,0.85)', fontSize: '0.78rem',
          fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          MONDE #{localSeed}
        </span>
        {paysSelectionne !== null
          ? <span style={{ color: 'rgba(0,200,255,0.45)', fontSize: '0.75rem', fontFamily: 'monospace', letterSpacing: '0.08em' }}>ROYAUME #{paysSelectionne}</span>
          : <span style={{ color: 'rgba(0,200,255,0.45)', fontSize: '0.75rem', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{nRoyaumes} royaumes</span>
        }
        <span style={{ color: 'rgba(0,200,255,0.25)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
          {xf.scale.toFixed(2)}× | {240 * 170} hex
        </span>
      </div>

      <CarteSVG
        xf={xf}
        svgData={svgData}
        lod={lod}
        nuages={nuages}
        cloudOffset={cloudOffset}
        nuagesVisibles={nuagesVisibles}
        nuagesOpacity={nuagesOpacity}
        hoveredPays={hoveredPays}
        setHoveredPays={setHoveredPays}
        onPaysDoubleClick={onPaysDoubleClick}
      />

      {/* Panel hover pays */}
      {infoHover && (
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none', zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '20px',
          background: 'rgba(0,6,18,0.88)', backdropFilter: 'blur(6px)',
          border: `1px solid ${infoHover.couleur}44`,
          borderRadius: '4px', padding: '8px 24px',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '0.12em',
            color: infoHover.couleur,
          }}>
            {infoHover.nom}
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.1em',
            color: 'rgba(180,220,255,0.5)', textTransform: 'uppercase',
          }}>
            {infoHover.biome}
          </span>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.08em',
            color: 'rgba(180,220,255,0.35)',
          }}>
            {infoHover.taille.toLocaleString()} hex
          </span>
        </div>
      )}
    </div>
  )
}
