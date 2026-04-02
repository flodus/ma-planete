# ma-planete

Prototype de visualisation géopolitique — globe 3D, planisphère et monde procédural.

**[→ Démo live](https://flodus.github.io/ma-planete)**

---

## Vues

### Globe & Planisphère
Globe interactif avec morphing animé vers une projection Mercator plate.
Les 10 pays du jeu ARIA sont mis en valeur avec des néons colorés pulsants.
- Double-clic sur le globe → bascule en planisphère
- Clic sur un pays → sélection / survol
- Double-clic sur un pays en planisphère → War Room

### War Room
Vue zoomée sur un pays sélectionné avec néon + ligne de scan couleur pays.
Filtrage mainland pour France, USA, Russie (exclut les territoires d'outre-mer).

### Monde Fictif
Carte isométrique hexagonale générée procéduralement.
Terrains, reliefs, océans avec profondeur, royaumes nommés aléatoirement.

### Radio
Lecteur audio intégré avec stations prédéfinies et support de playlists/MP3 personnalisés (persistés en localStorage).

---

## Stack

- **React 19** + **Vite**
- **Three.js** / **@react-three/fiber** / **@react-three/drei**
- Shaders GLSL custom (morphing sphère↔mercator, néons, scan)
- GeoJSON Natural Earth (110m / 50m / 10m)
- Styles inline uniquement — pas de CSS modules

## Lancer en local

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # build de production
```

---

Prototype intégré dans [ARIA](https://github.com/flodus/aria-llm-council) — simulation de gouvernance multi-LLM.
