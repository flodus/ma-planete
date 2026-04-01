// components/RadioPlayer/index.jsx
import { useState } from 'react'
import { accentRgba } from '../../styles/theme.js'
import { useRadioPlayer } from './useRadioPlayer'
import RadioButton from './RadioButton'
import StationDisplay from './StationDisplay'
import StationMenu from './StationMenu'
import VolumeControl from './VolumeControl'
import AddStationPopup from './AddStationPopup'
import AddLocalPopup from './AddLocalPopup'

function RadioPlayer() {
    const {
        stations,
        currentStation,
        isPlaying,
        setIsPlaying,
        volume,
        audioRef,
        togglePlay,
        changeStation,
        addStation,
        removeStation,
        resetToDefault,
        setVolume,
        isDefaultStation,
    } = useRadioPlayer()

    const [isOpen, setIsOpen] = useState(false)
    const [showVolume, setShowVolume] = useState(false)
    const [showAddPopup, setShowAddPopup] = useState(false)
    const [showLocalPopup, setShowLocalPopup] = useState(false)

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
            border: `0.5px solid ${accentRgba(0.25)}`
        }}>
        <RadioButton isPlaying={isPlaying} onToggle={togglePlay} />
        <StationDisplay isPlaying={isPlaying} name={getDisplayName(currentStation.name)} />

        <StationMenu
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        stations={stations}
        currentStation={currentStation}
        onChangeStation={changeStation}
        onRemoveStation={removeStation}
        onReset={resetToDefault}
        onAddUrl={() => { setIsOpen(false); setShowAddPopup(true) }}
        onAddLocal={() => { setIsOpen(false); setShowLocalPopup(true) }}
        isDefaultStation={isDefaultStation}  // ← passer la fonction
        />

        <VolumeControl
        volume={volume}
        showVolume={showVolume}
        onToggle={() => setShowVolume(!showVolume)}
        onChange={setVolume}
        />
        </div>

        <AddStationPopup
        isOpen={showAddPopup}
        onClose={() => setShowAddPopup(false)}
        onAdd={addStation}
        />

        <AddLocalPopup
        isOpen={showLocalPopup}
        onClose={() => setShowLocalPopup(false)}
        onAdd={addStation}
        />

        <audio
        ref={audioRef}
        src={currentStation.src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        />
        </div>
    )
}

export default RadioPlayer
