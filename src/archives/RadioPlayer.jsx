// components/RadioPlayer.jsx
import { useState, useRef, useEffect } from 'react'
import defaultStationsData from '../data/defaultStations.json'

function parserM3U(texte) {
    const lignes = texte.split('\n').map(l => l.trim()).filter(Boolean)
    const result = []
    let nom = null
    for (const ligne of lignes) {
        if (ligne.startsWith('#EXTINF')) {
            const m = ligne.match(/,(.+)$/)
            nom = m ? m[1].trim() : null
        } else if (!ligne.startsWith('#')) {
            result.push({ name: nom || ligne, src: ligne })
            nom = null
        }
    }
    return result
}

function parserPLS(texte) {
    const lignes = texte.split('\n').map(l => l.trim())
    const fichiers = {}, titres = {}
    for (const ligne of lignes) {
        const mF = ligne.match(/^File(\d+)=(.+)$/i)
        if (mF) fichiers[mF[1]] = mF[2].trim()
        const mT = ligne.match(/^Title(\d+)=(.+)$/i)
        if (mT) titres[mT[1]] = mT[2].trim()
    }
    return Object.entries(fichiers).map(([i, src]) => ({ name: titres[i] || src, src }))
}

const STORAGE_KEY = 'radio_stations'
const CURRENT_KEY = 'current_station_id'
const VOLUME_KEY = 'radio_volume'

function RadioPlayer() {
    // Chargement des stations : d'abord localStorage, sinon le fichier JSON
    const [stations, setStations] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            return JSON.parse(saved)
        }
        return defaultStationsData
    })

    const [currentStation, setCurrentStation] = useState(() => {
        const savedId = localStorage.getItem(CURRENT_KEY)
        if (savedId) {
            const savedStations = localStorage.getItem(STORAGE_KEY)
            const stationsList = savedStations ? JSON.parse(savedStations) : defaultStationsData
            const found = stationsList.find(s => s.id === parseInt(savedId))
            if (found) return found
        }
        return defaultStationsData[0]
    })

    const [isPlaying, setIsPlaying] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [showVolume, setShowVolume] = useState(false)
    const [showAddPopup, setShowAddPopup] = useState(false)
    const [showLocalPopup, setShowLocalPopup] = useState(false)
    const [newStationName, setNewStationName] = useState('')
    const [newStationUrl, setNewStationUrl] = useState('')
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem(VOLUME_KEY)
        return saved ? parseFloat(saved) : 0.5
    })
    const audioRef = useRef(null)
    const fileInputRef = useRef(null)

    // Sauvegarde
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stations))
    }, [stations])

    useEffect(() => {
        localStorage.setItem(CURRENT_KEY, currentStation.id.toString())
    }, [currentStation])

    useEffect(() => {
        localStorage.setItem(VOLUME_KEY, volume.toString())
    }, [volume])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume
        }
    }, [volume])

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play().catch(e => console.log('Lecture impossible:', e))
            }
            setIsPlaying(!isPlaying)
        }
    }

    const handleVolumeChange = (e) => {
        setVolume(parseFloat(e.target.value))
    }

    const changeStation = (station) => {
        setCurrentStation(station)
        setIsOpen(false)
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.src = station.src
            audioRef.current.load()
            setIsPlaying(false)
        }
    }

    // Upload de fichiers audio et playlists
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files)
        const maxId = Math.max(...stations.map(s => s.id), 0)
        let idCounter = maxId + 1
        const newStations = []

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase()
            if (ext === 'm3u' || ext === 'm3u8') {
                const texte = await file.text()
                parserM3U(texte).forEach(e => newStations.push({ id: idCounter++, name: e.name, src: e.src, type: 'custom' }))
            } else if (ext === 'pls') {
                const texte = await file.text()
                parserPLS(texte).forEach(e => newStations.push({ id: idCounter++, name: e.name, src: e.src, type: 'custom' }))
            } else {
                const name = file.name.replace(/\.(mp3|m4a|ogg|wav|flac|aac)$/i, '')
                newStations.push({ id: idCounter++, name, src: URL.createObjectURL(file), type: 'local', file })
            }
        }

        setStations([...stations, ...newStations])
        setShowLocalPopup(false)
        if (newStations.length === 1) changeStation(newStations[0])
    }

    const addCustomStation = () => {
        if (newStationName.trim() && newStationUrl.trim()) {
            const newId = Math.max(...stations.map(s => s.id), 0) + 1
            const newStation = {
                id: newId,
                name: newStationName.trim(),
                src: newStationUrl.trim(),
                type: 'custom'
            }
            setStations([...stations, newStation])
            changeStation(newStation)
            setNewStationName('')
            setNewStationUrl('')
            setShowAddPopup(false)
        }
    }

    const removeStation = (stationId, e) => {
        e.stopPropagation()
        if (stations.length <= 1) return

            const stationToRemove = stations.find(s => s.id === stationId)
            if (stationToRemove?.type === 'local' && stationToRemove.src?.startsWith('blob:')) {
                URL.revokeObjectURL(stationToRemove.src)
            }

            const newStations = stations.filter(s => s.id !== stationId)
            setStations(newStations)

            if (currentStation.id === stationId) {
                changeStation(newStations[0])
            }
    }

    // Réinitialiser aux stations par défaut (depuis le JSON)
    const resetToDefault = () => {
        setStations(defaultStationsData)
        setCurrentStation(defaultStationsData[0])
        if (isPlaying && audioRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
        }
        setIsOpen(false)
    }

    const getDisplayName = (name) => {
        return name.length > 20 ? name.substring(0, 18) + '…' : name
    }

    return (
        <div style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            fontFamily: 'system-ui, monospace'
        }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(3px)',
            borderRadius: '16px',
            padding: '3px 8px',
            border: '0.5px solid rgba(198,162,76,0.25)'
        }}>
        <button onClick={togglePlay} style={{
            background: 'transparent', border: 'none', color: '#c6a24c',
            cursor: 'pointer', fontSize: '10px', width: '16px'
        }}>
        {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={{
            color: 'rgba(255,255,255,0.6)', fontSize: '9px',
            maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
        {isPlaying ? '🎧 ' : '⚫ '}{getDisplayName(currentStation.name)}
        </div>

        {/* Menu déroulant */}
        <div style={{ position: 'relative' }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '8px'
        }}>
        {isOpen ? '▲' : '▼'}
        </button>

        {isOpen && (
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
            <button onClick={resetToDefault} style={{
                background: 'transparent', border: 'none',
                color: '#c6a24c', cursor: 'pointer', fontSize: '8px'
            }}>
            ↺ Réinitialiser
            </button>
            </div>

            {stations.map(station => (
                <div key={station.id} onClick={() => changeStation(station)} style={{
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
                {!defaultStationsData.some(s => s.id === station.id) && (
                    <button onClick={(e) => removeStation(station.id, e)} style={{
                        background: 'transparent', border: 'none',
                        color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '10px', padding: '0 4px'
                    }}>
                    ✕
                    </button>
                )}
                </div>
            ))}

            <div style={{ borderTop: '0.5px solid rgba(198,162,76,0.3)' }} />

            <div onClick={() => { setIsOpen(false); setShowAddPopup(true); }} style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: '9px', color: '#c6a24c',
                background: 'rgba(198,162,76,0.05)'
            }}>
            🔗 + AJOUTER FLUX URL
            </div>

            <div onClick={() => { setIsOpen(false); setShowLocalPopup(true); }}
            title="mp3 · ogg · m4a · wav · flac · aac · m3u · pls"
            style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: '9px', color: '#c6a24c',
                background: 'rgba(198,162,76,0.05)', borderTop: '0.5px solid rgba(198,162,76,0.2)'
            }}>
            📁 + AJOUTER FICHIER AUDIO
            </div>
            </div>
        )}
        </div>

        {/* Volume */}
        <div style={{ position: 'relative' }}>
        <button onClick={() => setShowVolume(!showVolume)} style={{
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
            <input type="range" min="0" max="1" step="0.01" value={volume}
            onChange={handleVolumeChange} style={{
                width: '80px', height: '2px', WebkitAppearance: 'none',
                background: 'rgba(255,255,255,0.2)', borderRadius: '2px', outline: 'none'
            }}
            />
            </div>
        )}
        </div>
        </div>

        {/* Popup ajout MP3 local */}
        {showLocalPopup && (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', borderRadius: '12px',
                            padding: '20px', border: '1px solid rgba(198,162,76,0.5)', zIndex: 1001, minWidth: '280px'
            }}>
            <div style={{ color: '#c6a24c', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>
            📁 Ajouter un fichier audio ou une playlist
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginBottom: '14px' }}>
            mp3 · ogg · m4a · wav · flac · aac · m3u · pls — sélection multiple possible
            </div>
            <input
            type="file"
            accept="audio/*,.m3u,.m3u8,.pls"
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
            <button onClick={() => setShowLocalPopup(false)} style={{
                background: 'transparent', border: '0.5px solid rgba(255,255,255,0.3)',
                            borderRadius: '6px', padding: '5px 14px', color: 'rgba(255,255,255,0.6)',
                            fontSize: '10px', cursor: 'pointer'
            }}>
            Annuler
            </button>
            </div>
            </div>
        )}

        {/* Popup ajout URL */}
        {showAddPopup && (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', borderRadius: '12px',
                          padding: '20px', border: '1px solid rgba(198,162,76,0.5)', zIndex: 1001, minWidth: '280px'
            }}>
            <div style={{ color: '#c6a24c', fontSize: '12px', marginBottom: '16px', fontWeight: 'bold' }}>
            🔗 Ajouter un flux
            </div>
            <input type="text" placeholder="Nom de la radio" value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)} style={{
                width: '100%', background: 'rgba(255,255,255,0.1)',
                          border: '0.5px solid rgba(198,162,76,0.3)', borderRadius: '6px',
                          padding: '8px 10px', color: 'white', fontSize: '11px', marginBottom: '10px', outline: 'none'
            }} autoFocus />
            <input type="text" placeholder="URL du flux (mp3, aac, ogg)" value={newStationUrl}
            onChange={(e) => setNewStationUrl(e.target.value)} style={{
                width: '100%', background: 'rgba(255,255,255,0.1)',
                          border: '0.5px solid rgba(198,162,76,0.3)', borderRadius: '6px',
                          padding: '8px 10px', color: 'white', fontSize: '11px', marginBottom: '16px', outline: 'none'
            }} onKeyPress={(e) => e.key === 'Enter' && addCustomStation()} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddPopup(false)} style={{
                background: 'transparent', border: '0.5px solid rgba(255,255,255,0.3)',
                          borderRadius: '6px', padding: '5px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer'
            }}>Annuler</button>
            <button onClick={addCustomStation} style={{
                background: 'rgba(198,162,76,0.2)', border: '0.5px solid #c6a24c',
                          borderRadius: '6px', padding: '5px 14px', color: '#c6a24c', fontSize: '10px', cursor: 'pointer'
            }}>Ajouter</button>
            </div>
            </div>
        )}

        <audio ref={audioRef} src={currentStation.src}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        />
        <style>{`
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none; width: 8px; height: 8px;
                border-radius: 50%; background: #c6a24c; cursor: pointer;
            }
            `}</style>
            </div>
    )
}

export default RadioPlayer
