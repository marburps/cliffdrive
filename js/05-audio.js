// 05-audio.js — Per-player rumble + engine (stereo panned for 2P), tunnel, chiptune music
// P1 (top) panned left, P2 (bottom) right. Each player owns one AudioContext
// (engine + edge rumble share it) so both cars sound independent.

// ── PAN HELPER ──
function makePanner(ctx, pan){
  if(ctx.createStereoPanner){
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(ctx.destination);
    return p;
  }
  return ctx.destination;
}

// ── EDGE RUMBLE (per player instance) ──
function createRumble(ctx, pan){
  const out = makePanner(ctx, pan);
  const rumbleOsc = ctx.createOscillator();
  rumbleOsc.type = 'sawtooth';
  rumbleOsc.frequency.value = 35;
  const rumbleLFO = ctx.createOscillator();
  rumbleLFO.type = 'sine';
  rumbleLFO.frequency.value = 4;
  const rumbleLFOGain = ctx.createGain();
  rumbleLFOGain.gain.value = 0;
  rumbleLFO.connect(rumbleLFOGain);
  rumbleLFOGain.connect(rumbleOsc.frequency);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  lp.Q.value = 2;
  rumbleOsc.connect(lp);
  lp.connect(rumbleGain);
  rumbleGain.connect(out);
  rumbleOsc.start();
  rumbleLFO.start();
  return {
    ctx: ctx,
    init(){ if(this.ctx.state === 'suspended') this.ctx.resume(); },
    start(intensity){
      if(this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const vol = Math.min(0.35, intensity * 0.35);
      rumbleGain.gain.setTargetAtTime(vol, t, 0.08);
      rumbleLFO.frequency.setTargetAtTime(4 + intensity * 10, t, 0.1);
      rumbleLFOGain.gain.setTargetAtTime(intensity * 12, t, 0.1);
    },
    stop(){
      const t = this.ctx.currentTime;
      rumbleGain.gain.setTargetAtTime(0, t, 0.15);
    }
  };
}

// ── ENGINE + TIRE SCREECH (per player instance) ──
function createEngine(ctx, pan){
  const out = makePanner(ctx, pan);

  // --- Engine: 3 oscillators (saw + square + triangle) ---
  const engOsc1 = ctx.createOscillator();
  engOsc1.type = 'sawtooth';
  engOsc1.frequency.value = 55;

  const engOsc2 = ctx.createOscillator();
  engOsc2.type = 'square';
  engOsc2.frequency.value = 27.5;

  const engOsc3 = ctx.createOscillator();
  engOsc3.type = 'triangle';
  engOsc3.frequency.value = 110;

  const engFilter = ctx.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 400;
  engFilter.Q.value = 4;

  const engGain = ctx.createGain();
  engGain.gain.value = 0;

  const g1 = ctx.createGain(); g1.gain.value = 0.55;
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  const g3 = ctx.createGain(); g3.gain.value = 0.15;

  engOsc1.connect(g1).connect(engFilter);
  engOsc2.connect(g2).connect(engFilter);
  engOsc3.connect(g3).connect(engFilter);
  engFilter.connect(engGain).connect(out);

  engOsc1.start(); engOsc2.start(); engOsc3.start();

  // --- Tire screech: broadband friction noise ---
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

  const tireGain = ctx.createGain();
  tireGain.gain.value = 0;
  tireGain.connect(out);

  // Main friction hiss: WIDE bandpass (low Q = noisy, not tonal)
  const tireSrcA = ctx.createBufferSource();
  tireSrcA.buffer = buf; tireSrcA.loop = true;
  const tireSqueal = ctx.createBiquadFilter();
  tireSqueal.type = 'bandpass';
  tireSqueal.frequency.value = 3500;
  tireSqueal.Q.value = 1.8;
  const tireSquealGain = ctx.createGain();
  tireSquealGain.gain.value = 0.8;
  tireSrcA.connect(tireSqueal).connect(tireSquealGain).connect(tireGain);
  tireSrcA.start();

  // High-frequency "sss" edge
  const tireSrcB = ctx.createBufferSource();
  tireSrcB.buffer = buf; tireSrcB.loop = true;
  const tireGrit = ctx.createBiquadFilter();
  tireGrit.type = 'highpass';
  tireGrit.frequency.value = 6000;
  tireGrit.Q.value = 0.5;
  const tireGritGain = ctx.createGain();
  tireGritGain.gain.value = 0.3;
  tireSrcB.connect(tireGrit).connect(tireGritGain).connect(tireGain);
  tireSrcB.start();

  return {
    ctx: ctx,
    init(){ if(this.ctx.state === 'suspended') this.ctx.resume(); },
    // pl = the player this engine belongs to (P1 left / P2 right)
    update(pl){
      if(!ctx) return;
      if(ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const rpmNorm = pl.rpm / GEAR_RPM_MAX;
      const spdNorm = pl.speed / maxSpeed;

      // Engine pitch (≈ 40 Hz idle → 320 Hz redline)
      const f = 40 + rpmNorm * 280;
      engOsc1.frequency.setTargetAtTime(f, t, 0.04);
      engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      engOsc3.frequency.setTargetAtTime(f * 2, t, 0.04);

      // Filter opens with RPM
      engFilter.frequency.setTargetAtTime(300 + rpmNorm * 3200, t, 0.06);
      engFilter.Q.setTargetAtTime(2 + pl.accel * 4, t, 0.1);

      // Engine volume (×0.8 so two cars at once don't clip)
      const active = started && !gameOver && pl.crashTimer <= 0 && pl.out !== 'wrecked';
      const idle = 0.025;
      const rpmV = rpmNorm * 0.10;
      const thrV = pl.accel * 0.09;
      const spdV = spdNorm * 0.035;
      const vol = active ? (idle + rpmV + thrV + spdV) * 0.8 : 0;
      engGain.gain.setTargetAtTime(Math.min(0.35, vol), t, 0.08);

      // --- Tire screech (centrifugal + slide) ---
      const segIdx = Math.floor(pl.position / SEG_LEN) % ROAD_LEN;
      const curveN = Math.abs(segments[segIdx].curve) / CURVE_SHARPNESS;
      const latG   = spdNorm * spdNorm * curveN;
      const slide  = Math.abs(pl.steer) * spdNorm;
      const drive  = Math.min(1, latG * 1.8 + slide * curveN * 0.7);
      const screech = active ? Math.max(0, drive - 0.25) * 0.5 * 0.8 : 0;

      tireGain.gain.setTargetAtTime(screech, t, 0.08);

      tireSqueal.frequency.setTargetAtTime(2500 + drive * 2000 + spdNorm * 800, t, 0.12);
      tireSqueal.Q.setTargetAtTime(1.2 + drive * 1.5, t, 0.12);
      tireSquealGain.gain.setTargetAtTime(0.5 + drive * 0.4, t, 0.08);

      tireGrit.frequency.setTargetAtTime(4000 + drive * 4000, t, 0.1);
      tireGritGain.gain.setTargetAtTime(0.15 + drive * 0.4, t, 0.08);
    }
  };
}

// ── CHIPTUNE "OUTRUN"‑STYLE MUSIC (approx.) ──
let musicCtx=null, musicMaster=null, musicOn=false, musicTimer=null;
let musicStep=0, nextNoteTime=0, _noiseBuf=null;
const MUSIC_BPM=124;
const STEP=60/MUSIC_BPM/4;                 // 16th‑note duration (s)

const NOTE={
  C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,
  C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880,B5:987.77,C6:1046.5,
  E1:41.2,E2:82.41,F2:87.31,G2:98,A2:110,B2:123.47,
  C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196,A3:220,B3:246.94
};

// 32 eighth‑notes = 4 bars. Tweak here to reshape the melody.
const LEAD=['A4','C5','E5','C5','A4','C5','E5','A5',
            'A5','G5','E5','G5','A5','G5','E5','C5',
            'A4','C5','E5','C5','A4','C5','E5','G5',
            'A5','G5','F5','E5','D5','E5','C5','A4'];
const BASS=['A2','E3','A2','E3','A2','E3','A2','E3',
            'F2','C3','F2','C3','F2','C3','F2','C3',
            'A2','E3','A2','E3','A2','E3','A2','E3',
            'G2','D3','G2','D3','G2','D3','G2','D3'];

function _noise(){
  if(_noiseBuf) return _noiseBuf;
  _noiseBuf=musicCtx.createBuffer(1,musicCtx.sampleRate*0.2,musicCtx.sampleRate);
  const d=_noiseBuf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  return _noiseBuf;
}
function _lead(f,t,dur){
  const o=musicCtx.createOscillator(); o.type='square'; o.frequency.value=f;
  const lp=musicCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2600;
  const g=musicCtx.createGain();
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(0.14,t+0.005);
  g.gain.setValueAtTime(0.14,t+dur*0.7);
  g.gain.linearRampToValueAtTime(0.0001,t+dur);
  o.connect(lp).connect(g).connect(musicMaster);
  o.start(t); o.stop(t+dur);
}
function _bass(f,t,dur){
  const o=musicCtx.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
  const lp=musicCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700; lp.Q.value=4;
  const g=musicCtx.createGain();
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(0.22,t+0.004);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(lp).connect(g).connect(musicMaster);
  o.start(t); o.stop(t+dur);
}
function _kick(t){
  const o=musicCtx.createOscillator(); o.type='sine';
  const g=musicCtx.createGain();
  o.frequency.setValueAtTime(140,t);
  o.frequency.exponentialRampToValueAtTime(45,t+0.12);
  g.gain.setValueAtTime(0.5,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
  o.connect(g).connect(musicMaster);
  o.start(t); o.stop(t+0.2);
}
function _snare(t){
  const s=musicCtx.createBufferSource(); s.buffer=_noise();
  const f=musicCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=0.8;
  const g=musicCtx.createGain();
  g.gain.setValueAtTime(0.25,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  s.connect(f).connect(g).connect(musicMaster);
  s.start(t); s.stop(t+0.16);
}
function _hat(t,acc){
  const s=musicCtx.createBufferSource(); s.buffer=_noise();
  const f=musicCtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7000;
  const g=musicCtx.createGain();
  g.gain.setValueAtTime(acc?0.11:0.05,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
  s.connect(f).connect(g).connect(musicMaster);
  s.start(t); s.stop(t+0.06);
}
function _scheduleStep(step,time){
  const s=step%64, bar=(s/16)|0, ib=s%16;
  if(ib%2===0){                       // eighth‑notes
    const e=ib/2, gi=(bar*8+e)%32;
    if(LEAD[gi])  _lead(NOTE[LEAD[gi]],  time, STEP*2*0.9);
    if(BASS[gi])  _bass(NOTE[BASS[gi]], time, STEP*2*0.9);
  }
  if(ib%4===0)   _kick(time);          // 4‑on‑the‑floor
  if(ib===4||ib===12) _snare(time);    // backbeat 2 & 4
  if(ib%2===0)  _hat(time, ib%4===2);  // offbeat hats
}
function _musicLoop(){
  while(nextNoteTime < musicCtx.currentTime + 0.12){
    _scheduleStep(musicStep, nextNoteTime);
    nextNoteTime += STEP;
    musicStep++;
  }
}
function startMusic(){
  if(!musicCtx){
    musicCtx=new AudioContext();
    musicMaster=musicCtx.createGain(); musicMaster.gain.value=0.5;
    const comp=musicCtx.createDynamicsCompressor();
    musicMaster.connect(comp).connect(musicCtx.destination);
  }
  if(musicCtx.state==='suspended') musicCtx.resume();
  musicMaster.gain.setValueAtTime(0.5, musicCtx.currentTime);
  musicOn=true; musicStep=0;
  nextNoteTime=musicCtx.currentTime+0.06;
  if(musicTimer) clearInterval(musicTimer);
  musicTimer=setInterval(_musicLoop,25);
}
function stopMusic(){
  musicOn=false;
  if(musicTimer){clearInterval(musicTimer); musicTimer=null;}
  if(musicCtx&&musicMaster) musicMaster.gain.setTargetAtTime(0,musicCtx.currentTime,0.15);
}
function toggleMusic(){ musicOn ? stopMusic() : startMusic(); }

// ── BUILD THE TWO PLAYERS ───────────────────────────────────
// Done here (not 04-state.js) so the per-player audio instances — created by
// the factories above — get attached. P1 top = left, P2 bottom = right.
players = [makePlayer(0), makePlayer(1)];
for(let i = 0; i < players.length; i++){
  const actx = new AudioContext();              // one shared context per player
  const pan  = i === 0 ? -0.6 : 0.6;
  players[i].rumble = createRumble(actx, pan);
  players[i].engine = createEngine(actx, pan);
}

