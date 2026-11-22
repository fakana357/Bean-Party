// Bean Pandemonium — based on Uther Party's "Peon Pandemonium" (Triggers_Events[1]).
// Kept from the map: arena, catapults spawning at the four edge zones every 8 s
// (max 30, the 9th+ are the burning-oil kind), 6 s grace, survival scoring.
// Polished: catapults aim at beans (with flight-time delay), the landing spot is
// telegraphed, a hit or a hot puddle knocks you out, fire rate ramps up.
import { P_ENEMY, center, polar, dist } from '../engine.js';

export const PEON = { killR: 58, lavaR: 72, lavaDur: 3.2, speed: 400, scatter: 45 };

export default {
  num: 1, id: 'peon', title: 'Bean Pandemonium', orig: 'Peon Pandemonium',
  subtitle: 'Survive as long as possible!', arena: 'peon', rect: 'Peon_Pandemonium', kind: 'survival',
  hint: 'Dodge the glowing rings — a jelly bomb lands there. Orange puddles are hot!',
  objective: 'Be the last bean standing. Out: a jelly bomb lands on you or you step in a hot puddle.',
  clip: ['Peon_Pandemonium', 420, 420],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Peon_Pandemonium);
    const regs = [null, R.Peon_1, R.Peon_2, R.Peon_3, R.Peon_4];
    const S = (v.peon = { start: 0, warn: [], lava: [] });

    const init = G.trig('PeonInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true;
      S.start = w.t + 6; S.warn = []; S.lava = [];
      G.forPlaying((i) => G.bean('opeo', i, polar(C(), w.rng.real(100, 300), w.rng.dir()), { speed: 240 }));
      G.addKey(w.ofType('opeo'));
      G.cameraBounds(R.Peon_Pandemonium);
      w.restoreDestructables(R.Peon_Pandemonium);
      G.say('Bean Pandemonium', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.PeonHazards.enable();
      G.forBots(() => T.PeonAI.enable());
      yield 6;
      T.PeonSpawn.enable(); T.PeonFire.enable();
      T.PeonSpawn.execute(); // first launcher right away, then every 8 s
    });

    G.trig('PeonSpawn', function* (e) {
      yield w.rng.real(0, 2);
      if (!T.PeonSpawn.enabled) return;
      const type = w.ofPlayer(P_ENEMY).length >= 8 ? 'ocat' : 'ncat';
      const p = w.randomIn(regs[w.rng.int(1, 4)]), c = C();
      const u = w.create(type, P_ENEMY, p, Math.atan2(c.y - p.y, c.x - p.x) * 180 / Math.PI);
      u.nextShot = w.t + w.rng.real(0.5, 1.5); u.order = null; u.acquire = 0;
      w.emit({ k: 'teleport', x: p.x, y: p.y });
    }, { cond: () => w.ofPlayer(P_ENEMY).length < 30 }).every(8);

    // each launcher picks a bean, the shot lands where the bean *was*: move and you're safe
    G.trig('PeonFire', function* () {
      const beans = G.beans(); if (!beans.length) return;
      const elapsed = w.t - S.start;
      const cool = Math.max(1.4, 4.5 - elapsed * 0.05);
      for (const u of w.ofPlayer(P_ENEMY)) {
        if (w.t < u.nextShot) continue;
        const b = w.pick(beans), a = w.rng.dir(), r = w.rng.real(0, PEON.scatter);
        const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
        u.facing = Math.atan2(y - u.y, x - u.x) * 180 / Math.PI;
        u.nextShot = w.t + cool + w.rng.real(0, 1.2);
        const hot = u.type === 'ocat';
        const m = w.lob(u, x, y, { speed: PEON.speed, type: u.type, onImpact: (m) => impact(m, hot) });
        S.warn.push({ id: m.id, x, y, r: PEON.killR, end: w.t + m.dur, hot });
        w.emit({ k: 'swing', id: u.id }); w.emit({ k: 'warn', id: m.id, x, y, r: PEON.killR, dur: m.dur, hot });
      }
    }).every(0.1);

    function impact(m, hot) {
      S.warn = S.warn.filter((x) => x.id !== m.id);
      w.emit({ k: 'impact', x: m.tx, y: m.ty, type: m.type, r: PEON.killR });
      for (const b of G.beans()) if (dist(b, { x: m.tx, y: m.ty }) <= PEON.killR + b.coll) w.kill(b);
      for (const d of w.dest) if (d.alive && d.type === 'tree' && dist(d, { x: m.tx, y: m.ty }) < PEON.killR + 30) { d.alive = false; w.grid.dirty = true; w.emit({ k: 'tree', x: d.x, y: d.y, alive: false }); }
      if (hot) { S.lava.push({ x: m.tx, y: m.ty, r: PEON.lavaR, end: w.t + PEON.lavaDur }); w.emit({ k: 'lava', x: m.tx, y: m.ty, r: PEON.lavaR, dur: PEON.lavaDur }); }
    }

    G.trig('PeonHazards', function* () {
      S.lava = S.lava.filter((l) => l.end > w.t);
      for (const b of G.beans()) for (const l of S.lava) if (dist(b, l) <= l.r + b.coll * 0.5) { w.kill(b); break; }
    }).every(0.05);

    // bots: wander like the original (every 4 s), and sidestep telegraphed rings
    G.trig('PeonAI', function* () {
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const danger = [...S.warn, ...S.lava].find((d) => dist(u, d) < d.r + 40);
          if (danger && w.rng.next() < 0.6) {
            const a = Math.atan2(u.y - danger.y, u.x - danger.x) + w.rng.real(-0.6, 0.6);
            w.issue(u, { type: 'move', x: u.x + Math.cos(a) * 160, y: u.y + Math.sin(a) * 160 });
          } else if (!u.order && w.rng.next() < 0.06) { const p = w.randomIn(R.Peon_Pandemonium); w.issue(u, { type: 'move', ...p }); }
        }
      });
    }).every(0.25);

    return init;
  },
};
