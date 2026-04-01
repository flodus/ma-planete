// utils/geo.js — extraction géométrie GeoJSON, raycasting, couleur néon
import * as THREE from 'three'
import { RAYON, PI } from '../shaders/globe.js'

export function extraireSegments(features, mainland) {
  const pts = []
  const ajouterRing = ring => {
    if (mainland) {
      let sx=0,sy=0
      ring.forEach(p=>{sx+=p[0];sy+=p[1];})
      sx/=ring.length; sy/=ring.length
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return
    }
    for(let i=0;i<ring.length-1;i++){
      pts.push(ring[i][0],ring[i][1],0, ring[i+1][0],ring[i+1][1],0)
    }
  }
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return
    if(g.type==='LineString')          ajouterRing(g.coordinates)
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing)
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing)
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing))
  })
  if(!pts.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  return geo
}

export function extraireSegmentsNeon(features, mainland, r=RAYON+0.08) {
  const sphere=[], plane=[]
  const ajouterRing = ring => {
    if(mainland){
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return
    }
    for(let i=0;i<ring.length-1;i++){
      const la0=ring[i][1]*PI/180,   lo0=ring[i][0]*PI/180
      const la1=ring[i+1][1]*PI/180, lo1=ring[i+1][0]*PI/180
      sphere.push(r*Math.cos(la0)*Math.sin(lo0), r*Math.sin(la0), r*Math.cos(la0)*Math.cos(lo0),
                  r*Math.cos(la1)*Math.sin(lo1), r*Math.sin(la1), r*Math.cos(la1)*Math.cos(lo1))
      plane.push(ring[i][0]/180*RAYON*PI,   ring[i][1]/90*RAYON*PI/2,   0.06,
                 ring[i+1][0]/180*RAYON*PI, ring[i+1][1]/90*RAYON*PI/2, 0.06)
    }
  }
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return
    if(g.type==='LineString')          ajouterRing(g.coordinates)
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing)
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing)
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing))
  })
  if(!sphere.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sphere), 3))
  geo.setAttribute('aPlane',   new THREE.BufferAttribute(new Float32Array(plane),  3))
  return geo
}

export function extraireSegmentsWarRoom(features, mainland) {
  const pts = []
  const ajouterRing = ring => {
    if(mainland){
      let sx=0,sy=0; ring.forEach(p=>{sx+=p[0];sy+=p[1];}); sx/=ring.length; sy/=ring.length
      if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return
    }
    for(let i=0;i<ring.length-1;i++){
      const [lon0,lat0]=ring[i], [lon1,lat1]=ring[i+1]
      pts.push(lon0/180*RAYON*PI, lat0/90*RAYON*PI/2, lon0*PI/180,
               lon1/180*RAYON*PI, lat1/90*RAYON*PI/2, lon1*PI/180)
    }
  }
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return
    if(g.type==='LineString')          ajouterRing(g.coordinates)
    else if(g.type==='MultiLineString') g.coordinates.forEach(ajouterRing)
    else if(g.type==='Polygon')         g.coordinates.forEach(ajouterRing)
    else if(g.type==='MultiPolygon')    g.coordinates.forEach(p=>p.forEach(ajouterRing))
  })
  if(!pts.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
  return geo
}

export function bboxPlanPays(features, mainland) {
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity
  features.forEach(feat=>{
    const g=feat.geometry; if(!g) return
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]
    polys.forEach(p=>p.forEach(ring=>{
      if(mainland){
        let sx=0,sy=0; ring.forEach(pt=>{sx+=pt[0];sy+=pt[1];})
        sx/=ring.length; sy/=ring.length
        if(sx<mainland[0]||sx>mainland[2]||sy<mainland[1]||sy>mainland[3]) return
      }
      ring.forEach(pt=>{
        const x=pt[0]/180*RAYON*PI, y=pt[1]/90*RAYON*PI/2
        xMin=Math.min(xMin,x);xMax=Math.max(xMax,x)
        yMin=Math.min(yMin,y);yMax=Math.max(yMax,y)
      })
    }))
  })
  return { cx:(xMin+xMax)/2, cy:(yMin+yMax)/2, w:xMax-xMin, h:yMax-yMin }
}

export function pointDansRing(x, y, ring) {
  let inside = false
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j]
    if (((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside
  }
  return inside
}

export function trouverPays(lon, lat, features) {
  for (const f of features) {
    const g=f.geometry; if(!g) continue
    const polys = g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]
    for (const poly of polys)
      if (poly[0] && pointDansRing(lon, lat, poly[0])) return f
  }
  return null
}

export function couleurNeon(nom) {
  let h = 0
  for (let i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) & 0xffff
  // Éviter 165-265° (cyan / bleu proche du fond monde)
  const zones = [[0, 160], [270, 360]]
  const total = zones.reduce((s,[a,b])=>s+b-a, 0)
  let v = h % total, acc = 0, hue = 0
  for (const [a,b] of zones) {
    if (v < acc+(b-a)) { hue = a+(v-acc); break }
    acc += b-a
  }
  return new THREE.Color().setHSL(hue/360, 1.0, 0.55)
}
