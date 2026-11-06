// Orchard Bakery: the bigger farm. New land to the east (hens, dairy cows) and west
// (strawberries, bees), the produce they give, what you bake from it, and the order wagon.
// Everything is modelled in code with soft colour variation so it reads as real.
import * as THREE from 'three';
import {
  rand, fbm, noise3, paint, displace, at, mesh, merge, canvasTex, speckle, mats,
  makeBasket, makeBarrel, makeCrate, makeTable, makeJam
} from './models.js';

const V3 = THREE.Vector3;
const C = (h) => new THREE.Color(h);
const clamp01 = (x) => THREE.MathUtils.clamp(x, 0, 1);
const std = (o) => new THREE.MeshStandardMaterial(o);
const GEO = {}, MAT = {};

// ---------- textures ----------
function berryTex() {
  return canvasTex(128, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#b3121c'); g.addColorStop(0.75, '#d8282c'); g.addColorStop(1, '#e8a080');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 500, ['#7e0a14', '#f0504a'], [2, 5], [0.1, 0.3]);
    for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) { // seeds sit in little dimples
      const x = (col + (row % 2) * 0.5) * w / 12, y = h - (row + 0.6) * h / 10;
      c.fillStyle = 'rgba(110,10,16,.55)'; c.beginPath(); c.ellipse(x, y, 3.2, 4.2, 0, 0, 7); c.fill();
      c.fillStyle = '#f0cf5a'; c.beginPath(); c.ellipse(x, y - 0.6, 1.5, 2.3, 0, 0, 7); c.fill();
    }
  });
}
function combTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#c98a1c'; c.fillRect(0, 0, w, h);
    const r = rand(17), R = 9;
    for (let row = 0; row < 18; row++) for (let col = 0; col < 16; col++) {
      const x = col * R * 1.75 + (row % 2) * R * 0.87, y = row * R * 1.5;
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } c.closePath();
      const t = r(); c.fillStyle = t < 0.6 ? `rgb(${238 + r() * 12},${206 + r() * 20},${120 + r() * 30})` : `rgb(${200 + r() * 30},${125 + r() * 30},${20 + r() * 20})`;
      c.fill(); c.strokeStyle = 'rgba(120,70,10,.6)'; c.lineWidth = 1.6; c.stroke();
    }
  }, [1, 1]);
}
function labelTex(text, bg, fg = '#5a3a1c', sub) {
  return canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = fg; c.globalAlpha = 0.5; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16); c.globalAlpha = 1;
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 40px Georgia, serif'; c.fillText(text, w / 2, sub ? h / 2 - 10 : h / 2 + 2);
    if (sub) { c.font = 'italic 22px Georgia, serif'; c.fillText(sub, w / 2, h / 2 + 24); }
  });
}
function strawTex() {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#c9a85a'; c.fillRect(0, 0, w, h);
    const r = rand(4);
    for (let i = 0; i < 900; i++) { c.strokeStyle = r() > 0.5 ? 'rgba(240,215,140,.7)' : 'rgba(140,105,50,.6)'; c.lineWidth = 1; const x = r() * w, y = r() * h, a = r() * 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 4); c.stroke(); }
  }, [4, 1]);
}
function plankTex(color) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    const r = rand(color.length * 13);
    for (let x = 0; x < w; x += 32) {
      c.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`; c.fillRect(x, 0, 32, h);
      c.fillStyle = 'rgba(40,20,10,.45)'; c.fillRect(x, 0, 2, h);
    }
    speckle(c, w, h, 1400, ['#000', '#fff'], [1, 2], [0.04, 0.12]);
  }, [3, 1]);
}
export function farmMats() {
  if (MAT.berry) return MAT;
  MAT.berry = new THREE.MeshPhysicalMaterial({ map: berryTex(), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  MAT.calyx = std({ color: 0x4f8f36, roughness: 0.6, side: THREE.DoubleSide });
  MAT.egg = std({ vertexColors: true, roughness: 0.55 });
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
  MAT.milk = std({ color: 0xfdfbf4, roughness: 0.25 });
  MAT.foil = std({ color: 0xd8dde2, metalness: 0.9, roughness: 0.3 });
  MAT.comb = std({ map: combTex(), roughness: 0.3 });
  MAT.pastry = std({ vertexColors: true, roughness: 0.66 });
  MAT.custard = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.5 });
  MAT.butter = std({ color: 0xf5dc78, roughness: 0.42 });
  MAT.paper = std({ map: labelTex('Butter', '#f4efe2', '#3f6b45', 'fresh churned'), roughness: 0.85 });
  MAT.paperPlain = std({ color: 0xf4efe2, roughness: 0.85 });
  MAT.cream = std({ color: 0xfbf3df, roughness: 0.5 });
  MAT.honey = new THREE.MeshPhysicalMaterial({ color: 0xd8861a, roughness: 0.12, clearcoat: 1, emissive: 0x4a2400, emissiveIntensity: 0.25 });
  MAT.honeyLabel = std({ map: labelTex('Honey', '#2f3a33', '#f2c94c'), roughness: 0.7 });
  MAT.lid = std({ color: 0xd9a530, metalness: 0.85, roughness: 0.3 });
  MAT.feather = std({ vertexColors: true, roughness: 0.92 });
  MAT.comb2 = std({ color: 0xd2342c, roughness: 0.6 });
  MAT.beak = std({ color: 0xe8a63a, roughness: 0.5 });
  MAT.eye = std({ color: 0x15100c, roughness: 0.2 });
  MAT.hide = std({ vertexColors: true, roughness: 0.85 });
  MAT.muzzle = std({ color: 0xd9a090, roughness: 0.6 });
  MAT.horn = std({ color: 0xe9dfc8, roughness: 0.5 });
  MAT.hoof = std({ color: 0x2a221c, roughness: 0.6 });
  MAT.redBarn = std({ map: plankTex('#a8402f'), roughness: 0.85 });
  MAT.coop = std({ map: plankTex('#c9a072'), roughness: 0.85 });
  MAT.straw = std({ map: strawTex(), roughness: 1 });
  MAT.water = new THREE.MeshPhysicalMaterial({ color: 0x4f8a96, roughness: 0.06, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88 });
  MAT.metal = std({ color: 0xb8bcc0, metalness: 0.85, roughness: 0.35 });
  return MAT;
}

// ---------- produce ----------
function berryGeo() {
  if (GEO.berry) return GEO.berry;
  // A ripe strawberry: rounded shoulders tapering to a soft point, with a leafy green cap.
  const prof = [[0, -0.07], [0.012, -0.066], [0.028, -0.048], [0.043, -0.02], [0.052, 0.008], [0.053, 0.03], [0.044, 0.046], [0.026, 0.055], [0.008, 0.058], [0, 0.058]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 22);
  displace(body, (v) => { const a = Math.atan2(v.z, v.x); const k = 1 + Math.sin(a * 3 + 0.4) * 0.05 + noise3(v.x * 40, v.y * 40, v.z * 40) * 0.03; v.x *= k; v.z *= k; });
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Shape(); s.moveTo(0, -0.008); s.quadraticCurveTo(0.024, 0.01, 0.05, 0); s.quadraticCurveTo(0.024, -0.016, 0, -0.008);
    const a = i / 7 * Math.PI * 2;
    leaves.push(at(new THREE.ShapeGeometry(s, 4), 0, 0.058, 0, 0, -a, -0.45));
  }
  const cap = merge([...leaves, at(new THREE.CylinderGeometry(0.004, 0.006, 0.03, 5), 0, 0.072, 0)]);
  GEO.berry = { body, cap };
  return GEO.berry;
}
export function makeBerry() {
  const g = berryGeo(), m = farmMats(), grp = new THREE.Group();
  grp.add(mesh(g.body, m.berry), mesh(g.cap, m.calyx, false));
  grp.userData.kind = 'berry';
  return grp;
}
export function makeEgg() {
  if (!GEO.egg) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, y = -Math.cos(Math.PI * t); pts.push(new V3(Math.sin(Math.PI * t) * (1 - 0.13 * y) * 0.05, y * 0.064 + 0.064, 0)); }
    GEO.egg = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, p.y)), 22);
    paint(GEO.egg, (x, y, z, c) => { c.copy(C(0xd9a878)).lerp(C(0xf3dcc0), clamp01(0.5 + fbm(x * 40, y * 40, z * 40) * 0.8)); if (noise3(x * 160, y * 160, z * 160) > 0.62) c.lerp(C(0x9a6a44), 0.5); });
  }
  const m = mesh(GEO.egg, farmMats().egg); const grp = new THREE.Group(); grp.add(m); grp.userData.kind = 'egg';
  return grp;
}
export function makeMilk() {
  if (!GEO.bottle) {
    const prof = [[0, 0], [0.05, 0], [0.056, 0.008], [0.058, 0.16], [0.052, 0.2], [0.034, 0.24], [0.03, 0.27], [0.034, 0.28], [0.032, 0.29]].map(([r, y]) => new THREE.Vector2(r, y));
    GEO.bottle = new THREE.LatheGeometry(prof, 24);
    const fill = [[0, 0.004], [0.052, 0.004], [0.054, 0.16], [0.048, 0.2], [0.03, 0.24], [0.026, 0.262], [0, 0.262]].map(([r, y]) => new THREE.Vector2(r, y));
    GEO.milk = new THREE.LatheGeometry(fill, 24);
    GEO.foil = at(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 20), 0, 0.29, 0);
  }
  const m = farmMats(), grp = new THREE.Group();
  grp.add(mesh(GEO.milk, m.milk), mesh(GEO.bottle, m.glass, false, false), mesh(GEO.foil, m.foil, false));
  grp.userData.kind = 'milk';
  return grp;
}
export function makeComb() {
  // A honey frame: a wooden frame filled with comb, laid flat.
  if (!GEO.comb) {
    GEO.comb = at(new THREE.BoxGeometry(0.3, 0.028, 0.2), 0, 0.016, 0);
    GEO.frame = merge([at(new THREE.BoxGeometry(0.36, 0.035, 0.02), 0, 0.018, 0.105), at(new THREE.BoxGeometry(0.36, 0.035, 0.02), 0, 0.018, -0.105), at(new THREE.BoxGeometry(0.02, 0.035, 0.2), 0.16, 0.018, 0), at(new THREE.BoxGeometry(0.02, 0.035, 0.2), -0.16, 0.018, 0)]);
  }
  const grp = new THREE.Group(); grp.add(mesh(GEO.comb, farmMats().comb), mesh(GEO.frame, mats().wood)); grp.userData.kind = 'comb';
  return grp;
}
function fluted(R, H, flutes = 16) {
  const prof = [[0, 0], [R * 0.8, 0], [R * 0.9, 0.01], [R, H * 0.8], [R * 1.05, H], [R * 0.9, H * 1.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 48);
  displace(g, (v) => { const a = Math.atan2(v.z, v.x), k = 1 + Math.max(0, Math.sin(a * flutes)) * 0.06 * clamp01(v.y / H * 2); v.x *= k; v.z *= k; });
  paint(g, (x, y, z, c) => c.copy(C(0xe9b46a)).lerp(C(0x9a5a22), clamp01(0.3 + y / H * 0.5 + fbm(x * 30, y * 30, z * 30) * 0.6)));
  return g;
}
export function makeCustard() {
  if (!GEO.custard) {
    GEO.custShell = fluted(0.085, 0.045, 14);
    const top = new THREE.CircleGeometry(0.08, 28); top.rotateX(-Math.PI / 2); top.translate(0, 0.043, 0);
    paint(top, (x, y, z, c) => { c.copy(C(0xf6d77a)).lerp(C(0xe0a446), clamp01(Math.hypot(x, z) / 0.08 * 0.6 + fbm(x * 50, 0, z * 50) * 0.5)); if (noise3(x * 300, 0, z * 300) > 0.55) c.lerp(C(0x8a4a1c), 0.6); });
    GEO.custTop = top;
  }
  const m = farmMats(), grp = new THREE.Group();
  grp.add(mesh(GEO.custShell, m.pastry), mesh(GEO.custTop, m.custard, false));
  grp.userData.kind = 'custard';
  return grp;
}
export function makeButter() {
  if (!GEO.butter) {
    const b = new THREE.BoxGeometry(0.15, 0.07, 0.095, 6, 3, 4);
    displace(b, (v) => { const s = 0.006; v.x -= Math.sign(v.x) * s * (Math.abs(v.y) > 0.03 ? 1 : 0); v.z -= Math.sign(v.z) * s * (Math.abs(v.y) > 0.03 ? 1 : 0); });
    b.translate(0, 0.036, 0); GEO.butter = b;
    GEO.wrap = at(new THREE.BoxGeometry(0.156, 0.05, 0.1), 0, 0.025, 0);
    GEO.string = merge([at(new THREE.BoxGeometry(0.158, 0.006, 0.006), 0, 0.072, 0), at(new THREE.BoxGeometry(0.006, 0.006, 0.098), 0, 0.072, 0)]);
  }
  const m = farmMats(), grp = new THREE.Group();
  const wrapMats = [m.paperPlain, m.paperPlain, m.paperPlain, m.paperPlain, m.paper, m.paper];
  grp.add(mesh(GEO.butter, m.butter), mesh(GEO.wrap, wrapMats), mesh(GEO.string, std({ color: 0xc8553d, roughness: 0.8 }), false));
  grp.userData.kind = 'butter';
  return grp;
}
export function makeTart() {
  if (!GEO.tart) {
    GEO.tartShell = fluted(0.19, 0.05, 22);
    const cream = new THREE.CylinderGeometry(0.175, 0.175, 0.02, 32); cream.translate(0, 0.045, 0); GEO.tartCream = cream;
    const { body, cap } = berryGeo(), bs = [];
    const ring = (n, rad, y) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; bs.push(at(body.clone(), Math.cos(a) * rad, y, Math.sin(a) * rad, Math.PI / 2 - 0.5, -a + Math.PI / 2, 0, 0.9)); } };
    ring(10, 0.13, 0.07); ring(6, 0.065, 0.08); bs.push(at(body.clone(), 0, 0.095, 0, 0, 0, 0, 0.95));
    GEO.tartBerries = merge(bs); GEO.tartCap = at(cap.clone(), 0, 0.15, 0, 0, 0, 0, 0.8);
  }
  const m = farmMats(), grp = new THREE.Group();
  grp.add(mesh(GEO.tartShell, m.pastry), mesh(GEO.tartCream, m.cream, false), mesh(GEO.tartBerries, m.berry), mesh(GEO.tartCap, m.calyx, false));
  grp.userData.kind = 'tart';
  return grp;
}
export function makeHoney() {
  if (!GEO.hjar) {
    const prof = [[0, 0], [0.07, 0], [0.085, 0.02], [0.09, 0.08], [0.082, 0.15], [0.06, 0.17], [0.062, 0.185]].map(([r, y]) => new THREE.Vector2(r, y));
    GEO.hjar = new THREE.LatheGeometry(prof, 26);
    const fill = [[0, 0.006], [0.068, 0.006], [0.081, 0.022], [0.085, 0.08], [0.078, 0.145], [0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y));
    GEO.hfill = new THREE.LatheGeometry(fill, 26);
    GEO.hlid = at(new THREE.CylinderGeometry(0.066, 0.066, 0.03, 24), 0, 0.195, 0);
    GEO.hlabel = new THREE.CylinderGeometry(0.0905, 0.0905, 0.05, 24, 1, true, -1, 2); GEO.hlabel.translate(0, 0.08, 0);
  }
  const m = farmMats(), grp = new THREE.Group();
  grp.add(mesh(GEO.hfill, m.honey), mesh(GEO.hjar, m.glass, false, false), mesh(GEO.hlid, m.lid), mesh(GEO.hlabel, m.honeyLabel, false));
  grp.userData.kind = 'honey';
  return grp;
}
export function makeFarmItem(kind) {
  return ({ berry: makeBerry, egg: makeEgg, milk: makeMilk, comb: makeComb, custard: makeCustard, butter: makeButter, tart: makeTart, honey: makeHoney })[kind]?.();
}

// ---------- animals ----------
export function makeChicken(seed) {
  const r = rand(seed), m = farmMats(), g = new THREE.Group();
  const brown = r() < 0.6;
  const base = C(brown ? 0xa9582c : 0xf4eee2), dark = C(brown ? 0x6a3218 : 0xd6cdbb), light = C(brown ? 0xcf8a4a : 0xffffff);
  const feather = (geo) => paint(geo, (x, y, z, c) => c.copy(base).lerp(dark, clamp01(0.35 - y * 2 + fbm(x * 25, y * 25, z * 25) * 0.6)).lerp(light, clamp01(y * 1.2 - 0.35)));
  const parts = [
    feather(at(new THREE.SphereGeometry(0.15, 18, 14), 0, 0.27, 0, 0, 0, 0, new V3(0.88, 0.85, 1.25))),
    feather(at(new THREE.SphereGeometry(0.09, 14, 10), 0, 0.36, 0.11, -0.3, 0, 0, new V3(0.9, 1.25, 0.9))),
    paint(at(new THREE.SphereGeometry(0.1, 12, 8), 0.12, 0.28, -0.02, 0, 0, 0, new V3(0.3, 0.68, 1.2)), (x, y, z, c) => c.copy(dark)),
    paint(at(new THREE.SphereGeometry(0.1, 12, 8), -0.12, 0.28, -0.02, 0, 0, 0, new V3(0.3, 0.68, 1.2)), (x, y, z, c) => c.copy(dark))
  ];
  for (let i = 0; i < 4; i++) parts.push(paint(at(new THREE.SphereGeometry(0.075, 10, 8), (i - 1.5) * 0.03, 0.41, -0.17, -0.7 + i * 0.05, 0, (i - 1.5) * 0.2, new V3(0.28, 1.15, 0.6)), (x, y, z, c) => c.copy(dark).lerp(C(0x2a1a10), brown ? 0.4 : 0)));
  const body = new THREE.Group(); g.add(body);
  body.add(mesh(merge(parts), m.feather));
  const head = new THREE.Group(); head.position.set(0, 0.44, 0.15); body.add(head);
  head.add(mesh(paint(at(new THREE.SphereGeometry(0.062, 14, 10), 0, 0.02, 0.02), (x, y, z, c) => c.copy(base).lerp(light, 0.3)), m.feather));
  for (let i = 0; i < 3; i++) head.add(mesh(at(new THREE.SphereGeometry(0.024 - Math.abs(i - 1) * 0.004, 8, 6), 0, 0.085 + (i === 1 ? 0.01 : 0), -0.01 + i * 0.022), m.comb2, false));
  head.add(mesh(at(new THREE.SphereGeometry(0.018, 8, 6), 0, -0.025, 0.07, 0, 0, 0, new V3(0.8, 1.4, 0.7)), m.comb2, false));
  head.add(mesh(at(new THREE.ConeGeometry(0.016, 0.045, 8), 0, 0.015, 0.095, Math.PI / 2), m.beak, false));
  for (const s of [-1, 1]) head.add(mesh(at(new THREE.SphereGeometry(0.009, 6, 5), s * 0.045, 0.035, 0.05), m.eye, false));
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.05, 0.16, 0.01); g.add(leg);
    leg.add(mesh(at(new THREE.CylinderGeometry(0.01, 0.012, 0.16, 6), 0, -0.08, 0), m.beak, false));
    for (const a of [-0.5, 0, 0.5]) leg.add(mesh(at(new THREE.BoxGeometry(0.01, 0.008, 0.06), Math.sin(a) * 0.02, -0.158, 0.025, 0, a, 0), m.beak, false));
    legs.push(leg);
  }
  const s = 0.95 + r() * 0.15; g.scale.setScalar(s);
  g.userData = { body, head, legs, phase: r() * 6, mode: 'idle', t: r() * 2, target: new V3(), speed: 0 };
  return g;
}
export function makeCow(seed) {
  const r = rand(seed), m = farmMats(), g = new THREE.Group();
  const holstein = r() < 0.55;
  const off = r() * 10;
  const coat = (geo) => paint(geo, (x, y, z, c) => {
    if (holstein) c.set(fbm(x * 1.7 + off, y * 1.7, z * 1.7 - off) > 0.06 ? 0x1f1a18 : 0xf6f2ea);
    else c.copy(C(0xb57a48)).lerp(C(0x7a4a2a), clamp01(y - 0.9 + fbm(x * 3, y * 3, z * 3) * 0.6)).lerp(C(0xe8cfa8), clamp01(0.7 - y));
  });
  const body = coat(at(new THREE.CapsuleGeometry(0.38, 0.9, 8, 20), 0, 1.0, 0, Math.PI / 2, 0, 0, new V3(0.95, 1, 1.05)));
  const neck = coat(at(new THREE.SphereGeometry(0.3, 16, 12), 0, 1.1, 0.68, 0.4, 0, 0, new V3(0.85, 1, 1.1)));
  g.add(mesh(merge([body, neck]), m.hide));
  g.add(mesh(at(new THREE.SphereGeometry(0.13, 14, 10), 0, 0.66, -0.3, 0, 0, 0, new V3(1.1, 0.8, 1.2)), m.muzzle));
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.86); g.add(head);
  head.add(mesh(coat(at(new THREE.SphereGeometry(0.2, 18, 14), 0, 0, 0.12, 0.35, 0, 0, new V3(0.78, 0.82, 1.3))), m.hide));
  head.add(mesh(at(new THREE.SphereGeometry(0.13, 16, 12), 0, -0.14, 0.33, 0.2, 0, 0, new V3(1.05, 0.8, 0.85)), m.muzzle));
  for (const s of [-1, 1]) {
    head.add(mesh(at(new THREE.SphereGeometry(0.018, 6, 5), s * 0.045, -0.13, 0.43), m.hoof, false));
    head.add(mesh(at(new THREE.SphereGeometry(0.022, 8, 6), s * 0.12, 0.06, 0.2), m.eye, false));
    head.add(mesh(coat(at(new THREE.SphereGeometry(0.08, 10, 8), s * 0.21, 0.08, 0.02, 0, 0, s * 0.5, new V3(1.2, 0.45, 0.7))), m.hide));
    head.add(mesh(at(new THREE.ConeGeometry(0.025, 0.1, 8), s * 0.1, 0.18, 0.02, 0, 0, -s * 0.6), m.horn, false));
  }
  const legs = [];
  for (const [x, z] of [[-0.22, 0.5], [0.22, 0.5], [-0.22, -0.5], [0.22, -0.5]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.82, z); g.add(leg);
    leg.add(mesh(coat(at(new THREE.CylinderGeometry(0.075, 0.055, 0.76, 10), 0, -0.38, 0)), m.hide));
    leg.add(mesh(at(new THREE.CylinderGeometry(0.06, 0.065, 0.07, 10), 0, -0.79, 0), m.hoof));
    legs.push(leg);
  }
  const tail = new THREE.Group(); tail.position.set(0, 1.25, -0.82); g.add(tail);
  tail.add(mesh(at(new THREE.CylinderGeometry(0.015, 0.02, 0.75, 6), 0, -0.36, -0.02), m.hide));
  tail.add(mesh(at(new THREE.SphereGeometry(0.05, 8, 6), 0, -0.74, -0.02, 0, 0, 0, new V3(1, 1.6, 1)), holstein ? m.hoof : m.hide));
  g.scale.setScalar(0.92 + r() * 0.12);
  g.userData = { head, legs, tail, phase: r() * 6, mode: 'graze', t: 2 + r() * 4, target: new V3(), speed: 0 };
  return g;
}
function makeDuck(seed) {
  const g = new THREE.Group(), m = farmMats();
  const body = paint(at(new THREE.SphereGeometry(0.14, 14, 10), 0, 0.06, 0, 0, 0, 0, new V3(0.85, 0.6, 1.3)), (x, y, z, c) => c.copy(C(0x8a6a4a)).lerp(C(0xd8c8a8), clamp01(-y * 6 + 0.4)));
  g.add(mesh(body, m.feather));
  const head = paint(at(new THREE.SphereGeometry(0.065, 12, 10), 0, 0.2, 0.14), (x, y, z, c) => c.set(seed % 2 ? 0x2f6a4a : 0x8a6a4a));
  g.add(mesh(head, m.feather));
  g.add(mesh(at(new THREE.BoxGeometry(0.04, 0.015, 0.06), 0, 0.19, 0.22), m.beak, false));
  g.userData = { a: seed * 2.1, r: 0.9 + (seed % 3) * 0.35, sp: 0.18 + (seed % 2) * 0.08 };
  return g;
}
function animateChicken(ch, dt, area) {
  const u = ch.userData; u.t -= dt;
  if (u.t <= 0) {
    const k = Math.random();
    if (k < 0.45) { u.mode = 'walk'; u.target.set(area[0] + Math.random() * (area[2] - area[0]), 0, area[1] + Math.random() * (area[3] - area[1])); u.t = 4; }
    else if (k < 0.85) { u.mode = 'peck'; u.t = 1.2 + Math.random() * 1.5; }
    else { u.mode = 'idle'; u.t = 1 + Math.random() * 2; }
  }
  let sp = 0;
  if (u.mode === 'walk') {
    const d = new V3().subVectors(u.target, ch.position); d.y = 0; const L = d.length();
    if (L < 0.08) { u.mode = 'peck'; u.t = 1.2; } else {
      sp = 0.55; ch.position.addScaledVector(d.normalize(), Math.min(L, sp * dt));
      let a = Math.atan2(d.x, d.z) - ch.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); ch.rotation.y += a * Math.min(1, dt * 8);
    }
  }
  u.phase += dt * (sp > 0 ? 14 : 0);
  u.legs[0].rotation.x = Math.sin(u.phase) * 0.6 * (sp > 0 ? 1 : 0); u.legs[1].rotation.x = -u.legs[0].rotation.x;
  u.body.position.y = sp > 0 ? Math.abs(Math.sin(u.phase)) * 0.015 : 0;
  const peck = u.mode === 'peck' ? Math.max(0, Math.sin(performance.now() / 1000 * 9 + u.phase)) : 0;
  u.body.rotation.x = peck * 0.55;
  u.head.position.z = 0.15 + (sp > 0 ? Math.sin(u.phase * 2) * 0.02 : 0);
}
function animateCow(cow, dt, area, time) {
  const u = cow.userData; u.t -= dt;
  if (u.t <= 0) {
    if (u.mode === 'graze') { u.mode = 'walk'; u.target.set(area[0] + Math.random() * (area[2] - area[0]), 0, area[1] + Math.random() * (area[3] - area[1])); u.t = 12; }
    else { u.mode = 'graze'; u.t = 5 + Math.random() * 7; }
  }
  let sp = 0;
  if (u.mode === 'walk') {
    const d = new V3().subVectors(u.target, cow.position); d.y = 0; const L = d.length();
    let a = Math.atan2(d.x, d.z) - cow.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    cow.rotation.y += a * Math.min(1, dt * 1.2);
    if (L < 0.2) u.t = 0; else if (Math.abs(a) < 0.8) { sp = 0.45; cow.position.addScaledVector(new V3(Math.sin(cow.rotation.y), 0, Math.cos(cow.rotation.y)), sp * dt); }
  }
  u.phase += dt * sp * 6;
  u.legs.forEach((l, i) => { l.rotation.x = Math.sin(u.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.3 * (sp > 0 ? 1 : 0); });
  const down = u.mode === 'graze' ? 1 : 0;
  u.head.rotation.x += ((down ? 0.9 + Math.sin(time * 2 + u.phase) * 0.06 : 0) - u.head.rotation.x) * Math.min(1, dt * 2);
  u.tail.rotation.z = Math.sin(time * 1.7 + u.phase) * 0.25; u.tail.rotation.x = 0.15 + Math.sin(time * 1.1) * 0.08;
}

// ---------- buildings and plots ----------
function shed(H, w, d, h, roofColor, wallMat) {
  // Simple timber building with plank walls and a clay shingle roof.
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), 0, 0.1, 0), m.stone));
  g.add(mesh(at(new THREE.BoxGeometry(w, h, d), 0, 0.2 + h / 2, 0), wallMat));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(mesh(at(new THREE.BoxGeometry(0.14, h, 0.14), x, 0.2 + h / 2, z), m.beam));
  const rise = d * 0.38;
  const gs = new THREE.Shape(); gs.moveTo(-d / 2, 0); gs.lineTo(d / 2, 0); gs.lineTo(0, rise); gs.lineTo(-d / 2, 0);
  for (const s of [-1, 1]) { const gm = mesh(new THREE.ShapeGeometry(gs), wallMat); gm.rotation.y = s * Math.PI / 2; gm.position.set(s * (w / 2 + 0.001), 0.2 + h, 0); g.add(gm); }
  const roof = H.shingleRoof(w, d, rise, roofColor); roof.position.y = 0.2 + h; g.add(roof);
  return g;
}
function makeHenHouse(H) {
  const g = new THREE.Group(), m = mats(), fm = farmMats();
  const coop = new THREE.Group(); coop.position.y = 0.55; g.add(coop);
  for (const [x, z] of [[-0.9, -0.65], [0.9, -0.65], [-0.9, 0.65], [0.9, 0.65]]) g.add(mesh(at(new THREE.BoxGeometry(0.12, 0.6, 0.12), x, 0.3, z), m.beam));
  coop.add(mesh(at(new THREE.BoxGeometry(2.0, 1.2, 1.5), 0, 0.6, 0), fm.coop));
  const rs = new THREE.Shape(); rs.moveTo(-0.75, 0); rs.lineTo(0.75, 0); rs.lineTo(0, 0.6); rs.lineTo(-0.75, 0);
  for (const s of [-1, 1]) { const gm = mesh(new THREE.ShapeGeometry(rs), fm.coop); gm.rotation.y = s * Math.PI / 2; gm.position.set(s * 1.001, 1.2, 0); coop.add(gm); }
  const roof = H.shingleRoof(2.0, 1.5, 0.6, 0xb5462f); roof.position.y = 1.2; coop.add(roof);
  coop.add(mesh(at(new THREE.BoxGeometry(0.42, 0.52, 0.04), 0.45, 0.42, 0.77), m.dark, false));
  coop.add(mesh(at(new THREE.BoxGeometry(0.5, 0.06, 0.06), 0.45, 0.71, 0.78), m.white), mesh(at(new THREE.BoxGeometry(0.06, 0.58, 0.06), 0.18, 0.42, 0.78), m.white), mesh(at(new THREE.BoxGeometry(0.06, 0.58, 0.06), 0.72, 0.42, 0.78), m.white));
  // ramp with little cleats
  g.add(mesh(at(new THREE.BoxGeometry(0.34, 0.03, 1.1), 0.45, 0.32, 1.25, 0.52, 0, 0), m.wood));
  for (let i = 0; i < 5; i++) g.add(mesh(at(new THREE.BoxGeometry(0.3, 0.02, 0.02), 0.45, 0.12 + i * 0.1, 1.67 - i * 0.18, 0.52, 0, 0), m.woodDark, false));
  // nest boxes on the side with a hinged lid
  coop.add(mesh(at(new THREE.BoxGeometry(0.5, 0.45, 1.1), -1.22, 0.3, 0), fm.coop));
  coop.add(mesh(at(new THREE.BoxGeometry(0.58, 0.04, 1.18), -1.24, 0.56, 0, 0, 0, 0.3), m.woodDark));
  coop.add(mesh(at(new THREE.PlaneGeometry(0.7, 0.24), -0.4, 1.0, 0.76), std({ map: labelTex('Hens', '#7a4a2e', '#fbf1df'), roughness: 0.6 }), false));
  return g;
}
function makeNestCrate() {
  const g = new THREE.Group(); const t = makeTable(1.1, 0.7, 0.7); g.add(t);
  g.add(mesh(at(new THREE.BoxGeometry(0.9, 0.08, 0.55), 0, 0.74, 0), farmMats().straw));
  for (let i = 0; i < 9; i++) { const s = mesh(at(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 3), (Math.random() - 0.5) * 0.9, 0.78, (Math.random() - 0.5) * 0.55, Math.random() * 3, 0, Math.PI / 2), farmMats().straw, false); g.add(s); }
  return g;
}
function makeRailFence(x0, z0, x1, z1, gapAt) {
  // post-and-rail fence around a rectangle
  const g = new THREE.Group(), m = mats();
  const side = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6)), ang = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) { const t = i / n; g.add(mesh(at(new THREE.BoxGeometry(0.12, 1.1, 0.12), ax + (bx - ax) * t, 0.55, az + (bz - az) * t), m.woodDark)); }
    for (const y of [0.45, 0.9]) { const r = mesh(new THREE.BoxGeometry(0.06, 0.1, L), m.wood); r.position.set((ax + bx) / 2, y, (az + bz) / 2); r.rotation.y = ang; g.add(r); }
  };
  side(x0, z0, x1, z0); side(x0, z1, x1, z1); side(x0, z0, x0, z1); side(x1, z0, x1, z1);
  return g;
}
function makeBarn(H) {
  const fm = farmMats(), m = mats();
  const g = shed(H, 4.4, 3.4, 2.4, 0x6f6a66, fm.redBarn);
  const dz = 1.71;
  g.add(mesh(at(new THREE.BoxGeometry(1.9, 1.9, 0.05), 0, 1.15, dz), fm.redBarn));
  for (const s of [-1, 1]) {
    g.add(mesh(at(new THREE.BoxGeometry(0.08, 1.9, 0.06), s * 0.95, 1.15, dz + 0.03), m.white), mesh(at(new THREE.BoxGeometry(0.06, 2.6, 0.06), s * 0.47, 1.15, dz + 0.04, 0, 0, s * 0.78), m.white));
  }
  g.add(mesh(at(new THREE.BoxGeometry(1.95, 0.08, 0.06), 0, 2.1, dz + 0.03), m.white), mesh(at(new THREE.BoxGeometry(1.95, 0.08, 0.06), 0, 0.22, dz + 0.03), m.white));
  g.add(mesh(at(new THREE.BoxGeometry(0.7, 0.6, 0.06), 0, 2.85, dz - 0.25), m.dark, false));
  g.add(mesh(at(new THREE.PlaneGeometry(1.2, 0.36), 1.55, 2.0, dz + 0.04), std({ map: labelTex('Dairy', '#f4efe2', '#a8402f'), roughness: 0.6 }), false));
  for (const [x, z] of [[-2.6, 1.0], [-2.7, 0.1]]) { const hay = mesh(at(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 18), 0, 0.42, 0, Math.PI / 2, 0.3, 0), fm.straw); hay.position.set(x, 0, z); g.add(hay); }
  return g;
}
function makeMilkStand() {
  const g = new THREE.Group(), m = mats(), fm = farmMats();
  g.add(mesh(at(new THREE.BoxGeometry(1.2, 0.7, 0.7), 0, 0.35, 0), m.wood));
  g.add(mesh(at(new THREE.BoxGeometry(1.3, 0.05, 0.8), 0, 0.72, 0), m.woodDark));
  // two old milk churns beside it
  for (const x of [-0.95, 0.95]) {
    const prof = [[0, 0], [0.17, 0], [0.18, 0.05], [0.18, 0.42], [0.12, 0.55], [0.1, 0.62], [0.12, 0.64], [0, 0.66]].map(([r, y]) => new THREE.Vector2(r, y));
    g.add(mesh(at(new THREE.LatheGeometry(prof, 20), x, 0, 0.1), fm.metal));
  }
  return g;
}
function makeShelter(H, roofColor, signText, signBg) {
  const g = new THREE.Group(), m = mats();
  for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) g.add(mesh(at(new THREE.BoxGeometry(0.14, 2.3, 0.14), x, 1.15, z), m.beam));
  const roof = H.shingleRoof(2.9, 2.0, 0.8, roofColor); roof.position.y = 2.3; g.add(roof);
  g.add(mesh(at(new THREE.BoxGeometry(2.3, 0.08, 0.9), 0, 0.8, -0.4), m.wood));
  for (const x of [-1.05, 1.05]) g.add(mesh(at(new THREE.BoxGeometry(0.08, 0.8, 0.8), x, 0.4, -0.4), m.woodDark));
  g.add(mesh(at(new THREE.PlaneGeometry(1.6, 0.5), 0, 2.15, 1.02), std({ map: H.signTex(signText, signBg), roughness: 0.6 }), false));
  return g;
}
function makeChurnHouse(H) {
  const g = makeShelter(H, 0x8a5a3c, 'Butter', '#3f6b45'), m = mats();
  // a tall wooden butter churn with a plunger that works while there's milk
  const prof = []; for (let i = 0; i <= 8; i++) { const y = i / 8; prof.push(new THREE.Vector2(0.26 - y * 0.06 + Math.sin(y * Math.PI) * 0.02, y * 0.9)); }
  g.add(mesh(at(new THREE.LatheGeometry(prof, 20), -0.5, 0.84, -0.4), m.woodDark));
  for (const y of [0.12, 0.5, 0.82]) g.add(mesh(at(new THREE.TorusGeometry(0.255 - y / 0.9 * 0.06 + 0.01, 0.012, 6, 20), -0.5, 0.84 + y, -0.4, Math.PI / 2), m.iron, false));
  const plunger = new THREE.Group(); plunger.position.set(-0.5, 1.7, -0.4); g.add(plunger);
  plunger.add(mesh(at(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), 0, 0.2, 0), m.wood));
  plunger.add(mesh(at(new THREE.SphereGeometry(0.05, 8, 6), 0, 0.66, 0), m.wood));
  // butter pats waiting on a board, and a crock
  g.add(mesh(at(new THREE.BoxGeometry(0.6, 0.03, 0.4), 0.55, 0.86, -0.4), m.wood));
  for (let i = 0; i < 3; i++) { const b = makeButter(); b.position.set(0.38 + i * 0.17, 0.88, -0.4); g.add(b); }
  g.userData = { plunger, smokeAt: null };
  return g;
}
function makeHoneyHouse(H) {
  const g = makeShelter(H, 0xa8743a, 'Honey', '#7a5a1c'), m = mats(), fm = farmMats();
  // a hand-cranked extractor drum
  const drum = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.34, 0.04], [0.34, 0.6], [0.32, 0.62]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
  g.add(mesh(at(drum, -0.5, 0.84, -0.4), fm.metal));
  const crank = new THREE.Group(); crank.position.set(-0.5, 1.5, -0.4); g.add(crank);
  crank.add(mesh(at(new THREE.BoxGeometry(0.4, 0.03, 0.03), 0.18, 0, 0), m.iron), mesh(at(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), 0.36, 0.07, 0), m.wood));
  for (let i = 0; i < 6; i++) { const j = makeHoney(); j.position.set(0.25 + (i % 3) * 0.2, 0.84, -0.6 + Math.floor(i / 3) * 0.24); g.add(j); }
  g.userData = { crank, smokeAt: null };
  return g;
}
function makeHive(color) {
  const g = new THREE.Group(), m = mats();
  const paintMat = std({ color, roughness: 0.75 });
  g.add(mesh(at(new THREE.BoxGeometry(0.62, 0.3, 0.7), 0, 0.15, 0), m.woodDark));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(at(new THREE.BoxGeometry(0.54, 0.25, 0.62), 0, 0.43 + i * 0.27, 0), paintMat));
    g.add(mesh(at(new THREE.BoxGeometry(0.56, 0.02, 0.64), 0, 0.31 + i * 0.27, 0), m.beam, false));
  }
  g.add(mesh(at(new THREE.BoxGeometry(0.66, 0.08, 0.76), 0, 1.16, 0), farmMats().metal));
  g.add(mesh(at(new THREE.BoxGeometry(0.34, 0.03, 0.02), 0, 0.34, 0.315), m.dark, false));
  g.add(mesh(at(new THREE.BoxGeometry(0.4, 0.025, 0.14), 0, 0.31, 0.38, 0.2, 0, 0), m.wood));
  return g;
}
function makeBush(H, seed) {
  const r = rand(seed), g = new THREE.Group();
  const blobs = [H.foliageBlob(0, 0.42, 0, 0.42, seed, 0x6fa046, 0x2a5220, 2), H.foliageBlob(0.3, 0.32, 0.12, 0.3, seed + 1, 0x6fa046, 0x2a5220, 2), H.foliageBlob(-0.28, 0.32, -0.1, 0.32, seed + 2, 0x6fa046, 0x2a5220, 2)];
  g.add(mesh(merge(blobs), mats().foliage));
  // little white flowers here and there
  for (let i = 0; i < 4; i++) { const a = r() * 6.28; g.add(mesh(at(new THREE.SphereGeometry(0.03, 6, 5), Math.cos(a) * 0.4, 0.55 + r() * 0.2, Math.sin(a) * 0.4), mats().white, false)); }
  const berries = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + r() * 0.4, rad = 0.43 + r() * 0.06;
    const b = makeBerry(); b.position.set(Math.cos(a) * rad, 0.2 + r() * 0.22, Math.sin(a) * rad * 0.8); b.rotation.set(Math.PI + (r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6); b.scale.setScalar(1.25);
    g.add(b); berries.push({ mesh: b, grow: 1 });
  }
  return { group: g, berries };
}
function makeWagon(H) {
  // The order wagon: a sturdy cart with a chalkboard that lists what the next order needs.
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.BoxGeometry(2.4, 0.1, 1.3), 0, 0.85, 0), m.wood));
  for (const z of [-0.64, 0.64]) g.add(mesh(at(new THREE.BoxGeometry(2.4, 0.4, 0.06), 0, 1.08, z), m.wood));
  for (const x of [-1.18, 1.18]) g.add(mesh(at(new THREE.BoxGeometry(0.06, 0.4, 1.3), x, 1.08, 0), m.wood));
  for (const [x, z] of [[-0.8, -0.75], [0.8, -0.75], [-0.8, 0.75], [0.8, 0.75]]) {
    g.add(mesh(at(new THREE.TorusGeometry(0.42, 0.05, 8, 26), x, 0.45, z), m.woodDark));
    for (let i = 0; i < 6; i++) g.add(mesh(at(new THREE.BoxGeometry(0.04, 0.8, 0.03), x, 0.45, z, 0, 0, i * Math.PI / 6), m.woodDark, false));
    g.add(mesh(at(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), x, 0.45, z, Math.PI / 2), m.iron, false));
  }
  for (const z of [-0.35, 0.35]) g.add(mesh(at(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6), 2.0, 0.5, z, 0, 0, Math.PI / 2 - 0.35), m.wood));
  const cr = makeCrate(0.7, 0.4, 0.5); cr.position.set(-0.7, 0.9, -0.3); g.add(cr);
  // chalkboard sign on two posts, facing the player
  for (const x of [-0.75, 0.75]) g.add(mesh(at(new THREE.BoxGeometry(0.07, 1.4, 0.07), x, 1.6, 0.6), m.woodDark));
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const board = mesh(at(new THREE.PlaneGeometry(1.7, 0.85), 0, 2.0, 0.66, -0.25), std({ map: tex, roughness: 0.9 }), false); g.add(board);
  g.add(mesh(at(new THREE.BoxGeometry(1.8, 0.95, 0.04), 0, 2.0, 0.63, -0.25), m.woodDark));
  return { group: g, ctx: cv.getContext('2d'), tex };
}
export const makeWagonIcon = () => makeWagon().group;
function makePond(H) {
  const g = new THREE.Group(), m = mats(), fm = farmMats();
  const water = new THREE.CircleGeometry(1, 48); water.rotateX(-Math.PI / 2);
  displace(water, (v) => { const a = Math.atan2(v.z, v.x), k = 1 + Math.sin(a * 3) * 0.08 + Math.sin(a * 5 + 1) * 0.05; v.x *= 2.6 * k; v.z *= 1.8 * k; });
  const w = mesh(water, fm.water, false, true); w.position.y = 0.05; g.add(w);
  const bank = new THREE.RingGeometry(1, 1.18, 48, 1); bank.rotateX(-Math.PI / 2);
  displace(bank, (v) => { const a = Math.atan2(v.z, v.x), k = 1 + Math.sin(a * 3) * 0.08 + Math.sin(a * 5 + 1) * 0.05; v.x *= 2.6 * k; v.z *= 1.8 * k; });
  g.add(mesh(at(bank, 0, 0.04, 0), std({ color: 0x8a7a5a, roughness: 1 }), false, true));
  const r = rand(31);
  for (let i = 0; i < 22; i++) { const a = r() * 6.28, rr = 1.05 + r() * 0.15; g.add(mesh(at(new THREE.DodecahedronGeometry(0.1 + r() * 0.12, 0), Math.cos(a) * 2.6 * rr, 0.06, Math.sin(a) * 1.8 * rr, r(), r(), r(), new V3(1, 0.6, 1)), m.stone)); }
  for (let i = 0; i < 40; i++) { const a = -0.6 + r() * 1.6, rr = 0.95 + r() * 0.2, h = 0.5 + r() * 0.5; g.add(mesh(at(new THREE.CylinderGeometry(0.012, 0.018, h, 4), Math.cos(a) * 2.6 * rr, h / 2, Math.sin(a) * 1.8 * rr, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), mats().leaf, false)); if (i % 4 === 0) g.add(mesh(at(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), Math.cos(a) * 2.6 * rr, h, Math.sin(a) * 1.8 * rr), std({ color: 0x5a3a22, roughness: 0.9 }), false)); }
  for (let i = 0; i < 6; i++) { const a = r() * 6.28, rr = r() * 0.7; const pad = mesh(at(new THREE.CircleGeometry(0.16, 12, 0.3, 5.9), Math.cos(a) * 2.2 * rr, 0.06, Math.sin(a) * 1.5 * rr, -Math.PI / 2), mats().leaf, false); g.add(pad); if (i % 2) g.add(mesh(at(new THREE.SphereGeometry(0.04, 8, 6), Math.cos(a) * 2.2 * rr, 0.09, Math.sin(a) * 1.5 * rr), std({ color: 0xf6c6d8, roughness: 0.5 }), false)); }
  const ducks = [0, 1].map((i) => { const d = makeDuck(i + 1); g.add(d); return d; });
  return { group: g, ducks };
}

// Where everything sits on the new land
export const FARM_SPOTS = {
  eggs: new V3(19.8, 0, -7.6), custardIn: new V3(18.6, 0, -2.1), custardOut: new V3(21.0, 0, -2.1),
  milk: new V3(27.2, 0, -7.6), butterIn: new V3(25.9, 0, -2.1), butterOut: new V3(28.5, 0, -2.1),
  tartIn: new V3(-21.7, 0, -2.1), tartOut: new V3(-19.3, 0, -2.1),
  comb: new V3(-27.4, 0, -7.6), honeyIn: new V3(-28.7, 0, -2.1), honeyOut: new V3(-26.1, 0, -2.1),
  order: new V3(10.5, 0, -5.3)
};
export const FARM_PATHS = [
  [13.6, 1.2, 30, 1.2, 1.6], [23.5, 1.2, 23.5, -9.4, 1.4], [19.8, -2.6, 23.5, -2.6, 1.2], [23.5, -2.6, 27.2, -2.6, 1.2],
  [-6, 1.2, -14, 0.2, 1.6], [-14, 0.2, -30, 0.2, 1.6], [-24, 0.2, -24, -9.4, 1.4], [-20.5, -2.6, -27.4, -2.6, 1.2],
  [4.4, -5, 10.5, -5.4, 1.6]
];
const BUSHES = []; for (const z of [2.6, 5.0, 7.4, 9.8]) for (const x of [-28.6, -26.2, -23.8, -21.4]) BUSHES.push([x, z]);
const HIVES = [[-29.6, -11.8, 0xf6f2ea], [-28.1, -12.1, 0xcfe3cf], [-26.6, -11.8, 0xf2d98a], [-25.1, -12.1, 0xc9dbe8]];
export const PADDOCK = [24.2, 3.4, 30.4, 13.6];
const HEN_RUN = [17.4, -13.1, 22.2, -9.3];

export function buildFarm(scene, colliders, H) {
  const box = (x0, z0, x1, z1, need) => colliders.push({ box: [x0, z0, x1, z1], need });
  const groups = {};
  const grp = (id) => { const g = new THREE.Group(); scene.add(g); groups[id] = g; return g; };
  const S = FARM_SPOTS, anchors = {};
  const tableAt = (parent, spot, need) => { const t = makeTable(1.3, 0.7, 0.8); t.position.copy(spot).add(new V3(0, 0, -0.95)); parent.add(t); return t.position.clone().add(new V3(0, 0.83, 0)); };
  const basketAt = (parent, spot) => { const b = makeBasket(1); b.position.copy(spot).add(new V3(0, 0, -0.9)); parent.add(b); return b.position.clone().add(new V3(0, 0.25, 0)); };

  // ----- east meadow: hens, custard oven, dairy and butter -----
  const east = grp('eastLand');
  const pond = makePond(H); pond.group.position.set(20.4, 0, 8.6); east.add(pond.group);
  colliders.push({ x: 20.4, z: 8.6, r: 2.0, need: 'eastLand' });
  const hens = grp('hens');
  const hh = makeHenHouse(H); hh.position.set(19.8, 0, -11.4); hens.add(hh);
  const run = makeRailFence(...HEN_RUN); run.scale.y = 0.75; hens.add(run);
  box(HEN_RUN[0] - 0.1, HEN_RUN[1] - 0.1, HEN_RUN[2] + 0.1, HEN_RUN[3] + 0.1, 'hens');
  const nest = makeNestCrate(); nest.position.copy(S.eggs).add(new V3(0, 0, -0.95)); hens.add(nest);
  anchors.eggs = nest.position.clone().add(new V3(0, 0.79, 0));
  const chickens = [];
  for (let i = 0; i < 6; i++) { const c = makeChicken(i * 7 + 3); c.position.set(HEN_RUN[0] + 0.5 + (i % 3) * 1.5, 0, HEN_RUN[3] - 0.5 - (i > 2 ? 0.4 : 0)); hens.add(c); chickens.push(c); }

  const pastry = grp('pastry');
  const pOven = H.makeOven('bread'); pOven.position.set(19.8, 0, -4.6); pastry.add(pOven); box(18.4, -5.9, 21.2, -3.3, 'pastry');
  anchors.custardIn = basketAt(pastry, S.custardIn); anchors.custardOut = tableAt(pastry, S.custardOut);

  const dairy = grp('dairy');
  const barn = makeBarn(H); barn.position.set(27.2, 0, -11.2); dairy.add(barn); box(24.8, -12.9, 29.6, -9.5, 'dairy');
  const stand = makeMilkStand(); stand.position.copy(S.milk).add(new V3(0, 0, -0.95)); dairy.add(stand);
  box(S.milk.x - 1.2, S.milk.z - 1.35, S.milk.x + 1.2, S.milk.z - 0.55, 'dairy');
  anchors.milk = stand.position.clone().add(new V3(0, 0.75, 0));
  dairy.add(makeRailFence(...PADDOCK)); box(PADDOCK[0] - 0.1, PADDOCK[1] - 0.1, PADDOCK[2] + 0.1, PADDOCK[3] + 0.1, 'dairy');
  const trough = new THREE.Group(); trough.add(mesh(at(new THREE.BoxGeometry(1.4, 0.4, 0.5), 0, 0.2, 0), mats().woodDark)); trough.add(mesh(at(new THREE.PlaneGeometry(1.3, 0.4), 0, 0.38, 0, -Math.PI / 2), farmMats().water, false));
  trough.position.set(25.4, 0, 12.4); dairy.add(trough);
  const cows = [];
  for (let i = 0; i < 3; i++) { const c = makeCow(i * 11 + 5); c.position.set(26 + i * 1.6, 0, 5.5 + i * 2.4); c.rotation.y = i * 2; dairy.add(c); cows.push(c); }

  const churn = grp('churn');
  const ch = makeChurnHouse(H); ch.position.set(27.2, 0, -4.6); churn.add(ch); box(25.75, -5.65, 28.65, -3.6, 'churn');
  anchors.butterIn = basketAt(churn, S.butterIn); anchors.butterOut = tableAt(churn, S.butterOut);

  // ----- west hill: strawberries and bees -----
  const west = grp('westLand');
  const berries = grp('berries'), bushes = [];
  const straw = new THREE.PlaneGeometry(8.6, 1.3); straw.rotateX(-Math.PI / 2);
  for (const z of [2.6, 5.0, 7.4, 9.8]) { const s = mesh(straw, farmMats().straw, false, true); s.position.set(-25, 0.03, z); berries.add(s); }
  BUSHES.forEach(([x, z], i) => {
    const b = makeBush(H, 200 + i * 3); b.group.position.set(x, 0, z); b.group.rotation.y = i * 1.7; berries.add(b.group);
    bushes.push({ x, z, apples: b.berries, group: 'berries', fruit: 'berry', foliage: null, fade: 1, reach: 1.3 });
    colliders.push({ x, z, r: 0.42, group: 'berries' });
  });
  const sign = mesh(at(new THREE.PlaneGeometry(1.2, 0.4), 0, 1.2, 0), std({ map: labelTex('Strawberries', '#fbf1df', '#c8553d'), roughness: 0.6 }), false);
  const post = new THREE.Group(); post.add(sign, mesh(at(new THREE.BoxGeometry(0.08, 1.2, 0.08), 0, 0.6, -0.03), mats().woodDark)); post.position.set(-19.6, 0, 1.6); berries.add(post);

  const tarts = grp('tarts');
  const tOven = H.makeOven('pie'); tOven.position.set(-20.5, 0, -4.6); tarts.add(tOven); box(-21.9, -5.9, -19.1, -3.3, 'tarts');
  anchors.tartIn = basketAt(tarts, S.tartIn); anchors.tartOut = tableAt(tarts, S.tartOut);

  const bees = grp('bees');
  for (const [x, z, c] of HIVES) { const h = makeHive(c); h.position.set(x, 0, z); h.rotation.y = (x * 7) % 0.3; bees.add(h); colliders.push({ x, z, r: 0.45, need: 'bees' }); }
  const combStand = makeTable(1.1, 0.7, 0.7); combStand.position.copy(S.comb).add(new V3(0, 0, -0.95)); bees.add(combStand);
  anchors.comb = combStand.position.clone().add(new V3(0, 0.74, 0));
  // a meadow of wildflowers for the bees
  {
    const r = rand(71), fg = merge([at(new THREE.SphereGeometry(0.05, 6, 5), 0, 0.3, 0, 0, 0, 0, new V3(1, 0.6, 1)), at(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 3), 0, 0.15, 0)]);
    paint(fg, (x, y, z, c) => c.set(y > 0.26 ? 0xffffff : 0x4a7a30));
    const im = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 500), mtx = new THREE.Matrix4(), col = new THREE.Color();
    const fc = [0xb7a6e8, 0xf4d35e, 0xfff6e0, 0xe58fb0, 0x8fb3e0];
    let k = 0;
    for (let i = 0; i < 1500 && k < 500; i++) {
      const x = -30.4 + r() * 8, z = -13.8 + r() * 4.6;
      if (HIVES.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 0.55)) continue;
      mtx.compose(new V3(x, 0, z), new THREE.Quaternion(), new V3(1, 0.6 + r() * 0.9, 1)); im.setMatrixAt(k, mtx); im.setColorAt(k++, col.set(fc[(r() * fc.length) | 0]));
    }
    im.count = k; bees.add(im);
  }
  const beeGeo = paint(new THREE.SphereGeometry(0.03, 8, 6).scale(0.8, 0.8, 1.3), (x, y, z, c) => c.set(Math.sin(z * 260) > 0 ? 0x2a1e10 : 0xf2b632));
  const beeIM = new THREE.InstancedMesh(beeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), 36); bees.add(beeIM);
  const beeData = Array.from({ length: 36 }, (_, i) => ({ hive: HIVES[i % 4], a: i * 1.7, r: 0.5 + (i % 5) * 0.35, h: 0.6 + (i % 3) * 0.35, sp: 0.8 + (i % 4) * 0.3 }));

  const honey = grp('honey');
  const hh2 = makeHoneyHouse(H); hh2.position.set(-27.4, 0, -4.6); honey.add(hh2); box(-28.85, -5.65, -25.95, -3.6, 'honey');
  anchors.honeyIn = basketAt(honey, S.honeyIn); anchors.honeyOut = tableAt(honey, S.honeyOut);

  // ----- extra display tables by the main stall -----
  const shopE = grp('shopE'), shopW = grp('shopW');
  const tE = makeTable(1.7, 0.8, 0.95); tE.position.set(4.75, 0, 5.6); shopE.add(tE); box(3.9, 5.2, 5.6, 6.0, 'pastry');
  const tW = makeTable(1.7, 0.8, 0.95); tW.position.set(-4.95, 0, 5.6); shopW.add(tW); box(-5.8, 5.2, -4.1, 6.0, 'tarts');
  anchors.stallE = tE.position.clone().add(new V3(0, 0.98, 0)); anchors.stallW = tW.position.clone().add(new V3(0, 0.98, 0));
  const cloth = (t) => t.add(mesh(at(new THREE.BoxGeometry(1.72, 0.01, 0.82), 0, 0.98, 0), std({ color: 0xf7efe0, roughness: 0.9 }), false, true));
  cloth(tE); cloth(tW);

  // ----- order wagon -----
  const wagonG = grp('wagon');
  const wagon = makeWagon(H); wagon.group.position.set(10.5, 0, -7.4); wagonG.add(wagon.group); box(9.2, -8.1, 12.6, -6.7, 'wagon');
  anchors.order = wagon.group.position.clone().add(new V3(0.45, 0.92, -0.1));

  const stations = { custard: pOven, butter: ch, tart: tOven, honey: hh2 };
  const beeM = new THREE.Matrix4(), beeQ = new THREE.Quaternion();
  function animate(dt, t, on) {
    if (on.hens) for (const c of chickens) {
      animateChicken(c, dt, [HEN_RUN[0] + 0.3, HEN_RUN[1] + 0.3, HEN_RUN[2] - 0.3, HEN_RUN[3] - 0.3]);
      if (c.position.x > 18.6 && c.position.x < 21.0 && c.position.z > -12.3 && c.position.z < -10.5) c.position.z = c.position.z < -11.4 ? -12.3 : -10.5; // walk round the coop
    }
    if (on.dairy) for (const c of cows) animateCow(c, dt, [PADDOCK[0] + 1, PADDOCK[1] + 1.2, PADDOCK[2] - 1, PADDOCK[3] - 1.2], t);
    if (on.eastLand) for (const d of pond.ducks) { const u = d.userData; u.a += dt * u.sp; d.position.set(Math.cos(u.a) * u.r * 1.6, 0.03 + Math.sin(t * 2 + u.a) * 0.01, Math.sin(u.a) * u.r); d.rotation.y = -u.a; }
    if (on.bees) beeData.forEach((b, i) => {
      b.a += dt * b.sp;
      const x = b.hive[0] + Math.cos(b.a) * b.r + Math.sin(t * 3 + i) * 0.1, z = b.hive[1] + 1.0 + Math.sin(b.a * 1.3) * b.r * 1.4, y = b.h + Math.sin(t * 5 + i * 2) * 0.12;
      beeQ.setFromEuler(new THREE.Euler(0, b.a + Math.PI / 2, 0)); beeM.compose(new V3(x, y, z), beeQ, new V3(1, 1, 1)); beeIM.setMatrixAt(i, beeM);
    });
    beeIM.instanceMatrix.needsUpdate = true;
  }
  return { groups, anchors, stations, bushes, animate, wagon, chickens, cows };
}
