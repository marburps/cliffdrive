# AGENTS.md

CliffDrive is a 2-player split-screen racing game: pure HTML5 Canvas + vanilla JS, ES2017+ browser globals, **no build step and no runtime dependencies**.

## Run it

There is no build, test, lint, or typecheck. The only commands are:

```bash
npx serve .          # then open http://localhost:3000
# or: python -m http.server 8000
```

`package.json` has only `serve` (dev convenience); there are **no `scripts`**. Verify changes by loading the page in a browser.

## Architecture (matters only if you change wiring)

- Global namespace, no modules: each `js/0X-*.js` declares `const`s/functions that later scripts read.
- **Load order in `index.html` is load-bearing.** Scripts run top-to-bottom and share globals, so a file reading a symbol must load after the file that defines it. `tracks/track1.js` (data) → `js/01-…08` (config→state→audio→update→render→hud) → loop starts in `js/08-hud.js`. Reorder or add a script and you must keep this dependency order correct.
- Entry point `index.html` loads everything; `js/08-hud.js` calls `requestAnimationFrame(loop)` at the end.
- `.split.js` is a **one-shot migration artifact** (old `main.js` → 8 files). Do not re-run it; it's already been applied.

## Track data

- Circuit data (GPS control points→curves, elevation profile, tunnel positions/lengths, laps, start line, billboards) lives in **`tracks/track1.js`** as a single `Track1` object.
- `tracks/track1.js` must load **before** `js/01-config.js` (config reads `Track1.*`) and before `js/02-track.js`.
- `js/01-config.js` re-exposes track values as the globals the game actually uses (`TUNNELS`, `TREE_TYPES`, `CURVE_SHARPNESS`, `TOTAL_LAPS`, `START_POS`, …); `js/02-track.js` builds the 6000-segment road from `Track1.gps` + `Track1.elevation`. Change values in the track file, not in the config file.
- Units: **100 units = 1 m, 100000 units = 1 km**; track = `ROAD_LEN * SEG_LEN` = 6000 * 200 = 12 km. Positions are absolute units from the start/finish line (segment 0), which wraps at `TRACK_LENGTH`.
