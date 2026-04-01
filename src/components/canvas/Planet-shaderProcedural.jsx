// src/components/canvas/Planet.jsx
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

// 1. Définition des Shaders Procéduraux
const vertexShader = `
uniform float uTransition;
uniform float uRadius;
varying vec2 vUv;

void main() {
    vUv = uv;

    // A. Position Plan (XY)
    vec3 planePos = position;

    // B. Calcul de la position sphérique
    float lon = (uv.x * 2.0 - 1.0) * 3.14159265359;
    float lat = (uv.y - 0.5) * 3.14159265359;

    vec3 spherePos;
    spherePos.x = uRadius * cos(lat) * sin(lon);
    spherePos.y = uRadius * sin(lat);
    spherePos.z = uRadius * cos(lat) * cos(lon);

    // C. Morphing
    vec3 finalPos = mix(spherePos, planePos, uTransition);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;

// Fonction de hachage pour le bruit
float hash(vec2 p) {
    p = fract(p * vec3(.1031, .1030, .0973).xy);
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
}

// Fonction de bruit (Noise) pour générer des formes organiques
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1., 0.));
    float c = hash(i + vec2(0., 1.));
    float d = hash(i + vec2(1., 1.));
    vec2 u = f * f * (3. - 2. * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}

void main() {
    // Génération de continents par accumulation de couches de bruit (fBm)
    float n = noise(vUv * 6.0) * 0.5;
    n += noise(vUv * 12.0) * 0.25;
    n += noise(vUv * 24.0) * 0.125;

    vec3 color;

    // Logique de coloration procédurale
    if (n > 0.5) {
        // Terre / Continents
        color = vec3(0.15, 0.45, 0.15);
    } else if (n > 0.47) {
        // Plages / Sable
        color = vec3(0.8, 0.7, 0.5);
    } else {
        // Océans
        color = vec3(0.05, 0.15, 0.4);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

export function Planet({ radius = 5, isPlanar = false }) {
    const meshRef = useRef();
    const groupRef = useRef();
    const [, getKeys] = useKeyboardControls(); // Récupère les touches configurées dans Scene.jsx

    // Les uniforms ne contiennent plus de texture, seulement les paramètres mathématiques
    const uniforms = useMemo(() => ({
        uTransition: { value: 0 },
        uRadius: { value: radius },
    }), [radius]);

    useFrame((state, delta) => {
        if (!meshRef.current || !groupRef.current) return;

        // 1. Animation de la transition (Globe <-> Plan)
        const targetTransition = isPlanar ? 1.0 : 0.0;
        meshRef.current.material.uniforms.uTransition.value = THREE.MathUtils.lerp(
            meshRef.current.material.uniforms.uTransition.value,
            targetTransition,
            0.05
        );

        // 2. Gestion du déplacement au clavier (ZQSD / Flèches) en mode Plan
        if (isPlanar) {
            const { forward, backward, left, right } = getKeys();
            const moveSpeed = 15 * delta;

            if (forward)  groupRef.current.position.y -= moveSpeed;
            if (backward) groupRef.current.position.y += moveSpeed;
            if (left)     groupRef.current.position.x += moveSpeed;
            if (right)    groupRef.current.position.x -= moveSpeed;
        } else {
            // Retour fluide au centre (0,0,0) pour le mode Globe
            groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
    });

    return (
        <group ref={groupRef}>
        <mesh ref={meshRef}>
        {/* Géométrie haute résolution pour un morphing fluide */}
        <planeGeometry args={[radius * 2 * Math.PI, radius * Math.PI, 128, 64]} />
        <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        />
        </mesh>

        {/* Fond sombre pour le mode planisphère */}
        {isPlanar && (
            <mesh position={[0, 0, -0.2]}>
            <planeGeometry args={[radius * 2 * Math.PI + 2, radius * Math.PI + 2]} />
            <meshStandardMaterial color="#050505" />
            </mesh>
        )}
        </group>
    );
}
