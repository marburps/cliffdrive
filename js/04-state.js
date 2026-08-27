// 04-state.js — Two players, gears, input, gamepads, start / restart, damage model
// 2-player split-screen: all per-car state lives on players[0]/players[1];
// P is the "active player" pointer set before each per-player update/render pass.

// ==========================================================
//  GEARBOX (shared constants)
// ==========================================================
const GEAR_MAX = [4000, 8000, 12000, 16000, 21000, 30000];
const GEAR_RPM_MIN = 800;
const GEAR_RPM_MAX = 8500;
const NUM_GEARS = 6;

// ==========================================================
//  PER-PLAYER STATE
// ==========================================================
let P = null;                     // active player (set around per-player passes)
const maxSpeed = 30000;

function generateCracks(){
  const crackSeeds = [];
  for(let i = 0; i < 8; i++){
    const pts = [];
    let cx = Math.random(), cy = Math.random() * 0.5;  // normalized 0..1 — scaled by the viewport at draw time
    let angle = Math.random() * Math.PI * 2;
    for(let s = 0; s < 5 + Math.floor(Math.random() * 5); s++){
      pts.push({x: cx, y: cy});
      angle += (Math.random() - 0.5) * 0.25;
      cx += Math.cos(angle) * (0.02 + Math.random() * 0.04);
      cy += Math.sin(angle) * (0.02 + Math.random() * 0.04);
    }
    crackSeeds.push(pts);
  }
  return crackSeeds;
}

function makePlayer(idx){
  return {
    idx: idx,
    name: 'P' + (idx + 1),
    spawnX: idx === 0 ? P1_START_LANE : P2_START_LANE,  // own grid lane = safe respawn lane
    carCol: idx === 0 ? P1_CAR_COLOR : P2_CAR_COLOR,    // own car's color, as seen by the other player

    // car physics
    playerX: idx === 0 ? P1_START_LANE : P2_START_LANE,
    playerAngle: 0, carHeading: 0, roadAngle: 0, horizonOffset: 0,
    speed: 0, position: START_POS, posBefore: START_POS, distance: 0,
    accel: 0, braking: 0, steer: 0,
    targetAccel: 0, targetBrake: 0, steerRaw: 0,
    crashTimer: 0, camShake: 0,

    // gearbox
    gear: 1, rpm: 800, shiftCooldown: 0, shiftFlash: 0,
    prevShiftUp: false, prevShiftDown: false,

    // damage
    damage: 0, prevPlayerX: idx === 0 ? P1_START_LANE : P2_START_LANE, lateralVel: 0,
    damageFlash: 0, damagePopups: [], crashReason: 'road',
    crackSeeds: [],
    wasInTunnel: false,

    // race progress
    lapCount: 0, lapTimes: [], currentLapStart: 0,
    raceStarted: false, raceFinished: false, prevCompletedLaps: 0,
    out: null,               // null | 'wrecked' | 'finished'
    carHitCd: 0,             // cooldown after a player-vs-player bump

    // audio (live instances attach in 05-audio.js once the players exist)
    engine: null, rumble: null,
  };
}

function resetToGrid(pl){
  pl.playerX = pl.spawnX;
  pl.playerAngle = 0; pl.carHeading = 0; pl.roadAngle = 0; pl.horizonOffset = 0;
  pl.speed = 0; pl.position = START_POS; pl.posBefore = START_POS; pl.distance = 0;
  pl.accel = 0; pl.braking = 0; pl.steer = 0;
  pl.targetAccel = 0; pl.targetBrake = 0; pl.steerRaw = 0;
  pl.crashTimer = 0; pl.camShake = 0;
  pl.gear = 1; pl.rpm = 800; pl.shiftCooldown = 0; pl.shiftFlash = 0;
  pl.prevShiftUp = false; pl.prevShiftDown = false;
  pl.damage = 0; pl.prevPlayerX = pl.spawnX; pl.lateralVel = 0;
  pl.damageFlash = 0; pl.damagePopups = []; pl.crashReason = 'road';
  pl.crackSeeds = generateCracks(); pl.wasInTunnel = false;
  pl.lapCount = 0; pl.lapTimes = []; pl.currentLapStart = 0;
  pl.raceStarted = false; pl.raceFinished = false; pl.prevCompletedLaps = 0;
  pl.out = null; pl.carHitCd = 0;
}

// ==========================================================
//  RACE FLOW — one shared start, per-player progress
// ==========================================================
let fouled = false;

function startGame(){
  if(gameOver || started) return;
  started = true;
  overlay.classList.add('hidden');
  fouled = false;
  for(const pl of players){
    resetToGrid(pl);
    pl.engine.init();
    pl.rumble.init();
  }
  oncoming = []; oncomingIn = 12;
  startMusic();
  startLights();
}

function restartGame(){
  if(!gameOver && started) return;
  gameOver = false;
  started = true;
  fouled = false;
  for(const pl of players){
    resetToGrid(pl);
    pl.engine.init();
    pl.rumble.init();
  }
  oncoming = []; oncomingIn = 12;
  overlay.classList.add('hidden');
  startMusic();
  startLights();
}

function flagFoulStart(){
  stopMusic();
  fouled = true;
  lightsPhase = 'foul';
  started = false;
  for(const pl of players) resetToGrid(pl);
  oncoming = []; oncomingIn = 12;
  overlay.innerHTML = `
    <h1 class="go-title" style="color:#f55">🚫 FOUL START</h1>
    <p class="go-sub">Someone hit the gas before the green light.</p>
    <p class="big" style="margin-top:30px">Press <b>Enter</b> / <b>R</b> / <b>START</b> to try again</p>
  `;
  overlay.classList.remove('hidden');
}

// race ends once BOTH players are done (finished 3 laps or wrecked)
function checkRaceOver(){
  if(gameOver) return;
  if(players.every(pl => pl.out !== null)){
    gameOver = true;
    stopMusic();
    showRaceResults();
  }
}

// ==========================================================
//  INPUT (keyboard + up to two gamepads)
//   P1 (top)    = first gamepad  + W/A/S/D (+E/Q)
//   P2 (bottom) = second gamepad + arrow keys
// ==========================================================
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if(!started && !gameOver && (e.code === 'Enter' || e.code === 'Space')) startGame();
  if(gameOver && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR')) restartGame();
  if(e.code === 'KeyM') toggleMusic();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('gamepadconnected', e => console.log('Gamepad connected', e.gamepad.id));

function connectedPads(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const conns = [];
  for(const p of pads) if(p && p.connected) conns.push(p);
  return conns;  // [P1 pad, P2 pad] in connection order
}

function readPad(gp, pl){
  if(!gp) return;
  const DEAD = 0.15, SDEAD = 0.12, RS_DEAD = 0.5;
  const l2 = gp.buttons[6] ? gp.buttons[6].value : 0;
  const r2 = gp.buttons[7] ? gp.buttons[7].value : 0;
  if(l2 > DEAD){ const x = (l2 - DEAD) / (1 - DEAD); pl.targetBrake = x * x * 0.55; }
  if(r2 > DEAD){ const x = (r2 - DEAD) / (1 - DEAD); pl.targetAccel = x * x * 0.85; }
  const ax = gp.axes && gp.axes[0] ? gp.axes[0] : 0;
  if(Math.abs(ax) > SDEAD) pl.steerRaw = (ax - SDEAD * Math.sign(ax)) / (1 - SDEAD);
  const rsY = gp.axes && gp.axes[3] ? gp.axes[3] : 0;
  if(rsY < -RS_DEAD) pl._shiftUpInput = true;
  if(rsY > RS_DEAD) pl._shiftDownInput = true;
}

function pollInputs(){
  const conns = connectedPads();
  const gp1 = conns[0] || null;
  const gp2 = conns.length > 1 ? conns[1] : null;
  const P1 = players[0], P2 = players[1];
  for(const pl of [P1, P2]){
    pl.targetAccel = 0; pl.targetBrake = 0; pl.steerRaw = 0;
    pl._shiftUpInput = false; pl._shiftDownInput = false;
  }

  // start / restart from EITHER controller
  for(const gp of [gp1, gp2]){
    if(!gp) continue;
    const b10 = gp.buttons[10] && gp.buttons[10].pressed;
    const b9 = gp.buttons[9] && gp.buttons[9].pressed;
    const b12 = gp.buttons[12] && gp.buttons[12].pressed;
    if(!started && !gameOver && (b10 || b9 || b12)){ startGame(); break; }
    if(gameOver && (b10 || b9 || b12)){ restartGame(); break; }
  }

  readPad(gp1, P1);
  readPad(gp2, P2);

  if(started && !gameOver){
    // P1 keyboard (WASD)
    if(keys['KeyA'])      P1.steerRaw = -1;
    if(keys['KeyD'])      P1.steerRaw = 1;
    if(keys['KeyW'])      P1.targetAccel = 1;
    if(keys['KeyS'])      P1.targetBrake = 0.6;
    if(keys['KeyE'])      P1._shiftUpInput = true;
    if(keys['KeyQ'])      P1._shiftDownInput = true;
    // P2 keyboard (arrow keys)
    if(keys['ArrowLeft'])   P2.steerRaw = -1;
    if(keys['ArrowRight'])  P2.steerRaw = 1;
    if(keys['ArrowUp'])     P2.targetAccel = 1;
    if(keys['ArrowDown'])   P2.targetBrake = 0.6;
  }

  // shifts (both players, cooldown-gated)
  for(const pl of [P1, P2]){
    if(pl._shiftUpInput && !pl.prevShiftUp && started && !gameOver && pl.shiftCooldown <= 0 && pl.out !== 'wrecked'){
      if(pl.gear < NUM_GEARS){
        pl.gear++;
        pl.shiftCooldown = 0.25;
        pl.shiftFlash = 1;
      }
    }
    if(pl._shiftDownInput && !pl.prevShiftDown && started && !gameOver && pl.shiftCooldown <= 0 && pl.out !== 'wrecked'){
      if(pl.gear > 1){
        const newGearCap = GEAR_MAX[pl.gear - 2];
        if(pl.speed > newGearCap * 1.5){
          const ratio = pl.speed / newGearCap;
          const t = Math.min(1, (ratio - 2) / 2);
          applyDamage(pl, Math.round(25 + t * 15));
        }
        pl.gear--;
        pl.shiftCooldown = 0.25;
        pl.shiftFlash = 1;
      }
    }
    pl.prevShiftUp = !!pl._shiftUpInput;
    pl.prevShiftDown = !!pl._shiftDownInput;
  }
}

// ==========================================================
//  DAMAGE
// ==========================================================
function calculateDamage(pl){
  const speedNorm = Math.min(1, pl.speed / maxSpeed);
  const latNorm = Math.min(1, Math.abs(pl.lateralVel) / 1.4);
  const raw = speedNorm * 0.6 + latNorm * 0.4;
  let dmg = 10 + raw * 52 + (Math.random() * 16 - 8);
  dmg = Math.max(5, Math.min(80, dmg));
  return Math.round(dmg);
}

function applyDamage(pl, amount){
  if(pl.out) return;
  pl.damage = Math.min(100, pl.damage + amount);
  pl.damageFlash = 1;
  pl.camShake = Math.max(pl.camShake, 0.4 + amount * 0.01);
  pl.damagePopups.push({
    text: '-' + amount + '%',
    x: W * 0.5 + (Math.random() - 0.5) * 100,
    y: H * 0.5,
    life: 1.5,
    vy: -80
  });
  if(pl.damage >= 100) wreckPlayer(pl);
}

function wreckPlayer(pl){
  if(pl.out) return;
  pl.damage = 100;
  pl.out = 'wrecked';           // this player is out — the other keeps racing
  pl.crashReason = 'wrecked';
  pl.crashTimer = 2.5;
  pl.speed = 0;
  checkRaceOver();
}

// finished 3 laps: the car keeps driving (no lap counting), race ends when both are done
function finishCar(pl){
  if(pl.out) return;
  pl.out = 'finished';
  pl.raceFinished = true;
  checkRaceOver();
}

// ==========================================================
//  RESULTS (shown when BOTH players are done)
// ==========================================================
function fmtTime(ms){
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function playerResultBlock(pl){
  if(pl.out === 'wrecked'){
    return `<div style="margin:14px 0;padding:14px 18px;border-radius:12px;background:rgba(80,20,20,.35);border:1px solid rgba(255,80,80,.3)">
      <p style="font-size:22px;color:#f88;margin:0 0 8px">💥 ${pl.name} — WRECKED</p>
      <p style="font-size:15px;color:#a99;margin:3px 0">📏 ${ (pl.distance / 100000).toFixed(2) } km
        ${pl.lapCount > 0 ? ' · ' + pl.lapCount + '/' + TOTAL_LAPS + ' laps' : ''} · Final damage: 100%</p>
    </div>`;
  }
  const total = pl.lapTimes.reduce((a, b) => a + b, 0);
  const best = Math.min(...pl.lapTimes);
  const lines = pl.lapTimes.map((t, i) =>
    `<p style="font-size:15px;margin:3px 0;color:${t === best ? '#4f8' : '#aac'};text-align:left">Lap ${i + 1}: <b>${fmtTime(t)}</b>${t === best ? ' 🏆' : ''}</p>`
  ).join('');
  return `<div style="margin:14px 0;padding:14px 18px;border-radius:12px;background:rgba(20,50,80,.30);border:1px solid rgba(90,160,255,.25)">
    <p style="font-size:22px;color:#8cf;margin:0 0 8px">🏁 ${pl.name} — FINISHED ${TOTAL_LAPS} laps</p>
    <div>${lines}</div>
    <p style="font-size:17px;color:#4f8;margin:8px 0 0">Total: <b>${fmtTime(total)}</b></p>
  </div>`;
}

function showRaceResults(){
  const pl1 = players[0], pl2 = players[1];
  const total = pl => (pl.lapTimes && pl.lapTimes.length ? pl.lapTimes.reduce((a, b) => a + b, 0) : null);
  const t1 = total(pl1), t2 = total(pl2);
  let verdict;
  if(t1 !== null && t2 !== null) verdict = t1 === t2 ? "It's a DRAW"
    : (t1 < t2 ? pl1.name : pl2.name) + ' by ' + fmtTime(Math.abs(t1 - t2));
  else if(t1 !== null) verdict = pl1.name + ' (P2 wrecked)';
  else if(t2 !== null) verdict = pl2.name + ' (P1 wrecked)';
  else verdict = pl1.distance === pl2.distance ? 'DRAW — both wrecked'
    : (pl1.distance > pl2.distance ? pl1.name : pl2.name) + ' by distance (both wrecked)';

  overlay.innerHTML = `
    <h1 class="go-title" style="color:#4f8">🏁 RACE COMPLETE</h1>
    <p style="margin-top:6px;font-size:17px;color:#aac">${TOTAL_LAPS} laps of 12 km — Nieuwerkerkeschleife · split-screen 2P</p>
    <div style="margin-top:16px;text-align:left;display:inline-block">${playerResultBlock(pl1)}${playerResultBlock(pl2)}</div>
    <p class="go-stat" style="margin-top:18px;font-size:24px">🏆 Winner: <b style="color:#4f8">${verdict}</b></p>
    <p class="big" style="margin-top:26px">Press <b>Enter</b> / <b>R</b> / <b>START</b> to race again</p>
  `;
  overlay.classList.remove('hidden');
}