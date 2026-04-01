// src/utils/tectonique.js — transformation tectonique seedée du GeoJSON

const PI = Math.PI;

export function mulberry32(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Rotation de Rodrigues : vecteur v autour de l'axe k d'angle angle
function rodrigues(vx, vy, vz, kx, ky, kz, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = vx * kx + vy * ky + vz * kz;
    const cx  = ky * vz - kz * vy;
    const cy  = kz * vx - kx * vz;
    const cz  = kx * vy - ky * vx;
    return [
        vx * cos + cx * sin + kx * dot * (1 - cos),
        vy * cos + cy * sin + ky * dot * (1 - cos),
        vz * cos + cz * sin + kz * dot * (1 - cos),
    ];
}

const AXES_BASE = [
    [ 1, 1, 1], [-1, 1, 1], [ 1,-1, 1], [-1,-1, 1],
    [ 1, 1,-1], [-1, 1,-1], [ 1,-1,-1], [-1,-1,-1],
];

// 8 transformations indépendantes (une par octant), issues du seed
function genererTransforms(seed) {
    const rng = mulberry32(seed);
    return AXES_BASE.map(([bx, by, bz]) => {
        // Normaliser l'axe de base
        const len0 = Math.sqrt(bx*bx + by*by + bz*bz);
        // Ajouter perturbation seedée
        let ax = bx/len0 + (rng() - 0.5) * 0.6;
        let ay = by/len0 + (rng() - 0.5) * 0.6;
        let az = bz/len0 + (rng() - 0.5) * 0.6;
        // Re-normaliser
        const len = Math.sqrt(ax*ax + ay*ay + az*az);
        ax /= len; ay /= len; az /= len;
        const angle = rng() * 2 * PI;
        return { ax, ay, az, angle };
    });
}

// Point d'entrée principal
// features[] → features[] (deep clone, original non muté)
export function tectoniqueTransformer(features, seed) {
    const transforms = genererTransforms(seed);

    const octant = (x, y, z) =>
        (x >= 0 ? 4 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 1 : 0);

    const toXYZ = (lon, lat) => {
        const lo = lon * PI / 180, la = lat * PI / 180;
        return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    };

    const toLonLat = (x, y, z) => {
        const lat = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / PI;
        let lon = Math.atan2(x, z) * 180 / PI;
        if (lon >  180) lon -= 360;
        if (lon < -180) lon += 360;
        return [lon, lat];
    };

    const normaliserRingContinument = ring => {
        if (ring.length < 2) return ring;
        let prevLon = ring[0][0];
        for (let i = 1; i < ring.length; i++) {
            let lon = ring[i][0];
            while (lon - prevLon >  180) lon -= 360;
            while (prevLon - lon >  180) lon += 360;
            ring[i] = ring[i].length > 2
                ? [lon, ring[i][1], ring[i][2]]
                : [lon, ring[i][1]];
            prevLon = lon;
        }
        return ring;
    };

    // Segmente un ring par octant, applique la rotation propre à chaque groupe
    const transformerRing = ring => {
        if (ring.length < 2) return [ring];

        const groupes = [];
        let groupe = [ring[0]];
        let octCourant = octant(...toXYZ(ring[0][0], ring[0][1]));

        for (let i = 1; i < ring.length; i++) {
            const pt  = ring[i];
            const oct = octant(...toXYZ(pt[0], pt[1]));
            if (oct !== octCourant) {
                groupe.push(pt);
                groupes.push({ oct: octCourant, pts: groupe });
                groupe     = [pt];
                octCourant = oct;
            } else {
                groupe.push(pt);
            }
        }
        if (groupe.length >= 2) groupes.push({ oct: octCourant, pts: groupe });

        return groupes
            .filter(g => g.pts.length >= 2)
            .map(g => {
                const { ax, ay, az, angle } = transforms[g.oct];
                const transformé = g.pts.map(pt => {
                    const [x, y, z]     = toXYZ(pt[0], pt[1]);
                    const [rx, ry, rz]  = rodrigues(x, y, z, ax, ay, az, angle);
                    const [lon, lat]    = toLonLat(rx, ry, rz);
                    return pt.length > 2 ? [lon, lat, pt[2]] : [lon, lat];
                });
                return normaliserRingContinument(transformé);
            });
    };

    return features.map(feat => {
        if (!feat.geometry) return feat;
        const g = feat.geometry;
        if (g.type === 'Polygon') {
            return { ...feat, geometry: { ...g, coordinates: g.coordinates.flatMap(transformerRing) } };
        }
        if (g.type === 'MultiPolygon') {
            return { ...feat, geometry: { ...g, coordinates: g.coordinates.map(poly => poly.flatMap(transformerRing)) } };
        }
        return feat;
    });
}
