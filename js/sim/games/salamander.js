// Sala-Bean-der Sizzle — based on "The Salamander Sizzle" (Triggers_Events[21]).
// Kept: beans start 800 from the centre (angle slot*135-22.5), a breath shoots a
// fire sprite from 128 ahead, flying straight at 350 for ~6 s, shrubs (DTsh)
// block a fireball and burn away, survival scoring.
// Polished: Space breathes fire toward the cursor (1.2 s cooldown), any
// fireball touch = out, 90 s timer instead of 150 s, bots aim with lead and dodge.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

const SAL = { cool: 1.2, life: 6, speed: 350, hitR: 66, shrubR: 80 };

export default {
  num: 21, id: 'salamander', title: 'Sala-Bean-der Sizzle', orig: 'The Salamander Sizzle',
  subtitle: 'Shoot fire and sizzle your opponents!', arena: 'salamander_sizzle', rect: 'Salamander_Sizzle', kind: 'survival',
  hint: 'Space = breathe a fireball toward the cursor. Touch any fireball and you sizzle!',
  objective: 'Be the last bean standing. Out: a fireball touches you.',
  clip: ['Salamander_Sizzle', 64, 64],
  canTarget(G, u, t) { return t !== u && t.alive && G.key.has(t); },
  action(G, u, target, aim) {
    const p = target && target.alive && target !== u ? target : aim;
    if (!p) return false;
    return G.v.salamander.fire(u, angleTo(u, p));
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Salamander_Sizzle);
    const S = (v.salamander = { live: false });

    S.fire = (u, ang) => {
      if (!S.live || !u.alive || w.t < (u.salCd || 0)) return false;
      u.salCd = w.t + SAL.cool; u.facing = ang;
      const f = w.create('ewsp', P_ENEMY, polar(u, 128, ang), ang);
      f.abils = f.abils.filter((a) => a !== 'ANpi');
      f.baseSpeed = SAL.speed; f.salEnd = w.t + SAL.life; f.salDir = ang;
      w.issue(f, { type: 'move', ...polar(u, 3000, ang) });
      w.emit({ k: 'sfx', id: 'shoot' });
      return true;
    };

    const init = G.trig('SalamanderInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true; S.live = false;
      G.forPlaying((i) => { const b = G.bean('nslr', i, polar(C(), 800, i * 135 - 22.5), { speed: 270 }); b.salCd = 0; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('nslr'));
      for (const d of w.destIn(R.Salamander_Sizzle)) if (d.id === 'DTsh') w.setDest(d, true);
      G.cameraBounds(R.Salamander_Sizzle);
      G.startTimer(90, 'Time Left');
      G.say('Sala-Bean-der Sizzle', 'Shoot fire and sizzle your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.SalamanderBurn.enable();
      yield 3;
      S.live = true;
      G.forBots(() => T.SalamanderAI.enable());
    });

    // fireballs: burn out after their life, burn shrubs, sizzle beans
    G.trig('SalamanderBurn', function* () {
      const fires = w.ofType('ewsp');
      for (const f of fires) {
        if (w.t >= f.salEnd || !w.grid.walkable(f.x, f.y, 1) && dist(f, C()) > 1300) { w.remove(f); continue; }
        let hitShrub = false;
        for (const d of w.grid.dest) if (d.alive && d.id === 'DTsh' && Math.hypot(d.x - f.x, d.y - f.y) <= SAL.shrubR) { w.setDest(d, false); hitShrub = true; }
        if (hitShrub) { w.emit({ k: 'impact', x: f.x, y: f.y, type: 'ewsp', r: 60 }); w.remove(f); }
      }
      const live = w.ofType('ewsp');
      for (const b of G.beans()) for (const f of live) if (dist(b, f) <= SAL.hitR) { G.boom(b); w.quake = 300; break; }
    }).every(0.05);

    // bots: dodge incoming fireballs, keep a fighting distance, shoot with lead
    G.trig('SalamanderAI', function* () {
      const fires = w.ofType('ewsp'), beans = G.beans();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          // dodge: closest approach of each fireball in the next second
          let dodge = null;
          for (const f of fires) {
            const a = f.salDir * Math.PI / 180, vx = Math.cos(a), vy = Math.sin(a);
            const rx = u.x - f.x, ry = u.y - f.y, along = rx * vx + ry * vy;
            if (along < 0 || along > 450) continue;
            const side = -rx * vy + ry * vx;
            if (Math.abs(side) < SAL.hitR + 40) { const s = side >= 0 ? 1 : -1; dodge = { dx: -vy * s, dy: vx * s }; break; }
          }
          if (dodge && w.rng.next() < 0.8) { w.issue(u, { type: 'steer', ...dodge }); u.salMoveT = w.t + 0.4; continue; }
          const foes = beans.filter((b) => b.owner !== u.owner);
          let tg = null, td = 1e9; for (const b of foes) { const d = dist(u, b); if (d < td) { td = d; tg = b; } }
          if (!tg) continue;
          if (w.t >= (u.salMoveT || 0)) {
            u.salMoveT = w.t + w.rng.real(0.6, 1.6);
            let ang = angleTo(u, tg) + (td < 400 ? 180 : td > 800 ? 0 : 90 * (w.rng.next() < 0.5 ? 1 : -1)) + w.rng.real(-30, 30);
            let p = polar(u, w.rng.real(120, 260), ang);
            if (dist(p, C()) > 850) p = polar(C(), 700, angleTo(C(), p));
            w.issue(u, { type: 'move', ...p });
          }
          if (w.t >= u.salCd && td < 1000 && w.rng.next() < 0.35) {
            const t = td / SAL.speed, lead = w.rng.real(0.4, 1.0);
            const p = { x: tg.x + (tg.vx || 0) * t * lead, y: tg.y + (tg.vy || 0) * t * lead };
            S.fire(u, angleTo(u, p) + w.rng.real(-8, 8));
          }
        }
      });
    }).every(0.2);

    return init;
  },
};
