// Flight of the Bean-men — based on "Flight of the Footmen" (Triggers_Events[45]).
// Kept: the looping course, start 768 below the finish, the 5 guard towers and 2
// cannon towers on their original spots (range 440; guard 0.9 s darts, cannon
// 2.5 s splash shells), night time with shadowmeld (stand still to vanish), the
// Defend skill, 90 s timer, race scoring.
// Polished: one hit = out. Space raises the Defend shield (0.8 s, 1.6 s recharge,
// half speed) which blocks darts but not cannon shells; shells are telegraphed;
// standing still for 1 s hides you so the towers pick someone else.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, angleTo } from '../engine.js';

export const FLIGHT = { range: 440, dartCd: 1.5, dart: 600, shellCd: 2.8, shell: 700, splash: 90, shield: 0.8, shieldCd: 0.9, hide: 1.0, speed: 270 };
const TOWERS = [['hgtw', -896, 192], ['h003', -384, 192], ['hgtw', -384, -192], ['hgtw', 384, 192], ['hgtw', 384, -192], ['h003', 896, 192], ['hgtw', 896, -192]];

export default {
  num: 45, id: 'flight', title: 'Flight of the Bean-men', orig: 'Flight of the Footmen',
  subtitle: 'Reach the end, but defend when you have to!', arena: 'flight_of_the_footmen', rect: 'Flight_of_the_Footmen', kind: 'race',
  hint: 'Run to the flag. Space = shield (blocks darts, not cannonballs). Stand still to hide from towers.',
  objective: 'Reach the flag. Out: a dart or a cannonball hits you.',
  clip: ['Flight_of_the_Footmen', 64, 64],
  canTarget() { return false; },
  action(G, u) {
    const w = G.w; if (w.t < (u.shieldReady || 0)) return false;
    u.shieldUntil = w.t + FLIGHT.shield; u.shieldReady = w.t + FLIGHT.shieldCd; u.baseSpeed = FLIGHT.speed * 0.5;
    w.emit({ k: 'ring', x: u.x, y: u.y, r: 45, color: 0x7fd3ff, dur: FLIGHT.shield }); w.emit({ k: 'sfx', id: 'click' });
    return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Flight_of_the_Footmen);
    const F = (v.flight = { shells: [] });
    const self = this;

    const init = G.trig('FlightInitialization', function* () {
      G.music('human1');
      v.ante = 8; w.tod = 0; F.shells = [];
      G.forPlaying((i) => { const b = G.bean('h002', i, offset(w.randomIn(R.Flight_Finish), 0, -768), { speed: FLIGHT.speed }); b.facing = 0; b.shieldUntil = 0; b.shieldReady = 0; b.hidden = false; });
      G.addKey(w.ofType('h002'));
      for (const [t, dx, dy] of TOWERS) { const u = w.create(t, P_ENEMY, offset(C(), dx, dy)); u.acquire = 0; u.invuln = true; u.next = w.t + 4; }
      w.create('ncop', P_NEUTRAL, center(R.Flight_Finish));
      G.cameraBounds(R.Flight_of_the_Footmen);
      G.startTimer(90, 'Time Left');
      G.say('Flight of the Bean-men', 'Reach the end, but defend when you have to!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.FlightFinish.enable(); T.FlightTick.enable();
      yield 4;
      G.forBots(() => T.FlightAI.enable());
    });

    G.trig('FlightFinish', function* (e) { v.focus = e.unit; T.RaceFinish.execute(); }, { cond: (e) => G.key.has(e.unit) });
    w.handlers.push({ kind: 'enter', trig: T.FlightFinish, rect: R.Flight_Finish });

    G.trig('FlightTick', function* () {
      F.shells = F.shells.filter((s) => s.t > w.t - 0.1);
      const beans = G.beans();
      for (const b of beans) {
        if (w.t >= b.shieldUntil) b.baseSpeed = FLIGHT.speed;
        const hide = w.t - b.lastActive >= FLIGHT.hide;
        if (hide !== b.hidden) { b.hidden = hide; b.invisible = hide; w.emit({ k: 'meld', id: b.id, on: hide }); }
      }
      for (const t of w.alive((u) => u.type === 'hgtw' || u.type === 'h003')) {
        if (w.t < t.next) continue;
        let tg = null, bd = FLIGHT.range;
        for (const b of beans) if (!b.hidden) { const d = dist(t, b); if (d <= bd) { bd = d; tg = b; } }
        if (!tg) continue;
        t.facing = angleTo(t, tg);
        if (t.type === 'hgtw') {
          t.next = w.t + FLIGHT.dartCd;
          w.shoot(t, tg, { speed: FLIGHT.dart, type: 'hgtw', onHit: (m, b) => {
            if (!b.alive || !G.key.has(b)) return;
            if (w.t < b.shieldUntil) { w.emit({ k: 'ring', x: b.x, y: b.y, r: 40, color: 0xffffff, dur: 0.2 }); w.emit({ k: 'sfx', id: 'pop' }); return; }
            w.kill(b);
          } });
        } else {
          t.next = w.t + FLIGHT.shellCd;
          const p = { x: tg.x + tg.vx * 0.3, y: tg.y + tg.vy * 0.3 }, fl = dist(t, p) / FLIGHT.shell;
          F.shells.push({ x: p.x, y: p.y, t: w.t + fl });
          w.emit({ k: 'warn', id: t.id * 1000 + (w.tick % 1000), x: p.x, y: p.y, r: FLIGHT.splash, dur: fl, hot: true });
          w.lob(t, p.x, p.y, { speed: FLIGHT.shell, type: 'h003', onImpact: () => {
            w.emit({ k: 'impact', x: p.x, y: p.y, type: 'h003', r: FLIGHT.splash });
            for (const b of G.beans()) if (dist(b, p) <= FLIGHT.splash + b.coll * 0.5) G.boom(b);
          } });
        }
      }
    }).every(0.05);

    // bots: run the course to the flag (as the original), shield against incoming darts, dodge shells
    G.trig('FlightAI', function* () {
      const goal = center(R.Flight_Finish);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.botStart ??= w.t + w.rng.real(0, 2.5))) continue;
          const dart = w.missiles.find((m) => m.target === u && m.type === 'hgtw' && dist(m, u) < FLIGHT.dart * 0.35);
          if (dart && w.t >= u.shieldReady && w.rng.next() < (u.skill ??= w.rng.real(0.75, 0.97))) self.action(G, u);
          const shell = F.shells.find((s) => s.t - w.t < 1.0 && dist(u, s) < FLIGHT.splash + 50);
          if (shell) { const a = angleTo(shell, u) * Math.PI / 180; w.issue(u, { type: 'steer', dx: Math.cos(a), dy: Math.sin(a) }); continue; }
          if (w.t < (u.botHold || 0)) { if (u.order) w.issue(u, { type: 'stop' }); continue; }
          // sometimes hide when a tower is close and the shield is recharging
          if (w.t < u.shieldReady && w.rng.next() < 0.02 && w.alive((t) => t.type === 'hgtw' && dist(t, u) < FLIGHT.range).length) { u.botHold = w.t + w.rng.real(1.2, 2.2); continue; }
          if (!u.botPath || w.tick % 40 === u.id % 40) u.botPath = w.grid.path(u, goal, u.coll) || [];
          while (u.botPath.length > 1 && dist(u, u.botPath[0]) < 16) u.botPath.shift();
          const wp = u.botPath[0]; if (!wp) continue;
          const d = dist(u, wp) || 1; w.issue(u, { type: 'steer', dx: (wp.x - u.x) / d, dy: (wp.y - u.y) / d });
        }
      });
    }).every(0.1);

    return init;
  },
};
