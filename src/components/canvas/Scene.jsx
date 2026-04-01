import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, MapControls, Stars, KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
//import { Planet } from './Planet';
import { Marker } from './Marker';
import { WarRoomMap } from './WarRoomMap';


// Configuration des touches du clavier
const map = [
    { name: 'forward', keys: ['ArrowUp', 'z'] },
{ name: 'backward', keys: ['ArrowDown', 's'] },
{ name: 'left', keys: ['ArrowLeft', 'q'] },
{ name: 'right', keys: ['ArrowRight', 'd'] },
];
// Dans Scene.jsx
function ControlsManager({ isPlanar, radius }) {
    const { camera } = useThree();
    const controlsRef = useRef();

    useEffect(() => {
        if (isPlanar) {
            // 1. On force la caméra à se remettre "droite" face au plan XY
            camera.position.set(0, 0, radius * 3);
            camera.up.set(0, 1, 0); // Force le "Haut" vers le haut (Y)

    if (controlsRef.current) {
        // 2. On force le point de vue (target) au centre (0,0,0)
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
    }
        } else {
            // Optionnel : repositionner un peu mieux pour le globe
            camera.position.set(0, 0, radius * 3);
        }
    }, [isPlanar, camera, radius]);

    return isPlanar ? (
        <MapControls
        ref={controlsRef}
        enableRotate={false} // BLOQUE la vue de biais
        screenSpacePanning={true}
        panSpeed={1}
        />
    ) : (
        <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false} // Évite de décentrer le globe par erreur
        />
    );
}

export function Scene({ isPlanar }) {
    const radius = 5;

    return (
        <KeyboardControls map={map}>
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <color attach="background" args={['#020202']} />
        <ambientLight intensity={0.5} />

        <ControlsManager isPlanar={isPlanar} radius={radius} />

        <Stars radius={100} factor={4} />

        <Planet radius={radius} isPlanar={isPlanar} textureUrl="/textures/planet_color.jpg" />

        {/* Ajoute tes petits objets ici ! */}
       {/* <Marker lat={48.8566} lon={2.3522} radius={radius} isPlanar={isPlanar} />  Paris */}
       {/*  <Marker lat={40.7128} lon={-74.0060} radius={radius} isPlanar={isPlanar} /> NYC */}

        </Canvas>
        </KeyboardControls>
    );
}


