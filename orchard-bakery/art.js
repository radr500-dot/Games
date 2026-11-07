/**
 * Art pack from Design (Orchard Bakery art handoff). Helpers are exported too so the game can build its own pieces in the same style.
 * Orchard Bakery: procedural low-poly 3D models (three.js r160+).
 * Every builder adds meshes to a parent (Scene or Group) and returns a THREE.Group.
 * Units: 1 unit ~ 1 metre-ish. Characters are ~2.6 units tall at default scale 1.35.
 * Builders face +Z (toward the default camera). Rotate with the returned group.rotation.y.
 */
import * as THREE from 'three';
const T = THREE;
const mats = {};
function M(c, o) {
  const k = c + JSON.stringify(o || {});
  if (!mats[k]) mats[k] = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {}));
  return mats[k];
}
const F = (c) => M(c, { flatShading: true });
const geos = {};
function rboxGeo(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const k = [w, h, d, r].join(',');
  if (geos[k]) return geos[k];
  const W = w - 2 * r, H = h - 2 * r;
  const s = new T.Shape();
  s.moveTo(-W / 2, -H / 2); s.lineTo(W / 2, -H / 2); s.lineTo(W / 2, H / 2); s.lineTo(-W / 2, H / 2); s.lineTo(-W / 2, -H / 2);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(d - 2 * r, 0.0001), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  geos[k] = g;
  return g;
}
function add(p, geo, m, x, y, z, o) {
  o = o || {};
  const me = new T.Mesh(geo, m);
  me.position.set(x || 0, y || 0, z || 0);
  me.castShadow = o.cast !== false; me.receiveShadow = true;
  if (o.rx) me.rotation.x = o.rx; if (o.ry) me.rotation.y = o.ry; if (o.rz) me.rotation.z = o.rz;
  if (o.s) me.scale.set(o.s[0], o.s[1], o.s[2]);
  p.add(me); return me;
}
function rb(p, w, h, d, c, x, y, z, r, o) { return add(p, rboxGeo(w, h, d, r == null ? 0.06 : r), typeof c === 'string' || typeof c === 'number' ? M(c) : c, x, y, z, o); }
function cyl(p, rt, rbm, h, c, x, y, z, seg, o) { return add(p, new T.CylinderGeometry(rt, rbm, h, seg || 20), typeof c === 'object' ? c : M(c), x, y, z, o); }
function sph(p, r, c, x, y, z, o) { return add(p, new T.SphereGeometry(r, 20, 14), typeof c === 'object' ? c : M(c), x, y, z, o); }
function G(p, x, y, z, ry, s) { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); if (ry) g.rotation.y = ry; if (s) g.scale.setScalar(s); if (p) p.add(g); return g; }
let seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

// ---------- props ----------
function apple(p, x, y, z, r) {
  r = r || 0.12; const g = G(p, x, y, z);
  sph(g, r, '#E2362A', 0, 0, 0, { s: [1, 0.92, 1] });
  cyl(g, 0.012, 0.012, r * 0.6, '#6B3F1F', 0, r * 0.95, 0, 6);
  add(g, new T.SphereGeometry(r * 0.35, 8, 6), M('#4FB33A'), r * 0.3, r * 1.0, 0, { s: [1.3, 0.35, 0.7] });
  return g;
}
function pie(p, x, y, z, s) {
  const g = G(p, x, y, z, 0, s || 1);
  cyl(g, 0.3, 0.25, 0.1, '#B5622D', 0, 0.05, 0, 24);
  cyl(g, 0.29, 0.3, 0.07, '#F2B65A', 0, 0.13, 0, 24);
  for (let i = -1; i <= 1; i++) {
    rb(g, 0.05, 0.03, 0.52, '#D98A3A', i * 0.14, 0.175, 0, 0.012);
    rb(g, 0.52, 0.03, 0.05, '#D98A3A', 0, 0.18, i * 0.14, 0.012);
  }
  return g;
}
function bread(p, x, y, z, s, ry) {
  const g = G(p, x, y, z, ry || 0, s || 1);
  add(g, new T.CapsuleGeometry(0.14, 0.26, 6, 14), M('#D98E3C'), 0, 0.12, 0, { rz: Math.PI / 2, s: [0.8, 1, 1] });
  for (let i = -1; i <= 1; i++) rb(g, 0.03, 0.02, 0.18, '#F5C77A', i * 0.11, 0.235, 0, 0.008, { ry: 0.5 });
  return g;
}
function jar(p, x, y, z, s, col) {
  const g = G(p, x, y, z, 0, s || 1);
  cyl(g, 0.13, 0.13, 0.26, col || '#C8263D', 0, 0.13, 0, 18);
  cyl(g, 0.15, 0.15, 0.06, '#F7E6C6', 0, 0.28, 0, 18);
  cyl(g, 0.1, 0.1, 0.1, '#FFF6E6', 0, 0.12, 0.05, 14, { s: [1, 1, 0.9] });
  return g;
}
function coinPile(p, x, y, z, n) {
  const g = G(p, x, y, z);
  const gold = M('#F7C232', { metalness: 0.35, roughness: 0.45, emissive: '#5A3A00', emissiveIntensity: 0.25 });
  for (let i = 0; i < (n || 6); i++) cyl(g, 0.15, 0.15, 0.05, gold, (rnd() - 0.5) * 0.4, 0.03 + i * 0.05, (rnd() - 0.5) * 0.4, 20);
  return g;
}

// ---------- nature ----------
function appleTree(p, x, z, s) {
  const g = G(p, x, 0, z, rnd() * 6, s || 1);
  cyl(g, 0.13, 0.2, 1.1, '#8B5A34', 0, 0.55, 0, 8);
  add(g, new T.IcosahedronGeometry(0.95, 1), F('#45A535'), 0, 1.6, 0);
  add(g, new T.IcosahedronGeometry(0.68, 1), F('#5BBE40'), -0.5, 1.4, 0.35);
  add(g, new T.IcosahedronGeometry(0.62, 1), F('#3C952E'), 0.55, 1.35, -0.2);
  add(g, new T.IcosahedronGeometry(0.55, 1), F('#72D054'), 0.1, 2.1, 0.2);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.75 + rnd(), h = 1.2 + rnd() * 0.9;
    const rr = 0.9 - Math.abs(h - 1.6) * 0.35;
    apple(g, Math.cos(a) * rr, h, Math.sin(a) * rr + 0.1, 0.12);
  }
  return g;
}
function bush(p, x, z, s, col) {
  const g = G(p, x, 0, z, rnd() * 6, s || 1);
  add(g, new T.IcosahedronGeometry(0.5, 1), F(col || '#4DAA36'), 0, 0.38, 0);
  add(g, new T.IcosahedronGeometry(0.38, 1), F('#62C247'), 0.35, 0.3, 0.1);
  add(g, new T.IcosahedronGeometry(0.34, 1), F('#3E9930'), -0.32, 0.28, -0.05);
  return g;
}
function pine(p, x, z, s) {
  const g = G(p, x, 0, z, 0, s || 1);
  cyl(g, 0.1, 0.14, 0.5, '#7A4C2C', 0, 0.25, 0, 7);
  add(g, new T.ConeGeometry(0.75, 1.1, 8), F('#2F8A3A'), 0, 0.95, 0);
  add(g, new T.ConeGeometry(0.58, 0.9, 8), F('#3AA046'), 0, 1.45, 0);
  add(g, new T.ConeGeometry(0.4, 0.7, 8), F('#4CB656'), 0, 1.9, 0);
  return g;
}
function rock(p, x, z, s) { return add(p, new T.DodecahedronGeometry(0.28 * (s || 1), 0), F('#A9A79E'), x, 0.12 * (s || 1), z, { ry: rnd() * 3, s: [1, 0.7, 1] }); }
function flowers(p, x, z, n) {
  const cols = ['#FF7FA6', '#FFFFFF', '#FFD23F', '#B98CFF'];
  for (let i = 0; i < (n || 6); i++) {
    const fx = x + (rnd() - 0.5) * 0.9, fz = z + (rnd() - 0.5) * 0.9;
    cyl(p, 0.015, 0.015, 0.22, '#3E9A30', fx, 0.11, fz, 5, { cast: false });
    sph(p, 0.07, cols[i % 4], fx, 0.24, fz, { s: [1, 0.6, 1] });
  }
}
function sunflower(p, x, z, s) {
  const g = G(p, x, 0, z, 0, s || 1);
  cyl(g, 0.035, 0.045, 1.3, '#4E9F32', 0, 0.65, 0, 6);
  add(g, new T.SphereGeometry(0.16, 8, 6), F('#4FA83A'), 0.14, 0.6, 0, { s: [1.4, 0.3, 0.8] });
  const head = G(g, 0, 1.35, 0.05); head.rotation.x = 0.35;
  add(head, new T.CylinderGeometry(0.34, 0.34, 0.05, 12), F('#FFC926'), 0, 0, 0, { rx: Math.PI / 2 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(head, new T.ConeGeometry(0.08, 0.22, 4), F('#FFB300'), Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0, { rz: a - Math.PI / 2 }); }
  add(head, new T.CylinderGeometry(0.17, 0.17, 0.08, 12), F('#6B3A1B'), 0, 0, 0.02, { rx: Math.PI / 2 });
  return g;
}
function cloud(p, x, y, z, s) {
  const g = G(p, x, y, z, 0, s || 1); const w = M('#FFFFFF', { roughness: 1 });
  [[0, 0, 0, 1], [0.9, -0.1, 0, 0.75], [-0.9, -0.15, 0, 0.7], [0.4, 0.45, 0, 0.7]].forEach((c) => add(g, new T.SphereGeometry(c[3], 14, 10), w, c[0], c[1], c[2], { cast: false }));
  return g;
}

// ---------- structures ----------
function fence(p, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 0.8));
  const ang = Math.atan2(-dz, dx);
  for (let i = 0; i <= n; i++) rb(p, 0.14, 0.62, 0.14, '#C9884C', x1 + dx * i / n, 0.31, z1 + dz * i / n, 0.04);
  const g = G(p, (x1 + x2) / 2, 0, (z1 + z2) / 2, ang);
  rb(g, L, 0.1, 0.07, '#DDA062', 0, 0.42, 0, 0.03);
  rb(g, L, 0.1, 0.07, '#DDA062', 0, 0.22, 0, 0.03);
}
function path(p, x, z, w, d) { rb(p, w, 0.06, d, '#EDBA68', x, 0.0, z, 0.03, { cast: false }); }
function field(p, x, z, w, d, crop) {
  const g = G(p, x, 0, z);
  rb(g, w, 0.22, d, '#9C5E2E', 0, 0.06, 0, 0.08);
  rb(g, w - 0.2, 0.06, d - 0.2, '#B8733B', 0, 0.17, 0, 0.03, { cast: false });
  for (let i = -w / 2 + 0.35; i < w / 2 - 0.2; i += 0.42) for (let j = -d / 2 + 0.35; j < d / 2 - 0.2; j += 0.42) {
    if (crop === 'wheat') {
      const sx = i + (rnd() - 0.5) * 0.08, sz = j + (rnd() - 0.5) * 0.08, hh = 0.55 + rnd() * 0.15;
      cyl(g, 0.02, 0.025, hh, '#C9A13A', sx, 0.2 + hh / 2, sz, 5);
      add(g, new T.CapsuleGeometry(0.055, 0.16, 3, 6), F('#F4C843'), sx, 0.2 + hh + 0.05, sz);
    } else if (crop === 'tea') {
      add(g, new T.IcosahedronGeometry(0.2, 1), F(rnd() > 0.5 ? '#3C9B3A' : '#4FB548'), i, 0.36, j, { s: [1, 0.8, 1] });
    } else if (crop === 'flowers') {
      const cols = ['#FF6F9C', '#FFD23F', '#FFFFFF', '#B98CFF', '#FF8C42'];
      cyl(g, 0.015, 0.015, 0.25, '#3E9A30', i, 0.32, j, 5);
      sph(g, 0.09, cols[Math.floor(rnd() * 5)], i, 0.47, j, { s: [1, 0.6, 1] });
    }
  }
  return g;
}
function ring(p, x, z, r, op) {
  const m = new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: op || 0.95 });
  const me = new T.Mesh(new T.RingGeometry(r * 0.82, r, 40), m); me.rotation.x = -Math.PI / 2; me.position.set(x, 0.06, z); p.add(me);
  const f = new T.Mesh(new T.CircleGeometry(r * 0.82, 40), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.18 }));
  f.rotation.x = -Math.PI / 2; f.position.set(x, 0.055, z); p.add(f);
}
function spot(p, x, z, w, d) {
  const g = G(p, x, 0, z);
  const pl = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.28 }));
  pl.rotation.x = -Math.PI / 2; pl.position.y = 0.05; g.add(pl);
  const wm = M('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.35 });
  const seg = 0.32, gap = 0.18;
  for (let t = -w / 2; t < w / 2 - 0.1; t += seg + gap) { rb(g, seg, 0.05, 0.12, wm, t + seg / 2, 0.06, -d / 2, 0.02, { cast: false }); rb(g, seg, 0.05, 0.12, wm, t + seg / 2, 0.06, d / 2, 0.02, { cast: false }); }
  for (let t = -d / 2; t < d / 2 - 0.1; t += seg + gap) { rb(g, 0.12, 0.05, seg, wm, -w / 2, 0.06, t + seg / 2, 0.02, { cast: false }); rb(g, 0.12, 0.05, seg, wm, w / 2, 0.06, t + seg / 2, 0.02, { cast: false }); }
  coinPile(g, 0, 0, 0, 7);
  return g;
}
function oven(p, x, z, ry, stone) {
  const g = G(p, x, 0, z, ry || 0);
  const base = stone ? '#9E9A90' : '#C55F37', dome = stone ? '#C9C4B7' : '#DE7C47', top = stone ? '#B7B2A6' : '#E39058', chim = stone ? '#7F7B73' : '#A54C2C';
  rb(g, 2.1, 0.75, 1.7, base, 0, 0.375, 0, 0.12);
  rb(g, 2.2, 0.12, 1.8, top, 0, 0.78, 0, 0.05);
  add(g, new T.SphereGeometry(0.88, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), F(dome), 0, 0.82, -0.05, { s: [1, 0.95, 0.85] });
  for (let i = 0; i < 7; i++) { const a = rnd() * Math.PI, b = rnd() * 1.2; rb(g, 0.2, 0.08, 0.06, base, Math.cos(a) * 0.75 * Math.cos(b * 0.5), 0.9 + Math.sin(b) * 0.55, -0.05 + Math.sin(a) * 0.6, 0.02, { ry: -a }); }
  rb(g, 0.34, 0.8, 0.34, chim, 0.45, 1.55, -0.35, 0.05);
  rb(g, 0.42, 0.1, 0.42, base, 0.45, 1.97, -0.35, 0.03);
  const door = G(g, 0, 0.84, 0.66);
  add(door, new T.CylinderGeometry(0.42, 0.42, 0.1, 18, 1, false, -Math.PI / 2, Math.PI), M('#3A2216'), 0, 0, 0, { rx: Math.PI / 2 });
  add(door, new T.CylinderGeometry(0.3, 0.3, 0.12, 18, 1, false, -Math.PI / 2, Math.PI), M('#FF8A1E', { emissive: '#FF7A00', emissiveIntensity: 1.2 }), 0, 0, 0.01, { rx: Math.PI / 2 });
  add(door, new T.CylinderGeometry(0.16, 0.16, 0.13, 14, 1, false, -Math.PI / 2, Math.PI), M('#FFD45A', { emissive: '#FFC23A', emissiveIntensity: 1.2 }), 0, 0, 0.02, { rx: Math.PI / 2 });
  for (let i = 0; i < 3; i++) cyl(g, 0.09, 0.09, 0.7, '#A86A3C', -1.35, 0.1 + (i === 2 ? 0.16 : 0), -0.2 + i * 0.2 - (i === 2 ? 0.1 : 0), 8, { rx: Math.PI / 2 });
  return g;
}
function stall(p, x, z, ry, goods) {
  const g = G(p, x, 0, z, ry || 0);
  rb(g, 2.8, 0.9, 0.95, '#D3904F', 0, 0.45, 0, 0.08);
  for (let i = -1; i <= 1; i++) rb(g, 0.82, 0.62, 0.04, i === 0 ? '#E8392F' : '#FFF4E2', i * 0.9, 0.42, 0.49, 0.03);
  rb(g, 3.0, 0.12, 1.1, '#EDB06C', 0, 0.96, 0, 0.04);
  [[-1.35, -0.4], [1.35, -0.4], [-1.35, 0.42], [1.35, 0.42]].forEach((c) => rb(g, 0.13, 2.3, 0.13, '#9A6237', c[0], 1.15, c[1], 0.04));
  const aw = G(g, 0, 2.28, 0.05); aw.rotation.x = 0.32;
  for (let i = 0; i < 8; i++) rb(aw, 0.4, 0.09, 1.5, i % 2 ? '#FFF6E6' : '#E8392F', -1.4 + i * 0.4, 0, 0, 0.03);
  for (let i = 0; i < 8; i++) add(aw, new T.CylinderGeometry(0.2, 0.2, 0.08, 14, 1, false, 0, Math.PI), M(i % 2 ? '#FFF6E6' : '#E8392F'), -1.4 + i * 0.4, -0.02, 0.75, { rz: Math.PI / 2, ry: Math.PI / 2, rx: Math.PI / 2 });
  if (goods !== false) {
    pie(g, -1.0, 1.02, 0.1, 0.9); pie(g, -1.0, 1.15, 0.1, 0.9); pie(g, -0.4, 1.02, 0.15, 0.9);
    bread(g, 0.25, 1.02, 0.1, 1, 0.3); bread(g, 0.55, 1.02, 0.2, 1, -0.2);
    jar(g, 1.0, 1.02, 0.15, 0.9); jar(g, 1.25, 1.02, -0.05, 0.9, '#7C2BA0');
  }
  return g;
}
function cart(p, x, z, ry) {
  const g = G(p, x, 0, z, ry || 0);
  rb(g, 1.5, 0.5, 0.95, '#C9864A', 0, 0.62, 0, 0.06);
  rb(g, 1.4, 0.06, 0.85, '#E3A462', 0, 0.88, 0, 0.02);
  [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].forEach((c) => { cyl(g, 0.3, 0.3, 0.1, '#6E4426', c[0], 0.3, c[1], 16, { rx: Math.PI / 2 }); cyl(g, 0.1, 0.1, 0.12, '#D9A16A', c[0], 0.3, c[1], 10, { rx: Math.PI / 2 }); });
  rb(g, 0.9, 0.08, 0.08, '#8B5A34', 1.1, 0.75, 0.25, 0.03, { rz: 0.25 }); rb(g, 0.9, 0.08, 0.08, '#8B5A34', 1.1, 0.75, -0.25, 0.03, { rz: 0.25 });
  for (let i = 0; i < 7; i++) apple(g, -0.55 + (i % 4) * 0.22, 1.0 + Math.floor(i / 4) * 0.15, -0.15 + (i % 2) * 0.25, 0.13);
  for (let i = 0; i < 5; i++) { cyl(g, 0.02, 0.02, 0.6, '#E6B84A', 0.35 + i * 0.07, 1.15, 0.05, 5, { rz: 0.2 - i * 0.1 }); add(g, new T.CapsuleGeometry(0.05, 0.14, 3, 6), F('#F4C843'), 0.35 + i * 0.07 - (0.2 - i * 0.1) * 0.3, 1.47, 0.05); }
  return g;
}
function character(p, x, z, o) {
  o = o || {}; const g = G(p, x, 0, z, o.ry || 0, o.s || 1.35);
  const skin = o.skin || '#F6C8A0';
  [-0.12, 0.12].forEach((sx) => { rb(g, 0.17, 0.3, 0.2, o.pants || '#3E3A5A', sx, 0.22, 0, 0.06); rb(g, 0.2, 0.1, 0.28, '#4A2E1E', sx, 0.06, 0.04, 0.04); });
  add(g, new T.CapsuleGeometry(0.3, 0.28, 6, 14), M(o.shirt || '#3C7FD6'), 0, 0.68, 0, { s: [1, 1, 0.85] });
  if (o.apron) { rb(g, 0.46, 0.42, 0.06, '#FFFFFF', 0, 0.62, 0.25, 0.04); rb(g, 0.06, 0.2, 0.05, '#FFFFFF', -0.14, 0.9, 0.2, 0.02); rb(g, 0.06, 0.2, 0.05, '#FFFFFF', 0.14, 0.9, 0.2, 0.02); }
  if (o.dress) add(g, new T.ConeGeometry(0.42, 0.55, 14, 1, true), M(o.dress), 0, 0.5, 0);
  sph(g, 0.36, skin, 0, 1.3, 0);
  sph(g, 0.05, '#2A1A10', -0.13, 1.33, 0.32); sph(g, 0.05, '#2A1A10', 0.13, 1.33, 0.32);
  sph(g, 0.016, '#FFFFFF', -0.115, 1.35, 0.365); sph(g, 0.016, '#FFFFFF', 0.145, 1.35, 0.365);
  sph(g, 0.06, '#FF9A8A', -0.22, 1.22, 0.27, { s: [1, 0.7, 0.4] }); sph(g, 0.06, '#FF9A8A', 0.22, 1.22, 0.27, { s: [1, 0.7, 0.4] });
  add(g, new T.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), M('#7A3A2A'), 0, 1.21, 0.33, { rz: Math.PI });
  sph(g, 0.045, '#EBA982', 0, 1.27, 0.36);
  if (o.hat === 'chef') {
    cyl(g, 0.27, 0.25, 0.22, '#FFFFFF', 0, 1.63, 0, 18);
    [[-0.13, 0], [0.13, 0], [0, 0.1], [0, -0.1]].forEach((c) => sph(g, 0.2, '#FFFFFF', c[0], 1.8, c[1]));
    sph(g, 0.2, '#FFFFFF', 0, 1.88, 0);
  } else if (o.hat === 'cap') {
    add(g, new T.SphereGeometry(0.37, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(o.capColor || '#F07A2A'), 0, 1.36, 0);
    rb(g, 0.42, 0.04, 0.3, o.capColor || '#F07A2A', 0, 1.38, 0.38, 0.02);
  } else if (o.hat === 'straw') {
    cyl(g, 0.62, 0.62, 0.04, '#F2C25A', 0, 1.55, 0, 22); cyl(g, 0.3, 0.33, 0.24, '#F2C25A', 0, 1.67, 0, 18); cyl(g, 0.335, 0.335, 0.07, '#D8392E', 0, 1.6, 0, 18);
  } else {
    add(g, new T.SphereGeometry(0.385, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), M(o.hair || '#6B3E22'), 0, 1.33, -0.02);
    if (o.bun) sph(g, 0.16, o.hair || '#6B3E22', 0, 1.7, -0.12);
  }
  const arm = M(o.shirt || '#3C7FD6');
  if (o.carry) {
    [-1, 1].forEach((sd) => { add(g, new T.CapsuleGeometry(0.08, 0.26, 4, 8), arm, sd * 0.3, 0.78, 0.2, { rx: -1.2 }); sph(g, 0.09, skin, sd * 0.27, 0.74, 0.42); });
  } else if (o.wave) {
    add(g, new T.CapsuleGeometry(0.08, 0.26, 4, 8), arm, -0.36, 0.62, 0, { rz: -0.25 }); sph(g, 0.09, skin, -0.4, 0.42, 0);
    add(g, new T.CapsuleGeometry(0.08, 0.26, 4, 8), arm, 0.42, 1.0, 0, { rz: 2.5 }); sph(g, 0.09, skin, 0.52, 1.2, 0.02);
  } else {
    [-1, 1].forEach((sd) => { add(g, new T.CapsuleGeometry(0.08, 0.26, 4, 8), arm, sd * 0.36, 0.62, 0, { rz: sd * 0.25 }); sph(g, 0.09, skin, sd * 0.4, 0.42, 0); });
  }
  const st = G(g, 0, 0.82, 0.5);
  if (o.carry === 'apples') {
    rb(st, 0.62, 0.06, 0.46, '#B9773F', 0, 0, 0, 0.03);
    const pos = [];
    for (let l = 0; l < (o.n || 4); l++) for (let i = 0; i < 3; i++) pos.push([-0.17 + i * 0.17 + (l % 2) * 0.05, 0.12 + l * 0.2, (i % 2) * 0.08 - 0.04]);
    pos.forEach((q) => apple(st, q[0], q[1], q[2], 0.11));
  } else if (o.carry === 'pies') {
    for (let l = 0; l < (o.n || 5); l++) pie(st, 0, l * 0.15, 0, 0.9);
  } else if (o.carry === 'bread') {
    rb(st, 0.6, 0.06, 0.42, '#B9773F', 0, 0, 0, 0.03);
    for (let l = 0; l < (o.n || 3); l++) { bread(st, -0.12, 0.04 + l * 0.18, 0, 0.9, 0.1); bread(st, 0.14, 0.04 + l * 0.18, 0.02, 0.9, -0.1); }
  } else if (o.carry === 'pie1') { pie(st, 0, 0, 0, 1.1); }
  if (o.carry) st.position.y = 0.82;
  return g;
}
const baker = (p, x, z, o) => character(p, x, z, Object.assign({ shirt: '#3C7FD6', pants: '#3A3554', apron: true, hat: 'chef' }, o));
const helper = (p, x, z, o) => character(p, x, z, Object.assign({ shirt: '#45A53A', pants: '#5A4232', hat: 'cap', capColor: '#F07A2A', skin: '#E3A47A' }, o));
const villA = (p, x, z, o) => character(p, x, z, Object.assign({ shirt: '#F08A3C', dress: '#F08A3C', pants: '#5A3A2A', hair: '#7A4220', bun: true, skin: '#F1B98E' }, o));
const villB = (p, x, z, o) => character(p, x, z, Object.assign({ shirt: '#8A62D6', pants: '#2F4A7A', hair: '#2A1A10', skin: '#B9784C' }, o));
const villC = (p, x, z, o) => character(p, x, z, Object.assign({ shirt: '#E5486A', pants: '#3A5A3A', hat: 'straw', skin: '#F6C8A0' }, o));

function hen(p, x, z, ry, s) {
  const g = G(p, x, 0, z, ry || 0, s || 1);
  sph(g, 0.28, '#FFFFFF', 0, 0.32, 0, { s: [1, 0.85, 1.2] });
  sph(g, 0.17, '#FFFFFF', 0, 0.58, 0.22);
  add(g, new T.ConeGeometry(0.16, 0.3, 6), M('#FFFFFF'), 0, 0.42, -0.33, { rx: -1.1 });
  rb(g, 0.06, 0.12, 0.16, '#E8302A', 0, 0.76, 0.2, 0.03);
  add(g, new T.ConeGeometry(0.05, 0.12, 6), M('#F7A21C'), 0, 0.57, 0.42, { rx: Math.PI / 2 });
  sph(g, 0.04, '#E8302A', 0, 0.48, 0.35);
  sph(g, 0.03, '#2A1A10', -0.09, 0.62, 0.34); sph(g, 0.03, '#2A1A10', 0.09, 0.62, 0.34);
  cyl(g, 0.02, 0.02, 0.16, '#F7A21C', -0.08, 0.08, 0, 5); cyl(g, 0.02, 0.02, 0.16, '#F7A21C', 0.08, 0.08, 0, 5);
  return g;
}
function cow(p, x, z, ry, s) {
  const g = G(p, x, 0, z, ry || 0, s || 1);
  [[-0.32, -0.45], [0.32, -0.45], [-0.32, 0.45], [0.32, 0.45]].forEach((c) => { rb(g, 0.2, 0.5, 0.2, '#F4EFE6', c[0], 0.25, c[1], 0.06); rb(g, 0.22, 0.1, 0.22, '#5A3A28', c[0], 0.05, c[1], 0.03); });
  rb(g, 0.95, 0.7, 1.45, '#FFFFFF', 0, 0.82, 0, 0.25);
  rb(g, 0.4, 0.4, 0.04, '#2E2420', 0.48, 0.9, -0.2, 0.08, { ry: Math.PI / 2 }); rb(g, 0.3, 0.28, 0.04, '#2E2420', -0.48, 0.8, 0.25, 0.08, { ry: Math.PI / 2 });
  rb(g, 0.45, 0.04, 0.4, '#2E2420', 0.1, 1.17, -0.35, 0.08);
  rb(g, 0.62, 0.58, 0.55, '#FFFFFF', 0, 1.12, 0.88, 0.18);
  rb(g, 0.56, 0.24, 0.12, '#FFB3B0', 0, 0.98, 1.17, 0.08);
  sph(g, 0.035, '#C2615D', -0.12, 0.99, 1.24); sph(g, 0.035, '#C2615D', 0.12, 0.99, 1.24);
  sph(g, 0.05, '#2A1A10', -0.17, 1.24, 1.15); sph(g, 0.05, '#2A1A10', 0.17, 1.24, 1.15);
  add(g, new T.ConeGeometry(0.06, 0.2, 6), M('#F2D27A'), -0.24, 1.48, 0.82, { rz: 0.5 }); add(g, new T.ConeGeometry(0.06, 0.2, 6), M('#F2D27A'), 0.24, 1.48, 0.82, { rz: -0.5 });
  rb(g, 0.22, 0.1, 0.12, '#FFFFFF', -0.4, 1.3, 0.8, 0.04, { rz: 0.3 }); rb(g, 0.22, 0.1, 0.12, '#FFFFFF', 0.4, 1.3, 0.8, 0.04, { rz: -0.3 });
  cyl(g, 0.035, 0.035, 0.5, '#FFFFFF', 0, 0.85, -0.78, 6, { rx: 0.4 });
  return g;
}
function beehive(p, x, z, ry) {
  const g = G(p, x, 0, z, ry || 0);
  rb(g, 0.85, 0.12, 0.85, '#8B5A34', 0, 0.3, 0, 0.03);
  [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach((c) => rb(g, 0.1, 0.3, 0.1, '#8B5A34', c[0], 0.15, c[1], 0.03));
  rb(g, 0.72, 0.36, 0.72, '#F6B52E', 0, 0.55, 0, 0.06); rb(g, 0.72, 0.36, 0.72, '#F09A1A', 0, 0.92, 0, 0.06); rb(g, 0.72, 0.36, 0.72, '#F6B52E', 0, 1.29, 0, 0.06);
  rb(g, 0.9, 0.12, 0.9, '#C9864A', 0, 1.53, 0, 0.04);
  rb(g, 0.28, 0.06, 0.04, '#3A2216', 0, 0.45, 0.36, 0.02);
  for (let i = 0; i < 3; i++) { const b = G(g, -0.5 + i * 0.5, 1.2 + i * 0.25, 0.6 - i * 0.2); sph(b, 0.07, '#FFD12E', 0, 0, 0, { s: [1.3, 1, 1] }); rb(b, 0.04, 0.12, 0.12, '#2A1A10', 0.02, 0, 0, 0.01); sph(b, 0.05, '#FFFFFF', 0, 0.07, 0, { s: [1, 0.4, 1.6] }); }
  return g;
}
function churn(p, x, z) {
  const g = G(p, x, 0, z);
  cyl(g, 0.32, 0.42, 1.0, '#C98A4E', 0, 0.5, 0, 16);
  cyl(g, 0.4, 0.4, 0.07, '#7A4C2C', 0, 0.2, 0, 16); cyl(g, 0.35, 0.35, 0.07, '#7A4C2C', 0, 0.82, 0, 16);
  cyl(g, 0.3, 0.3, 0.08, '#A86A3C', 0, 1.02, 0, 16);
  cyl(g, 0.045, 0.045, 0.8, '#8B5A34', 0, 1.4, 0, 8); rb(g, 0.4, 0.08, 0.08, '#8B5A34', 0, 1.8, 0, 0.03);
  const b = G(g, 0.65, 0, 0.3); cyl(b, 0.28, 0.28, 0.05, '#DDEBF5', 0, 0.03, 0, 18); rb(b, 0.38, 0.2, 0.26, '#F9D65A', 0, 0.16, 0, 0.04);
  return g;
}
function ciderPress(p, x, z) {
  const g = G(p, x, 0, z);
  rb(g, 1.6, 0.18, 1.1, '#8B5A34', 0, 0.09, 0, 0.04);
  rb(g, 0.16, 1.8, 0.16, '#9A6237', -0.65, 0.95, 0, 0.04); rb(g, 0.16, 1.8, 0.16, '#9A6237', 0.65, 0.95, 0, 0.04);
  rb(g, 1.6, 0.22, 0.24, '#A86A3C', 0, 1.85, 0, 0.05);
  cyl(g, 0.08, 0.08, 0.7, '#8C8A84', 0, 1.4, 0, 10, { s: [1, 1, 1] }); rb(g, 0.9, 0.06, 0.06, '#7A4C2C', 0, 2.05, 0, 0.02);
  cyl(g, 0.45, 0.45, 0.55, '#C98A4E', 0, 0.5, 0, 14);
  for (let i = 0; i < 6; i++) apple(g, -0.25 + (i % 3) * 0.25, 0.85, -0.12 + Math.floor(i / 3) * 0.24, 0.12);
  rb(g, 0.3, 0.06, 0.12, '#8B5A34', 0.55, 0.28, 0.35, 0.02);
  cyl(g, 0.16, 0.14, 0.32, '#C7782A', 0.75, 0.16, 0.5, 14);
  return g;
}
function jamKitchen(p, x, z) {
  const g = G(p, x, 0, z);
  rb(g, 1.5, 0.8, 1.0, '#E6A86A', 0, 0.4, 0, 0.08); rb(g, 1.6, 0.1, 1.1, '#B9773F', 0, 0.82, 0, 0.03);
  rb(g, 0.6, 0.34, 0.04, '#3A2216', -0.2, 0.4, 0.5, 0.04);
  add(g, new T.CylinderGeometry(0.26, 0.16, 0.08, 10), M('#FF8A1E', { emissive: '#FF7A00', emissiveIntensity: 1 }), -0.2, 0.35, 0.51, { rx: Math.PI / 2 });
  cyl(g, 0.42, 0.36, 0.45, '#C8263D', -0.2, 1.1, 0, 20); cyl(g, 0.44, 0.44, 0.05, '#8E1A2C', -0.2, 1.33, 0, 20); cyl(g, 0.38, 0.38, 0.03, '#EE4B68', -0.2, 1.33, 0, 20);
  rb(g, 0.06, 0.7, 0.06, '#9A6237', -0.05, 1.55, 0.05, 0.02, { rz: -0.5 });
  jar(g, 0.5, 0.87, 0.15, 1); jar(g, 0.5, 0.87, -0.2, 1, '#7C2BA0');
  return g;
}
function cheeseShelf(p, x, z) {
  const g = G(p, x, 0, z);
  [-0.8, 0.8].forEach((sx) => rb(g, 0.12, 1.6, 0.6, '#8B5A34', sx, 0.8, 0, 0.03));
  [0.35, 0.95, 1.55].forEach((y) => rb(g, 1.7, 0.08, 0.62, '#A86A3C', 0, y, 0, 0.02));
  [[0.35, [-0.45, 0.1, 0.5]], [0.95, [-0.4, 0.3]]].forEach((row) => row[1].forEach((sx) => { cyl(g, 0.26, 0.26, 0.22, '#F6C640', sx, row[0] + 0.15, 0, 18); cyl(g, 0.24, 0.24, 0.02, '#FCE07A', sx, row[0] + 0.27, 0, 18); }));
  const w = G(g, 0.45, 1.0, 0.05); add(w, new T.CylinderGeometry(0.26, 0.26, 0.22, 18, 1, false, 0, Math.PI * 1.6), M('#F6C640'), 0, 0.1, 0);
  return g;
}
function henHouse(p, x, z, ry) {
  const g = G(p, x, 0, z, ry || 0);
  [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]].forEach((c) => rb(g, 0.12, 0.4, 0.12, '#8B5A34', c[0], 0.2, c[1], 0.03));
  rb(g, 1.7, 1.0, 1.3, '#FFF1D6', 0, 0.9, 0, 0.06);
  const rf = G(g, 0, 1.4, 0);
  rb(rf, 1.2, 0.1, 1.55, '#D8392E', -0.45, 0.32, 0, 0.04, { rz: 0.62 }); rb(rf, 1.2, 0.1, 1.55, '#C02E25', 0.45, 0.32, 0, 0.04, { rz: -0.62 });
  add(g, new T.CylinderGeometry(0.22, 0.22, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), M('#3A2216'), 0, 0.7, 0.66, { rx: Math.PI / 2 });
  rb(g, 0.44, 0.06, 0.9, '#C9884C', 0, 0.3, 1.05, 0.02, { rx: 0.5 });
  rb(g, 0.4, 0.22, 0.04, '#F6C640', -0.5, 1.05, 0.66, 0.03);
  return g;
}
function cottage(p, x, z, ry) {
  const g = G(p, x, 0, z, ry || 0);
  rb(g, 4.2, 0.25, 3.2, '#C9C3B3', 0, 0.12, 0, 0.06);
  rb(g, 4.0, 2.3, 3.0, '#FFF1D9', 0, 1.35, 0, 0.1);
  [-1.95, 1.95].forEach((sx) => rb(g, 0.16, 2.3, 0.16, '#9A6237', sx, 1.35, 1.48, 0.03));
  rb(g, 4.1, 0.16, 0.16, '#9A6237', 0, 2.45, 1.48, 0.03);
  const rf = G(g, 0, 2.5, 0);
  rb(rf, 2.75, 0.22, 3.6, '#E0402F', -1.08, 0.82, 0, 0.06, { rz: 0.62 }); rb(rf, 2.75, 0.22, 3.6, '#C2321F', 1.08, 0.82, 0, 0.06, { rz: -0.62 });
  const gab = new T.Shape(); gab.moveTo(-2, 0); gab.lineTo(2, 0); gab.lineTo(0, 1.45); gab.lineTo(-2, 0);
  add(rf, new T.ExtrudeGeometry(gab, { depth: 2.9, bevelEnabled: false }), M('#FFE6C2'), 0, -0.05, -1.45);
  rb(g, 0.5, 1.4, 0.5, '#A54C2C', 1.1, 4.0, -0.5, 0.05); rb(g, 0.62, 0.14, 0.62, '#8A3A20', 1.1, 4.72, -0.5, 0.03);
  cloud(g, 1.3, 5.2, -0.5, 0.28); cloud(g, 1.7, 5.7, -0.5, 0.2);
  rb(g, 0.9, 1.5, 0.1, '#8B4E2A', 0, 0.95, 1.52, 0.06); sph(g, 0.05, '#F7C232', 0.28, 0.95, 1.6);
  [-1.25, 1.25].forEach((sx) => {
    rb(g, 0.9, 0.8, 0.08, M('#FFD45A', { emissive: '#FFB62E', emissiveIntensity: 0.6 }), sx, 1.45, 1.52, 0.04);
    rb(g, 1.0, 0.1, 0.12, '#9A6237', sx, 1.88, 1.56, 0.03); rb(g, 1.0, 0.1, 0.12, '#9A6237', sx, 1.02, 1.56, 0.03);
    rb(g, 0.08, 0.8, 0.1, '#9A6237', sx, 1.45, 1.56, 0.02); rb(g, 0.9, 0.08, 0.1, '#9A6237', sx, 1.45, 1.56, 0.02);
    rb(g, 1.0, 0.22, 0.3, '#9A6237', sx, 0.88, 1.68, 0.04);
    for (let i = 0; i < 4; i++) sph(g, 0.1, ['#FF6F9C', '#FFD23F', '#FFFFFF', '#FF6F9C'][i], sx - 0.33 + i * 0.22, 1.04, 1.68);
  });
  const aw = G(g, 0, 2.15, 1.75); aw.rotation.x = 0.45;
  for (let i = 0; i < 5; i++) rb(aw, 0.3, 0.06, 0.6, i % 2 ? '#FFF6E6' : '#E8392F', -0.6 + i * 0.3, 0, 0, 0.02);
  rb(g, 2.2, 0.55, 0.12, '#FFF6E6', 0, 2.75, 1.62, 0.08); rb(g, 2.3, 0.65, 0.08, '#8B4E2A', 0, 2.75, 1.56, 0.08);
  pie(g, -1.25, 0.99, 1.7, 0.6);
  return g;
}
function pond(p, x, z, r) {
  cyl(p, r + 0.15, r + 0.15, 0.08, '#E2C38A', x, 0.02, z, 28, { cast: false });
  cyl(p, r, r, 0.1, M('#5CC3E8', { roughness: 0.3 }), x, 0.04, z, 28, { cast: false });
  cyl(p, r * 0.4, r * 0.4, 0.11, M('#9EE0F5', { roughness: 0.3 }), x - r * 0.3, 0.045, z - r * 0.2, 20, { cast: false, s: [1.4, 1, 0.35] });
  for (let i = 0; i < 6; i++) { const a = i * 1.1; rock(p, x + Math.cos(a) * (r + 0.2), z + Math.sin(a) * (r + 0.2), 0.8); }
}
function ground(p, w, d, col) {
  const pl = new T.Mesh(new T.PlaneGeometry(w, d), M(col || '#86C93F', { roughness: 1 }));
  pl.rotation.x = -Math.PI / 2; pl.receiveShadow = true; p.add(pl);
  for (let i = 0; i < 40; i++) {
    const c = new T.Mesh(new T.CircleGeometry(0.4 + rnd() * 1.4, 18), M(rnd() > 0.5 ? '#93D34A' : '#79BC37', { roughness: 1 }));
    c.rotation.x = -Math.PI / 2; c.position.set((rnd() - 0.5) * w, 0.005, (rnd() - 0.5) * d); c.scale.set(1, 0.6, 1); c.receiveShadow = true; p.add(c);
  }
  for (let i = 0; i < 160; i++) add(p, new T.ConeGeometry(0.04, 0.16, 3), F('#6AB233'), (rnd() - 0.5) * w, 0.07, (rnd() - 0.5) * d, { cast: false });
}

// ---------- worlds ----------
function farm(sc, wide) {
  ground(sc, 90, 90);
  for (let i = 0; i < 16; i++) { const tx = -13 + i * 1.8 + rnd(); (i % 3 ? pine : appleTree)(sc, tx, -11.5 - rnd() * 3, 1.2); bush(sc, tx + 0.9, -10.2, 1.1); }
  path(sc, 0, 0.5, 1.7, 22);
  path(sc, 0, -3.4, wide ? 22 : 14, 1.5);
  path(sc, 0, 1.4, wide ? 22 : 14, 1.5);
  // orchard
  fence(sc, -4.4, -8.6, -0.95, -8.6); fence(sc, -4.4, -8.6, -4.4, -4.3); fence(sc, -0.95, -8.6, -0.95, -6.6);
  [[-3.4, -7.6], [-1.9, -7.4], [-3.5, -5.6], [-2.0, -5.3]].forEach((t) => appleTree(sc, t[0], t[1], 1.0));
  // wheat
  field(sc, 2.6, -6.4, 3.2, 3.6, 'wheat');
  // baker by a tree
  ring(sc, -0.85, -5.0, 0.6);
  const bk = baker(sc, -0.85, -4.9, { carry: 'apples', n: 4, ry: 0.35 });
  // ovens
  oven(sc, -2.7, -1.3, 0.25);
  ring(sc, -2.2, 0.2, 0.55);
  spot(sc, 2.7, -1.2, 2.2, 2.0);
  helper(sc, 0.3, -0.4, { carry: 'pies', n: 5, ry: -1.0 });
  // market
  stall(sc, -2.4, 3.3, 0);
  ring(sc, -2.4, 4.55, 0.6);
  villA(sc, -2.4, 4.7, { ry: Math.PI - 0.5 });
  villB(sc, -1.1, 5.4, { ry: -0.7 });
  villC(sc, -0.1, 6.4, { ry: -0.4 });
  villA(sc, 0.3, 7.6, { ry: -0.2, shirt: '#2FA6A0', dress: '#2FA6A0', hair: '#E8B04A' });
  coinPile(sc, -1.3, 1.0, 3.95, 5);
  cart(sc, 2.6, 3.6, -0.3); ring(sc, 2.4, 4.9, 0.5);
  pond(sc, 3.0, 8.0, 1.2);
  // edges
  [[-4.6, 0.2], [-4.4, 2.4], [4.5, 0], [4.6, 5.5], [-4.3, 7.8], [-3.0, 9.2], [1.4, 9.5], [4.4, -3.6]].forEach((b) => bush(sc, b[0], b[1], 1.1));
  [[-5.4, -2], [5.4, 2.6], [5.6, -6], [-5.5, 5.6]].forEach((t) => pine(sc, t[0], t[1], 1.2));
  flowers(sc, -3.6, 6.6, 8); flowers(sc, 1.2, -0.3, 6); flowers(sc, 3.6, 5.9, 7); flowers(sc, -1.0, -2.4, 5);
  rock(sc, 1.2, 6.9, 1); rock(sc, -3.4, 0.9, 1.2);
  fence(sc, 0.95, -8.6, 4.4, -8.6); fence(sc, 4.4, -8.6, 4.4, -4.5);
  if (wide) {
    henHouse(sc, 7.0, -1.4, -0.3); hen(sc, 6.0, -0.2, 0.6); hen(sc, 7.6, 0.0, -0.8, 0.9); hen(sc, 8.3, -0.6, 2.4, 0.95);
    fence(sc, 5.4, 2.6, 9.6, 2.6); fence(sc, 5.4, 2.6, 5.4, 6.4); fence(sc, 9.6, 2.6, 9.6, 6.4); fence(sc, 5.4, 6.4, 9.6, 6.4);
    cow(sc, 7.2, 4.3, -0.6); churn(sc, 4.6, 6.6);
    beehive(sc, -6.8, 3.6, 0.3); beehive(sc, -8.1, 3.9, -0.2); flowers(sc, -7.4, 5.2, 10);
    spot(sc, -7.0, -1.3, 2.2, 2.0);
    field(sc, -7.6, -6.4, 3.0, 3.0, 'tea');
    field(sc, 7.4, -6.4, 3.0, 3.0, 'flowers');
    [[-10.5, 0], [10.5, 1], [-10.2, 7], [10.6, -5], [-9.8, -9]].forEach((t) => pine(sc, t[0], t[1], 1.3));
    [[-9.6, -3.5], [9.8, 8], [-5, 8.6], [6.2, 8.8]].forEach((b) => bush(sc, b[0], b[1], 1.1));
  }
  return { baker: bk };
}
function hero(sc) {
  ground(sc, 60, 60);
  sc.background = new T.Color('#9FDBF5');
  for (let i = 0; i < 9; i++) add(sc, new T.SphereGeometry(6 + rnd() * 4, 20, 12), F(i % 2 ? '#6DBB3C' : '#7CC944'), -30 + i * 8, -2.5, -26 - rnd() * 6, { cast: false, s: [1.4, 0.6, 1] });
  cloud(sc, -5, 9.5, -18, 1.4); cloud(sc, 6, 11, -20, 1.7); cloud(sc, 1, 13, -24, 1.2);
  cottage(sc, 0, -2.2);
  path(sc, 0, 3.2, 1.5, 9);
  appleTree(sc, -4.3, -1.5, 1.35); appleTree(sc, 4.4, -1.0, 1.3); appleTree(sc, -6.4, -4.5, 1.2); appleTree(sc, 6.6, -4.8, 1.15);
  stall(sc, 3.2, 1.8, -0.5);
  cart(sc, -3.4, 2.2, 0.5);
  fence(sc, -6, 0.9, -1.2, 0.9); fence(sc, 1.2, 0.9, 6, 0.9);
  for (let i = 0; i < 9; i++) { sunflower(sc, -5.8 + i * 0.55, 5.2 + (i % 2) * 0.35, 0.9); sunflower(sc, 1.5 + i * 0.55, 5.2 + (i % 2) * 0.35, 0.9); }
  baker(sc, -0.45, 3.0, { wave: true, ry: 0.15, s: 1.15 });
  helper(sc, 1.05, 2.4, { carry: 'pies', n: 3, ry: -0.4, s: 1.05 });
  hen(sc, -1.8, 3.8, 0.8, 1.1);
  flowers(sc, -1.6, 1.6, 8); flowers(sc, 1.9, 4.2, 6);
  bush(sc, -2.4, -0.2, 1); bush(sc, 2.5, -0.4, 1);
}

export const ASSETS = {
  baker: (s) => baker(s, 0, 0, {}),
  bakerCarry: (s) => baker(s, 0, 0, { carry: 'apples', n: 4 }),
  helper: (s) => helper(s, 0, 0, { carry: 'bread', n: 2 }),
  villagerA: (s) => villA(s, 0, 0, {}),
  villagerB: (s) => villB(s, 0, 0, {}),
  villagerC: (s) => villC(s, 0, 0, {}),
  oven: (s) => oven(s, 0, 0, 0),
  stoneOven: (s) => oven(s, 0, 0, 0, true),
  jamKitchen: (s) => jamKitchen(s, 0, 0),
  churn: (s) => churn(s, 0, 0),
  cheese: (s) => cheeseShelf(s, 0, 0),
  ciderPress: (s) => ciderPress(s, 0, 0),
  beehive: (s) => beehive(s, 0, 0),
  henHouse: (s) => { henHouse(s, 0, 0); hen(s, 1.2, 0.9, 0.6); },
  stall: (s) => stall(s, 0, 0, 0),
  cart: (s) => cart(s, 0, 0, 0),
  appleTree: (s) => appleTree(s, 0, 0, 1),
  wheat: (s) => field(s, 0, 0, 2.6, 2.6, 'wheat'),
  tea: (s) => field(s, 0, 0, 2.6, 2.6, 'tea'),
  flowers: (s) => field(s, 0, 0, 2.6, 2.6, 'flowers'),
  hen: (s) => { hen(s, -0.3, 0, 0.5); hen(s, 0.45, 0.3, -0.5, 0.9); },
  cow: (s) => cow(s, 0, 0, 0.3),
  cottage: (s) => cottage(s, 0, 0),
  spot: (s) => spot(s, 0, 0, 2.2, 2.0),
  pie: (s) => pie(s, 0, 0, 0, 1),
  bread: (s) => bread(s, 0, 0, 0, 1),
  jam: (s) => jar(s, 0, 0, 0, 1),
  apple: (s) => apple(s, 0, 0.12, 0, 0.14)
};


// ---------- lighting, renderer and camera presets ----------
export function setSeed(n) { seed = n; }

/** Apply the house renderer settings. */
export function configureRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
}

/** Add the house lighting: bright sky fill + one warm sun from the top left. Returns the sun so it can follow the player. */
export function addLighting(scene) {
  scene.add(new T.HemisphereLight('#FFFFFF', '#7FA84A', 1.25));
  scene.add(new T.AmbientLight('#FFF6E8', 0.35));
  const sun = new T.DirectionalLight('#FFF4E0', 2.3);
  sun.position.set(-8, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 60;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  return sun;
}

/** Camera presets. offset = camera position relative to the point it follows (the player). */
export const CAMERA = {
  phone:   { fov: 27, offset: [0, 28.5, 24.9] },
  desktop: { fov: 22, offset: [0, 25, 25.4] },
  hero:    { fov: 42, position: [0, 5.2, 13.5], lookAt: [0, 2.6, -1] }
};
export const GROUND_COLOR = '#86C93F';
export const SKY_COLOR = '#9FDBF5';

export { M, F, rb, cyl, sph, add, G, rboxGeo, rnd };
export {
  apple, pie, bread, jar, coinPile,
  appleTree, bush, pine, rock, flowers, sunflower, cloud,
  fence, path, field, ring, spot, oven, stall, cart,
  character, baker, helper, villA, villB, villC,
  hen, cow, beehive, churn, ciderPress, jamKitchen, cheeseShelf, henHouse, cottage, pond, ground,
  farm, hero
};
