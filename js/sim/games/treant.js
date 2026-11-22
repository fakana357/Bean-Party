// Treant Bean Valley — based on "Treant Valley" (Triggers_Events[15]).
// Kept: the clearing with its 12 trees, beans start 100-400 from the centre,
// from 7 s a random tree glows for 2 s and wakes up as a treant (max 12),
// treants roam to random spots every 2.5 s and chase beans that come close.
// Polished: touching a treant = out (no hidden HP); trees wake every 6 s;
// treants slowly speed up and a 100 s timer guarantees the round ends.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const TREANT = { touch: 22, chaseR: 220, every: 6, max: 12, glow: 2 };

export default {
  num: 15, id: 'treant', title: 'Treant Bean Valley', orig: 'Treant Valley',
  subtitle: 'Survive as long as possible!', arena: 'treant_valley', rect: 'Treant_Valley', kind: 'survival',
  hint: 'Glowing trees wake up as treants. Don’t let a treant touch you!',
  objective: 'Be the last bean standing. Out: a treant touches you.',
  clip: ['Treant_Valley', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Treant_Valley);
    const S = (v.treant = { start: 0 });

    const init = G.trig('TreantInitialization', function* () {
      G.music('lichking');
      v.tiesPossible = true; S.start = w.t;
      w.restoreDestructables(R.Treant_Valley);
      G.forPlaying((i) => G.bean('ngno', i, polar(C(), w.rng.real(100, 400), w.rng.dir()), { speed: 270 }));
      G.addKey(w.ofType('ngno'));
      G.cameraBounds(R.Treant_Valley);
      G.startTimer(100, 'Time Left');
      G.say('Treant Bean Valley', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.TreantTouch.enable();
      G.forBots(() => T.TreantAI.enable());
      yield 5;
      T.TreantSpawn.enable(); T.TreantPatrol.enable(); T.TreantSpawn.execute();
    });

    G.trig('TreantSpawn', function* (e) {
      const trees = w.destIn(R.Treant_Valley).filter((d) => d.alive && d.type === 'tree' && !d.waking);
      if (!trees.length || w.ofType('efon').length >= TREANT.max) return;
      const d = w.rng.pick(trees); d.waking = true;
      w.emit({ k: 'warn', id: 'treant' + d.x + d.y, x: d.x, y: d.y, r: 90, dur: TREANT.glow });
      const round = G.round();
      yield TREANT.glow;
      d.waking = false;
      if (G.round() !== round || !T.TreantSpawn.enabled) return;
      w.setDest(d, false);
      const u = w.create('efon', P_ENEMY, { x: d.x, y: d.y });
      u.acquire = 0; u.baseSpeed = 200 + (w.t - S.start) * 0.6;
      w.emit({ k: 'impact', x: d.x, y: d.y, type: 'efon', r: 80 });
    }).every(TREANT.every);

    // roam to a random spot (original: attack-move every 2.5 s); chase beans nearby
    G.trig('TreantPatrol', function* () {
      const beans = G.beans();
      for (const u of w.ofType('efon')) {
        u.baseSpeed = Math.min(265, 200 + (w.t - S.start) * 0.6);
        let near = null, nd = TREANT.chaseR;
        for (const b of beans) { const d = dist(u, b); if (d < nd) { nd = d; near = b; } }
        if (near) w.issue(u, { type: 'move', x: near.x, y: near.y });
        else if (!u.order || (u.roamAt ?? 0) <= w.t) { u.roamAt = w.t + 2.5; w.issue(u, { type: 'move', ...w.randomIn(R.Treant_Valley) }); }
      }
    }).every(0.25);

    G.trig('TreantTouch', function* () {
      const ts = w.ofType('efon');
      for (const b of G.beans()) for (const t of ts) if (dist(b, t) <= b.coll + TREANT.touch) { G.boom(b); break; }
    }).every(0.05);

    // bots: keep moving (the original's outward drift), away from treants and glowing trees
    G.trig('TreantAI', function* () {
      const ts = w.ofType('efon'), waking = w.destIn(R.Treant_Valley).filter((d) => d.waking);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let fx = 0, fy = 0;
          for (const t of [...ts, ...waking]) { const d = dist(u, t); if (d < 360) { const k = (360 - d) / 360; fx += (u.x - t.x) / d * k; fy += (u.y - t.y) / d * k; } }
          const c = C(), dc = dist(u, c); if (dc > 300) { fx += (c.x - u.x) / dc * 0.5; fy += (c.y - u.y) / dc * 0.5; }
          if (Math.hypot(fx, fy) > 0.15) {
            let p = { x: u.x + fx * 200, y: u.y + fy * 200 };
            if (!w.grid.walkable(p.x, p.y, u.coll)) p = polar(u, 150, angleTo(u, c) + w.rng.real(-70, 70));
            w.issue(u, { type: 'move', ...p });
          } else if (!u.order && w.rng.next() < 0.2) w.issue(u, { type: 'move', ...polar(C(), w.rng.real(0, 350), w.rng.dir()) });
        }
      });
    }).every(0.2);

    return init;
  },
};
