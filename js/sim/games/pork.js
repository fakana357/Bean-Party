// Pork the Piggy-Bean — based on "Pork the Piggy" (Triggers_Events[36]).
// Kept: spear-thrower beans stand in a row 448 below the centre
// (x = -576 + 128*slot), a boar wanders in the middle (new spot every 4 s, at
// least 400 away), every order becomes a ground-targeted spear throw, the beam
// that skewers the boar finishes, a new boar appears 2 s later, 90 s timer, race scoring.
// Polished: no HP: one spear landing on the boar skewers it. Spears fly in an
// arc to the clicked spot (1.2 s reload) so you must lead the boar.
import { P_ENEMY, center, offset, polar, dist, angleTo } from '../engine.js';

const PK = { speed: 1100, hitR: 48, cool: 1.2, boarSpeed: 110 };

export default {
  num: 36, id: 'pork', title: 'Pork the Piggy-Bean', orig: 'Pork the Piggy',
  subtitle: 'Be the first to skewer the piggy!', arena: 'pork_the_piggy', rect: 'Pork_the_Piggy', kind: 'race', noMove: true,
  hint: 'Space or click = throw a spear at that spot. Lead the piggy: first hit wins!',
  objective: 'Hit the piggy with a spear first to win.',
  clip: ['Pork_the_Piggy', 64, 64],
  canTarget(G, u, t) { return t.type === 'nfbr' && t.alive; },
  action(G, u, target, aim) { const p = target || aim; return p ? G.v.pork.throw(u, p) : false; },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Pork_the_Piggy);
    const P = (v.pork = { boar: null });

    P.throw = (u, p) => {
      if (!u.alive || w.t < (u.pkCd || 0) || !T.PorkTick.enabled) return false;
      u.pkCd = w.t + PK.cool; u.facing = angleTo(u, p);
      const x = p.x, y = p.y, round = G.round();
      w.emit({ k: 'swing', id: u.id }); w.emit({ k: 'sfx', id: 'throw' });
      w.lob(u, x, y, { speed: PK.speed, type: 'spear', onImpact: () => {
        w.emit({ k: 'impact', x, y, type: 'spear', r: 30 });
        if (G.round() !== round || !u.alive || !G.key.has(u)) return;
        const b = P.boar;
        if (b && b.alive && Math.hypot(b.x - x, b.y - y) <= PK.hitR) {
          b.exploded = true; w.kill(b); P.boar = null;
          w.emit({ k: 'text3d', x, y: y + 40, text: 'Skewered!', color: '#ffd23f' });
          v.focus = u; T.RaceFinish.execute();
          w.spawn(function* () { yield 2; if (G.round() === round && T.PorkTick.enabled) spawnBoar(256); });
        }
      } });
      return true;
    };

    function spawnBoar(r) {
      const b = w.create('nfbr', P_ENEMY, polar(C(), w.rng.real(0, r), w.rng.dir()), w.rng.dir());
      b.acquire = 0; b.baseSpeed = PK.boarSpeed; P.boar = b;
      w.emit({ k: 'teleport', x: b.x, y: b.y });
      w.issue(b, { type: 'move', ...polar(b, 400, w.rng.dir()) });
    }

    const init = G.trig('PorkInitialization', function* () {
      G.music('orc3');
      v.ante = 8; P.boar = null;
      G.forPlaying((i) => { const b = G.bean('ohun', i, offset(C(), -576 + 128 * i, -448)); b.baseSpeed = 0; b.facing = 90; b.pkCd = 0; b.invuln = false; });
      G.addKey(w.ofType('ohun'));
      spawnBoar(128);
      G.cameraBounds(R.Pork_the_Piggy);
      G.startTimer(90, 'Time Left');
      G.say('Pork the Piggy-Bean', 'Be the first to skewer the piggy!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.PorkTick.enable(); T.PorkPatrol.enable();
      yield 2;
      G.forBots(() => T.PorkAI.enable());
    });

    G.trig('PorkTick', function* () {}).every(1);

    // the boar trots to a new spot every 4 s, at least 400 away
    G.trig('PorkPatrol', function* () {
      const b = P.boar; if (!b || !b.alive) return;
      let p = w.randomIn(R.Pork_the_Piggy);
      if (dist(b, p) < 400) p = polar(b, 400, angleTo(b, C()));
      w.issue(b, { type: 'move', ...p });
    }).every(4);

    // bots: aim with lead after a reaction time, with some error
    G.trig('PorkAI', function* () {
      const b = P.boar; if (!b || !b.alive) return;
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pkCd) continue;
          if (w.t < (u.pkAt ??= w.t + w.rng.real(0.2, 1.2))) continue;
          u.pkAt = null;
          const fl = dist(u, b) / PK.speed, err = w.rng.real(0, 70), lead = w.rng.real(0.6, 1.2);
          const p = polar({ x: b.x + (b.vx || 0) * fl * lead, y: b.y + (b.vy || 0) * fl * lead }, err, w.rng.dir());
          P.throw(u, p);
        }
      });
    }).every(0.1);

    return init;
  },
};
