// Bean Party simulation engine.
// A small, deterministic re-implementation of the parts of the Warcraft III
// runtime that Uther Party's triggers rely on: units, orders, pathing, attacks,
// artillery, spells used by the 5 ported minigames, timers, regions, time of
// day, trigger threads (PolledWait / TriggerSleepAction) and events.
// Pure JS, no DOM: it runs in the browser, in Node tests and in Deno.

import { Rng } from './rng.js';
import { STATS, MAP } from './data.js';

export const DT = 1 / 40;
export const P_ENEMY = 12;      // Player(11) in JASS (1-based here)
export const P_NEUTRAL = 16;    // PLAYER_NEUTRAL_PASSIVE
const DEG = Math.PI / 180;

// MiscGame.txt damage tables. Armor order: small, medium, large, fort, normal, hero, divine, none
const ARMOR = { small: 0, medium: 1, large: 2, fort: 3, normal: 4, hero: 5, divine: 6, none: 7 };
const DMG = {
  normal: [1.0, 1.5, 1.0, 0.7, 1.0, 1.0, 0.05, 1.0],
  pierce: [2.0, 0.75, 1.0, 0.35, 1.0, 0.5, 0.05, 1.5],
  siege: [1.0, 0.5, 1.0, 1.5, 1.0, 0.5, 0.05, 1.5],
  magic: [1.25, 0.75, 2.0, 0.35, 1.0, 0.5, 0.05, 1.0],
  chaos: [1, 1, 1, 1, 1, 1, 1, 1],
  spells: [1.0, 1.0, 1.0, 1.0, 1.0, 0.7, 0.05, 1.0],
  hero: [1.0, 1.0, 1.0, 0.5, 1.0, 1.0, 0.05, 1.0],
};
const DEFENSE_ARMOR = 0.06;
const DAY_LENGTH = 480, DAWN = 6, DUSK = 18;

export const AB = STATS.abilities;
const ab = (id, key, field) => {
  const a = AB[id]; if (!a) return 0;
  if (field && a.overrides[field] !== undefined) return +a.overrides[field];
  return +a[key] || 0;
};
// Effective ability numbers (base SLK + map overrides)
export const ABIL = {
  ACtb: { range: ab('ACtb', 'rng', 'aran'), missile: ab('ACtb', 'missilespeed', 'amsp'), dmg: ab('ACtb', 'dataa'), cost: ab('ACtb', 'cost', 'amcs'), cool: ab('ACtb', 'cool', 'acdn'), targs: String(AB.ACtb.overrides.atar || AB.ACtb.targs) },
  A007: { range: ab('A007', 'rng'), cost: ab('A007', 'cost'), cool: ab('A007', 'cool'), dur: ab('A007', 'dur'), steps: ab('A007', 'dataa'), pause: ab('A007', 'datad', 'Prg4') },
  Sshm: { fade: ab('Sshm', 'dataa'), dayNight: ab('Sshm', 'datab'), action: ab('Sshm', 'datac') },
  ANpi: { area: ab('ANpi', 'area'), dmg: ab('ANpi', 'dataa'), interval: ab('ANpi', 'dur') },
  Adda: { fullR: ab('Adda', 'dataa', 'Dda1'), fullD: ab('Adda', 'datab', 'Dda2'), partR: ab('Adda', 'datac', 'Dda3'), partD: ab('Adda', 'datad', 'Dda4'), delay: ab('Adda', 'dur') },
  Abof: { area: ab('Abof', 'area'), dmg: ab('Abof', 'dataa'), interval: ab('Abof', 'datab'), dur: ab('Abof', 'dur') },
};

// ---------------------------------------------------------------- geometry
// Some arenas are enlarged for the bigger beans. A scaled arena is moved to its own far-away
// spot so it never overlaps another arena; regions, doodads and destructibles move with it.
export const ARENA_SCALE = { road: 1.5 };
const SCALED_AT = { road: { x: 30000, y: 0 } };
for (const [key, a] of Object.entries(MAP.arenas)) {
  a.cell = 32; a.scale = 1;
  const k = ARENA_SCALE[key]; if (!k) continue;
  const ox = a.x0, oy = a.y0, X = SCALED_AT[key].x, Y = SCALED_AT[key].y;
  const tf = (x, y) => [X + (x - ox) * k, Y + (y - oy) * k];
  const W = a.w * 32, H = a.h * 32;
  for (const [name, r] of Object.entries(MAP.regions)) if (r[0] >= ox && r[2] <= ox + W && r[1] >= oy && r[3] <= oy + H) { const [x0, y0] = tf(r[0], r[1]), [x1, y1] = tf(r[2], r[3]); MAP.regions[name] = [x0, y0, x1, y1]; }
  for (const d of [...a.dest, ...a.deco]) { [d.x, d.y] = tf(d.x, d.y); }
  a.x0 = X; a.y0 = Y; a.cell = 32 * k; a.scale = k;
}
// Clip an arena to its play zone (region + margin) so leftover bits of the WC3 map's
// neighbouring terrain don't show up or connect to the play area. Games declare
// clip: [regionName, marginX, marginY]; the party applies it once before the world is built.
export function clipArena(key, reg, mx, my) {
  const a = MAP.arenas[key]; if (!a || a.clipped) return; a.clipped = true;
  const r = MAP.regions[reg], k = a.scale || 1;
  a.rows = a.rows.map((row, j) => [...row].map((c, i) => {
    const x = a.x0 + (i + 0.5) * a.cell, y = a.y0 + (j + 0.5) * a.cell;
    return x < r[0] - mx * k || x > r[2] + mx * k || y < r[1] - my * k || y > r[3] + my * k ? '#' : c;
  }).join(''));
  const keep = (d) => d.x >= r[0] - mx * k && d.x <= r[2] + mx * k && d.y >= r[1] - my * k && d.y <= r[3] + my * k;
  a.deco = a.deco.filter(keep); a.dest = a.dest.filter(keep);
}
export const rect = (r) => ({ x0: r[0], y0: r[1], x1: r[2], y1: r[3] });
export const REGIONS = Object.fromEntries(Object.entries(MAP.regions).map(([k, v]) => [k, rect(v)]));
export const center = (r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
export const polar = (p, d, angDeg) => ({ x: p.x + d * Math.cos(angDeg * DEG), y: p.y + d * Math.sin(angDeg * DEG) });
export const offset = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) / DEG;
export const inRect = (r, p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
const angDiff = (a, b) => { let d = ((b - a) % 360 + 540) % 360 - 180; return d; };

// ---------------------------------------------------------------- pathing
// The world map is only walkable inside the exported arenas (32x32 cells, from war3map.wpm),
// minus destructible footprints (from war3map.doo).
// small units (beans, critters) squeeze through one-cell corridors like in the original map
const effR = (r) => (r <= 24 ? Math.min(r, 16) : r);
class Grid {
  constructor(world) {
    this.world = world;
    this.arenas = Object.entries(MAP.arenas).map(([key, a]) => ({ key, ...a, block: a.rows.map((r) => [...r].map((c) => (c === '#' ? 1 : 0))) }));
    this.dest = [];
    for (const a of this.arenas) for (const d of a.dest) this.dest.push({ ...d, arena: a.key, life: d.hp, maxLife: d.hp, alive: true });
    this.dirty = true;
    this.rebuild();
  }
  arenaAt(x, y) {
    for (const a of this.arenas) if (x >= a.x0 && y >= a.y0 && x < a.x0 + a.w * a.cell && y < a.y0 + a.h * a.cell) return a;
    return null;
  }
  rebuild() {
    for (const a of this.arenas) {
      a.cells = a.block.map((r) => r.slice());
      for (const d of this.dest) {
        if (!d.alive || d.arena !== a.key || !d.size) continue;
        const h = d.size / 2;
        for (let y = d.y - h + a.cell / 2; y < d.y + h; y += a.cell) for (let x = d.x - h + a.cell / 2; x < d.x + h; x += a.cell) {
          const i = Math.floor((x - a.x0) / a.cell), j = Math.floor((y - a.y0) / a.cell);
          if (a.cells[j] && a.cells[j][i] !== undefined) a.cells[j][i] = 1;
        }
      }
      // clearance: distance (world units) from cell centre to nearest blocked cell edge
      const W = a.w, H = a.h, D = new Float32Array(W * H).fill(1e9);
      const q = [];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (a.cells[j][i]) { D[j * W + i] = 0; q.push(i, j); }
      // treat outside of arena as blocked
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ((i === 0 || j === 0 || i === W - 1 || j === H - 1) && !a.cells[j][i]) { D[j * W + i] = Math.min(D[j * W + i], a.cell / 2); }
      for (let k = 0; k < q.length; k += 2) {
        const i = q[k], j = q[k + 1];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nd = D[j * W + i] + (di && dj ? a.cell * 1.41 : a.cell) - (D[j * W + i] === 0 ? a.cell / 2 : 0);
          if (nd < D[nj * W + ni]) { D[nj * W + ni] = nd; q.push(ni, nj); }
        }
      }
      a.clear = D;
    }
    this.dirty = false;
  }
  clearance(x, y) {
    const a = this.arenaAt(x, y); if (!a) return 0;
    const i = Math.floor((x - a.x0) / a.cell), j = Math.floor((y - a.y0) / a.cell);
    return a.clear[j * a.w + i];
  }
  // walking distance to `goal` from anywhere in the same arena (cached per goal+radius)
  flow(goal, r = 24) {
    const a = this.arenaAt(goal.x, goal.y); if (!a) return () => 1e9;
    if (this.dirty) this.rebuild();
    const key = `${goal.x | 0},${goal.y | 0},${r}`;
    a.flows ??= {};
    if (a.flows[key] && a.flows[key].clear === a.clear) return a.flows[key].fn;
    const W = a.w, H = a.h, D = new Float32Array(W * H).fill(1e9);
    const ok = (i, j) => { const c = a.clear[j * W + i]; return c > 0 && c >= Math.min(effR(r), 60) - 0.01; };
    const gi = Math.floor((goal.x - a.x0) / a.cell), gj = Math.floor((goal.y - a.y0) / a.cell);
    const q = [gi, gj]; D[gj * W + gi] = 0;
    for (let k = 0; k < q.length; k += 2) {
      const i = q[k], j = q[k + 1], d0 = D[j * W + i];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H || !ok(ni, nj)) continue;
        if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const nd = d0 + (di && dj ? a.cell * 1.414 : a.cell);
        if (nd < D[nj * W + ni]) { D[nj * W + ni] = nd; q.push(ni, nj); }
      }
    }
    const fn = (x, y) => {
      if (x < a.x0 || y < a.y0) return 1e9;
      const i = Math.floor((x - a.x0) / a.cell), j = Math.floor((y - a.y0) / a.cell);
      if (i >= W || j >= H) return 1e9;
      return D[j * W + i];
    };
    a.flows[key] = { clear: a.clear, fn };
    return fn;
  }
  // small units (beans, critters) squeeze through one-cell corridors like in the original map
  walkable(x, y, r = 0) { const c = this.clearance(x, y); return c > 0 && c >= Math.min(effR(r), 60) - 0.01; }
  los(ax, ay, bx, by, r) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 12);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!this.walkable(ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false; }
    return true;
  }
  nearestWalkable(x, y, r) {
    if (this.walkable(x, y, r)) return { x, y };
    for (let rad = 32; rad < 1200; rad += 32) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (this.walkable(px, py, r)) return { x: px, y: py };
    }
    return null;
  }
  // A* over 8-connected cells, then string pulling.
  // extra(x, y) -> added cost (in cells) for stepping onto that cell, e.g. near a monster
  path(from, to, r, extra = null) {
    const a = this.arenaAt(from.x, from.y); if (!a) return null;
    let goal = this.nearestWalkable(to.x, to.y, r); if (!goal) return null;
    if (this.arenaAt(goal.x, goal.y) !== a) return null;
    if (!extra && this.los(from.x, from.y, goal.x, goal.y, r)) return [goal];
    const W = a.w, H = a.h, ok = (i, j) => i >= 0 && j >= 0 && i < W && j < H && a.clear[j * W + i] >= Math.min(effR(r), 60) - 0.01 && a.clear[j * W + i] > 0;
    const si = Math.floor((from.x - a.x0) / a.cell), sj = Math.floor((from.y - a.y0) / a.cell);
    const gi = Math.floor((goal.x - a.x0) / a.cell), gj = Math.floor((goal.y - a.y0) / a.cell);
    const N = W * H, g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [[0, si, sj]]; g[sj * W + si] = 0;
    const hfn = (i, j) => Math.hypot(i - gi, j - gj);
    let found = false, it = 0;
    while (open.length && it++ < 20000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open[bi]; open.splice(bi, 1);
      const id = j * W + i; if (closed[id]) continue; closed[id] = 1;
      if (i === gi && j === gj) { found = true; break; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj;
        if (!ok(ni, nj)) continue; if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const nid = nj * W + ni, ng = g[id] + (di && dj ? 1.4142 : 1) + (extra ? extra(a.x0 + ni * a.cell + a.cell / 2, a.y0 + nj * a.cell + a.cell / 2) : 0);
        if (ng < g[nid]) { g[nid] = ng; came[nid] = id; open.push([ng + hfn(ni, nj), ni, nj]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let id = gj * W + gi; id !== -1; id = came[id]) cells.push({ x: a.x0 + (id % W) * a.cell + a.cell / 2, y: a.y0 + Math.floor(id / W) * a.cell + a.cell / 2 });
    cells.reverse(); cells[cells.length - 1] = goal;
    const out = []; let cur = from, k = 0;
    while (k < cells.length) {
      let far = k; for (let m = cells.length - 1; m > k; m--) if (this.los(cur.x, cur.y, cells[m].x, cells[m].y, r)) { far = m; break; }
      out.push(cells[far]); cur = cells[far]; k = far + 1;
    }
    return out;
  }
}

// ---------------------------------------------------------------- units
let NEXT_ID = 1;
export class Unit {
  constructor(world, type, owner, x, y, facing) {
    const s = STATS.units[type];
    if (!s) throw new Error('unknown unit ' + type);
    this.id = NEXT_ID++; this.type = type; this.s = s; this.owner = owner; this.color = owner;
    this.x = x; this.y = y; this.facing = facing ?? 270;
    this.maxHp = +s.hp; this.hp = this.maxHp; this.regen = +s.regenhp || 0;
    this.mana = +s.mana0 || 0; this.maxMana = +s.manan || 0;
    this.baseSpeed = +s.spd || 0; this.coll = +s.collision || 0;
    this.fly = s.movetp === 'fly';
    this.turn = (+s.turnrate || 0.5) * 32 / DEG; // deg per second
    this.abils = String(s.abillist || '').split(',').filter(Boolean);
    this.acquire = +s.acquire || 0;
    this.order = null; this.paused = false; this.invuln = this.abils.includes('Avul');
    this.dead = false; this.removed = false; this.exploded = false;
    this.cd = 0; this.atk = null; this.cast = null; this.path = null;
    this.lastActive = -1e9; this.invisible = false; this.speedMul = 1; this.purgeEnd = -1; this.purgeStart = -1; this.pauseUntil = -1;
    this.moving = false; this.vx = 0; this.vy = 0; this.inRects = new Set(); this.acqT = 0;
    this.abCd = {}; this.immoT = 0; this.flags = {};
    this.born = world.t;
  }
  get alive() { return !this.dead && !this.removed; }
  get speed() { return this.baseSpeed * this.speedMul; }
  get hasAttack() { return (+this.s.dmgplus1 > 0 || +this.s.dice1 > 0) && this.s.weaptp1 && this.s.targs1; }
  isEnemy(o) { return isEnemy(this.owner, o.owner); }
}
export function isEnemy(a, b) {
  if (a === b) return false;
  if (a === P_NEUTRAL || b === P_NEUTRAL) return false;
  return true; // every player is unallied in Uther Party (Next Event)
}

// ---------------------------------------------------------------- triggers
export class Trigger {
  constructor(world, name, action, opts = {}) {
    this.world = world; this.name = name; this.action = action; this.cond = opts.cond || null;
    this.enabled = opts.enabled ?? true; this.execCount = 0; this.events = [];
  }
  enable() { this.enabled = true; return this; }
  disable() { this.enabled = false; return this; }
  execute(ev = {}) { this.execCount++; return this.world.spawn(this.action, { ...ev, trig: this }); }
  conditional(ev = {}) { if (this.cond && !this.cond({ ...ev, trig: this })) return; return this.execute(ev); }
  fire(ev) { if (!this.enabled) return; if (this.cond && !this.cond({ ...ev, trig: this })) return; this.execute(ev); }
  every(period) { this.world.periodics.push({ trig: this, period, next: Math.ceil((this.world.t + 1e-9) / period) * period || period }); return this; }
  once(after) { this.world.periodics.push({ trig: this, period: 0, next: this.world.t + after }); return this; }
  on(kind, filter) { this.world.handlers.push({ kind, trig: this, filter }); return this; }
}

// ---------------------------------------------------------------- world
export class World {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.t = 0; this.tick = 0;
    this.units = []; this.missiles = []; this.areas = []; this.fx = [];
    this.threads = []; this.periodics = []; this.handlers = [];
    this.grid = new Grid(this);
    this.tod = 12; this.todRunning = false; this.todScale = 1; this.nightFx = 0; this.nightSince = -1e9; this.daySince = -1e9;
    this.timer = { remaining: 0, running: false, label: '' };
    this.quake = 0;
    this.texts = [];
  }
  get dest() { return this.grid.dest; }
  emit(e) { e.t = this.t; this.fx.push(e); }

  // ---- threads (JASS waits). Generators yield seconds; yield 0 = next frame.
  spawn(fn, ev) {
    if (!fn) return;
    const r = fn(ev);
    if (r && typeof r.next === 'function') { const th = { gen: r, wake: this.t, alive: true }; this.step(th); if (th.alive) this.threads.push(th); return th; }
    return null;
  }
  step(th) {
    let res;
    try { res = th.gen.next(); } catch (e) { th.alive = false; console.error(e); return; }
    if (res.done) { th.alive = false; return; }
    const w = +res.value || 0;
    th.wake = this.t + (w <= 0 ? DT * 0.5 : w);
  }
  trigger(name, action, opts) { return new Trigger(this, name, action, opts); }
  dispatch(kind, ev) {
    for (const h of this.handlers.slice()) if (h.kind === kind && (!h.filter || h.filter(ev))) h.trig.fire(ev);
  }

  // ---- units
  create(type, owner, p, facing = 270) {
    const u = new Unit(this, type, owner, p.x, p.y, facing);
    // units are placed at the nearest valid spot, as WC3 does
    if (!u.fly && u.baseSpeed > 0) { const w = this.grid.nearestWalkable(p.x, p.y, u.coll); if (w) { u.x = w.x; u.y = w.y; } }
    this.units.push(u); this.lastCreated = u;
    this.emit({ k: 'spawn', id: u.id });
    return u;
  }
  remove(u) { if (u.removed) return; u.removed = true; this.emit({ k: 'remove', id: u.id, x: u.x, y: u.y }); }
  kill(u, killer = null) {
    if (!u.alive) return;
    u.hp = 0; u.dead = true; u.order = null; u.atk = null; u.cast = null;
    this.emit({ k: 'death', id: u.id, type: u.type, x: u.x, y: u.y, exploded: u.exploded, owner: u.owner });
    if (u.abils.includes('Adda')) this.deathDamage(u);
    this.dispatch('death', { unit: u, killer });
  }
  explode(u) { if (!u || !u.alive) return; u.exploded = true; this.kill(u); }
  damage(src, u, amount, atype = 'normal', isSpell = false) {
    if (!u.alive || u.invuln || amount <= 0) return 0;
    const ai = ARMOR[u.s.deftype] ?? 1;
    let d = amount * ((DMG[atype] || DMG.normal)[ai]);
    if (!isSpell) { const a = +u.s.def || 0; d *= a >= 0 ? 1 - (a * DEFENSE_ARMOR) / (1 + DEFENSE_ARMOR * a) : 2 - Math.pow(0.94, -a); }
    if (u.oneHit) d = u.hp + 1;
    u.hp -= d; this.emit({ k: 'hit', id: u.id, d });
    if (u.hp <= 0.405) this.kill(u, src); // WC3 units die below 0.405 life
    return d;
  }
  setLife(u, v) { if (!u.alive) return; u.hp = Math.min(v, u.maxHp); if (u.hp <= 0.405) this.kill(u); }
  alive(filter) { return this.units.filter((u) => u.alive && (!filter || filter(u))); }
  ofType(t) { return this.alive((u) => u.type === t); }
  ofPlayer(p) { return this.alive((u) => u.owner === p); }
  inRange(p, r, filter) { return this.alive((u) => Math.hypot(u.x - p.x, u.y - p.y) <= r && (!filter || filter(u))); }
  pick(list) { return this.rng.pick(list); }
  randomIn(r) { return { x: this.rng.real(r.x0, r.x1), y: this.rng.real(r.y0, r.y1) }; }
  pauseAll(flag) { for (const u of this.alive()) u.paused = flag; }

  // ---- orders
  issue(u, order) {
    if (!u || !u.alive) return false;
    if (u.paused || this.t < u.pauseUntil) return false;
    if (order.type === 'cast' && !this.canCast(u, order.abil, order.target)) return false;
    if (order.type === 'smart') {
      const tg = order.target;
      if (tg && u.hasAttack && u.isEnemy(tg) && this.canTarget(u, tg)) order = { type: 'attack', target: tg };
      else if (tg) order = { type: 'move', x: tg.x, y: tg.y, follow: tg, smart: true, target: tg };
    }
    u.order = order; u.path = null; u.atk = null; u.cast = null;
    if (order.type === 'move' || order.type === 'patrol' || order.type === 'steer') u.lastActive = this.t;
    if (order.type === 'steer') { u.order = order; return true; }
    if (order.type === 'stop') u.order = null;
    const kind = order.target ? 'orderTarget' : (order.type === 'stop' ? 'orderImmediate' : 'orderPoint');
    this.dispatch(kind, { unit: u, order: order.type === 'cast' ? order.abil : order.type, target: order.target || null, x: order.x, y: order.y });
    return true;
  }
  canTarget(u, t) {
    if (!t.alive || t.invisible) return false;
    const tg = String(u.s.targs1 || '');
    if (t.invuln && !tg.includes('invulnerable')) return false;
    if (t.fly) return tg.includes('air');
    return tg.includes('ground') || tg.includes('organic');
  }
  canCast(u, abil, target) {
    if (!u.abils.includes(abil)) return false;
    if ((u.abCd[abil] || 0) > this.t) return false;
    const A = ABIL[abil];
    if (A.cost && u.mana < A.cost) return false;
    if (!target || target === u || !target.alive) return false;
    if (abil === 'ACtb') {
      const tg = A.targs;
      if (target.invuln && !tg.includes('invulnerable')) return false;
      if (target.s.type && /Mechanical/.test(target.s.type) && !target.s.type.includes('organic')) { /* towers etc are structures */ }
      if (+target.s.spd === 0) return false; // structures are not in the target list
      const rel = isEnemy(u.owner, target.owner) || target.owner === P_NEUTRAL;
      if (!rel) return false;
    }
    if (abil === 'A007') { if (!isEnemy(u.owner, target.owner)) return false; }
    return true;
  }

  // ---- effects
  splash(src, x, y, base, s, { tree = true } = {}) {
    const full = +s.farea1, med = +s.harea1, small = +s.qarea1, hf = +s.hfact1, qf = +s.qfact1;
    for (const u of this.alive((u) => !u.fly)) {
      const d = Math.hypot(u.x - x, u.y - y) - u.coll * 0.5;
      let f = 0; if (d <= full) f = 1; else if (d <= med) f = hf; else if (d <= small) f = qf;
      if (f > 0) this.damage(src, u, base * f, s.atktype1);
    }
    if (tree) for (const d of this.grid.dest) {
      if (!d.alive || d.type !== 'tree') continue;
      const r = Math.hypot(d.x - x, d.y - y); let f = 0;
      if (r <= full) f = 1; else if (r <= med) f = hf; else if (r <= small) f = qf;
      if (f > 0) { d.life -= base * f; if (d.life <= 0) { d.alive = false; this.grid.dirty = true; this.emit({ k: 'tree', x: d.x, y: d.y, alive: false }); } }
    }
  }
  rollDamage(s) { let d = +s.dmgplus1; for (let i = 0; i < (+s.dice1 || 0); i++) d += this.rng.int(1, +s.sides1 || 1); return d; }
  deathDamage(u) {
    const A = ABIL.Adda, x = u.x, y = u.y, src = u;
    this.spawn(function* (w) { yield A.delay; w.emit({ k: 'boom', x, y, r: A.partR });
      for (const t of w.alive((t) => !t.fly)) { const d = Math.hypot(t.x - x, t.y - y); if (d <= A.fullR) w.damage(src, t, A.fullD, 'spells', true); else if (d <= A.partR) w.damage(src, t, A.partD, 'spells', true); }
    }.bind(null, this));
  }
  fireArea(x, y, owner) {
    const A = ABIL.Abof; this.areas.push({ k: 'oil', x, y, r: A.area, end: this.t + A.dur, next: this.t + A.interval, owner });
    this.emit({ k: 'oil', x, y, r: A.area, dur: A.dur });
  }
  restoreDestructables(r) {
    for (const d of this.grid.dest) if (d.x >= r.x0 && d.x <= r.x1 && d.y >= r.y0 && d.y <= r.y1) { if (!d.alive) this.emit({ k: d.type === 'tree' ? 'tree' : 'dest', x: d.x, y: d.y, alive: true }); d.alive = true; d.life = d.maxLife; }
    this.grid.dirty = true;
  }
  lob(src, x, y, { speed = 400, arc = 0.35, type = 'ncat', onImpact } = {}) {
    const d = Math.hypot(x - src.x, y - src.y);
    const m = { id: NEXT_ID++, kind: 'art', src, owner: src.owner, x0: src.x, y0: src.y, x: src.x, y: src.y, tx: x, ty: y, z: 0, arc, life: 0, dur: Math.max(0.05, d / speed), dmg: 0, s: src.s, type, onImpact };
    this.missiles.push(m); return m;
  }
  shoot(src, target, { speed = 900, type = 'boulder', onHit } = {}) {
    const m = { id: NEXT_ID++, kind: 'home', src, owner: src.owner, x: src.x, y: src.y, z: 60, target, speed, dmg: 0, s: src.s, type, onHit };
    this.missiles.push(m); return m;
  }
  // destroy / restore a destructible (gates, walls, trees); pathing updates next tick
  setDest(d, alive) { if (d.alive === alive) return; d.alive = alive; if (alive) d.life = d.maxLife; this.grid.dirty = true; this.emit({ k: d.type === 'tree' ? 'tree' : 'dest', x: d.x, y: d.y, alive }); }
  destIn(r) { return this.grid.dest.filter((d) => d.x >= r.x0 && d.x <= r.x1 && d.y >= r.y0 && d.y <= r.y1); }
  isNight() { return this.tod < DAWN || this.tod >= DUSK; }

  // ---------------------------------------------------------------- tick
  update() {
    const t0 = this.t; this.t += DT; this.tick++;
    if (this.grid.dirty) this.grid.rebuild();
    // time of day
    if (this.todRunning) {
      const prev = this.tod; this.tod += (DT * 24 / DAY_LENGTH) * this.todScale; if (this.tod >= 24) this.tod -= 24;
      const wasNight = prev < DAWN || prev >= DUSK; if (wasNight !== this.isNight()) { if (this.isNight()) this.nightSince = this.t; else this.daySince = this.t; }
      for (const h of this.handlers) if (h.kind === 'tod' && prev < h.filter && this.tod >= h.filter) h.trig.fire({});
    }
    // timer
    if (this.timer.running) { this.timer.remaining -= DT; if (this.timer.remaining <= 0) { this.timer.remaining = 0; this.timer.running = false; this.dispatch('timer', {}); } }
    // periodic triggers
    for (const p of this.periodics.slice()) {
      if (this.t + 1e-9 >= p.next) {
        if (p.period > 0) p.next += p.period; else this.periodics.splice(this.periodics.indexOf(p), 1);
        if (p.trig.enabled) p.trig.fire({});
      }
    }
    // threads
    for (const th of this.threads) if (th.alive && this.t + 1e-9 >= th.wake) this.step(th);
    this.threads = this.threads.filter((t) => t.alive);
    // units
    for (const u of this.units) if (u.alive) this.updateUnit(u);
    this.separate();
    // missiles
    for (const m of this.missiles) this.updateMissile(m);
    this.missiles = this.missiles.filter((m) => !m.done);
    // ground areas (burning oil)
    for (const a of this.areas) {
      if (this.t >= a.next && this.t <= a.end) { a.next += ABIL.Abof.interval; for (const u of this.inRange(a, a.r, (u) => !u.fly)) this.damage(null, u, ABIL.Abof.dmg, 'spells', true); }
    }
    this.areas = this.areas.filter((a) => this.t <= a.end);
    // enter-rect events
    const rectHandlers = this.handlers.filter((h) => h.kind === 'enter');
    if (rectHandlers.length) for (const u of this.units) {
      if (!u.alive) continue;
      for (const h of rectHandlers) {
        const r = h.rect, inside = inRect(r, u), key = h.trig.name + '|' + r.x0 + ',' + r.y0;
        if (inside && !u.inRects.has(key)) { u.inRects.add(key); h.trig.fire({ unit: u }); }
        else if (!inside) u.inRects.delete(key);
      }
    }
    if (this.quake > 0) this.quake = Math.max(0, this.quake - 50 * (DT / 0.05));
    this.units = this.units.filter((u) => u.alive || this.t - (u.deathT ??= this.t) < 0.1);
  }

  updateUnit(u) {
    // regeneration
    if (u.regen > 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.regen * DT);
    // purge slow (movement returns over the duration in N steps)
    if (u.purgeEnd > this.t) { const A = ABIL.A007, k = Math.floor((this.t - u.purgeStart) / (A.dur / A.steps)); u.speedMul = Math.min(1, k / A.steps); } else u.speedMul = 1;
    // shadowmeld (Sshm): invisible at night when the unit has been still for the action duration + fade
    if (u.abils.includes('Sshm')) {
      const A = ABIL.Sshm, nightOk = this.isNight() ? this.t - this.nightSince >= A.dayNight || this.nightSince < 0 : this.t - this.daySince < A.dayNight;
      const was = u.invisible; u.invisible = nightOk && this.t - u.lastActive >= A.action + A.fade;
      if (was !== u.invisible) this.emit({ k: 'meld', id: u.id, on: u.invisible });
    }
    // permanent immolation
    if (u.abils.includes('ANpi')) {
      u.immoT += DT; const A = ABIL.ANpi;
      if (u.immoT >= A.interval) { u.immoT -= A.interval; for (const t of this.inRange(u, A.area, (t) => !t.fly && t.isEnemy(u) && t !== u)) this.damage(u, t, A.dmg, 'spells', true); }
    }
    u.moving = false; u.vx = 0; u.vy = 0;
    if (u.paused || this.t < u.pauseUntil) return;
    if (u.cd > 0) u.cd -= DT;
    const o = u.order;
    // auto acquire for idle units
    if (!o && u.hasAttack && u.acquire > 0) {
      u.acqT -= DT;
      if (u.acqT <= 0) {
        u.acqT = 0.25;
        let best = null, bd = 1e9;
        for (const t of this.units) {
          if (!t.alive || !u.isEnemy(t) || !this.canTarget(u, t)) continue;
          const d = dist(u, t); if (d > u.acquire || d >= bd) continue;
          if (u.baseSpeed === 0 && d > +u.s.rangen1 + t.coll) continue;
          if (u.baseSpeed > 0 && !this.grid.los(u.x, u.y, t.x, t.y, 1)) continue;
          best = t; bd = d;
        }
        if (best) u.order = { type: 'attack', target: best, auto: true, home: { x: u.x, y: u.y } };
      }
    }
    if (!u.order) return;
    const ord = u.order;
    switch (ord.type) {
      case 'move': {
        if (ord.follow && ord.follow.alive) { ord.x = ord.follow.x; ord.y = ord.follow.y; }
        if (this.moveTo(u, ord, ord.follow ? u.coll + ord.follow.coll + 8 : 4)) u.order = null;
        break;
      }
      case 'patrol': {
        const tgt = ord.leg ? ord.b : ord.a;
        if (this.moveTo(u, { x: tgt.x, y: tgt.y }, 4, true)) { ord.leg = !ord.leg; u.path = null; }
        break;
      }
      case 'steer': this.steer(u, ord.dx, ord.dy); break;
      case 'attackground': this.attackPoint(u, ord); break;
      case 'attack': this.attackUnit(u, ord); break;
      case 'cast': this.doCast(u, ord); break;
    }
  }
  faceTo(u, ang) {
    if (u.baseSpeed === 0 && /Mechanical/.test(u.s.type) && !u.s.spd) { u.facing = ang; return true; }
    const d = angDiff(u.facing, ang), step = u.turn * DT;
    if (Math.abs(d) <= step) { u.facing = ang; return true; }
    u.facing += Math.sign(d) * step; return Math.abs(d) < 5;
  }
  moveTo(u, p, arrive, noPathCache) {
    if (u.baseSpeed <= 0) return true;
    const dx0 = p.x - u.x, dy0 = p.y - u.y;
    if (Math.hypot(dx0, dy0) <= arrive) { u.path = null; return true; }
    if (u.fly) return this.advance(u, p.x, p.y, arrive);
    if (!u.path || u.pathGoal?.x !== p.x || u.pathGoal?.y !== p.y || (this.tick + u.id) % 40 === 0) {
      u.path = this.grid.path(u, p, u.coll) || [];
      u.pathGoal = { x: p.x, y: p.y };
      if (!u.path.length) return true;
    }
    const wp = u.path[0];
    if (!wp) return true;
    const last = u.path.length === 1;
    if (this.advance(u, wp.x, wp.y, last ? arrive : 6)) { u.path.shift(); if (!u.path.length) return true; }
    return false;
  }
  advance(u, tx, ty, arrive) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= arrive) return true;
    const ang = Math.atan2(dy, dx) / DEG;
    this.faceTo(u, ang);
    const diff = Math.abs(angDiff(u.facing, ang));
    if (diff > 90) return false;
    const sp = u.speed * DT * Math.max(0, Math.cos(diff * DEG));
    const step = Math.min(sp, d);
    this.place(u, u.x + (dx / d) * step, u.y + (dy / d) * step);
    return Math.hypot(tx - u.x, ty - u.y) <= arrive;
  }
  steer(u, dx, dy) {
    const m = Math.hypot(dx, dy); if (m < 0.01) { u.order = null; return; }
    const ang = Math.atan2(dy, dx) / DEG;
    this.faceTo(u, ang);
    const sp = u.speed * DT * Math.min(1, m);
    this.place(u, u.x + (dx / m) * sp, u.y + (dy / m) * sp);
  }
  place(u, nx, ny) {
    const ox = u.x, oy = u.y;
    if (u.fly || this.grid.walkable(nx, ny, u.coll)) { u.x = nx; u.y = ny; }
    else if (this.grid.walkable(nx, u.y, u.coll)) u.x = nx;
    else if (this.grid.walkable(u.x, ny, u.coll)) u.y = ny;
    const mx = u.x - ox, my = u.y - oy;
    if (mx || my) { u.moving = true; u.vx = mx / DT; u.vy = my / DT; u.lastActive = this.t; }
  }
  separate() {
    const us = this.units.filter((u) => u.alive && !u.fly && u.coll > 0);
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j]; const ma = a.baseSpeed > 0 && !a.paused, mb = b.baseSpeed > 0 && !b.paused;
      if (!ma && !mb) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.coll + b.coll; // WC3 collision size is a radius
      if (d >= min) continue;
      const push = (min - d), nx = dx / d, ny = dy / d;
      // the unit that is walking yields to the one standing still (so nobody gets shoved into danger)
      const oa = !!a.order, ob = !!b.order;
      const wa = ma && mb ? (oa === ob ? 0.5 : oa ? 1 : 0) : ma ? 1 : 0, wb = 1 - wa;
      if (wa) { const x = a.x - nx * push * wa, y = a.y - ny * push * wa; if (this.grid.walkable(x, y, a.coll)) { a.x = x; a.y = y; } }
      if (wb) { const x = b.x + nx * push * wb, y = b.y + ny * push * wb; if (this.grid.walkable(x, y, b.coll)) { b.x = x; b.y = y; } }
    }
  }
  attackPoint(u, ord) {
    const s = u.s, d = dist(u, ord);
    if (d < +s.minrange) return; // too close for artillery
    if (d > +s.rangen1) { this.moveTo(u, ord, +s.rangen1 - 10); return; }
    this.swing(u, ord.x, ord.y, null);
  }
  attackUnit(u, ord) {
    const t = ord.target, s = u.s;
    if (!t || !t.alive || !this.canTarget(u, t)) { u.order = null; u.atk = null; return; }
    if (ord.auto && u.baseSpeed > 0 && dist(u, ord.home) > 600) { u.order = { type: 'move', x: ord.home.x, y: ord.home.y }; return; }
    const reach = +s.rangen1 + t.coll + u.coll * 0.5;
    if (dist(u, t) > reach) { if (u.baseSpeed === 0) { u.order = null; return; } u.atk = null; this.moveTo(u, { x: t.x, y: t.y }, reach - 4); return; }
    this.swing(u, t.x, t.y, t);
  }
  swing(u, x, y, target) {
    const s = u.s;
    const ready = this.faceTo(u, angleTo(u, { x, y }));
    if (!u.atk) { if (u.cd > 0 || !ready) return; u.atk = { t: 0 }; u.lastActive = this.t; this.emit({ k: 'swing', id: u.id }); }
    u.atk.t += DT;
    if (u.atk.t >= +s.dmgpt1) {
      u.atk = null; u.cd = +s.cool1;
      const dmg = this.rollDamage(s);
      const w = s.weaptp1;
      if (w === 'artillery') {
        const sp = +s.missilespeed_1, d = Math.hypot(x - u.x, y - u.y);
        this.missiles.push({ id: NEXT_ID++, kind: 'art', src: u, owner: u.owner, x0: u.x, y0: u.y, x: u.x, y: u.y, tx: x, ty: y, z: 0, arc: +s.missilearc_1, life: 0, dur: Math.max(0.05, d / sp), dmg, s, oil: u.abils.includes('Abof'), type: u.type });
      } else if (w === 'missile' || w === 'msplash') {
        this.missiles.push({ id: NEXT_ID++, kind: 'home', src: u, owner: u.owner, x: u.x, y: u.y, z: 60, target, speed: +s.missilespeed_1, dmg, s, type: u.type });
      } else if (target) this.damage(u, target, dmg, s.atktype1);
    }
  }
  doCast(u, ord) {
    const A = ABIL[ord.abil], t = ord.target;
    if (!t || !t.alive) { u.order = null; u.cast = null; return; }
    const d = dist(u, t);
    if (d > A.range) { this.moveTo(u, t, A.range - 10); return; }
    const ready = this.faceTo(u, angleTo(u, t));
    if (!u.cast) { if (!ready) return; u.cast = { t: 0 }; this.emit({ k: 'cast', id: u.id, abil: ord.abil }); }
    u.cast.t += DT; u.lastActive = this.t;
    if (u.cast.t >= (+u.s.castpt || 0)) {
      u.cast = null; u.order = null;
      if (A.cost) u.mana -= A.cost; if (A.cool) u.abCd[ord.abil] = this.t + A.cool;
      if (ord.abil === 'ACtb') this.missiles.push({ id: NEXT_ID++, kind: 'home', src: u, owner: u.owner, x: u.x, y: u.y, z: 60, target: t, speed: A.missile, dmg: A.dmg, spell: true, type: 'boulder' });
      if (ord.abil === 'A007') { const P = ABIL.A007; t.pauseUntil = this.t + P.pause; t.purgeStart = this.t; t.purgeEnd = this.t + P.dur; t.order = null; this.emit({ k: 'purge', id: t.id, src: u.id }); }
      this.dispatch('spell', { unit: u, abil: ord.abil, target: t });
    }
  }
  updateMissile(m) {
    if (m.kind === 'art') {
      m.life += DT; const k = Math.min(1, m.life / m.dur);
      m.x = m.x0 + (m.tx - m.x0) * k; m.y = m.y0 + (m.ty - m.y0) * k;
      const dd = Math.hypot(m.tx - m.x0, m.ty - m.y0); m.z = 4 * m.arc * dd * k * (1 - k) + 40;
      if (k >= 1) { m.done = true; if (m.onImpact) { m.onImpact(m); return; } this.emit({ k: 'impact', x: m.tx, y: m.ty, type: m.type, r: +m.s.qarea1 }); this.splash(m.src, m.tx, m.ty, m.dmg, m.s); if (m.oil) this.fireArea(m.tx, m.ty, m.owner); }
    } else {
      const t = m.target; if (!t) { m.done = true; return; }
      const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy), st = m.speed * DT;
      m.prog = (m.prog || 0); m.total ??= d;
      if (d <= st) {
        m.done = true; m.x = t.x; m.y = t.y;
        if (m.onHit) { m.onHit(m, t); return; }
        if (t.alive) { if (m.spell) this.damage(m.src, t, m.dmg, 'spells', true); else this.damage(m.src, t, m.dmg, m.s.atktype1); }
        this.emit({ k: 'impact', x: t.x, y: t.y, type: m.type, r: 40 });
      } else { m.x += (dx / d) * st; m.y += (dy / d) * st; m.prog += st; const k = m.prog / (m.prog + d); m.z = 60 + (m.type === 'boulder' ? 4 * 0.3 * m.total * k * (1 - k) : 0); }
    }
  }
}
