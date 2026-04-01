// components/RadioPlayer/StationMenu.jsx
export default function StationMenu({
    isOpen,
    onToggle,
    stations,
    currentStation,
    onChangeStation,
    onRemoveStation,
    onReset,
    onAddUrl,
    onAddLocal,
    isDefaultStation  // nouvelle prop
}) {
    if (!isOpen) return null

        return (
            <div style={{ position: 'relative' }}>
            <button onClick={onToggle} style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '8px'
            }}>
            {isOpen ? '▲' : '▼'}
            </button>

            <div style={{
                position: 'absolute', top: '100%', right: '0', marginTop: '6px',
                background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)',
                borderRadius: '8px', border: '0.5px solid rgba(198,162,76,0.4)',
                overflow: 'hidden', minWidth: '200px', maxHeight: '350px', overflowY: 'auto'
            }}>
            <div style={{
                padding: '6px 10px',
                borderBottom: '0.5px solid rgba(198,162,76,0.3)',
                fontSize: '8px',
                color: '#c6a24c',
                display: 'flex',
                justifyContent: 'space-between'
            }}>
            <span>📻 RADIOS</span>
            <button onClick={onReset} style={{
                background: 'transparent', border: 'none',
                color: '#c6a24c', cursor: 'pointer', fontSize: '8px'
            }}>
            ↺ Réinitialiser
            </button>
            </div>

            {stations.map(station => (
                <div key={station.id} onClick={() => onChangeStation(station)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', cursor: 'pointer', fontSize: '10px',
                    color: currentStation.id === station.id ? '#c6a24c' : 'rgba(255,255,255,0.7)',
                                      background: currentStation.id === station.id ? 'rgba(198,162,76,0.15)' : 'transparent',
                                      borderBottom: '0.5px solid rgba(198,162,76,0.1)'
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{station.type === 'local' ? '📁' : station.type === 'custom' ? '🔗' : '📡'}</span>
                <span>{station.name}</span>
                {station.description && (
                    <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>{station.description}</span>
                )}
                </span>
                {/* La croix n'apparaît que si ce n'est PAS une station par défaut */}
                {!isDefaultStation(station) && (
                    <button onClick={(e) => { e.stopPropagation(); onRemoveStation(station.id) }} style={{
                        background: 'transparent', border: 'none',
                        color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '10px', padding: '0 4px'
                    }}>
                    ✕
                    </button>
                )}
                </div>
            ))}

            <div style={{ borderTop: '0.5px solid rgba(198,162,76,0.3)' }} />
            <div onClick={onAddLocal} style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: '9px', color: '#c6a24c',
                background: 'rgba(198,162,76,0.05)'
            }}>
            📁 + AJOUTER FICHIER MP3
            </div>
            <div onClick={onAddUrl} style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: '9px', color: '#c6a24c',
                background: 'rgba(198,162,76,0.05)', borderTop: '0.5px solid rgba(198,162,76,0.2)'
            }}>
            🔗 + AJOUTER FLUX URL
            </div>
            </div>
            </div>
        )
}
