// hooks/useGlobeOrbit.js — drag + inertie + zoom globe
import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CURSEUR_GRAB, CURSEUR_GRABBING } from '../utils/curseurs.js'

export function useGlobeOrbit(groupRef, actif) {
  const { gl, camera } = useThree()
  const state = useRef({ dragging:false, velY:0, velX:0, lastX:0, lastY:0 })
  useEffect(()=>{
    if(!actif) return
    const el=gl.domElement
    const s=state.current
    const dn=e=>{s.dragging=true;s.lastX=e.clientX;s.lastY=e.clientY;el.style.cursor=CURSEUR_GRABBING;}
    const mv=e=>{
      if(!s.dragging)return
      s.velY+=(e.clientX-s.lastX)*0.007
      s.velX+=(e.clientY-s.lastY)*0.004
      s.lastX=e.clientX; s.lastY=e.clientY
    }
    const up=()=>{s.dragging=false;el.style.cursor=CURSEUR_GRAB;}
    const wh=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.01,3.5,14);}
    el.style.cursor=CURSEUR_GRAB
    el.addEventListener('mousedown',dn); window.addEventListener('mousemove',mv)
    window.addEventListener('mouseup',up); el.addEventListener('wheel',wh,{passive:true})
    return ()=>{
      el.style.cursor=''
      el.removeEventListener('mousedown',dn); window.removeEventListener('mousemove',mv)
      window.removeEventListener('mouseup',up); el.removeEventListener('wheel',wh)
    }
  },[gl,camera,actif])
  return state
}
