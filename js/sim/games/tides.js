// Tides of Bean-ness — based on "Tides of Darkness" (Triggers_Events[44]).
// Kept: the bay with the human shipyard (bottom left) and the orc shipyard (top
// right), one bean frigate per player near the human yard, one orc frigate per
// player near the orc yard plus one more every 10 s (max 7 ships), frigates lob
// shells (range 600, 1.5 s, speed 600), orcs back off when shot at, the first
// orc ship you sink is your finish (race scoring), 120 s timer.
// Polished: Space fires a shell at the cursor; one shell sinks any ship (yours
// only hurt orcs); every orc shell is telegraphed so you can dodge.
import { P_ENEMY, P_NEUTRAL, center, polar, offset, dist, angleTo, inRect } from '../engine.js';

export const TIDES = { range: 600, cd: 1.5, shell: 600, hit: 70, orcCd: [1.8, 2.8], max: 7, speed: 350 };

export default {
  num: 44, id: 'tides', title: 'Tides of Bean-ness', orig: 'Tides of Darkness',
  subtitle: 'Kill one enemy ship!', arena: 'tides_of_darkness', rect: 'Tides_of_Darkness', kind: 'race',
  hint: 'Space = fire a shell at the cursor. Sink one orc ship to finish. One enemy shell = sunk!',
  objective: 'Sink an orc ship to finish. Out: an enemy shell hits your boat.',
  clip: ['Tides_of_Darkness', 64, 64],
  canTarget() { return false; },
  action(G, u, target, aim) {
    const w = G.w; if (w.t < (u.reload || 0) || !aim) return false;
    const a = angleTo(u, aim), d = Math.min(TIDES.range, dist(u, aim));
    G.v.tides.fire(u, polar(u, d, a)); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Tides_of_Darkness);
    const D = (v.tides = {});
    const box = () => { const r = R.Tides_of_Darkness; return { x0: r.x0 + 48, y0: r.y0 + 48, x1: r.x1 - 48, y1: r.y1 - 48 }; };
    const sea = (p) => inRect(box(), p) && !w.grid.walkable(p.x, p.y, 0);
    const seaNear = (p) => { if (sea(p)) return p; for (let r = 32; r < 900; r += 32) for (let k = 0; k < 16; k++) { const q = polar(p, r, k * 22.5); if (sea(q)) return q; } return p; };
    const ship = (u, p) => { if (p) { const q = seaNear(p); u.x = q.x; u.y = q.y; } u.fly = true; u.lx = u.x; u.ly = u.y; u.reload = 0; return u; };

    const init = G.trig('TidesInitialization', function* () {
      G.music('war2intro');
      v.ante = 8; D.shells = [];
      const hy = w.create('hshy', P_NEUTRAL, center(R.Tides_Start)); hy.invuln = true;
      const oy = w.create('oshy', P_ENEMY, center(R.Tides_Spawn)); oy.invuln = true; oy.yard = true;
      let n = 0;
      G.forPlaying((i) => { const p = offset(w.randomIn(R.Tides_Start), w.rng.real(128, 256), w.rng.real(128, 256)); const b = G.bean('hdes', i, p, { speed: TIDES.speed }); b.facing = 45; ship(b, polar(p, 90 * (n++ % 4), n * 80)); });
      G.addKey(w.ofType('hdes'));
      G.forPlaying((i) => spawnOrc(polar(offset(w.randomIn(R.Tides_Spawn), w.rng.real(-128, -256), w.rng.real(-128, -256)), 90 * (i % 4), i * 80)));
      G.cameraBounds(R.Tides_of_Darkness);
      G.startTimer(120, 'Time Left');
      G.say('Tides of Bean-ness', 'Sink one enemy ship!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.TidesSpawn.enable(); T.TidesTick.enable();
      yield 4;
      for (const o of w.ofType('odes')) o.awake = true;
      G.forBots(() => T.TidesAI.enable());
    });

    function spawnOrc(p) {
      const o = ship(w.create('odes', P_ENEMY, p, 225), p);
      o.acquire = 0; o.orc = true; o.awake = w.t > 4; o.reload = w.t + w.rng.real(...TIDES.orcCd);
      return o;
    }
    G.trig('TidesSpawn', function* () { const o = spawnOrc(offset(center(R.Tides_Spawn), -64, -64)); o.awake = true; w.emit({ k: 'teleport', x: o.x, y: o.y }); },
      { cond: () => w.ofPlayer(P_ENEMY).length < TIDES.max + 1 }).every(10);

    D.fire = (u, p) => {
      u.reload = w.t + (u.orc ? w.rng.real(...TIDES.orcCd) : TIDES.cd); u.facing = angleTo(u, p);
      const fl = dist(u, p) / TIDES.shell, mine = !u.orc, src = u;
      if (!mine) { D.shells.push({ x: p.x, y: p.y, t: w.t + fl }); w.emit({ k: 'warn', id: u.id * 1000 + (w.tick % 1000), x: p.x, y: p.y, r: TIDES.hit, dur: fl, hot: true }); }
      w.emit({ k: 'sfx', id: 'shoot' });
      w.lob(u, p.x, p.y, { speed: TIDES.shell, type: 'hdes', onImpact: () => {
        w.emit({ k: 'impact', x: p.x, y: p.y, type: 'hdes', r: TIDES.hit });
        if (mine) {
          for (const o of w.ofType('odes')) if (dist(o, p) <= TIDES.hit) {
            const x = o.x, y = o.y; w.explode(o); w.emit({ k: 'boom', x, y, r: 0 });
            if (src.alive && G.key.has(src)) { v.focus = src; T.RaceFinish.execute(); }
          }
          // orcs that were shot at back away (Tides Orc AI)
          for (const o of w.ofType('odes')) if (dist(o, p) < 300) o.flee = polar(o, w.rng.real(50, 300), angleTo(src, o) + w.rng.real(-45, 45));
        } else for (const b of G.beans()) if (dist(b, p) <= TIDES.hit) G.boom(b);
      } });
    };

    G.trig('TidesTick', function* () {
      D.shells = D.shells.filter((s) => s.t > w.t);
      for (const u of w.alive((u) => u.type === 'hdes' || u.type === 'odes')) {
        if (!sea(u)) { u.x = u.lx; u.y = u.ly; } else { u.lx = u.x; u.ly = u.y; }
      }
      const beans = G.beans();
      for (const o of w.ofType('odes')) {
        if (!o.awake) continue;
        if (o.flee) { w.issue(o, { type: 'move', ...o.flee }); o.flee = null; }
        let t = null, bd = 1e9; for (const b of beans) { const d = dist(o, b); if (d < bd) { bd = d; t = b; } }
        if (!t) continue;
        if (bd <= TIDES.range && w.t >= o.reload) {
          const fl = bd / TIDES.shell, lead = w.rng.real(0, 0.8);
          const p = { x: t.x + t.vx * fl * lead + w.rng.real(-40, 40), y: t.y + t.vy * fl * lead + w.rng.real(-40, 40) };
          D.fire(o, dist(o, p) > TIDES.range ? polar(o, TIDES.range, angleTo(o, p)) : p);
        } else if (!o.order && bd > 800 && w.rng.next() < 0.05) w.issue(o, { type: 'move', ...polar(o, 250, angleTo(o, t) + w.rng.real(-40, 40)) });
        else if (!o.order && w.rng.next() < 0.02) w.issue(o, { type: 'move', ...polar(o, w.rng.real(50, 300), angleTo(t, o) + w.rng.real(-60, 60)) });
      }
    }).every(0.05);

    // bots: as the original, close in when no orc is near, kite when one is; aim with a lead; dodge shells
    G.trig('TidesAI', function* () {
      const orcs = w.ofType('odes');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const danger = D.shells.find((s) => s.t - w.t < 1.1 && dist(u, s) < TIDES.hit + 50);
          if (danger) { const a = angleTo(danger, u); w.issue(u, { type: 'steer', dx: Math.cos(a * Math.PI / 180), dy: Math.sin(a * Math.PI / 180) }); continue; }
          if (u.order?.type === 'steer') w.issue(u, { type: 'stop' });
          let t = null, bd = 1e9; for (const o of orcs) { const d = dist(u, o); if (d < bd) { bd = d; t = o; } }
          if (!t) continue;
          if (bd <= TIDES.range - 30 && w.t >= u.reload && w.t >= (u.botNext || 0)) {
            const fl = bd / TIDES.shell, err = u.err ??= w.rng.real(20, 70);
            D.fire(u, { x: t.x + t.vx * fl + w.rng.real(-err, err), y: t.y + t.vy * fl + w.rng.real(-err, err) });
            u.botNext = w.t + w.rng.real(0.2, 0.8);
          }
          if (!u.order || w.rng.next() < 0.04) {
            if (bd > 800) w.issue(u, { type: 'move', ...polar(u, 300, angleTo(u, t) + w.rng.real(-30, 30)) });
            else if (bd < 420) w.issue(u, { type: 'move', ...polar(u, w.rng.real(50, 300), angleTo(t, u) + w.rng.real(-60, 60)) });
            else w.issue(u, { type: 'move', ...polar(u, 150, angleTo(u, t) + 90 * (u.id % 2 ? 1 : -1)) });
          }
        }
      });
    }).every(0.1);

    return init;
  },
};
