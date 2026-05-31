# 🤿 Damien's Under the Sea Adventure

A first-person-ish 3D diving game built with [Babylon.js](https://www.babylonjs.com/). Dive from the surface to the seabed, swimming into rare species for points while dodging sharks and octopuses.

**[Play it here](https://aapearce.github.io/damiens-under-the-sea/)** • part of [Damien's Arcade](https://aapearce.github.io/damiens-arcade/)

## 🎮 How to play

- You **descend automatically** at a fixed speed from the surface to the seabed.
- **Steer into glowing species** to collect them for points.
- **Avoid the hazards** — a shark bite or octopus ink costs you points; the **2nd hit ends the dive** (restart from the top).
- Reach the **seabed** to win and earn a star rank.

| | Desktop | Mobile |
| --- | --- | --- |
| Steer left/right | ← → (or A/D) | move your finger |
| Adjust nearer/farther | ↑ ↓ (or W/S) | move your finger |

## 🐠 Scoring

| Species | Points |
| --- | --- |
| 🟠 Clownfish | 10 |
| 🔵 Lanternfish | 25 |
| 🟣 Jellyfish | 45 |
| 🟢 Golden Angler (rare) | 90 |

Plus a **Depth Bonus** (+40 at each 20% of the way down) and a **Flawless Bonus** at the seabed (+600 for a no-hit dive, +200 if you took one hit).

## ✨ Graphics

- Behind-the-diver 3D descent with **depth fog** that darkens blue→black as you sink.
- **God-ray light shafts** from the surface, **bloom** + a **glow layer** for bioluminescent species.
- A **dive torch** that brightens with depth, **bubble trails**, drifting **marine snow**, and a **caustic-lit seabed** payoff.

## 🛠️ Tech

- Babylon.js (CDN), vanilla ES modules, no build step.
- Leaderboard stored locally via `localStorage`.

```
index.html
style.css
js/
  main.js        # scene, environment, loop, spawning, collisions, scoring
  diver.js       # the diver model + descent
  creatures.js   # species + shark/octopus
  ui.js          # HUD, screens, leaderboard
  leaderboard.js # localStorage top-10
```

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
