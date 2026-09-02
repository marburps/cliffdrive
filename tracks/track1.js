// tracks/track1.js — Track1 (Nürburgring Nordschleife) track DATA
// Pure data only: shape (curves), elevations, tunnels, start/finish, laps,
// decoration and tunnel presentation. Loaded in index.html right after
// 01-config.js (defines ROAD_LEN / SEG_LEN) and before 02-track.js.
// 01-config.js and 02-track.js read their track values from this object.
//
// Units: 100 units = 1 m  ·  100000 units = 1 km  ·  track ≈ 12 km
// Absolute positions are measured from the START/FINISH line (segment 0)
// going clockwise around the lap. 12 km => 1,200,000 units.
const Track1 = {
  name: "Nürburgring Nordschleife",

  // ── CURVES — GPS control points [lat, lon] (41) ─────────────────
  // 02-track.js Catmull-Rom splines these into the 6000 road segments;
  // the per-segment curve is derived from the resulting 2D shape.
  gps: [
    [50.3444,6.9442],[50.3431,6.9447],[50.3412,6.9458],[50.3400,6.9482],
    [50.3425,6.9531],[50.3478,6.9569],[50.3533,6.9619],[50.3556,6.9658],
    [50.3601,6.9634],[50.3644,6.9617],[50.3678,6.9619],[50.3706,6.9539],
    [50.3689,6.9442],[50.3719,6.9408],[50.3756,6.9411],[50.3764,6.9367],
    [50.3775,6.9333],[50.3794,6.9339],[50.3789,6.9372],[50.3769,6.9419],
    [50.3758,6.9458],[50.3711,6.9583],[50.3681,6.9664],[50.3664,6.9686],
    [50.3625,6.9744],[50.3592,6.9747],[50.3558,6.9792],[50.3533,6.9794],
    [50.3514,6.9819],[50.3475,6.9839],[50.3458,6.9856],[50.3442,6.9897],
    [50.3444,6.9944],[50.3472,6.9983],[50.3486,7.0017],[50.3469,7.0039],
    [50.3442,7.0036],[50.3436,6.9997],[50.3428,6.9919],[50.3414,6.9692],
    [50.3421,6.9602]
  ],
  curveSharpness: 5,          // max per-segment curve magnitude the car feels

  // ── ELEVATION — metres above the start/finish datum, as [fraction, m] ──
  // Antoniusbuche (0.0, 0) → Hocheichen (0.12, +55) → Kottenborn (0.22, +120)
  // → Wehrseifen (0.45, +190 highest) → Bergwerk (0.55, +100)
  // → Karussell (0.68, +30) → Hohe Acht (0.76, +160) → Döttinger (0.97, −10)
  // → Antoniusbuche (1.0, 0)
  elevation: [
    [0.00,0],[0.04,-12],[0.08,5],[0.12,55],[0.16,80],
    [0.20,110],[0.22,120],[0.26,90],[0.30,40],[0.32,20],
    [0.36,50],[0.40,120],[0.44,170],[0.45,190],[0.48,175],
    [0.52,140],[0.55,100],[0.60,70],[0.65,45],[0.68,30],
    [0.72,50],[0.76,160],[0.79,170],[0.82,140],[0.86,90],
    [0.90,50],[0.94,10],[0.97,-10],[1.00,0]
  ],

  // ── TUNNELS: entry positions in game units (100000 units = 1 km) ──
  // Every tunnel shares the same length and layout.
  tunnels: [100000, 600000, 800000],  // 1 km, 6 km, 8 km
  tunnelLen: 10000,                   // 100 m each
  tunnelWallSide: 4.2,
  tunnelCeilingH: 3.2,
  tunnelLightSpacing: 4,

  // ── START / FINISH ──────────────────────────────────────────────
  // Start/finish line is segment 0 (first gps point — Antoniusbuche).
  // totalLaps: laps to complete the race.
  // startOffsetUnits: the car is placed this many units BEFORE the line
  //   (2000 units = 20 m).  So START_POS = TRACK_LENGTH − startOffsetUnits.
  totalLaps: 3,
  startOffsetUnits: 2000,

  // ── DECORATION ──────────────────────────────────────────────────
  treeTypes: [0, 4, 5],         // Eifel forest tree sprite types
  billboardText: "X-LAN RACE",  // billboard text, max 10 chars
  // deterministic billboards: [segmentIndex, side(−1 left hill / +1 right), offset]
  // (chosen off-road, none inside the 1 km / 6 km / 8 km tunnels)
  billboards: [
    [187, -1, 1.15],[412, -1, 1.30],[655, -1, 1.05],[908, -1, 1.40],
    [1143, -1, 1.20],[1390, -1, 1.35],[1618, -1, 1.10],[1874, -1, 1.25],
    [2109, -1, 1.45],[2347, -1, 1.05],[2586, -1, 1.30],[2821, -1, 1.15],
    [3059, -1, 1.20],[3308, -1, 1.40],[3540, -1, 1.10],[3782, -1, 1.35],
    [4105, -1, 1.25],[4266, -1, 1.05],[4501, -1, 1.45],[4748, -1, 1.15],
    [4985, -1, 1.20],[5219, -1, 1.30],[5455, -1, 1.10],[5692, -1, 1.40],
    [5860, -1, 1.20],[320, 1, 0.30],[770, 1, 0.40],[1290, 1, 0.25],
    [1760, 1, 0.35],[2280, 1, 0.45],[2810, 1, 0.30],[3330, 1, 0.40],
    [3860, 1, 0.25],[4390, 1, 0.35],[4910, 1, 0.45],[5430, 1, 0.30],
    [5670, 1, 0.40]
  ]
};
