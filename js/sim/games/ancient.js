// The Ancient Bean-isher — based on "Ancient Punisher" (Triggers_Events[41]).
// Kept: beans start 448 from the centre (slot*135-22.5), the Ancient Protector in
// the middle, the fast day cycle (x20: a day is 24 s), cloaks taken away at 6:00,
// one cloak fewer than beans plus one fake item spawning at 8:00 (128-512 from
// the centre), the Ancient uprooting at 18:00 and rooting again at 4:00,
// shadowmeld at night, survival scoring.
// Polished: walk onto a cloak to wear it (one item each); at night a cloaked bean
// that stands still is invisible; the Ancient hunts the nearest visible bean and
// its touch = out. The fake item is a "dud" that blocks you from taking a cloak.
// Every night the Ancient gets a little faster; 150 s safety timer.
import { P_ENEMY, P_NEUTRAL, center, polar, dist, angleTo } from '../engine.js';

export const ANCIENT = { reach: 70, speed: 280, speedUp: 25, still: 0.5, grab: 40 };

export default {
  num: 41, id: 'ancient', title: 'The Ancient Bean-isher', orig: 'Ancient Punisher',
  subtitle: 'Get a cloak, and hide!', arena: 'ancient_punisher', rect: 'Ancient_Punisher', kind: 'survival',
  hint: 'By day grab a cloak (one is a dud!). At night stand still in your cloak — the Ancient’s touch = out.',
  objective: 'Be the last bean standing. Out: the Ancient touches you at night (stand still in a real cloak).',
  clip: ['Ancient_Punisher', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Ancient_Punisher);
    const A = (v.ancient = {});

    const init = G.trig('AncientInitialization', function* () {
      G.music('human1');
      Object.assign(A, { phase: 'day', prev: 7, anc: null, nights: 0 });
      G.forPlaying((i) => { const b = G.bean('Nbrn', i, polar(C(), 448, i * 135 - 22.5), { speed: 320 }); b.facing = angleTo(b, C()); b.item = null; });
      G.addKey(w.ofType('Nbrn'));
      const a = (A.anc = w.create('etrp', P_ENEMY, C(), 270));
      a.acquire = 0; a.abils = []; a.coll = 48; a.baseSpeed = ANCIENT.speed; a.rooted = true;
      w.tod = 7; w.todRunning = false; w.todScale = 20;
      G.cameraBounds(R.Ancient_Punisher);
      G.startTimer(150, 'Time Left');
      G.say('The Ancient Bean-isher', 'Get a cloak, and hide!');
      T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.TieDeath.enable(); v.tiesPossible = true;
      T.AncientTick.enable();
      yield 4;
      w.todRunning = true; A.prev = w.tod;
      G.forBots(() => T.AncientAI.enable());
    });

    const items = () => w.alive((u) => u.role === 'cloak' || u.role === 'dud');
    function clearItems() {
      for (const it of items()) w.remove(it);
      for (const b of G.beans()) { if (b.item) w.emit({ k: 'teleport', x: b.x, y: b.y }); b.item = null; setHidden(b, false); }
    }
    function spawnItems() {
      const n = G.beans().length;
      const mk = (role) => { const u = w.create('Nbrn', P_NEUTRAL, polar(C(), w.rng.real(128, 512), w.rng.dir())); u.role = role; u.invuln = true; u.baseSpeed = 0; u.coll = 0; u.fly = true; return u; };
      for (let k = 0; k < n - 1; k++) mk('cloak');
      mk('dud');
      w.emit({ k: 'sfx', id: 'new' });
    }
    function setHidden(b, on) { if (b.invisible === on) return; b.invisible = on; w.emit({ k: 'meld', id: b.id, on }); }
    const crossed = (h) => (A.prev < h && w.tod >= h) || (A.prev > w.tod && (h > A.prev || h <= w.tod));

    G.trig('AncientTick', function* () {
      const a = A.anc;
      if (w.todRunning) {
        if (crossed(4)) { A.phase = 'root'; w.issue(a, { type: 'move', ...C() }); }
        if (crossed(6)) { clearItems(); A.phase = 'day'; }
        if (crossed(8)) spawnItems();
        if (crossed(18)) { A.phase = 'night'; a.rooted = false; A.nights++; a.baseSpeed = ANCIENT.speed + ANCIENT.speedUp * (A.nights - 1); G.say('Night falls!', 'Stand still in your cloak!'); w.quake = 200; }
        A.prev = w.tod;
      }
      const beans = G.beans();
      // pick up items
      for (const it of items()) for (const b of beans) if (!b.item && dist(b, it) <= ANCIENT.grab) {
        b.item = it.role; w.remove(it);
        w.emit({ k: 'text3d', x: b.x, y: b.y, text: it.role === 'cloak' ? 'Cloak!' : 'Dud!', color: it.role === 'cloak' ? '#a58cff' : '#ff6b6b' });
        w.emit({ k: 'sfx', id: it.role === 'cloak' ? 'ding' : 'red' });
        break;
      }
      // shadowmeld: cloak + night + standing still
      for (const b of beans) setHidden(b, A.phase === 'night' && b.item === 'cloak' && w.t - b.lastActive >= ANCIENT.still);
      // the Ancient
      if (A.phase === 'night') {
        let t = null, bd = 1e9;
        for (const b of beans) if (!b.invisible) { const d = dist(a, b); if (d < bd) { bd = d; t = b; } }
        if (t) w.issue(a, { type: 'move', x: t.x, y: t.y }); else if (a.order) w.issue(a, { type: 'stop' });
      } else if (A.phase === 'root' && dist(a, C()) < 10) { a.rooted = true; a.order = null; }
      for (const b of beans) if (dist(a, b) <= ANCIENT.reach + b.coll) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'etrp', r: 60 }); w.kill(b); }
    }).every(0.05);

    // bots: grab the nearest cloak by day (the original bots go for cloaks only),
    // freeze in the cloak at night, run from the Ancient without one
    G.trig('AncientAI', function* () {
      const a = A.anc, its = items().filter((u) => u.role === 'cloak');
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          if (w.t < (u.botNext || 0)) continue;
          const da = dist(u, a);
          if (A.phase !== 'night') {
            if (!u.item && its.length) { let best = null, bd = 1e9; for (const it of its) { const d = dist(u, it) + w.rng.real(0, 120); if (d < bd) { bd = d; best = it; } } w.issue(u, { type: 'move', x: best.x, y: best.y }); }
            else if (da < 260) w.issue(u, { type: 'move', ...polar(C(), 420, angleTo(C(), u) + w.rng.real(-30, 30)) });
            u.botNext = w.t + w.rng.real(0.2, 0.6);
            continue;
          }
          if (u.item === 'cloak' && (da > 200 || u.invisible)) { if (u.order) w.issue(u, { type: 'stop' }); u.botNext = w.t + 0.3; continue; }
          // flee: away from the Ancient, curving round the room
          let ang = angleTo(a, u) + w.rng.real(-35, 35);
          let p = polar(u, 220, ang);
          if (dist(p, C()) > 470) p = polar(C(), 440, angleTo(C(), u) + (u.id % 2 ? 50 : -50));
          w.issue(u, { type: 'move', ...p });
          u.botNext = w.t + w.rng.real(0.25, 0.5);
        }
      });
    }).every(0.1);

    return init;
  },
};
