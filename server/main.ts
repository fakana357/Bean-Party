// Bean Party room server (Deno / Deno Deploy).
// Serves the game files and runs lobbies + lockstep relay: every client runs the
// same deterministic simulation; the server only stamps player inputs with the
// tick they apply on and sends the tick stream to everyone in the room.
//
//   deno run -A server/main.ts            (http://localhost:8000)
//   PORT=9000 deno run -A server/main.ts
//
// Rooms live in this process's memory (one instance). On Deno Deploy keep the
// project to a single region so all friends land on the same instance.

const TICK_MS = 25; // must match DT in js/sim/engine.js (1/40 s)
const SEND_EVERY = 2; // ticks per frame message
const HOLD_MAX = 20000; // a client may pause the tick clock (intro) at most this long

type Skin = { pattern: string; main: string; accent: string; emoji: string };
type Client = { id: number; ws: WebSocket; name: string; skin: Skin; room: Room | null; slot: number; holding: boolean; holdSince: number; over: boolean };
type Cmd = [number, number, unknown]; // [tick, slot, cmd]
type Room = {
  id: string; name: string; password: string; games: number; host: Client | null;
  members: Client[]; state: 'lobby' | 'game';
  seed: number; tick: number; clock: number; pending: Cmd[]; timer?: ReturnType<typeof setInterval>;
  votes: Set<number>; round: number; hashes: Map<number, Map<number, string>>; overAt: number;
};

const rooms = new Map<string, Room>();
const lobby = new Set<Client>();
let nextId = 1;

const send = (c: Client, m: unknown) => { try { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); } catch { /* gone */ } };
const roomInfo = (r: Room) => ({ id: r.id, name: r.name, locked: !!r.password, players: r.members.length, max: 8, state: r.state, games: r.games });
const roster = (r: Room) => r.members.map((m) => ({ slot: m.slot, name: m.name, skin: m.skin, host: m === r.host }));
const pushRooms = () => { const list = [...rooms.values()].map(roomInfo); for (const c of lobby) send(c, { t: 'rooms', rooms: list }); };
const pushRoom = (r: Room) => { for (const m of r.members) send(m, { t: 'room', room: { ...roomInfo(r), host: r.host?.slot ?? 0, players: roster(r) }, you: m.slot }); };
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function newRoomId() { let id = ''; do id = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); while (rooms.has(id)); return id; }

function join(c: Client, r: Room) {
  leave(c);
  const used = new Set(r.members.map((m) => m.slot));
  const slot = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => !used.has(s));
  if (!slot) return send(c, { t: 'error', text: 'Room is full' });
  c.room = r; c.slot = slot; c.holding = false; c.over = false;
  r.members.push(c); r.members.sort((a, b) => a.slot - b.slot);
  if (!r.host) r.host = c;
  lobby.delete(c);
  pushRoom(r); pushRooms();
}

function leave(c: Client) {
  const r = c.room; if (!r) return;
  r.members = r.members.filter((m) => m !== c);
  c.room = null;
  if (r.state === 'game') queue(r, 0, { k: 'leave', slot: c.slot });
  if (r.host === c) r.host = r.members[0] ?? null;
  if (!r.members.length) { clearInterval(r.timer); rooms.delete(r.id); }
  else { pushRoom(r); checkVotes(r); }
  lobby.add(c); pushRooms();
}

function queue(r: Room, slot: number, cmd: unknown) { r.pending.push([r.tick + 1, slot, cmd]); }

function start(r: Room) {
  if (r.state === 'game' || !r.members.length) return;
  r.state = 'game'; r.seed = (Math.random() * 2 ** 31) | 0; r.tick = 0; r.pending = []; r.votes = new Set(); r.round = 0; r.hashes = new Map(); r.overAt = 0;
  for (const m of r.members) { m.holding = false; m.over = false; }
  for (const m of r.members) send(m, { t: 'start', seed: r.seed, games: r.games, players: roster(r), you: m.slot });
  r.clock = performance.now();
  clearInterval(r.timer);
  r.timer = setInterval(() => step(r), TICK_MS);
  pushRooms();
}

function backToLobby(r: Room) {
  clearInterval(r.timer); r.timer = undefined; r.state = 'lobby';
  for (const m of r.members) send(m, { t: 'lobby' });
  pushRoom(r); pushRooms();
}

function step(r: Room) {
  const now = performance.now();
  // a client watching the intro holds the clock (everyone sees the same intro, then plays from the same tick)
  const holders = r.members.filter((m) => m.holding && now - m.holdSince < HOLD_MAX);
  if (holders.length) { r.clock = now; return; }
  const due = Math.min(20, Math.floor((now - r.clock) / TICK_MS));
  if (due < SEND_EVERY) return;
  r.clock += due * TICK_MS;
  const from = r.tick + 1;
  r.tick += due;
  const cmds = r.pending.filter((p) => p[0] <= r.tick).map((p) => [Math.max(p[0], from), p[1], p[2]]);
  r.pending = r.pending.filter((p) => p[0] > r.tick);
  const msg = JSON.stringify({ t: 'f', a: from, n: due, c: cmds });
  for (const m of r.members) { try { if (m.ws.readyState === WebSocket.OPEN) m.ws.send(msg); } catch { /* gone */ } }
  if (r.overAt && now > r.overAt) backToLobby(r);
}

function checkVotes(r: Room) {
  if (r.state !== 'game') return;
  const need = Math.floor(r.members.length / 2) + 1;
  for (const m of r.members) send(m, { t: 'votes', n: r.votes.size, need, round: r.round });
  if (r.votes.size >= need) { queue(r, 0, { k: 'skip', r: r.round }); r.votes = new Set(); for (const m of r.members) send(m, { t: 'votes', n: 0, need, round: r.round, skipped: true }); }
}

function onMessage(c: Client, m: any) {
  const r = c.room;
  switch (m.t) {
    case 'hello': c.name = clean(m.name, 16) || 'Bean'; if (m.skin && typeof m.skin === 'object') c.skin = { pattern: clean(m.skin.pattern, 12), main: clean(m.skin.main, 9), accent: clean(m.skin.accent, 9), emoji: clean(m.skin.emoji, 8) }; if (!r) { lobby.add(c); pushRooms(); } else pushRoom(r); break;
    case 'create': {
      const games = [8, 20, 52].includes(+m.games) ? +m.games : 8;
      const room: Room = { id: newRoomId(), name: clean(m.name, 24) || `${c.name}'s room`, password: clean(m.password, 24), games, host: null, members: [], state: 'lobby', seed: 0, tick: 0, clock: 0, pending: [], votes: new Set(), round: 0, hashes: new Map(), overAt: 0 };
      rooms.set(room.id, room); join(c, room); break;
    }
    case 'join': {
      const room = rooms.get(String(m.id));
      if (!room) return send(c, { t: 'error', text: 'Room not found' });
      if (room.state !== 'lobby') return send(c, { t: 'error', text: 'Game already running' });
      if (room.password && room.password !== String(m.password ?? '')) return send(c, { t: 'error', text: 'Wrong password', code: 'password' });
      join(c, room); break;
    }
    case 'leave': leave(c); break;
    case 'settings': if (r && r.host === c && r.state === 'lobby' && [8, 20, 52].includes(+m.games)) { r.games = +m.games; pushRoom(r); pushRooms(); } break;
    case 'start': if (r && r.host === c) start(r); break;
    case 'in': if (r && r.state === 'game' && m.c && typeof m.c === 'object') queue(r, c.slot, m.c); break;
    case 'hold': if (r) { c.holding = !!m.on; c.holdSince = performance.now(); } break;
    case 'round': if (r && +m.r > r.round) { r.round = +m.r; r.votes = new Set(); checkVotes(r); } break;
    case 'vote': if (r && r.state === 'game' && +m.r === r.round) { r.votes.add(c.slot); checkVotes(r); } break;
    case 'hash': if (r && r.state === 'game') {
      const n = +m.n; let at = r.hashes.get(n); if (!at) { at = new Map(); r.hashes.set(n, at); }
      at.set(c.slot, String(m.h));
      if (new Set(at.values()).size > 1) for (const x of r.members) send(x, { t: 'desync', n });
      if (r.hashes.size > 20) r.hashes.delete(Math.min(...r.hashes.keys()));
      break;
    }
    case 'over': if (r && r.state === 'game') { c.over = true; if (!r.overAt) r.overAt = performance.now() + 15000; if (r.members.every((x) => x.over)) backToLobby(r); } break;
    case 'ping': send(c, { t: 'pong', at: m.at }); break;
  }
}

const TYPES: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mjs': 'text/javascript' };
const ROOT = new URL('..', import.meta.url);

Deno.serve({ port: +(Deno.env.get('PORT') ?? 8000) }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/ws') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const c: Client = { id: nextId++, ws: socket, name: 'Bean', skin: { pattern: 'solid', main: '#ff5fa8', accent: '#ffffff', emoji: '😀' }, room: null, slot: 0, holding: false, holdSince: 0, over: false };
    socket.onmessage = (e) => { let m; try { m = JSON.parse(String(e.data)); } catch { return; } try { onMessage(c, m); } catch (err) { console.error(err); } };
    socket.onclose = () => { leave(c); lobby.delete(c); };
    return response;
  }
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  if (path.includes('..') || path.startsWith('/server/') || path.startsWith('/.git')) return new Response('not found', { status: 404 });
  try {
    const file = await Deno.readFile(new URL('.' + path, ROOT));
    const ext = path.slice(path.lastIndexOf('.'));
    return new Response(file, { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
});
