// Group D looks: Blinky the Bean, A-Bean-inations, Sleepy Beantime, Nature's Bean Circle, Skull of Gul'Bean.
const ball = (THREE, M, r, col, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(col, 0.4)); m.position.set(x, y, z); return m; };

// Nature's Circle forms: the player's bean plus a readable form accessory
function form(kind) {
  return (u, { makeBean, hex, THREE, M }) => {
    const b = makeBean(hex);
    const g = new THREE.Group(); g.position.y = 0.55; (b.userData.rig || b).add(g);
    if (kind === 'bear') { for (const s of [-1, 1]) g.add(ball(THREE, M, 0.09, 0x8b5a2b, s * 0.17, 0.12, 0)); }
    if (kind === 'quill') for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 8), M(0xfff1e0, 0.5)); const a = (i / 6 - 0.5) * 2.2; c.position.set(Math.sin(a) * 0.15, 0.05 + Math.cos(a) * 0.1, -0.12); c.rotation.z = -a; g.add(c); }
    if (kind === 'hawk') for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), M(0x7fd3ff, 0.4)); w.position.set(s * 0.3, -0.1, -0.05); w.rotation.z = s * 0.3; g.add(w); }
    if (kind === 'druid') { const l = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), M(0x57e36b, 0.5)); l.position.y = 0.12; g.add(l); }
    return b;
  };
}

export const LOOKS = {
  // gummy polar bear
  nplb: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = ball(THREE, M, 0.38, 0xf4f8ff, 0, 0.4, 0); body.scale.set(1, 0.85, 1.3); body.castShadow = true; g.add(body);
    g.add(ball(THREE, M, 0.24, 0xf4f8ff, 0, 0.62, 0.42));
    for (const s of [-1, 1]) { g.add(ball(THREE, M, 0.08, 0xffb3d1, s * 0.16, 0.84, 0.38)); g.add(ball(THREE, M, 0.04, 0x2a1846, s * 0.09, 0.68, 0.64)); }
    g.add(ball(THREE, M, 0.05, 0x2a1846, 0, 0.6, 0.66));
    return g;
  },
  // abombination: a wobbly lime jelly bomb with a fuse
  u000: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0x9be15d, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.9 }));
    body.position.y = 0.45; body.castShadow = true; g.add(body);
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25), M(0x5c5470)); fuse.position.y = 0.98; g.add(fuse);
    g.add(ball(THREE, M, 0.07, 0xff6b3d, 0, 1.12, 0));
    for (const s of [-1, 1]) g.add(ball(THREE, M, 0.07, 0x2a1846, s * 0.15, 0.6, 0.4));
    return g;
  },
  // sleepy rock golem: a stack of pastel toy blocks with a nightcap
  ngst: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), M(0xb8a9e8, 0.6)); a.position.y = 0.4; a.castShadow = true; g.add(a);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), M(0xd8ccff, 0.6)); h.position.y = 0.95; g.add(h);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 16), M(0x5b7cff, 0.5)); cap.position.set(0, 1.4, 0); cap.rotation.z = 0.4; g.add(cap);
    g.add(ball(THREE, M, 0.08, 0xffffff, -0.2, 1.55, 0));
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), M(0x2a1846)); e.position.set(s * 0.12, 1.0, 0.23); g.add(e); }
    return g;
  },
  edoc: form('druid'), ngz1: form('bear'), nqb1: form('quill'), nwe2: form('hawk'),
  // Skull: the candy skull itself, or a floor button
  ngme: (u, { THREE, M }) => {
    const g = new THREE.Group();
    if (u.role === 'button') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.08, 28), M(0xfff1e0, 0.5)); base.position.y = 0.04; g.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 28), M(0xff4d6d, 0.4)); top.position.y = 0.14; g.add(top);
      return g;
    }
    const s = ball(THREE, M, 0.28, 0xfff6e0, 0, 1.25, 0); s.scale.set(1, 0.9, 1); g.add(s);
    for (const x of [-1, 1]) g.add(ball(THREE, M, 0.07, 0x7a3cff, x * 0.1, 1.27, 0.23));
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f })); glow.rotation.x = Math.PI / 2; glow.position.y = 0.9; g.add(glow);
    return g;
  },
};

export const THEMES = {
  sleepy_time: { a: '#3b3f7a', b: '#4a4f92', line: '#9fb4ff', side: '#2b2d5c', bump: [0xbfe3ff, 0xffd23f], deep: '#161838', night: 1 },
  nature_circle: { a: '#5fbf7a', b: '#7fd394', line: '#ffd23f', side: '#3f8f57', bump: [0xff8fc0, 0x7fd3ff], deep: '#24563a', night: 1 },
  skull: { a: '#6b4b8c', b: '#7d5ca0', line: '#ffd23f', side: '#4a3166', bump: [0x9be15d, 0xff6b8b], deep: '#231538', night: 1 },
};
