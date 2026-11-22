// Looks for the creatures that still used the generic critter: candy-toy
// primitives, facing +z, ~0.01 scene units per WC3 unit.

const glossy = (THREE, c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, ...extra });
const mesh = (THREE, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const eyes = (THREE, g, y, z, sx, r = 0.06, col = 0xffffff) => {
  for (const s of [-1, 1]) {
    g.add(mesh(THREE, new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: col }), s * sx, y, z));
    g.add(mesh(THREE, new THREE.SphereGeometry(r * 0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1030 }), s * sx, y, z + r * 0.7));
  }
};
const sized = (g, u, base) => { const k = Math.max(0.6, Math.min(3, (u.coll || base) / base)); g.scale.setScalar(k); return g; };
const legs = (THREE, g, mat, w, d, h, r = 0.05) => {
  for (const [x, z] of [[-w, -d], [w, -d], [-w, d], [w, d]]) g.add(mesh(THREE, new THREE.CylinderGeometry(r, r, h, 8), mat, x, h / 2, z));
};
const done = (g) => { g.userData = { ...(g.userData || {}), kind: 'critter' }; return g; };

// four-legged candy beast (kodo, bear, fel beast…)
function beast(THREE, { body, belly, horn, size = 1, ears = false, tusk = false }) {
  const g = new THREE.Group(), m = glossy(THREE, body);
  const b = mesh(THREE, new THREE.SphereGeometry(0.32 * size, 20, 14), m, 0, 0.42 * size, 0); b.scale.set(0.9, 0.8, 1.25); g.add(b);
  const h = mesh(THREE, new THREE.SphereGeometry(0.2 * size, 16, 12), m, 0, 0.55 * size, 0.36 * size); g.add(h);
  if (belly) { const bl = mesh(THREE, new THREE.SphereGeometry(0.24 * size, 16, 10), glossy(THREE, belly), 0, 0.33 * size, 0.08 * size); bl.scale.set(0.9, 0.7, 1.1); g.add(bl); }
  legs(THREE, g, m, 0.16 * size, 0.2 * size, 0.26 * size, 0.06 * size);
  if (horn) for (const s of [-1, 1]) { const c = mesh(THREE, new THREE.ConeGeometry(0.05 * size, 0.18 * size, 10), glossy(THREE, horn), s * 0.11 * size, 0.74 * size, 0.4 * size); c.rotation.x = 0.4; g.add(c); }
  if (ears) for (const s of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.07 * size, 10, 8), m, s * 0.15 * size, 0.73 * size, 0.3 * size));
  if (tusk) for (const s of [-1, 1]) { const t = mesh(THREE, new THREE.ConeGeometry(0.03 * size, 0.12 * size, 8), glossy(THREE, 0xfff6e0), s * 0.08 * size, 0.46 * size, 0.52 * size); t.rotation.x = -0.6; g.add(t); }
  eyes(THREE, g, 0.62 * size, 0.53 * size, 0.08 * size, 0.045 * size);
  return g;
}

function tower(THREE, top, cap, cannon) {
  const g = new THREE.Group();
  g.add(mesh(THREE, new THREE.CylinderGeometry(0.34, 0.42, 1.1, 18), glossy(THREE, 0xfff2f8), 0, 0.55, 0));
  for (let i = 0; i < 4; i++) { const st = mesh(THREE, new THREE.TorusGeometry(0.39 - i * 0.02, 0.035, 8, 24), glossy(THREE, top), 0, 0.15 + i * 0.27, 0); st.rotation.x = Math.PI / 2; g.add(st); }
  g.add(mesh(THREE, new THREE.ConeGeometry(0.46, 0.45, 18), glossy(THREE, cap), 0, 1.33, 0));
  if (cannon) { const c = mesh(THREE, new THREE.CylinderGeometry(0.09, 0.11, 0.5, 12), glossy(THREE, 0x3a2a5c), 0, 1.0, 0.35); c.rotation.x = Math.PI / 2.4; g.add(c); }
  else g.add(mesh(THREE, new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.8 }), 0, 1.62, 0));
  return g;
}

function boat(THREE, hull, sail) {
  const g = new THREE.Group();
  const h = mesh(THREE, new THREE.CylinderGeometry(0.3, 0.2, 0.9, 16, 1, false, 0, Math.PI), glossy(THREE, hull), 0, 0.2, 0);
  h.rotation.set(Math.PI / 2, 0, Math.PI); g.add(h);
  const deck = mesh(THREE, new THREE.BoxGeometry(0.58, 0.04, 0.85), glossy(THREE, 0xffe6b8), 0, 0.2, 0); g.add(deck);
  g.add(mesh(THREE, new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), glossy(THREE, 0xc98b4a), 0, 0.65, 0));
  const s = mesh(THREE, new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ color: sail, side: THREE.DoubleSide, roughness: 0.6 }), 0, 0.72, 0.03);
  g.add(s);
  return g;
}

export const LOOKS = {
  // Polymorph: a fluffy candy-floss sheep
  nshe: (u, { THREE }) => {
    const g = new THREE.Group(), wool = glossy(THREE, 0xfff4fb, { roughness: 0.8, clearcoat: 0 });
    for (const [x, y, z, r] of [[0, 0.3, 0, 0.2], [0.12, 0.32, 0.08, 0.14], [-0.12, 0.32, 0.08, 0.14], [0.1, 0.3, -0.12, 0.14], [-0.1, 0.3, -0.12, 0.14], [0, 0.42, 0, 0.14]]) g.add(mesh(THREE, new THREE.SphereGeometry(r, 12, 10), wool, x, y, z));
    g.add(mesh(THREE, new THREE.SphereGeometry(0.1, 12, 10), glossy(THREE, 0x3a2a5c), 0, 0.36, 0.22));
    legs(THREE, g, glossy(THREE, 0x3a2a5c), 0.09, 0.08, 0.16, 0.03);
    eyes(THREE, g, 0.39, 0.3, 0.04, 0.025);
    return done(g);
  },
  // Kodo Bean: piglets to eat, and the gummy kid
  npig: (u, { THREE }) => {
    const g = beast(THREE, { body: 0xff9ec7, belly: 0xffc4dd, size: 0.55, ears: true });
    g.add(mesh(THREE, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), glossy(THREE, 0xff6fa8), 0, 0.29, 0.31)).rotation.x = Math.PI / 2;
    return done(g);
  },
  nvlk: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x57e36b, { transmission: 0.3, thickness: 0.4 });
    const b = mesh(THREE, new THREE.SphereGeometry(0.18, 16, 12), m, 0, 0.24, 0); b.scale.set(1, 1.15, 0.9); g.add(b);
    g.add(mesh(THREE, new THREE.SphereGeometry(0.13, 16, 12), m, 0, 0.5, 0));
    for (const s of [-1, 1]) { g.add(mesh(THREE, new THREE.SphereGeometry(0.05, 8, 6), m, s * 0.1, 0.62, 0)); g.add(mesh(THREE, new THREE.SphereGeometry(0.06, 8, 6), m, s * 0.16, 0.28, 0.02)); g.add(mesh(THREE, new THREE.SphereGeometry(0.07, 8, 6), m, s * 0.08, 0.07, 0)); }
    eyes(THREE, g, 0.53, 0.11, 0.05, 0.03);
    return done(g);
  },
  // Raider: gummy bear, candy bird, balloon
  edcm: (u, { THREE }) => done(beast(THREE, { body: 0xb5651d, belly: 0xffc98b, size: 1.1, ears: true })),
  ehip: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x57c8ff);
    const b = mesh(THREE, new THREE.SphereGeometry(0.2, 16, 12), m, 0, 0.9, 0); b.scale.set(0.9, 0.8, 1.3); g.add(b);
    g.add(mesh(THREE, new THREE.SphereGeometry(0.13, 12, 10), m, 0, 1.02, 0.22));
    const beak = mesh(THREE, new THREE.ConeGeometry(0.05, 0.14, 8), glossy(THREE, 0xffd23f), 0, 1.0, 0.38); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const s of [-1, 1]) { const wg = mesh(THREE, new THREE.BoxGeometry(0.45, 0.03, 0.22), glossy(THREE, 0xff5fa8), s * 0.3, 0.95, 0); wg.rotation.z = s * 0.3; g.add(wg); }
    eyes(THREE, g, 1.06, 0.31, 0.06, 0.035);
    return done(g);
  },
  nzep: (u, { THREE }) => {
    const g = new THREE.Group();
    const bal = mesh(THREE, new THREE.SphereGeometry(0.45, 20, 16), glossy(THREE, 0xff5fa8), 0, 1.35, 0); bal.scale.set(1, 1.1, 1); g.add(bal);
    for (let i = 0; i < 6; i++) { const st = mesh(THREE, new THREE.SphereGeometry(0.455, 20, 16, i * Math.PI / 3, Math.PI / 12), glossy(THREE, 0xffffff), 0, 1.35, 0); st.scale.set(1, 1.1, 1); g.add(st); }
    g.add(mesh(THREE, new THREE.CylinderGeometry(0.22, 0.18, 0.22, 14), glossy(THREE, 0xc98b4a, { clearcoat: 0, roughness: 0.8 }), 0, 0.45, 0));
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) g.add(mesh(THREE, new THREE.CylinderGeometry(0.008, 0.008, 0.55), glossy(THREE, 0x5a3a20), x, 0.8, z));
    return done(g);
  },
  // Treant: a walking lollipop tree
  efon: (u, { THREE }) => {
    const g = new THREE.Group();
    g.add(mesh(THREE, new THREE.CylinderGeometry(0.1, 0.14, 0.7, 12), glossy(THREE, 0xc98b4a), 0, 0.42, 0));
    for (const [x, y, z, r, c] of [[0, 1.05, 0, 0.38, 0x57e36b], [0.22, 0.95, 0.1, 0.22, 0x8af07a], [-0.22, 0.98, -0.05, 0.24, 0x3fcf5a]]) g.add(mesh(THREE, new THREE.SphereGeometry(r, 16, 12), glossy(THREE, c), x, y, z));
    for (const s of [-1, 1]) { const a = mesh(THREE, new THREE.CylinderGeometry(0.035, 0.05, 0.45, 8), glossy(THREE, 0xa8703a), s * 0.2, 0.55, 0.05); a.rotation.z = s * 0.9; g.add(a); }
    legs(THREE, g, glossy(THREE, 0xa8703a), 0.07, 0, 0.12, 0.06);
    eyes(THREE, g, 0.62, 0.12, 0.05, 0.04, 0xfff2a8);
    return done(sized(g, u, 32));
  },
  // Skeleton: a white sugar skeleton (tinted when a spellbreaker takes it over)
  uske: (u, { THREE }) => {
    const g = new THREE.Group(), bone = glossy(THREE, 0xfffaf0);
    g.add(mesh(THREE, new THREE.SphereGeometry(0.15, 16, 12), bone, 0, 0.62, 0));
    g.add(mesh(THREE, new THREE.BoxGeometry(0.16, 0.06, 0.08), bone, 0, 0.52, 0.04));
    for (let i = 0; i < 3; i++) { const r = mesh(THREE, new THREE.TorusGeometry(0.1 - i * 0.012, 0.018, 6, 16), bone, 0, 0.42 - i * 0.07, 0); r.rotation.x = Math.PI / 2; g.add(r); }
    g.add(mesh(THREE, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), bone, 0, 0.33, -0.02));
    for (const s of [-1, 1]) { g.add(mesh(THREE, new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), bone, s * 0.06, 0.1, 0)); const a = mesh(THREE, new THREE.CylinderGeometry(0.018, 0.018, 0.25, 6), bone, s * 0.15, 0.38, 0.03); a.rotation.z = s * 0.3; g.add(a); }
    for (const s of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9b4dff }), s * 0.055, 0.64, 0.12));
    const tint = mesh(THREE, new THREE.TorusGeometry(0.2, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 0.02, 0); tint.rotation.x = Math.PI / 2; tint.visible = false; g.add(tint);
    g.userData = { kind: 'critter' };
    // gold ring under a skeleton a spellbreaker has taken over
    const upd = () => { tint.visible = u.owner >= 1 && u.owner <= 8; };
    g.traverse((o) => { if (o.isMesh && o !== tint) o.onBeforeRender = upd; });
    return g;
  },
  // Stampede: kodo beasts and their keeper
  okod: (u, { THREE }) => done(sized(beast(THREE, { body: 0x9b4dff, belly: 0xd9b8ff, horn: 0xfff2a8, size: 1.3 }), u, 32)),
  Nbst: (u, { THREE }) => {
    const g = beast(THREE, { body: 0xff8a3d, belly: 0xffd0a8, horn: 0xffffff, size: 1.2, ears: true });
    return done(g);
  },
  // Push the Ogre: a big lime gumdrop ogre
  nogr: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x9be36b);
    const b = mesh(THREE, new THREE.SphereGeometry(0.42, 22, 16), m, 0, 0.48, 0); b.scale.set(1.05, 1.1, 0.95); g.add(b);
    g.add(mesh(THREE, new THREE.SphereGeometry(0.3, 18, 14), glossy(THREE, 0xc9f5a8), 0, 0.38, 0.17));
    for (const s of [-1, 1]) {
      const t = mesh(THREE, new THREE.ConeGeometry(0.045, 0.14, 8), glossy(THREE, 0xfff6e0), s * 0.12, 0.62, 0.38); g.add(t);
      g.add(mesh(THREE, new THREE.SphereGeometry(0.13, 12, 10), m, s * 0.45, 0.5, 0.05));
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.09, 0.1, 0.18, 10), m, s * 0.18, 0.08, 0));
    }
    eyes(THREE, g, 0.78, 0.32, 0.11, 0.06);
    return done(sized(g, u, 48));
  },
  // Skull of Gul'Bean monsters
  nsgt: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x6a2bd6);
    const b = mesh(THREE, new THREE.SphereGeometry(0.3, 18, 14), m, 0, 0.32, -0.08); b.scale.set(1, 0.75, 1.2); g.add(b);
    g.add(mesh(THREE, new THREE.SphereGeometry(0.17, 14, 10), m, 0, 0.32, 0.3));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const l = mesh(THREE, new THREE.CylinderGeometry(0.025, 0.025, 0.5), glossy(THREE, 0xffd23f), s * 0.3, 0.2, -0.2 + i * 0.13); l.rotation.z = s * 1.0; g.add(l); }
    eyes(THREE, g, 0.4, 0.43, 0.07, 0.05, 0xff4d6d);
    return done(g);
  },
  nsln: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x57e36b, { transmission: 0.4, thickness: 0.6 });
    const b = mesh(THREE, new THREE.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), m, 0, 0.05, 0); b.scale.set(1.1, 1, 1.1); g.add(b);
    for (const [x, z] of [[0.3, 0.1], [-0.25, -0.2], [0.05, 0.32]]) g.add(mesh(THREE, new THREE.SphereGeometry(0.08, 10, 8), m, x, 0.04, z));
    eyes(THREE, g, 0.3, 0.27, 0.09, 0.055);
    return done(g);
  },
  nfgb: (u, { THREE }) => done(beast(THREE, { body: 0xff4d6d, belly: 0xffb3c4, horn: 0x3a2a5c, size: 1.1, tusk: true })),
  ndqv: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0xff5fa8);
    g.add(mesh(THREE, new THREE.ConeGeometry(0.24, 0.6, 18), m, 0, 0.3, 0));
    g.add(mesh(THREE, new THREE.SphereGeometry(0.15, 14, 12), m, 0, 0.7, 0));
    for (const s of [-1, 1]) { const h = mesh(THREE, new THREE.ConeGeometry(0.04, 0.16, 8), glossy(THREE, 0x3a2a5c), s * 0.08, 0.86, 0); h.rotation.z = -s * 0.4; g.add(h); const wg = mesh(THREE, new THREE.ConeGeometry(0.16, 0.36, 3), glossy(THREE, 0x9b4dff), s * 0.24, 0.55, -0.1); wg.rotation.z = s * 1.2; g.add(wg); }
    eyes(THREE, g, 0.73, 0.12, 0.055, 0.035);
    return done(g);
  },
  ndqn: (u, { THREE }) => {
    const g = LOOKS.ndqv(u, { THREE });
    g.scale.setScalar(0.8);
    g.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0xff5fa8) { o.material = o.material.clone(); o.material.color.set(0xff9ec7); } });
    return g;
  },
  // Plague: the hooded acolyte (patient zero)
  uaco: (u, { THREE }) => {
    const g = new THREE.Group();
    g.add(mesh(THREE, new THREE.ConeGeometry(0.22, 0.62, 18), glossy(THREE, 0x3a2a5c), 0, 0.31, 0));
    g.add(mesh(THREE, new THREE.SphereGeometry(0.11, 12, 10), glossy(THREE, 0x9be36b), 0, 0.56, 0.06));
    const hood = mesh(THREE, new THREE.ConeGeometry(0.14, 0.22, 14), glossy(THREE, 0x2a1c44), 0, 0.68, -0.02); g.add(hood);
    eyes(THREE, g, 0.58, 0.15, 0.04, 0.025, 0xc8ff57);
    return done(g);
  },
  // Spellbreaker: candy scarab beetles
  ucs1: (u, { THREE }) => {
    const g = new THREE.Group(), m = glossy(THREE, 0x2fd3c4, { metalness: 0.3 });
    const b = mesh(THREE, new THREE.SphereGeometry(0.2, 16, 12), m, 0, 0.16, 0); b.scale.set(1, 0.6, 1.25); g.add(b);
    g.add(mesh(THREE, new THREE.BoxGeometry(0.01, 0.13, 0.48), glossy(THREE, 0x0f6f66), 0, 0.2, 0));
    g.add(mesh(THREE, new THREE.SphereGeometry(0.09, 12, 10), glossy(THREE, 0x0f6f66), 0, 0.15, 0.25));
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const l = mesh(THREE, new THREE.CylinderGeometry(0.015, 0.015, 0.2), glossy(THREE, 0x0f6f66), s * 0.2, 0.08, -0.1 + i * 0.1); l.rotation.z = s * 1.1; g.add(l); }
    eyes(THREE, g, 0.2, 0.32, 0.04, 0.03);
    return done(sized(g, u, 16));
  },
  // Tides of Darkness: the player boats and the orc ships
  hshy: (u, { THREE }) => done(boat(THREE, 0x57c8ff, 0xffffff)),
  oshy: (u, { THREE }) => { const g = boat(THREE, 0x6a2bd6, 0xff4d6d); g.scale.setScalar(1.25); return done(g); },
  // Flight of the Bean-men: candy towers
  hgtw: (u, { THREE }) => done(tower(THREE, 0xff5fa8, 0xff5fa8, false)),
  h003: (u, { THREE }) => done(tower(THREE, 0x57c8ff, 0x3a2a5c, true)),
};
