// The Skull of Gul'Bean — based on "The Skull of Gul'dan" (Triggers_Events[31]).
// Kept: the cavern layout, beans start at the exit circle, the spider den, the
// sludge, the guards in front of the two buttons, stepping on both buttons opens
// the gate to the boss chamber, a random boss (Pit Lord or Dreadlord) appears
// with the skull and starts hunting 10 s later, the skull carrier who reaches the
// exit circle wins the whole pot, race scoring.
// Polished (the original is a 240 s hero RPG with items, levels and a shop):
// every creature is a one-touch hazard that chases beans near its post and
// returns home; the skull sits on a pedestal next to the boss and is grabbed by
// walking onto it; touching the carrier steals it; a carrier who is caught drops
// it on the spot. 150 s timer.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, angleTo } from '../engine.js';

export const SKULL = { touch: 30, chaseR: 220, leash: 420, creep: 230, boss: 250, steal: 1.0, btnR: 90, timer: 150 };

export default {
  num: 31, id: 'skull', title: 'The Skull of Gul’Bean', orig: 'The Skull of Gul’dan',
  subtitle: 'Obtain the skull of Gul’dan, and escape!', arena: 'skull', rect: 'Skull', kind: 'race',
  hint: 'Step on both buttons to open the gate, grab the skull and bring it to the exit. Monsters = out!',
  objective: 'Carry the skull to the exit — one winner. Out: a monster touches you.',
  clip: ['Skull', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Skull);
    const K = (v.skull = {});
    const gateP = () => offset(C(), 0, 640);

    const init = G.trig('SkullInitialization', function* () {
      G.music('nightelfx1');
      v.ante = 8;
      Object.assign(K, { pressed: [false, false], open: false, skull: null, carrier: null, boss: null, stealAt: 0 });
      // the gate (ATg1) blocks the corridor to the boss chamber until both buttons are down
      w.restoreDestructables(R.Skull);
      K.gate = w.dest.find((d) => d.id === 'ATg1' && dist(d, gateP()) < 200);
      if (K.gate) { K.gate.size = 192; w.grid.dirty = true; }
      const fin = center(R.Skull_Finish);
      G.forPlaying((i) => G.bean('Edem', i, offset(fin, w.rng.real(-256, 256), 0), { speed: 320 }));
      G.addKey(w.ofType('Edem'));
      const creep = (t, p, f) => { const u = w.create(t, P_ENEMY, p, f); u.acquire = 0; u.abils = []; u.home = { x: u.x, y: u.y }; u.baseSpeed = Math.min(u.baseSpeed, SKULL.creep); u.creep = true; return u; };
      creep('nsgt', center(R.Skull_Spider), 15);
      creep('nspr', w.randomIn(R.Skull_Spider), 15);
      creep('nsln', offset(C(), 512, -512), 165);
      creep('nfgb', w.randomIn(R.Skull_Guard_Left), 300);
      creep('ndqv', center(R.Skull_Guard_Right), 240);
      creep('ndqn', w.randomIn(R.Skull_Guard_Right), 240);
      K.btn = [R.Skull_Button_Left, R.Skull_Button_Right].map((r) => {
        // put the button on the nearest spot a bean can actually walk to from the exit
        const c = center(r), reach = w.grid.flow(fin, 24);
        let p = w.grid.nearestWalkable(c.x, c.y, 24) || c;
        if (reach(p.x, p.y) >= 1e9) {
          let bd = 1e9;
          for (let dy = -320; dy <= 320; dy += 16) for (let dx = -320; dx <= 320; dx += 16) {
            const q = { x: c.x + dx, y: c.y + dy };
            if (reach(q.x, q.y) < 1e9 && w.grid.walkable(q.x, q.y, 24) && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); p = q; }
          }
        }
        const b = w.create('ngme', P_NEUTRAL, p); b.role = 'button'; b.invuln = true; b.baseSpeed = 0; b.coll = 0; return b;
      });
      w.create('ncop', P_NEUTRAL, fin);
      G.cameraBounds(R.Skull);
      G.startTimer(SKULL.timer, 'Time Left');
      G.say('The Skull of Gul’Bean', 'Obtain the skull, and escape!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.SkullTick.enable();
      yield 3;
      G.forBots(() => T.SkullAI.enable());
    });

    function openGate() {
      K.open = true;
      if (K.gate) w.setDest(K.gate, false);
      G.sound('doors'); w.emit({ k: 'sfx', id: 'new' }); w.quake = 300;
      const bp = offset(C(), 0, 1216);
      const sk = (K.skull = w.create('ngme', P_NEUTRAL, offset(bp, 0, -96)));
      sk.role = 'skull'; sk.invuln = true; sk.baseSpeed = 0; sk.coll = 0; sk.fly = true;
      const boss = (K.boss = w.create(w.rng.int(1, 2) === 1 ? 'Nplh' : 'Utic', P_ENEMY, offset(bp, 0, 96), 270));
      boss.acquire = 0; boss.abils = []; boss.baseSpeed = SKULL.boss; boss.home = { x: boss.x, y: boss.y }; boss.wakeAt = w.t + 10; boss.tick = 0;
      w.emit({ k: 'teleport', x: boss.x, y: boss.y });
      G.say('The gate is open!', 'Grab the skull and run to the exit!');
    }

    function setCarrier(u) {
      K.carrier = u; K.stealAt = w.t + SKULL.steal;
      if (u) { w.emit({ k: 'ring', x: u.x, y: u.y, r: 80, color: 0xffd23f, dur: 0.6 }); w.emit({ k: 'sfx', id: 'ding' }); }
    }

    G.trig('SkullTick', function* () {
      const beans = G.beans();
      // buttons
      K.btn.forEach((b, k) => {
        if (K.pressed[k]) return;
        if (beans.some((u) => dist(u, b) <= SKULL.btnR)) {
          K.pressed[k] = true; b.pressed = true;
          w.emit({ k: 'ring', x: b.x, y: b.y, r: 120, color: 0x57e36b, dur: 0.8 }); w.emit({ k: 'sfx', id: 'click' });
          w.emit({ k: 'text3d', x: b.x, y: b.y, text: K.pressed.every(Boolean) ? 'Gate open!' : 'Button 1/2', color: '#57e36b' });
          if (K.pressed.every(Boolean)) openGate();
        }
      });
      // creeps: chase beans near their post, otherwise walk home
      for (const m of w.alive((u) => u.creep)) {
        let t = null, bd = SKULL.chaseR;
        for (const u of beans) { const d = dist(u, m); if (d < bd && dist(u, m.home) < SKULL.leash) { bd = d; t = u; } }
        if (t) w.issue(m, { type: 'move', x: t.x, y: t.y });
        else if (dist(m, m.home) > 20 && (!m.order || m.order.chasing !== false)) w.issue(m, { type: 'move', x: m.home.x, y: m.home.y, chasing: false });
      }
      // boss: wakes 10 s after the gate opens, then hunts the skull carrier (or the nearest bean)
      const boss = K.boss;
      if (boss && boss.alive && w.t >= boss.wakeAt) {
        let t = K.carrier && K.carrier.alive ? K.carrier : null;
        if (!t) { let bd = 1e9; for (const u of beans) { const d = dist(u, boss); if (d < bd) { bd = d; t = u; } } }
        if (t && (!boss.order || boss.tick++ % 10 === 0)) w.issue(boss, { type: 'move', x: t.x, y: t.y });
      } else if (boss && boss.alive && !K.carrier) {
        for (const u of beans) if (dist(u, boss) < SKULL.chaseR) { boss.wakeAt = Math.min(boss.wakeAt, w.t); }
      }
      // touches
      for (const m of w.alive((u) => u.owner === P_ENEMY)) for (const u of beans) if (u.alive && dist(u, m) <= m.coll + u.coll + SKULL.touch - 24) w.kill(u);
      // skull
      const sk = K.skull; if (!sk) return;
      if (K.carrier && !K.carrier.alive) { sk.x = K.carrier.x; sk.y = K.carrier.y; setCarrier(null); w.emit({ k: 'text3d', x: sk.x, y: sk.y, text: 'Dropped!', color: '#ffd23f' }); }
      if (!K.carrier) {
        for (const u of beans) if (u.alive && dist(u, sk) <= 50) { setCarrier(u); break; }
      } else if (w.t >= K.stealAt) {
        for (const u of beans) if (u !== K.carrier && u.alive && dist(u, K.carrier) <= u.coll * 2 + 10) { setCarrier(u); w.emit({ k: 'text3d', x: u.x, y: u.y, text: 'Stolen!', color: '#ffd23f' }); break; }
      }
      if (K.carrier) {
        sk.x = K.carrier.x; sk.y = K.carrier.y + 1;
        if (dist(K.carrier, center(R.Skull_Finish)) <= 80) {
          const win = K.carrier; K.carrier = null;
          for (const u of [...G.key]) if (u !== win) G.key.delete(u);
          sk.x = win.x; sk.y = win.y;
          v.focus = win; T.SkullTick.disable(); T.RaceFinish.execute();
        }
      }
    }).every(0.05);

    // bots: open the buttons, then race for the skull / chase its carrier, keep away from monsters
    G.trig('SkullAI', function* () {
      const fin = center(R.Skull_Finish), mons = w.alive((u) => u.owner === P_ENEMY);
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          let goal;
          if (!K.open) { if (u.btnPick === undefined) u.btnPick = w.rng.int(0, 1); if (K.pressed[u.btnPick]) u.btnPick = 1 - u.btnPick; goal = K.btn[u.btnPick]; }
          else if (K.carrier === u) goal = fin;
          else if (K.carrier) goal = K.carrier;
          else goal = K.skull;
          if (!goal) continue;
          // danger: a monster close and facing/coming toward us -> back off for a moment
          let near = null, nd = 1e9;
          for (const m of mons) { const d = dist(u, m); if (d < nd) { nd = d; near = m; } }
          const careful = u.careful ??= w.rng.real(0.8, 1.3);
          if (near && nd < (near === K.boss ? 240 : 110) * careful) {
            const a = angleTo(near, u) + w.rng.real(-40, 40), p = { x: u.x + Math.cos(a * Math.PI / 180) * 200, y: u.y + Math.sin(a * Math.PI / 180) * 200 };
            const q = w.grid.nearestWalkable(p.x, p.y, u.coll); if (q) w.issue(u, { type: 'move', ...q });
            u.botHold = w.t + w.rng.real(0.4, 1.0);
            continue;
          }
          if (w.t < (u.botHold || 0)) continue;
          if (!u.order || w.tick % 20 === u.id % 20) w.issue(u, { type: 'move', x: goal.x, y: goal.y });
        }
      });
    }).every(0.1);

    return init;
  },
};
