import * as THREE from 'three';
import { createScene, S } from './scene.js';
import { buildArena, finishPad, THEMES, themeFor } from './arena.js';
import { makeActor, makeBean, animateBean, applySkin, setSkinResolver, BEAN_COLORS, BEAN_NAMES } from './actors.js';
import { PATTERNS, PALETTE, EMOJIS, skinDataURL } from './skins.js';
import { FX } from './fx.js';
import { initFeel, solveFeel, impulse } from './feel.js';
import { Audio } from './audio.js';
import { Party, GAMES } from '../sim/party.js';
import { DT, REGIONS, center, P_ENEMY, ARENA_SCALE } from '../sim/engine.js';
import { MAP } from '../sim/data.js';
import { ROADKILL_LANES } from '../sim/games/roadkill.js';
import { STATUS, statusOf, loadStatus, saveStatus, report } from './status.js';
import { Net } from './net.js';

const $ = (id) => document.getElementById(id);
const V = createScene($('view'));
const { scene, camera, composer, frame, rig } = V;
const fx = new FX(scene);
const audio = new Audio();
const ME = 1; // the local player always takes slot 1

// ------------------------------------------------------------------ state
const st = {
  mode: 'menu', party: null, local: ME, count: 8, name: 'You',
  speed: 1, acc: 0, arenaKey: null, arenas: {}, actors: new Map(), view: null,
  holder: 0, light: 'red', pathOverlay: null, devOnly: null, spectate: false,
  night: 0, flames: [], lastTimer: -1, hold: 0, intro: null, skins: {},
  mySkin: { pattern: 'bigdots', main: '#ff4d5e', accent: '#ffffff', emoji: '😎' },
  keys: new Set(), steering: false, joy: null, mouse: null,
};
try {
  const s = JSON.parse(localStorage.getItem('beanparty2') || '{}');
  if (s.name) st.name = s.name; if (s.count) st.count = s.count; if (s.skin?.main) st.mySkin = s.skin;
} catch (e) {}
const save = () => { try { localStorage.setItem('beanparty2', JSON.stringify({ name: st.name, count: st.count, skin: st.mySkin })); } catch (e) {} };
const skinOf = (slot) => st.skins[slot] || (slot === ME ? st.mySkin : { pattern: 'solid', main: BEAN_COLORS[slot], accent: '#ffffff' });
setSkinResolver(skinOf);
const swatchURL = (slot) => skinDataURL(skinOf(slot).main, skinOf(slot), 40, 40);
const nameOf = (slot) => st.party?.name(slot) ?? '?';

// ------------------------------------------------------------------ menu stage
const menuGroup = new THREE.Group(); scene.add(menuGroup);
{
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.35, 64), new THREE.MeshPhysicalMaterial({ color: 0xffd23f, roughness: 0.3, clearcoat: 1 }));
  stage.position.y = -0.175; stage.receiveShadow = true; stage.castShadow = true; menuGroup.add(stage);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 12, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2; menuGroup.add(rim);
  for (let i = 0; i < 24; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6b0 })); const a = i / 24 * Math.PI * 2; b.position.set(Math.cos(a) * 1.25, -0.02, Math.sin(a) * 1.25); b.userData.i = i; menuGroup.add(b); }
  menuGroup.userData.lights = menuGroup.children.filter((c) => c.userData.i !== undefined);
  // floating candy confetti in the background
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 10), new THREE.MeshPhysicalMaterial({ color: PALETTE[i % 10], roughness: 0.2, clearcoat: 1 }));
    c.position.set((Math.random() - 0.5) * 12, Math.random() * 5 - 0.5, -2 - Math.random() * 6); c.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    c.userData.spin = (Math.random() - 0.5) * 2; c.userData.bob = Math.random() * 6; menuGroup.add(c);
  }
}
function refreshMenuBean() {
  if (menuGroup.userData.hero) menuGroup.remove(menuGroup.userData.hero);
  const b = makeBean(st.mySkin.main, 2.1, st.mySkin);
  menuGroup.add(b); menuGroup.userData.hero = b;
}

// ------------------------------------------------------------------ menu UI
const mkRow = (el, items, make, on) => { el.innerHTML = ''; items.forEach((it) => { const b = document.createElement('button'); make(b, it); b.onclick = () => { on(it); save(); updateMenu(); audio.start(); audio.play('pop'); }; el.appendChild(b); }); };
mkRow($('patterns'), PATTERNS, (b, p) => { b.className = 'pat'; b.setAttribute('aria-label', 'Pattern ' + p); }, (p) => (st.mySkin = { ...st.mySkin, pattern: p }));
mkRow($('mainCols'), PALETTE, (b, c) => { b.className = 'sw'; b.style.background = c; b.setAttribute('aria-label', 'Main colour ' + c); }, (c) => (st.mySkin = { ...st.mySkin, main: c }));
mkRow($('emojis'), EMOJIS, (b, e) => { b.className = 'emo'; b.textContent = e; b.setAttribute('aria-label', 'Face ' + e); }, (e) => (st.mySkin = { ...st.mySkin, emoji: e }));
mkRow($('subCols'), PALETTE, (b, c) => { b.className = 'sw'; b.style.background = c; b.setAttribute('aria-label', 'Second colour ' + c); }, (c) => (st.mySkin = { ...st.mySkin, accent: c }));
$('name').value = st.name;
$('name').oninput = (e) => { st.name = e.target.value.trim() || 'You'; save(); };
$('minus').onclick = () => { st.count = Math.max(2, st.count - 1); save(); updateMenu(); audio.start(); audio.play('click'); };
$('plus').onclick = () => { st.count = Math.min(8, st.count + 1); save(); updateMenu(); audio.start(); audio.play('click'); };
$('custBtn').onclick = () => { $('custom').classList.toggle('hidden'); audio.start(); audio.play('click'); };
$('custDone').onclick = () => { $('custom').classList.add('hidden'); audio.play('click'); };
function updateMenu() {
  [...$('patterns').children].forEach((b, i) => { b.classList.toggle('on', PATTERNS[i] === st.mySkin.pattern); b.style.backgroundImage = `url(${skinDataURL(st.mySkin.main, { ...st.mySkin, pattern: PATTERNS[i] }, 40, 40)})`; });
  [...$('mainCols').children].forEach((b, i) => b.classList.toggle('on', PALETTE[i] === st.mySkin.main));
  [...$('subCols').children].forEach((b, i) => b.classList.toggle('on', PALETTE[i] === st.mySkin.accent));
  [...$('emojis').children].forEach((b, i) => b.classList.toggle('on', EMOJIS[i] === (st.mySkin.emoji || '😀')));
  $('count').textContent = st.count; refreshMenuBean();
}
updateMenu();
$('play').onclick = () => startParty();
$('again').onclick = () => startParty(st.devOnly);

// ------------------------------------------------------------------ party lifecycle
function randomSkin(slot) {
  const main = BEAN_COLORS[slot];
  let accent = PALETTE[(Math.random() * PALETTE.length) | 0]; if (accent.toLowerCase() === main.toLowerCase()) accent = '#ffffff';
  return { pattern: PATTERNS[(Math.random() * PATTERNS.length) | 0], main, accent, emoji: EMOJIS[(Math.random() * EMOJIS.length) | 0] };
}
function startParty(only = null, opts = {}) {
  audio.start(); audio.play('new');
  st.devOnly = only; st.spectate = !!opts.spectate;
  let players;
  if (opts.online) {
    const m = opts.online;
    st.local = m.you;
    players = m.players.map((pl) => ({ slot: pl.slot, name: pl.name, bot: false }));
    st.skins = {}; for (const pl of m.players) st.skins[pl.slot] = pl.skin?.main ? pl.skin : randomSkin(pl.slot);
    st.party = new Party({ players, seed: m.seed, gameLength: m.games });
  } else {
    st.mp = null;
    const slots = []; for (let i = 1; i <= st.count; i++) slots.push(i);
    st.local = st.spectate ? -1 : ME;
    players = slots.map((s) => ({ slot: s, name: s === ME && !st.spectate ? st.name : BEAN_NAMES[s], bot: s !== st.local }));
    st.skins = {}; for (const pl of players) st.skins[pl.slot] = pl.slot === ME && !st.spectate ? st.mySkin : randomSkin(pl.slot);
    st.party = new Party({ players, only, seed: (Math.random() * 2 ** 31) | 0 });
  }
  st.mode = 'game'; st.acc = 0; st.hold = 0; st.intro = null; st.holder = 0;
  clearActors(); fx.clear(); stampQ.length = 0; stampT = 0;
  for (const id of ['menu', 'end', 'mid', 'stamp', 'custom', 'net', 'pause']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('again').classList.toggle('hidden', !!opts.online); $('skipBtn').classList.add('hidden');
  menuGroup.visible = false; podium.visible = false;
  st.out = new Set(); st.done = new Set(); st.gain = {};
  st.party.start();
  renderBoard();
  processEvents();
}
function clearActors() { for (const [, a] of st.actors) scene.remove(a.obj); st.actors.clear(); }

function showArena(key) {
  if (st.arenaKey === key) return;
  for (const [k, g] of Object.entries(st.arenas)) g.visible = k === key;
  if (!st.arenas[key]) {
    const opts = {};
    if (key === 'road') opts.paint = paintRoad;
    if (key === 'stop') opts.paint = paintStop;
    st.arenas[key] = buildArena(key, opts); scene.add(st.arenas[key]);
  }
  st.arenas[key].visible = true; st.arenaKey = key;
  if (st.pathOverlay) { scene.remove(st.pathOverlay); st.pathOverlay = null; if (dev.showPath) togglePath(true); }
}
function paintRoad(g, P) {
  const C = center(REGIONS.Roadkill_Challenge), K = ARENA_SCALE.road || 1;
  for (const [dx, dy, , , px] of ROADKILL_LANES) {
    const xa = C.x + Math.min(dx, px) * K - 160, xb = C.x + Math.max(dx, px) * K + 160, y = C.y + dy * K;
    const [ax, ay] = P(xa, y + 95), [bx, by] = P(xb, y - 95);
    g.fillStyle = '#4b5e8a'; g.globalAlpha = 0.85; roundRect(g, ax, ay, bx - ax, by - ay, 10); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); const [mx, my] = P(xa + 20, y); const [nx] = P(xb - 20, y); g.moveTo(mx, my); g.lineTo(nx, my); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax + 4, ay + 3); g.lineTo(bx - 4, ay + 3); g.moveTo(ax + 4, by - 3); g.lineTo(bx - 4, by - 3); g.stroke();
  }
}
function paintStop(g, P) {
  const r = REGIONS.Stop_and_Go;
  g.strokeStyle = 'rgba(165,140,255,0.6)'; g.lineWidth = 4; g.setLineDash([14, 14]);
  const [x, y0] = P((r.x0 + r.x1) / 2, r.y0 + 80), [, y1] = P(0, r.y1 - 300); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); g.setLineDash([]);
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ------------------------------------------------------------------ actors
const elastic = (k) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k) * Math.cos(k * 10));
const lerpAng = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
function makeMeMarker() {
  const g = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: 0.8 }));
  g.rotation.x = Math.PI; return g;
}
function syncActors(alpha, dt, t) {
  const w = st.party.w, seen = new Set(), feelList = [];
  for (const u of w.units) {
    if (u.removed) continue;
    let a = st.actors.get(u.id);
    if (!a) {
      if (u.type === 'ncop') { const p = finishPad(); p.position.set(u.x * S, 0, -u.y * S); scene.add(p); a = { obj: p, pad: true }; st.actors.set(u.id, a); }
      else { const obj = makeActor(u); if (!obj) continue; obj.position.set(u.x * S, 0, -u.y * S); scene.add(obj); a = { obj, color: u.color }; st.actors.set(u.id, a); obj.userData.baseScale = obj.scale.x; obj.scale.multiplyScalar(0.01); a.spawnT = 0; }
    }
    seen.add(u.id);
    const o = a.obj, ud = o.userData;
    if (a.pad) { ud.ring.rotation.z += dt; ud.flag.rotation.y = Math.sin(t * 3) * 0.2; continue; }
    if (!u.alive) continue;
    const px = u.px ?? u.x, py = u.py ?? u.y;
    const x = px + (u.x - px) * alpha, y = py + (u.y - py) * alpha;
    const fly = u.fly ? Math.sin(t * 3 + u.id) * 0.08 : 0;
    if (ud.kind === 'bean') {
      if (!a.f) initFeel(a, x * S, -y * S);
      o.position.y = fly;
      feelList.push({ a, obj: o, u, tx: x * S, tz: -y * S, r: 0.3 * (ud.baseScale || 1) });
    } else o.position.set(x * S, fly, -y * S);
    if (u.type !== 'uzg1') {
      const yaw = (u.type === 'hmtt' || u.type === 'hctw') ? u.facing * Math.PI / 180 : (u.facing + 90) * Math.PI / 180;
      let d = yaw - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * (ud.kind === 'bean' ? 18 : 10));
    }
    if (a.spawnT !== undefined && a.spawnT < 1) { a.spawnT = Math.min(1, a.spawnT + dt * 3); o.scale.setScalar((ud.baseScale ?? 1) * Math.max(0.01, elastic(a.spawnT))); }
    if (ud.kind === 'bean') {
      animateBean(o, u, t, dt);
      const frozen = w.t < u.pauseUntil;
      if (frozen !== !!ud.frozen) { ud.frozen = frozen; ud.bodyMat.emissive.set(frozen ? 0x66ccff : 0x000000); ud.bodyMat.emissiveIntensity = frozen ? 0.7 : 0; }
      if (ud.bomb) ud.bomb.visible = st.holder === u.id;
      // hidden beans (e.g. Covert Kitty-Bean): yours turns ghostly, others vanish
      const op = u.invisible ? (u.owner === st.local ? 0.35 : 0) : 1;
      ud.op = (ud.op ?? 1) + (op - (ud.op ?? 1)) * Math.min(1, dt * 8);
      if (ud.op < 0.999 || op < 1) { ud.bodyMat.opacity = ud.op; ud.limbMat.opacity = ud.op; o.visible = ud.op > 0.02; }
      if (a.hurt > 0) { a.hurt -= dt; ud.bodyMat.emissive.set(0xffffff); ud.bodyMat.emissiveIntensity = Math.max(0, a.hurt * 3); }
      if (u.owner === st.local && !ud.me) { ud.me = makeMeMarker(); ud.me.scale.setScalar(1 / (ud.baseScale || 1) * 0.7); o.add(ud.me); }
      if (ud.me) { ud.me.position.y = 1.4 + (ud.bomb?.visible ? 0.75 : 0) + Math.sin(t * 4) * 0.06; ud.me.rotation.y += dt * 2; }
    } else if (ud.kind === 'launcher') {
      ud.shoot = Math.max(0, ud.shoot - dt * 2.5);
      ud.pivot.rotation.x = -0.6 + Math.sin(Math.min(1, ud.shoot) * Math.PI) * 1.4;
      ud.jelly.visible = ud.shoot <= 0.05 && (u.nextShot ?? 0) - w.t < 1.2;
    } else if (ud.kind === 'sprite') {
      ud.core.scale.setScalar(1 + Math.sin(t * 12 + u.id) * 0.08); ud.halo.scale.setScalar(1 + Math.sin(t * 7 + u.id) * 0.15);
      ud.ring.visible = false;
      if (Math.random() < 0.5) fx.burst(u.x, u.y, 70, 1, { colors: [0xffd23f, 0xff8a3d, 0xff5a1f], speed: 0.3, up: 1.5, grav: -1.5, life: 0.5, size: 1.4 });
    } else if (ud.kind === 'lighthouse') {
      const col = st.light === 'red' ? 0xff4d5e : st.light === 'yellow' ? 0xffd23f : 0x57e36b;
      ud.lampMat.color.set(col); ud.lampMat.emissive.set(col); ud.beamMat.color.set(col);
      ud.beam.visible = st.light === 'red';
      const tg = a.aim && unitById(a.aim);
      const want = tg && tg.alive ? Math.atan2(tg.y - u.y, tg.x - u.x) : (t * 0.9 + u.id) % (Math.PI * 2);
      ud.eye.rotation.y = lerpAng(ud.eye.rotation.y, want, Math.min(1, dt * (tg ? 14 : 2)));
      ud.beamMat.opacity = tg ? 0.35 : 0.12;
    } else if (ud.kind === 'roller') {
      if (Math.hypot(u.vx, u.vy) > 1) ud.roller.rotation.y += dt * u.speed * 0.02;
      if (Math.random() < 0.08) fx.puff(u.x - Math.cos(u.facing * Math.PI / 180) * 10, u.y - Math.sin(u.facing * Math.PI / 180) * 10, 110, 0.18, 0xffffff, 0.8, 0.6);
    }
  }
  solveFeel(feelList, w.grid, dt);
  st.feelList = feelList;
  for (const [id, a] of st.actors) {
    const u = w.units.find((x) => x.id === id);
    if (!seen.has(id) || !u || (!u.alive && !a.pad)) { scene.remove(a.obj); st.actors.delete(id); }
  }
}
// the camera always keeps every bean on screen (or the whole arena for fitAll games)
function playRect() {
  const v = st.view; if (st.game?.fitAll || !st.party) return v;
  const bs = [...st.party.key].filter((u) => u.alive); if (!bs.length) return v;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of bs) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x); y1 = Math.max(y1, b.y); }
  const pad = 380; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const minW = 1300, minH = 1000;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  // stay inside the arena view where possible
  const sx = (a0, a1, b0, b1) => { const w = a1 - a0; if (w >= b1 - b0) return [b0, b1]; if (a0 < b0) return [b0, b0 + w]; if (a1 > b1) return [b1 - w, b1]; return [a0, a1]; };
  [x0, x1] = sx(x0, x1, v.x0, v.x1); [y0, y1] = sx(y0, y1, v.y0, v.y1);
  return { x0, y0, x1, y1 };
}
function unitById(id) { return st.party?.w.units.find((u) => u.id === id); }

// ------------------------------------------------------------------ events
function processEvents() {
  const p = st.party, w = p.w;
  for (const e of w.fx.splice(0)) handleFx(e, w);
  for (const e of p.events.splice(0)) handleParty(e, p);
}
function handleFx(e, w) {
  const S2 = st.feelList;
  switch (e.k) {
    case 'death': {
      const a = st.actors.get(e.id);
      const col = e.owner >= 1 && e.owner <= 8 ? new THREE.Color(skinOf(e.owner).main).getHex() : 0xffffff;
      if (['opeo', 'nsea', 'nmrl', 'ngsp', 'hmtm'].includes(e.type)) {
        fx.burst(e.x, e.y, 30, 40, { colors: [col, 0xffffff, col], speed: 4, up: 5 });
        if (!e.exploded) { fx.puff(e.x, e.y, 20, 0.45, 0xffffff, 0.5); audio.play('pop'); }
        if (e.type === 'nmrl') fx.splat(e.x, e.y, 45, col, 6);
      } else fx.puff(e.x, e.y, 30, 0.6, 0xffffff, 0.6);
      if (a) { scene.remove(a.obj); st.actors.delete(e.id); }
      break;
    }
    case 'hit': { const a = st.actors.get(e.id); if (a) { a.hurt = 0.25; if (a.f) { a.f.sqv -= 6; } } break; }
    case 'warn': fx.telegraph(e.x, e.y, e.r, e.dur, e.hot); break;
    case 'impact':
      if (e.type === 'ncat' || e.type === 'ocat') {
        fx.splat(e.x, e.y, e.r, e.type === 'ocat' ? 0xff7a2a : 0xff5fa8, 4); fx.ring(e.x, e.y, e.r * 1.6, 0xffffff, 0.4);
        fx.burst(e.x, e.y, 10, 22, { colors: e.type === 'ocat' ? [0xff8a3d, 0xffd23f] : [0xff5fa8, 0xffb3d9], speed: 3, up: 3, life: 0.9 });
        audio.play('splat'); rig.shake = Math.max(rig.shake, 0.05); if (S2) impulse(S2, e.x * S, -e.y * S, 1.6, 4);
      } else if (e.type === 'uzg1') { fx.burst(e.x, e.y, 40, 14, { colors: [0xff4d5e, 0xffffff], speed: 2, up: 2, life: 0.5 }); audio.play('zap'); }
      break;
    case 'lava': fx.lava(e.x, e.y, e.r, e.dur); break;
    case 'boom': fx.boom(e.x, e.y, false); if (e.r) fx.ring(e.x, e.y, e.r, 0xffe066, 0.6, 0.05); audio.play('boom'); rig.shake = Math.max(rig.shake, 0.12); if (S2) impulse(S2, e.x * S, -e.y * S, 3, 6); break;
    case 'teleport': fx.teleport(e.x, e.y); break;
    case 'centerFlame': st.flames.push(fx.flame(e.x, e.y)); break;
    case 'holder': st.holder = e.id; break;
    case 'throw': audio.play('throw'); break;
    case 'catch': {
      const u = unitById(e.id); if (!u) break;
      fx.burst(u.x, u.y, 60, 12, { colors: [0xffe066, 0xff8a3d], speed: 2, up: 3 }); audio.play('fuse');
      if (u.owner === st.local) { setHint('YOU HAVE THE BOMB! Click a bean or press Space to throw it!', true); audio.play('ding'); }
      else if (st.hintHot) setHint(st.game?.hint, false);
      break;
    }
    case 'swing': { const a = st.actors.get(e.id); if (a?.obj.userData.kind === 'launcher') { a.obj.userData.shoot = 1; audio.play('shoot'); } break; }
    case 'purge': { const u = unitById(e.id); if (u) { fx.ring(u.x, u.y, 90, 0x9fe8ff, 0.7); fx.burst(u.x, u.y, 60, 20, { colors: [0xbff0ff, 0xffffff], speed: 2, up: 3 }); audio.play('freeze'); } break; }
    case 'spotted': { const u = unitById(e.id); const a = st.actors.get(e.tower); if (a) a.aim = e.id; if (u) { fx.text(u.x, u.y + 40, '!', '#ff4d5e'); audio.play('red'); } break; }
    case 'light': st.light = e.c; audio.play(e.c); renderLights(); for (const [, a] of st.actors) a.aim = null; break;
    case 'dest': { const ar = st.arenas[st.arenaKey]; if (!ar) break; for (const c of ar.children) if (c.userData.dest && Math.abs(c.userData.dest.x - e.x) < 1 && Math.abs(c.userData.dest.y - e.y) < 1) { c.visible = e.alive; if (!e.alive) fx.puff(e.x, e.y, 20, 0.5, 0xffffff, 0.5); } break; }
    case 'text3d': fx.text(e.x, e.y, e.text, e.color || '#fff'); break;
    case 'sfx': audio.play(e.id); break;
    case 'ring': fx.ring(e.x, e.y, e.r, e.color ?? 0xffffff, e.dur ?? 0.5, 0.05); break;
    case 'tree': {
      const ar = st.arenas[st.arenaKey]; if (!ar) break;
      for (const tr of ar.userData.trees) if (Math.abs(tr.d.x - e.x) < 1 && Math.abs(tr.d.y - e.y) < 1) { tr.mesh.userData.candy.visible = e.alive; if (!e.alive) fx.burst(e.x, e.y, 90, 30, { colors: [0xff7fb8, 0xffffff], speed: 3, up: 4 }); }
      break;
    }
  }
}

let bannerTimer = 0, toastTimer = 0;
function banner(title, sub, dur = 3.2, cls = '') {
  const b = $('banner'); b.querySelector('h1').textContent = title; const p = b.querySelector('p'); p.textContent = sub || ''; p.classList.toggle('hidden', !sub);
  b.querySelector('.hint').classList.add('hidden');
  b.className = cls; void b.offsetWidth; b.classList.add('pop'); bannerTimer = dur;
}
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('off'); toastTimer = 2.2; }
function setHint(text, hot) {
  const h = $('hint'); if (!text) { h.classList.add('hidden'); return; }
  h.textContent = '';
  const goal = !hot && st.game?.objective;
  if (goal) { const b = document.createElement('div'); b.className = 'goal'; b.textContent = goal; h.appendChild(b); }
  const c = document.createElement('div'); c.textContent = text; h.appendChild(c);
  h.classList.remove('hidden'); h.classList.toggle('hot', !!hot); st.hintHot = !!hot;
}
const stampQ = []; let stampT = 0;
function stamp(text, sub, cls) { stampQ.push([text, sub, cls]); if (stampT <= 0) nextStamp(); }
function nextStamp() {
  const n = stampQ.shift(); const el = $('stamp'); if (!n) { el.classList.add('hidden'); return; }
  el.className = n[2] || ''; el.querySelector('b').textContent = n[0]; el.querySelector('small').textContent = n[1] || '';
  void el.offsetWidth; el.classList.add('go'); stampT = 1.5;
}
function showMid() {
  const p = st.party; if (!p || st.mode !== 'game') return;
  const rows = p.players.map((pl) => ({ ...pl, score: p.scores[pl.slot] })).sort((a, b) => b.score - a.score || a.slot - b.slot);
  $('midHead').textContent = 'Standings';
  $('midRows').innerHTML = rows.map((r, i) => `<div class="pl${r.slot === st.local ? ' me' : ''}" style="animation:pop2 .4s ${i * 0.06}s both"><span class="dot" style="background-image:url(${swatchURL(r.slot)})"></span><span class="nm">${i + 1}. ${esc(r.name)}</span><span class="sc">${r.score}${st.gain?.[r.slot] ? `<span class="gain">+${st.gain[r.slot]}</span>` : ''}</span></div>`).join('');
  $('mid').classList.remove('hidden');
}

// ---- round intro: roulette -> camera flyover with the title -> 3, 2, 1, GO!
const CARD_ART = {};
function cardArt(g) {
  if (CARD_ART[g.id]) return CARD_ART[g.id];
  const A = MAP.arenas[g.arena], th = themeFor(g.arena), r = REGIONS[g.rect];
  const pad = g.id === 'peon' ? 300 : 120;
  const c32 = A.cell;
  const i0 = Math.max(0, Math.floor((r.x0 - pad - A.x0) / c32)), i1 = Math.min(A.w, Math.ceil((r.x1 + pad - A.x0) / c32));
  const j0 = Math.max(0, Math.floor((r.y0 - pad - A.y0) / c32)), j1 = Math.min(A.h, Math.ceil((r.y1 + pad - A.y0) / c32));
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 240, 180); gr.addColorStop(0, '#' + new THREE.Color(th.bump[0]).getHexString()); gr.addColorStop(1, '#' + new THREE.Color(th.bump[1]).getHexString());
  x.fillStyle = gr; x.fillRect(0, 0, 240, 180);
  const cw = i1 - i0, ch = j1 - j0, k = Math.min(220 / cw, 160 / ch), ox = (240 - cw * k) / 2, oy = (180 - ch * k) / 2;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (A.rows[j][i] === '.') { x.fillStyle = ((Math.floor(i / 4) + Math.floor(j / 4)) % 2) ? th.a : th.b; x.fillRect(ox + (i - i0) * k, oy + (j1 - 1 - j) * k, k + 0.6, k + 0.6); }
  return (CARD_ART[g.id] = cv.toDataURL());
}
function startIntro(g, label) {
  const strip = $('rStrip'), win = $('roulette');
  // a dozen random cards plus the picked one, so the reel stays light with 52 games
  const pool = GAMES.filter((x) => x !== g).sort(() => Math.random() - 0.5).slice(0, 11); pool.splice((Math.random() * 12) | 0, 0, g);
  const order = pool, reps = 4, html = [];
  for (let r = 0; r < reps; r++) for (const gg of order) html.push(`<div class="rcard"><img alt="" src="${cardArt(gg)}"><span>${gg.title}</span></div>`);
  strip.innerHTML = html.join('');
  $('rRound').textContent = label; $('rName').textContent = ''; $('rName').classList.remove('go');
  win.classList.remove('hidden');
  const card = strip.children[0], step = card.offsetWidth + 22;
  const idx = (reps - 2) * order.length + order.indexOf(g);
  strip.style.transition = 'none'; strip.style.transform = `translateX(${window.innerWidth / 2 - card.offsetWidth / 2}px)`;
  void strip.offsetWidth;
  strip.style.transition = 'transform 2.3s cubic-bezier(.12,.75,.18,1)';
  strip.style.transform = `translateX(${window.innerWidth / 2 - (idx * step + card.offsetWidth / 2)}px)`;
  let ticks = 0; const tk = setInterval(() => { if (++ticks > 18) clearInterval(tk); audio.play('tick'); }, 70);
  setTimeout(() => { $('rName').textContent = g.title; $('rName').classList.add('go'); audio.play('new'); }, 2350);
  setHint('');
  st.intro = { t: 0, roulette: 3.4, fly: 3.4, count: 2.6, g, banner: false, num: -1 };
  st.hold = 1e9;
}
function updateIntro(dt) {
  const I = st.intro; if (!I) return;
  I.t += dt;
  const t1 = I.roulette, t2 = t1 + I.fly, t3 = t2 + I.count;
  if (I.t >= t1 && !I.banner) { I.banner = true; $('roulette').classList.add('hidden'); banner(I.g.title, I.g.objective || I.g.subtitle, I.fly + 0.3, 'flyover'); audio.play('green'); }
  if (I.t >= t2) {
    const k = Math.floor((I.t - t2) / 0.65);
    if (k !== I.num && k <= 3) { I.num = k; const el = $('countdown'); el.textContent = k < 3 ? String(3 - k) : 'GO!'; el.className = k === 3 ? 'go' : ''; void el.offsetWidth; el.classList.add('tick'); audio.play(k === 3 ? 'ding' : 'tick'); }
  }
  if (I.t >= t3) { $('countdown').className = 'hidden'; st.intro = null; st.hold = 0; setHint(I.g.hint || ''); if (online()) { $('skipBtn').classList.remove('hidden'); renderSkip(); } }
}
function introCamera(dt) {
  const I = st.intro;
  if (!I || I.t < I.roulette) { if (st.view) frame(st.view, null, dt, true); return; }
  frame(st.view, null, dt, true);
  const k = Math.min(1, (I.t - I.roulette) / (I.fly + 0.4)), e = 1 - Math.pow(1 - k, 3);
  const tgt = rig.target.clone(), d = rig.dist;
  const yaw = (1 - e) * -1.3, pitch = (24 + 32 * e) * Math.PI / 180, dist = d * (1.55 - 0.55 * e);
  camera.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(tgt);
}

function handleParty(e, p) {
  switch (e.k) {
    case 'camera': {
      const g = GAMES.find((g) => REGIONS[g.rect] === e.rect); if (g) { showArena(g.arena); st.game = g; }
      const pad = g?.viewPad ?? (g?.id === 'peon' ? 300 : 40);
      st.view = { x0: e.rect.x0 - pad, y0: e.rect.y0 - pad, x1: e.rect.x1 + pad, y1: e.rect.y1 + pad };
      st.out = new Set(); st.done = new Set(); st.holder = 0; st.light = 'red';
      for (const f of st.flames) fx.root.remove(f); st.flames = [];
      $('lights').classList.toggle('hidden', g?.id !== 'stop'); $('clock').classList.add('hidden');
      audio.setMusic(true, g?.id === 'stop' ? 'night' : g?.kind === 'race' ? 'tense' : 'party');
      $('mid').classList.add('hidden'); $('fade').style.opacity = '0';
      updateTouchUI();
      if (g) startIntro(g, p.v.tieBreaker ? 'Tie-Breaker!' : `Round ${p.v.gamesPlayed + 1}`);
      break;
    }
    case 'text': if (!e.sub && !/ won!$/.test(e.text)) toast(e.text); break;
    case 'out': st.out.add(e.slot); st.gain[e.slot] = e.pts; renderBoard(); if (e.slot === st.local) { audio.play('out'); stamp('OUT!', `+${e.pts} points`, 'bad'); setHint(''); } else toast(`${nameOf(e.slot)} is out!`); break;
    case 'finish': st.done.add(e.slot); st.gain[e.slot] = e.pts; renderBoard(); audio.play('ding'); if (e.slot === st.local) { stamp('FINISHED!', `+${e.pts} points`, 'good'); setHint(''); } else toast(`${nameOf(e.slot)} finished! +${e.pts}`); break;
    case 'result': {
      setHint(''); $('skipBtn').classList.add('hidden');
      if (e.kind === 'win') { audio.play('win'); const pts = p.v.ante; if (e.slot) st.gain[e.slot] = pts; if (e.slot === st.local) stamp('WINNER!', `+${pts} points`, 'gold'); else stamp(`${nameOf(e.slot)} wins!`, `${e.played} of ${e.of} games played`, 'gold'); }
      else { audio.play(e.kind === 'draw' ? 'draw' : 'win'); stamp(e.kind === 'draw' ? 'DRAW!' : 'FINISHED!', `${e.played} of ${e.of} games played`, e.kind === 'draw' ? 'meh' : 'good'); }
      renderBoard(e.scores);
      setTimeout(() => showMid(), 1600);
      break;
    }
    case 'leaderboard': $('round').textContent = e.label; break;
    case 'fade': $('fade').style.transition = `opacity ${e.dur}s`; $('fade').style.opacity = e.dir === 'out' ? '0.92' : '0'; if (e.dir === 'in') { st.gain = {}; renderBoard(); } break;
    case 'gameover': showEnd(e.winner, e.scores); if (online()) st.net.send({ t: 'over' }); break;
  }
}

// ------------------------------------------------------------------ HUD
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderBoard(scores) {
  const p = st.party; if (!p) return;
  const S2 = scores || p.scores;
  const rows = p.players.map((pl) => ({ ...pl, score: S2[pl.slot] })).sort((a, b) => b.score - a.score || a.slot - b.slot);
  $('board').innerHTML = rows.map((r) => `<div class="pl${r.slot === st.local ? ' me' : ''}${st.out?.has(r.slot) ? ' out' : ''}${st.done?.has(r.slot) ? ' done' : ''}"><span class="dot" style="background-image:url(${swatchURL(r.slot)})"></span><span class="nm">${esc(r.name)}</span><span class="sc">${r.score}${st.gain?.[r.slot] ? `<span class="gain">+${st.gain[r.slot]}</span>` : ''}</span></div>`).join('');
}
function renderLights() { const L = $('lights').children; L[0].classList.toggle('on', st.light === 'red'); L[1].classList.toggle('on', st.light === 'yellow'); L[2].classList.toggle('on', st.light === 'green'); }
function updateHud() {
  const w = st.party.w, tm = $('timer');
  if (w.timer.total && (w.timer.running || w.timer.remaining > 0)) {
    tm.classList.remove('hidden'); const s = Math.ceil(w.timer.remaining); tm.textContent = s; tm.classList.toggle('warn', s <= 10);
    if (s !== st.lastTimer && s <= 5 && s > 0) audio.play('tick'); st.lastTimer = s;
  } else tm.classList.add('hidden');
}

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function worldAt(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  return { x: hit.x / S, y: -hit.z / S };
}
function myBean() { return st.party ? [...st.party.key].find((u) => u.alive && u.owner === st.local) : null; }
function beanAt(p) {
  let best = null, bd = 60;
  for (const u of st.party.key) { if (!u.alive || u.owner === st.local) continue; const d = Math.hypot(u.x - p.x, u.y - p.y); if (d < bd) { bd = d; best = u; } }
  return best;
}
const canPlay = () => st.mode === 'game' && st.party && !(st.hold > 0) && myBean();
// ------------------------------------------------------------------ inputs (offline: applied now; online: sent, applied on the server's tick)
function applyCmd(p, slot, c) {
  if (!c || typeof c !== 'object') return;
  if (c.k === 'leave') { const pl = p.players.find((x) => x.slot === c.slot); if (pl) pl.bot = true; return; }
  if (c.k === 'skip') { if (p.v.round === c.r && p.v.gamesPlayed < p.v.gameLength) { p.G.T.SurvivalDeath.disable(); p.G.T.RaceDeath.disable(); p.G.T.Draw.conditional({}); } return; }
  const u = [...p.key].find((x) => x.alive && x.owner === slot); if (!u) return;
  if (c.k === 'm') p.w.issue(u, { type: 'move', x: +c.x, y: +c.y });
  else if (c.k === 's') p.w.issue(u, { type: 'steer', dx: +c.dx, dy: +c.dy });
  else if (c.k === 'x') p.w.issue(u, { type: 'stop' });
  else if (c.k === 'a') { const t = c.id ? p.w.units.find((x) => x.id === c.id) : null; p.action(slot, t || null, c.x != null ? { x: +c.x, y: +c.y } : null); }
}
const online = () => !!(st.net && st.mp);
function input(c) { if (online()) st.net.send({ t: 'in', c }); else applyCmd(st.party, st.local, c); }

function act(target, aim) {
  if (!canPlay()) return false;
  if (online()) {
    const g = st.game, u = myBean();
    const ok = !!g?.action && (!target || !g.canTarget || g.canTarget(st.party.G, u, target));
    if (!ok) return false;
    input({ k: 'a', id: target?.id || 0, x: aim ? Math.round(aim.x) : null, y: aim ? Math.round(aim.y) : null });
    if (target) { fx.ring(target.x, target.y, 70, 0xffd23f, 0.35, 0.05); fx.ring(target.x, target.y, 40, 0xffffff, 0.25, 0.05); } audio.play('click');
    return true;
  }
  const ok = st.party.action(st.local, target, aim);
  if (ok) { const t = target || null; if (t) { fx.ring(t.x, t.y, 70, 0xffd23f, 0.35, 0.05); fx.ring(t.x, t.y, 40, 0xffffff, 0.25, 0.05); } audio.play('click'); }
  return ok;
}
function moveTo(p) {
  const u = myBean(); if (!u || !canPlay() || st.game?.noMove) return;
  if (Math.hypot(u.x - p.x, u.y - p.y) < 30) { input({ k: 'x' }); return; }
  input({ k: 'm', x: Math.round(p.x), y: Math.round(p.y) }); fx.marker(p.x, p.y, 0x57e36b);
}
function stopMe() { const u = myBean(); if (u && canPlay()) input({ k: 'x' }); }
const cv = $('view');
cv.addEventListener('contextmenu', (e) => e.preventDefault());
const hover = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
hover.rotation.x = Math.PI / 2; hover.visible = false; scene.add(hover);
function targetable(t) {
  const g = st.game, u = myBean(); if (!g?.action || !u || !t || !canPlay()) return false;
  return g.canTarget ? g.canTarget(st.party.G, u, t) : true;
}
function updateHover(t) {
  const tg = st.mouse && st.mode === 'game' && st.party ? beanAt(st.mouse) : null;
  const ok = tg && targetable(tg);
  hover.visible = !!ok; cv.style.cursor = ok ? 'pointer' : 'default';
  if (ok) { const a = st.actors.get(tg.id); const p = a?.obj.position || { x: tg.x * S, z: -tg.y * S }; hover.position.set(p.x, 0.04, p.z); hover.scale.setScalar(1 + Math.sin(t * 8) * 0.08); }
}
cv.addEventListener('pointermove', (e) => { if (st.mode === 'game') st.mouse = worldAt(e.clientX, e.clientY); });
cv.addEventListener('pointerdown', (e) => {
  if (!canPlay()) return;
  const p = worldAt(e.clientX, e.clientY); if (!p) return; st.mouse = p;
  const tgt = beanAt(p);
  if (tgt && act(tgt, p)) return;
  if (e.button === 2 || e.button === 0) moveTo(p);
});
const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (KEYS[e.code]) { st.keys.add(e.code); e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && !act(null, st.mouse || aimAhead())) stopMe(); }
  if (e.key === '`' || e.key === '~') toggleDev();
});
window.addEventListener('keyup', (e) => st.keys.delete(e.code));
window.addEventListener('blur', () => st.keys.clear());
function aimAhead() { const u = myBean(); if (!u) return null; const a = u.facing * Math.PI / 180; return { x: u.x + Math.cos(a) * 400, y: u.y + Math.sin(a) * 400 }; }
function steerInput() {
  let dx = 0, dy = 0;
  for (const k of st.keys) { dx += KEYS[k][0]; dy += KEYS[k][1]; }
  if (st.joy) { dx += st.joy.x; dy += st.joy.y; }
  const u = myBean(); if (!u || !canPlay() || st.game?.noMove) { st.steering = false; return; }
  const m = Math.hypot(dx, dy);
  if (m > 0.15) {
    const sx = Math.round(dx / Math.max(1, m) * 100) / 100, sy = Math.round(dy / Math.max(1, m) * 100) / 100;
    if (!online() || !st.steering || sx !== st.lastSteer?.[0] || sy !== st.lastSteer?.[1] || T - st.lastSteerAt > 0.5) { input({ k: 's', dx: sx, dy: sy }); st.lastSteer = [sx, sy]; st.lastSteerAt = T; }
    st.steering = true;
  }
  else if (st.steering) { st.steering = false; st.lastSteer = null; input({ k: 'x' }); }
}
// touch: joystick + action button
const touch = matchMedia('(pointer: coarse)').matches;
function updateTouchUI() { $('joy').classList.toggle('hidden', !touch); $('actBtn').classList.toggle('hidden', !touch || !(st.game?.action)); $('actBtn').textContent = st.game?.id === 'mortar' ? 'Throw' : 'Freeze'; }
{
  const joy = $('joy'), knob = $('joyKnob'); let id = null;
  const upd = (e) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = -(e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } st.joy = { x, y }; knob.style.transform = `translate(${x * 36}px, ${-y * 36}px)`; };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); upd(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
  const end = () => { id = null; st.joy = null; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  $('actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); act(null, aimAhead()); });
}

// ------------------------------------------------------------------ podium / end
const podium = new THREE.Group(); podium.visible = false; scene.add(podium);
const PODIUM_AT = { x: 0, y: -12000 };
function showEnd(winner, scores) {
  st.mode = 'end';
  audio.setMusic(true, 'party'); audio.play('win');
  for (const id of ['hud', 'mid', 'roulette']) $(id).classList.add('hidden');
  $('end').classList.remove('hidden'); $('fade').style.opacity = '0';
  for (const g of Object.values(st.arenas)) g.visible = false; st.arenaKey = null;
  clearActors(); fx.clear();
  while (podium.children.length) podium.remove(podium.children[0]);
  const p = st.party;
  const rows = p.players.map((pl) => ({ ...pl, score: scores[pl.slot] })).sort((a, b) => b.score - a.score);
  $('endTitle').textContent = `${p.name(winner)} wins!`;
  $('standings').innerHTML = rows.map((r, i) => `<div class="pl${r.slot === st.local ? ' me' : ''}"><span class="dot" style="background-image:url(${swatchURL(r.slot)})"></span><span class="nm">${i + 1}. ${esc(r.name)}</span><span class="sc">${r.score}</span></div>`).join('');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.7, 0.6, 64), new THREE.MeshStandardMaterial({ color: 0xffc4e1, roughness: 0.5 }));
  base.position.y = -0.3; base.receiveShadow = true; podium.add(base);
  const steps = [[0, 1.1, 0xffd23f], [-1.25, 0.7, 0xdfe6ff], [1.25, 0.45, 0xffb27a]];
  rows.slice(0, 3).forEach((r, i) => {
    const [x, h, c] = steps[i];
    const blk = new THREE.Mesh(new THREE.BoxGeometry(1.15, h, 1.15), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })); blk.position.set(x, h / 2, 0); blk.castShadow = true; blk.receiveShadow = true; podium.add(blk);
    const b = makeBean(skinOf(r.slot).main, i === 0 ? 1.5 : 1.2, skinOf(r.slot)); b.position.set(x, h, 0.1); b.userData.menuPhase = i; podium.add(b);
  });
  rows.slice(3).forEach((r, i) => { const b = makeBean(skinOf(r.slot).main, 0.9, skinOf(r.slot)); b.position.set(-2.4 + i * 1.2, 0, 1.9); b.userData.menuPhase = i + 3; podium.add(b); });
  podium.position.set(PODIUM_AT.x * S, 0, -PODIUM_AT.y * S);
  podium.visible = true; st.endT = 0;
}

// ------------------------------------------------------------------ dev console
const dev = { open: false, showPath: false, status: loadStatus() };
function toggleDev(force) { if (st.mp && (force ?? !dev.open)) return; dev.open = force ?? !dev.open; $('dev').classList.toggle('hidden', !dev.open); if (dev.open) renderDev(); }
$('devToggle').onclick = () => toggleDev();
function renderDev() {
  const d = $('dev');
  d.innerHTML = `<h3>Dev console</h3>
  <div class="grid"><button id="dvCopy">Copy report</button></div>
  <textarea id="dvReport" class="hidden" readonly></textarea>
  <div class="games">${GAMES.map((g) => { const s = statusOf(dev.status, g); return `<div class="gRow"><button class="mark" data-m="${g.id}" title="${s.status}">${STATUS[s.status]}</button><button class="start" data-g="${g.num}">${g.num}. ${g.title}<span class="orig">${g.orig}</span></button><input data-n="${g.id}" value="${(s.note || '').replace(/"/g, '&quot;')}" placeholder="note"></div>`; }).join('')}</div>
  <div class="grid"><button id="dvParty">Full party</button><button id="dvSpec">${st.spectate ? 'Play myself' : 'Bots only (watch)'}</button></div>
  <label>Beans <select id="dvCount">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option ${n === st.count ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label>Sim speed <select id="dvSpeed">${[0.25, 0.5, 1, 2, 4, 8].map((n) => `<option ${n === st.speed ? 'selected' : ''} value="${n}">${n}×</option>`).join('')}</select></label>
  <div class="grid"><button id="dvPath">${dev.showPath ? 'Hide' : 'Show'} pathing grid</button><button id="dvEnd">End round (draw)</button></div>
  <div class="grid"><button id="dvSkip">Skip intro</button><button id="dvMute">${audio.muted ? 'Unmute' : 'Mute'}</button></div>
  <div class="grid"><button id="dvMenu">Back to menu</button></div>
  <div id="dvInfo" style="opacity:.7"></div>`;
  d.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => startParty(+b.dataset.g, { spectate: st.spectate })));
  const order = Object.keys(STATUS);
  d.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
    const g = GAMES.find((x) => x.id === b.dataset.m), cur = statusOf(dev.status, g).status;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    dev.status[g.id] = { ...(dev.status[g.id] || {}), status: next }; saveStatus(dev.status);
    b.textContent = STATUS[next]; b.title = next;
  }));
  d.querySelectorAll('[data-n]').forEach((i) => (i.oninput = () => { const id = i.dataset.n; dev.status[id] = { ...(dev.status[id] || {}), note: i.value }; saveStatus(dev.status); }));
  $('dvCopy').onclick = () => {
    const text = report(dev.status, GAMES), ta = $('dvReport');
    ta.value = text; ta.classList.remove('hidden'); ta.focus(); ta.select();
    const ok = () => { $('dvCopy').textContent = 'Copied!'; setTimeout(() => { const b = $('dvCopy'); if (b) b.textContent = 'Copy report'; }, 1500); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, () => { try { document.execCommand('copy'); ok(); } catch {} });
    else { try { document.execCommand('copy'); ok(); } catch {} }
  };
  $('dvParty').onclick = () => startParty(null, { spectate: st.spectate });
  $('dvSpec').onclick = () => { st.spectate = !st.spectate; startParty(st.devOnly, { spectate: st.spectate }); renderDev(); };
  $('dvCount').onchange = (e) => { st.count = +e.target.value; save(); updateMenu(); };
  $('dvSpeed').onchange = (e) => { st.speed = +e.target.value; };
  $('dvPath').onclick = () => { togglePath(!dev.showPath); renderDev(); };
  $('dvEnd').onclick = () => { if (st.party) { st.party.G.T.SurvivalDeath.disable(); st.party.G.T.RaceDeath.disable(); st.party.G.T.Draw.conditional({}); } };
  $('dvSkip').onclick = skipIntro;
  $('dvMute').onclick = () => { audio.setMuted(!audio.muted); renderDev(); };
  $('dvMenu').onclick = () => toMenu();
}
function skipIntro() { if (st.intro) { st.intro.banner = true; st.intro.t = st.intro.roulette + st.intro.fly + st.intro.count; $('roulette').classList.add('hidden'); $('banner').classList.add('hidden'); bannerTimer = 0; updateIntro(0); } }
function togglePath(on) {
  dev.showPath = on;
  if (st.pathOverlay) { scene.remove(st.pathOverlay); st.pathOverlay = null; }
  if (!on || !st.party || !st.arenaKey) return;
  const a = st.party.w.grid.arenas.find((a) => a.key === st.arenaKey);
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.35, depthWrite: false }), geo = new THREE.PlaneGeometry(0.3, 0.3);
  for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) if (a.cells[j][i]) { const q = new THREE.Mesh(geo, m); q.rotation.x = -Math.PI / 2; q.position.set((a.x0 + i * a.cell + a.cell / 2) * S, 0.5, -(a.y0 + j * a.cell + a.cell / 2) * S); g.add(q); }
  scene.add(g); st.pathOverlay = g;
}
function toMenu() {
  st.mode = 'menu'; st.party = null; st.intro = null; st.hold = 0; clearActors(); fx.clear();
  for (const g of Object.values(st.arenas)) g.visible = false; st.arenaKey = null;
  podium.visible = false; menuGroup.visible = true;
  $('menu').classList.remove('hidden');
  for (const id of ['hud', 'end', 'mid', 'roulette']) $(id).classList.add('hidden');
  $('fade').style.opacity = '0';
  audio.setMusic(true, 'menu'); V.setNight(0);
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), T = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T += dt;
  for (const c of V.clouds.children) { c.position.x += c.userData.spd * dt; if (c.position.x > 40) c.position.x = -40; }
  if (st.mode === 'menu') {
    V.setNight(0); V.setSky(0xff5fa8, 0xffb3d9, 0x9a4dff);
    const hero = menuGroup.userData.hero;
    const aspect = innerWidth / innerHeight;
    menuGroup.position.set(aspect > 1 ? -0.9 : 0, 0, 0);
    camera.position.set(0, 1.35, aspect > 1 ? 6.2 : 8.5); camera.lookAt(0, aspect > 1 ? 0.95 : 0.4, 0);
    V.sun.position.set(3, 7, 6); V.sun.target.position.set(0, 0, 0);
    if (hero) {
      const ud = hero.userData; const k = T * 2;
      hero.rotation.y = Math.sin(T * 0.6) * 0.5;
      ud.rig.position.y = Math.max(0, Math.sin(k * 1.5)) * 0.12;
      const sq = 1 + Math.sin(k * 3) * 0.04; ud.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      ud.arms[1].rotation.z = 0.55 + (Math.sin(T * 1.3) > 0.6 ? 1.9 + Math.sin(T * 14) * 0.3 : 0);
      ud.arms[0].rotation.z = -0.55;
    }
    for (const l of menuGroup.userData.lights) l.material.color.setHSL(((T * 0.3 + l.userData.i / 24) % 1), 0.9, 0.75);
    for (const c of menuGroup.children) if (c.userData.spin !== undefined) { c.rotation.x += c.userData.spin * dt; c.rotation.y += c.userData.spin * 0.7 * dt; c.position.y += Math.sin(T + c.userData.bob) * dt * 0.2; }
  } else if (st.mode === 'game' && st.party) {
    const p = st.party, w = p.w;
    updateIntro(dt);
    if (!(st.hold > 0)) { steerInput(); st.acc += dt * (online() ? 1 : st.speed); }
    let steps = 0;
    if (online()) {
      // run the ticks the server has confirmed: real time, faster when we're behind
      const behind = st.mp.ready - st.mp.tick;
      if (behind > 6) st.acc += DT * Math.min(60, behind - 2);
      if (behind <= 0) st.acc = Math.min(st.acc, DT);
    }
    while (st.acc >= DT && steps < 400 && !(st.hold > 0)) {
      if (online()) {
        if (st.mp.tick >= st.mp.ready) break;
        const n = ++st.mp.tick, cmds = st.mp.cmds.get(n);
        if (cmds) { st.mp.cmds.delete(n); for (const [slot, c] of cmds) applyCmd(p, slot, c); }
      }
      for (const u of w.units) { u.px = u.x; u.py = u.y; }
      p.update(); st.acc -= DT; steps++;
      if (online()) mpAfterTick(p);
      processEvents();
      if (st.mode !== 'game') break;
    }
    if (online()) mpSyncHold();
    if (st.hold > 0) { st.acc = 0; processEvents(); }
    if (st.mode === 'game') {
      const alpha = Math.min(1, st.acc / DT);
      syncActors(alpha, dt, T);
      fx.syncMissiles(w.missiles, alpha);
      updateHover(T);
      if (st.intro) introCamera(dt);
      else if (st.view) frame(playRect(), null, dt, false, true);
      rig.shake = Math.max(w.quake / 500 * 0.25, rig.shake * Math.exp(-dt * 8));
      const theme = st.arenaKey && themeFor(st.arenaKey);
      st.night += ((theme?.night ? 1 : 0) - st.night) * Math.min(1, dt * 1.5);
      V.setNight(st.night); V.setSky(0x5bc4ff, 0xbfe9ff, 0xffd6ec);
      updateHud();
      if (dev.open) { const info = $('dvInfo'); if (info) info.textContent = `t=${w.t.toFixed(1)}s units=${w.units.length} missiles=${w.missiles.length}`; }
    }
  } else if (st.mode === 'end') {
    st.endT += dt;
    frame({ x0: PODIUM_AT.x - 420, y0: PODIUM_AT.y - 330, x1: PODIUM_AT.x + 420, y1: PODIUM_AT.y + 280 }, null, dt, st.endT < 0.05);
    for (const b of podium.children) if (b.userData.kind === 'bean') { const k = T * 3 + b.userData.menuPhase; const ud = b.userData; ud.rig.position.y = Math.max(0, Math.sin(k * 2)) * 0.3; ud.arms[0].rotation.z = -2.4 + Math.sin(k * 4) * 0.4; ud.arms[1].rotation.z = 2.4 - Math.sin(k * 4) * 0.4; }
    V.setSky(0xff5fa8, 0xffb3d9, 0x9a4dff); V.setNight(0);
    if (Math.random() < dt * 6) fx.burst(PODIUM_AT.x + (Math.random() - 0.5) * 500, PODIUM_AT.y + (Math.random() - 0.5) * 200, 400, 20, { speed: 2, up: 2, grav: 3, life: 3 });
  }
  fx.update(dt, T);
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.add('hidden'); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.add('off'); }
  if (stampT > 0) { stampT -= dt; if (stampT <= 0) nextStamp(); }
  composer.render();
}
requestAnimationFrame(loop);
audio.setMusic(true, 'menu');
window.addEventListener('pointerdown', () => audio.start(), { once: true });


// ------------------------------------------------------------------ online
const NET = { games: 8, rooms: [], room: null, pendingJoin: null };
function netErr(text) { const e = $('netErr'); e.textContent = text; e.classList.remove('hidden'); clearTimeout(netErr.t); netErr.t = setTimeout(() => e.classList.add('hidden'), 3500); }
function showNet(view) {
  $('net').classList.remove('hidden'); $('menu').classList.add('hidden');
  for (const id of ['netRooms', 'netRoom', 'netPass']) $(id).classList.toggle('hidden', id !== view);
}
async function openOnline() {
  audio.start(); audio.play('click');
  if (!st.net?.open) {
    st.net = new Net(netHandlers);
    try { await st.net.connect(); } catch { st.net = null; netErr('Can’t reach the game server'); return; }
  }
  st.net.send({ t: 'hello', name: st.name, skin: st.mySkin });
  showNet(NET.room ? 'netRoom' : 'netRooms'); renderRooms();
}
function closeOnline() {
  $('net').classList.add('hidden'); $('menu').classList.remove('hidden');
  if (st.net) { st.net.close(); st.net = null; } NET.room = null; st.mp = null;
}
function renderRooms() {
  const el = $('roomList');
  if (!NET.rooms.length) { el.innerHTML = '<div class="none">No rooms yet — create one!</div>'; return; }
  el.innerHTML = NET.rooms.map((r) => `<button data-room="${esc(r.id)}" ${r.state !== 'lobby' || r.players >= r.max ? 'disabled' : ''}><span>${r.locked ? '🔒 ' : ''}${esc(r.name)}</span><span class="meta">${r.state !== 'lobby' ? 'playing · ' : ''}${r.players}/${r.max} · ${r.games === 52 ? 'all games' : r.games + ' games'}</span></button>`).join('');
  el.querySelectorAll('[data-room]').forEach((b) => (b.onclick = () => {
    const r = NET.rooms.find((x) => x.id === b.dataset.room); if (!r) return;
    audio.play('click');
    if (r.locked) { NET.pendingJoin = r.id; $('passTitle').textContent = `Password for ${r.name}`; $('passInput').value = ''; showNet('netPass'); $('passInput').focus(); }
    else st.net.send({ t: 'join', id: r.id });
  }));
}
function segSet(el, n) { [...el.children].forEach((b) => b.classList.toggle('on', +b.dataset.n === n)); }
function renderRoom() {
  const r = NET.room; if (!r) return;
  $('roomTitle').textContent = `${r.locked ? '🔒 ' : ''}${r.name}`;
  $('roomPlayers').innerHTML = r.players.map((pl) => `<div class="pl"><i style="background-image:url(${skinDataURL(pl.skin?.main || BEAN_COLORS[pl.slot], pl.skin || {}, 40, 40)});background-size:cover">${esc(pl.skin?.emoji || '')}</i>${esc(pl.name)}${pl.host ? '<small>host</small>' : ''}</div>`).join('');
  const host = r.host === NET.you;
  segSet($('roomGames'), r.games); $('roomGames').classList.toggle('ro', !host);
  $('roomStart').classList.toggle('hidden', !host); $('roomWait').classList.toggle('hidden', host);
}
const netHandlers = {
  rooms: (m) => { NET.rooms = m.rooms; renderRooms(); },
  room: (m) => {
    const before = NET.room?.players?.map((p) => p.slot) || [];
    NET.room = m.room; NET.you = m.you;
    if (st.mp && st.mode !== 'menu') { for (const s0 of before) if (!m.room.players.some((p) => p.slot === s0)) toast(`${st.party?.name(s0) ?? 'Someone'} disconnected`); return; }
    showNet('netRoom'); renderRoom();
  },
  error: (m) => { netErr(m.text); if (m.code === 'password') showNet('netPass'); },
  start: (m) => {
    audio.play('new');
    st.mp = { tick: 0, ready: 0, cmds: new Map(), round: 0, held: false, voted: -1, votes: { n: 0, need: 1 } };
    $('net').classList.add('hidden');
    startParty(null, { online: m });
  },
  f: (m) => {
    if (!st.mp) return;
    for (const [n, slot, c] of m.c) { let a = st.mp.cmds.get(n); if (!a) st.mp.cmds.set(n, (a = [])); a.push([slot, c]); }
    st.mp.ready = m.a + m.n - 1;
  },
  votes: (m) => { if (!st.mp) return; st.mp.votes = m; if (m.skipped) toast('Minigame skipped'); renderSkip(); },
  desync: () => { st.desyncs = (st.desyncs || 0) + 1; toast('Out of sync with the room'); },
  lobby: () => { st.mp = null; $('pause').classList.add('hidden'); toMenu(); showNet('netRoom'); renderRoom(); },
  close: () => { const was = !!st.mp || !$('net').classList.contains('hidden'); st.net = null; NET.room = null; if (st.mp) { st.mp = null; toMenu(); } $('net').classList.add('hidden'); $('menu').classList.remove('hidden'); if (was) netErr('Disconnected from the server'); },
};
function renderSkip() {
  const b = $('skipBtn'), v = st.mp?.votes || { n: 0, need: 1 }, mine = st.mp?.voted === st.mp?.round;
  b.textContent = mine ? `Voted to skip ${v.n}/${v.need}` : v.n ? `Vote to skip ${v.n}/${v.need}` : 'Vote to skip';
  b.classList.toggle('voted', mine);
}
function mpAfterTick(p) {
  const mp = st.mp;
  if (p.v.round !== mp.round) { mp.round = p.v.round; mp.votes = { n: 0, need: mp.votes.need }; st.net.send({ t: 'round', r: mp.round }); renderSkip(); }
  if (mp.tick % 200 === 0) {
    let h = 0; for (const u of p.w.units) if (u.alive) h = (h * 31 + Math.round(u.x) * 7 + Math.round(u.y) + u.id) | 0;
    st.net.send({ t: 'hash', n: mp.tick, h: h + ':' + p.scores.join(',') });
  }
}
function mpSyncHold() { const h = st.hold > 0; if (h !== st.mp.held) { st.mp.held = h; st.net.send({ t: 'hold', on: h }); } }
function disconnect() { $('pause').classList.add('hidden'); closeOnline(); toMenu(); }

$('online').onclick = openOnline;
$('netBack').onclick = () => { audio.play('click'); closeOnline(); };
$('newGames').onclick = (e) => { const n = +e.target.dataset?.n; if (n) { NET.games = n; segSet($('newGames'), n); audio.play('click'); } };
$('roomCreate').onclick = () => { audio.play('click'); st.net?.send({ t: 'create', name: $('roomName').value.trim() || `${st.name}’s room`, password: $('roomPass').value, games: NET.games }); };
$('roomGames').onclick = (e) => { const n = +e.target.dataset?.n; if (n && NET.room?.host === NET.you) { st.net.send({ t: 'settings', games: n }); audio.play('click'); } };
$('roomStart').onclick = () => { audio.play('click'); st.net?.send({ t: 'start' }); };
$('roomLeave').onclick = () => { audio.play('click'); st.net?.send({ t: 'leave' }); NET.room = null; showNet('netRooms'); renderRooms(); };
$('passOk').onclick = () => { st.net?.send({ t: 'join', id: NET.pendingJoin, password: $('passInput').value }); };
$('passInput').onkeydown = (e) => { if (e.key === 'Enter') $('passOk').onclick(); };
$('passCancel').onclick = () => { showNet('netRooms'); };
$('skipBtn').onclick = () => { if (!st.mp || st.mp.voted === st.mp.round) return; st.mp.voted = st.mp.round; st.net.send({ t: 'vote', r: st.mp.round }); audio.play('click'); renderSkip(); };
$('pauseResume').onclick = () => $('pause').classList.add('hidden');
$('pauseQuit').onclick = disconnect;
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (st.mp && (st.mode === 'game' || st.mode === 'end')) $('pause').classList.toggle('hidden');
  else if (!$('netPass').classList.contains('hidden')) showNet('netRooms');
});

// test hook (used by the automated screenshot harness)
window.__bean = { st, startParty, toggleDev, toMenu, skipIntro };
