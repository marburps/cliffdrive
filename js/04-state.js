// 04-state.js — Game state, gears, input, game pad, start / restart, damage model
// Split from main.js (lines 499–722); keep load order in index.html.

// ==========================================================
//  GEARBOX
// ==========================================================
const GEAR_MAX = [4000, 8000, 12000, 16000, 21000, 30000];
const GEAR_RPM_MIN = 800;
const GEAR_RPM_MAX = 8500;
const NUM_GEARS = 6;

// ==========================================================
//  STATE
// ==========================================================
let playerX=0, speed=0, position=START_POS;
let playerAngle=0; // ψ: car heading minus road heading (camera offset, for the renderer)
let carHeading=0;  // car's own world heading (screen rad) — steering only
let roadAngle=0;   // road's own heading at the car (screen rad) — geometry only
let horizonOffset=0;
let accel=0, braking=0, steer=0;
let targetAccel=0, targetBrake=0, steerRaw=0;
let crashTimer=0, camShake=0, distance=0;
const maxSpeed=30000;

let gear = 1;
let rpm = 800;
let shiftCooldown = 0;
let shiftFlash = 0;

let prevShiftUp = false;
let prevShiftDown = false;

let damage=0;
let prevPlayerX=0;
let lateralVel=0;
let damageFlash=0;
let damagePopups=[];
let crackSeeds=[];

function generateCracks(){
  crackSeeds=[];
  for(let i=0;i<8;i++){
    const pts=[];
    let cx=Math.random()*W, cy=Math.random()*H*0.5;
    let angle=Math.random()*Math.PI*2;
    for(let s=0;s<5+Math.floor(Math.random()*5);s++){
      pts.push({x:cx,y:cy});
      angle+=(Math.random()-0.5)*1.2;
      cx+=Math.cos(angle)*(20+Math.random()*40);
      cy+=Math.sin(angle)*(20+Math.random()*40);
    }
    crackSeeds.push(pts);
  }
}
generateCracks();

const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(!started&&!gameOver&&(e.code==='Enter'||e.code==='Space')) startGame();
  if((gameOver||raceFinished)&&(e.code==='Enter'||e.code==='Space'||e.code==='KeyR')) restartGame();
  if(e.code==='KeyM') toggleMusic();
});
addEventListener('keyup',e=>{keys[e.code]=false});

function startGame(){
  if(gameOver) return;
  started=true;
  overlay.classList.add('hidden');
  lapCount = 0;
  lapTimes = [];
  raceFinished = false;
  prevCompletedLaps = 0;
  position = START_POS; // 20 m before the start/finish line
  initEngineAudio();
  startMusic();
  if(engCtx && engCtx.state==='suspended') engCtx.resume();
  startLights();
}

function restartGame(){
  gameOver=false;
  started=true;
  playerAngle=0; carHeading=0; roadAngle=0;
  damage=0; speed=0; playerX=0; distance=0;
  position = START_POS; // 20 m before the start/finish line
  accel=0; braking=0; steer=0; crashTimer=0; camShake=0;
  prevPlayerX=0; lateralVel=0; damageFlash=0; damagePopups=[];
  gear=1; rpm=800; shiftCooldown=0; shiftFlash=0;
  prevShiftUp=false; prevShiftDown=false;
  generateCracks();
    lapCount = 0;
  lapTimes = [];
  raceFinished = false;
  prevCompletedLaps = 0;
  overlay.classList.add('hidden');
  startMusic();
  if(engCtx && engCtx.state==='suspended') engCtx.resume();
}
function triggerGameOver(){
  stopMusic();
  gameOver=true;
  overlay.innerHTML=`
    <h1 class="go-title">💥 WRECKED</h1>
    <p class="go-sub">Your car took too much damage and broke down.</p>
    <p class="go-stat">📏 Distance traveled: <b>${(distance/100000).toFixed(2)} km</b></p>
    <p style="margin-top:10px;color:#89a">Final damage: 100%</p>
    <p class="big" style="margin-top:30px">Press <b>Enter</b> / <b>R</b> / <b>START</b> to try again</p>
  `;
  overlay.classList.remove('hidden');
}
let fouled = false;
function flagFoulStart(){
  stopMusic();
  fouled = true;
  started = false;
  speed = 0; accel = 0; braking = 0;
  targetAccel = 0; targetBrake = 0;
  lapCount = 0;
  lapTimes = [];
  raceFinished = false;
  prevCompletedLaps = 0;
  position = START_POS;
  playerX = 0; playerAngle = 0; carHeading = 0; roadAngle = 0;
  overlay.innerHTML=`
    <h1 class="go-title" style="color:#f55">🚫 FOUL START</h1>
    <p class="go-sub">You hit the gas before the green light.</p>
    <p class="big" style="margin-top:30px">Press <b>Enter</b> / <b>R</b> / <b>START</b> to try again</p>
  `;
  overlay.classList.remove('hidden');
}
addEventListener('gamepadconnected',e=>console.log('Gamepad connected',e.gamepad.id));

function showRaceResults() {
  const best = Math.min(...lapTimes);
  const fmt = ms => {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };
  const lines = lapTimes.map((t, i) =>
    `<p style="font-size:22px;margin:6px 0;color:${t === best ? '#4f8' : '#aac'}">${i + 1}. Lap &nbsp; ${fmt(t)}${t === best ? ' 🏆' : ''}</p>`
  ).join('');
  overlay.innerHTML = `
    <h1 class="go-title" style="color:#4f8">🏁 RACE COMPLETE</h1>
    <p style="margin-top:12px;font-size:18px;color:#aac">${TOTAL_LAPS} laps of 12 km — Nieuwerkerkeschleife</p>
    <div style="margin-top:20px;text-align:left;display:inline-block">${lines}</div>
    <p class="go-stat" style="margin-top:24px">🏆 Best Lap: <b style="color:#4f8">${fmt(best)}</b></p>
    <p style="margin-top:10px;color:#89a">Total race time: <b>${fmt(lapTimes.reduce((a, b) => a + b, 0))}</b></p>
    <p class="big" style="margin-top:28px">Press <b>Enter</b> / <b>R</b> / <b>START</b> to race again</p>
  `;
  overlay.classList.remove('hidden');
}

function pollGamepad(){
  targetAccel=0; targetBrake=0; steerRaw=0;
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  let gp=null;
  for(const p of pads){if(p&&p.connected){gp=p;break}}

  let shiftUpInput=false, shiftDownInput=false;

  if(gp){
    if(!started&&!gameOver){
      const b10=gp.buttons[10]&&gp.buttons[10].pressed;
      const b9=gp.buttons[9]&&gp.buttons[9].pressed;
      const b12=gp.buttons[12]&&gp.buttons[12].pressed;
      if(b10||b9||b12) startGame();
    }
    if(gameOver||raceFinished){
      const b10=gp.buttons[10]&&gp.buttons[10].pressed;
      const b9=gp.buttons[9]&&gp.buttons[9].pressed;
      const b12=gp.buttons[12]&&gp.buttons[12].pressed;
      if(b10||b9||b12) restartGame();
    }
    if(started&&!gameOver){
      const DEAD=0.15;
      const l2=gp.buttons[6]?gp.buttons[6].value:0;
      const r2=gp.buttons[7]?gp.buttons[7].value:0;
      if(l2>DEAD){const x=(l2-DEAD)/(1-DEAD);targetBrake=x*x*0.55;}
      if(r2>DEAD){const x=(r2-DEAD)/(1-DEAD);targetAccel=x*x*0.85;}
      const ax=gp.axes&&gp.axes[0]?gp.axes[0]:0;
      const SDEAD=0.12;
      if(Math.abs(ax)>SDEAD) steerRaw=(ax-SDEAD*Math.sign(ax))/(1-SDEAD);

      const rsY = gp.axes&&gp.axes[3]?gp.axes[3]:0;
      const RS_DEAD = 0.5;
      if(rsY < -RS_DEAD) shiftUpInput=true;
      if(rsY > RS_DEAD) shiftDownInput=true;
    }
  }

  if(started&&!gameOver){
    if(keys['ArrowLeft']||keys['KeyA'])  steerRaw=-1;
    if(keys['ArrowRight']||keys['KeyD']) steerRaw=1;
    if(keys['ArrowUp']  ||keys['KeyW'])  targetAccel=1;
    if(keys['ArrowDown']||keys['KeyS'])  targetBrake=0.6;
    if(keys['KeyE']) shiftUpInput=true;
    if(keys['KeyQ']) shiftDownInput=true;
  }

  if(shiftUpInput && !prevShiftUp && started && !gameOver && shiftCooldown<=0){
    if(gear < NUM_GEARS){
      gear++;
      shiftCooldown = 0.25;
      shiftFlash = 1;
    }
  }
  if(shiftDownInput && !prevShiftDown && started && !gameOver && shiftCooldown<=0){
    if(gear > 1){
      const newGearCap = GEAR_MAX[gear - 2];
      if(speed > newGearCap * 1.5){
        const ratio = speed / newGearCap;
        const t = Math.min(1, (ratio - 2) / 2);
        const dmg = Math.round(25 + t * 15);
        applyDamage(dmg);
      }
      gear--;
      shiftCooldown = 0.25;
      shiftFlash = 1;
    }
  }

  prevShiftUp = shiftUpInput;
  prevShiftDown = shiftDownInput;
}

