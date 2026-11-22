// The Bean Plague — based on "The Plague" (Triggers_Events[37]).
// Kept: beans start 100-300 from the centre, one extra infected acolyte dies
// after 6 s and rises as a zombie, every bean that falls rises again as a
// zombie, survival scoring with ties.
// Polished: one zombie touch = out. Corpses glow for 2 s before they rise so
// it's readable; zombies are slower than beans but speed up over time. 90 s timer.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

const PL = { rise: 2, zSpeed: 190, zMax: 265, accel: 1.0, hitPad: 4 };

export default {
  num: 37, id: 'plague', title: 'The Bean Plague', orig: 'The Plague',
  subtitle: 'Avoid contact with the plague!', arena: 'plague', rect: 'Plague', kind: 'survival',
  hint: 'Don’t touch the zombies. Fallen beans rise again as zombies!',
  objective: 'Be the last bean standing. Out: a zombie touches you.',
  clip: ['Plague', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Plague);
    const Z = (v.plague = { t0: 0 });

    function rise(x, y) {
      const round = G.round();
      w.emit({ k: 'warn', id: 'pl' + w.t + x, x, y, r: 40, dur: PL.rise, hot: true });
      w.spawn(function* () {
        yield PL.rise;
        if (G.round() !== round || !T.PlagueTick.enabled) return;
        const z = w.create('nzom', P_ENEMY, { x, y }, w.rng.dir());
        z.acquire = 0; z.coll = 20; z.baseSpeed = PL.zSpeed;
        w.emit({ k: 'impact', x, y, type: 'nzom', r: 50 }); w.emit({ k: 'sfx', id: 'splat' });
      });
    }

    const init = G.trig('PlagueInitialization', function* () {
      G.music('lichking');
      v.tiesPossible = true;
      G.forPlaying((i) => G.bean('uaco', i, polar(C(), w.rng.real(100, 300), w.rng.dir()), { speed: 270 }));
      G.addKey(w.ofType('uaco'));
      const first = w.create('uaco', P_ENEMY, polar(C(), w.rng.real(100, 300), w.rng.dir()));
      first.acquire = 0; first.baseSpeed = 0;
      G.cameraBounds(R.Plague);
      G.startTimer(90, 'Time Left');
      G.say('The Bean Plague', 'Avoid contact with the plague!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.PlagueTick.enable(); T.PlagueRise.enable();
      G.forBots(() => T.PlagueAI.enable());
      yield 6 - PL.rise;
      Z.t0 = w.t;
      if (first.alive) { const x = first.x, y = first.y; w.kill(first); rise(x, y); }
    });

    // fallen beans rise as zombies
    G.trig('PlagueRise', function* (e) { rise(e.unit.x, e.unit.y); }, { cond: (e) => G.key.has(e.unit) || e.unit.isBean }).on('death');

    G.trig('PlagueTick', function* () {
      const zs = w.ofType('nzom'), beans = G.beans();
      for (const z of zs) {
        z.baseSpeed = Math.min(PL.zMax, z.baseSpeed + PL.accel * 0.05);
        let tg = null, td = 1e9; for (const b of beans) { const d = dist(z, b); if (d < td) { td = d; tg = b; } }
        if (tg && (w.tick + z.id) % 6 === 0) w.issue(z, { type: 'move', x: tg.x, y: tg.y });
      }
      for (const b of beans) if (zs.some((z) => dist(z, b) <= z.coll + b.coll + PL.hitPad)) G.boom(b);
    }).every(0.05);

    // bots: run from nearby zombies, stay off the walls (the original wanders outward)
    G.trig('PlagueAI', function* () {
      const zs = w.ofType('nzom');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const sense = u.plSense ??= w.rng.real(250, 420);
          let fx = 0, fy = 0;
          for (const z of zs) { const d = dist(u, z); if (d < sense) { const k = (sense - d) / sense; fx += (u.x - z.x) / (d || 1) * k; fy += (u.y - z.y) / (d || 1) * k; } }
          const dc = dist(u, C());
          if (dc > 420) { const k = (dc - 420) / 150; fx += (C().x - u.x) / dc * k; fy += (C().y - u.y) / dc * k; }
          if (Math.hypot(fx, fy) > 0.1) { w.issue(u, { type: 'steer', dx: fx, dy: fy }); continue; }
          if (!u.order || u.order.type === 'steer') w.issue(u, { type: 'move', ...polar(u, w.rng.real(200, 400), angleTo(C(), u) + w.rng.real(-120, 120) + (dc > 300 ? 180 : 0)) });
        }
      });
    }).every(0.15);

    return init;
  },
};
