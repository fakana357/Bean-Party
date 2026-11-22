// Fel Bean Fiasco — based on "Fel Orc Fiasco" (Triggers_Events[51], a variant of
// Peon Pandemonium that the original map's filter never picked; ported anyway).
// Kept: the Peon Pandemonium arena, beans start 100-300 from the centre, 5 s grace,
// then a launcher appears at one of the 4 edge zones EVERY SECOND (max 30, the
// 27th+ are the burning-oil kind), survival scoring with ties.
// Polished like Bean Pandemonium: shots aim where a bean was, the landing spot is
// telegraphed, a hit or a hot puddle = out; launchers fire slowly at first so the
// swarm builds up instead of killing everyone in the first seconds.
import { P_ENEMY, center, polar, dist } from '../engine.js';

export const FEL = { killR: 58, lavaR: 72, lavaDur: 3.2, speed: 400, scatter: 45, max: 30, hotFrom: 26 };

export default {
  num: 51, id: 'fel', title: 'Fel Bean Fiasco', orig: 'Fel Orc Fiasco',
  subtitle: 'Survive as long as possible!', arena: 'peon', rect: 'Peon_Pandemonium', kind: 'survival',
  hint: 'A new jelly launcher every second! Dodge the glowing rings and the orange puddles.',
  objective: 'Be the last bean standing. Out: a jelly bomb or a hot puddle.',
  clip: ['Peon_Pandemonium', 420, 420],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Peon_Pandemonium);
    const regs = [R.Peon_1, R.Peon_2, R.Peon_3, R.Peon_4];
    const S = (v.fel = { start: 0, warn: [], lava: [] });

    const init = G.trig('FelInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true;
      S.start = w.t + 5; S.warn = []; S.lava = [];
      G.forPlaying((i) => G.bean('ncpn', i, polar(C(), w.rng.real(100, 300), w.rng.dir()), { speed: 240 }));
      G.addKey(w.ofType('ncpn'));
      G.cameraBounds(R.Peon_Pandemonium);
      w.restoreDestructables(R.Peon_Pandemonium);
      G.startTimer(95, 'Time Left');
      G.say('Fel Bean Fiasco', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.FelHazards.enable();
      G.forBots(() => T.FelAI.enable());
      yield 5;
      T.FelSpawn.enable(); T.FelFire.enable();
    });

    G.trig('FelSpawn', function* () {
      const n = w.ofPlayer(P_ENEMY).length;
      const type = n >= FEL.hotFrom ? 'ocat' : 'ncat';
      const p = w.randomIn(w.rng.pick(regs)), c = C();
      const u = w.create(type, P_ENEMY, p, Math.atan2(c.y - p.y, c.x - p.x) * 180 / Math.PI);
      u.nextShot = w.t + w.rng.real(1.5, 3.5); u.order = null; u.acquire = 0;
      w.emit({ k: 'teleport', x: u.x, y: u.y });
    }, { cond: () => w.ofPlayer(P_ENEMY).length < FEL.max }).every(1);

    G.trig('FelFire', function* () {
      const beans = G.beans(); if (!beans.length) return;
      const elapsed = w.t - S.start;
      const cool = Math.max(3, 9 - elapsed * 0.08);
      for (const u of w.ofPlayer(P_ENEMY)) {
        if (w.t < u.nextShot) continue;
        const b = w.pick(beans), a = w.rng.dir(), r = w.rng.real(0, FEL.scatter);
        const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
        u.facing = Math.atan2(y - u.y, x - u.x) * 180 / Math.PI;
        u.nextShot = w.t + cool + w.rng.real(0, 2);
        const hot = u.type === 'ocat';
        const m = w.lob(u, x, y, { speed: FEL.speed, type: u.type, onImpact: (m) => impact(m, hot) });
        S.warn.push({ id: m.id, x, y, r: FEL.killR, end: w.t + m.dur, hot });
        w.emit({ k: 'swing', id: u.id }); w.emit({ k: 'warn', id: m.id, x, y, r: FEL.killR, dur: m.dur, hot });
      }
    }).every(0.1);

    function impact(m, hot) {
      S.warn = S.warn.filter((x) => x.id !== m.id);
      if (!T.FelHazards.enabled) return;
      w.emit({ k: 'impact', x: m.tx, y: m.ty, type: m.type, r: FEL.killR });
      for (const b of G.beans()) if (dist(b, { x: m.tx, y: m.ty }) <= FEL.killR + b.coll) w.kill(b);
      for (const d of w.dest) if (d.alive && d.type === 'tree' && dist(d, { x: m.tx, y: m.ty }) < FEL.killR + 30) { d.alive = false; w.grid.dirty = true; w.emit({ k: 'tree', x: d.x, y: d.y, alive: false }); }
      if (hot) { S.lava.push({ x: m.tx, y: m.ty, r: FEL.lavaR, end: w.t + FEL.lavaDur }); w.emit({ k: 'lava', x: m.tx, y: m.ty, r: FEL.lavaR, dur: FEL.lavaDur }); }
    }

    G.trig('FelHazards', function* () {
      S.lava = S.lava.filter((l) => l.end > w.t);
      S.warn = S.warn.filter((x) => x.end > w.t - 0.5);
      for (const b of G.beans()) for (const l of S.lava) if (dist(b, l) <= l.r + b.coll * 0.5) { w.kill(b); break; }
    }).every(0.05);

    // bots: wander, sidestep telegraphed rings and puddles
    G.trig('FelAI', function* () {
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const danger = [...S.warn, ...S.lava].find((d) => dist(u, d) < d.r + 40);
          if (danger && w.rng.next() < 0.6) {
            const a = Math.atan2(u.y - danger.y, u.x - danger.x) + w.rng.real(-0.6, 0.6);
            w.issue(u, { type: 'move', x: u.x + Math.cos(a) * 160, y: u.y + Math.sin(a) * 160 });
          } else if (!u.order && w.rng.next() < 0.08) w.issue(u, { type: 'move', ...w.randomIn(R.Peon_Pandemonium) });
        }
      });
    }).every(0.25);

    return init;
  },
};
