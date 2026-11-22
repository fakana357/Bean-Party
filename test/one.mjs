// Run one minigame module with bots: node test/one.mjs js/sim/games/<file>.js [runs] [players]
import { Party } from '../js/sim/party.js';
const file = process.argv[2], runs = +(process.argv[3] || 3), n = +(process.argv[4] || 8);
const g = (await import('../' + file)).default;
for (let r = 0; r < runs; r++) {
  const players = Array.from({ length: n }, (_, i) => ({ slot: i + 1, name: 'Bot' + (i + 1), bot: true }));
  const p = new Party({ seed: 100 + r, players, only: g.num, games: [g] });
  p.start();
  const log = []; let err = null;
  const orig = console.error; console.error = (e) => { err = err || e; };
  while (p.w.t < 400 && p.v.gamesPlayed < 1) { p.update(); for (const e of p.events.splice(0)) if (['out', 'finish', 'result'].includes(e.k)) log.push(`${e.t.toFixed(1)} ${e.k}${e.slot ? ' P' + e.slot : ''}${e.pts ? ' +' + e.pts : ''}${e.kind ? ' ' + e.kind : ''}`); p.w.fx.length = 0; }
  console.error = orig;
  console.log(`run ${r}: ${p.v.gamesPlayed ? 'ended' : 'TIMEOUT'} at ${p.w.t.toFixed(1)}s | scores ${p.scores.slice(1, n + 1).join(' ')}${err ? ' | ERROR ' + (err.stack || err) : ''}`);
  console.log('   ' + log.join(' · '));
}
