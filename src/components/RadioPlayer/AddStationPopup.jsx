// components/RadioPlayer/AddStationPopup.jsx
import { useState } from 'react'

export default function AddStationPopup({ isOpen, onClose, onAdd }) {
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')

    if (!isOpen) return null

        const handleSubmit = () => {
            if (name.trim() && url.trim()) {
                onAdd({ name: name.trim(), src: url.trim(), type: 'custom' })
                setName('')
                setUrl('')
                onClose()
            }
        }

        return (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', borderRadius: '12px',
                padding: '20px', border: '1px solid rgba(198,162,76,0.5)', zIndex: 1001, minWidth: '280px'
            }}>
            <div style={{ color: '#c6a24c', fontSize: '12px', marginBottom: '16px', fontWeight: 'bold' }}>
            🔗 Ajouter un flux
            </div>
            <input
            type="text"
            placeholder="Nom de la radio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
                width: '100%', background: 'rgba(255,255,255,0.1)',
                border: '0.5px solid rgba(198,162,76,0.3)', borderRadius: '6px',
                padding: '8px 10px', color: 'white', fontSize: '11px', marginBottom: '10px', outline: 'none'
            }}
            autoFocus
            />
            <input
            type="text"
            placeholder="URL du flux (mp3, aac, ogg)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            style={{
                width: '100%', background: 'rgba(255,255,255,0.1)',
                border: '0.5px solid rgba(198,162,76,0.3)', borderRadius: '6px',
                padding: '8px 10px', color: 'white', fontSize: '11px', marginBottom: '16px', outline: 'none'
            }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
                background: 'transparent', border: '0.5px solid rgba(255,255,255,0.3)',
                borderRadius: '6px', padding: '5px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer'
            }}>Annuler</button>
            <button onClick={handleSubmit} style={{
                background: 'rgba(198,162,76,0.2)', border: '0.5px solid #c6a24c',
                borderRadius: '6px', padding: '5px 14px', color: '#c6a24c', fontSize: '10px', cursor: 'pointer'
            }}>Ajouter</button>
            </div>
            </div>
        )
}
