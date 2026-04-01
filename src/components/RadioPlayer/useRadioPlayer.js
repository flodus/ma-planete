// components/RadioPlayer/useRadioPlayer.js
import { useState, useRef, useEffect } from 'react'
import defaultStationsData from '../../data/defaultStations.json'

const STORAGE_KEY = 'radio_stations'
const CURRENT_KEY = 'current_station_id'
const VOLUME_KEY = 'radio_volume'

const isDefaultStation = (station) => {
    return defaultStationsData.some(defaultStation =>
    defaultStation.id === station.id
    )
}

export function useRadioPlayer() {
    const [stations, setStations] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const parsed = JSON.parse(saved)
            const defaultIds = defaultStationsData.map(s => s.id)
            const missingDefaults = defaultStationsData.filter(
                defaultStation => !parsed.some(s => s.id === defaultStation.id)
            )
            return [...missingDefaults, ...parsed.filter(s => !defaultIds.includes(s.id))]
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
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem(VOLUME_KEY)
        return saved ? parseFloat(saved) : 0.5
    })

    const audioRef = useRef(null)

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
        if (!audioRef.current) return

            if (isPlaying) {
                audioRef.current.pause()
                setIsPlaying(false)
            } else {
                const playPromise = audioRef.current.play()
                if (playPromise !== undefined) {
                    playPromise
                    .then(() => {
                        setIsPlaying(true)
                    })
                    .catch((error) => {
                        console.log('Lecture bloquée:', error)
                        setIsPlaying(false)
                    })
                }
            }
    }

    const changeStation = (station) => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.src = station.src
        audioRef.current.load()
        setCurrentStation(station)
        setIsPlaying(false)
    }

    const addStation = (station) => {
        const customStations = stations.filter(s => !isDefaultStation(s))
        const maxCustomId = Math.max(...customStations.map(s => s.id), 0)
        const maxDefaultId = Math.max(...defaultStationsData.map(s => s.id), 0)
        const newId = Math.max(maxCustomId, maxDefaultId) + 1

        const newStation = { id: newId, ...station }
        setStations([...stations, newStation])
        changeStation(newStation)
        return newStation
    }

    const removeStation = (stationId) => {
        const stationToRemove = stations.find(s => s.id === stationId)

        if (isDefaultStation(stationToRemove)) {
            console.log('Impossible de supprimer une station par défaut')
            return
        }

        if (stations.length <= 1) return

            if (stationToRemove?.type === 'local' && stationToRemove.src?.startsWith('blob:')) {
                URL.revokeObjectURL(stationToRemove.src)
            }

            const newStations = stations.filter(s => s.id !== stationId)
            setStations(newStations)

            if (currentStation.id === stationId) {
                changeStation(newStations[0])
            }
    }

    const resetToDefault = () => {
        setStations(defaultStationsData)
        setCurrentStation(defaultStationsData[0])
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.src = defaultStationsData[0].src
            audioRef.current.load()
        }
        setIsPlaying(false)
    }

    return {
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
    }
}
