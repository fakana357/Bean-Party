// Quill-Bean Mile — based on "Quillboar Mile" (Triggers_Events[33]).
// Kept: beans start 960 below the centre and run up to the finish, one spear
// thrower on each side (Quillboar_Left_Side / Right_Side), 60 s timer, race scoring.
// Polished: throwers no longer use hidden HP damage: every spear is lobbed at a
// marked spot (a ring shows where it lands) and a hit = out. Throwers slide
// along their side to keep up with the runners.
import { P_ENEMY, P_NEUTRAL, center, offset, dist } from '../engine.js';

const QB = { beanSpeed: 250, slide: 140, flight: 750, hitR: 56, range: 900, cool: [0.9, 1.5] };

export default {
  num: 33, id: 'quillboar', title: 'Quill-Bean Mile', orig: 'Quillboar Mile',
  subtitle: 'Reach the end!', arena: 'quillboar_mile', rect: 'Quillboar_Mile', kind: 'race',
  hint: 'Run to the flag. Spears land on the glowing rings: don’t be there!',
  objective: 'Reach the flag. Out: a spear lands on you.',
  clip: ['Quillboar_Mile', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Quillboar_Mile);
    const Q = (v.quillboar = { spots: [] });

    const init = G.trig('QuillboarInitialization', function* () {
      G.music('war2intro');
      v.ante = 8; Q.spots = [];
      G.forPlaying((i) => G.bean('npig', i, offset(C(), w.rng.real(-64, 64), -960 + w.rng.real(-32, 32)), { speed: QB.beanSpeed }));
      G.addKey(w.ofType('npig'));
      for (const [r, f] of [[R.Quillboar_Left_Side, 0], [R.Quillboar_Right_Side, 180]]) {
        const h = w.create('nqbh', P_ENEMY, w.randomIn(r), f);
        h.acquire = 0; h.coll = 0; h.qbRect = r; h.qbNext = 0;
      }
      w.create('ncop', P_NEUTRAL, center(R.Quillboar_Finish));
      G.cameraBounds(R.Quillboar_Mile);
      G.startTimer(60, 'Time Left');
      G.say('Quill-Bean Mile', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.QuillboarFinish.enable(); T.QuillboarThrow.enable();
      yield 4;
      for (const h of w.ofType('nqbh')) h.qbNext = w.t + w.rng.real(0.5, 1.5);
      G.forBots(() => T.QuillboarAI.enable());
    });

    G.trig('QuillboarFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.QuillboarFinish, rect: R.Quillboar_Finish });

    G.trig('QuillboarThrow', function* () {
      const beans = G.beans();
      for (const h of w.ofType('nqbh')) {
        // slide along the side toward the runners' average height
        if (beans.length) {
          const ty = beans.reduce((s, b) => s + b.y, 0) / beans.length;
          const step = QB.slide * 0.05, ny = h.y + Math.max(-step, Math.min(step, ty - h.y));
          h.y = Math.max(h.qbRect.y0, Math.min(h.qbRect.y1, ny));
        }
        if (!h.qbNext || w.t < h.qbNext) continue;
        const inRange = beans.filter((b) => dist(b, h) <= QB.range);
        if (!inRange.length) continue;
        h.qbNext = w.t + w.rng.real(...QB.cool);
        const b = w.pick(inRange), d = dist(h, b), fl = d / QB.flight, lead = w.rng.real(0.3, 1.0);
        const x = b.x + (b.vx || 0) * fl * lead, y = b.y + (b.vy || 0) * fl * lead;
        h.facing = Math.atan2(y - h.y, x - h.x) * 180 / Math.PI;
        const s = { x, y, end: w.t + fl };
        Q.spots.push(s);
        w.emit({ k: 'warn', id: 'qb' + w.t + h.id, x, y, r: QB.hitR - 20, dur: fl, hot: true });
        w.emit({ k: 'swing', id: h.id }); w.emit({ k: 'sfx', id: 'throw' });
        w.lob(h, x, y, { speed: QB.flight, type: 'spear', onImpact: () => {
          Q.spots.splice(Q.spots.indexOf(s), 1);
          w.emit({ k: 'impact', x, y, type: 'spear', r: QB.hitR });
          for (const o of G.beans()) if (Math.hypot(o.x - x, o.y - y) <= QB.hitR) G.boom(o);
        } });
      }
    }).every(0.05);

    // bots: run for the flag, sidestep any ring they are standing in
    G.trig('QuillboarAI', function* () {
      const goal = center(R.Quillboar_Finish);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.qbWait ??= w.t + w.rng.real(0, 1))) continue;
          const danger = Q.spots.find((s) => Math.hypot(s.x - u.x, s.y - u.y) < QB.hitR + 30 && s.end - w.t < (u.qbReact ??= w.rng.real(0.5, 0.9)));
          if (danger) {
            const d = Math.hypot(u.x - danger.x, u.y - danger.y) || 1;
            let dx = (u.x - danger.x) / d, dy = (u.y - danger.y) / d;
            if (d < 5) { dx = w.rng.next() < 0.5 ? 1 : -1; dy = 0; }
            w.issue(u, { type: 'steer', dx, dy }); continue;
          }
          if (!u.order || u.order.type !== 'move') w.issue(u, { type: 'move', x: goal.x, y: goal.y });
        }
      });
    }).every(0.1);

    return init;
  },
};
