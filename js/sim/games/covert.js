// Covert Kitty-Bean — based on "Covert Kitty" (Triggers_Events[8]).
// Kept: start on the left, reach the circle on the right, 3 guards (Doom Guards)
// that wander to random spots every 7 s and cripple (slow) a bean within 400
// every 2 s, night that turns into day (hiding stops at dawn), race scoring.
// Polished: guards only chase beans they can see; standing still at night
// for 1 s hides you (shown with a ring); a guard touch = out; the night is
// sped up (about 50 s) and a 90 s timer ends the round.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, angleTo, polar } from '../engine.js';

export const COVERT = { speed: 250, guardR: 48, patrol: 190, chaseSpeed: 215, sight: 360, crippleSpeed: 200, cripple: 1.2, hideAfter: 1.0, todScale: 2 };

export default {
  num: 8, id: 'covert', title: 'Covert Kitty-Bean', orig: 'Covert Kitty',
  subtitle: 'Elude the guards!', arena: 'covert_kitty', rect: 'Covert_Kitty', kind: 'race',
  hint: 'Reach the circle on the right. Stand still at night to hide. A guard touch = out!',
  objective: 'Reach the circle on the right. Out: a guard touches you.',
  clip: ['Covert_Kitty', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Covert_Kitty);
    const goal = () => center(R.Covert_Finish);

    const init = G.trig('CovertInitialization', function* () {
      G.music('NightElf2');
      v.ante = 8;
      w.tod = 1; w.todRunning = true; w.todScale = COVERT.todScale;
      G.forPlaying((i) => { const b = G.bean('esen', i, w.randomIn(R.Covert_Start), { speed: COVERT.speed }); b.facing = 0; b.hidden = false; });
      G.addKey(w.ofType('esen'));
      for (const dx of [-128, 256, 640]) { const g = w.create('nbal', P_ENEMY, offset(C(), dx, 0)); g.acquire = 0; g.baseSpeed = COVERT.patrol; }
      w.create('ncop', P_NEUTRAL, goal());
      G.cameraBounds(R.Covert_Kitty);
      G.startTimer(90, 'Time Left');
      G.say('Covert Kitty-Bean', 'Elude the guards! Dawn is coming...');
      T.Dawn.enable(); T.RaceDeath.enable(); T.RaceExpire.enable(); T.CovertFinish.enable(); T.CovertTick.enable(); T.CovertGuards.enable(); T.CovertHide.enable();
      yield 2;
      T.CovertPatrol.enable(); T.CovertPatrol.execute();
      G.forBots(() => T.CovertAI.enable());
    });

    G.trig('CovertFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.CovertFinish, rect: R.Covert_Finish });

    G.trig('CovertPatrol', function* () {
      for (const g of w.ofType('nbal')) if (!g.chase) w.issue(g, { type: 'move', ...w.randomIn(R.Covert_Kitty) });
    }).every(7);

    // night + standing still for a second = hidden
    G.trig('CovertHide', function* () {
      for (const b of G.beans()) {
        const hide = w.isNight() && w.t - b.lastActive >= COVERT.hideAfter;
        if (hide !== b.hidden) {
          b.hidden = hide; b.invisible = hide;
          w.emit({ k: 'meld', id: b.id, on: hide });
          if (hide) w.emit({ k: 'ring', x: b.x, y: b.y, r: 45, color: 0x8a6cff, dur: 0.5 });
        }
      }
    }).every(0.1);

    // guards spot visible beans within 400, chase them and cripple them every 2 s
    G.trig('CovertGuards', function* () {
      for (const g of w.ofType('nbal')) {
        if (g.chase && (!g.chase.alive || g.chase.hidden || dist(g, g.chase) > 650 || w.t > g.chaseEnd)) { g.chase = null; g.baseSpeed = COVERT.patrol; g.rest = w.t + 1.5; w.issue(g, { type: 'move', ...w.randomIn(R.Covert_Kitty) }); }
        if (!g.chase && w.t > (g.rest || 0)) {
          let best = null, bd = COVERT.sight;
          for (const b of G.beans()) { const d = dist(g, b); if (!b.hidden && d < bd && w.grid.los(g.x, g.y, b.x, b.y, 8)) { bd = d; best = b; } }
          if (best) { g.chase = best; g.chaseEnd = w.t + 4; g.baseSpeed = COVERT.chaseSpeed; w.emit({ k: 'spotted', id: best.id, tower: g.id }); g.nextCripple = w.t + 0.5; }
        }
        if (g.chase) {
          w.issue(g, { type: 'move', x: g.chase.x, y: g.chase.y });
          if (w.t >= g.nextCripple && dist(g, g.chase) <= COVERT.sight) {
            g.nextCripple = w.t + 2;
            const b = g.chase; b.crippleUntil = w.t + COVERT.cripple; b.baseSpeed = COVERT.crippleSpeed;
            w.emit({ k: 'ring', x: b.x, y: b.y, r: 60, color: 0x57e36b, dur: 0.6 }); w.emit({ k: 'sfx', id: 'zap' });
          }
        } else if (!g.order) w.issue(g, { type: 'move', ...w.randomIn(R.Covert_Kitty) });
      }
    }).every(0.2);

    G.trig('CovertTick', function* () {
      const guards = w.ofType('nbal');
      for (const b of G.beans()) {
        if (b.crippleUntil && w.t >= b.crippleUntil) { b.crippleUntil = 0; b.baseSpeed = COVERT.speed; }
        if (guards.some((g) => dist(g, b) <= COVERT.guardR + b.coll)) w.kill(b);
      }
    }).every(0.05);

    // bots: the original runs for the goal when no guard is within 500 and hides
    // otherwise; at dawn everybody runs. Ours also run away from a chasing guard.
    G.trig('CovertAI', function* () {
      const guards = w.ofType('nbal');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let near = null, nd = 1e9;
          for (const g of guards) { const d = dist(g, u); if (d < nd) { nd = d; near = g; } }
          const chased = guards.find((g) => g.chase === u);
          const night = w.isNight();
          const nerve = u.nerve ??= w.rng.real(380, 560);
          if (!chased && night && near && nd < nerve && nd > 120) { if (u.order) w.issue(u, { type: 'stop' }); }
          else G.botGo(u, goal(), guards, { fear: chased ? 260 : 200, lead: 0.5 });
        }
      });
    }).every(0.25);

    return init;
  },
};
