// The Tauren Bean-Tragedy — based on "The Tauren Tragedy" (Triggers_Events[10]).
// Kept: the barracks in the middle, beans start 400 out, after 7 s every 1.5 s
// one soldier per player marches out of the barracks (max 50), soldiers hunt
// the beans, Shockwave (800 long, 125 wide, 1050 speed) on a tiny mana budget,
// last bean standing wins.
// Polished: a soldier touch = out; soldiers are a bit slower than beans so
// you can kite; Space fires a Shockwave at the cursor (2 per round) that wipes
// soldiers and stuns beans it hits for 1.5 s; 90 s timer.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const TAUREN = { speed: 250, soldierSpeed: 185, soldierR: 24, max: 50, waves: 2, waveLen: 800, waveW: 62, waveSpeed: 1050, stun: 1.5 };

export default {
  num: 10, id: 'tauren', title: 'The Tauren Bean-Tragedy', orig: 'The Tauren Tragedy',
  subtitle: 'Survive as long as possible!', arena: 'tauren_tragedy', rect: 'Tauren_Tragedy', kind: 'survival',
  hint: 'Run from the toy soldiers! Space = Shockwave at the cursor (2 per round). Soldier touch = out.',
  objective: 'Be the last bean standing. Out: a toy soldier touches you.',
  clip: ['Tauren_Tragedy', 64, 64],
  action(G, u, target, aim) { return G.v.tauren ? G.v.tauren.wave(u, target || aim) : false; },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Tauren_Tragedy);
    const S = (v.tauren = {});

    S.wave = (u, p) => {
      if (!p || (u.waves || 0) <= 0 || w.t < (u.waveCd || 0) || w.t < u.pauseUntil) return false;
      u.waves -= 1; u.waveCd = w.t + 0.8;
      const a = angleTo(u, p), round = G.round(), o = { x: u.x, y: u.y };
      u.facing = a;
      w.emit({ k: 'sfx', id: 'boom' }); w.emit({ k: 'text3d', x: u.x, y: u.y + 50, text: u.waves + ' left', color: '#ffd23f' });
      w.spawn(function* () {
        const hitB = new Set();
        for (let d = 40; d <= TAUREN.waveLen; d += TAUREN.waveSpeed * 0.05) {
          if (G.round() !== round || !T.TaurenTick.enabled) return;
          const c = polar(o, d, a);
          w.emit({ k: 'ring', x: c.x, y: c.y, r: TAUREN.waveW, color: 0xffd23f, dur: 0.35 });
          for (const f of w.ofType('hfoo')) if (dist(f, c) <= TAUREN.waveW + f.coll) w.explode(f);
          for (const b of G.beans()) if (b !== u && !hitB.has(b) && dist(b, c) <= TAUREN.waveW + b.coll) { hitB.add(b); b.pauseUntil = w.t + TAUREN.stun; b.order = null; w.emit({ k: 'purge', id: b.id, src: u.id }); }
          yield 0.05;
        }
      });
      return true;
    };

    const init = G.trig('TaurenInitialization', function* () {
      G.music('Comradeship');
      v.tiesPossible = true;
      const bar = w.create('hbar', P_ENEMY, C()); bar.invuln = true; bar.acquire = 0;
      G.forPlaying((i) => { const b = G.bean('Otch', i, polar(C(), 400, w.rng.dir()), { speed: TAUREN.speed }); b.waves = TAUREN.waves; });
      G.addKey(w.ofType('Otch'));
      G.cameraBounds(R.Tauren_Tragedy);
      G.startTimer(90, 'Time Left');
      G.say('The Tauren Bean-Tragedy', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.TaurenTick.enable();
      yield 7;
      T.TaurenSpawn.enable(); T.TaurenChase.enable();
      G.forBots(() => T.TaurenAI.enable());
    });

    G.trig('TaurenSpawn', function* () {
      G.forPlaying(() => {
        if (w.ofType('hfoo').length >= TAUREN.max) return;
        const f = w.create('hfoo', P_ENEMY, polar(C(), 160, w.rng.dir())); f.acquire = 0; f.baseSpeed = TAUREN.soldierSpeed; f.coll = TAUREN.soldierR;
      });
    }).every(1.5);

    // soldiers hunt the nearest bean (acquire range 1000)
    G.trig('TaurenChase', function* () {
      const beans = G.beans();
      for (const f of w.ofType('hfoo')) {
        let best = null, bd = 1000;
        for (const b of beans) { const d = dist(f, b); if (d < bd) { bd = d; best = b; } }
        if (best) w.issue(f, { type: 'move', x: best.x, y: best.y }); else if (f.order) w.issue(f, { type: 'stop' });
      }
    }).every(0.3);

    G.trig('TaurenTick', function* () {
      const fs = w.ofType('hfoo');
      for (const b of G.beans()) if (fs.some((f) => dist(f, b) <= f.coll + b.coll + 2)) w.kill(b);
    }).every(0.05);

    // bots: steer away from soldiers (and walls), blast a Shockwave when crowded
    G.trig('TaurenAI', function* () {
      const fs = w.ofType('hfoo');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pauseUntil) continue;
          let fx = 0, fy = 0, close = 0, nd = 1e9, near = null;
          for (const f of fs) {
            const d = Math.max(1, dist(f, u)); if (d < nd) { nd = d; near = f; }
            if (d < 500) { fx += (u.x - f.x) / (d * d); fy += (u.y - f.y) / (d * d); }
            if (d < 260) close++;
          }
          const k = (u.panic ??= w.rng.real(110, 170));
          if (near && u.waves > 0 && (nd < k || close >= 4) && w.rng.next() < 0.7) {
            // aim at the densest soldier direction
            let bestA = angleTo(u, near), bestN = 0;
            for (let a = 0; a < 360; a += 30) { let n = 0; for (const f of fs) { const d = dist(f, u); if (d < 500 && Math.abs(((angleTo(u, f) - a) % 360 + 540) % 360 - 180) < 12) n++; } if (n > bestN) { bestN = n; bestA = a; } }
            if (nd < k) bestA = angleTo(u, near);
            if (S.wave(u, polar(u, 300, bestA))) continue;
          }
          // pull towards open space in the ring
          const c = C(), dc = dist(u, c);
          fx += (c.x - u.x) / dc * (dc > 480 ? 0.004 : 0.0005); fy += (c.y - u.y) / dc * (dc > 480 ? 0.004 : 0.0005);
          if (dc < 260) { fx -= (c.x - u.x) / dc * 0.004; fy -= (c.y - u.y) / dc * 0.004; }
          if (Math.hypot(fx, fy) < 1e-6) { if (!u.order && w.rng.next() < 0.1) w.issue(u, { type: 'move', ...polar(u, w.rng.real(200, 400), angleTo(c, u) + w.rng.real(-120, 120)) }); continue; }
          const a = Math.atan2(fy, fx) * 180 / Math.PI;
          let best = null;
          for (const da of [0, 30, -30, 60, -60, 90, -90, 130, -130]) { const p = polar(u, 120, a + da); if (w.grid.walkable(p.x, p.y, u.coll)) { best = p; break; } }
          if (best) w.issue(u, { type: 'move', ...best });
        }
      });
    }).every(0.2);

    return init;
  },
};
