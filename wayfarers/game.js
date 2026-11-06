// The 3D world and the run itself: the band, gates, walls, crates, rival
// bands, coins and the bonus stairs at the finish.
import * as THREE from './vendor/three.module.min.js';
import { ERAS, eraIndex } from './eras.js';
import { buildProp, buildBody, buildHead, buildLeg, buildHat, buildItem, buildProjectile, buildCoin } from './models.js';

const ROAD = 5.2;          // half width of the road
const MAXV = 80;           // most travelers drawn at once (the count can go higher)
const MAXD = 40;           // most knocked-over travelers drawn at once
const MAXE = 90;           // most rival travelers drawn
const SHOT_SPEED = 34;
const PLAYER_COLOR = '#d9654b';
const RIVAL_COLOR = '#6f6aa6';
const SKIN = ['#f2c9a0', '#e3b088', '#c98d62', '#9c6a46', '#f5d6b8'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// Rolling hills beside the road. Flat near the road, taller further out.
function hillHeight(x, z) {
  const d = Math.abs(x) - ROAD - 1.2;
  if (d <= 0) return -0.02;
  const f = Math.min(1, d / 10);
  const h = Math.sin(x * 0.09 + z * 0.045) * 1.6 + Math.sin(z * 0.11 - x * 0.05) * 1.1 + Math.sin(x * 0.23 + z * 0.19) * 0.35;
  return f * f * (h + 1.6 + d * 0.05);
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return c;
}

// ---------- Canvas textures ----------
function roadTexture(kind, base, edge) {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const r = rng(77);
  const col = (k) => '#' + shade(base, k).getHexString();
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const speckle = (n, a, b) => { for (let i = 0; i < n; i++) { g.fillStyle = col((r() - 0.5) * a); const s = 1 + r() * b; g.fillRect(r() * S, r() * S, s, s); } };
  switch (kind) {
    case 'dirt':
      speckle(900, 0.12, 3);
      for (let i = 0; i < 18; i++) { g.fillStyle = col(-0.025 - r() * 0.035); g.beginPath(); g.ellipse(r() * S, r() * S, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, 7); g.fill(); }
      break;
    case 'sandstone':
      speckle(500, 0.08, 2);
      g.strokeStyle = col(-0.12); g.lineWidth = 3;
      for (let y = 0; y < S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 64) % 2 ? 32 : 0; x < S; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
      break;
    case 'cobble':
      for (let y = 0; y < S; y += 32) for (let x = -16; x < S + 16; x += 32) {
        const ox = (y / 32) % 2 ? 16 : 0;
        g.fillStyle = col((r() - 0.5) * 0.12);
        g.beginPath(); g.roundRect(x + ox + 2, y + 2, 28, 28, 9); g.fill();
      }
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = col(-0.18); g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
      break;
    case 'planks':
      for (let y = 0; y < S; y += 32) {
        g.fillStyle = col((r() - 0.5) * 0.1); g.fillRect(0, y, S, 30);
        g.fillStyle = col(-0.2); g.fillRect(0, y + 30, S, 2);
        for (let i = 0; i < 6; i++) { g.fillStyle = col(-0.07); g.fillRect(r() * S, y + 4 + r() * 22, 30 + r() * 40, 1.5); }
        g.fillStyle = col(-0.28); g.fillRect(12, y + 14, 3, 3); g.fillRect(S - 15, y + 14, 3, 3);
      }
      break;
    case 'brickroad':
      for (let y = 0; y < S; y += 21) for (let x = -32; x < S; x += 42) {
        g.fillStyle = col((r() - 0.5) * 0.12); g.fillRect(x + ((y / 21) % 2 ? 21 : 0) + 1, y + 1, 40, 19);
      }
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = col(-0.2); g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
      break;
    case 'asphalt':
      speckle(1400, 0.1, 2);
      g.fillStyle = edge; g.fillRect(S / 2 - 4, 30, 8, 90); g.fillRect(S / 2 - 4, 158, 8, 90);
      g.fillRect(10, 0, 5, S); g.fillRect(S - 15, 0, 5, S);
      break;
    case 'panels':
      g.fillStyle = col(-0.1);
      for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.fillStyle = col((r() - 0.5) * 0.06); g.fillRect(x + 2, y + 2, 60, 60); }
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#7ff0ea'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
      g.fillStyle = col(-0.15); for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.beginPath(); g.arc(x + 10, y + 10, 2.5, 0, 7); g.fill(); g.beginPath(); g.arc(x + 54, y + 54, 2.5, 0, 7); g.fill(); }
      break;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

function wallTexture(kind, base) {
  const W = 256, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const r = rng(13);
  const col = (k) => '#' + shade(base, k).getHexString();
  g.fillStyle = col(-0.16); g.fillRect(0, 0, W, H);
  if (kind === 'boulder') {
    for (let i = 0; i < 26; i++) { g.fillStyle = col((r() - 0.4) * 0.16); g.beginPath(); g.ellipse(r() * W, r() * H, 18 + r() * 16, 14 + r() * 10, r() * 3, 0, 7); g.fill(); }
  } else if (kind === 'barrels') {
    for (let x = 0; x < W; x += 32) { g.fillStyle = col((r() - 0.5) * 0.1); g.fillRect(x + 2, 0, 28, H); g.fillStyle = col(-0.3); g.fillRect(x + 2, 22, 28, 5); g.fillRect(x + 2, H - 27, 28, 5); }
  } else if (kind === 'metal') {
    for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) { g.fillStyle = col((r() - 0.5) * 0.08); g.fillRect(x + 3, y + 3, 58, 58); g.fillStyle = col(-0.25); g.fillRect(x + 8, y + 8, 5, 5); g.fillRect(x + 51, y + 51, 5, 5); }
    g.fillStyle = '#7ff0ea'; g.fillRect(0, 62, W, 4);
  } else if (kind === 'concrete') {
    for (let i = 0; i < 600; i++) { g.fillStyle = col((r() - 0.5) * 0.08); g.fillRect(r() * W, r() * H, 2, 2); }
    g.fillStyle = col(-0.2); for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H); g.fillRect(0, 64, W, 2);
    g.fillStyle = '#f2c94c'; for (let x = -20; x < W; x += 40) { g.beginPath(); g.moveTo(x, H - 18); g.lineTo(x + 20, H - 18); g.lineTo(x + 32, H); g.lineTo(x + 12, H); g.fill(); }
  } else {
    const bh = kind === 'sandstone' ? 32 : 21, bw = kind === 'sandstone' ? 64 : 42;
    for (let y = 0; y < H; y += bh) for (let x = -bw; x < W; x += bw) {
      g.fillStyle = col((r() - 0.5) * 0.12);
      g.fillRect(x + ((y / bh) % 2 ? bw / 2 : 0) + 2, y + 2, bw - 4, bh - 4);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A flat label with text drawn on a canvas (numbers on walls and gates).
class Label {
  constructor(w, h, px = 256) {
    this.cv = document.createElement('canvas');
    this.cv.width = px; this.cv.height = Math.round(px * h / w);
    this.g = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.last = null;
  }
  draw(key, fn) {
    if (key === this.last) return;
    this.last = key;
    const { g, cv } = this;
    g.clearRect(0, 0, cv.width, cv.height);
    fn(g, cv.width, cv.height);
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); }
}

function pill(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const FONT = '800 {s}px -apple-system, "SF Pro Rounded", "Segoe UI", Helvetica, Arial, sans-serif';
const font = (s) => FONT.replace('{s}', s);

function fmt(n) {
  n = Math.max(0, Math.ceil(n));
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
}

// ---------- Instanced pools ----------
class Pool {
  constructor(scene, geo, mat, max, { shadow = false, colors = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = shadow;
    this.mesh.frustumCulled = false;
    if (colors) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.count = 0;
    this.max = max;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(m, color) {
    if (this.n >= this.max) return;
    this.mesh.setMatrixAt(this.n, m);
    if (color && this.mesh.instanceColor) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.dispose(); }
}

const _o = new THREE.Object3D();
const _c = new THREE.Color();
const _v3 = new THREE.Vector3();

// ======================================================================
export class Game {
  constructor(canvas, hooks) {
    this.hooks = hooks;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 420);
    this.camK = 1;

    this.hemi = new THREE.HemisphereLight('#ffffff', '#8fa27a', 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e6', 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 22; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#dcecef', 45, 170);

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0);\n#include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), this.skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    this.orb = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: '#ffe48a', fog: false }));
    this.scene.add(this.orb);
    this.stars = this.makeStars();
    this.scene.add(this.stars);

    // shared materials
    this.vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.unitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    this.coinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55, emissive: '#5a3c00', emissiveIntensity: 0.35 });
    this.projMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
    this.puffMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
    this.debrisMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });

    const s = this.scene;
    this.pBody = new Pool(s, buildBody(), this.unitMat, MAXV + MAXE + MAXD, { shadow: true, colors: true });
    this.pHead = new Pool(s, buildHead(), this.unitMat, MAXV + MAXE + MAXD, { shadow: true, colors: true });
    this.pLeg = new Pool(s, buildLeg(), this.unitMat, (MAXV + MAXE + MAXD) * 2, { colors: true });
    this.coins = new Pool(s, buildCoin(), this.coinMat, 500, { shadow: true });
    this.puffs = new Pool(s, new THREE.IcosahedronGeometry(0.5, 1), this.puffMat, 260);
    this.debris = new Pool(s, new THREE.BoxGeometry(0.42, 0.3, 0.3), this.debrisMat, 420, { colors: true, shadow: true });
    this.pHat = null; this.pItem = null; this.pProj = null;

    this.dark = false;
    this.speedSetting = 1;
    this.state = 'idle';
    this.time = 0;
    this.shake = 0;
    this.input = { dragging: false, lastX: 0, keys: 0 };
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.running = true;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  makeStars() {
    const n = 260, pos = new Float32Array(n * 3), r = rng(5);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, e = 0.12 + r() * 1.2;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 380; pos[i * 3 + 1] = Math.sin(e) * 380; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 380;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: '#fffbe8', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  }

  // ---------- setup ----------
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Fit the road's width on narrow phones by widening the view and pulling back a little.
    const want = 6.6, dist = 17.1;
    let vfov = 2 * Math.atan(want / dist / aspect) * 180 / Math.PI;
    vfov = clamp(vfov, 46, 66);
    const half = Math.tan(vfov * Math.PI / 360) * aspect * dist;
    this.camK = clamp(want / half, 1.0, 1.45);
    this.camera.fov = vfov;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  setTheme(dark) {
    this.dark = dark;
    if (this.level != null) this.applyPalette();
  }

  pal() { return this.era[this.dark ? 'dark' : 'light']; }

  applyPalette() {
    const p = this.pal(), d = this.dark;
    this.skyMat.uniforms.top.value.set(p.skyTop);
    this.skyMat.uniforms.bottom.value.set(p.skyBottom);
    this.scene.fog.color.set(p.fog);
    this.renderer.setClearColor(p.fog);
    this.hemi.color.set(d ? '#8f93d6' : '#ffffff');
    this.hemi.groundColor.set(d ? '#2a2638' : '#8fa27a');
    this.hemi.intensity = d ? 1.15 : 1.55;
    this.sun.color.set(d ? '#ffc58f' : '#fff4e0');
    this.sun.intensity = d ? 1.6 : 2.4;
    this.orb.material.color.set(d ? '#f3ecd8' : '#ffe48a');
    this.stars.visible = d;
    this.debrisMat.color.set('#ffffff');
    // terrain colors
    if (this.terrain) for (const t of this.terrain) this.colorTerrain(t);
    if (this.roadMesh) {
      this.roadMesh.material.map?.dispose();
      this.roadMesh.material.map = roadTexture(this.era.road, p.road, p.roadEdge);
      this.roadMesh.material.map.repeat.set(1, this.roadLen / 10.4);
      this.roadMesh.material.needsUpdate = true;
      for (const e of this.edges) e.material.color.set(p.roadEdge);
    }
    if (this.wallMat) {
      this.wallMat.map?.dispose();
      this.wallMat.map = wallTexture(this.era.wall, p.wall);
      this.wallMat.needsUpdate = true;
    }
    if (this.seaMesh) this.seaMesh.material.color.set(p.sea);
    this.puffMat.color.set(d ? '#d9d4f0' : '#ffffff');
    if (this.cloudMat) { this.cloudMat.color.set(d ? '#6d6a99' : '#ffffff'); this.cloudMat.opacity = d ? 0.55 : 0.92; }
  }

  colorTerrain(mesh) {
    const p = this.pal();
    const g = mesh.geometry, pos = g.attributes.position;
    const c0 = new THREE.Color(p.grass[0]), c1 = new THREE.Color(p.grass[1]), c2 = new THREE.Color(p.grass[2]);
    const col = g.attributes.color.array;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + mesh.position.x, z = pos.getZ(i) + mesh.position.z, y = pos.getY(i);
      const n = Math.sin(x * 0.21 + z * 0.13) * 0.5 + Math.sin(z * 0.37 - x * 0.11) * 0.5;
      _c.copy(c0).lerp(n > 0 ? c2 : c1, Math.abs(n) * 0.9);
      if (y > 3.2) _c.lerp(c2, Math.min(1, (y - 3.2) * 0.2));
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.attributes.color.needsUpdate = true;
  }

  clearLevel() {
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== this.vcMat && o.material !== this.wallMat && o.material !== this.coinMat) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
    }
    for (const ob of this.obstacles || []) ob.label?.dispose();
    for (const gr of this.groups || []) gr.label?.dispose();
    if (this.wallMat) { this.wallMat.map?.dispose(); this.wallMat.dispose(); this.wallMat = null; }
    for (const p of [this.pHat, this.pItem, this.pProj, this.eHat, this.eItem]) p?.dispose(this.scene);
    this.terrain = null; this.roadMesh = null; this.seaMesh = null;
  }

  // Build the world for a stage. stats = { band, power, rate, range, coinMult, magnet }
  // soft < 1 makes walls and rivals weaker (after a rest on the same stage)
  loadLevel(level, stats, soft = 1) {
    this.clearLevel();
    this.soft = soft;
    this.level = level;
    this.stats = stats;
    const ei = eraIndex(level);
    this.era = ERAS[ei];
    this.eraI = ei;
    const R = rng(level * 9973 + 17);
    this.R = R;
    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.length = 175 + Math.min(level, 34) * 6;
    this.finishZ = -this.length;
    this.stairCount = 10;
    this.endZ = this.finishZ - 12 - this.stairCount * 6.5;
    this.roadLen = this.length + 140;

    // era-specific parts of the travelers and what they throw
    this.pHat = new Pool(this.scene, buildHat(this.era.hat), this.unitMat, MAXV + MAXD, { shadow: true });
    this.pItem = new Pool(this.scene, buildItem(this.era.item), this.unitMat, MAXV + MAXD);
    this.eHat = new Pool(this.scene, buildHat(this.era.hat), this.unitMat, MAXE, { shadow: true });
    this.eItem = new Pool(this.scene, buildItem(this.era.item), this.unitMat, MAXE);
    this.projMat.emissive.set(this.era.proj === 'laser' || this.era.proj === 'pellet' ? '#55aaaa' : '#000000');
    this.pProj = new Pool(this.scene, buildProjectile(this.era.proj), this.projMat, 700);

    this.buildEnvironment(R);
    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.buildCourse(R);
    this.applyPalette();
    this.resetRun();
  }

  buildEnvironment(R) {
    const w = this.world, era = this.era;
    const z0 = 40, z1 = this.endZ - 70, len = z0 - z1;
    // road
    const roadGeo = new THREE.PlaneGeometry(ROAD * 2, len);
    roadGeo.rotateX(-Math.PI / 2);
    this.roadLen = len;
    this.roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    this.roadMesh.position.set(0, 0, (z0 + z1) / 2);
    this.roadMesh.receiveShadow = true;
    w.add(this.roadMesh);
    this.edges = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, len), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
      e.position.set(sx * (ROAD + 0.2), 0.1, (z0 + z1) / 2);
      e.receiveShadow = true;
      w.add(e); this.edges.push(e);
    }
    // hills (or sand and sea on the right in the Age of Sail)
    this.terrain = [];
    const segZ = Math.ceil(len / 3);
    for (const sx of [-1, 1]) {
      const width = 150;
      const g = new THREE.PlaneGeometry(width, len, 50, segZ);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
      m.position.set(sx * (ROAD + 0.35 + width / 2), 0, (z0 + z1) / 2);
      const pos = g.attributes.position;
      const flat = era.sea && sx > 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + m.position.x, z = pos.getZ(i) + m.position.z;
        let y = hillHeight(x, z);
        if (flat) { const d = Math.abs(x) - ROAD; y = d < 5 ? 0.0 : -0.6 - (d - 5) * 0.05; }
        pos.setY(i, y);
      }
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
      g.computeVertexNormals();
      m.receiveShadow = true;
      w.add(m); this.terrain.push(m);
    }
    if (era.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, len), new THREE.MeshStandardMaterial({ color: '#5fb2cf', roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(ROAD + 6 + 80, -0.25, (z0 + z1) / 2);
      w.add(sea); this.seaMesh = sea;
    }
    this.buildClouds(R, z0, z1);
    // scenery
    const kinds = era.props;
    const totalW = kinds.reduce((a, k) => a + k[1], 0);
    const built = {};
    const placed = {};
    for (const [k] of kinds) { built[k] = buildProp(k); placed[k] = []; }
    if (era.sea) { built.ship = built.ship || buildProp('ship'); placed.ship = placed.ship || []; }
    const pick = () => { let t = R() * totalW; for (const [k, wt] of kinds) { if ((t -= wt) <= 0) return k; } return kinds[0][0]; };
    for (const sx of [-1, 1]) {
      for (let z = z0; z > z1; z -= 2.2 + R() * 3.2) {
        const sea = era.sea && sx > 0;
        let k = pick();
        if (sea) { if (R() < 0.75) continue; k = R() < 0.8 ? 'ship' : 'lighthouse'; if (!built[k]) { built[k] = buildProp(k); placed[k] = []; } }
        else if (k === 'ship' || k === 'lighthouse') k = 'rock';
        const big = built[k].big;
        const dmin = big ? 10 : 7.2;
        const x = sx * (dmin + Math.pow(R(), 1.4) * (sea ? 40 : 55));
        const y = sea ? -0.25 : hillHeight(x, z);
        const s = (big ? 0.9 : 0.8) + R() * 0.55;
        placed[k].push({ x, y, z: z + (R() - 0.5) * 2, s, ry: R() * Math.PI * 2, sx });
      }
    }
    // little things by the roadside
    const space = era.key === 'space';
    const small = space ? [['pebble', 3], ['crystal', 1]] : era.sea ? [['tuft', 3], ['pebble', 2], ['flower', 1]] : [['tuft', 4], ['flower', 3], ['pebble', 2]];
    for (const [k] of small) if (!built[k]) { built[k] = buildProp(k); placed[k] = []; }
    const smallW = small.reduce((a, k) => a + k[1], 0);
    for (const sx of [-1, 1]) {
      if (era.sea && sx > 0) continue;
      for (let z = z0; z > z1; z -= 0.7 + R() * 1.1) {
        let t = R() * smallW, k = small[0][0];
        for (const [kk, wt] of small) { if ((t -= wt) <= 0) { k = kk; break; } }
        const x = sx * (ROAD + 0.8 + Math.pow(R(), 1.6) * 9);
        placed[k].push({ x, y: hillHeight(x, z), z, s: (k === 'crystal' ? 0.45 : 0.8) + R() * 0.6, ry: R() * 6.3, sx });
      }
    }
    for (const k of Object.keys(placed)) {
      const list = placed[k];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(built[k].geo, this.vcMat, list.length);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((p, i) => {
        _o.position.set(p.x, p.y, p.z);
        // big buildings face the road
        _o.rotation.set(0, built[k].big ? (p.sx > 0 ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 0.6 : p.ry, 0);
        const tall = k === 'tower2' ? 0.7 + R() * 1.3 : 1;
        _o.scale.set(p.s, p.s * tall, p.s);
        _o.updateMatrix();
        im.setMatrixAt(i, _o.matrix);
        const t = 0.88 + R() * 0.2;
        im.setColorAt(i, _c.setRGB(t, t, t));
      });
      im.receiveShadow = true;
      w.add(im);
    }
  }

  buildClouds(R, z0, z1) {
    const geo = buildProp('cloud').geo;
    const n = Math.ceil((z0 - z1) / 22);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.92, flatShading: true });
    this.cloudMat = mat;
    const im = new THREE.InstancedMesh(geo, mat, n * 2);
    let i = 0;
    for (let k = 0; k < n; k++) for (const sx of [-1, 1]) {
      _o.position.set(sx * (35 + R() * 80), 32 + R() * 22, z0 - k * 22 - R() * 20 - 60);
      _o.rotation.set(0, R() * 6, 0);
      _o.scale.setScalar(1.2 + R() * 1.6);
      _o.updateMatrix(); im.setMatrixAt(i++, _o.matrix);
    }
    this.world.add(im);
  }

  // ---------- the course ----------
  buildCourse(R) {
    const L = this.level;
    // Difficulty follows the size the band is expected to have at each point,
    // so walls stay meaningful as numbers grow. Upgrades are what make it easier.
    const P = Math.pow(1.3, this.eraI);           // a traveler's base strength in this era
    const toughness = (1.5 + Math.min(L, 10) * 0.1) * Math.pow(1.06, L) * (L < 3 ? 0.75 + L * 0.08 : 1) * (this.soft || 1);
    let e = 4 + L * 0.5;                           // expected band size
    const wallHp = (k) => e * 1.4 * P * toughness * k;
    this.hpBase = P * 4;
    this.coinValue = Math.max(1, Math.round(Math.pow(1.09, L)));
    this.obstacles = [];
    this.groups = [];
    this.pickups = [];
    const addVal = (bonus = 0) => Math.round(3 + L * 0.9 + R() * 4 + bonus);
    const take = (defs) => {
      const val = (d) => d.k === 'add' ? e + d.v : d.k === 'mul' ? e * d.v : e + 2;
      e = Math.max(e, Math.max(val(defs[0]), val(defs[1])) * 0.85 + Math.min(val(defs[0]), val(defs[1])) * 0.15);
    };
    let z = -14;
    this.coinLine(z, 0, 7, R);
    z -= 10;
    // an easy first pair of gates
    const first = R() < 0.5 ? [{ k: 'add', v: addVal(2) }, { k: 'add', v: Math.max(2, Math.round(addVal() * 0.5)) }] : [{ k: 'add', v: addVal(2) }, { k: 'mul', v: 2 }];
    this._e = e; this._P = P; this.gatePair(z, first, R); take(first);
    let lastType = 'gate';
    let walls = 0;
    while (z > this.finishZ + 26) {
      z -= 17 + R() * 7;
      const pool = [];
      const add = (t, w) => { if (t !== lastType || t === 'gate') pool.push([t, w]); };
      add('gate', 30); add('wall', 22 + Math.min(L, 10)); add('half', 12); add('crates', 10); add('coins', 6);
      if (L >= 1) add('rivals', 10 + Math.min(L, 12));
      let tot = pool.reduce((a, p) => a + p[1], 0), t = R() * tot, type = pool[0][0];
      for (const [k, w] of pool) { if ((t -= w) <= 0) { type = k; break; } }
      if (walls === 0 && type === 'rivals' && L < 3) type = 'wall';
      lastType = type;
      switch (type) {
        case 'gate': {
          const a = addVal();
          const opts = [
            [{ k: 'add', v: a }, { k: 'add', v: Math.max(1, Math.round(a * 0.45)) }],
            [{ k: 'add', v: a }, { k: 'add', v: -Math.max(2, Math.round(a * 0.6)) }],
            [{ k: 'mul', v: L > 12 && R() < 0.3 ? 3 : 2 }, { k: 'add', v: a }],
            [{ k: 'rate', v: 15 }, { k: 'add', v: Math.round(a * 0.8) }],
            [{ k: 'reach', v: 3 }, { k: 'add', v: Math.round(a * 0.7) }],
            [{ k: 'add', v: -Math.max(2, Math.round(a * 0.4)) }, { k: 'mul', v: 2 }],
          ];
          const defs = opts[Math.floor(R() * opts.length)];
          this._e = e; this.gatePair(z, defs, R); take(defs);
          break;
        }
        case 'wall':
          this.wall(z, -ROAD, ROAD, wallHp(0.75 + R() * 0.6), R);
          walls++;
          break;
        case 'half': {
          const left = R() < 0.5;
          const strong = wallHp(1.5 + R() * 0.6), weak = wallHp(0.3 + R() * 0.2);
          this.wall(z, -ROAD, -0.1, left ? strong : weak, R);
          this.wall(z, 0.1, ROAD, left ? weak : strong, R);
          walls++;
          break;
        }
        case 'crates': {
          const n = 2 + Math.floor(R() * 2);
          for (let i = 0; i < n; i++) this.crate(z - i * 0.2, -3.6 + (7.2 * (i + 0.5)) / n + (R() - 0.5), wallHp(0.25));
          this.coinLine(z + 6, (R() - 0.5) * 5, 5, R);
          break;
        }
        case 'coins':
          this.coinLine(z, (R() - 0.5) * 6, 9, R, true);
          break;
        case 'rivals': {
          const n = Math.max(3, Math.round(e * (0.35 + R() * 0.3) * (this.soft || 1)));
          this.rivals(z, (R() - 0.5) * 4, n, P * 2);
          e -= n * 0.25;
          break;
        }
      }
    }
    this.expected = e;
    // finish arch and bonus stairs
    this.finishArch();
    for (let k = 0; k < this.stairCount; k++) {
      const zz = this.finishZ - 12 - k * 6.5;
      this.wall(zz, -ROAD, ROAD, e * 1.4 * P * toughness / (this.soft || 1) * (1.6 + k * 1.1), R, { stair: k, mult: +(1.2 + k * 0.2).toFixed(1) });
    }
    this.obstacles.sort((a, b) => b.z - a.z);
  }

  coinLine(z, x, n, R, wave = false) {
    for (let i = 0; i < n; i++) {
      const xx = clamp(x + (wave ? Math.sin(i * 0.7) * 2.5 : 0), -ROAD + 0.6, ROAD - 0.6);
      this.pickups.push({ x: xx, y: 0.55, z: z - i * 1.3, vx: 0, vy: 0, vz: 0, st: 'rest', spin: i * 0.6, v: this.coinValue });
    }
  }

  gatePair(z, defs, R) {
    if (R() < 0.5) defs = [defs[1], defs[0]];
    const pair = [];
    defs.forEach((d, i) => {
      const x0 = i === 0 ? -ROAD : 0.12, x1 = i === 0 ? -0.12 : ROAD;
      const g = { type: 'gate', kind: d.k, v: d.v, start: d.v, x0, x1, z, d: 0.3, acc: 0, pair, used: false, flash: 0 };
      g.step = Math.max(this._P, this._e * this._P * 0.3);
      g.cap = d.k === 'add' ? Math.max(d.v, 0) + Math.round(6 + this.level * 0.6) : d.v;
      const grp = new THREE.Group();
      const w = x1 - x0;
      const panelMat = new THREE.MeshStandardMaterial({ color: '#2f7fd6', transparent: true, opacity: 0.74, roughness: 0.25, depthWrite: false, emissive: '#000000' });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 2.3, 0.12), panelMat);
      panel.position.y = 1.35;
      grp.add(panel);
      const postMat = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.5 });
      for (const px of [-w / 2 + 0.1, w / 2 - 0.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8), postMat);
        post.position.set(px, 1.4, 0); post.castShadow = true; grp.add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.28), new THREE.MeshStandardMaterial({ color: '#2f7fd6', roughness: 0.5 }));
      top.position.y = 2.75; top.castShadow = true; grp.add(top);
      g.topBar = top;
      const label = new Label(w - 0.4, 1.5, 320);
      label.mesh.position.set(0, 1.4, 0.09);
      grp.add(label.mesh);
      grp.position.set((x0 + x1) / 2, 0, z);
      this.world.add(grp);
      g.grp = grp; g.panel = panel; g.label = label;
      this.drawGate(g);
      pair.push(g);
      this.obstacles.push(g);
    });
  }

  gateGood(g) { return g.kind !== 'add' || g.v > 0; }

  drawGate(g) {
    const good = this.gateGood(g);
    const txt = g.kind === 'add' ? (g.v > 0 ? '+' + g.v : g.v < 0 ? '−' + Math.abs(g.v) : '0')
      : g.kind === 'mul' ? '×' + g.v : g.kind === 'rate' ? 'Faster' : 'Reach';
    const sub = g.kind === 'rate' ? 'throws +15%' : g.kind === 'reach' ? 'range +3' : g.kind === 'add' && g.v <= 0 ? 'throw to raise' : '';
    const col = good ? (g.kind === 'rate' || g.kind === 'reach' ? '#e8962a' : '#2f7fd6') : '#958b84';
    g.panel.material.color.set(col);
    g.panel.material.emissive.set(col).multiplyScalar(0.25);
    g.topBar.material.color.set(col);
    g.label.draw(txt + sub, (c, W, H) => {
      c.fillStyle = '#ffffff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6;
      const big = txt.length > 4 ? 62 : 104;
      c.font = font(big);
      c.fillText(txt, W / 2, sub ? H * 0.42 : H / 2);
      if (sub) { c.font = font(30); c.fillText(sub, W / 2, H * 0.82); }
    });
  }

  wall(z, x0, x1, hp, R, extra = {}) {
    hp = Math.max(1, Math.round(hp));
    const w = x1 - x0;
    const o = { type: 'wall', x0, x1, z, d: 1.1, hp, max: hp, dead: false, wob: 0, ...extra };
    const grp = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, 2.0, 1.1);
    // scale the texture to the wall width
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w / 4);
    let mat = this.wallMat;
    if (extra.stair != null) {
      const hues = ['#f28b82', '#f6ad6b', '#f7d26a', '#b9dd7a', '#7fd1a8', '#76c7d9', '#7fa8e8', '#a594e6', '#d69be0', '#f29bc0'];
      mat = new THREE.MeshStandardMaterial({ color: hues[extra.stair % hues.length], roughness: 0.7 });
    }
    const box = new THREE.Mesh(geo, mat);
    box.position.y = 1.0; box.castShadow = true; box.receiveShadow = true;
    grp.add(box);
    const label = new Label(Math.min(w - 0.3, extra.stair != null ? 6 : 3.4), extra.stair != null ? 1.7 : 1.1, 300);
    label.mesh.position.set(0, 1.05, 0.57);
    grp.add(label.mesh);
    grp.position.set((x0 + x1) / 2, 0, z);
    this.world.add(grp);
    o.grp = grp; o.box = box; o.label = label;
    o.coins = extra.stair != null ? 0 : 3 + Math.floor(R() * 4);
    this.drawWall(o);
    this.obstacles.push(o);
    return o;
  }

  drawWall(o) {
    const n = Math.ceil(o.hp);
    o.label.draw(n, (c, W, H) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (o.stair != null) {
        c.fillStyle = 'rgba(255,255,255,.92)'; pill(c, W * 0.18, H * 0.05, W * 0.64, H * 0.56, 40); c.fill();
        c.fillStyle = '#2a2a2a'; c.font = font(92); c.fillText('×' + o.mult, W / 2, H * 0.34);
        c.fillStyle = 'rgba(0,0,0,.55)'; pill(c, W * 0.32, H * 0.66, W * 0.36, H * 0.3, 30); c.fill();
        c.fillStyle = '#fff'; c.font = font(44); c.fillText(fmt(n), W / 2, H * 0.81);
      } else {
        c.fillStyle = 'rgba(30,28,36,.62)'; pill(c, W * 0.2, H * 0.12, W * 0.6, H * 0.76, 46); c.fill();
        c.fillStyle = '#ffffff'; c.font = font(fmt(n).length > 3 ? 80 : 100); c.fillText(fmt(n), W / 2, H / 2 + 4);
      }
    });
  }

  crate(z, x, hp) {
    hp = Math.max(1, Math.round(hp));
    const o = { type: 'crate', x0: x - 0.6, x1: x + 0.6, z, d: 1.2, hp, max: hp, dead: false, wob: 0, coins: 7 };
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: '#c9935a', roughness: 0.8 }));
    box.position.y = 0.6; box.castShadow = true; grp.add(box);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.8 });
    for (const y of [0.15, 1.05]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 1.24), bandMat); b.position.y = y; grp.add(b); }
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), this.coinMat);
    coin.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(coin.geometry.attributes.position.count * 3).fill(1), 3));
    coin.rotation.x = Math.PI / 2; coin.position.set(0, 0.62, 0.62); grp.add(coin);
    const label = new Label(1.2, 0.6, 200);
    label.mesh.position.set(0, 1.6, 0);
    grp.add(label.mesh);
    grp.position.set(x, 0, z);
    this.world.add(grp);
    o.grp = grp; o.box = box; o.label = label;
    this.drawCrate(o);
    this.obstacles.push(o);
  }
  drawCrate(o) {
    const n = Math.ceil(o.hp);
    o.label.draw(n, (c, W, H) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(30,28,36,.6)'; pill(c, W * 0.2, H * 0.1, W * 0.6, H * 0.8, 40); c.fill();
      c.fillStyle = '#fff'; c.font = font(64); c.fillText(fmt(n), W / 2, H / 2 + 3);
    });
  }

  rivals(z, x, n, hp) {
    const gr = { z, x, units: [], active: false, label: new Label(1.8, 0.9, 200), alive: n, hp: Math.max(1, Math.round(hp)) };
    const shown = Math.min(n, 40);
    gr.per = n / shown;
    for (let i = 0; i < shown; i++) {
      const r = 0.6 * Math.sqrt(i), a = i * 2.39996;
      gr.units.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r * 0.8, hp: gr.hp * gr.per, alive: true, fall: 0, ph: Math.random() * 6, skin: SKIN[i % SKIN.length] });
    }
    gr.label.mesh.position.set(x, 3.0, z);
    this.world.add(gr.label.mesh);
    this.drawGroup(gr);
    this.groups.push(gr);
  }
  drawGroup(gr) {
    const n = Math.ceil(gr.alive);
    gr.label.draw(n, (c, W, H) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = RIVAL_COLOR; pill(c, W * 0.15, H * 0.1, W * 0.7, H * 0.8, 50); c.fill();
      c.fillStyle = '#fff'; c.font = font(70); c.fillText(fmt(n), W / 2, H / 2 + 3);
    });
  }

  finishArch() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#fbf8f1', roughness: 0.5 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4.6, 10), mat); p.position.set(sx * (ROAD + 0.4), 2.3, 0); p.castShadow = true; grp.add(p); }
    const banner = new Label(ROAD * 2 + 1, 1.1, 512);
    banner.mesh.position.set(0, 4.2, 0);
    banner.mesh.material.side = THREE.DoubleSide;
    banner.draw('f', (c, W, H) => {
      const sq = H / 2;
      for (let x = 0; x < W; x += sq) for (let y = 0; y < H; y += sq) { c.fillStyle = ((x + y) / sq) % 2 ? '#2a2a2a' : '#ffffff'; c.fillRect(x, y, sq, sq); }
      c.fillStyle = 'rgba(255,255,255,.95)'; pill(c, W * 0.3, H * 0.1, W * 0.4, H * 0.8, 30); c.fill();
      c.fillStyle = '#2a2a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = font(58); c.fillText('FINISH', W / 2, H / 2 + 3);
    });
    grp.add(banner.mesh);
    this.finishBanner = banner;
    grp.position.z = this.finishZ;
    this.world.add(grp);
  }

  // ---------- run state ----------
  resetRun() {
    const st = this.stats;
    this.band = { x: 0, tx: 0, z: 2, v: 0 };
    this.count = st.band;
    this.units = [];
    this.dying = [];
    this.syncUnits(true);
    this.shots = [];
    this.flying = [];      // coins in the air
    this.bits = [];        // debris
    this.puffList = [];
    this.rate = st.rate;
    this.range = st.range;
    this.power = st.power;
    this.runCoins = 0;
    this.passedFinish = false;
    this.mult = 1;
    this.consumeT = 0;
    this.blockedBy = null;
    this.ended = false;
    this.state = 'ready';
    this.camPos = new THREE.Vector3(0, 10.5 * this.camK, this.band.z + 13.5 * this.camK);
    this.camLook = new THREE.Vector3(0, 0.5, this.band.z - 9);
    this.hooks.onCount?.(this.count);
    this.hooks.onProgress?.(0);
  }

  slot(i) {
    const r = 0.6 * Math.sqrt(i), a = i * 2.39996;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.85];
  }

  // Keep the drawn travelers in step with the count. Every traveler keeps its
  // own place in the band, so nobody shuffles around when the count changes.
  syncUnits(instant = false, victims = null) {
    const want = Math.min(Math.max(0, Math.ceil(this.count)), MAXV);
    while (this.units.length < want) {
      const i = this.units.length;
      const [sx, sz] = this.slot(i);
      this.units.push({ s: i, sx, sz, ox: instant ? sx : sx * 0.3, oz: instant ? sz : sz * 0.3 + 1.2, ph: Math.random() * 6, fire: Math.random(), pop: instant ? 1 : 0, skin: _c.set(SKIN[i % SKIN.length]).clone() });
    }
    while (this.units.length > want) {
      // the given travelers go first, otherwise the ones at the outside edge
      let u = victims && victims.length ? victims.shift() : null;
      if (!u || !this.units.includes(u)) u = this.units.reduce((m, x) => (x.s > m.s ? x : m), this.units[0]);
      this.removeUnit(u);
    }
    this.bandR = 0.6 * Math.sqrt(Math.max(1, this.units.length)) + 0.35;
  }

  // A traveler sits down: they tip over and fade, and the traveler at the outer
  // edge of the band walks over to fill the gap.
  removeUnit(u) {
    const i = this.units.indexOf(u);
    if (i < 0) return;
    this.knockOver(this.band.x + u.ox, this.band.z + u.oz, u);
    this.units.splice(i, 1);
    // Close the gap: the nearest traveler further out steps in, then the
    // nearest one further out fills their place, and so on. Each one only
    // moves a short way, like a real crowd closing ranks.
    let hole = u.s;
    for (let guard = 0; guard < MAXV; guard++) {
      const [hx, hz] = this.slot(hole);
      let best = null, bd = Infinity;
      for (const x of this.units) {
        if (x.s <= hole) continue;
        const d = (x.sx - hx) ** 2 + (x.sz - hz) ** 2;
        if (d < bd) { bd = d; best = x; }
      }
      if (!best) break;
      const old = best.s;
      best.s = hole; best.sx = hx; best.sz = hz;
      hole = old;
    }
  }

  knockOver(x, z, u) {
    if (this.dying.length >= MAXD) this.dying.shift();
    this.dying.push({ x, z, ph: u.ph, skin: u.skin, t: 0, vz: 1.2 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.8 });
    if (Math.random() < 0.5) this.puff(x, 0.5, z, 0.6);
  }

  setCount(n, victims = null) {
    this.count = Math.max(0, Math.round(n));
    this.syncUnits(false, victims);
    this.hooks.onCount?.(this.count);
  }

  start() { if (this.state === 'ready') { this.state = 'run'; this.hooks.sound?.('go'); this.hooks.onStart?.(); } }
  // the menu shows the band waiting at the start line
  showMenu() { this.state = 'idle'; this.inputEnabled = false; }
  ready() { this.state = 'ready'; this.inputEnabled = true; }

  // ---------- input ----------
  bindInput() {
    const c = this.canvas;
    const down = (e) => {
      if (this.state === 'ready' && this.inputEnabled) this.start();
      this.input.dragging = true; this.input.lastX = e.clientX;
      c.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!this.input.dragging || this.state !== 'run') { this.input.lastX = e.clientX; return; }
      const dx = e.clientX - this.input.lastX; this.input.lastX = e.clientX;
      const span = Math.min(this.w, 520);
      this.band.tx = clamp(this.band.tx + dx * (ROAD * 2.1) / span, -this.maxX(), this.maxX());
    };
    const up = () => { this.input.dragging = false; };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.input.keys = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.input.keys = 1;
      else return;
      if (this.state === 'ready' && this.inputEnabled) this.start();
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) this.input.keys = 0;
    });
  }
  maxX() { return Math.max(0, ROAD - 0.45 - Math.min(this.bandR || 1, 3.6) * 0.8); }

  // ---------- effects ----------
  puff(x, y, z, s = 1) {
    if (this.puffList.length > 240) return;
    this.puffList.push({ x, y, z, t: 0, life: 0.45, s, vy: 1.2 });
  }
  burstCoins(x, z, n, value) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      this.pickups.push({ x, y: 1.2, z, vx: Math.cos(a) * sp, vy: 5 + Math.random() * 3, vz: Math.sin(a) * sp * 0.6 + 1.5, st: 'fly', spin: Math.random() * 6, v: value });
    }
  }
  shatter(o) {
    const colors = o.type === 'crate' ? ['#c9935a', '#8a5a3b'] : o.stair != null ? ['#' + o.box.material.color.getHexString()] : [this.pal().wall, '#' + shade(this.pal().wall, -0.1).getHexString()];
    const n = o.type === 'crate' ? 14 : Math.min(36, 12 + Math.round((o.x1 - o.x0) * 3));
    for (let i = 0; i < n; i++) {
      if (this.bits.length > 400) break;
      const x = o.x0 + Math.random() * (o.x1 - o.x0);
      this.bits.push({ x, y: 0.3 + Math.random() * 1.6, z: o.z + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 5, vz: -2 - Math.random() * 5, rx: Math.random() * 6, ry: Math.random() * 6, wr: (Math.random() - 0.5) * 12, t: 0, life: 1.0 + Math.random() * 0.5, c: new THREE.Color(colors[i % colors.length]), s: 0.6 + Math.random() * 0.8 });
    }
    for (let i = 0; i < 5; i++) this.puff(o.x0 + Math.random() * (o.x1 - o.x0), 0.6, o.z, 1.6);
  }

  destroy(o) {
    o.dead = true;
    this.world.remove(o.grp);
    this.shatter(o);
    this.shake = Math.max(this.shake, o.type === 'crate' ? 0.12 : 0.25);
    if (o.coins) this.burstCoins((o.x0 + o.x1) / 2, o.z, o.coins, this.coinValue);
    this.hooks.sound?.(o.type === 'crate' ? 'crate' : 'crumble');
    if (o.stair != null) { this.mult = Math.max(this.mult, o.mult); this.hooks.onToast?.('×' + o.mult, 'gold'); }
  }

  // ---------- simulation ----------
  update(dt) {
    this.time += dt;
    const b = this.band;
    const running = this.state === 'run';
    // steering
    if (running && this.input.keys) b.tx = clamp(b.tx + this.input.keys * 9 * dt, -this.maxX(), this.maxX());
    b.tx = clamp(b.tx, -this.maxX(), this.maxX());
    b.x = damp(b.x, b.tx, 14, dt);

    // Walls stop the band. The band's front rests against the wall face and only
    // ever moves forward, so it never bounces back and forth.
    let blocked = null, stopZ = -Infinity;
    const touching = [];
    if (running) {
      for (const o of this.obstacles) {
        if (o.dead || o.type !== 'wall') continue;
        if (o.z > b.z + 3) continue;
        if (o.z < b.z - 8) break;
        const face = o.z + o.d / 2 + 0.32;
        for (const u of this.units) {
          const ux = b.x + u.sx;
          if (ux > o.x0 - 0.3 && ux < o.x1 + 0.3) {
            const z = face - u.sz;            // where the band would stop for this traveler
            if (z > stopZ) { stopZ = z; blocked = o; }
          }
        }
        if (blocked) break;
      }
    }
    const runSpeed = [7, 8.6, 10.4][this.speedSetting] || 8.6;
    let pressing = false;
    if (running) {
      const nz = b.z - b.v * dt;
      if (blocked && nz <= stopZ + 0.02) { pressing = b.z <= stopZ + 0.6; b.z = Math.min(b.z, Math.max(nz, stopZ)); }
      else b.z = nz;
    }
    b.v = damp(b.v, running ? (pressing ? 1.5 : runSpeed) : 0, pressing ? 18 : 5, dt);

    // pressing against a wall: the travelers touching it push it down
    if (pressing && blocked) {
      const face = blocked.z + blocked.d / 2 + 0.32;
      for (const u of this.units) {
        const ux = b.x + u.ox, uz = b.z + u.oz;
        if (ux > blocked.x0 - 0.3 && ux < blocked.x1 + 0.3 && uz < face + 0.5) touching.push(u);
      }
      touching.sort((a, c) => a.oz - c.oz);
      this.consumeT += dt * (6 + this.count * 0.3);
      let n = Math.floor(this.consumeT);
      this.consumeT -= n;
      if (n > 0) {
        n = Math.min(n, this.count);
        blocked.hp -= n * this.power * 3;
        blocked.wob = 1;
        if (this.count > this.units.length) {
          // a big band: show a few of the pushers sitting down, the rest are counted
          for (let k = 0; k < Math.min(n, 3, touching.length); k++) { const u = touching[k]; this.knockOver(b.x + u.ox, b.z + u.oz, u); }
        }
        this.setCount(this.count - n, touching);
        this.hooks.sound?.('bump');
        if (blocked.hp <= 0) this.destroy(blocked); else this.drawWall(blocked);
      }
    } else this.consumeT = 0;
    this.pressing = pressing;

    // units drift to their places in the band
    for (const u of this.units) {
      // walk toward their place, eased but never faster than a quick step
      const dx = u.sx - u.ox, dz = u.sz - u.oz, dist = Math.hypot(dx, dz);
      if (dist > 1e-4) {
        const step = Math.min(dist * (1 - Math.exp(-6 * dt)), 4.5 * dt);
        u.ox += dx / dist * step; u.oz += dz / dist * step;
      }
      u.pop = Math.min(1, u.pop + dt * 5);
      if (blocked && !blocked.dead) {
        const face = blocked.z + blocked.d / 2 + 0.32, ux = b.x + u.ox;
        if (ux > blocked.x0 - 0.3 && ux < blocked.x1 + 0.3 && b.z + u.oz < face) u.oz = damp(u.oz, face - b.z, 30, dt);
      }
      const wx = b.x + u.ox;
      if (wx > ROAD - 0.25) u.ox = ROAD - 0.25 - b.x; else if (wx < -ROAD + 0.25) u.ox = -ROAD + 0.25 - b.x;
      u.ph += dt * (running ? Math.max(b.v, pressing ? 5 : 0) * 1.4 : 1.5);
    }

    // throwing
    if (running && this.units.length) {
      const per = this.count / this.units.length;
      const dmg = this.power * per;
      for (const u of this.units) {
        u.fire -= dt * this.rate;
        if (u.fire <= 0) {
          u.fire += 1 + (Math.random() - 0.5) * 0.2;
          if (this.shots.length < 700) this.shots.push({ x: b.x + u.ox + 0.3, y: 1.05, z: b.z + u.oz - 0.4, life: this.range / SHOT_SPEED, dmg, sp: Math.random() * 6 });
        }
      }
      if (Math.random() < dt * 6) this.hooks.sound?.('throw');
    }

    this.updateShots(dt);
    if (running) this.updateGates();
    this.updateRivals(dt, running);
    this.updatePickups(dt);
    this.updateFx(dt);

    for (const o of this.obstacles) {
      if (o.dead || !o.wob) continue;
      o.wob = Math.max(0, o.wob - dt * 6);
      const s = 1 + o.wob * 0.04;
      o.grp.scale.set(s, s, s);
    }

    // finish line and the end of the run
    if (running) {
      if (!this.passedFinish && b.z < this.finishZ) {
        this.passedFinish = true;
        this.hooks.sound?.('finish');
        this.hooks.onToast?.('Finish!', 'gold');
        this.confetti();
      }
      this.hooks.onProgress?.(clamp(b.z / this.finishZ, 0, 1));
      if (this.count <= 0) this.endRun();
      else if (b.z < this.endZ + 4) { this.mult = Math.max(this.mult, 3.0); this.endRun(); }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  confetti() {
    const cols = ['#f28b82', '#f7d26a', '#7fd1a8', '#76c7d9', '#a594e6'];
    for (let i = 0; i < 60; i++) {
      this.bits.push({ x: (Math.random() - 0.5) * ROAD * 2, y: 4 + Math.random(), z: this.finishZ, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, vz: 2 + Math.random() * 3, rx: 0, ry: 0, wr: (Math.random() - 0.5) * 16, t: 0, life: 1.6, c: new THREE.Color(cols[i % cols.length]), s: 0.3 });
    }
  }

  endRun() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'done';
    const success = this.passedFinish;
    const bonus = success ? Math.round(this.runCoins * (this.mult - 1)) : 0;
    setTimeout(() => this.hooks.onEnd?.({ success, coins: this.runCoins, bonus, mult: this.mult }), success ? 500 : 650);
  }

  updateShots(dt) {
    const b = this.band;
    // active targets near the band
    const near = [];
    for (const o of this.obstacles) {
      if (o.dead || o.used) continue;
      if (o.z > b.z + 1) continue;
      if (o.z < b.z - this.range - 4) break;
      if (o.type === 'gate' && o.kind !== 'add') continue;
      near.push(o);
    }
    const groups = this.groups.filter((g) => g.alive > 0 && g.z > b.z - this.range - 6 && g.z < b.z + 3);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const z0 = s.z;
      s.z -= SHOT_SPEED * dt;
      s.life -= dt;
      let hit = false;
      for (const o of near) {
        if (o.dead) continue;
        if (s.x < o.x0 || s.x > o.x1) continue;
        const front = o.z + o.d / 2;
        if (z0 >= o.z - o.d / 2 && s.z <= front) {
          hit = true;
          if (o.type === 'gate') {
            if (o.v < o.cap) {
              o.acc += s.dmg;
              if (o.acc >= o.step) { const k = Math.floor(o.acc / o.step); o.acc -= k * o.step; o.v = Math.min(o.cap, o.v + k); o.flash = 1; this.drawGate(o); this.hooks.sound?.('tick'); }
            }
          } else {
            o.hp -= s.dmg; o.wob = 1;
            if (o.hp <= 0) this.destroy(o);
            else if (o.type === 'crate') this.drawCrate(o); else this.drawWall(o);
          }
          break;
        }
      }
      if (!hit) {
        for (const g of groups) {
          for (const u of g.units) {
            if (!u.alive) continue;
            if (Math.abs(s.x - u.x) < 0.4 && z0 >= u.z - 0.4 && s.z <= u.z + 0.4) {
              hit = true;
              u.hp -= s.dmg;
              if (u.hp <= 0) this.knock(g, u);
              break;
            }
          }
          if (hit) break;
        }
      }
      if (hit || s.life <= 0) { this.shots[i] = this.shots[this.shots.length - 1]; this.shots.pop(); }
    }
  }

  knock(g, u) {
    u.alive = false; u.fall = 0.001;
    g.alive = Math.max(0, g.alive - g.per);
    this.drawGroup(g);
    if (Math.random() < 0.35) this.burstCoins(u.x, u.z, 1, this.coinValue);
    this.hooks.sound?.('pop');
    if (g.alive <= 0.01) { g.alive = 0; g.label.mesh.visible = false; }
  }

  updateGates() {
    const b = this.band;
    for (const o of this.obstacles) {
      if (o.type !== 'gate' || o.used) continue;
      if (o.z < b.z - 1) break;
      if (b.z <= o.z) {
        const chosen = o.pair.find((g) => b.x >= g.x0 - 0.2 && b.x <= g.x1 + 0.2) || o.pair[0];
        for (const g of o.pair) { g.used = true; g.fade = 1; }
        chosen.chosen = true;
        this.applyGate(chosen);
      }
    }
    for (const o of this.obstacles) {
      if (o.type !== 'gate') continue;
      if (o.flash) { o.flash = Math.max(0, o.flash - 0.08); o.panel.material.opacity = 0.74 + o.flash * 0.2; }
      if (o.used && o.fade > 0) {
        o.fade = Math.max(0, o.fade - 0.06);
        o.grp.scale.setScalar(o.chosen ? 1 + (1 - o.fade) * 0.25 : 1);
        o.panel.material.opacity = o.fade * 0.74;
        o.label.mat.opacity = o.fade;
        if (o.fade <= 0) o.grp.visible = false;
      }
    }
  }

  applyGate(g) {
    let txt = '';
    const before = this.count;
    if (g.kind === 'add') { this.setCount(this.count + g.v); txt = (g.v >= 0 ? '+' : '−') + Math.abs(g.v); }
    else if (g.kind === 'mul') { this.setCount(this.count * g.v); txt = '×' + g.v; }
    else if (g.kind === 'rate') { this.rate *= 1.15; txt = 'Faster throws'; }
    else if (g.kind === 'reach') { this.range += 3; txt = 'Longer reach'; }
    const good = this.count >= before;
    this.hooks.onToast?.(txt, good ? 'good' : 'soft');
    this.hooks.sound?.(good ? 'gate' : 'gateLow');
  }

  updateRivals(dt, running) {
    const b = this.band;
    for (const g of this.groups) {
      if (g.alive <= 0 && g.units.every((u) => !u.alive && u.fall >= 1.42)) continue;
      if (!g.active && running && g.z - b.z > -16) g.active = true;
      let cx = 0, cz = 0, n = 0;
      for (const u of g.units) {
        if (!u.alive) { if (u.fall > 0 && u.fall < 1.42) u.fall = Math.min(1.42, u.fall + dt * 3.5); continue; }
        u.ph += dt * (g.active ? 9 : 1.5);
        if (g.active && running) {
          // walk toward the band
          const dx = b.x - u.x, dz = (b.z - 0.5) - u.z;
          const d = Math.hypot(dx, dz) || 1;
          const sp = 4.2;
          u.x += (dx / d) * sp * dt * 0.8;
          u.z += (dz / d) * sp * dt;
          u.x = clamp(u.x, -ROAD + 0.3, ROAD - 0.3);
          // touching one of ours: both sit out
          for (let k = this.units.length - 1; k >= 0; k--) {
            const m = this.units[k];
            const mx = b.x + m.ox, mz = b.z + m.oz;
            if (Math.abs(mx - u.x) < 0.55 && Math.abs(mz - u.z) < 0.55) {
              const take = Math.min(g.per, this.count);
              this.puff(u.x, 0.7, u.z, 0.8);
              u.alive = false; u.fall = 0.001;
              g.alive = Math.max(0, g.alive - g.per); this.drawGroup(g);
              if (g.alive <= 0.01) { g.alive = 0; g.label.mesh.visible = false; }
              this.setCount(this.count - Math.max(1, Math.round(take)), [m]);
              this.hooks.sound?.('bump');
              break;
            }
          }
        }
        if (u.alive) { cx += u.x; cz += u.z; n++; }
      }
      if (n) { g.label.mesh.position.set(cx / n, 3.0, cz / n); g.label.mesh.lookAt(this.camera.position); }
      // a rival band that slips past just wanders off
      if (n && cz / n > b.z + 4) for (const u of g.units) if (u.alive) { u.alive = false; u.fall = 0.001; g.alive = 0; g.label.mesh.visible = false; }
    }
  }

  updatePickups(dt) {
    const b = this.band;
    const reach = this.bandR + this.stats.magnet;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.spin += dt * 4;
      if (p.z > b.z + 30) { this.pickups[i] = this.pickups[this.pickups.length - 1]; this.pickups.pop(); continue; }
      if (p.st === 'fly') {
        p.vy -= 22 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.x = clamp(p.x, -ROAD + 0.4, ROAD - 0.4);
        if (p.y <= 0.45 && p.vy < 0) { p.y = 0.45; if (Math.abs(p.vy) > 3) { p.vy *= -0.35; p.vx *= 0.5; p.vz *= 0.5; } else { p.st = 'rest'; p.y = 0.55; } }
      }
      if (p.st !== 'pull' && this.state === 'run') {
        const dx = b.x - p.x, dz = b.z - p.z;
        if (dx * dx + dz * dz < reach * reach && p.y < 2) p.st = 'pull';
      }
      if (p.st === 'pull') {
        p.x = damp(p.x, b.x, 14, dt); p.z = damp(p.z, b.z, 14, dt); p.y = damp(p.y, 1.6, 10, dt);
        if (Math.abs(p.x - b.x) < 0.6 && Math.abs(p.z - b.z) < 0.6) {
          const v = Math.max(1, Math.round(p.v * this.stats.coinMult));
          this.runCoins += v;
          this.hooks.onCoin?.(v);
          this.pickups[i] = this.pickups[this.pickups.length - 1]; this.pickups.pop();
        }
      }
    }
  }

  updateFx(dt) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      const slow = Math.max(0, 1 - d.t * 3);
      d.z += d.vz * slow * dt; d.x += d.vx * slow * dt;
      if (d.t > 0.7) this.dying.splice(i, 1);
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const d = this.bits[i];
      d.t += dt;
      d.vy -= 20 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.wr * dt; d.ry += d.wr * 0.7 * dt;
      if (d.y < 0.12) { d.y = 0.12; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.wr *= 0.6; }
      if (d.t > d.life) { this.bits[i] = this.bits[this.bits.length - 1]; this.bits.pop(); }
    }
    for (let i = this.puffList.length - 1; i >= 0; i--) {
      const p = this.puffList[i];
      p.t += dt; p.y += p.vy * dt;
      if (p.t > p.life) { this.puffList[i] = this.puffList[this.puffList.length - 1]; this.puffList.pop(); }
    }
  }

  // ---------- drawing ----------
  drawUnits() {
    const b = this.band;
    const t = this.time;
    const running = this.state === 'run' && b.v > 0.5;
    this.pBody.begin(); this.pHead.begin(); this.pLeg.begin(); this.pHat.begin(); this.pItem.begin();
    this.eHat.begin(); this.eItem.begin();
    const body = _c.set(PLAYER_COLOR).clone();
    const itemCol = new THREE.Color('#ffffff');
    const drawOne = (x, z, ph, pop, skin, color, hatPool, itemPool, fall, run) => {
      const bob = run ? Math.abs(Math.sin(ph)) * 0.12 : Math.sin(ph) * 0.02;
      const s = pop < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - pop, 3)) : 1;
      _o.position.set(x, bob, z);
      const tip = fall ? (color === RIVAL_COLOR ? -1 : 1) * Math.sin(Math.min(1, fall) * Math.PI / 2) * Math.PI / 2 : 0;
      _o.rotation.set(fall ? tip : (run ? -0.12 : 0), 0, run ? Math.sin(ph) * 0.06 : 0);
      if (color === RIVAL_COLOR) _o.rotation.y = Math.PI;
      _o.scale.setScalar(s * (fall > 1 ? Math.max(0.001, 1 - (fall - 1) * 2.4) : 1));
      _o.updateMatrix();
      const base = _o.matrix.clone();
      this.pBody.push(base, color === RIVAL_COLOR ? _v3c.set(RIVAL_COLOR) : body);
      this.pHead.push(base, skin);
      hatPool.push(base);
      itemPool.push(base);
      for (const side of [-1, 1]) {
        _o2.position.set(side * 0.12, 0.48, 0);
        _o2.rotation.set(run && !fall ? Math.sin(ph + (side > 0 ? Math.PI : 0)) * 0.7 : 0, 0, 0);
        _o2.scale.setScalar(1);
        _o2.updateMatrix();
        _m4.multiplyMatrices(base, _o2.matrix);
        this.pLeg.push(_m4, _legCol);
      }
    };
    const pushing = this.pressing;
    for (const u of this.units) drawOne(b.x + u.ox, b.z + u.oz, u.ph, u.pop, u.skin, PLAYER_COLOR, this.pHat, this.pItem, 0, running || pushing);
    for (const d of this.dying) drawOne(d.x, d.z, d.ph, 1, d.skin, PLAYER_COLOR, this.pHat, this.pItem, Math.min(1, d.t / 0.35) + Math.max(0, d.t - 0.35) * 1.2, false);
    for (const g of this.groups) {
      if (g.z > b.z + 20 || g.z < b.z - 120) continue;
      for (const u of g.units) {
        if (!u.alive && u.fall >= 1.42) continue;
        drawOne(u.x, u.z, u.ph, 1, _skinCol.set(u.skin), RIVAL_COLOR, this.eHat, this.eItem, u.alive ? 0 : u.fall, g.active && u.alive);
      }
    }
    for (const p of [this.pBody, this.pHead, this.pLeg, this.pHat, this.pItem, this.eHat, this.eItem]) p.end();
  }

  drawFx() {
    this.pProj.begin();
    for (const s of this.shots) {
      _o.position.set(s.x, s.y, s.z);
      const spinny = this.era.proj === 'rock' || this.era.proj === 'ball';
      _o.rotation.set(spinny ? s.z * 0.6 : 0, spinny ? s.sp : 0, 0);
      _o.scale.setScalar(1);
      _o.updateMatrix(); this.pProj.push(_o.matrix);
    }
    this.pProj.end();
    this.coins.begin();
    for (const p of this.pickups) {
      if (p.z < this.band.z - 110) continue;
      _o.position.set(p.x, p.y + (p.st === 'rest' ? Math.sin(p.spin * 0.8) * 0.08 : 0), p.z);
      _o.rotation.set(0, p.spin, 0); _o.scale.setScalar(p.st === 'pull' ? 0.8 : 1);
      _o.updateMatrix(); this.coins.push(_o.matrix);
    }
    this.coins.end();
    this.debris.begin();
    for (const d of this.bits) {
      _o.position.set(d.x, d.y, d.z);
      _o.rotation.set(d.rx, d.ry, 0);
      const k = d.t > d.life - 0.3 ? (d.life - d.t) / 0.3 : 1;
      _o.scale.set(d.s * k, d.s * k * (d.s < 0.4 ? 0.2 : 1), d.s * k);
      _o.updateMatrix(); this.debris.push(_o.matrix, d.c);
    }
    this.debris.end();
    this.puffs.begin();
    for (const p of this.puffList) {
      const k = p.t / p.life;
      _o.position.set(p.x, p.y, p.z); _o.rotation.set(0, 0, 0);
      _o.scale.setScalar(p.s * (0.4 + k * 0.9) * (1 - k * 0.6));
      _o.updateMatrix(); this.puffs.push(_o.matrix);
    }
    this.puffs.end();
  }

  updateCamera(dt) {
    const b = this.band, k = this.camK;
    const menu = this.state === 'idle';
    const sway = menu ? Math.sin(this.time * 0.25) * 2.5 : 0;
    const tx = b.x * 0.55 + sway, ty = (menu ? 7.5 : 10.5) * k, tz = b.z + (menu ? 11 : 13.5) * k;
    if (!this.camPos) this.camPos = new THREE.Vector3(tx, ty, tz);
    this.camPos.x = damp(this.camPos.x, tx, 4, dt);
    this.camPos.y = damp(this.camPos.y, ty, 3, dt);
    this.camPos.z = damp(this.camPos.z, tz, 8, dt);
    this.camLook.set(b.x * 0.45, menu ? 1.2 : 0.5, b.z - (menu ? 6 : 9));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; }
    this.camera.lookAt(this.camLook);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.orb.position.set(this.camera.position.x + 70, this.camera.position.y + 85, this.camera.position.z - 300);
    this.orb.lookAt(this.camera.position);
    this.sun.position.set(b.x + 12, 26, b.z + 8);
    this.sun.target.position.set(b.x, 0, b.z - 6);
  }

  // where the band's count bubble goes on screen
  bandScreen() {
    // while pushing a wall, the bubble slides to the back so the wall's number stays readable
    this.bubbleBack = damp(this.bubbleBack || 0, this.pressing ? 1 : 0, 8, 1 / 60);
    const k = this.bubbleBack;
    _v3.set(this.band.x, 2.4 + this.bandR * 0.3 - k * 1.2, this.band.z - this.bandR * 0.2 + k * (this.bandR * 1.3 + 0.6));
    _v3.project(this.camera);
    return { x: (_v3.x * 0.5 + 0.5) * this.w, y: (-_v3.y * 0.5 + 0.5) * this.h };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.running || !this.era) return;
    if (this.state !== 'paused') this.update(dt);
    this.updateCamera(dt);
    this.drawUnits();
    this.drawFx();
    this.renderer.render(this.scene, this.camera);
    const p = this.bandScreen();
    this.hooks.onFrame?.(p, this.count);
  }

  pause() { if (this.state === 'run' || this.state === 'ready') { this.prevState = this.state; this.state = 'paused'; } }
  resume() { if (this.state === 'paused') this.state = this.prevState || 'run'; this.last = performance.now(); }
}

const _o2 = new THREE.Object3D();
const _m4 = new THREE.Matrix4();
const _v3c = new THREE.Color();
const _skinCol = new THREE.Color();
const _legCol = new THREE.Color('#4a3f4f');
