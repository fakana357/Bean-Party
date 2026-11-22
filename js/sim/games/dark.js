// Dark Bean Forest — based on "Dark Forest" (Triggers_Events[12]).
// Kept: night glade ringed by trees, beans start 300 from the centre, after
// 6 s a blob (Abomination) spawns at the centre every 15 s (random 0-4 s delay)
// plus a bat (Gargoyle) the first time and 50% after, max 10, monsters
// attack-move to random spots every 4.5 s; blobs only hit walkers, bats only
// hit flyers; shapeshift between walking and flying (Storm Crow form).
// Polished: one key (Space) toggles walk/fly with a 2 s cooldown; a touch
// from the matching monster = out; spawns speed up and a 120 s timer ends it.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const DARK = { walk: 270, fly: 310, cool: 2, blobR: 48, blobSpeed: 235, blobSight: 300, batR: 16, batSpeed: 330, batSight: 400, max: 14 };

export default {
  num: 12, id: 'dark', title: 'Dark Bean Forest', orig: 'Dark Forest',
  subtitle: 'Survive as long as possible!', arena: 'dark_forest', rect: 'Dark_Forest', kind: 'survival',
  hint: 'Space = switch walk / fly. Blobs catch walkers, bats catch flyers. A touch = out!',
  objective: 'Be the last bean standing. Out: a blob touches you while walking, or a bat while flying.',
  clip: ['Dark_Forest', 64, 64],
  action(G, u) { return G.v.dark ? G.v.dark.toggle(u) : false; },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Dark_Forest);
    const D = (v.dark = { interval: 15 });
    const inset = 50, clamp = (u) => { const r = R.Dark_Forest; u.x = Math.max(r.x0 + inset, Math.min(r.x1 - inset, u.x)); u.y = Math.max(r.y0 + inset, Math.min(r.y1 - inset, u.y)); };

    D.toggle = (u) => {
      if (w.t < (u.morphCd || 0) || !u.alive) return false;
      if (u.fly) { const p = w.grid.nearestWalkable(u.x, u.y, u.coll); if (!p) return false; u.x = p.x; u.y = p.y; }
      u.fly = !u.fly; u.baseSpeed = u.fly ? DARK.fly : DARK.walk; u.morphCd = w.t + DARK.cool; u.path = null;
      w.emit({ k: 'teleport', x: u.x, y: u.y }); w.emit({ k: 'text3d', x: u.x, y: u.y + 50, text: u.fly ? 'Fly!' : 'Walk!', color: u.fly ? '#9fe8ff' : '#ffd23f' });
      return true;
    };

    const init = G.trig('DarkInitialization', function* () {
      G.music('NightElf3');
      v.tiesPossible = true; D.interval = 15;
      w.tod = 0;
      G.forPlaying((i) => G.bean('edot', i, polar(C(), 300, w.rng.dir()), { speed: DARK.walk }));
      G.addKey(w.ofType('edot'));
      w.emit({ k: 'ring', x: C().x, y: C().y, r: 120, color: 0x8a6cff, dur: 2 });
      G.cameraBounds(R.Dark_Forest);
      G.startTimer(120, 'Time Left');
      G.say('Dark Bean Forest', 'Survive as long as possible!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.DarkTick.enable(); T.DarkHunt.enable(); T.DarkPatrol.enable();
      yield 6;
      T.DarkSpawn.execute();
      G.forBots(() => T.DarkAI.enable());
    });

    G.trig('DarkSpawn', function* (e) {
      const round = G.round(); let first = true;
      while (G.round() === round && T.DarkTick.enabled) {
        if (w.ofPlayer(P_ENEMY).length < DARK.max) {
          yield w.rng.real(0, 4);
          if (G.round() !== round || !T.DarkTick.enabled) return;
          w.emit({ k: 'warn', id: 'dark' + w.t, x: C().x, y: C().y, r: 90, dur: 0.8, hot: true });
          yield 0.8;
          if (G.round() !== round || !T.DarkTick.enabled) return;
          const a = w.create('uabo', P_ENEMY, C()); a.acquire = 0; a.baseSpeed = DARK.blobSpeed; a.coll = DARK.blobR;
          w.emit({ k: 'teleport', x: C().x, y: C().y });
          if (first || w.rng.next() < 0.5) { const g = w.create('ugar', P_ENEMY, C()); g.acquire = 0; g.baseSpeed = DARK.batSpeed; g.coll = DARK.batR; }
          first = false;
        }
        yield D.interval;
        D.interval = Math.max(5, D.interval - 1.5);
      }
    });

    G.trig('DarkPatrol', function* () {
      for (const m of w.ofPlayer(P_ENEMY)) if (!m.chase) w.issue(m, { type: 'move', ...w.randomIn(R.Dark_Forest) });
    }).every(4.5);

    // blobs hunt walking beans within 300, bats hunt flying beans within 400
    G.trig('DarkHunt', function* () {
      for (const m of w.ofPlayer(P_ENEMY)) {
        const bat = m.type === 'ugar', sight = bat ? DARK.batSight : DARK.blobSight;
        let best = null, bd = sight;
        for (const b of G.beans()) { if (!!b.fly !== bat) continue; const d = dist(m, b); if (d < bd) { bd = d; best = b; } }
        const was = m.chase; m.chase = best;
        if (best) w.issue(m, { type: 'move', x: best.x, y: best.y });
        else if (was) w.issue(m, { type: 'move', ...w.randomIn(R.Dark_Forest) });
      }
    }).every(0.2);

    G.trig('DarkTick', function* () {
      const ms = w.ofPlayer(P_ENEMY);
      for (const b of G.beans()) {
        if (b.fly) clamp(b);
        for (const m of ms) if ((m.type === 'ugar') === !!b.fly && dist(m, b) <= m.coll + b.coll + (m.type === 'ugar' ? 10 : 0)) { w.kill(b); break; }
      }
      for (const m of ms) if (m.fly) clamp(m);
    }).every(0.05);

    // bots (original): a bat within 600 -> walk, a blob within 400 -> fly;
    // plus: flee whatever can hit the current form, otherwise wander outward
    G.trig('DarkAI', function* () {
      const ms = w.ofPlayer(P_ENEMY);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let nb = 1e9, ng = 1e9;
          for (const m of ms) { const d = dist(m, u); if (m.type === 'ugar') ng = Math.min(ng, d); else nb = Math.min(nb, d); }
          const react = u.react ??= w.rng.real(0.5, 0.9);
          if (w.rng.next() < react) {
            if (u.fly && ng < 450 && nb > 150) D.toggle(u);
            else if (!u.fly && nb < 260 && ng > 250) D.toggle(u);
          }
          let fx = 0, fy = 0;
          for (const m of ms) { if ((m.type === 'ugar') !== !!u.fly) continue; const d = Math.max(1, dist(m, u)); if (d < 450) { fx += (u.x - m.x) / (d * d); fy += (u.y - m.y) / (d * d); } }
          if (fx || fy) {
            const c = C(), dc = Math.max(1, dist(u, c)); if (dc > 600) { fx += (c.x - u.x) / dc * 0.003; fy += (c.y - u.y) / dc * 0.003; }
            const a = Math.atan2(fy, fx) * 180 / Math.PI;
            let best = null;
            for (const da of [0, 35, -35, 70, -70, 110, -110]) { const p = polar(u, 150, a + da); if (u.fly ? dist(p, c) < 720 : w.grid.walkable(p.x, p.y, u.coll)) { best = p; break; } }
            if (best) w.issue(u, { type: 'move', ...best });
          } else if (!u.order && w.rng.next() < 0.15) {
            let p = polar(u, w.rng.real(200, 500), angleTo(C(), u) + w.rng.real(-120, 120));
            if (dist(p, C()) > 650) p = polar(C(), 600, angleTo(C(), p));
            w.issue(u, { type: 'move', ...p });
          }
        }
      });
    }).every(0.25);

    return init;
  },
};
