// src/components/canvas/Planet.jsx
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

export function Planet({ radius = 5, isPlanar = false }) {
    const meshRef = useRef();
    const groupRef = useRef();
    const [, getKeys] = useKeyboardControls();
    const [geoData, setGeoData] = useState(null);

    useEffect(() => {
        fetch('/countries.geo.json')
        .then(res => res.json())
        .then(data => setGeoData(data))
        .catch(err => console.error("Manque countries.geo.json dans /public"));
    }, []);

    // 1. Texture de fond Cyber
    const dynamicTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(512, 256, 10, 512, 256, 600);
        grad.addColorStop(0, '#101435'); grad.addColorStop(1, '#04050c');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 512);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    for(let i=0; i<1024; i+=32) { ctx.strokeRect(i, 0, 0.5, 512); ctx.strokeRect(0, i/2, 1024, 0.5); }
    return new THREE.CanvasTexture(canvas);
    }, []);

    // 2. Préparation des géométries (Frontières mondiales + Highlights)
    const geometries = useMemo(() => {
        if (!geoData) return { world: null, france: null, italy: null };

        const extractPoints = (filterFn) => {
            const pts = [];
            geoData.features.filter(filterFn).forEach(feat => {
                const coords = feat.geometry.type === "Polygon" ? [feat.geometry.coordinates] : feat.geometry.coordinates;
                coords.forEach(poly => poly.forEach(ring => {
                    for (let i = 0; i < ring.length - 1; i++) {
                        pts.push(new THREE.Vector3(ring[i][0], ring[i][1], 0), new THREE.Vector3(ring[i+1][0], ring[i+1][1], 0));
                    }
                }));
            });
            return new THREE.BufferGeometry().setFromPoints(pts);
        };

        return {
            world: extractPoints(f => f.properties.name !== "France" && f.properties.name !== "Italy"),
                               france: extractPoints(f => f.properties.name === "France"),
                               italy: extractPoints(f => f.properties.name === "Italy"),
        };
    }, [geoData]);

    // 3. Matériaux & Shaders
    const sharedUniforms = useMemo(() => ({
        uTransition: { value: 0 },
        uRadius: { value: radius },
        uTexture: { value: dynamicTexture }
    }), [radius, dynamicTexture]);

    const vertexShader = `
    uniform float uTransition; uniform float uRadius;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        float lon = (uv.x * 2.0 - 1.0) * 3.14159265;
        float lat = (uv.y - 0.5) * 3.14159265;
        vec3 sphere = vec3(uRadius * cos(lat) * sin(lon), uRadius * sin(lat), uRadius * cos(lat) * cos(lon));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(sphere, position, uTransition), 1.0);
    }
    `;

    // Shader spécifique pour les lignes GeoJSON (conversion degrés -> 3D)
    const lineVertexShader = `
    uniform float uTransition; uniform float uRadius;
    void main() {
        float lon = position.x * (3.14159265 / 180.0);
        float lat = position.y * (3.14159265 / 180.0);
        vec3 sphere = vec3((uRadius+0.02) * cos(lat) * sin(lon), (uRadius+0.02) * sin(lat), (uRadius+0.02) * cos(lat) * cos(lon));
        vec3 plane = vec3(position.x / 180.0 * (uRadius * 3.14159), position.y / 90.0 * (uRadius * 3.14159 / 2.0), 0.05);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(sphere, plane, uTransition), 1.0);
    }
    `;

    useFrame((state, delta) => {
        const target = isPlanar ? 1.0 : 0.0;
        sharedUniforms.uTransition.value = THREE.MathUtils.lerp(sharedUniforms.uTransition.value, target, 0.05);

        if (isPlanar) {
            const { forward, backward, left, right } = getKeys();
            const s = 20 * delta;
            if (forward) groupRef.current.position.y -= s;
            if (backward) groupRef.current.position.y += s;
            if (left) groupRef.current.position.x += s;
            if (right) groupRef.current.position.x -= s;
        } else {
            groupRef.current.position.lerp(new THREE.Vector3(0,0,0), 0.1);
        }
    });

    return (
        <group ref={groupRef}>
        <mesh ref={meshRef}>
        <planeGeometry args={[radius * 2 * Math.PI, radius * Math.PI, 64, 32]} />
        <shaderMaterial vertexShader={vertexShader} fragmentShader="uniform sampler2D uTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTexture, vUv); }" uniforms={sharedUniforms} side={THREE.DoubleSide} />
        </mesh>

        {/* Frontières Mondiales Mondiales (Cyan discret) */}
        {geometries.world && (
            <lineSegments geometry={geometries.world}>
            <shaderMaterial vertexShader={lineVertexShader} fragmentShader="void main() { gl_FragColor = vec4(0.0, 0.5, 0.6, 0.3); }" uniforms={sharedUniforms} transparent />
            </lineSegments>
        )}

        {/* HIGHLIGHT : France (Rose Néon) */}
        {geometries.france && (
            <lineSegments geometry={geometries.france}>
            <shaderMaterial vertexShader={lineVertexShader} fragmentShader="void main() { gl_FragColor = vec4(1.0, 0.0, 0.6, 1.0); }" uniforms={sharedUniforms} />
            </lineSegments>
        )}

        {/* HIGHLIGHT : Italie (Vert Néon) */}
        {geometries.italy && (
            <lineSegments geometry={geometries.italy}>
            <shaderMaterial vertexShader={lineVertexShader} fragmentShader="void main() { gl_FragColor = vec4(0.2, 1.0, 0.4, 1.0); }" uniforms={sharedUniforms} />
            </lineSegments>
        )}
        </group>
    );
}
