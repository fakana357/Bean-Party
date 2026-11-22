import { Party } from '../js/sim/party.js';
const mk = (only) => { const players = Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, name: 'P' + (i + 1), bot: i !== 0 })); const p = new Party({ seed: 11, players, only }); p.start(); return p; };
// Hot Mortar: when our mortar holds the bomb, right-click (smart) another mortar
{
  const p = mk(4), w = p.w; let passed = false, tries = 0;
  while (w.t < 120 && !passed) {
    p.update(); p.events.length = 0;
    const me = w.units.find((u) => u.alive && u.owner === 1 && u.type === 'hmtm');
    if (!me) break;
    if (p.v.mortar.important === me && tries < 1) {
      const other = w.units.find((u) => u.alive && u.type === 'hmtm' && u !== me);
      const ok = w.issue(me, { type: 'smart', target: other }); tries++;
      console.log('mortar: holder=me at', w.t.toFixed(2), 'smart order accepted:', ok, 'order now', me.order?.type, me.order?.abil);
      const target = other;
      for (let k = 0; k < 200; k++) { p.update(); if (p.v.mortar.important === target) { passed = true; console.log('mortar: bomb landed on target at', w.t.toFixed(2)); break; } }
    }
    for (const e of w.fx.splice(0)) {}
  }
  if (!passed) console.log('mortar: never passed (holder never me or failed)');
}
// Stop and Go: wait for green, move, stop on yellow, purge someone
{
  const p = mk(18), w = p.w;
  const me = () => w.units.find((u) => u.alive && u.owner === 1);
  while (p.v.light !== 'green') p.update();
  w.issue(me(), { type: 'move', x: me().x, y: me().y + 900 });
  while (p.v.light !== 'yellow') p.update();
  console.log('stop: on yellow moving, invisible?', me().invisible, 'y', me().y.toFixed(0));
  w.issue(me(), { type: 'stop' });
  for (let i = 0; i < 30; i++) p.update();
  console.log('stop: stopped invisible?', me().invisible, 'light', p.v.light);
  while (p.v.light !== 'green') p.update();
  const other = w.units.find((u) => u.alive && u.type === 'nsea' && u.owner !== 1);
  const ok = w.issue(me(), { type: 'cast', abil: 'A007', target: other });
  for (let i = 0; i < 4; i++) p.update();
  console.log('stop: purge ok', ok, 'target paused until', other.pauseUntil.toFixed(2), 'now', w.t.toFixed(2), 'mana', me().mana);
  while (w.t < 200 && me()) p.update();
  console.log('stop: my seal', me() ? 'alive' : 'gone', 'score', p.scores[1]);
}
