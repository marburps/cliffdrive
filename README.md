# CliffDrive

A 2D top-down racing game on a Nordschleife-style circuit, built as a **vibe coding test with qwen3.8:27b running locally on a laptop with an RTX 5080**. The entire game was prompted into existence conversationally — no build step, no dependencies, just HTML5 Canvas and vanilla JavaScript.

## How to Run

Open `index.html` directly in a browser, or serve the folder with a local server:

```bash
npx serve .
# or
python -m http.server 8000
```

Then visit `http://localhost:8000` (or the port shown by your server).

## Controls

| Key | Action |
| --- | ------ |
| `W` | Accelerate |
| `S` | Brake |
| `A` / `D` | Steer |
| `Q` | Shift down |
| `E` | Shift up |

Gamepad also supported: left stick steers, R2 gas, L2 brake, right stick shifts.

## Gameplay

- 12 km track with 42 corners and no guardrails — go off-road and you take damage
- At 100% damage, it's over
- Manual 6-speed gearbox: start in 1st and shift up as your speed grows
- Oncoming traffic on the track — keep out of its way
- Start lights, damage state, and dashboard HUD

## Project Structure

```
cliffdrive/
├── index.html      # Entry point, loads canvas and scripts
├── css/
│   └── style.css   # Layout and canvas styling
├── js/
│   ├── 01-config.js    # Tuning constants
│   ├── 02-track.js     # Track definition
│   ├── 03-hud-track.js # Track/HUD data
│   ├── 04-state.js     # Game state
│   ├── 05-audio.js     # Sound
│   ├── 06-update.js    # Game loop / physics
│   ├── 07-render.js    # Rendering
│   └── 08-hud.js       # Dashboard/HUD
└── README.md
```
