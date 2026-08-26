// 06-update.js — Frame update (physics, lap / race, popups)
// Split from main.js (lines 1014–1223); keep load order in index.html.

// ── DAMAGE ──
function calculateDamage(){
  const speedNorm = Math.min(1, speed / maxSpeed);
  const latNorm   = Math.min(1, Math.abs(lateralVel) / 1.4);
  const raw       = speedNorm * 0.6 + latNorm * 0.4;
  let dmg         = 10 + raw * 52 + (Math.random() * 16 - 8);
  dmg = Math.max(5, Math.min(80, dmg));
  return Math.round(dmg);
}

function applyDamage(amount){
  damage = Math.min(100, damage + amount);
  damageFlash = 1;
  camShake = Math.max(camShake, 0.4 + amount * 0.01);
  damagePopups.push({
    text: '-'+amount+'%',
    x: W*0.5 + (Math.random()-0.5)*100,
    y: H*0.5,
    life: 1.5,
    vy: -80
  });
  if(damage >= 100){
    damage = 100;
    triggerGameOver();
  }
}

// ==========================================================
//  UPDATE
// ==========================================================
function update(dt){
  if(gameOver) return;
  if(!started) return;

  const instantLat = (playerX - prevPlayerX) / Math.max(dt, 0.001);
  lateralVel = lateralVel * 0.65 + instantLat * 0.35;
  prevPlayerX = playerX;

  if(crashTimer>0){
    crashTimer -= dt;
    speed *= .95;
    if(crashTimer <= 0){
      playerX = 0; speed = 0; accel = 0; braking = 0; steer = 0;
      carHeading = roadAngle;   // realign the car with the road on respawn
      playerAngle = 0;
      prevPlayerX = 0; lateralVel = 0; gear = 1; rpm = 800;
    }
    damageFlash *= 0.92;
    updatePopups(dt);
    return;
  }

  const _tIdx = Math.floor(position / SEG_LEN) % ROAD_LEN;
  const _nowIn = !!segments[_tIdx].tunnel;
  if (_nowIn && !wasInTunnel) tunnelChime('enter');
  if (!_nowIn && wasInTunnel)  tunnelChime('exit');
  wasInTunnel = _nowIn;

  if(shiftCooldown > 0) shiftCooldown -= dt;
  if(shiftFlash > 0) shiftFlash *= Math.pow(0.02, dt);

  // The world only rotates when the CAR turns. No input → no world yaw,
  // so the road can never "pull" the car along it anymore.
  horizonOffset -= steer * 220 * dt;

  const upRate  = 1 - Math.pow(0.03, dt);
  const downRate= 1 - Math.pow(0.15, dt);
  if(targetAccel>accel) accel += (targetAccel-accel)*upRate;
  else                  accel += (targetAccel-accel)*downRate;

  const brakeUpRate  = 1 - Math.pow(0.18, dt);
  const brakeDownRate= 1 - Math.pow(0.12, dt);
  if(targetBrake>braking) braking += (targetBrake-braking)*brakeUpRate;
  else                    braking += (targetBrake-braking)*brakeDownRate;

  const sRate = 1 - Math.pow(0.008, dt);
  steer += (steerRaw - steer)*sRate;

  const gearCap = GEAR_MAX[gear - 1];
  let effectiveAccel = accel;
  if(speed >= gearCap * 0.85){
    const proximity = (speed - gearCap*0.85) / (gearCap*0.15);
    effectiveAccel *= Math.max(0, 1 - proximity);
  }

  speed += effectiveAccel * getEngineAccel(rpm, gear) * dt;
  speed -= braking * BRAKE * dt;
  speed -= speed * DRAG  * dt;

  const segNow = segments[Math.floor(position/SEG_LEN)%ROAD_LEN];
  const segNext= segments[(Math.floor(position/SEG_LEN)+1)%ROAD_LEN];
  const _segPct = (position % SEG_LEN) / SEG_LEN;
  const _curveI = segNow.curve * (1 - _segPct) + segNext.curve * _segPct;
  const dy = segNext.y - segNow.y;
  speed -= dy * 0.2 * dt;

  if(speed > gearCap){
    speed -= DOWNSHIFT_DECEL * dt;
    if(speed < gearCap) speed = gearCap;
  }

  speed = Math.max(0, speed);

  if(speed < 50){
    rpm += (GEAR_RPM_MIN - rpm) * (1 - Math.pow(0.01, dt));
  } else {
    const targetRPM = GEAR_RPM_MIN + (speed / gearCap) * (GEAR_RPM_MAX - GEAR_RPM_MIN);
    const rpmRate = 1 - Math.pow(0.005, dt);
    rpm += (targetRPM - rpm) * rpmRate;
  }
  rpm = Math.max(600, Math.min(GEAR_RPM_MAX, rpm));

  // ── CAR (free body) ─────────────────────────────────────────
  // The car's heading is the car's own state, changed ONLY by the
  // steering input and the car's own speed. No segment/road value
  // touches this line, so the car can never be pulled along the road.
  const vW = speed * 0.5;                        // world units/s
  carHeading += steer * STEER_K * dt * (speed * OVERSTEER);       // the only thing that rotates the car

  // How far the car's heading has diverged from the road's:
  const psi = carHeading - roadAngle;

  // The car keeps moving in the direction it points. Split that motion
  // into "along the road" and "across the road":
  const ds = vW * Math.cos(psi) * dt;
  position += ds;
  distance += ds;

  // ── LAP DETECTION ──
  const completedLaps = Math.floor(position / TRACK_LENGTH);
  if (completedLaps > prevCompletedLaps) {
    prevCompletedLaps = completedLaps;
    if (!raceStarted) {
      // First crossing of the start/finish line: the timer starts now.
      raceStarted = true;
      currentLapStart = performance.now();
    } else {
      lapCount = completedLaps - 1; // crossings count, not laps done yet
      const now = performance.now();
      lapTimes.push(now - currentLapStart);
      currentLapStart = now;
      if (lapCount >= TOTAL_LAPS && !raceFinished) {
        raceFinished = true;
        started = false;
        speed = 0;
        showRaceResults();
      }
    }
  }

  playerX  += vW * Math.sin(psi) / ROAD_HALF * dt;   // slide across the road

  // The road's own heading changes over the distance we advanced.
  // This is the road's geometry, NOT a force on the car:

  const centT = Math.min(
    1,
    Math.max(
      0,
      (speed - CENTRIFUGAL_SPEED_REF) / (maxSpeed - CENTRIFUGAL_SPEED_REF)
    )
  );
  const centrifugalScale = 1 + CENTRIFUGAL_SPEED_SCALE * centT * centT;

  roadAngle += _curveI * PHYS_K * ds * centrifugalScale;

  // The camera looks along the CAR's heading, so the road visibly
  // peels away by exactly the difference:
  playerAngle = Math.max(-MAX_HEADING, Math.min(MAX_HEADING, psi));

  // strong slip bleeds speed
  speed = Math.max(0, speed - speed * Math.abs(psi) * 0.5 * dt);

  if(playerX > 0.60 || playerX < -0.60){
    speed *= .93;
  }
  if(playerX > 0.6){
    crashTimer=2.5; camShake=1; speed=0; playerX=0.6;
    applyDamage(calculateDamage());
  }
  if(playerX < -0.6){
    crashTimer=2.5; camShake=1; speed=0; playerX=-0.6;
    applyDamage(calculateDamage());
  }
  playerX=Math.max(-0.65,Math.min(0.65,playerX));

  if (crashTimer <= 0) {
    const absPX     = Math.abs(playerX);
    if (absPX > 0.30 && absPX < 0.60) {
      edgeRumble((absPX - 0.30) / 0.30);
    } else {
      edgeRumbleStop();
    }
  } else {
    edgeRumbleStop();
  }

  camShake *= .9;
  damageFlash *= 0.93;
  updatePopups(dt);
}

function updatePopups(dt){
  for(let i=damagePopups.length-1;i>=0;i--){
    damagePopups[i].y += damagePopups[i].vy*dt;
    damagePopups[i].life -= dt;
    if(damagePopups[i].life<=0) damagePopups.splice(i,1);
  }
}

