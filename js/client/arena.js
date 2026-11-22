// Builds a stylised 3D arena from the map's real pathing grid (war3map.wpm) and
// placed doodads/destructibles (war3map.doo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAP } from '../sim/data.js';
import { THEMES_EXTRA } from './looks/index.js';
import { REGIONS, center, ARENA_SCALE } from '../sim/engine.js';
import { S } from './scene.js';

export const THEMES = {
  peon:   { a: '#ffa9cf', b: '#ffc4df', line: '#ff8fc0', side: '#ff6fae', bump: [0x7ee8c8, 0xfff2a8], deep: '#c74b86', night: 0 },
  kaboom: { a: '#ffcf8a', b: '#ffe3b8', line: '#ff8a3d', side: '#e8603a', bump: [0xb27bff, 0xff6b8b], deep: '#8c3b2b', night: 0 },
  mortar: { a: '#9fe38a', b: '#c1f2ad', line: '#69c96b', side: '#4da85a', bump: [0xffd23f, 0x7fd3ff], deep: '#2f7a46', night: 0 },
  stop:   { a: '#5b4b9c', b: '#6b5bb0', line: '#a58cff', side: '#3b2d73', bump: [0x2ee6c5, 0x8a6cff], deep: '#1f1645', night: 1 },
  road:   { a: '#8fd3ff', b: '#b8e6ff', line: '#58b8ef', side: '#3d8fd1', bump: [0xff8a3d, 0xffd23f], deep: '#22568a', night: 0 },
};

const PX = 8; // texture pixels per 32-unit cell

// ---- smooth outlines from the pathing grid (marching squares on a blurred field)
function contours(field, W, H, level = 0.5) {
  const v = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : field[j * W + i]);
  const segs = [];
  const lerp = (a, b, va, vb) => { const t = (level - va) / (vb - va || 1e-6); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  for (let j = -1; j < H; j++) for (let i = -1; i < W; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
    const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const P = { a: [i, j], b: [i + 1, j], c: [i + 1, j + 1], d: [i, j + 1] };
    const e = { ab: () => lerp(P.a, P.b, a, b), bc: () => lerp(P.b, P.c, b, c), cd: () => lerp(P.c, P.d, c, d), da: () => lerp(P.d, P.a, d, a) };
    const L = { 1: [['da', 'ab']], 2: [['ab', 'bc']], 3: [['da', 'bc']], 4: [['bc', 'cd']], 6: [['ab', 'cd']], 7: [['da', 'cd']], 8: [['cd', 'da']], 9: [['cd', 'ab']], 11: [['cd', 'bc']], 12: [['bc', 'da']], 13: [['bc', 'ab']], 14: [['ab', 'da']] };
    let pairs = L[idx];
    if (idx === 5) pairs = (a + b + c + d) / 4 > level ? [['da', 'cd'], ['ab', 'bc']] : [['da', 'ab'], ['bc', 'cd']];
    if (idx === 10) pairs = (a + b + c + d) / 4 > level ? [['ab', 'da'], ['cd', 'bc']] : [['ab', 'bc'], ['cd', 'da']];
    for (const [p, q] of pairs) segs.push([e[p](), e[q]()]);
  }
  const key = (p) => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000);
  const map = new Map();
  segs.forEach((sg, k) => { for (const p of sg) { const kk = key(p); if (!map.has(kk)) map.set(kk, []); map.get(kk).push(k); } });
  const used = new Uint8Array(segs.length), loops = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue; used[s0] = 1;
    const loop = [segs[s0][0], segs[s0][1]]; let cur = segs[s0][1];
    for (let guard = 0; guard < 100000; guard++) {
      const nb = (map.get(key(cur)) || []).find((k) => !used[k]); if (nb === undefined) break;
      used[nb] = 1; const sg = segs[nb]; const nxt = key(sg[0]) === key(cur) ? sg[1] : sg[0];
      loop.push(nxt); cur = nxt;
    }
    if (loop.length > 4) loops.push(loop);
  }
  return loops;
}
function chaikin(pts, n = 2) {
  for (let k = 0; k < n; k++) { const o = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(o[0]); pts = o; }
  return pts;
}
const area = (p) => { let s = 0; for (let i = 0; i < p.length - 1; i++) s += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1]; return s / 2; };
const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
function shapesFrom(loops, toXY) {
  const polys = loops.map((l) => chaikin(l, 3).map(toXY)).filter((p) => Math.abs(area(p)) > 0.02);
  const depth = polys.map((p, i) => polys.filter((q, k) => k !== i && Math.abs(area(q)) > Math.abs(area(p)) && inside(p[0], q)).length);
  const shapes = [];
  polys.forEach((p, i) => {
    if (depth[i] % 2) return;
    const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
    polys.forEach((h, k) => { if (depth[k] === depth[i] + 1 && Math.abs(area(h)) < Math.abs(area(p)) && inside(h[0], p)) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))); });
    shapes.push(sh);
  });
  return shapes;
}
function blur(f, W, H, r, n) {
  let a = f;
  for (let it = 0; it < n; it++) {
    const b = new Float32Array(W * H), c = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const x = i + d; if (x >= 0 && x < W) { s += a[j * W + x]; } m++; } b[j * W + i] = s / m; }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0, m = 0; for (let d = -r; d <= r; d++) { const y = j + d; if (y >= 0 && y < H) { s += b[y * W + i]; } m++; } c[j * W + i] = s / m; }
    a = c;
  }
  return a;
}

const PAINTERS = {
  dots(g, w, h, th) { g.fillStyle = th.b; g.globalAlpha = 0.9; const st = 46; for (let y = 0, r = 0; y < h + st; y += st, r++) for (let x = (r % 2) * st / 2; x < w + st; x += st) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } g.globalAlpha = 1; },
  rings(g, w, h, th, P) { const [cx, cy] = P.center; for (let r = 1400, k = 0; r > 0; r -= 26, k++) { g.fillStyle = k % 2 ? th.a : th.b; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); } },
  sunburst(g, w, h, th, P) { const [cx, cy] = P.center; for (let k = 0; k < 28; k++) { g.fillStyle = k % 2 ? th.a : th.b; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 2000, (k / 28) * Math.PI * 2, ((k + 1) / 28) * Math.PI * 2); g.fill(); } g.fillStyle = th.b; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill(); },
  stars(g, w, h, th) { g.fillStyle = th.b; g.globalAlpha = 0.6; let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < (w * h) / 900; i++) { g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 0, 7); g.fill(); } g.globalAlpha = 1; },
  diag(g, w, h, th) { g.strokeStyle = th.b; g.lineWidth = 22; for (let x = -h; x < w + h; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } },
};
const THEME_PAINT = { peon: 'dots', kaboom: 'rings', mortar: 'sunburst', stop: 'stars', road: 'diag' };
const THEME_CENTER = { kaboom: 'Kaboom_Room', mortar: 'Mortar', peon: 'Peon_Pandemonium' };

export function themeFor(key) {
  if (THEMES[key]) return THEMES[key];
  if (THEMES_EXTRA[key]) return THEMES_EXTRA[key];
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pal = [['#ffd1e8', '#ffe6f2', 0x7ee8c8, 0xfff2a8, '#ff6fae', '#c74b86'], ['#c9f0ff', '#e3f8ff', 0xff8a3d, 0xffd23f, '#3d8fd1', '#22568a'], ['#d9f7c4', '#ecffe0', 0xa066ff, 0x7fd3ff, '#4da85a', '#2f7a46'], ['#ffe2b8', '#fff1dc', 0xff5fa8, 0xb27bff, '#e8803a', '#8c4b2b'], ['#e4d6ff', '#f1e9ff', 0x2ee6c5, 0xffd23f, '#8a6cff', '#3b2d73']][h % 5];
  return (THEMES[key] = { a: pal[0], b: pal[1], line: pal[4], side: pal[4], bump: [pal[2], pal[3]], deep: pal[5], night: 0 });
}

export function buildArena(key, opts = {}) {
  const A = MAP.arenas[key], th = themeFor(key);
  const group = new THREE.Group(); group.name = 'arena-' + key;
  const W = A.w, H = A.h, TP = 16;
  const walk = (i, j) => i >= 0 && j >= 0 && i < W && j < H && A.rows[j][i] === '.';
  const x0 = A.x0 * S, z0 = -A.y0 * S, c = A.cell * S;
  const wx = (i) => x0 + i * c, wz = (j) => z0 - j * c;

  // --- top surface: painted candy checker
  const cv = document.createElement('canvas'); cv.width = W * TP; cv.height = H * TP;
  const g = cv.getContext('2d');
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!walk(i, j)) continue;
    g.fillStyle = (Math.floor(i / 4) + Math.floor(j / 4)) % 2 ? th.a : th.b;
    g.fillRect(i * TP, (H - 1 - j) * TP, TP, TP);
  }
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let j = 0; j < H; j += 2) for (let i = (j / 2) % 2; i < W; i += 2) if (walk(i, j)) { g.beginPath(); g.arc(i * TP + TP / 2, (H - 1 - j) * TP + TP / 2, TP * 0.22, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  g.strokeStyle = th.line; g.lineWidth = 4;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!walk(i, j)) continue; const X = i * TP, Y = (H - 1 - j) * TP;
    g.beginPath();
    if (!walk(i - 1, j)) { g.moveTo(X + 2, Y); g.lineTo(X + 2, Y + TP); }
    if (!walk(i + 1, j)) { g.moveTo(X + TP - 2, Y); g.lineTo(X + TP - 2, Y + TP); }
    if (!walk(i, j + 1)) { g.moveTo(X, Y + 2); g.lineTo(X + TP, Y + 2); }
    if (!walk(i, j - 1)) { g.moveTo(X, Y + TP - 2); g.lineTo(X + TP, Y + TP - 2); }
    g.stroke();
  }
  if (opts.paint) opts.paint(g, (x, y) => [((x - A.x0) / A.cell) * TP, (H - (y - A.y0) / A.cell) * TP], TP / A.cell);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W * c, H * c), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.55 }));
  top.rotation.x = -Math.PI / 2; top.position.set(x0 + W * c / 2, 0, z0 - H * c / 2); top.receiveShadow = true;
  group.add(top);

  // --- open water under sea arenas (boats sail on unwalkable cells)
  if (key === 'tides_of_darkness') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W * c, H * c), new THREE.MeshPhysicalMaterial({ color: 0x3fb8ff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.position.set(x0 + W * c / 2, -0.04, z0 - H * c / 2); water.receiveShadow = true; group.add(water);
  }
  // --- platform sides
  const sideCol = new THREE.Color(th.side), deep = new THREE.Color(th.deep);
  const pos = [], col = [], T = 0.9;
  const quad = (a, b, cc, d, ca, cb) => { pos.push(...a, ...b, ...cc, ...a, ...cc, ...d); for (const k of [ca, ca, cb, ca, cb, cb]) col.push(k.r, k.g, k.b); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!walk(i, j)) continue;
    const L = wx(i), R = wx(i + 1), N = wz(j + 1), F = wz(j);
    if (!walk(i, j - 1)) quad([L, 0, F], [R, 0, F], [R, -T, F], [L, -T, F], sideCol, deep);
    if (!walk(i, j + 1)) quad([R, 0, N], [L, 0, N], [L, -T, N], [R, -T, N], sideCol, deep);
    if (!walk(i - 1, j)) quad([L, 0, N], [L, 0, F], [L, -T, F], [L, -T, N], sideCol, deep);
    if (!walk(i + 1, j)) quad([R, 0, F], [R, 0, N], [R, -T, N], [R, -T, F], sideCol, deep);
    quad([L, -T, F], [R, -T, F], [R, -T, N], [L, -T, N], deep, deep);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sg.computeVertexNormals();
  const sides = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  sides.receiveShadow = true; group.add(sides);

  // --- candy bumpers on unwalkable cells near the floor (2x2 merged where possible)
  const near = (i, j) => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (walk(i + di, j + dj)) return true; return false; };
  const isB = (i, j) => i >= 0 && j >= 0 && i < W && j < H && !walk(i, j) && near(i, j);
  const used = new Set(), blocks = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!isB(i, j) || used.has(i + ',' + j)) continue;
    if (i % 2 === 0 && j % 2 === 0 && isB(i + 1, j) && isB(i, j + 1) && isB(i + 1, j + 1) && ![[i + 1, j], [i, j + 1], [i + 1, j + 1]].some(([a, b]) => used.has(a + ',' + b))) {
      for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) used.add(a + ',' + b);
      blocks.push([i + 0.5, j + 0.5, 2]);
    } else { used.add(i + ',' + j); blocks.push([i, j, 1]); }
  }
  const bumpGeo = new RoundedBoxGeometry(c * 0.94, 0.42, c * 0.94, 3, 0.07);
  const bumps = new THREE.InstancedMesh(bumpGeo, new THREE.MeshStandardMaterial({ roughness: 0.3 }), blocks.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), cA = new THREE.Color(th.bump[0]), cB = new THREE.Color(th.bump[1]);
  blocks.forEach(([i, j, n], k) => {
    const h = (n === 2 ? 1.25 : 0.8) + 0.2 * Math.sin(i * 0.7 + j * 0.45);
    sc.set(n * (n === 2 ? 1.02 : 1), h, n * (n === 2 ? 1.02 : 1)); v.set(wx(i) + c / 2, 0.21 * h - 0.05, wz(j) - c / 2);
    m4.compose(v, q, sc); bumps.setMatrixAt(k, m4);
    bumps.setColorAt(k, ((Math.floor(i / 2) + Math.floor(j / 2)) % 2 ? cA : cB));
  });
  bumps.castShadow = true; bumps.receiveShadow = true; group.add(bumps);

  // --- doodads (decor) and destructibles
  const decoGroup = new THREE.Group(); group.add(decoGroup);
  for (const d of A.deco) { const m = makeDeco(d.id, d.s); if (m) { m.position.set(d.x * S, 0, -d.y * S); m.rotation.y = (d.x * 13 + d.y * 7) % 6.28; decoGroup.add(m); } }
  // non-tree destructibles (gates, walls, pathing blockers) as candy blocks
  for (const d of A.dest) if (d.type !== 'tree' && d.size) { const b = new THREE.Mesh(new RoundedBoxGeometry(d.size * S * 0.95, 0.5, d.size * S * 0.95, 3, 0.07), new THREE.MeshStandardMaterial({ color: th.bump[0], roughness: 0.35 })); b.position.set(d.x * S, 0.22, -d.y * S); b.castShadow = true; b.receiveShadow = true; b.userData.dest = d; group.add(b); }
  const trees = [];
  for (const d of A.dest) if (d.type === 'tree') { const t = makeTree(d); t.position.set(d.x * S, 0, -d.y * S); group.add(t); trees.push({ d, mesh: t }); }

  group.userData = { trees, key, theme: th };
  return group;
}

const mats = {};
const mat = (hex, rough = 0.45, extra = {}) => (mats[hex + rough + JSON.stringify(extra)] ??= new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra }));

function makeDeco(id, s = 1) {
  const g = new THREE.Group(); const k = id[1];
  if (k === 'R') {
    const n = id.endsWith('sp') ? 3 : id.endsWith('rs') ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + i * 0.05, 0), mat([0xc9b8ff, 0xffc4d8, 0xa8e6ff][i % 3], 0.8));
      r.position.set((i - n / 2) * 0.18, 0.08, (i % 2) * 0.12); r.scale.y = id.endsWith('sp') || id.endsWith('rs') ? 2.2 : 0.8; r.castShadow = true; g.add(r);
    }
  } else if (id === 'BPca' || id === 'LPrs') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 6, 12), mat(0x3fcf7a, 0.5)); body.position.y = 0.26; body.castShadow = true; g.add(body);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), mat(0x3fcf7a, 0.5)); arm.position.set(0.12, 0.3, 0); arm.rotation.z = -0.6; g.add(arm);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xff5fa8, 0.4)); fl.position.y = 0.53; g.add(fl);
  } else if (k === 'P' || k === 'T' || k === 'S') {
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11 + i * 0.02, 12, 10), mat([0x6fdc8c, 0x4fcf7a, 0x8be04e][i], 0.7)); b.position.set(Math.cos(i * 2.1) * 0.1, 0.09, Math.sin(i * 2.1) * 0.1); b.castShadow = true; g.add(b); }
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xffd23f, 0.4)); fl.position.set(0, 0.22, 0); g.add(fl);
  } else return null;
  g.scale.setScalar(Math.max(0.7, Math.min(1.6, s)));
  return g;
}

function makeTree() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 8), mat(0xfff1e0, 0.5)); stick.position.y = 0.35; stick.castShadow = true; g.add(stick);
  const candy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xff7fb8, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 }));
  candy.position.y = 0.95; candy.scale.set(1, 1, 0.5); candy.castShadow = true; g.add(candy);
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 24), mat(0xffffff, 0.3)); swirl.position.set(0, 0.95, 0.17); g.add(swirl);
  g.userData.candy = candy;
  return g;
}

export function finishPad() {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + j) % 2 ? '#2a1846' : '#ffffff'; x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 32), [new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0xffd23f })]);
  pad.position.y = 0.03; pad.receiveShadow = true; g.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 8, 40), new THREE.MeshStandardMaterial({ color: 0xffe66b, emissive: 0xffc23f, emissiveIntensity: 1.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), mat(0xffffff, 0.4)); pole.position.set(0.55, 0.65, 0); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32, 8, 1), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); flag.position.set(0.8, 1.13, 0); g.add(flag);
  g.userData = { ring, flag };
  return g;
}
