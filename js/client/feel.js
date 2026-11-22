// "Feel" layer: purely visual soft-body physics on top of the 1:1 simulation.
// The sim decides where a bean is; this layer decides how it *looks* getting
// there: springy inertia, leaning, squash on contact, beans pressing against
// each other and walls without clipping, and arms that reach out to touch.
import * as THREE from 'three';
import { S } from './scene.js';

const K = 240, C = 2 * Math.sqrt(K) * 0.8;         // follow spring (slightly under-damped = jiggle)
const MAX_OFF = 0.16;                               // max visual offset from sim position
const SQ_K = 320, SQ_C = 10;                        // squash spring
const v3 = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), q = new THREE.Quaternion(), qBase = new THREE.Quaternion();

export function initFeel(a, x, z) {
  a.f = { x, z, vx: 0, vz: 0, pvx: 0, pvz: 0, ax: 0, az: 0, sq: 0, sqv: 0, lean: [0, 0], reach: [0, 0], reachDir: [new THREE.Vector3(), new THREE.Vector3()], kick: [0, 0] };
}

export function impulse(beans, x, z, radius, strength) {
  for (const b of beans) {
    const f = b.a.f; if (!f) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
    if (d > radius || d < 1e-4) continue;
    const k = strength * (1 - d / radius);
    f.vx += (dx / d) * k; f.vz += (dz / d) * k; f.sqv -= k * 3;
  }
}

// beans: [{ a, obj, u, tx, tz, r }]
export function solveFeel(beans, grid, dt) {
  if (dt <= 0) return;
  // 1) springy follow of the sim position
  for (const b of beans) {
    const f = b.a.f;
    const ax = (b.tx - f.x) * K - f.vx * C, az = (b.tz - f.z) * K - f.vz * C;
    f.vx += ax * dt; f.vz += az * dt; f.x += f.vx * dt; f.z += f.vz * dt;
    const ox = f.x - b.tx, oz = f.z - b.tz, ol = Math.hypot(ox, oz);
    if (ol > MAX_OFF) { f.x = b.tx + ox / ol * MAX_OFF; f.z = b.tz + oz / ol * MAX_OFF; }
    b.contacts = [];
  }
  // 2) soft contacts between beans (no visual interpenetration)
  for (let it = 0; it < 3; it++) for (let i = 0; i < beans.length; i++) for (let j = i + 1; j < beans.length; j++) {
    const A = beans[i], B = beans[j], fa = A.a.f, fb = B.a.f;
    const dx = fb.x - fa.x, dz = fb.z - fa.z, d = Math.hypot(dx, dz) || 1e-4, min = A.r + B.r;
    if (d < min + 0.22) {
      const nx = dx / d, nz = dz / d;
      if (it === 0) { A.contacts.push({ x: fb.x, z: fb.z, d: min + 0.22 - d, n: [nx, nz] }); B.contacts.push({ x: fa.x, z: fa.z, d: min + 0.22 - d, n: [-nx, -nz] }); }
      if (d < min) {
        const push = (min - d) * 0.5;
        fa.x -= nx * push; fa.z -= nz * push; fb.x += nx * push; fb.z += nz * push;
        // exchange a little momentum so bumps feel bouncy
        const rel = (fb.vx - fa.vx) * nx + (fb.vz - fa.vz) * nz;
        if (rel < 0) { const j2 = -rel * 0.6; fa.vx -= nx * j2; fa.vz -= nz * j2; fb.vx += nx * j2; fb.vz += nz * j2; fa.sqv -= j2 * 4; fb.sqv -= j2 * 4; }
      }
    }
  }
  // 3) walls: keep the visual body out of padded walls using the real clearance map
  for (const b of beans) {
    const f = b.a.f, wx = f.x / S, wy = -f.z / S;
    const c = grid.clearance(wx, wy) * S, want = b.r * 0.92;
    const e = 6, gx = (grid.clearance(wx + e, wy) - grid.clearance(wx - e, wy)), gy = (grid.clearance(wx, wy + e) - grid.clearance(wx, wy - e));
    const gl = Math.hypot(gx, gy) || 1, nx = gx / gl, nz = -gy / gl;
    if (c < want + 0.18 && gl > 0.01) b.contacts.push({ x: f.x - nx * (c + 0.05), z: f.z - nz * (c + 0.05), d: want + 0.18 - c, n: [-nx, -nz], wall: true });
    if (c < want && gl > 0.01) {
      const push = Math.min(want - c, 0.12); f.x += nx * push; f.z += nz * push;
      const into = f.vx * -nx + f.vz * -nz; if (into > 0) { f.vx += nx * into * 1.5; f.vz += nz * into * 1.5; f.sqv -= into * 3; }
    }
  }
  // 4) pose: lean into acceleration, squash & stretch, reaching arms
  for (const b of beans) {
    const f = b.a.f, o = b.obj, d = o.userData;
    o.position.x = f.x; o.position.z = f.z;
    const svx = (b.u.vx || 0) * S, svz = -(b.u.vy || 0) * S;
    const accx = (svx - f.pvx) / dt, accz = (svz - f.pvz) / dt; f.pvx = svx; f.pvz = svz;
    f.ax += (accx - f.ax) * Math.min(1, dt * 12); f.az += (accz - f.az) * Math.min(1, dt * 12);
    const yaw = o.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const fwdA = f.ax * fx + f.az * fz, sideA = f.ax * fz - f.az * fx;
    const spd = Math.hypot(svx, svz);
    const offx = f.x - b.tx, offz = f.z - b.tz; // spring lag gives a jiggle when stopping
    const lagF = offx * fx + offz * fz, lagS = offx * fz - offz * fx;
    const tgtLeanX = THREE.MathUtils.clamp(fwdA * 0.025 + spd * 0.06 - lagF * 2.2, -0.4, 0.45);
    const tgtLeanZ = THREE.MathUtils.clamp(-sideA * 0.02 + lagS * 2.2, -0.35, 0.35);
    f.lean[0] += (tgtLeanX - f.lean[0]) * Math.min(1, dt * 14); f.lean[1] += (tgtLeanZ - f.lean[1]) * Math.min(1, dt * 14);
    d.rig.rotation.x += f.lean[0]; d.rig.rotation.z += f.lean[1];
    // squash spring (impulses come from bumps, starts and stops)
    f.sqv += (-f.sq * SQ_K - f.sqv * SQ_C) * dt - Math.abs(fwdA) * 0.002;
    f.sq += f.sqv * dt; f.sq = THREE.MathUtils.clamp(f.sq, -0.25, 0.25);
    const s = 1 + f.sq; d.body.scale.y *= s; d.body.scale.x /= Math.sqrt(s); d.body.scale.z /= Math.sqrt(s);
    // contact squish: flatten toward the nearest contact
    let best = null; for (const c of b.contacts) if (!best || c.d > best.d) best = c;
    // arms: reach for whatever we're touching
    for (let side = 0; side < 2; side++) {
      const pv = d.arms[side]; if (!pv) continue;
      let want = 0;
      if (best) {
        // contact direction in bean-local space
        v3.set(best.x - f.x, 0, best.z - f.z); const L = v3.length() || 1; v3.multiplyScalar(1 / L);
        const lx = v3.x * Math.cos(-yaw) + v3.z * Math.sin(-yaw), lz = -v3.x * Math.sin(-yaw) + v3.z * Math.cos(-yaw);
        const sideSign = side === 0 ? -1 : 1;
        const facing = lx * sideSign * 0.8 + lz * 0.6; // how much this arm faces the contact
        if (facing > -0.1) { want = THREE.MathUtils.clamp(best.d / 0.22, 0, 1) * THREE.MathUtils.clamp(facing + 0.4, 0, 1); f.reachDir[side].set(lx, -0.25 + (best.wall ? 0.05 : 0.15), lz).normalize(); }
      }
      f.reach[side] += (want - f.reach[side]) * Math.min(1, dt * 10);
      if (f.reach[side] > 0.01) {
        qBase.copy(pv.quaternion);
        q.setFromUnitVectors(down, f.reachDir[side]);
        pv.quaternion.copy(qBase).slerp(q, f.reach[side]);
      }
    }
  }
}
