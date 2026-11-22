// Troubled Beans — based on "Troubled Waters" (Triggers_Events[38]).
// Kept: beans start at Troubled_Start and race east to the finish, every 2.5 s
// two water waves appear 256 past the finish on one of 3 lanes (-128/0/+128)
// and rush west at 320 (16 per 0.05 s), touching one within 64 = out,
// 90 s timer, race scoring.
// Polished: waves are removed when they leave the channel (the original only
// cleaned up the wrong unit type), and bots switch lanes to dodge.
import { P_ENEMY, P_NEUTRAL, center, offset } from '../engine.js';

const TW = { speed: 320, hitR: 64, lane: 128 };

export default {
  num: 38, id: 'troubled', title: 'Troubled Beans', orig: 'Troubled Waters',
  subtitle: 'Reach the end!', arena: 'troubled_waters', rect: 'Troubled_Waters', kind: 'race',
  hint: 'Run east to the circle. Waves rush down the lanes: one splash = out!',
  objective: 'Reach the circle in the east. Out: a wave splashes you.',
  clip: ['Troubled_Waters', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const F = () => center(R.Troubled_Finish);

    const init = G.trig('TroubledInitialization', function* () {
      G.music('illidan');
      v.ante = 8;
      G.forPlaying((i) => { const b = G.bean('nhmc', i, w.randomIn(R.Troubled_Start), { speed: 220 }); b.facing = 0; });
      G.addKey(w.ofType('nhmc'));
      w.create('ncop', P_NEUTRAL, F());
      G.cameraBounds(R.Troubled_Waters);
      G.startTimer(90, 'Time Left');
      G.say('Troubled Beans', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.TroubledFinish.enable(); T.TroubledDeath.enable(); T.TroubledSpawn.enable();
      yield 4;
      G.forBots(() => T.TroubledAI.enable());
    });

    G.trig('TroubledFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.TroubledFinish, rect: R.Troubled_Finish });

    G.trig('TroubledSpawn', function* () {
      for (let k = 0; k < 2; k++) {
        const p = offset(F(), 256, w.rng.int(-1, 1) * TW.lane);
        if (w.ofType('h005').some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 64)) continue;
        const u = w.create('h005', P_ENEMY, p, 180); u.acquire = 0; u.coll = 0; u.baseSpeed = TW.speed;
      }
    }).every(2.5);

    G.trig('TroubledDeath', function* () {
      const ws = w.ofType('h005');
      for (const u of ws) { u.x -= TW.speed * 0.05; u.vx = -TW.speed; u.moving = true; if (u.x < R.Troubled_Waters.x0 - 64) w.remove(u); }
      for (const b of G.beans()) if (ws.some((u) => u.alive && Math.hypot(u.x - b.x, u.y - b.y) <= TW.hitR)) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'h005', r: 60 }); G.boom(b); }
    }).every(0.05);

    // bots: run east in their lane, hop to a lane with no wave coming soon
    G.trig('TroubledAI', function* () {
      const ws = w.ofType('h005'), cy = F().y, goal = F();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const look = u.twLook ??= w.rng.real(1.0, 1.6);
          const threat = (ly, t) => ws.some((o) => Math.abs(o.y - ly) < TW.hitR + 10 && o.x > u.x - 40 && (o.x - u.x) / (TW.speed + u.speed) < t);
          const lanes = [-1, 0, 1].map((k) => cy + k * TW.lane);
          const cur = lanes.reduce((a, l) => (Math.abs(l - u.y) < Math.abs(a - u.y) ? l : a));
          let want = u.twLane ?? cur;
          if (threat(want, look)) {
            const free = lanes.filter((l) => !threat(l, look + Math.abs(l - u.y) / u.speed)).sort((a, b) => Math.abs(a - u.y) - Math.abs(b - u.y));
            if (free.length) want = free[0];
          }
          u.twLane = want;
          const dy = want - u.y;
          if (Math.abs(dy) > 8) w.issue(u, { type: 'steer', dx: threat(u.y, 0.5) ? -0.2 : 0.15, dy: Math.sign(dy) });
          else w.issue(u, { type: 'steer', dx: 1, dy: (goal.y - u.y) * 0 });
        }
      });
    }).every(0.1);

    return init;
  },
};
