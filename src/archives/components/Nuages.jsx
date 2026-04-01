// src/components/Nuages.jsx
import React, { useState, useEffect, useRef } from 'react';

const Nuages = ({
    vitesse = 0.9,
    opaciteBase = 0.7,
    largeurPage = 3000,
    hauteurPage = 1800,
    zoomVisible = 1.5,
    scaleActuel = 0.5,
}) => {
    const [cloudOffset, setCloudOffset] = useState(0);
    const animationRef = useRef(null);
    const [nuages, setNuages] = useState([]);
    const tempsRef = useRef(0);

    // Générer des nuages initiaux
    useEffect(() => {
        const genererNuages = () => {
            const nouveauxNuages = [];
            const nombreNuages = 35;

            for (let i = 0; i < nombreNuages; i++) {
                nouveauxNuages.push({
                    id: i,
                    phase: Math.random() * Math.PI * 2,
                                    baseX: Math.random() * (largeurPage + 400) - 200,
                                    baseY: 50 + Math.random() * (hauteurPage - 100),
                                    baseSize: 25 + Math.random() * 60,
                                    baseSpeed: 0.5 + Math.random() * 1.2,
                                    baseOpacity: 0.4 + Math.random() * 0.5,
                                    amplitudeY: 20 + Math.random() * 40,
                                    amplitudeSize: 8 + Math.random() * 20,
                                    amplitudeOpacity: 0.15 + Math.random() * 0.25,
                                    speedVariation: 0.3 + Math.random() * 0.8,
                });
            }
            setNuages(nouveauxNuages);
        };

        genererNuages();
    }, [largeurPage, hauteurPage]);

    // Animation des nuages
    useEffect(() => {
        let lastTime = performance.now();

        function animateClouds(now) {
            const delta = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            tempsRef.current += delta * 0.8;
            setCloudOffset(prev => (prev + delta * vitesse * 90) % (largeurPage * 2));

            setNuages(prevNuages =>
            prevNuages.map(cloud => ({
                ...cloud,
                currentSize: cloud.baseSize + Math.sin(tempsRef.current * 0.6 + cloud.phase) * cloud.amplitudeSize,
                                     currentY: cloud.baseY + Math.sin(tempsRef.current * 0.4 + cloud.phase * 1.3) * cloud.amplitudeY,
                                     currentOpacity: Math.min(0.85, Math.max(0.3,
                                                                             cloud.baseOpacity + Math.sin(tempsRef.current * 0.7 + cloud.phase * 0.8) * cloud.amplitudeOpacity
                                     )),
                                     currentSpeed: cloud.baseSpeed + Math.sin(tempsRef.current * 0.3 + cloud.phase) * cloud.speedVariation * 0.3,
            }))
            );

            animationRef.current = requestAnimationFrame(animateClouds);
        }

        animationRef.current = requestAnimationFrame(animateClouds);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [vitesse, largeurPage]);

    const createCloudPath = (x, y, size) => {
        const r = Math.max(8, size);
        return `M${x},${y - r*0.5} Q${x + r*0.4},${y - r*0.7} ${x + r*0.8},${y - r*0.2} Q${x + r*1.0},${y - r*0.3} ${x + r*0.9},${y} Q${x + r*1.1},${y + r*0.2} ${x + r*0.7},${y + r*0.4} Q${x + r*0.5},${y + r*0.5} ${x + r*0.2},${y + r*0.4} Q${x},${y + r*0.6} ${x - r*0.2},${y + r*0.4} Q${x - r*0.5},${y + r*0.5} ${x - r*0.7},${y + r*0.4} Q${x - r*1.1},${y + r*0.2} ${x - r*0.9},${y} Q${x - r*1.0},${y - r*0.3} ${x - r*0.8},${y - r*0.2} Q${x - r*0.4},${y - r*0.7} ${x},${y - r*0.5}Z`;
    };

    // LOGIQUE DE DISPARITION AU ZOOM (simplifiée)
    // Si le zoom est supérieur au seuil, on n'affiche rien
    if (scaleActuel >= zoomVisible) {
        return null;
    }

    // Opacité qui diminue quand on approche du seuil
    const facteurOpacity = Math.max(0, 1 - (scaleActuel / zoomVisible) * 0.8);

    return (
        <>
        {nuages.map((cloud) => {
            const xPos = (cloud.baseX + cloudOffset * cloud.currentSpeed) % (largeurPage + 500) - 250;
            const yPos = cloud.currentY;
            const size = Math.max(15, cloud.currentSize);
            const opacity = cloud.currentOpacity * facteurOpacity;
            const path = createCloudPath(xPos, yPos, size);

            return (
                <path
                key={cloud.id}
                d={path}
                fill={`rgba(245, 250, 255, ${opacity})`}
                filter="url(#cloud-blur)"
                stroke="none"
                style={{ pointerEvents: 'none' }}
                />
            );
        })}
        </>
    );
};

export default Nuages;
