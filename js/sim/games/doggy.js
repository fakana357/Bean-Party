// Doggy Bean Hell — based on "Doggy Hell" (Triggers_Events[40]).
// Kept: the lava maze (Doggy_1..13 strips kill on entry), the start circle, the
// stick 896 above the start, the 10 meat wagons pounding a fixed spot 768 ahead of
// them (cooldown 2 s, 1.5 s once a stick has been grabbed, splash 64), 120 s timer,
// race scoring.
// Polished: every shell is telegraphed with a ring, a fresh stick appears after
// each return so everybody can still place, a dropped stick goes back to its spot.
import { P_ENEMY, P_NEUTRAL, center, offset, dist, inRect } from '../engine.js';

export const DOGGY = { splash: 64, flight: 900, cd: 2, cdFast: 1.5, speed: 210, grab: 44 };
// [dx, dy, facing] from Doggy Initialization
const WAGONS = [[-640, 0, 0], [640, 0, 180], [-320, -640, 90], [320, -640, 90], [-320, 640, 270], [320, 640, 270], [-256, 256, 0], [256, 256, 180], [-256, -256, 0], [256, -256, 180]];
// bot routes from the start pocket to the stick pocket (right side; mirrored for the left)
const ROUTE = [[0, -512], [512, -512], [512, -128], [128, -128], [128, 128], [512, 128], [512, 512], [0, 512]];

export default {
  num: 40, id: 'doggy', title: 'Doggy Bean Hell', orig: 'Doggy Hell',
  subtitle: 'Fetch the stick, and return to the circle of power!', arena: 'doggy_hell', rect: 'Doggy_Hell', kind: 'race',
  hint: 'Fetch the stick and bring it back to the circle. Lava and wagon shells = out!',
  objective: 'Bring the stick back to the start circle. Out: lava or a wagon shell.',
  clip: ['Doggy_Hell', 64, 64],
  install(G) {
    const { w, T, R, v } = G;
    const C = () => center(R.Doggy_Hell);
    const LAVA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => R['Doggy_' + i]);
    const D = (v.doggy = {});

    const init = G.trig('DoggyInitialization', function* () {
      G.music('illidan');
      v.ante = 8;
      Object.assign(D, { stick: null, carrier: null, fast: false, home: offset(w.randomIn(R.Doggy_Start), 0, 896) });
      G.forPlaying((i) => G.bean('ndog', i, w.randomIn(R.Doggy_Start), { speed: DOGGY.speed }));
      G.addKey(w.ofType('ndog'));
      for (const [dx, dy, f] of WAGONS) {
        const u = w.create('umtw', P_ENEMY, offset(C(), dx, dy), f);
        u.x = C().x + dx; u.y = C().y + dy; u.acquire = 0; u.baseSpeed = 0; u.invuln = true; u.fly = true;
        u.spot = offset(u, Math.cos(f * Math.PI / 180) * 768, Math.sin(f * Math.PI / 180) * 768);
        u.nextFire = w.t + 4 + w.rng.real(0, DOGGY.cd); u.lands = [];
      }
      w.create('ncop', P_NEUTRAL, center(R.Doggy_Start));
      for (const r of LAVA) {
        const len = Math.max(r.x1 - r.x0, r.y1 - r.y0), n = Math.max(1, Math.round(len / 64));
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; w.emit({ k: 'lava', x: r.x0 + (r.x1 - r.x0) * (r.x1 - r.x0 > r.y1 - r.y0 ? t : 0.5), y: r.y0 + (r.y1 - r.y0) * (r.x1 - r.x0 > r.y1 - r.y0 ? 0.5 : t), r: 64, dur: 125 }); }
      }
      spawnStick();
      G.cameraBounds(R.Doggy_Hell);
      G.startTimer(120, 'Time Left');
      G.say('Doggy Bean Hell', 'Fetch the stick, and return to the circle!');
      T.RaceDeath.enable(); T.RaceExpire.enable(); T.DoggyTick.enable();
      yield 4;
      G.forBots(() => T.DoggyAI.enable());
    });

    function spawnStick() {
      const s = (D.stick = w.create('n000', P_NEUTRAL, offset(D.home, w.rng.real(-48, 48), 0)));
      s.role = 'stick'; s.invuln = true; s.baseSpeed = 0; s.coll = 0; s.fly = true; s.home = { x: s.x, y: s.y };
      D.carrier = null;
      w.emit({ k: 'ring', x: s.x, y: s.y, r: 60, color: 0xffd23f, dur: 0.6 });
    }

    G.trig('DoggyTick', function* () {
      const beans = G.beans();
      // wagons
      for (const u of w.ofType('umtw')) {
        if (w.t < u.nextFire) continue;
        u.nextFire = w.t + (D.fast ? DOGGY.cdFast : DOGGY.cd);
        const sp = u.spot, fl = dist(u, sp) / DOGGY.flight;
        u.lands.push(w.t + fl); u.lands = u.lands.filter((t) => t > w.t - 0.5);
        w.emit({ k: 'warn', id: u.id * 1000 + (w.tick % 1000), x: sp.x, y: sp.y, r: DOGGY.splash, dur: fl, hot: true });
        w.lob(u, sp.x, sp.y, { speed: DOGGY.flight, type: 'umtw', onImpact: () => {
          w.emit({ k: 'impact', x: sp.x, y: sp.y, type: 'umtw', r: DOGGY.splash });
          for (const b of G.beans()) if (dist(b, sp) <= DOGGY.splash + b.coll * 0.5) G.boom(b);
        } });
      }
      // lava
      for (const b of beans) if (LAVA.some((r) => inRect(r, b))) { w.emit({ k: 'impact', x: b.x, y: b.y, type: 'lava', r: 40 }); w.kill(b); }
      // stick
      const s = D.stick; if (!s) return;
      if (D.carrier && !D.carrier.alive) { s.x = s.home.x; s.y = s.home.y; D.carrier = null; w.emit({ k: 'text3d', x: s.x, y: s.y, text: 'Stick is back!', color: '#ffd23f' }); }
      if (!D.carrier) {
        for (const b of G.beans()) if (dist(b, s) <= DOGGY.grab) { D.carrier = b; D.fast = true; w.emit({ k: 'sfx', id: 'ding' }); w.emit({ k: 'text3d', x: b.x, y: b.y, text: 'Fetch!', color: '#ffd23f' }); break; }
      }
      if (D.carrier) {
        const b = D.carrier; s.x = b.x; s.y = b.y + 1;
        if (inRect(R.Doggy_Start, b)) {
          D.carrier = null; w.remove(s); D.stick = null;
          v.focus = b; T.RaceFinish.execute();
          const round = G.round();
          w.spawn(function* () { yield 1; if (G.round() === round && T.DoggyTick.enabled) spawnStick(); });
        }
      }
    }).every(0.05);

    // bots: follow the maze route, waiting for the shells to land before crossing a target spot
    G.trig('DoggyAI', function* () {
      const wag = w.ofType('umtw');
      const unsafe = (u, dx, dy) => {
        for (const g of wag) {
          const pending = g.lands.filter((t) => t > w.t - 0.05);
          const nextFire = g.nextFire + dist(g, g.spot) / DOGGY.flight;
          for (const t of [...pending, nextFire]) {
            if (t - w.t > 1.2) continue;
            for (let k = 0; k <= 4; k++) {
              const dt = Math.max(0, t - w.t) * k / 4, p = { x: u.x + dx * u.speed * dt, y: u.y + dy * u.speed * dt };
              if (k === 4 && dist(p, g.spot) < DOGGY.splash + u.coll + 20) return true;
            }
          }
        }
        return false;
      };
      // shells about to land are threats; otherwise walk (A*) to the stick / back to the circle
      const hot = [];
      for (const g of wag) {
        const nextFire = g.nextFire + dist(g, g.spot) / DOGGY.flight;
        const soon = g.lands.some((t) => t > w.t - 0.05 && t - w.t < 0.8) || nextFire - w.t < 0.8;
        if (soon) hot.push({ x: g.spot.x, y: g.spot.y, r: DOGGY.splash + 20 });
      }
      const lava = (D.lavaDots ??= LAVA.flatMap((r) => {
        const out = [], lx = r.x1 - r.x0, ly = r.y1 - r.y0, n = Math.max(1, Math.round(Math.max(lx, ly) / 32));
        for (let k = 0; k <= n; k++) out.push({ x: r.x0 + lx * (lx > ly ? k / n : 0.5), y: r.y0 + ly * (lx > ly ? 0.5 : k / n), r: Math.min(lx, ly) / 2 - 18 });
        return out;
      }));
      G.forBots((i) => {
        for (const u of G.keyOf(i)) {
          if (!u.alive) continue;
          const goal = D.carrier === u ? center(R.Doggy_Start) : D.carrier ? { x: D.carrier.x, y: D.carrier.y } : D.stick ? { x: D.stick.x, y: D.stick.y } : null;
          if (!goal) continue;
          const inHot = hot.some((h) => dist(u, h) < h.r + u.coll);
          G.botGo(u, goal, [...hot, ...lava.filter((l) => dist(l, u) < 110)], { fear: inHot ? 110 : 24, lead: 0, los: false, step: 60 });
        }
      });
    }).every(0.1);

    return init;
  },
};
