// Orchard Bakery: the world (ground, sky, orchard, wheat, bakery, ovens, stall, tea garden).
import * as THREE from 'three';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';
import {
  rand, fbm, noise3, paint, paintFaces, displace, at, mesh, merge, canvasTex, speckle, mats, wheatStalkGeo,
  makeApple, makeBasket, makeBarrel, makeCrate, makeTable, makeChair, makeLamp, makeBench, makeUmbrella, makePerson
} from './models.js';

// ---------- layout ----------
export const BOUNDS = { minX: -16.2, maxX: 16.2, minZ: -14.2, maxZ: 14.6 };
export const PATHS = [ // [x1,z1,x2,z2,width]
  [0, 18, 0, 6.4, 2.0], [0, 4.2, 0, -8.6, 2.0],
  [0, 1.2, -6, 1.2, 1.6], [0, 1.2, 6.2, 1.2, 1.6],
  [0, -5, -4.4, -5, 1.8], [0, -5, 4.4, -5, 1.8],
  [0, 9, 6.5, 10.5, 1.4], [0, 9.5, -4.5, 10.8, 1.2]
];
export const PLAZAS = [[0, -5.6, 3.2], [0, 4.9, 2.4]];
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
  gate: new THREE.Vector3(0, 0, 17)
};
export const TREE_SPOTS = {
  start: [[-7.4, -1.6], [-10.4, -1.6], [-7.4, 2.0], [-10.4, 2.0]],
  trees2: [[-13.4, -1.6], [-13.4, 2.0], [-7.4, 5.6], [-10.4, 5.6]],
  orchard3: [[-13.4, 5.6], [-7.4, -5.2], [-10.4, -5.2], [-13.4, -5.2]]
};
export const FIELD = { x0: 7, z0: -3, nx: 6, nz: 7 };
export const TEA = [[6.4, 10.2, 0], [9.6, 10.2, 1], [8.0, 12.9, 2]];
export const PADS = {
  trees2: { pos: [-4.8, 4.3], cost: 15, name: 'More apple trees', icon: 'tree' },
  basket: { pos: [-2.6, 2.6], cost: 25, name: 'Bigger tray', icon: 'tray' },
  wheat: { pos: [5.0, 3.3], cost: 40, name: 'Wheat field', icon: 'wheat' },
  bread: { pos: [4.4, -4.6], cost: 60, name: 'Bread oven', icon: 'bread', req: 'wheat' },
  tea: { pos: [4.4, 8.2], cost: 80, name: 'Tea garden', icon: 'tea' },
  helper: { pos: [-4.4, 7.4], cost: 110, name: 'Orchard helper', icon: 'helper', req: 'trees2' },
  flowers: { pos: [-3.4, 10.6], cost: 60, name: 'Flower garden', icon: 'flower' },
  runner: { pos: [-1.9, -2.6], cost: 140, name: 'Shop helper', icon: 'runner', req: 'bread' },
  barrow: { pos: [2.8, -1.6], cost: 120, name: 'Big wooden tray', icon: 'tray', req: 'basket' },
  orchard3: { pos: [-4.8, -2.2], cost: 150, name: 'Orchard corner', icon: 'tree', req: 'trees2' }
};
export const PAD_ORDER = ['trees2', 'basket', 'wheat', 'bread', 'tea', 'helper', 'flowers', 'runner', 'barrow', 'orchard3'];

// ---------- sky + ground ----------
function makeSky(scene) {
  const geo = new THREE.SphereGeometry(220, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x8fc3e6) }, mid: { value: new THREE.Color(0xd5e8ef) }, bot: { value: new THREE.Color(0xf3e6d0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(-0.02, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.6, h)); gl_FragColor = vec4(c,1.0); }`
  });
  const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -1; scene.add(sky);
  // Soft clouds: flattened white blobs high up
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
  const r = rand(44);
  for (let i = 0; i < 9; i++) {
    const parts = []; for (let k = 0; k < 5; k++) parts.push(at(new THREE.SphereGeometry(1, 12, 8), k * 1.6 - 3.2 + r(), r() * 0.6, r() * 1.2, 0, 0, 0, 1.2 + r() * 1.2));
    const c = new THREE.Mesh(merge(parts), cm); const a = r() * Math.PI * 2, d = 90 + r() * 60;
    c.position.set(Math.cos(a) * d, 32 + r() * 18, Math.sin(a) * d - 30); c.scale.set(3, 1.1, 2); c.lookAt(0, c.position.y, 0); scene.add(c);
  }
}

function makeGround(scene) {
  const SIZE = 76, PX = 2048;
  const tex = canvasTex(PX, PX, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    const g1 = [0.33, 0.52, 0.2], g2 = [0.5, 0.64, 0.28], dirt = [0.76, 0.63, 0.44], dirt2 = [0.62, 0.5, 0.34];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = (x / w - 0.5) * SIZE, wz = (y / h - 0.5) * SIZE;
      const n = fbm(wx * 0.35, 0, wz * 0.35) * 0.5 + 0.5, fine = noise3(wx * 6, 1, wz * 6) * 0.5 + 0.5;
      const p = pathAmount(wx, wz);
      const k = n * 0.7 + fine * 0.3;
      let r = g1[0] + (g2[0] - g1[0]) * k, g = g1[1] + (g2[1] - g1[1]) * k, b = g1[2] + (g2[2] - g1[2]) * k;
      const dk = fine * 0.6 + n * 0.4;
      const pr = dirt[0] + (dirt2[0] - dirt[0]) * dk, pg = dirt[1] + (dirt2[1] - dirt[1]) * dk, pb = dirt[2] + (dirt2[2] - dirt[2]) * dk;
      r += (pr - r) * p; g += (pg - g) * p; b += (pb - b) * p;
      const i = (y * w + x) * 4; d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // pebbles on the paths, clover and darker grass flecks elsewhere
    const rr = rand(12);
    for (let i = 0; i < 26000; i++) {
      const x = rr() * w, y = rr() * h, wx = (x / w - 0.5) * SIZE, wz = (y / h - 0.5) * SIZE;
      const p = pathAmount(wx, wz);
      if (p > 0.6) { c.fillStyle = rr() > 0.5 ? 'rgba(110,90,70,.35)' : 'rgba(240,225,200,.4)'; c.beginPath(); c.arc(x, y, 0.8 + rr() * 1.4, 0, 7); c.fill(); }
      else if (p < 0.1) { c.fillStyle = rr() > 0.5 ? 'rgba(60,95,40,.35)' : 'rgba(170,200,110,.3)'; c.fillRect(x, y, 1.5, 3 + rr() * 3); }
    }
  });
  const g = new THREE.PlaneGeometry(SIZE, SIZE); g.rotateX(-Math.PI / 2);
  const ground = mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), false, true);
  scene.add(ground);
  const far = mesh(at(new THREE.CircleGeometry(260, 48), 0, -0.02, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7c9a4f, roughness: 1 }), false, true);
  scene.add(far);
  // Gentle hills far away
  const hm = new THREE.MeshStandardMaterial({ color: 0x86a45a, roughness: 1 });
  const r = rand(8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3, d = 75 + r() * 40;
    const h = mesh(new THREE.SphereGeometry(1, 24, 12), hm, false, false);
    h.position.set(Math.cos(a) * d, -6, Math.sin(a) * d); h.scale.set(28 + r() * 20, 10 + r() * 8, 20 + r() * 12); scene.add(h);
  }
}

// ---------- vegetation ----------
function foliageBlob(cx, cy, cz, rad, seed, light = 0x86b452, dark = 0x2f5a22, detail) {
  // Leafy canopy: a bumpy ball made of many small leaf clumps, darker in the hollows.
  const ico = new THREE.IcosahedronGeometry(rad, detail ?? (rad > 0.8 ? 4 : 3)); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  const L = new THREE.Color(light), D = new THREE.Color(dark), M = new THREE.Color(0x5f8f3a);
  const bump = (v) => fbm(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed) * 0.22 + Math.abs(noise3(v.x * 7 / rad + seed, v.y * 7 / rad, v.z * 7 / rad)) * 0.11;
  displace(g, (v) => { v.multiplyScalar(1 + bump(v) - 0.04); });
  g.translate(cx, cy, cz);
  paint(g, (x, y, z, c) => {
    const lx = x - cx, ly = y - cy, lz = z - cz;
    const clump = Math.abs(noise3(lx * 7 / rad + seed, ly * 7 / rad, lz * 7 / rad));
    const up = THREE.MathUtils.clamp(ly / rad * 0.5 + 0.5, 0, 1);
    const k = THREE.MathUtils.clamp(up * 0.7 + clump * 0.9 - 0.15 + fbm(x * 3, y * 3, z * 3) * 0.3, 0, 1);
    c.copy(D).lerp(M, Math.min(1, k * 1.6)).lerp(L, Math.max(0, k * 1.6 - 0.6));
  });
  return g;
}
export function makeTree(seed, fruit = true) {
  const r = rand(seed), m = mats(), grp = new THREE.Group();
  const h = 1.25 + r() * 0.25;
  // trunk with a slight bend and two branches
  const trunk = new THREE.CylinderGeometry(0.13, 0.2, h, 10, 6);
  displace(trunk, (v) => { v.x += Math.sin(v.y * 1.6 + seed) * 0.05; v.z += Math.cos(v.y * 1.3) * 0.03; });
  trunk.translate(0, h / 2, 0);
  const br = [];
  for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2; br.push(at(new THREE.CylinderGeometry(0.05, 0.09, 0.9, 7), Math.cos(a) * 0.25, h + 0.25, Math.sin(a) * 0.25, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7)); }
  grp.add(mesh(merge([trunk, ...br]), m.bark));
  const blobs = [], centers = [];
  const n = 6 + ((r() * 3) | 0);
  centers.push([0, h + 1.05, 0, 1.0]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5, d = 0.55 + r() * 0.3;
    centers.push([Math.cos(a) * d, h + 0.75 + r() * 0.65, Math.sin(a) * d, 0.55 + r() * 0.25]);
  }
  centers.forEach(([x, y, z, rad], i) => blobs.push(foliageBlob(x, y, z, rad, seed + i * 3.1)));
  const foliage = mesh(merge(blobs), fruit ? m.foliage.clone() : m.foliage); grp.add(foliage);
  const apples = [];
  if (fruit) {
    // Hang apples just outside the canopy, mostly on the lower half so they're easy to see
    const rr = rand(seed * 13);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rr() * 0.4, el = -0.15 + rr() * 0.6;
      const p = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(1.3).add(new THREE.Vector3(0, h + 0.95, 0));
      const ap = makeApple(true); ap.position.copy(p); ap.rotation.set(rr() * 0.6, rr() * 6, rr() * 0.6); ap.scale.setScalar(0.95);
      grp.add(ap); apples.push({ mesh: ap, grow: 1 });
    }
  }
  return { group: grp, apples, foliage };
}

function makeGrass(scene, avoid) {
  // tuft = 5 thin curved blades
  const blades = [], r = rand(31);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.PlaneGeometry(0.035, 0.2, 1, 2); b.translate(0, 0.1, 0);
    displace(b, (v) => { v.z += v.y * v.y * 1.4; v.x *= 1 - v.y * 3.6; });
    blades.push(at(b, (r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12, 0, r() * Math.PI * 2, (r() - 0.5) * 0.4, 0.7 + r() * 0.6));
  }
  const geo = merge(blades);
  paint(geo, (x, y, z, c) => c.set(0x3d6a26).lerp(new THREE.Color(0x9cc25a), THREE.MathUtils.clamp(y / 0.22, 0, 1)));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const wind = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      float sway = sin(uTime * 1.6 + wp.x * 0.6 + wp.y * 0.4) * 0.06 + sin(uTime * 2.7 + wp.x) * 0.02;
      transformed.x += sway * position.y * 3.0; transformed.z += sway * position.y * 1.5;`);
  };
  const N = 7000, im = new THREE.InstancedMesh(geo, mat, N); im.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let k = 0, tries = 0;
  while (k < N && tries < N * 6) {
    tries++;
    const x = (r() - 0.5) * 40, z = (r() - 0.5) * 38;
    if (pathAmount(x, z) > 0.05 || avoid(x, z)) continue;
    if (fbm(x * 0.4, 5, z * 0.4) < -0.25) continue; // leave natural bare patches
    q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0));
    const s = 0.7 + r() * 0.7;
    mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.8 + r() * 0.5), s));
    im.setMatrixAt(k, mtx); im.setColorAt(k, col.setHSL(0.25 + r() * 0.05, 0.35, 0.55 + r() * 0.2)); k++;
  }
  im.count = k; scene.add(im);
  // little flowers dotted in the grass
  const fg = merge([at(new THREE.SphereGeometry(0.05, 6, 5), 0, 0.2, 0), at(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 3), 0, 0.1, 0)]);
  paint(fg, (x, y, z, c) => c.set(y > 0.16 ? 0xffffff : 0x4a7a30));
  const fm = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 600);
  const fc = [0xfff6e0, 0xf4d35e, 0xe58fb0, 0xb7a6e8, 0xffffff];
  k = 0;
  for (let i = 0; i < 1600 && k < 600; i++) {
    const x = (r() - 0.5) * 40, z = (r() - 0.5) * 38;
    if (pathAmount(x, z) > 0.05 || avoid(x, z)) continue;
    mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 0.7 + r() * 0.6, 1));
    fm.setMatrixAt(k, mtx); fm.setColorAt(k, col.set(fc[(r() * fc.length) | 0])); k++;
  }
  fm.count = k; scene.add(fm);
  return wind;
}

function makeForest(scene) {
  // Instanced trees beyond the fence so the farm sits in a green valley
  const r = rand(91);
  const canopy = merge([foliageBlob(0, 2.6, 0, 1.3, 1, 0x6f9e48, 0x2f5a26, 2), foliageBlob(0.6, 2.1, 0.3, 0.9, 2, 0x6f9e48, 0x2f5a26, 2), foliageBlob(-0.5, 2.2, -0.3, 0.95, 3, 0x6f9e48, 0x2f5a26, 2)]);
  const pine = merge([0, 1, 2, 3].map((i) => paint(at(new THREE.ConeGeometry(1.3 - i * 0.26, 1.5, 9), 0, 1.6 + i * 0.8, 0), (x, y, z, c) => c.set(0x2f5a33).lerp(new THREE.Color(0x5d8a4a), THREE.MathUtils.clamp((y - 1) / 4, 0, 1)))));
  const trunk = at(new THREE.CylinderGeometry(0.15, 0.22, 1.8, 7), 0, 0.9, 0);
  const N = 170;
  const ic = new THREE.InstancedMesh(canopy, mats().foliage, N), ip = new THREE.InstancedMesh(pine, mats().foliage, N), it = new THREE.InstancedMesh(trunk, mats().bark, N * 2);
  for (const m of [ic, ip, it]) { m.castShadow = true; m.receiveShadow = true; }
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  let a = 0, b = 0, t = 0;
  for (let i = 0; i < N * 2; i++) {
    const ang = r() * Math.PI * 2, d = 21 + r() * 22;
    const x = Math.cos(ang) * d * 1.05, z = Math.sin(ang) * d;
    if (Math.abs(x) < 3.5 && z > 14) continue; // keep the road clear
    if (Math.abs(x) < BOUNDS.maxX + 2 && Math.abs(z) < BOUNDS.maxZ + 2) continue;
    const s = 0.9 + r() * 0.9;
    mtx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
    if (r() > 0.45 && a < N) { ic.setMatrixAt(a, mtx); ic.setColorAt(a++, col.setHSL(0.25 + r() * 0.04, 0.3, 0.75 + r() * 0.3)); }
    else if (b < N) { ip.setMatrixAt(b, mtx); ip.setColorAt(b++, col.setHSL(0.3, 0.2, 0.8 + r() * 0.25)); }
    else continue;
    it.setMatrixAt(t++, mtx);
  }
  ic.count = a; ip.count = b; it.count = t;
  scene.add(ic, ip, it);
}

function makeFence(scene) {
  const picket = merge([new THREE.BoxGeometry(0.09, 0.85, 0.035).translate(0, 0.42, 0), at(new THREE.ConeGeometry(0.064, 0.09, 4), 0, 0.89, 0, 0, Math.PI / 4, 0, new THREE.Vector3(1, 1, 0.4))]);
  const pts = [];
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const add = (x1, z1, x2, z2) => { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.floor(L / 0.22); for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, Math.atan2(x2 - x1, z2 - z1)]); } };
  add(minX - 0.4, minZ - 0.4, maxX + 0.4, minZ - 0.4); add(minX - 0.4, minZ - 0.4, minX - 0.4, maxZ + 0.4); add(maxX + 0.4, minZ - 0.4, maxX + 0.4, maxZ + 0.4);
  add(minX - 0.4, maxZ + 0.4, -1.6, maxZ + 0.4); add(1.6, maxZ + 0.4, maxX + 0.4, maxZ + 0.4);
  const im = new THREE.InstancedMesh(picket, mats().white, pts.length); im.castShadow = true; im.receiveShadow = true;
  const mtx = new THREE.Matrix4();
  pts.forEach(([x, z, a], i) => { mtx.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, mtx); });
  scene.add(im);
  const rails = (x1, z1, x2, z2) => { for (const y of [0.3, 0.65]) { const L = Math.hypot(x2 - x1, z2 - z1); const r = mesh(new THREE.BoxGeometry(L, 0.06, 0.03), mats().white); r.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); r.rotation.y = -Math.atan2(z2 - z1, x2 - x1); r.position.z += 0.03; scene.add(r); } };
  rails(minX - 0.4, minZ - 0.4, maxX + 0.4, minZ - 0.4); rails(minX - 0.4, minZ - 0.4, minX - 0.4, maxZ + 0.4); rails(maxX + 0.4, minZ - 0.4, maxX + 0.4, maxZ + 0.4);
  rails(minX - 0.4, maxZ + 0.4, -1.6, maxZ + 0.4); rails(1.6, maxZ + 0.4, maxX + 0.4, maxZ + 0.4);
  // gate posts
  for (const x of [-1.7, 1.7]) { const p = mesh(at(new THREE.BoxGeometry(0.22, 1.5, 0.22), x, 0.75, maxZ + 0.4), mats().woodDark); scene.add(p); scene.add(mesh(at(new THREE.SphereGeometry(0.14, 10, 8), x, 1.58, maxZ + 0.4), mats().woodDark)); }
}

// ---------- buildings ----------
function shingleRoof(w, d, rise, color = 0xc8553d) {
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
function signTex(text, bg = '#3b5a32', fg = '#fbf1df') {
  return canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e9b44c'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = fg; c.font = 'bold 84px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 4);
  });
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
  const g = new THREE.Group(), m = mats();
  const W = 7, D = 4.4, H = 3;
  g.add(mesh(at(new THREE.BoxGeometry(W + 0.2, 0.45, D + 0.2), 0, 0.22, 0), m.stone));
  const walls = mesh(at(new THREE.BoxGeometry(W, H, D), 0, 0.45 + H / 2, 0), m.plaster); g.add(walls);
  // timber frame
  const top = 0.45 + H;
  for (const z of [D / 2 + 0.01, -D / 2 - 0.01]) {
    g.add(mesh(at(new THREE.BoxGeometry(W + 0.05, 0.16, 0.1), 0, 0.5, z), m.beam), mesh(at(new THREE.BoxGeometry(W + 0.05, 0.16, 0.1), 0, top - 0.08, z), m.beam), mesh(at(new THREE.BoxGeometry(W + 0.05, 0.12, 0.1), 0, 0.45 + H * 0.55, z), m.beam));
    for (const x of [-W / 2, -W / 4 - 0.4, W / 4 + 0.4, W / 2]) g.add(mesh(at(new THREE.BoxGeometry(0.16, H, 0.1), x, 0.45 + H / 2, z), m.beam));
  }
  for (const x of [-W / 2 - 0.01, W / 2 + 0.01]) for (const z of [-D / 2, 0, D / 2]) g.add(mesh(at(new THREE.BoxGeometry(0.1, H, 0.16), x, 0.45 + H / 2, z), m.beam));
  // gables
  const rise = 1.7;
  const gs = new THREE.Shape(); gs.moveTo(-D / 2, 0); gs.lineTo(D / 2, 0); gs.lineTo(0, rise); gs.lineTo(-D / 2, 0);
  for (const s of [-1, 1]) { const gm = mesh(new THREE.ShapeGeometry(gs), m.plaster); gm.rotation.y = s * Math.PI / 2; gm.position.set(s * W / 2, top, 0); g.add(gm); }
  const roof = shingleRoof(W, D, rise); roof.position.y = top; g.add(roof);
  // chimney
  g.add(mesh(at(new THREE.BoxGeometry(0.6, 1.8, 0.6), 2.1, top + 1.3, -0.8), m.brick));
  g.add(mesh(at(new THREE.BoxGeometry(0.72, 0.12, 0.72), 2.1, top + 2.2, -0.8), m.stone));
  // door with arched frame
  const dz = D / 2 + 0.02;
  g.add(mesh(at(new THREE.BoxGeometry(1.25, 2.1, 0.1), 0, 0.45 + 1.05, dz), m.beam));
  g.add(mesh(at(new THREE.BoxGeometry(1.05, 1.95, 0.08), 0, 0.45 + 0.99, dz + 0.03), new THREE.MeshStandardMaterial({ color: 0x5f8a6a, roughness: 0.6 })));
  for (let i = 0; i < 4; i++) g.add(mesh(at(new THREE.BoxGeometry(0.02, 1.9, 0.02), -0.36 + i * 0.24, 0.45 + 0.99, dz + 0.08), m.beam, false));
  g.add(mesh(at(new THREE.SphereGeometry(0.05, 8, 6), 0.38, 1.4, dz + 0.1), m.gold, false));
  // shop sign above the door
  const sign = mesh(at(new THREE.PlaneGeometry(2.2, 0.68), 0, 0.45 + 2.6, dz + 0.08), new THREE.MeshStandardMaterial({ map: signTex('Bakery'), roughness: 0.6 }), false);
  g.add(sign);
  windowAt(g, -2.3, 0.45 + 1.45, dz, 1.1, 1.0); windowAt(g, 2.3, 0.45 + 1.45, dz, 1.1, 1.0);
  // awning over the front
  const aw = mesh(at(new THREE.PlaneGeometry(6.6, 1.1), 0, 0.45 + 2.15, dz + 0.45, -1.0), m.awning, true, true); g.add(aw);
  // steps
  g.add(mesh(at(new THREE.BoxGeometry(1.8, 0.18, 0.6), 0, 0.09, dz + 0.3), m.stone));
  // crates and barrels to the sides
  const b1 = makeBarrel(); b1.position.set(-3.2, 0, dz + 0.6); g.add(b1);
  const c1 = makeCrate(); c1.position.set(3.2, 0, dz + 0.55); c1.rotation.y = 0.2; g.add(c1);
  return { group: g, chimneyTop: new THREE.Vector3(2.1, top + 2.3, -0.8) };
}

function makeOven(kind) {
  // A wood-fired brick oven on a stone base, with a glowing mouth and its own little chimney.
  const g = new THREE.Group(), m = mats();
  const bread = kind === 'bread';
  g.add(mesh(at(new THREE.BoxGeometry(2.6, 1.0, 2.4), 0, 0.5, 0), m.stone));
  g.add(mesh(at(new THREE.BoxGeometry(2.8, 0.12, 2.6), 0, 1.06, 0), new THREE.MeshStandardMaterial({ map: textures2().slab, roughness: 0.8 })));
  const dome = new THREE.SphereGeometry(1.1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = bread ? new THREE.MeshStandardMaterial({ map: mats().plaster.map, color: 0xf6efe4, roughness: 0.9 }) : m.brick;
  const d = mesh(dome, domeMat); d.position.y = 1.1; d.scale.set(1, bread ? 0.85 : 0.95, 1); g.add(d);
  // brick arch around the mouth
  const arch = new THREE.TorusGeometry(0.48, 0.12, 10, 24, Math.PI);
  g.add(mesh(at(arch, 0, 1.12, 1.0), m.brick));
  for (const s of [-1, 1]) g.add(mesh(at(new THREE.BoxGeometry(0.24, 0.3, 0.3), s * 0.48, 1.26, 1.0), m.brick));
  // dark interior + fire
  g.add(mesh(at(new THREE.CircleGeometry(0.46, 24, 0, Math.PI), 0, 1.12, 0.93), m.dark, false));
  const fire = new THREE.Group(); fire.position.set(0, 1.14, 0.75); g.add(fire);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07 + (i % 2) * 0.03, 0.22 + (i % 3) * 0.06, 7), i % 2 ? m.fire : m.ember);
    f.position.set((i - 2) * 0.09, 0.1, -((i % 2) * 0.08)); fire.add(f);
  }
  for (let i = 0; i < 4; i++) fire.add(mesh(at(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6), (i - 1.5) * 0.08, 0.02, -0.05, 0, i, Math.PI / 2), m.beam, false));
  const glow = new THREE.PointLight(0xff8a3a, 2.5, 3.5, 2); glow.position.set(0, 1.4, 1.35); g.add(glow);
  // chimney
  g.add(mesh(at(new THREE.CylinderGeometry(0.16, 0.18, 0.8, 12), 0, 2.3, -0.3), bread ? m.stone : m.brick));
  // wooden peel leaning on the side, and a bag of flour
  g.add(mesh(at(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), 1.38, 0.8, 0.6, 0.2, 0, -0.25), m.wood));
  g.add(mesh(at(new THREE.BoxGeometry(0.34, 0.02, 0.4), 1.58, 0.06, 0.7, 0.2, 0, -0.25), m.wood));
  const sack = new THREE.SphereGeometry(0.28, 16, 12);
  displace(sack, (v) => { v.y = v.y < 0 ? v.y * 0.6 : v.y * 1.25; v.multiplyScalar(1 + fbm(v.x * 5, v.y * 5, v.z * 5) * 0.06); });
  g.add(mesh(at(sack, -1.55, 0.2, 0.7), new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 1 })));
  g.userData = { fire, glow, smokeAt: new THREE.Vector3(0, 2.75, -0.3) };
  return g;
}
const T2 = {};
function textures2() {
  if (!T2.slab) T2.slab = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#cfc6b8'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, ['#9a9186', '#efe8dc'], [1, 3]); });
  return T2;
}

function makeStall() {
  const g = new THREE.Group(), m = mats();
  const W = 3.0, D = 1.0, H = 0.95;
  g.add(mesh(at(new THREE.BoxGeometry(W, H, D), 0, H / 2, 0), m.wood));
  g.add(mesh(at(new THREE.BoxGeometry(W + 0.12, 0.06, D + 0.12), 0, H + 0.03, 0), m.woodDark));
  // cloth drape on the front
  const cloth = new THREE.PlaneGeometry(W + 0.05, 0.5, 30, 2);
  displace(cloth, (v) => { v.z += Math.sin(v.x * 9) * 0.02; });
  g.add(mesh(at(cloth, 0, H - 0.25, D / 2 + 0.03), new THREE.MeshStandardMaterial({ color: 0xf7efe0, roughness: 0.9, side: THREE.DoubleSide })));
  // two tall back posts hold a short awning, so the goods stay in view from above
  for (const x of [-1, 1]) g.add(mesh(at(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), x * (W / 2 - 0.05), 1.3, -D / 2 - 0.1), m.woodDark));
  for (const x of [-1, 1]) g.add(mesh(at(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), x * (W / 2 - 0.05), 2.3, -0.16, 1.05, 0, 0), m.woodDark));
  const tilt = 0.5, AD = 1.1;
  const awn = mesh(at(new THREE.PlaneGeometry(W + 0.5, AD), 0, 2.6 - Math.sin(tilt) * AD / 2, -D / 2 - 0.1 + Math.cos(tilt) * AD / 2, -Math.PI / 2 + tilt), m.awning); g.add(awn);
  const fz = -D / 2 - 0.1 + Math.cos(tilt) * AD, fy = 2.6 - Math.sin(tilt) * AD;
  // scalloped valance along the front edge
  const sc = new THREE.Shape(); sc.moveTo(-(W + 0.5) / 2, 0); sc.lineTo((W + 0.5) / 2, 0);
  const n = 12; for (let i = n; i >= 0; i--) { const x = -(W + 0.5) / 2 + i * (W + 0.5) / n; sc.lineTo(x, -0.2); if (i > 0) sc.quadraticCurveTo(x - (W + 0.5) / n / 2, -0.05, x - (W + 0.5) / n, -0.2); }
  g.add(mesh(at(new THREE.ShapeGeometry(sc), 0, fy, fz), new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.85, side: THREE.DoubleSide })));
  // board sign on the front of the counter
  g.add(mesh(at(new THREE.PlaneGeometry(1.2, 0.37), 0, H - 0.27, D / 2 + 0.05), new THREE.MeshStandardMaterial({ map: signTex('Fresh', '#7a4a2e'), roughness: 0.6 }), false));
  // baskets and crates for flavour
  const b = makeBasket(0.7); b.position.set(-1.9, 0, 0.3); g.add(b);
  const cr = makeCrate(); cr.position.set(1.95, 0, -0.1); cr.rotation.y = 0.15; g.add(cr);
  return g;
}

function makeField() {
  const g = new THREE.Group();
  const { x0, z0, nx, nz } = FIELD;
  // tilled soil bed
  const soil = new THREE.PlaneGeometry(nx + 0.4, nz + 0.4, nx * 8, nz * 8); soil.rotateX(-Math.PI / 2);
  displace(soil, (v) => { v.y = 0.04 + Math.sin(v.z * Math.PI * 2) * 0.04 + fbm(v.x * 3, 0, v.z * 3) * 0.015; });
  paint(soil, (x, y, z, c) => c.set(0x6b4a30).lerp(new THREE.Color(0x8c6a48), THREE.MathUtils.clamp(y * 10 + fbm(x * 4, 1, z * 4) * 0.4, 0, 1)));
  const s = mesh(soil, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), false, true);
  s.position.set(x0 + nx / 2, 0, z0 + nz / 2); g.add(s);
  const r = rand(55);
  const clump = wheatStalkGeo(r, 14, 0.85);
  const im = new THREE.InstancedMesh(clump, mats().wheat, nx * nz * 2); im.castShadow = true; im.receiveShadow = true;
  const cells = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = x0 + i + 0.5, cz = z0 + j + 0.5;
    cells.push({ x: cx, z: cz, grow: 1, idx: cells.length * 2, rot: r() * 6, rot2: r() * 6 });
  }
  g.add(im);
  // hay bales and a scarecrow
  const hay = new THREE.CylinderGeometry(0.45, 0.45, 0.7, 20, 2);
  paint(hay, (x, y, z, c) => c.set(0xd9b65a).lerp(new THREE.Color(0xb8923a), THREE.MathUtils.clamp(fbm(x * 8, y * 8, z * 8) + 0.4, 0, 1)));
  const hm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  for (const [x, z, ry] of [[x0 - 0.8, z0 + nz + 0.5, 0.3], [x0 + 0.3, z0 + nz + 1.1, 1.4]]) { const h = mesh(at(hay.clone(), 0, 0.45, 0, Math.PI / 2, ry, 0), hm); h.position.set(x, 0, z); g.add(h); }
  const sc = makePerson({ seed: 404, shirt: 0xc8553d, pants: 0x5a6a8a, hat: false, hairStyle: 3, skin: 0xe9dcc0 });
  sc.position.set(x0 + nx + 0.8, 0.2, z0 + 1); sc.userData.arms.forEach((a, i) => { a.sh.rotation.z = (i ? 1 : -1) * 1.45; }); g.add(sc);
  g.add(mesh(at(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), x0 + nx + 0.8, 0.5, z0 + 1), mats().wood));
  return { group: g, im, cells };
}
export function updateFieldInstances(field) {
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const c of field.cells) {
    const s = Math.max(0.02, c.grow);
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(e.set(0, k ? c.rot2 : c.rot, 0));
      mtx.compose(new THREE.Vector3(c.x + (k ? 0.18 : -0.18), 0.02, c.z + (k ? -0.1 : 0.12)), q, new THREE.Vector3(0.9 + s * 0.1, s, 0.9 + s * 0.1));
      field.im.setMatrixAt(c.idx + k, mtx);
    }
    const col = new THREE.Color().setRGB(0.75 + s * 0.25, 0.85 + s * 0.15, 0.6 + s * 0.4 * (s >= 1 ? 1 : 0.6));
    field.im.setColorAt(c.idx, col); field.im.setColorAt(c.idx + 1, col);
  }
  field.im.instanceMatrix.needsUpdate = true; if (field.im.instanceColor) field.im.instanceColor.needsUpdate = true;
}

function makeTeaGarden() {
  const g = new THREE.Group(), seats = [];
  // a round stone terrace with three tables
  const terr = mesh(at(new THREE.CylinderGeometry(3.4, 3.5, 0.08, 40), 8, 0.04, 11.4), mats().stone, false, true);
  terr.material = terr.material.clone(); terr.material.map = terr.material.map.clone(); terr.material.map.repeat.set(4, 4); terr.material.map.needsUpdate = true;
  g.add(terr);
  const cloth = new THREE.MeshStandardMaterial({ color: 0xfbf1df, roughness: 0.9 });
  TEA.forEach(([x, z], i) => {
    const t = makeTable(1.0, 1.0, 0.76, cloth); t.position.set(x, 0.08, z); g.add(t);
    const u = makeUmbrella(i % 2 ? 0x5f8a6a : 0xc8553d); u.position.set(x, 0.08, z); g.add(u);
    // tea set: pot and cups
    const pot = mesh(at(new THREE.SphereGeometry(0.11, 14, 10), x, 0.95, z, 0, 0, 0, new THREE.Vector3(1, 0.85, 1)), mats().white); g.add(pot);
    g.add(mesh(at(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 6), x + 0.12, 0.96, z, 0, 0, -1), mats().white));
    for (const s of [-1, 1]) {
      const ch = makeChair(); ch.position.set(x + s * 0.75, 0.08, z); ch.rotation.y = s * -Math.PI / 2; g.add(ch);
      g.add(mesh(at(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 12), x + s * 0.28, 0.85, z), mats().white));
      seats.push({ x: x + s * 0.75, z, face: s > 0 ? -Math.PI / 2 : Math.PI / 2, busy: null });
    }
  });
  // planters
  for (const [x, z] of [[4.9, 13.6], [11.1, 13.6], [11.4, 9.0]]) {
    const pot = mesh(at(new THREE.CylinderGeometry(0.35, 0.26, 0.5, 14), x, 0.25, z), new THREE.MeshStandardMaterial({ color: 0xb8653d, roughness: 0.8 })); g.add(pot);
    g.add(mesh(merge([foliageBlob(x, 0.75, z, 0.38, x * 3)]), mats().foliage));
  }
  return { group: g, seats };
}

function makeFlowerGarden() {
  const g = new THREE.Group();
  const r = rand(66);
  const beds = [[-6.5, 11.5, 2.6, 1.2], [-9.8, 11.5, 2.6, 1.2], [-8.2, 9.3, 4.6, 0.9]];
  for (const [x, z, w, d] of beds) {
    g.add(mesh(at(new THREE.BoxGeometry(w + 0.2, 0.22, d + 0.2), x, 0.11, z), mats().woodDark));
    g.add(mesh(at(new THREE.BoxGeometry(w, 0.05, d), x, 0.22, z), new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 1 }), false, true));
    for (let i = 0; i < w * d * 14; i++) {
      const fx = x + (r() - 0.5) * w * 0.92, fz = z + (r() - 0.5) * d * 0.9, h = 0.2 + r() * 0.25;
      g.add(mesh(at(new THREE.CylinderGeometry(0.01, 0.01, h, 3), fx, 0.22 + h / 2, fz), mats().leaf, false, false));
      const col = [0xe58fb0, 0xf4d35e, 0xfff6e0, 0xc8553d, 0xb7a6e8, 0xf29e4c][(r() * 6) | 0];
      const fl = mesh(at(new THREE.SphereGeometry(0.06 + r() * 0.03, 8, 6), fx, 0.24 + h, fz, 0, 0, 0, new THREE.Vector3(1, 0.6, 1)), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), true, false);
      g.add(fl);
    }
  }
  const b = makeBench(); b.position.set(-8.2, 0, 13.4); b.rotation.y = Math.PI; g.add(b);
  const l = makeLamp(); l.position.set(-4.8, 0, 12.6); g.add(l);
  return g;
}

// ---------- build everything ----------
export function buildWorld(scene) {
  makeSky(scene); makeGround(scene); makeForest(scene); makeFence(scene);
  const colliders = []; // {x,z,r} circles or {box:[minx,minz,maxx,maxz]}
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
  decor(makeBench(), -2.8, -2.6 + 9, Math.PI / 2, 0); // bench by the path
  decor(makeBarrel(), 6.6, -9.6, 0, 0.35); decor(makeCrate(), -6.6, -9.4, 0.4, 0.4); decor(makeCrate(), -6.9, -8.7, 1.2, 0.4);
  const well = new THREE.Group();
  well.add(mesh(at(new THREE.CylinderGeometry(0.7, 0.75, 0.75, 24, 1, true), 0, 0.37, 0), mats().stone));
  well.add(mesh(at(new THREE.TorusGeometry(0.72, 0.09, 8, 24), 0, 0.75, 0, Math.PI / 2), mats().stone));
  well.add(mesh(at(new THREE.CircleGeometry(0.66, 24), 0, 0.5, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3e6a7a, roughness: 0.1, metalness: 0.2 })));
  for (const s of [-1, 1]) well.add(mesh(at(new THREE.BoxGeometry(0.1, 1.5, 0.1), s * 0.68, 1.2, 0), mats().woodDark));
  well.add(mesh(at(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), 0, 1.75, 0, 0, 0, Math.PI / 2), mats().wood));
  const wr = shingleRoof(1.4, 1.2, 0.5); wr.position.y = 1.95; wr.scale.set(1, 1, 1); well.add(wr);
  decor(well, -12.5, -9.5, 0.3, 0.85);

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

  const wind = makeGrass(scene, (x, z) => {
    if (x > FIELD.x0 - 0.5 && x < FIELD.x0 + FIELD.nx + 0.5 && z > FIELD.z0 - 0.5 && z < FIELD.z0 + FIELD.nz + 0.5) return true;
    if (Math.hypot(x - 8, z - 11.4) < 3.6) return true;
    for (const c of colliders) if (c.box) { const [a, b, cc, d] = c.box; if (x > a - 0.2 && x < cc + 0.2 && z > b - 0.2 && z < d + 0.2) return true; }
    return false;
  });

  return {
    colliders, trees, treeGroups, field, tea, flowers, bakery, pieOven, breadOven, breadGroup,
    anchors: {
      pieIn: pieInBasket.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      pieOut: pieTable.position.clone().add(new THREE.Vector3(0, 0.83, 0)),
      breadIn: breadBasket.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      breadOut: breadTable.position.clone().add(new THREE.Vector3(0, 0.83, 0)),
      stall: SPOTS.stall.clone().add(new THREE.Vector3(0, 1.01, 0)),
      cash: cashBarrel.position.clone().add(new THREE.Vector3(0, 0.88, 0))
    },
    wind, addBox: box
  };
}
