// hooks/useMercatorZoom.js — zoom molette en vue mercator
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function useMercatorZoom(actif, zMin=3, zMax=60) {
  const { gl, camera } = useThree()
  useEffect(()=>{
    if(!actif) return
    const el=gl.domElement
    const wh=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*0.02,zMin,zMax);}
    el.addEventListener('wheel',wh,{passive:true})
    return ()=>{ el.removeEventListener('wheel',wh) }
  },[gl,camera,actif,zMin,zMax])
}
