// Orchard Bakery: a calm 3D bakery-management game.
// Pick apples and wheat, bake pies and bread, stock the stall, collect coins, build your bakery up.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { makeItem, makePerson, animatePerson, makeCoin, makeBasket, makeUmbrella, makeTable, rand, mats } from './models.js';
import { buildWorld, updateFieldInstances, SPOTS, FIELD, BOUNDS, PADS, PAD_ORDER, makeTree } from './world.js';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const SAVE_KEY = 'orchard-bakery-save-v1';

// ---------- renderer ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e7d6, 45, 120);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environment = envTex;
// soften the studio reflections so the outdoor sun leads

const hemi = new THREE.HemisphereLight(0xdcebff, 0x6a7a3a, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 3.0);
sun.position.set(-12, 22, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 19, bottom: -19, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

const world = buildWorld(scene);

// ---------- state ----------
const DEFAULT = () => ({ coins: 0, cash: 0, unlocked: {}, paid: {}, carry: [], ovens: { pie: { in: 0, out: 0 }, bread: { in: 0, out: 0 }, jam: { in: 0, out: 0 } }, stall: { pie: 0, bread: 0, jam: 0 }, sound: true, sold: 0 });
let S = DEFAULT();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s.coins === 'number') S = Object.assign(DEFAULT(), s); } catch (e) { /* fresh start */ }
S.ovens.jam = S.ovens.jam || { in: 0, out: 0 }; S.stall.jam = S.stall.jam || 0;
const save = () => {
  S.carry = player.carry.items.map((i) => i.kind);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be blocked */ }
};
const cap = () => (S.unlocked.barrow ? 22 : S.unlocked.basket ? 14 : 8);
// Each product: raw item -> station basket -> finished goods table -> stall display
const PRODUCTS = {
  pie: { raw: 'apple', inP: 'pieIn', outP: 'pieOut', stall: 'stallPie', need: null },
  bread: { raw: 'wheat', inP: 'breadIn', outP: 'breadOut', stall: 'stallBread', need: 'bread' },
  jam: { raw: 'apple', inP: 'jamIn', outP: 'jamOut', stall: 'stallJam', need: 'jam' }
};
const live = (k) => !PRODUCTS[k].need || !!S.unlocked[PRODUCTS[k].need];
const price = (k) => ({ pie: 6 + (S.unlocked.price1 ? 3 : 0), bread: 7 + (S.unlocked.price2 ? 3 : 0), jam: 9 + (S.unlocked.price2 ? 3 : 0) }[k]);
const bakeTime = () => 1.0 * (S.unlocked.oven1 ? 0.7 : 1) * (S.unlocked.oven2 ? 0.7 : 1); // seconds per item

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
const SCALE = { apple: 0.75, pie: 0.72, bread: 0.72, wheat: 1, coin: 1, jam: 1 };
const LAYER = { // per-layer offsets, layer height, base lift
  apple: [[[-0.085, -0.04], [0.085, -0.04], [0, 0.085]], 0.19, 0.105],
  pie: [[[0, 0]], 0.1, 0],
  bread: [[[0, -0.075], [0, 0.075]], 0.155, 0],
  wheat: [[[0, -0.06], [0, 0.06]], 0.085, 0.045],
  jam: [[[-0.1, 0], [0.1, 0]], 0.215, 0]
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
  const m = makeItem(kind); m.scale.setScalar(SCALE[kind]);
  if (kind === 'apple') m.rotation.y = Math.random() * 6;
  if (kind === 'pie') m.rotation.y = Math.random() * 6;
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
  pieIn: new Pile(scene, basketLayout, A.pieIn), pieOut: new Pile(scene, gridLayout(3, 1, 0.42, 0), A.pieOut),
  breadIn: new Pile(world.breadGroup, basketLayout, A.breadIn), breadOut: new Pile(world.breadGroup, gridLayout(2, 2, 0.55, 0.22), A.breadOut),
  stallPie: new Pile(scene, gridLayout(3, 1, 0.47, 0, -0.8, -0.05), A.stall), stallBread: new Pile(scene, gridLayout(2, 2, 0.52, 0.25, 0.85, -0.05), A.stall),
  jamIn: new Pile(world.jamGroup, basketLayout, A.jamIn), jamOut: new Pile(world.jamGroup, gridLayout(4, 2, 0.26, 0.24), A.jamOut),
  stallJam: new Pile(world.jamGroup, gridLayout(4, 3, 0.24, 0.22), A.jamTable)
};
const MAXP = { pieIn: 28, breadIn: 24, jamIn: 28, pieOut: 12, breadOut: 12, jamOut: 16 };
const maxp = (name) => (name.startsWith('stall') ? (S.unlocked.stall2 ? 20 : 12) : MAXP[name]);
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
  ir.setSize(128, 128); ir.setPixelRatio(1); ir.outputColorSpace = THREE.SRGBColorSpace; ir.toneMapping = THREE.ACESFilmicToneMapping;
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
  ip.dispose(); ir.dispose(); ir.forceContextLoss && ir.forceContextLoss();
  const imgs = {};
  return Promise.all(Object.entries(ICON).map(([k, url]) => new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = url; imgs[k] = im; }))).then(() => imgs);
}
let IMG = {};

// ---------- build pads ----------
const pads = {};
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawPad(p) {
  const c = p.ctx, W = 320, def = PADS[p.id], paid = S.paid[p.id] || 0, left = Math.max(0, def.cost - paid);
  c.clearRect(0, 0, W, W);
  roundRect(c, 10, 10, W - 20, W - 20, 46); c.fillStyle = 'rgba(251,246,234,.93)'; c.fill();
  c.lineWidth = 10; c.setLineDash([26, 16]); c.strokeStyle = '#3f6b45'; c.stroke(); c.setLineDash([]);
  // progress fill from the bottom
  c.save(); roundRect(c, 10, 10, W - 20, W - 20, 46); c.clip();
  c.fillStyle = 'rgba(233,180,76,.45)'; const fh = (W - 20) * (paid / def.cost); c.fillRect(10, W - 10 - fh, W - 20, fh); c.restore();
  if (IMG[def.icon]) c.drawImage(IMG[def.icon], W / 2 - 66, 26, 132, 132);
  c.fillStyle = '#2f3b2a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 34px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif'; c.fillText(def.name, W / 2, 186);
  if (IMG.coin) c.drawImage(IMG.coin, W / 2 - 78, 214, 62, 62);
  c.font = 'bold 54px ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'left'; c.fillText(String(left), W / 2 - 8, 248);
  p.tex.needsUpdate = true;
}
function makePad(id) {
  const def = PADS[id];
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
  for (const id of PAD_ORDER) {
    if (S.unlocked[id]) continue;
    const req = PADS[id].req; if (req && !S.unlocked[req]) continue;
    out.push(id); if (out.length >= 3) break;
  }
  return out;
}
function refreshPads() {
  const act = activePadIds();
  for (const id of Object.keys(pads)) if (!act.includes(id)) { const p = pads[id]; burst(p.mesh.position, 10, 1.2); scene.remove(p.mesh); p.tex.dispose(); delete pads[id]; }
  for (const id of act) if (!pads[id]) makePad(id);
}

// ---------- zones on the ground (soft markers) ----------
function zoneTex(icon, label) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  c.beginPath(); c.arc(128, 128, 112, 0, Math.PI * 2); c.fillStyle = 'rgba(255,250,238,.7)'; c.fill();
  c.lineWidth = 9; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
  if (IMG[icon]) { c.drawImage(IMG[icon], 58, 28, 140, 140); }
  if (label) { c.fillStyle = '#3b3a2c'; c.font = 'bold 40px ui-rounded, -apple-system, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText(label, 128, 212); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const zones = {};
function addZone(name, pos, icon, label, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: zoneTex(icon, label), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.025, pos.z); m.receiveShadow = true; parent.add(m);
  zones[name] = { pos: new V3(pos.x, 0, pos.z), mesh: m, r: 0.95 };
}

// ---------- customers ----------
const QUEUE = (i) => new V3(0, 0, 6.75 + i * 1.05);
const customers = [], queue = [];
const POOL = [];
for (let i = 0; i < 16; i++) {
  const p = makePerson({ seed: 100 + i * 17 }); p.visible = false; scene.add(p);
  const bub = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); bub.scale.set(0.62, 0.62, 1); bub.position.y = 2.15; bub.visible = false; p.add(bub);
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
  const c = { ...slot, slot, pos: slot.person.position, path: [], state: 'in', speed: 2.1 + Math.random() * 0.5, t: 0, want: null, buys: 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0), seat: null, face: Math.PI, spd: 0 };
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
  const interval = 3.0 * (tea ? 0.75 : 1) * (flowers ? 0.85 : 1) * (S.unlocked.sign1 ? 0.8 : 1) * (S.unlocked.sign2 ? 0.8 : 1);
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
          const pr = price(it.kind); S.sold++;
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
  shop: { seed: 33, shirt: 0x6a8fc0, apron: true, hat: true }, field: { seed: 45, shirt: 0xc97a9a, hairStyle: 3 }
};
function addWorker(kind, look = kind) {
  const p = makePerson(WORKER_LOOK[look]);
  const start = { orchard: [-6, 0], shop: [-1.5, -3], field: [6.2, 1] }[kind];
  p.position.set(start[0], 0, start[1]); scene.add(p);
  const w = makeActor(p, 6, 2.8); w.kind = kind; w.state = 'idle'; w.target = null; w.wait = 0;
  tameEnv(p); burst(p.position.clone(), 10, 1); workers.push(w); return w;
}
function stepToward(a, target, dt) {
  const d = new V3().subVectors(target, a.obj.position); d.y = 0; const L = d.length();
  if (L < 0.35) { a.vel.multiplyScalar(Math.exp(-10 * dt)); return true; }
  const want = d.normalize().multiplyScalar(a.speed);
  a.vel.lerp(want, 1 - Math.exp(-8 * dt));
  return false;
}
// Which basket a helper should fill: the emptier one that still has room below the helper limit
function helperBasket(raw) {
  const opts = Object.keys(PRODUCTS).filter((k) => live(k) && PRODUCTS[k].raw === raw && piles[PRODUCTS[k].inP].count < HELPER_FILL);
  opts.sort((x, y) => piles[PRODUCTS[x].inP].count - piles[PRODUCTS[y].inP].count);
  return opts[0] ? PRODUCTS[opts[0]].inP : null;
}
function updateWorkers(dt) {
  for (const w of workers) {
    let target = null;
    const pos = w.obj.position;
    if (w.kind === 'orchard' || w.kind === 'field') {
      const raw = w.kind === 'orchard' ? 'apple' : 'wheat';
      if (w.state === 'drop' && (w.carry.count === 0 || !helperBasket(raw))) w.state = 'pick';
      if (w.state !== 'drop') {
        w.state = 'pick';
        let best = null, bd = Infinity;
        if (w.carry.count < w.cap) {
          if (raw === 'apple') for (const t of world.trees) {
            if (!treeActive(t) || !t.apples.some((a) => a.grow >= 1)) continue;
            const d = Math.hypot(t.x - pos.x, t.z - pos.z) - (t === w.target ? 2 : 0);
            if (d < bd) { bd = d; best = t; }
          } else for (const c of world.field.cells) {
            if (c.grow < 1) continue;
            const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < bd) { bd = d; best = c; }
          }
        }
        w.target = best;
        const basket = helperBasket(raw);
        if (basket && (w.carry.count >= w.cap || (!best && w.carry.count > 0))) w.state = 'drop';
        else if (best && w.carry.count < w.cap) {
          if (raw === 'apple') { const dir = new V3(pos.x - best.x, 0, pos.z - best.z); if (dir.length() < 0.1) dir.set(1, 0, 0); target = new V3(best.x, 0, best.z).add(dir.normalize().multiplyScalar(1.05)); }
          else target = new V3(best.x, 0, best.z);
        } else target = raw === 'apple' ? new V3(-5.6, 0, 0.4) : new V3(6.2, 0, 1.0); // rest when the baskets are full
      }
      if (w.state === 'drop') { const b = helperBasket(raw); target = b ? zones[b].pos : null; w.dropTo = b; }
    } else {
      const room = (k) => stallPile(k).count < maxp(PRODUCTS[k].stall);
      if (w.state === 'deliver' && w.carry.count === 0) w.state = 'fetch';
      if (w.state !== 'deliver') {
        w.state = 'fetch';
        const opts = [];
        for (const k of Object.keys(PRODUCTS)) if (live(k) && piles[PRODUCTS[k].outP].count > 0 && room(k)) opts.push([PRODUCTS[k].outP, piles[PRODUCTS[k].outP].count]);
        opts.sort((a, b) => b[1] - a[1]);
        if (w.carry.count >= w.cap || (!opts.length && w.carry.count > 0)) w.state = 'deliver';
        else if (opts.length) target = zones[opts[0][0]].pos;
        else target = new V3(-1.2, 0, -3.2);
      }
      if (w.state === 'deliver') target = zones.stallIn.pos;
    }
    if (target) stepToward(w, target, dt);
    else w.vel.multiplyScalar(Math.exp(-10 * dt));
    moveActor(w, dt);
    const allow = w.kind === 'orchard' ? ['trees', w.dropTo || 'none'] : w.kind === 'field' ? ['wheat', w.dropTo || 'none'] : ['pieOut', 'breadOut', 'jamOut', 'stallIn'];
    interact(w, dt, allow, w.kind !== 'shop');
  }
}

// ---------- movement + collisions ----------
function treeActive(t) { return t.group === 'start' || !!S.unlocked[t.group]; }
function resolve(pos, r = 0.3) {
  for (const c of world.colliders) {
    if (c.group && c.group !== 'start' && !S.unlocked[c.group]) continue;
    if (c.need && !S.unlocked[c.need]) continue;
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
  if (sp > 0.15) a.facing = Math.atan2(a.vel.x, a.vel.z);
  turnTo(a.obj, a.facing, dt, 12);
  animatePerson(a.obj, Math.min(moved, sp + 0.01), dt, a.carry.count > 0);
  a.carry.update(dt);
}

// ---------- interactions ----------
function near(a, z) { return zones[z] && a.obj.position.distanceTo(zones[z].pos) < zones[z].r; }
function interact(a, dt, allowed, helper = false) {
  a.cool -= dt; if (a.cool > 0) return;
  const can = (z) => !allowed || allowed.includes(z);
  const pos = a.obj.position;
  // pick apples
  if (can('trees') && a.carry.count < a.cap) {
    for (const t of world.trees) {
      if (!treeActive(t) || Math.hypot(t.x - pos.x, t.z - pos.z) > 1.75) continue;
      const ap = t.apples.find((x) => x.grow >= 1);
      if (ap) {
        ap.grow = 0; ap.mesh.visible = false;
        a.carry.add('apple', ap.mesh.getWorldPosition(new V3()), 0.3); a.cool = 0.09; if (a === player) sfx.pick(); return;
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
    if (!can(zone) || !near(a, zone) || piles[pileName].count >= (helper ? HELPER_FILL : maxp(pileName))) return false;
    const it = a.carry.take(kind); if (!it) return false;
    scene.remove(it.mesh); piles[pileName].add(kind, it.wp, 0.28); a.cool = 0.08; if (a === player) sfx.pick(); return true;
  };
  const takeFrom = (zone, pileName) => {
    if (!can(zone) || !near(a, zone) || a.carry.count >= a.cap) return false;
    const it = piles[pileName].take(); if (!it) return false;
    scene.remove(it.mesh); a.carry.add(it.kind, it.wp, 0.28); a.cool = 0.08; if (a === player) sfx.pick(); return true;
  };
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && drop(P.inP, P.raw, P.inP)) return; }
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && takeFrom(P.outP, P.outP)) return; }
  for (const k of Object.keys(PRODUCTS)) { const P = PRODUCTS[k]; if (live(k) && drop('stallIn', k, P.stall)) return; }
  if (a !== player) return;
  // sell spare apples and wheat at the farm cart, so a full tray never leaves you stuck
  if (near(a, 'cart')) {
    const it = a.carry.take('apple') || a.carry.take('wheat');
    if (it) { scene.remove(it.mesh); fly(it.mesh, it.wp, null, zones.cart.pos.clone().add(new V3(0, 0.8, -1.05)), 0.25, () => { S.coins += 1; sfx.coin(); }, 0.6); a.cool = 0.07; return; }
  }
  // collect coins
  if (near(a, 'cash') && S.cash > 0) {
    const chunk = Math.max(1, Math.ceil(S.cash / 12));
    S.cash -= chunk; S.coins += chunk; syncCash();
    const coin = makeCoin(); fly(coin, A.cash.clone().add(new V3(0, 0.2, 0)), player.obj, new V3(0, 1.3, 0), 0.25, () => { player.obj.remove(coin); }, 0.5);
    sfx.coin(); a.cool = 0.06; return;
  }
  // pay into build pads
  for (const id of Object.keys(pads)) {
    const p = pads[id], def = PADS[id];
    if (Math.hypot(pos.x - def.pos[0], pos.z - def.pos[1]) > 0.95 || S.coins <= 0) continue;
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
  if (id === 'helper') addWorker('orchard');
  if (id === 'helper3') addWorker('orchard', 'orchard2');
  if (id === 'helper2') addWorker('field');
  if (id === 'runner') addWorker('shop');
  player.cap = cap();
}
function unlock(id, animate) {
  S.unlocked[id] = true; delete S.paid[id];
  applyUnlock(id, animate);
  if (animate) { sfx.build(); toast(`${PADS[id].name} built!`); }
  refreshPads(); save();
}

// ---------- HUD ----------
let shownCoins = S.coins;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function updateHud(dt) {
  shownCoins += (S.coins - shownCoins) * Math.min(1, dt * 12); if (Math.abs(S.coins - shownCoins) < 0.5) shownCoins = S.coins;
  $('coinNum').textContent = Math.round(shownCoins);
  $('carryNum').textContent = `${player.carry.count}/${player.cap}`;
  $('carryPill').classList.toggle('full', player.carry.count >= player.cap);
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
function nextGoal() {
  const c = player.carry, has = (k) => c.countOf(k) > 0;
  const room = (k) => live(k) && piles[PRODUCTS[k].inP].count < maxp(PRODUCTS[k].inP);
  if (has('apple')) {
    const k = ['pie', 'jam'].find(room);
    if (k) return { pos: zones[PRODUCTS[k].inP].pos, text: k === 'pie' ? 'Put the apples in the oven basket.' : 'Put the apples in the jam kitchen basket.' };
    return { pos: zones.cart.pos, text: 'The baskets are full. Sell spare apples at the farm cart.' };
  }
  if (has('wheat')) {
    if (room('bread')) return { pos: zones.breadIn.pos, text: 'Put the wheat in the bread oven basket.' };
    return { pos: zones.cart.pos, text: S.unlocked.bread ? 'The bread basket is full. Sell spare wheat at the farm cart.' : 'Sell the wheat at the farm cart, or build the bread oven.' };
  }
  if (has('pie') || has('bread') || has('jam')) return { pos: zones.stallIn.pos, text: 'Set the bakes out on the market stall.' };
  if (S.cash >= 6) return { pos: zones.cash.pos, text: 'Customers paid! Collect your coins by the stall.' };
  const pad = Object.keys(pads).map((id) => ({ id, left: PADS[id].cost - (S.paid[id] || 0) })).sort((a, b) => a.left - b.left)[0];
  if (pad && S.coins >= Math.min(pad.left, 10) && S.coins > 0) return { pos: new V3(PADS[pad.id].pos[0], 0, PADS[pad.id].pos[1]), text: `Build ${PADS[pad.id].name.toLowerCase()}: stand on its spot.` };
  const names = { pie: 'Fresh pies! Pick them up', bread: 'Fresh bread! Pick it up', jam: 'Fresh jam! Pick the jars up' };
  for (const k of Object.keys(PRODUCTS)) if (live(k) && piles[PRODUCTS[k].outP].count > 0) return { pos: zones[PRODUCTS[k].outP].pos, text: `${names[k]} from the table.` };
  if (piles.pieIn.count > 0) return { pos: zones.pieOut.pos, text: 'Baking… the pies will be ready in a moment.' };
  let best = null, bd = Infinity; const p = player.obj.position;
  for (const t of world.trees) { if (!treeActive(t) || !t.apples.some((a) => a.grow >= 1)) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
  if (best) return { pos: new V3(best.x + 1.1, 0, best.z + 0.6), text: 'Walk up to an apple tree to pick apples.' };
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
  fov = camera.aspect < 0.9 ? 48 : 40; camera.fov = fov; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
function camDistance() {
  const want = 17; // world units to keep visible side to side
  const d = want / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect);
  return THREE.MathUtils.clamp(d, 12, 21) * zoom;
}
function updateCamera(dt, snap) {
  const target = player.obj.position.clone().add(new V3(0, 0.8, 0));
  const d = camDistance(), el = THREE.MathUtils.degToRad(44);
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
const ovenTimers = { pie: 0, bread: 0 };
let smokeT = 0;
function updateWorld(dt, t) {
  for (const kind of Object.keys(PRODUCTS)) {
    if (!live(kind)) continue;
    const { inP, outP } = PRODUCTS[kind];
    const oven = kind === 'pie' ? world.pieOven : kind === 'bread' ? world.breadOven : world.jamKitchen;
    const baking = piles[inP].count > 0 && piles[outP].count < MAXP[outP];
    if (baking) {
      ovenTimers[kind] += dt;
      if (ovenTimers[kind] >= bakeTime()) {
        const it = piles[inP].take();
        if (it) {
          scene.remove(it.mesh);
          const mouth = oven.localToWorld(kind === 'jam' ? new V3(0, 1.2, -0.2) : new V3(0, 1.3, 1.1));
          piles[outP].add(kind, mouth, 0.35);
        }
        ovenTimers[kind] = 0;
      }
    } else ovenTimers[kind] = 0;
    const f = oven.userData;
    const flick = (baking ? 1 : 0.45) * (0.85 + Math.sin(t * 13 + kind.length) * 0.1 + Math.sin(t * 29) * 0.05);
    if (f.glow) f.glow.intensity = 3.2 * flick;
    f.fire.scale.set(1, 0.6 + flick * 0.6, 1);
    if (baking && Math.random() < dt * 3) puff(oven.localToWorld(f.smokeAt.clone()), { color: 0xeeeeee, size: 0.35, opacity: 0.55, life: 2.4 });
  }
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = 0.55; puff(world.bakery.chimneyTop.clone(), { color: 0xf2f2f2, size: 0.5, opacity: 0.45, life: 3.2 }); }
  for (const tr of world.trees) {
    if (!treeActive(tr)) continue;
    for (const a of tr.apples) {
      if (a.grow >= 1) continue;
      a.grow = Math.min(1, a.grow + dt / 4.5);
      const s = a.grow < 0.15 ? 0 : (a.grow - 0.15) / 0.85;
      a.mesh.visible = s > 0; a.mesh.scale.setScalar(0.95 * (0.3 + 0.7 * s));
    }
  }
  // fade any orchard tree that stands between the camera and the baker, so you can always see her
  const pp = player.obj.position;
  for (const tr of world.trees) {
    const dz = tr.z - pp.z, dx = Math.abs(tr.x - pp.x);
    const hide = playing && dz > -0.6 && dz < 4.2 && dx < 1.9;
    const want = hide ? 0.32 : 1;
    if (Math.abs(tr.fade - want) < 0.005) { if (tr.fade !== want) { tr.fade = want; const m = tr.foliage.material; m.opacity = want; if (want === 1) { m.transparent = false; m.depthWrite = true; m.needsUpdate = true; } } continue; }
    tr.fade += (want - tr.fade) * Math.min(1, dt * 8);
    const m = tr.foliage.material, tp = tr.fade < 0.99; if (m.transparent !== tp) { m.transparent = tp; m.needsUpdate = true; } m.opacity = tr.fade; m.depthWrite = !tp;
  }
  if (S.unlocked.wheat) {
    const rate = fastGrow > 0 ? 1 / 1.2 : 1 / 6; fastGrow -= dt;
    for (const c of world.field.cells) if (c.grow < 1) { c.grow = Math.min(1, c.grow + dt * rate); fieldDirty = true; }
    if (fieldDirty) { updateFieldInstances(world.field); fieldDirty = false; }
  }
  for (const p of Object.values(pads)) if (p.mesh.scale.x < 1) p.mesh.scale.setScalar(Math.min(1, p.mesh.scale.x + dt * 4));
  world.wind.value = t;
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
    interact(player, dt);
    updateCamera(dt);
    updateHint(dt, !!(ix || iy));
  } else {
    animatePerson(player.obj, 0, dt, player.carry.count > 0);
    orbitCamera(dt);
  }
  updateWorld(dt, t);
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
  if (frames === 120) { if (slow > 60 && pixelRatio > 1.2) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); resize(); } frames = 0; slow = 0; }
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
}
function restore() {
  // hide everything that hasn't been built yet
  world.treeGroups.trees2.visible = !!S.unlocked.trees2; world.treeGroups.orchard3.visible = !!S.unlocked.orchard3;
  world.field.group.visible = !!S.unlocked.wheat; world.breadGroup.visible = !!S.unlocked.bread;
  world.tea.group.visible = !!S.unlocked.tea; world.flowers.visible = !!S.unlocked.flowers;
  world.jamGroup.visible = !!S.unlocked.jam; world.signpost.visible = !!S.unlocked.sign1; world.bunting.visible = !!S.unlocked.sign2;
  world.colliders.push({ box: [SPOTS.breadOven.x - 1.4, SPOTS.breadOven.z - 1.3, SPOTS.breadOven.x + 1.4, SPOTS.breadOven.z + 1.3], need: 'bread' });
  world.colliders.push({ x: 8, z: 11.4, r: 0.01, need: 'tea' });
  for (const [x, z] of [[6.4, 10.2], [9.6, 10.2], [8.0, 12.9]]) world.colliders.push({ x, z, r: 0.55, need: 'tea' });
  for (const id of Object.keys(S.unlocked)) applyUnlock(id, false);
  const o = S.ovens;
  for (let i = 0; i < Math.min(o.pie.in, MAXP.pieIn); i++) piles.pieIn.addInstant('apple');
  for (let i = 0; i < Math.min(o.pie.out, MAXP.pieOut); i++) piles.pieOut.addInstant('pie');
  for (let i = 0; i < Math.min(o.bread.in, MAXP.breadIn); i++) piles.breadIn.addInstant('wheat');
  for (let i = 0; i < Math.min(o.bread.out, MAXP.breadOut); i++) piles.breadOut.addInstant('bread');
  for (let i = 0; i < Math.min(o.jam.in, MAXP.jamIn); i++) piles.jamIn.addInstant('apple');
  for (let i = 0; i < Math.min(o.jam.out, MAXP.jamOut); i++) piles.jamOut.addInstant('jam');
  for (let i = 0; i < Math.min(S.stall.pie, maxp('stallPie')); i++) piles.stallPie.addInstant('pie');
  for (let i = 0; i < Math.min(S.stall.bread, maxp('stallBread')); i++) piles.stallBread.addInstant('bread');
  for (let i = 0; i < Math.min(S.stall.jam, maxp('stallJam')); i++) piles.stallJam.addInstant('jam');
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
  S.ovens.pie.in = piles.pieIn.count; S.ovens.pie.out = piles.pieOut.count;
  S.ovens.bread.in = piles.breadIn.count; S.ovens.bread.out = piles.breadOut.count;
  S.ovens.jam.in = piles.jamIn.count; S.ovens.jam.out = piles.jamOut.count;
  S.stall.pie = piles.stallPie.count; S.stall.bread = piles.stallBread.count; S.stall.jam = piles.stallJam.count;
  if (playing) save();
}, 2000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

function setSoundBtn() { $('soundBtn').classList.toggle('off', !S.sound); $('soundBtn').setAttribute('aria-label', S.sound ? 'Sound on' : 'Sound off'); }
$('soundBtn').addEventListener('click', () => { S.sound = !S.sound; setSoundBtn(); save(); if (S.sound) tone(660, 0.1); });
$('playBtn').addEventListener('click', () => {
  playing = true; $('start').hidden = true; $('hud').hidden = false; $('hint').hidden = false;
  updateCamera(0, true); camPos.copy(camera.position);
  if (S.sound) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { /* ignore */ } }
});
$('menuBtn').addEventListener('click', () => { save(); playing = false; $('start').hidden = false; $('hud').hidden = true; $('hint').hidden = true; joy.active = false; $('joy').classList.remove('on'); setPlayLabel(); });
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Start a brand new bakery? Your coins and buildings will be cleared.')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  location.reload();
});
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
window.__ob = { keys, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simT += dt; update(dt, simT); } }, info: () => renderer.info.render, S, camera, updateCamera, THREE, scene, player, piles, world, unlock, get pads() { return pads; }, customers, setPlaying: (v) => { playing = v; } };

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
