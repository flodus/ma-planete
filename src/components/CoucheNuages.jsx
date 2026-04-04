// components/CoucheNuages.jsx — overlay SVG nuages animés sans passer par React
// RAF direct sur les attributs DOM → CarteSVG ne re-render plus jamais pour les nuages
import { useRef, useEffect, useMemo } from 'react'
import { VB_W, VB_H } from '../utils/hex.js'
import { NUAGES_VISIBLE_MAX_SCALE, genererNuages, createCloudPath } from '../utils/nuages.js'

export default function CoucheNuages({ xf, seed }) {
  const pathEls  = useRef([])
  const scaleRef = useRef(xf.scale)
  const rafRef   = useRef(null)
  const tempsRef = useRef(0)
  const offsetRef = useRef(0)

  // Générer les nuages une fois par seed — stable entre renders
  const nuages = useMemo(() => genererNuages(VB_W, VB_H), [seed]) // eslint-disable-line

  // Sync scale sans redémarrer le RAF
  useEffect(() => { scaleRef.current = xf.scale }, [xf.scale])

  // RAF unique — direct DOM, aucun setState
  useEffect(() => {
    let lastTime = performance.now()
    function animate(now) {
      const delta = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      tempsRef.current += delta * 0.5
      offsetRef.current = (offsetRef.current + delta * 0.8) % (VB_W * 2)

      const sc = scaleRef.current
      const visible = sc < NUAGES_VISIBLE_MAX_SCALE
      const globalOpacity = visible ? Math.max(0, 1 - (sc / NUAGES_VISIBLE_MAX_SCALE) * 0.7) : 0
      const t = tempsRef.current
      const off = offsetRef.current

      nuages.forEach((c, i) => {
        const el = pathEls.current[i]
        if (!el) return
        if (!visible) { el.setAttribute('fill', 'none'); return }

        const cy   = c.baseY    + Math.sin(t * 0.4 + c.phase * 1.3) * c.amplitudeY
        const cs   = c.baseSize + Math.sin(t * 0.6 + c.phase)        * c.amplitudeSize
        const co   = Math.min(0.85, Math.max(0.3,
          c.baseOpacity + Math.sin(t * 0.7 + c.phase * 0.8) * c.amplitudeOpacity))
        const cspd = c.baseSpeed + Math.sin(t * 0.3 + c.phase) * c.speedVariation * 0.3
        const xPos = (c.baseX + off * cspd * 80) % (VB_W + 500) - 250

        el.setAttribute('d', createCloudPath(xPos, cy, cs))
        el.setAttribute('fill', `rgba(245,248,255,${(co * globalOpacity).toFixed(3)})`)
      })

      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [nuages]) // redémarre si nouveau monde (seed change → nuages change)

  return (
    <div style={{
      position: 'absolute',
      transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.scale})`,
      transformOrigin: '0 0',
      width: `${VB_W}px`,
      height: `${VB_H}px`,
      pointerEvents: 'none',
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {nuages.map((c, i) => (
          <path
            key={c.id}
            ref={el => { pathEls.current[i] = el }}
            stroke="none"
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </svg>
    </div>
  )
}
