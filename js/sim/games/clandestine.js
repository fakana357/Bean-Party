// Clandes-Bean Kitty — based on "Clandestine Kitty" (Triggers_Events[49]).
// Kept: the long night-time grove, beans start at the bottom (Clandestine_Start),
// a treat waits near the top (centre + 1216, ±128), 3 guards start at centre
// -512/+256/+768 and wander to a random spot every 7 s, bring the treat home to
// finish, race scoring.
// Polished: the guards' crippling attacks became one clear rule: a guard that SEES
// you MOVING (within 320, trees block sight) charges at you, and touching a guard
// = out. Stand still to stay hidden. The treat drops where its carrier falls and a
// new one appears after each delivery. 120 s timer instead of 150.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, angleTo, polar, inRect } from '../engine.js';

export const KITTY = { sight: 320, charge: 280, chargeFor: 2.5, walk: 190, touch: 34, grab: 50 };

export default {
  num: 49, id: 'clandestine', title: 'Clandes-Bean Kitty', orig: 'Clandestine Kitty',
  subtitle: 'Obtain a vial, and return to safety!', arena: 'clandestine_kitty', rect: 'Clandestine_Kitty', kind: 'race',
  hint: 'Grab the treat at the top and bring it home. Guards spot you only while you move — freeze!',
  objective: 'Bring the treat home. Out: a guard touches you.',
  clip: ['Clandestine_Kitty', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Clandestine_Kitty);
    const S = (v.clandestine = { treat: null, carrier: null });

    function placeTreat(p) {
      const t = w.create('Huth', P_NEUTRAL, p); t.x = p.x; t.y = p.y; t.coll = 0; t.baseSpeed = 0; t.invuln = true; t.acquire = 0; t.paused = true;
      S.treat = t; S.carrier = null;
      w.emit({ k: 'ring', x: p.x, y: p.y, r: 50, color: 0xffd23f, dur: 0.6 });
    }
    const topSpot = () => {
      const c = offset(C(), 0, 1216);
      for (let k = 0; k < 30; k++) { const p = offset(c, w.rng.real(-128, 128), w.rng.real(-128, 128)); if (w.grid.walkable(p.x, p.y, 20)) return p; }
      return w.grid.nearestWalkable(c.x, c.y, 20) || c;
    };

    const init = G.trig('ClandestineInitialization', function* () {
      G.music('lichking');
      v.ante = 8; w.tod = 0;
      G.forPlaying((i) => G.bean('Emoo', i, w.randomIn(R.Clandestine_Start), { speed: 300 }));
      G.addKey(w.ofType('Emoo'));
      for (const dy of [-512, 256, 768]) {
        const g = w.create('nbal', P_ENEMY, offset(C(), 0, dy)); g.acquire = 0; g.invuln = true; g.baseSpeed = KITTY.walk; g.chaseEnd = 0;
      }
      w.create('ncop', P_NEUTRAL, center(R.Clandestine_Start));
      placeTreat(topSpot());
      G.cameraBounds(R.Clandestine_Kitty);
      G.startTimer(120, 'Time Left');
      G.say('Clandes-Bean Kitty', 'Obtain a vial, and return to safety!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.ClandestineTick.enable(); T.ClandestineDrop.enable();
      yield 2;
      T.ClandestineGuards.enable();
      G.forBots(() => T.ClandestineAI.enable());
    });

    // a fallen carrier drops the treat
    G.trig('ClandestineDrop', function* (e) {
      if (S.carrier === e.unit) placeTreat(w.grid.nearestWalkable(e.unit.x, e.unit.y, 20) || { x: e.unit.x, y: e.unit.y });
    }, { cond: (e) => G.key.has(e.unit) }).on('death');

    G.trig('ClandestineTick', function* () {
      const guards = w.ofType('nbal');
      for (const b of G.beans()) {
        if (guards.some((g) => dist(g, b) <= b.coll + KITTY.touch)) { w.kill(b); continue; }
        if (S.treat && S.treat.alive && dist(b, S.treat) <= KITTY.grab) {
          w.remove(S.treat); S.treat = null; S.carrier = b;
          w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'Got it!', color: '#ffd23f' }); w.emit({ k: 'sfx', id: 'ding' });
        }
        if (S.carrier === b && inRect(R.Clandestine_Start, b)) {
          S.carrier = null; v.focus = b; T.RaceFinish.execute();
          placeTreat(topSpot());
        }
      }
      if (S.carrier && S.carrier.alive && w.tick % 20 === 0) w.emit({ k: 'ring', x: S.carrier.x, y: S.carrier.y, r: 40, color: 0xffd23f, dur: 0.4 });
    }).every(0.05);

    // guards: wander (new spot every 7 s); charge at a bean they see moving
    G.trig('ClandestineGuards', function* () {
      const beans = G.beans();
      for (const g of w.ofType('nbal')) {
        if (w.t < g.chaseEnd && g.target && g.target.alive) { w.issue(g, { type: 'move', x: g.target.x, y: g.target.y }); continue; }
        g.baseSpeed = KITTY.walk; g.target = null;
        let seen = null, bd = KITTY.sight;
        for (const b of beans) { const d = dist(g, b); if (d < bd && b.moving && w.grid.los(g.x, g.y, b.x, b.y, 1)) { bd = d; seen = b; } }
        if (seen) {
          g.target = seen; g.chaseEnd = w.t + KITTY.chargeFor; g.baseSpeed = KITTY.charge;
          w.emit({ k: 'spotted', id: seen.id, tower: g.id });
          w.issue(g, { type: 'move', x: seen.x, y: seen.y });
        } else if (!g.order || w.t >= (g.roamAt || 0)) { g.roamAt = w.t + 7; w.issue(g, { type: 'move', ...w.randomIn(R.Clandestine_Kitty) }); }
      }
    }).every(0.1);

    // bots: head for the treat (or home with it); freeze when a guard could see them,
    // but step away if one is about to bump into them
    G.trig('ClandestineAI', function* () {
      const guards = w.ofType('nbal');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const goal = S.carrier === u ? center(R.Clandestine_Start) : S.treat ? { x: S.treat.x, y: S.treat.y } : offset(C(), 0, 900);
          let close = null, cd = 1e9;
          for (const g of guards) { const d = dist(g, u); if (d < cd) { cd = d; close = g; } }
          const brave = u.brave ??= w.rng.real(0.85, 1.15);
          const hunted = guards.some((g) => g.target === u && w.t < (g.chaseEnd || 0));
          if (hunted || (close && cd < 150)) { G.botGo(u, goal, guards, { fear: hunted ? 360 : 170, lead: 0.4 }); continue; }
          if (close && cd < (KITTY.sight + 60) * brave && w.grid.los(close.x, close.y, u.x, u.y, 1)) { if (u.order) w.issue(u, { type: 'stop' }); continue; }
          if (!u.botPath || w.tick % 20 === u.id % 20 || !u.botGoal || dist(u.botGoal, goal) > 8) { u.botPath = w.grid.path(u, goal, u.coll) || []; u.botGoal = goal; }
          while (u.botPath.length > 1 && dist(u, u.botPath[0]) < 16) u.botPath.shift();
          const wp = u.botPath[0] || goal;
          w.issue(u, { type: 'move', x: wp.x, y: wp.y });
        }
      });
    }).every(0.2);

    return init;
  },
};
