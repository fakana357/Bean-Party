// Hungry Hungry Beans — based on "Hungry Hungry Kodos" (Triggers_Events[13]).
// Kept: the octagon arena with its 4 gate mouths, beans start 200 from the centre,
// piglets come in from the gates every 10 s (max 10), gummy kids appear from
// the 2nd wave (max 2) and give a stun bolt, survival scoring with ties.
// Polished: the hidden HP drain is a visible tummy timer (countdown over your
// head when low); eating = touching; the bolt is a click/Space on another bean.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const KODOS = { food: 30, pig: 5, kid: 2, eatR: 20, stun: 2, boltFood: 6, maxPigs: 10, maxKids: 2 };

function nearestOther(G, u, p) {
  let t = null, bd = 1e9;
  for (const b of G.beans()) if (b !== u) { const d = dist(b, p); if (d < bd) { bd = d; t = b; } }
  return t;
}

export default {
  num: 13, id: 'kodos', title: 'Hungry Hungry Beans', orig: 'Hungry Hungry Kodos',
  subtitle: 'Eat the pigs to survive the longest!', arena: 'hungry_hungry_kodos', rect: 'Hungry_Hungry_Kodos', kind: 'survival',
  hint: 'Touch piglets to eat (+5 s). Empty tummy = out! Gummy kid = zap: click a bean to stun it.',
  objective: 'Be the last bean standing. Out: your tummy runs empty — eat piglets to refill it.',
  clip: ['Hungry_Hungry_Kodos', 64, 64],
  canTarget(G, u, t) { return (u.zaps || 0) > 0 && t !== u && G.key.has(t) && t.alive; },
  action(G, u, target, aim) {
    if (!(u.zaps > 0) || G.w.t < u.pauseUntil) return false;
    let t = target && target.alive && target !== u && G.key.has(target) ? target : null;
    if (!t && aim) t = nearestOther(G, u, aim);
    if (!t) return false;
    G.v.kodos.bolt(u, t); return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Hungry_Hungry_Kodos);
    const gates = () => [R.Hungry_1, R.Hungry_2, R.Hungry_3, R.Hungry_4];
    const K = (v.kodos = { wave: 0 });

    K.bolt = (from, to) => {
      from.zaps -= 1;
      w.emit({ k: 'sfx', id: 'zap' });
      w.shoot(from, to, { speed: 1000, type: 'boulder', onHit: (m, t) => {
        if (!t || !t.alive) return;
        t.pauseUntil = w.t + KODOS.stun; t.order = null;
        t.food -= KODOS.boltFood;
        w.emit({ k: 'ring', x: t.x, y: t.y, r: 60, color: 0x9fe8ff, dur: 0.6 });
        w.emit({ k: 'text3d', x: t.x, y: t.y, text: `-${KODOS.boltFood}`, color: '#7fd3ff' });
      } });
    };

    const init = G.trig('KodosInitialization', function* () {
      G.music('orc3');
      v.tiesPossible = true; K.wave = 0; K.start = w.t;
      G.forPlaying((i) => { const b = G.bean('okod', i, polar(C(), 200, w.rng.dir()), { speed: 240 }); b.food = KODOS.food; b.zaps = 0; b.lastShow = 0; });
      G.addKey(w.ofType('okod'));
      G.cameraBounds(R.Hungry_Hungry_Kodos);
      G.say('Hungry Hungry Beans', 'Eat the pigs to survive the longest!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.KodosHunger.enable(); T.KodosPigs.enable();
      G.forBots(() => T.KodosAI.enable());
      yield 3;
      T.KodosSpawnBase.enable(); T.KodosSpawnBase.execute();
    });

    function spawnFrom(type) {
      const g = w.rng.pick(gates());
      const u = w.create(type, P_ENEMY, w.randomIn(g));
      u.acquire = 0;
      w.issue(u, { type: 'move', ...w.randomIn(R.Hungry_Hungry_Kodos) });
      w.emit({ k: 'ring', x: u.x, y: u.y, r: 40, color: type === 'nvlk' ? 0xffd23f : 0xff9fc8, dur: 0.5 });
      return u;
    }

    // every 10 s: a piglet for each bean still in (the original rolled 50 %), kids from wave 2
    G.trig('KodosSpawnBase', function* () {
      K.wave += 1;
      const n = G.beans().length;
      for (let k = 0; k < n; k++) if (w.ofType('npig').length < KODOS.maxPigs) spawnFrom('npig');
      if (K.wave > 1 && w.ofType('nvlk').length < KODOS.maxKids) spawnFrom('nvlk');
    }).every(10);

    // tummy timer: drains a bit faster as the round goes on; countdown when low
    G.trig('KodosHunger', function* () {
      const drain = 0.1 * (1 + Math.max(0, w.t - (K.start || 0)) / 60);
      for (const b of G.beans()) {
        b.food -= drain;
        if (b.food <= 0) { w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'Starved!', color: '#ff4d5e' }); w.kill(b); continue; }
        const s = Math.ceil(b.food);
        if (s <= 10 && s !== b.lastShow) { b.lastShow = s; w.emit({ k: 'text3d', x: b.x, y: b.y, text: String(s), color: s <= 5 ? '#ff4d5e' : '#ffd23f' }); }
        if (s > 10) b.lastShow = 0;
      }
    }).every(0.1);

    // eating (touch) and piglet behaviour: wander, shy away from close beans
    G.trig('KodosPigs', function* () {
      const beans = G.beans();
      for (const p of [...w.ofType('npig'), ...w.ofType('nvlk')]) {
        let eaten = false;
        for (const b of beans) if (w.t >= b.pauseUntil && dist(b, p) <= b.coll + p.coll + KODOS.eatR) {
          if (p.type === 'npig') { b.food += KODOS.pig; w.emit({ k: 'text3d', x: b.x, y: b.y, text: `+${KODOS.pig}`, color: '#57e36b' }); }
          else { b.zaps = (b.zaps || 0) + 1; w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'ZAP!', color: '#7fd3ff' }); }
          w.emit({ k: 'sfx', id: 'pop' }); w.remove(p); eaten = true; break;
        }
        if (eaten) continue;
        if (w.tick % 8 !== p.id % 8) continue;
        let near = null, nd = 160;
        for (const b of beans) { const d = dist(b, p); if (d < nd) { nd = d; near = b; } }
        if (near) {
          let q = polar(p, 160, angleTo(near, p) + w.rng.real(-40, 40));
          if (!w.grid.walkable(q.x, q.y, p.coll)) q = w.randomIn(R.Hungry_Hungry_Kodos);
          w.issue(p, { type: 'move', ...q });
        } else if (!p.order) w.issue(p, { type: 'move', ...w.randomIn(R.Hungry_Hungry_Kodos) });
      }
    }).every(0.05);

    // bots: chase the closest snack nobody else is closer to, zap the best-fed rival
    G.trig('KodosAI', function* () {
      const food = [...w.ofType('npig'), ...w.ofType('nvlk')];
      const beans = G.beans();
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || w.t < u.pauseUntil) continue;
          if (u.zaps > 0 && w.rng.next() < 0.15) {
            let best = null, bf = -1; for (const b of beans) if (b !== u && b.food > bf && w.t >= b.pauseUntil) { bf = b.food; best = b; }
            if (best) { K.bolt(u, best); continue; }
          }
          let tgt = null, bs = 1e9;
          for (const f of food) {
            let d = dist(u, f); if (f.type === 'nvlk') d *= 1.3;
            for (const b of beans) if (b !== u && dist(b, f) < d * 0.7) d *= 1.6;
            if (d < bs) { bs = d; tgt = f; }
          }
          if (tgt) w.issue(u, { type: 'move', x: tgt.x, y: tgt.y });
          else if (!u.order) w.issue(u, { type: 'move', ...polar(C(), w.rng.real(0, 300), w.rng.dir()) });
        }
      });
    }).every(0.3);

    return init;
  },
};
