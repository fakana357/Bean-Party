// Bean Stampede — based on "Stampede" (Triggers_Events[17]).
// Kept: the long field, beans start 384 left of the centre, the beast tamer in the
// middle starts the stampede at 7 s (2 beasts a second, 30 s per cast, then a new
// cast in a random left/right direction), more tamers join every 20 s.
// Polished: beasts run in straight lanes across the whole field at 500 and one touch
// = out; tamers are harmless and announce their direction; max 4 tamers; 90 s timer.
import { P_ENEMY, center, offset, dist } from '../engine.js';

export const STAMPEDE = { perSec: 2, cast: 30, speed: 500, touch: 38, maxTamers: 4 };

export default {
  num: 17, id: 'stampede', title: 'Bean Stampede', orig: 'Stampede',
  subtitle: 'Dodge the stampede as long as possible!', arena: 'stampede', rect: 'Stampede', kind: 'survival',
  hint: 'Beasts charge across the field. Dodge up and down — one touch and you’re out!',
  objective: 'Be the last bean standing. Out: a charging beast touches you.',
  clip: ['Stampede', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Stampede);
    const S = (v.stampede = { tamers: [] });

    function cast(t) {
      t.dir = w.rng.next() < 0.5 ? -1 : 1; t.castEnd = w.t + STAMPEDE.cast; t.nextBeast = w.t;
      t.facing = t.dir > 0 ? 0 : 180;
      w.emit({ k: 'text3d', x: t.x, y: t.y + 40, text: t.dir > 0 ? '>>>' : '<<<', color: '#ffd23f' });
      w.emit({ k: 'sfx', id: 'red' });
    }
    function addTamer(p) {
      const t = w.create('Nbst', P_ENEMY, p, 180);
      t.acquire = 0; t.paused = true; t.invuln = true;
      w.emit({ k: 'teleport', x: t.x, y: t.y });
      S.tamers.push(t); cast(t);
    }

    const init = G.trig('StampedeInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true; S.tamers = [];
      G.forPlaying((i) => G.bean('ogru', i, offset(C(), -384, w.rng.real(-192, 192)), { speed: 280 }));
      G.addKey(w.ofType('ogru'));
      const first = w.create('Nbst', P_ENEMY, C(), 180); first.acquire = 0; first.paused = true; first.invuln = true;
      G.cameraBounds(R.Stampede);
      G.startTimer(97, 'Time Left');
      G.say('Bean Stampede', 'Dodge the stampede as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.StampedeRun.enable();
      G.forBots(() => T.StampedeAI.enable());
      yield 7;
      first.dir = -1; S.tamers.push(first); cast(first); first.dir = -1; first.facing = 180;
      T.StampedeSpawn.enable();
    });

    G.trig('StampedeSpawn', function* () {
      const round = G.round();
      yield 15;
      if (G.round() !== round || !T.StampedeSpawn.enabled || S.tamers.length >= STAMPEDE.maxTamers) return;
      addTamer(offset(C(), w.rng.real(-160, 160), w.rng.real(-256, 256)));
    }).every(20);

    // beasts: spawned off the edge, run straight across, removed at the far side
    G.trig('StampedeRun', function* () {
      const r = R.Stampede, dt = 0.025;
      for (const t of S.tamers) {
        if (!t.alive) continue;
        if (w.t >= t.castEnd) cast(t);
        while (w.t >= t.nextBeast) {
          t.nextBeast += 1 / STAMPEDE.perSec;
          const y = w.rng.real(r.y0 + 30, r.y1 - 30), x = t.dir > 0 ? r.x0 - 120 : r.x1 + 120;
          const b = w.create('okod', P_ENEMY, { x, y }, t.dir > 0 ? 0 : 180);
          b.x = x; b.y = y; b.acquire = 0; b.paused = true; b.invuln = true; b.beast = t.dir; b.coll = 40;
        }
      }
      const beans = G.beans();
      for (const b of w.ofType('okod')) {
        if (!b.beast) continue;
        b.x += b.beast * STAMPEDE.speed * dt; b.vx = b.beast * STAMPEDE.speed; b.moving = true;
        if ((b.beast > 0 && b.x > r.x1 + 140) || (b.beast < 0 && b.x < r.x0 - 140)) { w.remove(b); continue; }
        for (const p of beans) if (p.alive && dist(p, b) <= p.coll + STAMPEDE.touch) { p.squashed = true; w.kill(p); }
      }
    }).every(0.025);

    // bots: look at the beasts coming down their lane and step up/down to the safest gap
    G.trig('StampedeAI', function* () {
      const beasts = w.ofType('okod').filter((b) => b.beast), r = R.Stampede;
      const danger = (x, y) => {
        let worst = 0;
        for (const b of beasts) {
          if (Math.abs(b.y - y) > 24 + STAMPEDE.touch + 22) continue;
          const tt = (x - b.x) / (b.beast * STAMPEDE.speed);
          if (tt < -0.15) continue;
          worst = Math.max(worst, tt < 1.4 ? 2 - tt : 0.3);
        }
        return worst;
      };
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const react = u.react ??= w.rng.real(0.75, 1.1);
          let best = u.y, bs = danger(u.x, u.y) * react;
          if (bs < 0.2) { if (u.order && !u.order.dodge) w.issue(u, { type: 'stop' }); continue; }
          for (let dy = -240; dy <= 240; dy += 40) {
            const y = u.y + dy; if (y < r.y0 + 30 || y > r.y1 - 30) continue;
            const s = danger(u.x, y) + Math.abs(dy) / 600 + danger(u.x, (u.y + y) / 2) * 0.7;
            if (s < bs) { bs = s; best = y; }
          }
          const tx = Math.min(r.x1 - 120, Math.max(r.x0 + 120, u.x));
          w.issue(u, { type: 'move', x: tx, y: best, dodge: true });
        }
      });
    }).every(0.15);

    return init;
  },
};
