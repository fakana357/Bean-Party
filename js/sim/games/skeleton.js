// The Skele-Bean Sonata — based on "The Skeleton Sonata" (Triggers_Events[16]).
// Kept: the night-time crypt room, beans start 100-300 from the centre, from 6 s
// every 2.5 s a grave bursts into 3 skeletons that hunt the beans, a new grave
// appears somewhere else, beans can dispel skeletons around them.
// Polished: a 90 s timer ends the round; the next grave is shown as a filling warning ring; touching a
// skeleton = out; dispel is Space with a clear 5 s cooldown instead of hidden mana.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const SKEL = { touch: 22, dispelR: 170, cool: 7, every: 2, speed: 250, max: 40 };

function dispel(G, u) {
  const w = G.w;
  if (w.t < (u.dispelAt || 0)) return false;
  u.dispelAt = w.t + SKEL.cool;
  w.emit({ k: 'ring', x: u.x, y: u.y, r: SKEL.dispelR, color: 0xfff2a8, dur: 0.5 });
  w.emit({ k: 'sfx', id: 'zap' });
  for (const s of w.ofType('uske')) if (dist(s, u) <= SKEL.dispelR) { w.emit({ k: 'impact', x: s.x, y: s.y, type: 'uske', r: 30 }); w.kill(s); }
  w.spawn(function* () { yield SKEL.cool; if (u.alive) w.emit({ k: 'text3d', x: u.x, y: u.y, text: 'Ready', color: '#fff2a8' }); });
  return true;
}

export default {
  num: 16, id: 'skeleton', title: 'The Skele-Bean Sonata', orig: 'The Skeleton Sonata',
  subtitle: 'Survive as long as possible!', arena: 'skeleton_sonata', rect: 'Skeleton_Sonata', kind: 'survival',
  hint: 'Graves burst into skeletons. Space = dispel skeletons around you (7 s cooldown). Touch = out!',
  objective: 'Be the last bean standing. Out: a skeleton touches you.',
  clip: ['Skeleton_Sonata', 64, 64],
  action(G, u) { return dispel(G, u); },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Skeleton_Sonata);
    const K = (v.skeleton = { grave: null });

    function newGrave() {
      let p = null;
      for (let k = 0; k < 20; k++) {
        p = w.randomIn(R.Skeleton_Sonata);
        if (w.grid.walkable(p.x, p.y, 32) && G.beans().every((b) => dist(b, p) > 160)) break;
      }
      K.grave = p;
      w.emit({ k: 'warn', id: 'grave', x: p.x, y: p.y, r: 70, dur: SKEL.every });
    }

    const init = G.trig('SkeletonInitialization', function* () {
      G.music('lichking');
      w.tod = 0;
      v.tiesPossible = true;
      G.forPlaying((i) => { const b = G.bean('hmpr', i, polar(C(), w.rng.real(100, 300), w.rng.dir()), { speed: 270 }); b.dispelAt = 0; });
      G.addKey(w.ofType('hmpr'));
      G.cameraBounds(R.Skeleton_Sonata);
      G.startTimer(90, 'Time Left');
      G.say('The Skele-Bean Sonata', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.SkeletonTouch.enable(); T.SkeletonHunt.enable();
      G.forBots(() => T.SkeletonAI.enable());
      yield 3.5;
      K.t0 = w.t;
      newGrave();
      yield SKEL.every;
      T.SkeletonSpawn.enable(); T.SkeletonSpawn.execute();
    });

    G.trig('SkeletonSpawn', function* () {
      const p = K.grave; if (!p) return;
      if (w.ofType('uske').length < SKEL.max) {
        w.emit({ k: 'boom', x: p.x, y: p.y, r: 0 });
        for (let k = 0; k < 3; k++) { const s = w.create('uske', P_ENEMY, polar(p, 20, k * 120)); s.acquire = 0; s.baseSpeed = Math.min(300, SKEL.speed + (w.t - (K.t0 ?? w.t)) * 0.7); }
      }
      newGrave();
    }).every(SKEL.every);

    // skeletons hunt the nearest bean (original: acquire range 1000)
    G.trig('SkeletonHunt', function* () {
      const beans = G.beans();
      for (const s of w.ofType('uske')) {
        let t = null, bd = 1e9; for (const b of beans) { const d = dist(s, b); if (d < bd) { bd = d; t = b; } }
        if (t) w.issue(s, { type: 'move', x: t.x, y: t.y });
      }
    }).every(0.2);

    G.trig('SkeletonTouch', function* () {
      const sk = w.ofType('uske');
      for (const b of G.beans()) for (const s of sk) if (dist(b, s) <= b.coll + SKEL.touch) { G.boom(b); break; }
    }).every(0.05);

    // bots: run from the skeleton crowd and the grave, dispel when 2+ are close (or one is very close)
    G.trig('SkeletonAI', function* () {
      const sk = w.ofType('uske');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const close = sk.filter((s) => dist(s, u) < SKEL.dispelR * 0.8);
          if (w.t >= u.dispelAt && (close.length >= 2 || close.some((s) => dist(s, u) < 90)) && w.rng.next() < 0.6) { dispel(G, u); continue; }
          let fx = 0, fy = 0;
          const threats = K.grave ? [...sk, K.grave] : sk;
          for (const t of threats) { const d = Math.max(1, dist(u, t)); if (d < 400) { const k = (400 - d) / 400; fx += (u.x - t.x) / d * k; fy += (u.y - t.y) / d * k; } }
          const c = C(), dc = dist(u, c); if (dc > 200) { fx += (c.x - u.x) / dc * (dc / 400); fy += (c.y - u.y) / dc * (dc / 400); }
          if (Math.hypot(fx, fy) > 0.05) {
            let p = { x: u.x + fx * 150, y: u.y + fy * 150 };
            if (!w.grid.walkable(p.x, p.y, u.coll)) p = polar(u, 120, angleTo(u, c) + w.rng.real(-80, 80));
            w.issue(u, { type: 'move', ...p });
          }
        }
      });
    }).every(0.2);

    return init;
  },
};
