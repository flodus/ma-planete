// components/RadioPlayer/RadioButton.jsx
import { ACCENT } from '../../styles/theme.js'

export default function RadioButton({ isPlaying, onToggle }) {
    return (
        <button onClick={onToggle} style={{
            background: 'transparent', border: 'none', color: ACCENT,
            cursor: 'pointer', fontSize: '10px', width: '16px'
        }}>
        {isPlaying ? '⏸' : '▶'}
        </button>
    )
}
