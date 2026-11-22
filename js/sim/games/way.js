// Way of the Bean-Bow — based on "Way of the Bow" (Triggers_Events[6]).
// Kept: the tree-dotted night glade, archers placed 1000 from the centre at
// (slot*135 - 22.5)°, 5 s frozen start, 1.5 s between shots, arrows at 900,
// 120 s timer, last bean standing wins.
// Polished: WC3 homing arrows become straight skill-shots you can dodge; the
// candy trees block arrows (cover); one arrow = out.
import { center, polar, dist, angleTo } from '../engine.js';

export const WAY = { speed: 270, arrow: 900, range: 1100, cool: 1.5, hitR: 12, treeR: 44 };

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

export default {
  num: 6, id: 'way', title: 'Way of the Bean-Bow', orig: 'Way of the Bow',
  subtitle: 'Shoot your opponents!', arena: 'way_of_the_bow', rect: 'Way_of_the_Bow', kind: 'survival',
  hint: 'Click a bean or press Space to shoot at the cursor. One arrow = out. Trees block arrows!',
  objective: 'Be the last bean standing. Out: an arrow hits you.',
  clip: ['Way_of_the_Bow', 64, 64],
  canTarget(G, u, t) { return t !== u && w0(G) && w0(G).t >= (u.nextShot || 0); },
  action(G, u, target, aim) {
    const w = G.w; if (!G.v.way || w.t < (u.nextShot || 0) || u.paused) return false;
    const p = target && target.alive && target !== u ? target : aim; if (!p) return false;
    G.v.way.fire(u, p); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Way_of_the_Bow);
    const A = (v.way = { arrows: [] });
    const trees = () => w.dest.filter((d) => d.alive && d.type === 'tree' && d.x >= R.Way_of_the_Bow.x0 - 100 && d.x <= R.Way_of_the_Bow.x1 + 100 && d.y >= R.Way_of_the_Bow.y0 - 100 && d.y <= R.Way_of_the_Bow.y1 + 100);
    let treeList = [];

    A.fire = (u, p) => {
      u.nextShot = w.t + WAY.cool;
      const a = angleTo(u, p); u.facing = a;
      const end = polar(u, WAY.range, a), start = polar(u, u.coll + 6, a);
      const m = w.lob({ x: start.x, y: start.y, owner: u.owner, s: u.s }, end.x, end.y, { speed: WAY.arrow, arc: 0, type: 'earc', onImpact: () => {} });
      m.src = u; m.owner = u.owner; m.prevX = start.x; m.prevY = start.y; m.way = true;
      A.arrows.push(m);
      w.emit({ k: 'sfx', id: 'shoot' });
    };

    const init = G.trig('WayInitialization', function* () {
      G.music('NightElf1');
      v.tiesPossible = true; A.arrows = [];
      w.tod = 0;
      G.forPlaying((i) => { const b = G.bean('earc', i, polar(C(), 1000, i * 135 - 22.5), { speed: WAY.speed }); b.facing = angleTo(b, C()); b.nextShot = 0; });
      G.addKey(w.ofType('earc'));
      treeList = trees();
      G.cameraBounds(R.Way_of_the_Bow);
      G.startTimer(120, 'Time Left');
      G.say('Way of the Bean-Bow', 'Shoot your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.WayArrows.enable();
      w.pauseAll(true);
      yield 5;
      w.pauseAll(false);
      G.forBots(() => T.WayAI.enable());
    });

    // straight arrows: hit the first bean (not the shooter) or tree along their path
    G.trig('WayArrows', function* () {
      const beans = G.beans();
      for (const m of A.arrows) {
        if (m.done) continue;
        const a = { x: m.prevX, y: m.prevY }, b = { x: m.x, y: m.y };
        m.prevX = m.x; m.prevY = m.y;
        let stop = false;
        for (const t of treeList) if (t.alive && segDist(t, a, b) <= WAY.treeR) { stop = true; break; }
        if (!stop) for (const u of beans) if (u !== m.src && u.alive && segDist(u, a, b) <= u.coll + WAY.hitR) { w.kill(u); stop = true; break; }
        if (stop) { m.done = true; w.emit({ k: 'impact', x: m.x, y: m.y, type: 'earc', r: 30 }); }
      }
      A.arrows = A.arrows.filter((m) => !m.done);
      w.missiles = w.missiles.filter((m) => !m.way || !m.done);
    }).every(0.025);

    // bots: sidestep arrows heading their way, keep moving, shoot with a rough lead
    G.trig('WayAI', function* () {
      const beans = G.beans();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          // dodge
          let threat = null, tt = 1e9;
          for (const m of A.arrows) {
            if (m.src === u) continue;
            const dx = m.tx - m.x0, dy = m.ty - m.y0, l = Math.hypot(dx, dy) || 1, vx = dx / l, vy = dy / l;
            const rx = u.x - m.x, ry = u.y - m.y, along = rx * vx + ry * vy; if (along < 0 || along > 700) continue;
            const side = Math.abs(rx * vy - ry * vx); if (side > 75) continue;
            if (along < tt) { tt = along; threat = { vx, vy, s: rx * vy - ry * vx }; }
          }
          if (threat && w.rng.next() < (u.skill ??= w.rng.real(0.55, 0.9))) {
            const sg = threat.s >= 0 ? 1 : -1;
            let dx = threat.vy * sg, dy = -threat.vx * sg;
            if (!w.grid.walkable(u.x + dx * 60, u.y + dy * 60, u.coll)) { dx = -dx; dy = -dy; }
            w.issue(u, { type: 'steer', dx, dy });
            u.dodgeUntil = w.t + 0.35;
            continue;
          }
          if (w.t < (u.dodgeUntil || 0)) continue;
          if (u.order?.type === 'steer') w.issue(u, { type: 'stop' });
          // shoot
          if (w.t >= u.nextShot && w.rng.next() < 0.35) {
            const cands = beans.filter((b) => b !== u && dist(b, u) < 1000 && !treeList.some((t) => t.alive && segDist(t, u, b) <= WAY.treeR));
            const t = w.pick(cands);
            if (t) {
              const lead = dist(u, t) / WAY.arrow * w.rng.real(0.5, 1.1);
              const aim = { x: t.x + (t.vx || 0) * lead + w.rng.real(-25, 25), y: t.y + (t.vy || 0) * lead + w.rng.real(-25, 25) };
              A.fire(u, aim);
            }
          }
          // roam (the original: move to a random spot every 2 s)
          if (!u.order || w.rng.next() < 0.04) w.issue(u, { type: 'move', ...w.randomIn(R.Way_of_the_Bow) });
        }
      });
    }).every(0.1);

    return init;
  },
};

function w0(G) { return G.w; }
