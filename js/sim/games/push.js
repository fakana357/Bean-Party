// Push the Ogre-Bean — based on "Push the Ogre" (Triggers_Events[19]).
// Kept: the square yard, one circle per player (Push_1..8), beans start 200 from
// their circle towards the centre, the slow invulnerable ogre in the middle,
// it breaks wind every 6-8 s after a 1 s warning (a 192-radius cloud 64 behind it
// for 1.5 s), a bean that dies loses its circle, race scoring, 90 s timer.
// Polished: pushing is explicit (walk into the ogre to shove it, opposite pushes
// cancel), the ogre faces where it is shoved so its cloud lands on the pushers,
// the cloud spot is shown during the warning, touching the cloud = out, and after
// a goal the circle is used up and the ogre pops back to the middle.
import { P_ENEMY, center, polar, dist, angleTo, inRect } from '../engine.js';

export const PUSH = { R: 48, goal: 130, bump: 170, lean: 60, friction: 1.6, max: 260, gasR: 192, gasBack: 64, warn: 1, cloud: 1.5 };

export default {
  num: 19, id: 'push', title: 'Push the Ogre-Bean', orig: 'Push the Ogre',
  subtitle: 'Get the ogre to your circle!', arena: 'push_the_ogre', rect: 'Push_the_Ogre', kind: 'race',
  hint: 'Walk into the ogre to push it into YOUR circle. When it shakes, get away from its stinky cloud!',
  objective: 'Push the ogre into YOUR circle — one winner. Out: the ogre’s stink cloud catches you.',
  clip: ['Push_the_Ogre', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Push_the_Ogre);
    const P = (v.push = { ogre: null, circles: {}, gas: null, warn: null });
    const reg = (i) => R['Push_' + i];

    const init = G.trig('PushInitialization', function* () {
      G.music('human1');
      v.ante = 8;
      P.circles = {}; P.gas = null; P.warn = null;
      w.restoreDestructables(R.Push_the_Ogre);
      G.forPlaying((i) => {
        const c = center(reg(i));
        P.circles[i] = w.create('ncop', i, c);
        G.bean('hkni', i, polar(c, 200, angleTo(c, C())), { speed: 350 });
      });
      G.addKey(w.ofType('hkni'));
      const o = (P.ogre = w.create('nogr', P_ENEMY, C(), 270));
      o.acquire = 0; o.paused = true; o.invuln = true; o.mvx = 0; o.mvy = 0;
      G.cameraBounds(R.Push_the_Ogre);
      G.startTimer(90, 'Time Left');
      G.say('Push the Ogre-Bean', 'Get the ogre to your circle!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.PushPhysics.enable(); T.PushDeath.enable();
      T.PushGas.execute();
      yield 2;
      G.forBots(() => T.PushAI.enable());
    });

    // a bean that drops out loses its circle
    G.trig('PushDeath', function* (e) {
      const c = P.circles[e.unit.owner]; if (c) { w.remove(c); delete P.circles[e.unit.owner]; }
    }, { cond: (e) => e.unit.type === 'hkni' }).on('death');

    // shoving, goals and the gas cloud
    G.trig('PushPhysics', function* () {
      const o = P.ogre; if (!o || !o.alive) return;
      const dt = 0.025;
      // run into the ogre to bump it (impulse by how fast you hit it); leaning on it barely moves it
      let fx = 0, fy = 0;
      const beans = G.beans();
      for (const b of beans) {
        const d = dist(b, o);
        const touching = d <= PUSH.R + b.coll + 8 && d > 1;
        if (!touching) { b.ogreTouch = false; continue; }
        const nx = (o.x - b.x) / d, ny = (o.y - b.y) / d;
        const s = ((b.vx || 0) * nx + (b.vy || 0) * ny) / Math.max(1, b.speed);
        const str = b.pushStr ??= w.rng.real(0.85, 1.2);
        if (!b.ogreTouch && s > 0.4 && w.t - (b.lastBump || -9) > 0.3) {
          b.lastBump = w.t;
          o.mvx += nx * PUSH.bump * s * str; o.mvy += ny * PUSH.bump * s * str;
          w.emit({ k: 'ring', x: (o.x + b.x) / 2, y: (o.y + b.y) / 2, r: 30, color: 0xffffff, dur: 0.25 });
          w.emit({ k: 'sfx', id: 'bump' });
        }
        b.ogreTouch = true;
        if (s > 0.25) { fx += nx * s * str; fy += ny * s * str; }
      }
      o.mvx += fx * PUSH.lean * dt; o.mvy += fy * PUSH.lean * dt;
      const fr = Math.exp(-PUSH.friction * dt); o.mvx *= fr; o.mvy *= fr;
      const sp = Math.hypot(o.mvx, o.mvy);
      if (sp > PUSH.max) { o.mvx *= PUSH.max / sp; o.mvy *= PUSH.max / sp; }
      if (sp > 4) {
        const nx = o.x + o.mvx * dt, ny = o.y + o.mvy * dt;
        if (w.grid.walkable(nx, ny, PUSH.R)) { o.x = nx; o.y = ny; }
        else if (w.grid.walkable(nx, o.y, PUSH.R)) { o.x = nx; o.mvy = 0; }
        else if (w.grid.walkable(o.x, ny, PUSH.R)) { o.y = ny; o.mvx = 0; }
        else { o.mvx = 0; o.mvy = 0; }
        const want = Math.atan2(o.mvy, o.mvx) * 180 / Math.PI; let dd = ((want - o.facing) % 360 + 540) % 360 - 180; o.facing += Math.max(-6, Math.min(6, dd));
        o.vx = o.mvx; o.vy = o.mvy; o.moving = true;
      } else { o.vx = 0; o.vy = 0; o.moving = false; }
      // goal: the ogre stands in a circle whose owner is still in
      for (const [slot, c] of Object.entries(P.circles)) {
        if (dist(o, center(reg(+slot))) > PUSH.goal) continue;
        const k = G.keyOf(+slot).find((u) => u.alive); if (!k) continue;
        w.remove(c); delete P.circles[slot];
        w.emit({ k: 'boom', x: o.x, y: o.y, r: 0 });
        o.x = C().x; o.y = C().y; o.mvx = 0; o.mvy = 0; w.emit({ k: 'teleport', x: o.x, y: o.y });
        v.focus = k; T.RaceFinish.execute();
        break;
      }
      // the cloud
      if (P.gas && w.t <= P.gas.end) for (const b of G.beans()) if (dist(b, P.gas) <= PUSH.gasR) { w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'Pee-yew!', color: '#9be36b' }); w.kill(b); }
    }).every(0.025);

    G.trig('PushGas', function* () {
      const round = G.round();
      for (;;) {
        yield w.rng.real(6, 8);
        if (G.round() !== round || !T.PushPhysics.enabled) return;
        const o = P.ogre;
        const p = polar(o, PUSH.gasBack, o.facing + 180);
        P.warn = p;
        w.emit({ k: 'warn', id: 'pushgas', x: p.x, y: p.y, r: PUSH.gasR, dur: PUSH.warn, hot: true });
        w.emit({ k: 'text3d', x: o.x, y: o.y + 30, text: '!!', color: '#9be36b' });
        yield PUSH.warn;
        if (G.round() !== round || !T.PushPhysics.enabled) return;
        P.gas = { x: p.x, y: p.y, end: w.t + PUSH.cloud };
        w.emit({ k: 'lava', x: p.x, y: p.y, r: PUSH.gasR, dur: PUSH.cloud });
        w.emit({ k: 'sfx', id: 'splat' });
        yield PUSH.cloud;
        P.gas = null; P.warn = null;
      }
    });

    // bots: get behind the ogre (on the far side from their circle) and shove it home; flee the gas
    G.trig('PushAI', function* () {
      const o = P.ogre; if (!o) return;
      const danger = P.gas || P.warn;
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (danger && dist(u, danger) < PUSH.gasR + 90) {
            const p = polar(danger, PUSH.gasR + 160, angleTo(danger, u));
            w.issue(u, { type: 'move', x: p.x, y: p.y }); u.botWait = w.t + w.rng.real(0.2, 1.8); continue;
          }
          if (w.t < (u.botWait ??= w.t + w.rng.real(0, 1))) continue;
          const c = P.circles[i]; if (!c) continue;
          // the ogre is heading for somebody else's circle and ours is far: some bots just wait for a better chance
          if ((u.patience ??= w.rng.real(0, 1)) < 0.5) {
            let other = 1e9; for (const [sl, cc] of Object.entries(P.circles)) if (+sl !== i) other = Math.min(other, dist(o, cc));
            if (dist(o, c) > other + 260 && w.rng.next() < 0.97) { if (dist(u, o) < 150) w.issue(u, { type: 'move', ...polar(o, 220, angleTo(o, c)) }); continue; }
          }
          const home = angleTo(o, c);
          const behind = polar(o, PUSH.R + u.coll + 6, home + 180);
          const dB = dist(u, behind);
          const run = polar(o, PUSH.R + u.coll + (u.runup ??= w.rng.real(70, 130)), home + 180);
          if (u.charging) {
            if (u.ogreTouch || w.t > u.charging) { u.charging = 0; u.backoff = w.t + w.rng.real(0.15, 0.5); }
            else { w.issue(u, { type: 'move', x: o.x, y: o.y }); continue; }
          }
          if (u.backoff && w.t < u.backoff + 1.5) {
            if (dist(u, run) < 24 && w.t > u.backoff) { u.backoff = 0; u.charging = w.t + 1; const a = home + w.rng.real(-6, 6) * (u.sloppy ??= w.rng.real(0.5, 1.5)); w.issue(u, { type: 'move', ...polar(o, 0, 0) }); continue; }
            w.issue(u, { type: 'move', x: run.x, y: run.y }); continue;
          }
          if (dB < 30) { u.backoff = w.t; continue; }
          // walk around the ogre instead of through it
          const side = ((angleTo(o, u) - (home + 180)) % 360 + 540) % 360 - 180;
          let tgt = behind;
          if (Math.abs(side) > 50 && dist(u, o) < 260) tgt = polar(o, PUSH.R + u.coll + 70, angleTo(o, u) - Math.sign(side) * 50);
          w.issue(u, { type: 'move', x: tgt.x, y: tgt.y });
        }
      });
    }).every(0.1);

    return init;
  },
};
