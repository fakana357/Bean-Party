// Group A looks (Rat Maze, Clean Crew, Covert Kitty, Polymorph Ring, Tauren
// Tragedy, Bomb Baldwin, Dark Forest). Simple candy/toy primitives.
// ~0.01 scene units per WC3 unit, +y up, facing +z.

const eyes = (THREE, g, y, z, sx, r = 0.07) => {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(s * sx, y, z); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1030 })); p.position.set(s * sx, y, z + r * 0.7); g.add(p);
  }
};

// the same wind-up doll for Baldwins and look-alikes (they must look identical)
function peasant(u, { THREE, M }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.34, 16), M(0x8fd3ff, 0.5)); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), M(0xffd9b3, 0.5)); head.position.y = 0.47; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.14, 16), M(0xc98b4a, 0.6)); hat.position.y = 0.6; g.add(hat);
  eyes(THREE, g, 0.48, 0.1, 0.05, 0.03);
  const key = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 16), M(0xffd23f, 0.3)); key.position.set(0, 0.25, -0.2); g.add(key);
  return g;
}

export const LOOKS = {
  // props: cheese wedge (Rat Maze) and goo tiles (Clean Crew)
  hcth: (u, { THREE, M }) => {
    const g = new THREE.Group();
    if (u.prop === 'goo') {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0x9b4dff, emissive: 0x4a1a99, emissiveIntensity: 0.4, roughness: 0.2 }));
      d.position.y = 0.015; g.add(d);
      return g;
    }
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 3, 1, false, 0, Math.PI * 2), M(0xffd23f, 0.4)); w.position.y = 0.2; w.castShadow = true; g.add(w);
    for (const [x, z] of [[0.08, 0.05], [-0.06, -0.08]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0xe0a800, 0.6)); h.position.set(x, 0.31, z); g.add(h); }
    return g;
  },
  // wind-up toy spider
  nspr: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M(0x3a2a5c, 0.3)); body.scale.set(1, 0.7, 1.2); body.position.y = 0.22; body.castShadow = true; g.add(body);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36), M(0xff5fa8, 0.4)); leg.position.set(s * 0.22, 0.14, -0.15 + i * 0.1); leg.rotation.z = s * 1.0; g.add(leg);
    }
    eyes(THREE, g, 0.3, 0.2, 0.07, 0.05);
    return g;
  },
  // cleaning robot with a mop
  hmpr: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 18), M(0xffffff, 0.3)); body.position.y = 0.3; body.castShadow = true; g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x57c8ff, 0.2)); dome.position.y = 0.55; g.add(dome);
    const mop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), M(0xc98b4a)); mop.position.set(0.28, 0.35, 0.1); mop.rotation.z = 0.3; g.add(mop);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), M(0x9fe8ff)); head.position.set(0.38, 0.03, 0.1); g.add(head);
    eyes(THREE, g, 0.45, 0.19, 0.08, 0.04);
    return g;
  },
  // patrol robot guard
  nbal: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), M(0x5c5470, 0.4, { metalness: 0.4 })); body.position.y = 0.6; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.4), M(0x7a6f96, 0.4)); head.position.y = 1.15; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.05), new THREE.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff2030, emissiveIntensity: 2 })); visor.position.set(0, 1.17, 0.21); g.add(visor);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3), M(0x2a1846)); leg.position.set(s * 0.18, 0.15, 0); g.add(leg); }
    return g;
  },
  // big fuzzy gummy monster
  nsqa: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0x57e36b, roughness: 0.3, clearcoat: 1 })); body.scale.set(1, 1.1, 0.9); body.position.y = 0.55; body.castShadow = true; g.add(body);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M(0x3fbf55)); arm.position.set(s * 0.5, 0.5, 0.1); g.add(arm); }
    eyes(THREE, g, 0.8, 0.4, 0.15, 0.1);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 16, Math.PI), M(0x1a1030)); mouth.position.set(0, 0.6, 0.43); mouth.rotation.z = Math.PI; g.add(mouth);
    return g;
  },
  // toy soldier
  hfoo: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.34, 12), M(0xff4d5e, 0.5)); body.position.y = 0.3; body.castShadow = true; g.add(body);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), M(0x2a3a7a)); legs.position.y = 0.07; g.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), M(0xffd9b3)); head.position.y = 0.55; g.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 12), M(0x1a1030)); hat.position.y = 0.72; g.add(hat);
    return g;
  },
  // toy fort
  hbar: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), M(0xfff1e0, 0.5)); base.position.y = 0.4; base.castShadow = true; g.add(base);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 14), M(0xff8fc2, 0.4)); t.position.set(x, 0.6, z); g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.4, 14), M(0x5c3fa8)); r.position.set(x, 1.4, z); g.add(r);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), M(0x8a5a2b)); door.position.set(0, 0.25, 1.11); g.add(door);
    return g;
  },
  h000: peasant,
  hpea: peasant,
  // gingerbread farm house
  hhou: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), M(0xc98b4a, 0.6)); base.position.y = 0.35; base.castShadow = true; g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 4), M(0xffffff, 0.4)); roof.position.y = 1.0; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.05), M(0xff5fa8)); door.position.set(0, 0.2, 0.56); g.add(door);
    return g;
  },
  // jelly blob (walk-catcher)
  uabo: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0x9b4dff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.85 })); body.scale.set(1, 0.85, 1); body.position.y = 0.4; body.castShadow = true; g.add(body);
    eyes(THREE, g, 0.6, 0.38, 0.14, 0.09);
    return g;
  },
  // candy bat (fly-catcher)
  ugar: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), M(0x2a1846, 0.3)); body.position.y = 0.9; body.castShadow = true; g.add(body);
    for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 3), M(0xff4d5e, 0.4)); wing.position.set(s * 0.28, 0.92, 0); wing.rotation.z = s * Math.PI / 2; g.add(wing); }
    eyes(THREE, g, 0.95, 0.13, 0.06, 0.04);
    return g;
  },
};

export const THEMES = {
  dark_forest: { a: '#2f2a5c', b: '#3b3570', line: '#8a6cff', side: '#2b2350', bump: [0x6b5bb0, 0x2ee6c5], deep: '#15102e', night: 1 },
  covert_kitty: { a: '#2c3a5c', b: '#34446a', line: '#7fb2ff', side: '#232f4d', bump: [0x4b6bb0, 0x8a6cff], deep: '#121a2e', night: 1 },
};
