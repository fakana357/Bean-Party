// The Beanquerade — based on "The Masquerade" (Triggers_Events[25]).
// Kept: every bean has a den (Masquerade_1..8), villagers walk out of the
// Masquerade_Spawn spots at night, you must feed and be back home before
// sunrise, there are always fewer villagers than vampires, ties possible.
// Polished: hidden HP drain became a clear rule. At night touch a villager to
// feed (once). At sunrise you must be fed AND inside your den, else you fry.
// Leaving your den during the day = fry. Villagers per night = half the beans.
import { P_NEUTRAL, center, polar, dist, angleTo } from '../engine.js';

const MQ = { night: 18, day: 4, denR: 60, eatR: 50, firstDelay: 4 };

export default {
  num: 25, id: 'masquerade', title: 'The Beanquerade', orig: 'The Masquerade',
  subtitle: 'Feed, and return to your den before sunrise!', arena: 'masquerade', rect: 'Masquerade', kind: 'survival',
  hint: 'At night bump a villager to feed, then be in your den at sunrise. Hungry or outside = fried!',
  objective: 'Be the last bean standing. Out: you are hungry or outside your den at sunrise.',
  clip: ['Masquerade', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const M = (v.masq = { phase: 'intro', end: 0, dens: new Map() });
    const spawns = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => center(R['Masquerade_Spawn_' + i]));

    const init = G.trig('MasqueradeInitialization', function* () {
      G.music('lichking');
      v.tiesPossible = true;
      M.phase = 'intro'; M.dens = new Map();
      G.forPlaying((i) => {
        const c = center(R['Masquerade_' + i]);
        const den = w.create('otrb', P_NEUTRAL, c, 270); den.coll = 0; den.acquire = 0; den.invuln = true; den.denSlot = i;
        const b = G.bean('Udre', i, polar(c, 50, angleTo(c, center(R.Masquerade))), { speed: 270 });
        b.abils = b.abils.filter((a) => a !== 'Apiv'); b.invuln = false; b.fed = false;
        M.dens.set(b, c);
      });
      G.addKey(w.ofType('Udre'));
      G.cameraBounds(R.Masquerade);
      G.say('The Beanquerade', 'Feed, and return to your den before sunrise!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.MasqueradeTick.enable();
      G.forBots(() => T.MasqueradeAI.enable());
      yield MQ.firstDelay;
      T.MasqueradeLoop.execute();
    });

    const home = (b) => { const d = M.dens.get(b); return d && dist(b, d) <= MQ.denR; };
    function fry(b) { if (!b.alive) return; w.emit({ k: 'impact', x: b.x, y: b.y, type: 'sun', r: 50 }); G.boom(b); }

    G.trig('MasqueradeLoop', function* () {
      const round = G.round();
      const ok = () => G.round() === round && T.MasqueradeTick.enabled;
      while (ok()) {
        // night falls
        const n = G.beans().length;
        for (const b of G.beans()) b.fed = false;
        const count = Math.max(1, Math.floor(n / 2));
        const order = spawns.slice(); for (let i = order.length - 1; i > 0; i--) { const j = w.rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
        for (let k = 0; k < count; k++) { const u = w.create('nvl2', P_NEUTRAL, order[k % 8], w.rng.dir()); u.acquire = 0; u.mqWander = 0; }
        M.phase = 'night'; M.end = w.t + MQ.night;
        G.say(`Night falls: ${count} villager${count > 1 ? 's' : ''} out!`);
        w.emit({ k: 'sfx', id: 'new' });
        yield MQ.night - 3;
        for (let s = 3; s > 0; s--) {
          if (!ok()) return;
          G.say(`Sunrise in ${s}...`); w.emit({ k: 'sfx', id: 'tick' });
          for (const [b, d] of M.dens) if (b.alive) w.emit({ k: 'ring', x: d.x, y: d.y, r: MQ.denR, color: 0xffd23f, dur: 0.6 });
          yield 1;
        }
        if (!ok()) return;
        // sunrise
        M.phase = 'day'; M.end = w.t + MQ.day;
        for (const u of w.ofType('nvl2')) { w.emit({ k: 'teleport', x: u.x, y: u.y }); w.remove(u); }
        G.say('Sunrise!'); w.emit({ k: 'sfx', id: 'bigboom' });
        for (const b of G.beans()) if (!b.fed || !home(b)) fry(b);
        yield MQ.day;
      }
    });

    G.trig('MasqueradeTick', function* () {
      if (M.phase === 'night') {
        const vill = w.ofType('nvl2');
        for (const b of G.beans()) {
          if (b.fed) continue;
          for (const u of vill) if (u.alive && dist(b, u) <= MQ.eatR) {
            w.kill(u); b.fed = true;
            w.emit({ k: 'text3d', x: b.x, y: b.y + 40, text: 'Yum!', color: '#ff7fc8' });
            w.emit({ k: 'ring', x: b.x, y: b.y, r: 50, color: 0xff4d5e, dur: 0.6 }); w.emit({ k: 'sfx', id: 'ding' });
            break;
          }
        }
        // villagers: wander, run from hungry beans
        for (const u of w.ofType('nvl2')) {
          let near = null, nd = 300;
          for (const b of G.beans()) if (!b.fed) { const d = dist(u, b); if (d < nd) { nd = d; near = b; } }
          if (near) {
            if (!u.mqFlee || w.t >= u.mqFlee) { u.mqFlee = w.t + 0.4; w.issue(u, { type: 'move', ...polar(u, 200, angleTo(near, u) + w.rng.real(-40, 40)) }); }
          } else if (!u.order && w.t >= u.mqWander) { u.mqWander = w.t + w.rng.real(1, 3); w.issue(u, { type: 'move', ...polar(u, w.rng.real(100, 250), w.rng.dir()) }); }
        }
      } else if (M.phase === 'day') {
        for (const b of G.beans()) if (!home(b)) fry(b);
      }
    }).every(0.05);

    // bots: hunt the nearest villager, head home when fed or when sunrise is close
    G.trig('MasqueradeAI', function* () {
      G.forBots((i) => {
        for (const b of G.keyOf(i)) {
          if (!b.alive) continue;
          const den = M.dens.get(b);
          b.mqMargin ??= w.rng.real(1.0, 2.5);
          const goHome = M.phase !== 'night' || b.fed || (M.end - w.t) < dist(b, den) / b.speed + b.mqMargin;
          if (goHome) { if (dist(b, den) > 12) w.issue(b, { type: 'move', x: den.x, y: den.y }); else if (b.order) w.issue(b, { type: 'stop' }); continue; }
          let tg = null, td = 1e9;
          for (const u of w.ofType('nvl2')) { const d = dist(b, u); if (d < td) { td = d; tg = u; } }
          if (!tg) { if (dist(b, den) > 12) w.issue(b, { type: 'move', x: den.x, y: den.y }); continue; }
          const lead = Math.min(0.6, td / 400);
          w.issue(b, { type: 'move', x: tg.x + (tg.vx || 0) * lead, y: tg.y + (tg.vy || 0) * lead });
        }
      });
    }).every(0.2);

    return init;
  },
};
