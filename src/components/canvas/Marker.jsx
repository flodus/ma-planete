// src/components/canvas/Marker.jsx
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToSphere, latLonToPlane } from '../../utils/geoMaths';

export function Marker({ lat, lon, radius, isPlanar }) {
    const meshRef = useRef();

    // On calcule les deux positions fixes une seule fois au montage
    const spherePos = latLonToSphere(lat, lon, radius);
    const planePos = latLonToPlane(lat, lon, radius);

    useFrame(() => {
        if (!meshRef.current) return;

        // On choisit la cible selon le mode
        const target = isPlanar ? planePos : spherePos;

        // Animation fluide pour suivre le mouvement de la planète
        meshRef.current.position.lerp(target, 0.05);

        // Optionnel : orienter le marqueur vers l'extérieur
        if (!isPlanar) {
            meshRef.current.lookAt(0, 0, 0);
        } else {
            meshRef.current.rotation.set(0, 0, 0);
        }
    });

    return (
        <mesh ref={meshRef}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="red" />
        </mesh>
    );
}
