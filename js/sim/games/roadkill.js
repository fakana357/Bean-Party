// Rollkill Challenge — based on "Roadkill Challenge" (Triggers_Events[7]).
// Kept: the U-shaped course, 8 rollers on the original lanes and speeds,
// 90 s timer, race scoring.
// Polished: the hitbox is the roller's actual footprint, and bots wait for a gap.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, ARENA_SCALE } from '../engine.js';
const K = ARENA_SCALE.road || 1;

// Siege engines from Roadkill Initialization: [startDx, startDy, facing, speed|null(default 220), patrolDx]
export const ROADKILL_LANES = [
  [-256, -448, 180, null, -896], [-256, -64, 180, 280, -896], [-256, 320, 180, 340, -896],
  [256, 320, 0, 260, 896], [896, 192, 180, 260, 256], [256, -192, 0, 280, 896],
  [896, -320, 180, 280, 256], [256, -448, 0, 280, 896],
];
export const ROLLER = { halfLen: 78, halfWid: 52 };

function hits(t, b, pad = 0) {
  const a = t.facing * Math.PI / 180, dx = b.x - t.x, dy = b.y - t.y;
  const along = dx * Math.cos(a) + dy * Math.sin(a), side = -dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(along) <= ROLLER.halfLen + b.coll + pad && Math.abs(side) <= ROLLER.halfWid + b.coll + pad;
}

export default {
  num: 7, id: 'roadkill', title: 'Rollkill Challenge', orig: 'Roadkill Challenge',
  subtitle: 'Reach the end!', arena: 'road', rect: 'Roadkill_Challenge', kind: 'race',
  hint: 'Cross the roads and reach the flag. One bump from a roller and you’re flat!',
  objective: 'Reach the flag across the roads. Out: a roller hits you.',
  clip: ['Roadkill_Challenge', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Roadkill_Challenge);

    const init = G.trig('RoadkillInitialization', function* () {
      G.music('illidan');
      v.ante = 8;
      G.forPlaying((i) => G.bean('nmrl', i, w.randomIn(R.Roadkill_Start), { speed: 250 * K }));
      G.addKey(w.ofType('nmrl'));
      for (const [dx, dy, f, sp, px] of ROADKILL_LANES) {
        const u = w.create('hmtt', P_ENEMY, offset(C(), dx * K, dy * K), f);
        u.acquire = 0;
        if (sp) u.baseSpeed = sp * K; else u.baseSpeed *= K;
        u.order = { type: 'patrol', a: { x: u.x, y: u.y }, b: offset(C(), px * K, dy * K), leg: true };
      }
      w.create('ncop', P_NEUTRAL, center(R.Roadkill_Finish));
      G.cameraBounds(R.Roadkill_Challenge);
      G.startTimer(90, 'Time Left');
      G.say('Rollkill Challenge', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.RoadkillFinish.enable(); T.RoadkillDeath.enable();
      yield 2;
      G.forBots(() => T.RoadkillAI.enable());
    });

    G.trig('RoadkillFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.RoadkillFinish, rect: R.Roadkill_Finish });

    G.trig('RoadkillDeath', function* () {
      const rollers = w.ofType('hmtt');
      for (const b of G.beans()) if (rollers.some((t) => hits(t, b))) { b.squashed = true; w.kill(b); }
    }).every(0.05);

    // bots: follow the path to the flag, but stop when a roller would reach them soon
    G.trig('RoadkillAI', function* () {
      const rollers = w.ofType('hmtt'), goal = center(R.Roadkill_Finish);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.botWait ??= w.t + w.rng.real(0, 3))) continue;
          if (!u.botPath || w.tick % 40 === u.id % 40) u.botPath = w.grid.path(u, goal, u.coll) || [];
          while (u.botPath.length && dist(u, u.botPath[0]) < 12) u.botPath.shift();
          const wp = u.botPath[0]; if (!wp) continue;
          const d = dist(u, wp), nx = (wp.x - u.x) / d, ny = (wp.y - u.y) / d;
          const careful = u.careful ??= w.rng.real(0.9, 1.5);
          const unsafe = (mx, my) => {
            for (const t of rollers) {
              const a = t.facing * Math.PI / 180, sp = t.speed;
              for (let k = 0; k <= 5; k++) {
                const dt = (k / 5) * careful;
                const me = { x: u.x + mx * u.speed * dt, y: u.y + my * u.speed * dt, coll: u.coll };
                const tt = { x: t.x + Math.cos(a) * sp * dt, y: t.y + Math.sin(a) * sp * dt, facing: t.facing };
                if (hits(tt, me, 34)) return true;
              }
            }
            return false;
          };
          if (!unsafe(nx, ny)) w.issue(u, { type: 'steer', dx: nx, dy: ny });
          else if (!unsafe(0, 0)) { if (u.order) w.issue(u, { type: 'stop' }); }
          else if (!unsafe(-nx, -ny)) w.issue(u, { type: 'steer', dx: -nx, dy: -ny });
          else w.issue(u, { type: 'steer', dx: nx, dy: ny });
        }
      });
    }).every(0.1);

    return init;
  },
};
