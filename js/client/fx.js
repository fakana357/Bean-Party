// Particles, decals, missiles and one-shot effects.
import * as THREE from 'three';
import { S } from './scene.js';

const COLORS = [0xff5fa8, 0x7fd3ff, 0xffd23f, 0x4fe3b5, 0xa066ff, 0xff8a3d];

export class FX {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.root = new THREE.Group(); scene.add(this.root);
    // pooled confetti/particles as a single instanced mesh
    this.N = 1400;
    this.pGeo = new THREE.BoxGeometry(0.06, 0.012, 0.09);
    this.pMesh = new THREE.InstancedMesh(this.pGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide }), this.N);
    this.pMesh.frustumCulled = false; this.root.add(this.pMesh);
    this.parts = []; this.pi = 0;
    for (let i = 0; i < this.N; i++) { this.parts.push({ life: 0 }); this.pMesh.setColorAt(i, new THREE.Color(0xffffff)); }
    this.puffGeo = new THREE.SphereGeometry(1, 14, 10);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.missiles = new Map();
  }
  clear() { for (const it of this.items) this.root.remove(it.obj); this.items = []; for (const p of this.parts) p.life = 0; for (const [, m] of this.missiles) this.root.remove(m); this.missiles.clear(); }
  add(obj, life, update) { this.root.add(obj); this.items.push({ obj, life, max: life, update }); return obj; }

  burst(x, y, z, n = 40, { colors = COLORS, speed = 4, up = 4, size = 1, grav = 9, life = 1.6, kind = 'confetti' } = {}) {
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.pi]; const idx = this.pi; this.pi = (this.pi + 1) % this.N;
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      Object.assign(p, { x: x * S, y: z * S + 0.3, z: -y * S, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s, life, max: life, rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 20, size: size * (0.6 + Math.random() * 0.8), grav, kind });
      this.pMesh.setColorAt(idx, new THREE.Color(colors[i % colors.length]));
    }
    this.pMesh.instanceColor.needsUpdate = true;
  }
  puff(x, y, z = 0, r = 0.5, color = 0xffffff, life = 0.7, opacity = 0.9) {
    const m = new THREE.Mesh(this.puffGeo, new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, emissive: color, emissiveIntensity: 0.15 }));
    m.position.set(x * S, z * S + r * 0.5, -y * S); m.scale.setScalar(r * 0.3);
    this.add(m, life, (it, k) => { const s = r * (0.3 + 0.9 * Math.sqrt(1 - k)); m.scale.setScalar(s); m.position.y += 0.004; m.material.opacity = opacity * k; });
  }
  ring(x, y, r, color = 0xffffff, life = 0.5, y0 = 0.03) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x * S, y0, -y * S);
    this.add(m, life, (it, k) => { m.scale.setScalar(r * S * (0.2 + (1 - k) * 0.85)); m.material.opacity = k; });
  }
  splat(x, y, r, color, life = 4) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 18, 0, 7); g.fill();
    for (let i = 0; i < 9; i++) { const a = Math.random() * 7, d = 14 + Math.random() * 12; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 3 + Math.random() * 6, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, color, transparent: true, depthWrite: false, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x * S, 0.015, -y * S); m.scale.setScalar(r * S * 1.6);
    this.add(m, life, (it, k) => { m.material.opacity = Math.min(0.85, k * 2); });
  }
  boom(x, y, big = false) {
    const r = big ? 1.1 : 0.7;
    this.puff(x, y, 0, r, 0xffe066, 0.35, 1);
    this.puff(x, y, 20, r * 0.8, 0xff8a3d, 0.6, 1);
    for (let i = 0; i < 6; i++) this.puff(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120, Math.random() * 40, r * 0.55, 0xf4ecff, 0.9 + Math.random() * 0.4, 0.85);
    this.ring(x, y, big ? 300 : 220, 0xffffff, 0.45);
    this.burst(x, y, 30, big ? 70 : 40, { speed: 6, up: 6 });
  }
  teleport(x, y) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x * S, 1.5, -y * S);
    this.add(m, 0.8, (it, k) => { m.scale.set(k, 1 + (1 - k), k); m.material.opacity = 0.6 * k; });
    this.burst(x, y, 20, 24, { colors: [0xfff2a8, 0xffffff, 0x7fd3ff], speed: 1.5, up: 6, grav: 2 });
  }
  marker(x, y, color = 0x57e36b) {
    for (let i = 0; i < 2; i++) setTimeout(() => this.ring(x, y, 45 - i * 12, color, 0.45, 0.04), i * 90);
  }
  text(x, y, str, color = '#fff') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
    g.font = '64px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#2a1846'; g.strokeText(str, 128, 50); g.fillStyle = color; g.fillText(str, 128, 50);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    sp.position.set(x * S, 1.4, -y * S); sp.scale.set(1.6, 0.6, 1); sp.renderOrder = 10;
    this.add(sp, 1.6, (it, k) => { sp.position.y += 0.012; sp.material.opacity = Math.min(1, k * 3); });
  }
  oil(x, y, r, dur) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r * S, 32), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3300, emissiveIntensity: 1.2, transparent: true, opacity: 0.6, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x * S, 0.02, -y * S);
    let acc = 0;
    this.add(m, dur, (it, k, dt) => { m.material.opacity = 0.6 * Math.min(1, k * 4); acc += dt; if (acc > 0.08) { acc = 0; this.burst(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, 0, 1, { colors: [0xffd23f, 0xff8a3d], speed: 0.2, up: 2, grav: -1, life: 0.6, size: 1.3 }); } });
  }
  // landing telegraph: a fixed outline + a disc that fills up until impact
  telegraph(x, y, r, dur, hot) {
    const col = hot ? 0xff7a1a : 0xff3d8b;
    const g = new THREE.Group(); g.position.set(x * S, 0.03, -y * S);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * S * 0.9, r * S, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * S, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false }));
    ring.rotation.x = disc.rotation.x = -Math.PI / 2; g.add(ring, disc);
    this.add(g, dur, (it, k, dt, t) => { const f = 1 - k; disc.scale.setScalar(Math.max(0.02, f)); ring.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * (6 + f * 14))); });
  }
  lava(x, y, r, dur) {
    const g = new THREE.Group(); g.position.set(x * S, 0.025, -y * S);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * S, 40), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3300, emissiveIntensity: 1.4, transparent: true, opacity: 0.85, depthWrite: false }));
    const edge = new THREE.Mesh(new THREE.RingGeometry(r * S * 0.92, r * S * 1.04, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = edge.rotation.x = -Math.PI / 2; g.add(disc, edge);
    let acc = 0;
    this.add(g, dur, (it, k, dt) => { const a = Math.min(1, k * 5); disc.material.opacity = 0.85 * a; edge.material.opacity = a; acc += dt; if (acc > 0.06) { acc = 0; this.burst(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, 0, 1, { colors: [0xffd23f, 0xff8a3d], speed: 0.2, up: 2, grav: -1, life: 0.6, size: 1.3 }); } });
  }
  flame(x, y, persistent) {
    const g = new THREE.Group(); g.position.set(x * S, 0, -y * S);
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x5b3a8c, roughness: 0.6 })); logs.position.y = 0.12; g.add(logs);
    const cones = [];
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.35 - i * 0.04, 1.2 - i * 0.12, 12), new THREE.MeshStandardMaterial({ color: [0xffd23f, 0xff8a3d, 0xff5a1f][i % 3], emissive: [0xffb000, 0xff6a00, 0xff3300][i % 3], emissiveIntensity: 1.8, transparent: true, opacity: 0.9 })); const a = i / 5 * 6.28; c.position.set(Math.cos(a) * 0.25 * (i ? 1 : 0), 0.7, Math.sin(a) * 0.25 * (i ? 1 : 0)); g.add(c); cones.push(c); }
    this.add(g, 1e9, (it, k, dt, t) => { cones.forEach((c, i) => { const s = 1 + Math.sin(t * 9 + i * 1.7) * 0.18; c.scale.set(1 / s, s, 1 / s); }); });
    return g;
  }

  // ---- missiles mirrored from sim
  syncMissiles(list, alpha) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let o = this.missiles.get(m.id);
      if (!o) { o = this.makeMissile(m); this.missiles.set(m.id, o); this.root.add(o); }
      const px = o.userData.px ?? m.x, py = o.userData.py ?? m.y, pz = o.userData.pz ?? m.z;
      o.position.set(m.x * S, (m.z || 60) * S, -m.y * S);
      o.userData.px = m.x; o.userData.py = m.y; o.userData.pz = m.z;
      o.rotation.x += 0.2; o.rotation.y += 0.13;
      if (o.userData.shadow) { o.userData.shadow.position.set(m.x * S, 0.02, -m.y * S); const h = (m.z || 0) * S; o.userData.shadow.scale.setScalar(Math.max(0.4, 1.2 - h * 0.15)); }
      if (o.userData.trail && Math.random() < 0.6) this.burst(m.x, m.y, m.z || 60, 1, { colors: o.userData.trail, speed: 0.1, up: 0.3, grav: 0.5, life: 0.5, size: 1.2 });
    }
    for (const [id, o] of this.missiles) if (!seen.has(id)) { this.root.remove(o); if (o.userData.shadow) this.root.remove(o.userData.shadow); this.missiles.delete(id); }
  }
  makeMissile(m) {
    let o;
    if (m.type === 'ncat' || m.type === 'ocat') {
      const hot = m.type === 'ocat';
      o = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshPhysicalMaterial({ color: hot ? 0xff5a1f : 0xff5fa8, roughness: 0.1, clearcoat: 1, emissive: hot ? 0xff3300 : 0x220011, emissiveIntensity: hot ? 1 : 0.4 }));
      o.userData.trail = hot ? [0xffd23f, 0xff8a3d] : [0xff9fd0, 0xffffff];
    } else if (m.type === 'boulder') {
      o = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0x2a1846, roughness: 0.25, clearcoat: 1 })); o.add(b);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 })); sp.position.set(0.15, 0.2, 0); o.add(sp);
      o.userData.trail = [0xffe066, 0xff8a3d];
    } else if (m.type === 'uzg1') {
      o = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb3bd }));
      o.userData.trail = [0xff4d5e, 0xffffff];
    } else o = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    o.castShadow = true;
    if (m.kind === 'art' || m.type === 'boulder') {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: 0x2a1846, transparent: true, opacity: 0.3, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; this.root.add(sh); o.userData.shadow = sh;
    }
    return o;
  }

  update(dt, t) {
    for (const it of this.items) { it.life -= dt; it.update && it.update(it, Math.max(0, it.life / it.max), dt, t); }
    for (const it of this.items) if (it.life <= 0) this.root.remove(it.obj);
    this.items = this.items.filter((i) => i.life > 0);
    const { m4, q, e, v, sc } = this;
    for (let i = 0; i < this.N; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { sc.set(0, 0, 0); m4.compose(v.set(0, -99, 0), q, sc); this.pMesh.setMatrixAt(i, m4); continue; }
      p.life -= dt; p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.kind === 'confetti') { p.y = 0.02; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; p.spin *= 0.8; }
      if (p.kind === 'confetti' && p.vy < 0) { p.vx *= 0.97; p.vz *= 0.97; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const s = p.size * Math.min(1, p.life / p.max * 3);
      e.set(p.rx, p.ry, 0); q.setFromEuler(e); sc.set(s, s, s);
      m4.compose(v.set(p.x, p.y, p.z), q, sc); this.pMesh.setMatrixAt(i, m4);
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
  }
}
