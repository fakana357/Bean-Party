// The Rat-Bean Maze — based on "The Rat Maze" (Triggers_Events[2]).
// Kept: the maze, the 8 start circles, the cheese in the centre, 5 spiders that
// patrol random spots every 10 s, carrier slowed to 190, 120 s timer, one winner.
// Polished: a spider touch = out (spiders only chase what they can see, and a
// little slower than a bean); bump the cheese carrier to steal the cheese
// (instead of WC3 rats biting each other to death).
import { P_ENEMY, P_NEUTRAL, center, offset, dist, angleTo, polar } from '../engine.js';

export const RAT_STARTS = [[192, 2880], [2112, 2496], [1728, 576], [-192, 960], [-192, 2496], [1728, 2880], [2112, 960], [192, 576]];
export const RAT = { speed: 270, carry: 190, spiderR: 15, spiderSpeed: 185, sight: 230, chase: 2, steal: 52, stealLock: 1.2, home: 100 };

export default {
  num: 2, id: 'rat', title: 'The Rat-Bean Maze', orig: 'The Rat Maze',
  subtitle: 'Get the cheese, and return to your circle!', arena: 'rat_maze', rect: 'Rat_Maze', kind: 'race',
  hint: 'Grab the cheese and bring it to your circle. Bump the carrier to steal it. Spiders = out!',
  objective: 'Bring the cheese back to YOUR start circle — one winner. Out: a spider touches you.',
  clip: ['Rat_Maze', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Rat_Maze);
    const S = (v.rat = { cheese: null, holder: null, lock: 0, home: {} });

    const init = G.trig('RatInitialization', function* () {
      G.music('PursuitTheme');
      v.ante = 8;
      S.holder = null; S.lock = 0; S.home = {};
      G.forPlaying((i) => {
        const [x, y] = RAT_STARTS[i - 1];
        S.home[i] = { x, y };
        const b = G.bean('nrat', i, { x, y }, { speed: RAT.speed });
        b.ratSpeed = RAT.speed;
        const pad = w.create('ncop', i, { x, y }); pad.coll = 0;
      });
      G.addKey(w.ofType('nrat'));
      S.cheese = w.create('hcth', P_NEUTRAL, w.grid.nearestWalkable(C().x, C().y, 24) || C()); S.cheese.prop = 'cheese'; S.cheese.coll = 0; S.cheese.baseSpeed = 0; S.cheese.invuln = true; S.cheese.acquire = 0;
      for (const [dx, dy] of [[128, 0], [0, 128], [-128, 0], [0, -128]]) {
        const s = w.create('nspr', P_ENEMY, offset(C(), dx, dy)); s.acquire = 0; s.baseSpeed = RAT.spiderSpeed; s.coll = RAT.spiderR;
      }
      G.cameraBounds(R.Rat_Maze);
      G.startTimer(120, 'Time Left');
      G.say('The Rat-Bean Maze', 'Get the cheese, and return to your circle!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.RatTick.enable(); T.RatDeath.enable(); T.RatSpiders.enable();
      yield 4;
      T.RatPatrol.enable(); T.RatPatrol.execute();
      G.forBots(() => T.RatAI.enable());
    });

    function give(b) {
      if (S.holder) { S.holder.baseSpeed = S.holder.ratSpeed; }
      S.holder = b; S.lock = w.t + RAT.stealLock;
      if (b) { b.baseSpeed = RAT.carry; w.emit({ k: 'ring', x: b.x, y: b.y, r: 60, color: 0xffd23f, dur: 0.4 }); w.emit({ k: 'sfx', id: 'ding' }); }
    }

    G.trig('RatPatrol', function* () {
      for (const s of w.ofType('nspr')) if (!s.chase) w.issue(s, { type: 'move', ...w.randomIn(R.Rat_Maze) });
    }).every(10);

    // spiders: chase a bean they can see for a short while, then go back to patrolling
    G.trig('RatSpiders', function* () {
      for (const s of w.ofType('nspr')) {
        if (s.chase && (!s.chase.alive || w.t > s.chaseEnd)) { s.chase = null; s.rest = w.t + 2; w.issue(s, { type: 'move', ...w.randomIn(R.Rat_Maze) }); }
        if (!s.chase && w.t > (s.rest || 0)) {
          for (const b of G.beans()) if (dist(s, b) <= RAT.sight && w.grid.los(s.x, s.y, b.x, b.y, 8)) { s.chase = b; s.chaseEnd = w.t + RAT.chase; break; }
        }
        if (s.chase) w.issue(s, { type: 'move', x: s.chase.x, y: s.chase.y });
        else if (!s.order) w.issue(s, { type: 'move', ...w.randomIn(R.Rat_Maze) });
      }
    }).every(0.2);

    G.trig('RatTick', function* () {
      const spiders = w.ofType('nspr');
      for (const b of G.beans()) if (spiders.some((s) => dist(s, b) <= RAT.spiderR + b.coll)) w.kill(b);
      const c = S.cheese; if (!c) return;
      if (S.holder && !S.holder.alive) give(null);
      if (!S.holder) {
        for (const b of G.beans()) if (dist(b, c) <= 40) { give(b); break; }
      } else {
        const h = S.holder;
        c.x = h.x; c.y = h.y + 1;
        if (w.t >= S.lock) for (const b of G.beans()) if (b !== h && dist(b, h) <= RAT.steal) { give(b); w.emit({ k: 'text3d', x: b.x, y: b.y + 40, text: 'Stolen!', color: '#ffd23f' }); break; }
        const hh = S.holder, home = S.home[hh.owner];
        if (home && dist(hh, home) <= RAT.home) {
          T.RatTick.disable(); T.RatAI.disable();
          w.remove(c); S.cheese = null;
          for (const k of [...G.key]) if (k !== hh) G.key.delete(k);
          v.focus = hh; T.RaceFinish.execute();
        }
      }
    }).every(0.05);

    // a rat's start circle goes away with it (Rat Death)
    G.trig('RatDeath', function* (e) {
      for (const u of w.ofPlayer(e.unit.owner)) if (u.type === 'ncop') w.remove(u);
    }, { cond: (e) => e.unit.type === 'nrat' }).on('death');

    // bots: run for the cheese (or the carrier), carry it home, and back off from spiders
    G.trig('RatAI', function* () {
      const spiders = w.ofType('nspr'); const c = S.cheese; if (!c) return;
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.botWait ??= w.t + w.rng.real(0, 1.5))) continue;
          const goal = S.holder === u ? S.home[i] : (S.holder ? { x: S.holder.x, y: S.holder.y } : c);
          // close spider coming: get away; otherwise take the route that keeps away from spiders
          const near = spiders.some((sp) => dist(sp, u) < 130 && w.grid.los(sp.x, sp.y, u.x, u.y, 4));
          if (near) { G.botGo(u, goal, spiders, { fear: 150, lead: 0.4, step: 90 }); continue; }
          if (!u.botPath || w.t >= (u.repath || 0) || !u.botPath.length || u.botGoalHolder !== S.holder) {
            u.repath = w.t + 0.75; u.botGoalHolder = S.holder;
            u.botPath = w.grid.path(u, goal, u.coll, (x, y) => { let c = 0; for (const sp of spiders) { const d = Math.hypot(sp.x - x, sp.y - y); if (d < 260) c += (260 - d) / 12; } return c; }) || [];
          }
          while (u.botPath.length > 1 && dist(u, u.botPath[0]) < 20) u.botPath.shift();
          const wp = u.botPath[0] || goal;
          // don't walk into a spider that sits on the route
          if (spiders.some((sp) => dist(sp, wp) < 90 || (dist(sp, u) < 220 && dist(sp, wp) < dist(u, wp)))) {
            u.blocked ??= w.t;
            if (w.t - u.blocked < 2.5) { if (u.order) w.issue(u, { type: 'stop' }); continue; }
          } else u.blocked = null;
          w.issue(u, { type: 'move', x: wp.x, y: wp.y });
        }
      });
    }).every(0.25);

    return init;
  },
};
