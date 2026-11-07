// Orchard Bakery: a calm 3D bakery-management game.
// Pick apples and wheat, bake pies and bread, stock the stall, collect coins, build your bakery up.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { makeItem, makePerson, animatePerson, makeCoin, makeBasket, makeUmbrella, makeTable, rand, mats } from './models.js';
import { buildWorld, updateFieldInstances, SPOTS, FIELD, BOUNDS, PADS, PAD_ORDER, LEVELS, makeTree } from './world.js';
import { makeFarmItem, makeWagonIcon } from './farm.js';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const SAVE_KEY = 'orchard-bakery-save-v1';

// ---------- renderer ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Draw at the screen's full sharpness (up to 3x on iPhone); only step down a little if a device really struggles.
const DPR = window.devicePixelRatio || 1;
let pixelRatio = Math.min(DPR, 3);
const MIN_RATIO = Math.min(DPR, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86; // bright and sunny, like a toy farm
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e7d6, 45, 120);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environment = envTex;
// soften the studio reflections so the outdoor sun leads

const hemi = new THREE.HemisphereLight(0xe4f2ff, 0x7fa456, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2da, 2.7);
sun.position.set(-12, 22, 10); sun.castShadow = true;
const BIG = !matchMedia("(pointer: coarse)").matches && !/[?&]lite/.test(location.search);
sun.shadow.mapSize.set(BIG ? 4096 : 2048, BIG ? 4096 : 2048);
Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 19, bottom: -19, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(40, 1, 0.6, 400);

const world = buildWorld(scene);

// ---------- state ----------
const DEFAULT = () => ({ coins: 0, cash: 0, unlocked: {}, paid: {}, carry: [], piles: {}, levels: {}, sound: true, sold: 0, xp: 0, level: 1, stats: { sold: {}, orders: 0, builds: 0, earned: 0 }, tasks: [], order: null });
let S = DEFAULT();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s.coins === 'number') S = Object.assign(DEFAULT(), s); } catch (e) { /* fresh start */ }
// older saves: move oven and stall counts into the general pile store, and give a bakery level for past sales
if (S.ovens) { const o = S.ovens, st = S.stall || {}; Object.assign(S.piles, { pieIn: o.pie?.in, pieOut: o.pie?.out, breadIn: o.bread?.in, breadOut: o.bread?.out, jamIn: o.jam?.in, jamOut: o.jam?.out, stallPie: st.pie, stallBread: st.bread, stallJam: st.jam }); delete S.ovens; delete S.stall; }
S.stats = Object.assign({ sold: {}, orders: 0, builds: 0, earned: 0 }, S.stats || {});
if (!S.migratedXp) { S.migratedXp = true; S.xp = (S.xp || 0) + S.sold + Object.keys(S.unlocked).length * 6; }
const xpNeed = (L) => Math.round(12 * Math.pow(1.27, L - 1) + 8 * L);
while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; }
const lv = (id) => S.levels[id] || 0;
const save = () => {
  S.carry = player.carry.items.map((i) => i.kind);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be blocked */ }
};
const cap = () => (S.unlocked.barrow ? 22 : S.unlocked.basket ? 14 : 8) + lv('lvTray') * 2;
// Each product: raw item -> station basket -> finished goods table -> stall display
const PRODUCTS = {
  pie: { raw: 'apple', inP: 'pieIn', outP: 'pieOut', stall: 'stallPie', need: null },
  bread: { raw: 'wheat', inP: 'breadIn', outP: 'breadOut', stall: 'stallBread', need: 'bread' },
  jam: { raw: 'apple', inP: 'jamIn', outP: 'jamOut', stall: 'stallJam', need: 'jam' },
  custard: { raw: 'egg', inP: 'custardIn', outP: 'custardOut', stall: 'stallCustard', need: 'pastry' },
  butter: { raw: 'milk', inP: 'butterIn', outP: 'butterOut', stall: 'stallButter', need: 'churn' },
  tart: { raw: 'berry', inP: 'tartIn', outP: 'tartOut', stall: 'stallTart', need: 'tarts' },
  honey: { raw: 'comb', inP: 'honeyIn', outP: 'honeyOut', stall: 'stallHoney', need: 'honey' },
  cheese: { raw: 'milk', inP: 'cheeseIn', outP: 'cheeseOut', stall: 'stallCheese', need: 'cheese' },
  cider: { raw: 'apple', inP: 'ciderIn', outP: 'ciderOut', stall: 'stallCider', need: 'cider' }
};
// Raw goods that animals and hives make on their own, ready to collect
const PRODUCERS = { eggs: { kind: 'egg', need: 'hens' }, milk: { kind: 'milk', need: 'dairy' }, comb: { kind: 'comb', need: 'bees' } };
const NAMES = { apple: 'apples', wheat: 'wheat', berry: 'strawberries', egg: 'eggs', milk: 'milk', comb: 'honeycomb', pie: 'pies', bread: 'loaves', jam: 'jars of jam', custard: 'custard tarts', butter: 'butter', tart: 'berry tarts', honey: 'jars of honey', cheese: 'cheeses', cider: 'bottles of cider' };
const SPARE = { apple: 1, wheat: 1, berry: 2, egg: 2, milk: 2, comb: 3 }; // farm cart prices
const live = (k) => !PRODUCTS[k].need || !!S.unlocked[PRODUCTS[k].need];
const BASE_PRICE = { pie: 6, bread: 7, jam: 9, custard: 12, butter: 14, tart: 16, honey: 18, cheese: 22, cider: 26 };
const price = (k) => Math.round((BASE_PRICE[k] + (k === 'pie' && S.unlocked.price1 ? 3 : 0) + ((k === 'bread' || k === 'jam') && S.unlocked.price2 ? 3 : 0)) * (1 + 0.15 * lv('lvPrice')));
const bakeTime = () => Math.max(0.12, 1.0 * (S.unlocked.oven1 ? 0.7 : 1) * (S.unlocked.oven2 ? 0.7 : 1) * Math.pow(0.88, lv('lvOven'))); // seconds per item
const growRate = () => Math.pow(1.14, lv('lvGrow'));
const farmRate = () => Math.pow(1.15, lv('lvFarm'));
const beeRate = () => Math.pow(1.15, lv('lvHill'));
const handRate = () => Math.min(2.2, Math.pow(1.08, lv('lvHands')));

// ---------- sound (soft, optional) ----------
let actx = null;
function tone(freq, dur = 0.12, type = 'sine', vol = 0.06, delay = 0) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* no audio */ }
}
let lastPop = 0;
const sfx = {
  pick() { const n = performance.now(); if (n - lastPop < 60) return; lastPop = n; tone(520 + Math.random() * 120, 0.08, 'sine', 0.045); },
  coin() { const n = performance.now(); if (n - lastPop < 50) return; lastPop = n; tone(1320, 0.09, 'triangle', 0.03); tone(1760, 0.12, 'triangle', 0.025, 0.04); },
  build() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.05, i * 0.08)); }
};

// ---------- small timers that follow game time ----------
const timers = [];
function after(sec, fn) { timers.push({ t: sec, fn }); }
function updateTimers(dt) { for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } } }

// ---------- flying items ----------
const flights = [];
function fly(obj, fromWorld, toParent, toLocal, dur = 0.32, onDone, arc = 0.9) {
  scene.add(obj); obj.position.copy(fromWorld);
  const f = { obj, from: fromWorld.clone(), toParent, toLocal: toLocal.clone(), t: 0, dur, onDone, arc };
  flights.push(f); return f;
}
function updateFlights(dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]; f.t += dt;
    const k = Math.min(1, f.t / f.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const target = f.toParent ? f.toParent.localToWorld(f.toLocal.clone()) : f.toLocal;
    f.obj.position.lerpVectors(f.from, target, e); f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
    if (k >= 1) {
      flights.splice(i, 1);
      if (f.toParent) { f.toParent.add(f.obj); f.obj.position.copy(f.toLocal); } else scene.remove(f.obj);
      f.onDone && f.onDone();
    }
  }
}

// ---------- piles (stacks of items on trays, tables, baskets, the stall) ----------
const SCALE = { apple: 0.85, pie: 0.8, bread: 0.8, wheat: 1.1, coin: 1, jam: 1.12, berry: 1.25, egg: 1.2, milk: 1.1, comb: 1.05, custard: 1.25, butter: 1.2, tart: 1.0, honey: 1.12, cheese: 1.15, cider: 1.1 };
const LAYER = { // per-layer offsets, layer height, base lift
  apple: [[[-0.096, -0.045], [0.096, -0.045], [0, 0.096]], 0.215, 0.12],
  pie: [[[0, 0]], 0.112, 0],
  bread: [[[0, -0.085], [0, 0.085]], 0.175, 0],
  wheat: [[[0, -0.066], [0, 0.066]], 0.094, 0.05],
  jam: [[[-0.112, 0], [0.112, 0]], 0.24, 0],
  berry: [[[-0.088, -0.062], [0.088, -0.062], [0, 0.088], [0.125, 0.075], [-0.125, 0.075]], 0.125, 0.088],
  egg: [[[-0.084, -0.06], [0.084, -0.06], [0, 0.084]], 0.155, 0],
  milk: [[[-0.077, 0], [0.077, 0]], 0.33, 0],
  comb: [[[0, 0]], 0.042, 0],
  custard: [[[-0.125, -0.06], [0.125, -0.06], [0, 0.125]], 0.062, 0],
  butter: [[[-0.1, 0], [0.1, 0]], 0.09, 0],
  tart: [[[0, 0]], 0.075, 0],
  honey: [[[-0.112, 0], [0.112, 0]], 0.24, 0],
  cheese: [[[0, 0]], 0.095, 0],
  cider: [[[-0.07, 0], [0.07, 0]], 0.34, 0]
};
function trayLayout(items, i) { // mixed stack: same-kind items share layers
  let y = 0, layerKind = null, inLayer = 0, p = null;
  for (let j = 0; j <= i; j++) {
    const k = items[j].kind, L = LAYER[k];
    if (k !== layerKind || inLayer >= L[0].length) { if (layerKind) y += LAYER[layerKind][1]; layerKind = k; inLayer = 0; }
    if (j === i) { const o = L[0][inLayer]; p = new V3(o[0], y + L[2], o[1]); }
    inLayer++;
  }
  return p;
}
function gridLayout(cols, rows, sx, sz, ox = 0, oz = 0) {
  return (items, i) => {
    const k = items[i].kind, L = LAYER[k], per = cols * rows;
    const layer = Math.floor(i / per), c = i % per, cx = c % cols, cz = Math.floor(c / cols);
    return new V3(ox + (cx - (cols - 1) / 2) * sx, layer * L[1] + L[2], oz + (cz - (rows - 1) / 2) * sz);
  };
}
function basketLayout(items, i) {
  const k = items[i].kind;
  if (k === 'wheat') { const layer = Math.floor(i / 3), c = i % 3; return new V3(0, 0.02 + layer * 0.08, (c - 1) * 0.12); }
  const layer = Math.floor(i / 7), c = i % 7;
  if (c === 0) return new V3(0, 0.02 + layer * 0.18, 0);
  const a = c * Math.PI / 3 + layer * 0.5; return new V3(Math.cos(a) * 0.2, 0.02 + layer * 0.18, Math.sin(a) * 0.2);
}
function newItem(kind) {
  const m = makeItem(kind) || makeFarmItem(kind); m.scale.setScalar(SCALE[kind] ?? 1);
  if (['apple', 'pie', 'berry', 'egg', 'custard', 'tart'].includes(kind)) m.rotation.y = Math.random() * 6;
  return m;
}
class Pile {
  constructor(parent, layout, at) { this.g = new THREE.Group(); if (at) this.g.position.copy(at); parent.add(this.g); this.items = []; this.layout = layout; }
  get count() { return this.items.length; }
  countOf(k) { let n = 0; for (const it of this.items) if (it.kind === k) n++; return n; }
  add(kind, fromWorld, dur, done) {
    const it = { kind, m: newItem(kind), flying: true }; this.items.push(it);
    it.f = fly(it.m, fromWorld, this.g, this.layout(this.items, this.items.length - 1), dur, () => { it.flying = false; it.f = null; done && done(); });
    return it;
  }
  addInstant(kind) { const it = { kind, m: newItem(kind), flying: false }; this.items.push(it); this.g.add(it.m); it.m.position.copy(this.layout(this.items, this.items.length - 1)); return it; }
  take(kind) {
    let idx = -1;
    for (let j = this.items.length - 1; j >= 0; j--) if (!kind || this.items[j].kind === kind) { if (!this.items[j].flying) { idx = j; break; } }
    if (idx < 0) return null;
    const it = this.items.splice(idx, 1)[0];
    const wp = it.m.getWorldPosition(new V3());
    if (it.m.parent) it.m.parent.remove(it.m);
    return { mesh: it.m, wp, kind: it.kind };
  }
  update(dt) {
    const k = 1 - Math.exp(-16 * dt);
    this.items.forEach((it, i) => { if (!it.flying) it.m.position.lerp(this.layout(this.items, i), k); else if (it.f) it.f.toLocal.copy(this.layout(this.items, i)); });
  }
}

const A = world.anchors;
const piles = {
  pieIn: new Pile(scene, basketLayout, A.pieIn), pieOut: new Pile(scene, gridLayout(3, 1, 0.48, 0), A.pieOut),
  breadIn: new Pile(world.breadGroup, basketLayout, A.breadIn), breadOut: new Pile(world.breadGroup, gridLayout(2, 2, 0.55, 0.22), A.breadOut),
  stallPie: new Pile(scene, gridLayout(3, 1, 0.5, 0, -0.8, -0.05), A.stall), stallBread: new Pile(scene, gridLayout(2, 2, 0.52, 0.25, 0.85, -0.05), A.stall),
  jamIn: new Pile(world.jamGroup, basketLayout, A.jamIn), jamOut: new Pile(world.jamGroup, gridLayout(4, 2, 0.26, 0.24), A.jamOut),
  stallJam: new Pile(world.jamGroup, gridLayout(4, 3, 0.24, 0.22), A.jamTable)
};
// the bigger farm's baskets, tables and displays
const FA = world.farm.anchors, FG = world.farm.groups;
Object.assign(piles, {
  eggs: new Pile(FG.hens, gridLayout(5, 3, 0.15, 0.14), FA.eggs), milk: new Pile(FG.dairy, gridLayout(5, 2, 0.16, 0.2), FA.milk),
  comb: new Pile(FG.bees, gridLayout(2, 2, 0.4, 0.26), FA.comb),
  custardIn: new Pile(FG.pastry, basketLayout, FA.custardIn), custardOut: new Pile(FG.pastry, gridLayout(5, 3, 0.22, 0.2), FA.custardOut),
  butterIn: new Pile(FG.churn, gridLayout(4, 2, 0.15, 0.17), FA.butterIn), butterOut: new Pile(FG.churn, gridLayout(5, 3, 0.2, 0.17), FA.butterOut),
  tartIn: new Pile(FG.tarts, basketLayout, FA.tartIn), tartOut: new Pile(FG.tarts, gridLayout(3, 2, 0.4, 0.3), FA.tartOut),
  honeyIn: new Pile(FG.honey, gridLayout(2, 2, 0.36, 0.24), FA.honeyIn), honeyOut: new Pile(FG.honey, gridLayout(4, 2, 0.24, 0.24), FA.honeyOut),
  stallCustard: new Pile(FG.shopE, gridLayout(3, 3, 0.21, 0.22, -0.42, 0), FA.stallE), stallButter: new Pile(FG.shopE, gridLayout(2, 3, 0.2, 0.22, 0.48, 0), FA.stallE),
  stallTart: new Pile(FG.shopW, gridLayout(2, 2, 0.4, 0.36, -0.4, 0), FA.stallW), stallHoney: new Pile(FG.shopW, gridLayout(2, 3, 0.2, 0.22, 0.5, 0), FA.stallW),
  cheeseIn: new Pile(FG.cheese, gridLayout(4, 2, 0.16, 0.2), FA.cheeseIn), cheeseOut: new Pile(FG.cheese, gridLayout(4, 2, 0.28, 0.26), FA.cheeseOut),
  ciderIn: new Pile(FG.cider, basketLayout, FA.ciderIn), ciderOut: new Pile(FG.cider, gridLayout(5, 2, 0.2, 0.22), FA.ciderOut),
  stallCheese: new Pile(FG.shopN, gridLayout(2, 2, 0.28, 0.3, -0.42, 0), FA.stallN), stallCider: new Pile(FG.shopN, gridLayout(3, 2, 0.16, 0.22, 0.45, 0), FA.stallN),
  order: new Pile(FG.wagon, gridLayout(4, 3, 0.3, 0.3), FA.order)
});
const PILE_KIND = { pieIn: 'apple', pieOut: 'pie', breadIn: 'wheat', breadOut: 'bread', jamIn: 'apple', jamOut: 'jam', eggs: 'egg', milk: 'milk', comb: 'comb' };
for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; PILE_KIND[P.inP] = P.raw; PILE_KIND[P.outP] = k; PILE_KIND[P.stall] = k; }
const MAXP = { pieIn: 28, breadIn: 24, jamIn: 28, pieOut: 12, breadOut: 12, jamOut: 16, custardIn: 28, custardOut: 15, butterIn: 16, butterOut: 15, tartIn: 28, tartOut: 12, honeyIn: 12, honeyOut: 16, cheeseIn: 16, cheeseOut: 16, ciderIn: 28, ciderOut: 20, eggs: 15, milk: 10, comb: 8 };
const maxp = (name) => (name.startsWith('stall') ? (S.unlocked.stall2 ? 20 : 12) + lv('lvStore') * 4 : MAXP[name] + (PRODUCERS[name] ? 0 : lv('lvStore') * 4));
const HELPER_FILL = 16; // helpers leave room in the baskets so you can always add your own

// Coins resting on the cash barrel
const cashPile = new Pile(scene, (items, i) => { const per = 7, layer = Math.floor(i / per), c = i % per; if (c === 0) return new V3(0, layer * 0.024 + 0.012, 0); const a = c * Math.PI / 3; return new V3(Math.cos(a) * 0.17, layer * 0.024 + 0.012, Math.sin(a) * 0.17); }, A.cash);
LAYER.coin = [[[0, 0]], 0.024, 0.012];
function syncCash() {
  const want = Math.min(S.cash, 56);
  while (cashPile.count < want) cashPile.addInstant('coin');
  while (cashPile.count > want) { const t = cashPile.take(); if (!t) break; }
}

// ---------- people ----------
function makeActor(person, capacity, speed) {
  const a = { obj: person, vel: new V3(), carry: null, cap: capacity, speed, cool: 0, facing: 0 };
  a.carry = new Pile(person.userData.tray, trayLayout);
  return a;
}
const player = makeActor(makePerson({ seed: 7, apron: true, hat: true, shirt: 0xc8553d, pants: 0x4a5a6e, hair: 0x6a4428, skin: 0xf1c9a5, height: 1 }), 8, 4.6);
player.obj.position.set(0, 0, -1.5);
scene.add(player.obj);

// ---------- smoke and puffs ----------
const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const puffs = [];
function puff(pos, opts = {}) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: opts.color ?? 0xffffff, opacity: opts.opacity ?? 0.7 }));
  m.position.copy(pos); const s = opts.size ?? 0.4; m.scale.set(s, s, s); scene.add(m);
  puffs.push({ m, t: 0, life: opts.life ?? 1.6, vel: opts.vel ?? new V3((Math.random() - 0.5) * 0.2, 0.7, (Math.random() - 0.5) * 0.2), grow: opts.grow ?? 1.2, o: opts.opacity ?? 0.7 });
}
function updatePuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt; const k = p.t / p.life;
    p.m.position.addScaledVector(p.vel, dt); p.vel.x += 0.15 * dt;
    const s = p.m.scale.x + p.grow * dt; p.m.scale.set(s, s, s);
    p.m.material.opacity = p.o * (1 - k);
    if (k >= 1) { scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1); }
  }
}
function burst(center, n = 14, radius = 1.6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    puff(center.clone().add(new V3(Math.cos(a) * radius * 0.5, 0.3, Math.sin(a) * radius * 0.5)), { vel: new V3(Math.cos(a) * 1.4, 0.8, Math.sin(a) * 1.4), life: 0.7, size: 0.6, grow: 1.8, opacity: 0.85, color: 0xfff6e6 });
  }
}

// ---------- icons (rendered from the real 3D models) ----------
const ICON = {};
function renderIcons() {
  const ir = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  ir.setSize(256, 256); ir.setPixelRatio(1); ir.outputColorSpace = THREE.SRGBColorSpace; ir.toneMapping = THREE.ACESFilmicToneMapping;
  const is = new THREE.Scene();
  const ip = new THREE.PMREMGenerator(ir); is.environment = ip.fromScene(new RoomEnvironment(ir), 0.04).texture;
  is.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 4, 3); is.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const shot = (name, obj, dir = new V3(0.2, 0.75, 1)) => {
    is.add(obj);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new V3()), r = box.getSize(new V3()).length() / 2;
    cam.position.copy(c).add(dir.normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(15)) * 0.95)); cam.lookAt(c);
    ir.render(is, cam); ICON[name] = ir.domElement.toDataURL('image/png'); is.remove(obj);
  };
  shot('apple', makeItem('apple'), new V3(0.3, 0.5, 1)); shot('pie', makeItem('pie')); shot('bread', makeItem('bread'), new V3(0.4, 0.8, 1));
  shot('wheat', (() => { const g = makeItem('wheat'); g.rotation.z = 0.9; return g; })(), new V3(0, 0.3, 1));
  shot('coin', (() => { const c = makeCoin(); c.rotation.x = 1.1; return c; })(), new V3(0, 0.2, 1));
  shot('tree', makeTree(3, true).group, new V3(0.2, 0.25, 1));
  shot('tray', (() => { const g = makeBasket(1); for (let i = 0; i < 5; i++) { const a = makeItem('apple'); a.position.set(Math.cos(i * 1.3) * 0.17 * (i ? 1 : 0), 0.3 + (i ? 0 : 0.08), Math.sin(i * 1.3) * 0.17 * (i ? 1 : 0)); g.add(a); } return g; })());
  shot('tea', (() => { const g = new THREE.Group(); g.add(makeTable(1, 1, 0.76)); const u = makeUmbrella(); g.add(u); return g; })(), new V3(0.4, 0.35, 1));
  shot('jam', makeItem('jam'), new V3(0.2, 0.5, 1));
  shot('fire', (() => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 + (i % 2) * 0.05, 0.4 + (i % 3) * 0.12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffa040 : 0xff6a20 })); f.position.set((i - 2) * 0.12, 0.2, (i % 2) * 0.08); g.add(f); } for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), mats().beam); l.rotation.set(0, i, Math.PI / 2); l.position.y = 0.03; g.add(l); } return g; })(), new V3(0, 0.4, 1));
  shot('sign', (() => { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), mats().woodDark); p.position.y = 0.8; g.add(p); const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 0.06), new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.7 })); b.position.set(0.2, 1.3, 0.05); g.add(b); return g; })(), new V3(0.2, 0.3, 1));
  shot('helper', makePerson({ seed: 21, shirt: 0x8fb86a, hairStyle: 3 }), new V3(0.2, 0.25, 1));
  shot('runner', makePerson({ seed: 33, shirt: 0x6a8fc0, apron: true, hat: true }), new V3(0.2, 0.25, 1));
  shot('flower', (() => { const g = new THREE.Group(); const c = [0xe58fb0, 0xf4d35e, 0xfff6e0, 0xc8553d, 0xb7a6e8]; for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: c[i % 5], roughness: 0.6 })); f.position.set(Math.cos(i * 2.4) * 0.22 * Math.sqrt(i / 9), 0.35 + (i % 3) * 0.05, Math.sin(i * 2.4) * 0.22 * Math.sqrt(i / 9)); g.add(f); } const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.36, 16), new THREE.MeshStandardMaterial({ color: 0xb8653d, roughness: 0.8 })); pot.position.y = 0.12; g.add(pot); return g; })());
  for (const k of ['egg', 'milk', 'custard', 'butter', 'tart', 'honey', 'cheese', 'cider']) shot(k, makeFarmItem(k), new V3(0.2, 0.6, 1));
  shot('berry', (() => { const b = makeFarmItem('berry'); b.rotation.z = 0.5; return b; })(), new V3(0.2, 0.3, 1));
  shot('comb', (() => { const c = makeFarmItem('comb'); c.rotation.x = 1.0; return c; })(), new V3(0, 0.3, 1));
  shot('wagon', (() => { const w = makeWagonIcon(); w.rotation.y = -0.6; return w; })(), new V3(0.3, 0.45, 1));
  shot('land', (() => { const g = new THREE.Group(); const t = makeTree(77, false).group; t.scale.setScalar(0.7); t.position.set(0.4, 0, -0.4); g.add(t); for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.04), mats().white); p.position.set(-0.9 + i * 0.3, 0.35, 0.5); g.add(p); } const rail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.03), mats().white); rail.position.set(-0.15, 0.45, 0.53); g.add(rail); const gr = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x8fb86a, roughness: 1 })); g.add(gr); return g; })(), new V3(0.2, 0.5, 1));
  shot('star', (() => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.4 : 1; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 }), mats().gold); })(), new V3(0, 0, 1));
  ip.dispose(); ir.dispose(); ir.forceContextLoss && ir.forceContextLoss();
  const imgs = {};
  return Promise.all(Object.entries(ICON).map(([k, url]) => new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = url; imgs[k] = im; }))).then(() => imgs);
}
let IMG = {};

// ---------- build pads ----------
const pads = {};
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
// A pad is either a one-time build (PADS) or an endless level-up (LEVELS) whose price rises gently each time.
const levelCost = (id) => { const L = lv(id), b = LEVELS[id].base; return Math.round((b * Math.pow(1.22, L) + 40 * L) / 5) * 5; };
function padDef(id) {
  if (PADS[id]) return PADS[id];
  const d = LEVELS[id];
  return { pos: d.pos, cost: levelCost(id), name: `${d.name} ${lv(id) + 1}`, icon: d.icon, level: true };
}
const padLocked = (id) => (PADS[id]?.lvl || 0) > S.level;
function drawPad(p) {
  const c = p.ctx, W = 320, def = padDef(p.id), paid = S.paid[p.id] || 0, left = Math.max(0, def.cost - paid), locked = padLocked(p.id);
  c.clearRect(0, 0, W, W);
  roundRect(c, 10, 10, W - 20, W - 20, 46); c.fillStyle = 'rgba(251,246,234,.93)'; c.fill();
  c.lineWidth = 10; c.setLineDash([26, 16]); c.strokeStyle = '#3f6b45'; c.stroke(); c.setLineDash([]);
  // progress fill from the bottom
  c.save(); roundRect(c, 10, 10, W - 20, W - 20, 46); c.clip();
  c.fillStyle = 'rgba(233,180,76,.45)'; const fh = (W - 20) * (paid / def.cost); c.fillRect(10, W - 10 - fh, W - 20, fh); c.restore();
  if (IMG[def.icon]) c.drawImage(IMG[def.icon], W / 2 - 66, 26, 132, 132);
  c.fillStyle = '#2f3b2a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${def.name.length > 15 ? 28 : 34}px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif`; c.fillText(def.name, W / 2, 186);
  if (locked) {
    if (IMG.star) c.drawImage(IMG.star, W / 2 - 104, 218, 56, 56);
    c.font = 'bold 36px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'left'; c.fillText(`Level ${def.lvl}`, W / 2 - 40, 248);
  } else {
    if (IMG.coin) c.drawImage(IMG.coin, W / 2 - 78, 214, 62, 62);
    c.font = 'bold 54px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'left'; c.fillText(String(left), W / 2 - 8, 248);
  }
  if (def.level) { c.fillStyle = '#3f6b45'; roundRect(c, W - 86, 18, 64, 40, 16); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 24px ui-rounded, -apple-system, sans-serif'; c.fillText('↑', W - 54, 40); }
  p.tex.needsUpdate = true;
}
function makePad(id) {
  const def = padDef(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = 320;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(def.pos[0], 0.03, def.pos[1]); m.receiveShadow = true;
  const p = { id, mesh: m, ctx: cv.getContext('2d'), tex, cool: 0, shown: 0 };
  drawPad(p); scene.add(m); m.scale.setScalar(0.01);
  pads[id] = p; return p;
}
function activePadIds() {
  const out = [];
  let open = 0, waiting = 0;
  for (const id of PAD_ORDER) {
    if (S.unlocked[id]) continue;
    const req = PADS[id].req; if (req && !S.unlocked[req]) continue;
    if (padLocked(id)) { if (waiting++ < 1) out.push(id); continue; } // a locked one doesn't take a buildable slot
    out.push(id); if (++open >= 3) break;
  }
  // level-ups never run out: each appears once its last one-time build on that spot is done
  for (const id of Object.keys(LEVELS)) { const d = LEVELS[id]; if (S.unlocked[d.req] && !(d.max && lv(id) >= d.max)) out.push(id); }
  return out;
}
function refreshPads() {
  const act = activePadIds();
  for (const id of Object.keys(pads)) if (!act.includes(id)) { const p = pads[id]; burst(p.mesh.position, 10, 1.2); scene.remove(p.mesh); p.tex.dispose(); delete pads[id]; }
  for (const id of act) if (!pads[id]) makePad(id);
}

// ---------- zones on the ground (soft markers) ----------
// Ground spots: a big clear icon and a bold label. Honey rings are for putting things in, green rings for picking up.
const PUT = ['In', 'Stall', 'Sell', 'Orders'];
function zoneTex(icon, label) {
  const S2 = 512, cv = document.createElement('canvas'); cv.width = cv.height = S2; const c = cv.getContext('2d');
  const put = PUT.some((w) => label.includes(w) || label.endsWith(' in'));
  c.beginPath(); c.arc(256, 256, 236, 0, Math.PI * 2); c.fillStyle = 'rgba(255,250,238,.9)'; c.fill();
  c.lineWidth = 22; c.strokeStyle = put ? '#e9b44c' : '#5f9a52'; c.stroke();
  c.beginPath(); c.arc(256, 256, 214, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
  c.beginPath(); c.arc(256, 186, 134, 0, Math.PI * 2); c.fillStyle = put ? '#f3dca4' : '#cfe3bd'; c.fill();
  if (IMG[icon]) c.drawImage(IMG[icon], 116, 46, 280, 280);
  c.fillStyle = '#2b241c'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `800 ${label.length > 9 ? 62 : 74}px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif`; c.fillText(label, 256, 384);
  c.font = '700 40px ui-rounded, -apple-system, "Segoe UI", sans-serif'; c.fillStyle = put ? '#9a6a10' : '#3f6b45';
  c.fillText(put ? '▼ put here' : '▲ pick up', 256, 444);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// A small upright sign over each spot, so you can read what it is from any angle; it shows as you come near.
const signs = [];
function signTex(icon, label) {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 128; const c = cv.getContext('2d');
  roundRect(c, 4, 4, 376, 120, 40); c.fillStyle = 'rgba(255,250,240,.96)'; c.fill(); c.lineWidth = 5; c.strokeStyle = 'rgba(122,90,50,.35)'; c.stroke();
  if (IMG[icon]) c.drawImage(IMG[icon], 14, 12, 104, 104);
  c.fillStyle = '#2b241c'; c.font = `800 ${label.length > 9 ? 40 : 48}px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif`; c.textBaseline = 'middle'; c.fillText(label, 124, 66);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const zones = {};
function addZone(name, pos, icon, label, parent = scene) {
  // drawn without lighting or tone mapping so the colours and words stay crisp in full sun
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: zoneTex(icon, label), color: 0xf4f1ea, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.025, pos.z); m.receiveShadow = true; parent.add(m);
  zones[name] = { pos: new V3(pos.x, 0, pos.z), mesh: m, r: 0.95 };
  if (name !== 'stallIn' && name !== 'cash') {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex(icon, label), transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false }));
    sp.scale.set(2.0, 0.667, 1); sp.position.set(pos.x, 2.5, pos.z - 0.2); sp.renderOrder = 5; parent.add(sp); signs.push(sp);
  }
}

// ---------- customers ----------
const QUEUE = (i) => new V3(0, 0, 6.75 + i * 1.05);
const customers = [], queue = [];
const POOL = [];
for (let i = 0; i < 16; i++) {
  const p = makePerson({ seed: 100 + i * 17 }); p.visible = false; scene.add(p);
  const bub = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); bub.scale.set(0.85, 0.85, 1); bub.position.y = 2.3; bub.visible = false; p.add(bub);
  POOL.push({ person: p, bub, busy: false, carry: new Pile(p.userData.tray, trayLayout) });
}
const bubbleMats = {};
function bubbleMat(kind) {
  if (bubbleMats[kind]) return bubbleMats[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,255,255,.96)'; c.beginPath(); c.arc(64, 58, 50, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(52, 100); c.lineTo(64, 124); c.lineTo(76, 100); c.fill();
  if (IMG[kind]) c.drawImage(IMG[kind], 22, 16, 84, 84);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return (bubbleMats[kind] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
}
let spawnTimer = 2;
function spawnCustomer() {
  const slot = POOL.find((p) => !p.busy); if (!slot) return;
  slot.busy = true;
  const c = { ...slot, slot, pos: slot.person.position, path: [], state: 'in', speed: 2.1 + Math.random() * 0.5, t: 0, want: null, buys: 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0) + Math.floor(lv('lvCrowd') / 4), seat: null, face: Math.PI, spd: 0 };
  c.person.visible = true; c.pos.set((Math.random() - 0.5) * 1.2, 0, 26);
  c.path = [new V3(c.pos.x * 0.4, 0, 16.5)];
  queue.push(c); customers.push(c);
}
function moveTo(c, dt) {
  const tgt = c.path[0]; if (!tgt) { c.spd = 0; return true; }
  const d = new V3().subVectors(tgt, c.pos); d.y = 0; const L = d.length();
  if (L < 0.06) { c.path.shift(); return c.path.length === 0; }
  const step = Math.min(L, c.speed * dt); c.pos.addScaledVector(d.normalize(), step);
  c.face = Math.atan2(d.x, d.z); c.spd = c.speed;
  return false;
}
function turnTo(obj, ang, dt, rate = 10) {
  let d = ang - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * Math.min(1, dt * rate);
}
function stallKinds() { return Object.keys(PRODUCTS).filter(live); }
const stallPile = (k) => piles[PRODUCTS[k].stall];
function updateCustomers(dt) {
  const tea = !!S.unlocked.tea, flowers = !!S.unlocked.flowers;
  const interval = Math.max(0.5, 3.0 * (tea ? 0.75 : 1) * (flowers ? 0.85 : 1) * (S.unlocked.sign1 ? 0.8 : 1) * (S.unlocked.sign2 ? 0.8 : 1) * (S.unlocked.eastLand ? 0.9 : 1) * (S.unlocked.westLand ? 0.9 : 1) * Math.pow(0.9, lv('lvCrowd')));
  spawnTimer -= dt;
  if (spawnTimer <= 0 && queue.length < 8) { spawnCustomer(); spawnTimer = interval * (0.8 + Math.random() * 0.4); }
  for (let i = customers.length - 1; i >= 0; i--) {
    const c = customers[i]; c.t += dt;
    const qi = queue.indexOf(c);
    if (c.state === 'in' || c.state === 'queue') {
      const target = QUEUE(Math.max(0, qi));
      if (c.state === 'in' && c.path.length === 0) c.state = 'queue';
      if (c.state === 'queue') { if (c.pos.distanceTo(target) > 0.06) c.path = [target]; }
      moveTo(c, dt);
      const atFront = qi === 0 && c.state === 'queue' && c.pos.distanceTo(QUEUE(0)) < 0.1;
      if (atFront) {
        c.face = Math.PI;
        if (!c.want) {
          const kinds = stallKinds(); const stocked = kinds.filter((k) => stallPile(k).count > 0);
          c.want = (stocked.length ? stocked : kinds)[(Math.random() * (stocked.length || kinds.length)) | 0];
          c.bub.material = bubbleMat(c.want); c.bub.visible = true; c.waitBuy = 0.35;
        }
        const pile = stallPile(c.want);
        if (pile.count === 0) { // calmly switch to the other item if that one's in stock
          const other = stallKinds().find((k) => k !== c.want && stallPile(k).count > 0);
          if (other && c.t > 1) { c.want = other; c.bub.material = bubbleMat(other); }
        }
        c.waitBuy -= dt;
        if (c.waitBuy <= 0 && pile.count > 0 && pile.items[pile.items.length - 1] && !pile.items[pile.items.length - 1].flying) {
          const it = pile.take();
          scene.remove(it.mesh);
          c.carry.add(it.kind, it.wp, 0.3);
          const pr = price(it.kind); S.sold++; S.stats.sold[it.kind] = (S.stats.sold[it.kind] || 0) + 1; addXP(1 + Math.floor(BASE_PRICE[it.kind] / 10));
          // coins hop from the customer to the cash barrel
          for (let k = 0; k < 3; k++) after(k * 0.07, () => { const coin = makeCoin(); fly(coin, c.pos.clone().add(new V3(0, 1.3, 0)), null, A.cash.clone().add(new V3(0, 0.1, 0)), 0.38, () => { S.cash += k === 2 ? pr - 2 : 1; syncCash(); sfx.coin(); }, 0.7); });
          c.buys--; c.waitBuy = 0.3; if (c.buys > 0) { c.want = null; }
          if (c.buys <= 0) {
            c.bub.visible = false; queue.splice(qi, 1);
            const seat = tea && Math.random() < 0.65 ? world.tea.seats.find((s) => !s.busy) : null;
            if (seat) { seat.busy = c; c.seat = seat; c.state = 'toSeat'; c.path = [new V3(1.4, 0, 7.2), new V3(seat.x < 8 ? 4.6 : 11.2, 0, seat.z), new V3(seat.x, 0, seat.z)]; }
            else { c.state = 'out'; c.path = [new V3(1.5, 0, 7.4), new V3(1.5, 0, 14.0), new V3(0.4, 0, 16.5), new V3(0.4, 0, 27)]; }
          }
        }
      }
    } else if (c.state === 'toSeat') {
      if (moveTo(c, dt)) { c.state = 'sit'; c.t = 0; c.face = c.seat.face; }
    } else if (c.state === 'sit') {
      c.spd = 0;
      if (c.t > 4.5) {
        const tip = 3;
        const from = new V3(c.seat.x, 1.0, c.seat.z);
        const coin = makeCoin(); fly(coin, from, null, A.cash.clone().add(new V3(0, 0.1, 0)), 0.7, () => { S.cash += tip; syncCash(); sfx.coin(); }, 2.2);
        c.seat.busy = null; c.seat = null; c.state = 'out';
        c.path = [new V3(c.pos.x, 0, 13.6), new V3(1.2, 0, 13.8), new V3(0.4, 0, 16.5), new V3(0.4, 0, 27)];
      }
    } else if (c.state === 'out') {
      if (moveTo(c, dt)) {
        c.person.visible = false; c.slot.busy = false; c.want = null;
        while (c.carry.count) { const t = c.carry.take(); if (!t) break; }
        customers.splice(i, 1); continue;
      }
    }
    turnTo(c.person, c.face, dt, 9);
    animatePerson(c.person, c.spd, dt, c.carry.count > 0, c.state === 'sit');
    c.carry.update(dt);
  }
}

// ---------- helpers (unlockable workers) ----------
const workers = [];
const WORKER_LOOK = {
  orchard: { seed: 21, shirt: 0x8fb86a, hairStyle: 3, apron: false }, orchard2: { seed: 57, shirt: 0xe0b44a, hairStyle: 1 },
  shop: { seed: 33, shirt: 0x6a8fc0, apron: true, hat: true }, shop2: { seed: 61, shirt: 0xd9825b, apron: true, hat: true },
  field: { seed: 45, shirt: 0xc97a9a, hairStyle: 3 }, haulE: { seed: 73, shirt: 0x5aa0a0, hairStyle: 3 }, haulW: { seed: 89, shirt: 0x7a6ab0, hairStyle: 2 }
};
// Farmhands on the new land carry produce to the right basket. A route either picks from bushes or takes from a pile.
const ROUTES = {
  haulE: [{ from: 'eggs', to: 'custardIn' }, { from: 'milk', to: 'butterIn' }, { from: 'milk', to: 'cheeseIn' }],
  haulW: [{ pick: 'berry', to: 'tartIn' }, { from: 'comb', to: 'honeyIn' }]
};
function addWorker(kind, look = kind) {
  const p = makePerson(WORKER_LOOK[look]);
  const start = { orchard: [-6, 0], shop: [-1.5, -3], field: [6.2, 1], haulE: [23.5, -1], haulW: [-24, -1] }[kind];
  p.position.set(start[0], 0, start[1]); scene.add(p);
  const w = makeActor(p, 6, 2.8); w.kind = kind; w.state = 'idle'; w.target = null; w.wait = 0; w.home = new V3(start[0], 0, start[1]);
  if (kind === 'orchard') w.fruitOnly = 'apple';
  if (kind === 'haulW') w.fruitOnly = 'berry';
  if (kind === 'shop') { w.cap = 8; w.speed = 3.2; }
  tameEnv(p); burst(p.position.clone(), 10, 1); workers.push(w); return w;
}
function stepToward(a, target, dt) {
  const d = new V3().subVectors(target, a.obj.position); d.y = 0; const L = d.length();
  if (L < 0.35) { a.vel.multiplyScalar(Math.exp(-10 * dt)); a.stuck = 0; return true; }
  d.normalize();
  // simple steering: if a wall or oven is in the way, walk along it until the way is clear
  if (a.detour > 0) { a.detour -= dt; d.applyAxisAngle(new V3(0, 1, 0), a.side * 1.25); }
  else if (a.stuck > 0.35) { a.detour = 0.9; a.stuck = 0; a.side = a.side ? -a.side * (Math.random() < 0.7 ? -1 : 1) : 1; }
  const want = d.multiplyScalar(a.speed * (a === player ? 1 : handRate()));
  a.vel.lerp(want, 1 - Math.exp(-8 * dt));
  return false;
}
// Which basket a helper should fill: the emptier one that still has room below the helper limit
function helperBasket(raw) {
  const opts = Object.keys(PRODUCTS).filter((k) => live(k) && PRODUCTS[k].raw === raw && piles[PRODUCTS[k].inP].count < HELPER_FILL);
  opts.sort((x, y) => piles[PRODUCTS[x].inP].count - piles[PRODUCTS[y].inP].count);
  return opts[0] ? PRODUCTS[opts[0]].inP : null;
}
function ripeNear(pos, fruit, prefer) {
  let best = null, bd = Infinity;
  for (const t of world.trees) {
    if ((t.fruit || 'apple') !== fruit || !treeActive(t) || !t.apples.some((a) => a.grow >= 1)) continue;
    const d = Math.hypot(t.x - pos.x, t.z - pos.z) - (t === prefer ? 2 : 0);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
const besideTree = (pos, t) => { const dir = new V3(pos.x - t.x, 0, pos.z - t.z); if (dir.length() < 0.1) dir.set(1, 0, 0); return new V3(t.x, 0, t.z).add(dir.normalize().multiplyScalar(t.reach ? 0.85 : 1.05)); };
function updateWorkers(dt) {
  for (const w of workers) {
    let target = null, allow;
    const pos = w.obj.position;
    if (w.kind === 'orchard' || w.kind === 'field') {
      const raw = w.kind === 'orchard' ? 'apple' : 'wheat';
      if (w.state === 'drop' && (w.carry.count === 0 || !helperBasket(raw))) w.state = 'pick';
      if (w.state !== 'drop') {
        w.state = 'pick';
        let best = null;
        if (w.carry.count < w.cap) {
          if (raw === 'apple') best = ripeNear(pos, 'apple', w.target);
          else { let bd = Infinity; for (const c of world.field.cells) { if (c.grow < 1) continue; const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < bd) { bd = d; best = c; } } }
        }
        w.target = best;
        const basket = helperBasket(raw);
        if (basket && (w.carry.count >= w.cap || (!best && w.carry.count > 0))) w.state = 'drop';
        else if (best && w.carry.count < w.cap) target = raw === 'apple' ? besideTree(pos, best) : new V3(best.x, 0, best.z);
        else target = raw === 'apple' ? new V3(-5.6, 0, 0.4) : new V3(6.2, 0, 1.0); // rest when the baskets are full
      }
      if (w.state === 'drop') { const b = helperBasket(raw); target = b ? zones[b].pos : null; w.dropTo = b; }
      allow = w.kind === 'orchard' ? ['trees', w.dropTo || 'none'] : ['wheat', w.dropTo || 'none'];
    } else if (ROUTES[w.kind]) {
      const routes = ROUTES[w.kind].filter((r) => live(Object.keys(PRODUCTS).find((k) => PRODUCTS[k].inP === r.to)));
      const kindOf = (r) => r.pick || PRODUCERS[r.from].kind;
      const room = (r) => piles[r.to].count < HELPER_FILL;
      if (w.state === 'drop') { const r = routes.find((x) => x.to === w.dropTo); if (!r || !w.carry.countOf(kindOf(r)) || !room(r)) w.state = 'get'; }
      if (w.state !== 'drop') {
        w.state = 'get';
        const carried = routes.filter((r) => w.carry.countOf(kindOf(r)) > 0 && room(r));
        const want = routes.filter((r) => room(r) && (r.pick ? ripeNear(pos, r.pick) : piles[r.from].count > 0)).sort((x, y) => piles[x.to].count - piles[y.to].count);
        if (carried.length && (w.carry.count >= w.cap || !want.length || !want.some((r) => kindOf(r) === kindOf(carried[0])))) { w.state = 'drop'; w.dropTo = carried[0].to; }
        else if (want.length && w.carry.count < w.cap) {
          const r = want[0]; w.route = r;
          if (r.pick) { w.target = ripeNear(pos, r.pick, w.target); target = besideTree(pos, w.target); } else target = zones[r.from].pos;
        } else target = w.home;
      }
      if (w.state === 'drop') target = zones[w.dropTo].pos;
      allow = ['trees', w.route?.from || 'none', w.state === 'drop' ? w.dropTo : 'none'];
    } else {
      const room = (k) => stallPile(k).count < maxp(PRODUCTS[k].stall);
      if (w.state === 'deliver' && w.carry.count === 0) w.state = 'fetch';
      if (w.state !== 'deliver') {
        w.state = 'fetch';
        const opts = [];
        for (const k of Object.keys(PRODUCTS)) if (live(k) && piles[PRODUCTS[k].outP].count > 0 && room(k)) {
          // two runners split the work: the second favours the far-off kitchens
          const far = Math.abs(zones[PRODUCTS[k].outP].pos.x) > 16;
          opts.push([PRODUCTS[k].outP, piles[PRODUCTS[k].outP].count * (w.second ? (far ? 3 : 1) : (far ? 0.4 : 1))]);
        }
        opts.sort((a, b) => b[1] - a[1]);
        if (w.carry.count >= w.cap || (!opts.length && w.carry.count > 0)) w.state = 'deliver';
        else if (opts.length) target = zones[opts[0][0]].pos;
        else target = w.second ? new V3(1.2, 0, -3.2) : new V3(-1.2, 0, -3.2);
      }
      if (w.state === 'deliver') target = zones.stallIn.pos;
      allow = [...Object.values(PRODUCTS).map((P) => P.outP), 'stallIn'];
    }
    if (target) stepToward(w, target, dt);
    else w.vel.multiplyScalar(Math.exp(-10 * dt));
    moveActor(w, dt);
    interact(w, dt, allow, w.kind !== 'shop');
  }
}

// ---------- movement + collisions ----------
function treeActive(t) { return t.group === 'start' || !!S.unlocked[t.group]; }
function resolve(pos, r = 0.3) {
  for (const c of world.colliders) {
    if (c.group && c.group !== 'start' && !S.unlocked[c.group]) continue;
    if (c.need && !S.unlocked[c.need]) continue;
    if (c.until && S.unlocked[c.until]) continue;
    if (c.box) {
      const [x0, z0, x1, z1] = c.box;
      const cx = THREE.MathUtils.clamp(pos.x, x0, x1), cz = THREE.MathUtils.clamp(pos.z, z0, z1);
      const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-4) { pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
        else { // inside: push out along the shortest side
          const o = [pos.x - x0 + r, x1 - pos.x + r, pos.z - z0 + r, z1 - pos.z + r], m = Math.min(...o), k = o.indexOf(m);
          if (k === 0) pos.x = x0 - r; else if (k === 1) pos.x = x1 + r; else if (k === 2) pos.z = z0 - r; else pos.z = z1 + r;
        }
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; }
    }
  }
  pos.x = THREE.MathUtils.clamp(pos.x, BOUNDS.minX, BOUNDS.maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, BOUNDS.minZ, BOUNDS.maxZ);
}
function moveActor(a, dt) {
  const p = a.obj.position, before = p.clone();
  p.addScaledVector(a.vel, dt); resolve(p);
  const moved = Math.hypot(p.x - before.x, p.z - before.z) / Math.max(dt, 1e-4);
  const sp = Math.hypot(a.vel.x, a.vel.z);
  if (a !== player) a.stuck = (moved < sp * 0.35 && sp > 0.5) ? (a.stuck || 0) + dt : Math.max(0, (a.stuck || 0) - dt);
  if (sp > 0.15) a.facing = Math.atan2(a.vel.x, a.vel.z);
  const yaw0 = a.obj.rotation.y;
  turnTo(a.obj, a.facing, dt, 12);
  const walk = Math.min(moved, sp + 0.01);
  animatePerson(a.obj, walk, dt, a.carry.count > 0);
  // lean gently into turns and forward when hurrying, like a real person
  const body = a.obj.userData.body, turn = (a.obj.rotation.y - yaw0) / Math.max(dt, 1e-4);
  const roll = THREE.MathUtils.clamp(-turn * walk * 0.012, -0.16, 0.16), pitch = THREE.MathUtils.clamp(walk * 0.022, 0, 0.1);
  body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 8); body.rotation.x += (pitch - body.rotation.x) * Math.min(1, dt * 8);
  // soft dust at each footstep on the paths
  if (a === player && walk > 2.6) {
    const step = Math.floor(a.obj.userData.phase / Math.PI);
    if (step !== a.lastStep) { a.lastStep = step; const side = step % 2 ? 1 : -1, f = a.obj.rotation.y; puff(p.clone().add(new V3(Math.cos(f) * 0.1 * side, 0.06, -Math.sin(f) * 0.1 * side)), { color: 0xe6d6b8, size: 0.16, opacity: 0.4, life: 0.6, grow: 0.7, vel: new V3(-a.vel.x * 0.06, 0.25, -a.vel.z * 0.06) }); }
  }
  a.carry.update(dt);
}

// ---------- interactions ----------
// You only pick up from (or load into) a spot once you pause on it, so walking past never grabs things.
// The stall and the coin barrel stay instant, since you always want those.
const dwell = {};
function updateDwell(dt) {
  const slow = Math.hypot(player.vel.x, player.vel.z) < 2.2;
  for (const name of Object.keys(zones)) {
    const z = zones[name], inside = z.mesh.visible !== false && player.obj.position.distanceTo(z.pos) < z.r;
    dwell[name] = inside && slow ? (dwell[name] || 0) + dt : inside ? Math.max(0, (dwell[name] || 0) - dt) : 0;
    const want = dwell[name] >= SETTLE ? 1.12 : 1; z.mesh.scale.setScalar(z.mesh.scale.x + (want - z.mesh.scale.x) * Math.min(1, dt * 10));
  }
}
const SETTLE = 0.3;
// Trees and bushes work the same way: walk past and nothing happens, stop beside one to pick.
let treeDwell = 0;
function updateTreeDwell(dt) {
  const p = player.obj.position, slow = Math.hypot(player.vel.x, player.vel.z) < 2.2;
  const by = world.trees.some((t) => treeActive(t) && Math.hypot(t.x - p.x, t.z - p.z) <= (t.reach || 1.75) && t.apples.some((x) => x.grow >= 1));
  treeDwell = by && slow ? treeDwell + dt : by ? Math.max(0, treeDwell - dt) : 0;
}
const settled = (a, z) => a !== player || (dwell[z] || 0) >= SETTLE;
function near(a, z) { return zones[z] && a.obj.position.distanceTo(zones[z].pos) < zones[z].r; }
function interact(a, dt, allowed, helper = false) {
  a.cool -= dt; if (a.cool > 0) return;
  const can = (z) => !allowed || allowed.includes(z);
  const pos = a.obj.position;
  // pick apples
  if (can('trees') && a.carry.count < a.cap && (a !== player || treeDwell >= SETTLE)) {
    for (const t of world.trees) {
      if (!treeActive(t) || (a.fruitOnly && (t.fruit || 'apple') !== a.fruitOnly) || Math.hypot(t.x - pos.x, t.z - pos.z) > (t.reach || 1.75)) continue;
      const ap = t.apples.find((x) => x.grow >= 1);
      if (ap) {
        ap.grow = 0; ap.mesh.visible = false;
        a.carry.add(t.fruit || 'apple', ap.mesh.getWorldPosition(new V3()), 0.3); a.cool = 0.09; if (a === player) sfx.pick(); return;
      }
    }
  }
  // cut wheat
  if ((a === player || can('wheat')) && S.unlocked.wheat && a.carry.count < a.cap) {
    const { x0, z0, nx, nz } = FIELD;
    if (pos.x > x0 - 0.4 && pos.x < x0 + nx + 0.4 && pos.z > z0 - 0.4 && pos.z < z0 + nz + 0.4) {
      let best = null, bd = 0.95;
      for (const c of world.field.cells) { const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (c.grow >= 1 && d < bd) { bd = d; best = c; } }
      if (best) { best.grow = 0; fieldDirty = true; a.carry.add('wheat', new V3(best.x, 0.6, best.z), 0.3); a.cool = 0.08; sfx.pick(); burst(new V3(best.x, 0.2, best.z), 3, 0.4); return; }
    }
  }
  const drop = (zone, kind, pileName) => {
    if (!can(zone) || !near(a, zone) || (zone !== 'stallIn' && !settled(a, zone)) || piles[pileName].count >= (helper ? HELPER_FILL : maxp(pileName))) return false;
    const it = a.carry.take(kind); if (!it) return false;
    scene.remove(it.mesh); piles[pileName].add(kind, it.wp, 0.28); a.cool = 0.08; if (a === player) sfx.pick(); return true;
  };
  const takeFrom = (zone, pileName) => {
    if (!can(zone) || !near(a, zone) || !settled(a, zone) || a.carry.count >= a.cap) return false;
    const it = piles[pileName].take(); if (!it) return false;
    scene.remove(it.mesh); a.carry.add(it.kind, it.wp, 0.28); a.cool = 0.08; if (a === player) sfx.pick(); return true;
  };
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && drop(P.inP, P.raw, P.inP)) return; }
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && takeFrom(P.outP, P.outP)) return; }
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && drop('stallIn', k, P.stall)) return; }
  for (const z of Object.keys(PRODUCERS)) if (S.unlocked[PRODUCERS[z].need] && (a === player || can(z)) && takeFrom(z, z)) return;
  if (a !== player) return;
  // the order wagon takes whatever the current order still needs
  if (S.unlocked.wagon && S.order && near(a, 'order') && settled(a, 'order')) {
    for (const k of Object.keys(S.order.items)) {
      if ((S.order.got[k] || 0) >= S.order.items[k]) continue;
      const it = a.carry.take(k); if (!it) continue;
      scene.remove(it.mesh); S.order.got[k] = (S.order.got[k] || 0) + 1;
      piles.order.add(k, it.wp, 0.3); drawOrder(); a.cool = 0.08; sfx.pick();
      if (orderDone()) after(0.4, finishOrder);
      return;
    }
  }
  // sell spare raw goods at the farm cart, so a full tray never leaves you stuck
  if (near(a, 'cart') && settled(a, 'cart')) {
    let it = null; for (const k of Object.keys(SPARE)) { it = a.carry.take(k); if (it) break; }
    if (it) { const v = SPARE[it.kind]; scene.remove(it.mesh); fly(it.mesh, it.wp, null, zones.cart.pos.clone().add(new V3(0, 0.8, -1.05)), 0.25, () => { S.coins += v; S.stats.earned += v; sfx.coin(); }, 0.6); a.cool = 0.07; return; }
  }
  // collect coins
  if (near(a, 'cash') && S.cash > 0) {
    const chunk = Math.max(1, Math.ceil(S.cash / 12));
    S.cash -= chunk; S.coins += chunk; S.stats.earned += chunk; syncCash();
    const coin = makeCoin(); fly(coin, A.cash.clone().add(new V3(0, 0.2, 0)), player.obj, new V3(0, 1.3, 0), 0.25, () => { player.obj.remove(coin); }, 0.5);
    sfx.coin(); a.cool = 0.06; return;
  }
  // pay into build pads
  for (const id of Object.keys(pads)) {
    const p = pads[id], def = padDef(id);
    if (Math.hypot(pos.x - def.pos[0], pos.z - def.pos[1]) > 0.95 || S.coins <= 0 || padLocked(id)) continue;
    const left = def.cost - (S.paid[id] || 0);
    const chunk = Math.min(S.coins, left, Math.max(1, Math.ceil(def.cost / 24)));
    S.coins -= chunk; S.paid[id] = (S.paid[id] || 0) + chunk; drawPad(p);
    const coin = makeCoin(); fly(coin, pos.clone().add(new V3(0, 1.3, 0)), null, p.mesh.position.clone(), 0.25, null, 0.6);
    sfx.coin(); a.cool = 0.05;
    if (S.paid[id] >= def.cost) unlock(id, true);
    return;
  }
}

// ---------- unlocking ----------
const pops = [];
function popIn(obj, center, delay = 0) {
  const piv = new THREE.Group(); piv.position.copy(center); const parent = obj.parent || scene; parent.add(piv); piv.add(obj); obj.position.sub(center);
  piv.scale.setScalar(0.001); pops.push({ piv, t: -delay });
  after(delay, () => burst(center.clone(), 12, 2));
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt; const k = THREE.MathUtils.clamp(p.t / 0.5, 0, 1);
    const c1 = 1.70158, c3 = c1 + 1, e = k <= 0 ? 0.001 : 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    p.piv.scale.setScalar(Math.max(0.001, e)); if (k >= 1) { p.piv.scale.setScalar(1); pops.splice(i, 1); }
  }
}
function applyUnlock(id, animate) {
  const show = (obj, center, delay) => { obj.visible = true; if (animate) popIn(obj, center, delay); };
  if (id === 'trees2' || id === 'orchard3') {
    const grp = world.treeGroups[id]; grp.visible = true;
    if (animate) [...grp.children].forEach((t, i) => popIn(t, t.position.clone(), i * 0.12));
  }
  if (id === 'wheat') { world.field.group.visible = true; if (animate) { world.field.cells.forEach((c) => (c.grow = 0.05)); fastGrow = 1.4; fieldDirty = true; burst(new V3(10, 0, 0.5), 16, 5); } }
  if (id === 'bread') { show(world.breadGroup, new V3(4.4, 0, -6), 0); zones.breadIn.mesh.visible = zones.breadOut.mesh.visible = true; }
  if (id === 'tea') show(world.tea.group, new V3(8, 0, 11.4), 0);
  if (id === 'flowers') show(world.flowers, new V3(-8, 0, 11.2), 0);
  if (id === 'jam') show(world.jamGroup, new V3(-6, 0, -4), 0);
  if (id === 'sign1') show(world.signpost, world.signpost.position.clone(), 0);
  if (id === 'sign2') show(world.bunting, world.bunting.position.clone(), 0);
  const farmShow = { eastLand: [22, 0, 0], hens: [19.8, 0, -10], pastry: [19.8, 0, -4.6], dairy: [27.2, 0, -9], churn: [27.2, 0, -4.6], berries: [-24.8, 0, 6], tarts: [-20.5, 0, -4.6], cheese: [19.8, 0, 4.0], cider: [-18.9, 0, 3.7], bees: [-27.4, 0, -10.5], honey: [-27.4, 0, -4.6], wagon: [10.5, 0, -7.4] };
  if (farmShow[id]) show(FG[id], new V3(...farmShow[id]), 0);
  if (id === 'pastry' || id === 'churn') FG.shopE.visible = true;
  if (id === 'tarts' || id === 'honey') FG.shopW.visible = true;
  if (id === 'cheese' || id === 'cider') FG.shopN.visible = true;
  if (id === 'eastLand' || id === 'westLand') {
    const d = world.dividers[id]; if (animate && d.visible) for (let z = -13; z <= 14; z += 3) burst(new V3(id === 'eastLand' ? 16.6 : -16.6, 0, z), 6, 1);
    d.visible = false;
  }
  if (id === 'wagon' && !S.order) after(animate ? 1.2 : 0, newOrder);
  if (id === 'runner2') addWorker('shop', 'shop2').second = true;
  if (id === 'handE') addWorker('haulE');
  if (id === 'handW') addWorker('haulW');
  if (id === 'helper') addWorker('orchard');
  if (id === 'helper3') addWorker('orchard', 'orchard2');
  if (id === 'helper2') addWorker('field');
  if (id === 'runner') addWorker('shop');
  player.cap = cap();
}
function unlock(id, animate) {
  S.stats.builds++; addXP(5);
  if (LEVELS[id]) { // a level-up: same spot, new price, and the pad stays for the next one
    const name = padDef(id).name;
    S.levels[id] = lv(id) + 1; delete S.paid[id];
    player.cap = cap();
    if (animate) { sfx.build(); toast(`${name} done!`); if (pads[id]) burst(pads[id].mesh.position.clone(), 12, 1.6); }
    if (pads[id]) drawPad(pads[id]);
    refreshPads(); save(); return;
  }
  S.unlocked[id] = true; delete S.paid[id];
  applyUnlock(id, animate);
  if (animate) { sfx.build(); toast(`${PADS[id].name} built!`); }
  refreshPads(); save();
}

// ---------- bakery level, orders and tasks ----------
function addXP(n) {
  S.xp += n;
  let up = false;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++; up = true;
    const gift = 10 * S.level; S.coins += gift;
    after(1.7, () => { toast(`Bakery level ${S.level}! +${gift} coins`); sfx.build(); });
  }
  if (up) { for (const p of Object.values(pads)) drawPad(p); refreshPads(); }
}
const liveKinds = () => Object.keys(PRODUCTS).filter(live);
function newOrder() {
  const kinds = liveKinds().sort(() => Math.random() - 0.5).slice(0, S.level >= 8 ? 3 : 2);
  const items = {};
  for (const k of kinds) items[k] = Math.min(40, 2 + Math.floor(S.level * 0.6) + ((Math.random() * 3) | 0));
  const value = Object.entries(items).reduce((t, [k, n]) => t + price(k) * n, 0);
  S.order = { items, got: {}, reward: Math.round(value * 1.6 / 5) * 5, xp: 6 + Object.values(items).reduce((a, b) => a + b, 0) };
  drawOrder(); save();
}
const orderDone = () => S.order && Object.keys(S.order.items).every((k) => (S.order.got[k] || 0) >= S.order.items[k]);
function finishOrder() {
  if (!orderDone()) return;
  const o = S.order; S.order = null;
  S.coins += o.reward; S.stats.earned += o.reward; S.stats.orders++;
  for (let k = 0; k < 8; k++) after(k * 0.06, () => { const coin = makeCoin(); fly(coin, FA.order.clone().add(new V3(0, 0.5, 0)), player.obj, new V3(0, 1.3, 0), 0.45, () => player.obj.remove(coin), 1.4); sfx.coin(); });
  toast(`Order delivered! +${o.reward} coins`); addXP(o.xp);
  while (piles.order.count) { const t = piles.order.take(); if (!t) break; }
  burst(FA.order.clone(), 10, 1.4);
  drawOrder(); after(5, newOrder);
}
function drawOrder() {
  const { ctx: c, tex } = world.farm.wagon, W = 512, H = 256;
  c.fillStyle = '#2f3a33'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#a77b52'; c.lineWidth = 16; c.strokeRect(8, 8, W - 16, H - 16);
  c.fillStyle = '#f4efe2'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (!S.order) { c.font = 'bold 44px Georgia, serif'; c.fillText('Next order soon…', W / 2, H / 2); tex.needsUpdate = true; return; }
  c.font = 'bold 40px Georgia, serif'; c.fillText(`Order: ${S.order.reward} coins`, W / 2, 50);
  const ks = Object.keys(S.order.items), cw = (W - 40) / ks.length;
  ks.forEach((k, i) => {
    const x = 20 + cw * i + cw / 2, got = S.order.got[k] || 0, need = S.order.items[k];
    if (IMG[k]) c.drawImage(IMG[k], x - 48, 86, 96, 96);
    c.fillStyle = got >= need ? '#a9d98a' : '#f4efe2'; c.font = 'bold 38px ui-rounded, -apple-system, sans-serif'; c.fillText(`${got}/${need}`, x, 212);
  });
  tex.needsUpdate = true;
}
// Tasks: three gentle goals at a time; finish one and a new one takes its place.
const TASK_TYPES = ['sell', 'sell', 'orders', 'builds', 'earn'];
function statOf(t) { return t.type === 'sell' ? (S.stats.sold[t.kind] || 0) : t.type === 'orders' ? S.stats.orders : t.type === 'builds' ? S.stats.builds : S.stats.earned; }
function makeTask() {
  const used = S.tasks.map((t) => t.type + (t.kind || ''));
  for (let tries = 0; tries < 20; tries++) {
    const type = TASK_TYPES[(Math.random() * TASK_TYPES.length) | 0];
    if (type === 'orders' && !S.unlocked.wagon) continue;
    const t = { type };
    if (type === 'sell') { const ks = liveKinds(); t.kind = ks[(Math.random() * ks.length) | 0]; }
    if (used.includes(type + (t.kind || ''))) continue;
    const L = S.level;
    if (type === 'sell') { t.need = Math.round((8 + L * 3) / 5) * 5; t.reward = Math.round(t.need * price(t.kind) * 0.6 / 5) * 5; }
    if (type === 'orders') { t.need = 1 + Math.floor(L / 8); t.reward = Math.round(40 * Math.pow(1.15, L) / 10) * 10 * t.need; }
    if (type === 'builds') { t.need = 2 + Math.floor(L / 6); t.reward = Math.round(25 * Math.pow(1.2, L) / 5) * 5; }
    if (type === 'earn') { t.need = Math.round(80 * Math.pow(1.25, L) / 10) * 10; t.reward = Math.round(t.need * 0.25 / 5) * 5; }
    t.xp = 5 + L; t.start = statOf(t);
    return t;
  }
  return { type: 'earn', need: 100, reward: 25, xp: 5, start: S.stats.earned };
}
function taskText(t) {
  if (t.type === 'sell') return `Sell ${t.need} ${NAMES[t.kind]}`;
  if (t.type === 'orders') return t.need === 1 ? 'Deliver an order from the wagon' : `Deliver ${t.need} wagon orders`;
  if (t.type === 'builds') return `Build or upgrade ${t.need} things`;
  return `Collect ${t.need} coins`;
}
const taskIcon = (t) => (t.type === 'sell' ? t.kind : t.type === 'orders' ? 'wagon' : t.type === 'builds' ? 'sign' : 'coin');
let tasksT = 0;
function updateTasks(dt) {
  tasksT -= dt; if (tasksT > 0) return; tasksT = 0.5;
  while (S.tasks.length < 3) S.tasks.push(makeTask());
  S.tasks.forEach((t, i) => {
    if (statOf(t) - t.start < t.need) return;
    S.coins += t.reward; addXP(t.xp);
    toast(`Task done: ${taskText(t)}. +${t.reward} coins`); sfx.build();
    S.tasks[i] = makeTask(); save();
  });
  if (!$('panel').hidden) drawPanel();
}
function drawPanel() {
  $('pLv').textContent = S.level; $('pLvTitle').textContent = `Bakery level ${S.level}`;
  $('pXp').style.width = `${Math.min(100, S.xp / xpNeed(S.level) * 100)}%`;
  $('pXpText').textContent = `${S.xp} of ${xpNeed(S.level)} stars to level ${S.level + 1}. Every sale, task and order earns stars.`;
  $('taskList').innerHTML = S.tasks.map((t) => { const p = Math.min(t.need, statOf(t) - t.start); return `<li><img src="${ICON[taskIcon(t)] || ''}" alt=""><div><b>${taskText(t)}</b><div class="bar"><i style="width:${p / t.need * 100}%"></i></div></div><div class="reward">+${t.reward}<small>${p} / ${t.need}</small></div></li>`; }).join('');
  const o = S.order;
  $('orderBox').innerHTML = !S.unlocked.wagon ? 'Build the order wagon by the bakery to take big orders for extra coins.'
    : !o ? 'A new order is on its way.'
      : `Bring these to the wagon by the bakery for <b>${o.reward} coins</b>:<div class="order-items">${Object.keys(o.items).map((k) => `<span class="${(o.got[k] || 0) >= o.items[k] ? 'done' : ''}"><img src="${ICON[k]}" alt="">${o.got[k] || 0}/${o.items[k]}</span>`).join('')}</div>`;
  const next = PAD_ORDER.filter((id) => !S.unlocked[id]).slice(0, 4);
  $('nextList').innerHTML = next.length ? next.map((id) => { const d = PADS[id]; const why = d.lvl > S.level ? `Opens at bakery level ${d.lvl}` : d.req && !S.unlocked[d.req] ? `After ${PADS[d.req].name.toLowerCase()}` : `${d.cost} coins, ready to build`; return `<li><img src="${ICON[d.icon] || ''}" alt=""><div>${d.name}<small>${why}</small></div></li>`; }).join('')
    : '<li>Everything is built! Keep levelling up your upgrades, with no limit.</li>';
}

// ---------- HUD ----------
let shownCoins = S.coins;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function updateHud(dt) {
  shownCoins += (S.coins - shownCoins) * Math.min(1, dt * 12); if (Math.abs(S.coins - shownCoins) < 0.5) shownCoins = S.coins;
  $('coinNum').textContent = Math.round(shownCoins);
  $('carryNum').textContent = `${player.carry.count}/${player.cap}`;
  $('carryPill').classList.toggle('full', player.carry.count >= player.cap);
  updateCarryList(dt);
  $('lvNum').textContent = S.level; $('xpFill').style.width = `${Math.min(100, S.xp / xpNeed(S.level) * 100)}%`;
}
// What's on your tray, as little picture chips, plus a note when you've set everything down.
let carryKey = '', lastCount = 0, emptyT = 0;
function updateCarryList(dt) {
  const counts = {};
  for (const it of player.carry.items) counts[it.kind] = (counts[it.kind] || 0) + 1;
  const n = player.carry.count;
  if (lastCount > 0 && n === 0) emptyT = 2.2;
  lastCount = n; emptyT -= dt;
  const key = n ? Object.entries(counts).map(([k, c]) => k + c).join() : emptyT > 0 ? 'empty' : '';
  if (key === carryKey) return; carryKey = key;
  const el = $('carryList');
  if (n) el.innerHTML = Object.entries(counts).map(([k, c]) => `<span class="chip"><img src="${ICON[k] || ''}" alt="">${c}<small>${NAMES[k] || k}</small></span>`).join('');
  else if (emptyT > 0) el.innerHTML = '<span class="chip done">✓ Tray empty</span>';
  else el.innerHTML = '';
  el.hidden = !el.innerHTML || !playing;
}
// A gentle "what next" hint with a bouncing marker, so you never feel lost.
const marker = new THREE.Group();
{
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 18), new THREE.MeshStandardMaterial({ color: 0xe9b44c, emissive: 0x6a4a10, emissiveIntensity: 0.4, roughness: 0.4 }));
  m.rotation.x = Math.PI; m.position.y = 0.22; marker.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.name = 'ring'; marker.add(ring);
  scene.add(marker); marker.visible = false;
}
let idle = 0, hintText = '';
const BAKE_NAME = { pie: 'pie oven', bread: 'bread oven', jam: 'jam kitchen', custard: 'custard oven', butter: 'butter churn', tart: 'tart oven', honey: 'honey house', cheese: 'cheese room', cider: 'cider press' };
function nextGoal() {
  const c = player.carry, has = (k) => c.countOf(k) > 0;
  const room = (k) => live(k) && piles[PRODUCTS[k].inP].count < maxp(PRODUCTS[k].inP);
  for (const raw of Object.keys(SPARE)) {
    if (!has(raw)) continue;
    const opts = Object.keys(PRODUCTS).filter((k) => PRODUCTS[k].raw === raw && room(k));
    if (opts.length) { opts.sort((x, y) => zones[PRODUCTS[x].inP].pos.distanceTo(player.obj.position) - zones[PRODUCTS[y].inP].pos.distanceTo(player.obj.position)); return { pos: zones[PRODUCTS[opts[0]].inP].pos, text: `Take the ${NAMES[raw]} to the ${BAKE_NAME[opts[0]]} basket.` }; }
    return { pos: zones.cart.pos, text: `The baskets are full. Sell spare ${NAMES[raw]} at the farm cart.` };
  }
  const goods = Object.keys(PRODUCTS).filter(has);
  if (goods.length) {
    const o = S.order, wants = o && S.unlocked.wagon && goods.some((k) => (o.items[k] || 0) > (o.got[k] || 0));
    return wants && goods.every((k) => stallPile(k).count >= maxp(PRODUCTS[k].stall) || (o.items[k] || 0) > (o.got[k] || 0))
      ? { pos: zones.order.pos, text: 'The wagon order needs these. Take them to the order wagon.' }
      : { pos: zones.stallIn.pos, text: wants ? 'Set the bakes out on the stall, or take them to the order wagon.' : 'Set the bakes out on the market stall.' };
  }
  if (S.cash >= 6) return { pos: zones.cash.pos, text: 'Customers paid! Collect your coins by the stall.' };
  const pad = Object.keys(pads).filter((id) => !padLocked(id)).map((id) => ({ id, left: padDef(id).cost - (S.paid[id] || 0) })).sort((a, b) => a.left - b.left)[0];
  if (pad && S.coins >= Math.min(pad.left, 10) && S.coins > 0) { const d = padDef(pad.id); return { pos: new V3(d.pos[0], 0, d.pos[1]), text: `${d.level ? 'Upgrade' : 'Build'} ${d.name.toLowerCase()}: stand on its spot.` }; }
  for (const k of Object.keys(PRODUCTS)) if (live(k) && piles[PRODUCTS[k].outP].count > 0) return { pos: zones[PRODUCTS[k].outP].pos, text: `Fresh ${NAMES[k]} are ready. Pick them up from the ${BAKE_NAME[k]}.` };
  for (const z of Object.keys(PRODUCERS)) if (S.unlocked[PRODUCERS[z].need] && piles[z].count >= 4) return { pos: zones[z].pos, text: `There are ${NAMES[PRODUCERS[z].kind]} to collect.` };
  if (piles.pieIn.count > 0) return { pos: zones.pieOut.pos, text: 'Baking… the pies will be ready in a moment.' };
  let best = null, bd = Infinity; const p = player.obj.position;
  for (const t of world.trees) { if (!treeActive(t) || !t.apples.some((a) => a.grow >= 1)) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
  if (best) return { pos: new V3(best.x + 1.1, 0, best.z + 0.6), text: best.fruit === 'berry' ? 'Walk up to a strawberry bush to pick berries.' : 'Walk up to an apple tree to pick apples.' };
  return { pos: null, text: 'The apples are growing back. Try the wheat field or the stall.' };
}
function updateHint(dt, moving) {
  idle = moving ? 0 : idle + dt;
  const g = nextGoal();
  if (g.text !== hintText) { hintText = g.text; $('hint').textContent = g.text; }
  const showMarker = g.pos && (Object.keys(S.unlocked).length === 0 || idle > 6);
  marker.visible = !!showMarker;
  if (showMarker) { marker.position.lerp(new V3(g.pos.x, 0, g.pos.z), marker.position.distanceTo(g.pos) > 6 ? 1 : Math.min(1, dt * 8)); const t = performance.now() / 1000; marker.children[0].position.y = 1.7 + Math.sin(t * 3.2) * 0.15; marker.getObjectByName('ring').scale.setScalar(1 + Math.sin(t * 3.2) * 0.06); }
}

// ---------- input: thumb joystick + keys ----------
const keys = new Set();
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const JR = 56;
window.addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); keys.add(e.key.toLowerCase()); });
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', (e) => {
  if (!playing || joy.active) return;
  joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  canvas.setPointerCapture(e.pointerId);
  const b = $('joy'); b.style.left = `${e.clientX}px`; b.style.top = `${e.clientY}px`; b.classList.add('on'); $('knob').style.transform = 'translate(-50%,-50%)';
});
canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const L = Math.hypot(dx, dy);
  if (L > JR) { // let the base follow the thumb so it never feels stuck
    joy.ox += dx - dx / L * JR; joy.oy += dy - dy / L * JR; dx = dx / L * JR; dy = dy / L * JR;
    const b = $('joy'); b.style.left = `${joy.ox}px`; b.style.top = `${joy.oy}px`;
  }
  joy.x = dx / JR; joy.y = dy / JR;
  $('knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.active = false; joy.x = joy.y = 0; $('joy').classList.remove('on'); };
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
// zoom: mouse wheel or two-finger pinch
let zoom = 1;
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.65, 1.5); }, { passive: false });
let pinch = null;
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom }; joy.active = false; $('joy').classList.remove('on'); } }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoom = THREE.MathUtils.clamp(pinch.z * pinch.d / d, 0.65, 1.5); } }, { passive: true });
canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());

function inputVec() {
  let x = joy.x, y = joy.y;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) y -= 1;
  if (keys.has('arrowdown') || keys.has('s')) y += 1;
  const L = Math.hypot(x, y);
  if (L > 1) { x /= L; y /= L; }
  if (L < 0.12) return [0, 0];
  return [x, y];
}

// ---------- camera ----------
const camTarget = new V3(), camPos = new V3();
let fov = 40;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  fov = camera.aspect < 0.9 ? 40 : 32; // a narrower lens looks like a tabletop model camera.fov = fov; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
function camDistance() {
  const want = 17; // world units to keep visible side to side
  const d = want / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect);
  return THREE.MathUtils.clamp(d, 14, 27) * zoom;
}
const lookAhead = new V3();
function updateCamera(dt, snap) {
  // the camera leads a little in the direction you're walking, so you see where you're going
  lookAhead.lerp(new V3(player.vel.x, 0, player.vel.z).multiplyScalar(0.32), snap ? 1 : 1 - Math.exp(-2.5 * dt));
  const target = player.obj.position.clone().add(new V3(0, 0.8, 0)).add(lookAhead);
  const d = camDistance(), el = THREE.MathUtils.degToRad(50);
  const want = target.clone().add(new V3(0, Math.sin(el) * d, Math.cos(el) * d));
  const k = snap ? 1 : 1 - Math.exp(-6 * dt);
  camTarget.lerp(target, k); camPos.lerp(want, k);
  camera.position.copy(camPos); camera.lookAt(camTarget);
}
let orbitT = 0;
function orbitCamera(dt) {
  orbitT += dt * 0.08;
  const r = 24, c = new V3(-1, 0.5, 0);
  camera.position.set(c.x + Math.sin(orbitT) * r, 13, c.z + Math.cos(orbitT) * r); camera.lookAt(c);
}

// ---------- ovens, trees and fields over time ----------
let fieldDirty = false, fastGrow = 0;
const ovenTimers = {}, prodTimers = {};
let smokeT = 0;
const STATION = { pie: world.pieOven, bread: world.breadOven, jam: world.jamKitchen, ...world.farm.stations };
const OVENS = ['pie', 'bread', 'custard', 'tart'];
const PRODUCE_AT = { eggs: new V3(19.8, 1.0, -10.6), milk: new V3(27.2, 1.4, -9.4), comb: new V3(-27.4, 1.2, -11.6) };
function updateWorld(dt, t) {
  for (const kind of Object.keys(PRODUCTS)) {
    if (!live(kind)) continue;
    const { inP, outP } = PRODUCTS[kind];
    const oven = STATION[kind];
    const baking = piles[inP].count > 0 && piles[outP].count < maxp(outP);
    ovenTimers[kind] = ovenTimers[kind] || 0;
    if (baking) {
      ovenTimers[kind] += dt;
      if (ovenTimers[kind] >= bakeTime()) {
        const it = piles[inP].take();
        if (it) {
          scene.remove(it.mesh);
          const mouth = oven.localToWorld(OVENS.includes(kind) ? new V3(0, 1.3, 1.1) : new V3(0, 1.2, -0.2));
          piles[outP].add(kind, mouth, 0.35);
        }
        ovenTimers[kind] = 0;
      }
    } else ovenTimers[kind] = 0;
    const f = oven.userData;
    const flick = (baking ? 1 : 0.45) * (0.85 + Math.sin(t * 13 + kind.length) * 0.1 + Math.sin(t * 29) * 0.05);
    if (f.glow) f.glow.intensity = 3.2 * flick;
    if (f.fire) f.fire.scale.set(1, 0.6 + flick * 0.6, 1);
    if (f.plunger && baking) f.plunger.position.y = 1.7 + Math.abs(Math.sin(t * 5)) * 0.25;
    if (f.crank && baking) f.crank.rotation.y += dt * 6;
    if (baking && f.smokeAt && Math.random() < dt * 3) puff(oven.localToWorld(f.smokeAt.clone()), { color: 0xeeeeee, size: 0.35, opacity: 0.55, life: 2.4 });
  }
  // hens lay, cows give milk, bees fill their frames
  for (const z of Object.keys(PRODUCERS)) {
    if (!S.unlocked[PRODUCERS[z].need] || piles[z].count >= maxp(z)) continue;
    prodTimers[z] = (prodTimers[z] || 0) + dt * (z === 'comb' ? beeRate() : farmRate());
    const every = { eggs: 1.6, milk: 2.4, comb: 3.2 }[z];
    if (prodTimers[z] >= every) { prodTimers[z] = 0; piles[z].add(PRODUCERS[z].kind, PRODUCE_AT[z], 0.5); }
  }
  world.farm.animate(dt, t, S.unlocked);
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 0.55; puff(world.bakery.chimneyTop.clone(), { color: 0xf2f2f2, size: 0.5, opacity: 0.45, life: 3.2 }); }
  for (const tr of world.trees) {
    if (!treeActive(tr)) continue;
    for (const a of tr.apples) {
      if (a.grow >= 1) continue;
      a.grow = Math.min(1, a.grow + dt * growRate() / (tr.fruit === 'berry' ? 3.5 : 4.5));
      const s = a.grow < 0.15 ? 0 : (a.grow - 0.15) / 0.85;
      a.mesh.visible = s > 0; a.mesh.scale.setScalar(0.95 * (0.3 + 0.7 * s));
    }
  }
  // fade any orchard tree that stands between the camera and the baker, so you can always see her
  const pp = player.obj.position;
  for (const tr of world.trees) {
    if (!tr.foliage) continue;
    const dz = tr.z - pp.z, dx = Math.abs(tr.x - pp.x);
    const hide = playing && dz > -0.6 && dz < 4.2 && dx < 1.9;
    const want = hide ? 0.32 : 1;
    const fm = [tr.foliage.material, ...tr.foliage.children.map((c) => c.material)];
    if (Math.abs(tr.fade - want) < 0.005) { if (tr.fade !== want) { tr.fade = want; for (const m of fm) { m.opacity = want; if (want === 1) { m.transparent = false; m.depthWrite = true; m.needsUpdate = true; } } } continue; }
    tr.fade += (want - tr.fade) * Math.min(1, dt * 8);
    const tp = tr.fade < 0.99; for (const m of fm) { if (m.transparent !== tp) { m.transparent = tp; m.needsUpdate = true; } m.opacity = tr.fade; m.depthWrite = !tp; }
  }
  if (S.unlocked.wheat) {
    const rate = fastGrow > 0 ? 1 / 1.2 : growRate() / 6; fastGrow -= dt;
    for (const c of world.field.cells) if (c.grow < 1) { c.grow = Math.min(1, c.grow + dt * rate); fieldDirty = true; }
    if (fieldDirty) { updateFieldInstances(world.field); fieldDirty = false; }
  }
  for (const sp of signs) { const d = Math.hypot(sp.position.x - pp.x, sp.position.z - pp.z); const want = playing && d < 5.5 ? 1 : 0; sp.material.opacity += (want - sp.material.opacity) * Math.min(1, dt * 6); sp.visible = sp.material.opacity > 0.02; }
  { // see through the stall awning while you stand behind the counter
    const behind = playing && Math.abs(pp.x - SPOTS.stall.x) < 2.8 && pp.z < SPOTS.stall.z && pp.z > SPOTS.stall.z - 3.2;
    for (const m of world.stall.userData.fadeMats) {
      const o = m.opacity + ((behind ? 0.18 : 1) - m.opacity) * Math.min(1, dt * 8), tp = o < 0.99;
      if (m.transparent !== tp) { m.transparent = tp; m.depthWrite = !tp; m.needsUpdate = true; }
      m.opacity = tp ? o : 1;
    }
  }
  for (const p of Object.values(pads)) if (p.mesh.scale.x < 1) p.mesh.scale.setScalar(Math.min(1, p.mesh.scale.x + dt * 4));
  world.wind.value = t;
}

// The sun's shadow box travels with you, so the whole bigger farm keeps soft shadows.
const SUN_OFF = new V3(-12, 22, 10);
function followSun() {
  const c = playing ? player.obj.position : new V3(0, 0, 0), step = 0.25;
  const x = Math.round(c.x / step) * step, z = Math.round(c.z / step) * step;
  sun.target.position.set(x, 0, z); sun.position.set(x + SUN_OFF.x, SUN_OFF.y, z + SUN_OFF.z);
}

// ---------- main loop ----------
let playing = false, last = performance.now(), frames = 0, slow = 0;
function update(dt, t) {
  if (playing) {
    const [ix, iy] = inputVec();
    const want = new V3(ix, 0, iy).multiplyScalar(player.speed);
    const accel = (ix || iy) ? 10 : 12;
    player.vel.lerp(want, 1 - Math.exp(-accel * dt));
    moveActor(player, dt);
    updateDwell(dt); updateTreeDwell(dt);
    interact(player, dt);
    updateCamera(dt);
    updateHint(dt, !!(ix || iy));
  } else {
    animatePerson(player.obj, 0, dt, player.carry.count > 0);
    orbitCamera(dt);
  }
  updateWorld(dt, t);
  updateTasks(dt);
  followSun();
  updateCustomers(dt);
  updateWorkers(dt);
  updateTimers(dt);
  updateFlights(dt);
  for (const p of Object.values(piles)) p.update(dt);
  updatePops(dt); updatePuffs(dt);
  updateHud(dt);
}
let simT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt;
  // quietly lower resolution if a phone is struggling, to keep motion smooth
  frames++; if (dt > 0.026) slow++;
  if (frames === 120) { if (slow > 84 && pixelRatio > MIN_RATIO + 0.01) { pixelRatio = Math.max(MIN_RATIO, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); } frames = 0; slow = 0; }
  update(dt, simT);
  if (window.__camOverride) window.__camOverride(camera);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- start ----------
function setupZones() {
  addZone('pieIn', SPOTS.pieIn, 'apple', 'Apples in');
  addZone('pieOut', SPOTS.pieOut, 'pie', 'Pies');
  addZone('breadIn', SPOTS.breadIn, 'wheat', 'Wheat in', world.breadGroup);
  addZone('breadOut', SPOTS.breadOut, 'bread', 'Bread', world.breadGroup);
  addZone('stallIn', SPOTS.stallIn, 'pie', 'Stall');
  addZone('cash', SPOTS.cash, 'coin', 'Coins');
  addZone('jamIn', SPOTS.jamIn, 'apple', 'Apples in', world.jamGroup);
  addZone('jamOut', SPOTS.jamOut, 'jam', 'Jam', world.jamGroup);
  addZone('cart', SPOTS.cart, 'coin', 'Sell extras');
  addZone('eggs', SPOTS.eggs, 'egg', 'Eggs', FG.hens); addZone('milk', SPOTS.milk, 'milk', 'Milk', FG.dairy); addZone('comb', SPOTS.comb, 'comb', 'Honeycomb', FG.bees);
  addZone('custardIn', SPOTS.custardIn, 'egg', 'Eggs in', FG.pastry); addZone('custardOut', SPOTS.custardOut, 'custard', 'Custard', FG.pastry);
  addZone('butterIn', SPOTS.butterIn, 'milk', 'Milk in', FG.churn); addZone('butterOut', SPOTS.butterOut, 'butter', 'Butter', FG.churn);
  addZone('tartIn', SPOTS.tartIn, 'berry', 'Berries in', FG.tarts); addZone('tartOut', SPOTS.tartOut, 'tart', 'Tarts', FG.tarts);
  addZone('honeyIn', SPOTS.honeyIn, 'comb', 'Comb in', FG.honey); addZone('honeyOut', SPOTS.honeyOut, 'honey', 'Honey', FG.honey);
  addZone('cheeseIn', SPOTS.cheeseIn, 'milk', 'Milk in', FG.cheese); addZone('cheeseOut', SPOTS.cheeseOut, 'cheese', 'Cheese', FG.cheese);
  addZone('ciderIn', SPOTS.ciderIn, 'apple', 'Apples in', FG.cider); addZone('ciderOut', SPOTS.ciderOut, 'cider', 'Cider', FG.cider);
  addZone('order', SPOTS.order, 'wagon', 'Orders', FG.wagon);
}
function restore() {
  // hide everything that hasn't been built yet
  world.treeGroups.trees2.visible = !!S.unlocked.trees2; world.treeGroups.orchard3.visible = !!S.unlocked.orchard3;
  world.field.group.visible = !!S.unlocked.wheat; world.breadGroup.visible = !!S.unlocked.bread;
  world.tea.group.visible = !!S.unlocked.tea; world.flowers.visible = !!S.unlocked.flowers;
  world.jamGroup.visible = !!S.unlocked.jam; world.signpost.visible = !!S.unlocked.sign1; world.bunting.visible = !!S.unlocked.sign2;
  for (const id of Object.keys(FG)) FG[id].visible = !!S.unlocked[id];
  FG.shopE.visible = !!(S.unlocked.pastry || S.unlocked.churn); FG.shopW.visible = !!(S.unlocked.tarts || S.unlocked.honey); FG.shopN.visible = !!(S.unlocked.cheese || S.unlocked.cider);
  world.colliders.push({ box: [SPOTS.breadOven.x - 1.4, SPOTS.breadOven.z - 1.3, SPOTS.breadOven.x + 1.4, SPOTS.breadOven.z + 1.3], need: 'bread' });
  world.colliders.push({ x: 8, z: 11.4, r: 0.01, need: 'tea' });
  for (const [x, z] of [[6.4, 10.2], [9.6, 10.2], [8.0, 12.9]]) world.colliders.push({ x, z, r: 0.55, need: 'tea' });
  for (const id of Object.keys(S.unlocked)) applyUnlock(id, false);
  for (const [name, kind] of Object.entries(PILE_KIND)) for (let i = 0; i < Math.min(S.piles[name] || 0, maxp(name)); i++) piles[name].addInstant(kind);
  if (S.order) for (const [k, n] of Object.entries(S.order.got)) for (let i = 0; i < Math.min(n, 12); i++) piles.order.addInstant(k);
  drawOrder();
  for (const k of (S.carry || []).slice(0, cap())) if (LAYER[k]) player.carry.addInstant(k);
  syncCash(); refreshPads();
  for (const p of Object.values(pads)) p.mesh.scale.setScalar(1);
  player.cap = cap();
  tameEnv(scene);
}
// soften studio reflections everywhere so the outdoor sun leads
function tameEnv(root) { root.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial && m.envMapIntensity === 1) m.envMapIntensity = m.metalness > 0.5 ? 0.8 : 0.3; }); }
// keep the save in step with what's on screen
setInterval(() => {
  for (const name of Object.keys(PILE_KIND)) S.piles[name] = piles[name].count;
  if (playing) save();
}, 2000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

function setSoundBtn() { $('panelSound').textContent = S.sound ? 'Sound: on' : 'Sound: off'; $('soundBtn').classList.toggle('off', !S.sound); $('soundBtn').setAttribute('aria-label', S.sound ? 'Sound on' : 'Sound off'); }
$('panelSound').addEventListener('click', () => $('soundBtn').click());
$('soundBtn').addEventListener('click', () => { S.sound = !S.sound; setSoundBtn(); save(); if (S.sound) tone(660, 0.1); });
$('playBtn').addEventListener('click', () => {
  playing = true; $('start').hidden = true; $('hud').hidden = false; $('hint').hidden = false; carryKey = '-';
  updateCamera(0, true); camPos.copy(camera.position);
  if (S.sound) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { /* ignore */ } }
});
$('menuBtn').addEventListener('click', () => { save(); playing = false; $('panel').hidden = true; $('carryList').hidden = true; $('start').hidden = false; $('hud').hidden = true; $('hint').hidden = true; joy.active = false; $('joy').classList.remove('on'); setPlayLabel(); });
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Start a brand new bakery? Your coins and buildings will be cleared.')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  location.reload();
});
function openPanel() { drawPanel(); $('panel').hidden = false; $('goalsDot').hidden = true; }
$('goalsBtn').addEventListener('click', openPanel); $('lvPill').addEventListener('click', openPanel);
$('panelClose').addEventListener('click', () => { $('panel').hidden = true; });
$('panel').addEventListener('click', (e) => { if (e.target.id === 'panel') $('panel').hidden = true; });
function setPlayLabel() { $('playBtn').textContent = (S.sold > 0 || Object.keys(S.unlocked).length) ? 'Continue' : 'Open the bakery'; }

resize();
renderIcons().then((imgs) => {
  IMG = imgs;
  $('coinIcon').src = ICON.coin; $('carryIcon').src = ICON.tray;
  setupZones(); restore(); setSoundBtn(); setPlayLabel();
  $('loading').hidden = true; $('playBtn').disabled = false;
  if (new URLSearchParams(location.search).has('play')) $('playBtn').click();
  requestAnimationFrame((n) => { last = n; frame(n); });
});

// testing hook
window.__ob = { addXP, get order() { return S.order; }, newOrder, drawPanel, openPanel, workers, keys, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simT += dt; update(dt, simT); } }, info: () => renderer.info.render, S, camera, updateCamera, THREE, scene, player, piles, world, unlock, get pads() { return pads; }, customers, setPlaying: (v) => { playing = v; } };

// ---------- offline + updates ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // When an update takes over, reload once so the new version shows right away
  // (progress is saved). Also look for updates whenever the app comes back to the front.
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; save(); location.reload(); } });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  });
}
