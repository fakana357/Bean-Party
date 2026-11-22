// The Spike Bean Pit — based on "The Spike Pit" (Triggers_Events[20]).
// Kept: the spike-tiled pit, beans start 50-100 from the centre, a 400-radius
// safe zone where the spikes are down drifts in a random direction, speeding up
// (+0.2 per 0.25 s step, cap 400) and turning back towards the centre (+0-5°)
// when it leaves the pit; spikes 512+ away from it come back up; ties possible.
// Polished: spike tiles no longer block walking; the rule is simply "standing on
// a raised spike tile = out" (bean centre on the tile), and tiles flash a warning
// for 0.5 s before they rise again.
import { center, polar, dist, angleTo } from '../engine.js';

export const SPIKE = { safe: 400, rise: 512, half: 60, warn: 0.5, accel: 0.25 };

export default {
  num: 20, id: 'spike', title: 'The Spike Bean Pit', orig: 'The Spike Pit',
  subtitle: 'Stay off the spikes!', arena: 'spike_pit', rect: 'Spike_Pit', kind: 'survival',
  hint: 'Stay inside the moving safe zone. Raised spike tiles = out! Flashing tiles are about to rise.',
  objective: 'Be the last bean standing. Out: you are on a raised spike tile or outside the safe zone.',
  clip: ['Spike_Pit', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Spike_Pit);
    const S = (v.spike = { p: null, speed: 0, ang: 0, tiles: [] });

    function setTile(d, up) {
      if (d.alive === up) return;
      d.alive = up; d.riseAt = null;
      w.emit({ k: 'dest', x: d.x, y: d.y, alive: up });
    }

    const init = G.trig('SpikeInitialization', function* () {
      G.music('illidan');
      v.tiesPossible = true;
      S.p = C(); S.speed = 0; S.ang = w.rng.dir();
      S.tiles = w.destIn(R.Spike_Pit).filter((d) => d.id === 'DTsp');
      for (const d of S.tiles) { d.size = 0; d.riseAt = null; } // spikes are a hazard, not a wall
      w.grid.dirty = true;
      for (const d of S.tiles) { d.alive = false; setTile(d, dist(d, S.p) > SPIKE.safe); }
      G.forPlaying((i) => G.bean('hmil', i, polar(C(), w.rng.real(50, 100), w.rng.dir()), { speed: 270 }));
      G.addKey(w.ofType('hmil'));
      G.cameraBounds(R.Spike_Pit);
      G.say('The Spike Bean Pit', 'Stay off the spikes!');
      T.TieDeath.enable(); T.SurvivalDeath.enable(); T.SpikeWork.enable(); T.SpikeTouch.enable();
      yield 2;
      G.forBots(() => T.SpikeAI.enable());
    });

    // the safe zone moves every 0.25 s (as the original)
    G.trig('SpikeWork', function* () {
      const r = R.Spike_Pit;
      S.p = polar(S.p, S.speed, S.ang);
      if (S.speed < 400) S.speed += SPIKE.accel;
      if (S.p.x < r.x0 || S.p.x > r.x1 || S.p.y < r.y0 || S.p.y > r.y1) S.ang = angleTo(S.p, C()) + w.rng.real(0, 5);
      for (const d of S.tiles) {
        const dd = dist(d, S.p);
        if (dd <= SPIKE.safe) setTile(d, false);
        else if (dd >= SPIKE.rise && !d.alive && d.riseAt == null) {
          d.riseAt = w.t + SPIKE.warn;
          w.emit({ k: 'warn', id: 'spk' + d.x + ',' + d.y, x: d.x, y: d.y, r: SPIKE.half, dur: SPIKE.warn, hot: true });
        }
      }
    }).every(0.25);

    G.trig('SpikeTouch', function* () {
      for (const d of S.tiles) if (d.riseAt != null && w.t >= d.riseAt) { if (dist(d, S.p) >= SPIKE.safe) setTile(d, true); else d.riseAt = null; }
      for (const b of G.beans()) for (const d of S.tiles) {
        if (d.alive && Math.abs(b.x - d.x) <= SPIKE.half && Math.abs(b.y - d.y) <= SPIKE.half) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'spike', r: 40 }); w.kill(b); break; }
      }
    }).every(0.05);

    // bots: stay near the middle of the safe zone, a bit ahead of where it is going
    G.trig('SpikeAI', function* () {
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const lead = u.lead ??= w.rng.real(0.3, 1.2);
          const ahead = polar(S.p, Math.min(250, S.speed * 4 * lead), S.ang);
          if (dist(u, ahead) > (u.slack ??= w.rng.real(60, 180)) || !u.order) {
            const p = polar(ahead, w.rng.real(0, 90), w.rng.dir());
            w.issue(u, { type: 'move', x: p.x, y: p.y });
          }
        }
      });
    }).every(0.25);

    return init;
  },
};
