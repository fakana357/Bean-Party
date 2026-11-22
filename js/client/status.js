// Per-game status shown in the dev console. AUTO is the latest bot-run check;
// a status the player picks is stored locally and goes into the copied report.
export const STATUS = { ok: '✅', playable: '🟡', broken: '🔴', untested: '⬜' };
export const AUTO = {
  rat: ['ok', 'Bots path around spiders; 4 spiders instead of 5.'],
  roadkill: ['playable', 'Hard: bots often get rolled.'],
  covert: ['playable', 'Guards slower now; bots still get caught often.'],
  push: ['playable', 'Reworked: run into the ogre to bump it; it keeps momentum.'],
  horse: ['ok', 'Was broken (lanes too narrow), fixed.'],
  blinky: ['ok', 'Aiming snaps to the nearest open spot.'],
  skull: ['ok', 'One winner per round by design.'],
  minotaur: ['playable', 'Bots rarely find the flag.'],
  unseen: ['playable', 'Bots weak.'],
  doggy: ['playable', 'Bots slow in the lava maze.'],
  flight: ['ok', 'Darts slower, shield recharges faster.'],
  wheel: ['ok', 'Wheel gets faster over the round.'],
  skeleton: ['ok', 'Skeletons speed up; dispel 7 s.'],
  dark: ['ok', 'Spawns speed up more.'],
  clandestine: ['playable', 'Bots weak; guards slower than beans when charging.'],
  tides: ['playable', 'Bots rarely sink a ship.'],
};
const KEY = 'beanparty-status';
export function loadStatus() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function saveStatus(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function statusOf(store, g) {
  const mine = store[g.id] || {};
  const [auto, note] = AUTO[g.id] || ['ok', ''];
  return { status: mine.status || auto, note: mine.note ?? note, mine: !!mine.status };
}
export function report(store, games) {
  const lines = ['Bean Party — test report', ''];
  for (const g of games) { const s = statusOf(store, g); lines.push(`${STATUS[s.status]} #${g.num} ${g.title} (${g.orig}) — ${s.status}${s.note ? ': ' + s.note : ''}`); }
  return lines.join('\n');
}
