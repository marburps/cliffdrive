// 01-config.js — Configuration and tuning constants
// Split from main.js (lines 1–61); keep load order in index.html.

const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
// CVW/CVH = true canvas pixel size. W/H = CURRENT VIEWPORT size — they are
// switched per player before each viewport render (H = CVH/2 in 2-player
// split-screen), so every draw call auto-scales to its half of the screen.
let CVW, CVH;
let W, H;
function resize(){
  CVW=canvas.width=innerWidth; CVH=canvas.height=innerHeight;
  W=CVW; H=Math.floor(CVH/2);
}
resize();addEventListener('resize',resize);
const overlay=document.getElementById('overlay');
let started=false, gameOver=false;

const ROAD_LEN=6000,SEG_LEN=200,ROAD_HALF=2400,DRAW_DIST=150;
const CURVE_K=0.005;
const CLIFF_HEIGHT_RATIO=14;
const HILL_HEIGHT_RATIO=2.8;
const TREE_TYPES=[0,4,5];
const BRAKE=10000;
const DRAG=0.05;
const DOWNSHIFT_DECEL=8000;
const ENGINE_HP=450;
const MAX_ACCEL=2800;
const ELEVATION = 16;
const CURVE_SHARPNESS = 5; // how sharp tha sharpest bends turn
// ── steering model (free body) ─────────────────────────────────────
// The car's heading is its own state: it changes ONLY from steering
// input and the car's own speed. No road/segment value steers the car.
const STEER_K = 0.00004; // car rotation: carHeading += steer · STEER_K · vW · dt
const PHYS_K  = 0.000005;
const CENTRIFUGAL_SPEED_REF   = 100; // speed where the old PHYS_K feels balanced (~100 km/h)
const CENTRIFUGAL_SPEED_SCALE = 2.0;   // 0 = old behavior, 1 = 2× centrifugal effect at max speed
const MAX_HEADING = 0.7; // safety cap on the camera's angle difference
const OVERSTEER = 0.5;
const BILLBOARD_TEXT = "X-LAN RACE"; // billboard text, max 10 chars

// ── RACE / LAP STATE ──
const TRACK_LENGTH = ROAD_LEN * SEG_LEN; // 1,200,000 units = 12 km
const TOTAL_LAPS = 3;
const START_OFFSET_UNITS = 20 * 100; // car starts 20 m BEFORE the start/finish line (100 units = 1 m)
const START_POS = TRACK_LENGTH - START_OFFSET_UNITS;
let raceGo = false; // shared start: true once the green light is up (timer armed)
// lapCount / lapTimes / currentLapStart / raceStarted / raceFinished /
// prevCompletedLaps are per-player now → see players[] in 04-state.js

// ── START LIGHTS ──
// 4 red lights (one per second), then the 5th turns green.
const LIGHT_STEP_MS = 1000;
const LIGHT_GO_MS = 4 * LIGHT_STEP_MS;
let lightsPhase = 'idle'; // 'idle' | 'countdown' | 'go' | 'foul'
let lightsStartT = 0;

function lightState(){
  if(lightsPhase==='foul') return {red:4, green:false};
  if(lightsPhase==='go')   return {red:4, green:true};
  if(lightsPhase==='countdown'){
    const t = performance.now() - lightsStartT;
    return {red:Math.max(0, Math.min(4, Math.floor(t / LIGHT_STEP_MS) + 1)), green:false};
  }
  return {red:0, green:false};
}

function startLights(){
  lightsPhase = 'countdown';
  lightsStartT = performance.now();
  raceGo = false;
  for(const pl of players) pl.currentLapStart = 0;
}

function advanceLights(){
  if(lightsPhase !== 'countdown') return;
  if (fouled) return;
  if (performance.now() - lightsStartT >= LIGHT_GO_MS) {
    lightsPhase = 'go';
    raceGo = true;
    const now = performance.now();           // timer starts on green (per player)
    for(const pl of players) pl.currentLapStart = now;
  }
}

// ── TUNNELS: entry positions in game units (100000 units = 1 km).
//    Every tunnel shares the same length and layout. ──
const TUNNELS = [
  100000,   // 1 km
  600000,   // 6 km
  800000,   // 8 km
];
const TUNNEL_LEN = 10000;              // 100 m each
const TUNNEL_WALL_SIDE = 4.2;
const TUNNEL_CEILING_H = 3.2;
const TUNNEL_LIGHT_SPACING = 4;



function getEngineAccel(rpm,gear){
  if(rpm>=3000)return MAX_ACCEL;
  const floor=[1500,1500,800,400,30,0][gear-1];
  const t=Math.max(0,(rpm-500)/2500);
  const s=t*t*(3-2*t);
  return floor+s*(MAX_ACCEL-floor)/3.5;
}

// ── TWO-PLAYER GRID ───────────────────────────────────────────
// 4 lanes (normalized, road half-width = 1): oncoming left 2, player right 2.
// P1 (top) starts in lane 3 (2nd from the right), P2 (bottom) in lane 4
// (rightmost drivable lane — the hard off-road edge is at ±0.6).
const P1_START_LANE = 0.21;   // center of lane 3 (inner right lane, spans 0..0.42)
const P2_START_LANE = 0.51;   // center of lane 4 (outer right lane, usable 0.42..0.6)
const P1_CAR_COLOR = [236, 64, 64];    // player 1's car, as seen by player 2
const P2_CAR_COLOR = [64, 132, 236];   // player 2's car, as seen by player 1
const CARCAR_LATERAL_HIT = 0.15;       // player-vs-player lateral overlap (normalized; ~car width, keeps the 0.25 grid gap bump-free)
const CARCAR_DAMAGE = 10;              // % damage each car takes on player contact
let players = [];                      // [P1, P2] — built in 05-audio.js (after the audio factories load)

// ── ONCOMING TRAFFIC ───────────────────────────────────────────
// 4 lanes: player drives the right 2, oncoming traffic the left 2.
const ONC_SPEED=10000;                     // 100 km/h relative to the ROAD (dash: speed/100 = km/h)
const ONC_LANES=[-0.25,-0.7];              // left 2 lane centers (right of center = player side)
const ONC_SPAWN_AHEAD=DRAW_DIST*SEG_LEN;   // spawn at the draw limit ahead of the FIELD (frontmost player) → small in the distance, grows in
const ONC_BEHIND_CULL=16*SEG_LEN;          // drop a car once it is fully behind the rearview glass
const ONC_COLORS=[[200,48,44],[48,92,190],[222,224,232],[42,44,52],[212,160,52],[52,152,92]];
const ONC_CAR_HIT_HALF=400;                  // swept hitbox: half a car length (100 units = 1 m)
const ONC_LATERAL_HIT=0.30;                  // lateral (lane) overlap for a collision, normalized
const ONC_COLLISION_DAMAGE=30;               // % damage taken when hitting an oncoming car
let oncoming=[];                           // {pos, lane, col} — pos in absolute track units
let oncomingIn=12;                         // seconds (after green) until the first oncoming car

