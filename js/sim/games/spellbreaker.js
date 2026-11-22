// Bean Breaker Blood — based on "Spell Breaker Blood" (Triggers_Events[42]).
// Kept: beans start 400 from the centre (slot*135-22.5), the demon gate in the
// middle spits a creature every 7 s (+0-2 s, max 30) from the same 7-type list
// with the same difficulty curve (big Infernals/Doom Guards rarer, never two at
// once), Control Magic takes a creature over, a bean's creatures die with it,
// survival scoring.
// Polished: Space takes over the wild creature nearest the cursor (within 500);
// small ones recharge your spell in 5 s, big ones in 15 s. Wild creatures chase
// the nearest bean, yours chase the nearest rival; any creature that is not yours
// touching you = out. 150 s timer (original 240 s).
import { P_ENEMY, center, polar, offset, dist, angleTo } from '../engine.js';

export const SB = { range: 500, cdSmall: 5, cdBig: 15, max: 30, every: 7, speedCap: 290 };
const TYPES = ['ucs1', 'uske', 'ucs2', 'uskm', 'ucsC', 'ninf', 'nbal'];
const BIG = new Set(['ninf', 'nbal']);

export default {
  num: 42, id: 'spellbreaker', title: 'Bean Breaker Blood', orig: 'Spell Breaker Blood',
  subtitle: 'Use summons to kill your opponents!', arena: 'spell_breaker_blood', rect: 'Spell_Breaker_Blood', kind: 'survival',
  hint: 'Space = take over the creature nearest your cursor and send it at rivals. Other creatures’ touch = out!',
  objective: 'Be the last bean standing. Out: a creature you don’t control touches you.',
  clip: ['Spell_Breaker_Blood', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) {
    const w = G.w; if (w.t < (u.cast || 0) || !aim) return false;
    let best = null, bd = 1e9;
    for (const m of w.alive((m) => m.creature && m.owner === P_ENEMY)) { if (dist(m, u) > SB.range) continue; const d = dist(m, aim); if (d < bd) { bd = d; best = m; } }
    if (!best) return false;
    G.v.sb.take(u, best); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Spell_Breaker_Blood);
    const S = (v.sb = {});

    const init = G.trig('SpellbreakerInitialization', function* () {
      G.music('illidan');
      S.curve = 0; w.tod = 0; v.tiesPossible = true;
      G.forPlaying((i) => { const b = G.bean('hspt', i, polar(C(), 400, i * 135 - 22.5), { speed: 300 }); b.cast = 0; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('hspt'));
      const gate = w.create('ndmg', P_ENEMY, C(), 306.25); gate.invuln = true; gate.coll = 0;
      G.cameraBounds(R.Spell_Breaker_Blood);
      G.startTimer(150, 'Time Left');
      G.say('Bean Breaker Blood', 'Use summons to pop your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.SpellbreakerDeath.enable(); T.SpellbreakerTick.enable();
      G.forBots(() => T.SpellbreakerAI.enable());
      yield 5;
      T.SpellbreakerSpawn.enable(); T.SpellbreakerSpawn.execute();
    });

    G.trig('SpellbreakerSpawn', function* () {
      yield w.rng.real(0, 2);
      if (!T.SpellbreakerSpawn.enabled || w.alive((m) => m.creature).length >= SB.max) return;
      if (S.curve < 7) S.curve++;
      let n = w.rng.int(1, w.rng.int(1, S.curve));
      if (S.curve > 5 && w.rng.int(1, 6) !== 1) n = w.rng.int(1, 5);
      if (w.alive((m) => m.creature && BIG.has(m.type)).length) n = w.rng.int(1, 5);
      const m = w.create(TYPES[n - 1], P_ENEMY, offset(C(), 0, -64));
      m.creature = true; m.acquire = 0; m.abils = []; m.baseSpeed = Math.min(m.baseSpeed, SB.speedCap); m.pauseUntil = w.t + 1;
      if (m.baseSpeed === 0) { m.x += w.rng.real(-300, 300); m.y += w.rng.real(-300, 300); const p = w.grid.nearestWalkable(m.x, m.y, 24); if (p) { m.x = p.x; m.y = p.y; } }
      w.emit({ k: 'teleport', x: m.x, y: m.y });
    }).every(SB.every);

    S.take = (u, m) => {
      m.owner = u.owner; m.color = u.owner; m.order = null;
      u.cast = w.t + (BIG.has(m.type) ? SB.cdBig : SB.cdSmall);
      w.emit({ k: 'ring', x: m.x, y: m.y, r: 70, color: 0xff5fa8, dur: 0.5 }); w.emit({ k: 'sfx', id: 'zap' });
      w.emit({ k: 'text3d', x: m.x, y: m.y, text: 'Mine!', color: '#ff5fa8' });
      const round = G.round(), cd = u.cast;
      w.spawn(function* () { yield cd - w.t; if (G.round() === round && u.alive && u.cast === cd) w.emit({ k: 'text3d', x: u.x, y: u.y, text: 'Ready!', color: '#57e36b' }); });
    };

    G.trig('SpellbreakerDeath', function* (e) {
      for (const m of w.alive((m) => m.creature && m.owner === e.unit.owner)) w.kill(m);
    }, { cond: (e) => G.key.has(e.unit) }).on('death');

    G.trig('SpellbreakerTick', function* () {
      const beans = G.beans();
      for (const m of w.alive((m) => m.creature)) {
        if (m.baseSpeed > 0 && w.t >= m.pauseUntil && (w.tick + m.id) % 6 === 0) {
          let t = null, bd = m.owner === P_ENEMY ? 600 : 1e9;
          for (const b of beans) if (b.owner !== m.owner) { const d = dist(b, m); if (d < bd) { bd = d; t = b; } }
          if (t) w.issue(m, { type: 'move', x: t.x, y: t.y });
          else if (!m.order) w.issue(m, { type: 'move', ...polar(C(), w.rng.real(0, 350), w.rng.dir()) });
        }
        for (const b of beans) if (b.alive && b.owner !== m.owner && dist(b, m) <= m.coll + b.coll + 4) { G.boom(b); break; }
      }
    }).every(0.05);

    // bots: grab the closest wild creature when ready, run from creatures that aren't theirs
    G.trig('SpellbreakerAI', function* () {
      const mons = w.alive((m) => m.creature);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t >= u.cast && w.t >= (u.botNext || 0)) {
            u.botNext = w.t + w.rng.real(0.4, 1.2);
            let best = null, bd = SB.range;
            for (const m of mons) if (m.owner === P_ENEMY) { const d = dist(u, m) - (BIG.has(m.type) ? 150 : 0); if (d < bd) { bd = d; best = m; } }
            if (best) S.take(u, best);
          }
          let fx = 0, fy = 0;
          for (const m of mons) if (m.owner !== u.owner) { const d = dist(u, m); if (d < 300) { const k = (300 - d) / 300 / (d || 1); fx += (u.x - m.x) * k; fy += (u.y - m.y) * k; } }
          const dc = dist(u, C()); if (dc > 380) { fx += (C().x - u.x) / dc * 0.5; fy += (C().y - u.y) / dc * 0.5; }
          if (Math.hypot(fx, fy) > 0.12) w.issue(u, { type: 'steer', dx: fx, dy: fy });
          else if (u.order?.type === 'steer') w.issue(u, { type: 'stop' });
        }
      });
    }).every(0.1);

    return init;
  },
};
