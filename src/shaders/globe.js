// shaders/globe.js — constantes shaders + texture fond cyber
import * as THREE from 'three'

export const RAYON = 2
export const PI    = Math.PI

export const lineVertexShader = `
uniform float uTransition;
uniform float uRadius;
void main() {
  float lon = position.x * (3.14159265 / 180.0);
  float lat = position.y * (3.14159265 / 180.0);
  float r = uRadius + 0.08;
  vec3 sphere = vec3(r*cos(lat)*sin(lon), r*sin(lat), r*cos(lat)*cos(lon));
  vec3 plane  = vec3(
    position.x / 180.0 * (uRadius * 3.14159265),
    position.y / 90.0  * (uRadius * 3.14159265 / 2.0),
    0.06);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(sphere, plane, uTransition), 1.0);
}`

export const fragMonde = `void main() { gl_FragColor = vec4(0.03, 0.55, 0.80, 0.40); }`

export const fondVertexShader = `
uniform float uTransition; uniform float uRadius; varying vec2 vUv;
void main(){
  vUv=uv;
  float lon=(uv.x*2.0-1.0)*3.14159265; float lat=(uv.y-0.5)*3.14159265;
  vec3 sphere=vec3(uRadius*cos(lat)*sin(lon),uRadius*sin(lat),uRadius*cos(lat)*cos(lon));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(sphere,position,uTransition),1.0);
}`

export const fondFrag = `varying vec2 vUv; uniform sampler2D uTexture;
void main(){gl_FragColor=texture2D(uTexture,vUv);}`

// Néons avec morph sphère → mercator (utilise aPlane de extraireSegmentsNeon / useContoursFictifs)
export const neonMorphVert = `
attribute vec3 aPlane;
uniform float uTransition;
varying float vScan;
void main() {
  vScan = atan(position.x, position.z);
  vec3 pos = mix(position, aPlane, uTransition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`

// Néons — positions sphère pré-calculées, vScan = longitude
export const neonVertexShader = `
varying float vScan;
void main() {
  vScan = atan(position.x, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// Génère un fragment shader néon avec couleur et optionnellement uAlpha pour le fondu morph
export const neonFrag = (r, g, b, avecAlpha = false) =>
  `uniform float uTime; ${avecAlpha ? 'uniform float uAlpha;' : ''} varying float vScan;
void main(){ float p=clamp(0.25+0.15*sin(vScan-uTime*0.5),0.10,0.38); gl_FragColor=vec4(${r},${g},${b},p${avecAlpha ? '*uAlpha' : ''}); }`

export function creerTexture() {
  const c=document.createElement('canvas'); c.width=1024; c.height=512;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(512,256,10,512,256,620);
  g.addColorStop(0,'#060c1e'); g.addColorStop(1,'#02030a');
  ctx.fillStyle=g; ctx.fillRect(0,0,1024,512);
  ctx.strokeStyle='rgba(0,180,255,0.06)'; ctx.lineWidth=0.5;
  for(let i=0;i<1024;i+=32){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i/2);ctx.lineTo(1024,i/2);ctx.stroke();
  }
  return new THREE.CanvasTexture(c)
}
