import { Party, GAMES } from '../js/sim/party.js';
const only = +process.argv[2], until = +(process.argv[3]||10), every=+(process.argv[4]||1);
const players = Array.from({ length: 8 }, (_, i) => ({ slot: i + 1, name: 'Bot' + (i + 1), bot: true }));
const p = new Party({ seed: 3, players, only });
p.start();
let next=0;
while (p.w.t < until) {
  p.update();
  for (const e of p.w.fx.splice(0)) if (!['hit','swing','spawn'].includes(e.k)) console.log(e.t.toFixed(2), JSON.stringify(e));
  p.events.length=0;
  if (p.w.t>=next){ next+=every; console.log('--', p.w.t.toFixed(2), p.w.units.filter(u=>u.alive).map(u=>`${u.type}#${u.id}o${u.owner}(${u.x|0},${u.y|0})${u.paused?'P':''}${u.invuln?'I':''}${u.order?u.order.type:''}`).join(' ')); }
}
