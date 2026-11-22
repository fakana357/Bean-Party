// Mino-Bean Maze — based on "Minotaur Maze" (Triggers_Events[32]).
// Kept: beans start in the centre of the maze, 4 minotaurs start at the
// corners (+-672) and patrol to a new random spot every 10 s, a prize appears
// 640 from the centre 4 s in, whoever grabs it finishes and a new prize
// appears somewhere random, race scoring.
// Polished: a minotaur touch = out; minotaurs charge beans they can see
// within 350 but are a bit slower than beans. Timer 120 s instead of 180 s.
import { P_ENEMY, P_NEUTRAL, center, offset, polar, dist, angleTo } from '../engine.js';

const MN = { beanSpeed: 250, tauSpeed: 215, sight: 350, grabR: 48, hitPad: 6 };

export default {
  num: 32, id: 'minotaur', title: 'Mino-Bean Maze', orig: 'Minotaur Maze',
  subtitle: 'Claim the prize!', arena: 'minotaur_maze', rect: 'Minotaur_Maze', kind: 'race',
  hint: 'Find and grab the flag in the maze. A minotaur touch = out!',
  objective: 'Grab the flag in the maze. Out: a minotaur touches you.',
  clip: ['Minotaur_Maze', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Minotaur_Maze);
    const N = (v.minotaur = { prize: null });

    const spot = (p) => w.grid.nearestWalkable(p.x, p.y, 16) || p;
    function placePrize(p) {
      if (N.prize) w.remove(N.prize);
      N.prize = w.create('ncop', P_NEUTRAL, spot(p));
      w.emit({ k: 'teleport', x: N.prize.x, y: N.prize.y });
    }

    const init = G.trig('MinotaurInitialization', function* () {
      G.music('illidan');
      v.ante = 8; N.prize = null;
      G.forPlaying((i) => { const b = G.bean('nskk', i, polar(C(), w.rng.real(0, 8), w.rng.dir()), { speed: MN.beanSpeed }); b.coll = 14; });
      G.addKey(w.ofType('nskk'));
      for (const [dx, dy] of [[-672, 672], [672, 672], [-672, -672], [672, -672]]) {
        const t = w.create('otau', P_ENEMY, offset(C(), dx, dy)); t.acquire = 0; t.baseSpeed = MN.tauSpeed;
      }
      G.cameraBounds(R.Minotaur_Maze);
      G.startTimer(120, 'Time Left');
      G.say('Mino-Bean Maze', 'Claim the prize!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.MinotaurTick.enable(); T.MinotaurChase.enable();
      yield 4;
      placePrize(polar(C(), 640, w.rng.dir()));
      T.MinotaurPatrol.enable(); T.MinotaurPatrol.execute();
      G.forBots(() => T.MinotaurAI.enable());
    });

    G.trig('MinotaurPatrol', function* () {
      for (const t of w.ofType('otau')) if (!t.chasing) w.issue(t, { type: 'move', ...spot(w.randomIn(R.Minotaur_Maze)) });
    }).every(10);

    // minotaurs charge a bean they can see
    G.trig('MinotaurChase', function* () {
      const beans = G.beans();
      for (const t of w.ofType('otau')) {
        let tg = null, td = MN.sight;
        for (const b of beans) { const d = dist(t, b); if (d < td && w.grid.los(t.x, t.y, b.x, b.y, 1)) { td = d; tg = b; } }
        if (tg) { t.chasing = true; w.issue(t, { type: 'move', x: tg.x, y: tg.y }); }
        else if (t.chasing) { t.chasing = false; w.issue(t, { type: 'move', ...spot(w.randomIn(R.Minotaur_Maze)) }); }
        else if (!t.order) w.issue(t, { type: 'move', ...spot(w.randomIn(R.Minotaur_Maze)) });
      }
    }).every(0.3);

    G.trig('MinotaurTick', function* () {
      const taus = w.ofType('otau');
      for (const b of G.beans()) {
        if (taus.some((t) => dist(t, b) <= t.coll + b.coll + MN.hitPad)) { G.boom(b); continue; }
        if (N.prize && N.prize.alive && dist(b, N.prize) <= MN.grabR) {
          v.focus = b; T.RaceFinish.execute();
          placePrize(w.randomIn(R.Minotaur_Maze));
        }
      }
    }).every(0.05);

    // bots: walk to the prize, back off from minotaurs within 400 (as the original)
    G.trig('MinotaurAI', function* () {
      const taus = w.ofType('otau');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || !N.prize) continue;
          if (w.t < (u.mnWait ??= w.t + w.rng.real(0, 1.5))) continue;
          const near = taus.filter((t) => dist(t, u) < 260 && w.grid.los(t.x, t.y, u.x, u.y, 1));
          if (near.length && w.rng.next() < 0.85) {
            const t = near[0];
            w.issue(u, { type: 'move', ...spot(polar(u, 256, angleTo(t, u) + w.rng.real(-30, 30))) });
            u.mnWait = w.t + 0.6;
            continue;
          }
          if (!u.order || u.order.x !== N.prize.x) w.issue(u, { type: 'move', x: N.prize.x, y: N.prize.y });
        }
      });
    }).every(0.25);

    return init;
  },
};
