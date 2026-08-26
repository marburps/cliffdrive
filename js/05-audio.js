// 05-audio.js — Rumble, engine + screech, chiptune music
// Split from main.js (lines 723–1013); keep load order in index.html.

// ── AUDIO + VISUAL EDGE WARNING ──
let rumbleCtx = null, rumbleOsc = null, rumbleGain = null, rumbleLFO = null, rumbleLFOGain = null;
let edgeWarnActive = false;

function initRumbleAudio() {
  if (rumbleCtx) return;
  rumbleCtx = new AudioContext();
  rumbleOsc = rumbleCtx.createOscillator();
  rumbleOsc.type = 'sawtooth';
  rumbleOsc.frequency.value = 35;
  rumbleLFO = rumbleCtx.createOscillator();
  rumbleLFO.type = 'sine';
  rumbleLFO.frequency.value = 4;
  rumbleLFOGain = rumbleCtx.createGain();
  rumbleLFOGain.gain.value = 0;
  rumbleLFO.connect(rumbleLFOGain);
  rumbleLFOGain.connect(rumbleOsc.frequency);
  rumbleGain = rumbleCtx.createGain();
  rumbleGain.gain.value = 0;
  const lp = rumbleCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  lp.Q.value = 2;
  rumbleOsc.connect(lp);
  lp.connect(rumbleGain);
  rumbleGain.connect(rumbleCtx.destination);
  rumbleOsc.start();
  rumbleLFO.start();
}

function edgeRumble(intensity) {
  if (rumbleCtx && rumbleCtx.state === 'suspended') rumbleCtx.resume();
  initRumbleAudio();
  if (!rumbleGain) return;
  const t = rumbleCtx.currentTime;
  const vol = Math.min(0.35, intensity * 0.35);
  rumbleGain.gain.setTargetAtTime(vol, t, 0.08);
  rumbleLFO.frequency.setTargetAtTime(4 + intensity * 10, t, 0.1);
  rumbleLFOGain.gain.setTargetAtTime(intensity * 12, t, 0.1);
  edgeWarnActive = true;
}

function edgeRumbleStop() {
  if (!rumbleGain) return;
  const t = rumbleCtx.currentTime;
  rumbleGain.gain.setTargetAtTime(0, t, 0.15);
  edgeWarnActive = false;
}

// ── ENGINE + TIRE SCREECH AUDIO ──
let engCtx = null, engOsc1 = null, engOsc2 = null, engOsc3 = null,
    engGain = null, engFilter = null, engSubGain = null,
    tireGain = null, tireSrcA = null, tireSrcB = null,
    tireSqueal = null, tireGrit = null,
    tireSquealGain = null, tireGritGain = null;

function initEngineAudio() {
  if (engCtx) return;
  engCtx = new AudioContext();
  const t = engCtx.currentTime;

  // --- Engine: 3 oscillators (saw + square + triangle) ---
  engOsc1 = engCtx.createOscillator();
  engOsc1.type = 'sawtooth';
  engOsc1.frequency.value = 55;

  engOsc2 = engCtx.createOscillator();
  engOsc2.type = 'square';
  engOsc2.frequency.value = 27.5;

  engOsc3 = engCtx.createOscillator();
  engOsc3.type = 'triangle';
  engOsc3.frequency.value = 110;

  engFilter = engCtx.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 400;
  engFilter.Q.value = 4;

  engGain = engCtx.createGain();
  engGain.gain.value = 0;

  const g1 = engCtx.createGain(); g1.gain.value = 0.55;
  const g2 = engCtx.createGain(); g2.gain.value = 0.25;
  const g3 = engCtx.createGain(); g3.gain.value = 0.15;

  engOsc1.connect(g1).connect(engFilter);
  engOsc2.connect(g2).connect(engFilter);
  engOsc3.connect(g3).connect(engFilter);
  engFilter.connect(engGain).connect(engCtx.destination);

  engOsc1.start(); engOsc2.start(); engOsc3.start();

    // --- Tire screech: two parallel noise paths + wobble + crackle ---
  // --- Tire screech: broadband friction noise (no LFOs) ---
  const len = engCtx.sampleRate * 2;
  const buf = engCtx.createBuffer(1, len, engCtx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

  tireGain = engCtx.createGain();
  tireGain.gain.value = 0;
  tireGain.connect(engCtx.destination);

  // Main friction hiss: WIDE bandpass (low Q = noisy, not tonal)
  tireSrcA = engCtx.createBufferSource();
  tireSrcA.buffer = buf; tireSrcA.loop = true;
  tireSqueal = engCtx.createBiquadFilter();
  tireSqueal.type = 'bandpass';
  tireSqueal.frequency.value = 3500;
  tireSqueal.Q.value = 1.8;
  tireSquealGain = engCtx.createGain();
  tireSquealGain.gain.value = 0.8;
  tireSrcA.connect(tireSqueal).connect(tireSquealGain).connect(tireGain);
  tireSrcA.start();

  // High-frequency "sss" edge
  tireSrcB = engCtx.createBufferSource();
  tireSrcB.buffer = buf; tireSrcB.loop = true;
  tireGrit = engCtx.createBiquadFilter();
  tireGrit.type = 'highpass';
  tireGrit.frequency.value = 6000;
  tireGrit.Q.value = 0.5;
  tireGritGain = engCtx.createGain();
  tireGritGain.gain.value = 0.3;
  tireSrcB.connect(tireGrit).connect(tireGritGain).connect(tireGain);
  tireSrcB.start();
}

function updateEngineAudio() {
  if (!engCtx) return;
  if (engCtx.state === 'suspended') engCtx.resume();
  const t = engCtx.currentTime;
  const rpmNorm = rpm / GEAR_RPM_MAX;
  const spdNorm = speed / maxSpeed;

  // Engine pitch (≈ 40 Hz idle → 320 Hz redline)
  const f = 40 + rpmNorm * 280;
  engOsc1.frequency.setTargetAtTime(f, t, 0.04);
  engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
  engOsc3.frequency.setTargetAtTime(f * 2, t, 0.04);

  // Filter opens with RPM
  engFilter.frequency.setTargetAtTime(300 + rpmNorm * 3200, t, 0.06);
  engFilter.Q.setTargetAtTime(2 + accel * 4, t, 0.1);

  // Engine volume
  const active = started && !gameOver && crashTimer <= 0;
  const idle = 0.025;
  const rpmV = rpmNorm * 0.10;
  const thrV = accel * 0.09;
  const spdV = spdNorm * 0.035;
  const vol = active ? idle + rpmV + thrV + spdV : 0;
  engGain.gain.setTargetAtTime(Math.min(0.35, vol), t, 0.08);

  // --- Tire screech (centrifugal + slide) ---
  const segIdx = Math.floor(position / SEG_LEN) % ROAD_LEN;
  const curveN = Math.abs(segments[segIdx].curve) / CURVE_SHARPNESS;
  const latG   = spdNorm * spdNorm * curveN;
  const slide  = Math.abs(steer) * spdNorm;
  const drive  = Math.min(1, latG * 1.8 + slide * curveN * 0.7);
  const screech = active ? Math.max(0, drive - 0.25) * 0.5 : 0;

  tireGain.gain.setTargetAtTime(screech, t, 0.08);

  tireSqueal.frequency.setTargetAtTime(2500 + drive * 2000 + spdNorm * 800, t, 0.12);
  tireSqueal.Q.setTargetAtTime(1.2 + drive * 1.5, t, 0.12);
  tireSquealGain.gain.setTargetAtTime(0.5 + drive * 0.4, t, 0.08);

  tireGrit.frequency.setTargetAtTime(4000 + drive * 4000, t, 0.1);
  tireGritGain.gain.setTargetAtTime(0.15 + drive * 0.4, t, 0.08);
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

