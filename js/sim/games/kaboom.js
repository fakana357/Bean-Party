// The Ka-Bean Room — based on "The Kaboom Room" (Triggers_Events[3]).
// Kept: round room, beans start 600 from the centre, fire sprites spawn at the
// centre every 10 s (max 10) and fly outward at 350, wrapping back at 800,
// the centre fire lights up after 5 s, survival scoring with ties.
// Polished: touching a sprite or the fire = you explode; explosions chain to
// beans within a clearly drawn radius.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const KABOOM = { spriteR: 30, fireR: 105, chainR: 150, chainDelay: 0.3 };

export default {
  num: 3, id: 'kaboom', title: 'The Ka-Bean Room', orig: 'The Kaboom Room',
  subtitle: 'Survive as long as possible!', arena: 'kaboom', rect: 'Kaboom_Room', kind: 'survival',
  hint: 'Don’t touch the fire sprites or the bonfire. Boom spreads to beans next to you!',
  objective: 'Be the last bean standing. Out: you touch a fire sprite, the bonfire, or a bean blowing up next to you.',
  clip: ['Kaboom_Room', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Kaboom_Room);
    const K = (v.kaboom = { fire: false });

    const init = G.trig('KaboomInitialization', function* () {
      G.music('war2intro');
      v.tiesPossible = true; K.fire = false;
      G.forPlaying((i) => G.bean('ngsp', i, polar(C(), 600, w.rng.dir()), { speed: 270 }));
      G.addKey(w.ofType('ngsp'));
      G.cameraBounds(R.Kaboom_Room);
      G.say('The Ka-Bean Room', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.KaboomResetBase.enable(); T.KaboomTouch.enable();
      G.forBots(() => T.KaboomAI.enable());
      yield 5;
      K.fire = true;
      w.emit({ k: 'centerFlame', x: C().x, y: C().y, r: KABOOM.fireR });
      G.sound('brazier');
      T.KaboomWispSpawn.enable();
      T.KaboomWispSpawn.execute();
    });

    G.trig('KaboomWispSpawn', function* () {
      yield w.rng.real(0, 2);
      if (!T.KaboomWispSpawn.enabled) return;
      const u = w.create('ewsp', P_ENEMY, C());
      u.abils = u.abils.filter((a) => a !== 'ANpi');
      w.issue(u, { type: 'move', ...polar(C(), 900, w.rng.dir()) });
    }, { cond: () => w.ofPlayer(P_ENEMY).length < 10 }).every(10);

    G.trig('KaboomResetBase', function* () {
      for (const u of w.ofType('ewsp')) if (dist(C(), u) >= 800) { u.x = C().x; u.y = C().y; w.issue(u, { type: 'move', ...polar(C(), 900, w.rng.dir()) }); }
    }).every(0.05);

    function explode(b) {
      if (!b.alive) return;
      const x = b.x, y = b.y;
      G.boom(b, KABOOM.chainR);
      w.quake = 500;
      w.spawn(function* () {
        yield KABOOM.chainDelay;
        for (const o of G.beans()) if (dist(o, { x, y }) <= KABOOM.chainR) explode(o);
      });
    }

    G.trig('KaboomTouch', function* () {
      const sprites = w.ofType('ewsp');
      for (const b of G.beans()) {
        if (K.fire && dist(b, C()) <= KABOOM.fireR + b.coll) { explode(b); continue; }
        for (const s of sprites) if (dist(b, s) <= KABOOM.spriteR + b.coll) { explode(b); break; }
      }
    }).every(0.05);

    // bots: the original drifts outward every 2 s; they also dodge nearby sprites
    G.trig('KaboomAI', function* () {
      const sprites = w.ofType('ewsp');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let near = null, nd = 260;
          for (const s of sprites) { const d = dist(u, s); if (d < nd) { nd = d; near = s; } }
          if (near && w.rng.next() < 0.55) {
            const a = angleTo(near, u) + w.rng.real(-50, 50);
            let p = polar(u, 180, a); if (dist(p, C()) > 620) p = polar(C(), 560, angleTo(C(), p));
            w.issue(u, { type: 'move', ...p });
          } else if (!u.order && w.rng.next() < 0.12) {
            let p = polar(u, w.rng.real(200, 500), angleTo(C(), u) + w.rng.real(-120, 120));
            if (dist(p, C()) > 620) p = polar(C(), 560, angleTo(C(), p)); if (dist(p, C()) < 220) p = polar(C(), 300, angleTo(C(), p));
            w.issue(u, { type: 'move', ...p });
          }
        }
      });
    }).every(0.25);

    return init;
  },
};
