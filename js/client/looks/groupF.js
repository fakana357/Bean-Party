// Group F looks: Doggy Bean Hell, Ancient Bean-isher, Bean Breaker Blood, Dune Bean Distress,
// Tides of Bean-ness, Flight of the Bean-men, Bean Tower Defense.
const ball = (THREE, M, r, col, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(col, 0.4)); m.position.set(x, y, z); return m; };
const box = (THREE, M, w, h, d, col, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(col, 0.5)); m.position.set(x, y, z); m.castShadow = true; return m; };
function boat(THREE, M, hull, sail) {
  const g = new THREE.Group();
  g.add(box(THREE, M, 0.55, 0.22, 1.1, hull, 0, 0.11, 0));
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 4), M(hull, 0.5)); bow.rotation.x = Math.PI / 2; bow.position.set(0, 0.11, 0.72); g.add(bow);
  g.add(box(THREE, M, 0.04, 0.7, 0.04, 0xfff1e0, 0, 0.55, -0.1));
  g.add(box(THREE, M, 0.5, 0.4, 0.02, sail, 0, 0.6, -0.08));
  return g;
}

export const LOOKS = {
  // meat wagon -> candy cart with a jelly catapult
  umtw: (u, { THREE, M }) => {
    const g = new THREE.Group();
    g.add(box(THREE, M, 0.7, 0.35, 0.9, 0x8f5bd6, 0, 0.35, 0));
    for (const x of [-0.38, 0.38]) for (const z of [-0.3, 0.3]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14), M(0x2a1846)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.16, z); g.add(w); }
    g.add(ball(THREE, M, 0.16, 0xff5fa8, 0, 0.66, 0.2));
    return g;
  },
  // the stick (Doggy Hell)
  n000: (u, { THREE, M, makeBean, hex }) => {
    if (u.role !== 'stick') return makeBean(hex);
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), M(0xc98a4b, 0.6)); s.rotation.z = Math.PI / 2; s.position.y = 0.9; g.add(s);
    return g;
  },
  // Ancient Bean-isher items share the bean's type: cloaks and the dud
  Nbrn: (u, { THREE, M, makeBean, hex }) => {
    if (!u.role) return makeBean(hex);
    const g = new THREE.Group();
    if (u.role === 'cloak') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 16), M(0x7a3cff, 0.4)); c.position.y = 0.25; g.add(c); g.add(ball(THREE, M, 0.08, 0xffd23f, 0, 0.5, 0)); }
    else { g.add(box(THREE, M, 0.3, 0.3, 0.3, 0x9a9a9a, 0, 0.15, 0)); g.add(ball(THREE, M, 0.06, 0xff4d6d, 0, 0.36, 0)); }
    return g;
  },
  // ancient protector -> giant gumdrop tree
  etrp: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.0, 12), M(0x9b6a3c, 0.6)); trunk.position.y = 0.5; trunk.castShadow = true; g.add(trunk);
    g.add(ball(THREE, M, 0.7, 0x57e36b, 0, 1.4, 0));
    for (const s of [-1, 1]) g.add(ball(THREE, M, 0.1, 0xff4d6d, s * 0.22, 1.3, 0.62));
    return g;
  },
  // demon gate -> swirly candy portal
  ndmg: (u, { THREE }) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 10, 32), new THREE.MeshStandardMaterial({ color: 0xff5fa8, emissive: 0x7a3cff, emissiveIntensity: 1.2 }));
    ring.position.y = 0.6; g.add(ring);
    return g;
  },
  // Dune: barricades share the worm bean's type
  ndwm: (u, { THREE, M, makeBean, hex }) => {
    if (u.role !== 'barricade') return makeBean(hex);
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) g.add(box(THREE, M, 0.12, 0.5, 0.12, k % 2 ? 0xffffff : 0xff4d6d, (k - 1) * 0.2, 0.25, 0));
    g.add(box(THREE, M, 0.6, 0.08, 0.08, 0xffd23f, 0, 0.42, 0));
    return g;
  },
  // wildkin -> fluffy owl-bear plush
  nowb: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const b = ball(THREE, M, 0.5, 0xc9a2ff, 0, 0.55, 0); b.castShadow = true; g.add(b);
    for (const s of [-1, 1]) { g.add(ball(THREE, M, 0.13, 0xffffff, s * 0.18, 0.75, 0.42)); g.add(ball(THREE, M, 0.06, 0x2a1846, s * 0.18, 0.75, 0.53)); }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 8), M(0xffb13d)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.6, 0.55); g.add(beak);
    return g;
  },
  // Tides: the bean rides a candy boat; orc boats are sour green
  hdes: (u, { THREE, M, makeBean, hex }) => { const b = makeBean(hex); const s = boat(THREE, M, 0xfff1e0, 0xff8fc0); s.scale.setScalar(1.3); b.add(s); return b; },
  odes: (u, { THREE, M }) => { const g = boat(THREE, M, 0x4f8a3c, 0x9be15d); g.scale.setScalar(1.4); g.add(ball(THREE, M, 0.18, 0x9be15d, 0, 0.45, 0.2)); return g; },
  // Tower: archmage -> wizard gumdrop with a starry hat; water elemental -> blue jelly
  Hamg: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const b = ball(THREE, M, 0.32, 0x7fd3ff, 0, 0.35, 0); b.castShadow = true; g.add(b);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 16), M(0x5b3cc4, 0.4)); hat.position.y = 0.88; g.add(hat);
    g.add(ball(THREE, M, 0.06, 0xffd23f, 0, 1.18, 0));
    return g;
  },
  hwat: (u, { THREE }) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0x58b8ef, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }));
    b.position.y = 0.42; b.scale.set(1, 1.2, 1); g.add(b);
    return g;
  },
};

export const THEMES = {
  doggy_hell: { a: '#ff9a6b', b: '#ffb48f', line: '#ff4d4d', side: '#c7443a', bump: [0xffd23f, 0xff6b3d], deep: '#6b1f1f', night: 0 },
  tides_of_darkness: { a: '#58b8ef', b: '#7fd3ff', line: '#ffffff', side: '#2f7ab8', bump: [0xfff1e0, 0xff8fc0], deep: '#1d4f80', night: 0 },
  flight_of_the_footmen: { a: '#4b4b8c', b: '#5b5ba0', line: '#ffd23f', side: '#33336b', bump: [0x7fd3ff, 0xff8fc0], deep: '#1a1a40', night: 1 },
  spell_breaker_blood: { a: '#7a2f5c', b: '#8c3b6b', line: '#ff5fa8', side: '#5a1f44', bump: [0x9be15d, 0xffd23f], deep: '#2e0f24', night: 1 },
};
