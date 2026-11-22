// The party framework: a line-by-line port of Uther Party's core triggers
// (Next Event, Filter, Win, Draw, Finish, Game End, Tiebreaker, Survival/Race
// Death/Expire/Finish, Tie Death, Quake). Minigames plug into it.
import { World, REGIONS, P_ENEMY, P_NEUTRAL, center, clipArena } from './engine.js';
import { ALL_GAMES } from './games/index.js';

export const GAMES = ALL_GAMES.slice().sort((a, b) => a.num - b.num);

export class Party {
  // players: [{slot 1..8, name, bot}]
  constructor({ seed = (Math.random() * 2 ** 31) | 0, players, only = null, gameLength = null, games = null } = {}) {
    this.games = games || GAMES;
    for (const g of this.games) if (g.clip) clipArena(g.arena, ...g.clip);
    const w = (this.w = new World(seed));
    this.players = players;
    this.only = only;
    this.scores = Array(17).fill(0);
    this.key = new Set();
    this.events = [];
    this.v = {
      ante: 0, tieAnte: 0, gamesPlayed: 0,
      // Integer_GameLength = 8 in the map; capped to the minigames that exist in this build
      gameLength: gameLength ?? Math.min(8, only ? 1 : (games || GAMES).length),
      tieBreaker: false, gameIsOver: false, tiesPossible: false, gameCompleted: false,
      keepWinners: false, onePlayerLeft: false, focus: null, current: null, number: 0,
    };
    const G = (this.G = { w, party: this, T: {}, R: REGIONS, key: this.key, v: this.v });
    G.trig = (name, action, opts = {}) => (G.T[name] = w.trigger(name, action, { enabled: false, ...opts }));
    G.playing = (i) => this.players.some((p) => p.slot === i);
    G.isBot = (i) => this.players.some((p) => p.slot === i && p.bot);
    G.slots = () => this.players.map((p) => p.slot).sort((a, b) => a - b);
    G.forPlaying = (fn) => { for (let i = 1; i <= 8; i++) if (G.playing(i)) fn(i); };
    G.forBots = (fn) => { for (let i = 1; i <= 8; i++) if (G.isBot(i)) fn(i); };
    G.say = (text, sub) => this.emit({ k: 'text', text, sub });
    G.music = (id) => this.emit({ k: 'music', id });
    G.sound = (id, at) => this.emit({ k: 'sound', id, at });
    G.addKey = (units) => { for (const u of units) this.key.add(u); };
    G.keyOf = (p) => [...this.key].filter((u) => u.owner === p);
    G.startTimer = (sec, label) => { w.timer = { remaining: sec, running: true, label, total: sec }; };
    G.cameraBounds = (r) => { this.emit({ k: 'camera', rect: r }); this.view = r; };
    // a player's bean: small candy, one touch = out, responsive turning, no auto attacks
    G.bean = (type, slot, p, { speed } = {}) => {
      // keep starting spots apart so nobody spawns touching another bean
      const others = w.alive((o) => o.isBean);
      const clear = (q) => w.grid.walkable(q.x, q.y, 24) && others.every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= 60);
      let q = p;
      for (let r = 0; !clear(q) && r < 400; r += 12) { let found = false; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + r; const c = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }; if (clear(c)) { q = c; found = true; break; } } if (found) break; }
      const u = w.create(type, slot, q, 90);
      u.x = q.x; u.y = q.y;
      u.coll = 24; u.oneHit = true; u.turn = 4000; u.acquire = 0; u.isBean = true; u.abils = u.abils.filter((a) => a !== 'Adda' && a !== 'Sshm');
      if (speed) u.baseSpeed = speed;
      return u;
    };
    // bot steering: head for `goal` along the path, but sidestep threats (units or {x,y,r})
    // seen within `fear`, using where they will be in `lead` seconds.
    G.botGo = (u, goal, threats = [], { fear = 200, lead = 0.35, step = 150, los = true, every = 6 } = {}) => {
      const pos = (t) => ({ x: t.x + (t.vx || 0) * lead, y: t.y + (t.vy || 0) * lead, r: (t.r ?? t.coll ?? 16) + u.coll });
      const near = [];
      for (const t of threats) {
        if (t === u || (t.alive === false)) continue;
        const p = pos(t);
        const d = Math.hypot(p.x - u.x, p.y - u.y) - p.r;
        if (d < fear && (!los || w.grid.los(u.x, u.y, t.x, t.y, 4))) near.push(p);
      }
      if (!near.length) {
        if (goal && (!u.order || u.order.type !== 'move' || Math.hypot(u.order.x - goal.x, u.order.y - goal.y) > 30 || (w.tick + u.id) % (every * 4) === 0)) w.issue(u, { type: 'move', x: goal.x, y: goal.y });
        return false;
      }
      // direction we'd like to go: next path waypoint toward the goal
      let gx = 0, gy = 0;
      if (goal) {
        const path = w.grid.path(u, goal, u.coll);
        const wp = path && path.length ? path[0] : goal;
        const d = Math.hypot(wp.x - u.x, wp.y - u.y) || 1; gx = (wp.x - u.x) / d; gy = (wp.y - u.y) / d;
      }
      let best = null, bs = -1e9;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const q = { x: u.x + dx * step, y: u.y + dy * step };
        if (!w.grid.walkable(q.x, q.y, u.coll) || !w.grid.los(u.x, u.y, q.x, q.y, u.coll * 0.6)) continue;
        let danger = 0;
        for (const p of near) {
          for (const f of [0.35, 0.7, 1]) {
            const m = { x: u.x + dx * step * f, y: u.y + dy * step * f };
            const d = Math.hypot(p.x - m.x, p.y - m.y) - p.r;
            if (d < fear) danger += ((fear - d) / fear) ** 2 * (d < 10 ? 6 : 1);
          }
        }
        const s = (dx * gx + dy * gy) * 1.2 - danger * 3;
        if (s > bs) { bs = s; best = q; }
      }
      if (best) w.issue(u, { type: 'move', x: best.x, y: best.y });
      return true;
    };
    G.beans = () => [...this.key].filter((u) => u.alive);
    G.round = () => G.v.round;
    G.boom = (u, chainR) => { if (!u.alive) return; u.exploded = true; w.kill(u); w.emit({ k: 'boom', x: u.x, y: u.y, r: chainR || 0 }); };
    this.installCore();
    this.coreNames = new Set(Object.keys(G.T));
    this.events_ = {};
    for (const g of this.games) this.events_[g.num] = g.install(G);
    // every minigame trigger (and the shared survival/race ones) switches off between events
    const SHARED = ['Dawn', 'TieDeath', 'SurvivalDeath', 'SurvivalExpire', 'RaceDeath', 'RaceExpire'];
    for (const [name, t] of Object.entries(G.T)) t.game = SHARED.includes(name) || !this.coreNames.has(name);
    this.name = (slot) => this.players.find((p) => p.slot === slot)?.name ?? '?';
  }
  emit(e) { e.t = this.w.t; this.events.push(e); }
  // player input that is not plain movement: click/tap on a bean, or the action key
  action(slot, target, aim) {
    const g = this.games.find((g) => g.num === this.v.number); if (!g || !g.action) return false;
    const u = [...this.key].find((k) => k.alive && k.owner === slot); if (!u) return false;
    return g.action(this.G, u, target, aim);
  }
  start() {
    const G = this.G;
    // Intro End -> leaderboard, then Next Event
    this.emit({ k: 'leaderboard', label: `Game 1 of ${this.v.gameLength}` });
    G.T.NextEvent.execute();
  }
  update() {
    this.w.update();
    // key units removed by RemoveUnit leave the group
    for (const u of this.key) if (u.removed) this.key.delete(u);
  }

  installCore() {
    const G = this.G, w = this.w, v = this.v, S = this.scores, P = this;
    const T = G.T;
    const keyCount = () => [...this.key].filter((u) => u.alive).length;
    const fadeOut = () => this.emit({ k: 'fade', dir: 'out', dur: 4 });

    G.trig('NextEvent', function* () {
      for (const u of w.units) w.remove(u);
      w.missiles.length = 0; w.areas.length = 0;
      T.Disable.execute();
      w.pauseAll(false);
      w.todRunning = false; w.tod = 12; w.todScale = 1;
      v.gameCompleted = false; v.keepWinners = false; v.tiesPossible = false;
      v.ante = 9; v.round = (v.round || 0) + 1;
      G.forPlaying(() => { v.ante -= 1; });
      this.key.clear();
      w.quake = 0;
      if (v.gamesPlayed >= v.gameLength) T.GameEnd.execute();
      if (v.gameIsOver) { P.emit({ k: 'gameover', winner: v.winner, scores: S.slice() }); return; }
      if (v.gamesPlayed >= v.gameLength) return;
      if (v.tieBreaker) G.say('Tie-Breaker');
      T.Filter.execute();
      // hand out neutral key units (Hot Mortar) at random
      G.forPlaying((i) => {
        const pool = [...this.key].filter((u) => u.owner === P_NEUTRAL);
        const u = w.pick(pool); if (u) { u.owner = i; u.color = i; }
      });
      if (v.tieBreaker) T.Tiebreaker.execute();
      P.emit({ k: 'leaderboard', label: `Game ${v.gamesPlayed + 1} of ${v.gameLength}` });
      P.emit({ k: 'fade', dir: 'in', dur: 1 });
    }.bind(this));

    G.trig('Filter', function* () {
      if (P.only) { v.number = P.only; P.events_[P.only].execute(); return; }
      for (let guard = 0; guard < 10000; guard++) {
        v.number = w.rng.int(1, 52);
        const t = P.events_[v.number];
        if (!t) continue;                 // minigame not ported yet
        if (t.execCount === 1) continue;  // already played
        t.execute(); return;
      }
    });

    const endRound = (kind) => function* () {
      T.Win.disable(); T.Draw.disable(); T.Finish.disable();
      w.timer.running = false;
      if (!v.gameIsOver) v.gamesPlayed += 1;
      if (kind === 'win') {
        v.focus = w.pick([...this.key]);
        if (v.focus) S[v.focus.owner] += v.ante;
        P.emit({ k: 'result', kind, slot: v.focus?.owner, text: `${P.name(v.focus?.owner)} won!`, played: v.gamesPlayed, of: v.gameLength, scores: S.slice() });
        for (const u of this.key) { w.emit({ k: 'teleport', x: u.x, y: u.y }); w.remove(u); }
        this.key.clear();
      } else {
        P.emit({ k: 'result', kind, text: kind === 'draw' ? 'Draw!' : 'Finished!', played: v.gamesPlayed, of: v.gameLength, scores: S.slice() });
        this.key.clear();
      }
      fadeOut();
      yield 4;
      T.Win.enable(); T.Draw.enable(); T.Finish.enable();
      T.NextEvent.execute();
    }.bind(this);
    const enabledCond = (e) => e.trig.enabled;
    G.trig('Win', endRound('win'), { enabled: true, cond: enabledCond });
    G.trig('Draw', endRound('draw'), { enabled: true, cond: enabledCond });
    G.trig('Finish', endRound('finish'), { enabled: true, cond: enabledCond });

    G.trig('GameEnd', function* () {
      v.number = 0; v.tieBreaker = false;
      for (let i = 1; i <= 8; i++) if (S[i] > v.number) v.number = S[i];
      for (let a = 1; a <= 8; a++) if (G.playing(a) && S[a] === v.number) for (let b = 1; b <= 8; b++) if (a !== b && S[a] === S[b] && G.playing(b)) v.tieBreaker = true;
      if (v.tieBreaker) { v.gameLength += 1; P.tied = G.slots().filter((i) => S[i] === v.number); return; }
      v.gameIsOver = true;
      for (let i = 1; i <= 8; i++) if (G.playing(i) && S[i] === v.number) v.winner = i;
    });

    G.trig('Tiebreaker', function* () {
      let top = 0; for (let i = 1; i <= 8; i++) if (S[i] > top) top = S[i];
      G.forPlaying((i) => { if (S[i] !== top) for (const u of w.ofPlayer(i)) w.remove(u); });
      for (const u of [...this.key]) if (u.removed) this.key.delete(u);
    }.bind(this));

    // Disable: switches every minigame trigger off between events
    G.trig('Disable', function* () { for (const t of Object.values(T)) if (t.game) t.disable(); });

    // Tie Death: deaths in the same frame share the same ante
    G.trig('TieDeath', function* (e) { v.tieAnte = v.ante; e.trig.disable(); yield 0; e.trig.enable(); }, { cond: enabledCond });

    G.trig('SurvivalDeath', function* (e) {
      const u = e.unit, p = u.owner;
      T.TieDeath.conditional({});
      this.key.delete(u);
      S[p] += v.tiesPossible ? v.tieAnte : v.ante;
      P.emit({ k: 'out', slot: p, pts: v.tiesPossible ? v.tieAnte : v.ante, scores: S.slice() });
      v.ante += 1;
      v.onePlayerLeft = false;
      const total = [...this.key].length;
      for (let i = 1; i <= 8; i++) if ([...this.key].filter((k) => k.owner === i).length === total) v.onePlayerLeft = true;
      if (v.tiesPossible) yield 0;
      if (!v.onePlayerLeft) return;
      T.SurvivalDeath.disable();
      if ([...this.key].length > 0) T.Win.conditional({}); else T.Draw.conditional({});
    }.bind(this), { cond: (e) => this.key.has(e.unit) && [...this.key].filter((k) => k.owner === e.unit.owner).length <= 1 }).on('death');

    G.trig('SurvivalExpire', function* () {
      T.SurvivalDeath.disable();
      for (let i = 1; i <= 8; i++) if ([...this.key].some((k) => k.owner === i)) { S[i] += v.ante; }
      for (const u of [...this.key]) w.kill(u);
      T.Draw.conditional({});
    }.bind(this)).on('timer');

    G.trig('RaceDeath', function* (e) {
      this.key.delete(e.unit);
      if ([...this.key].length > 0) return;
      if (v.gameCompleted) T.Finish.conditional({}); else T.Draw.conditional({});
    }.bind(this), { cond: (e) => this.key.has(e.unit) }).on('death');

    G.trig('RaceExpire', function* () { for (const u of [...this.key]) w.kill(u); }.bind(this)).on('timer');

    G.trig('RaceFinish', function* () {
      const u = v.focus;
      if (!v.gameCompleted) P.emit({ k: 'text', text: `${P.name(u.owner)} won!` });
      v.gameCompleted = true;
      this.key.delete(u);
      S[u.owner] += v.ante;
      P.emit({ k: 'finish', slot: u.owner, pts: v.ante, scores: S.slice() });
      v.ante -= 1;
      if (!v.keepWinners) { w.emit({ k: 'teleport', x: u.x, y: u.y }); w.remove(u); }
      if ([...this.key].length === 0) T.RaceDeath.disable();
      if ([...this.key].length === 0) T.Finish.conditional({});
    }.bind(this), { enabled: true });

    // Dawn: time of day stops at 7:00
    G.trig('Dawn', function* () { w.todRunning = false; }).on('tod', 7);
    for (const h of w.handlers) if (h.kind === 'tod') h.filter = 7;
  }
}
