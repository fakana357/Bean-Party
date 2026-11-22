// The Clean-Bean Crew — based on "The Clean-up Crew" (Triggers_Events[5]).
// Kept: a 512-radius patch of goo (blight) near the centre, 4 cleaners (priests)
// at the corners (±700), the first scrub 5 s in and one every 10 s aimed at a
// random bean, a fallen bean leaves a 192-radius goo splat, survival with ties.
// Polished: the hidden HP drain is replaced by a clear rule (off the goo for
// more than 1 s = out), scrubs are telegraphed, they speed up over time and a
// 90 s timer guarantees the round ends.
import { P_ENEMY, P_NEUTRAL, center, offset, polar, dist, angleTo } from '../engine.js';

export const CLEAN = { tile: 64, start: 512, splat: 192, scrubR: 200, warn: 1.3, dry: 1.0, speed: 270 };

export default {
  num: 5, id: 'clean', title: 'The Clean-Bean Crew', orig: 'The Clean-up Crew',
  subtitle: 'Stay on the goo!', arena: 'clean_crew', rect: 'Clean_Crew', kind: 'survival',
  hint: 'Stay on the purple goo! Off the goo for more than a second = out. Cleaners scrub where beans stand.',
  objective: 'Be the last bean standing. Out: you stay off the purple goo for more than a second.',
  clip: ['Clean_Crew', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Clean_Crew);
    const S = (v.clean = { goo: new Map(), zones: [], interval: 10, next: 0 });
    const key = (x, y) => Math.floor((x - R.Clean_Crew.x0) / CLEAN.tile) + ',' + Math.floor((y - R.Clean_Crew.y0) / CLEAN.tile);
    const tileCenter = (i, j) => ({ x: R.Clean_Crew.x0 + (i + 0.5) * CLEAN.tile, y: R.Clean_Crew.y0 + (j + 0.5) * CLEAN.tile });
    const onGoo = (p) => S.goo.has(key(p.x, p.y));

    function addGoo(p, r) {
      const T0 = CLEAN.tile, r0 = R.Clean_Crew;
      for (let i = Math.floor((p.x - r - r0.x0) / T0); i <= Math.floor((p.x + r - r0.x0) / T0); i++)
        for (let j = Math.floor((p.y - r - r0.y0) / T0); j <= Math.floor((p.y + r - r0.y0) / T0); j++) {
          const c = tileCenter(i, j), k = i + ',' + j;
          if (S.goo.has(k) || dist(c, p) > r || !w.grid.walkable(c.x, c.y, 0)) continue;
          const u = w.create('hcth', P_NEUTRAL, c); u.x = c.x; u.y = c.y; u.prop = 'goo'; u.coll = 0; u.baseSpeed = 0; u.invuln = true; u.acquire = 0;
          S.goo.set(k, u);
        }
    }
    function scrub(p, r) {
      for (const [k, u] of [...S.goo]) if (dist(u, p) <= r) { w.remove(u); S.goo.delete(k); }
    }

    const init = G.trig('CleanInitialization', function* () {
      G.music('Undead1');
      v.tiesPossible = true;
      S.goo = new Map(); S.zones = []; S.interval = 10;
      addGoo(polar(C(), w.rng.real(0, 128), w.rng.dir()), CLEAN.start);
      G.forPlaying((i) => { const b = G.bean('ugho', i, polar(C(), w.rng.real(0, 256), w.rng.dir()), { speed: CLEAN.speed }); b.dry = 0; });
      G.addKey(w.ofType('ugho'));
      for (const [dx, dy] of [[-700, 700], [700, 700], [-700, -700], [700, -700]]) {
        const p = w.create('hmpr', P_ENEMY, offset(C(), dx, dy)); p.acquire = 0; p.baseSpeed = 120; p.home = { x: p.x, y: p.y };
      }
      G.cameraBounds(R.Clean_Crew);
      G.startTimer(90, 'Time Left');
      G.say('The Clean-Bean Crew', 'Stay on the goo!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.CleanDry.enable(); T.CleanDeath.enable(); T.CleanWander.enable();
      G.forBots(() => T.CleanAI.enable());
      yield 5;
      T.CleanScrub.enable(); T.CleanScrub.execute();
    });

    // a cleaner aims at a random bean's spot; the goo there is scrubbed after a warning
    G.trig('CleanScrub', function* () {
      const round = G.round();
      while (T.CleanScrub.enabled && G.round() === round) {
        const n = S.interval <= 6 ? 2 : 1;
        const targets = G.beans().slice();
        for (let k = 0; k < n && targets.length; k++) {
          const b = targets.splice(w.rng.int(0, targets.length - 1), 1)[0];
          const pr = w.pick(w.ofType('hmpr')); if (!pr) break;
          const p = { x: b.x, y: b.y }, z = { x: p.x, y: p.y, r: CLEAN.scrubR, end: w.t + CLEAN.warn };
          pr.facing = angleTo(pr, p); w.emit({ k: 'swing', id: pr.id });
          S.zones.push(z);
          w.emit({ k: 'warn', id: 'clean' + w.t + k, x: p.x, y: p.y, r: CLEAN.scrubR, dur: CLEAN.warn, hot: true });
          w.spawn(function* () {
            yield CLEAN.warn;
            S.zones = S.zones.filter((q) => q !== z);
            if (G.round() !== round || !T.CleanScrub.enabled) return;
            scrub(p, CLEAN.scrubR);
            w.emit({ k: 'ring', x: p.x, y: p.y, r: CLEAN.scrubR, color: 0x9fe8ff, dur: 0.6 }); w.emit({ k: 'sfx', id: 'zap' });
          });
        }
        yield S.interval;
        S.interval = Math.max(3, S.interval - 0.75);
      }
    });

    G.trig('CleanWander', function* () {
      for (const p of w.ofType('hmpr')) if (!p.order && w.rng.next() < 0.3) w.issue(p, { type: 'move', ...polar(p.home, w.rng.real(0, 150), w.rng.dir()) });
    }).every(1);

    // off the goo for more than CLEAN.dry seconds = dried up
    G.trig('CleanDry', function* () {
      for (const b of G.beans()) {
        if (onGoo(b)) { b.dry = 0; continue; }
        if (!b.dry) w.emit({ k: 'text3d', x: b.x, y: b.y + 40, text: 'Dry!', color: '#ff4d5e' });
        b.dry = (b.dry || 0) + 0.05;
        if (b.dry > CLEAN.dry) w.kill(b);
      }
    }).every(0.05);

    G.trig('CleanDeath', function* (e) { addGoo(e.unit, CLEAN.splat); }, { cond: (e) => e.unit.type === 'ugho' && G.key.has(e.unit) }).on('death');

    // bots: stay on thick goo, away from warned spots and from other beans
    G.trig('CleanAI', function* () {
      const tiles = [...S.goo.values()];
      const danger = (p) => S.zones.some((z) => dist(z, p) <= z.r + 30);
      const score = (u, t) => {
        let s = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (onGoo({ x: t.x + dx * CLEAN.tile, y: t.y + dy * CLEAN.tile })) s += 1;
        if (danger(t)) s -= 20;
        for (const b of G.beans()) if (b !== u && dist(b, t) < 150) s -= 2;
        return s - dist(u, t) / 120;
      };
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || !tiles.length) continue;
          const urgent = danger(u) || !onGoo(u);
          if (!urgent && u.order && w.rng.next() < 0.9) continue;
          if (!urgent && w.rng.next() < 0.7) continue;
          let best = null, bs = -1e9;
          for (const t of tiles) { if (urgent && dist(u, t) > 450) continue; const s = score(u, t) + w.rng.real(0, 1.5); if (s > bs) { bs = s; best = t; } }
          if (best) w.issue(u, { type: 'move', x: best.x, y: best.y });
        }
      });
    }).every(0.2);

    return init;
  },
};
