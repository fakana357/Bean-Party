// node test/trace.mjs <file> [players] [every] [maxT]
import { Party } from '../js/sim/party.js';
const g = (await import('../' + process.argv[2])).default;
const n = +(process.argv[3] || 3), every = +(process.argv[4] || 4), maxT = +(process.argv[5] || 100);
const players = Array.from({ length: n }, (_, i) => ({ slot: i + 1, bot: true }));
const p = new Party({ seed: 300, players, only: g.num, games: [g] }); p.start();
let nx = 0;
while (p.w.t < maxT && p.v.gamesPlayed < 1) {
  p.update();
  for (const e of p.events.splice(0)) if (['out', 'finish', 'result'].includes(e.k)) console.log(p.w.t.toFixed(1), e.k, e.slot ?? '', e.text ?? '');
  for (const e of p.w.fx.splice(0)) if (e.k === 'death' && e.owner <= 8) console.log(p.w.t.toFixed(1), 'death', e.type, e.x | 0, e.y | 0);
  if (p.w.t > nx) { nx += every; console.log(p.w.t.toFixed(0), p.G.beans().map((u) => `${u.owner}:${u.x | 0},${u.y | 0}${u.order ? ' ' + u.order.type : ''}`).join(' | ')); }
}
