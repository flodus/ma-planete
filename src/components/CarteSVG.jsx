// components/CarteSVG.jsx — rendu SVG de la carte hex fictive
import React from 'react'
import { VB_W, VB_H } from '../utils/hex.js'
import { neonPays } from '../utils/palette.js'
import { createCloudPath } from '../utils/nuages.js'

export default function CarteSVG({
  xf, svgData, lod,
  nuages, cloudOffset, nuagesVisibles, nuagesOpacity,
  hoveredPays, setHoveredPays, onPaysDoubleClick,
}) {
  const { oceanSurfD, oceanFaceD, oceanGradD,
          terreSurfD, terreFaceD, terreGradD,
          paysD, frontD, coteD, particules } = svgData

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
          <filter id="cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3"/>
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

        {coteD && <path d={coteD} stroke="rgba(0,210,245,0.50)" strokeWidth="0.9" fill="none" />}

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

        {nuagesVisibles && nuages.map((cloud) => {
          const xPos = (cloud.baseX + cloudOffset * cloud.currentSpeed * 80) % (VB_W + 500) - 250
          return (
            <path key={`cloud-${cloud.id}`}
              d={createCloudPath(xPos, cloud.currentY, cloud.currentSize)}
              fill={`rgba(245, 248, 255, ${cloud.currentOpacity * nuagesOpacity})`}
              filter="url(#cloud-blur)" stroke="none"
              style={{ pointerEvents: 'none' }} />
          )
        })}

      </svg>
    </div>
  )
}
