// Obey Archibean — based on "Obey Archimonde" (Triggers_Events[22]).
// Kept: 8 player plots (Obey_1..8), the boss above them, a command every
// (speed + 0.5) s after a 2 s pause, speed starting at 5 and dropping 0.5 per
// command down to 1, extra commands unlocked at difficulty 5 and 10, a wrong
// order = instant lightning, too slow = out, ties possible.
// Polished: WC3 spell orders became coloured pads around your plot. The boss
// calls a colour; step on that pad before time runs out. Stepping on any other
// pad = out. Beans glide back to the middle between commands. 90 s timer.
import { P_ENEMY, P_NEUTRAL, center, offset, dist } from '../engine.js';

// roar, stomp, bloodlust, unholy frenzy
const CMDS = [
  { name: 'RED', color: '#ff4d5e', hex: 0xff4d5e, dx: 0, dy: 100 },
  { name: 'BLUE', color: '#3d8bff', hex: 0x3d8bff, dx: 0, dy: -100 },
  { name: 'GREEN', color: '#57d96b', hex: 0x57d96b, dx: -100, dy: 0 },
  { name: 'YELLOW', color: '#ffd23f', hex: 0xffd23f, dx: 100, dy: 0 },
];
const PAD_R = 46, PLOT = 140;

export default {
  num: 22, id: 'obey', title: 'Obey Archibean', orig: 'Obey Archimonde',
  subtitle: 'Do what Archibean tells you!', arena: 'obey_archimonde', rect: 'Obey_Archimonde', kind: 'survival',
  hint: 'Step on the pad of the colour Archibean calls, in time. Wrong pad = out!',
  objective: 'Be the last bean standing. Out: you are not on the called colour when time runs out.',
  clip: ['Obey_Archimonde', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const O = (v.obey = { cmd: -1, open: false, deadline: 0, speed: 5, curve: 0, homes: new Map() });

    const init = G.trig('ObeyInitialization', function* () {
      G.music('lichking');
      v.tiesPossible = true;
      Object.assign(O, { cmd: -1, open: false, deadline: 0, speed: 5, curve: 0 }); O.homes = new Map();
      G.forPlaying((i) => {
        const c = center(R['Obey_' + i]);
        const b = G.bean('nchw', i, c, { speed: 300 }); b.x = c.x; b.y = c.y; b.facing = 90;
        O.homes.set(b, c);
        CMDS.forEach((k, j) => {
          const p = w.create('ncp2', P_NEUTRAL, offset(c, k.dx, k.dy), 0);
          p.coll = 0; p.padColor = k.hex; p.padSlot = i; p.padCmd = j;
        });
      });
      G.addKey(w.ofType('nchw'));
      const boss = w.create('Uwar', P_ENEMY, offset(center(R.Obey_Archimonde), 0, 320), 270);
      boss.acquire = 0; boss.invuln = true; boss.baseSpeed = 0; O.boss = boss;
      G.cameraBounds(R.Obey_Archimonde);
      G.say('Obey Archibean', 'Do what Archibean tells you!');
      G.startTimer(90, 'Time Left');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.ObeyCheck.enable();
      yield 4;
      G.forBots(() => T.ObeyAI.enable());
      T.ObeyLoop.execute();
    });

    function zap(b) { if (!b.alive) return; w.emit({ k: 'impact', x: b.x, y: b.y, type: 'zap', r: 60 }); w.emit({ k: 'sfx', id: 'zap' }); G.boom(b); w.quake = 500; }

    G.trig('ObeyLoop', function* () {
      const round = G.round();
      while (G.round() === round && T.ObeyCheck.enabled) {
        // glide everyone back home
        O.open = false;
        for (const b of G.beans()) { b.pauseUntil = w.t + 1.2; b.order = null; }
        yield 2;
        if (G.round() !== round || !T.ObeyCheck.enabled) return;
        O.curve += 1;
        let c = w.rng.int(0, 1);
        if (O.curve >= 5 && w.rng.int(1, 3) === 1) c = 2;
        if (O.curve >= 10 && w.rng.int(1, 4) === 1) c = 3;
        O.cmd = c; O.open = true;
        const window = O.speed + 0.5;
        O.deadline = w.t + window;
        for (const b of G.beans()) b.obeyed = false;
        G.say(`Archibean says: ${CMDS[c].name}!`);
        w.emit({ k: 'text3d', x: O.boss.x, y: O.boss.y + 80, text: CMDS[c].name + '!', color: CMDS[c].color });
        w.emit({ k: 'ring', x: O.boss.x, y: O.boss.y, r: 160, color: CMDS[c].hex, dur: 0.8 });
        w.emit({ k: 'sfx', id: 'new' });
        w.emit({ k: 'swing', id: O.boss.id });
        yield window;
        if (G.round() !== round || !T.ObeyCheck.enabled) return;
        O.open = false;
        for (const b of G.beans()) if (!b.obeyed) zap(b);
        if (O.speed > 1) O.speed -= 0.5;
      }
    });

    G.trig('ObeyCheck', function* () {
      for (const b of G.beans()) {
        const h = O.homes.get(b); if (!h) continue;
        if (w.t < b.pauseUntil) { // gliding back to the middle
          const d = dist(b, h); if (d > 2) { const k = Math.min(1, 0.05 * 6); b.x += (h.x - b.x) * k; b.y += (h.y - b.y) * k; }
          continue;
        }
        // stay on your own plot
        b.x = Math.max(h.x - PLOT, Math.min(h.x + PLOT, b.x)); b.y = Math.max(h.y - PLOT, Math.min(h.y + PLOT, b.y));
        for (let j = 0; j < CMDS.length; j++) {
          const p = offset(h, CMDS[j].dx, CMDS[j].dy);
          if (dist(b, p) > PAD_R) continue;
          if (O.open && j === O.cmd) { if (!b.obeyed) { b.obeyed = true; w.emit({ k: 'ring', x: p.x, y: p.y, r: PAD_R + 10, color: CMDS[j].hex, dur: 0.4 }); } }
          else if (!(b.obeyed && !O.open && j === O.cmd)) { zap(b); break; }
        }
      }
    }).every(0.05);

    // bots: react after a human-ish delay; occasionally panic and pick the wrong pad
    G.trig('ObeyAI', function* () {
      G.forBots((i) => {
        for (const b of G.keyOf(i)) {
          if (!b.alive || w.t < b.pauseUntil) continue;
          const h = O.homes.get(b);
          if (!O.open) { b.botCmd = null; continue; }
          if (b.botCmd == null) {
            b.botCmd = O.cmd; b.botAt = w.t + w.rng.real(0.3, 1.5);
            if (w.rng.next() < 0.03 + 0.01 * O.curve) b.botCmd = w.rng.int(0, O.curve >= 10 ? 3 : O.curve >= 5 ? 2 : 1);
          }
          if (w.t < b.botAt || b.obeyed) continue;
          const k = CMDS[b.botCmd]; w.issue(b, { type: 'move', ...offset(h, k.dx, k.dy) });
        }
      });
    }).every(0.1);

    return init;
  },
};
