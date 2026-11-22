// Wheel of Bean Fire — based on "Wheel of Fire" (Triggers_Events[47]).
// Kept: the square yard, beans start in the 4 corner zones (Wheel_1..4), a fire
// sprite in the middle and 4 spokes of 5 sprites (128 apart) turning around it,
// random starting direction, the wheel speeds up (rate +0.01 per 0.05 s, max 10)
// and reverses after reaching 2°/step, holding a little longer each time.
// Polished: touching a fire sprite = out, the spin may get faster before each
// reversal as the round goes on, a 90 s timer ends the round, ties possible.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const WHEEL = { spokes: 4, per: 5, gap: 128, touch: 40, maxSpeed: 2.5 };

export default {
  num: 47, id: 'wheel', title: 'Wheel of Bean Fire', orig: 'Wheel of Fire',
  subtitle: 'Survive as long as possible!', arena: 'wheel_of_fire', rect: 'Wheel_of_Fire', kind: 'survival',
  hint: 'The fire wheel spins and reverses. Stay between the spokes — touching fire = out!',
  objective: 'Be the last bean standing. Out: you touch the fire wheel.',
  clip: ['Wheel_of_Fire', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Wheel_of_Fire);
    const S = (v.wheel = { cw: false, angle: 0, rate: 0, speed: 0, curve: 0, holding: false, armed: true, sprites: [] });

    const init = G.trig('WheelInitialization', function* () {
      v.tiesPossible = true;
      Object.assign(S, { t0: w.t, cw: w.rng.next() < 0.5, angle: 0, rate: 0, speed: 0, curve: 0, holding: false, armed: true, sprites: [] });
      const regs = [R.Wheel_1, R.Wheel_2, R.Wheel_3, R.Wheel_4];
      G.forPlaying((i) => G.bean('nsat', i, w.randomIn(w.rng.pick(regs)), { speed: 270 }));
      G.addKey(w.ofType('nsat'));
      const mk = (p, spoke, r) => {
        const u = w.create('ewsp', P_ENEMY, p); u.abils = u.abils.filter((a) => a !== 'ANpi'); u.acquire = 0; u.paused = true;
        u.spoke = spoke; u.rad = r; S.sprites.push(u); return u;
      };
      mk(C(), 0, 0);
      for (let a = 1; a <= WHEEL.spokes; a++) for (let b = 1; b <= WHEEL.per; b++) mk(polar(C(), b * WHEEL.gap, a * 90), a, b * WHEEL.gap);
      G.cameraBounds(R.Wheel_of_Fire);
      G.startTimer(90, 'Time Left');
      G.say('Wheel of Bean Fire', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.WheelMotion.enable();
      G.forBots(() => T.WheelAI.enable());
    });

    G.trig('WheelReverse', function* () {
      S.holding = true;
      const round = G.round();
      yield S.curve + 1;
      if (G.round() !== round || !T.WheelMotion.enabled) return;
      S.curve += 1; S.cw = !S.cw; S.holding = false;
    });

    G.trig('WheelMotion', function* () {
      if (S.rate < 10) S.rate += 0.01;
      S.speed += (S.cw ? -1 : 1) * S.rate / 1000;
      // the wheel gets meaner over time: it may spin faster before it reverses
      const rev = Math.min(4.5, 2 + (w.t - S.t0) / 30);
      S.speed = Math.max(-rev - 0.5, Math.min(rev + 0.5, S.speed));
      S.angle += S.speed;
      if (S.armed && Math.abs(S.speed) >= rev) { S.armed = false; T.WheelReverse.execute(); }
      if (!S.armed && !S.holding && Math.abs(S.speed) < 1) S.armed = true;
      const c = C();
      for (const u of S.sprites) {
        if (!u.spoke) continue;
        const p = polar(c, u.rad, u.spoke * 90 + S.angle);
        u.x = p.x; u.y = p.y; u.facing = u.spoke * 90 + S.angle + (S.speed > 0 ? 90 : -90);
      }
      for (const b of G.beans()) if (S.sprites.some((s) => dist(b, s) <= b.coll + WHEEL.touch)) G.boom(b);
    }).every(0.05);

    // bots: hold the middle of a sector at a comfortable radius and turn with the wheel
    G.trig('WheelAI', function* () {
      const c = C();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const rr = u.prefR ??= w.rng.real(170, 330);
          const r = Math.min(rr, Math.abs(S.speed) > 1.5 ? 220 / Math.max(1, Math.abs(S.speed) / 2) : rr);
          const rel = (((angleTo(c, u) - S.angle) % 90) + 90) % 90; // 0..90 inside a sector
          const base = angleTo(c, u) - rel;
          const lead = S.speed * 20 * (u.lead ??= w.rng.real(0.25, 0.6));
          const p = polar(c, r, base + 45 + lead);
          w.issue(u, { type: 'move', x: p.x, y: p.y });
        }
      });
    }).every(0.15);

    return init;
  },
};
