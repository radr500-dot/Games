// Low-poly models built from simple shapes. Each model is merged into one
// geometry with vertex colors, so a whole forest can be drawn in one go.
import * as THREE from './vendor/three.module.min.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// One colored piece of a model, moved into place.
export function part(geo, color, o = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _q.setFromEuler(_e);
  _v.set(o.x || 0, o.y || 0, o.z || 0);
  const s = o.s || 1;
  _s.set((o.sx || 1) * s, (o.sy || 1) * s, (o.sz || 1) * s);
  _m.compose(_v, _q, _s);
  g.applyMatrix4(_m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Join pieces into a single geometry (position, normal, color).
export function merge(parts) {
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// A triangular prism (a pitched roof): width along x, depth along z, peak up.
export function prism(w, d, h) {
  const x = w / 2, z = d / 2;
  const v = [
    // front and back triangles
    -x, 0, z, x, 0, z, 0, h, z,
    x, 0, -z, -x, 0, -z, 0, h, -z,
    // left slope
    -x, 0, -z, -x, 0, z, 0, h, z, -x, 0, -z, 0, h, z, 0, h, -z,
    // right slope
    x, 0, z, x, 0, -z, 0, h, -z, x, 0, z, 0, h, -z, 0, h, z,
    // bottom
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, -z, x, 0, z, -x, 0, z,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const Cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const Sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

// ---------- Scenery ----------
// Each returns { geo, big } where big props are kept further from the road.
export function buildProp(kind) {
  const P = [];
  let big = false;
  switch (kind) {
    case 'tree':
      P.push(part(Cyl(0.16, 0.24, 1.4, 6), '#8a5a3b', { y: 0.7 }));
      P.push(part(Ico(1.05), '#6fae5b', { y: 2.1 }));
      P.push(part(Ico(0.75), '#7fbd66', { y: 2.7, x: 0.35, z: 0.2 }));
      break;
    case 'pine':
      P.push(part(Cyl(0.13, 0.2, 1.0, 6), '#7a4e33', { y: 0.5 }));
      P.push(part(Cone(1.05, 1.8, 7), '#4f8f5a', { y: 1.7 }));
      P.push(part(Cone(0.78, 1.4, 7), '#5aa064', { y: 2.6 }));
      P.push(part(Cone(0.5, 1.0, 7), '#66ad6d', { y: 3.3 }));
      break;
    case 'bush':
      P.push(part(Ico(0.7), '#79b765', { y: 0.35, sx: 1.3, sy: 0.8 }));
      P.push(part(Ico(0.45), '#89c472', { y: 0.55, x: 0.5, sy: 0.8 }));
      break;
    case 'rock':
      P.push(part(new THREE.DodecahedronGeometry(0.7, 0), '#9c968e', { y: 0.25, sy: 0.6, ry: 0.4 }));
      P.push(part(new THREE.DodecahedronGeometry(0.4, 0), '#aaa49b', { y: 0.2, x: 0.7, sy: 0.7 }));
      break;
    case 'hut':
      P.push(part(Cyl(1.05, 1.15, 1.1, 9), '#c9a16d', { y: 0.55 }));
      P.push(part(Cone(1.55, 1.5, 9), '#d8b45e', { y: 1.85 }));
      P.push(part(Box(0.5, 0.7, 0.1), '#5c4030', { y: 0.35, z: 1.1 }));
      big = true; break;
    case 'palm':
      P.push(part(Cyl(0.11, 0.19, 3.0, 6), '#a07850', { y: 1.5, rz: 0.12 }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        P.push(part(Box(1.7, 0.06, 0.45), '#5ea455', { x: Math.cos(a) * 0.75 - 0.18, y: 3.0, z: Math.sin(a) * 0.75, ry: -a, rz: -0.35 }));
      }
      P.push(part(Sph(0.13, 6, 5), '#6b4a2f', { y: 2.9, x: -0.1, z: 0.12 }));
      break;
    case 'temple':
      P.push(part(Box(4, 0.4, 3), '#e6d3a8', { y: 0.2 }));
      for (const cx of [-1.6, -0.55, 0.55, 1.6]) for (const cz of [-1.1, 1.1])
        P.push(part(Cyl(0.17, 0.2, 2.0, 8), '#f1e4c4', { x: cx, y: 1.4, z: cz }));
      P.push(part(Box(4.2, 0.3, 3.2), '#e6d3a8', { y: 2.55 }));
      P.push(part(prism(3.2, 4.2, 0.9), '#d9a066', { y: 2.7, ry: Math.PI / 2 }));
      big = true; break;
    case 'obelisk':
      P.push(part(Box(0.9, 0.3, 0.9), '#d9c28f', { y: 0.15 }));
      P.push(part(Box(0.55, 3.2, 0.55), '#e8d4a4', { y: 1.9 }));
      P.push(part(Cone(0.4, 0.6, 4), '#e2b04a', { y: 3.8, ry: Math.PI / 4 }));
      break;
    case 'tower':
      P.push(part(Cyl(1.05, 1.2, 4.2, 10), '#b9b3a8', { y: 2.1 }));
      P.push(part(Cyl(1.3, 1.3, 0.45, 10), '#a9a397', { y: 4.4 }));
      P.push(part(Cone(1.45, 1.9, 10), '#c95b4a', { y: 5.55 }));
      P.push(part(Cyl(0.03, 0.03, 1.0, 4), '#6b5a4a', { y: 6.9 }));
      P.push(part(Box(0.6, 0.35, 0.03), '#f2c94c', { y: 7.15, x: 0.3 }));
      P.push(part(Box(0.35, 0.6, 0.08), '#4a4a55', { y: 2.6, z: 1.1 }));
      big = true; break;
    case 'cottage':
      P.push(part(Box(2.0, 1.4, 1.6), '#f1e6cf', { y: 0.7 }));
      P.push(part(prism(2.3, 1.9, 1.0), '#b5583f', { y: 1.4 }));
      P.push(part(Box(0.3, 0.7, 0.3), '#8f7a6a', { y: 2.0, x: 0.6 }));
      P.push(part(Box(0.4, 0.75, 0.06), '#7a5238', { y: 0.38, z: 0.81 }));
      P.push(part(Box(0.38, 0.38, 0.06), '#9fd0e8', { y: 0.85, z: 0.81, x: 0.6 }));
      big = true; break;
    case 'ship':
      P.push(part(Box(1.5, 0.8, 4.2), '#8a5a3b', { y: 0.3 }));
      P.push(part(Box(1.6, 0.2, 4.4), '#6d4429', { y: 0.75 }));
      P.push(part(Cyl(0.07, 0.08, 4.0, 5), '#6d4429', { y: 2.7 }));
      P.push(part(Box(2.0, 1.4, 0.05), '#fbf6ea', { y: 2.4, z: 0.05 }));
      P.push(part(Box(1.5, 0.9, 0.05), '#fbf6ea', { y: 3.6, z: 0.05 }));
      P.push(part(Box(0.6, 0.3, 0.02), '#d9654b', { y: 4.6, x: 0.3 }));
      big = true; break;
    case 'lighthouse':
      P.push(part(Cyl(0.65, 0.95, 5.0, 10), '#fbf6ea', { y: 2.5 }));
      P.push(part(Cyl(0.72, 0.78, 0.7, 10), '#d9654b', { y: 2.0 }));
      P.push(part(Cyl(0.66, 0.7, 0.7, 10), '#d9654b', { y: 3.8 }));
      P.push(part(Cyl(0.5, 0.5, 0.7, 8), '#ffe08a', { y: 5.35 }));
      P.push(part(Cone(0.7, 0.7, 8), '#c95b4a', { y: 6.05 }));
      big = true; break;
    case 'factory':
      P.push(part(Box(3.2, 2.2, 2.4), '#b9644d', { y: 1.1 }));
      for (const px of [-1.05, 0, 1.05]) P.push(part(prism(1.05, 2.4, 0.7), '#7d4a3e', { x: px, y: 2.2 }));
      P.push(part(Cyl(0.3, 0.42, 3.6, 8), '#6e5a52', { y: 3.4, x: 1.0, z: -0.6 }));
      P.push(part(Cyl(0.25, 0.36, 2.8, 8), '#6e5a52', { y: 3.0, x: -0.8, z: -0.7 }));
      for (const px of [-1.1, -0.4, 0.4, 1.1]) P.push(part(Box(0.35, 0.5, 0.05), '#ffe3a0', { x: px, y: 1.2, z: 1.21 }));
      big = true; break;
    case 'windmill':
      P.push(part(Cyl(0.75, 1.1, 3.2, 8), '#e9dcc0', { y: 1.6 }));
      P.push(part(Cone(0.95, 1.0, 8), '#a85b45', { y: 3.7 }));
      for (let i = 0; i < 4; i++) P.push(part(Box(0.32, 2.6, 0.05), '#f7f1e4', { y: 3.1, z: 1.0, rz: i * Math.PI / 2 + 0.4, x: 0 }));
      big = true; break;
    case 'lamp':
      P.push(part(Cyl(0.06, 0.08, 2.6, 6), '#3d3a40', { y: 1.3 }));
      P.push(part(Box(0.34, 0.42, 0.34), '#ffe08a', { y: 2.75 }));
      P.push(part(Cone(0.3, 0.25, 4), '#3d3a40', { y: 3.08, ry: Math.PI / 4 }));
      break;
    case 'tower2':
      P.push(part(Box(2.2, 6, 2.2), '#8fb6cf', { y: 3 }));
      for (let i = 0; i < 5; i++) P.push(part(Box(2.25, 0.12, 2.25), '#dfe9ef', { y: 1 + i * 1.1 }));
      P.push(part(Box(1.4, 0.6, 1.4), '#c5d3db', { y: 6.3 }));
      big = true; break;
    case 'dome':
      P.push(part(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f3f1fa', {}));
      P.push(part(Cyl(1.75, 1.75, 0.25, 14), '#b9b3d6', { y: 0.12 }));
      P.push(part(Box(0.7, 0.9, 0.2), '#6fd3d0', { y: 0.5, z: 1.5 }));
      P.push(part(Cyl(0.05, 0.05, 1.0, 4), '#8a86a8', { y: 1.9 }));
      P.push(part(Sph(0.12, 6, 5), '#ff9ec7', { y: 2.45 }));
      big = true; break;
    case 'tuft':
      for (let i = 0; i < 4; i++) P.push(part(Cone(0.09, 0.5 + (i % 2) * 0.2, 4), '#7fb86a', { x: (i - 1.5) * 0.13, y: 0.25, z: (i % 2) * 0.1, rz: (i - 1.5) * 0.25 }));
      break;
    case 'flower':
      P.push(part(Cyl(0.02, 0.02, 0.45, 4), '#5f9a50', { y: 0.22 }));
      P.push(part(Ico(0.12), '#ffffff', { y: 0.5 }));
      P.push(part(Ico(0.06), '#f2c94c', { y: 0.52, z: 0.08 }));
      P.push(part(Cyl(0.02, 0.02, 0.35, 4), '#5f9a50', { y: 0.17, x: 0.22 }));
      P.push(part(Ico(0.1), '#f29bc0', { y: 0.38, x: 0.22 }));
      break;
    case 'pebble':
      P.push(part(new THREE.DodecahedronGeometry(0.22, 0), '#b4ada3', { y: 0.06, sy: 0.5 }));
      P.push(part(new THREE.DodecahedronGeometry(0.14, 0), '#a39c92', { y: 0.05, x: 0.3, sy: 0.6 }));
      break;
    case 'cloud':
      P.push(part(Ico(3, 1), '#ffffff', { sy: 0.7 }));
      P.push(part(Ico(2.3, 1), '#ffffff', { x: 3, y: -0.4, sy: 0.7 }));
      P.push(part(Ico(2.1, 1), '#ffffff', { x: -2.8, y: -0.6, sy: 0.65 }));
      P.push(part(Ico(1.8, 1), '#ffffff', { x: 1.2, y: 1.2, sy: 0.8 }));
      break;
    case 'crystal':
      P.push(part(new THREE.OctahedronGeometry(0.55, 0), '#a99ee8', { y: 0.9, sy: 2.0 }));
      P.push(part(new THREE.OctahedronGeometry(0.35, 0), '#8fd8e0', { y: 0.55, x: 0.55, sy: 1.8, rz: -0.3 }));
      break;
    case 'antenna':
      P.push(part(Cyl(0.08, 0.12, 2.6, 6), '#8a86a8', { y: 1.3 }));
      P.push(part(Cone(0.9, 0.35, 12), '#f3f1fa', { y: 2.7, rx: 0.6 }));
      P.push(part(Sph(0.1, 6, 5), '#ff9ec7', { y: 3.1, z: 0.3 }));
      break;
  }
  return { geo: merge(P), big };
}

// ---------- Travelers ----------
// A traveler stands with feet at y = 0 and faces -z (the way the band runs).
export function buildBody() {
  return merge([part(new THREE.CapsuleGeometry(0.27, 0.36, 4, 10), '#ffffff', { y: 0.92 })]);
}
export function buildHead() {
  return merge([part(Sph(0.23, 12, 10), '#ffffff', { y: 1.52 })]);
}
export function buildLeg() {
  // pivot at the hip
  return merge([part(Box(0.14, 0.46, 0.16), '#ffffff', { y: -0.23 })]);
}
export function buildHat(kind) {
  const P = [];
  switch (kind) {
    case 'hair':
      P.push(part(Sph(0.24, 10, 6), '#6b4026', { y: 1.6, sy: 0.65, z: 0.04 }));
      P.push(part(Ico(0.11), '#6b4026', { y: 1.77, x: 0.06 }));
      P.push(part(Box(0.56, 0.12, 0.1), '#c98b4a', { y: 1.07, z: 0, rz: 0.5 })); // fur sash
      break;
    case 'helmet':
      P.push(part(new THREE.SphereGeometry(0.26, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c99545', { y: 1.56 }));
      P.push(part(Box(0.06, 0.16, 0.42), '#c9473b', { y: 1.86 }));
      break;
    case 'knight':
      P.push(part(Cyl(0.255, 0.255, 0.32, 12), '#c4cad2', { y: 1.6 }));
      P.push(part(Sph(0.255, 12, 6), '#c4cad2', { y: 1.76, sy: 0.4 }));
      P.push(part(Box(0.3, 0.05, 0.05), '#3d4048', { y: 1.6, z: -0.25 }));
      P.push(part(Box(0.04, 0.2, 0.32), '#d9b24a', { y: 1.92 }));
      break;
    case 'tricorn':
      P.push(part(Cyl(0.36, 0.36, 0.06, 3), '#2b2b33', { y: 1.72, ry: Math.PI }));
      P.push(part(Cyl(0.19, 0.22, 0.16, 10), '#2b2b33', { y: 1.8 }));
      P.push(part(Box(0.05, 0.05, 0.05), '#e8c45a', { y: 1.78, z: -0.3 }));
      break;
    case 'tophat':
      P.push(part(Cyl(0.32, 0.32, 0.04, 14), '#26242b', { y: 1.71 }));
      P.push(part(Cyl(0.19, 0.19, 0.38, 14), '#26242b', { y: 1.92 }));
      P.push(part(Cyl(0.2, 0.2, 0.07, 14), '#b5523b', { y: 1.78 }));
      P.push(part(Cyl(0.08, 0.08, 0.02, 10), '#d9b24a', { y: 1.5, z: -0.21, rx: Math.PI / 2, x: 0.09 })); // monocle
      break;
    case 'cap':
      P.push(part(new THREE.SphereGeometry(0.255, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#2f6fb3', { y: 1.58 }));
      P.push(part(Box(0.3, 0.03, 0.22), '#2f6fb3', { y: 1.59, z: -0.27 }));
      break;
    case 'bubble':
      P.push(part(Sph(0.33, 14, 10), '#f6f6fb', { y: 1.54 }));
      P.push(part(Sph(0.24, 12, 8), '#384a7a', { y: 1.54, z: -0.14, sz: 0.7 }));
      P.push(part(Cyl(0.02, 0.02, 0.3, 4), '#8a86a8', { y: 1.95, x: 0.14 }));
      P.push(part(Sph(0.05, 6, 5), '#ff9ec7', { y: 2.12, x: 0.14 }));
      P.push(part(Box(0.4, 0.3, 0.2), '#d8d6e6', { y: 1.0, z: 0.26 })); // backpack
      break;
  }
  return merge(P);
}
export function buildItem(kind) {
  const P = [];
  // a little arm toward the item
  P.push(part(Box(0.1, 0.36, 0.1), '#e9b98f', { x: 0.3, y: 1.0, z: -0.05, rz: 0.3 }));
  switch (kind) {
    case 'club':
      P.push(part(Cyl(0.05, 0.11, 0.62, 6), '#8a5a3b', { x: 0.38, y: 1.05, z: -0.12, rx: -0.4 }));
      break;
    case 'spear':
      P.push(part(Cyl(0.025, 0.025, 1.6, 5), '#8a5a3b', { x: 0.38, y: 1.2 }));
      P.push(part(Cone(0.06, 0.2, 5), '#c99545', { x: 0.38, y: 2.08 }));
      break;
    case 'bow':
      P.push(part(new THREE.TorusGeometry(0.36, 0.03, 4, 10, Math.PI), '#8a5a3b', { x: 0.38, y: 1.0, z: -0.15, rz: -Math.PI / 2 }));
      P.push(part(Cyl(0.006, 0.006, 0.72, 3), '#f3efe6', { x: 0.38, y: 1.0, z: -0.15 }));
      break;
    case 'musket':
      P.push(part(Cyl(0.035, 0.045, 1.1, 6), '#5a3d2a', { x: 0.36, y: 1.05, z: -0.3, rx: -1.2 }));
      break;
    case 'gear':
      P.push(part(new THREE.TorusGeometry(0.13, 0.05, 5, 10), '#d4a84a', { x: 0.38, y: 0.95, z: -0.18 }));
      P.push(part(Cyl(0.04, 0.04, 0.3, 6), '#8a6a3a', { x: 0.38, y: 0.95, z: -0.18, rx: Math.PI / 2 }));
      break;
    case 'blaster':
      P.push(part(Box(0.13, 0.17, 0.42), '#3b8f7a', { x: 0.38, y: 0.98, z: -0.22 }));
      P.push(part(Cyl(0.04, 0.04, 0.2, 6), '#f2c94c', { x: 0.38, y: 1.0, z: -0.5, rx: Math.PI / 2 }));
      break;
    case 'laser':
      P.push(part(Box(0.11, 0.13, 0.46), '#f6f6fb', { x: 0.38, y: 0.98, z: -0.22 }));
      P.push(part(Sph(0.06, 6, 5), '#6fe3e0', { x: 0.38, y: 1.0, z: -0.47 }));
      break;
  }
  return merge(P);
}

// What the band throws. Long ones point along -z.
export function buildProjectile(kind) {
  const P = [];
  const along = { rx: Math.PI / 2 };
  switch (kind) {
    case 'rock': P.push(part(new THREE.DodecahedronGeometry(0.15, 0), '#8f8a84', {})); break;
    case 'spear':
      P.push(part(Cyl(0.03, 0.03, 0.9, 5), '#8a5a3b', along));
      P.push(part(Cone(0.06, 0.2, 5), '#c99545', { rx: -Math.PI / 2, z: -0.52 }));
      break;
    case 'arrow':
      P.push(part(Cyl(0.02, 0.02, 0.75, 4), '#8a5a3b', along));
      P.push(part(Cone(0.05, 0.15, 4), '#9aa0a8', { rx: -Math.PI / 2, z: -0.44 }));
      P.push(part(Box(0.12, 0.01, 0.14), '#f3efe6', { z: 0.33 }));
      break;
    case 'ball': P.push(part(Sph(0.14, 8, 6), '#3b3a40', {})); break;
    case 'bolt':
      P.push(part(Box(0.09, 0.09, 0.38), '#d4a84a', {}));
      P.push(part(Cone(0.08, 0.14, 4), '#b8862f', { rx: -Math.PI / 2, z: -0.25 }));
      break;
    case 'pellet': P.push(part(Sph(0.11, 8, 6), '#ffd84a', {})); break;
    case 'laser': P.push(part(new THREE.CapsuleGeometry(0.05, 0.6, 3, 6), '#7ff0ea', along)); break;
  }
  return merge(P);
}

export function buildCoin() {
  return merge([
    part(Cyl(0.3, 0.3, 0.08, 16), '#f2c94c', { rx: Math.PI / 2 }),
    part(Cyl(0.2, 0.2, 0.1, 16), '#e0a92e', { rx: Math.PI / 2 }),
  ]);
}
