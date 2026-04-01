// components/RadioPlayer/StationDisplay.jsx
export default function StationDisplay({ isPlaying, name }) {
    return (
        <div style={{
            color: 'rgba(255,255,255,0.6)', fontSize: '9px',
            maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
        {isPlaying ? '🎧 ' : '⚫ '}{name}
        </div>
    )
}
