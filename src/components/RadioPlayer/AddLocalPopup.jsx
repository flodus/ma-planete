// components/RadioPlayer/AddLocalPopup.jsx
import { useRef } from 'react'

export default function AddLocalPopup({ isOpen, onClose, onAdd }) {
    const fileInputRef = useRef(null)

    if (!isOpen) return null

        const handleFileUpload = (e) => {
            const files = Array.from(e.target.files)
            files.forEach(file => {
                onAdd({
                    name: file.name.replace('.mp3', '').replace('.m4a', '').replace('.ogg', ''),
                      src: URL.createObjectURL(file),
                      type: 'local',
                      file: file
                })
            })
            onClose()
        }

        return (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', borderRadius: '12px',
                padding: '20px', border: '1px solid rgba(198,162,76,0.5)', zIndex: 1001, minWidth: '280px'
            }}>
            <div style={{ color: '#c6a24c', fontSize: '12px', marginBottom: '16px', fontWeight: 'bold' }}>
            📁 Ajouter un fichier audio
            </div>
            <input
            type="file"
            accept="audio/mp3,audio/mpeg,audio/m4a,audio/ogg"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{
                width: '100%', background: 'rgba(255,255,255,0.1)',
                border: '0.5px solid rgba(198,162,76,0.3)', borderRadius: '6px',
                padding: '8px', color: 'white', fontSize: '11px', marginBottom: '16px'
            }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
                background: 'transparent', border: '0.5px solid rgba(255,255,255,0.3)',
                borderRadius: '6px', padding: '5px 14px', color: 'rgba(255,255,255,0.6)',
                fontSize: '10px', cursor: 'pointer'
            }}>
            Annuler
            </button>
            </div>
            </div>
        )
}
