// The A-Bean-inations — based on "The Abombinations" (Triggers_Events[28]).
// Kept: beans start 384 from the centre (slot*135-22.5), an abombination portals
// in at the centre every 10 s (max 10) and chases a random bean, each pop brings
// another one 1-3 s later, pops blow up everything nearby (chains), they rot away
// (and blow up) after 20 s, survival scoring with ties.
// Polished: Space shoots the blob nearest the cursor (1.5 s reload), a blob's
// touch = out (and it pops), the blast radius is drawn, 120 s safety timer.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const ABOM = { speed: 300, touch: 64, blast: 190, delay: 0.3, fuse: 20, reload: 1.5 };

export default {
  num: 28, id: 'abombinations', title: 'The A-Bean-inations', orig: 'The Abombinations',
  subtitle: 'Keep away from the Abombinations!', arena: 'abombinations', rect: 'Abombinations', kind: 'survival',
  hint: 'Space = shoot the blob nearest your cursor. Blobs pop in a big blast — touching one = out!',
  objective: 'Be the last bean standing. Out: a blob or its blast touches you.',
  clip: ['Abombinations', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) {
    const w = G.w; if (w.t < (u.reload || 0)) return false;
    const p = aim || target; if (!p) return false;
    let best = null, bd = 1e9;
    for (const b of w.ofType('u000')) { if (b.popping) continue; const d = dist(b, p); if (d < bd) { bd = d; best = b; } }
    if (!best) return false;
    G.v.abom.shoot(u, best); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Abombinations);
    const A = (v.abom = {});

    const init = G.trig('AbombinationsInitialization', function* () {
      G.music('undead3');
      v.tiesPossible = true;
      const ang = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => i * 135 - 22.5);
      for (let i = ang.length - 1; i > 0; i--) { const j = w.rng.int(0, i); [ang[i], ang[j]] = [ang[j], ang[i]]; }
      let k = 0;
      G.forPlaying((i) => { const b = G.bean('hrif', i, polar(C(), 384, ang[k++]), { speed: 270 }); b.reload = 0; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('hrif'));
      G.cameraBounds(R.Abombinations);
      G.startTimer(120, 'Time Left');
      G.say('The A-Bean-inations', 'Keep away from the Abombinations!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.AbombinationsTick.enable();
      w.emit({ k: 'teleport', x: C().x, y: C().y });
      yield 5;
      T.AbombinationsSpawn.enable(); T.AbombinationsSpawn.execute();
      G.forBots(() => T.AbombinationsAI.enable());
    });

    const chase = (m) => { const t = w.pick(G.beans()); m.prey = t; if (t) w.issue(m, { type: 'move', x: t.x, y: t.y, follow: t }); };

    G.trig('AbombinationsSpawn', function* () {
      const m = w.create('u000', P_ENEMY, C());
      m.abils = m.abils.filter((a) => a !== 'Adda' && a !== 'Awan'); m.acquire = 0; m.baseSpeed = ABOM.speed; m.regen = 0;
      m.bornT = w.t; m.pauseUntil = w.t + 1;
      w.emit({ k: 'teleport', x: m.x, y: m.y }); G.sound('teleport', m);
      yield 1;
      if (m.alive) chase(m);
    }, { cond: () => w.ofType('u000').length < 10 }).every(10);

    function pop(m) {
      if (!m.alive || m.popping) return;
      m.popping = true; m.order = null; m.baseSpeed = 0;
      const round = G.round();
      w.spawn(function* () {
        yield ABOM.delay;
        if (G.round() !== round || !m.alive) return;
        const x = m.x, y = m.y;
        w.explode(m); w.emit({ k: 'boom', x, y, r: ABOM.blast }); w.quake = 500; G.sound('gateDeath', m);
        for (const b of G.beans()) if (dist(b, { x, y }) <= ABOM.blast + b.coll * 0.5) G.boom(b);
        for (const o of w.ofType('u000')) if (dist(o, { x, y }) <= ABOM.blast) pop(o);
        yield w.rng.real(1, 3);
        if (G.round() === round && T.AbombinationsSpawn.enabled) T.AbombinationsSpawn.conditional({});
      });
    }
    A.shoot = (u, m) => {
      u.reload = w.t + ABOM.reload; u.facing = angleTo(u, m);
      w.emit({ k: 'sfx', id: 'shoot' });
      w.shoot(u, m, { speed: 2500, type: 'boulder', onHit: (_, t) => pop(t) });
    };

    G.trig('AbombinationsTick', function* () {
      for (const m of w.ofType('u000')) {
        if (m.popping) continue;
        const age = w.t - m.bornT;
        if (age >= ABOM.fuse) { pop(m); continue; }
        if (age >= ABOM.fuse - 2 && !m.warned) { m.warned = true; w.emit({ k: 'warn', id: m.id, x: m.x, y: m.y, r: ABOM.blast, dur: 2, hot: true }); }
        if (w.t >= m.pauseUntil && (!m.prey || !m.prey.alive)) chase(m);
        for (const b of G.beans()) if (dist(b, m) <= ABOM.touch) { G.boom(b); pop(m); break; }
      }
    }).every(0.05);

    // bots: shoot blobs next to rivals (sabotage, as the quest advises) or blobs
    // coming at them while still far enough away; run from nearby blobs
    G.trig('AbombinationsAI', function* () {
      const blobs = w.ofType('u000').filter((m) => !m.popping), beans = G.beans();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t >= u.reload && w.t >= (u.botNext || 0)) {
            let pick = null;
            for (const m of blobs) {
              const dm = dist(u, m); if (dm < ABOM.blast + 70) continue;
              if (beans.some((o) => o !== u && dist(o, m) < ABOM.blast * 0.8)) { pick = m; break; }
              if ((m.prey === u && dm < 520) || dm < 330) pick = m;
            }
            if (pick) { A.shoot(u, pick); u.botNext = w.t + w.rng.real(0.3, 0.9); }
          }
          let fx = 0, fy = 0;
          for (const m of blobs) { const d = dist(u, m); if (d < 420) { const k = (420 - d) / 420 / (d || 1); fx += (u.x - m.x) * k; fy += (u.y - m.y) * k; } }
          const dc = dist(u, C()); if (dc > 330) { fx += (C().x - u.x) / dc * 0.6; fy += (C().y - u.y) / dc * 0.6; }
          if (Math.hypot(fx, fy) > 0.15) w.issue(u, { type: 'steer', dx: fx, dy: fy });
          else if (u.order?.type === 'steer') w.issue(u, { type: 'stop' });
          else if (!u.order && w.rng.next() < 0.03) w.issue(u, { type: 'move', ...polar(u, w.rng.real(200, 400), angleTo(C(), u) + 180 + w.rng.real(-120, 120)) });
        }
      });
    }).every(0.1);

    return init;
  },
};
