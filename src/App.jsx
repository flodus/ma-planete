// src/App.jsx
import React, { useState, useRef, lazy, Suspense } from 'react';
const ExplorateurMonde    = lazy(() => import('./views/ExplorateurMonde').then(m => ({ default: m.ExplorateurMonde })))
const ExplorateurMondeFictif = lazy(() => import('./views/ExplorateurMondeFictif'))
import InitScreenLayout from './components/InitScreenLayout';
import PlanetCanvas from './components/PlanetCanvas';
import MorphingCanvas from './components/MorphingCanvas';
// InitScreenInner local — stub pour la démo (l'original est dans le repo ARIA)
function InitScreenInner({ worldName, setWorldName, onLaunchLocal, generatingBackground }) {
  const [progress, setProgress] = React.useState(0)
  const [lancé, setLancé] = React.useState(false)

  const handleLancer = () => {
    setLancé(true)
    onLaunchLocal() // déclenche morphPret immédiatement comme l'original
  }

  React.useEffect(() => {
    if (!lancé) return
    const id = setInterval(() => setProgress(p => { if (p >= 1) { clearInterval(id); return 1 } return p + 0.02 }), 40)
    return () => clearInterval(id)
  }, [lancé])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'100vh', gap:'32px', fontFamily:'monospace', color:'rgba(0,210,255,0.85)' }}>
      {lancé
        ? generatingBackground(progress)
        : <>
          <div style={{ fontSize:'0.75rem', letterSpacing:'0.35em', textTransform:'uppercase',
            color:'rgba(0,200,255,0.45)' }}>Ma Planète — prototype</div>
          <input value={worldName} onChange={e => setWorldName(e.target.value)}
            placeholder="Nom du monde"
            style={{ background:'rgba(0,15,35,0.8)', border:'1px solid rgba(0,200,255,0.25)',
              borderRadius:'4px', padding:'10px 18px', color:'rgba(0,210,255,0.85)',
              fontFamily:'monospace', fontSize:'0.9rem', letterSpacing:'0.08em', outline:'none', width:'240px' }}/>
          <button onClick={handleLancer}
            style={{ padding:'12px 36px', background:'rgba(0,15,35,0.9)',
              border:'1px solid rgba(0,200,255,0.4)', borderRadius:'4px',
              color:'rgba(0,210,255,0.9)', cursor:'pointer',
              fontFamily:'monospace', fontSize:'0.88rem', letterSpacing:'0.18em', textTransform:'uppercase' }}>
            Lancer
          </button>
        </>
      }
    </div>
  )
};
import RadioPlayer from './components/RadioPlayer'

// ─── Écran de choix monde ────────────────────────────────────────────────────

function EcranChoixMonde({ onReel, onFictif }) {
  const btnBase = {
    padding: '20px 44px', background: 'rgba(0,8,22,0.9)',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.95rem', fontFamily: 'monospace', letterSpacing: '0.18em',
    textTransform: 'uppercase',
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020208',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '32px' }}>
      <div style={{ color: 'rgba(0,200,255,0.5)', fontFamily: 'monospace',
        fontSize: '0.82rem', letterSpacing: '0.35em', textTransform: 'uppercase' }}>
        Choisir un monde
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        <button onClick={onReel} style={{ ...btnBase,
          border: '1px solid rgba(0,200,255,0.4)', color: 'rgba(0,210,255,0.9)' }}>
          Monde réel
        </button>
        <button onClick={onFictif} style={{ ...btnBase,
          border: '1px solid rgba(120,80,200,0.5)', color: 'rgba(180,130,255,0.9)' }}>
          Monde fictif
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [worldName, setWorldName] = useState('');
  const [phase,     setPhase]     = useState('init');
  const [morphPret, setMorphPret] = useState(false);
  const [typeMonde, setTypeMonde] = useState(null);
  const overlayRef = useRef(null);

  const handleLancement = () => {
    setMorphPret(true);
  };

  const handleMorphFini = () => {
    setPhase('attente');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'opacity 0.85s ease';
        overlayRef.current.style.opacity = '0';
      }
    }));
    setTimeout(() => setPhase('globe'), 3000);
  };

  // Le contenu principal change selon la phase
  const getMainContent = () => {
    if (phase === 'globe') {
      if (typeMonde === null)
        return <EcranChoixMonde onReel={() => setTypeMonde('reel')} onFictif={() => setTypeMonde('fictif')} />;
      if (typeMonde === 'fictif')
        return <ExplorateurMondeFictif seed={42} onMondeReel={() => setTypeMonde(null)} />;
      return <ExplorateurMonde initialVue="globe" />;
    }
    if (phase === 'attente') {
      return (
        <>
        <ExplorateurMonde initialVue="mercator" sansTransition />
        <div ref={overlayRef} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(2,2,8,1)',
              opacity: 1,
              pointerEvents: 'none',
        }} />
        </>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <InitScreenLayout background={<PlanetCanvas />}>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: '100vh' }}>
      <InitScreenInner
      worldName={worldName}
      setWorldName={setWorldName}
      onLaunchLocal={handleLancement}
      onLaunchAI={handleLancement}
      hasApiKeys={false}
      onRefreshKeys={() => {}}
      generatingBackground={(progress) => (
        <MorphingCanvas
        progress={progress}
        morphPret={morphPret}
        onMorphFini={handleMorphFini}
        />
      )}
      />
      </div>
      </InitScreenLayout>
      </div>
    );
  };

  return (
    <>
    <Suspense fallback={null}>
      {getMainContent()}
    </Suspense>
    <RadioPlayer />  {/* RadioPlayer est TOUJOURS monté */}
    </>
  );
}
