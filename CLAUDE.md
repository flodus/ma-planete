# CLAUDE.md — ma-planete (proto WorldMap)

> Proto isolé — aucun import croisé avec ~/aria-llm-council/
> Langue de travail : français. Commentaires et variables en français.

## Contexte

Bac à sable pour explorer la carte 3D d'ARIA.
Navigation à 3 niveaux : GlobeView → MercatorView → WarRoomView.
Les décisions d'architecture sont dans `aria_worldmap_context.md` (à la racine d'ARIA).

## Stack

- React 19 + Vite
- Three.js + @react-three/fiber + @react-three/drei
- GeoJSON dans `/public/` — ne jamais déplacer
- Styles inline uniquement — pas de CSS modules

## Commandes

```bash
npm run dev      # http://localhost:5174 (5173 pris par ARIA)
npm run build
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/App.jsx` | Navigation entre les 3 vues + état global |
| `src/views/GlobeView.jsx` | Sphère 3D rotative (shader procédural ou GeoJSON) |
| `src/views/MercatorView.jsx` | Planisphère plat, pays cliquables |
| `src/views/WarRoomView.jsx` | Fond néon, burger → CountryPanel |
| `src/components/canvas/` | Composants Three.js originaux — garder intacts |
| `public/countries.geo.json` | GeoJSON monde global |

## Règles

- Ne jamais modifier les fichiers dans `src/components/canvas/` — ce sont les originaux de référence
- Les vues vont dans `src/views/`, les nouveaux composants dans `src/components/`
- Un chantier = une branche git
- `npm run build` doit passer avant tout commit
