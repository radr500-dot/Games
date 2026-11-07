// Orchard Bakery: 3D models. Everything is built in code (no downloaded art),
// with smooth shading, soft colour variation and small details so items read as real.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// ---------- small helpers ----------
export function rand(seed) { // deterministic random, so the world looks the same every visit
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
export function noise3(x, y, z) { // smooth value noise, -1..1
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    const wgt = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    r += wgt * hash3(xi + dx, yi + dy, zi + dz);
  }
  return r * 2 - 1;
}
export function fbm(x, y, z) { return noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1; }

const C = (h) => new THREE.Color(h);
export { paint, displace, at, mesh, canvasTex, speckle };
// Paint per-vertex colours with a function of position.
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), c); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
// Colour whole triangles by their centre (for stripes and patches).
export function paintFaces(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    fn(x, y, z, c); for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function displace(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
// Merge geometries even if some have colours/uvs and others don't.
export function merge(list) {
  const keepIndex = list.every((g) => g.index);
  const norm = list.map((g) => {
    g = g.index && !keepIndex ? g.toNonIndexed() : g;
    if (!g.attributes.color) paint(g, (x, y, z, c) => c.setRGB(1, 1, 1));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(norm);
}
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);
  return g.applyMatrix4(m);
};
function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }

// ---------- canvas textures ----------
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(ctx, w, h, n, colors, size = [1, 3], alpha = [0.15, 0.4]) {
  const r = rand(w * 7 + n);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha[0] + r() * (alpha[1] - alpha[0]);
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}
const TEX = {};
export function textures() {
  if (TEX.wood) return TEX;
  TEX.wood = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#a77b52'; c.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let y = 0; y < h; y += 1) {
      const n = Math.sin(y * 0.21 + Math.sin(y * 0.047) * 3) * 0.5 + 0.5;
      c.fillStyle = `rgba(${90 + n * 40},${58 + n * 30},${32 + n * 18},${0.25 + r() * 0.2})`; c.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(60,38,20,.35)'; c.fillRect(0, (i + 1) * (h / 9) - 1, w, 2); } // plank gaps
    speckle(c, w, h, 900, ['#6b4a2c', '#c9a072'], [1, 2]);
  }, [1, 1]);
  TEX.brick = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d8cbb6'; c.fillRect(0, 0, w, h); // mortar
    const r = rand(9), rows = 10, bh = h / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * 0.5, bw = w / 6;
      for (let x = -1; x < 7; x++) {
        const t = r(); c.fillStyle = `rgb(${165 + t * 40},${78 + t * 30},${55 + t * 20})`;
        c.fillRect((x + off) * bw + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(c, w, h, 1500, ['#7a3a28', '#e0a080', '#5a2a1c'], [1, 2]);
  }, [3, 2]);
  TEX.stone = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#b9b2a6'; c.fillRect(0, 0, w, h);
    const r = rand(21);
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, rx = 14 + r() * 20, ry = 10 + r() * 12, t = r();
      c.fillStyle = `rgb(${160 + t * 50},${152 + t * 48},${140 + t * 44})`;
      c.beginPath(); c.ellipse(x, y, rx, ry, r() * 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(80,72,64,.45)'; c.lineWidth = 2; c.stroke();
    }
    speckle(c, w, h, 1200, ['#8b847a', '#ddd6cc'], [1, 2]);
  }, [2, 1]);
  TEX.plaster = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f2e3c6'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 2500, ['#e2cfa8', '#fff6e2', '#d8c49c'], [1, 4], [0.1, 0.3]);
  }, [2, 2]);
  TEX.awning = canvasTex(256, 64, (c, w, h) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fbf1df' : '#c8553d'; c.fillRect(i * w / 8, 0, w / 8, h); }
    speckle(c, w, h, 600, ['#000', '#fff'], [1, 2], [0.03, 0.08]);
  });
  TEX.wicker = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#b08850'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) {
      const o = (y / 8) % 2 ? 8 : 0;
      const g = c.createLinearGradient(x + o, y, x + o, y + 8); g.addColorStop(0, '#d9b47a'); g.addColorStop(1, '#8a6434');
      c.fillStyle = g; c.fillRect(x + o, y + 1, 14, 6);
    }
  }, [6, 2]);
  TEX.bark = canvasTex(64, 256, (c, w, h) => {
    c.fillStyle = '#6e5038'; c.fillRect(0, 0, w, h);
    const r = rand(5);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${40 + r() * 30},${28 + r() * 20},${18},.5)`; c.fillRect(r() * w, 0, 1 + r() * 3, h); }
    speckle(c, w, h, 500, ['#8d6c4e', '#3f2d1f'], [1, 3]);
  }, [2, 1]);
  return TEX;
}

// Shared materials
const MAT = {};
export function mats() {
  // Flat colours only, no textures: the bright toy-farm look from the Design art pack.
  if (MAT.apple) return MAT;
  const S = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {}));
  MAT.apple = S(0xe2362a); MAT.stem = S(0x6b3f1f); MAT.leaf = S(0x4fb33a, { side: THREE.DoubleSide });
  MAT.crust = S(0xd98a3a); MAT.tin = S(0xb5622d); MAT.filling = S(0xc8263d); MAT.bread = S(0xd98e3c); MAT.wheat = S(0xf4c843);
  MAT.gold = S(0xf7c232, { metalness: 0.35, roughness: 0.45, emissive: 0x5a3a00, emissiveIntensity: 0.25 });
  MAT.wood = S(0xc9884c); MAT.woodDark = S(0x8b5a34); MAT.beam = S(0x9a6237); MAT.brick = S(0xde7c47); MAT.stone = S(0xc9c3b3);
  MAT.plaster = S(0xfff1d9); MAT.awning = S(0xe8392f, { side: THREE.DoubleSide }); MAT.wicker = S(0xd9a16a, { side: THREE.DoubleSide });
  MAT.bark = S(0x8b5a34); MAT.foliage = S(0xffffff, { vertexColors: true, flatShading: true }); MAT.roof = S(0xffffff, { vertexColors: true });
  MAT.glass = S(0xffd45a, { emissive: 0xffb62e, emissiveIntensity: 0.6 }); MAT.white = S(0xfff6e6); MAT.iron = S(0x4a3a30);
  MAT.cloth = S(0xfff6e6, { side: THREE.DoubleSide }); MAT.fire = new THREE.MeshBasicMaterial({ color: 0xffa040 }); MAT.ember = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  MAT.dark = S(0x3a2216, { roughness: 1 });
  return MAT;
}

// ---------- food items ----------
const GEO = {};
function appleGeo() {
  if (GEO.apple) return GEO.apple;
  // Real apple profile: wide shoulders, narrower base, dimples top and bottom.
  const prof = [[0, 0.1], [0.22, 0.03], [0.48, 0.04], [0.72, 0.16], [0.9, 0.36], [0.98, 0.56], [0.95, 0.74], [0.82, 0.9], [0.6, 1.0], [0.36, 1.02], [0.16, 0.95], [0.04, 0.86], [0, 0.84]]
    .map(([r, y]) => new THREE.Vector2(r * 0.15, y * 0.28 - 0.14));
  const g = new THREE.LatheGeometry(prof, 28);
  displace(g, (v) => { const a = Math.atan2(v.z, v.x); const k = 1 + Math.sin(a * 5) * 0.025 * Math.min(1, Math.abs(v.y) * 8); v.x *= k; v.z *= k; });
  paint(g, (x, y, z, c) => {
    const a = Math.atan2(z, x), n = fbm(x * 30, y * 30, z * 30);
    const blush = THREE.MathUtils.clamp(0.75 + Math.cos(a) * 0.35 + n * 0.25 - (y > 0.1 ? 0.3 : 0), 0, 1);
    const streak = Math.max(0, Math.sin(a * 22 + n * 3)) * 0.15;
    c.copy(C(0xd9b44a)).lerp(C(0xb3201f), blush).lerp(C(0x7e1414), streak);
    if (Math.hypot(x, z) < 0.03 && y > 0.1) c.lerp(C(0x8a9a3a), 0.6);
  });
  const stem = at(new THREE.CylinderGeometry(0.006, 0.01, 0.07, 6), 0.006, 0.13, 0, 0, 0, -0.25);
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.03, 0.02, 0.07, 0); leafShape.quadraticCurveTo(0.03, -0.02, 0, 0);
  const leaf = at(new THREE.ShapeGeometry(leafShape, 6), 0.01, 0.15, 0, 0.6, 0.4, 0.4);
  GEO.apple = { body: g, stem, leaf };
  return GEO.apple;
}
function old_makeApple(withLeaf = true) {
  const m = mats(), g = appleGeo(), grp = new THREE.Group();
  grp.add(mesh(g.body, m.apple)); grp.add(mesh(g.stem, m.stem, false));
  if (withLeaf) grp.add(mesh(g.leaf, m.leaf, false));
  grp.userData.kind = 'apple';
  return grp;
}

function pieGeo() {
  if (GEO.pie) return GEO.pie;
  const R = 0.3;
  const tin = new THREE.LatheGeometry([[0, 0], [R * 0.82, 0], [R * 0.86, 0.01], [R * 1.02, 0.07], [R * 1.1, 0.075], [R * 1.1, 0.082], [R * 1.0, 0.08]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  // Domed top crust, a little uneven, browned at the high points.
  const top = new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  displace(top, (v) => { v.y = v.y * 0.24 + 0.07 + fbm(v.x * 9, 0, v.z * 9) * 0.008; });
  // Vent slits pressed into the crust
  const slits = [];
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; slits.push(at(new THREE.BoxGeometry(0.09, 0.012, 0.016), Math.cos(a) * 0.12, 0.138, Math.sin(a) * 0.12, 0, -a, 0)); }
  paint(top, (x, y, z, c) => {
    const n = fbm(x * 14, y * 14, z * 14), d = Math.hypot(x, z) / R;
    c.copy(C(0xe2a85c)).lerp(C(0x9a5520), THREE.MathUtils.clamp(0.45 + n * 0.7 + (1 - d) * 0.15, 0, 1));
    c.offsetHSL(0, 0, (hash3(x * 200, y * 200, z * 200) - 0.5) * 0.04); // sugar sparkle
  });
  // Crimped edge: a ring of pinched dough
  const crimps = [];
  for (let i = 0; i < 26; i++) {
    const a = i * Math.PI * 2 / 26;
    const s = new THREE.SphereGeometry(0.04, 10, 8);
    crimps.push(at(s, Math.cos(a) * R * 0.98, 0.083, Math.sin(a) * R * 0.98, 0, -a, 0.5, new THREE.Vector3(1.0, 0.7, 0.55)));
  }
  const crimp = merge(crimps);
  paint(crimp, (x, y, z, c) => c.copy(C(0xd89850)).lerp(C(0x8a4a18), THREE.MathUtils.clamp(0.4 + fbm(x * 20, y * 40, z * 20) * 0.7, 0, 1)));
  GEO.pie = { tin, crust: merge([top, crimp]), slits: merge(slits) };
  return GEO.pie;
}
function old_makePie() {
  const m = mats(), g = pieGeo(), grp = new THREE.Group();
  grp.add(mesh(g.tin, m.tin)); grp.add(mesh(g.crust, m.crust)); grp.add(mesh(g.slits, m.filling, false));
  grp.userData.kind = 'pie';
  return grp;
}

function breadGeo() {
  if (GEO.bread) return GEO.bread;
  // A rustic batard: long oval loaf, flat underside, deep golden crust that opens at the scores.
  const g = new THREE.SphereGeometry(1, 40, 24);
  displace(g, (v) => {
    const n = fbm(v.x * 3, v.y * 3, v.z * 3);
    const taper = 1 - Math.pow(Math.abs(v.x), 3) * 0.25;
    v.x *= 0.42; v.z *= 0.17 * taper * (1 + n * 0.05);
    v.y = v.y > 0 ? v.y * 0.17 * taper * (1 + n * 0.08) : v.y * 0.04;
    v.y += 0.04;
  });
  paint(g, (x, y, z, c) => {
    const n = fbm(x * 14, y * 14, z * 14);
    const top = THREE.MathUtils.clamp((y - 0.02) / 0.15, 0, 1);
    c.copy(C(0xd6a05e)).lerp(C(0x8c4a1a), THREE.MathUtils.clamp(top * 0.85 + n * 0.4, 0, 1));
    if (hash3(x * 90, y * 90, z * 90) > 0.9 && y > 0.12) c.lerp(C(0xf3eadb), 0.75); // flour dusting
  });
  // Diagonal scores across the top, pale where the dough opened
  const cuts = [];
  for (let i = -1; i <= 1; i++) cuts.push(at(new THREE.CapsuleGeometry(0.016, 0.1, 3, 8), i * 0.13, 0.205 - Math.abs(i) * 0.012, 0, Math.PI / 2, 0, 1.0, new THREE.Vector3(1, 1, 0.5)));
  const cut = merge(cuts);
  paint(cut, (x, y, z, c) => c.set(0xe9cf98));
  GEO.bread = { loaf: g, cut };
  return GEO.bread;
}
function old_makeBread() {
  const m = mats(), g = breadGeo(), grp = new THREE.Group();
  grp.add(mesh(g.loaf, m.bread)); grp.add(mesh(g.cut, m.bread, false));
  grp.userData.kind = 'bread';
  return grp;
}

export function wheatStalkGeo(r, count = 1, spread = 0) {
  // One stalk: thin stem + seed head made of little grains.
  const parts = [];
  for (let s = 0; s < count; s++) {
    const ox = (r() - 0.5) * spread, oz = (r() - 0.5) * spread, lean = (r() - 0.5) * 0.25, h = 0.75 + r() * 0.25;
    parts.push(at(new THREE.CylinderGeometry(0.006, 0.009, h, 4, 1, true), ox, h / 2, oz, lean, 0, lean * 0.6));
    const hx = ox + Math.sin(lean * 0.6) * -h * 0.5, hz = oz + Math.sin(lean) * h * 0.5;
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        parts.push(at(new THREE.SphereGeometry(0.014, 5, 4), hx + side * 0.012, h + i * 0.022, hz, 0, 0, side * 0.4, new THREE.Vector3(1, 1.6, 1)));
      }
    }
    parts.push(at(new THREE.CylinderGeometry(0.002, 0.002, 0.12, 3), hx, h + 0.2, hz, 0.1, 0, 0.1)); // awn
  }
  const g = merge(parts);
  paint(g, (x, y, z, c) => c.copy(C(0x9c8a3a)).lerp(C(0xe8c56a), THREE.MathUtils.clamp(y / 0.9, 0, 1)).offsetHSL(0, 0, (hash3(x * 40, y * 9, z * 40) - 0.5) * 0.08));
  return g;
}
function old_makeWheatBundle() {
  if (!GEO.sheaf) {
    const r = rand(77);
    const g = wheatStalkGeo(r, 9, 0.08);
    g.translate(0, -0.45, 0);
    GEO.sheaf = merge([g, paint(at(new THREE.TorusGeometry(0.05, 0.012, 6, 16), 0, -0.05, 0, Math.PI / 2), (x, y, z, c) => c.set(0xc8553d))]);
    GEO.sheaf.rotateZ(Math.PI / 2);
  }
  const grp = new THREE.Group();
  const m = mesh(GEO.sheaf, mats().wheat); m.scale.setScalar(0.7); m.position.y = 0.05; grp.add(m);
  grp.userData.kind = 'wheat';
  return grp;
}

function old_makeCoin() {
  if (!GEO.coin) GEO.coin = merge([new THREE.CylinderGeometry(0.09, 0.09, 0.022, 24), at(new THREE.TorusGeometry(0.085, 0.008, 6, 24), 0, 0.011, 0, Math.PI / 2), at(new THREE.TorusGeometry(0.085, 0.008, 6, 24), 0, -0.011, 0, Math.PI / 2)]);
  return mesh(GEO.coin, mats().gold, true, false);
}

function old_makeItem(kind) {
  if (kind === 'apple') return makeApple();
  if (kind === 'pie') return makePie();
  if (kind === 'bread') return makeBread();
  if (kind === 'wheat') return makeWheatBundle();
  if (kind === 'coin') return makeCoin();
  if (kind === 'jam') return makeJam();
}
// How items stack in hands, on tables and on shelves: [height, per layer, spacing]
export const STACK = { apple: [0.24, 3, 0.2], pie: [0.105, 1, 0], bread: [0.2, 2, 0.24], wheat: [0.13, 2, 0.2] };

// ---------- people ----------
const SKIN = [0xf1c9a5, 0xe0ac84, 0xc68a5f, 0x9c6a45, 0x70482c, 0xf6d6bd];
const HAIR = [0x3a2716, 0x5a3a22, 0x8a5a2e, 0xc9a25a, 0x1e1a18, 0x9a9590, 0xb5562e];
const SHIRT = [0x6a8fc0, 0x8fb86a, 0xe0b44a, 0xc97a9a, 0x7a6ab0, 0x5aa0a0, 0xd9825b, 0xe6e0d0];
const PANTS = [0x3d4a5c, 0x5a4a3a, 0x6a6a72, 0x2f3a4a, 0x7a5a48];
function smat(c, rough = 0.7) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough }); }

function old_makePerson(opts = {}) {
  const r = rand(opts.seed ?? 1);
  const pick = (a) => a[(r() * a.length) | 0];
  const skin = smat(opts.skin ?? pick(SKIN), 0.6), hair = smat(opts.hair ?? pick(HAIR), 0.55);
  const shirt = smat(opts.shirt ?? pick(SHIRT), 0.85), pants = smat(opts.pants ?? pick(PANTS), 0.85);
  const shoe = smat(0x3a2a20, 0.6);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const H = opts.height ?? (0.94 + r() * 0.1);
  body.scale.setScalar(H);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  const pelvis = mesh(at(new THREE.SphereGeometry(0.17, 16, 12), 0, 0.02, 0, 0, 0, 0, new THREE.Vector3(1, 0.7, 0.8)), pants); hips.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso);
  const chest = mesh(at(new THREE.CapsuleGeometry(0.17, 0.3, 6, 16), 0, 0.26, 0, 0, 0, 0, new THREE.Vector3(1.05, 1, 0.72)), shirt); torso.add(chest);
  if (opts.apron) {
    const ap = mesh(at(new THREE.CylinderGeometry(0.19, 0.24, 0.62, 18, 1, true, -1.1, 2.2), 0, 0.1, 0.0, 0, Math.PI / 2 - Math.PI / 2, 0, new THREE.Vector3(1, 1, 0.78)), mats().cloth);
    ap.rotation.y = 0; torso.add(ap); ap.position.z = 0.02;
    const strap = mesh(at(new THREE.TorusGeometry(0.14, 0.012, 6, 20, Math.PI), 0, 0.46, 0.06, 0.3, 0, 0), mats().cloth, false); torso.add(strap);
  }
  const neck = mesh(at(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), 0, 0.53, 0), skin); torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.72; head.scale.setScalar(1.5); torso.add(head); // big friendly toy heads
  head.add(mesh(at(new THREE.SphereGeometry(0.115, 24, 18), 0, 0, 0, 0, 0, 0, new THREE.Vector3(0.95, 1.05, 1)), skin));
  head.add(mesh(at(new THREE.SphereGeometry(0.02, 8, 6), 0, -0.01, 0.112), skin, false)); // nose
  const eyeM = smat(0x22160f, 0.3);
  for (const s of [-1, 1]) {
    head.add(mesh(at(new THREE.SphereGeometry(0.013, 8, 6), s * 0.042, 0.018, 0.1), eyeM, false));
    head.add(mesh(at(new THREE.SphereGeometry(0.022, 8, 6), s * 0.112, 0, 0, 0, 0, 0, new THREE.Vector3(0.5, 1, 0.8)), skin, false)); // ears
  }
  const style = opts.hairStyle ?? ((r() * 4) | 0);
  head.add(mesh(at(new THREE.SphereGeometry(0.123, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0.01, -0.012, -0.25), hair));
  if (style === 1) head.add(mesh(at(new THREE.SphereGeometry(0.055, 12, 10), 0, 0.08, -0.1), hair)); // bun
  if (style === 2) head.add(mesh(at(new THREE.CapsuleGeometry(0.1, 0.12, 4, 12), 0, -0.06, -0.06, 0, 0, 0, new THREE.Vector3(1.15, 1, 0.6)), hair)); // long hair
  if (opts.hat || style === 3) {
    const hatM = smat(opts.hat ? 0xffffff : 0xd8c08a, 0.8);
    if (opts.hat) head.add(mesh(at(new THREE.CylinderGeometry(0.13, 0.11, 0.13, 18), 0, 0.15, -0.01), hatM), mesh(at(new THREE.SphereGeometry(0.14, 16, 10), 0, 0.24, -0.01, 0, 0, 0, new THREE.Vector3(1, 0.55, 1)), hatM));
    else head.add(mesh(at(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), 0, 0.07, 0), hatM), mesh(at(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 18), 0, 0.12, 0), hatM));
  }
  const limb = (r0, r1, len, m) => { const g = new THREE.CapsuleGeometry((r0 + r1) / 2, len, 4, 10); g.translate(0, -len / 2, 0); return mesh(g, m); };
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.215, 0.44, 0); torso.add(sh);
    sh.add(mesh(at(new THREE.SphereGeometry(0.065, 12, 10), 0, 0, 0), shirt));
    const up = limb(0.055, 0.05, 0.22, shirt); sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    el.add(limb(0.045, 0.04, 0.2, opts.sleeves === false ? skin : skin));
    const hand = mesh(at(new THREE.SphereGeometry(0.045, 10, 8), 0, -0.26, 0, 0, 0, 0, new THREE.Vector3(0.8, 1, 0.6)), skin); el.add(hand);
    sh.rotation.z = s * 0.08;
    arms.push({ sh, el });
    const hip = new THREE.Group(); hip.position.set(s * 0.095, 0, 0); hips.add(hip);
    hip.add(limb(0.08, 0.07, 0.34, pants));
    const kn = new THREE.Group(); kn.position.y = -0.43; hip.add(kn);
    kn.add(limb(0.065, 0.055, 0.32, pants));
    const foot = mesh(at(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8), 0, -0.44, 0.04, Math.PI / 2, 0, 0, new THREE.Vector3(1.1, 1, 0.75)), shoe); kn.add(foot);
    legs.push({ hip, kn });
  }
  // A wooden tray held in front when carrying things
  const tray = new THREE.Group(); tray.position.set(0, 1.18 * H, 0.4); tray.scale.setScalar(1.25); root.add(tray); // goods read big and clear
  const trayBoard = mesh(at(new THREE.BoxGeometry(0.46, 0.03, 0.34), 0, -0.02, 0), mats().wood); tray.add(trayBoard);
  tray.visible = false;
  root.userData = { body, hips, torso, head, arms, legs, tray, phase: 0, H, sit: 0 };
  return root;
}

// Walk cycle driven by distance travelled so feet never slide.
function old_animatePerson(p, speed, dt, carrying, sitting = false) {
  const u = p.userData;
  const s = THREE.MathUtils.clamp(speed / 3.6, 0, 1);
  u.phase += speed * dt * (Math.PI * 2 / 1.25);
  const ph = u.phase, sw = 0.62 * s;
  u.sit += ((sitting ? 1 : 0) - u.sit) * Math.min(1, dt * 8);
  const sit = u.sit;
  u.legs.forEach((l, i) => {
    const sgn = i ? 1 : -1;
    const a = Math.sin(ph + (i ? Math.PI : 0));
    l.hip.rotation.x = a * sw * (1 - sit) - sit * 1.5;
    l.kn.rotation.x = Math.max(0, -Math.cos(ph + (i ? Math.PI : 0))) * 0.9 * s * (1 - sit) + sit * 1.5;
    void sgn;
  });
  const bob = Math.abs(Math.sin(ph)) * 0.035 * s;
  u.hips.position.y = 0.92 + bob - 0.02 * s - sit * 0.4;
  u.torso.rotation.x = 0.06 * s;
  u.torso.rotation.y = Math.sin(ph) * 0.08 * s;
  u.head.rotation.y = -Math.sin(ph) * 0.06 * s;
  u.arms.forEach((a, i) => {
    const sw2 = Math.sin(ph + (i ? 0 : Math.PI)) * 0.55 * s;
    const tx = carrying ? -1.25 : sw2 - sit * 0.5;
    const te = carrying ? -0.55 : -0.15 - Math.max(0, sw2) * 0.4 - sit * 0.6;
    a.sh.rotation.x += (tx - a.sh.rotation.x) * Math.min(1, dt * 14);
    a.el.rotation.x += (te - a.el.rotation.x) * Math.min(1, dt * 14);
    a.sh.rotation.z = (i ? 1 : -1) * (carrying ? 0.25 : 0.08);
  });
  u.tray.visible = carrying;
  u.tray.position.y = (1.12 + bob - sit * 0.4) * u.H;
}

// ---------- props ----------
function old_makeBasket(scale = 1) {
  const g = new THREE.Group(), m = mats();
  const prof = [[0.0, 0.0], [0.28, 0.0], [0.34, 0.05], [0.4, 0.3], [0.42, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(mesh(new THREE.LatheGeometry(prof, 28), m.wicker));
  g.add(mesh(at(new THREE.TorusGeometry(0.42, 0.025, 8, 32), 0, 0.32, 0, Math.PI / 2), m.wicker));
  g.scale.setScalar(scale);
  return g;
}
function old_makeBarrel() {
  const g = new THREE.Group(), m = mats();
  const prof = []; for (let i = 0; i <= 10; i++) { const y = i / 10; prof.push(new THREE.Vector2(0.3 + Math.sin(y * Math.PI) * 0.06, y * 0.85)); }
  g.add(mesh(new THREE.LatheGeometry(prof, 20), m.woodDark));
  for (const y of [0.12, 0.42, 0.73]) g.add(mesh(at(new THREE.TorusGeometry(0.3 + Math.sin((y / 0.85) * Math.PI) * 0.06 + 0.005, 0.014, 6, 24), 0, y, 0, Math.PI / 2), m.iron));
  g.add(mesh(at(new THREE.CircleGeometry(0.3, 20), 0, 0.85, 0, -Math.PI / 2), m.wood));
  return g;
}
function old_makeCrate(w = 0.6, h = 0.45, d = 0.45) {
  const g = new THREE.Group(), m = mats();
  for (let i = 0; i < 3; i++) g.add(mesh(at(new THREE.BoxGeometry(w, h / 3 - 0.02, 0.03), 0, h / 6 + i * h / 3, d / 2), m.wood), mesh(at(new THREE.BoxGeometry(w, h / 3 - 0.02, 0.03), 0, h / 6 + i * h / 3, -d / 2), m.wood));
  for (let i = 0; i < 3; i++) g.add(mesh(at(new THREE.BoxGeometry(0.03, h / 3 - 0.02, d), w / 2, h / 6 + i * h / 3, 0), m.wood), mesh(at(new THREE.BoxGeometry(0.03, h / 3 - 0.02, d), -w / 2, h / 6 + i * h / 3, 0), m.wood));
  g.add(mesh(at(new THREE.BoxGeometry(w, 0.03, d), 0, 0.03, 0), m.woodDark));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(mesh(at(new THREE.BoxGeometry(0.05, h, 0.05), x * w / 2, h / 2, z * d / 2), m.woodDark));
  return g;
}
function old_makeTable(w = 1.2, d = 0.7, h = 0.78, m2) {
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.BoxGeometry(w, 0.05, d), 0, h, 0), m2 || m.wood));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(mesh(at(new THREE.BoxGeometry(0.06, h, 0.06), x * (w / 2 - 0.06), h / 2, z * (d / 2 - 0.06)), m.woodDark));
  return g;
}
function old_makeChair() {
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0, 0.46, 0), m.wood));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(mesh(at(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6), x * 0.18, 0.23, z * 0.18), m.woodDark));
  for (const x of [-1, 1]) g.add(mesh(at(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), x * 0.18, 0.71, -0.19), m.woodDark));
  for (const y of [0.62, 0.8, 0.94]) g.add(mesh(at(new THREE.BoxGeometry(0.4, 0.05, 0.025), 0, y, -0.19), m.wood));
  return g;
}
function old_makeLamp() {
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.CylinderGeometry(0.045, 0.06, 2.4, 10), 0, 1.2, 0), m.iron));
  g.add(mesh(at(new THREE.BoxGeometry(0.4, 0.04, 0.04), 0.16, 2.3, 0), m.iron));
  const lantern = new THREE.Group(); lantern.position.set(0.34, 2.05, 0); g.add(lantern);
  lantern.add(mesh(at(new THREE.BoxGeometry(0.18, 0.24, 0.18), 0, 0, 0), new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd88a, emissiveIntensity: 0.4, roughness: 0.3 })));
  lantern.add(mesh(at(new THREE.ConeGeometry(0.15, 0.12, 4), 0, 0.18, 0, 0, Math.PI / 4), m.iron));
  return g;
}
function old_makeBench() {
  const g = new THREE.Group(), m = mats();
  for (let i = 0; i < 3; i++) g.add(mesh(at(new THREE.BoxGeometry(1.6, 0.04, 0.12), 0, 0.45, -0.14 + i * 0.14), m.wood));
  for (let i = 0; i < 2; i++) g.add(mesh(at(new THREE.BoxGeometry(1.6, 0.1, 0.03), 0, 0.68 + i * 0.16, -0.24, -0.15), m.wood));
  for (const x of [-0.7, 0.7]) g.add(mesh(at(new THREE.BoxGeometry(0.06, 0.45, 0.42), x, 0.22, -0.05), m.iron), mesh(at(new THREE.BoxGeometry(0.05, 0.5, 0.05), x, 0.7, -0.26, -0.15), m.iron));
  return g;
}
function old_makeUmbrella(color = 0xc8553d) {
  const g = new THREE.Group(), m = mats();
  g.add(mesh(at(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8), 0, 1.15, 0), m.wood));
  const can = new THREE.ConeGeometry(1.25, 0.42, 12, 1, true).toNonIndexed();
  paintFaces(can, (x, y, z, c) => { const a = Math.atan2(z, x); c.set(Math.floor((a + Math.PI) / (Math.PI * 2) * 12 + 0.5) % 2 ? color : 0xfbf1df); });
  g.add(mesh(at(can, 0, 2.2, 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })));
  return g;
}

// ---------- jam ----------
function gingham() {
  if (TEX.gingham) return TEX.gingham;
  TEX.gingham = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#fbf3e6'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(200,85,61,.55)';
    for (let i = 0; i < 4; i++) { c.fillRect(i * 16, 0, 8, h); c.fillRect(0, i * 16, w, 8); }
  }, [2, 2]);
  return TEX.gingham;
}
function old_makeJam() {
  if (!GEO.jar) {
    const prof = [[0, 0], [0.085, 0], [0.095, 0.012], [0.095, 0.15], [0.08, 0.17], [0.075, 0.19]].map(([r, y]) => new THREE.Vector2(r, y));
    GEO.jar = new THREE.LatheGeometry(prof, 28);
    GEO.jamFill = new THREE.CylinderGeometry(0.088, 0.088, 0.14, 24); GEO.jamFill.translate(0, 0.08, 0);
    const lid = new THREE.CylinderGeometry(0.115, 0.13, 0.035, 24, 1, false);
    displace(lid, (v) => { if (v.y < 0) { const a = Math.atan2(v.z, v.x); v.y -= 0.02 + Math.max(0, Math.sin(a * 8)) * 0.02; } });
    lid.translate(0, 0.205, 0); GEO.lid = lid;
    GEO.band = at(new THREE.TorusGeometry(0.081, 0.006, 6, 24), 0, 0.185, 0, Math.PI / 2);
    GEO.label = new THREE.CylinderGeometry(0.0965, 0.0965, 0.05, 24, 1, true, -0.9, 1.8); GEO.label.translate(0, 0.08, 0);
  }
  if (!MAT.jarGlass) {
    MAT.jarGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
    MAT.jam = new THREE.MeshPhysicalMaterial({ color: 0x8e1a1f, roughness: 0.25, clearcoat: 0.6, sheen: 0.2 });
    MAT.lid = new THREE.MeshStandardMaterial({ map: gingham(), roughness: 0.9 });
    MAT.string = new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.9 });
    MAT.label = new THREE.MeshStandardMaterial({ color: 0xf6ecd6, roughness: 0.8 });
  }
  const g = new THREE.Group();
  g.add(mesh(GEO.jamFill, MAT.jam)); g.add(mesh(GEO.jar, MAT.jarGlass, false, false));
  g.add(mesh(GEO.label, MAT.label, false)); g.add(mesh(GEO.lid, MAT.lid)); g.add(mesh(GEO.band, MAT.string, false));
  g.userData.kind = 'jam';
  return g;
}

// =====================================================================
// Toy-farm art (from the Design art pack, art.js): chunky bevelled shapes, flat bright colours.
// Static pieces are merged into one vertex-coloured mesh each, so phones draw them quickly.
// =====================================================================
import * as OB from './art.js';
export const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const _m4 = new THREE.Matrix4();
// Merge every plain mesh under root into a few vertex-coloured meshes. keep(mesh) = leave that mesh as its own object.
export function bakeStatic(root, keep = () => false) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = {}, kept = [];
  root.traverse((o) => {
    if (!o.isMesh || o === root) return;
    const m = o.material;
    if (Array.isArray(m) || o.isInstancedMesh || o.isSkinnedMesh || m.transparent || m.map || m.type !== 'MeshStandardMaterial' && m.type !== 'MeshPhysicalMaterial' || (m.emissive && m.emissiveIntensity > 0.3 && m.emissive.getHex() !== 0) || keep(o)) { kept.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    _m4.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(_m4);
    if (m.flatShading || !g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = m.color;
    const src = m.vertexColors && g.attributes.color;
    for (let i = 0; i < n; i++) { col[i * 3] = src ? src.getX(i) * c.r : c.r; col[i * 3 + 1] = src ? src.getY(i) * c.g : c.g; col[i * 3 + 2] = src ? src.getZ(i) * c.b : c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const key = (o.castShadow ? 'c' : '-') + (o.receiveShadow ? 'r' : '-');
    (buckets[key] || (buckets[key] = [])).push(g);
  });
  const out = new THREE.Group();
  for (const key of Object.keys(buckets)) {
    const me = new THREE.Mesh(mergeGeometries(buckets[key], false), VC); me.castShadow = key[0] === 'c'; me.receiveShadow = key[1] === 'r'; out.add(me);
  }
  for (const o of kept) { o.updateMatrixWorld(true); _m4.multiplyMatrices(inv, o.matrixWorld); o.parent.remove(o); _m4.decompose(o.position, o.quaternion, o.scale); out.add(o); }
  return out;
}
export function bakeGeo(build) { // one merged geometry from a builder
  const tmp = new THREE.Group(); build(tmp);
  const b = bakeStatic(tmp); const geos = [];
  b.traverse((o) => { if (o.isMesh && o.material === VC) geos.push(o.geometry); });
  return geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
}
// Fit a geometry inside the box an item used to fill, so stacks, trays and shelves still line up.
function fitGeo(g, min, max) {
  g.computeBoundingBox(); const b = g.boundingBox, sz = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(sz); b.getCenter(c);
  const kxz = Math.min((max[0] - min[0]) / sz.x, (max[2] - min[2]) / sz.z), ky = Math.min((max[1] - min[1]) / sz.y, kxz);
  g.translate(-c.x, -b.min.y, -c.z); g.scale(kxz, ky, kxz); g.translate((min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2);
  return g;
}
const ITEM_BOX = {
  apple: [[-0.147, -0.132, -0.147], [0.147, 0.187, 0.147]], pie: [[-0.332, 0, -0.33], [0.332, 0.144, 0.33]], bread: [[-0.42, 0, -0.175], [0.42, 0.213, 0.168]],
  wheat: [[-0.561, 0.001, -0.07], [0.315, 0.12, 0.07]], coin: [[-0.093, -0.018, -0.093], [0.093, 0.018, 0.093]], jam: [[-0.13, 0, -0.13], [0.13, 0.222, 0.13]],
  berry: [[-0.055, -0.07, -0.055], [0.055, 0.087, 0.055]], egg: [[-0.05, 0, -0.05], [0.05, 0.128, 0.05]], milk: [[-0.058, 0, -0.058], [0.058, 0.297, 0.058]],
  comb: [[-0.18, 0, -0.115], [0.18, 0.05, 0.115]], custard: [[-0.094, 0, -0.094], [0.094, 0.06, 0.094]], butter: [[-0.079, 0, -0.05], [0.079, 0.075, 0.05]],
  tart: [[-0.201, 0, -0.201], [0.201, 0.22, 0.201]], honey: [[-0.09, 0, -0.09], [0.09, 0.21, 0.09]], cheese: [[-0.111, 0, -0.111], [0.111, 0.08, 0.111]],
  cider: [[-0.05, 0, -0.05], [0.05, 0.311, 0.051]]
};
const { rb, cyl, sph, add, M, F } = OB;
const ITEM_BUILD = {
  apple: (g) => OB.apple(g, 0, 0, 0, 0.13),
  pie: (g) => OB.pie(g, 0, 0, 0, 1),
  bread: (g) => OB.bread(g, 0, 0, 0, 1),
  jam: (g) => OB.jar(g, 0, 0, 0, 1),
  coin: (g) => cyl(g, 0.15, 0.15, 0.05, '#F7C232', 0, 0, 0, 20),
  wheat: (g) => { // a tied sheaf lying on its side
    for (let i = 0; i < 7; i++) { const z = (i % 3 - 1) * 0.05, y = Math.floor(i / 3) * 0.05; cyl(g, 0.018, 0.018, 0.62, '#E6B84A', -0.05, y, z, 5, { rz: Math.PI / 2 }); add(g, new THREE.CapsuleGeometry(0.05, 0.16, 3, 6), F('#F4C843'), 0.32, y, z, { rz: Math.PI / 2 }); }
    cyl(g, 0.11, 0.11, 0.05, '#D8392E', -0.05, 0.04, 0, 10, { rz: Math.PI / 2 });
  },
  berry: (g) => { sph(g, 0.1, '#E8302A', 0, 0.1, 0, { s: [1, 1.15, 1] }); add(g, new THREE.ConeGeometry(0.08, 0.06, 5), F('#4FB33A'), 0, 0.22, 0, { rx: Math.PI }); for (let i = 0; i < 6; i++) sph(g, 0.012, '#FFE07A', Math.cos(i) * 0.09, 0.08 + (i % 3) * 0.04, Math.sin(i) * 0.09); },
  egg: (g) => sph(g, 0.1, '#FFF4DC', 0, 0.12, 0, { s: [0.85, 1.15, 0.85] }),
  milk: (g) => { cyl(g, 0.1, 0.11, 0.32, '#FFFFFF', 0, 0.16, 0, 16); cyl(g, 0.06, 0.1, 0.1, '#FFFFFF', 0, 0.37, 0, 16); cyl(g, 0.065, 0.065, 0.06, '#3C7FD6', 0, 0.45, 0, 14); rb(g, 0.14, 0.1, 0.02, '#3C7FD6', 0, 0.16, 0.105, 0.01); },
  comb: (g) => { rb(g, 0.5, 0.08, 0.32, '#E7A21A', 0, 0.04, 0, 0.03); for (let i = 0; i < 6; i++) cyl(g, 0.055, 0.055, 0.03, '#F7C23E', -0.16 + (i % 3) * 0.16, 0.09, -0.07 + Math.floor(i / 3) * 0.14, 6); },
  custard: (g) => { cyl(g, 0.3, 0.24, 0.12, '#D98A3A', 0, 0.06, 0, 18); cyl(g, 0.26, 0.26, 0.05, '#FFE07A', 0, 0.12, 0, 18); sph(g, 0.05, '#E8302A', 0, 0.16, 0); },
  butter: (g) => { rb(g, 0.4, 0.04, 0.28, '#DDEBF5', 0, 0.02, 0, 0.015); rb(g, 0.3, 0.16, 0.18, '#F9D65A', 0, 0.12, 0, 0.04); },
  tart: (g) => { cyl(g, 0.3, 0.25, 0.12, '#B5622D', 0, 0.06, 0, 20); cyl(g, 0.27, 0.27, 0.05, '#F2B65A', 0, 0.13, 0, 20); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; sph(g, 0.06, '#E8302A', Math.cos(a) * 0.16, 0.18, Math.sin(a) * 0.16, { s: [1, 1.15, 1] }); } sph(g, 0.07, '#E8302A', 0, 0.19, 0); },
  honey: (g) => { OB.jar(g, 0, 0, 0, 1, '#F0A21C'); },
  cheese: (g) => { cyl(g, 0.3, 0.3, 0.22, '#F6C640', 0, 0.11, 0, 18); cyl(g, 0.28, 0.28, 0.02, '#FCE07A', 0, 0.225, 0, 18); },
  cider: (g) => { cyl(g, 0.1, 0.1, 0.36, '#C7782A', 0, 0.18, 0, 14); cyl(g, 0.05, 0.09, 0.1, '#C7782A', 0, 0.41, 0, 14); cyl(g, 0.055, 0.055, 0.06, '#3E9A30', 0, 0.48, 0, 12); rb(g, 0.15, 0.12, 0.02, '#FFF6E6', 0, 0.18, 0.1, 0.01); }
};
const ITEM_GEO = {};
export function makeToyItem(kind) {
  if (!ITEM_BUILD[kind]) return null;
  if (!ITEM_GEO[kind]) ITEM_GEO[kind] = fitGeo(bakeGeo(ITEM_BUILD[kind]), ...ITEM_BOX[kind]);
  const grp = new THREE.Group(); const me = new THREE.Mesh(ITEM_GEO[kind], VC); me.castShadow = true; me.receiveShadow = true; grp.add(me);
  grp.userData.kind = kind;
  return grp;
}
export function makeApple() { return makeToyItem('apple'); }
export function makePie() { return makeToyItem('pie'); }
export function makeBread() { return makeToyItem('bread'); }
export function makeWheatBundle() { return makeToyItem('wheat'); }
export function makeJam() { return makeToyItem('jam'); }
export function makeCoin() { const g = makeToyItem('coin'); const m = g.children[0]; g.remove(m); m.receiveShadow = false; return m; }
export function makeItem(kind) { return makeToyItem(kind); }

// ---------- props ----------
const bakeProp = (build) => { const g = new THREE.Group(); build(g); return bakeStatic(g); };
export function makeBasket(scale = 1) {
  return bakeProp((g) => { cyl(g, 0.42 * scale, 0.32 * scale, 0.32 * scale, '#D9A16A', 0, 0.16 * scale, 0, 18); cyl(g, 0.44 * scale, 0.44 * scale, 0.06 * scale, '#B9773F', 0, 0.32 * scale, 0, 18); cyl(g, 0.38 * scale, 0.38 * scale, 0.02 * scale, '#8B5A34', 0, 0.3 * scale, 0, 18); });
}
export function makeBarrel() {
  return bakeProp((g) => { cyl(g, 0.34, 0.3, 0.85, '#C9884C', 0, 0.425, 0, 16); for (const y of [0.15, 0.7]) cyl(g, 0.36, 0.36, 0.07, '#7A4C2C', 0, y, 0, 16); cyl(g, 0.3, 0.3, 0.02, '#E3A462', 0, 0.86, 0, 16); });
}
export function makeCrate(w = 0.6, h = 0.45, d = 0.45) {
  return bakeProp((g) => { rb(g, w, h, d, '#C9884C', 0, h / 2, 0, 0.05); rb(g, w + 0.02, 0.07, d + 0.02, '#9A6237', 0, h - 0.04, 0, 0.02); rb(g, w * 0.8, 0.06, 0.02, '#9A6237', 0, h / 2, d / 2 + 0.005, 0.01); });
}
export function makeTable(w = 1.2, d = 0.7, h = 0.78, m2) {
  const top = m2 && m2.color ? '#' + m2.color.getHexString() : '#E3A462';
  return bakeProp((g) => { rb(g, w, 0.1, d, top, 0, h - 0.03, 0, 0.04); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rb(g, 0.1, h - 0.05, 0.1, '#9A6237', x * (w / 2 - 0.09), (h - 0.05) / 2, z * (d / 2 - 0.09), 0.03); });
}
export function makeChair() {
  return bakeProp((g) => { rb(g, 0.44, 0.08, 0.44, '#E3A462', 0, 0.46, 0, 0.03); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rb(g, 0.07, 0.44, 0.07, '#9A6237', x * 0.17, 0.22, z * 0.17, 0.02); rb(g, 0.44, 0.42, 0.07, '#C9884C', 0, 0.72, -0.19, 0.03); });
}
export function makeLamp() {
  const g = new THREE.Group();
  cyl(g, 0.06, 0.08, 2.3, '#4A3A30', 0, 1.15, 0, 8); rb(g, 0.42, 0.06, 0.06, '#4A3A30', 0.16, 2.28, 0, 0.02);
  rb(g, 0.22, 0.26, 0.22, M('#FFE9A8', { emissive: '#FFD45A', emissiveIntensity: 0.8 }), 0.34, 2.05, 0, 0.04); add(g, new THREE.ConeGeometry(0.17, 0.12, 4), M('#4A3A30'), 0.34, 2.24, 0, { ry: Math.PI / 4 });
  return bakeStatic(g);
}
export function makeBench() {
  return bakeProp((g) => { rb(g, 1.6, 0.1, 0.42, '#E3A462', 0, 0.45, 0, 0.04); rb(g, 1.6, 0.3, 0.08, '#C9884C', 0, 0.75, -0.2, 0.04); for (const x of [-0.65, 0.65]) rb(g, 0.1, 0.42, 0.38, '#9A6237', x, 0.21, 0, 0.03); });
}
export function makeUmbrella(color = 0xe8392f) {
  const g = new THREE.Group();
  cyl(g, 0.04, 0.04, 2.3, '#9A6237', 0, 1.15, 0, 8);
  for (let i = 0; i < 8; i++) add(g, new THREE.ConeGeometry(1.2, 0.45, 8, 1, false, i * Math.PI / 4, Math.PI / 4), M(i % 2 ? '#FFF6E6' : '#' + new THREE.Color(color).getHexString()), 0, 2.2, 0);
  sph(g, 0.07, '#9A6237', 0, 2.45, 0);
  return bakeStatic(g);
}

// ---------- people: chibi characters with big heads ----------
const SKIN2 = ['#F6C8A0', '#F1B98E', '#E3A47A', '#B9784C', '#8A5636', '#FAD7B8'];
const HAIR2 = ['#7A4220', '#2A1A10', '#E8B04A', '#B5562E', '#5A3A22', '#C9C0B8'];
const SHIRT2 = ['#F08A3C', '#8A62D6', '#E5486A', '#2FA6A0', '#3C7FD6', '#F2C94C', '#45A53A', '#FF7FA6'];
const PANTS2 = ['#3A3554', '#2F4A7A', '#5A3A2A', '#3A5A3A', '#4A4A58'];
const hexOf = (c, d) => (c == null ? d : typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);
const PERSON_SCALE = 1.2;
export function makePerson(opts = {}) {
  const r = rand(opts.seed ?? 1); const pick = (a) => a[(r() * a.length) | 0];
  const skin = hexOf(opts.skin, pick(SKIN2)), hair = hexOf(opts.hair, pick(HAIR2)), shirt = hexOf(opts.shirt, pick(SHIRT2)), pants = hexOf(opts.pants, pick(PANTS2));
  const style = opts.hairStyle ?? ((r() * 4) | 0); // 0 short, 1 bun + dress, 2 long, 3 straw hat
  const dress = opts.dress ?? (style === 1 || (style === 2 && r() > 0.5));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const H = opts.height ?? (0.94 + r() * 0.1), k = PERSON_SCALE * H; body.scale.setScalar(k);
  const HIP = 0.37;
  const hips = new THREE.Group(); hips.position.y = HIP; body.add(hips);
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sd * 0.12, 0, 0); hips.add(hip);
    const kn = new THREE.Group(); hip.add(kn);
    rb(kn, 0.17, 0.3, 0.2, pants, 0, -0.15, 0, 0.06); rb(kn, 0.2, 0.1, 0.28, '#4A2E1E', 0, -0.31, 0.04, 0.04);
    legs.push({ hip, kn });
  }
  const torso = new THREE.Group(); hips.add(torso);
  const tb = new THREE.Group(); torso.add(tb); // static torso parts, merged below
  add(tb, new THREE.CapsuleGeometry(0.3, 0.28, 6, 14), M(shirt), 0, 0.31, 0, { s: [1, 1, 0.85] });
  if (opts.apron) { rb(tb, 0.46, 0.42, 0.06, '#FFFFFF', 0, 0.25, 0.25, 0.04); rb(tb, 0.06, 0.2, 0.05, '#FFFFFF', -0.14, 0.53, 0.2, 0.02); rb(tb, 0.06, 0.2, 0.05, '#FFFFFF', 0.14, 0.53, 0.2, 0.02); }
  if (dress) add(tb, new THREE.ConeGeometry(0.42, 0.55, 14, 1, true), M(shirt), 0, 0.13, 0);
  const head = new THREE.Group(); head.position.y = 0.93; torso.add(head);
  const hb = new THREE.Group(); head.add(hb);
  sph(hb, 0.36, skin, 0, 0, 0);
  for (const sx of [-1, 1]) { sph(hb, 0.05, '#2A1A10', sx * 0.13, 0.03, 0.32); sph(hb, 0.016, '#FFFFFF', sx * 0.13 + 0.015, 0.05, 0.365); sph(hb, 0.06, '#FF9A8A', sx * 0.22, -0.08, 0.27, { s: [1, 0.7, 0.4] }); }
  add(hb, new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), M('#7A3A2A'), 0, -0.09, 0.33, { rz: Math.PI });
  sph(hb, 0.045, '#EBA982', 0, -0.03, 0.36);
  if (opts.hat === true || opts.hat === 'chef') {
    cyl(hb, 0.27, 0.25, 0.22, '#FFFFFF', 0, 0.33, 0, 18);
    [[-0.13, 0], [0.13, 0], [0, 0.1], [0, -0.1]].forEach((c) => sph(hb, 0.2, '#FFFFFF', c[0], 0.5, c[1])); sph(hb, 0.2, '#FFFFFF', 0, 0.58, 0);
  } else if (opts.hat === 'cap') {
    add(hb, new THREE.SphereGeometry(0.37, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(hexOf(opts.capColor, '#F07A2A')), 0, 0.06, 0);
    rb(hb, 0.42, 0.04, 0.3, hexOf(opts.capColor, '#F07A2A'), 0, 0.08, 0.38, 0.02);
  } else if (style === 3) {
    cyl(hb, 0.62, 0.62, 0.04, '#F2C25A', 0, 0.25, 0, 22); cyl(hb, 0.3, 0.33, 0.24, '#F2C25A', 0, 0.37, 0, 18); cyl(hb, 0.335, 0.335, 0.07, pick(['#D8392E', '#3C7FD6', '#45A53A']), 0, 0.3, 0, 18);
  } else {
    add(hb, new THREE.SphereGeometry(0.385, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), M(hair), 0, 0.03, -0.02);
    if (style === 1) sph(hb, 0.16, hair, 0, 0.4, -0.12);
    if (style === 2) add(hb, new THREE.CapsuleGeometry(0.22, 0.2, 4, 10), M(hair), 0, -0.12, -0.2, { s: [1.5, 1, 0.7] });
  }
  for (const sd of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sd * 0.33, 0.48, 0); torso.add(sh);
    const el = new THREE.Group(); sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.08, 0.26, 4, 8), M(shirt), 0, -0.18, 0); sph(el, 0.09, skin, 0, -0.38, 0);
    sh.rotation.z = sd * 0.25;
    arms.push({ sh, el, sd });
  }
  // merge each rigid part so a person is only a handful of draw calls
  const bakeInto = (grp) => { const b = bakeStatic(grp); while (grp.children.length) grp.remove(grp.children[0]); for (const c of [...b.children]) grp.add(c); };
  for (const l of legs) bakeInto(l.kn);
  bakeInto(tb); bakeInto(hb); for (const a of arms) bakeInto(a.el);
  // the carry tray, held out in front of the chest
  const tray = new THREE.Group(); tray.position.set(0, 0.95 * k, 0.58 * k); tray.scale.setScalar(1.25); root.add(tray);
  const board = bakeProp((g) => rb(g, 0.5, 0.05, 0.38, '#B9773F', 0, -0.025, 0, 0.02)); tray.add(board);
  tray.visible = false;
  root.userData = { body, hips, torso, head, arms, legs, tray, phase: 0, H, k, sit: 0, idle: r() * 6, HIP };
  return root;
}
// Walk cycle driven by distance travelled so feet never slide; a gentle bob when standing still.
export function animatePerson(p, speed, dt, carrying, sitting = false) {
  const u = p.userData;
  const s = THREE.MathUtils.clamp(speed / 3.6, 0, 1);
  u.phase += speed * dt * (Math.PI * 2 / 1.05);
  u.idle += dt * (Math.PI * 2 / 1.2);
  const ph = u.phase, sw = 0.7 * s;
  u.sit += ((sitting ? 1 : 0) - u.sit) * Math.min(1, dt * 8);
  const sit = u.sit;
  u.legs.forEach((l, i) => { l.hip.rotation.x = Math.sin(ph + (i ? Math.PI : 0)) * sw * (1 - sit) - sit * 1.45; });
  const bob = Math.abs(Math.sin(ph)) * 0.05 * s + Math.sin(u.idle) * 0.02 * (1 - s);
  u.hips.position.y = u.HIP + bob - sit * 0.2;
  u.torso.rotation.x = 0.05 * s;
  u.torso.rotation.y = Math.sin(ph) * 0.07 * s;
  u.head.rotation.z = Math.sin(ph) * 0.05 * s;
  u.arms.forEach((a, i) => {
    const sw2 = Math.sin(ph + (i ? 0 : Math.PI)) * 0.7 * s;
    const tx = carrying ? -1.2 : sw2 - sit * 0.4;
    a.sh.rotation.x += (tx - a.sh.rotation.x) * Math.min(1, dt * 16);
    a.el.rotation.x = 0;
    a.sh.rotation.z = a.sd * (carrying ? 0.05 : 0.25);
  });
  u.tray.visible = carrying;
  u.tray.position.y = (0.95 + (bob - sit * 0.2)) * u.k;
}
