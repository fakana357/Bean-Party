# Porting an Uther Party minigame to Bean Party

You port minigames from the Warcraft III map `UtherParty_4.0` into this engine. The 5 finished games in `js/sim/games/` (`peon.js`, `kaboom.js`, `mortar.js`, `stop.js`, `roadkill.js`) are the reference. Read at least `kaboom.js`, `mortar.js` and `roadkill.js` before writing anything.

## Rules of the port ("polished", not bug-for-bug)

- **Keep the spirit and the numbers** of the original: arena, spawn points, enemy types, speeds, timers, spawn cadence, win condition, and scoring style (survival or race).
- **Fix anything that plays badly.** Question the original designers: confusing hidden HP, invisible rules, WC3 bugs, ability-heavy fiddliness and stuck states get redesigned into a clear, readable rule.
- **One touch = out.** Player beans are created with `G.bean(...)` and die from any damage or `w.kill(b)`. Prefer explicit hit checks (distance or footprint) every 0.05 s over WC3 damage/HP.
- **Controls:** by default the player only moves (WASD/joystick/click). If the game needs an action, implement `action(G, u, target, aim)`: a click on a bean passes `target`, Space passes `aim` (a world point near the cursor). Return `true` if something happened. Also implement `canTarget(G, u, t)` so the client can highlight clickable beans. If the game needs no movement (like Hot Mortar), set `noMove: true` and the bean's `baseSpeed = 0`. If a second key really is needed, write it in `hint` (for example "E = ...") and say so in your report. That needs client work and is to be avoided.
- **Bots must be decent**: copy the original AI's intent and add simple dodging or gap-waiting so rounds are fun. A round should usually last 20–90 s and must always end (add a timer if needed).
- `hint` is a single short line shown under the screen all round. `title` is a pun on the original name with "Bean" in it, e.g. "Peon Pandemonium" became "Bean Pandemonium". `orig` is the original name.
- Visuals are themed as a candy/party world, not WC3 orcs/undead. Enemies are machines, candy creatures and toys.

## Files you own

- `js/sim/games/<id>.js`: one file per minigame. **Do not edit any other sim file.**
- `js/client/looks/<group>.js`: optional custom 3D looks for your enemy unit types and arena themes (see below). One file per helper.
- After adding files run `python3 /home/claude/tools/genindex.py` (it regenerates `js/sim/games/index.js` and `js/client/looks/index.js`; safe to run any time).
- **Do not edit** `engine.js`, `party.js`, `data.js`, `main.js`, `actors.js`, `arena.js`, `fx.js`, `feel.js`, `scene.js` or `index.html`. If you truly need an engine feature, implement it inside your game file using the world API. List anything you couldn't do in your final report.

## Game module shape

```js
import { P_ENEMY, P_NEUTRAL, center, polar, offset, dist, angleTo } from '../engine.js';
export default {
  num: 12,                       // Triggers_Events index in the map (see table)
  id: 'dark', title: 'Dark Bean Forest', orig: 'Dark Forest',
  subtitle: 'Survive as long as possible!', // original quest text
  arena: 'dark_forest',          // key in MAP.arenas (lowercased rect name, see table)
  rect: 'Dark_Forest',           // region the camera frames; must be REGIONS key
  clip: ['Dark_Forest', 64, 64], // crop arena walkable cells to region + margin (x, y)
  kind: 'survival' | 'race',
  hint: 'One line: what to do and what kills you.',
  viewPad: 40,                   // optional: padding around rect for the camera
  fitAll: false, noMove: false,  // optional
  action(G, u, target, aim) {}, canTarget(G, u, t) {}, // optional
  install(G) { /* register triggers, return the init trigger */ },
};
```

`install(G)` mirrors the JASS triggers. You get:

- `G.w`: the `World` (see `js/sim/engine.js`), `G.T` (triggers by name), `G.R` (regions as `{x0,y0,x1,y1}` by JASS name, e.g. `R.Dark_Forest`), `G.v` (round variables: `v.ante`, `v.tiesPossible`, `v.focus`...).
- `G.trig(name, function* (e) {...}, { cond })` creates a trigger (disabled by default; switched off automatically between rounds). Chain `.every(seconds)` for periodic, or `.on('death')`. Inside generators `yield seconds` waits (PolledWait), `yield 0` = next tick. **Trigger names must be unique across all games: prefix them with your id.**
- `G.trig(...).execute(ev)` runs a trigger now. `e.trig.enabled` tells whether the trigger is still on (use after waits; also check `G.round()` against a saved round number in spawned threads).
- `G.forPlaying(fn(slot))`, `G.forBots(fn(slot))`, `G.isBot(slot)`, `G.keyOf(slot)` (key units of a slot), `G.beans()` (alive key units).
- `G.bean(type, slot, point, { speed })` creates the player's bean (collision 24, one-hit, no auto-attack, starts apart from other beans). Use the original unit type id so the right accessory/look is used, or any id. Then `G.addKey(units)`.
- `G.cameraBounds(R.X)` (call once in init, required: it also selects the arena), `G.say(title, subtitle)` (required: it starts the intro), `G.startTimer(sec, label)`, `G.music(id)`, `G.sound(id)`, `G.boom(unit, chainRadius)` (explode a bean with an effect).
- Shared framework triggers you enable in init: survival games use `T.SurvivalDeath` (and `T.TieDeath` with `v.tiesPossible = true` when simultaneous deaths are possible), plus `T.SurvivalExpire` if you start a timer. Race games set `v.ante = 8`, enable `T.RaceDeath` + `T.RaceExpire` (with a timer), and on reaching the goal do `v.focus = unit; T.RaceFinish.execute()`. Enter-rect events: `G.trig('XFinish', fn, {cond}); w.handlers.push({ kind: 'enter', trig: T.XFinish, rect: R.X_Finish });`. Team or other scoring: award points through these frameworks only.

World API you will use (`w = G.w`):
`w.create(type, owner, point, facingDeg)`, `w.remove(u)`, `w.kill(u)`, `w.explode(u)`, `w.issue(u, {type:'move', x, y} | {type:'stop'} | {type:'steer', dx, dy} | {type:'patrol', a, b, leg:true})` (or set `u.order` directly for scripted units), `w.alive(filter)`, `w.ofType(t)`, `w.ofPlayer(p)`, `w.inRange(p, r, filter)`, `w.randomIn(rect)`, `w.rng.real/int/dir/pick/next`, `w.lob(src, x, y, {speed, type, onImpact})` (arcing projectile), `w.shoot(src, target, {speed, type, onHit})` (homing projectile), `w.spawn(function* () {...})` (a thread), `w.grid.walkable(x, y, r)`, `w.grid.path(from, to, r)`, `w.dest` / `w.destIn(rect)` / `w.setDest(d, alive)` (destructibles: gates, trees), `w.restoreDestructables(rect)`, `w.t` (seconds), `w.quake = 500` (camera shake), `w.emit({...})` (client effect, below). Units: `u.x, u.y, u.facing, u.baseSpeed, u.coll, u.alive, u.paused, u.invuln, u.order, u.owner, u.type`, and any custom field you like. `P_ENEMY` = Player(11), `P_NEUTRAL` = neutral passive. Player slots are 1–8. Unit stats come from `STATS.units[type]` (`import { STATS } from '../data.js'`). Units of types not in STATS fail: use a type from the table or an existing one.

Client effects you can emit with `w.emit`: `{k:'boom', x, y, r}` (explosion + optional ring radius), `{k:'warn', id, x, y, r, dur, hot}` (telegraph ring filling up over dur), `{k:'lava', x, y, r, dur}` (glowing hazard puddle), `{k:'ring', x, y, r, color, dur}`, `{k:'teleport', x, y}`, `{k:'impact', x, y, type, r}`, `{k:'text3d', x, y, text, color}`, `{k:'sfx', id}` with id in `pop boom bigboom splat throw shoot zap out ding win draw new red yellow green freeze click fuse tick`, `{k:'centerFlame', x, y}` (bonfire), `{k:'light', c:'red'|'yellow'|'green'}` (traffic-light HUD). Deaths, spawns and projectiles render automatically.

## Looks (optional, `js/client/looks/<group>.js`)

Units without a custom look render as a generic candy creature (or a candy tower if speed is 0), and player beans render automatically. To give enemies personality, export:

```js
import * as THREE from 'three';
export const LOOKS = {
  ugar: (u, { THREE, M }) => { const g = new THREE.Group(); /* meshes, ~0.01 scene units per WC3 unit, +y up, facing +z */ return g; },
};
export const THEMES = { dark_forest: { a: '#2f2a5c', b: '#3b3570', line: '#8a6cff', side: '#2b2350', bump: [0x6b5bb0, 0x2ee6c5], deep: '#15102e', night: 1 } };
```

Keep looks simple: a few primitives, candy colours. A look's `userData` may be empty.

## Data and tools

- The original script is at `/home/claude/map/out/war3map.j`. Summarise one minigame with `python3 /home/claude/tools/jsum.py <Prefix>` (e.g. `Dark`, `Kodos`), which strips boilerplate. Strings (quest texts): `/home/claude/map/out/war3map.wts` (TRIGSTR_xxx).
- Regions (rects) are in `MAP.regions`. Check an arena's walkable grid with `node -e "import('/home/claude/game/js/sim/data.js').then(m=>{const a=m.MAP.arenas['dark_forest'];console.log(a.x0,a.y0,a.w,a.h);console.log(a.rows.slice().reverse().join('\n'))})"` (`.` = walkable, `#` = blocked, 32 units per cell, row 0 = lowest y).
- Test with bots: `node test/one.mjs js/sim/games/<file>.js 3 8` (3 runs, 8 players). It must end every run without errors, with sensible scores. Also test with 2 and 4 players.
- Optional visual check: `cd /home/claude/tools && PAGE=index.html timeout 200 python3 shot.py shots/<name>.png "__bean.startParty(<num>)||WAIT300||__bean.skipIntro()" 6000`, then look at the png. This is slow (software rendering), so use it sparingly.

## Minigame table

| num | JASS prefix | rect / arena key | units in script |
|---|---|---|---|
| 1 | Peon | Peon_Pandemonium / peon | ncat ocat opeo |
| 2 | Rat | Rat_Maze / rat_maze | ches ncop nrat nspr |
| 3 | Kaboom | Kaboom_Room / kaboom | ewsp ngsp |
| 4 | Mortar | Mortar / mortar | hctw hmtm |
| 5 | Clean | Clean_Crew / clean_crew | hmpr ugho |
| 6 | Way | Way_of_the_Bow / way_of_the_bow | earc |
| 7 | Roadkill | Roadkill_Challenge / road | hmtt ncop nmrl |
| 8 | Covert | Covert_Kitty / covert_kitty | esen nbal ncop |
| 9 | Polymorph | Polymorph_Ring / polymorph_ring | hsor nsqa |
| 10 | Tauren | Tauren_Tragedy / tauren_tragedy | AOsh AOws Otch hbar hfoo |
| 11 | Bomb | Bomb_Baldwin / bomb_baldwin | h000 hgyr hhou hpea |
| 12 | Dark | Dark_Forest / dark_forest | edot uabo ugar |
| 13 | Kodos | Hungry_Hungry_Kodos / hungry_hungry_kodos | LTg1 LTg3 npig nvlk okod |
| 14 | Raider | Raider_Relay / raider_relay | ACen edcm ehip ncop nzep orai |
| 15 | Treant | Treant_Valley / treant_valley | efon ngno |
| 16 | Skeleton | Skeleton_Sonata / skeleton_sonata | Awan hmpr ugho uske |
| 17 | Stampede | Stampede / stampede | ANst Nbst ogru |
| 18 | Stop | Stop_and_Go / stop | ncop nsea uzg1 |
| 19 | Push | Push_the_Ogre / push_the_ogre | hkni ncop nogr |
| 20 | Spike | Spike_Pit / spike_pit | hmil |
| 21 | Salamander | Salamander_Sizzle / salamander_sizzle | DTsh ewsp nslr |
| 22 | Obey | Obey_Archimonde / obey_archimonde | Uwar nchw |
| 23 | Whack | Whack_a_Fiend / whack_a_fiend | AHtb AHtc Hmkg ucrm ucry ugho |
| 24 | Horse | Horse_Race / horse_race | ncp2 nwzg |
| 25 | Masquerade | Masquerade / masquerade | AUav Udre nvl2 otrb |
| 26 | Crab | Crab_Island / crab_island | ACmi Awan ncrb nsc2 nsc3 nscb uban |
| 27 | Blinky | Blinky_the_Bear / blinky_the_bear | ncop ngzc nplb |
| 28 | Abombinations | Abombinations / abombinations | hrif u000 |
| 29 | Sleepy | Sleepy_Time / sleepy_time | emtg ngst |
| 30 | Nature | Nature_Circle / nature_circle | A003 A004 A005 edoc ngz1 nqb1 nwe2 |
| 31 | Skull | Skull / skull | AEev AEim AEmb ANca ANht ANrf ATg1 AUav AUcs AUsl DTes Edem Nplh OTsp Utic glsk nbal ncop ndqn ndqv nfgb ngme ninf nsgt nsln nspr phea pnvl pspd |
| 32 | Minotaur | Minotaur_Maze / minotaur_maze | nskk otau shwd |
| 33 | Quillboar | Quillboar_Mile / quillboar_mile | Awan ncop npig nqbh |
| 34 | Unseen | Unseen / unseen | ncop ndrf odoc |
| 35 | Destruction | Destruction_Dance / destruction_dance | Obla |
| 36 | Pork | Pork_the_Piggy / pork_the_piggy | nfbr ohun |
| 37 | Plague | Plague / plague | nzom uaco |
| 38 | Troubled | Troubled_Waters / troubled_waters | h005 hwat ncp3 nhmc |
| 39 | Sheep | Sheep_Shearers / sheep_shearers | e000 ncop nshe |
| 40 | Doggy | Doggy_Hell / doggy_hell | iwbr n000 ncop ndog u001 umtw |
| 41 | Ancient | Ancient_Punisher / ancient_punisher | Nbrn clsd etrp ledg |
| 42 | Spellbreaker | Spell_Breaker_Blood / spell_breaker_blood | hspt nbal ndmg ninf ucs1 ucs2 ucsC uske uskm |
| 43 | Dune | Dune_Worm_Distress / dune_worm_distress | ndwm nowb |
| 44 | Tides | Tides_of_Darkness / tides_of_darkness | hdes hshy odes oshy |
| 45 | Flight | Flight_of_the_Footmen / flight_of_the_footmen | h002 h003 hgtw ncop |
| 46 | Tower | Tower_Defense / tower_defense | AHab AHwe Hamg h004 hatw |
| 47 | Wheel | Wheel_of_Fire / wheel_of_fire | ANpi ewsp nsat |
| 48 | Death | Death_Trap / death_trap | ncop nftr |
| 49 | Clandestine | Clandestine_Kitty / clandestine_kitty | Emoo bzbf nbal ncop |
| 50 | Battle | Tauren_Tragedy / tauren_tragedy | ANbf ANdh Npbm rman |
| 51 | Fel | Peon_Pandemonium / peon | ncat ncpn ocat |
| 52 | Sea | Tides_of_Darkness / tides_of_darkness | hbsh |
