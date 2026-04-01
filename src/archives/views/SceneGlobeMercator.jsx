// src/views/SceneGlobeMercator.jsx — globe + planisphère (s'utilise dans un Canvas)
// Approche identique à GlobeView.jsx + MercatorView.jsx, étendue à 10 pays
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const RAYON = 2;
const PI    = Math.PI;

const PAYS = {
  france:    { couleur:'#ff0d8c', NAME:'France',                   mainland:[-5.5,41.0,9.6,51.2],   bbox:[-5.5,41.0,9.6,51.2]   },
  usa:       { couleur:'#7319ff', NAME:'United States of America',  mainland:[-125,24,-66,50],       bbox:[-125,24,-66,50]        },
  chine:     { couleur:'#ff2626', NAME:'China',                    mainland:null,                   bbox:[73.5,18.2,135.1,53.5]  },
  russie:    { couleur:'#a633ff', NAME:'Russia',                   mainland:null,                   bbox:[27.3,41.2,190,77.7]    },
  bresil:    { couleur:'#26ff4d', NAME:'Brazil',                   mainland:null,                   bbox:[-73.1,-33.8,-29.3,5.3] },
  inde:      { couleur:'#ff8000', NAME:'India',                    mainland:null,                   bbox:[68.1,7.9,97.4,35.7]    },
  allemagne: { couleur:'#ffcc00', NAME:'Germany',                  mainland:null,                   bbox:[6.0,47.2,15.1,55.1]    },
  japon:     { couleur:'#ff00bf', NAME:'Japan',                    mainland:null,                   bbox:[122.9,24.2,145.8,45.5] },
  nigeria:   { couleur:'#d9ff00', NAME:'Nigeria',                  mainland:null,                   bbox:[2.7,4.3,14.7,13.9]     },
  arabie:    { couleur:'#e6bf1a', NAME:'Saudi Arabia',             mainland:null,                   bbox:[34.6,16.4,55.7,32.2]   },
};

// ─── Shaders (identiques à GlobeView / MercatorView) ─────────────────────────

const vertSphere = `
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r   = uRadius + 0.03;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(
    r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon), 1.0
  );
}`;

const vertSphereRempli = `
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r   = uRadius + 0.01;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(
    r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon), 1.0
  );
}`;

const vertPlan = `
uniform float uRadius;
void main() {
  float x = position.x / 180.0 * (uRadius * 3.14159265);
  float y = position.y / 90.0  * (uRadius * 3.14159265 / 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.06, 1.0);
}`;

const vertRempliPlan = `
uniform float uRadius;
void main() {
  float x = position.x / 180.0 * (uRadius * 3.14159265);
  float y = position.y / 90.0  * (uRadius * 3.14159265 / 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.03, 1.0);
}`;

const fragMonde = `void main(){ gl_FragColor = vec4(0.02, 0.45, 0.65, 0.28); }`;

// Fragment shaders néons — générés depuis couleur hex, avec phase décalée par pays
function hexVec(hex) {
  return [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)]
    .map(h => (parseInt(h,16)/255).toFixed(3)).join(',');
}
const FRAG_NEON = Object.fromEntries(
  Object.entries(PAYS).map(([id, cfg], i) => [id,
    `uniform float uTime; void main(){ float p=0.8+0.2*sin(uTime*2.4+${(i*0.5).toFixed(2)}); gl_FragColor=vec4(${hexVec(cfg.couleur)},p); }`
  ])
);
const FRAG_NEON_FILL = Object.fromEntries(
  Object.entries(PAYS).map(([id, cfg], i) => [id,
    `uniform float uTime; void main(){ float p=0.18+0.07*sin(uTime*2.4+${(i*0.5).toFixed(2)}); gl_FragColor=vec4(${hexVec(cfg.couleur)},p); }`
  ])
);

// ─── Texture de fond ─────────────────────────────────────────────────────────
function creerTexture() {
  const c = document.createElement('canvas'); c.width=1024; c.height=512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(512,256,10,512,256,620);
  g.addColorStop(0,'#0e1a40'); g.addColorStop(1,'#03040c');
  ctx.fillStyle=g; ctx.fillRect(0,0,1024,512);
  ctx.strokeStyle='rgba(0,180,255,0.06)'; ctx.lineWidth=0.5;
  for(let i=0;i<1024;i+=32){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i/2);ctx.lineTo(1024,i/2);ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// ─── Extraction GeoJSON ───────────────────────────────────────────────────────
function extraireSegments(features, mainland) {
  const pts = [];
  const ajouterRing = ring => {
    if (mainland) {
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length;
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
    }
    for(let i=0;i<ring.length-1;i++)
      pts.push(new THREE.Vector3(ring[i][0],ring[i][1],0),
               new THREE.Vector3(ring[i+1][0],ring[i+1][1],0));
  };
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    if     (g.type==='LineString')      ajouterRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing);
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing);
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing));
  });
  return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
}

function extraireRemplissage(features, mainland) {
  const pos = [];
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return;
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    polys.forEach(poly=>{
      if(!poly.length||poly[0].length<4) return;
      if(mainland){
        let sx=0,sy=0; poly[0].forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=poly[0].length; sy/=poly[0].length;
        if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return;
      }
      try{
        const contour=poly[0].map(p=>new THREE.Vector2(p[0],p[1]));
        const holes=poly.slice(1).map(h=>h.map(p=>new THREE.Vector2(p[0],p[1])));
        THREE.ShapeUtils.triangulateShape(contour,holes).forEach(tri=>
          tri.forEach(idx=>pos.push(contour[idx].x,contour[idx].y,0))
        );
      }catch(_){}
    });
  });
  if(!pos.length) return null;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
  return geo;
}

// ─── Hook drag + zoom (mercator) ──────────────────────────────────────────────
function useDragZoom(groupRef) {
  const { gl, camera } = useThree();
  useEffect(()=>{
    const el=gl.domElement;
    let on=false, ox=0, oy=0;
    const dn=e=>{on=true;ox=e.clientX;oy=e.clientY;el.style.cursor='grabbing';};
    const mv=e=>{
      if(!on||!groupRef.current) return;
      const f=camera.position.z*0.002;
      groupRef.current.position.x+=(e.clientX-ox)*f;
      groupRef.current.position.y-=(e.clientY-oy)*f;
      ox=e.clientX; oy=e.clientY;
    };
    const up=()=>{on=false;el.style.cursor='grab';};
    const wh=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.02,2,30);};
    el.style.cursor='grab';
    el.addEventListener('mousedown',dn); window.addEventListener('mousemove',mv);
    window.addEventListener('mouseup',up); el.addEventListener('wheel',wh,{passive:true});
    return()=>{
      el.style.cursor='';
      el.removeEventListener('mousedown',dn); window.removeEventListener('mousemove',mv);
      window.removeEventListener('mouseup',up); el.removeEventListener('wheel',wh);
    };
  },[gl,camera,groupRef]);
}

// ─── Globe 3D ─────────────────────────────────────────────────────────────────
function SphereGlobe({ geoData, onSurvol }) {
  const texture = useMemo(()=>creerTexture(),[]);
  const uMonde  = useMemo(()=>({uRadius:{value:RAYON}}),[]);

  const uPays = useRef(null);
  if(!uPays.current){
    uPays.current={};
    Object.keys(PAYS).forEach((id,i)=>{
      uPays.current[id]={uRadius:{value:RAYON},uTime:{value:i*0.5}};
    });
  }

  const geos = useMemo(()=>{
    if(!geoData) return {};
    const features=geoData.features;
    return {
      monde: extraireSegments(features,null),
      ...Object.fromEntries(Object.entries(PAYS).map(([id,cfg])=>[
        id, extraireSegments(features.filter(f=>f.properties?.NAME===cfg.NAME), cfg.mainland)
      ])),
    };
  },[geoData]);

  useFrame((_,delta)=>{
    Object.values(uPays.current).forEach(u=>{u.uTime.value+=delta;});
  });

  // Détection pays sous le curseur
  const dernierPays = useRef(null);
  const detecter = e => {
    const pt=e.point.clone().normalize();
    const lat=Math.asin(THREE.MathUtils.clamp(pt.y,-1,1))*(180/PI);
    const lon=Math.atan2(pt.x,pt.z)*(180/PI);
    const t=Object.entries(PAYS).find(([,c])=>{
      const[l,b,r,t]=c.bbox; return lon>=l&&lon<=r&&lat>=b&&lat<=t;
    });
    return t ? PAYS[t[0]].NAME : null;
  };
  const handleSurvol = e=>{
    e.stopPropagation();
    const name=detecter(e);
    if(name!==dernierPays.current){ dernierPays.current=name; onSurvol(name); }
  };

  return (
    <>
      <OrbitControls makeDefault enablePan={false}/>
      <mesh renderOrder={0}>
        <sphereGeometry args={[RAYON,64,32]}/>
        <meshBasicMaterial map={texture}/>
      </mesh>
      {geos.monde&&(
        <lineSegments geometry={geos.monde} renderOrder={2}>
          <shaderMaterial vertexShader={vertSphere} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false}/>
        </lineSegments>
      )}
      {/* Néons pays — même vertex shader que les frontières (collés aux bordures)
          depthTest=true (défaut) → la sphère opaque cache le dos du globe */}
      {Object.entries(PAYS).map(([id])=>geos[id]&&(
        <lineSegments key={id} geometry={geos[id]} renderOrder={5}>
          <shaderMaterial vertexShader={vertSphere} fragmentShader={FRAG_NEON[id]}
            uniforms={uPays.current[id]} transparent depthWrite={false}/>
        </lineSegments>
      ))}
      <mesh
        onClick={e=>{e.stopPropagation();onSurvol(detecter(e));}}
        onPointerMove={handleSurvol}
        onPointerLeave={()=>{dernierPays.current=null;onSurvol(null);}}>
        <sphereGeometry args={[RAYON+0.05,32,32]}/>
        <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
      </mesh>
    </>
  );
}

// ─── Planisphère Mercator ─────────────────────────────────────────────────────
function PlanMercator({ geoData, onSurvolMercator, onEntrerMercator }) {
  const groupRef = useRef();
  const texture  = useMemo(()=>creerTexture(),[]);
  const uMonde   = useMemo(()=>({uRadius:{value:RAYON}}),[]);

  const uPays = useRef(null);
  if(!uPays.current){
    uPays.current={};
    Object.keys(PAYS).forEach((id,i)=>{
      uPays.current[id]={uRadius:{value:RAYON},uTime:{value:i*0.5}};
    });
  }

  const geos = useMemo(()=>{
    if(!geoData) return {};
    const features=geoData.features;
    return {
      monde: extraireSegments(features,null),
      ...Object.fromEntries(Object.entries(PAYS).flatMap(([id,cfg])=>{
        const feat=features.filter(f=>f.properties?.NAME===cfg.NAME);
        return [
          [id,          extraireSegments(feat,cfg.mainland)],
          [id+'Fill',   extraireRemplissage(feat,cfg.mainland)],
        ];
      })),
    };
  },[geoData]);

  const { camera } = useThree();
  // Zoom initial pour voir le planisphère entier comme une carte murale
  useEffect(()=>{ camera.position.setZ(RAYON*4.5); },[]);

  useDragZoom(groupRef);
  useFrame((_,delta)=>{
    Object.values(uPays.current).forEach(u=>{u.uTime.value+=delta;});
  });

  return (
    <group ref={groupRef}>
      <mesh renderOrder={0}>
        <planeGeometry args={[RAYON*2*PI, RAYON*PI]}/>
        <meshBasicMaterial map={texture}/>
      </mesh>
      {geos.monde&&(
        <lineSegments geometry={geos.monde} renderOrder={2}>
          <shaderMaterial vertexShader={vertPlan} fragmentShader={fragMonde}
            uniforms={uMonde} transparent depthWrite={false}/>
        </lineSegments>
      )}
      {/* Remplissages néon par pays (faible opacité) */}
      {Object.entries(PAYS).map(([id])=>geos[id+'Fill']&&(
        <mesh key={id+'Fill'} geometry={geos[id+'Fill']} renderOrder={3}>
          <shaderMaterial vertexShader={vertRempliPlan} fragmentShader={FRAG_NEON_FILL[id]}
            uniforms={uPays.current[id]} transparent depthWrite={false} side={THREE.DoubleSide}/>
        </mesh>
      ))}
      {/* Néons frontières pays */}
      {Object.entries(PAYS).map(([id])=>geos[id]&&(
        <lineSegments key={id} geometry={geos[id]} renderOrder={5}>
          <shaderMaterial vertexShader={vertPlan} fragmentShader={FRAG_NEON[id]}
            uniforms={uPays.current[id]} transparent depthTest={false} depthWrite={false}/>
        </lineSegments>
      ))}
      {/* Hitboxes clic / double-clic */}
      {Object.entries(PAYS).map(([id,cfg])=>{
        const[l,b,r,t]=cfg.bbox;
        const cx=((l+r)/2)/180*RAYON*PI, cy=((b+t)/2)/90*RAYON*PI/2;
        const w=Math.abs(r-l)/180*RAYON*PI, h=Math.abs(t-b)/90*RAYON*PI/2;
        return(
          <mesh key={id} position={[cx,cy,0.3]}
            onClick={e=>{e.stopPropagation();onSurvolMercator(cfg.NAME);}}
            onDoubleClick={e=>{e.stopPropagation();onEntrerMercator(id);}}>
            <planeGeometry args={[w,h]}/>
            <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function SceneGlobeMercator({
  geoData, isPlanar, paysSurvolé,
  onClickGlobe, onSurvolMercator, onEntrerMercator,
}) {
  if(isPlanar) return(
    <PlanMercator
      geoData={geoData}
      paysSurvolé={paysSurvolé}
      onSurvolMercator={onSurvolMercator}
      onEntrerMercator={onEntrerMercator}
    />
  );
  return(
    <SphereGlobe
      geoData={geoData}
      paysSurvolé={paysSurvolé}
      onSurvol={onClickGlobe}
    />
  );
}
