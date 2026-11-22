// Blinky the Bean — based on "Blinky the Bear" (Triggers_Events[27]).
// Kept: the walled lane course, start and finish spots, the 10 patrolling polar
// bears on their original lanes, Blink range 512 / short cooldown, 90 s timer,
// race scoring, leaving the course = out.
// Polished: Blink is the Space key (toward the cursor, lands on the farthest open
// spot along the aim), a bear's touch = out, bots look for safe landing spots.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, inRect } from '../engine.js';

export const BLINKY = { range: 512, cd: 0.8, bearR: 36 };

// [startDx, startDy, patrolDx, patrolDy] from Blinky Initialization
const BEARS = [
  [-576, -832, -576, -1856], [576, -1856, 576, -832], [-192, -192, -192, -1088], [192, -1088, 192, -192],
  [-576, 448, -576, -448], [576, -448, 576, 448], [-576, 832, -576, 1728], [576, 1728, 576, 832],
  [-192, 192, -192, 960], [192, 960, 192, 192],
];

function landing(w, u, aim) {
  let dx = aim.x - u.x, dy = aim.y - u.y; const d = Math.hypot(dx, dy) || 1;
  const r = Math.min(BLINKY.range, d); dx /= d; dy /= d;
  const end = { x: u.x + dx * r, y: u.y + dy * r };
  // forgiving aim: snap to an open spot within 72 of where you aimed (lanes are narrow)
  if (!w.grid.walkable(end.x, end.y, u.coll)) {
    let best = null, bd = 73;
    for (let rad = 12; rad <= 72; rad += 12) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, q = { x: end.x + Math.cos(a) * rad, y: end.y + Math.sin(a) * rad };
      if (dist(q, u) <= BLINKY.range + 8 && w.grid.walkable(q.x, q.y, u.coll) && rad < bd) { bd = rad; best = q; }
      if (best) break;
    }
    if (best) return best;
  }
  for (let s = r; s >= 0; s -= 16) { const p = { x: u.x + dx * s, y: u.y + dy * s }; if (w.grid.walkable(p.x, p.y, u.coll)) return p; }
  return null;
}

export default {
  num: 27, id: 'blinky', title: 'Blinky the Bean', orig: 'Blinky the Bear',
  subtitle: 'Reach the end!', arena: 'blinky_the_bear', rect: 'Blinky_the_Bear', kind: 'race',
  hint: 'Space = blink toward the cursor (hops walls). Reach the flag — a bear’s touch = out!',
  objective: 'Reach the flag. Out: a bear touches you.',
  clip: ['Blinky_the_Bear', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) {
    const w = G.w; if (!aim || w.t < (u.blinkAt || 0)) return false;
    const p = landing(w, u, aim); if (!p || dist(p, u) < 24) return false;
    w.emit({ k: 'teleport', x: u.x, y: u.y });
    u.x = p.x; u.y = p.y; u.order = null; u.path = null; u.blinkAt = w.t + BLINKY.cd;
    w.emit({ k: 'teleport', x: u.x, y: u.y }); w.emit({ k: 'sfx', id: 'zap' });
    return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Blinky_the_Bear);
    const self = this;

    const init = G.trig('BlinkyInitialization', function* () {
      G.music('OrcVictory');
      v.ante = 8;
      G.forPlaying((i) => { const b = G.bean('ngzc', i, w.randomIn(R.Blinky_Start), { speed: 320 }); b.blinkAt = 0; });
      G.addKey(w.ofType('ngzc'));
      for (const [ax, ay, bx, by] of BEARS) {
        const u = w.create('nplb', P_ENEMY, offset(C(), ax, ay), ay < by ? 90 : 270);
        u.acquire = 0;
        u.order = { type: 'patrol', a: { x: u.x, y: u.y }, b: offset(C(), bx, by), leg: true };
      }
      w.create('ncop', P_NEUTRAL, center(R.Blinky_Finish));
      G.cameraBounds(R.Blinky_the_Bear);
      G.startTimer(90, 'Time Left');
      G.say('Blinky the Bean', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.BlinkyDeath.enable(); T.BlinkyFinish.enable();
      yield 3;
      G.forBots(() => T.BlinkyAI.enable());
    });

    G.trig('BlinkyFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.BlinkyFinish, rect: R.Blinky_Finish });

    G.trig('BlinkyDeath', function* () {
      const bears = w.ofType('nplb');
      for (const b of G.beans()) {
        if (!inRect(R.Blinky_the_Bear, b)) { w.kill(b); continue; }
        if (bears.some((t) => dist(t, b) <= BLINKY.bearR + b.coll)) w.kill(b);
      }
    }).every(0.05);

    // bot map: cost to the finish when you can both walk and blink (Dijkstra over open cells)
    let bf = null;
    function blinkFlow(goal, r) {
      if (bf && bf.round === G.round()) return bf.fn;
      const a = w.grid.arenaAt(goal.x, goal.y), cs = a.cell, cells = [];
      for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
        const x = a.x0 + (i + 0.5) * cs, y = a.y0 + (j + 0.5) * cs;
        if (w.grid.walkable(x, y, r) && inRect(R.Blinky_the_Bear, { x, y })) cells.push({ i, j, x, y, d: 1e9, done: false });
      }
      const idx = new Map(cells.map((c, k) => [c.j * a.w + c.i, k]));
      let g0 = null, gd = 1e9; for (const c of cells) { const d = dist(c, goal); if (d < gd) { gd = d; g0 = c; } }
      g0.d = 0;
      for (;;) {
        let cur = null; for (const c of cells) if (!c.done && c.d < 1e9 && (!cur || c.d < cur.d)) cur = c;
        if (!cur) break; cur.done = true;
        for (const c of cells) {
          if (c.done) continue;
          const d = dist(c, cur); if (d > BLINKY.range - 8) continue;
          const cost = d <= cs * 1.5 ? d : 260 + d * 0.2;
          if (cur.d + cost < c.d) c.d = cur.d + cost;
        }
      }
      const fn = (x, y) => { const k = idx.get(Math.floor((y - a.y0) / cs) * a.w + Math.floor((x - a.x0) / cs)); return k == null ? 1e9 : cells[k].d; };
      bf = { round: G.round(), fn };
      return fn;
    }

    // bots: blink toward the finish (as the original), but pick landing spots away from bears
    G.trig('BlinkyAI', function* () {
      const bears = w.ofType('nplb'), goal = center(R.Blinky_Finish);
      const danger = (p, look) => {
        let m = 1e9;
        for (const t of bears) {
          const o = t.order, tg = o ? (o.leg ? o.b : o.a) : t, dd = dist(t, tg) || 1;
          for (let k = 0; k <= 3; k++) { const s = Math.min(dd, t.speed * look * k / 3); m = Math.min(m, dist(p, { x: t.x + (tg.x - t.x) / dd * s, y: t.y + (tg.y - t.y) / dd * s })); }
        }
        return m;
      };
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const path = w.grid.path(u, goal, u.coll);
          const reach = path && path.length <= 3 && Math.abs(goal.y - u.y) < 700;
          if (reach) w.issue(u, { type: 'move', ...goal });
          const threat = danger(u, 0.6) < 110;
          if (w.t < (u.blinkAt || 0) || (w.t < (u.botNext || 0) && !threat)) continue;
          if (reach && !threat) continue;
          const flow = blinkFlow(goal, u.coll), here = flow(u.x, u.y);
          let best = null, bs = -1e9;
          for (let gx = -512; gx <= 512; gx += 32) for (let gy = -512; gy <= 512; gy += 32) {
            if (gx * gx + gy * gy > 512 * 512) continue;
            const aim = { x: u.x + gx, y: u.y + gy };
            if (!w.grid.walkable(aim.x, aim.y, u.coll) || !inRect(R.Blinky_the_Bear, aim)) continue;
            const dg = danger(aim, 1.0);
            const s = (here - flow(aim.x, aim.y)) - (dg < 140 ? 2000 : 0) + w.rng.real(0, 60);
            if (s > bs) { bs = s; best = aim; }
          }
          if (best && (bs > 120 || threat)) self.action(G, u, null, best);
          u.botNext = w.t + w.rng.real(0.8, 1.8);
        }
      });
    }).every(0.1);

    return init;
  },
};
