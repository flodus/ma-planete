// components/CarteSVG.jsx — rendu SVG de la carte hex fictive
// React.memo : ne re-render que si xf/svgData/lod/hover changent, jamais pour les nuages
import React, { memo } from 'react'
import { VB_W, VB_H, hexCenter } from '../utils/hex.js'
import { neonPays } from '../utils/palette.js'

const CarteSVG = memo(function CarteSVG({
  xf, svgData, lod,
  hoveredPays, setHoveredPays, onPaysDoubleClick,
}) {
  const { oceanSurfD, oceanFaceD, oceanGradD,
          terreSurfD, terreFaceD, terreGradD,
          paysD, frontD, coteD, particules,
          paysCentres, nomsPays } = svgData

  const nPart = lod === 2 ? 200 : 120

  return (
    <div style={{
      position: 'absolute',
      transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.scale})`,
      transformOrigin: '0 0',
      width: `${VB_W}px`,
      height: `${VB_H}px`,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%' }}>

        <defs>
          <linearGradient id="ombre-couche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </linearGradient>
          <filter id="pays-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
          <filter id="relief-shadow" x="-0.5" y="-0.5" width="2" height="2">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="3" dy="3" result="offsetblur"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <rect width={VB_W} height={VB_H} fill="#061628" />

        {particules.slice(0, nPart).map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="0.8" fill="#1a3a5a" opacity="0.4" />
        ))}

        {/* Océan */}
        {[0, 1, 2, 3].map(i => (
          <React.Fragment key={`oi-${i}`}>
            {i > 0 && Object.entries(oceanFaceD[i]).map(([c, d]) => d &&
              <path key={`of-${i}-${c}`} d={d} fill={c} stroke="none" />
            )}
            {i > 0 && oceanGradD[i] &&
              <path key={`og-${i}`} d={oceanGradD[i]} fill="url(#ombre-couche)" stroke="none" />
            }
            {Object.entries(oceanSurfD[i]).map(([c, d]) => d &&
              <path key={`os-${i}-${c}`} d={d} fill={c} stroke="none" />
            )}
          </React.Fragment>
        ))}

        {/* Terrain */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <React.Fragment key={`ti-${i}`}>
            {i > 0 && Object.entries(terreFaceD[i]).map(([c, d]) => d &&
              <path key={`tf-${i}-${c}`} d={d} fill={c} stroke="none" />
            )}
            {i > 0 && terreGradD[i] &&
              <path key={`tg-${i}`} d={terreGradD[i]} fill="url(#ombre-couche)" stroke="none" />
            }
            {Object.entries(terreSurfD[i]).map(([c, d]) => d &&
              <path key={`ts-${i}-${c}`} d={d} fill={c} stroke="none"
                filter={i === 1 ? "url(#relief-shadow)" : undefined} />
            )}
          </React.Fragment>
        ))}

        {/* Côtes */}
        {coteD && <path d={coteD} stroke="rgba(0,210,245,0.50)" strokeWidth="0.9" fill="none" />}

        {/* Frontières + zones de hover pays */}
        {Object.keys(frontD).map(idx => {
          const id  = +idx
          const isH = hoveredPays === id
          const col = neonPays(id)
          return (
            <g key={`pays-${idx}`}>
              <path d={frontD[idx]} stroke={col}
                strokeWidth={isH ? '4' : '2'} fill="none"
                filter="url(#pays-glow)" opacity={isH ? '0.55' : '0.08'} />
              <path d={frontD[idx]} stroke={col}
                strokeWidth={isH ? '1.5' : '0.5'} fill="none"
                opacity={isH ? '0.9' : '0.2'} />
              {paysD[idx] &&
                <path d={paysD[idx]} fill={col}
                  fillOpacity={isH ? '0.08' : '0.001'} stroke="none"
                  onMouseEnter={() => setHoveredPays(id)}
                  onMouseLeave={() => setHoveredPays(null)}
                  onDoubleClick={() => onPaysDoubleClick?.(id)} />
              }
            </g>
          )
        })}

        {/* Noms des royaumes — LOD 1 et 2 */}
        {lod >= 1 && nomsPays && Object.entries(nomsPays).map(([pidStr, nom]) => {
          const pid    = +pidStr
          const centre = paysCentres?.[pid]
          if (!centre) return null
          const [cx, cy] = hexCenter(centre.sumC / centre.n, centre.sumR / centre.n)
          return (
            <text key={`nom-${pid}`}
              x={cx} y={cy}
              fontSize={lod === 2 ? 16 : 22}
              fill="rgba(220,235,255,0.75)"
              stroke="rgba(0,5,20,0.85)"
              strokeWidth={lod === 2 ? 3 : 4}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="monospace" letterSpacing="0.08em"
              style={{ paintOrder: 'stroke fill', userSelect: 'none', pointerEvents: 'none' }}>
              {nom}
            </text>
          )
        })}


      </svg>
    </div>
  )
})

export default CarteSVG
