import * as THREE from 'three';

/**
 * Convertit des coordonnées Latitude/Longitude en position 3D (X, Y, Z)
 * @param {number} lat - Latitude (-90 à 90)
 * @param {number} lon - Longitude (-180 à 180)
 * @param {number} radius - Rayon de la planète
 * @returns {THREE.Vector3}
 */
export const latLonToSphere = (lat, lon, radius) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
};

/**
 * Convertit des coordonnées Latitude/Longitude en position Plane (X, Y)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Rayon utilisé pour l'échelle
 * @returns {THREE.Vector3}
 */
export const latLonToPlane = (lat, lon, radius) => {
    const width = radius * 2 * Math.PI;
    const height = radius * Math.PI;

    const x = (lon / 180) * (width / 2);
    const y = (lat / 90) * (height / 2);

    return new THREE.Vector3(x, y, 0);
};

/**
 * Calcule la distance "Grand Cercle" entre deux points sur la sphère
 * (Utile pour savoir si ton joueur est proche d'un objectif)
 */
export const getSphereDistance = (lat1, lon1, lat2, lon2, radius) => {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return radius * c;
};
