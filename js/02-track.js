// 02-track.js — Track generation: GPS shape, curve, elevation, sprites, tunnels
// Split from main.js (lines 62–276); keep load order in index.html.

// ═══════════════════════════════════════════════════════════════
//  STEP 1 — Generate the 2D closed-loop track from GPS coordinates
//  Nürburgring Nordschleife — 41 control points → Catmull-Rom → 6000 pts
// ═══════════════════════════════════════════════════════════════

// Pre-declare track2D before the IIFE runs (hoisted)
const track2D={x:new Float32Array(ROAD_LEN),y:new Float32Array(ROAD_LEN)};

// GPS control points now live in tracks/track1.js
const gpsControl=Track1.gps;

// Convert GPS → 2D meters (equirectangular, centered on track centroid)
(function(){
  const latC=50.36, lonC=6.968;
  const cosLat=Math.cos(latC*Math.PI/180);
  const M_PER_DEG_LAT=110574, M_PER_DEG_LON=111320*cosLat;

  const pts2D=gpsControl.map(([lat,lon])=>[
    (lon-lonC)*M_PER_DEG_LON,
    (lat-latC)*M_PER_DEG_LAT
  ]);

  function catmullRom(p0,p1,p2,p3,t){
    const t2=t*t, t3=t2*t;
    return [
      0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
    ];
  }

  const N=pts2D.length;
  const base=Math.floor(ROAD_LEN/N);          // 146
  const raw=new Float32Array(ROAD_LEN*2);
  let idx=0;

  for(let seg=0;seg<N;seg++){
    const p0=pts2D[(seg-1+N)%N];
    const p1=pts2D[seg];
    const p2=pts2D[(seg+1)%N];
    const p3=pts2D[(seg+2)%N];

    const count=(seg===N-1)?(ROAD_LEN-idx):base;

    for(let j=0;j<count && idx<ROAD_LEN;j++){
      const t=j/count;
      const pt=catmullRom(p0,p1,p2,p3,t);
      raw[idx*2]=pt[0];
      raw[idx*2+1]=pt[1];
      idx++;
    }
  }

  // Normalise to [-1,1]
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<ROAD_LEN;i++){
    if(raw[i*2]<minX)minX=raw[i*2];
    if(raw[i*2]>maxX)maxX=raw[i*2];
    if(raw[i*2+1]<minY)minY=raw[i*2+1];
    if(raw[i*2+1]>maxY)maxY=raw[i*2+1];
  }
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const scale=Math.min((maxX-minX)/2,(maxY-minY)/2)||1;

  for(let i=0;i<ROAD_LEN;i++){
    track2D.x[i]=(raw[i*2]-cx)/scale;
    track2D.y[i]=(raw[i*2+1]-cy)/scale;
  }
})();

// ═══════════════════════════════════════════════════════════════
//  STEP 2 — Derive per-segment curve, elevation & sprites FROM the 2D shape
// ═══════════════════════════════════════════════════════════════
const CURVE_SCALE=400;

const rawTurn=new Float32Array(ROAD_LEN);
for(let i=0;i<ROAD_LEN;i++){
  const i1=(i+1)%ROAD_LEN;
  const i2=(i+2)%ROAD_LEN;
  const a1=Math.atan2(track2D.y[i1]-track2D.y[i],track2D.x[i1]-track2D.x[i]);
  const a2=Math.atan2(track2D.y[i2]-track2D.y[i1],track2D.x[i2]-track2D.x[i1]);
  let d=a2-a1;
  while(d>Math.PI)d-=2*Math.PI;
  while(d<-Math.PI)d+=2*Math.PI;
  rawTurn[i]=d;
}

const smoothTurn=new Float32Array(ROAD_LEN);
const SMOOTH_N=3;
for(let i=0;i<ROAD_LEN;i++){
  let sum=0;
  for(let k=-SMOOTH_N;k<=SMOOTH_N;k++){
    sum+=rawTurn[(i+k+ROAD_LEN)%ROAD_LEN];
  }
  smoothTurn[i]=sum/(2*SMOOTH_N+1);
}

// Nürburgring elevation profile (relative, metres — start/finish at 0)
// Key landmarks by fraction of track:
//   0.00 Antoniusbuche (0)  →  0.12 Hocheichen (+55)
//   0.22 Kottenborn (+120)  →  0.32 Fuchsröhre (+20)
//   0.45 Wehrseifen (+190, highest)
//   0.55 Bergwerk (+100)   →  0.68 Karussell (+30)
//   0.76 Hohe Acht (+160)  →  0.92 Döttinger (-10)
//   1.00 Antoniusbuche (0)
function elevationAt(t){
  // Smooth piecewise using cosine interpolation between key points
  // (elevation profile is defined in tracks/track1.js)
  const keys=Track1.elevation;
  // Find surrounding keys
  let lo=0,hi=keys.length-1;
  for(let i=0;i<keys.length-1;i++){
    if(t>=keys[i][0]&&t<=keys[i+1][0]){lo=i;hi=i+1;break;}
  }
  const t0=keys[lo][0],t1=keys[hi][0];
  const v0=keys[lo][1],v1=keys[hi][1];
  const f=(t-t0)/(t1-t0||1);
  // Smoothstep interpolation
  const s=f*f*(3-2*f);
  return v0+(v1-v0)*s;
}

const segments=[];
for(let i=0;i<ROAD_LEN;i++){
  const curve=Math.max(-CURVE_SHARPNESS,Math.min(CURVE_SHARPNESS,smoothTurn[i]*CURVE_SCALE));
  const t=i/ROAD_LEN;

  // Elevation from Nordschleife profile
  let y=elevationAt(t)*ELEVATION; // scale up for visual drama

  // ── SPRITES ──
  const sprites=[];
  const absCurve=Math.abs(curve);
  const hasRightRail=curve<-3;

  if(Math.random()<0.12){
    sprites.push({side:-1,type:TREE_TYPES[Math.floor(Math.random()*TREE_TYPES.length)],off:0.2+Math.random()*0.5});
  }
  if(Math.random()<0.05){
    sprites.push({side:-1,type:1,off:0.15+Math.random()*0.5});
  }
  if(!hasRightRail&&Math.random()<0.03){
    sprites.push({side:1,type:1,off:0.05+Math.random()*0.15});
  }
  if(Math.random()<0.22){
    sprites.push({side:-1,type:3,off:0.1+Math.random()*0.6});
  }
  // Extra trees on left side for that Eifel forest feel
  if(!hasRightRail&&Math.random()<0.18){
      sprites.push({side:1,type:TREE_TYPES[Math.floor(Math.random()*TREE_TYPES.length)],off:0.25+Math.random()*0.55});
  }

  segments.push({curve,y,sprites});

}

/*
const tunnelStartSeg = Math.floor(TUNNEL_START / SEG_LEN);
const tunnelEndSeg   = Math.floor(TUNNEL_END / SEG_LEN);
for (let i = 0; i < ROAD_LEN; i++) {
  const s = i * SEG_LEN;
  segments[i].tunnel = s >= TUNNEL_START && s < TUNNEL_END;
  segments[i].tunnelEntrance = false;
  segments[i].tunnelExit = false;
}
segments[tunnelStartSeg % ROAD_LEN].tunnelEntrance = true;
segments[tunnelEndSeg % ROAD_LEN].tunnelExit = true;
*/


// set per-segment flags for every tunnel
for (let i = 0; i < ROAD_LEN; i++) {
  segments[i].tunnel = false;
  segments[i].tunnelEntrance = false;
  segments[i].tunnelExit = false;
}
for (const startUnit of TUNNELS) {
  const startSeg = Math.floor(startUnit / SEG_LEN);
  const endSeg   = Math.floor((startUnit + TUNNEL_LEN) / SEG_LEN);
  for (let s = startSeg; s < endSeg; s++) {
    segments[s % ROAD_LEN].tunnel = true;
  }
  segments[startSeg % ROAD_LEN].tunnelEntrance = true;
  segments[endSeg   % ROAD_LEN].tunnelExit = true;
}

// Billboards — fixed positions from tracks/track1.js (type 6 = billboard)
for (const [segIdx, side, off] of Track1.billboards) {
  if (segments[segIdx].tunnel) continue; // never place inside a tunnel
  segments[segIdx].sprites.push({ side, type: 6, off });
}

