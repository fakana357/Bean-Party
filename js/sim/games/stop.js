// Stop and Glow — based on "Stop and Go" (Triggers_Events[18]).
// Kept: the lane, 10 towers in two rows, the light cycle (red 5-9 s, green
// 3-5 s, yellow 1 s), a one-shot freeze (Purge: 1 s stop, then slowed for 5 s),
// race scoring (8, 7, 6...).
// Polished: the rule is simply "moving on red = zapped" (instead of night-time
// shadowmeld), beans are faster, and the 100 s night is a visible round timer.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, ABIL } from '../engine.js';

export const STOP = { speed: 100, grace: 0.35, time: 100 };

export default {
  num: 18, id: 'stop', title: 'Stop and Glow', orig: 'Stop and Go',
  subtitle: 'Stop on red, and go on green!', arena: 'stop', rect: 'Stop_and_Go', kind: 'race',
  hint: 'Move on green, freeze on red! Click a bean to freeze them for a second (once).',
  objective: 'Reach the finish line. Out: you move while the light is red.',
  canTarget(G, u, t) { return u.mana >= 75 && t !== u; },
  action(G, u, target, aim) {
    const w = G.w;
    if (!target && aim) { let bd = 1e9; for (const b of G.beans()) if (b !== u) { const d = dist(b, aim); if (d < bd) { bd = d; target = b; } } }
    if (!target || target === u || !target.alive || !G.key.has(target)) return false;
    if (u.mana < 75 || dist(u, target) > ABIL.A007.range) return false;
    u.mana -= 75;
    const P = ABIL.A007; target.pauseUntil = w.t + P.pause; target.purgeStart = w.t; target.purgeEnd = w.t + P.dur; target.order = null;
    w.emit({ k: 'purge', id: target.id, src: u.id });
    return true;
  },
  clip: ['Stop_and_Go', 460, 40],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Stop_and_Go);
    v.light = 'red'; v.redAt = 0;
    const towers = () => w.ofPlayer(P_ENEMY);

    const init = G.trig('StopInitialization', function* () {
      G.music('lichking');
      v.ante = 8;
      w.tod = 1; w.todRunning = true;
      G.forPlaying((i) => { const u = G.bean('nsea', i, offset(C(), w.rng.real(-100, 100), -512), { speed: STOP.speed }); u.mana = 75; });
      G.addKey(w.ofType('nsea'));
      for (const dy of [512, 256, 0, -256, -512]) for (const dx of [-384, 384]) { const t = w.create('uzg1', P_ENEMY, offset(C(), dx, dy)); t.acquire = 0; }
      w.create('ncop', P_NEUTRAL, center(R.Stop_Finish));
      G.cameraBounds(R.Stop_and_Go);
      G.startTimer(STOP.time, 'Dawn');
      G.say('Stop and Glow', 'Stop on red, and go on green!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.StopFinish.enable(); T.StopAI.enable(); T.StopWatch.enable();
      T.StopRedLight.execute();
    });

    G.trig('StopFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.StopFinish, rect: R.Stop_Finish });

    // red light: any bean that moves after a short grace gets zapped by the nearest lighthouse
    G.trig('StopWatch', function* () {
      if (v.light !== 'red' || w.t - v.redAt < STOP.grace) return;
      for (const b of G.beans()) {
        if (b.zapped || w.t - b.lastActive > 0.08) continue;
        b.zapped = true;
        let tw = null, bd = 1e9; for (const t of towers()) { const d = dist(t, b); if (d < bd) { bd = d; tw = t; } }
        w.issue(b, { type: 'stop' }); b.pauseUntil = w.t + 5;
        w.emit({ k: 'spotted', id: b.id, tower: tw?.id });
        w.shoot(tw || b, b, { speed: 1400, type: 'uzg1', onHit: (m, t) => { if (t && t.alive) w.kill(t); } });
      }
    }).every(0.05);

    G.trig('StopAI', function* () {
      if (v.light === 'green') return;
      G.forBots((i) => { for (const u of G.keyOf(i)) if (u.order && w.rng.int(1, 3) === 1) w.issue(u, { type: 'stop' }); });
    }).every(0.25);

    const light = (c) => { v.light = c; if (c === 'red') v.redAt = w.t; w.emit({ k: 'light', c }); };

    G.trig('StopGreenLight', function* () {
      light('green');
      G.forBots((i) => { for (const u of G.keyOf(i)) if (u.alive && w.rng.next() < 0.85) w.issue(u, { type: 'move', ...center(R.Stop_Finish) }); });
      yield w.rng.real(3, 5);
      if (!T.StopFinish.enabled) return;
      T.StopYellowLight.execute();
    });
    G.trig('StopYellowLight', function* () {
      light('yellow');
      yield 1;
      if (!T.StopFinish.enabled) return;
      T.StopRedLight.execute();
    });
    G.trig('StopRedLight', function* () {
      light('red');
      yield w.rng.real(5, 9);
      if (!T.StopFinish.enabled) return;
      T.StopGreenLight.execute();
    });

    return init;
  },
};
