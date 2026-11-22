// Bean Battle for the Bottle — based on "Battle for the Bottle" (Triggers_Events[50],
// never picked by the original map's filter but ported anyway).
// Kept: the Tauren Tragedy ring, brewmasters start 500 from the centre at
// i*135-22.5°, everyone frozen for the first 5 s, Breath of Fire (range 375),
// a mana bottle appears every 10 s within 500 of the centre, last bean standing.
// Polished: Breath of Fire is the only move: Space (or click a bean) breathes a
// fire cone after a short visible wind-up; caught in the cone = out. 6 s cooldown,
// a bottle refills it at once. The drunken camera wobble/colour flashes and
// Drunken Haze are dropped. 90 s timer instead of 180.
import { center, polar, dist, angleTo } from '../engine.js';

export const BREW = { range: 375, half: 26, windup: 0.45, cool: 6, grab: 50, maxBottles: 4 };

function breathe(G, u, dir) {
  const w = G.w, B = G.v.battle;
  if (!u.alive || w.t < (u.readyAt || 0) || u.breathing || u.paused) return false;
  u.breathing = true; u.readyAt = w.t + BREW.windup + BREW.cool; u.facing = dir;
  for (let k = 1; k <= 3; k++) { const p = polar(u, k * BREW.range / 3.2, dir); w.emit({ k: 'warn', id: 'brew' + u.id + k, x: p.x, y: p.y, r: 40 + k * 22, dur: BREW.windup, hot: true }); }
  const round = G.round();
  w.spawn(function* () {
    yield BREW.windup;
    u.breathing = false;
    if (G.round() !== round || !u.alive || !B.on) return;
    w.emit({ k: 'sfx', id: 'boom' });
    for (let k = 1; k <= 4; k++) { const p = polar(u, k * BREW.range / 4, dir); w.emit({ k: 'impact', x: p.x, y: p.y, type: 'fire', r: 30 + k * 18 }); }
    for (const b of G.beans()) {
      if (b === u) continue;
      const d = dist(u, b); if (d > BREW.range + b.coll) continue;
      let da = Math.abs(((angleTo(u, b) - dir) % 360 + 540) % 360 - 180);
      const slack = Math.atan2(b.coll, Math.max(1, d)) * 180 / Math.PI;
      if (da <= BREW.half + slack) { b.exploded = true; w.kill(b); }
    }
  });
  return true;
}

export default {
  num: 50, id: 'battle', title: 'Bean Battle for the Bottle', orig: 'Battle for the Bottle',
  subtitle: 'Kill your opponents!', arena: 'tauren_tragedy', rect: 'Tauren_Tragedy', kind: 'survival',
  hint: 'Space or click a bean = breathe fire (6 s cooldown). Bottles refill it. Don’t stand in the cone!',
  objective: 'Be the last bean standing. Out: dragon fire hits you.',
  clip: ['Tauren_Tragedy', 64, 64],
  canTarget(G, u, t) { return t !== u && G.key.has(t) && G.w.t >= (u.readyAt || 0); },
  action(G, u, target, aim) {
    const p = target && target !== u && target.alive ? target : aim;
    if (!p) return false;
    return breathe(G, u, angleTo(u, p));
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Tauren_Tragedy);
    const B = (v.battle = { on: false });

    const init = G.trig('BattleInitialization', function* () {
      G.music('war2intro');
      v.tiesPossible = true; B.on = true;
      G.forPlaying((i) => { const b = G.bean('Npbm', i, polar(C(), 500, i * 135 - 22.5), { speed: 270 }); b.paused = true; b.readyAt = 0; b.breathing = false; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('Npbm'));
      G.cameraBounds(R.Tauren_Tragedy);
      G.startTimer(95, 'Time Left');
      G.say('Bean Battle for the Bottle', 'Kill your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.BattleBottles.enable();
      yield 5;
      for (const b of G.beans()) b.paused = false;
      T.BattleSpawn.enable(); T.BattleSpawn.execute();
      G.forBots(() => T.BattleAI.enable());
    });

    G.trig('BattleSpawn', function* () {
      if (w.ofType('Hart').length >= BREW.maxBottles) return;
      let p = polar(C(), w.rng.real(0, 500), w.rng.dir());
      p = w.grid.nearestWalkable(p.x, p.y, 20) || p;
      const u = w.create('Hart', 16, p); u.x = p.x; u.y = p.y; u.coll = 0; u.baseSpeed = 0; u.invuln = true; u.acquire = 0; u.paused = true;
      w.emit({ k: 'ring', x: p.x, y: p.y, r: 50, color: 0x7fd3ff, dur: 0.6 });
    }).every(10);

    G.trig('BattleBottles', function* () {
      for (const bt of w.ofType('Hart')) for (const b of G.beans()) if (dist(b, bt) <= BREW.grab) {
        b.readyAt = Math.min(b.readyAt || 0, w.t);
        w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'Refill!', color: '#7fd3ff' }); w.emit({ k: 'sfx', id: 'ding' });
        w.remove(bt); break;
      }
    }).every(0.05);

    // bots: grab nearby bottles, breathe at a bean in range (aiming ahead), dodge cones,
    // keep away from ready opponents while recharging
    G.trig('BattleAI', function* () {
      const beans = G.beans(), bottles = w.ofType('Hart');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || u.breathing) continue;
          const ready = w.t >= (u.readyAt || 0);
          // dodge a cone that is winding up at us
          const threat = beans.find((o) => o !== u && o.breathing && dist(o, u) < BREW.range + 60 && Math.abs(((angleTo(o, u) - o.facing) % 360 + 540) % 360 - 180) < BREW.half + 15);
          if (threat) { const side = w.rng.next() < 0.5 ? 90 : -90; const p = polar(u, 160, threat.facing + side); w.issue(u, { type: 'move', ...p }); continue; }
          let foe = null, fd = 1e9; for (const o of beans) if (o !== u) { const d = dist(u, o); if (d < fd) { fd = d; foe = o; } }
          if (ready && foe && fd < BREW.range * 0.85 && w.rng.next() < (u.aggro ??= w.rng.real(0.25, 0.6))) {
            const lead = BREW.windup * (u.skill ??= w.rng.real(0.3, 1));
            breathe(G, u, angleTo(u, { x: foe.x + (foe.vx || 0) * lead, y: foe.y + (foe.vy || 0) * lead })); continue;
          }
          let bot = null, bd = ready ? 250 : 600; for (const b of bottles) { const d = dist(u, b); if (d < bd) { bd = d; bot = b; } }
          if (bot) { w.issue(u, { type: 'move', x: bot.x, y: bot.y }); continue; }
          if (foe && ready) { w.issue(u, { type: 'move', ...polar(foe, 260, angleTo(foe, u) + w.rng.real(-40, 40)) }); continue; }
          if (foe && fd < 450) { let p = polar(u, 200, angleTo(foe, u) + w.rng.real(-60, 60)); if (dist(p, C()) > 560) p = polar(C(), 450, angleTo(C(), p)); w.issue(u, { type: 'move', ...p }); continue; }
          if (!u.order) w.issue(u, { type: 'move', ...polar(C(), w.rng.real(0, 450), w.rng.dir()) });
        }
      });
    }).every(0.2);

    return init;
  },
};
