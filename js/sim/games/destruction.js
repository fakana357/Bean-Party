// Bean-struction Dance — based on "Destruction's Dance" (Triggers_Events[35]).
// Kept: blademaster beans start 400 from the centre (angle slot*135-22.5), all
// frozen for 5 s, attacks are blink strikes, 1-hit kills, survival scoring.
// Polished: walking stays normal. Space (or click a bean) = blink strike: a
// ring marks where you will land (0.45 s), then you blink there and slash
// every bean inside the ring. You can't move while winding up, so others can
// strike your spot. 1.6 s cooldown, 90 s timer instead of 120 s.
import { center, polar, dist, angleTo } from '../engine.js';

const DD = { range: 450, wind: 0.45, r: 66, cool: 1.6 };

export default {
  num: 35, id: 'destruction', title: 'Bean-struction Dance', orig: 'Destruction’s Dance',
  subtitle: 'Use speed and finesse to slash your opponents!', arena: 'destruction_dance', rect: 'Destruction_Dance', kind: 'survival',
  hint: 'Space or click = blink strike to the ring. Get out of other beans’ rings!',
  objective: 'Be the last bean standing. Out: you are inside a ring when it strikes.',
  clip: ['Destruction_Dance', 64, 64],
  canTarget(G, u, t) { return t !== u && t.alive && G.key.has(t) && dist(u, t) <= DD.range + 100; },
  action(G, u, target, aim) {
    const p = target && target.alive && target !== u ? target : aim;
    if (!p) return false;
    return G.v.destruction.strike(u, p);
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Destruction_Dance);
    const D = (v.destruction = { live: false, rings: [] });

    D.strike = (u, p) => {
      if (!D.live || !u.alive || w.t < (u.ddCd || 0) || w.t < u.pauseUntil) return false;
      const q0 = dist(u, p) > DD.range ? polar(u, DD.range, angleTo(u, p)) : { x: p.x, y: p.y };
      const q = w.grid.walkable(q0.x, q0.y, u.coll) ? q0 : (w.grid.nearestWalkable(q0.x, q0.y, u.coll) || { x: u.x, y: u.y });
      u.ddCd = w.t + DD.wind + DD.cool; u.pauseUntil = w.t + DD.wind; u.order = null; u.facing = angleTo(u, q);
      const ring = { x: q.x, y: q.y, by: u, end: w.t + DD.wind };
      D.rings.push(ring);
      w.emit({ k: 'warn', id: 'dd' + u.id + '_' + w.t, x: q.x, y: q.y, r: DD.r, dur: DD.wind, hot: true });
      const round = G.round();
      w.spawn(function* () {
        yield DD.wind;
        D.rings.splice(D.rings.indexOf(ring), 1);
        if (G.round() !== round || !u.alive || !D.live) return;
        w.emit({ k: 'teleport', x: u.x, y: u.y });
        u.x = q.x; u.y = q.y;
        w.emit({ k: 'teleport', x: q.x, y: q.y }); w.emit({ k: 'swing', id: u.id }); w.emit({ k: 'sfx', id: 'zap' });
        w.emit({ k: 'ring', x: q.x, y: q.y, r: DD.r, color: 0xffffff, dur: 0.3 });
        for (const o of G.beans()) if (o !== u && dist(o, q) <= DD.r) G.boom(o);
      });
      return true;
    };

    const init = G.trig('DestructionInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true; D.live = false; D.rings = [];
      G.forPlaying((i) => { const b = G.bean('Obla', i, polar(C(), 400, i * 135 - 22.5), { speed: 300 }); b.facing = angleTo(b, C()); b.ddCd = 0; });
      G.addKey(w.ofType('Obla'));
      G.cameraBounds(R.Destruction_Dance);
      G.startTimer(90, 'Time Left');
      G.say('Bean-struction Dance', 'Use speed and finesse to slash your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable();
      for (const b of G.beans()) b.pauseUntil = w.t + 5;
      yield 5;
      D.live = true;
      G.forBots(() => T.DestructionAI.enable());
    });

    // bots: leave rings aimed at them, strike the nearest bean with some lead
    G.trig('DestructionAI', function* () {
      const beans = G.beans();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pauseUntil) continue;
          const react = u.ddReact ??= w.rng.real(0.12, 0.3);
          const ring = D.rings.find((r) => r.by !== u && dist(u, r) <= DD.r + u.coll + 20 && r.end - w.t < DD.wind - react);
          if (ring) {
            const d = dist(u, ring) || 1; let dx = (u.x - ring.x) / d, dy = (u.y - ring.y) / d;
            if (d < 3) { const a = w.rng.dir() * Math.PI / 180; dx = Math.cos(a); dy = Math.sin(a); }
            w.issue(u, { type: 'steer', dx, dy }); continue;
          }
          let tg = null, td = 1e9; for (const b of beans) if (b !== u) { const d = dist(u, b); if (d < td) { td = d; tg = b; } }
          if (!tg) continue;
          if (w.t >= u.ddCd && td <= DD.range + 40 && w.rng.next() < 0.25) {
            const lead = w.rng.real(0, 0.4);
            D.strike(u, { x: tg.x + (tg.vx || 0) * lead, y: tg.y + (tg.vy || 0) * lead });
            continue;
          }
          if (!u.order || u.order.type === 'steer' || w.rng.next() < 0.1) {
            // keep a mid distance from the nearest bean, circling it
            const want = td > 380 ? 0 : td < 200 ? 180 : 90 * (u.id % 2 ? 1 : -1);
            let p = polar(u, 160, angleTo(u, tg) + want + w.rng.real(-30, 30));
            if (dist(p, C()) > 420) p = polar(C(), 380, angleTo(C(), p));
            w.issue(u, { type: 'move', ...p });
          }
        }
      });
    }).every(0.1);

    return init;
  },
};
