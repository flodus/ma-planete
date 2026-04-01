// src/views/LigneScan.jsx — ligne de scan animée (overlay DOM, pas Three.js)
import React, { useEffect, useRef } from 'react';

export default function LigneScan({ couleur = '#00e5ff' }) {
  const ligneRef = useRef();

  useEffect(() => {
    let raf;
    const depart = performance.now();
    const animer = () => {
      const t = (performance.now() - depart) % 4000 / 4000;
      if (ligneRef.current) ligneRef.current.style.top = `${t * 100}%`;
      raf = requestAnimationFrame(animer);
    };
    raf = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
      <div ref={ligneRef} style={{
        position: 'absolute', left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent 0%, ${couleur} 30%, ${couleur} 70%, transparent 100%)`,
        boxShadow: `0 0 12px ${couleur}, 0 0 4px ${couleur}`,
        opacity: 0.45,
      }} />
    </div>
  );
}
