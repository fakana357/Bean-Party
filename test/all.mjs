// node test/all.mjs [runs] [players] [filter]
import { Party } from '../js/sim/party.js';
import { ALL_GAMES } from '../js/sim/games/index.js';
const runs = +(process.argv[2] || 3), n = +(process.argv[3] || 6), only = process.argv[4];
const out = [];
for (const g of [...ALL_GAMES].sort((a, b) => a.num - b.num)) {
  if (only && !only.split(',').includes(g.id)) continue;
  let tot = 0, draws = 0, to = 0, errs = 0, dur = 0, outs = 0, fins = 0, firstErr = '';
  for (let r = 0; r < runs; r++) {
    const players = Array.from({ length: n }, (_, i) => ({ slot: i + 1, name: 'B' + (i + 1), bot: true }));
    let p;
    try {
      p = new Party({ seed: 300 + r * 7, players, only: g.num, games: [g] }); p.start();
      const orig = console.error; console.error = (e) => { errs++; firstErr = firstErr || String(e?.stack || e).split('\n').slice(0, 2).join(' '); };
      while (p.w.t < 400 && p.v.gamesPlayed < 1) {
        p.update();
        for (const e of p.events.splice(0)) { if (e.k === 'out') outs++; if (e.k === 'finish') fins++; if (e.k === 'result' && e.kind === 'draw') draws++; }
        p.w.fx.length = 0;
      }
      console.error = orig;
      if (!p.v.gamesPlayed) to++;
      dur += p.w.t; tot += p.scores.slice(1, n + 1).reduce((a, b) => a + b, 0);
    } catch (e) { errs++; firstErr = firstErr || String(e.stack).split('\n').slice(0, 2).join(' '); }
  }
  out.push(`${String(g.num).padStart(2)} ${g.id.padEnd(14)} ${g.kind.padEnd(8)} pts/run ${(tot / runs).toFixed(1).padStart(5)} outs ${(outs / runs).toFixed(1).padStart(4)} fin ${(fins / runs).toFixed(1).padStart(4)} draws ${draws} TO ${to} avg ${(dur / runs).toFixed(0)}s${errs ? ' ERR ' + firstErr : ''}`);
}
console.log(out.join('\n'));
