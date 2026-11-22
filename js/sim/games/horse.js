// Horse Bean Race — based on "Horse Race" (Triggers_Events[24]).
// Kept: 8 lanes (Horse_1..8), finish 4608 to the east, everyone frozen for 6 s,
// then running on their own; speed drops by 2 every 0.05 s down to 60, the
// boost sets it to 320 (1 s cooldown), 60 s timer, race scoring.
// Polished: "don't overdo it" is now a real rule: boosting again before the
// green ring shows (1.2 s) makes your bean trip for 1 s. A traffic light counts down the start.
import { P_NEUTRAL, center, offset } from '../engine.js';

const HR = { top: 320, min: 60, decay: 40, ready: 1.2, trip: 1.0 };

export default {
  num: 24, id: 'horse', title: 'Horse Bean Race', orig: 'Horse Race',
  subtitle: 'Press Space to speed up, but don’t overdo it!', arena: 'horse_race', rect: 'Horse_Race', kind: 'race', noMove: true,
  hint: 'Space = sprint! Wait for the green ring between sprints, or you trip.',
  objective: 'Reach the end of your lane first. Sprinting too early makes you trip.',
  clip: ['Horse_Race', 64, 64],
  action(G, u) { return G.v.horse.boost(u); },
  install(G) {
    const { w, T, R, v } = G;
    const H = (v.horse = { go: false });

    H.boost = (u) => {
      if (!H.go || !u.alive || w.t < u.pauseUntil) return false;
      if (w.t < u.hrReady) { // overdid it: trip
        u.pauseUntil = w.t + HR.trip; u.baseSpeed = HR.min; u.hrReady = w.t + HR.trip + 0.3; u.hrRang = false;
        w.emit({ k: 'text3d', x: u.x, y: u.y + 40, text: 'Oof!', color: '#ff4d5e' });
        return true;
      }
      u.baseSpeed = HR.top; u.hrReady = w.t + HR.ready; u.hrRang = false;
      w.emit({ k: 'impact', x: u.x, y: u.y, type: 'boost', r: 30 }); w.emit({ k: 'sfx', id: 'pop' });
      return true;
    };

    const init = G.trig('HorseInitialization', function* () {
      G.music('illidan');
      v.ante = 8; H.go = false;
      G.forPlaying((i) => {
        const c = center(R['Horse_' + i]);
        const b = G.bean('nwzg', i, c); b.x = c.x; b.y = c.y; b.coll = 14; b.facing = 0; b.baseSpeed = HR.min; b.hrReady = 0; b.hrRang = true; b.hrLane = c.y;
        w.create('ncp2', P_NEUTRAL, offset(c, 4608, 0), 0).coll = 0;
      });
      G.addKey(w.ofType('nwzg'));
      w.create('ncop', P_NEUTRAL, center(R.Horse_Finish));
      G.cameraBounds(R.Horse_Race);
      G.startTimer(60, 'Time Left');
      G.say('Horse Bean Race', 'Press Space to speed up, but don’t overdo it!');
      T.RaceDeath.enable(); T.RaceExpire.enable();
      w.emit({ k: 'light', c: 'red' });
      yield 4; w.emit({ k: 'light', c: 'yellow' });
      yield 2; w.emit({ k: 'light', c: 'green' });
      H.go = true;
      for (const b of G.beans()) b.baseSpeed = HR.top;
      T.HorseRun.enable(); T.HorseFinish.enable();
      G.forBots(() => T.HorseAI.enable());
    });

    G.trig('HorseRun', function* () {
      for (const b of G.beans()) {
        if (b.baseSpeed > HR.min) b.baseSpeed = Math.max(HR.min, b.baseSpeed - 2);
        b.y = b.hrLane;
        if (!b.order || b.order.type !== 'steer') b.order = { type: 'steer', dx: 1, dy: 0 };
        if (!b.hrRang && w.t >= b.hrReady) { b.hrRang = true; w.emit({ k: 'ring', x: b.x, y: b.y, r: 40, color: 0x57e36b, dur: 0.4 }); }
      }
    }).every(0.05);

    G.trig('HorseFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.HorseFinish, rect: R.Horse_Finish });

    // bots: sprint some time after the ring, now and then too eagerly
    G.trig('HorseAI', function* () {
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pauseUntil) continue;
          if (u.hrNext == null) u.hrNext = w.t + (w.rng.next() < 0.07 ? w.rng.real(0.6, 1.1) : w.rng.real(1.25, 2.3));
          if (w.t >= u.hrNext) { H.boost(u); u.hrNext = null; }
        }
      });
    }).every(0.05);

    return init;
  },
};
