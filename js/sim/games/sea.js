// Bean Sea Combat — based on "Sea Combat" (Triggers_Events[52], never picked by
// the original map's filter but ported anyway).
// Kept: the Tides of Darkness sea, one battleship per player 896 from the centre
// at i*135-22.5°, everyone frozen for 5 s, long-range cannon duels, last boat
// afloat wins, 120 s timer (survival scoring).
// Polished: no auto-attacks or hidden HP: Space (or click a bean) lobs a cannonball
// at that spot (max 700 away, 2.5 s reload); the landing spot is telegraphed and
// a splash there sinks any boat (but not the shooter). Boats can't sail onto islands.
import { center, polar, dist, angleTo } from '../engine.js';

export const SEA = { range: 700, splash: 70, reload: 2.5, ball: 650, speed: 230 };

function fire(G, u, p) {
  const w = G.w;
  if (!u.alive || u.paused || w.t < (u.readyAt || 0)) return false;
  const d = dist(u, p), tgt = d > SEA.range ? polar(u, SEA.range, angleTo(u, p)) : { x: p.x, y: p.y };
  u.readyAt = w.t + SEA.reload; u.facing = angleTo(u, tgt);
  const round = G.round();
  const m = w.lob(u, tgt.x, tgt.y, { speed: SEA.ball, type: 'boulder', onImpact: (m) => {
    G.v.sea.warn = G.v.sea.warn.filter((x) => x.id !== m.id);
    if (G.round() !== round) return;
    w.emit({ k: 'impact', x: m.tx, y: m.ty, type: 'boulder', r: SEA.splash });
    for (const b of G.beans()) if (b !== u && dist(b, { x: m.tx, y: m.ty }) <= SEA.splash + b.coll) { b.exploded = true; w.kill(b); }
  } });
  G.v.sea.warn.push({ id: m.id, x: tgt.x, y: tgt.y, end: w.t + m.dur, from: u });
  w.emit({ k: 'warn', id: m.id, x: tgt.x, y: tgt.y, r: SEA.splash, dur: m.dur });
  w.emit({ k: 'sfx', id: 'shoot' });
  return true;
}

export default {
  num: 52, id: 'sea', title: 'Bean Sea Combat', orig: 'Sea Combat',
  subtitle: 'Kill your opponents!', arena: 'tides_of_darkness', rect: 'Tides_of_Darkness', kind: 'survival',
  hint: 'Space or click = fire a cannonball there (2.5 s reload). Sail out of the red rings!',
  objective: 'Be the last ship afloat. Out: a cannonball hits your ship.',
  clip: ['Tides_of_Darkness', 64, 64],
  canTarget(G, u, t) { return t !== u && G.key.has(t) && G.w.t >= (u.readyAt || 0); },
  action(G, u, target, aim) {
    const p = target && target !== u && target.alive ? target : aim;
    return p ? fire(G, u, p) : false;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Tides_of_Darkness);
    const S = (v.sea = { warn: [] });

    const init = G.trig('SeaInitialization', function* () {
      G.music('war2intro');
      v.tiesPossible = true; S.warn = [];
      G.forPlaying((i) => {
        const p = polar(C(), 896, i * 135 - 22.5);
        const b = G.bean('hbsh', i, p, { speed: SEA.speed });
        b.x = p.x; b.y = p.y; b.fly = true; b.paused = true; b.readyAt = 0; b.lastSea = { x: p.x, y: p.y }; b.facing = angleTo(p, C());
      });
      G.addKey(w.ofType('hbsh'));
      G.cameraBounds(R.Tides_of_Darkness);
      G.startTimer(125, 'Time Left');
      G.say('Bean Sea Combat', 'Kill your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.SeaWater.enable();
      yield 5;
      for (const b of G.beans()) b.paused = false;
      G.forBots(() => T.SeaAI.enable());
    });

    // boats stay on the water and inside the sea
    G.trig('SeaWater', function* () {
      const r = R.Tides_of_Darkness;
      for (const b of G.beans()) {
        b.x = Math.min(r.x1 - 40, Math.max(r.x0 + 40, b.x)); b.y = Math.min(r.y1 - 40, Math.max(r.y0 + 40, b.y));
        if (w.grid.clearance(b.x, b.y) > 0) { b.x = b.lastSea.x; b.y = b.lastSea.y; } else b.lastSea = { x: b.x, y: b.y };
      }
      S.warn = S.warn.filter((x) => x.end > w.t - 0.2);
    }).every(0.025);

    // bots: dodge incoming rings, keep a fighting distance, shoot at the closest boat with a lead
    G.trig('SeaAI', function* () {
      const beans = G.beans(), c = C();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const danger = S.warn.find((x) => x.from !== u && dist(u, x) < SEA.splash + 60);
          if (danger) { const p = polar(u, 200, angleTo(danger, u) + w.rng.real(-50, 50)); w.issue(u, { type: 'move', ...p }); continue; }
          let foe = null, fd = 1e9; for (const o of beans) if (o !== u) { const d = dist(u, o); if (d < fd) { fd = d; foe = o; } }
          if (!foe) continue;
          if (w.t >= (u.readyAt || 0) && fd < SEA.range && w.rng.next() < (u.aggro ??= w.rng.real(0.2, 0.5))) {
            const t = Math.min(SEA.range, fd) / SEA.ball * (u.skill ??= w.rng.real(0.4, 1.1));
            const err = (u.err ??= w.rng.real(20, 70));
            fire(G, u, { x: foe.x + (foe.vx || 0) * t + w.rng.real(-err, err), y: foe.y + (foe.vy || 0) * t + w.rng.real(-err, err) });
            continue;
          }
          if (!u.order || w.rng.next() < 0.1) {
            const want = u.range ??= w.rng.real(380, 560);
            let p = fd > want ? polar(u, 200, angleTo(u, foe) + w.rng.real(-70, 70)) : polar(u, 200, angleTo(foe, u) + w.rng.real(-70, 70));
            if (dist(p, c) > 850) p = polar(c, 700, angleTo(c, p) + w.rng.real(-30, 30));
            w.issue(u, { type: 'move', ...p });
          }
        }
      });
    }).every(0.2);

    return init;
  },
};
