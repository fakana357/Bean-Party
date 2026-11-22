// Dune Bean Distress — based on "Dune Worm Distress" (Triggers_Events[43]).
// Kept: worms start within 100 of the centre, the rock field (restored each
// round) can be dug through by worms but not by the predator, barricades
// (100 lumber = 2 each) that the predator breaks over time, the Wildkin arriving
// at the centre and lunging at a random worm every 4 s (1 in 2), survival scoring.
// Polished: walk into a rock to dig it away (0.5 s), Space drops a barricade
// toward the cursor, the Wildkin's touch = out. Digging time is 30 s (was 40 s,
// with worms a bit faster: 150 instead of 100) and a 75 s hunt timer ends it.
import { P_ENEMY, P_NEUTRAL, center, polar, dist, angleTo } from '../engine.js';

export const DUNE = { dig: 0.5, digR: 100, barricades: 2, barR: 32, barLife: 2.5, prep: 30, hunt: 75, speed: 150, reach: 60 };

export default {
  num: 43, id: 'dune', title: 'Dune Bean Distress', orig: 'Dune Worm Distress',
  subtitle: 'Dig a home, and keep away from the predator!', arena: 'dune_worm_distress', rect: 'Dune_Worm_Distress', kind: 'survival',
  hint: 'Push into rocks to dig a burrow. Space = drop a barricade (2). The Wildkin’s touch = out!',
  objective: 'Be the last bean standing. Out: the Wildkin touches you.',
  clip: ['Dune_Worm_Distress', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) {
    const w = G.w; if (!(u.bars > 0)) return false;
    const a = aim ? angleTo(u, aim) : u.facing;
    const p = polar(u, u.coll + DUNE.barR + 6, a);
    if (!w.grid.walkable(p.x, p.y, 8)) return false;
    u.bars--;
    const b = w.create('ndwm', P_NEUTRAL, p); b.x = p.x; b.y = p.y;
    b.role = 'barricade'; b.baseSpeed = 0; b.coll = DUNE.barR; b.invuln = true; b.life = DUNE.barLife;
    w.emit({ k: 'sfx', id: 'click' }); w.emit({ k: 'ring', x: p.x, y: p.y, r: 50, color: 0xffd23f, dur: 0.4 });
    return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Dune_Worm_Distress);
    const D = (v.dune = {});
    const self = this;

    const init = G.trig('DuneInitialization', function* () {
      G.music('illidan');
      D.kin = null;
      w.restoreDestructables(R.Dune_Worm_Distress);
      v.tiesPossible = true;
      G.forPlaying((i) => { const b = G.bean('ndwm', i, polar(C(), w.rng.real(0, 100), w.rng.dir()), { speed: DUNE.speed }); b.bars = DUNE.barricades; });
      G.addKey(w.ofType('ndwm'));
      w.emit({ k: 'teleport', x: C().x, y: C().y });
      G.cameraBounds(R.Dune_Worm_Distress);
      G.startTimer(DUNE.prep, 'Predator in');
      G.say('Dune Bean Distress', 'Dig a home, and keep away from the predator!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.DuneTick.enable();
      G.forBots(() => T.DuneAI.enable());
      const round = G.round();
      yield DUNE.prep;
      if (G.round() !== round) return;
      const k = (D.kin = w.create('nowb', P_ENEMY, C()));
      k.acquire = 0; k.abils = []; k.next = w.t;
      w.emit({ k: 'teleport', x: k.x, y: k.y }); w.quake = 300; G.say('The Wildkin is here!', 'Hide!');
      G.startTimer(DUNE.hunt, 'Time Left'); T.SurvivalExpire.enable();
      T.DuneWildkin.enable();
    });

    const rocks = () => w.destIn(R.Dune_Worm_Distress).filter((d) => d.alive && d.id === 'DTrc');

    // the Wildkin picks a random worm and goes for it (1 in 2 every 4 s, as the original)
    G.trig('DuneWildkin', function* () {
      const k = D.kin; if (!k || !k.alive || w.rng.int(1, 2) !== 1) return;
      const t = w.pick(G.beans()); if (t) { k.prey = t; w.issue(k, { type: 'move', x: t.x, y: t.y }); }
    }).every(4);

    G.trig('DuneTick', function* () {
      const beans = G.beans(), rs = rocks();
      // digging: pushing into a rock for 0.5 s clears it
      for (const b of beans) {
        if (!b.order) { b.digT = 0; continue; }
        let r = null;
        for (const d of rs) if (dist(b, d) <= DUNE.digR && Math.abs(((angleTo(b, d) - b.facing) % 360 + 540) % 360 - 180) < 60) { r = d; break; }
        if (!r) { b.digT = 0; continue; }
        if (b.digRock !== r) { b.digRock = r; b.digT = 0; }
        b.digT += 0.05;
        if (b.digT >= DUNE.dig) { w.setDest(r, false); w.emit({ k: 'impact', x: r.x, y: r.y, type: 'DTrc', r: 60 }); b.digT = 0; }
      }
      const k = D.kin; if (!k || !k.alive) return;
      // chase the chosen worm while it is reachable, else wander toward it
      if (k.prey && k.prey.alive && (w.tick % 10 === 0)) w.issue(k, { type: 'move', x: k.prey.x, y: k.prey.y });
      // barricades wear down while the Wildkin leans on them
      for (const bar of w.alive((u) => u.role === 'barricade')) if (dist(bar, k) <= bar.coll + k.coll + 12) {
        bar.life -= 0.05;
        if (bar.life <= 0) { w.emit({ k: 'impact', x: bar.x, y: bar.y, type: 'ndwm', r: 50 }); w.kill(bar); }
      }
      for (const b of beans) if (dist(b, k) <= DUNE.reach + b.coll) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'nowb', r: 50 }); w.kill(b); }
    }).every(0.05);

    // bots: dig a short tunnel into the nearest rocks, then hide and barricade the mouth
    G.trig('DuneAI', function* () {
      const rs = rocks(), k = D.kin;
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < (u.botNext || 0)) continue;
          u.botNext = w.t + w.rng.real(0.2, 0.5);
          if (k && k.alive) {
            const dk = dist(u, k);
            if (dk < 260 && u.bars > 0 && w.rng.next() < 0.5) self.action(G, u, null, k);
            if (dk < 200) { const p = polar(u, 150, angleTo(k, u) + w.rng.real(-40, 40)); w.issue(u, { type: 'move', ...p }); continue; }
            if (u.dug >= 3) { if (u.order) w.issue(u, { type: 'stop' }); continue; }
          }
          if ((u.dug || 0) >= 3) { if (u.order) w.issue(u, { type: 'stop' }); continue; }
          if (!u.rock || !u.rock.alive) {
            if (u.rock) u.dug = (u.dug || 0) + 1;
            let best = null, bd = 1e9;
            for (const d of rs) { const s = dist(u, d) - (u.dug ? 0 : dist(d, C()) * 0.3) + w.rng.real(0, 40); if (s < bd) { bd = s; best = d; } }
            u.rock = best;
          }
          if (u.rock) { const d = dist(u, u.rock) || 1; w.issue(u, { type: 'steer', dx: (u.rock.x - u.x) / d, dy: (u.rock.y - u.y) / d }); }
        }
      });
    }).every(0.1);

    return init;
  },
};
