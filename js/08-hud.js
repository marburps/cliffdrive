// 08-hud.js — Dash: speedo, tachometer, right cluster, roundRect, game loop
// Split from main.js (lines 1988–2370); keep load order in index.html.

/* ============================================================
   COCKPIT
   ============================================================ */
function drawCockpit(){
  const dh=H*0.28;
  const dy=H-dh;

  ctx.fillStyle='#0a0a0e';
  ctx.fillRect(0,0,W,H*0.05);
  ctx.strokeStyle='rgba(255,255,255,0.04)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,H*0.05);ctx.lineTo(W,H*0.05);ctx.stroke();

  const lg=ctx.createLinearGradient(0,0,W*0.12,0);
  lg.addColorStop(0,'#050508');lg.addColorStop(.6,'#14141c');lg.addColorStop(1,'#1d1d26');
  ctx.fillStyle=lg;
  ctx.beginPath();ctx.moveTo(0,H*0.05);ctx.lineTo(W*0.05,H*0.05);ctx.lineTo(W*0.12,dy);ctx.lineTo(0,dy);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(120,140,180,0.08)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(W*0.05,H*0.05);ctx.lineTo(W*0.12,dy);ctx.stroke();

  const rg=ctx.createLinearGradient(W,0,W*0.88,0);
  rg.addColorStop(0,'#050508');rg.addColorStop(.6,'#14141c');rg.addColorStop(1,'#1d1d26');
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.moveTo(W,H*0.05);ctx.lineTo(W*0.95,H*0.05);ctx.lineTo(W*0.88,dy);ctx.lineTo(W,dy);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(120,140,180,0.08)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(W*0.95,H*0.05);ctx.lineTo(W*0.88,dy);ctx.stroke();

  const dg=ctx.createLinearGradient(0,dy,0,H);
  dg.addColorStop(0,'#20202c');dg.addColorStop(.25,'#2a2a3a');dg.addColorStop(.6,'#1a1a24');dg.addColorStop(1,'#08080c');
  ctx.fillStyle=dg;
  ctx.beginPath();
  ctx.moveTo(0,dy+18);
  ctx.quadraticCurveTo(W*0.18,dy-18,W*0.5,dy-6);
  ctx.quadraticCurveTo(W*0.82,dy-18,W,dy+18);
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(160,180,220,0.12)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,dy+18);
  ctx.quadraticCurveTo(W*0.18,dy-18,W*0.5,dy-6);
  ctx.quadraticCurveTo(W*0.82,dy-18,W,dy+18);ctx.stroke();

  ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(W*0.05,dy+H*0.05);
  ctx.quadraticCurveTo(W*0.5,dy+H*0.02,W*0.95,dy+H*0.05);ctx.stroke();

  drawSteeringWheel(W*0.16,H*0.83,Math.min(H*0.14,W*0.09));
  drawTachometer(W*0.38,H*0.79,Math.min(H*0.16,W*0.085));
  drawSpeedo(W*0.62,H*0.79,Math.min(H*0.16,W*0.085));
  drawRightCluster(W*0.84,H*0.82,Math.min(H*0.12,W*0.06));

  const hg=ctx.createLinearGradient(0,H-H*0.04,0,H);
  hg.addColorStop(0,'rgba(10,10,14,0)');
  hg.addColorStop(1,'rgba(10,10,14,0.9)');
  ctx.fillStyle=hg;
  ctx.beginPath();ctx.moveTo(W*0.35,H);ctx.quadraticCurveTo(W*0.5,H-H*0.045,W*0.65,H);ctx.closePath();ctx.fill();

  drawRearviewMirror();
}

/* ============================================================
   REARVIEW MIRROR — mini render of the track behind the car
   ============================================================ */
function drawRearviewMirror(){
  // mirror body: left dark pillar area, outside the windscreen
  const mw = Math.max(60, W*0.075);
  const mh = Math.max(90, H*0.16);
  const mx = W*0.028;
  const my = H*0.50;

  ctx.save();

  // mount neck into the door
  ctx.strokeStyle='#15151e';
  ctx.lineWidth=Math.max(2, mw*0.06);
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(mx, my+mh*0.55);
  ctx.lineTo(mx-Math.max(4, mw*0.12), my+mh*0.62);
  ctx.stroke();

  // frame
  ctx.fillStyle='#11111a';
  roundRect(mx-mw*0.06, my-mh*0.05, mw*1.12, mh*1.10, mw*0.07);
  ctx.fill();
  ctx.strokeStyle='#39414f';
  ctx.lineWidth=1.5;
  roundRect(mx-mw*0.06, my-mh*0.05, mw*1.12, mh*1.10, mw*0.07);
  ctx.stroke();

  // mirrored view, clipped to the glass
  roundRect(mx, my, mw, mh, mw*0.05);
  ctx.clip();

  // sky + ground
  const skyH=mh*0.45;
  const sg=ctx.createLinearGradient(0,my,0,my+skyH);
  sg.addColorStop(0,'#12263f'); sg.addColorStop(1,'#7db4dc');
  ctx.fillStyle=sg;
  ctx.fillRect(mx,my,mw,skyH);
  const og=ctx.createLinearGradient(0,my+skyH,0,my+mh);
  og.addColorStop(0,'#1c4066'); og.addColorStop(1,'#08141f');
  ctx.fillStyle=og;
  ctx.fillRect(mx,my+skyH,mw,mh-skyH);

  // road receding behind the car (main-projection math with z going negative)
  const nearY=my+mh*0.97, farY=my+skyH*0.8;
  const cx=mx+mw*0.5;
  const focal=Math.max(10, mw*0.12)/5;           // wide-angle: 1/4 focal = 4x field of view
  const N=16;
  const baseSeg=Math.floor(P.position/SEG_LEN);
  const baseY = segments[baseSeg % ROAD_LEN].y;
  const camH=280;
  const playerWX=P.playerX*ROAD_HALF;

  const pts=[];
  let dcx=0, cxWorld=0;
  for(let n=1;n<=N;n++){
    const z=n*8;                                   // mirror depth per slice
    const idx=(baseSeg-n+ROAD_LEN*4)%ROAD_LEN;
    dcx += segments[idx].curve*8*CURVE_K;
    cxWorld += -dcx;                              // mirrored: rear view inverts curve drift
    const scale=focal/z;
    const sy = farY + (camH - (segments[idx].y - baseY)*2.5) * scale * (nearY-farY)/camH;
    const sx = cx + (cxWorld - playerWX) * scale;
    pts.push({sx:Math.max(mx,Math.min(mx+mw+40,sx)), sy:Math.max(farY,Math.min(nearY,sy)), hw:Math.max(1,ROAD_HALF*scale)});
  }

  // draw far slice first
  for(let i=N-1;i>=1;i--){
    const a=pts[i], b=pts[i-1];
    ctx.fillStyle='#343440';
    ctx.beginPath();
    ctx.moveTo(a.sx-a.hw,a.sy);ctx.lineTo(a.sx+a.hw,a.sy);
    ctx.lineTo(b.sx+b.hw,b.sy);ctx.lineTo(b.sx-b.hw,b.sy);
    ctx.closePath();ctx.fill();
    if(a.hw>1.2){
      const ew=Math.max(0.5,a.hw*0.08);
      ctx.fillStyle='rgba(225,230,240,0.65)';
      ctx.beginPath();ctx.moveTo(a.sx-a.hw,a.sy);ctx.lineTo(a.sx-a.hw+ew,a.sy);ctx.lineTo(b.sx-b.hw+ew*0.8,b.sy);ctx.lineTo(b.sx-b.hw,b.sy);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(a.sx+a.hw,a.sy);ctx.lineTo(a.sx+a.hw-ew,a.sy);ctx.lineTo(b.sx+b.hw-ew*0.8,b.sy);ctx.lineTo(b.sx+b.hw,b.sy);ctx.closePath();ctx.fill();
      if(i%3===0){
        const cw=Math.max(0.5,a.hw*0.05);
        ctx.fillStyle='rgba(255,210,40,0.5)';
        ctx.beginPath();ctx.moveTo(a.sx-cw/2,a.sy);ctx.lineTo(a.sx+cw/2,a.sy);ctx.lineTo(b.sx+cw*0.4,b.sy);ctx.lineTo(b.sx-cw*0.4,b.sy);ctx.closePath();ctx.fill();
      }
    }
  }

  // glass tint + specular streak
  ctx.fillStyle='rgba(70,110,150,0.10)';
  ctx.fillRect(mx,my,mw,mh);
  const spg=ctx.createLinearGradient(mx,my,mx+mw,my+mh);
  spg.addColorStop(0,'rgba(255,255,255,0)');
  spg.addColorStop(0.35,'rgba(255,255,255,0)');
  spg.addColorStop(0.45,'rgba(255,255,255,0.10)');
  spg.addColorStop(0.55,'rgba(255,255,255,0)');
  spg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=spg;
  ctx.fillRect(mx,my,mw,mh);

  ctx.restore();
}

function drawSteeringWheel(cx,cy,r){
  ctx.save();ctx.translate(cx,cy);ctx.rotate(P.steer*0.95);
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath();ctx.ellipse(0,r*0.15,r*1.05,r*0.4,0,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=r*0.2;ctx.strokeStyle='#0a0a10';
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
  ctx.lineWidth=r*0.14;ctx.strokeStyle='#2a2a34';
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
  ctx.lineWidth=r*0.06;ctx.strokeStyle='rgba(255,255,255,0.07)';
  ctx.beginPath();ctx.arc(0,0,r*1.0,-Math.PI*0.9,-Math.PI*0.1);ctx.stroke();
  ctx.strokeStyle='#1e1e28';ctx.lineWidth=r*0.11;ctx.lineCap='round';
  for(let i=0;i<3;i++){
    const a=-Math.PI/2+i*(Math.PI*2/3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r*0.32,Math.sin(a)*r*0.32);
    ctx.lineTo(Math.cos(a)*r*0.95,Math.sin(a)*r*0.95);
    ctx.stroke();
  }
  const hub=ctx.createRadialGradient(0,0,0,0,0,r*0.34);
  hub.addColorStop(0,'#3a3a48');hub.addColorStop(1,'#14141a');
  ctx.fillStyle=hub;
  ctx.beginPath();ctx.arc(0,0,r*0.34,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#48485a';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,0,r*0.34,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#8aa0c0';
  ctx.beginPath();ctx.arc(0,0,r*0.08,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawTachometer(cx,cy,r){
  const MAX_RPM=8500;
  const REDLINE=7000;
  const rpmFrac=Math.min(1,P.rpm/MAX_RPM);
  const a0=Math.PI*0.75;
  const a1=Math.PI*2.25;
  const aNow=a0+(a1-a0)*rpmFrac;

  ctx.save();
  ctx.fillStyle='#050508';
  ctx.beginPath();ctx.arc(cx,cy,r+5,0,Math.PI*2);ctx.fill();
  const fg=ctx.createRadialGradient(cx,cy-r*0.2,r*0.1,cx,cy,r);
  fg.addColorStop(0,'#181820');
  fg.addColorStop(1,'#020204');
  ctx.fillStyle=fg;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#3a3a4c';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();

  const rlStart=a0+(a1-a0)*(REDLINE/MAX_RPM);
  ctx.strokeStyle='rgba(255,30,30,0.6)';
  ctx.lineWidth=r*0.13;
  ctx.beginPath();ctx.arc(cx,cy,r*0.76,rlStart,a1);ctx.stroke();

  for(let i=0;i<=8500;i+=1000){
    const f=i/MAX_RPM;
    const a=a0+(a1-a0)*f;
    const major=i%2000===0;
    const r1=r*(major?0.58:0.66);
    const r2=r*0.8;
    const inRed=i>=REDLINE;
    ctx.strokeStyle=inRed?'#ff4444':(major?'#e6ecf5':'#7888a0');
    ctx.lineWidth=major?2.5:1;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);
    ctx.stroke();
    if(major){
      ctx.fillStyle=inRed?'#ff6666':'#d8e2f0';
      ctx.font='bold '+Math.max(8,r*0.14)+'px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(i/1000+(i===0?'':(i===8500?'':'x')),cx+Math.cos(a)*r*0.44,cy+Math.sin(a)*r*0.44);
    }
  }
  ctx.fillStyle='#667';
  ctx.font=Math.max(7,r*0.09)+'px sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('x1000',cx,cy+r*0.25);
  ctx.fillStyle='#889';
  ctx.font='bold '+Math.max(8,r*0.11)+'px sans-serif';
  ctx.fillText('RPM',cx,cy-r*0.35);

  const inRedZone=P.rpm>=REDLINE;
  ctx.strokeStyle=inRedZone?'#ff2222':'#ffcc22';
  ctx.lineWidth=Math.max(2.5,r*0.04);
  ctx.lineCap='round';
  ctx.shadowColor=inRedZone?'rgba(255,30,30,0.7)':'rgba(255,200,30,0.4)';
  ctx.shadowBlur=inRedZone?12:6;
  ctx.beginPath();
  ctx.moveTo(cx-Math.cos(aNow)*r*0.1,cy-Math.sin(aNow)*r*0.1);
  ctx.lineTo(cx+Math.cos(aNow)*r*0.65,cy+Math.sin(aNow)*r*0.65);
  ctx.stroke();
  ctx.shadowBlur=0;

  ctx.fillStyle='#0a0a10';
  ctx.beginPath();ctx.arc(cx,cy,r*0.12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a3a48';
  ctx.beginPath();ctx.arc(cx,cy,r*0.06,0,Math.PI*2);ctx.fill();

  ctx.fillStyle=inRedZone?'#ff4444':'#aaffcc';
  ctx.font='bold '+Math.max(12,r*0.2)+'px "Courier New",monospace';
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText(Math.round(P.rpm).toString(),cx,cy+r*0.55);

  ctx.fillStyle='#ffffff';
  ctx.font='bold '+Math.max(14,r*0.3)+'px "Courier New",monospace';
  ctx.textAlign='center';
  ctx.fillText(P.gear.toString(),cx+r*0.35,cy+r*0.05);
  ctx.fillStyle='#667';
  ctx.font=Math.max(7,r*0.09)+'px sans-serif';
  ctx.fillText('GEAR',cx+r*0.35,cy+r*0.2);

  if(P.shiftFlash>0.05){
    ctx.fillStyle=`rgba(100,200,255,${P.shiftFlash*0.15})`;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawSpeedo(cx,cy,r){
  const maxK=340;
  const kmh=Math.round(P.speed/100);
  const frac=Math.min(1,kmh/maxK);
  const a0=Math.PI*0.75;
  const a1=Math.PI*2.25;
  const aNow=a0+(a1-a0)*frac;
  ctx.save();
  ctx.fillStyle='#050508';
  ctx.beginPath();ctx.arc(cx,cy,r+5,0,Math.PI*2);ctx.fill();
  const fg=ctx.createRadialGradient(cx,cy-r*0.2,r*0.1,cx,cy,r);
  fg.addColorStop(0,'#14141c');fg.addColorStop(1,'#020204');
  ctx.fillStyle=fg;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#3a3a4c';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();

  const gearCapKmh=GEAR_MAX[P.gear-1]/100;
  const gearCapFrac=Math.min(1,gearCapKmh/maxK);
  const gearCapAngle=a0+(a1-a0)*gearCapFrac;
  ctx.strokeStyle='rgba(80,180,255,0.7)';
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(cx+Math.cos(gearCapAngle)*r*0.55,cy+Math.sin(gearCapAngle)*r*0.55);
  ctx.lineTo(cx+Math.cos(gearCapAngle)*r*0.85,cy+Math.sin(gearCapAngle)*r*0.85);
  ctx.stroke();

  const rl=a0+(a1-a0)*0.85;
  ctx.strokeStyle='rgba(255,50,50,0.55)';ctx.lineWidth=r*0.14;
  ctx.beginPath();ctx.arc(cx,cy,r*0.76,rl,a1);ctx.stroke();
  for(let i=0;i<=maxK;i+=20){
    const f=i/maxK;
    const a=a0+(a1-a0)*f;
    const major=i%60===0;
    const r1=r*(major?0.6:0.68);
    const r2=r*0.82;
    ctx.strokeStyle=major?'#e6ecf5':'#7888a0';
    ctx.lineWidth=major?2.5:1.2;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);
    ctx.stroke();
    if(major){
      ctx.fillStyle='#d8e2f0';
      ctx.font='bold '+Math.max(9,r*0.15)+'px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(''+i,cx+Math.cos(a)*r*0.46,cy+Math.sin(a)*r*0.46);
    }
  }
  ctx.strokeStyle='#ff2828';ctx.lineWidth=Math.max(3,r*0.045);ctx.lineCap='round';
  ctx.shadowColor='rgba(255,40,40,0.5)';ctx.shadowBlur=8;
  ctx.beginPath();
  ctx.moveTo(cx-Math.cos(aNow)*r*0.12,cy-Math.sin(aNow)*r*0.12);
  ctx.lineTo(cx+Math.cos(aNow)*r*0.68,cy+Math.sin(aNow)*r*0.68);
  ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#0a0a10';
  ctx.beginPath();ctx.arc(cx,cy,r*0.13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a3a48';
  ctx.beginPath();ctx.arc(cx,cy,r*0.07,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#8fe0ff';
  ctx.font='bold '+Math.max(14,r*0.26)+'px "Courier New",monospace';
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText(kmh,cx,cy+r*0.55);
  ctx.font=Math.max(9,r*0.11)+'px sans-serif';ctx.fillStyle='#6a8';
  ctx.fillText('km/h',cx,cy+r*0.74);
  if(P.braking>0.15){
    ctx.fillStyle=`rgba(255,60,60,${0.4+P.braking*0.55})`;
    ctx.font='bold '+Math.max(10,r*0.15)+'px sans-serif';
    ctx.fillText('BRAKE',cx,cy-r*0.62);
  }
  if(P.accel>0.15){
    ctx.fillStyle=`rgba(90,255,140,${0.35+P.accel*0.4})`;
    ctx.font='bold '+Math.max(9,r*0.12)+'px sans-serif';
    ctx.fillText('THROTTLE',cx,cy-r*0.78);
  }
  ctx.restore();
}


function drawRightCluster(cx,cy,r){
  ctx.save();
  const hw=r*2.0,hh=r*2.8;
  ctx.fillStyle='rgba(0,0,0,0.55)';
  roundRect(cx-hw/2,cy-hh/2,hw,hh,10);ctx.fill();
  ctx.strokeStyle='rgba(80,120,160,0.35)';ctx.lineWidth=1.5;
  roundRect(cx-hw/2,cy-hh/2,hw,hh,10);ctx.stroke();
  ctx.fillStyle='rgba(120,180,255,0.04)';
  roundRect(cx-hw/2+3,cy-hh/2+3,hw-6,hh-6,8);ctx.fill();

  ctx.fillStyle='#8fc';
  ctx.font='bold '+Math.max(11,r*0.36)+'px "Courier New",monospace';
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  const d=(P.distance/100000).toFixed(2);
  ctx.fillText(d+' km',cx,cy-hh/2+r*0.38);
  ctx.fillStyle='#789';ctx.font=Math.max(8,r*0.18)+'px sans-serif';
  ctx.fillText('DISTANCE',cx,cy-hh/2+r*0.58);

  const stickH=r*1.1,stickW=r*0.16;
  const sTop=cy-stickH/2,sBot=cy+stickH/2;
  ctx.fillStyle='rgba(0,0,0,0.55)';
  roundRect(cx-stickW/2,sTop,stickW,stickH,stickW/2);ctx.fill();
  ctx.strokeStyle='rgba(100,130,170,0.35)';ctx.lineWidth=1;
  roundRect(cx-stickW/2,sTop,stickW,stickH,stickW/2);ctx.stroke();

  for(let g=1;g<=6;g++){
    const t=(g-1)/5;
    const gy=sBot-t*stickH;
    const active=(g===P.gear);
    ctx.fillStyle=active?'rgba(120,230,255,0.95)':'rgba(140,150,170,0.45)';
    ctx.beginPath();
    ctx.arc(cx+stickW/2+r*0.1,gy,active?r*0.045:r*0.03,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle=active?'#aef':'#778';
    ctx.font='bold '+Math.max(8,r*0.2)+'px "Courier New",monospace';
    ctx.textAlign='left';
    ctx.fillText(''+g,cx+stickW/2+r*0.2,gy+r*0.07);
    ctx.strokeStyle=active?'rgba(120,230,255,0.6)':'rgba(120,230,150,0.3)';
    ctx.lineWidth=active?2:1;
    ctx.beginPath();
    ctx.moveTo(cx-stickW*0.3,gy);
    ctx.lineTo(cx+stickW*0.3,gy);
    ctx.stroke();
  }

  const knobY=sBot-((P.gear-1)/5)*stickH;
  const kR=r*0.14;
  const kGrad=ctx.createRadialGradient(cx-kR*0.3,knobY-kR*0.3,kR*0.1,cx,knobY,kR);
  kGrad.addColorStop(0,'#aef');
  kGrad.addColorStop(0.6,'#38a');
  kGrad.addColorStop(1,'#1a3350');
  ctx.fillStyle=kGrad;
  ctx.beginPath();ctx.arc(cx,knobY,kR,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(cx,knobY,kR,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.25)';
  ctx.beginPath();ctx.arc(cx-kR*0.25,knobY-kR*0.25,kR*0.3,0,Math.PI*2);ctx.fill();

  if(P.shiftFlash>0.05){
    ctx.fillStyle=`rgba(100,220,255,${P.shiftFlash*0.18})`;
    roundRect(cx-stickW*1.5,sTop-stickW,stickW*3,stickH+stickW*2,stickW);ctx.fill();
  }

  const dmgLabelY=cy+stickH/2+r*0.28;
  const dmgY=dmgLabelY+r*0.12;
  const dmgW=r*1.5,dmgH=Math.max(6,r*0.16);
  const dmgX=cx-dmgW/2;
  ctx.fillStyle=P.damage>70?'#f55':P.damage>40?'#fa0':'#8c8';
  ctx.font='bold '+Math.max(9,r*0.22)+'px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('DAMAGE '+Math.round(P.damage)+'%',cx,dmgLabelY);
  ctx.fillStyle='rgba(0,0,0,0.6)';
  roundRect(dmgX,dmgY,dmgW,dmgH,3);ctx.fill();
  ctx.strokeStyle='rgba(100,120,140,0.4)';ctx.lineWidth=1;
  roundRect(dmgX,dmgY,dmgW,dmgH,3);ctx.stroke();
  if(P.damage>0){
    const fillW=dmgW*(P.damage/100);
    const dGrad=ctx.createLinearGradient(dmgX,0,dmgX+dmgW,0);
    dGrad.addColorStop(0,'#2ecc40');
    dGrad.addColorStop(0.4,'#ffdc00');
    dGrad.addColorStop(0.7,'#ff851b');
    dGrad.addColorStop(1,'#ff4136');
    ctx.fillStyle=dGrad;
    roundRect(dmgX,dmgY,fillW,dmgH,3);ctx.fill();
  }
  if(P.damage>70){
    const pulse=0.5+0.5*Math.sin(performance.now()*0.008);
    ctx.strokeStyle=`rgba(255,50,50,${0.3+pulse*0.5})`;
    ctx.lineWidth=2;
    roundRect(dmgX-2,dmgY-2,dmgW+4,dmgH+4,5);ctx.stroke();
  }

  // EDGE WARNING
  if(started&&!P.out&&P.crashTimer<=0){
    const absPX=Math.abs(P.playerX);
    if(absPX>0.30){
      const t=Math.min(1,(absPX-0.30)/0.30);
      const pulse=0.4+0.6*Math.sin(performance.now()*0.01*(4+t*8));
      const alpha=t*0.35*pulse;
      const grd=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7);
      grd.addColorStop(0,'rgba(255,0,0,0)');
      grd.addColorStop(1,`rgba(255,20,20,${alpha})`);
      ctx.fillStyle=grd;
      ctx.fillRect(0,0,W,H);
    }
  }

  ctx.restore();
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect){ctx.roundRect(x,y,w,h,r);return}
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
}

let lastT=0;
function loop(t){
  const dt=Math.min((t-lastT)/1000,.05);lastT=t;
  pollInputs();
  advanceLights();
  update(dt);
  renderAll();
  for(const pl of players) pl.engine.update(pl);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

