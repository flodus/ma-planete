// src/components/canvas/Planet.jsx
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

export function Planet({ radius = 5, isPlanar = false }) {
    const meshRef = useRef();
    const groupRef = useRef();
    const borderRef = useRef();
    const [, getKeys] = useKeyboardControls();
    const [geoData, setGeoData] = useState(null);

    // 1. Chargement du GeoJSON (Vérifie bien qu'il est dans /public/countries.geo.json)
    useEffect(() => {
        fetch('/countries.geo.json')
        .then(res => res.json())
        .then(data => setGeoData(data))
        .catch(err => console.error("Erreur : Fichier GeoJSON manquant dans le dossier public", err));
    }, []);

    // 2. Texture de fond : Cyber Grille
    const dynamicTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Fond radial sombre (Bleu/Violet)
        const grad = ctx.createRadialGradient(512, 256, 10, 512, 256, 600);
        grad.addColorStop(0, '#161b40'); grad.addColorStop(1, '#050714');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 512);

        // Grille
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        for(let i=0; i<1024; i+=32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); }
        for(let j=0; j<512; j+=32) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(1024, j); ctx.stroke(); }

        return new THREE.CanvasTexture(canvas);
    }, []);

    // 3. Géométrie des frontières (Points pour LineSegments)
    const borderGeom = useMemo(() => {
        if (!geoData) return null;
        const points = [];
        geoData.features.forEach(feat => {
            const type = feat.geometry.type;
            const coords = type === "Polygon" ? [feat.geometry.coordinates] : feat.geometry.coordinates;

            coords.forEach(polygon => {
                polygon.forEach(ring => {
                    for (let i = 0; i < ring.length - 1; i++) {
                        points.push(new THREE.Vector3(ring[i][0], ring[i][1], 0));
                        points.push(new THREE.Vector3(ring[i+1][0], ring[i+1][1], 0));
                    }
                });
            });
        });
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [geoData]);

    // 4. Shaders de morphing
    const sharedUniforms = useMemo(() => ({
        uTransition: { value: 0 },
        uRadius: { value: radius },
        uTexture: { value: dynamicTexture }
    }), [radius, dynamicTexture]);

    const vertexShader = `
    uniform float uTransition;
    uniform float uRadius;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        // Conversion Lon/Lat (x/y) en Sphère ou Plan
        float lon = (uv.x * 2.0 - 1.0) * 3.14159265;
        float lat = (uv.y - 0.5) * 3.14159265;

        vec3 spherePos = vec3(uRadius * cos(lat) * sin(lon), uRadius * sin(lat), uRadius * cos(lat) * cos(lon));
        vec3 planePos = position; // Position déjà plane via planeGeometry

        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(spherePos, planePos, uTransition), 1.0);
    }
    `;

    const borderVertexShader = `
    uniform float uTransition;
    uniform float uRadius;
    void main() {
        float lon = position.x * (3.14159265 / 180.0);
        float lat = position.y * (3.14159265 / 180.0);

        vec3 spherePos = vec3((uRadius+0.02) * cos(lat) * sin(lon), (uRadius+0.02) * sin(lat), (uRadius+0.02) * cos(lat) * cos(lon));
        // Projection plane alignée sur la texture
        vec3 planePos = vec3(position.x / 180.0 * (uRadius * 3.14159), position.y / 90.0 * (uRadius * 3.14159 / 2.0), 0.05);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(spherePos, planePos, uTransition), 1.0);
    }
    `;

    useFrame((state, delta) => {
        const target = isPlanar ? 1.0 : 0.0;
        const t = THREE.MathUtils.lerp(sharedUniforms.uTransition.value, target, 0.05);
        sharedUniforms.uTransition.value = t;

        if (isPlanar) {
            const { forward, backward, left, right } = getKeys();
            const speed = 20 * delta;
            if (forward) groupRef.current.position.y -= speed;
            if (backward) groupRef.current.position.y += speed;
            if (left) groupRef.current.position.x += speed;
            if (right) groupRef.current.position.x -= speed;
        } else {
            groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
    });

    return (
        <group ref={groupRef}>
        {/* Fond de la planète */}
        <mesh ref={meshRef}>
        <planeGeometry args={[radius * 2 * Math.PI, radius * Math.PI, 64, 32]} />
        <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader="uniform sampler2D uTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTexture, vUv); }"
        uniforms={sharedUniforms}
        side={THREE.DoubleSide}
        />
        </mesh>

        {/* Frontières GeoJSON */}
        {borderGeom && (
            <lineSegments ref={borderRef} geometry={borderGeom}>
            <shaderMaterial
            uniforms={sharedUniforms}
            vertexShader={borderVertexShader}
            fragmentShader="void main() { gl_FragColor = vec4(0.0, 0.8, 1.0, 0.4); }"
            transparent
            />
            </lineSegments>
        )}
        </group>
    );
}
