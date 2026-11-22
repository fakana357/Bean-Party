// Crabby Bean Island — based on "Crab Island" (Triggers_Events[26]).
// Kept: beans start 100-300 from the island centre, every 10 s spider crabs
// climb out of the sea 640 from the centre (a limbripper, 50% a shorecrawler,
// 1 in 8 a behemoth once 5+ crabs are out), max 30, survival scoring.
// Polished: one pinch = out. Crabs scuttle in short dashes toward where a bean
// is heading (dodgeable) and are slower than beans; a ring warns where a crab
// will climb out. 90 s timer. The possessable critter crab was dropped.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

const CRAB = {
  nscb: { speed: 240, r: 24 },
  nsc2: { speed: 210, r: 30 },
  nsc3: { speed: 170, r: 46 },
};

export default {
  num: 26, id: 'crab', title: 'Crabby Bean Island', orig: 'Crab Island',
  subtitle: 'Survive as long as possible!', arena: 'crab_island', rect: 'Crab_Island', kind: 'survival',
  hint: 'Spider crabs crawl out of the sea. One pinch and you’re out!',
  objective: 'Be the last bean standing. Out: a spider crab pinches you.',
  clip: ['Crab_Island', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Crab_Island);

    const init = G.trig('CrabInitialization', function* () {
      G.music('war2intro');
      v.tiesPossible = true;
      G.forPlaying((i) => G.bean('uban', i, polar(C(), w.rng.real(100, 300), w.rng.dir()), { speed: 270 }));
      G.addKey(w.ofType('uban'));
      G.cameraBounds(R.Crab_Island);
      G.startTimer(90, 'Time Left');
      G.say('Crabby Bean Island', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.CrabTick.enable();
      yield 5;
      G.forBots(() => T.CrabAI.enable());
      T.CrabSpawn.enable(); T.CrabSpawn.execute();
    });

    function crawl(type) {
      const p = polar(C(), 640, w.rng.dir()), round = G.round();
      w.emit({ k: 'warn', id: 'crab' + w.t, x: p.x, y: p.y, r: 70, dur: 1.2, hot: true });
      w.spawn(function* () {
        yield 1.2;
        if (G.round() !== round || !T.CrabTick.enabled) return;
        const u = w.create(type, P_ENEMY, p, angleTo(p, C()));
        u.acquire = 0; u.baseSpeed = CRAB[type].speed; u.crabR = CRAB[type].r; u.crabNext = w.t + 0.3;
        w.emit({ k: 'impact', x: u.x, y: u.y, type: 'splash', r: 60 });
      });
    }
    const crabs = () => w.alive((u) => u.crabR);

    G.trig('CrabSpawn', function* () {
      if (crabs().length >= 30) return;
      if (w.rng.int(1, 2) === 1) crawl('nscb');
      crawl(crabs().length >= 5 && w.rng.int(1, 8) === 1 ? 'nsc3' : 'nsc2');
    }).every(10);

    G.trig('CrabTick', function* () {
      const cs = crabs(), beans = G.beans();
      for (const c of cs) {
        if (w.t >= c.crabNext && beans.length) {
          // dash toward where the nearest bean is heading
          let tg = null, td = 1e9; for (const b of beans) { const d = dist(c, b); if (d < td) { td = d; tg = b; } }
          const lead = Math.min(0.8, td / c.speed);
          const p = { x: tg.x + (tg.vx || 0) * lead, y: tg.y + (tg.vy || 0) * lead };
          const dash = Math.min(dist(c, p) + 40, w.rng.real(220, 360));
          w.issue(c, { type: 'move', ...polar(c, dash, angleTo(c, p)) });
          c.crabNext = w.t + w.rng.real(0.9, 1.5);
        }
      }
      for (const b of beans) for (const c of cs) if (dist(b, c) <= c.crabR + b.coll) { w.emit({ k: 'sfx', id: 'splat' }); G.boom(b); break; }
    }).every(0.05);

    // bots: flee from close crabs, keep away from the shore
    G.trig('CrabAI', function* () {
      const cs = crabs();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const sense = u.crabSense ??= w.rng.real(220, 380);
          let fx = 0, fy = 0;
          for (const c of cs) {
            const d = dist(u, c); if (d > sense) continue;
            const k = (sense - d) / sense; fx += (u.x - c.x) / (d || 1) * k; fy += (u.y - c.y) / (d || 1) * k;
          }
          const dc = dist(u, C());
          if (dc > 450) { const k = (dc - 450) / 150; fx += (C().x - u.x) / dc * k; fy += (C().y - u.y) / dc * k; }
          if (Math.hypot(fx, fy) > 0.15) { w.issue(u, { type: 'steer', dx: fx, dy: fy }); continue; }
          if (!u.order || u.order.type === 'steer' || w.rng.next() < 0.05) {
            if (u.order?.type === 'steer' || !u.order) w.issue(u, { type: 'move', ...polar(C(), w.rng.real(0, 380), w.rng.dir()) });
          }
        }
      });
    }).every(0.15);

    return init;
  },
};
