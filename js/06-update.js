// 06-update.js — Per-player physics / laps, shared world (oncoming traffic), collisions
// P is the "active player" (set by the main loop before each updatePlayer call).

// ==========================================================
//  PER-PLAYER UPDATE
// ==========================================================
function updatePlayer(dt){
  const pl = P;
  if(gameOver || !started) return;
  if(pl.out === 'wrecked') return;   // out of the race — the car is frozen on the track

  const instantLat = (pl.playerX - pl.prevPlayerX) / Math.max(dt, 0.001);
  pl.lateralVel = pl.lateralVel * 0.65 + instantLat * 0.35;
  pl.prevPlayerX = pl.playerX;

  if(pl.carHitCd > 0) pl.carHitCd -= dt;

  if(pl.crashTimer > 0){
    pl.crashTimer -= dt;
    pl.speed *= .95;
    if(pl.crashTimer <= 0){
      // respawn in this player's own lane (never center — an oncoming car could be there)
      pl.playerX = pl.spawnX; pl.speed = 0; pl.accel = 0; pl.braking = 0; pl.steer = 0;
      pl.carHeading = pl.roadAngle;   // realign the car with the road
      pl.playerAngle = 0;
      pl.prevPlayerX = pl.spawnX; pl.lateralVel = 0; pl.gear = 1; pl.rpm = 800;
    }
    pl.damageFlash *= 0.92;
    updatePopups(pl, dt);
    return;
  }

  const _tIdx = Math.floor(pl.position / SEG_LEN) % ROAD_LEN;
  const _nowIn = !!segments[_tIdx].tunnel;
  if (_nowIn && !pl.wasInTunnel) tunnelChime('enter');
  if (!_nowIn && pl.wasInTunnel)  tunnelChime('exit');
  pl.wasInTunnel = _nowIn;

  if(pl.shiftCooldown > 0) pl.shiftCooldown -= dt;
  if(pl.shiftFlash > 0) pl.shiftFlash *= Math.pow(0.02, dt);

  // crossing the start/finish line before the green light is a foul (aborts the race)
  if(!raceGo && pl.position >= TRACK_LENGTH){
    flagFoulStart();
    return;
  }

  // The world only rotates when the CAR turns. No input → no world yaw,
  // so the road can never "pull" the car along it anymore.
  pl.horizonOffset -= pl.steer * 220 * dt;

  const upRate  = 1 - Math.pow(0.03, dt);
  const downRate= 1 - Math.pow(0.15, dt);
  if(pl.targetAccel > pl.accel) pl.accel += (pl.targetAccel - pl.accel) * upRate;
  else                          pl.accel += (pl.targetAccel - pl.accel) * downRate;

  const brakeUpRate  = 1 - Math.pow(0.18, dt);
  const brakeDownRate= 1 - Math.pow(0.12, dt);
  if(pl.targetBrake > pl.braking) pl.braking += (pl.targetBrake - pl.braking) * brakeUpRate;
  else                            pl.braking += (pl.targetBrake - pl.braking) * brakeDownRate;

  const sRate = 1 - Math.pow(0.008, dt);
  pl.steer += (pl.steerRaw - pl.steer) * sRate;

  const gearCap = GEAR_MAX[pl.gear - 1];
  let effectiveAccel = pl.accel;
  if(pl.speed >= gearCap * 0.85){
    const proximity = (pl.speed - gearCap * 0.85) / (gearCap * 0.15);
    effectiveAccel *= Math.max(0, 1 - proximity);
  }

  pl.speed += effectiveAccel * getEngineAccel(pl.rpm, pl.gear) * dt;
  pl.speed -= pl.braking * BRAKE * dt;
  pl.speed -= pl.speed * DRAG  * dt;

  const segNow  = segments[Math.floor(pl.position / SEG_LEN) % ROAD_LEN];
  const segNext = segments[(Math.floor(pl.position / SEG_LEN) + 1) % ROAD_LEN];
  const _segPct = (pl.position % SEG_LEN) / SEG_LEN;
  const _curveI = segNow.curve * (1 - _segPct) + segNext.curve * _segPct;
  const dy = segNext.y - segNow.y;
  pl.speed -= dy * 0.2 * dt;

  if(pl.speed > gearCap){
    pl.speed -= DOWNSHIFT_DECEL * dt;
    if(pl.speed < gearCap) pl.speed = gearCap;
  }

  pl.speed = Math.max(0, pl.speed);

  if(pl.speed < 50){
    pl.rpm += (GEAR_RPM_MIN - pl.rpm) * (1 - Math.pow(0.01, dt));
  } else {
    const targetRPM = GEAR_RPM_MIN + (pl.speed / gearCap) * (GEAR_RPM_MAX - GEAR_RPM_MIN);
    const rpmRate = 1 - Math.pow(0.005, dt);
    pl.rpm += (targetRPM - pl.rpm) * rpmRate;
  }
  pl.rpm = Math.max(600, Math.min(GEAR_RPM_MAX, pl.rpm));

  // ── CAR (free body) ─────────────────────────────────────────
  // The car's heading is the car's own state, changed ONLY by the
  // steering input and the car's own speed.
  const vW = pl.speed * 0.5;                       // world units/s
  pl.carHeading += pl.steer * STEER_K * dt * (pl.speed * OVERSTEER);

  // How far the car's heading has diverged from the road's:
  const psi = pl.carHeading - pl.roadAngle;

  // Split motion into "along the road" and "across the road":
  const ds = vW * Math.cos(psi) * dt;
  pl.posBefore = pl.position;
  pl.position += ds;
  pl.distance += ds;

  // ── LAP DETECTION ──
  // The car starts 20 m before the line, so crossing it is the first
  // event and must NOT be recorded as a lap. A lap only completes on
  // a subsequent crossing (crossings >= 2).
  const completedCrossings = Math.floor(pl.position / TRACK_LENGTH);
  if (completedCrossings > pl.prevCompletedLaps) {
    pl.prevCompletedLaps = completedCrossings;
    if (completedCrossings < 2) {
      // arm the lap 1 clock (it was set at the green light; fall back)
      pl.raceStarted = true;
      if (!pl.currentLapStart) pl.currentLapStart = performance.now();
    } else if (!pl.raceFinished) {
      pl.lapCount = completedCrossings - 1;
      const now = performance.now();
      pl.lapTimes.push(now - pl.currentLapStart);
      pl.currentLapStart = now;
      if (pl.lapCount >= TOTAL_LAPS) {
        finishCar(pl);   // car keeps driving; race ends when BOTH players are done
      }
    }
  }

  pl.playerX += vW * Math.sin(psi) / ROAD_HALF * dt;   // slide across the road

  // The road's own heading changes over the distance we advanced
  // (road geometry, NOT a force on the car):
  const centT = Math.min(
    1,
    Math.max(
      0,
      (pl.speed - CENTRIFUGAL_SPEED_REF) / (maxSpeed - CENTRIFUGAL_SPEED_REF)
    )
  );
  const centrifugalScale = 1 + CENTRIFUGAL_SPEED_SCALE * centT * centT;

  pl.roadAngle += _curveI * PHYS_K * ds * centrifugalScale;

  // The camera looks along the CAR's heading, so the road visibly
  // peels away by exactly the difference:
  pl.playerAngle = Math.max(-MAX_HEADING, Math.min(MAX_HEADING, psi));

  // strong slip bleeds speed
  pl.speed = Math.max(0, pl.speed - pl.speed * Math.abs(psi) * 0.5 * dt);

  if(pl.playerX > 0.60 || pl.playerX < -0.60){
    pl.speed *= .93;
  }
  if(pl.playerX > 0.6){
    pl.crashReason = 'road';
    pl.crashTimer = 2.5; pl.camShake = 1; pl.speed = 0; pl.playerX = 0.6;
    applyDamage(pl, calculateDamage(pl));
  }
  if(pl.playerX < -0.6){
    pl.crashReason = 'road';
    pl.crashTimer = 2.5; pl.camShake = 1; pl.speed = 0; pl.playerX = -0.6;
    applyDamage(pl, calculateDamage(pl));
  }
  pl.playerX = Math.max(-0.65, Math.min(0.65, pl.playerX));

  if (pl.crashTimer <= 0) {
    const absPX = Math.abs(pl.playerX);
    if (absPX > 0.30 && absPX < 0.60) {
      pl.rumble.start((absPX - 0.30) / 0.30);
    } else {
      pl.rumble.stop();
    }
  } else {
    pl.rumble.stop();
  }

  pl.camShake *= .9;
  pl.damageFlash *= 0.93;
  updatePopups(pl, dt);
}

// ==========================================================
//  SHARED WORLD — oncoming traffic (both players see the same cars)
// ==========================================================
function updateWorld(dt){
  if(!started || gameOver) return;
  const behindPos = Math.min(players[0].position, players[1].position);
  const frontPos  = Math.max(players[0].position, players[1].position);

  // Spawn once the race is live, every 45–75 s on average (60 s mean).
  // Spawn ahead of the FRONTMOST car so the car lives on the track ahead of
  // both players; each viewport sees it enter its own draw window in turn.
  if (raceGo) {
    oncomingIn -= dt;
    if (oncomingIn <= 0) {
      oncoming.push({
        pos: frontPos + ONC_SPAWN_AHEAD + (Math.random() * 0.5 - 0.25) * SEG_LEN,
        lane: ONC_LANES[(Math.random() * ONC_LANES.length) | 0],
        col: ONC_COLORS[(Math.random() * ONC_COLORS.length) | 0]
      });
      oncomingIn = 45 + Math.random() * 30;
    }
  }
  for (let i = oncoming.length - 1; i >= 0; i--) {
    const o = oncoming[i];
    o.prevPos = o.pos;
    o.pos -= ONC_SPEED * dt; // fixed 100 km/h relative to the road
    if (o.pos < behindPos - ONC_BEHIND_CULL) oncoming.splice(i, 1);
  }
}

// ════════════════════════════════════════════════════════════
//  COLLISIONS (run after both players + traffic have moved)
// ════════════════════════════════════════════════════════════
function oncomingCollisions(){
  if(!started || gameOver) return;
  for(const pl of players){
    if(pl.out === 'wrecked') continue;
    for (let i = oncoming.length - 1; i >= 0; i--) {
      const o = oncoming[i];
      // Lane: hit only if the player laterally overlaps this car's lane.
      if (Math.abs(pl.playerX - o.lane) < ONC_LATERAL_HIT) {
        // Swept 1D overlap of both cars' paths this frame (dt-proof at any
        // relative speed), each padded by half a car length:
        const pLo = Math.min(pl.posBefore, pl.position), pHi = Math.max(pl.posBefore, pl.position);
        const oLo = Math.min(o.prevPos, o.pos), oHi = Math.max(o.prevPos, o.pos);
        if (Math.max(pLo - ONC_CAR_HIT_HALF, oLo - ONC_CAR_HIT_HALF) <=
            Math.min(pHi + ONC_CAR_HIT_HALF, oHi + ONC_CAR_HIT_HALF)) {
          oncoming.splice(i, 1);          // the oncoming car vanishes
          pl.crashReason = 'headon';
          pl.crashTimer = 2.5; pl.camShake = 1; pl.speed = 0;
          applyDamage(pl, ONC_COLLISION_DAMAGE);
          break;                          // one head-on per player per frame
        }
      }
    }
  }
}

function carCarCollision(){
  const A = players[0], B = players[1];
  if(!started || gameOver || !raceGo) return;               // no contact on the grid before green
  if(A.out === 'wrecked' || B.out === 'wrecked') return;
  if(A.carHitCd > 0 || B.carHitCd > 0) return;             // per-pair cooldown after a bump

  // lateral: only a hit if the two cars actually overlap side-to-side
  if (Math.abs(A.playerX - B.playerX) >= CARCAR_LATERAL_HIT) return;

  // longitudinal: swept overlap of both cars' paths this frame
  const aLo = Math.min(A.posBefore, A.position), aHi = Math.max(A.posBefore, A.position);
  const bLo = Math.min(B.posBefore, B.position), bHi = Math.max(B.posBefore, B.position);
  if (Math.max(aLo - ONC_CAR_HIT_HALF, bLo - ONC_CAR_HIT_HALF) >
      Math.min(aHi + ONC_CAR_HIT_HALF, bHi + ONC_CAR_HIT_HALF)) return;

  // ── side swipe: 10% for BOTH, both slowed, cars push apart ──
  const sideA = A.playerX <= B.playerX ? -1 : 1;   // A yaws away from B
  const sideB = -sideA;
  for(const entry of [[A, sideA], [B, sideB]]){
    const pl = entry[0], side = entry[1];
    applyDamage(pl, CARCAR_DAMAGE);
    pl.speed *= 0.7;
    pl.camShake = Math.max(pl.camShake, 0.7);
    pl.carHitCd = 1.5;
    pl.carHeading += side * 0.06;   // heading kick → the cars drift apart over the next seconds
  }
}

// ==========================================================
//  ORCHESTRATION (called once per frame by the loop)
// ==========================================================
function update(dt){
  if(!started || gameOver) return;
  for(const pl of players){
    P = pl;
    updatePlayer(dt);
    if(pl.out === 'wrecked') updatePopups(pl, dt);  // let the last damage popups fade in a wrecked view
  }
  updateWorld(dt);
  oncomingCollisions();
  carCarCollision();
}

function updatePopups(pl, dt){
  for(let i = pl.damagePopups.length - 1; i >= 0; i--){
    pl.damagePopups[i].y += pl.damagePopups[i].vy * dt;
    pl.damagePopups[i].life -= dt;
    if(pl.damagePopups[i].life <= 0) pl.damagePopups.splice(i, 1);
  }
}