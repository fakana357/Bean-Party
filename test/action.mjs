import { Party } from '../js/sim/party.js';
const players = Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, name: 'P' + (i + 1), bot: i !== 0 }));
const p = new Party({ seed: 5, players, only: 4 }); p.start(); const w = p.w;
let n = 0;
while (w.t < 60) {
  p.update(); p.events.length = 0; w.fx.length = 0;
  const me = [...p.key].find((u) => u.alive && u.owner === 1); if (!me) { console.log('I died at', w.t.toFixed(1)); break; }
  if (p.v.mortar.holder === me && w.t >= p.v.mortar.lockUntil) {
    const ok = p.action(1, null, { x: me.x + 300, y: me.y });
    if (ok) { n++; console.log('threw at', w.t.toFixed(2)); }
  }
}
console.log('throws', n);
