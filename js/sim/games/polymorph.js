// The Polymorph Bean Ring — based on "Polymorph Ring" (Triggers_Events[9]).
// Kept: beans start 500 from the centre of the round prison, a big monster
// (Sasquatch) appears in the centre every 10 s (random 0-5 s delay, max 8),
// monsters attack-move to random spots every 2.5 s, polymorph and slow spells
// with a limited, non-regenerating budget, survival scoring.
// Polished: a monster touch = out; Space near a monster turns it into a
// harmless sheep for 8 s, clicking a bean slows it (both use one of 4 zaps);
// monsters get faster once the ring is full and a 120 s timer ends the round.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const POLY = { speed: 220, zaps: 4, range: 500, sheepTime: 8, slowTime: 2.5, slowSpeed: 110, monR: 48, monSpeed: 190, sight: 300, ring: 540 };

export default {
  num: 9, id: 'polymorph', title: 'The Polymorph Bean Ring', orig: 'Polymorph Ring',
  subtitle: 'Survive as long as possible!', arena: 'polymorph_ring', rect: 'Polymorph_Ring', kind: 'survival',
  hint: 'Space near a monster = turn it into a sheep. Click a bean = slow it. 4 zaps only. Monster touch = out!',
  objective: 'Be the last bean standing. Out: a monster touches you.',
  clip: ['Polymorph_Ring', 64, 64],
  canTarget(G, u, t) { return t !== u && (u.zaps || 0) > 0; },
  action(G, u, target, aim) { return G.v.poly ? G.v.poly.zap(u, target, aim) : false; },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Polymorph_Ring);
    const P = (v.poly = { monSpeed: POLY.monSpeed });

    P.zap = (u, target, aim) => {
      if ((u.zaps || 0) <= 0 || w.t < (u.zapCd || 0)) return false;
      if (target && target.alive && target !== u && G.key.has(target)) {
        if (dist(u, target) > POLY.range + 200) return false;
        target.slowUntil = w.t + POLY.slowTime; target.baseSpeed = POLY.slowSpeed;
        w.emit({ k: 'purge', id: target.id, src: u.id });
      } else {
        const p = aim || u; let best = null, bd = 1e9;
        for (const m of w.ofType('nsqa')) { const d = dist(m, p); if (dist(m, u) <= POLY.range && d < bd) { bd = d; best = m; } }
        if (!best) return false;
        sheep(best);
      }
      u.zaps -= 1; u.zapCd = w.t + 0.4;
      w.emit({ k: 'text3d', x: u.x, y: u.y + 50, text: u.zaps + ' zaps', color: '#c9a5ff' });
      return true;
    };
    function sheep(m) {
      const x = m.x, y = m.y, round = G.round();
      w.remove(m);
      const s = w.create('nshe', P_ENEMY, { x, y }); s.acquire = 0; s.baseSpeed = 120; s.coll = 16; s.harmless = true;
      w.emit({ k: 'teleport', x, y }); w.emit({ k: 'sfx', id: 'pop' });
      w.issue(s, { type: 'move', ...polar(s, 150, w.rng.dir()) });
      w.spawn(function* () {
        yield POLY.sheepTime;
        if (G.round() !== round || !s.alive || !T.PolymorphTick.enabled) return;
        w.emit({ k: 'warn', id: 'poly' + s.id, x: s.x, y: s.y, r: POLY.monR + 30, dur: 1, hot: true });
        yield 1;
        if (G.round() !== round || !s.alive || !T.PolymorphTick.enabled) return;
        w.remove(s); spawnMon({ x: s.x, y: s.y });
      });
    }
    function spawnMon(p) {
      const m = w.create('nsqa', P_ENEMY, p); m.acquire = 0; m.baseSpeed = P.monSpeed; m.coll = POLY.monR;
      w.emit({ k: 'teleport', x: m.x, y: m.y });
      return m;
    }
    const inRing = (p) => dist(p, C()) <= POLY.ring;
    const clampRing = (p) => (inRing(p) ? p : polar(C(), POLY.ring - 20, angleTo(C(), p)));

    const init = G.trig('PolymorphInitialization', function* () {
      G.music('Human2');
      P.monSpeed = POLY.monSpeed;
      G.forPlaying((i) => { const b = G.bean('hsor', i, polar(C(), 500, w.rng.dir()), { speed: POLY.speed }); b.zaps = POLY.zaps; });
      G.addKey(w.ofType('hsor'));
      w.emit({ k: 'ring', x: C().x, y: C().y, r: 120, color: 0x8a6cff, dur: 2 });
      G.cameraBounds(R.Polymorph_Ring);
      G.startTimer(120, 'Time Left');
      G.say('The Polymorph Bean Ring', 'Survive as long as possible!');
      T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.PolymorphPatrol.enable(); T.PolymorphTick.enable(); T.PolymorphChase.enable();
      yield 5;
      T.PolymorphSpawn.enable(); T.PolymorphSpawn.execute();
      G.forBots(() => T.PolymorphAI.enable());
    });

    G.trig('PolymorphSpawn', function* () {
      const n = w.ofType('nsqa').length + w.ofType('nshe').length;
      if (n >= 8) { P.monSpeed = Math.min(250, P.monSpeed + 12); for (const m of w.ofType('nsqa')) m.baseSpeed = P.monSpeed; return; }
      yield w.rng.real(0, 5);
      if (!T.PolymorphSpawn.enabled) return;
      w.emit({ k: 'warn', id: 'polys' + w.t, x: C().x, y: C().y, r: 90, dur: 0.8, hot: true });
      yield 0.8;
      if (!T.PolymorphSpawn.enabled) return;
      spawnMon(C());
    }).every(10);

    G.trig('PolymorphPatrol', function* () {
      for (const m of w.ofType('nsqa')) if (!m.chase) w.issue(m, { type: 'move', ...clampRing(w.randomIn(R.Polymorph_Ring)) });
      for (const s of w.ofType('nshe')) w.issue(s, { type: 'move', ...clampRing(polar(s, 150, w.rng.dir())) });
    }).every(2.5);

    // monsters chase the nearest bean within 300 (the attack-move acquire range)
    G.trig('PolymorphChase', function* () {
      for (const m of w.ofType('nsqa')) {
        let best = null, bd = POLY.sight;
        for (const b of G.beans()) { const d = dist(m, b); if (d < bd) { bd = d; best = b; } }
        m.chase = best;
        if (best) w.issue(m, { type: 'move', x: best.x, y: best.y });
      }
    }).every(0.2);

    G.trig('PolymorphTick', function* () {
      const mons = w.ofType('nsqa');
      for (const b of G.beans()) {
        if (b.slowUntil && w.t >= b.slowUntil) { b.slowUntil = 0; b.baseSpeed = POLY.speed; }
        if (mons.some((m) => dist(m, b) <= POLY.monR + b.coll)) w.kill(b);
      }
    }).every(0.05);

    // bots: drift around the ring away from the centre (original AI), flee
    // nearby monsters and zap one that gets too close
    G.trig('PolymorphAI', function* () {
      const mons = w.ofType('nsqa');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let near = null, nd = 1e9;
          for (const m of mons) { const d = dist(m, u); if (d < nd) { nd = d; near = m; } }
          const panic = u.panic ??= w.rng.real(120, 190);
          if (near && nd < panic && u.zaps > 0 && w.rng.next() < 0.6) { P.zap(u, null, near); continue; }
          if (near && nd < 330) {
            let fx = 0, fy = 0;
            for (const m of mons) { const d = dist(m, u); if (d < 420) { fx += (u.x - m.x) / (d * d); fy += (u.y - m.y) / (d * d); } }
            const a = Math.atan2(fy, fx) * 180 / Math.PI;
            let best = null;
            for (const da of [0, 35, -35, 70, -70, 110, -110]) { const p = polar(u, 170, a + da); if (inRing(p) && w.grid.walkable(p.x, p.y, u.coll)) { best = p; break; } }
            w.issue(u, { type: 'move', ...(best || clampRing(polar(u, 170, a))) });
            continue;
          }
          if (!u.order && w.rng.next() < 0.2) w.issue(u, { type: 'move', ...clampRing(polar(u, w.rng.real(200, 500), angleTo(C(), u) + w.rng.real(-120, 120))) });
        }
      });
    }).every(0.25);

    return init;
  },
};
