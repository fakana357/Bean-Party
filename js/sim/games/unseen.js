// The Unseen Bean — based on "The Unseen" (Triggers_Events[34]).
// Kept: beans start 1024 west of the centre, 20 invisible guards stand still
// somewhere in Unseen_Center, a magic eye reveals them, finish in the east,
// 90 s timer, race scoring.
// Polished: guards are one touch = out instead of hitting HP. Space throws an
// eye toward the cursor (3 s cooldown) that reveals guards within 320 for 6 s,
// for everyone. Hidden guards shimmer very faintly.
import { P_ENEMY, P_NEUTRAL, center, offset, polar, dist, angleTo } from '../engine.js';

const UN = { count: 20, eyeRange: 450, eyeR: 320, eyeDur: 6, cool: 3, hitPad: 14 };

export default {
  num: 34, id: 'unseen', title: 'The Unseen Bean', orig: 'The Unseen',
  subtitle: 'Evade hidden guards and reach the end!', arena: 'unseen', rect: 'Unseen', kind: 'race',
  hint: 'Space = throw a magic eye that reveals hidden guards. Touch a guard = out!',
  objective: 'Reach the far side. Out: a (hidden) guard touches you.',
  clip: ['Unseen', 64, 64],
  action(G, u, target, aim) {
    const p = target || aim; if (!p) return false;
    return G.v.unseen.eye(u, p);
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Unseen);
    const U = (v.unseen = { eyes: [] });

    function refresh() {
      U.eyes = U.eyes.filter((e) => e.end > w.t);
      for (const g of w.ofType('ndrf')) g.revealed = U.eyes.some((e) => dist(e, g) <= UN.eyeR);
    }
    U.eye = (u, p) => {
      if (!u.alive || w.t < (u.unCd || 0) || !T.UnseenTick.enabled) return false;
      u.unCd = w.t + UN.cool;
      let q = dist(u, p) > UN.eyeRange ? polar(u, UN.eyeRange, angleTo(u, p)) : { x: p.x, y: p.y };
      w.emit({ k: 'sfx', id: 'throw' });
      w.lob(u, q.x, q.y, { speed: 900, type: 'eye', onImpact: () => {
        U.eyes.push({ x: q.x, y: q.y, end: w.t + UN.eyeDur });
        w.emit({ k: 'ring', x: q.x, y: q.y, r: UN.eyeR, color: 0x9fe8ff, dur: 0.8 });
        refresh();
      } });
      return true;
    };

    const init = G.trig('UnseenInitialization', function* () {
      G.music('lichking');
      v.ante = 8; U.eyes = [];
      const st = offset(C(), -1024, 0);
      G.forPlaying((i) => { const b = G.bean('odoc', i, offset(st, w.rng.real(-128, 128), w.rng.real(-256, 256)), { speed: 270 }); b.facing = 0; b.unCd = 0; });
      G.addKey(w.ofType('odoc'));
      const zone = R.Unseen_Center;
      for (let k = 0, tries = 0; k < UN.count && tries < 400; tries++) {
        const p = w.randomIn(zone);
        if (!w.grid.walkable(p.x, p.y, 16)) continue;
        const g = w.create('ndrf', P_ENEMY, p, w.rng.dir());
        g.acquire = 0; g.baseSpeed = 0; g.coll = 16; g.revealed = false; g.abils = g.abils.filter((a) => a !== 'Apiv');
        k++;
      }
      w.create('ncop', P_NEUTRAL, center(R.Unseen_Finish));
      G.cameraBounds(R.Unseen);
      G.startTimer(90, 'Time Left');
      G.say('The Unseen Bean', 'Evade hidden guards and reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.UnseenFinish.enable(); T.UnseenTick.enable();
      yield 4;
      G.forBots(() => T.UnseenAI.enable());
    });

    G.trig('UnseenFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.UnseenFinish, rect: R.Unseen_Finish });

    G.trig('UnseenTick', function* () {
      refresh();
      const gs = w.ofType('ndrf');
      for (const b of G.beans()) for (const g of gs) if (dist(b, g) <= g.coll + b.coll + UN.hitPad) {
        g.revealed = true; w.emit({ k: 'swing', id: g.id }); G.boom(b); break;
      }
    }).every(0.05);

    // bots: throw eyes ahead now and then, walk east, back off from guards they can see
    G.trig('UnseenAI', function* () {
      const goal = center(R.Unseen_Finish), gs = w.ofType('ndrf');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t >= u.unCd && w.rng.next() < 0.12) U.eye(u, polar(u, 300, angleTo(u, goal) + w.rng.real(-45, 45)));
          const seen = gs.filter((g) => (g.revealed || w.rng.next() < 0.02) && dist(g, u) < 110);
          if (seen.length) {
            const g = seen[0], a = angleTo(g, u), side = angleTo(u, goal) + (w.rng.next() < 0.5 ? 90 : -90);
            const p = polar(u, 120, (a + side) / 2);
            w.issue(u, { type: 'move', ...(w.grid.nearestWalkable(p.x, p.y, 24) || p) });
            u.unWait = w.t + 0.5; continue;
          }
          if (w.t < (u.unWait || 0)) continue;
          if (!u.order) {
            // advance in short careful steps, pausing behind eyes
            const ahead = polar(u, w.rng.real(120, 240), angleTo(u, goal) + w.rng.real(-25, 25));
            w.issue(u, { type: 'move', ...(w.grid.nearestWalkable(ahead.x, ahead.y, 24) || goal) });
          }
        }
      });
    }).every(0.25);

    return init;
  },
};
