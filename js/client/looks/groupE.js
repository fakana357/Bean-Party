// Group E looks: Mino-Bean Maze, Quill-Bean Mile, The Unseen Bean, Pork the Piggy-Bean,
// The Bean Plague, Troubled Beans, Bean Shearers.
// ~0.01 scene units per WC3 unit, +y up, facing +z.
import * as THREE from 'three';

const glossy = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, ...extra });
const eyes = (g, M, r, y, z, s = 1) => {
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 10, 8), M(0xffffff, 0.3)); e.position.set(sx * r, y, z); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), M(0x1a1030, 0.3)); p.position.set(sx * r, y, z + 0.05 * s); g.add(p);
  }
};

export const LOOKS = {
  // minotaur: a chunky caramel bull robot
  otau: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), glossy(0xc9783a)); body.scale.set(1, 1.1, 1.1); body.position.y = 0.45; body.castShadow = true; g.add(body);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), M(0xffc4df)); snout.scale.set(1.3, 0.8, 0.8); snout.position.set(0, 0.42, 0.36); g.add(snout);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 10), M(0xfff1e0)); h.position.set(sx * 0.3, 0.85, 0.05); h.rotation.z = -sx * 0.9; g.add(h); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), M(0xffd23f, 0.2, { metalness: 0.6 })); ring.position.set(0, 0.35, 0.48); g.add(ring);
    eyes(g, M, 0.13, 0.62, 0.3);
    return g;
  },
  // spear thrower: a candy cannon post with spikes
  nqbh: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.5, 18), M(0x8a5a3c)); base.position.y = 0.25; base.castShadow = true; g.add(base);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), glossy(0xff8a3d)); head.position.y = 0.7; g.add(head);
    for (let i = 0; i < 6; i++) { const q = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.25, 6), M(0xfff1e0)); const a = i / 6 * Math.PI * 2; q.position.set(Math.cos(a) * 0.2, 0.9, Math.sin(a) * 0.2 - 0.05); q.rotation.x = -0.5; g.add(q); }
    eyes(g, M, 0.1, 0.75, 0.24);
    return g;
  },
  // hidden guard: a ghostly mint jelly, nearly invisible until revealed
  ndrf: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x2ee6c5, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.06 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat); body.scale.set(1, 1.3, 1); body.position.y = 0.4; g.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, transparent: true, opacity: 0.06 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat), eyeR = eyeL.clone(); eyeL.position.set(-0.1, 0.55, 0.26); eyeR.position.set(0.1, 0.55, 0.26); g.add(eyeL, eyeR);
    body.onBeforeRender = () => { const o = u.revealed || !u.alive ? 0.9 : 0.06; mat.opacity += (o - mat.opacity) * 0.15; eyeMat.opacity = mat.opacity; };
    return g;
  },
  // the piggy: a pink gumdrop boar
  nfbr: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), glossy(0xff9ec7)); body.scale.set(0.9, 0.8, 1.2); body.position.y = 0.3; body.castShadow = true; g.add(body);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 14), M(0xff6fae)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.3, 0.38); g.add(nose);
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), M(0xff6fae)); ear.position.set(sx * 0.14, 0.56, 0.15); g.add(ear); const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), M(0xffffff)); t.position.set(sx * 0.08, 0.24, 0.4); t.rotation.x = 0.4; g.add(t); }
    eyes(g, M, 0.1, 0.42, 0.3, 0.8);
    return g;
  },
  // zombie: a sour-apple bean with droopy arms
  nzom: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.3, 6, 14), glossy(0x8fdc5a)); body.position.y = 0.42; body.rotation.x = 0.2; body.castShadow = true; g.add(body);
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.25, 4, 8), M(0x6fbf45)); a.rotation.x = Math.PI / 2; a.position.set(sx * 0.18, 0.5, 0.25); g.add(a); }
    eyes(g, M, 0.08, 0.62, 0.22, 0.9);
    return g;
  },
  // wave: a blue jelly roller
  h005: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x58b8ef, roughness: 0.1, clearcoat: 1, transmission: 0.3, transparent: true, opacity: 0.85 });
    const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 6, 16), mat); wave.rotation.x = Math.PI / 2; wave.rotation.z = Math.PI / 2; wave.position.y = 0.3; wave.scale.set(1, 1, 1); g.add(wave);
    const foam = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 20), M(0xffffff)); foam.position.y = 0.55; foam.rotation.x = Math.PI / 2; g.add(foam);
    return g;
  },
  // shearer: a spinning scissor drone with its danger circle (radius 120)
  e000: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff4d5e })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; g.add(rim);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glossy(0xc0c8d8, { metalness: 0.6 })); hub.position.y = 0.5; hub.castShadow = true; g.add(hub);
    const blades = new THREE.Group(); blades.position.y = 0.5; g.add(blades);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.08), M(0xeef2ff, 0.2, { metalness: 0.7 })); b.rotation.y = i * Math.PI / 4; blades.add(b); }
    hub.onBeforeRender = () => { blades.rotation.y += 0.3; };
    eyes(g, M, 0.08, 0.55, 0.19, 0.8);
    return g;
  },
};

export const THEMES = {
  minotaur_maze: { a: '#e8c79a', b: '#f2dab8', line: '#b2793f', side: '#9a6a3a', bump: [0x57d96b, 0xff7fc8], deep: '#5a3a20', night: 0 },
  quillboar_mile: { a: '#c8e68a', b: '#dcf2ad', line: '#ff8a3d', side: '#7fa84d', bump: [0xff8a3d, 0xfff2a8], deep: '#3f6a26', night: 0 },
  unseen: { a: '#3d3a7a', b: '#4b4890', line: '#2ee6c5', side: '#2a2760', bump: [0x2ee6c5, 0xa066ff], deep: '#141235', night: 1 },
  destruction_dance: { a: '#ffcf8a', b: '#ffe3b8', line: '#ff4d5e', side: '#e8603a', bump: [0xff4d5e, 0xffd23f], deep: '#8c3b2b', night: 0 },
  pork_the_piggy: { a: '#9fe38a', b: '#c1f2ad', line: '#ff9ec7', side: '#4da85a', bump: [0xff9ec7, 0xffd23f], deep: '#2f7a46', night: 0 },
  plague: { a: '#5b6b4b', b: '#6b7d58', line: '#8fdc5a', side: '#3b4a30', bump: [0x8fdc5a, 0xa066ff], deep: '#1c2614', night: 1 },
  troubled_waters: { a: '#bfe9ff', b: '#d8f3ff', line: '#58b8ef', side: '#3d8fd1', bump: [0xffd23f, 0xff7fc8], deep: '#22568a', night: 0 },
  sheep_shearers: { a: '#d8f5c8', b: '#e8fadc', line: '#ff4d5e', side: '#8cc97a', bump: [0xffffff, 0xff7fc8], deep: '#3f7a36', night: 0 },
};
