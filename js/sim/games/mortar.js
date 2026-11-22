// Hot Mortar-Bean — based on "Hot Mortar" (Triggers_Events[4]).
// Kept: 8 starting spots around the centre cannon tower, the tower throws the
// first bomb 4 s in, bombs fly at 900, a random 5-25 s fuse, the holder blows up.
// Polished: everyone can walk; throwing is instant (click a bean); a bomb
// that times out mid-air blows up on whoever catches it (no stuck rounds).
import { P_ENEMY, center, dist } from '../engine.js';

export const MORTAR = { catchLock: 0.25, flight: 900 };

export default {
  num: 4, id: 'mortar', title: 'Hot Mortar-Bean', orig: 'Hot Mortar',
  subtitle: 'Keep passing the mortar on!', arena: 'mortar', rect: 'Mortar', kind: 'survival', noMove: true, fitAll: true,
  canTarget(G, u, t) { return G.v.mortar.holder === u && t !== u; },
  hint: 'Got the bomb? Click another bean to throw it!',
  objective: 'Don’t be holding the bomb when it goes off. Last bean standing wins.',
  action(G, u, target, aim) {
    const M = G.v.mortar;
    if (M.holder !== u || G.w.t < M.lockUntil) return false;
    let t = target && target.alive && target !== u && G.key.has(target) ? target : null;
    if (!t && aim) { let bd = 1e9; for (const b of G.beans()) if (b !== u) { const d = dist(b, aim); if (d < bd) { bd = d; t = b; } } }
    if (!t) return false;
    M.throw(u, t); return true;
  },
  clip: ['Mortar', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const M = (v.mortar = { holder: null, flight: null, fuseEnd: 1e9, lockUntil: 0, tower: null, boomOnLand: false, botAt: 0 });
    const spots = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => R['Mortar_' + i]);

    const init = G.trig('MortarInitialization', function* () {
      G.music('human1');
      Object.assign(M, { holder: null, flight: null, fuseEnd: 1e9, lockUntil: 0, boomOnLand: false });
      const order = spots.slice(); for (let i = order.length - 1; i > 0; i--) { const j = w.rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
      let k = 0; G.forPlaying((i) => { const b = G.bean('hmtm', i, center(order[k++])); b.baseSpeed = 0; });
      G.addKey(w.ofType('hmtm'));
      M.tower = w.create('hctw', P_ENEMY, center(R.Mortar)); M.tower.acquire = 0; M.tower.invuln = true;
      G.cameraBounds(R.Mortar);
      G.say('Hot Mortar-Bean', 'Keep passing the mortar on!');
      T.SurvivalDeath.enable(); T.MortarTick.enable(); T.MortarAI.enable();
      T.MortarStart.execute();
    });

    function setHolder(u) { M.holder = u; w.emit({ k: 'holder', id: u ? u.id : 0 }); }
    M.throw = (from, to) => {
      setHolder(null);
      w.emit({ k: 'throw', from: from.id, to: to.id });
      M.flight = w.shoot(from, to, { speed: MORTAR.flight, type: 'boulder', onHit: (m, t) => land(t) });
    };
    function land(t) {
      M.flight = null;
      if (!t || !t.alive) { const alive = G.beans(); t = w.pick(alive); if (!t) return; }
      setHolder(t); M.lockUntil = w.t + MORTAR.catchLock; M.botAt = w.t + w.rng.real(0.45, 1.6);
      w.emit({ k: 'catch', id: t.id });
      if (M.boomOnLand) explode();
    }
    function explode() {
      const u = M.holder; M.boomOnLand = false; M.fuseEnd = 1e9;
      if (!u) return;
      setHolder(null);
      G.boom(u); w.quake = 500; G.sound('gateDeath', u);
      const round = G.round();
      w.spawn(function* () { yield 0.1; if (G.round() === round && T.MortarTick.enabled) T.MortarStart.execute(); });
    }

    G.trig('MortarStart', function* () {
      const round = G.round();
      yield 3;
      if (G.round() !== round || !T.MortarTick.enabled) return;
      const t = w.pick(G.beans()); if (!t) return;
      M.fuseEnd = w.t + w.rng.real(5, 25);
      M.throw(M.tower, t);
    });

    G.trig('MortarTick', function* () {
      if (w.t < M.fuseEnd) return;
      if (M.holder) explode(); else if (M.flight) M.boomOnLand = true;
    }).every(0.05);

    // bots throw at a random bean after a human-ish reaction time
    G.trig('MortarAI', function* () {
      const h = M.holder; if (!h || !h.alive || !G.isBot(h.owner) || w.t < M.botAt || w.t < M.lockUntil) return;
      const others = G.beans().filter((b) => b !== h); if (!others.length) return;
      M.throw(h, w.pick(others));
    }).every(0.05);

    return init;
  },
};
