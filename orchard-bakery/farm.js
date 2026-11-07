// Orchard Bakery: the bigger farm. New land to the east (hens, dairy cows) and west
// (strawberries, bees), the produce they give, what you bake from it, and the order wagon.
// Everything is modelled in code with soft colour variation so it reads as real.
import * as THREE from 'three';
import {
  rand, fbm, noise3, paint, displace, at, mesh, merge, canvasTex, speckle, mats,
  makeBasket, makeBarrel, makeCrate, makeTable, makeJam, makeToyItem, bakeStatic, bakeGeo, VC
} from './models.js';
import * as OB from './art.js';
const { rb, cyl, sph, add: oadd, G: OG, M: OM, F: OF } = OB;

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
  const S = (c, o) => std(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {}));
  Object.assign(MAT, { berry: S(0xe8302a), calyx: S(0x4fb33a), egg: S(0xfff4dc), milk: S(0xffffff), foil: S(0xdde4ea), comb: S(0xe7a21a), pastry: S(0xd98a3a), custard: S(0xffe07a), butter: S(0xf9d65a), cream: S(0xfff6e6),
    honey: S(0xf0a21c), lid: S(0xf7c23e), feather: S(0xffffff), comb2: S(0xe8302a), beak: S(0xf7a21c), eye: S(0x2a1a10), hide: S(0xffffff), muzzle: S(0xffb3b0), horn: S(0xf2d27a), hoof: S(0x5a3a28),
    redBarn: S(0xd8392e), coop: S(0xfff1d6), straw: S(0xf2c25a), water: S(0x5cc3e8, { roughness: 0.3 }), metal: S(0xc9c3b3) });
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
export function makeBerry() { return makeToyItem('berry'); }
export function makeEgg() { return makeToyItem('egg'); }
export function makeMilk() { return makeToyItem('milk'); }
export function makeComb() { return makeToyItem('comb'); }
function fluted(R, H, flutes = 16) {
  const prof = [[0, 0], [R * 0.8, 0], [R * 0.9, 0.01], [R, H * 0.8], [R * 1.05, H], [R * 0.9, H * 1.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 48);
  displace(g, (v) => { const a = Math.atan2(v.z, v.x), k = 1 + Math.max(0, Math.sin(a * flutes)) * 0.06 * clamp01(v.y / H * 2); v.x *= k; v.z *= k; });
  paint(g, (x, y, z, c) => c.copy(C(0xe9b46a)).lerp(C(0x9a5a22), clamp01(0.3 + y / H * 0.5 + fbm(x * 30, y * 30, z * 30) * 0.6)));
  return g;
}
export function makeCustard() { return makeToyItem('custard'); }
export function makeButter() { return makeToyItem('butter'); }
export function makeTart() { return makeToyItem('tart'); }
export function makeHoney() { return makeToyItem('honey'); }
export function makeCheese() { return makeToyItem('cheese'); }
export function makeCider() { return makeToyItem('cider'); }
export function makeFarmItem(kind) { return makeToyItem(kind); }
// ---------- animals ----------
export function makeChicken(seed) {
  // The Design hen: a round white (or golden) body, red comb, orange beak and legs.
  const r = rand(seed), g = new THREE.Group();
  const col = r() < 0.7 ? '#FFFFFF' : '#F2C25A';
  const body = new THREE.Group(); g.add(body);
  const bb = new THREE.Group(); body.add(bb);
  sph(bb, 0.28, col, 0, 0.32, 0, { s: [1, 0.85, 1.2] }); oadd(bb, new THREE.ConeGeometry(0.16, 0.3, 6), OM(col), 0, 0.42, -0.33, { rx: -1.1 });
  const head = new THREE.Group(); head.position.set(0, 0.58, 0.22); body.add(head);
  const hb = new THREE.Group(); head.add(hb);
  sph(hb, 0.17, col, 0, 0, 0); rb(hb, 0.06, 0.12, 0.16, '#E8302A', 0, 0.18, -0.02, 0.03); oadd(hb, new THREE.ConeGeometry(0.05, 0.12, 6), OM('#F7A21C'), 0, -0.01, 0.2, { rx: Math.PI / 2 });
  sph(hb, 0.04, '#E8302A', 0, -0.1, 0.13); sph(hb, 0.03, '#2A1A10', -0.09, 0.04, 0.12); sph(hb, 0.03, '#2A1A10', 0.09, 0.04, 0.12);
  const legs = [];
  for (const sd of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(sd * 0.08, 0.16, 0); g.add(leg); cyl(leg, 0.02, 0.02, 0.16, '#F7A21C', 0, -0.08, 0, 5); legs.push(leg); }
  const bakeInto = (grp) => { const b = bakeStatic(grp); while (grp.children.length) grp.remove(grp.children[0]); for (const c of [...b.children]) grp.add(c); };
  bakeInto(bb); bakeInto(hb); for (const l of legs) bakeInto(l);
  const s = (0.95 + r() * 0.15) * 0.72; g.scale.setScalar(s);
  g.userData = { body, head, legs, phase: r() * 6, mode: 'idle', t: r() * 2, target: new V3(), speed: 0 };
  return g;
}
export function makeCow(seed) {
  // The Design cow: a chunky white block with dark patches, pink muzzle and little horns.
  const r = rand(seed), g = new THREE.Group();
  const patch = r() < 0.5 ? '#2E2420' : '#8B5A34';
  const bodyG = new THREE.Group(); g.add(bodyG);
  rb(bodyG, 0.95, 0.7, 1.45, '#FFFFFF', 0, 0.82, 0, 0.25);
  rb(bodyG, 0.4, 0.4, 0.04, patch, 0.48, 0.9, -0.2, 0.08, { ry: Math.PI / 2 }); rb(bodyG, 0.3, 0.28, 0.04, patch, -0.48, 0.8, 0.25, 0.08, { ry: Math.PI / 2 });
  rb(bodyG, 0.45, 0.04, 0.4, patch, 0.1, 1.17, -0.35, 0.08);
  const head = new THREE.Group(); head.position.set(0, 1.12, 0.7); g.add(head);
  const hb = new THREE.Group(); head.add(hb);
  rb(hb, 0.62, 0.58, 0.55, '#FFFFFF', 0, 0, 0.18, 0.18); rb(hb, 0.56, 0.24, 0.12, '#FFB3B0', 0, -0.14, 0.47, 0.08);
  sph(hb, 0.035, '#C2615D', -0.12, -0.13, 0.54); sph(hb, 0.035, '#C2615D', 0.12, -0.13, 0.54);
  sph(hb, 0.05, '#2A1A10', -0.17, 0.12, 0.45); sph(hb, 0.05, '#2A1A10', 0.17, 0.12, 0.45);
  oadd(hb, new THREE.ConeGeometry(0.06, 0.2, 6), OM('#F2D27A'), -0.24, 0.36, 0.12, { rz: 0.5 }); oadd(hb, new THREE.ConeGeometry(0.06, 0.2, 6), OM('#F2D27A'), 0.24, 0.36, 0.12, { rz: -0.5 });
  rb(hb, 0.22, 0.1, 0.12, '#FFFFFF', -0.4, 0.18, 0.1, 0.04, { rz: 0.3 }); rb(hb, 0.22, 0.1, 0.12, '#FFFFFF', 0.4, 0.18, 0.1, 0.04, { rz: -0.3 });
  const legs = [];
  for (const [x, z] of [[-0.32, 0.45], [0.32, 0.45], [-0.32, -0.45], [0.32, -0.45]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.5, z); g.add(leg);
    rb(leg, 0.2, 0.5, 0.2, '#F4EFE6', 0, -0.25, 0, 0.06); rb(leg, 0.22, 0.1, 0.22, '#5A3A28', 0, -0.45, 0, 0.03);
    legs.push(leg);
  }
  const tail = new THREE.Group(); tail.position.set(0, 1.05, -0.75); g.add(tail);
  cyl(tail, 0.035, 0.035, 0.5, '#FFFFFF', 0, -0.22, -0.05, 6, { rx: 0.2 }); sph(tail, 0.06, patch, 0, -0.48, -0.1);
  const bakeInto = (grp) => { const b = bakeStatic(grp); while (grp.children.length) grp.remove(grp.children[0]); for (const c of [...b.children]) grp.add(c); };
  bakeInto(bodyG); bakeInto(hb); bakeInto(tail); for (const l of legs) bakeInto(l);
  g.scale.setScalar(1.0 + r() * 0.12);
  g.userData = { head, legs, tail, phase: r() * 6, mode: 'graze', t: 2 + r() * 4, target: new V3(), speed: 0 };
  return g;
}
function makeDuck(seed) {
  const g = new THREE.Group();
  sph(g, 0.16, seed % 2 ? '#FFFFFF' : '#F2C25A', 0, 0.08, 0, { s: [0.85, 0.65, 1.3] }); sph(g, 0.08, seed % 2 ? '#3E9A30' : '#F2C25A', 0, 0.22, 0.15);
  rb(g, 0.06, 0.03, 0.08, '#F7A21C', 0, 0.21, 0.25, 0.01); sph(g, 0.018, '#2A1A10', -0.05, 0.25, 0.2); sph(g, 0.018, '#2A1A10', 0.05, 0.25, 0.2);
  const out = bakeStatic(g);
  out.userData = { a: seed * 2.1, r: 0.9 + (seed % 3) * 0.35, sp: 0.18 + (seed % 2) * 0.08 };
  return out;
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
  u.head.position.z = 0.22 + (sp > 0 ? Math.sin(u.phase * 2) * 0.03 : 0);
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
function shed(H, w, d, h, roofColor, wallColor) {
  // A chunky toy building: stone footing, painted walls, a pitched roof of two thick slabs.
  const g = new THREE.Group();
  const roofHex = '#' + new THREE.Color(roofColor).getHexString();
  rb(g, w + 0.3, 0.22, d + 0.3, '#C9C3B3', 0, 0.11, 0, 0.06);
  rb(g, w, h, d, wallColor, 0, 0.2 + h / 2, 0, 0.1);
  for (const x of [-w / 2, w / 2]) rb(g, 0.16, h, 0.16, '#FFFFFF', x, 0.2 + h / 2, d / 2, 0.03);
  const rise = d * 0.42, half = Math.hypot(d / 2 + 0.25, rise), ang = Math.atan2(rise, d / 2 + 0.25);
  const gab = new THREE.Shape(); gab.moveTo(-d / 2, 0); gab.lineTo(d / 2, 0); gab.lineTo(0, rise); gab.lineTo(-d / 2, 0);
  for (const sd of [-1, 1]) oadd(g, new THREE.ShapeGeometry(gab), OM(wallColor), sd * (w / 2 - 0.02), 0.2 + h, 0, { ry: sd * Math.PI / 2 });
  rb(g, w + 0.4, 0.2, half, roofHex, 0, 0.2 + h + rise / 2 + 0.05, -(d / 4 + 0.06), 0.05, { rx: -ang });
  rb(g, w + 0.4, 0.2, half, '#' + new THREE.Color(roofColor).multiplyScalar(0.86).getHexString(), 0, 0.2 + h + rise / 2 + 0.05, d / 4 + 0.06, 0.05, { rx: ang });
  return g;
}
function farmSign(text, bg = '#FFF6E6', fg = '#2B1D14') {
  return canvasTex(512, 160, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = '700 84px Fredoka, "Nunito", ui-rounded, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 4); });
}
function signBoard(g, text, x, y, z, w = 1.4, rx = 0) {
  rb(g, w + 0.12, w * 0.36, 0.08, '#8B4E2A', x, y, z - 0.03, 0.04, { rx });
  const m = mesh(at(new THREE.PlaneGeometry(w, w * 0.3), x, y, z + 0.02, rx), new THREE.MeshBasicMaterial({ map: farmSign(text), toneMapped: false }), false, false);
  g.add(m); m.userData.sign = true;
}
function makeHenHouse(H) {
  const g = new THREE.Group(); const hh = OB.henHouse(g, 0, 0, 0); hh.scale.setScalar(1.3);
  return bakeStatic(g);
}
function makeNestCrate() {
  const g = new THREE.Group(); g.add(makeTable(1.1, 0.7, 0.7));
  const s2 = new THREE.Group(); rb(s2, 0.9, 0.1, 0.55, '#F2C25A', 0, 0.75, 0, 0.04); g.add(bakeStatic(s2));
  return g;
}
function makeRailFence(x0, z0, x1, z1, gapAt) {
  const g = new THREE.Group();
  OB.fence(g, x0, z0, x1, z0); OB.fence(g, x0, z1, x1, z1); OB.fence(g, x0, z0, x0, z1); OB.fence(g, x1, z0, x1, z1);
  return bakeStatic(g);
}
function makeBarn(H) {
  const g = shed(H, 4.4, 3.4, 2.4, 0x6f6a66, '#D8392E');
  const dz = 1.72;
  rb(g, 1.9, 1.9, 0.08, '#B52E25', 0, 1.15, dz, 0.04);
  for (const sd of [-1, 1]) { rb(g, 0.1, 1.9, 0.1, '#FFFFFF', sd * 0.95, 1.15, dz + 0.04, 0.03); rb(g, 0.09, 2.5, 0.08, '#FFFFFF', sd * 0.0, 1.15, dz + 0.06, 0.03, { rz: sd * 0.78 }); }
  rb(g, 1.95, 0.1, 0.1, '#FFFFFF', 0, 2.1, dz + 0.04, 0.03); rb(g, 1.95, 0.1, 0.1, '#FFFFFF', 0, 0.22, dz + 0.04, 0.03);
  rb(g, 0.7, 0.6, 0.08, '#3A2216', 0, 2.95, dz - 0.3, 0.04);
  for (const [x, z] of [[-2.6, 1.0], [-2.7, 0.1]]) { const b = OG(g, x, 0, z, 0.3); cyl(b, 0.42, 0.42, 0.7, '#F2C25A', 0, 0.42, 0, 16, { rz: Math.PI / 2 }); }
  const out = bakeStatic(g); signBoard(out, 'Dairy', 1.6, 2.0, dz + 0.06, 1.1);
  return out;
}
function makeMilkStand() {
  const g = new THREE.Group();
  rb(g, 1.2, 0.7, 0.7, '#C9884C', 0, 0.35, 0, 0.06); rb(g, 1.3, 0.08, 0.8, '#E3A462', 0, 0.72, 0, 0.03);
  for (const x of [-0.95, 0.95]) { cyl(g, 0.18, 0.18, 0.45, '#DDE4EA', x, 0.23, 0.1, 14); cyl(g, 0.11, 0.17, 0.12, '#DDE4EA', x, 0.51, 0.1, 14); cyl(g, 0.12, 0.12, 0.05, '#3C7FD6', x, 0.6, 0.1, 14); }
  return bakeStatic(g);
}
function makeShelter(H, roofColor, signText) {
  // An open workshop: four posts, a thick sloping roof and a counter, with a sign on the front.
  const g = new THREE.Group();
  const roofHex = '#' + new THREE.Color(roofColor).getHexString();
  for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) rb(g, 0.16, 2.3, 0.16, '#9A6237', x, 1.15, z, 0.04);
  rb(g, 3.2, 0.18, 2.4, roofHex, 0, 2.45, 0, 0.06, { rx: 0.18 });
  rb(g, 2.4, 0.1, 0.95, '#E3A462', 0, 0.8, -0.4, 0.03);
  for (const x of [-1.05, 1.05]) rb(g, 0.1, 0.78, 0.85, '#9A6237', x, 0.39, -0.4, 0.03);
  return g;
}
function finishShelter(g, signText, keep) { const out = bakeStatic(g, keep); signBoard(out, signText, 0, 2.15, 1.18, 1.5, -0.18); return out; }
function makeChurnHouse(H) {
  const g = makeShelter(H, 0xe0402f, 'Butter');
  const c = OG(g, -0.5, 0.84, -0.4);
  cyl(c, 0.3, 0.38, 0.9, '#C98A4E', 0, 0.45, 0, 16); cyl(c, 0.36, 0.36, 0.07, '#7A4C2C', 0, 0.18, 0, 16); cyl(c, 0.32, 0.32, 0.07, '#7A4C2C', 0, 0.74, 0, 16); cyl(c, 0.28, 0.28, 0.08, '#A86A3C', 0, 0.92, 0, 16);
  const plunger = new THREE.Group(); plunger.position.set(-0.5, 1.7, -0.4);
  cyl(plunger, 0.045, 0.045, 0.8, '#8B5A34', 0, 0.2, 0, 8); rb(plunger, 0.4, 0.08, 0.08, '#8B5A34', 0, 0.6, 0, 0.03);
  for (let i = 0; i < 3; i++) { const b = OG(g, 0.38 + i * 0.22, 0.86, -0.4); cyl(b, 0.1, 0.1, 0.03, '#DDEBF5', 0, 0.015, 0, 14); rb(b, 0.14, 0.08, 0.1, '#F9D65A', 0, 0.07, 0, 0.02); }
  const out = finishShelter(g, 'Butter'); out.add(bakeStatic(plunger)); const pl = out.children[out.children.length - 1]; pl.position.set(-0.5, 1.7, -0.4);
  out.userData = { plunger: pl, smokeAt: null };
  return out;
}
function makeHoneyHouse(H) {
  const g = makeShelter(H, 0xf09a1a, 'Honey');
  cyl(g, 0.34, 0.34, 0.62, '#C9C3B3', -0.5, 1.15, -0.4, 18); cyl(g, 0.36, 0.36, 0.06, '#9E9A90', -0.5, 1.47, -0.4, 18);
  for (let i = 0; i < 6; i++) OB.jar(g, 0.25 + (i % 3) * 0.24, 0.85, -0.6 + Math.floor(i / 3) * 0.28, 0.7, '#F0A21C');
  const out = finishShelter(g, 'Honey');
  const crank = new THREE.Group(); rb(crank, 0.4, 0.04, 0.04, '#4A3A30', 0.18, 0, 0, 0.01); cyl(crank, 0.03, 0.03, 0.16, '#C9884C', 0.36, 0.08, 0, 6);
  const cb = bakeStatic(crank); cb.position.set(-0.5, 1.55, -0.4); out.add(cb);
  out.userData = { crank: cb, smokeAt: null };
  return out;
}
function makeCheeseRoom(H) {
  const g = makeShelter(H, 0x45a535, 'Cheese');
  const sh = OB.cheeseShelf(g, 0.45, -0.55); sh.scale.setScalar(0.75); sh.position.y = 0.84;
  rb(g, 0.5, 0.06, 0.5, '#8B5A34', -0.6, 0.87, -0.4, 0.02); cyl(g, 0.2, 0.2, 0.22, '#F6C640', -0.6, 1.0, -0.4, 18);
  for (const x of [-0.82, -0.38]) rb(g, 0.06, 0.9, 0.06, '#8B5A34', x, 1.3, -0.4, 0.02);
  rb(g, 0.55, 0.08, 0.12, '#8B5A34', -0.6, 1.76, -0.4, 0.02);
  const out = finishShelter(g, 'Cheese');
  const screw = new THREE.Group(); cyl(screw, 0.025, 0.025, 0.6, '#4A3A30', 0, 0, 0, 8); rb(screw, 0.34, 0.03, 0.03, '#4A3A30', 0, 0.25, 0, 0.01);
  const sb = bakeStatic(screw); sb.position.set(-0.6, 1.45, -0.4); out.add(sb);
  out.userData = { crank: sb, smokeAt: null };
  return out;
}
function makeCiderPress(H) {
  const g = makeShelter(H, 0xc2321f, 'Cider');
  const cp = OB.ciderPress(g, -0.45, -0.4); cp.scale.setScalar(0.72); cp.position.y = 0.84;
  for (let i = 0; i < 4; i++) { const b = OG(g, 0.4 + i * 0.17, 0.86, -0.45); cyl(b, 0.06, 0.06, 0.22, '#C7782A', 0, 0.11, 0, 10); cyl(b, 0.03, 0.05, 0.06, '#C7782A', 0, 0.25, 0, 10); cyl(b, 0.032, 0.032, 0.04, '#3E9A30', 0, 0.3, 0, 8); }
  const out = finishShelter(g, 'Cider');
  const screw = new THREE.Group(); rb(screw, 0.6, 0.04, 0.04, '#8B5A34', 0, 0, 0, 0.01);
  const sb = bakeStatic(screw); sb.position.set(-0.45, 2.38, -0.4); out.add(sb);
  out.userData = { crank: sb, smokeAt: null };
  return out;
}
function makeHive(color) {
  const g = new THREE.Group(); OB.beehive(g, 0, 0, 0);
  return bakeStatic(g);
}
function makeBush(H, seed) {
  const r = rand(seed), g = new THREE.Group();
  const b = new THREE.Group(); OB.bush(b, 0, 0, 1.0); for (let i = 0; i < 4; i++) { const a = r() * 6.28; sph(b, 0.035, '#FFFFFF', Math.cos(a) * 0.42, 0.5 + r() * 0.15, Math.sin(a) * 0.42); }
  g.add(bakeStatic(b));
  const berries = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + r() * 0.4, rad = 0.5 + r() * 0.06;
    const bb = makeBerry(); bb.position.set(Math.cos(a) * rad, 0.18 + r() * 0.22, Math.sin(a) * rad * 0.8); bb.rotation.set(Math.PI + (r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6); bb.scale.setScalar(1.35);
    g.add(bb); berries.push({ mesh: bb, grow: 1 });
  }
  return { group: g, berries };
}
function makeWagon(H) {
  // The order wagon: a big Design-style cart with a board that lists what the next order needs.
  const g = new THREE.Group();
  rb(g, 2.4, 0.5, 1.3, '#C9864A', 0, 1.0, 0, 0.08); rb(g, 2.3, 0.06, 1.2, '#E3A462', 0, 1.26, 0, 0.02);
  for (const [x, z] of [[-0.8, -0.72], [0.8, -0.72], [-0.8, 0.72], [0.8, 0.72]]) { cyl(g, 0.42, 0.42, 0.12, '#6E4426', x, 0.45, z, 18, { rx: Math.PI / 2 }); cyl(g, 0.14, 0.14, 0.14, '#D9A16A', x, 0.45, z, 10, { rx: Math.PI / 2 }); }
  for (const z of [-0.35, 0.35]) rb(g, 1.6, 0.1, 0.1, '#8B5A34', 1.85, 0.85, z, 0.03, { rz: 0.3 });
  for (const x of [-1.2, 1.2]) rb(g, 0.12, 2.0, 0.12, '#9A6237', x, 2.1, 0.6, 0.03);
  rb(g, 2.7, 1.5, 0.1, '#8B4E2A', 0, 2.65, 0.6, 0.06, { rx: -0.55 });
  const out = bakeStatic(g);
  // a big board tipped back toward the camera, so the order reads from a distance
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 352;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  out.add(mesh(at(new THREE.PlaneGeometry(2.5, 1.375), 0, 2.65, 0.66, -0.55), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), false));
  return { group: out, ctx: cv.getContext('2d'), tex };
}
export const makeWagonIcon = () => makeWagon().group;
function makePond(H) {
  // The Design pond: bright blue water with a sandy rim and grey rocks, stretched to fit its spot.
  const g = new THREE.Group(), b = new THREE.Group();
  const w = OG(b, 0, 0, 0); w.scale.set(2.6, 1, 1.8);
  cyl(w, 1.1, 1.1, 0.08, '#E2C38A', 0, 0.02, 0, 32, { cast: false }); cyl(w, 1.0, 1.0, 0.1, OM('#5CC3E8', { roughness: 0.3 }), 0, 0.04, 0, 32, { cast: false });
  cyl(w, 0.4, 0.4, 0.11, OM('#9EE0F5', { roughness: 0.3 }), -0.3, 0.045, -0.2, 20, { cast: false, s: [1.4, 1, 0.35] });
  for (let i = 0; i < 10; i++) { const a = i * 0.63; OB.rock(b, Math.cos(a) * 2.75, Math.sin(a) * 1.95, 0.9 + (i % 3) * 0.2); }
  for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.25; cyl(b, 0.02, 0.025, 0.7, '#3E9A30', Math.cos(a) * 2.55, 0.35, Math.sin(a) * 1.75, 5); oadd(b, new THREE.CapsuleGeometry(0.04, 0.12, 3, 6), OM('#7A4C2C'), Math.cos(a) * 2.55, 0.72, Math.sin(a) * 1.75); }
  g.add(bakeStatic(b));
  const ducks = [0, 1].map((i) => { const d = makeDuck(i + 1); g.add(d); return d; });
  return { group: g, ducks };
}
export const FARM_SPOTS = {
  eggs: new V3(19.8, 0, -7.6), custardIn: new V3(18.6, 0, -2.1), custardOut: new V3(21.0, 0, -2.1),
  milk: new V3(30.2, 0, -7.6), butterIn: new V3(28.9, 0, -2.1), butterOut: new V3(31.5, 0, -2.1),
  tartIn: new V3(-23.2, 0, -2.1), tartOut: new V3(-20.8, 0, -2.1),
  comb: new V3(-30.4, 0, -7.6), honeyIn: new V3(-31.7, 0, -2.1), honeyOut: new V3(-29.1, 0, -2.1),
  order: new V3(10.5, 0, -5.3),
  // a short lane leads round to the front of each, so the building never hides the spots
  cheeseIn: new V3(18.5, 0, 6.5), cheeseOut: new V3(21.1, 0, 6.5),
  ciderIn: new V3(-17.6, 0, 6.2), ciderOut: new V3(-20.2, 0, 6.2)
};
export const FARM_PATHS = [
  [13.6, 1.2, 33, 1.2, 1.6], [25.0, 1.2, 25.0, -9.4, 1.4],
  [-6, 1.2, -14, 0.2, 1.6], [-14, 0.2, -33, 0.2, 1.6], [-26.2, 0.2, -26.2, -9.4, 1.4],
  [5.2, -3.0, 10.5, -4.3, 1.4],
  [17.1, 1.2, 17.1, 7.6, 1.3], [17.1, 7.6, 22.4, 7.6, 1.3], // lane to the cheese room
  [-16.9, 0.2, -16.9, 7.3, 1.3], [-16.9, 7.3, -20.4, 7.3, 1.3] // lane to the cider press
];
const BUSHES = []; for (const z of [2.6, 5.0, 7.4, 9.8]) for (const x of [-31.6, -29.2, -26.8, -24.4]) BUSHES.push([x, z]);
const HIVES = [[-32.6, -11.8, 0xf6f2ea], [-31.1, -12.1, 0xcfe3cf], [-29.6, -11.8, 0xf2d98a], [-28.1, -12.1, 0xc9dbe8]];
export const PADDOCK = [27.2, 3.4, 33.4, 13.6];
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
  const pond = makePond(H); pond.group.position.set(20.0, 0, 11.6); east.add(pond.group);
  colliders.push({ x: 20.0, z: 11.6, r: 2.0, need: 'eastLand' });
  const hens = grp('hens');
  const hh = makeHenHouse(H); hh.position.set(19.8, 0, -11.4); hens.add(hh); { const ao = H.aoBlob(1.7, 1.4, 0.45); ao.position.copy(hh.position); hens.add(ao); }
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
  const barn = makeBarn(H); barn.position.set(30.2, 0, -11.2); dairy.add(barn); { const ao = H.aoBlob(3.0, 2.2, 0.5); ao.position.copy(barn.position); dairy.add(ao); } box(27.8, -12.9, 32.6, -9.5, 'dairy');
  const stand = makeMilkStand(); stand.position.copy(S.milk).add(new V3(0, 0, -0.95)); dairy.add(stand);
  box(S.milk.x - 1.2, S.milk.z - 1.35, S.milk.x + 1.2, S.milk.z - 0.55, 'dairy');
  anchors.milk = stand.position.clone().add(new V3(0, 0.75, 0));
  dairy.add(makeRailFence(...PADDOCK)); box(PADDOCK[0] - 0.1, PADDOCK[1] - 0.1, PADDOCK[2] + 0.1, PADDOCK[3] + 0.1, 'dairy');
  const tg = new THREE.Group(); rb(tg, 1.4, 0.4, 0.5, '#8B5A34', 0, 0.2, 0, 0.05); rb(tg, 1.25, 0.04, 0.36, '#5CC3E8', 0, 0.39, 0, 0.02); const trough = bakeStatic(tg);
  trough.position.set(28.4, 0, 12.4); dairy.add(trough);
  const cows = [];
  for (let i = 0; i < 3; i++) { const c = makeCow(i * 11 + 5); c.position.set(29 + i * 1.6, 0, 5.5 + i * 2.4); c.rotation.y = i * 2; dairy.add(c); cows.push(c); }

  const churn = grp('churn');
  const ch = makeChurnHouse(H); ch.position.set(30.2, 0, -4.6); churn.add(ch); { const ao = H.aoBlob(1.9, 1.4, 0.45); ao.position.copy(ch.position); churn.add(ao); } box(28.75, -5.65, 31.65, -3.6, 'churn');
  anchors.butterIn = basketAt(churn, S.butterIn); anchors.butterOut = tableAt(churn, S.butterOut);

  // ----- west hill: strawberries and bees -----
  const west = grp('westLand');
  const berries = grp('berries'), bushes = [];
  { const sg = new THREE.Group(); for (const z of [2.6, 5.0, 7.4, 9.8]) { rb(sg, 8.8, 0.16, 1.4, '#9C5E2E', -28, 0.05, z, 0.06, { cast: false }); rb(sg, 8.6, 0.05, 1.2, '#F2C25A', -28, 0.14, z, 0.02, { cast: false }); } berries.add(bakeStatic(sg)); }
  BUSHES.forEach(([x, z], i) => {
    const b = makeBush(H, 200 + i * 3); b.group.position.set(x, 0, z); b.group.rotation.y = i * 1.7; berries.add(b.group);
    bushes.push({ x, z, apples: b.berries, group: 'berries', fruit: 'berry', foliage: null, fade: 1, reach: 1.3 });
    colliders.push({ x, z, r: 0.42, group: 'berries' });
  });
  { const pg = new THREE.Group(); rb(pg, 0.12, 1.3, 0.12, '#9A6237', 0, 0.65, -0.05, 0.03); const post = bakeStatic(pg); signBoard(post, 'Berries', 0, 1.25, 0.02, 1.2); post.position.set(-17.2, 0, -1.3); berries.add(post); }

  const tarts = grp('tarts');
  const tOven = H.makeOven('pie'); tOven.position.set(-22.0, 0, -4.6); tarts.add(tOven); box(-23.4, -5.9, -20.6, -3.3, 'tarts');
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
      const x = -33.4 + r() * 8, z = -13.8 + r() * 4.6;
      if (HIVES.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 0.55)) continue;
      mtx.compose(new V3(x, 0, z), new THREE.Quaternion(), new V3(1, 0.6 + r() * 0.9, 1)); im.setMatrixAt(k, mtx); im.setColorAt(k++, col.set(fc[(r() * fc.length) | 0]));
    }
    im.count = k; bees.add(im);
  }
  const beeGeo = paint(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.9, 1.3), (x, y, z, c) => c.set(Math.abs(z) > 0.02 && Math.abs(z) < 0.045 ? 0x2a1a10 : 0xffd12e));
  const beeIM = new THREE.InstancedMesh(beeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), 36); bees.add(beeIM);
  const beeData = Array.from({ length: 36 }, (_, i) => ({ hive: HIVES[i % 4], a: i * 1.7, r: 0.5 + (i % 5) * 0.35, h: 0.6 + (i % 3) * 0.35, sp: 0.8 + (i % 4) * 0.3 }));

  const honey = grp('honey');
  const hh2 = makeHoneyHouse(H); hh2.position.set(-30.4, 0, -4.6); honey.add(hh2); { const ao = H.aoBlob(1.9, 1.4, 0.45); ao.position.copy(hh2.position); honey.add(ao); } box(-31.85, -5.65, -28.95, -3.6, 'honey');
  anchors.honeyIn = basketAt(honey, S.honeyIn); anchors.honeyOut = tableAt(honey, S.honeyOut);

  // ----- cheese room (east) and cider press (west), both facing the path from the north -----
  const cheese = grp('cheese');
  const cr = makeCheeseRoom(H); cr.position.set(19.8, 0, 4.0); cheese.add(cr); box(18.35, 3.0, 21.25, 5.05, 'cheese');
  anchors.cheeseIn = basketAt(cheese, S.cheeseIn); anchors.cheeseOut = tableAt(cheese, S.cheeseOut);
  const cider = grp('cider');
  const cp = makeCiderPress(H); cp.position.set(-18.9, 0, 3.7); cider.add(cp); box(-20.35, 2.7, -17.45, 4.75, 'cider');
  anchors.ciderIn = basketAt(cider, S.ciderIn); anchors.ciderOut = tableAt(cider, S.ciderOut);
  for (const [gp, o] of [[cheese, cr], [cider, cp]]) { const ao = H.aoBlob(1.9, 1.4, 0.45); ao.position.copy(o.position); gp.add(ao); }

  // ----- extra display tables by the main stall -----
  const shopE = grp('shopE'), shopW = grp('shopW');
  const tE = makeTable(1.7, 0.8, 0.95); tE.position.set(4.75, 0, 5.6); shopE.add(tE); box(3.9, 5.2, 5.6, 6.0, 'pastry');
  const tW = makeTable(1.7, 0.8, 0.95); tW.position.set(-4.95, 0, 5.6); shopW.add(tW); box(-5.8, 5.2, -4.1, 6.0, 'tarts');
  const shopN = grp('shopN');
  const tN = makeTable(1.7, 0.8, 0.95); tN.position.set(7.4, 0, 5.6); shopN.add(tN); box(6.55, 5.2, 8.25, 6.0, 'cheese');
  anchors.stallN = tN.position.clone().add(new V3(0, 0.98, 0));
  anchors.stallE = tE.position.clone().add(new V3(0, 0.98, 0)); anchors.stallW = tW.position.clone().add(new V3(0, 0.98, 0));
  const cloth = (t) => t.add(mesh(at(new THREE.BoxGeometry(1.72, 0.02, 0.82), 0, 0.98, 0), std({ color: 0xfff6e6, roughness: 0.9 }), false, true));
  cloth(tE); cloth(tW); cloth(tN);

  // ----- order wagon -----
  const wagonG = grp('wagon');
  const wagon = makeWagon(H); wagon.group.position.set(10.5, 0, -7.4); wagonG.add(wagon.group); box(9.2, -8.1, 12.6, -6.7, 'wagon');
  anchors.order = wagon.group.position.clone().add(new V3(0.45, 0.92, -0.1));

  const stations = { custard: pOven, butter: ch, tart: tOven, honey: hh2, cheese: cr, cider: cp };
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
