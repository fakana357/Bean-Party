// Sleepy Beantime — based on "Sleepy Time" (Triggers_Events[29]).
// Kept: night time, beans start 512 from the centre (slot*135-22.5), one rock
// golem dozing near the centre, taunting pulls it, the first bean "put to sleep"
// wins (race scoring, sleepers stay on the field), 120 s timer.
// Polished: no hidden HP — each golem bonk shows "Zz n/4" and 4 bonks = asleep;
// taunt is the Space key (pulls the golem onto you), bots taunt to steal it.
import { P_ENEMY, center, polar, dist, angleTo } from '../engine.js';

export const SLEEPY = { need: 4, reach: 70, windup: 0.3, cool: 1.35, tauntR: 450, tauntCd: 4, tauntFor: 4, walk: 170 };

export default {
  num: 29, id: 'sleepy', title: 'Sleepy Beantime', orig: 'Sleepy Time',
  subtitle: 'Be the first to die!', arena: 'sleepy_time', rect: 'Sleepy_Time', kind: 'race',
  hint: 'Get bonked 4 times by the sleepy golem to doze off first! Space = taunt it onto you.',
  objective: 'Get bonked 4 times by the golem first — the first to doze off wins.',
  clip: ['Sleepy_Time', 64, 64],
  canTarget() { return false; },
  action(G, u) {
    const w = G.w, g = G.v.sleepy.golem;
    if (!g || !g.alive || w.t < (u.tauntAt || 0)) return false;
    u.tauntAt = w.t + SLEEPY.tauntCd;
    w.emit({ k: 'ring', x: u.x, y: u.y, r: SLEEPY.tauntR, color: 0xffd23f, dur: 0.5 });
    w.emit({ k: 'sfx', id: 'pop' });
    if (dist(u, g) <= SLEEPY.tauntR) { g.taunter = u; g.tauntEnd = w.t + SLEEPY.tauntFor; w.emit({ k: 'text3d', x: g.x, y: g.y, text: '!', color: '#ffd23f' }); }
    return true;
  },
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Sleepy_Time);
    const S = (v.sleepy = { golem: null });

    const init = G.trig('SleepyInitialization', function* () {
      G.music('tragicconfrontation');
      v.keepWinners = true; v.ante = 8;
      w.tod = 0;
      G.forPlaying((i) => { const b = G.bean('emtg', i, polar(C(), 512, i * 135 - 22.5), { speed: 270 }); b.zz = 0; b.tauntAt = 0; b.facing = angleTo(b, C()); });
      G.addKey(w.ofType('emtg'));
      const g = (S.golem = w.create('ngst', P_ENEMY, polar(C(), w.rng.real(0, 200), w.rng.dir()), w.rng.dir()));
      g.acquire = 0; g.abils = []; g.baseSpeed = SLEEPY.walk; g.cdEnd = 0; g.swingAt = 0; g.taunter = null; g.tauntEnd = 0; g.wanderAt = 0;
      G.cameraBounds(R.Sleepy_Time);
      G.startTimer(120, 'Time Left');
      G.say('Sleepy Beantime', 'Be the first to fall asleep!');
      T.SleepyExpire.enable(); T.SleepyGolem.enable();
      yield 4;
      G.forBots(() => T.SleepyAI.enable());
    });

    function bonk(g, b) {
      w.emit({ k: 'impact', x: b.x, y: b.y, type: 'ngst', r: 60 }); w.emit({ k: 'sfx', id: 'splat' });
      b.zz += 1;
      w.emit({ k: 'text3d', x: b.x, y: b.y, text: b.zz >= SLEEPY.need ? 'Zzz!' : `Zz ${b.zz}/${SLEEPY.need}`, color: '#bfe3ff' });
      if (b.zz < SLEEPY.need) return;
      if (g.taunter === b) g.taunter = null;
      v.focus = b; T.RaceFinish.execute();
      b.asleep = true; b.order = null; b.baseSpeed = 0; b.paused = true;
    }

    G.trig('SleepyGolem', function* () {
      const g = S.golem; if (!g || !g.alive) return;
      const awake = G.beans();
      if (g.swingAt) {
        if (w.t < g.swingAt) return;
        g.swingAt = 0; g.cdEnd = w.t + SLEEPY.cool;
        const t = g.swingT; if (t && t.alive && G.key.has(t) && dist(g, t) <= SLEEPY.reach + g.coll + t.coll + 20) bonk(g, t);
        return;
      }
      if (g.taunter && (!G.key.has(g.taunter) || w.t > g.tauntEnd)) g.taunter = null;
      let tgt = g.taunter;
      if (!tgt) { let bd = SLEEPY.reach + 60; for (const b of awake) { const d = dist(g, b) - b.coll - g.coll; if (d < bd) { bd = d; tgt = b; } } }
      if (tgt) {
        const d = dist(g, tgt) - g.coll - tgt.coll;
        if (d <= SLEEPY.reach) {
          g.order = null; g.facing = angleTo(g, tgt);
          if (w.t >= g.cdEnd) { g.swingAt = w.t + SLEEPY.windup; g.swingT = tgt; w.emit({ k: 'swing', id: g.id }); }
        } else w.issue(g, { type: 'move', x: tgt.x, y: tgt.y, follow: tgt });
        return;
      }
      if (w.t >= g.wanderAt) { g.wanderAt = w.t + w.rng.real(2, 4); w.issue(g, { type: 'move', ...polar(C(), w.rng.real(0, 320), w.rng.dir()) }); }
    }).every(0.05);

    G.trig('SleepyExpire', function* () { T.SleepyGolem.disable(); T.RaceDeath.enable(); for (const u of [...G.key]) w.kill(u); }).on('timer');

    // bots: walk to the golem (as the original) and taunt to steal it from others
    G.trig('SleepyAI', function* () {
      const g = S.golem; if (!g || !g.alive) return;
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive || u.asleep) continue;
          if (w.t >= (u.botMove || 0)) { u.botMove = w.t + w.rng.real(0.6, 1.4); w.issue(u, { type: 'move', ...polar(g, g.coll + 40, angleTo(g, u) + w.rng.real(-40, 40)) }); }
          if (w.t >= (u.botTaunt || 0) && g.taunter !== u && dist(u, g) < SLEEPY.tauntR - 40) {
            u.botTaunt = w.t + w.rng.real(0.8, 2);
            if (w.rng.next() < 0.45) this.action(G, u);
          }
        }
      });
    }.bind(this)).every(0.25);

    return init;
  },
};
