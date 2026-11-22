// Visual actors for simulation units: beans and the Bean-world machines that
// replace the WC3 units (catapults -> jelly launchers, spirit towers ->
// lighthouses, siege engines -> steamrollers, wisps -> fire sprites...).
import * as THREE from 'three';
import { S } from './scene.js';
import { skinTexture, DEFAULT_SKINS, emojiTexture } from './skins.js';
import { LOOKS } from './looks/index.js';

let resolveSkin = (slot) => DEFAULT_SKINS[slot] || DEFAULT_SKINS[1];
export function setSkinResolver(fn) { resolveSkin = fn; }

// WC3 player colour order (red, blue, teal, purple, yellow, orange, green, pink) as candy shades
export const BEAN_COLORS = [null, '#ff4d5e', '#3d8bff', '#2ee6c5', '#a066ff', '#ffd23f', '#ff8a3d', '#57d96b', '#ff7fc8'];
export const BEAN_NAMES = [null, 'Cherry', 'Blueberry', 'Mint', 'Grape', 'Lemon', 'Tangerine', 'Lime', 'Bubblegum'];

// smooth bean body: a lathe profile (wider bottom, rounded top)
// strict cylinder with rounded top and bottom, sampled evenly by arc length so patterns don't stretch
const BR = 0.3, BH = 0.42, LEG = 0.13;
const PROFILE = (() => { const p = new THREE.Path(); p.absarc(0, BR, BR, -Math.PI / 2, 0, false); p.lineTo(BR, BR + BH); p.absarc(0, BR + BH, BR, 0, Math.PI / 2, false); return p.getSpacedPoints(64).map((v) => new THREE.Vector2(Math.max(0.0005, v.x), v.y)); })();
const geo = {
  body: new THREE.LatheGeometry(PROFILE, 48),
  eye: new THREE.CapsuleGeometry(0.027, 0.06, 4, 10),
  arm: new THREE.CapsuleGeometry(0.06, 0.16, 6, 12),
  foot: new THREE.CapsuleGeometry(0.075, 0.07, 6, 12),
  face: new THREE.CylinderGeometry(0.303, 0.303, 0.34, 24, 1, true, -0.62, 1.24),
  shadow: new THREE.CircleGeometry(0.3, 24),
};
const black = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.4 });
const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x2a1846, transparent: true, opacity: 0.22, depthWrite: false });
const M = (c, r = 0.45, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });

// glossy candy shell, like a jelly bean
function beanMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.4, transparent: true, opacity: 1 });
}
export const BEAN_SCALE = 0.8; // visual radius ≈ collision radius (14) of a player's bean

export const BEAN_STYLES = ['mask', 'sprout', 'shine', 'seam', 'antenna', 'cheeks'];
let BEAN_STYLE = 'none';
export function setBeanStyle(s) { BEAN_STYLE = s; }

function addFeature(rig, face, eyes, style, hex) {
  const dark = new THREE.Color(hex).multiplyScalar(0.55);
  if (style === 'mask') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.294, 0.302, 0.13, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1846, roughness: 0.45, side: THREE.DoubleSide }));
    band.position.y = 0.7; rig.add(band);
    for (const e of eyes) { e.material = white; e.position.z = 0.3; }
  } else if (style === 'sprout') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x3fbf5a })); stem.position.y = 1.03; rig.add(stem);
    for (const sx of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: 0x57d96b, roughness: 0.4 })); leaf.scale.set(1, 0.35, 0.55); leaf.position.set(sx * 0.055, 1.08, 0); leaf.rotation.z = sx * 0.5; rig.add(leaf); }
  } else if (style === 'shine') {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.13, 4, 10), m); a.scale.z = 0.3; a.position.set(-0.15, 0.8, 0.225); a.rotation.set(-0.3, -0.55, 0.55); rig.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), m); b.scale.z = 0.3; b.position.set(-0.205, 0.66, 0.205); b.rotation.y = -0.75; rig.add(b);
  } else if (style === 'seam') {
    const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20, y = 0.18 + t * 0.4, a = 0.55 + Math.sin(t * Math.PI) * 0.28; const r = 0.316 - Math.abs(t - 0.5) * 0.02; pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r)); }
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.018, 6), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5 })); rig.add(seam);
  } else if (style === 'antenna') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.97, 0), new THREE.Vector3(0.03, 1.1, -0.02), new THREE.Vector3(0.08, 1.2, -0.04)]);
    rig.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x2a1846 })));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0xffd23f, roughness: 0.3, clearcoat: 1 })); ball.position.set(0.08, 1.22, -0.04); rig.add(ball);
  } else if (style === 'cheeks') {
    for (const sx of [-1, 1]) { const ck = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0xff6f9f, transparent: true, opacity: 0.8 })); ck.position.set(sx * 0.15, 0.645, 0.262); ck.rotation.y = sx * 0.55; rig.add(ck); }
  }
}

export function makeBean(hex, scale = 1, skin = null, style = null) {
  skin = skin || DEFAULT_SKINS[1];
  style = style || BEAN_STYLE;
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const bodyMat = beanMaterial(0xffffff); bodyMat.map = skinTexture(hex, skin);
  const limbMat = beanMaterial(limbColor(hex, skin));
  const body = new THREE.Mesh(geo.body, bodyMat); body.position.y = LEG; body.rotation.y = Math.PI; body.castShadow = true; rig.add(body); // texture seam at the back
  // two flat pill eyes sitting flush on the body
  const face = new THREE.Group(); face.position.set(0, LEG + BR + BH * 0.78, 0); rig.add(face);
  // the emoji face is painted into the body texture (front = middle of the texture)
  const eyes = [];
  // arms hang from shoulder pivots so they can reach out procedurally
  const arms = [-1, 1].map((sx) => { const pv = new THREE.Group(); pv.position.set(sx * 0.29, LEG + BR + BH * 0.55, 0.0); pv.rotation.z = sx * 0.45; const a = new THREE.Mesh(geo.arm, limbMat); a.position.y = -0.12; a.castShadow = true; pv.add(a); rig.add(pv); return pv; });
  const feet = [-1, 1].map((sx) => { const f = new THREE.Mesh(geo.foot, limbMat); f.position.set(sx * 0.12, 0.1, 0.0); f.castShadow = true; rig.add(f); return f; });
  addFeature(rig, face, eyes, style, hex);
  const sh = new THREE.Mesh(geo.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; g.add(sh);
  g.scale.setScalar(scale);
  g.userData = { kind: 'bean', rig, body, bodyMat, limbMat, belly: { material: limbMat }, skin, face, eyes, arms, feet, phase: Math.random() * 6 };
  return g;
}
const limbColor = (hex, skin) => (skin.pattern === 'split' || skin.pattern === 'dip' || skin.pattern === 'gradient') ? skin.accent : hex;

// accessories per minigame role
function bombBackpack() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0x2a1846, roughness: 0.25, clearcoat: 1 })); b.castShadow = true; g.add(b);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 12), M(0xffd23f)); cap.position.y = 0.16; g.add(cap);
  const fuse = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), M(0xc8a27a, 0.9)); fuse.position.set(0.05, 0.2, 0); g.add(fuse);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 })); spark.position.set(0.11, 0.21, 0); g.add(spark);
  g.position.set(0, 0.62, -0.31); g.userData.spark = spark;
  return g;
}
function bigBomb() {
  const g = bombBackpack(); g.scale.setScalar(1.6); g.position.set(0, 1.55, 0); return g;
}
function flippers(hex) {
  const g = new THREE.Group();
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), M(new THREE.Color(hex).offsetHSL(0, 0, -0.15), 0.4)); fin.position.set(0, 0.88, -0.02); fin.rotation.x = -0.2; fin.scale.z = 0.3; g.add(fin);
  return g;
}
function beanie() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffffff, 0.8)); h.position.y = 0.8; g.add(h);
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), M(0xff5fa8, 0.9)); p.position.y = 1.04; g.add(p);
  return g;
}
function minicannon() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.34, 14), M(0x5c5470, 0.35, { metalness: 0.4 })); tube.rotation.x = Math.PI / 2 - 0.7; tube.position.set(0.22, 0.3, 0.18); tube.castShadow = true; g.add(tube);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 14), M(0xffd23f)); wheel.rotation.y = Math.PI / 2; wheel.position.set(0.3, 0.08, 0.1); g.add(wheel);
  return g;
}

function jellyLauncher(hot) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.95), M(hot ? 0xff8a3d : 0x9a7cff, 0.5)); base.position.y = 0.3; base.castShadow = true; g.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.99), M(0xffffff, 0.4)); trim.position.y = 0.42; g.add(trim);
  for (const [x, z] of [[-0.38, 0.32], [0.38, 0.32], [-0.38, -0.32], [0.38, -0.32]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 18), M(0xffd23f, 0.4)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.17, z); w.castShadow = true; g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), M(0x2a1846)); hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.17, z); g.add(hub); }
  const pivot = new THREE.Group(); pivot.position.set(0, 0.48, -0.2); g.add(pivot);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), M(0xfff1e0, 0.6)); arm.position.z = 0.42; arm.castShadow = true; pivot.add(arm);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0xfff1e0, 0.6, { side: THREE.DoubleSide })); cup.position.set(0, 0.05, 0.85); pivot.add(cup);
  const jelly = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshPhysicalMaterial({ color: hot ? 0xff5a2a : 0xff5fa8, roughness: 0.1, transmission: 0.3, clearcoat: 1, emissive: hot ? 0xff3300 : 0x000000, emissiveIntensity: hot ? 0.6 : 0 })); jelly.position.set(0, 0.1, 0.85); pivot.add(jelly);
  pivot.rotation.x = -0.6;
  g.userData = { kind: 'launcher', pivot, jelly, shoot: 0 };
  return g;
}

function fireSprite() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xff8a00, emissiveIntensity: 2.2, roughness: 0.4 })); core.position.y = 0.7; g.add(core);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = 0.7; g.add(halo);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), black); e.position.set(sx * 0.07, 0.76, 0.17); g.add(e); }
  // immolation ring = real ANpi area (220)
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  const sh = new THREE.Mesh(geo.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; g.add(sh);
  g.userData = { kind: 'sprite', core, halo, ring };
  return g;
}

function lighthouse() {
  const g = new THREE.Group();
  const stripes = document.createElement('canvas'); stripes.width = 8; stripes.height = 64; const x = stripes.getContext('2d');
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff4d6d'; x.fillRect(0, i * 16, 8, 16); }
  const t = new THREE.CanvasTexture(stripes); t.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 1.7, 24), M(0xffffff, 0.5, { map: t })); body.position.y = 0.85; body.castShadow = true; g.add(body);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), M(0xffffff, 0.4)); deck.position.y = 1.72; g.add(deck);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff2030, emissiveIntensity: 2.5 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), lampMat); lamp.position.y = 1.98; g.add(lamp);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 20), M(0xff4d6d, 0.4)); roof.position.y = 2.36; g.add(roof);
  const eye = new THREE.Group(); eye.position.y = 1.98; g.add(eye);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 24, 1, true), beamMat); beam.rotation.z = Math.PI / 2; beam.position.x = 3.5; beam.rotation.y = 0; eye.add(beam);
  eye.rotation.z = -0.28;
  g.userData = { kind: 'lighthouse', lampMat, beamMat, eye, beam };
  return g;
}

function steamroller(hex = 0xff8a3d) {
  const g = new THREE.Group();
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24), M(0xb9b4c9, 0.3, { metalness: 0.5 })); roller.rotation.x = Math.PI / 2; roller.position.set(0.45, 0.42, 0); roller.castShadow = true; g.add(roller);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.03, 6, 30), M(0xffd23f)); stripe.position.set(0.45, 0.42, 0); g.add(stripe);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.9), M(hex, 0.4)); cab.position.set(-0.25, 0.55, 0); cab.castShadow = true; g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.8), M(0xffffff)); roof.position.set(-0.3, 1.05, 0); g.add(roof);
  for (const z of [-0.36, 0.36]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42), M(0xffffff)); p.position.set(-0.3, 0.86, z); g.add(p); }
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.95, 16), M(0x2a1846)); wheel.rotation.x = Math.PI / 2; wheel.position.set(-0.5, 0.22, 0); g.add(wheel);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35), M(0x2a1846)); stack.position.set(-0.05, 1.0, 0.2); g.add(stack);
  for (const z of [-0.18, 0.18]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), white); e.position.set(0.13, 0.72, z); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), black); p.position.set(0.2, 0.72, z); g.add(p); }
  g.userData = { kind: 'roller', roller, stripe };
  return g;
}

function cannonTower() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.9, 28), M(0xfff1e0, 0.5)); base.position.y = 0.45; base.castShadow = true; g.add(base);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 8, 32), M(0xff5fa8)); band.rotation.x = Math.PI / 2; band.position.y = 0.9; g.add(band);
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), M(0xfff1e0, 0.5)); const a = i / 8 * Math.PI * 2; c.position.set(Math.cos(a) * 0.62, 1.0, Math.sin(a) * 0.62); g.add(c); }
  const head = new THREE.Group(); head.position.y = 1.1; g.add(head);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 18), M(0x5c5470, 0.3, { metalness: 0.5 })); barrel.rotation.z = -Math.PI / 2 + 0.6; barrel.position.x = 0.25; barrel.position.y = 0.2; barrel.castShadow = true; head.add(barrel);
  g.userData = { kind: 'tower', head };
  return g;
}

export function makeActor(u) {
  const sk = resolveSkin(u.color);
  const hex = sk.main || BEAN_COLORS[u.color] || '#ffffff';
  const makeBean_ = makeBean;
  const makeBean2 = (h, sc) => makeBean_(h, sc, sk);
  switch (u.type) {
    case 'opeo': return makeBean2(hex, BEAN_SCALE);
    case 'ngsp': { const b = makeBean2(hex, BEAN_SCALE); const bp = bombBackpack(); b.userData.rig.add(bp); b.userData.spark = bp.userData.spark; return b; }
    case 'hmtm': { const b = makeBean2(hex, BEAN_SCALE); const bomb = bigBomb(); bomb.visible = false; b.add(bomb); b.userData.bomb = bomb; b.userData.spark = bomb.userData.spark; return b; }
    case 'nsea': { const b = makeBean2(hex, BEAN_SCALE); return b; }
    case 'nmrl': { const b = makeBean2(hex, BEAN_SCALE); return b; }
    case 'ncat': return jellyLauncher(false);
    case 'ocat': return jellyLauncher(true);
    case 'ewsp': return fireSprite();
    case 'uzg1': return lighthouse();
    case 'hmtt': return steamroller();
    case 'hctw': return cannonTower();
    case 'ncop': return null;
    default: {
      if (LOOKS[u.type]) return LOOKS[u.type](u, { makeBean: makeBean2, hex, THREE, M });
      if (u.isBean || (u.owner >= 1 && u.owner <= 8)) return makeBean2(hex, BEAN_SCALE);
      return genericCritter(u);
    }
  }
}

// Fallback look for any unit type without a custom one: a candy creature sized by its
// collision, coloured from its type id. Buildings become rounded candy towers.
const hashCol = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return new THREE.Color().setHSL((h % 360) / 360, 0.65, 0.58); };
export function genericCritter(u) {
  const g = new THREE.Group(); const col = hashCol(u.type);
  const r = Math.max(0.14, Math.min(0.8, (u.coll || 16) * S * 1.1));
  if ((u.baseSpeed || 0) === 0 && !u.fly) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, r * 2.4, 20), M(col, 0.4)); body.position.y = r * 1.2; body.castShadow = true; g.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(col.clone().offsetHSL(0, 0, -0.15), 0.4)); cap.position.y = r * 2.4; g.add(cap);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 1 })); body.scale.set(1, 0.85, 1.15); body.position.y = r * 0.9 + (u.fly ? 0.6 : 0); body.castShadow = true; g.add(body);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 10, 8), white); e.position.set(sx * r * 0.38, r * 1.15 + (u.fly ? 0.6 : 0), r * 0.85); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.11, 8, 6), black); p.position.set(sx * r * 0.38, r * 1.15 + (u.fly ? 0.6 : 0), r * 1.02); g.add(p); }
    const sh = new THREE.Mesh(geo.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.scale.setScalar(r / 0.3); g.add(sh);
  }
  g.userData = { kind: 'critter' };
  return g;
}

export function applySkin(obj, hex, skin) {
  const d = obj.userData; if (!d.bodyMat) return;
  d.bodyMat.map = skinTexture(hex, skin); d.bodyMat.needsUpdate = true;
  d.limbMat.color.set(limbColor(hex, skin));
}

// per-frame animation of a bean from sim state
export function animateBean(obj, u, t, dt) {
  const d = obj.userData; if (d.kind !== 'bean') return;
  const speed = Math.hypot(u.vx || 0, u.vy || 0);
  const walking = speed > 5;
  d.walkT = (d.walkT || 0) + dt * (walking ? 10 + speed / 40 : 0);
  d.phase += dt;
  const w = d.walkT, k = walking ? 1 : 0;
  d.blend = (d.blend ?? 0) + (k - (d.blend ?? 0)) * Math.min(1, dt * 10);
  const b = d.blend;
  const hop = Math.abs(Math.sin(w)) * 0.09 * b;
  const breathe = Math.sin(d.phase * 2.4) * 0.025 * (1 - b);
  d.rig.position.y = hop;
  d.body.position.y = 0;
  d.rig.rotation.z = Math.sin(w) * 0.12 * b;
  d.rig.rotation.x = 0;
  const sq = 1 + breathe - Math.cos(w * 2) * 0.04 * b;
  d.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  d.feet[0].position.z = Math.sin(w) * 0.1 * b; d.feet[1].position.z = -Math.sin(w) * 0.1 * b;
  d.feet[0].position.y = 0.1 + Math.max(0, Math.sin(w)) * 0.06 * b; d.feet[1].position.y = 0.1 + Math.max(0, -Math.sin(w)) * 0.06 * b;
  d.arms[0].rotation.x = Math.sin(w) * 0.9 * b; d.arms[1].rotation.x = -Math.sin(w) * 0.9 * b;
  d.arms[0].rotation.z = -0.45 - (d.cheer || 0) * 2.2; d.arms[1].rotation.z = 0.45 + (d.cheer || 0) * 2.2; d.arms[0].rotation.y = 0; d.arms[1].rotation.y = 0;
  // blink
  const blink = (d.phase % 3.7) < 0.12 ? 0.15 : 1;

  if (d.spark) { const s = 0.8 + Math.random() * 0.7; d.spark.scale.setScalar(s); }
}
