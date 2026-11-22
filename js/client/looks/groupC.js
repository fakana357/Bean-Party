// Group C looks: Obey Archibean, Bean-Whack-a-Fiend, Horse Bean Race, The Beanquerade, Crabby Bean Island.
// ~0.01 scene units per WC3 unit, +y up, facing +z.
import * as THREE from 'three';

const eyes = (g, M, r, y, z, s = 1) => {
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 10, 8), M(0xffffff, 0.3)); e.position.set(sx * r, y, z); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), M(0x1a1030, 0.3)); p.position.set(sx * r, y, z + 0.05 * s); g.add(p);
  }
};

function crab(M, col, s) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 20, 14), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 1 }));
  body.scale.set(1.3, 0.55, 1); body.position.y = 0.22 * s; body.castShadow = true; g.add(body);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.32 * s, 6), M(col)); leg.rotation.z = sx * 1.0; leg.position.set(sx * 0.42 * s, 0.12 * s, (k - 1) * 0.15 * s); g.add(leg); }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 12, 10), M(0xffffff, 0.3)); claw.scale.set(1, 0.7, 1.4); claw.position.set(sx * 0.3 * s, 0.25 * s, 0.38 * s); g.add(claw);
  }
  eyes(g, M, 0.1 * s, 0.42 * s, 0.18 * s, s);
  return g;
}

export const LOOKS = {
  // Archibean: a big candy DJ machine with horns
  Uwar: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.3, 24), M(0x8a4dff, 0.35)); body.position.y = 0.65; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), M(0xb27bff, 0.3)); head.position.y = 1.45; g.add(head);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 12), M(0xffd23f)); h.position.set(sx * 0.32, 1.95, 0); h.rotation.z = -sx * 0.4; g.add(h); }
    eyes(g, M, 0.17, 1.5, 0.45, 1.6);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 32), M(0xff5fa8)); band.rotation.x = Math.PI / 2; band.position.y = 1.0; g.add(band);
    return g;
  },
  // coloured floor pad (Obey pads, Horse finish circles)
  ncp2: (u, { THREE, M }) => {
    const g = new THREE.Group(); const col = u.padColor ?? 0xfff1e0;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.05, 28), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.4 }));
    pad.position.y = 0.025; g.add(pad);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 28), M(0xffffff)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; g.add(rim);
    return g;
  },
  // fiend hole: a chocolate mound with a dark hole
  ucrm: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.12, 10, 24), M(0x7a4a2e, 0.6)); mound.rotation.x = Math.PI / 2; mound.position.y = 0.05; g.add(mound);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), M(0x2a1630, 0.9)); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.02; g.add(hole);
    return g;
  },
  // popped-up fiend: a green gumdrop critter with antennae
  ucry: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x57d96b, roughness: 0.25, clearcoat: 1 }));
    body.scale.set(1, 1.3, 1); body.position.y = 0.3; body.castShadow = true; g.add(body);
    eyes(g, M, 0.11, 0.5, 0.25);
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), M(0x1a1030)); a.position.set(sx * 0.12, 0.8, 0); a.rotation.z = -sx * 0.4; g.add(a); const t = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0xff5fa8)); t.position.set(sx * 0.18, 0.95, 0); g.add(t); }
    return g;
  },
  // vampire den: a dark candy coffin pad
  otrb: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.05, 28), new THREE.MeshStandardMaterial({ color: 0x5b2a6e, emissive: 0x8a3dbf, emissiveIntensity: 0.3 })); pad.position.y = 0.025; g.add(pad);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 28), M(0xff5fa8)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; g.add(rim);
    const coffin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.4), M(0x2a1630)); coffin.position.set(0, 0.08, -0.4); g.add(coffin);
    return g;
  },
  // villager: a little marshmallow with a hat
  nvl2: (u, { THREE, M }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.4, 16), M(0xfff1e0, 0.5)); body.position.y = 0.2; body.castShadow = true; g.add(body);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 14), M(0xff8a3d)); hat.position.y = 0.5; g.add(hat);
    eyes(g, M, 0.06, 0.32, 0.16, 0.7);
    return g;
  },
  nscb: (u, { M }) => crab(M, 0xff6b6b, 0.9),
  nsc2: (u, { M }) => crab(M, 0xff8a3d, 1.1),
  nsc3: (u, { M }) => crab(M, 0xc74b86, 1.7),
};

export const THEMES = {
  salamander_sizzle: { a: '#ffb36b', b: '#ffd0a0', line: '#ff6a3d', side: '#d9532f', bump: [0x57d96b, 0xffd23f], deep: '#7a2e1f', night: 0 },
  obey_archimonde: { a: '#7b5bc4', b: '#9478d6', line: '#ffd23f', side: '#4a3390', bump: [0xff5fa8, 0x2ee6c5], deep: '#2a1a5c', night: 0 },
  whack_a_fiend: { a: '#a8e68a', b: '#c6f2ad', line: '#7a4a2e', side: '#5ca84d', bump: [0xff7fc8, 0xffd23f], deep: '#2f6a36', night: 0 },
  horse_race: { a: '#9fe38a', b: '#c1f2ad', line: '#ffffff', side: '#4da85a', bump: [0xff8a3d, 0x3d8bff], deep: '#2f7a46', night: 0 },
  masquerade: { a: '#3b2d73', b: '#4b3a8a', line: '#ff5fa8', side: '#2a1f55', bump: [0xff4d5e, 0xffd23f], deep: '#140c30', night: 1 },
  crab_island: { a: '#ffe3a8', b: '#fff0c8', line: '#ffb85c', side: '#e8b060', bump: [0x2ee6c5, 0xff6b6b], deep: '#2a7fbf', night: 0 },
};
