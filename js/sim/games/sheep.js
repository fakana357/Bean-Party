// Bean Shearers — based on "Sheep Shearers" (Triggers_Events[39]).
// Kept: beans start at the top (Sheep_Start_Left/Right), the finish is at the
// bottom, two shearers race around the 4 corners (Sheep_Corner_1..4) at 400
// starting on opposite sides, they reverse direction every 15-20 s, getting
// close to one = out, 90 s timer, race scoring.
// Polished: the kill radius is drawn around each shearer (120 instead of an
// invisible 160) and bots wait for a gap.
import { P_ENEMY, P_NEUTRAL, center, dist } from '../engine.js';

const SH = { speed: 400, r: 120 };

export default {
  num: 39, id: 'sheep', title: 'Bean Shearers', orig: 'Sheep Shearers',
  subtitle: 'Reach the end!', arena: 'sheep_shearers', rect: 'Sheep_Shearers', kind: 'race',
  hint: 'Reach the flag. Keep out of the shearers’ circles: they reverse now and then!',
  objective: 'Reach the flag. Out: a shearer’s circle catches you.',
  clip: ['Sheep_Shearers', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const S = (v.sheep = { dir: 1, path: [], len: 0 });

    function at(s) {
      s = ((s % S.len) + S.len) % S.len;
      for (let i = 0; i < 4; i++) {
        const a = S.path[i], b = S.path[(i + 1) % 4], l = dist(a, b);
        if (s <= l) return { x: a.x + (b.x - a.x) * s / l, y: a.y + (b.y - a.y) * s / l, dx: (b.x - a.x) / l, dy: (b.y - a.y) / l };
        s -= l;
      }
      return { ...S.path[0], dx: 1, dy: 0 };
    }

    const init = G.trig('SheepInitialization', function* () {
      G.music('war2intro');
      v.ante = 8;
      const c = (n) => center(R['Sheep_Corner_' + n]);
      S.path = [c(1), c(2), c(4), c(3)];
      S.len = 0; for (let i = 0; i < 4; i++) S.len += dist(S.path[i], S.path[(i + 1) % 4]);
      S.dir = w.rng.int(1, 2) === 1 ? 1 : -1;
      G.forPlaying((i) => G.bean('nshe', i, w.randomIn(w.rng.int(1, 2) === 1 ? R.Sheep_Start_Left : R.Sheep_Start_Right), { speed: 230 }));
      G.addKey(w.ofType('nshe'));
      w.create('ncop', P_NEUTRAL, center(R.Sheep_Finish));
      // one starts at the bottom middle (the finish), one at the top middle
      const top = dist(S.path[0], S.path[1]) / 2, bottom = top + S.len / 2;
      for (const s of [bottom, top]) { const u = w.create('e000', P_ENEMY, at(s)); u.acquire = 0; u.coll = 0; u.baseSpeed = 0; u.shS = s; }
      G.cameraBounds(R.Sheep_Shearers);
      G.startTimer(90, 'Time Left');
      G.say('Bean Shearers', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.SheepFinish.enable(); T.SheepMove.enable(); T.SheepSwap.enable();
      yield 2;
      G.forBots(() => T.SheepAI.enable());
    });

    G.trig('SheepFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.SheepFinish, rect: R.Sheep_Finish });

    G.trig('SheepMove', function* () {
      const ws = w.ofType('e000');
      for (const u of ws) {
        u.shS += S.dir * SH.speed * 0.05;
        const p = at(u.shS); u.vx = (p.x - u.x) / 0.05; u.vy = (p.y - u.y) / 0.05; u.x = p.x; u.y = p.y;
        u.facing = Math.atan2(p.dy * S.dir, p.dx * S.dir) * 180 / Math.PI; u.moving = true;
      }
      for (const b of G.beans()) if (ws.some((u) => dist(u, b) <= SH.r)) G.boom(b);
    }).every(0.05);

    G.trig('SheepSwap', function* () {
      yield w.rng.real(0, 5);
      if (!T.SheepMove.enabled) return;
      S.dir = -S.dir;
      for (const u of w.ofType('e000')) w.emit({ k: 'ring', x: u.x, y: u.y, r: SH.r, color: 0xff4d5e, dur: 0.5 });
      w.emit({ k: 'sfx', id: 'red' });
    }).every(15);

    // bots: walk to the flag, but hold back (or retreat) when a shearer will pass close soon
    G.trig('SheepAI', function* () {
      const goal = center(R.Sheep_Finish), ws = w.ofType('e000');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const care = u.shCare ??= w.rng.real(0.6, 1.1);
          // where will I be, and where will they be?
          if (!u.shPath || w.tick % 20 === u.id % 20) u.shPath = w.grid.path(u, goal, u.coll) || [];
          while (u.shPath.length && dist(u, u.shPath[0]) < 12) u.shPath.shift();
          const wp = u.shPath[0] || goal;
          const d = dist(u, wp) || 1, nx = (wp.x - u.x) / d, ny = (wp.y - u.y) / d;
          const unsafe = (mx, my) => {
            for (let k = 0; k <= 6; k++) {
              const dt = (k / 6) * care * 1.6;
              const me = { x: u.x + mx * u.speed * dt, y: u.y + my * u.speed * dt };
              for (const o of ws) if (dist(at(o.shS + S.dir * SH.speed * dt), me) <= SH.r + 30) return true;
            }
            return false;
          };
          if (!unsafe(nx, ny)) w.issue(u, { type: 'steer', dx: nx, dy: ny });
          else if (!unsafe(0, 0)) { if (u.order) w.issue(u, { type: 'stop' }); }
          else if (!unsafe(-nx, -ny)) w.issue(u, { type: 'steer', dx: -nx, dy: -ny });
          else {
            // step away from the nearest shearer
            let o = ws[0]; for (const q of ws) if (dist(q, u) < dist(o, u)) o = q;
            const dd = dist(u, o) || 1; w.issue(u, { type: 'steer', dx: (u.x - o.x) / dd, dy: (u.y - o.y) / dd });
          }
        }
      });
    }).every(0.1);

    return init;
  },
};
