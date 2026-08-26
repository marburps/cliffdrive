// 07-render.js — Road / tunnel / billboard rendering, cockpit, windshield cracks
// Split from main.js (lines 1224–1987); keep load order in index.html.

// ── TUNNEL HELPERS ──────────────────────────────────────────

function drawTunnelPipes(p, x1, y1, h1, topY, farL, farR, shade) {
  if (h1 < 3 || h1 > H * 3) return;
  const pipeY = topY + (y1 - topY) * 0.15;
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const px = farL + (farR - farL) * t;
    const pipeW = Math.min(5, Math.max(1, h1 * 0.012));
    ctx.strokeStyle = `rgba(80,85,95,${0.4 * shade})`;
    ctx.lineWidth = pipeW;
    ctx.beginPath();
    ctx.moveTo(px, pipeY);
    ctx.lineTo(px, pipeY + (y1 - pipeY) * 0.06);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(60,60,70,${0.25 * shade})`;
  ctx.lineWidth = Math.min(4, Math.max(1, h1 * 0.008));
  ctx.beginPath();
  ctx.moveTo(farL + (farR - farL) * 0.2, pipeY - h1 * 0.02);
  ctx.quadraticCurveTo(x1, pipeY + h1 * 0.03, farR - (farR - farL) * 0.2, pipeY - h1 * 0.02);
  ctx.stroke();
}

function drawTunnelHeadlights(x1, y1, h1, shade) {
  if (h1 < 2 || h1 > H * 3) return;
  const beamW = Math.min(W * 0.5, h1 * 0.9);
  const beamH = Math.min(H, h1 * 1.6);
  const g = ctx.createRadialGradient(x1, y1 - beamH * 0.3, 0, x1, y1 - beamH * 0.3, Math.max(1, beamW * 1.2));
  g.addColorStop(0, `rgba(255,250,220,${0.12 * shade})`);
  g.addColorStop(0.5, `rgba(255,240,180,${0.05 * shade})`);
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x1 - beamW * 1.2, y1);
  ctx.lineTo(x1 - beamW * 0.5, y1 - beamH);
  ctx.lineTo(x1 + beamW * 0.5, y1 - beamH);
  ctx.lineTo(x1 + beamW * 1.2, y1);
  ctx.closePath();
  ctx.fill();
}

function drawTunnelSign() {
  const trackLen = ROAD_LEN * SEG_LEN;
  const lapPos = ((position % trackLen) + trackLen) % trackLen;

  // nearest upcoming tunnel entry within 300 m
  let distToEntry = null;
  for (const startUnit of TUNNELS) {
    let d = startUnit - lapPos;
    if (d < 0) d += trackLen;                 // wrap around the lap
    if (d >= 0 && d <= 30000 && (distToEntry === null || d < distToEntry)) {
      distToEntry = d;
    }
  }
  if (distToEntry === null) return;

  const t = 1 - distToEntry / 30000;
  const signX = W * 0.82;
  const signY = H * 0.38 - t * H * 0.04;
  const signW = 18 + t * 60;
  const signH = signW * 0.6;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 2);
  ctx.fillStyle = '#666';
  ctx.fillRect(signX - 2, signY + signH / 2, 4, H * 0.12);
  ctx.fillStyle = '#1a3a1a';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(signX - signW / 2, signY - signH / 2, signW, signH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(10, signW * 0.16)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TUNNEL', signX, signY - signH * 0.12);
  ctx.fillText('AHEAD', signX, signY + signH * 0.22);
  const mLeft = Math.round(distToEntry / 100);
  if (mLeft > 0) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${Math.max(9, signW * 0.13)}px monospace`;
    ctx.fillText(mLeft + ' m', signX, signY + signH * 0.5);
  }
  ctx.restore();
}

function drawStartFinishArch(p, q, x1, y1, h1, x2, y2, h2, shade) {
  const idx = p.idx;
  if (idx !== 0) return;
  if (h1 < 2.5) return;

  const spanX1  = h1 * 1.3;
  const spanX2  = h2 * 1.3;
  const L1 = x1 - spanX1, R1 = x1 + spanX1;
  const L2 = x2 - spanX2, R2 = x2 + spanX2;
  const archH1 = h1 * 1.5;
  const archH2 = h2 * 1.5;
  const T1 = archH1 * 0.5;
  const T2 = archH2 * 0.5;
  const O1y = y1 - archH1;              // outer peak (top of the arch)
  const O2y = y2 - archH2;
  const I1y = y1 - archH1 + T1;         // inner peak (bottom of the band)
  const I2y = y2 - archH2 + T2;
  // quadratic control points that make each bow peak at the given height
  const cO1 = 2 * O1y - y1;
  const cO2 = 2 * O2y - y2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, shade + 0.15);

  // ── Top surface (arch extruded one segment deep) ──
  ctx.fillStyle = `rgb(${42+shade*22},${45+shade*22},${54+shade*24})`;
  ctx.beginPath();
  ctx.moveTo(L1, y1);
  ctx.quadraticCurveTo(x1, cO1, R1, y1);          // outer near edge
  ctx.lineTo(R2, y2);
  ctx.quadraticCurveTo(x2, cO2, L2, y2);          // outer far edge (reversed)
  ctx.closePath();
  ctx.fill();

  // ── Front face: solid checkered band curbing from the ground ──
  const face = new Path2D();
  face.moveTo(L1, y1);
  face.quadraticCurveTo(x1, cO1, R1, y1);         // outer edge
  face.quadraticCurveTo(x1, 2 * I1y - y1, L1, y1);// inner edge
  face.closePath();

  ctx.fillStyle = '#111';
  ctx.fill(face);

  if (h1 > 5) {
    ctx.save();
    ctx.clip(face);
    const cell = Math.max(3, (R1 - L1) / 18);
    let row = 0;
    for (let cy = O1y; cy < y1; cy += cell, row++) {
      let col = 0;
      for (let cx = L1 - cell; cx < R1; cx += cell, col++) {
        ctx.fillStyle = ((row + col) & 1) === 0 ? '#f4f4f4' : '#0d0d0d';
        ctx.fillRect(cx, cy, cell + 1, cell + 1);
      }
    }
    ctx.restore();
  }

  ctx.strokeStyle = `rgba(225,230,240,${0.85*shade})`;
  ctx.lineWidth = Math.max(1.5, h1 * 0.035);
  ctx.stroke(face);

  // ── Solid base blocks where the arch meets the ground ──
  const capH = Math.max(2, h1 * 0.08);
  const capW = spanX1 * 0.3;
  for (const bx of [L1, R1]) {
    ctx.fillStyle = `rgb(${30+shade*20},${32+shade*20},${40+shade*22})`;
    ctx.fillRect(bx - capW/2, y1 - capH, capW, capH);
    ctx.fillStyle = `rgba(225,230,240,${0.5*shade})`;
    ctx.fillRect(bx - capW/2, y1 - capH, capW, Math.max(1, capH * 0.22));
  }

  ctx.restore();
}

function drawTunnelStrip(p, q, x1, y1, h1, x2, y2, h2, shade) {
  if (!p || !q) return;
  const s1 = segments[p.idx];
  const s2 = segments[q.idx];
  if (!s1.tunnel && !s2.tunnel) return;

  const inside = s1.tunnel && s2.tunnel;
  const alpha = inside ? 1 : 0.45;
  const wallSide = TUNNEL_WALL_SIDE;
  const ceilingH = TUNNEL_CEILING_H;

  // UNCLAMPED heights = true perspective. The ceiling/walls now converge
  // to the vanishing point at the exit instead of sliding down as bands.
  const wallH1 = h1 * ceilingH;
  const wallH2 = h2 * ceilingH;
  const topY1 = y1 - wallH1;
  const topY2 = y2 - wallH2;
  const farL  = x1 - h1 * wallSide;
  const farR  = x1 + h1 * wallSide;
  const nearL = x2 - h2 * wallSide;
  const nearR = x2 + h2 * wallSide;

  // only draw the fine details (lights/pipes/ribs) for on-screen segments
  const detailOK = h1 >= 2 && h1 <= H * 0.9;

  ctx.save();
  ctx.globalAlpha = alpha;

  // screen-space gradients (safe no matter how far off-screen the geometry goes)
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H);
  wallGrad.addColorStop(0, `rgb(${8 + shade * 6},${9 + shade * 6},${12 + shade * 5})`);
  wallGrad.addColorStop(0.55, `rgb(${26 + shade * 12},${28 + shade * 12},${34 + shade * 10})`);
  wallGrad.addColorStop(1, `rgb(${48 + shade * 18},${46 + shade * 16},${42 + shade * 12})`);

  const ceilGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  ceilGrad.addColorStop(0, 'rgb(2,3,5)');
  ceilGrad.addColorStop(1, `rgb(${14 + shade * 6},${15 + shade * 6},${20 + shade * 5})`);

  // left wall
  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.moveTo(x1 - h1, y1);
  ctx.lineTo(x2 - h2, y2);
  ctx.lineTo(nearL, y2);
  ctx.lineTo(nearL, topY2);
  ctx.lineTo(farL, topY1);
  ctx.closePath();
  ctx.fill();

  // right wall
  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.moveTo(x1 + h1, y1);
  ctx.lineTo(x2 + h2, y2);
  ctx.lineTo(nearR, y2);
  ctx.lineTo(nearR, topY2);
  ctx.lineTo(farR, topY1);
  ctx.closePath();
  ctx.fill();

  // ceiling
  ctx.fillStyle = ceilGrad;
  ctx.beginPath();
  ctx.moveTo(farL, topY1);
  ctx.lineTo(farR, topY1);
  ctx.lineTo(nearR, topY2);
  ctx.lineTo(nearL, topY2);
  ctx.closePath();
  ctx.fill();

  if (detailOK) {
    drawTunnelPipes(p, x1, y1, h1, topY1, farL, farR, shade);

    // ribs
    if (p.idx % 3 === 0) {
      const ribY1 = y1 - wallH1 * 0.35;
      ctx.strokeStyle = `rgba(190,200,210,${0.10 * shade})`;
      ctx.lineWidth = Math.min(6, Math.max(1, h1 * 0.010));
      ctx.beginPath();
      ctx.moveTo(x1 - h1, ribY1);
      ctx.lineTo(farL, ribY1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1 + h1, ribY1);
      ctx.lineTo(farR, ribY1);
      ctx.stroke();
    }

    // reflectors
    if (p.idx % 2 === 0) {
      const rw = Math.min(20, Math.max(1, h1 * 0.018));
      const ry1 = y1 - wallH1 * 0.18;
      ctx.fillStyle = `rgba(255,205,70,${0.58 * shade})`;
      ctx.fillRect(x1 - h1 * 1.16 - rw / 2, ry1, rw, rw);
      ctx.fillRect(x1 + h1 * 1.16 - rw / 2, ry1, rw, rw);
    }

    // ceiling light
    if (p.idx % TUNNEL_LIGHT_SPACING === 0) {
      const lw = Math.min(W * 0.4, Math.max(6, h1 * 0.72));
      const ly = y1 - wallH1 * 0.84;
      const lh = Math.min(24, Math.max(1, h1 * 0.035));
      ctx.save();
      ctx.shadowColor = 'rgba(255,235,170,0.9)';
      ctx.shadowBlur = Math.min(28, Math.max(6, h1 * 0.03));
      ctx.fillStyle = `rgba(255,245,205,${0.9 * Math.max(0.15, shade)})`;
      ctx.fillRect(x1 - lw, ly - lh / 2, lw * 2, lh);
      ctx.restore();
      ctx.fillStyle = `rgba(255,230,160,${0.05 * shade})`;
      ctx.beginPath();
      ctx.moveTo(x1 - lw, ly);
      ctx.lineTo(x1 - lw * 0.12, y1);
      ctx.lineTo(x1 + lw * 0.12, y1);
      ctx.lineTo(x1 + lw, ly);
      ctx.closePath();
      ctx.fill();
    }

    drawTunnelHeadlights(x1, y1, h1, shade);
  }

  // entrance arch
  if (s1.tunnelEntrance && h1 > 3 && h1 < H * 1.5) {
    const ah = h1;
    const aH = wallH1;
    const postW = Math.min(ah * 0.18, W * 0.05);
    ctx.fillStyle = `rgba(82,86,96,${alpha})`;
    ctx.fillRect(x1 - ah - postW, y1 - aH, postW, aH);
    ctx.fillRect(x1 + ah, y1 - aH, postW, aH);
    ctx.fillStyle = `rgba(64,68,78,${alpha})`;
    ctx.fillRect(x1 - ah - postW, y1 - aH, ah * 2 + postW * 2, postW);
    const fs = Math.max(8, Math.min(ah * 0.17, 40));
    ctx.fillStyle = `rgba(255,204,0,${alpha})`;
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TUNNEL', x1, y1 - aH + postW * 0.55);
    ctx.fillStyle = `rgba(255,255,220,${alpha})`;
    ctx.beginPath();
    ctx.arc(x1 - ah - postW / 2, y1 - aH + postW * 1.25, Math.max(1, Math.min(ah * 0.05, 10)), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x1 + ah + postW / 2, y1 - aH + postW * 1.25, Math.max(1, Math.min(ah * 0.05, 10)), 0, Math.PI * 2);
    ctx.fill();
  }

  // exit glow
  if (s1.tunnelExit && h1 > 3 && h1 < H * 1.5) {
    const ah = h1;
    const aH = wallH1;
    const g2 = ctx.createLinearGradient(0, y1 - aH, 0, y1);
    g2.addColorStop(0, `rgba(215,235,255,${0.36 * alpha})`);
    g2.addColorStop(1, 'rgba(215,235,255,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(x1 - ah, y1 - aH, ah * 2, aH);
  }

  ctx.restore();
}

function drawTunnelOverlay() {
  const idx = Math.floor(position / SEG_LEN) % ROAD_LEN;
  if (!segments[idx].tunnel && !segments[(idx + 1) % ROAD_LEN].tunnel) return;

  const horizonY = Math.floor(H * 0.45);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, horizonY + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(0, horizonY, W, H - horizonY);

  let g = ctx.createLinearGradient(0, 0, 0, H * 0.48);
  g.addColorStop(0, 'rgba(0,0,0,0.82)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.48);

  g = ctx.createLinearGradient(0, 0, W * 0.40, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.78)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W * 0.40, H);

  g = ctx.createLinearGradient(W, 0, W * 0.60, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.78)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(W * 0.60, 0, W * 0.40, H);

  const flick = 0.018 + 0.018 * Math.sin(performance.now() * 0.021);
  ctx.fillStyle = `rgba(0,0,0,${flick})`;
  ctx.fillRect(0, 0, W, H);

  drawTunnelSign();
}

// ── TUNNEL AUDIO ────────────────────────────────────────────
let tunnelAudioCtx = null;
let wasInTunnel = false;

function tunnelChime(type) {
  if (!tunnelAudioCtx) tunnelAudioCtx = new AudioContext();
  const t = tunnelAudioCtx.currentTime;
  const osc = tunnelAudioCtx.createOscillator();
  const gain = tunnelAudioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = type === 'enter' ? 220 : 330;
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain).connect(tunnelAudioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
}

function drawBillboard(s, ssx, y1, sz, h1, shade) {
  if (sz < 4) return;

  // The left side is a rising slope (~0.88 px of height per px of horizontal
  // distance). Lift the base by the slope height at this board's offset so it
  // sits ON the slope (a touch above it) instead of half-buried at road level.
  const lift  = s.off * h1 * 1.05;
  const baseY = y1 - lift;

  const bw = sz * 1.6;
  const bh = sz * 0.7;
  const ph = sz * 0.8;
  const pw = Math.max(1, sz * 0.06);
  const boardTop = baseY - ph - bh;

  const postC  = `rgb(${Math.round(58 + shade*20)},${Math.round(54 + shade*18)},${Math.round(50 + shade*15)})`;
  const boardC = `rgb(${Math.round(26 + shade*14)},${Math.round(26 + shade*14)},${Math.round(38 + shade*14)})`;

  // posts (rise up from the slope)
  ctx.fillStyle = postC;
  ctx.fillRect(ssx - bw*0.4 - pw/2, baseY - ph, pw, ph);
  ctx.fillRect(ssx + bw*0.4 - pw/2, baseY - ph, pw, ph);

  // board
  ctx.fillStyle = boardC;
  ctx.fillRect(ssx - bw/2, boardTop, bw, bh);
  ctx.strokeStyle = `rgba(210,220,235,${0.55*shade})`;
  ctx.lineWidth = Math.max(0.5, sz * 0.02);
  ctx.strokeRect(ssx - bw/2, boardTop, bw, bh);

  // text
  if (sz > 8) {
    const text = BILLBOARD_TEXT.slice(0, 10);
    const fs = Math.min(bh * 0.5, (bw * 0.85) / (Math.max(1, text.length) * 0.6));
    ctx.fillStyle = `rgba(255,214,70,${0.9 * shade})`;
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, ssx, boardTop + bh * 0.5);
  }
}

// ==========================================================
//  RENDER
// ==========================================================
function render(){
  ctx.save();
  if(camShake>.01)ctx.translate((Math.random()-.5)*camShake*25,(Math.random()-.5)*camShake*25);

  const horizonY=Math.floor(H*.45);
  const focal=H*.95;
  const camH=280;
  const baseSeg=Math.floor(position/SEG_LEN);
  const pct=(position%SEG_LEN)/SEG_LEN;
  const playerWX=playerX*ROAD_HALF;
  const _sy0 = segments[baseSeg % ROAD_LEN].y;
  const _sy1 = segments[(baseSeg + 1) % ROAD_LEN].y;
  const playerY = _sy0 + (_sy1 - _sy0) * pct;

  const sg=ctx.createLinearGradient(0,0,0,horizonY);
  sg.addColorStop(0,'#0b1a30');sg.addColorStop(.3,'#162d52');
  sg.addColorStop(.65,'#3a78a8');sg.addColorStop(1,'#a8d4ee');
  ctx.fillStyle=sg;ctx.fillRect(0,0,W,horizonY+2);

  ctx.globalAlpha=.3;
  const ct=performance.now()*.00002;
  for(let i=0;i<7;i++){
    const cx2=((i*311+ct*60*(1+i*.25))%(W+400))-200;
    const cy2=horizonY*.08+(i%4)*horizonY*.12;
    const cw=90+(i%4)*80;
    ctx.fillStyle='rgba(255,255,255,'+(0.12+(i%3)*.07)+')';
    ctx.beginPath();ctx.ellipse(cx2,cy2,cw,14+(i%3)*8,0,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  const og=ctx.createLinearGradient(0,horizonY,0,H);
  og.addColorStop(0,'#2a6496');og.addColorStop(.35,'#1a5080');og.addColorStop(1,'#0a2a44');
  ctx.fillStyle=og;ctx.fillRect(0,horizonY,W,H-horizonY);
  ctx.globalAlpha=.1;
  for(let i=0;i<40;i++){
    const ox=((i*197+position*.012)%(W+200))-100;
    const oy=horizonY+8+(i*43)%(H-horizonY-8);
    ctx.fillStyle='#aaddff';ctx.fillRect(ox,oy,12+(i%5)*12,1.2);
  }
  ctx.globalAlpha=1;

  drawHorizon();

  const fg=ctx.createLinearGradient(0,horizonY-35,0,horizonY+30);
  fg.addColorStop(0,'rgba(170,200,230,0)');
  fg.addColorStop(.5,'rgba(170,200,230,.35)');
  fg.addColorStop(1,'rgba(170,200,230,0)');
  ctx.fillStyle=fg;ctx.fillRect(0,horizonY-35,W,65);

  const proj=[];
  let cxWorld=0,dcx=0;
  for(let n=0;n<DRAW_DIST;n++){
    const idx=(baseSeg+n)%ROAD_LEN;
    const z=(n+1-pct)*SEG_LEN;
    if(z<1)continue;
    const frac=(n===0)?(1-pct):1;
    dcx+=segments[idx].curve*frac*SEG_LEN*CURVE_K;
    cxWorld+=dcx*frac;
    const scale=focal/z;
    // -playerAngle*z : the camera looks along the CAR's heading, so the
    // road at distance z is offset by the car's heading divergence
    const sx=W/2+(cxWorld - playerWX - playerAngle*z)*scale;
    const ELEV_EXAG=2.5;
    const sy=horizonY+(camH-(segments[idx].y-playerY)*ELEV_EXAG)*scale;
    const hw=ROAD_HALF*scale;
    proj.push({idx,sx,sy,hw,scale,sprites:segments[idx].sprites,n});
  }

  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i];
    const q=i>0?proj[i-1]:null;
    if(!q)continue;
    const y1=p.sy,y2=q.sy,x1=p.sx,x2=q.sx;
    const hw1=p.hw,hw2=q.hw;
    const h1=hw1/2,h2=hw2/2;
    const envH1=h1/2, envH2=h2/2;
    if(h1<.3||h2<.3)continue;
    const shade=Math.max(0,1-i/DRAW_DIST);

    // cliff
    const cliffDrop1=Math.min(envH1*CLIFF_HEIGHT_RATIO,H-y1);
    const cliffDrop2=Math.min(envH2*CLIFF_HEIGHT_RATIO,H-y2)
    const cliffSpread1=cliffDrop1*1.5;
    const cliffSpread2=cliffDrop2*1.5;
    if(cliffDrop1>2){
      const cg=ctx.createLinearGradient(0,y1,0,y1+cliffDrop1);
      cg.addColorStop(0,`rgb(${95+shade*45},${72+shade*30},${48+shade*20})`);
      cg.addColorStop(.35,`rgb(${72+shade*28},${52+shade*20},${36+shade*14})`);
      cg.addColorStop(1,'rgb(42,32,22)');
      ctx.fillStyle=cg;
      ctx.beginPath();
      ctx.moveTo(x1+h1,y1);ctx.lineTo(x2+h2,y2);
      ctx.lineTo(x2+h2+cliffSpread2,y2+cliffDrop2);
      ctx.lineTo(x1+h1+cliffSpread1,y1+cliffDrop1);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle=`rgba(140,110,75,${0.12*shade})`;ctx.lineWidth=1;
      for(let s=1;s<4;s++){
        const fy1=y1+cliffDrop1*s/4, fy2=y2+cliffDrop2*s/4;
        ctx.beginPath();ctx.moveTo(x1+h1,fy1);ctx.lineTo(x2+h2,fy2);ctx.stroke();
      }
    }

    // terrain (left)
    const terrW1=envH1*3.5,terrW2=envH2*3.5;
    const terrH1=Math.max(envH1*HILL_HEIGHT_RATIO,12),terrH2=Math.max(envH2*HILL_HEIGHT_RATIO,12);
    if(terrW1>1){
      const tg=ctx.createLinearGradient(x1-h1-terrW1,y1-terrH1,x1-h1,y1+terrH1*.3);
      tg.addColorStop(0,`rgb(${32+shade*14},${62+shade*28},${28+shade*10})`);
      tg.addColorStop(.5,`rgb(${48+shade*20},${76+shade*30},${36+shade*14})`);
      tg.addColorStop(1,`rgb(${38+shade*12},${58+shade*20},${30+shade*8})`);
      ctx.fillStyle=tg;
      ctx.beginPath();
      ctx.moveTo(x1-h1,y1);ctx.lineTo(x2-h2,y2);
      ctx.lineTo(x2-h2-terrW2,y2-terrH2);
      ctx.lineTo(x1-h1-terrW1,y1-terrH1*1.1);
      ctx.lineTo(x1-h1-terrW1*.5,y1-terrH1*.5);
      ctx.closePath();ctx.fill();
    }

    // road
    const r=Math.floor(50+shade*40),g=Math.floor(50+shade*40),b=Math.floor(54+shade*40);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(x1-h1,y1);ctx.lineTo(x1+h1,y1);
    ctx.lineTo(x2+h2,y2);ctx.lineTo(x2-h2,y2);
    ctx.closePath();ctx.fill();

    // shoulders
    const shW1=Math.max(1,h1*.08),shW2=Math.max(1,h2*.08);
    ctx.fillStyle=`rgba(80,80,85,${0.4*shade})`;
    ctx.beginPath();ctx.moveTo(x1-h1,y1);ctx.lineTo(x1-h1+shW1,y1);ctx.lineTo(x2-h2+shW2,y2);ctx.lineTo(x2-h2,y2);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(x1+h1-shW1,y1);ctx.lineTo(x1+h1,y1);ctx.lineTo(x2+h2,y2);ctx.lineTo(x2+h2-shW2,y2);ctx.closePath();ctx.fill();

    // edge lines
    const ew1=Math.max(1,h1*.05),ew2=Math.max(1,h2*.05);
    ctx.fillStyle=`rgba(255,255,255,${0.75*shade})`;
    ctx.beginPath();ctx.moveTo(x1-h1,y1);ctx.lineTo(x1-h1+ew1,y1);ctx.lineTo(x2-h2+ew2,y2);ctx.lineTo(x2-h2,y2);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(x1+h1-ew1,y1);ctx.lineTo(x1+h1,y1);ctx.lineTo(x2+h2,y2);ctx.lineTo(x2+h2-ew2,y2);ctx.closePath();ctx.fill();

    // center dashes
    if(p.idx%8<4){
      ctx.fillStyle=`rgba(255,210,40,${0.55*shade})`;
      const cw1=Math.max(1,h1*.025),cw2=Math.max(1,h2*.025);
      ctx.beginPath();ctx.moveTo(x1-cw1/2,y1);ctx.lineTo(x1+cw1/2,y1);ctx.lineTo(x2+cw2/2,y2);ctx.lineTo(x2-cw2/2,y2);ctx.closePath();ctx.fill();
    }
    // lane lines
    if(p.idx%6<3){
      ctx.fillStyle=`rgba(255,255,255,${0.22*shade})`;
      for(let ln=-1;ln<=1;ln+=2){
        const lx1=x1+h1*ln*.42,lx2=x2+h2*ln*.42;
        const lw1=Math.max(.5,h1*.012),lw2=Math.max(.5,h2*.012);
        ctx.beginPath();ctx.moveTo(lx1-lw1/2,y1);ctx.lineTo(lx1+lw1/2,y1);ctx.lineTo(lx2+lw2/2,y2);ctx.lineTo(lx2-lw2/2,y2);ctx.closePath();ctx.fill();
      }
    }

    // sprites
    for(const s of p.sprites){
      const ssx=x1+s.side*(h1+s.off*envH1);
      const sz=envH1*.55;
      if(sz<1.5)continue;
      if(s.type===0){
        const trunkH=sz*.35;
        ctx.fillStyle=`rgb(${55+shade*15},${40+shade*10},20)`;
        ctx.fillRect(ssx-sz*.04,y1-sz*.12,sz*.08,trunkH);
        ctx.fillStyle=`rgb(${35+shade*22},${65+shade*30},${25+shade*10})`;
        ctx.beginPath();ctx.moveTo(ssx,y1-sz*2.5);ctx.lineTo(ssx-sz*.45,y1-sz*.12);ctx.lineTo(ssx+sz*.45,y1-sz*.12);ctx.closePath();ctx.fill();
        ctx.fillStyle=`rgb(${45+shade*18},${75+shade*28},${30+shade*10})`;
        ctx.beginPath();ctx.moveTo(ssx,y1-sz*1.8);ctx.lineTo(ssx-sz*.32,y1-sz*.4);ctx.lineTo(ssx+sz*.32,y1-sz*.4);ctx.closePath();ctx.fill();
      }else if(s.type===4){
        const trunkW=sz*.07, trunkH=sz*.5;
        ctx.fillStyle=`rgb(${70+shade*20},${48+shade*14},${28+shade*8})`;
        ctx.fillRect(ssx-trunkW/2, y1-sz*.15, trunkW, trunkH);
        ctx.fillStyle=`rgb(${38+shade*18},${72+shade*24},${28+shade*8})`;
        ctx.beginPath();ctx.ellipse(ssx, y1-sz*.7, sz*.5, sz*.38, 0, 0, Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${48+shade*20},${85+shade*26},${32+shade*10})`;
        ctx.beginPath();ctx.ellipse(ssx-sz*.12, y1-sz*1.05, sz*.38, sz*.3, 0, 0, Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(ssx+sz*.14, y1-sz*1.0, sz*.35, sz*.28, 0, 0, Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${58+shade*16},${95+shade*22},${38+shade*8})`;
        ctx.beginPath();ctx.ellipse(ssx, y1-sz*1.3, sz*.28, sz*.22, 0, 0, Math.PI*2);ctx.fill();
      }else if(s.type===5){
        const trunkW=sz*.035, trunkH=sz*.45;
        ctx.fillStyle=`rgb(${60+shade*14},${42+shade*10},${25+shade*6})`;
        ctx.fillRect(ssx-trunkW/2, y1-sz*.1, trunkW, trunkH);
        ctx.fillStyle=`rgb(${25+shade*12},${55+shade*18},${22+shade*6})`;
        ctx.beginPath();ctx.ellipse(ssx, y1-sz*1.5, sz*.18, sz*.95, 0, 0, Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${32+shade*14},${68+shade*20},${26+shade*7})`;
        ctx.beginPath();ctx.ellipse(ssx, y1-sz*1.2, sz*.22, sz*.7, 0, 0, Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${40+shade*12},${78+shade*18},${30+shade*6})`;
        ctx.beginPath();ctx.ellipse(ssx, y1-sz*.85, sz*.16, sz*.45, 0, 0, Math.PI*2);ctx.fill();
      }else if(s.type===1){
        ctx.fillStyle=`rgb(${85+shade*20},${78+shade*16},${68+shade*12})`;
        ctx.beginPath();ctx.ellipse(ssx,y1-sz*.12,sz*.38,sz*.22,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${70+shade*15},${65+shade*12},${58+shade*10})`;
        ctx.beginPath();ctx.ellipse(ssx-sz*.12,y1-sz*.06,sz*.2,sz*.13,0,0,Math.PI*2);ctx.fill();
      }else if(s.type===2){
        ctx.fillStyle=`rgb(${30+shade*15},${75+shade*25},${25+shade*8})`;
        ctx.beginPath();ctx.ellipse(ssx,y1-sz*.08,sz*.32,sz*.2,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgb(${40+shade*12},${85+shade*22},${30+shade*8})`;
        ctx.beginPath();ctx.ellipse(ssx+sz*.1,y1-sz*.12,sz*.2,sz*.13,0,0,Math.PI*2);ctx.fill();
      }else if(s.type===6){
        drawBillboard(s, ssx, y1, sz, envH1, shade);
      }else{
        ctx.strokeStyle=`rgb(${50+shade*15},${80+shade*20},${30+shade*8})`;
        ctx.lineWidth=Math.max(1,sz*.02);
        for(let g=0;g<4;g++){
          const gx=ssx+(g-1.5)*sz*.09;
          ctx.beginPath();ctx.moveTo(gx,y1);
          ctx.quadraticCurveTo(gx+sz*.03*(g-1.5),y1-sz*.75,gx+sz*.05*(g-1.5),y1-sz*1.1);
          ctx.stroke();
        }
      }
    }

    // guardrail on sharp right-hand (negative curve) sections
    const segCurve=segments[p.idx].curve;
    if(segCurve<-4&&h1>2){
      const railH1=Math.max(2,envH1*0.14);
      const railH2=Math.max(2,envH2*0.14);
      const gx1=x1+h1+Math.max(1,envH1*0.012);
      const gx2=x2+h2+Math.max(1,envH2*0.012);
      const gy1t=y1-railH1;
      const gy2t=y2-railH2;
      const pg=ctx.createLinearGradient(0,gy1t,0,y1);
      pg.addColorStop(0,`rgba(195,200,212,${0.88*shade})`);
      pg.addColorStop(0.45,`rgba(158,163,175,${0.82*shade})`);
      pg.addColorStop(1,`rgba(112,118,130,${0.78*shade})`);
      ctx.fillStyle=pg;
      ctx.beginPath();ctx.moveTo(gx1,gy1t);ctx.lineTo(gx2,gy2t);ctx.lineTo(gx2,y2);ctx.lineTo(gx1,y1);ctx.closePath();ctx.fill();
      const bw1=Math.max(1,envH1*0.014),bw2=Math.max(1,envH2*0.014);
      ctx.fillStyle=`rgba(225,230,240,${0.92*shade})`;
      ctx.beginPath();ctx.moveTo(gx1,gy1t);ctx.lineTo(gx2,gy2t);ctx.lineTo(gx2,gy2t+bw2);ctx.lineTo(gx1,gy1t+bw1);ctx.closePath();ctx.fill();
      const my1=y1-railH1*0.52,my2=y2-railH2*0.52;
      ctx.fillStyle=`rgba(170,176,188,${0.72*shade})`;
      ctx.beginPath();ctx.moveTo(gx1,my1-bw1*0.5);ctx.lineTo(gx2,my2-bw2*0.5);ctx.lineTo(gx2,my2+bw2*0.5);ctx.lineTo(gx1,my1+bw1*0.5);ctx.closePath();ctx.fill();
      ctx.fillStyle=`rgba(95,100,112,${0.82*shade})`;
      ctx.beginPath();ctx.moveTo(gx1,y1-bw1);ctx.lineTo(gx2,y2-bw2);ctx.lineTo(gx2,y2);ctx.lineTo(gx1,y1);ctx.closePath();ctx.fill();
      ctx.strokeStyle=`rgba(255,255,255,${0.30*shade})`;
      ctx.lineWidth=Math.max(0.5,envH1*0.004);
      ctx.beginPath();ctx.moveTo(gx1,gy1t);ctx.lineTo(gx2,gy2t);ctx.stroke();
    }

    drawTunnelStrip(p, q, x1, y1, h1, x2, y2, h2, shade);
    drawStartFinishArch(p, q, x1, y1, h1, x2, y2, h2, shade);
  }

  // speed lines
  if(speed>maxSpeed*.55){
    const si=(speed/maxSpeed-.55)/.45;
    ctx.globalAlpha=si*.22;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
    for(let i=0;i<12;i++){
      const ly=H*.28+(i-6)*40;
      ctx.beginPath();
      if(i<6){ctx.moveTo(5+i*20,ly);ctx.lineTo(W*.3,ly)}
      else{ctx.moveTo(W-5-(i-6)*20,ly);ctx.lineTo(W*.7,ly)}
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  drawWindshieldCracks(horizonY);
  drawCockpit();

  if(navigator.getGamepads){
    const pads=navigator.getGamepads();
    for(const p of pads)if(p&&p.connected){
      ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='12px sans-serif';ctx.textAlign='left';
      ctx.fillText('\uD83C\uDFAE '+p.id.substring(0,28),22,22);break;
    }
  }

  if(crashTimer>0){
    ctx.fillStyle=`rgba(255,30,30,${crashTimer*.18})`;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff';ctx.font='bold '+Math.min(42,W*.033)+'px sans-serif';ctx.textAlign='center';
    ctx.fillText('\u26A0\uFE0F OFF THE ROAD! \u26A0\uFE0F',W/2,H/2);
  }

  if(damageFlash>0.02){
    ctx.fillStyle=`rgba(255,80,0,${damageFlash*0.12})`;
    ctx.fillRect(0,0,W,H);
  }

  for(const pop of damagePopups){
    const alpha=Math.min(1,pop.life);
    ctx.fillStyle=`rgba(255,60,30,${alpha})`;
    ctx.font='bold '+Math.min(36,W*.028)+'px sans-serif';
    ctx.textAlign='center';
    ctx.fillText(pop.text,pop.x,pop.y);
  }

  ctx.restore();
  drawMinimap();
  drawLapHUD();
}

// ── WINDSHIELD CRACKS ──
function drawWindshieldCracks(horizonY){
  if(damage<20)return;
  const numCracks=Math.min(crackSeeds.length,Math.floor((damage-10)/12)+1);
  ctx.save();
  ctx.globalAlpha=Math.min(0.6,(damage-15)/80);
  ctx.strokeStyle='rgba(200,220,255,0.7)';
  ctx.lineWidth=1.2;
  for(let i=0;i<numCracks;i++){
    const pts=crackSeeds[i];
    if(!pts||pts.length<2)continue;
    ctx.beginPath();
    ctx.moveTo(pts[0].x,pts[0].y);
    for(let j=1;j<pts.length;j++)ctx.lineTo(pts[j].x,pts[j].y);
    ctx.stroke();
  }
  ctx.restore();
}

