# Architecture — `src/`

## Vues — `src/views/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `ExplorateurMonde.jsx` | 790 ⚠️ | Vue principale. Globe ↔ Mercator morphé, clic pays, overlay WarRoom, scan line. Seule vue utilisée par App. |

## Composants — `src/components/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `RadioPlayer.jsx` | 385 | Lecteur radio persistant, stations par pays, toujours monté dans App. |
| `MorphingCanvas.jsx` | ~360 | Globe animé pendant le loading init, morph globe→mercator déclenché par `morphPret`. |
| `PlanetCanvas.jsx` | 229 | Canvas globe décoratif pour le fond de l'écran d'init. |
| `InitScreenLayout.jsx` | 19 | Wrapper HTML simple fond + enfant. |

## Composants Three.js — `src/components/canvas/`

| Fichier | Rôle |
|---|---|
| `WarRoomMap.jsx` | Carte planar néon, utilisée dans l'overlay WarRoom d'ExplorateurMonde — **ne pas modifier** |

## Utilitaires — `src/utils/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `worldGenerator.js` | 319 | Génère des données de monde fictif (noms, pays, stats) pour ARIA |
| `curseurs.js` | 8 | Constantes CSS curseur |

## Données / entry

| Fichier | Rôle |
|---|---|
| `src/data/defaultStations.json` | Stations radio par défaut |
| `App.jsx` (80L) | Routeur de phase : init → morph → globe |
| `main.jsx` | Point d'entrée React |

---

## Fichiers > 400 lignes — comment les découper

### `ExplorateurMonde.jsx` (~750L) — priorité si ça grossit

Découpage cible :

```
src/
├── hooks/
│   ├── useGlobeOrbit.js       # drag + inertie globe
│   └── useMercatorZoom.js     # zoom molette plan
├── shaders/
│   └── explorateurShaders.js  # toutes les const GLSL
└── views/
    ├── ExplorateurMonde.jsx   # orchestration + export (~200L)
    └── SceneGlobeMercator.jsx # composant Three.js (~150L)
```

### `RadioPlayer.jsx` (385L) — juste sous le seuil

À découper si ça grossit encore.
