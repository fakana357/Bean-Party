// Headless test: run full bot-only parties and single minigames, print outcomes.
import { Party, GAMES } from '../js/sim/party.js';

function run(opts, maxSec = 900) {
  const players = Array.from({ length: opts.n ?? 8 }, (_, i) => ({ slot: i + 1, name: 'Bot' + (i + 1), bot: true }));
  const p = new Party({ seed: opts.seed ?? 7, players, only: opts.only ?? null });
  p.start();
  const log = [];
  let steps = 0;
  while (p.w.t < maxSec) {
    p.update(); steps++;
    for (const e of p.events.splice(0)) {
      if (['result', 'finish', 'out', 'gameover', 'text'].includes(e.k)) log.push(`${e.t.toFixed(1)}s ${e.k} ${e.text || ''} ${e.slot ?? ''} ${e.pts ?? ''}`);
      if (e.k === 'gameover') return { log, scores: p.scores.slice(1, 9), winner: e.winner, t: p.w.t };
    }
    p.w.fx.length = 0;
    if (opts.only && p.v.gamesPlayed >= 1) return { log, scores: p.scores.slice(1, 9), t: p.w.t };
  }
  return { log, scores: p.scores.slice(1, 9), t: p.w.t, timeout: true };
}

const which = process.argv[2];
if (which === 'all') {
  const r = run({ seed: +(process.argv[3] || 7) }, 3000);
  console.log(r.log.join('\n')); console.log('scores', r.scores, 'winner', r.winner, 't', r.t.toFixed(1), r.timeout ? 'TIMEOUT' : '');
} else {
  for (const g of GAMES) {
    if (which && which !== g.id) continue;
    const t0 = performance.now();
    const r = run({ only: g.num, seed: 3 }, 600);
    console.log(`== ${g.id}: ${(r.t).toFixed(1)}s sim, ${(performance.now() - t0).toFixed(0)}ms real ${r.timeout ? 'TIMEOUT' : ''}`);
    console.log(r.log.slice(0, 30).join('\n')); console.log('scores', r.scores.join(' '));
  }
}
