import { Party } from '../js/sim/party.js';
import { ALL_GAMES } from '../js/sim/games/index.js';
import { readFileSync } from 'fs';
const looksSrc = ['groupA', 'groupC', 'groupD', 'groupE', 'groupF', 'groupG', 'groupB'].map((f) => { try { return readFileSync(`js/client/looks/${f}.js`, 'utf8'); } catch { return ''; } }).join('\n');
const builtin = ['opeo', 'ngsp', 'hmtm', 'nsea', 'nmrl', 'ncat', 'ocat', 'ewsp', 'uzg1', 'hmtt', 'hctw', 'ncop'];
const has = (t) => builtin.includes(t) || new RegExp(`['"]?${t}['"]?\\s*[:(]`).test(looksSrc.replace(/\/\/.*$/gm, ''));
for (const g of [...ALL_GAMES].sort((a, b) => a.num - b.num)) {
  const p = new Party({ seed: 5, players: Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, bot: true })), only: g.num, games: [g] }); p.start();
  const seen = new Map();
  while (p.w.t < 60 && p.v.gamesPlayed < 1) { p.update(); p.events.length = 0; p.w.fx.length = 0; for (const u of p.w.units) if (!u.isBean && !(u.owner >= 1 && u.owner <= 8 && !u.role)) seen.set(u.type + (u.role ? '/' + u.role : ''), u.type); }
  const miss = [...seen].filter(([k, t]) => !has(t)).map(([k]) => k);
  if (miss.length) console.log(g.num, g.id, 'MISSING', miss.join(' '));
}
