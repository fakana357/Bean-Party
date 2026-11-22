// Bean-Whack-a-Fiend — based on "Whack-a-Fiend" (Triggers_Events[23]).
// Kept: beans start 100-400 from the centre, fiends (one per player) pop up at
// random and burrow again every second, every whacked fiend is replaced,
// "kill 10 crypt fiends", 90 s timer, race scoring.
// Polished: no hero spells or XP: bump a fiend that is up to whack it. Holes
// are a fixed 4x4 grid and glow before a fiend bursts out; standing on a hole
// when it bursts = out.
import { P_ENEMY, P_NEUTRAL, center, offset, dist } from '../engine.js';

const WH = { goal: 10, warn: 0.8, up: 2.2, holeR: 52, hitR: 60, gap: 224 };

export default {
  num: 23, id: 'whack', title: 'Bean-Whack-a-Fiend', orig: 'Whack-a-Fiend',
  subtitle: 'Whack 10 fiends!', arena: 'whack_a_fiend', rect: 'Whack_a_Fiend', kind: 'race',
  hint: 'Bump fiends that pop up to whack them (10 wins). Don’t stand on a glowing hole!',
  objective: 'Whack 10 fiends first to finish. Don’t stand on a glowing hole.',
  clip: ['Whack_a_Fiend', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Whack_a_Fiend);
    const W = (v.whack = { holes: [], target: 3 });

    const init = G.trig('WhackInitialization', function* () {
      G.music('human1');
      v.ante = 8;
      W.holes = [];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const p = offset(C(), (a - 1.5) * WH.gap, (b - 1.5) * WH.gap);
        const h = w.create('ucrm', P_NEUTRAL, p, 270); h.coll = 0; h.acquire = 0;
        W.holes.push({ x: h.x, y: h.y, state: 'idle', t: 0, fiend: null });
      }
      G.forPlaying((i) => { const b = G.bean('Hmkg', i, offset(C(), 0, 0)); b.whacks = 0; });
      for (const b of w.ofType('Hmkg')) { // start between holes, 100-400 from the centre
        const a = w.rng.dir(), r = w.rng.real(100, 400);
        const p = { x: C().x + Math.cos(a * Math.PI / 180) * r, y: C().y + Math.sin(a * Math.PI / 180) * r };
        if (W.holes.every((h) => dist(h, p) > 90) && G.beans().every((o) => o === b || dist(o, p) > 60)) { b.x = p.x; b.y = p.y; }
      }
      G.addKey(w.ofType('Hmkg'));
      W.target = Math.max(3, G.beans().length);
      G.cameraBounds(R.Whack_a_Fiend);
      G.startTimer(90, 'Time Left');
      G.say('Bean-Whack-a-Fiend', 'Whack 10 fiends!');
      T.RaceDeath.enable(); T.RaceExpire.enable();
      G.forBots(() => T.WhackAI.enable());
      yield 4;
      T.WhackTick.enable(); T.WhackSwap.enable(); T.WhackSwap.execute();
    });

    function pop() {
      const free = W.holes.filter((h) => h.state === 'idle'); if (!free.length) return;
      const h = w.pick(free); h.state = 'warn'; h.t = w.t + WH.warn;
      w.emit({ k: 'warn', id: 'whack' + W.holes.indexOf(h), x: h.x, y: h.y, r: WH.holeR, dur: WH.warn, hot: true });
    }
    const active = () => W.holes.filter((h) => h.state !== 'idle').length;

    // every second a fiend burrows and up to two pop out (as in Whack Swap)
    G.trig('WhackSwap', function* () {
      for (let k = 0; k < 2 && active() < W.target; k++) pop();
    }).every(1);

    G.trig('WhackTick', function* () {
      for (const h of W.holes) {
        if (h.state === 'warn' && w.t >= h.t) {
          h.state = 'up'; h.t = w.t + WH.up;
          h.fiend = w.create('ucry', P_ENEMY, h, w.rng.dir()); h.fiend.coll = 0; h.fiend.acquire = 0; h.fiend.baseSpeed = 0;
          w.emit({ k: 'impact', x: h.x, y: h.y, type: 'ucry', r: WH.holeR }); w.emit({ k: 'sfx', id: 'pop' });
          for (const b of G.beans()) if (dist(b, h) <= WH.holeR) G.boom(b);
        } else if (h.state === 'up') {
          if (!h.fiend || !h.fiend.alive) { h.state = 'idle'; h.fiend = null; continue; }
          if (w.t >= h.t) { w.remove(h.fiend); h.fiend = null; h.state = 'idle'; continue; }
          let best = null, bd = 1e9;
          for (const b of G.beans()) { const d = dist(b, h); if (d <= WH.hitR && d < bd) { bd = d; best = b; } }
          if (best) {
            h.fiend.exploded = true; w.kill(h.fiend); h.fiend = null; h.state = 'idle';
            best.whacks = (best.whacks || 0) + 1;
            w.emit({ k: 'text3d', x: h.x, y: h.y + 40, text: String(best.whacks), color: '#ffd23f' }); w.emit({ k: 'sfx', id: 'ding' });
            if (best.whacks >= WH.goal) { v.focus = best; T.RaceFinish.execute(); }
            pop();
          }
        }
      }
    }).every(0.05);

    // bots: run to the nearest fiend that is up (or about to be), never onto a glowing hole
    G.trig('WhackAI', function* () {
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const skill = u.whSkill ??= w.rng.real(0.6, 1);
          const danger = W.holes.find((h) => h.state === 'warn' && dist(u, h) < WH.holeR + 30);
          if (danger) { const d = dist(u, danger) || 1; w.issue(u, { type: 'steer', dx: (u.x - danger.x) / d, dy: (u.y - danger.y) / d }); continue; }
          if (w.rng.next() > skill) continue;
          let best = null, bd = 1e9;
          for (const h of W.holes) {
            if (h.state === 'idle') continue;
            const d = dist(u, h) + (h.state === 'warn' ? 150 : 0);
            if (d < bd) { bd = d; best = h; }
          }
          if (!best) continue;
          if (best.state === 'up') { w.issue(u, { type: 'move', x: best.x, y: best.y }); continue; }
          // wait next to a warned hole
          const d = dist(u, best) || 1, wait = WH.holeR + 22;
          if (d > wait + 10) w.issue(u, { type: 'move', x: best.x + (u.x - best.x) / d * wait, y: best.y + (u.y - best.y) / d * wait });
          else if (u.order) w.issue(u, { type: 'stop' });
        }
      });
    }).every(0.1);

    return init;
  },
};
