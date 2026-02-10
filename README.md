# 🌲 Forest Hunter 3D (Orman Avcısı)

A first-person 3D forest survival game built with **Three.js**. Wolves and rabid dogs charge at you through a dark, foggy forest — aim, shoot, and survive!

## 🎮 Features

- 🌲 **Full 3D environment** — procedurally generated forest with trees, moonlight, atmospheric fog
- 🔫 **Realistic FPS gun model** — detailed 3D pistol with barrel, slide, grip, hand, iron sights, and green dot sight
- � **Pointer Lock FPS controls** — true mouse-captured FPS aiming with smooth yaw/pitch
- 🔭 **Aim Down Sights (ADS)** — right-click for zoomed precision aiming (FOV 70→40)
- 🐺 **4 enemy types** — wolves, alpha wolves, rabid dogs, and big rabid dogs
- � **Combat effects** — muzzle flash, recoil, screen shake, shell casings
- 🌊 **Wave system** — escalating difficulty with more and faster enemies each wave
- 🎵 **Procedural audio** — all sounds generated via Web Audio API
- 🏆 **Score & combo system** — chain kills for multiplied points

## 🐺 Enemy Types

| Type | Speed | HP | Points | Behavior |
|------|-------|----|--------|----------|
| 🐺 Kurt (Wolf) | Medium | 2 | 200 | Zigzag approach |
| 🐺 Alfa Kurt (Alpha Wolf) | Slow | 4 | 400 | Large, tanky, zigzags |
| � Kuduz Köpek (Rabid Dog) | Fast | 1 | 100 | Direct charge, foam |
| � Büyük Kuduz Köpek | Medium | 2 | 180 | Larger, foam effects |

## 🕹️ Controls

| Input | Action |
|-------|--------|
| 🖱️ Mouse Move | Look around (FPS camera) |
| 🖱️ Left Click | Shoot |
| 🖱️ Right Click (Hold) | Aim Down Sights (zoom) |
| ⌨️ R | Reload |
| Esc | Release mouse cursor |

## 🚀 How to Run

```bash
cd forest-hunter
npx serve . -l 3000

# Open http://localhost:3000 in your browser
```

## 🛠️ Tech Stack

- **Three.js r128** — 3D rendering, lighting, fog, shadows
- **HTML5 Canvas** — 2D HUD overlay (health, ammo, score, crosshair)
- **Vanilla JavaScript** — game engine, AI, wave system
- **Web Audio API** — procedural sound effects
- **Pointer Lock API** — FPS-style mouse capture
- **Google Fonts** — Orbitron, Russo One, Inter

## 📁 Project Structure

```
forest-hunter/
├── index.html      # Entry point, loads Three.js + game
├── style.css       # Fullscreen layout, HUD overlay styling
├── game3d.js       # Complete 3D game engine (~800 lines)
└── README.md
```

## License

MIT
