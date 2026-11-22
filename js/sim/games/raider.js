// Jelly Bean Relay — based on "Raider Relay" (Triggers_Events[14]).
// Kept: the two start pens, the 2 bears guarding the side lanes, the balloon
// (zeppelin) pad at the top, the 4 birds (2 patrolling across at y -512/-1024
// from the centre, 2 guarding the sides) that pop balloons, the island finish,
// race scoring with a 90 s timer.
// Polished: no boarding/unloading micro: stepping on the pad lifts you into your
// balloon and you steer it like your bean; landing on the island finishes. Bears
// only catch walkers, birds only catch balloons, one touch = out. Ensnare dropped.
import { P_ENEMY, P_NEUTRAL, center, offset, polar, dist, angleTo, inRect } from '../engine.js';

export const RAIDER = { bearTouch: 30, birdTouch: 34, bearAggro: 300, bearLeash: 520, guardAggro: 300, guardLeash: 420, balloonSpeed: 270 };

export default {
  num: 14, id: 'raider', title: 'Jelly Bean Relay', orig: 'Raider Relay',
  subtitle: 'Reach the end!', arena: 'raider_relay', rect: 'Raider_Relay', kind: 'race',
  hint: 'Run past the bears to the balloon pad, then fly to the island. Birds pop balloons!',
  objective: 'Reach the island: run past the bears, then fly the balloon. Out: a bear touches you or a bird pops your balloon.',
  clip: ['Raider_Relay', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Raider_Relay);

    const init = G.trig('RaiderInitialization', function* () {
      G.music('war2intro');
      v.ante = 8;
      G.forPlaying((i) => G.bean('orai', i, w.randomIn(w.rng.next() < 0.5 ? R.Raider_Start_1 : R.Raider_Start_2), { speed: 350 }));
      G.addKey(w.ofType('orai'));
      for (const dx of [-448, 448]) {
        const b = w.create('edcm', P_ENEMY, offset(C(), dx, -128));
        b.acquire = 0; b.baseSpeed = 240; b.home = { x: b.x, y: b.y }; b.invuln = true;
      }
      const birds = [[-640, -512, 640], [640, -1024, -640]];
      for (const [x0, y, x1] of birds) {
        const u = w.create('ehip', P_ENEMY, offset(C(), x0, y)); u.acquire = 0; u.invuln = true;
        u.order = { type: 'patrol', a: { x: u.x, y: u.y }, b: offset(C(), x1, y), leg: true };
      }
      for (const dx of [-512, 512]) {
        const u = w.create('ehip', P_ENEMY, offset(C(), dx, -768)); u.acquire = 0; u.invuln = true; u.baseSpeed = 300;
        u.post = { x: u.x, y: u.y }; u.ang = w.rng.dir();
      }
      w.create('ncop', P_NEUTRAL, center(R.Raider_Finish));
      G.cameraBounds(R.Raider_Relay);
      G.startTimer(90, 'Time Left');
      G.say('Jelly Bean Relay', 'Reach the end!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.RaiderTick.enable(); T.RaiderEnemies.enable();
      yield 2;
      G.forBots(() => T.RaiderAI.enable());
    });

    function board(u) {
      u.fly = true; u.baseSpeed = RAIDER.balloonSpeed; u.order = null;
      const z = w.create('nzep', P_NEUTRAL, { x: u.x, y: u.y }); z.acquire = 0; z.invuln = true; z.paused = true;
      u.balloon = z;
      w.emit({ k: 'ring', x: u.x, y: u.y, r: 60, color: 0xffd23f, dur: 0.6 });
      w.emit({ k: 'sfx', id: 'ding' });
    }

    G.trig('RaiderTick', function* () {
      const r = R.Raider_Relay, bears = w.ofType('edcm'), birds = w.ofType('ehip');
      for (const u of G.beans()) {
        if (!u.fly) {
          if (inRect(R.Raider_Zeppelin, u)) { board(u); continue; }
          if (bears.some((b) => dist(b, u) <= u.coll + RAIDER.bearTouch)) { w.kill(u); continue; }
        } else {
          u.x = Math.min(r.x1, Math.max(r.x0, u.x)); u.y = Math.min(r.y1, Math.max(r.y0, u.y));
          if (u.balloon) { u.balloon.x = u.x; u.balloon.y = u.y; u.balloon.facing = u.facing; }
          if (birds.some((b) => dist(b, u) <= u.coll + RAIDER.birdTouch)) {
            if (u.balloon) { w.emit({ k: 'boom', x: u.x, y: u.y, r: 0 }); w.remove(u.balloon); u.balloon = null; }
            w.kill(u); continue;
          }
          if (inRect(R.Raider_Finish, u)) {
            if (u.balloon) { w.remove(u.balloon); u.balloon = null; }
            v.focus = u; T.RaceFinish.execute();
          }
        }
      }
      for (const z of w.ofType('nzep')) if (!G.beans().some((u) => u.balloon === z)) w.remove(z);
    }).every(0.05);

    // bears chase walkers that come close and go home when lured too far;
    // guard birds circle their post and swoop at balloons nearby
    G.trig('RaiderEnemies', function* () {
      const beans = G.beans();
      for (const b of w.ofType('edcm')) {
        let t = null, bd = RAIDER.bearAggro;
        for (const u of beans) if (!u.fly && dist(u, b.home) < RAIDER.bearLeash) { const d = dist(u, b); if (d < bd) { bd = d; t = u; } }
        if (t) w.issue(b, { type: 'move', x: t.x, y: t.y });
        else if (dist(b, b.home) > 40) w.issue(b, { type: 'move', ...b.home });
        else if (!b.order) w.issue(b, { type: 'move', ...polar(b.home, 90, w.rng.pick([90, 270])) });
      }
      for (const g of w.ofType('ehip')) {
        if (!g.post) continue;
        let t = null, bd = RAIDER.guardAggro;
        for (const u of beans) if (u.fly && dist(u, g.post) < RAIDER.guardLeash) { const d = dist(u, g); if (d < bd) { bd = d; t = u; } }
        if (t) w.issue(g, { type: 'move', x: t.x, y: t.y });
        else { g.ang = (g.ang + 9) % 360; w.issue(g, { type: 'move', ...polar(g.post, 160, g.ang) }); }
      }
    }).every(0.1);

    // bots: walk the path to the pad, sidestepping bears; then fly to the island,
    // waiting for gaps between the birds
    G.trig('RaiderAI', function* () {
      const bears = w.ofType('edcm'), birds = w.ofType('ehip');
      const pad = center(R.Raider_Zeppelin), goal = center(R.Raider_Finish);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.botWait ??= w.t + w.rng.real(0, 2))) continue;
          if (!u.fly) {
            if (!u.botPath || w.tick % 40 === u.id % 40) u.botPath = w.grid.path(u, pad, u.coll) || [];
            while (u.botPath.length > 1 && dist(u, u.botPath[0]) < 16) u.botPath.shift();
            const wp = u.botPath[0] || pad;
            const d = Math.max(1, dist(u, wp));
            let dx = (wp.x - u.x) / d, dy = (wp.y - u.y) / d;
            for (const b of bears) {
              const db = dist(u, b); if (db > 230) continue;
              const k = ((230 - db) / 230) * 2.2 * (u.nerve ??= w.rng.real(0.7, 1.3));
              dx += (u.x - b.x) / db * k; dy += (u.y - b.y) / db * k;
            }
            w.issue(u, { type: 'steer', dx, dy });
            continue;
          }
          const d = Math.max(1, dist(u, goal)), nx = (goal.x - u.x) / d, ny = (goal.y - u.y) / d;
          const careful = u.careful ??= w.rng.real(0.8, 1.4);
          const unsafe = (mx, my) => {
            for (const b of birds) for (let k = 0; k <= 6; k++) {
              const dt = (k / 6) * careful;
              const px = u.x + mx * u.speed * dt, py = u.y + my * u.speed * dt;
              const bx = b.x + (b.vx || 0) * dt, by = b.y + (b.vy || 0) * dt;
              if (Math.hypot(px - bx, py - by) < u.coll + RAIDER.birdTouch + 30) return true;
            }
            return false;
          };
          if (!unsafe(nx, ny)) w.issue(u, { type: 'steer', dx: nx, dy: ny });
          else if (!unsafe(0, 0)) w.issue(u, { type: 'stop' });
          else if (!unsafe(-nx, -ny)) w.issue(u, { type: 'steer', dx: -nx, dy: -ny });
          else w.issue(u, { type: 'steer', dx: ny, dy: -nx });
        }
      });
    }).every(0.1);

    return init;
  },
};
