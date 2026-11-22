// Bean Tower Defense — based on "Tower Defense" (Triggers_Events[46]).
// Kept: the 8 build spots (Tower_1..8), an Archmage 448 beyond each spot,
// asleep for the first 5 s, then firing every 2.13 s, a Water Elemental 12 s
// later and Blizzard 20 s after that; the first finished Arcane Tower wins, race
// scoring, 150 s timer.
// Polished: one peasant bean per player instead of 8; the tower builds while you
// stand on your pad (15 s in total, progress shown); Archmage bolts and Blizzard
// shards are telegraphed rings; any hit or the Water Elemental's touch = out.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const TOWER = { build: 15, pad: 80, bolt: 2.13, boltSpeed: 700, boltR: 60, elemAt: 17, blizAt: 37, blizEvery: 4, blizR: 90, elemSpeed: 200, speed: 230 };

export default {
  num: 46, id: 'tower', title: 'Bean Tower Defense', orig: 'Tower Defense',
  subtitle: 'Complete your tower!', arena: 'tower_defense', rect: 'Tower_Defense', kind: 'race',
  hint: 'Stand on your pad to build the tower. Step aside from the Archmage’s rings — any hit = out!',
  objective: 'Finish building the tower on your pad. Out: an Archmage ring hits you.',
  clip: ['Tower_Defense', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Tower_Defense);
    const TD = (v.tower = { bolts: [] });

    const init = G.trig('TowerInitialization', function* () {
      G.music('human1');
      v.ante = 8; TD.bolts = []; TD.t0 = w.t;
      G.forPlaying((i) => {
        const pad = center(R['Tower_' + i]);
        const b = G.bean('h004', i, polar(pad, 128, w.rng.dir()), { speed: TOWER.speed });
        b.pad = pad; b.built = 0; b.shown = 0; b.facing = angleTo(b, pad);
        const m = w.create('Hamg', P_ENEMY, polar(pad, 448, angleTo(C(), pad)));
        const q = w.grid.nearestWalkable(m.x, m.y, 32); if (q) { m.x = q.x; m.y = q.y; }
        m.acquire = 0; m.invuln = true; m.baseSpeed = 0; m.mage = i; m.next = w.t + 5; m.facing = angleTo(m, pad);
        w.emit({ k: 'ring', x: pad.x, y: pad.y, r: TOWER.pad, color: 0xffd23f, dur: 3 });
      });
      G.addKey(w.ofType('h004'));
      G.cameraBounds(R.Tower_Defense);
      G.startTimer(150, 'Time Left');
      G.say('Bean Tower Defense', 'Complete your tower!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.TowerTick.enable();
      G.forBots(() => T.TowerAI.enable());
      const round = G.round();
      yield TOWER.elemAt;
      if (G.round() !== round) return;
      for (const m of w.ofType('Hamg')) {
        const e = w.create('hwat', P_ENEMY, polar(m, 80, m.facing));
        e.acquire = 0; e.abils = []; e.baseSpeed = TOWER.elemSpeed; e.elem = m.mage; e.pauseUntil = w.t + 1;
        w.emit({ k: 'teleport', x: e.x, y: e.y });
      }
      yield TOWER.blizAt - TOWER.elemAt;
      if (G.round() !== round) return;
      T.TowerBlizzard.enable(); T.TowerBlizzard.execute();
    });

    const beanOf = (slot) => G.beans().find((b) => b.owner === slot);
    function strike(src, p, fl, r, type) {
      TD.bolts.push({ x: p.x, y: p.y, t: w.t + fl, r });
      w.emit({ k: 'warn', id: src.id * 1000 + (w.tick % 1000) + Math.floor(p.x) % 97, x: p.x, y: p.y, r, dur: fl, hot: true });
      w.lob(src, p.x, p.y, { speed: Math.max(100, dist(src, p) / fl), type, onImpact: () => {
        w.emit({ k: 'impact', x: p.x, y: p.y, type, r });
        for (const b of G.beans()) if (dist(b, p) <= r + b.coll * 0.5) G.boom(b);
      } });
    }

    G.trig('TowerBlizzard', function* () {
      for (const m of w.ofType('Hamg')) {
        const b = beanOf(m.mage); if (!b) continue;
        for (let k = 0; k < 3; k++) strike(m, polar(b.pad, w.rng.real(0, 140), w.rng.dir()), 1.1, TOWER.blizR, 'Hamg');
      }
    }).every(TOWER.blizEvery);

    G.trig('TowerTick', function* () {
      TD.bolts = TD.bolts.filter((s) => s.t > w.t - 0.1);
      for (const m of w.ofType('Hamg')) {
        const b = beanOf(m.mage); if (!b || w.t < m.next) continue;
        m.next = w.t + TOWER.bolt; m.facing = angleTo(m, b);
        const fl = dist(m, b) / TOWER.boltSpeed;
        strike(m, { x: b.x + b.vx * fl * 0.5, y: b.y + b.vy * fl * 0.5 }, fl, TOWER.boltR, 'Hamg');
      }
      for (const e of w.alive((u) => u.elem)) {
        const b = beanOf(e.elem);
        if (b && (w.tick + e.id) % 6 === 0 && w.t >= e.pauseUntil) w.issue(e, { type: 'move', x: b.x, y: b.y });
        for (const o of G.beans()) if (dist(o, e) <= e.coll + o.coll + 4) G.boom(o);
      }
      for (const b of G.beans()) {
        if (dist(b, b.pad) > TOWER.pad) continue;
        b.built += 0.05;
        const pct = Math.floor(b.built / TOWER.build * 4);
        if (pct > b.shown && pct < 4) { b.shown = pct; w.emit({ k: 'text3d', x: b.pad.x, y: b.pad.y, text: `${pct * 25}%`, color: '#ffd23f' }); w.emit({ k: 'ring', x: b.pad.x, y: b.pad.y, r: TOWER.pad, color: 0xffd23f, dur: 0.5 }); }
        if (b.built >= TOWER.build) {
          const t = w.create('hatw', b.owner, b.pad); t.x = b.pad.x; t.y = b.pad.y; t.acquire = 0; t.invuln = true;
          w.emit({ k: 'sfx', id: 'win' });
          for (const m of w.ofType('Hamg')) if (m.mage === b.owner) { m.next = 1e9; }
          for (const e of w.alive((u) => u.elem === b.owner)) w.kill(e);
          v.focus = b; T.RaceFinish.execute();
        }
      }
    }).every(0.05);

    // bots: build on the pad (as the original peasants do), step out of incoming rings, kite the elemental
    G.trig('TowerAI', function* () {
      G.forBots((i) => {
        const u = beanOf(i); if (!u) return;
        if (w.t < (u.botNext || 0)) return;
        const hit = TD.bolts.find((s) => s.t - w.t < (u.react ??= w.rng.real(0.7, 1.0)) && s.t > w.t && dist(u, s) < s.r + u.coll + 14);
        if (hit) {
          let a = angleTo(hit, u); if (dist(u, hit) < 4) a = w.rng.dir();
          const p = polar(u, hit.r + 50, a + w.rng.real(-30, 30)); w.issue(u, { type: 'move', ...p });
          u.botNext = w.t + w.rng.real(0.15, 0.4); return;
        }
        const e = w.alive((x) => x.elem && dist(x, u) < 170)[0];
        if (e) { w.issue(u, { type: 'move', ...polar(u.pad, TOWER.pad * 0.7, angleTo(e, u.pad) + w.rng.real(-30, 30)) }); u.botNext = w.t + 0.2; return; }
        if (dist(u, u.pad) > 30) w.issue(u, { type: 'move', x: u.pad.x + w.rng.real(-20, 20), y: u.pad.y + w.rng.real(-20, 20) });
        u.botNext = w.t + w.rng.real(0.1, 0.3);
      });
    }).every(0.1);

    return init;
  },
};
