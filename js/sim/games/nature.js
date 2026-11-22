// Nature's Bean Circle — based on "Nature's Circle" (Triggers_Events[30]).
// Kept: druids start 512 from the centre (slot*135-22.5), three animal forms
// (bear 320, quillbeast 300, hawk 350) in a rock/paper/scissors loop
// (bear > quillbeast > hawk > bear), ~6.7 s between shifts (100 mana at 15/s),
// night time, survival scoring, 120 s timer.
// Polished: no damage race — touching a bean your form beats pops it (quills reach
// a bit further), druids lose to every animal; click a bean (or Space near it)
// to shift into the form that beats it.
import { center, polar, dist, angleTo } from '../engine.js';

export const NATURE = { cd: 6.5, touch: 56, quill: 100 };
const SPEED = { edoc: 270, ngz1: 320, nqb1: 300, nwe2: 350 };
const BEATS = { ngz1: 'nqb1', nqb1: 'nwe2', nwe2: 'ngz1' };
const COUNTER = { nqb1: 'ngz1', nwe2: 'nqb1', ngz1: 'nwe2' };
const NAME = { ngz1: 'Bear!', nqb1: 'Quill!', nwe2: 'Hawk!' };
const beats = (a, b) => a.type !== 'edoc' && (BEATS[a.type] === b.type || b.type === 'edoc');

export default {
  num: 30, id: 'nature', title: 'Nature’s Bean Circle', orig: 'Nature’s Circle',
  subtitle: 'Counter and kill your opponents!', arena: 'nature_circle', rect: 'Nature_Circle', kind: 'survival',
  hint: 'Bear pops Quill, Quill pops Hawk, Hawk pops Bear. Click a bean to become its counter!',
  objective: 'Be the last bean standing. Out: a bean in your counter form touches you.',
  clip: ['Nature_Circle', 64, 64],
  canTarget(G, u, t) { return t !== u && G.w.t >= (u.shiftAt || 0); },
  action(G, u, target, aim) {
    const w = G.w; if (w.t < (u.shiftAt || 0)) return false;
    let t = target && target.alive && target !== u && G.key.has(target) ? target : null;
    if (!t && aim) { let bd = 1e9; for (const b of G.beans()) if (b !== u) { const d = dist(b, aim); if (d < bd) { bd = d; t = b; } } }
    if (!t) return false;
    let form = COUNTER[t.type];
    if (!form) form = w.rng.pick(['ngz1', 'nqb1', 'nwe2'].filter((f) => f !== u.type));
    if (form === u.type) return false;
    G.v.nature.shift(u, form); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Nature_Circle);
    const N = (v.nature = {});

    const init = G.trig('NatureInitialization', function* () {
      G.music('nightelfx1');
      w.tod = 0; v.tiesPossible = true;
      G.forPlaying((i) => { const b = G.bean('edoc', i, polar(C(), 512, i * 135 - 22.5), { speed: SPEED.edoc }); b.shiftAt = 0; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('edoc'));
      G.cameraBounds(R.Nature_Circle);
      G.startTimer(120, 'Time Left');
      G.say('Nature’s Bean Circle', 'Counter and pop your opponents!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SurvivalExpire.enable(); T.NatureTouch.enable();
      yield 3;
      G.forBots(() => T.NatureAI.enable());
    });

    N.shift = (u, form) => {
      const x = u.x, y = u.y, f = u.facing, ord = u.order;
      const nu = G.bean(form, u.owner, { x, y }, { speed: SPEED[form] });
      nu.x = x; nu.y = y; nu.facing = f; nu.shiftAt = w.t + NATURE.cd;
      G.key.delete(u); G.addKey([nu]); w.remove(u);
      if (ord && ord.type !== 'steer') w.issue(nu, { type: ord.type === 'move' ? 'move' : 'stop', x: ord.x, y: ord.y });
      w.emit({ k: 'teleport', x, y }); w.emit({ k: 'text3d', x, y, text: NAME[form], color: '#ffffff' });
      return nu;
    };

    G.trig('NatureTouch', function* () {
      const bs = G.beans();
      for (const a of bs) for (const b of bs) {
        if (a === b || !a.alive || !b.alive || !beats(a, b)) continue;
        const r = NATURE.touch + (a.type === 'nqb1' ? NATURE.quill - NATURE.touch : 0);
        if (dist(a, b) <= r) G.boom(b);
      }
    }).every(0.05);

    // bots: hunt prey, flee hunters, and shift into the counter of a close hunter
    G.trig('NatureAI', function* () {
      const bs = G.beans();
      G.forBots((i) => {
        for (const u0 of G.keyOf(i)) {
          let u = u0; if (!u.alive) continue;
          let threat = null, td = 1e9, prey = null, pd = 1e9;
          for (const o of bs) {
            if (o === u || !o.alive) continue; const d = dist(u, o);
            if (beats(o, u) && d < td) { td = d; threat = o; }
            if (beats(u, o) && d < pd) { pd = d; prey = o; }
          }
          if (w.t >= u.shiftAt && w.t >= (u.botNext || 0)) {
            u.botNext = w.t + w.rng.real(0.3, 0.9);
            let tg = null;
            if (threat && td < 380) tg = threat;
            else if (!prey || pd > 500 || u.type === 'edoc') { let bd = 1e9; for (const o of bs) if (o !== u && o.alive && o.type !== 'edoc') { const d = dist(u, o); if (d < bd) { bd = d; tg = o; } } }
            if (tg && COUNTER[tg.type] && COUNTER[tg.type] !== u.type) { u = N.shift(u, COUNTER[tg.type]); continue; }
            if (u.type === 'edoc' && w.t > 4) { u = N.shift(u, w.rng.pick(['ngz1', 'nqb1', 'nwe2'])); continue; }
          }
          let dx = 0, dy = 0;
          for (const o of bs) if (o !== u && o.alive && beats(o, u)) { const d = dist(u, o); if (d < 420) { const k = (420 - d) / 420 / (d || 1) * 2; dx += (u.x - o.x) * k; dy += (u.y - o.y) * k; } }
          if (prey && pd < 700) { dx += (prey.x - u.x) / pd; dy += (prey.y - u.y) / pd; }
          const dc = dist(u, C()); if (dc > 420) { dx += (C().x - u.x) / dc * (dc - 420) / 100; dy += (C().y - u.y) / dc * (dc - 420) / 100; }
          if (Math.hypot(dx, dy) > 0.1) w.issue(u, { type: 'steer', dx: dx + w.rng.real(-0.15, 0.15), dy: dy + w.rng.real(-0.15, 0.15) });
          else if (!u.order && w.rng.next() < 0.1) w.issue(u, { type: 'move', ...w.randomIn(R.Nature_Circle) });
        }
      });
    }).every(0.1);

    return init;
  },
};
