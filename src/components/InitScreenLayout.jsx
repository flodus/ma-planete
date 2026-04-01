// src/components/InitScreenLayout.jsx
//
// Conteneur réutilisable pour l'écran d'init.
// Accepte un fond optionnel (background) positionné en absolu derrière le contenu.

export default function InitScreenLayout({ children, background }) {
  if (!background) return children;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {background}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
