// 03-hud-track.js — Track mini-map, lap HUD, horizon (mountains / buildings)
// Split from main.js (lines 277–498); keep load order in index.html.

// ═══════════════════════════════════════════════════════════════
//  MINIMAP — drawn directly from the pre-computed 2D track shape
// ═══════════════════════════════════════════════════════════════
function drawMinimap(){
  const size=Math.min(W,H)*0.2;
  const mx=W-size-14;
  const my=14;

  ctx.save();

  ctx.fillStyle='rgba(4,8,18,0.72)';
  roundRect(mx,my,size,size,10);ctx.fill();
  ctx.strokeStyle='rgba(70,130,200,0.45)';
  ctx.lineWidth=1.5;
  roundRect(mx,my,size,size,10);ctx.stroke();

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<ROAD_LEN;i++){
    if(track2D.x[i]<minX)minX=track2D.x[i];
    if(track2D.x[i]>maxX)maxX=track2D.x[i];
    if(track2D.y[i]<minY)minY=track2D.y[i];
    if(track2D.y[i]>maxY)maxY=track2D.y[i];
  }
  const rX=maxX-minX||1,rY=maxY-minY||1;
  const pad=18;
  const sc=Math.min((size-pad*2)/rX,(size-pad*2)/rY);
  const cx=(minX+maxX)*0.5;
  const cy=(minY+maxY)*0.5;

  function toMap(i){
    return{
      x:mx+size*0.5+(track2D.x[i]-cx)*sc,
      y:my+size*0.5+(track2D.y[i]-cy)*sc
    };
  }

  const step=Math.max(1,Math.floor(ROAD_LEN/800));
  ctx.beginPath();
  for(let i=0;i<=ROAD_LEN;i+=step){
    const p=toMap(i%ROAD_LEN);
    i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);
  }
  ctx.closePath();
  ctx.lineJoin='round';
  ctx.lineWidth=4;
  ctx.strokeStyle='rgba(30,50,80,0.7)';
  ctx.stroke();
  ctx.lineWidth=1.5;
  ctx.strokeStyle='rgba(200,220,255,0.85)';
  ctx.stroke();

  // highlight sharp corners
  for(let i=0;i<ROAD_LEN;i+=step){
    const c=Math.abs(segments[i].curve);
    if(c<5)continue;
    const p1=toMap(i);
    const p2=toMap((i+step)%ROAD_LEN);
    ctx.strokeStyle=`rgba(255,150,50,${Math.min(0.9,(c-5)*0.15)})`;
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(p1.x,p1.y);
    ctx.lineTo(p2.x,p2.y);
    ctx.stroke();
  }

  // start / finish
  const sf=toMap(0);
  ctx.fillStyle='#fff';
  ctx.fillRect(sf.x-2.5,sf.y-2.5,5,5);
  ctx.fillStyle='#000';
  ctx.fillRect(sf.x-1,sf.y-1,2,2);

  // player dot
  const pi=Math.floor(position/SEG_LEN)%ROAD_LEN;
  const pp=toMap(pi);
  ctx.shadowColor='rgba(255,255,0,0.9)';
  ctx.shadowBlur=10;
  ctx.fillStyle='#ffee00';
  ctx.beginPath();
  ctx.arc(pp.x,pp.y,5,0,Math.PI*2);
  ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#fff';
  ctx.lineWidth=1.5;
  ctx.stroke();

  // label
  ctx.fillStyle='rgba(150,180,220,0.5)';
  ctx.font=Math.max(9,size*0.055)+'px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('NIEWERKERKESCHLEIFE',mx+size/2,my+size-6);

  ctx.restore();
}

function drawLapHUD() {
  if (!started && !raceFinished) return;
  const fmt = ms => {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  const bx = 14, by = 14;
  const bw = 200, bh = raceFinished ? 40 + lapTimes.length * 28 + 50 : 40 + lapTimes.length * 28 + 30;

  ctx.save();
  ctx.fillStyle = 'rgba(4,8,18,0.72)';
  roundRect(bx, by, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,130,200,0.45)';
  ctx.lineWidth = 1.5;
  roundRect(bx, by, bw, bh, 10);
  ctx.stroke();

  // Current lap
  const displayLap = Math.min(lapCount + 1, TOTAL_LAPS);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`LAP ${displayLap} / ${TOTAL_LAPS}`, bx + 12, by + 10);

  // Current lap time (live)
  const elapsed = started && !raceFinished && raceGo ? performance.now() - currentLapStart : 0;
  ctx.fillStyle = '#7df';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(fmt(elapsed), bx + 12, by + 36);

  // Previous laps
  for (let i = 0; i < lapTimes.length; i++) {
    const y = by + 60 + i * 28;
    const isBest = raceFinished && lapTimes[i] === Math.min(...lapTimes);
    ctx.fillStyle = isBest ? '#4f8' : '#8899aa';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(`  Lap ${i + 1}: ${fmt(lapTimes[i])}${isBest ? ' 🏆' : ''}`, bx + 12, y);
  }

  if (raceFinished) {
    const best = Math.min(...lapTimes);
    const y = by + 60 + lapTimes.length * 28;
    ctx.fillStyle = '#4f8';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`BEST: ${fmt(best)}`, bx + 12, y);
  }

  ctx.restore();
}

// ==========================================================
//  HORIZON
// ==========================================================
const VW = 4096;
const mountains = (() => {
  const pts=[]; const N=VW/6;
  for(let i=0;i<=N;i++){
    const t = i/N * Math.PI * 2;
    const h = 90 + 70*Math.sin(t*3+1.2) + 45*Math.sin(t*7+4.1) + 22*Math.sin(t*13+2.3) + 12*Math.sin(t*23+0.7) + 6*Math.sin(t*41+3.9);
    pts.push(Math.max(20, h));
  }
  return pts;
})();
const buildings = (() => {
  const arr=[]; let x=0; let seed=1337;
  const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  while(x<VW-40){
    const w=16+rnd()*46;
    const h=28+rnd()*130+(rnd()<.15?60+rnd()*70:0);
    const cols=Math.max(2,Math.floor(w/9));
    const rows=Math.max(2,Math.floor(h/13));
    const wins=[];
    for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
      if(rnd()<0.5) wins.push({c,r,on:rnd()<0.72,warm:rnd()<0.6});
    }
    arr.push({x,w,h,cols,rows,wins});
    x+=w+(rnd()<.45?3+rnd()*16:0);
  }
  return arr;
})();
function drawHorizon(){
  const hy=Math.floor(H*.45);
  const base=((horizonOffset%VW)+VW)%VW;
  for(let t=0;t<2;t++){
    const dx=base-VW+t*VW;
    ctx.fillStyle='#5a7ea6';
    ctx.beginPath();ctx.moveTo(dx,hy+1);
    for(let i=0;i<mountains.length;i++) ctx.lineTo(dx+i*6,hy-mountains[i]*0.45);
    ctx.lineTo(dx+VW,hy+1);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(220,235,250,0.55)';
    for(let i=0;i<mountains.length;i++){
      const m=mountains[i]; if(m<140)continue;
      const px=dx+i*6, py=hy-m*0.45;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-8,py+10);ctx.lineTo(px+8,py+10);ctx.closePath();ctx.fill();
    }
    const haze=ctx.createLinearGradient(0,hy-70,0,hy);
    haze.addColorStop(0,'rgba(180,205,230,0)');haze.addColorStop(1,'rgba(180,205,230,0.35)');
    ctx.fillStyle=haze;ctx.fillRect(0,hy-70,W,70);
    for(const b of buildings){
      const bx=dx+b.x;
      if(bx+b.w<-50||bx>W+50)continue;
      const bh=b.h;
      ctx.fillStyle='#2a3852';ctx.fillRect(bx,hy-bh,b.w,bh);
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(bx+b.w*0.75,hy-bh,b.w*0.25,bh);
      ctx.fillStyle='#1d2840';ctx.fillRect(bx,hy-bh-3,b.w,3);
      if(b.h>110){
        ctx.strokeStyle='#1d2840';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(bx+b.w*0.5,hy-bh-3);ctx.lineTo(bx+b.w*0.5,hy-bh-18);ctx.stroke();
        ctx.fillStyle='rgba(255,60,60,0.9)';ctx.beginPath();ctx.arc(bx+b.w*0.5,hy-bh-18,1.8,0,Math.PI*2);ctx.fill();
      }
      const cw=b.w/b.cols,ch=bh/b.rows;
      for(const w of b.wins){
        if(!w.on)continue;
        const wx=bx+w.c*cw+cw*0.25, wy=hy-bh+w.r*ch+ch*0.28;
        const ww=cw*0.5, wh=ch*0.45;
        ctx.fillStyle=w.warm?'rgba(255,215,130,0.9)':'rgba(160,210,255,0.85)';
        ctx.fillRect(wx,wy,ww,wh);
      }
    }
  }
}

