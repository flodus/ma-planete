// components/RadioPlayer/RadioButton.jsx
export default function RadioButton({ isPlaying, onToggle }) {
    return (
        <button onClick={onToggle} style={{
            background: 'transparent', border: 'none', color: '#c6a24c',
            cursor: 'pointer', fontSize: '10px', width: '16px'
        }}>
        {isPlaying ? '⏸' : '▶'}
        </button>
    )
}
