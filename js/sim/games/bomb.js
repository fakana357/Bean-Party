// Bomb Baldbean — based on "Bomb Baldwin" (Triggers_Events[11]).
// Kept: bomb-copters start 700 from the farm at (slot*135 - 22.5)°, a 5 s
// frozen start, then one "Baldwin" per player plus 2 look-alikes pour out of
// the farm and wander, 2 s between bombs, 60 s timer, race scoring (each
// Baldwin you bomb finishes you, first finisher scores most).
// Polished: hovering the cursor to read names is replaced by a readable tell:
// Baldwins panic and run when a copter flies close, look-alikes don't.
// Bombing a look-alike scatters the crowd and makes your copter dizzy for 2 s.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const BOMB = { speed: 350, range: 450, cool: 2, flight: 650, blastR: 70, decoys: 2, panicR: 230, panicSpeed: 255, walk: 190, dizzy: 2 };

export default {
  num: 11, id: 'bomb', title: 'Bomb Baldbean', orig: 'Bomb Baldwin',
  subtitle: 'Find and bomb Baldwin!', arena: 'bomb_baldwin', rect: 'Bomb_Baldwin', kind: 'race',
  hint: 'Space = drop a bomb at the cursor. Hit a Baldwin to finish! Baldwins panic when you fly close.',
  objective: 'Hit a Baldwin with your bomb to finish. First hit = best place.',
  clip: ['Bomb_Baldwin', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) { return G.v.bomb ? G.v.bomb.drop(u, aim || target) : false; },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Bomb_Baldwin);
    const B = (v.bomb = {});
    const inset = 60, clamp = (u) => { const r = R.Bomb_Baldwin; u.x = Math.max(r.x0 + inset, Math.min(r.x1 - inset, u.x)); u.y = Math.max(r.y0 + inset, Math.min(r.y1 - inset, u.y)); };
    const peasants = () => w.alive((u) => u.type === 'h000' || u.type === 'hpea');
    const wander = (p) => { const q = w.randomIn(R.Bomb_Baldwin); w.issue(p, { type: 'move', x: q.x, y: q.y }); };

    B.drop = (u, p) => {
      if (!p || u.paused || w.t < (u.nextBomb || 0) || w.t < u.pauseUntil || !G.key.has(u)) return false;
      u.nextBomb = w.t + BOMB.cool;
      let q = p; if (dist(u, q) > BOMB.range) q = polar(u, BOMB.range, angleTo(u, q));
      const round = G.round();
      w.emit({ k: 'sfx', id: 'throw' });
      w.lob(u, q.x, q.y, { speed: BOMB.flight, arc: 0.3, type: 'boulder', onImpact: () => { if (G.round() === round && T.BombTick.enabled) land(u, q); } });
      return true;
    };
    function land(u, q) {
      w.emit({ k: 'boom', x: q.x, y: q.y, r: BOMB.blastR });
      let hit = null, hd = BOMB.blastR;
      for (const p of peasants()) { const d = dist(p, q) - p.coll; if (d <= hd) { hd = d; hit = p; } }
      if (!hit) return;
      const baldwin = hit.type === 'h000';
      w.explode(hit);
      if (baldwin) {
        if (u.alive && G.key.has(u)) { w.emit({ k: 'text3d', x: q.x, y: q.y + 40, text: 'Baldwin!', color: '#ffd23f' }); v.focus = u; T.RaceFinish.execute(); }
      } else {
        w.emit({ k: 'text3d', x: q.x, y: q.y + 40, text: 'Not Baldwin!', color: '#ff4d5e' });
        if (u.alive) { u.pauseUntil = w.t + BOMB.dizzy; u.order = null; w.emit({ k: 'purge', id: u.id, src: u.id }); }
        for (const p of peasants()) w.issue(p, { type: 'move', ...polar(p, w.rng.real(300, 500), angleTo(q, p) + w.rng.real(-40, 40)) });
      }
    }

    const init = G.trig('BombInitialization', function* () {
      G.music('TragicConfrontation');
      v.ante = 8;
      G.forPlaying((i) => { const b = G.bean('hgyr', i, polar(C(), 700, i * 135 - 22.5), { speed: BOMB.speed }); b.facing = angleTo(b, C()); b.nextBomb = 0; });
      G.addKey(w.ofType('hgyr'));
      const farm = w.create('hhou', P_ENEMY, C()); farm.invuln = true; farm.acquire = 0;
      G.cameraBounds(R.Bomb_Baldwin);
      G.startTimer(60, 'Time Left');
      G.say('Bomb Baldbean', 'Find and bomb Baldwin!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.BombTick.enable();
      w.pauseAll(true);
      yield 5;
      w.pauseAll(false);
      const n = G.beans().length, kinds = [];
      for (let k = 0; k < n; k++) kinds.push('h000');
      for (let k = 0; k < BOMB.decoys; k++) kinds.push('hpea');
      for (const t of kinds) { const p = w.create(t, P_ENEMY, polar(C(), w.rng.real(50, 64), w.rng.dir())); p.acquire = 0; p.baseSpeed = BOMB.walk; p.abils = []; wander(p); }
      T.BombCrowd.enable();
      G.forBots(() => T.BombAI.enable());
    });

    G.trig('BombTick', function* () { for (const b of G.beans()) clamp(b); }).every(0.025);

    // peasants wander; real Baldwins panic and flee from nearby copters
    G.trig('BombCrowd', function* () {
      const cs = G.beans();
      for (const p of peasants()) {
        let near = null, nd = BOMB.panicR;
        if (p.type === 'h000') for (const c of cs) { const d = dist(c, p); if (d < nd) { nd = d; near = c; } }
        if (near) {
          p.baseSpeed = BOMB.panicSpeed; p.panicking = true;
          const a = angleTo(near, p);
          for (const da of [0, 45, -45, 90, -90]) { const q = polar(p, 200, a + da); if (w.grid.walkable(q.x, q.y, p.coll)) { w.issue(p, { type: 'move', ...q }); break; } }
        } else {
          if (p.panicking) { p.panicking = false; p.baseSpeed = BOMB.walk; }
          if (!p.order || w.rng.next() < 0.03) wander(p);
        }
      }
    }).every(0.25);

    // bots: fly at a peasant (preferring one that panics), bomb it with a small lead
    G.trig('BombAI', function* () {
      const ps = peasants();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pauseUntil) continue;
          const eye = u.eye ??= w.rng.real(0.4, 0.85);
          if (!u.mark || !u.mark.alive || w.rng.next() < 0.04) {
            const panicky = ps.filter((p) => p.panicking);
            u.mark = panicky.length && w.rng.next() < eye ? w.pick(panicky) : w.pick(ps);
          }
          const t = u.mark; if (!t) continue;
          const d = dist(u, t);
          if (d > 220) w.issue(u, { type: 'move', x: t.x, y: t.y });
          else if (u.order) w.issue(u, { type: 'stop' });
          if (d < 330 && w.t >= u.nextBomb && w.rng.next() < 0.5) {
            const lead = d / BOMB.flight * w.rng.real(0.4, 1.0);
            const ok = t.panicking || w.rng.next() > eye; // careful bots wait for a peasant to panic
            if (ok) B.drop(u, { x: t.x + (t.vx || 0) * lead + w.rng.real(-30, 30), y: t.y + (t.vy || 0) * lead + w.rng.real(-30, 30) });
          }
        }
      });
    }).every(0.2);

    return init;
  },
};
