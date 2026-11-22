// Group G looks: Bean Battle for the Bottle (bottle), Clandes-Bean Kitty (treat vial),
// Bean Sea Combat (a bean riding a candy boat).
const ball = (THREE, M, r, col, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(col, 0.4)); m.position.set(x, y, z); return m; };

function bottle(THREE, M, glass, cork) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshPhysicalMaterial({ color: glass, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85, emissive: glass, emissiveIntensity: 0.35 }));
  body.position.y = 0.22; body.castShadow = true; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 12), M(glass, 0.2)); neck.position.y = 0.46; g.add(neck);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 12), M(cork, 0.6)); c.position.y = 0.56; g.add(c);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.32, 28), new THREE.MeshBasicMaterial({ color: glass, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; g.add(glow);
  body.onBeforeRender = () => { const t = performance.now() / 1000; g.rotation.y = t * 1.5; glow.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 3)); };
  g.userData = { kind: 'prop' };
  return g;
}

export const LOOKS = {
  // mana bottle: a glowing blue candy potion
  Hart: (u, { THREE, M }) => bottle(THREE, M, 0x5fb8ff, 0xc98a4b),
  // the treat: a golden honey vial
  Huth: (u, { THREE, M }) => bottle(THREE, M, 0xffc83d, 0xff5fa8),
  // sea combat: the player's bean standing in a little candy boat
  hbsh: (u, { makeBean, hex, THREE, M }) => {
    const b = makeBean(hex);
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.3, 0.24, 20, 1, true), M(0xfff1e0, 0.45, { side: THREE.DoubleSide }));
    hull.scale.set(0.8, 1, 1.4); hull.position.y = 0.1; hull.castShadow = true; b.add(hull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 28), M(0xff5fa8, 0.4)); rim.rotation.x = Math.PI / 2; rim.scale.set(0.8, 1.4, 1); rim.position.y = 0.22; b.add(rim);
    const bow = ball(THREE, M, 0.07, 0xffd23f, 0, 0.24, 0.62); b.add(bow);
    return b;
  },
};

export const THEMES = {};
