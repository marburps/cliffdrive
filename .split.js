const fs=require("fs");
const p="C:/Workspace/cliffdrive/";
const f=p+"js/main.js";
const s=fs.readFileSync(f,"utf8");
const eol=(s.includes("\r\n"))? "\r\n" : "\n";
const lines=s.split(/\r?\n/);

const files=[
  ["01-config.js",   1,   61, "Configuration and tuning constants"],
  ["02-track.js",    62,  276,"Track generation: GPS shape, curve, elevation, sprites, tunnels"],
  ["03-hud-track.js",277, 498,"Track mini-map, lap HUD, horizon (mountains / buildings)"],
  ["04-state.js",    499, 722,"Game state, gears, input, game pad, start / restart, damage model"],
  ["05-audio.js",    723,1013,"Rumble, engine + screech, chiptune music"],
  ["06-update.js",  1014,1223,"Frame update (physics, lap / race, popups)"],
  ["07-render.js",  1224,1987,"Road / tunnel / billboard rendering, cockpit, windshield cracks"],
  ["08-hud.js",     1988,2370,"Dash: speedo, tachometer, right cluster, roundRect, game loop"],
];

// safety: last start must be 1, first end must be total
if(files[0][1]!==1) throw new Error("first start not 1");
const contentEnd=lines.length-1; // drop the trailing split artifact (blank)
if(files[files.length-1][2]!==contentEnd) throw new Error("last end should be "+contentEnd);
for(let i=1;i<files.length;i++){ if(files[i][1]!==files[i-1][2]+1) throw new Error("gap before "+files[i][0]); }

// 1) backup original
// (kept original main.js intact on disk as a backup; index.html no longer loads it)

// 2) write split files with a small banner
for(const [name,a,b,desc] of files){
  const body=lines.slice(a-1,b).join(eol)+"\n";
  const banner=`// ${name} — ${desc}\n// Split from main.js (lines ${a}–${b}); keep load order in index.html.\n\n`;
  fs.writeFileSync(p+"js"+"/"+name, banner+body, {encoding:"utf8"});
}

// 3) verify: concatenate bodies (strip banners) == original
let concat="";
for(const [name,a,b] of files){
  const raw=fs.readFileSync(p+"js/"+name,"utf8");
  const idx=raw.indexOf("\n\n",0);
  if(idx<0) throw new Error("banner strip failed for "+name);
  concat+= raw.slice(idx+2); // drop the 2-line banner
}
const norm=x=>x.replace(/\r\n/g,"\n").replace(/\s+$/,"");
if(norm(concat)!==norm(s)){
  const a=norm(concat), b=norm(s);
  let i=0; while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  throw new Error("MISMATCH at char "+i+"\n A="+JSON.stringify(a.slice(i-40,i+40))+"\n B="+JSON.stringify(b.slice(i-40,i+40)));
}
console.log("OK: concat of 8 files === original main.js (content-identical)");

// 4) update index.html script tag -> ordered list
let html=fs.readFileSync(p+"index.html","utf8");
if(!html.includes('src="js/main.js"')) throw new Error("index.html missing js/main.js tag");
const scripts=files.map(([n])=>`<script src="js/${n}"></script>`).join("\n");
html=html.replace('<script src="js/main.js"></script>', scripts);
fs.writeFileSync(p+"index.html", html);
console.log("OK: index.html now loads "+files.length+" ordered scripts");
