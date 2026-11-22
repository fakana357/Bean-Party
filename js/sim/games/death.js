// The Death Bean Trap — based on "The Death Trap" (Triggers_Events[48]).
// Kept: the grid of corridors, the 2 start corners, the finish on the far side,
// the 40 spike traps that flip at random (50 %) every 2.5 s from 5 s on, race
// scoring with a 90 s timer.
// Polished: traps no longer block walking; standing on a raised trap = out (bean
// centre on its tile); a trap flashes 0.6 s before it rises; bots wait at a
// trap that is up or about to rise.
import { P_NEUTRAL, center, dist } from '../engine.js';

export const DEATH = { half: 58, warn: 0.6, every: 2.5 };

export default {
  num: 48, id: 'death', title: 'The Death Bean Trap', orig: 'The Death Trap',
  subtitle: 'Reach the end!', arena: 'death_trap', rect: 'Death_Trap', kind: 'race',
  hint: 'Reach the flag. Raised spikes = out! Flashing traps are about to come up.',
  objective: 'Reach the flag. Out: a raised spike.',
  clip: ['Death_Trap', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const S = (v.death = { traps: [] });

    function setTrap(d, up) {
      d.riseAt = null;
      if (d.alive === up) return;
      d.alive = up;
      w.emit({ k: 'dest', x: d.x, y: d.y, alive: up });
    }

    const init = G.trig('DeathInitialization', function* () {
      G.music('illidan');
      v.ante = 8;
      S.traps = w.destIn(R.Death_Trap).filter((d) => d.id === 'DTsp');
      for (const d of S.traps) { d.size = 0; d.riseAt = null; d.alive = true; setTrap(d, false); }
      w.grid.dirty = true;
      G.forPlaying((i) => G.bean('nftr', i, w.randomIn(w.rng.next() < 0.5 ? R.Death_Start_1 : R.Death_Start_2), { speed: 270 }));
      G.addKey(w.ofType('nftr'));
      w.create('ncop', P_NEUTRAL, center(R.Death_Finish));
      G.cameraBounds(R.Death_Trap);
      G.startTimer(90, 'Time Left');
      G.say('The Death Bean Trap', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.DeathFinish.enable(); T.DeathWork.enable();
      G.forBots(() => T.DeathAI.enable());
      yield 5 - DEATH.warn;
      T.DeathToggle.enable(); T.DeathToggle.execute();
    });

    // every 2.5 s each trap rolls up or down; rising ones are telegraphed first
    G.trig('DeathToggle', function* () {
      for (const d of S.traps) {
        if (w.rng.next() < 0.5) {
          if (!d.alive) { d.riseAt = w.t + DEATH.warn; w.emit({ k: 'warn', id: 'dt' + d.x + ',' + d.y, x: d.x, y: d.y, r: DEATH.half, dur: DEATH.warn, hot: true }); }
        } else setTrap(d, false);
      }
    }).every(DEATH.every);

    G.trig('DeathFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.DeathFinish, rect: R.Death_Finish });

    const onTrap = (b, d) => Math.abs(b.x - d.x) <= DEATH.half && Math.abs(b.y - d.y) <= DEATH.half;
    G.trig('DeathWork', function* () {
      for (const d of S.traps) if (d.riseAt != null && w.t >= d.riseAt) setTrap(d, true);
      for (const b of G.beans()) for (const d of S.traps) if (d.alive && onTrap(b, d)) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'spike', r: 40 }); w.kill(b); break; }
    }).every(0.05);

    // bots: follow the path to the flag, but hold before a trap that is up or flashing
    G.trig('DeathAI', function* () {
      const goal = center(R.Death_Finish);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (!u.botPath || w.tick % 40 === u.id % 40) u.botPath = w.grid.path(u, goal, u.coll) || [];
          while (u.botPath.length > 1 && dist(u, u.botPath[0]) < 14) u.botPath.shift();
          const wp = u.botPath[0] || goal;
          const d = Math.max(1, dist(u, wp)), nx = (wp.x - u.x) / d, ny = (wp.y - u.y) / d;
          const look = u.look ??= w.rng.real(0.35, 0.6);
          const ahead = { x: u.x + nx * u.speed * look, y: u.y + ny * u.speed * look };
          const mid = { x: (u.x + ahead.x) / 2, y: (u.y + ahead.y) / 2 };
          const bad = S.traps.some((t) => (t.alive || t.riseAt != null) && (onTrap(ahead, t) || onTrap(mid, t)) && !onTrap(u, t));
          const here = S.traps.find((t) => (t.alive || t.riseAt != null) && onTrap(u, t));
          if (here) w.issue(u, { type: 'steer', dx: nx, dy: ny }); // get off it
          else if (bad) { if (u.order) w.issue(u, { type: 'stop' }); }
          else w.issue(u, { type: 'steer', dx: nx, dy: ny });
        }
      });
    }).every(0.1);

    return init;
  },
};
