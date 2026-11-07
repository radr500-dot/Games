// Orchard Bakery: the world (ground, sky, orchard, wheat, bakery, ovens, stall, tea garden).
import * as THREE from 'three';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';
import {
  rand, fbm, noise3, paint, paintFaces, displace, at, mesh, merge, canvasTex, speckle, mats, wheatStalkGeo,
  makeApple, makeJam, makeBasket, makeBarrel, makeCrate, makeTable, makeChair, makeLamp, makeBench, makeUmbrella, makePerson,
  bakeStatic, bakeGeo, VC
} from './models.js';
import * as OB from './art.js';
import { buildFarm, FARM_PATHS, FARM_SPOTS } from './farm.js';

// ---------- layout ----------
export const BOUNDS = { minX: -33.8, maxX: 33.8, minZ: -14.2, maxZ: 14.6 };
export const HOME = { minX: -16.2, maxX: 16.2 }; // the first plot; the east and west land opens later
export const PATHS = [ // [x1,z1,x2,z2,width]
  [0, 18, 0, 6.4, 2.0], [0, 4.2, 0, -8.6, 2.0],
  [0, 1.2, -6, 1.2, 1.6], [0, 1.2, 6.2, 1.2, 1.6],
  [0, -3.0, -5.2, -3.0, 1.6], [0, -3.0, 5.2, -3.0, 1.6],
  [0, 9, 6.5, 10.5, 1.4], [0, 9.5, -4.5, 10.8, 1.2], [-5.2, -3.0, -8.6, -5.6, 1.6], [-8.6, -5.6, -10.9, -5.6, 1.4], [-3.2, 1.2, -3.2, -0.6, 1.2],
  ...FARM_PATHS
];
export const PLAZAS = [[0, -6.2, 1.6], [0, 4.9, 2.4]];
export function pathAmount(x, z) { // 0 = grass, 1 = path
  let d = Infinity;
  for (const [x1, z1, x2, z2, w] of PATHS) {
    const dx = x2 - x1, dz = z2 - z1, t = THREE.MathUtils.clamp(((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)) - w / 2);
  }
  for (const [px, pz, r] of PLAZAS) d = Math.min(d, Math.hypot(x - px, z - pz) - r);
  d += fbm(x * 0.9, 0, z * 0.9) * 0.25;
  return THREE.MathUtils.clamp(0.5 - d / 0.35, 0, 1);
}

export const SPOTS = {
  pieOven: new THREE.Vector3(-4.4, 0, -7.2), breadOven: new THREE.Vector3(4.4, 0, -7.2),
  pieIn: new THREE.Vector3(-5.6, 0, -4.7), pieOut: new THREE.Vector3(-3.1, 0, -4.7),
  breadIn: new THREE.Vector3(3.1, 0, -4.7), breadOut: new THREE.Vector3(5.6, 0, -4.7),
  stall: new THREE.Vector3(0, 0, 5.6), stallIn: new THREE.Vector3(0, 0, 4.1), cash: new THREE.Vector3(2.5, 0, 4.4),
  gate: new THREE.Vector3(0, 0, 17),
  jamKitchen: new THREE.Vector3(-9.6, 0, -9.4), jamIn: new THREE.Vector3(-10.9, 0, -7.2), jamOut: new THREE.Vector3(-8.3, 0, -7.2),
  jamTable: new THREE.Vector3(-2.45, 0, 5.6), cart: new THREE.Vector3(-3.2, 0, -1.0),
  ...FARM_SPOTS
};
export const TREE_SPOTS = {
  start: [[-7.4, -1.6], [-10.4, -1.6], [-7.4, 2.0], [-10.4, 2.0]],
  trees2: [[-13.4, -1.6], [-13.4, 2.0], [-7.4, 5.6], [-10.4, 5.6]],
  orchard3: [[-13.4, 5.6], [-15.2, -3.6], [-15.2, 3.9], [-13.4, -5.2]]
};
export const FIELD = { x0: 7, z0: -3, nx: 6, nz: 7 };
export const TEA = [[6.4, 10.2, 0], [9.6, 10.2, 1], [8.0, 12.9, 2]];
export const PADS = {
  trees2: { pos: [-4.8, 4.3], cost: 15, name: 'More apple trees', icon: 'tree' },
  basket: { pos: [-2.6, 2.6], cost: 25, name: 'Bigger tray', icon: 'tray' },
  wheat: { pos: [5.0, 3.3], cost: 40, name: 'Wheat field', icon: 'wheat' },
  sign1: { pos: [2.6, 12.6], cost: 35, name: 'Road sign', icon: 'sign' },
  line2: { pos: [-6.0, 13.0], cost: 70, name: 'Second line', icon: 'sign', req: 'sign1' }, // customers queue in two lines
  bread: { pos: [4.4, -4.6], cost: 60, name: 'Bread oven', icon: 'bread', req: 'wheat' },
  oven1: { pos: [0, -7.0], cost: 60, name: 'Hotter ovens', icon: 'fire' },
  jam: { pos: [-9.6, -7.2], cost: 90, name: 'Jam kitchen', icon: 'jam', req: 'trees2' },
  tea: { pos: [4.4, 8.2], cost: 80, name: 'Tea garden', icon: 'tea' },
  helper: { pos: [-4.4, 7.4], cost: 110, name: 'Orchard helper', icon: 'helper', req: 'trees2' },
  flowers: { pos: [-3.4, 10.6], cost: 60, name: 'Flower garden', icon: 'flower' },
  price1: { pos: [2.8, -1.6], cost: 100, name: 'Fancy pie tins', icon: 'pie' },
  barrow: { pos: [-2.6, 2.6], cost: 120, name: 'Big wooden tray', icon: 'tray', req: 'basket' },
  runner: { pos: [-1.9, -2.6], cost: 140, name: 'Shop helper', icon: 'runner', req: 'bread' },
  sign2: { pos: [2.6, 12.6], cost: 140, name: 'Village bunting', icon: 'sign', req: 'sign1' },
  orchard3: { pos: [-4.8, -2.2], cost: 150, name: 'Orchard corner', icon: 'tree', req: 'trees2' },
  oven2: { pos: [0, -7.0], cost: 180, name: 'Even hotter ovens', icon: 'fire', req: 'oven1' },
  helper2: { pos: [5.0, 3.3], cost: 170, name: 'Field helper', icon: 'helper', req: 'bread' },
  price2: { pos: [2.8, -1.6], cost: 160, name: 'Honey glaze', icon: 'jam', req: 'price1' },
  stall2: { pos: [-2.6, 2.6], cost: 130, name: 'Bigger stall', icon: 'bread', req: 'barrow' },
  helper3: { pos: [-4.8, 4.3], cost: 220, name: 'Second orchard helper', icon: 'helper', req: 'helper' },
  // the bigger farm: new land, new produce, new bakes
  wagon: { pos: [10.5, -5.3], cost: 120, name: 'Order wagon', icon: 'wagon' },
  eastLand: { pos: [14.6, -6.2], cost: 400, name: 'East meadow', icon: 'land', lvl: 4 },
  hens: { pos: [19.8, -7.6], cost: 250, name: 'Hen house', icon: 'egg', req: 'eastLand' },
  pastry: { pos: [19.8, -2.1], cost: 320, name: 'Custard oven', icon: 'custard', req: 'hens' },
  dairy: { pos: [30.2, -7.6], cost: 480, name: 'Dairy barn', icon: 'milk', req: 'pastry', lvl: 6 },
  churn: { pos: [30.2, -2.1], cost: 540, name: 'Butter churn', icon: 'butter', req: 'dairy' },
  runner2: { pos: [-1.9, -2.6], cost: 500, name: 'Second shop helper', icon: 'runner', req: 'pastry' },
  handE: { pos: [25.0, -5.6], cost: 600, name: 'Meadow helper', icon: 'helper', req: 'churn' },
  westLand: { pos: [-15.0, 0.2], cost: 900, name: 'West hill', icon: 'land', req: 'eastLand', lvl: 8 },
  berries: { pos: [-18.6, 0.2], cost: 650, name: 'Strawberry patch', icon: 'berry', req: 'westLand' },
  tarts: { pos: [-22.0, -2.1], cost: 800, name: 'Tart oven', icon: 'tart', req: 'berries' },
  bees: { pos: [-30.4, -7.6], cost: 1000, name: 'Bee hives', icon: 'comb', req: 'tarts', lvl: 10 },
  honey: { pos: [-30.4, -2.1], cost: 1100, name: 'Honey house', icon: 'honey', req: 'bees' },
  handW: { pos: [-26.2, -5.6], cost: 1250, name: 'Hill helper', icon: 'helper', req: 'honey' },
  cheese: { pos: [19.8, 6.5], cost: 900, name: 'Cheese room', icon: 'cheese', req: 'churn', lvl: 9 },
  cider: { pos: [-18.9, 6.2], cost: 1400, name: 'Cider press', icon: 'cider', req: 'tarts', lvl: 11 }
};
// Upgrades that never run out: each one levels up again and again, a little dearer each time.
export const LEVELS = {
  lvOven: { pos: [0, -7.0], name: 'Faster ovens', icon: 'fire', req: 'oven2', base: 200 },
  lvPrice: { pos: [2.8, -1.6], name: 'Better recipes', icon: 'pie', req: 'price2', base: 180 },
  lvTray: { pos: [-2.6, 2.6], name: 'Bigger tray', icon: 'tray', req: 'stall2', base: 160, max: 16 },
  lvCrowd: { pos: [2.6, 12.6], name: 'More customers', icon: 'sign', req: 'sign2', base: 200 },
  lvGrow: { pos: [-4.8, 4.3], name: 'Faster growing', icon: 'tree', req: 'helper3', base: 220 },
  lvStore: { pos: [5.0, 3.3], name: 'Bigger baskets', icon: 'bread', req: 'helper2', base: 160, max: 16 },
  lvFarm: { pos: [25.0, -5.6], name: 'Busier animals', icon: 'egg', req: 'handE', base: 400 },
  lvHands: { pos: [-1.9, -2.6], name: 'Quicker helpers', icon: 'runner', req: 'runner2', base: 350 },
  lvHill: { pos: [-26.2, -5.6], name: 'Busier bees', icon: 'comb', req: 'handW', base: 500 },
  lvSpeed: { pos: [5.0, 13.6], name: 'Comfy boots', icon: 'runner', req: 'basket', base: 60, max: 12 } // you walk faster
};
export const PAD_ORDER = ['trees2', 'basket', 'wheat', 'sign1', 'line2', 'bread', 'oven1', 'jam', 'tea', 'helper', 'flowers', 'price1', 'barrow', 'runner', 'sign2', 'orchard3', 'oven2', 'helper2', 'price2', 'stall2', 'helper3',
  'wagon', 'eastLand', 'hens', 'pastry', 'dairy', 'churn', 'runner2', 'handE', 'westLand', 'berries', 'tarts', 'cheese', 'bees', 'honey', 'cider', 'handW'];

// ---------- sky + ground ----------
function makeSky(scene) {
  // The camera looks down on the farm, so the sky is just a soft blue behind the far hills.
  scene.background = new THREE.Color(OB.GROUND_COLOR);
}
function makeGround(scene) {
  // Flat bright grass with a few lighter and darker patches, and raised sandy paths.
  const SIZE = 84;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, 48, 48); g.rotateX(-Math.PI / 2); // split up so depth stays accurate far from the middle
  scene.add(mesh(g, new THREE.MeshStandardMaterial({ color: OB.GROUND_COLOR, roughness: 1 }), false, true));
  const far = mesh(at(new THREE.RingGeometry(41, 260, 64, 3), 0, -0.02, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ color: OB.GROUND_COLOR, roughness: 1 }), false, true);
  scene.add(far);
  const r = rand(12);
  const patches = new THREE.Group();
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * 76, z = (r() - 0.5) * 40; if (pathAmount(x, z) > 0.02) continue;
    const c = mesh(at(new THREE.CircleGeometry(0.5 + r() * 1.5, 18), x, 0.004, z, -Math.PI / 2, 0, 0, new THREE.Vector3(1, 0.6, 1)), new THREE.MeshStandardMaterial({ color: r() > 0.5 ? 0x93d34a : 0x79bc37, roughness: 1 }), false, true);
    patches.add(c);
  }
  scene.add(bakeStatic(patches));
  // paths: chunky sand slabs; overlapping pieces share one flat colour so they join seamlessly
  const pg = new THREE.Group(), pm = OB.M('#EDBA68');
  for (const [x1, z1, x2, z2, w] of PATHS) {
    const L = Math.hypot(x2 - x1, z2 - z1);
    OB.add(pg, new THREE.BoxGeometry(L, 0.05, w), pm, (x1 + x2) / 2, 0, (z1 + z2) / 2, { ry: -Math.atan2(z2 - z1, x2 - x1), cast: false });
    for (const [x, z] of [[x1, z1], [x2, z2]]) OB.cyl(pg, w / 2, w / 2, 0.05, pm, x, 0, z, 24, { cast: false });
  }
  for (const [x, z, rr] of PLAZAS) OB.cyl(pg, rr, rr, 0.05, pm, x, 0, z, 36, { cast: false });
  const paths = bakeStatic(pg); paths.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); o.receiveShadow = true; } });
  scene.add(paths);
  // gentle green hills far away
  const hm = new THREE.MeshStandardMaterial({ color: 0x79bc37, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3, d = 75 + r() * 40;
    const h = mesh(new THREE.IcosahedronGeometry(1, 2), hm, false, false);
    h.position.set(Math.cos(a) * d, -6, Math.sin(a) * d); h.scale.set(28 + r() * 20, 10 + r() * 8, 20 + r() * 12); scene.add(h);
  }
}
// ---------- vegetation ----------
function foliageBlob(cx, cy, cz, rad, seed, light = 0x5bbe40, dark = 0x3c952e, detail) {
  // A faceted low-poly crown blob, coloured per face between two greens.
  const g = new THREE.IcosahedronGeometry(rad, 1); g.translate(cx, cy, cz);
  const r = rand(seed * 7 + 3), a = new THREE.Color(light), b = new THREE.Color(dark), c = new THREE.Color();
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length / 9; i++) { c.copy(a).lerp(b, r() * 0.5); for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], i * 9 + k * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); g.computeVertexNormals();
  return g;
}
let LEAF_MAT = null;
function leafMat() {
  if (LEAF_MAT) return LEAF_MAT;
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const r = rand(5);
    for (let i = 0; i < 22; i++) { // a sprig of small pointed leaves
      const x = w * (0.2 + r() * 0.6), y = h * (0.2 + r() * 0.6), a = r() * Math.PI * 2, L = 34 + r() * 26, W = L * 0.42;
      c.save(); c.translate(x, y); c.rotate(a);
      const g = c.createLinearGradient(-W, 0, W, 0), v = 0.85 + r() * 0.3;
      g.addColorStop(0, `rgb(${110 * v},${158 * v},${70 * v})`); g.addColorStop(1, `rgb(${150 * v},${196 * v},${96 * v})`);
      c.fillStyle = g; c.beginPath(); c.moveTo(0, -L / 2); c.quadraticCurveTo(W, 0, 0, L / 2); c.quadraticCurveTo(-W, 0, 0, -L / 2); c.fill();
      c.strokeStyle = 'rgba(40,70,25,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -L / 2); c.lineTo(0, L / 2); c.stroke();
      c.restore();
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.premultiplyAlpha = false;
  LEAF_MAT = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  return LEAF_MAT;
}
function leafCards(centers, seed) {
  const r = rand(seed * 31 + 7), pos = [], uv = [], col = [], idx = [];
  const L = new THREE.Color(1, 1, 0.92), D = new THREE.Color(0.42, 0.5, 0.38), c = new THREE.Color();
  const n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
  for (const [cx, cy, cz, rad] of centers) {
    const count = Math.round(120 * rad * rad + 20);
    for (let i = 0; i < count; i++) {
      n.set(r() * 2 - 1, r() * 1.6 - 0.5, r() * 2 - 1).normalize();
      p.set(cx, cy, cz).addScaledVector(n, rad * (1.0 + r() * 0.16));
      const s = 0.3 + r() * 0.2;
      t1.crossVectors(n, up); if (t1.lengthSq() < 0.01) t1.set(1, 0, 0); t1.normalize().applyAxisAngle(n, r() * 6.28);
      t2.crossVectors(n, t1).normalize();
      // tilt each card a little so they don't all lie flat on the ball
      n.addScaledVector(t1, (r() - 0.5) * 0.8).normalize(); t2.crossVectors(n, t1).normalize();
      const b = pos.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const ox = (u - 0.5) * s, oy = (v - 0.5) * s;
        pos.push(p.x + t1.x * ox + t2.x * oy, p.y + t1.y * ox + t2.y * oy, p.z + t1.z * ox + t2.z * oy); uv.push(u, v);
      }
      const k = THREE.MathUtils.clamp((n.y * 0.5 + 0.5) * 0.8 + r() * 0.35, 0, 1);
      c.copy(D).lerp(L, k); for (let j = 0; j < 4; j++) col.push(c.r, c.g, c.b);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  // light the cards like the canopy they sit on (outward normals), not like flat paper
  const nr = g.attributes.normal, ps = g.attributes.position;
  for (let i = 0; i < ps.count; i++) {
    let best = centers[0], bd = Infinity;
    for (const ct of centers) { const d = Math.hypot(ps.getX(i) - ct[0], ps.getY(i) - ct[1], ps.getZ(i) - ct[2]) - ct[3]; if (d < bd) { bd = d; best = ct; } }
    n.set(ps.getX(i) - best[0], ps.getY(i) - best[1], ps.getZ(i) - best[2]).normalize(); nr.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}
// a soft dark patch on the ground under things, so they sit on the grass instead of floating
const AO_MATS = {}; let AO_TEX = null;
export function aoBlob() { return new THREE.Object3D(); } // the Design art uses real shadows only
const TREE_GREENS = [[0x45a535, 0x3c952e], [0x5bbe40, 0x45a535], [0x3c952e, 0x2f8a2a], [0x72d054, 0x5bbe40]];
export function makeTree(seed, fruit = true) {
  // Faceted low-poly apple tree from the Design art pack: a sturdy trunk and four rounded crown blobs.
  const r = rand(seed), grp = new THREE.Group(), S = 1.22;
  const trunk = bakeStatic((() => { const t = new THREE.Group(); OB.cyl(t, 0.13 * S, 0.2 * S, 1.1 * S, '#8B5A34', 0, 0.55 * S, 0, 8); return t; })());
  grp.add(trunk);
  const blobs = [[0, 1.6, 0, 0.95], [-0.5, 1.4, 0.35, 0.68], [0.55, 1.35, -0.2, 0.62], [0.1, 2.1, 0.2, 0.55]].map(([x, y, z, rad], i) => foliageBlob(x * S, y * S, z * S, rad * S * (0.95 + r() * 0.1), seed + i, ...TREE_GREENS[i]));
  const foliage = mesh(merge(blobs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
  grp.add(foliage);
  const apples = [];
  if (fruit) {
    const rr = rand(seed * 13);
    for (let i = 0; i < 8; i++) {
      const a = i * 0.79 + rr() * 0.5, h = 1.15 + rr() * 0.85;
      const rad = (0.98 - Math.abs(h - 1.55) * 0.35) * S;
      const ap = makeApple(); ap.position.set(Math.cos(a) * rad, h * S, Math.sin(a) * rad + 0.12); ap.rotation.set(rr() * 0.4, rr() * 6, rr() * 0.4); ap.scale.setScalar(0.85);
      grp.add(ap); apples.push({ mesh: ap, grow: 1 });
    }
  }
  return { group: grp, apples, foliage };
}
function makeGrass(scene, avoid) {
  // Little grass spikes and flower clumps dotted about, as in the Design renders.
  const r = rand(31);
  const tuft = merge([0, 1, 2].map((i) => at(new THREE.ConeGeometry(0.045, 0.2 - i * 0.03, 3), (i - 1) * 0.06, 0.09, (i % 2) * 0.05)));
  const N = 900, im = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0x6ab233, roughness: 1, flatShading: true }), N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let k = 0;
  for (let t = 0; t < N * 6 && k < N; t++) {
    const x = (r() - 0.5) * 66, z = (r() - 0.5) * 34;
    if (pathAmount(x, z) > 0.02 || avoid(x, z)) continue;
    q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0)); const sc = 0.8 + r() * 0.6;
    mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(k++, mtx);
  }
  im.count = k; im.receiveShadow = true; scene.add(im);
  const fl = merge([paint(at(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), 0, 0.11, 0), (x, y, z, c) => c.set(0x3e9a30)), paint(at(new THREE.SphereGeometry(0.075, 8, 6), 0, 0.24, 0, 0, 0, 0, new THREE.Vector3(1, 0.6, 1)), (x, y, z, c) => c.set(0xffffff))]);
  const fm = new THREE.InstancedMesh(fl, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 700);
  const fc = [0xff7fa6, 0xffffff, 0xffd23f, 0xb98cff];
  k = 0;
  for (let t = 0; t < 300 && k < 700; t++) {
    const cx = (r() - 0.5) * 64, cz = (r() - 0.5) * 32;
    if (pathAmount(cx, cz) > 0.02 || avoid(cx, cz)) continue;
    for (let j = 0; j < 6 && k < 700; j++) {
      const x = cx + (r() - 0.5) * 0.9, z = cz + (r() - 0.5) * 0.9;
      mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 0.8 + r() * 0.4, 1)); fm.setMatrixAt(k, mtx); fm.setColorAt(k++, col.set(fc[j % 4]));
    }
  }
  fm.count = k; scene.add(fm);
  return { value: 0 };
}
function makeForest(scene) {
  // A ring of low-poly pines, round trees and bushes beyond the fence, so the farm sits in a green valley.
  const r = rand(91);
  const pine = bakeGeo((g) => OB.pine(g, 0, 0, 1.25)), round = bakeGeo((g) => { OB.cyl(g, 0.13, 0.2, 1.1, '#8B5A34', 0, 0.55, 0, 8); for (const [x, y, z, rad, c] of [[0, 1.6, 0, 0.95, '#45A535'], [-0.5, 1.4, 0.35, 0.68, '#5BBE40'], [0.55, 1.35, -0.2, 0.62, '#3C952E'], [0.1, 2.1, 0.2, 0.55, '#72D054']]) OB.add(g, new THREE.IcosahedronGeometry(rad, 1), OB.F(c), x, y, z); }), bush = bakeGeo((g) => OB.bush(g, 0, 0, 1.2));
  const N = 240;
  const ip = new THREE.InstancedMesh(pine, VC, N), ir = new THREE.InstancedMesh(round, VC, N), ib = new THREE.InstancedMesh(bush, VC, N);
  for (const m of [ip, ir, ib]) { m.castShadow = true; m.receiveShadow = true; }
  const mtx = new THREE.Matrix4();
  let a = 0, b = 0, c = 0;
  const put = (x, z) => {
    const s = 1.1 + r() * 0.9;
    mtx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.25), s));
    const k = r();
    if (k < 0.45 && a < N) ip.setMatrixAt(a++, mtx); else if (k < 0.8 && b < N) ir.setMatrixAt(b++, mtx); else if (c < N) ib.setMatrixAt(c++, mtx);
  };
  for (let i = 0; i < N * 4; i++) {
    const ang = r() * Math.PI * 2, d = 19 + r() * 26;
    const x = Math.cos(ang) * d * 1.9, z = Math.sin(ang) * d;
    if (Math.abs(x) < 3.5 && z > 14) continue; // keep the road clear
    if (Math.abs(x) < BOUNDS.maxX + 2.5 && z > BOUNDS.minZ - 2.5 && z < BOUNDS.maxZ + 2.5) continue;
    put(x, z);
  }
  // a hedge of bushes and trees just outside the back fence, where the camera looks
  for (let x = BOUNDS.minX; x < BOUNDS.maxX; x += 1.6 + r() * 0.8) { put(x, BOUNDS.minZ - 1.6 - r() * 1.2); }
  ip.count = a; ir.count = b; ib.count = c;
  scene.add(ip, ir, ib);
}
function makeFence(scene) {
  // Wooden post-and-rail fence round the whole farm, plus inner fences that come down when you buy new land.
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const line = (parent, segs) => { const g = new THREE.Group(); for (const sg of segs) OB.fence(g, ...sg); parent.add(bakeStatic(g)); };
  const x0 = minX - 0.4, x1 = maxX + 0.4, z0 = minZ - 0.4, z1 = maxZ + 0.4;
  line(scene, [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z1, -1.6, z1], [1.6, z1, x1, z1]]);
  const dividers = {};
  for (const [id, x] of [['eastLand', HOME.maxX + 0.4], ['westLand', HOME.minX - 0.4]]) {
    const g = new THREE.Group(); scene.add(g); dividers[id] = g;
    line(g, [[x, z0, x, z1]]);
  }
  const gp = new THREE.Group();
  for (const x of [-1.7, 1.7]) { OB.rb(gp, 0.26, 1.3, 0.26, '#9A6237', x, 0.65, maxZ + 0.4, 0.05); OB.sph(gp, 0.16, '#C9884C', x, 1.36, maxZ + 0.4); }
  scene.add(bakeStatic(gp));
  return dividers;
}
// ---------- buildings ----------
export function shingleRoof(w, d, rise, color = 0xc8553d) {
  // Two sloped roof faces covered with overlapping, slightly varied clay shingles.
  const grp = new THREE.Group();
  const half = d / 2 + 0.35, L = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  const rows = Math.ceil(L / 0.2), cols = Math.ceil((w + 0.6) / 0.32);
  const sh = new THREE.BoxGeometry(0.31, 0.03, 0.26); sh.translate(0, 0, 0.13);
  const im = new THREE.InstancedMesh(sh, mats().roof, rows * (cols + 1) * 2);
  im.castShadow = true; im.receiveShadow = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color(), base = new THREE.Color(color), r = rand(5);
  paint(sh, (x, y, z, c) => c.setRGB(1, 1, 1));
  let k = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < rows; i++) for (let j = 0; j <= cols; j++) {
      const t = (i + 0.5) / rows, along = (j + (i % 2) * 0.5) * 0.32 - (w + 0.6) / 2;
      if (along > (w + 0.6) / 2) continue;
      const z = side * (half - t * half), y = rise * t;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(side * ang + 0.05 * side, side > 0 ? 0 : Math.PI, 0, 'YXZ'));
      mtx.compose(new THREE.Vector3(along, y + 0.02, z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(k, mtx); im.setColorAt(k, col.copy(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12)); k++;
    }
  }
  im.count = k; grp.add(im);
  // under-deck so there are no gaps
  for (const side of [-1, 1]) {
    const deck = mesh(new THREE.BoxGeometry(w + 0.6, 0.05, L), mats().beam);
    deck.position.set(0, rise / 2 - 0.02, side * half / 2); deck.rotation.x = side * ang; grp.add(deck);
  }
  const ridge = mesh(at(new THREE.CylinderGeometry(0.09, 0.09, w + 0.7, 10), 0, rise + 0.03, 0, 0, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a3f2c, roughness: 0.7 }));
  grp.add(ridge);
  return grp;
}
function signTex(text, bg = '#FFF6E6', fg = '#2B1D14') {
  return canvasTex(512, 128, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = '700 76px Fredoka, "Nunito", ui-rounded, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 4); });
}
function windowAt(grp, x, y, z, w = 0.8, h = 0.9, box = true) {
  const m = mats();
  grp.add(mesh(at(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.08), x, y, z), m.beam));
  grp.add(mesh(at(new THREE.BoxGeometry(w, h, 0.04), x, y, z + 0.03), m.glass, false));
  grp.add(mesh(at(new THREE.BoxGeometry(0.05, h, 0.06), x, y, z + 0.05), m.beam), mesh(at(new THREE.BoxGeometry(w, 0.05, 0.06), x, y, z + 0.05), m.beam));
  for (const s of [-1, 1]) grp.add(mesh(at(new THREE.BoxGeometry(w * 0.5, h + 0.1, 0.05), x + s * (w * 0.75 + 0.06), y, z + 0.04), new THREE.MeshStandardMaterial({ color: 0x5f8a6a, roughness: 0.7 })));
  if (box) {
    grp.add(mesh(at(new THREE.BoxGeometry(w + 0.2, 0.2, 0.26), x, y - h / 2 - 0.12, z + 0.13), m.wood));
    const r = rand(Math.round(x * 10 + 99));
    for (let i = 0; i < 7; i++) {
      grp.add(mesh(at(new THREE.SphereGeometry(0.07 + r() * 0.03, 8, 6), x - w / 2 + 0.05 + i * (w / 6.5), y - h / 2 + 0.03 + r() * 0.05, z + 0.15 + (r() - 0.5) * 0.1), new THREE.MeshStandardMaterial({ color: [0xe58fb0, 0xf4d35e, 0xfff6e0, 0xc8553d][i % 4], roughness: 0.7 }), false));
      grp.add(mesh(at(new THREE.SphereGeometry(0.08, 8, 6), x - w / 2 + 0.1 + i * (w / 6.5), y - h / 2 - 0.02, z + 0.12), mats().foliage, false));
    }
  }
}
function makeBakery() {
  // The bakery: the Design cottage, scaled up to fill its plot, with a sign over the door.
  const g = new THREE.Group(), k = 1.6;
  const c = new THREE.Group(); c.scale.setScalar(k); g.add(c);
  const T = THREE;
  const { rb, sph, add, G, M } = OB;
  rb(c, 4.2, 0.25, 3.2, '#C9C3B3', 0, 0.12, 0, 0.06);
  rb(c, 4.0, 2.3, 3.0, '#FFF1D9', 0, 1.35, 0, 0.1);
  [-1.95, 1.95].forEach((sx) => rb(c, 0.16, 2.3, 0.16, '#9A6237', sx, 1.35, 1.48, 0.03));
  rb(c, 4.1, 0.16, 0.16, '#9A6237', 0, 2.45, 1.48, 0.03);
  const rf = G(c, 0, 2.5, 0);
  rb(rf, 2.75, 0.22, 3.6, '#E0402F', -1.08, 0.82, 0, 0.06, { rz: 0.62 }); rb(rf, 2.75, 0.22, 3.6, '#C2321F', 1.08, 0.82, 0, 0.06, { rz: -0.62 });
  const gab = new T.Shape(); gab.moveTo(-2, 0); gab.lineTo(2, 0); gab.lineTo(0, 1.45); gab.lineTo(-2, 0);
  add(rf, new T.ExtrudeGeometry(gab, { depth: 2.9, bevelEnabled: false }), M('#FFE6C2'), 0, -0.05, -1.45);
  rb(c, 0.5, 1.4, 0.5, '#A54C2C', 1.1, 4.0, -0.5, 0.05); rb(c, 0.62, 0.14, 0.62, '#8A3A20', 1.1, 4.72, -0.5, 0.03);
  rb(c, 0.9, 1.5, 0.1, '#8B4E2A', 0, 0.95, 1.52, 0.06); sph(c, 0.05, '#F7C232', 0.28, 0.95, 1.6);
  [-1.25, 1.25].forEach((sx) => {
    rb(c, 0.9, 0.8, 0.08, M('#FFD45A', { emissive: '#FFB62E', emissiveIntensity: 0.6 }), sx, 1.45, 1.52, 0.04);
    rb(c, 1.0, 0.1, 0.12, '#9A6237', sx, 1.88, 1.56, 0.03); rb(c, 1.0, 0.1, 0.12, '#9A6237', sx, 1.02, 1.56, 0.03);
    rb(c, 0.08, 0.8, 0.1, '#9A6237', sx, 1.45, 1.56, 0.02); rb(c, 0.9, 0.08, 0.1, '#9A6237', sx, 1.45, 1.56, 0.02);
    rb(c, 1.0, 0.22, 0.3, '#9A6237', sx, 0.88, 1.68, 0.04);
    for (let i = 0; i < 4; i++) sph(c, 0.1, ['#FF6F9C', '#FFD23F', '#FFFFFF', '#FF6F9C'][i], sx - 0.33 + i * 0.22, 1.04, 1.68);
  });
  const aw = G(c, 0, 2.15, 1.75); aw.rotation.x = 0.45;
  for (let i = 0; i < 5; i++) rb(aw, 0.3, 0.06, 0.6, i % 2 ? '#FFF6E6' : '#E8392F', -0.6 + i * 0.3, 0, 0, 0.02);
  rb(c, 2.2, 0.55, 0.12, '#FFF6E6', 0, 2.75, 1.62, 0.08); rb(c, 2.3, 0.65, 0.08, '#8B4E2A', 0, 2.75, 1.56, 0.08);
  const out = bakeStatic(g);
  out.add(mesh(at(new THREE.PlaneGeometry(2.0 * k, 0.46 * k), 0, 2.75 * k, 1.69 * k), new THREE.MeshBasicMaterial({ map: signTex('Bakery', '#FFF6E6', '#7A2E1E'), toneMapped: false }), false, false));
  return { group: out, chimneyTop: new THREE.Vector3(1.1 * k, 4.8 * k, -0.5 * k) };
}
function makeOven(kind) {
  // The Design oven: brick dome (pies) or white stone (bread), with a glowing door that pulses while baking.
  const g = new THREE.Group(), k = 1.2;
  const o = OB.oven(null, 0, 0, 0, kind === 'bread'); o.scale.setScalar(k); g.add(o);
  const glowMats = [];
  o.traverse((m) => { if (m.isMesh && m.material.emissiveIntensity > 0.5) { m.material = m.material.clone(); glowMats.push(m.material); } });
  const out = bakeStatic(g);
  const glow = { set intensity(v) { for (const m of glowMats) m.emissiveIntensity = 0.7 + v * 0.18; } };
  out.userData = { fire: null, glow, smokeAt: new THREE.Vector3(0.45 * k, 2.05 * k, -0.35 * k) };
  return out;
}
const T2 = {};
function textures2() {
  if (!T2.slab) T2.slab = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#cfc6b8'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, ['#9a9186', '#efe8dc'], [1, 3]); });
  return T2;
}

function makeStall() {
  // The Design market stall with its red and white awning; the awning fades when you stand behind it.
  const base = new THREE.Group(), k = 1.08;
  const st = OB.stall(null, 0, 0, 0, false); st.scale.setScalar(k); base.add(st);
  st.updateMatrixWorld(true);
  const awnParts = [];
  st.traverse((m) => { if (m.isMesh) { const p = new THREE.Vector3(); m.getWorldPosition(p); if (p.y > 2.0) awnParts.push(m); } });
  const awnRoot = new THREE.Group();
  for (const m of awnParts) { const w = m.matrixWorld.clone(); m.parent.remove(m); w.decompose(m.position, m.quaternion, m.scale); awnRoot.add(m); }
  const g = bakeStatic(base);
  const awn = bakeStatic(awnRoot); const awnMat = VC.clone(); awn.traverse((m) => { if (m.isMesh) m.material = awnMat; }); g.add(awn);
  g.userData.fadeMats = [awnMat];
  return g;
}
function makeField() {
  const g = new THREE.Group();
  const { x0, z0, nx, nz } = FIELD;
  // a raised tilled bed, as in the Design art
  const bed = new THREE.Group();
  OB.rb(bed, nx + 0.5, 0.22, nz + 0.5, '#9C5E2E', x0 + nx / 2, 0.06, z0 + nz / 2, 0.08);
  OB.rb(bed, nx + 0.3, 0.06, nz + 0.3, '#B8733B', x0 + nx / 2, 0.17, z0 + nz / 2, 0.03, { cast: false });
  for (let j = 0; j < nz; j++) OB.rb(bed, nx + 0.1, 0.04, 0.12, '#A8683A', x0 + nx / 2, 0.205, z0 + j + 0.5, 0.02, { cast: false });
  g.add(bakeStatic(bed));
  const r = rand(55);
  const clump = bakeGeo((cg) => { for (let i = 0; i < 4; i++) { const sx = (i % 2 - 0.5) * 0.22 + (r() - 0.5) * 0.06, sz = (Math.floor(i / 2) - 0.5) * 0.22 + (r() - 0.5) * 0.06, hh = 0.55 + r() * 0.15; OB.cyl(cg, 0.02, 0.025, hh, '#C9A13A', sx, hh / 2, sz, 5); OB.add(cg, new THREE.CapsuleGeometry(0.055, 0.16, 3, 6), OB.F('#F4C843'), sx, hh + 0.05, sz); } });
  const im = new THREE.InstancedMesh(clump, VC, nx * nz * 2); im.castShadow = true; im.receiveShadow = true;
  const cells = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = x0 + i + 0.5, cz = z0 + j + 0.5;
    cells.push({ x: cx, z: cz, grow: 1, idx: cells.length * 2, rot: r() * 6, rot2: r() * 6 });
  }
  g.add(im);
  // hay bales and a scarecrow
  const hay = new THREE.Group();
  for (const [x, z, ry] of [[x0 - 0.8, z0 + nz + 0.5, 0.3], [x0 + 0.3, z0 + nz + 1.1, 1.4]]) { const b = OB.G(hay, x, 0, z, ry); OB.cyl(b, 0.45, 0.45, 0.7, '#F2C25A', 0, 0.45, 0, 16, { rz: Math.PI / 2 }); OB.cyl(b, 0.46, 0.46, 0.08, '#D8A23A', 0, 0.45, 0, 16, { rz: Math.PI / 2 }); }
  OB.cyl(hay, 0.04, 0.04, 1.4, '#9A6237', x0 + nx + 0.8, 0.5, z0 + 1, 6);
  g.add(bakeStatic(hay));
  const sc = makePerson({ seed: 404, shirt: 0xd8392e, pants: 0x2f4a7a, hairStyle: 3, skin: 0xf2c25a });
  sc.position.set(x0 + nx + 0.8, 0.15, z0 + 1); sc.scale.setScalar(0.8); sc.userData.arms.forEach((a, i) => { a.sh.rotation.z = (i ? 1 : -1) * 1.45; }); g.add(sc);
  return { group: g, im, cells };
}
export function updateFieldInstances(field) {
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const c of field.cells) {
    const s = Math.max(0.02, c.grow);
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(e.set(0, k ? c.rot2 : c.rot, 0));
      mtx.compose(new THREE.Vector3(c.x + (k ? 0.18 : -0.18), 0.2, c.z + (k ? -0.1 : 0.12)), q, new THREE.Vector3(0.9 + s * 0.1, s, 0.9 + s * 0.1));
      field.im.setMatrixAt(c.idx + k, mtx);
    }
    const col = new THREE.Color().setRGB(0.75 + s * 0.25, 0.85 + s * 0.15, 0.6 + s * 0.4 * (s >= 1 ? 1 : 0.6));
    field.im.setColorAt(c.idx, col); field.im.setColorAt(c.idx + 1, col);
  }
  field.im.instanceMatrix.needsUpdate = true; if (field.im.instanceColor) field.im.instanceColor.needsUpdate = true;
}

function makeTeaGarden() {
  const g = new THREE.Group(), seats = [];
  // a round cream terrace with three tables under striped umbrellas
  const deco = new THREE.Group();
  OB.cyl(deco, 3.5, 3.5, 0.08, '#F2E3C6', 8, 0.04, 11.4, 40, { cast: false }); OB.cyl(deco, 3.25, 3.25, 0.09, '#FFF1D9', 8, 0.045, 11.4, 40, { cast: false });
  TEA.forEach(([x, z], i) => {
    OB.sph(deco, 0.12, '#FFFFFF', x, 0.95, z, { s: [1, 0.85, 1] }); OB.cyl(deco, 0.02, 0.02, 0.12, '#FFFFFF', x + 0.12, 0.96, z, 6, { rz: -1 });
    for (const sd of [-1, 1]) OB.cyl(deco, 0.05, 0.04, 0.07, '#FFFFFF', x + sd * 0.28, 0.86, z, 12);
  });
  for (const [x, z] of [[4.9, 13.6], [11.1, 13.6], [11.4, 9.0]]) { OB.cyl(deco, 0.38, 0.28, 0.5, '#C55F37', x, 0.25, z, 14); OB.bush(deco, x, z - 0.05, 0.9); deco.children[deco.children.length - 1].position.y = 0.45; }
  g.add(bakeStatic(deco));
  const cloth = new THREE.MeshStandardMaterial({ color: 0xfff6e6 });
  TEA.forEach(([x, z], i) => {
    const t = makeTable(1.0, 1.0, 0.76, cloth); t.position.set(x, 0.08, z); g.add(t);
    const u = makeUmbrella(i % 2 ? 0x45a535 : 0xe8392f); u.position.set(x, 0.08, z); g.add(u);
    for (const sd of [-1, 1]) {
      const ch = makeChair(); ch.position.set(x + sd * 0.75, 0.08, z); ch.rotation.y = sd * -Math.PI / 2; g.add(ch);
      seats.push({ x: x + sd * 0.75, z, face: sd > 0 ? -Math.PI / 2 : Math.PI / 2, busy: null });
    }
  });
  return { group: g, seats };
}
function makeFlowerGarden() {
  const g = new THREE.Group(), beds = new THREE.Group();
  for (const [x, z, w, d] of [[-6.5, 11.5, 2.6, 1.2], [-9.8, 11.5, 2.6, 1.2], [-8.2, 9.3, 4.6, 0.9]]) OB.field(beds, x, z, w + 0.3, d + 0.4, 'flowers');
  g.add(bakeStatic(beds));
  const b = makeBench(); b.position.set(-8.2, 0, 13.4); b.rotation.y = Math.PI; g.add(b);
  const l = makeLamp(); l.position.set(-4.8, 0, 12.6); g.add(l);
  return g;
}
function makeJamKitchen() {
  // The Design jam kitchen (a stove with a big red jam pot) under a simple wooden roof.
  const g = new THREE.Group(), k = 1.45;
  const jk = OB.jamKitchen(null, 0, -0.2); jk.scale.setScalar(k); g.add(jk);
  const glowMats = [];
  jk.traverse((m) => { if (m.isMesh && m.material.emissiveIntensity > 0.5) { m.material = m.material.clone(); glowMats.push(m.material); } });
  const roof = new THREE.Group(); g.add(roof);
  for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9]]) OB.rb(roof, 0.16, 2.5, 0.16, '#9A6237', x, 1.25, z, 0.04);
  OB.rb(roof, 3.0, 0.16, 1.4, '#E0402F', 0, 2.55, -0.45, 0.06, { rx: 0.35 });
  OB.rb(roof, 2.6, 0.08, 0.34, '#B9773F', 0, 1.6, -0.85, 0.03);
  for (let i = 0; i < 6; i++) OB.jar(roof, -1.0 + i * 0.4, 1.64, -0.85, 0.85, i % 2 ? '#7C2BA0' : '#C8263D');
  const out = bakeStatic(g);
  out.userData = { fire: null, glow: { set intensity(v) { for (const m of glowMats) m.emissiveIntensity = 0.7 + v * 0.18; } }, smokeAt: new THREE.Vector3(-0.3, 2.0, -0.2) };
  return out;
}
function makeCart() {
  // The Design produce cart, for selling spare fruit and grain.
  const g = new THREE.Group(); OB.cart(g, 0, 0, 0);
  return bakeStatic(g);
}
function makeSignpost() {
  const g = new THREE.Group();
  OB.rb(g, 0.16, 2.2, 0.16, '#9A6237', 0, 1.1, 0, 0.04);
  OB.rb(g, 1.5, 0.42, 0.08, '#E3A462', 0.25, 1.75, 0.08, 0.05);
  OB.flowers(g, 0, 0.2, 8);
  const out = bakeStatic(g);
  out.add(mesh(at(new THREE.PlaneGeometry(1.36, 0.36), 0.25, 1.75, 0.13), new THREE.MeshBasicMaterial({ map: signTex('Bakery', '#E3A462', '#2B1D14'), toneMapped: false }), false, false));
  return out;
}
function makeBunting() {
  // Strings of little cloth flags across the road.
  const g = new THREE.Group(), m = mats();
  for (const x of [-2.2, 2.2]) OB.rb(g, 0.16, 3.2, 0.16, '#9A6237', x, 1.6, 0, 0.04);
  const cols = ['#E8392F', '#F7C23E', '#FFFFFF', '#45A535', '#FF7FA6', '#3C7FD6'];
  for (let row = 0; row < 2; row++) {
    const n = 14, y0 = 3.0 - row * 0.35;
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(-2.2 + 4.4 * t, y0 - Math.sin(t * Math.PI) * 0.4, 0)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.015, 4), m.white, false));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = -2.2 + 4.4 * t, y = y0 - Math.sin(t * Math.PI) * 0.4;
      OB.add(g, new THREE.ConeGeometry(0.13, 0.3, 3), OB.M(cols[(i + row) % cols.length]), x, y - 0.15, 0, { rx: Math.PI, s: [1, 1, 0.25] });
    }
  }
  return bakeStatic(g);
}
// ---------- build everything ----------
export function buildWorld(scene) {
  makeSky(scene); makeGround(scene); makeForest(scene); const dividers = makeFence(scene);
  const colliders = [];
  for (const [id, x] of [['eastLand', HOME.maxX + 0.4], ['westLand', HOME.minX - 0.4]]) colliders.push({ box: [x - 0.2, BOUNDS.minZ - 1, x + 0.2, BOUNDS.maxZ + 1], until: id }); // {x,z,r} circles or {box:[minx,minz,maxx,maxz]}
  const box = (x, z, w, d) => colliders.push({ box: [x - w / 2, z - d / 2, x + w / 2, z + d / 2] });

  const bakery = makeBakery(); bakery.group.position.set(0, 0, -11.2); scene.add(bakery.group); box(0, -11.2, 7.4, 4.8);
  bakery.chimneyTop.add(bakery.group.position);

  const pieOven = makeOven('pie'); pieOven.position.copy(SPOTS.pieOven); scene.add(pieOven); box(SPOTS.pieOven.x, SPOTS.pieOven.z, 2.8, 2.6);
  const breadOven = makeOven('bread'); breadOven.position.copy(SPOTS.breadOven); scene.add(breadOven);
  const pieInBasket = makeBasket(1); pieInBasket.position.copy(SPOTS.pieIn).add(new THREE.Vector3(0, 0, -0.9)); scene.add(pieInBasket);
  const pieTable = makeTable(1.3, 0.7, 0.8); pieTable.position.copy(SPOTS.pieOut).add(new THREE.Vector3(0, 0, -0.95)); scene.add(pieTable);
  const breadGroup = new THREE.Group(); scene.add(breadGroup);
  breadGroup.add(breadOven);
  const breadBasket = makeBasket(1); breadBasket.position.copy(SPOTS.breadIn).add(new THREE.Vector3(0, 0, -0.9)); breadGroup.add(breadBasket);
  const breadTable = makeTable(1.3, 0.7, 0.8); breadTable.position.copy(SPOTS.breadOut).add(new THREE.Vector3(0, 0, -0.95)); breadGroup.add(breadTable);

  const stall = makeStall(); stall.position.copy(SPOTS.stall); scene.add(stall); box(SPOTS.stall.x, SPOTS.stall.z, 3.1, 1.1);
  // cash tray on a small barrel next to the stall
  const cashBarrel = makeBarrel(); cashBarrel.position.copy(SPOTS.cash).add(new THREE.Vector3(0.1, 0, 0.75)); scene.add(cashBarrel);
  colliders.push({ x: cashBarrel.position.x, z: cashBarrel.position.z, r: 0.35 });

  // decorations
  const decor = (o, x, z, ry = 0, rr = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; scene.add(o); if (rr) colliders.push({ x, z, r: rr }); return o; };
  decor(makeLamp(), -1.6, 3.2, 0, 0.12); decor(makeLamp(), 1.6, -3.4, Math.PI, 0.12); decor(makeLamp(), -1.6, 13, 0, 0.12);
  decor(makeBench(), -3.6, 8.9, Math.PI / 2, 0); // bench by the path
  decor(makeBarrel(), 6.6, -9.6, 0, 0.35); decor(makeCrate(), -6.6, -9.4, 0.4, 0.4); decor(makeCrate(), -6.9, -8.7, 1.2, 0.4);
  const wg = new THREE.Group();
  OB.cyl(wg, 0.75, 0.8, 0.75, '#C9C3B3', 0, 0.37, 0, 16); OB.cyl(wg, 0.62, 0.62, 0.05, '#5CC3E8', 0, 0.62, 0, 16);
  for (const sd of [-1, 1]) OB.rb(wg, 0.14, 1.6, 0.14, '#9A6237', sd * 0.68, 1.2, 0, 0.04);
  OB.cyl(wg, 0.08, 0.08, 1.5, '#C9884C', 0, 1.75, 0, 8, { rz: Math.PI / 2 });
  OB.rb(wg, 1.0, 0.12, 1.5, '#E0402F', -0.4, 2.15, 0, 0.04, { rz: 0.6 }); OB.rb(wg, 1.0, 0.12, 1.5, '#C2321F', 0.4, 2.15, 0, 0.04, { rz: -0.6 });
  decor(bakeStatic(wg), -12.5, -9.5, 0.3, 0.85);

  // orchard trees (all built now; extra groups appear when unlocked)
  const trees = []; const treeGroups = {};
  let seed = 10;
  for (const key of Object.keys(TREE_SPOTS)) {
    const grp = new THREE.Group(); scene.add(grp); treeGroups[key] = grp;
    for (const [x, z] of TREE_SPOTS[key]) {
      const t = makeTree(seed++, true); t.group.position.set(x, 0, z); t.group.rotation.y = seed; grp.add(t.group);
      trees.push({ x, z, apples: t.apples, group: key, timer: 0, foliage: t.foliage, fade: 1 });
      colliders.push({ x, z, r: 0.32, group: key });
    }
  }
  // shade trees around the edge (no fruit)
  for (const [x, z, s] of [[-14.5, -12.5, 1.25], [14.5, -12.6, 1.3], [-15, 12.8, 1.2], [14.8, 13.2, 1.15], [11.5, -12.8, 1.0], [-2.5, 13.6, 0.9], [15, 6.5, 1.1]]) {
    const t = makeTree(seed++ * 7, false); t.group.position.set(x, 0, z); t.group.scale.setScalar(s); scene.add(t.group); colliders.push({ x, z, r: 0.35 * s });
  }

  const field = makeField(); scene.add(field.group); updateFieldInstances(field);
  const tea = makeTeaGarden(); scene.add(tea.group);
  const flowers = makeFlowerGarden(); scene.add(flowers);
  const jamGroup = new THREE.Group(); scene.add(jamGroup);
  const jamKitchen = makeJamKitchen(); jamKitchen.position.copy(SPOTS.jamKitchen); jamGroup.add(jamKitchen);
  colliders.push({ box: [SPOTS.jamKitchen.x - 1.45, SPOTS.jamKitchen.z - 1.05, SPOTS.jamKitchen.x + 1.45, SPOTS.jamKitchen.z + 1.0], need: 'jam' });
  const jamBasket = makeBasket(1); jamBasket.position.copy(SPOTS.jamIn).add(new THREE.Vector3(0, 0, -0.9)); jamGroup.add(jamBasket);
  const jamOutTable = makeTable(1.3, 0.7, 0.8); jamOutTable.position.copy(SPOTS.jamOut).add(new THREE.Vector3(0, 0, -0.95)); jamGroup.add(jamOutTable);
  const jamTable = makeTable(1.1, 0.8, 0.95); jamTable.position.copy(SPOTS.jamTable); jamGroup.add(jamTable);
  colliders.push({ box: [SPOTS.jamTable.x - 0.55, SPOTS.jamTable.z - 0.4, SPOTS.jamTable.x + 0.55, SPOTS.jamTable.z + 0.4], need: 'jam' });
  const cart = makeCart(); cart.position.copy(SPOTS.cart).add(new THREE.Vector3(0, 0, -1.05)); scene.add(cart);
  colliders.push({ box: [cart.position.x - 0.8, cart.position.z - 0.6, cart.position.x + 0.8, cart.position.z + 0.6] });
  const signpost = makeSignpost(); signpost.position.set(2.6, 0, 16.6); signpost.rotation.y = -0.2; scene.add(signpost);
  const bunting = makeBunting(); bunting.position.set(0, 0, 12.2); scene.add(bunting);
  colliders.push({ x: -2.2, z: 12.2, r: 0.12, need: 'sign2' }, { x: 2.2, z: 12.2, r: 0.12, need: 'sign2' });

  const farm = buildFarm(scene, colliders, { shingleRoof, signTex, makeOven, foliageBlob, aoBlob });
  for (const b of farm.bushes) trees.push(b);
  const wind = makeGrass(scene, (x, z) => {
    if (x > FIELD.x0 - 0.5 && x < FIELD.x0 + FIELD.nx + 0.5 && z > FIELD.z0 - 0.5 && z < FIELD.z0 + FIELD.nz + 0.5) return true;
    if (Math.hypot(x - 8, z - 11.4) < 3.6) return true;
    if (Math.hypot((x - 20.0) / 2.9, (z - 11.6) / 2.1) < 1) return true; // pond
    if (x < -23 && x > -33 && z > 1.8 && z < 10.6) return true; // strawberry beds
    for (const c of colliders) if (c.box) { const [a, b, cc, d] = c.box; if ((cc - a) * (d - b) > 15) continue; if (x > a - 0.2 && x < cc + 0.2 && z > b - 0.2 && z < d + 0.2) return true; }
    return false;
  });

  return {
    colliders, trees, treeGroups, farm, dividers, stall, field, tea, flowers, bakery, jamGroup, jamKitchen, signpost, bunting, pieOven, breadOven, breadGroup,
    anchors: {
      pieIn: pieInBasket.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      pieOut: pieTable.position.clone().add(new THREE.Vector3(0, 0.83, 0)),
      breadIn: breadBasket.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      breadOut: breadTable.position.clone().add(new THREE.Vector3(0, 0.83, 0)),
      stall: SPOTS.stall.clone().add(new THREE.Vector3(0, 1.01, 0)),
      cash: cashBarrel.position.clone().add(new THREE.Vector3(0, 0.88, 0)),
      jamIn: jamBasket.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      jamOut: jamOutTable.position.clone().add(new THREE.Vector3(0, 0.83, 0)),
      jamTable: SPOTS.jamTable.clone().add(new THREE.Vector3(0, 0.98, 0))
    },
    wind, addBox: box
  };
}
