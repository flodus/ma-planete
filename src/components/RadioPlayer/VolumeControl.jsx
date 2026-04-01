// components/RadioPlayer/VolumeControl.jsx
export default function VolumeControl({ volume, showVolume, onToggle, onChange }) {
    return (
        <div style={{ position: 'relative' }}>
        <button onClick={onToggle} style={{
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '10px', width: '16px'
        }}>
        {volume === 0 ? '🔇' : '🔊'}
        </button>
        {showVolume && (
            <div style={{
                position: 'absolute', top: '100%', right: '0', marginTop: '6px',
                background: 'rgba(0,0,0,0.8)', borderRadius: '12px', padding: '8px',
                        border: '0.5px solid rgba(198,162,76,0.3)'
            }}>
            <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
                width: '80px', height: '2px', WebkitAppearance: 'none',
                background: 'rgba(255,255,255,0.2)', borderRadius: '2px', outline: 'none'
            }}
            />
            <style>{`
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 8px; height: 8px;
                    border-radius: 50%; background: #c6a24c; cursor: pointer;
                }
                `}</style>
                </div>
        )}
        </div>
    )
}
