# CliffDrive

A 2D top-down driving game built with HTML5 Canvas and vanilla JavaScript. No build step or dependencies required.

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
| `ArrowUp` | Accelerate |
| `ArrowDown` | Brake |
| `ArrowLeft` / `ArrowRight` | Steer |

## Project Structure

```
cliffdrive/
├── index.html      # Entry point, loads canvas and main script
├── css/
│   └── style.css   # Layout and canvas styling
├── js/
│   └── main.js     # Game loop, car physics, input handling, rendering
└── README.md
```

## State

Minimal playable core: a car you can drive around the canvas with basic acceleration, friction, and steering. Obstacles, camera scrolling, scoring, and a cliff-edge mechanic are planned next.
