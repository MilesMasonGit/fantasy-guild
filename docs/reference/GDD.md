# Tabletop Guild — Game Design Document

**Status:** reference, describes the game **as built** on `main` (v0.8.0).
**Last checked against code:** 2026-10-06 (five code surveys, key numbers
spot-checked by the director).
**Owner of the vision section:** the owner (interview 2026-10-06).

How to use this document:
- It says **what the game is and how it works today**, with the key rules and
  numbers, and points at the code. Code and `data/` win if they disagree.
- Every system is labelled **Built**, **Dormant** (code exists, switched off
  or unreachable), **Latent** (code works, no shipped content uses it),
  **Partial** or **Planned**.
- Numbers marked *placeholder* are known to be unbalanced and will change.
- Update it when a system changes. Wrong GDD lines are worse than missing ones.

---

## 1. Vision

**Title.** **Tabletop Guild** (owner, 2026-11-22), replacing the working title
Fantasy Guild after the owner's planned title turned out to be taken. A quick
web check found no game, app or store listing by that name and no trademark
filing, but not a legal search; tabletopguild.com and .net are taken
(tabletopguildgame.com and playtabletopguild.com looked free). The guild-idle
field is crowded with "Guild…" names, so the tabletop half carries the
identity. A trademark search in the US and Canada comes before any spend on
launch. The in-game rename is T-664; the repository, save keys and code
comments keep the old name.

**Pitch.** An idle game where you run an adventurers' guild by shaping a
living tabletop: you place resources, plant flags, and your heroes work, fight
and grow on their own.

**Design pillars.** Check every new feature against all four.

1. **The mat is a living place.** Things grow, spawn and transform; heroes
   walk about their work (enemies stand where they appear: owner, 2026-11-05).
   The ideal is an ecosystem that mostly feeds itself, which the player steers
   ("nothing arrives, everything transforms").
2. **Set up, don't micromanage.** The player arranges the operation: where
   Tokens stand, where flags go, what each station makes. Heroes act on their
   own. Simple enough for an idle game, with no systems that aren't needed.
3. **Variety per Token.** Guidelines, not laws: any Token may break a pattern
   with its own rules. Skills should feel mechanically different, not just be
   different recipe lists.
4. **Value comes from effort.** An item's worth derives from the effort to
   make it. The CMS's economic simulator enforces this at authoring time.

**How it's played.** Both ways: pleasant to leave open and watch (the living
mat), and progress continues between check-ins. Time away will be **simulated
on return** (real offline progress, a crunch track; see §10).

**Starting a game** (brief 450 S4). Picking an empty save slot opens the
**new-game screen**: the player names the Guild (shown on its slot; renamed later
in Settings, Game tab), looks at the world's first three rings and rolls another
with **Reroll** as often as they like, for nothing (what lies past ring 3 stays a
surprise), and makes the **first hero**: name, portrait and flag colour, with the
hero edit window's own controls. **Begin** starts play with that Guild, that
world and that hero.
*(`NewGameScreen.jsx`, `World.rollWorld`, `GuildName.js`)*

**Long-term pull.** Exploring new Regions through the Atlas (§10, the world
map): settle a place, work it, settle a better one further out. A settled
place is the guild's for good (no abandoning). Beside it, the pull is skill
levels, their milestone perks and Guild Hall upgrades.

---

## 2. The core loop as built

1. **A new game** opens in the **Starter Camp** (Atlas A7): the Tokens, their
   points and the opening Bank the owner laid out in a dev game, saved with the
   QA panel's Save camp to CMS, reviewed on the CMS's Starter
   Camp page and synced into `data/starterCamp.json`. Until one is synced it is
   the built-in camp: the Guild Hall in the middle of the mat, an Oak Forest and
   a Copper Mine either side (320 u away), and 3 Oak Seed, 10 Oak Wood and
   2 Wheat Seed in the Bank. The **first hero** stands in it, made on the
   new-game screen (§1), in Bunk Beds' free first rank.
   *(`StarterCamp.js`, `EngineBootstrap.createDefaultGameData`)*
2. **More heroes** come from the Guild Hall: each further Bunk Beds rank brings
   one at once, auto-named, every skill at level 1, renamed with the quill.
3. **Send a hero to a job**: drag a hero (their figure on the mat, or on the
   hero bar) onto a Token. They walk out of the Hall and work only that Token:
   a tree, a vein, a station, a Field, an enemy. Dragged onto a **camp** (a
   Logging Camp, a Mining Camp, a Fishing Hut, a Farmstead), they work every
   Token of its kind around it, one at a time. Onto bare ground, they go there
   and wait; onto the Guild Hall, they go home.
4. **Work makes loot**: each finished cycle drops items as loot on the mat. The
   player hovers loot to collect it into the Bank (auto-collect is optional).
5. **Spend items** in the Shop (drag a Token onto the mat, pay on drop), on
   Foundations that are built into stations, on recipes, and on Guild Hall
   upgrades. **Items are the only currency**; gold is retired.
6. **Spawners keep the mat alive**: forests, mines and camps spawn new Tokens up
   to an allowance, some paying an item per spawn (e.g. a seed).
7. **Limes**, the guide, teaches the game in eight short lessons, then names the one big goal
   (settle a place). Bounties are cut for now (owner 2026-11-21, T-637).

---

## 3. The playmat and Tokens

### The mat — Built
- One continuous surface, **no grid**. 12 steps of 160 u wide and 6.5 tall =
  **1920 × 1040 u** (aspect 13/24). A save or Region left on a bigger mat is pulled
  inside its edge on load and on travel. *(`matGeometry.js`, `matTuning.js`, `MatResize.js`)*
- A dropped Token lands **exactly where it is let go** if the spot is legal;
  otherwise it nudges to the nearest legal spot within 160 u, otherwise it flies
  back. A legal spot: art circle inside the mat; not crowding a neighbour
  (hitbox 90 % of the art radius, up to 30 % overlap: two standard Tokens 81 u
  apart at the closest); breaks no `Cannot` rule. *(`MatPlacement.js`)*
- **One spot for a Token's whole cycle** (owner, 2026-11-15 and 2026-11-17; brief 670 M3):
  a Token takes the room of the largest thing it can become, though it is drawn at its own
  size. A Stump takes its Tree's room, a Foundation the room of the largest
  building it can build, for every drop, arrival, planting and push and at the mat's edge,
  so nothing can be put down tight against the small form and a tree that grows back or a
  building that finishes stands exactly where it stood. Clicks, drawing and where a hero
  stands still use the drawn size. A squeeze already in an old save is not repaired: its
  tree moves aside when the Stump grows. *(`MatPlacement.roomRadiusOf`)*
- **Who draws over whom**: Tokens and flags by where they stand, lower on the mat in
  front; a Token being worked in front of those at rest. **Heroes are always on top of
  every Token and flag**, working, idle or walking, lower on the mat in front of each
  other. Over the heroes: loot, plates, numbers, callouts, bubbles. **Hovering a Token
  doesn't move it** in the stack; only its name and gear come up over the rest. A press goes to the Token
  whose centre is nearest the pointer, whichever is drawn on top, except on a hero's
  drawn pixel, which is the hero's. *(`matLayers.js`, `pressRouting.js`)*
- **A Forest or Orchard plants a full Tree in its reach** (no Saplings, owner 2026-11-20,
  T-596), at a gap that leaves room for what its neighbours will grow back into, so a Stump
  growing back moves nothing and no tree drifts out of reach. With no such spot in reach it
  plants nothing and waits, by the no-room rule (§3 Spawners). *(`EffectActions.js`)*
- **A player drop never pushes anything.** Arrivals (spawns, growth, builds)
  may push **spawned** Tokens aside; **placed Tokens are never pushed**, nor an
  enemy stepping to open space before its fight (§6, Fights).
- **Fixed Tokens** can't be dragged or pushed: a map's node, a Starter Camp
  fixture, a landmark, a planted Token (spawned into a growth chain), and every
  copy of a type marked **Stays where it stands** (`staysPut`, a box in the CMS
  Token editor: trees, fruit trees and veins), wherever it came from, an old save
  included. Demolition still takes any of them but a map's node (unless its type
  can be cleared: Demolition below), the camp's and a landmark. *(`FixedTokens.js`)*
- **Token cap: 128 Tokens**, fixed (owner, Atlas D-9; the Guild Hall's Token Cap star
  retired with brief 320, so a save's ranks there are dropped). The cap is the guild's but
  counts only the Region the guild is in (§10): every Token there, placed or
  spawned, and the **landmarks** (Token
  types marked `landmark`: the endgame sites, Atlas D-1; none are authored
  yet); not the Hall. A landmark is never pushed, cannot be moved by
  the player or demolished, and its inspection shows what its challenge needs
  (`Landmarks.js`). Enforced by the Shop, by recipes that make Tokens and by
  rule spawns; a spawner waits while the mat is at the cap (as well as at its
  family limit). **Outside the cap**, like event Tokens: a settled place's
  arrival enemies (they never block the player's building, owner 2026-11-20,
  T-609; room for them is the no-room rule, §3 Spawners) and a new place's own
  Tokens until the player adds to it (T-640). A save already over the cap keeps
  everything; adding waits until it is under. The cap's number, like the
  reach's and demolition's, belongs on the tuning page (T-253). *(`MatCap.js`)*
- Rarity has no gameplay rule (the old one Mythic at a time is retired, owner
  2026-11-20).
- **Terrain** (the ground under the Tokens) is **Built** (brief 80): each Region's stored cell map
  drawn as pixel ground, one look per terrain per Region, meadow where a Region stores none (the
  Starter Camp). Static: nothing on the mat changes it. *(`TerrainCanvas.jsx`)*
- **Water** is shapes stored with the cell map (lakes, ponds, tarns, rivers, sulphur springs, the
  edge sea), made with the layout and drawn where they lie. **Rivers (brief 370 R1, the owner's picks
  A and C)**: a river swings side to side a bend at a time, wider in its bends' pools and narrower
  between them, never doubling back and never narrower than a placing cell. **Each map draws its
  own** from its seed (`RIVER_VARIETY`): how much its rivers wind, how wide their wider stretches
  run, and how near the Hall they may pass (bent round its clearing). A split's side channel leaves
  and rejoins the main arm where it runs, land all round the island. **The bank is one number**, the
  lake look's `bank.width`: 2.5 draws the thin settled bank (pick A), 7 a ragged bank with pale sand
  bars inside the bends (pick C, drawn now). A Region stored before keeps its rivers as they were.
  *(`WaterShapes.js`, `TerrainGrass.js`, `terrainRegistry.js`)*
- **The ground's detail (brief 370 R2)** — **Built, waiting for the eye-check**: where two grounds
  meet the border is **ragged**, each pixel near a cell line taking whichever of the nearest
  cells' grounds wins on a little noise, so a cell's corners round off and its middle stays its
  own; the blend band between two biomes is **44 u** wide (was 160). The **dirt is settled**: its
  flat middle mottled in its lighter and darker tones, its colour showing through the grass a
  pixel or two out, grass reaching into its edge, and its sunken edge softened. **Lakes and
  rivers are drawn in depth bands** (light shallows to the deepest, edges wandering), no brighter
  than before; the sea keeps its own drawing. Drawing only: placement, "Stands on" and the stored
  map are untouched, and every picture is built once per Region, never per frame.
  *(`TerrainLattice.js`, `TerrainGrass.js`, `terrainRegistry.js`)*
- **Stone terrain** — **Built (brief 330 W3)**: a feature of the ground as water is. A Region
  written with Stone gets outcrops of bare rock (a wild chasm a ridge across the mat), made with
  its layout and stored with its cell map; the cells they cover are `stone`, never on the water or
  in the Hall's clearing. Only ore and stone of the place's own grow there, starting their groves
  on it; anything with no "Stands on" may still be built there, and a Token may name **Stone** in
  its "Stands on" (the mines and the Quarry do). How much water, stone and grass a place gets is
  its **biome's range** (owner 2026-11-20, T-613): a biome table on the CMS world page gives each
  biome its range of each, and each new place rolls within it; kits no longer set stone. Drawn as
  pale rock and scree, a code-drawn stand-in until the owner's Stone pieces.
  *(`StoneShapes.js`, `Layout.js`, `terrainRegistry.js`)*

### What a Token is — Built
*⚠️ Stale since 2026-10-08: the Token counts below (86 types) no longer match `data/tokens.json` (146); see [doc_audit.md](../active/review/doc_audit.md).*
Everything on the mat is a Token: resource nodes, tools, stations, spawners,
Foundations, enemies, quests, the Guild Hall. 86 Token types ship
(`data/tokens.json`): resource 48, context 10, station 8, spawner 7, enemy 4,
buff 4, promotion 2, map 1, manager 1, market 1. Plus the engine-owned quest
Token.
- **Work cycle**: `config` = skill, level required, cycle time, XP, inputs,
  outputs (each output a chance and a quantity range). Example: Oak Tree,
  forestry 1, 3 s, 1–2 Oak Wood + 20 % Oak Seedling, 5 charges.
- **Two kinds of cycle** (owner 2026-11-20, T-550): a finished piece of work is
  a **work cycle**, a kill a **combat cycle**. Every buff says which kind it
  reaches (its hover says so, T-495): combat cycles get Yield, Double Loot,
  Double Item, bonus drops and the XP bonus, never Refresh, Fail or Giant
  Harvest (§7). Loot is loot either way: kill loot counts for the collection
  log and On Produces rules.
- **Rare drop table** (`rareTable`, owner 2026-11-11, brief 590): any Token with
  drops (a vein, a tree, a station, water, an enemy) may carry one: a chance a
  cycle in percent, decimals allowed (0.5), and finds with a weight and a
  quantity range. Each finished cycle (each kill, for an enemy) rolls it once,
  after the Token's own outputs; on a hit one find, picked by weight, drops like
  any output (whatever reaches that kind of cycle works on it: Yield, Double Loot,
  Double Item, and Giant Harvest on a Farming cycle) and is marked for
  the rare twinkle as it lands (the twinkle is switched off for now, `lootEffects.js`). A failed cycle and a build roll nothing. **Lucky** (§7) raises the
  chance. The Token's card and the Encyclopedia list each find at its own chance
  (the table's times its share). **Rare finds live in rare tables** (owner
  2026-11-20, T-553): gems for Mining, treasure for Fishing, and each enemy's
  banner map and other rare drops, so Lucky reaches them; no plain drop line
  carries a rare find. *(`rareTables.js`, `RareTables.js`)*
- **Charges** (`uses`): one is spent per cycle by default; at 0 the Token is
  removed, unless its type **respawns** (below). `null` = unlimited (Workbench,
  Furnace, Cooking Pot).
- **Stations and supports never wear out** (owner 2026-10-24, brief 230 S1a): a
  `Works as` station, and a support (a Token whose rules help its neighbours by
  standing there: an `Acts as` capability, or a standing Provides or Grants that
  reaches past itself), is unlimited whatever `uses` its type or a saved copy
  holds (the Windmill and the Coast among them); a saved copy's old number is cleared as its
  board loads. A **gathering node keeps its charges** even when it helps its
  neighbours (they are what is gathered: the Blackberry Bush, the Shrimp Coast),
  but only its own gathering spends them: **help is free**, nothing wears for a
  neighbour's cycle or kill (owner 2026-10-24); an enemy keeps the kills that
  clear it; a triggered rule's charge cost is an authored price and still applies.
  The CMS hides Charges on a station or support and the audit flags authored ones.
  **Water** (a Token with catch pools, Fishing below) never runs out either.
  *(`wearRule.js`, `Charges.isUnlimited`)*
- **Origin**: *placed* (bought or built: fixed, refundable) or *spawned*
  (free, pushable, no refund). Both count toward the Token cap.
- **Size**: 1 (art radius 64 u) or 2 (144 u); growing stages are half-size.
- **Context Tokens** are support Tokens (an anvil) that stand near a worker;
  a recipe's context charge cost is no longer spent (help is free), and the CMS
  field for it now does nothing. **Gathering tools are hero gear**, not
  Tokens (T-126): pickaxes, woodaxes, fishing rods, sickles, **fishing nets and
  traps** (brief 230 S5) are items held in one hand (`tool: { kind,
  tier }`); a gathering Token names the kind and lowest tier it needs
  (`needsTool`), and only a hero holding one may work it. No tool: the hero does
  other work and the Token says "Needs Pickaxe". **Tools gate and speed**
  (owner 2026-11-20): each metal tier of node asks that tier of tool (T-624),
  and a better tool is also faster (§4 Equipment, T-515); the hero uses the
  highest-tier fitting tool in their hands. ⚠️ Water is the exception
  (Fishing, below): it takes any kind its catch pools name ("Needs Fishing Rod
  or Fishing Net").

### Reach — Built
Rules reach `nearby` (default), `self`, `self_and_nearby` or `board`.
**One standard reach: 240 u centre to centre** (owner, 2026-11-10; it was
164 u for rules and 280 to 360 u for camps): a small Token's eight neighbours
one step away (the diagonals are 226 u), not two steps (320 u). It is the same
for everything that reaches: a `nearby` rule (the supports: a Mine, Minecart,
Well, Composter, Beehive, Dock), a camp's work, where a Forest or Orchard
plants and what it counts, a growth or rest that needs a Token in reach, and a
"Stands near" or `Cannot` rule. Nothing in play changes it: Camp Reach is
retired. There is no Close/Far. A dev or perf build can tune it
(`matTuning.js`, for tests and the benches); a test or shipped build always uses 240.
*(`reachRegistry.js` `STANDARD_REACH_U`, `nearby.reachRadius`)*
- **Seeing reach** (brief 560 R2): hovering or dragging a Token that uses reach
  (a Foundation, a work camp, a Token with a `nearby` rule or a need of a Token
  near it) draws the one **reach ring** round it, one art pixel of gold over a
  black copy, from the Shop or across the mat, carried camps too; while carried
  it sits where the Token would really land. **Every Token inside the ring wears
  a small cream dot** on its centre (the owner's pick, 2026-11-10: seven art
  pixels, dark edge, a white highlight pixel, a black shadow one pixel
  down-right); heroes and floor loot never do. The dots come from the engine's
  own distance test, so a dotted Token is exactly one the camp works or the rule
  reaches. They are worked out when the ring moves to a new spot, not every
  frame, and nothing is drawn or worked out while nothing is hovered or carried.
  A camp lit through its hero (hovering the hero or their tab, or their sheet
  open) shows its ring without dots. *(`MatRings.jsx`, `reachDisplay.reachDotsAt`, `reachDot.js`)*

### Spawners — Built
A spawner puts new Tokens beside itself on an interval, up to its **limit**.
**Every spawner but an enemy camp counts its family in its reach** (owner
2026-11-20, T-599): the Trees and Stumps of its kind, or the outcrops, standing
within the standard reach (240 u), a map's included, against its own
allowance; two Forests far apart each fill their own, and there is no mat-wide
family count. Order per attempt: limit, upkeep, pick, land, then pay.
**An enemy camp's clock stands at zero while the camp is full** (owner,
2026-10-24), so a goblin or boss beaten in a full camp comes back one whole
interval later; every other spawner keeps counting while full and replaces a
loss on the next tick. A place's own camps also **sleep while its arrival holds
the mat** (§10), spawning an interval after it is cleared.
- **One rule for no room** (owner 2026-11-20, T-598): nothing is paid or lost
  until a new Token lands. With no room it waits and retries, and the player is
  told once ("No room beside the Smithy."). Spawners, events, crafted Tokens,
  arrivals and the Shop all follow it.
- **Landing within its reach**: every spawner but an enemy camp lands each Token
  only within its reach, at the free spot nearest it, never pushing.
- **An enemy camp counts its own** (owner, 2026-10-29; T-266): it counts only
  what it spawned (the Tokens tethered to it) against its own allowance, so
  goblins standing at one camp never keep another from spawning. An older
  save's untethered enemies join their nearest camp on the first tick, before
  any camp counts; an enemy placed by hand, or one whose camp is gone, counts
  toward none. **Enemies come back by their camp only** (owner 2026-11-20,
  T-545): every enemy has one use, and the camp's clock brings the next.

*(`SpawnerSystem.js`, `TimedChanges.js`)*

| Spawner | Spawns | Allowance | Every | Upkeep per spawn |
|---|---|---|---|---|
| Oak Forest | Oak Tree | 5 | 20 s | 1 Oak Seedling |
| Fir Forest | Fir Tree | 5 | 30 s | 1 Fir Seedling |
| A Forest for every other wood (birch, maple, mahogany, ebony, cedar; T-597, with the Forestry pack) | its Tree | content | content | 1 of its seedling |
| Apple Orchard | Apple Tree | 2 | 45 s | 1 Apple Seed |
| Quarry | Stone Outcrop | 3 | 30 s | — |
| 9 enemy camps (Goblin Camp, Wolf Den, Crab Rocks, Wild Hive, Ember Vents, Sulphur Rocks, Frog Pond; Cow Pasture and Thorn Thicket every 60 s) | their enemy | 3 | 30 s | — |
| 9 boss camps (Chief's Tent, Alpha's Den, Slime Pit, Tide Pool, Wind Stones, Queen's Hive, Smoking Crater, Basking Stone, Toxic Pool) | their boss | 1 | 5 min | — |

Mines don't spawn veins: a vein refills where it stands (Transforms, Mining).
The big rest-and-refill Forest nodes retire with T-597; every wood's Trees come
from its Forest.

### Transforms — Built
- **Growth** (no Saplings, owner 2026-11-20, T-596): a felled Tree becomes its
  Stump, which grows straight back into the Tree with its Forest in reach, a
  seedling each: Oak 150 s, Fir 240 s, the other woods 300 s (content numbers).
- **No random turning** (owner 2026-11-20, T-600): a Token changes only by
  growing, regrowing, refilling or a rule; `turns` is retired from the engine
  and the CMS.
- A transform keeps the Token's origin, starts fresh clocks and loses any cycle
  in progress. *(`TimedChanges.js`)*
- **A growth may need a Token in reach and cost an item** (brief 230 S2a; the
  CMS Grows block's **Needs one of these in reach** and **Costs when it
  grows**): a Stump grows into its Tree only while a Forest of its species
  stands within its reach; without one its clock **stands still** where it is
  (a Forest planted later carries on from there) and it says so with a yellow
  mark ("Needs an Oak Forest nearby to grow"). When it falls due it pays its
  cost (a seedling) from the Bank, then the loot on the mat, only once its new
  Token has landed; short of it, it is **stopped** at its finish, says "Needs
  Oak Seedling" over itself as it stops (the red callout look of "Needs Coal",
  no more often than that) and wears the yellow mark, and grows the tick one
  arrives. Every Stump asks for its Forest (T-597). The Forest answer is
  read once per Token when its neighbourhood changes, never per tick, like Grow
  Time. Its card and inspection say what it waits for, needs and pays.
  *(`Growth.js`, `TileModifiers.nearbyGateMet`)*
- **Grow Time** (brief 230 S1a): a support in reach speeds a growth and a
  refill's rest (`Provides Grow Time −X %`, aimed by tag or id, or narrowed to
  the growing Token's skill: its own, or what it grows into). Speed-ups stack,
  but together cut at most 80 % of the time (the standard floor, §7), and a rest
  never goes under 1 s. A clock already counting keeps its time; only the finish
  moves. Read once per Token when its neighbourhood or the content change,
  never per tick, so a day's catch-up does not pay it 86,400 times.
  *(`TileModifiers.growTimeOf`)*
- **Respawn** (every vein and tree uses it): a Token type with a
  Respawns block in the CMS comes back after it runs out. *Refill*: it stays
  where it stands, **resting** (greyed, a countdown bubble), nobody can work it,
  and after its time (12 s by default, at least 1 s) it refills to full at once.
  A refill may name a **resting sprite** (brief 230 S3): while it rests it is
  drawn as that picture instead of greyed: **each ore has its own spent-vein
  picture** with its countdown and no message (owner 2026-11-20, T-628; a code
  placeholder until the art); its card and inspection then name it ("Copper Ore Vein:
  resting, refills in 0:42"), and so does its hover. A refill that falls due
  part-way through a tick is worked only for the rest of that tick, so the
  catch-up's 1 s steps mine exactly what live play does. A refill may also
  **need a Token in reach** (brief 230 S2b; the CMS Respawns block's **Refills
  only with one of these in reach**): without one its rest **stands still**
  where it is, as a Stump's growth does (above), it wears the yellow mark
  ("Needs an Apple Orchard nearby to refill") and its card and inspection say
  it waits for one; one placed later carries the rest on from there.
  *Regrow*: it becomes its `into` Token (Oak Tree → Oak Stump), whose own
  growth brings it back. Its hero moves on with no red alert; it is never
  depleted (no On Depleted rules, not counted as used up); a Stump still
  counts toward its Forest's limit. Never on enemies, spawners or
  Foundations. A hero with nothing else in reach **waits for it silently**
  (brief 230 S1b): no bubble, not counted idle, the flag's hover and the Dock
  say "Waiting for Copper Vein", and they work it the moment it refills. So
  does a hero whose only work in reach is a Stump growing back into work they
  could do (brief 230 S2a: skill, level, tool and rule checked against what it
  grows into): "Waiting for Oak Stump", and they fell the tree the moment it
  stands. A Stump that is not coming back
  (no Forest in reach, or stopped for want of its seedling) is nothing to wait
  for: idle as before, and so is a resting Token whose refill needs a Token in
  reach that is not there (a Bare apple tree with no Orchard). Worked out when
  the flag's words, the speech or the idle mark ask, never on the flag's pass,
  so it costs a catch-up nothing.
  *(`Respawn.js`, `Flags.waitingOf`)*
- **Mining** (brief 230 S3; veins and refills ship): a **vein** runs dry after
  **about five uses** (one rule for veins and trees alike, owner 2026-11-20,
  T-627), refills all at once after its rest (about a minute, set per ore in
  the CMS), shows its ore's spent-vein picture while it rests, and stays where
  it stands. **Mines don't spawn veins**: a Mine is a support (below).
  Each metal tier of vein asks that tier of pickaxe,
  metals 20 levels apart, and the vein's rare finds (gems) are a rare table
  ([content_mining_forestry.md](../active/content_mining_forestry.md), T-624,
  T-553). A **Mine** is a support:
  `Provides Double Item Chance 25 (flat), narrowed to its ore, to [its veins],
  nearby`, so each Mine in reach gives that ore a 25 % chance to come out
  doubled, stacking to a sure double at four; gems and anything else the vein
  drops are never doubled (owner, 2026-10-24). A **Minecart** is a support:
  `Provides Work Time −X % to [its veins], nearby`, stacking down to the
  standard floor (§7). A miner waiting on a resting vein waits silently (above).
  *(`OutputRules.doubleItemDrop`, `Respawn.restingSpriteOf`)*
- **Forestry**: every wood (oak, fir, birch, maple, mahogany, ebony, cedar) has
  its spawner Forest, Trees and Stumps (above); a Tree becomes its Stump after
  about five uses (T-627); better trees ask better axes (T-624).
- **Orchards** (brief 230 S2b; built as content shapes, the S8 pack ships
  them): a fruit tree is **picked, not felled**. Fruiting, it is worked for its
  fruit; picked empty it rests **Bare** (its resting sprite, per fruit) and
  then fruits again all at once in place, a refill that **needs an Orchard of
  its fruit in reach** (above): a Bare tree with none stays Bare. An **Orchard**
  is a spawner that plants full fruit trees within its reach (up to
  its allowance, a seed each; a Bare tree still counts toward it) and a support
  that speeds its trees' fruiting (`Provides Grow Time −X % to [its tree]`,
  floored). Fruit trees stay where they stand. Fruiting and Bare art
  per fruit. *(`Respawn.gateMet`, `TimedChanges` refill row)*

### Foundations — Built
Buy a Foundation, pick a build recipe on it, and a Construction hero builds it
into a building in place (30 s to 4 minutes; levels 1 to 10 today, climbing to
99 as building variants and better Foundations unlock by the 20-level tiers,
owner 2026-11-20, T-634). **A builder stays** if the new building is work they
can do, otherwise moves on: one rule for every Token that becomes another
(owner 2026-11-20, T-608). *(`Foundations.js`)*
An **unbuilt Foundation floats** as floor loot does (brief 560 R2): its art bobs
in whole art pixels with its hard shadow still on the ground, on the mat and in
the hand; the building made on it rests. Hovering or carrying one shows the
reach ring and its dots (§Reach), so the player can judge a spot before choosing
what to build.

**An unbuilt Foundation can go back to the Shop** (owner, 2026-11-10; brief 580):
its whole Shop price returns to the Bank, and whatever the Bank has no slot for
waits on the floor as loot, as all income does (nothing is lost). One part-way
through a build is refundable too, for its Shop price only: a build, like every
work cycle, checks its materials to start and takes them only when it completes,
so a stopped build has paid nothing. The hero working it lets go as when any
Token leaves the mat. Only a Foundation the player put there: never a built
Token, a spawned one, or one laid down with the land (a map's node, a Starter
Camp Token, a landmark).
To refund one, drag it from the mat onto the lowered Shop's edge or the risen Shop
(§UI, the Shop): a short bubble where it stood names what came back, with a coins
sound. *(`Shop.canRefund`, `Shop.refund`, `dropOnShop`)*

Each kind of Foundation is for its own kind of building (owner, 2026-11-03; brief 410).
The Shop sells only Foundations, in the order below; each shows skill icons that
hint at what it is good for. The icons and the place in the list are authored in
the CMS on the Token's `shop` block (`skills`, `order`), not worked out from its
recipes: several buildings have no skill of their own. The kinds are
`FOUNDATION_KINDS` (`tokenConstants.js`); a building recipe names the kinds it
builds on. Prices are *placeholders*. The making buildings are one per skill
with their variants (§5, T-632); the Campfire, Ceramics Kiln, Grandma's Kitchen
and Fighter's Academy are retired (T-633).

| Foundation | Price | Skill icons | Builds |
|---|---|---|---|
| Wood Foundation | 15 Oak Wood | Crafting, Cooking, Alchemy, Fishing, Forestry | the Workshop, Kitchen and Apothecary with their variants; Windmill, Composter, Beehive, Dock, Fishing Hut, Logging Camp, Farmstead, Minecart, Mining Camp |
| Stone Foundation | 10 Stone + 5 Oak Wood | Smithing, Faith | the Blacksmith with its variants; Well |
| Farmland | 10 Oak Wood | Farming, Forestry | Field, Herb Garden, Grapevine, Apple Orchard, the planted forests |
| Excavation | 15 Oak Wood (no Stone: the first Quarry is what gets you Stone) | Mining | Copper Mine, Coal Mine, Quarry |
| Battlefield | 15 Oak Wood | Melee, Ranged, Magic | The 18 enemy spawners built from a banner (Goblin Camp, Wolf Den, Slime Pit and the rest) |

### Fishing — Built (brief 230 S5)
Owner rulings 2026-10-24 and 2026-11-20. **Water** is a Token with **catch pools**
(`catchPools: [{ tool, bait, catches: [{ itemId, weight }] }]`, the CMS Token
editor's Catch pools block), one weighted pool per **tool kind × bait**. **No
fishing without bait** (T-623): there is no basic pool, **except the Trap** (owner
2026-11-21): early fishing is a Trap with no bait, catching Raw Shrimp, the one
bait-free catch and how a new guild starts fishing. Four waters ship (Coast, River,
Lake and Bog Pool); the Fishing plan, amended to these rulings
first, brings fish tiers each with its own bait and the catch chosen by place
and gear ([content_fishing.md](../active/content_fishing.md), T-622). One sprite
per water type is content.
- **The card says what bites**: with a hero on the water, what their tool and bait
  land now, at the odds rolled; the water's other pools, or all of them with no
  hero on it, sit in shut lists by tool, at their authored odds.
- **Each finished cycle lands one catch** picked from a pool, in place of the
  Token's own Outputs, then widened like any output (Yield, Double Item Chance).
  A **rare catch drops like any other item**: no pop, no twinkle (owner
  2026-10-24); a water's treasure is its rare table (§3, T-553).
- **The tool picks the pool**: the first tool in the hero's hands (grid order)
  that the water has a pool for; a rod in the first hand and a net in the second
  fish with the rod. Water needs any kind its pools name. **Better waters ask a
  rod tier; bait picks the fish within a water** (owner 2026-11-21, T-622, to
  build in brief 770 G2): a pool may ask its tool kind at a tier, as a vein asks a
  pickaxe tier, and a hero below it does not fish there; a better rod is also
  faster (T-515). **A better rod
  has its own bonus** through the **Catch Weight** rule
  (§7): +900 % on a Dolphin weighted 10 beside 50 and 40 makes it 100 of 190.
- **Bait** is carried in a Consumable cell: the first, in grid order, that a pool
  for the hero's tool takes and the Bank holds is used, and **one is spent per
  catch**. **None left: the hero leaves and says "Needs Worm Bait"**, as with no
  arrows (§6) or no seed (Farming): one rule for a missing input, always "Needs"
  and the item (owner 2026-11-21). Bait in the Bank alone does not do: it must be
  carried. The Trap's Raw Shrimp needs none. A failed cycle catches
  nothing and keeps its bait.
- **Water never runs out** (`wearRule`: unlimited whatever its charges say) and
  **does not shift** (Transforms, above). The Fish Shoal, an event, is the
  exception: a rich node that runs out (§3 Events).
- **A Dock in reach speeds fishing**: content, a `Provides Work Time −X %` to the
  water, stacking to the standard floor (§7).
- Every pick draws one number from the game's random stream in a fixed place of
  the finished cycle (none for a one-fish pool), so a catch-up catches exactly
  what live play does, bait running out on the same catch.
- **The CMS prices water from its pools**, one catch a cycle, assuming no
  no-bait pool (T-623); the water's own Outputs are not counted, and Recalculate
  never writes Outputs onto water (`cms/src/engine/sim/fieldAdapter.js`
  `waterOutputs`).
  *(`catchPools.js`, `Fishing.js`, `BoardRunner.completeCycle`)*

### Farming — Built (brief 230 S4)
Owner rulings 2026-10-24. **A Field is one Token that grows itself**: a station
(Works as Farming, kind **Field**; a **Herb Garden** is kind Herb Garden, its own
crop list) with a **Field** block in the CMS (its shared empty and growing
pictures). **Each crop is a Farming recipe** the Field offers (director's call,
S0 Q4): the player picks it on the Field with the gear (**"Choose crop"**) and the
same list as a station's recipes, crops unlock by Farming level, and the pick
**sticks** for every sowing after. The recipe's **inputs are its seed**, one
per sowing, never per harvest: **checked when it is sown and taken by the first
harvest** (owner, 2026-11-10: every task checks its items to start and takes them
only at the end, when it is collected); its **Crop** row in the CMS sets how long it
**grows** (about an hour for wheat; 1 h by default), its **load** (harvests a
ripe Field holds; 10 by default) and its **ripe picture**.
- **Empty → growing → ripe.** Picking a crop on an empty Field sows it on the
  next tick if a seed is in the Bank (or in the loot on the mat), taking nothing
  yet: the seed is owed, and may be spent elsewhere meanwhile. Growing, it
  counts down (the timer bubble, the card, the inspection) and is drawn as the
  shared growing picture; ripe, as its crop's ripe picture. Its state is saved
  on the Token (`field: { cropId, load, full, seedOwed }`, `clocks.fieldMs`).
- **A ripe Field holds a load of harvest cycles**: a Farming hero harvests it like
  any work, each cycle making the crop's outputs (Yield, Double Item Chance and
  bonus drops apply as anywhere). **The first cycle takes the owed seed** as any
  work cycle takes its inputs: with the seed gone it waits, holding its progress,
  wears the "Out of item" mark and goes on the tick the seed is back (a crop
  saved while seeds were paid at sowing, or a wild patch's first crop, owes
  none). **The last cycle sows it again** with the pick, its growth counting from
  the moment that cycle ended; a seed that cycle dropped counts. **No seed: the Field is stopped** (empty, the pick kept),
  wears the yellow mark and sows the tick one arrives; **its hero says "Needs
  Wheat Seed" as they leave** (owner 2026-11-20, T-629), the one rule for a
  missing input (bait, arrows, seed).
- **A change of pick** while a crop grows or stands ripe applies at the next
  sowing: the crop in the ground is not dug up (the card says what it sows next).
- **Farmers wait silently** for a growing Field in reach ("Waiting for Wheat
  Field", not idle) and harvest it the moment it ripens; a stopped Field is
  nothing to wait for (idle as before). A Field that ripens part-way through a
  tick is harvested only after it ripened, so the catch-up's 1 s steps farm
  exactly what live play does.
- **Supports in reach** (content shapes; the S8 pack ships them): a **Well**
  `Provides Grow Time −X %` to Fields (stacking to the standard floor, §7); a
  **Composter** `Provides Crop Load +N` (or +X %) to Fields: the load a crop
  ripens with, read once as it ripens (director's routine call: a load axis, so
  the Field visibly holds more harvests; Yield would add crops per harvest and
  leave the load as it was); a **Beehive** `Provides Double Item Chance` on the
  crop (or Grants a seed) to Fields, and is itself a Farming node that **fills
  slowly with honey and wax**: a refill (it rests empty, then refills all at
  once, S0 Q10), sped by Fields or flowers in reach (`Provides Grow Time` to the
  Beehive). A **Windmill** is a station of kind Windmill that mills grain.
  Supports never wear out; help is free.
- **Seeing support effects** (brief 230 S7): holding a Token over the mat
  lights the Tokens within reach of where it would land that it would help or
  be helped by (their white outline) and tags each with what passes, gold over
  a Token it helps ("−50 % grow"), plain over one that helps it ("gives ×2
  Wheat 25 %"); mat-wide rules never light. The reach ring and its dots show
  at the same time (§Reach): every Token it would help wears a dot. A Token's card lists **Boosted by**
  and **Boosts** (each Token in reach and its effects) and notes when its
  speed-ups are held at the floor. A doubled item and a Composter's extra
  harvests pop quietly over the Token (a spark from the support and a rising
  +N, no name); a catch-up draws none.
- **A map's wild wheat patch is a ready-planted Field** (owner 2026-10-24): a
  Field type whose Field block **starts ripe with** a crop, which is also its
  pick; it sows again from the Bank like any Field.
- **Old saves**: a Wheat Field saved as a spawner loads as an empty Field with
  nothing picked. The Wheat Sprout retires (T-600).
- **Content**: the Farming plan ([content_farming.md](../active/content_farming.md),
  38 unlocks, no sickle, T-625) ships the crops by level.
- A Field never wears out (it is a station); its load is not its charges.
  *(`Fields.js`, `TimedChanges.js` field row, `RecipeResolver`, `BoardRunner.completeCycle`)*

### Demolition — Built (Atlas A3a, A3b); replaced the discard bin
Mark a Token for demolition and a hero holding Construction (level 1) removes
it in 10 s of work: no refund, no loot, never a depletion, and **a little
Construction XP** (owner 2026-11-20, T-610; the amount and the time on the
tuning page, T-253). While marked
it is only that job: its recipe, build, training, spawning, growth, refill and
Passive Production stop (what it gives its neighbours by standing there
carries on until it is gone). Unmarking makes it itself again and loses the
half-done demolition. Anything bought, built, spawned or planted can be marked,
a resting Token included; the Guild Hall, landmarks, a map's nodes and
enemies can't, except a map's node whose type is marked **Can be cleared where a
map placed it** (`clearable`, a box in the CMS Token editor: wild Forests and
the Stumps of felled map trees, brief 230 S2a). The Starter Camp's own Tokens
stay as laid whatever their type. **Two ways to mark** (owner 2026-11-20, T-607):
the top bar's **Demolish** map mode, for clearing many, and **Demolish** on the
Token's card, for one (where it can't be, the card says why); **Cancel
demolition** takes the mark off.
A marked Token wears the Construction badge, its inspection reads "Marked for
demolition" with the time left once a hero is on it, and "Demolished …" pops
up where it stood. The discard bin (and its refunds) is gone. An **event
Token** (below) is demolished like any Token (owner 2026-11-20, T-603): marked,
then cleared by a Construction hero over the usual time, nothing back; the next
event waits until it is gone.
*(`Demolition.js`, `useMapMode.js`, `TokenInspection.jsx`)*

### Events — Built (brief 640 E1, E2); twelve authored
Every **45 to 75 minutes of play** (a fresh random wait each time, counted from when the last
one left) a special Token lands on the active Region's mat
(the rules: [`concept_events.md`](../active/concept_events.md)). Two kinds:
a **rich node** (a big pool of charges and a high yield, a Copper Ore Comet) and a
**buff Token** (one effect on the Tokens in its reach for a set time, Rainfall).
Events are treats: nothing bad happens and nothing is lost by being away.

- **The table** is authored on the CMS's **Events** page (`data/events.json`):
  each event names its Token type, its kind, a **weight** in the draw, where it
  may land (**ground** words, the Token editor's "Stands on" words, and Region
  **biomes**; none of either is anywhere), for a buff its **minutes** on the
  mat, and its **goodbye line** (below). **Biome leans on which events come**
  (owner 2026-11-20, T-614): a Fish Shoal at the coast, a Fallen Maple in forest. The event's Token is an ordinary Token made on the Token editor. No table
  (before the first Sync of one): no events.
- **The clock** counts game time while no event stands on the mat and is held at
  zero while one does, so the next event comes **45 to 75 minutes after the last
  one left**; **one at a time**. Any event may come at any time (owner
  2026-11-20). The wait, the retry and a rich node's hour belong on the tuning
  page (T-253). When due, one event is drawn by weight among those
  that fit the place (the Region's biomes, ground both it and its Token may
  stand on) and lands on a free spot, pushing nothing; none fits or none finds
  room, and it tries again **5 minutes** later. Not tied to tier: a Mythril
  Comet may land in the first hour. An event left in another Region stays there,
  frozen with that mat, and does not hold this mat's clock.
- **A rich node** stays put and is worked like any node (every boost, Lucky,
  Giant Harvest on a Farming node, its rare table); it leaves at **0 charges**, or after **an hour** on the mat, worked or not.
  The **Fish Shoal** is a rich node that runs out (owner 2026-11-20 and
  2026-11-21, T-604): catch pools like any water, rod and bait picking the catch,
  one catch spending one of its big charge pool, its catches better than plain
  water's; it leaves when the charges are spent, like any rich node.
- **A buff Token** can be dragged anywhere and gives its rule in the standard
  reach, adding to the boosts of buildings and stars of the same kind inside the
  same limits (no speed stack cuts more than 80 %). It leaves when its time is
  up, its boost with it; time up while it is being dragged, it leaves once put down.
- Event Tokens never count toward the mat's Token cap. Offline, events land and
  are worked and buffs tick down as in play; the return report's **Events**
  section names each one that landed or left while away, one line per kind:
  **Expired** (it went by itself: time ran out, never worked, worked out),
  **Demolished** (the player's act) or **still here** (T-503; "left unworked"
  retires, 2026-11-21): `Fish Shoal ×3 · 2 expired · 1 still here`.
- The QA panel's **Events** section lands an event now (any, by weight, or a
  named one; it ignores the clock, never the ground; one at a time).
- **The arrival** (E2), by kind and from the mat's existing pieces: a rich node
  **streaks down** from up and to the right, leaving a short tail of white and
  gold sparks, and lands with the Giant Harvest's **star burst** and a puff of
  dust; a buff Token **drifts in** from the left and **fades up** in four steps.
  Short (about half a second), in whole art pixels, the same every time (no
  random numbers); none under reduced motion, none for events that landed while
  away.
- **The banner** (E2): a milestone banner names the event ("Copper Ore Comet!",
  with the Token's art; a buff's line says its minutes). Hovering it outlines the
  Token in gold; clicking it pulses the Token's gold outline (two golds, about a
  second) and, from the **World Map or the Guild Hall**, goes back to the mat
  first: over those two screens only banners that point to a Token show.
- **The goodbye** (owner 2026-11-20, T-602; banner only, owner 2026-11-21):
  when an event leaves, its banner goes and a new one says so in that event's
  own line ("The clouds waft away in the breeze."), a field on the CMS Events
  page, under **Expired** or **Demolished**. Nothing is left on the mat where it
  stood: no marker for events.
- **Time left** (E2) reads like a refreshing node's: the hover plate's timer
  cell counts a buff down (and a rich node down to leaving), and the
  Token card's Events section says **"Expires in 4m 57s"** (the same word as
  when it goes, 2026-11-21); a rich node shows its
  charges as any node does.
- **The badges** (E2) name an event buff by its event as one more source
  ("Rainfall nearby").
*(`events/EventClock.js`, `board/EventTokens.js`, `config/eventTable.js`,
`TimedChanges.js` rows `event_time_up` and `event_unworked`; the arrival
`board/fx/eventArrival.js`, the banner `notifications/bannerKinds.js` `event`)*

### Maps — Retired (brief 330 W2); the world map settles places instead
The map and modifier item types are gone, with the CMS's Map editor, the
Cartography table, upcycling and bounty maps. The items named "<Token> Map" are
ordinary materials that wear map art: they build their Token, and nothing here
reads them as maps. A save still holding a deleted item loads and plays: the
stack stays in the save, the Bank does not show it (it still takes a slot), and
the load names it in the log. The generation engine still writes a
Region from recipes (`Budget.js` → `Layout.js`, `Cartography.js`), each biome
its own ground and water: meadow, forest, mountain, coast, flower meadow,
cherry grove, Yellowstone, volcano, and the **Bog**, dark grass and mud with
a marsh of many small ponds (`terrainRegistry.js`). Map bursts, the Map shop, the Explore skill and the old Map
catalogue are retired too; the last Map Token, **Volcanic
Island**, does nothing and is the owner's to delete in the CMS.

---

## 4. Heroes

### Roster — Built
- Heroes come from the **Bunk Beds** Hall upgrade: each rank adds one hero,
  **max 8** (`ROSTER_MAX`). Rank 1 is free and held from the start: it is the
  first hero, made on the new-game screen (§1). *(`guildUpgrades.js`,
  `EngineBootstrap.createFirstHero`)*
- Every new hero starts alike: every skill at level 1 (below), 11 HP, a random
  name, plus whatever the Hall's **XP for Everyone** star has given so far (§8),
  so a later recruit arrives with the guild's gift. Differences are earned. No
  dismissing, no retirement, no permadeath. (Classless heroes, brief 270 K1;
  the "Recruit" title is gone.)
- One flag colour per hero (8 colours): the small flag that marks their job.

### Skills — Built
**One list of skills, and every hero holds every one** from level 1: there are
no specialist skills, just skills (owner 2026-11-21, T-643)
*(`skillRegistry.js`, the source of truth; classless heroes, brief 270 K1)*.
**Shown by kind, in one colour** (owner 2026-11-21): combat, gathering, making
(Fletching, Enchanting and Tailor among the making skills), then Faith,
Summoning, Crime and Science last until their identities place them.
Twenty today, Tailor making 21 (T-304):
- **Gathering and making**: mining, forestry, fishing, farming, smithing,
  crafting, cooking, alchemy, construction.
- **Combat**: melee, ranged, magic, stealth. The style a hero fights in is
  their weapon's (see Equipment and The fight). Each style's identity, as
  the owner ruled it (2026-11-20): **Melee** steady damage and defence with no
  support needed, its weapons and armour crafted from one metal and never
  spent, the reliable beginner style; **Ranged** hits harder and pays in
  arrows, two damage types a shot; **Magic** picks the element for the enemy
  from a kit of weapons to collect, each cast spending a Mote; **Stealth** the
  wild glass cannon, low steady damage, frequent crits, fragile gear (its crits
  come often, not larger: crit chance to a 75% ceiling, never Crit Damage).
  Signatures: Melee defence and Accuracy, Ranged saving arrows and arrow
  types, Magic Type Damage by element, Stealth crit chance and Dodge. Each style's
  text in the game says what it is about and names only weapons that exist
  (T-569). Weapon traits and the texts: concept_combat_styles.md.
- **Fletching, Enchanting, Tailor**: being built from their approved plans:
  Fletching makes bows and arrows (T-572), Enchanting makes wands, staffs and
  tomes and works Leylines for Motes (T-577), Tailor makes mage and Stealth
  clothing and the String Fletching uses (T-578, T-304).
- **Faith, Summoning, Crime, Science**: no content yet, shown at level
  1 like any skill (owner ruling D7). Their direction (owner 2026-11-21, 22):
  Faith builds blessing buildings kept lit by offerings; Summoning charges
  Summoned workers at the Summoning Circle; Crime steals alternate drops from
  camps through a Hideout; Science studies nodes from a Laboratory for
  permanent mastery. Taming was cut (2026-11-22). (Identities: see
  concept_skill_identities.md, draft.)

Leadership, Commerce, Trapping, Armory and Shadowcraft were **cut** (K1): content
naming one is listed by the boot audit and the CMS Economy Audit, and an older
save's levels in them are dropped on load.
Forestry is the old Logging, renamed with its id (it keeps the Logging art);
Explore and the other v1 skills were dropped.

- **If the skill is high enough, the hero can do it**: the gate on any work is
  the skill level, a tool or an item, never a class.
- XP comes from work cycles (the recipe's or Token's `xp`) and kills (into the
  style the hero fought in: their weapon's, Melee barehanded). Level cap 99; XP to level 99 ≈ 13 million
  (RuneScape-style curve, `XPCurve.js`).
- **XP bonuses apply per skill, kills included** (owner 2026-11-07, brief 530): a bonus aimed at a
  skill widens that skill's XP wherever it is earned, a work cycle of it or, for Melee, Ranged, Magic
  and Stealth, a kill won in that style; a bonus aimed at no skill widens every skill's XP, kills too.
  Gear, perks, potions, a Token's neighbours and Guild Hall stars all count, summed into one bonus
  (a true percentage: a fraction of XP is paid by chance, so +10 % on a 1 XP award is 2 XP one time
  in ten; owner, 2026-11-15). *(`BoardRunner.js`, `CombatResolutionProcessor.js`, `xpBonus.js`)*
- A skill level gives no work speed: a cycle takes its authored time whoever works it (owner 2026-10-09, T-125).
- **Hero level** = the average of all their skills, shown in the hero sheet's
  header (owner 2026-11-21, T-640); it gates nothing.
- **Content that still says `logging`** (data/ and the CMS workspace, until the
  owner's next Sync) is read as `forestry` as it loads
  (`skillIdMigration.js`, to be removed under T-114). Content naming a skill
  that does not exist, or carrying a retired Promotes rule, is listed by the
  boot audit and the CMS Economy Audit.

### Milestone perks — Built (brief 270 K4); nine authored
- **Each skill may carry a perk table**: fixed perks at set levels (any whole level from 2 to 99),
  each a **library effect** (§7). Every hero who reaches the level holds the perk and keeps it; no
  choices. *(`data/skillPerks.json`, written by the CMS's Skill Perks page and Sync; `perkTable.js`,
  `HeroPerks.js`)*
- **The shape of a table** (owner 2026-11-20, T-522, T-523): **majors at 10, 25, 50, 75 and 99**,
  small early and changing how the skill plays late, and **small repeatable steps every 5 levels**
  between them (the same effect again, adding up), none marked differently. A new table in the
  CMS starts with a row every 5 levels plus 99. Every skill that levels gets one, the combat
  styles too. Nine perks ship today, one per work skill at level 10. (Signature perks: see
  concept_milestone_perks.md, draft.)
- **Held, not granted**: a hero's perks are read off their levels whenever asked, never saved, so a
  level-up, a load and a catch-up agree and none is granted twice.
- A perk's rules reach the hero **as a carried item's do** (the Token they work, their fights, On
  Work Start, the combat numbers), and it spends nothing. A work rule should be narrowed to its
  skill; the audits say when one is not.
- **Shown**: every milestone the same way (no banner): the level-up float over the hero says the
  short version, "Forestry 25: Clean Felling, +2 recipes" (owner 2026-11-20 and 2026-11-21, T-524),
  and the hero bar gives it an alert of its own which, clicked, lists the perk and each new recipe,
  Token and gear piece by name, and the Hero drawer's skill panel lists every perk of
  the skill, those held in gold.

### Classes and promotion — Retired (brief 270 K1, K5)
The class jobs (Recruit, the basic and master classes), promotion, Promotion
Tokens, the Change Job planner, banked skills and Mastery are gone ("job" now
means only a hero's order, below): **if the skill is high enough, the hero can do it**
(`concept_classless_heroes.md`). A Token's Promotes rule does nothing; it still
reads as it did, the CMS no longer offers it and marks it retired, and the
audits name the Tokens carrying one (the Fighter's and Wizard Academies, for the
owner to delete). An older save keeps every level: banked skills come back onto
the sheet, the class and cut skills are dropped. Milestone perks (K4) take
promotion's place as the milestone. A Promotes rule's own charge moment ("Each
hero promoted") is gone with it (K5): a Promotes rule, like any rule that never
fires, spends nothing.

### Health, food, defeat — Built
- **Max HP = 10 + the hero's best combat skill** (the highest of the four,
  whatever is in their hands): 11 for a new hero, 109 at 99. Recomputed on
  every level-up (a level adds headroom, not a heal) and on load (an older
  save's stored max is replaced and current HP clamped to it).
  *(`FormulaRegistry.js`, `CombatFormulas.js`)*
- **Regen 1 HP / 10 s out of a fight**, idle, walking or working; none in a
  fight, where only food heals. **Regen is an effect** (owner 2026-11-20,
  T-527), like Speed and Recovery: stars, perks and gear may raise it (**no
  building Regen yet**, owner 2026-11-21), summed in the same buckets, named in the effect names table, explained
  on hover and listed on the hero's health hover.
- Below 25 % HP a hero eats equipped food from the Bank (in a fight eating
  takes that swing; out of one, at most one meal per second of game time, so
  a fight away eats as one watched does, owner 2026-11-17). **Only food heals**
  (owner 2026-10-24 and 2026-11-20, T-525): drinks and potions are buffs, an
  equipped drink is left alone, unspent, and the CMS offers a heal amount on
  food only, as the item tooltip shows one for food only. Out of a fight,
  healing is food and regen only. Heroes have no energy (removed, T-098).
- **Drinks** (brief 230 S6b): a drink whose rules wait on **On Work Start** is
  drunk from the Bank as its hero starts a work cycle and **lasts 10 work
  cycles** (one number for every drink, `DRINK_CYCLES`, a placeholder; a fight
  is not a work cycle). Its rules fire from that dose ("On Work Start: applies
  Coffee to the hero for the cycle", Coffee being work 50 % faster); a rule
  naming a skill counts only that skill's cycles. A fresh one is drunk when the
  dose runs out, and the dose keeps working after the Bank runs dry. The count
  left is saved on the hero (`drinkCycles`); a drink with no work rule does
  nothing. The guild's **Long-lasting Brews** and **Strong Drink** stars (§8) make a fresh dose
  last longer and its effects stronger. *(`ConsumptionSystem.startWorkDoses`, `LoadoutMoments.js`)*
- **Work potions** (Alchemy, brief 230 S6b): a Consumable whose rules wait on
  On Work Start is **spent only when a cycle of its own skill starts**, one
  potion for that one cycle: the Birdwatcher ("On Forestry Work Start: applies
  Birdwatcher to the hero for the cycle", Birdwatcher granting a Bird Nest a
  quarter of the time as the cycle completes). The hero keeps it while doing
  other work. With Long-lasting Brews (§8) one potion can last more than its
  cycle: it then counts down its cycles of that skill like a drink.
- **Nothing acts by sitting in the Bank**: a food, drink or potion's always-on
  rules do nothing (§7); it acts only through its moment and its dose.
- **Food Healing** (a Rules row) moves what every meal heals while the status
  lasts, in a fight or out (owner 2026-11-20, T-529: a status does what it says
  wherever the hero is): while **Burning** (−50 %) a Shrimp's 5 heals 3,
  rounded halves up.
- **Elixirs** (the unlimited consumable slot): an elixir whose rules wait on
  the fight-start moment is drunk as a fight starts and **lasts 10 fights**
  (one number for every elixir, `ELIXIR_FIGHTS`; each enemy engaged is one
  fight). Every equipped elixir type works at once and their effects stack; a
  type is drunk again from the Bank when its last dose runs out, and keeps
  working for the rest of its 10 fights after the Bank runs dry. The count
  left is saved on the hero (`elixirFights`). A consumable with no fight rule
  is never drunk by a fight. Long-lasting Brews and Strong Drink (§8) reach elixirs
  too. *(`ConsumptionSystem.js`, `LoadoutMoments.js`)*
- **The "used" bubble**: when a hero eats, or drinks an elixir, a drink or a
  work potion on the mat, a small bubble over their head shows the item's icon
  and what it did ("+5 ♥", or the item's name), tinted by the item's kind, for
  1.5 s, one at a time per hero. A work potion shows it every cycle it is drunk
  for. Not drawn during a catch-up. *(`matFx.js`)*
- **Defeat** (0 HP; the word is **Defeated**, for winning and losing alike,
  never knock-out, owner 2026-11-20, T-559): the hero loses their job, limps
  home, loses 25 % of the whole Bank stack of each carried food and drink
  (elixirs exempt), a 10 % chance per gear piece to destroy that piece (the
  hero's own copy), and is **wounded for 5 minutes** of game time, returning at
  50 % HP (*placeholder* numbers, on the tuning page, T-253). Limes explains
  these losses before the first fight (T-530). Healed, they wait at the Hall
  for a new job; a healing hero takes no job ("Ana is healing: 0:42"). The
  Guild Hall's **Infirmary** star gives **Recovery**, shortening wounds, and a
  rank bought mid-wound shortens the wound already running (owner 2026-11-20,
  T-528).

### Equipment — Built
A 3×3 loadout grid with category caps (hand 2 — two hands: a weapon, a tool
or an off-hand item takes one, a two-handed weapon both — hat 1, chest 1,
trinket 2, food 1, drink 1, consumable unlimited). Gear, weapons and tools are
one copy per hero: equipping takes the copy out of the Bank. **Ammo** is carried
in consumable cells and spent from the Bank: **bait** one per catch, **arrows**
one per shot, **Motes** one per cast, **Kunai** one per throw (§3 Fishing, §6
The fight). **Poisons** ride there too (§6 The fight).
- **Moving items by drag.** Dropped on another slot of the same hero, an item
  moves there and swaps with what is there; no slot has rules of its own, so a
  swap can never be refused, and a tool moved mid-job keeps the hero working.
  The weapon swung is the first in the hands whose level the hero meets; the
  tool used is the **highest-tier fitting tool** in their hands (owner
  2026-11-20, T-515). Dropped on another hero in the bar or the Bank's column, it
  leaves the giver (food and potions too; their stack stays in the Bank) and
  finds its slot as a drop from the Bank does: the receiver's first empty slot,
  or, on a full loadout, the place of one of its kind (a hat for a hat, a
  weapon for a weapon), whose piece goes to the Bank, not to the giver (owner,
  2026-11-15). **Dropped on a chosen cell**, it takes that cell and whatever
  was there goes to the Bank (owner 2026-11-20). A full loadout with nothing of
  its kind (dropped on the hero, not a cell), a level the receiver lacks or an
  item they already carry refuses with the reason and the item stays. Past a category's cap or a full pair of hands, what the receiver puts
  down goes to the Bank, as with any equip. A hero handed away from their work
  tool stops, keeps their flag and shows the yellow alert.
- **Tools and weapons that break** (brief 480 L1): a tool or a weapon may carry
  a **break chance** (§5). Nothing equips a spare from the Bank when one breaks:
  no order, camp or rule equips anything by itself; only the player does.
- **A weapon** is anything held in the hands that is not a gathering tool or an
  off-hand item. It names **one style** (`styles: ['melee']`; an older list of
  two fights in its first and the audits say so), its **damage**, its **speed**
  (it **Attacks every** 2 s fast, 3 s normal, 4 s slow) and its **damage type**
  (`damageType`, one of the nine, §6; a weapon without one hits in its style's
  default: Melee Slash, Ranged and Stealth Stab, Magic Fire). **Every weapon
  kind carries a small combat trait** that fits it and its style (owner
  2026-11-20, T-565): daggers crit, bows accuracy, and so on for the sword,
  greatsword, cleaver and the other styles' kinds. **The weapon decides the
  style**: any hero may hold any weapon, and fights in its style. A weapon
  naming no style is Melee. Older content's single `skillRequired` style is
  read as its style. The type comes from the family and its name, never the
  tier: swords are Slash at every metal. **Bows** mostly add Stab, a few
  special bows an element (T-572). **Magic's weapons** are three kinds, like
  swords and maces: **wands, staffs and tomes** (no off-hand tome changing an
  element); each names its element and the **Mote** a cast spends (T-577,
  T-579). **Kunai** are a thrown Stealth kind that spends one a throw (T-586);
  daggers spend nothing.
- **The hands** (owner: off-hand items only in the second hand): **only the
  weapon swung lends anything**, the first in the hands whose level the hero
  meets; a weapon in the second hand lends nothing, whatever its style. Taking
  up a weapon puts the one held down in its place, and taking up an off-hand
  item puts the one held down; a tool stays beside either. A two-hander clears
  both hands. An older save holding two weapons keeps them until the next
  weapon is taken up. *(`weaponStyles.js`, `EquipmentManager.js`)*
- **An off-hand item** (`offHand: true`, CMS "Held as: an off-hand item") is a
  hand item that is never swung: a **shield** acts like a piece of body armour
  (its resistances, cuts and rules, no block chance). It carries no weapon
  numbers. There is no quiver and no focus orb (owner 2026-11-20).
- **Defence is percentages, by damage type** (flat Armour, flat Resistance and
  Pierce are retired). Every worn piece (a hand item, hat, chest or trinket) may
  carry **resistances** (`resistances: { slash: 20, fire: 10 }`: percent off
  hits of that type the wearer takes; negative is a weakness; **only the nine
  types carry numbers**, no groups, and the CMS's fill-in button sets Slash,
  Crush and Stab at once, owner 2026-11-20, T-532) and a
  **damage cut** to named styles (`damageCut: { magic: 30 }`: percent off the
  wearer's own hits while they fight in that style, shown red in the tooltip).
  **Every piece is a trade-off** (owner): metal resists Slash, Crush and Stab
  and cuts Magic and Stealth, so a mage is worse off in an iron chestplate than
  in nothing; **leather and cloth don't cut Magic** (T-580). Mage clothing
  (Tailor) carries no Magic cut; Stealth clothing trades defence for crit
  chance and Dodge (T-578; no Crit Damage, owner 2026-11-21). **Lines add**: a fighter's resistance to a type
  is all its lines for that type added, heroes and enemies alike (§6). There is
  **no cap**: gear numbers are kept
  small instead, and the content audit names any type a hero's best possible
  stack (best hat, chest, two trinkets, hands, every perk) takes to 100 % or
  more. The best gear stack tops out at **90 %** in any type (owner
  2026-11-24: Darkmetal for Slash, Crush and Stab; Dragonscale with the two
  Sapphire Amulets for Fire, Ice and Electric), leaving room for a fight's
  own buffs such as Ironskin. *(`gearDefence.js`, `gearDefenceRule.js`)*
- **Level requirement** (K1): **every weapon asks a level in its own style by
  its metal** (owner 2026-11-20, T-566): copper 1, iron 15, silver 30 and on up
  the tier table, all four styles (`levelRequired`: "Iron Sword: Melee 15"); armour, off-hand items and
  trinkets name the style (`skillRequired`) beside the level. Equipping below
  it is refused, "Needs Melee 15". Gear held below its level (an older save, or
  a level added later) stays in its slot, lends nothing, and a weapon is not
  swung. *(`weaponStyles.js`, `EquipmentValidator.js`)*
- **A family's ability is a Rules effect on the item.** Every tier of a family
  points at the same library effect (the Dagger's Crit Chance: 5 on copper, 10
  on iron), each with its own **scale** (copper 1, iron 2…), so the tier raises
  the number. **Tools work the same way** (owner 2026-11-20, T-515): each tool
  family points at one Speed effect with a scale per tier, so a better tool is
  faster, shown on the Speed hover and inside the usual speed-up floor (§7).
  Armour may carry abilities the same way (a Status Stack Limit or Type
  Resistance % row counts beside its own lines). An ability may touch anything
  the grammar reaches, work included (a Cleaver's chance to double Raw Beef
  works on a kill and on a work cycle alike). **The same effect from several
  sources adds in full**, with no cap (owner 2026-11-20, T-516): items, perks,
  stars and buildings alike, numbers kept small instead; the content audit names
  any effect a hero's best possible stack pushes past a sane line.
- **What ships** (copper and iron, with the combat content pack): Sword,
  Dagger, Cleaver, Greatsword (two hands; a two-hander out-damages one hand of
  its metal, T-568), Bow and Wand at each metal; Leather Hat and Chest, Copper
  and Iron Helmet and Chestplate, a Copper Shield; the Elixirs of Valor and
  Ironskin; two arrows. Swords and cleavers are Slash, greatswords Crush,
  daggers Stab (Stealth only); both bows are Electric and both wands Smithy-made
  today. The approved plans being built replace the bows and wands: **Fletching**
  makes bows and arrows (T-572), **Enchanting** the wands, staffs and tomes
  (T-577), **Tailor** mage and Stealth clothing (T-578), Smithing the Kunai
  (T-586) and Alchemy the poisons (T-587).

### Orders: how heroes get work — Built (the heart of the game)
Heroes do not choose their own work: **the player sends each hero to a job by
dragging them** (hero orders, brief 260; owner 2026-10-28: one hero, one job,
less micromanagement than area flags).
- **Heroes live on the mat.** One with no job waits in a row in front of the
  Guild Hall. The hero bar is the roster: a click or a right-click on a hero
  opens their Hero drawer; it says on hover what they are doing, wears a yellow
  alert when only the player can get them going or a red one when wounded, and
  can be dragged from.
- **Drag and drop only; right-click inspects** (playmat declutter §4; owner,
  2026-11-23; replaces brief 610's select and right-click orders). Dragging is
  the one way to give an order. A plain click on the mat does nothing, and
  nothing is selected. **A right-click on a Token opens its card, on a hero
  (on the mat or the hero bar) their Hero drawer**; a right-click is never an
  order, and double-click opens nothing. Other clicks on a Token are unchanged:
  the recipe gear and the problem mark open the recipes, a finished quest is
  claimed, and in Demolish a click marks.
- **Drag a hero onto a Token** they can work (their figure, their job flag, or
  their figure on the hero bar): they walk there and work **only that Token**,
  a tree, a vein, a station, a Field, an enemy or a boss (a retired Promotion
  Token is nothing to work: K1).
  Onto **bare ground**: they walk there and wait (the flag marks the spot until
  they arrive). Onto the **Guild Hall**: they go home.
  A hero dropped on bare ground goes exactly where they were let go, among
  Tokens too (heroes walk over Tokens): no room test, no nudge, no fly-back;
  the spot must be on the mat. That is also how to stop a hero: drop them on
  bare ground (they wait there) or on the Guild Hall (home).
- **While a hero is carried**, every Token they could work glows, a dashed gold
  line runs from the hero to the pointer, and the flag snaps onto a Token they
  can work; over one they cannot, a red bubble says why. **A drop on a Token
  they cannot work is refused** with the reason ("Needs Pickaxe", "Mining level
  too low (needs 25)", "Nothing to work here" for a Token no hero works) and
  they keep the job they had.
- **Drag hints** (brief 490): while the carried hero is over a Token, **every
  hero** shows whether they could work it, over their figure on the mat, on
  their hero bar card, and the carried hero's also centred just above the
  Token's sprite (under the refusal, when there is one): the **tool** the Token
  needs (their own fitting tool, else the lowest tier that will do) and the
  **skill** icon with their level under it, each outlined green when they pass
  and red, drawn much darker, when not, by the same checks the game uses. A
  Token with no tool need shows the skill only; one naming no skill shows
  nothing. Over an **enemy** each hero shows only the weapons and shields in
  their hands instead (a two-handed weapon once; never a tool; no weapon or
  shield shows nothing), with no outline. Marks are drawn at 1x (32 px) at the
  mat's natural 2x Token scale.
  Hero speech and the bar's bubbles step aside while the marks show; the marks
  go when the pointer leaves the Token or the hero is dropped.
- **One hero per Token.** A hero sent to a Token another hero works waits
  beside it and takes it the moment it is free.
- **The job flag** (Lucide's triangle flag, in the hero's colour) peeks out from
  behind the top-left corner of the job's Token, drawn behind its art. Hovering
  a hero, on the mat or the hero bar, outlines their job.
- **When the job stops, the hero waits there** with the words for why: a resting
  vein, a regrowing tree, a growing Field, a station out of an input ("Needs
  Coal" over the station), an enemy waiting to respawn ("Waiting for Copper
  Vein", said silently; "Waiting for Goblin.", said out loud). A felled tree is
  followed through its Stump and felled again when it stands. **A Token that
  becomes another** (a Foundation built, a Token grown or changed) keeps its
  hero if the new Token is work they can do (T-608). **A missing input the hero
  carries** (bait, arrows, a seed for their Field) sends them off with the
  words for it, always "Needs" and the item ("Needs Copper Arrow", "Needs Worm
  Bait", "Needs Wheat Seed"; owner 2026-11-21): one rule (T-573, T-623,
  T-629). **A Token gone for good** (used up, removed, demolished, or become
  work they can't do) leaves the hero where it stood with a yellow **"needs a
  job"** mark, and they say "I need a job."
- **One hero per link** (owner): a hero no longer mines and then smelts on
  their own. A miner feeds the Bank and the Furnace's hero draws from it.
- **Sticky**: a hero never leaves mid-cycle. A new order, a stop or a recall
  resets the progress of the Token left behind; a moved Token keeps its hero and its
  progress (the hero walks after it).
- **Camps** (brief 260 O2) are Tokens built on a Foundation, each naming a
  skill (CMS: the Camp block): **Logging Camp** (Forestry),
  **Mining Camp** (Mining), **Fishing Hut** (Fishing), **Farmstead** (Farming:
  it harvests the ripe Fields and picks the bushes in its reach). **Every camp
  works the one standard reach, 240 u** (§Reach; owner, 2026-11-10): a camp no
  longer has a reach of its own, and nothing widens it. A hero sent
  to a camp works the **nearest free Token of its skill they can work within
  its reach** (nearest to the hero, then the earliest placed; no priority), finishes each cycle and keeps the Token while it can run, then
  moves to the next (never idle in between: the moment a Token is used up or
  an enemy beaten counts as between jobs, with no idle line or mark); with
  only resting or growing Tokens left they wait
  silently by the camp; with everything taken they say "Nothing to work near
  Logging Camp". **Any number of heroes** may work from one camp, one hero per
  Token. A drop on a camp whose Tokens the hero can work none of says why; an
  empty camp takes the order. Hovering or carrying a camp, or hovering a hero
  working from one, shows its **reach ring** (an enemy camp shows none); a camp
  hovered or carried dots every Token in its reach (§Reach).
- **Enemy camps** (a Goblin Camp, a boss's den) take the same order: the hero
  hunts what the camp spawns, one at a time, and waits beside it for the next.
- **The War Camp** (brief 630 B2; the rule is built, the Token comes with the
  content agent's building pack) is a camp whose skill is a combat style (CMS:
  the Camp block, any style under Combat; the style is only the mark). A hero
  sent to it **fights every enemy in its reach**, whoever spawned it or none,
  **one at a time, in the style of the weapon in their hands**: the nearest
  free enemy from where they stand; enemies stand still, so the hero walks to
  each. **A fight once taken is finished**: the enemy stays theirs until it
  falls (every life of an enemy with several), even if a crowded fight's step
  or the player's move carries it outside the reach; only the next choice reads
  the reach again. With none left they wait at the camp ("Nothing to fight
  near War Camp"; they say "Nothing to fight here."), and take any enemy that
  later comes into its reach, placed
  or spawned. A defeated hero stops as anywhere. It takes anyone who can
  fight; an enemy another hero fights (sent straight at it, or from an enemy
  camp or another War Camp) is passed over, never shared. While a place is held
  by its arrival a War Camp waits like every camp ("Beat the enemies here
  first"). Carried over a War Camp, each hero shows the weapons in their hands,
  as over an enemy. *(`Camps.js` `keepsWork`, `tokenConstants.isWarCamp`)*
- **Walking costs time**: heroes walk at 120 u/s (about 16 s across the mat) in
  straight lines; the cycle starts on arrival. Idle heroes potter within 80 u.
  *(`HeroMotion.js`)*
- **Returning to a Region**, heroes take up their jobs there again. An old
  save's flags load as orders: a flag on a Token becomes a job on it, an area
  flag a hero waiting where it stood.
- **Speech bubbles** are for moments (going idle, a job gone, a Token used
  up). Max 3 per hero. A bubble for something that needs the player ("Needs
  Coal", "My axe broke!") waits until hovered or clicked or until the need is
  met; hovering dismisses it, and the Token's "!" stays until it is fixed (owner
  2026-11-21, T-496, T-497). Lines: [`speech_bubble_lines.md`](speech_bubble_lines.md).
- *(`Flags.js`, the orders and the claims; `Orders.js`, the drop and the stop;
  `rightClickOrders.js`, the right-click; `Camps.js`)*

---

## 5. Economy and items

- **Items are the only currency** *(`GoldRetired.test.js`)*. Every price is a
  list of items. Nothing can be sold. The Shrimp Market Token runs but pays
  nothing; markets are cut for now (§16, T-127).
- **Item sinks**: surplus and high-tier items are meant to be spent on
  **upgrades and construction** (Hall upgrades, stations, recipes), not sold
  (owner 2026-10-06).
- **154 items** (`data/items.json`). An item's `value` is a CMS number, set by
  the simulator for balancing; **the game never shows or spends it** (owner
  2026-11-20, fine as is). **Every gathered item has a job** (owner 2026-11-20,
  T-626): nothing is gathered that nothing uses.
- **The Bank**: one slot per kind of item, stacks effectively unlimited.
  **Each tab holds 64 kinds; 1 tab + 1 per Bank Tabs rank (16 tabs = 1,024).**
  A new kind goes to the tab it was last filed in, else the first tab with
  room; when no tab has room, it stays on the mat as loot. Bank Slots retired
  (brief 310): an old save's ranks are dropped and a tab holding more than 64
  spills into tabs with room, the rest kept until moved. *(Inventory,
  `bankTabs.js`)*
- **Bank search and Sort** (brief 310): one search across all tabs matches
  name, tag, type and how the item is worn ("Hand"). Sort (beside Select)
  orders this tab or every tab in place by type, then the item's own tier
  (none last), then name; the dragged order holds until Sort is pressed.
  *(`bankSort.js`)*
- **Looking at an item in the Bank** (briefs 400, 570): hovering a tile gives the
  tooltip (name, count, tool, tags; no type or Equippable line). **The Item drawer** opens and
  closes with the Bank, on the screen's side away from the nav, the full height: it shows the item
  last clicked this session (else the open tab's first item, else a calm empty line): its name and
  a book to its Encyclopedia page, the sprite at 4×, the count, its tags as pills that explain
  themselves on hover, everything it does (a weapon's stats, resists, what it restores, the
  description, and **the effects it gives**, in the effect wording, before it is worn: a dagger's
  crit, a drink's buff; the tooltip lists them too, owner 2026-11-21, T-639), the actions, and how
  many were collected this run. A press that moves 8 px is a drag instead, and the click that ends
  a drag picks nothing; in Select mode a click selects. The mat stays where it is while the Bank is
  open. **Discard** throws a stack away (it asks first), nothing back (owner 2026-11-21, T-638);
  nothing is sold.
  *(`ItemDrawer.jsx`, `SideDrawer.jsx`)*
- **Supply is automatic**: Tokens take inputs from the Bank, then from loot on
  the mat. A cycle is all-or-nothing; first come, first served.
- **Tools and weapons that break** — **Built (brief 480 L1); no content uses
  it yet.** An item's `breakChance` (CMS: Break chance %, on a tool or a weapon
  only; a percent above 0 and up to 100) is rolled **only as a cycle it was
  used for completes**, never part-way (owner 2026-11-05: the swing is just
  art): a **tool** at the end of each work cycle on a Token that needs it (the
  highest-tier fitting tool in the hands, the one the cycle used; a failed cycle
  counts), a **weapon** at each **kill** (a fight's cycle), the weapon swung.
  A broken item is gone from the hero's hands for good, and nothing takes its
  place. The hero says "Rusty Woodaxe broke!" (gold) and stops with the yellow
  alert: with a broken **tool** they keep their order and wait by the Token
  ("Oak: Needs Woodaxe"; a second fitting tool in the other hand keeps them
  working), working again once handed a new one; with a broken **weapon**
  their order ends where they stand ("Needs a job"), since anyone may fight
  barehanded and a kept order would punch on. **One random draw per such
  cycle**, after everything else that cycle drew, and **none** for an item
  with no chance, so time away breaks the same item on the same cycle as live
  play, and content without the field plays exactly as before. Time away's
  summary lists what broke (§10). The item's tooltip and Encyclopedia card say
  the chance ("1% chance to break each cycle", "… each kill"). Both audits name
  a chance on an item that is neither tool nor weapon, or out of range.
  *(`itemBreak.js`, `equipment/Breakage.js`)*
- **Recipes** (117, `data/tokenRecipes.json`): construction 51, smithing 34,
  cooking 16, crafting 11, farming 3, alchemy 2. Stations never wear (§3), so a
  recipe costs its station nothing. A new station is idle until the player picks
  a recipe. Example: Copper Ingot = 4 Copper Ore + 1 Coal, 8 s.
- **One building per skill** (brief 630 B1, T-307; owner 2026-11-04). A
  skill's building (the Blacksmith for Smithing, the Kitchen for Cooking, the
  Workshop for Crafting, the Apothecary for Alchemy, each with its variants;
  the buildings come with the making plans, T-632) works as its skill with **no station kind**
  ("Any station" in the CMS), so it offers **every recipe of its skill**,
  smelting and smithing alike; the recipe list is gated by level as for any
  station (what the guild's best hero in the skill can run, then the next two
  as "???"). A variant is another building of the same skill and offers the
  same list. **The craft station kinds are retired** (Furnace, Smithy,
  Kitchen, Brewery, Tannery, Workbench, Alchemy Table, Summoning Circle):
  a station or a recipe still naming one reads as naming none, so the old split
  stations keep working, each offering its whole skill, until the plans'
  buildings replace them (T-632; the Campfire, Ceramics Kiln, Grandma's Kitchen
  and Fighter's Academy retire, T-633). The retired kinds leave data and the CMS
  (T-635). Smithing's high levels get more than ingots and pickaxes, and Cooking
  climbs past 35 (T-632). **Only Farming still splits its recipes by
  kind**: a station's `Works as` may name Field, Herb Garden or Windmill, and a
  recipe the kinds that make it (`stationKinds`, the CMS's "Made at", offered
  on Farming recipes only); a recipe naming no kind is offered by every station
  of its skill, and a station with no kind offers its whole skill. A saved
  station set to a recipe its kind no longer offers says "Choose a recipe". A
  recipe's context tags still work beside the kind.
  *(`recipePoolRegistry.recipesForStation`, `stationKindOf`, `STATION_KINDS`,
  `RETIRED_STATION_KINDS`)*
- **Upkeep**: spawners pay per spawn (table above). The top bar shows total
  upkeep per minute; the panel shows stock and "runs out in". Unpaid = the
  spawner waits; nothing goes into debt. **Rule upkeep** (a rule that costs
  items on its own clock) is **Latent**.
- **Passive Production** (the Guild Hall's free income, no hero needed): one
  lap pays every line at once, dropped as loot beside the Hall:
  1 Oak Seed, 1 Wheat Seed and 1 Apple Seed (*placeholder*; the CMS block is
  still called `trickle` in the data), plus the Wishing Well's Water and the Well
  stars' lines. **The lap is 10 minutes**, shortened by the guild-only **Lap Time**
  rule of a Guild Hall star (brief 390 G5; the pack's Swift Laps, at the Well, gives 8, 6,
  then 5 minutes, priced by the ledger (owner, 2026-11-06)), floored
  like any speed-up and held to the whole second; one lap for every Token that pays.
  A star bought mid-lap keeps the time already run. *(`PassiveProduction.js`)*
- **The Shop** sells the Foundations only (see §3, Foundations), for items,
  and buys nothing from the player (owner 2026-11-20, fine as is), all available from the
  start; price is the only gate (*placeholder* prices). An unbuilt
  Foundation goes back for its full price (§3, Foundations). Coast and Goblin
  Camp come from the Starter Camp and the world map's tables instead. *(`Shop.js`)*

---

## 6. Combat and enemies

### Enemies — Built
Enemies are Tokens with `enemy: { level, style, kinds?, resistances?, moves? }`.
**The level fills every number from the level table**: HP 20 + level, plus 4 HP
per 30 levels (the old armour step), a hit of 1 + 1 per 20 levels, **Attacks
every** 3 s, XP 10 × 1.065^(level − 1), no Dodge or Accuracy, a 5 % crit (the
table and its worked duels: `concept_combat.md`, "The level table and weapon
tiers").
- **Resistances and weaknesses** come in **fixed steps** (owner): resist 25,
  50 or 100 %, weak 25 or 50 % (`resistances: { slash: 50, crush: -50 }`), by
  damage type, several per enemy; **only the nine types carry numbers**, no
  groups (owner 2026-11-20, T-532; the CMS fill-in button sets Slash, Crush and
  Stab at once). A fighter's resistance to a type is **all its lines for that
  type added**, heroes and enemies alike (effects on it included); an enemy's
  authored line replaces its kind's preset for that type. Readable from the
  creature: a shell resists Slash, a fire elemental ignores Fire. Most enemies
  have 0–1 lines, bosses up to 3, and no enemy shuts out every type a style can
  reach at its tier. *(`damageTypes.js`)*
- **An enemy's effects are Passive or Active** (owner 2026-11-20, T-539):
  - **Active: its attacks, its moves** (owner: "each enemy has a few attacks,
    picked at random"): one made each attack, **picked by weight only** (no
    every-Nth timing for an enemy; `moves: [{ name, damageType, hits,
    effectId, target, lasts, weight }]`). A move hits with the enemy's own hit
    in its own type, or lands an effect on itself or the hero, or both: the
    owner's chicken Pecks (Stab), Scratches (Slash) and Flutters (no hit: +50 %
    Slash, Crush and Stab resistance on itself for one attack); the Big
    Lizard's Tail Smash rides a Heavy Strike for that attack. **An effect on
    the hero lands only if the attack hits**, by the same accuracy as any
    attack, with no separate chance; **an effect on itself always happens**.
    Poisoning moves carry Venom (the Venomous kind retires). An effect lasts
    **one attack** (until the next attack on its bearer is over, hit or miss),
    **the swing** (on itself only) or **the fight**; a status keeps its own
    lifetime. A move with no name reads **Strike** and hits as **Crush**
    (owner 2026-11-20, T-561, A31). The log and the fight window name the move
    made by **its own name** (Heavy Strike, Tail Smash, T-541), and a
    **special** move (one that lands an effect, or does not hit) is also said
    in a bubble over the enemy's bar on the mat; a plain hit, named or not, is
    not. *(`enemyMoves.js`, `isSpecialMove`)*
  - **Passive: a trait always on, or a rule that fires on a condition** (below
    a health line, when struck; Boss moves, below). **Kinds** are traits:
    none, one or two, each **an ordinary library effect the owner edits in the
    CMS** (owner 2026-11-20, T-540; the kind tick boxes pick from them):
    **Armoured** Slash, Crush and Stab resistance 50 % and slow (Attacks every
    4 s, same hit); **Nimble** +15 Dodge; **Swift** Attacks every 2 s at 2/3 of
    the level's hit; **Brute** Attacks every 4 s at 4/3 of the level's hit and
    at least 1 more. Swift clashes with Armoured and Brute (both set the
    attack time); the CMS refuses the pair. Kinds never change HP or XP. A
    passive is named by the effect it lands (Enrage).
- **Order**: the level table, then each kind in the order ticked (hits rounded
  halves up, at least 1), then **any number written beside the level** (`hp`,
  `hit`, `speed` fast/normal/slow, `xp`, `dodge`, `accuracy`, `critChance`)
  **replaces the result outright**, and an authored resistance line replaces a
  kind's on the same type. The CMS shows every number filled from the level and
  kinds, greyed "from level", until the author types one ("yours", with a
  button back). *(`enemyProfile.js`)*
- **An enemy keeps its damage and heals 5 % of its max health a second** out
  of a fight, rounded up (owner 2026-11-20, T-546): it makes the player stay in
  the fight, but a misclick costs little. Kept on the
  enemy, saved, and caught up after time away or a Region swap; the 5 % belongs
  on the tuning page (T-253).

19 ship, across all four styles: 11 Melee, 4 Stealth, 3 Magic, 1 Ranged (a
spread to widen, T-567). The **Small Slime** is the tutorial's first foe and has
no camp.

| Enemy | Level | Style | Kinds | Boss |
|---|---|---|---|---|
| Thorn Elemental | 1 | melee | — | |
| Cow | 1 | melee | — | |
| Small Slime | 1 | melee | — | |
| Crab | 3 | melee | Armoured | |
| Wolf | 4 | melee | Swift | |
| Goblin | 5 | melee | — | |
| Bee | 6 | stealth | Nimble | |
| Greater Slime | 8 | melee | Armoured | yes |
| Wolf Alpha | 10 | melee | Brute | yes |
| Goblin Chief | 12 (hit 3) | melee | Brute | yes |
| Water Elemental | 12 | magic | Armoured | yes |
| Wind Elemental | 12 | ranged | Swift | yes |
| Queen Bee | 14 | stealth | — (Venom on its moves) | yes |
| Frog | 15 | stealth | Nimble | |
| Sulphur Lizard | 16 | melee | Armoured | |
| Fire Elemental | 17 | magic | Brute | |
| Toxic Frog | 22 | stealth | — (Venom on its moves) | yes |
| Big Lizard | 24 | melee | Armoured | yes |
| Fire Elemental Chief | 25 | magic | Brute | yes |

Their resistances, weaknesses and moves are authored (the combat content pack).

- Goblins come from the Goblin Camp. **Enemies stand still** (owner,
  2026-11-05): an enemy stays where it spawned (a spot round its camp), where
  it is placed, or where the player drops it; a moved camp leaves its enemies
  where they stood. The only time one moves is a short step to open space
  before a crowded fight (§6, Fights), and it stays where it stepped. No walk
  animation is needed; the step slides in the idle pose.
- **No ambushes: combat is always started by the player** (owner,
  2026-11-05). No enemy attacks first: a hero fights only an enemy they are
  sent at (or one their enemy camp or War Camp hands them, §4 Camps), and
  nothing pulls a hero off their job. A hero working right beside a goblin
  camp is never attacked.
- **A boss** fights only the heroes sent at it, like every enemy. Never made by
  a rule. It comes from a camp of its own (later a Summoning Circle,
  Encounters, below), never loose in an arrival (owner 2026-11-20, T-547).
  **A boss is what a boss camp spawns** (owner 2026-11-21): nothing on the enemy
  itself marks it, and the CMS's boss tick on an enemy goes (brief 740 C5). The
  table's Boss column names the enemies whose camp is a boss camp.
- **Every enemy has one use** (owner 2026-11-20, T-545): a kill uses it up and
  its camp's clock brings the next (§3 Spawners). Nothing stands back up.
- **No hover**: an enemy's **Token card** shows everything (owner 2026-11-20,
  T-544): level, Style, health, moves, resistances, kinds and drops. Kinds stay
  hidden ("? fight one to learn") until that enemy has been fought; the rest
  shows from the start.

### Encounters — Built (brief 220 C5)
- **Every fight is one-on-one**, bosses included: a Token holds one hero's
  claim. A second hero sent to a busy enemy waits beside it and takes it within
  a second of it coming free, as it stands (it keeps its damage, healing 5 % a
  second). No random roll. The waiting hero says "Waiting for {enemy}.", their
  job flag's hover reads "{enemy} — {hero} is fighting it", and the roster line
  says "Waiting for {enemy}". A save holding two heroes on one enemy loads into
  one fight (the second waits).
- **Enemies come from camps only** (owner 2026-11-20, T-545, T-547), and a
  settled place's arrival (§10), one use each and tied to no camp. **Bosses
  come from camps of one**: an ordinary spawner (the Chief's Tent, the Slime
  Pit) whose spawn list names the one enemy, allowance 1, on its own interval:
  the same machinery and CMS fields as any camp. The boss stands by its camp; a
  place brings one through the world tables' camps. The camp's clock stands at
  zero while the camp is full, so a beaten boss comes back one whole interval
  after it falls, and a place's camps sleep while its arrival holds the mat
  (§3, Spawners).
- **A guardian** (none authored yet) would be a tough enemy whose camp stands
  by a rich node. It blocks nothing and attacks no one: a hero works the node
  in peace, and another may be sent at the guardian.
- **A Summoning Circle** (none authored yet; the Summoning skill's, §4) is a
  station whose recipe uses up a summon item (its input) and makes its boss
  beside it (a Token output). Its recipe is picked once, as any station's.
  Without the item it waits ("needs" the item, the usual yellow mark); with
  several in the Bank it calls one per cycle while a hero works it. A boss it
  called is gone once beaten.
- **No node ambushes** (owner, 2026-11-05): a Token's rule never spawns an
  enemy. A `Spawns` rule that names an enemy is refused, rolls nothing and
  costs nothing; the editor offers no enemy to a Spawns rule, and the content
  audit names such a rule so it can be deleted.
- **Enemy camps** are spawners; a hero sent to one hunts what it spawns (§4,
  Orders). Hovering or dragging one shows no ring (its enemies stand where
  they spawned, and nothing it does reaches its neighbours). Lure buildings
  are parked.
- **A beaten enemy**: the hero who beat it says "{enemy} Defeated" (a Token used
  up says "{token} Depleted").

### The fight — Built
- **Attacks.** A hero **Attacks every** 2 s (fast), 3 s (normal) or 4 s (slow),
  by their weapon (barehanded: 3 s). The weapon swung is the first in the hands
  the hero may hold (its level met); its style is the hero's for the fight. An
  enemy attacks at its own speed (3 s unless a kind or the author says
  otherwise). **Attack Speed** (good is plus; owner 2026-11-20, T-536) moves
  either side's attacks, kept between a quarter and four times the weapon's or
  the enemy's own time.
- **Damage types** (owner, brief 280): nine types, **no groups** (owner
  2026-11-20, T-532): only the types carry numbers.

  | Types | Mostly reached by |
  |---|---|
  | **Slash, Crush, Stab** | Melee (all three), Stealth (Stab), Ranged (arrows, and most bows: Stab) |
  | **Fire, Ice, Electric** | Magic (each weapon names its element), a few special bows |
  | **Poison** | Venom's ticks (a status, §6 Status effects), a few enemies' spits |
  | **Light, Dark** | later content |

  **Only weapons and ammo give a hit its type**: a weapon has one, a ranged shot
  two (the bow's and the arrow's). Armour, off-hand items and elixirs only
  boost or resist types. A fist is Crush. *(`damageTypes.js`)*
- **The hit, in order**: (the weapon's damage, a fist 1, **+ 1 per 20 combat
  levels + flat Damage from gear, both on the weapon part only**) × the matchup
  × Damage % buffs × (1 − the hero's damage cut for the style, from gear) → × 2
  on a crit (always double, below) → each part × (1 + the attacker's
  **Type Damage %** for that type) × (1 − the target's **resistance** to it
  after Sunder) (owner 2026-11-20, T-533: the boost first, then resistance cuts
  what is left: Poison +20 % on 50 % resistance does 60 %, 100 % resistance is
  always 0, a weakness of −50 % is × 1.5) → the parts summed → **the fraction
  rolls**: 1.1 does 1 nine times in ten and 2 one time in ten. No flat armour
  and **no "at least 1"**: a resisted hit can do 0. A landed hit that does 0 is
  still a hit (On Hit rules fire). An enemy's hit is its Hit (+ flat Damage)
  the same way, in its move's type (a move with no type hits as Crush).
- **All damage rolls its fraction** (owner 2026-11-20, T-535): a swing, a Deals
  rule and a status tick alike, drawn from the same seeded order so a catch-up
  replays it.
- **Arrows**: a hero fighting with a bow shoots the first arrow carried in a
  consumable cell that the Bank still holds, **one per shot, hit or miss**. A
  shot is the bow's damage (with the level step and flat Damage) in the bow's
  type plus the arrow's damage in the arrow's type (`arrow: { damage,
  damageType }` on a Consumable; usually Stab), so a ghost immune to Stab still
  takes the bow's part. **No shot without arrows** (owner 2026-11-20, T-573):
  when the last arrow is shot the hero leaves the fight and says "Needs Copper
  Arrow" (its name; owner 2026-11-21); a hero holding a bow with no arrows carried and in the Bank does
  not start a fight; the enemy keeps its damage. **Preservation** may save an
  arrow (gear, trinkets, Ranged perks, a Hall star; no quiver, T-574). An
  arrow's own On Swing and On Hit rules count only on the shot that spends it
  (a Sundering arrow sunders only when shot). *(`combat/Arrows.js`)*
- **Motes** (owner 2026-11-20, T-579): a magic weapon names the Mote it burns
  and **every cast spends one**, carried and spent like arrows. With none left
  the hero keeps casting at **half damage** in the weapon's element and says
  "Needs Fire Mote" once a fight. Motes needn't match damage types. A magic
  weapon naming no Mote casts free at full damage, and the content check names
  it (2026-11-21).
- **Kunai** (owner 2026-11-20, T-586): a thrown Stealth weapon that spends one
  a throw: the Kunai in the hand is kept and each throw spends one from the
  Bank; with none in the Bank the hero fights with the one in hand at half
  damage, as with no Motes (the same half, on the tuning page, T-253). Arrows, Motes and
  Kunai follow one ammo rule.
- **Poisons** (owner 2026-11-20, T-587): an optional consumable carried in a
  consumable cell, taken like an elixir at the start of a fight with a Stealth
  weapon (ignored with any other); its buff lasts a set number of attacks (a
  "for N attacks" length in the CMS), and each poison says what it does (Venom,
  crit, Sunder and so on). **Leftover attacks carry into later fights**; a new
  poison is taken only at a fight's start (owner 2026-11-21). Stealth's own hits are Stab.
- **Misses**: 10 % at an even level, 1 point less per level the attacker is
  above the defender (more when below), that part kept between 5 % and 25 %;
  then + the defender's Dodge − the attacker's Accuracy, kept between 5 % and
  40 %. Both sides roll the same way.
- **Crits**: 5 % (gear adds Crit Chance), **capped at 75 %** (owner
  2026-11-21; the ceiling on the tuning page, T-584), doubling the hit before
  the type factor. **A crit is always double**, for everyone: there is **no Crit
  Damage effect** (owner 2026-11-21, T-583); Stealth's big hits come from a high
  crit chance. Enemies crit at 5 % unless authored.
- **The fight window and the log name the type**: "Weak!" when the target's
  weaknesses outweigh its resistances across the hit's parts, "Resisted" the
  other way, by the same maths as the hit; a shot shows both its types.
- **Barehanded is a Melee punch**: 1 + the Melee level step, every 3 s, on the
  melee side of the cycle, in Crush, earning Melee XP. A hero's level for the
  damage step and the miss gap, both ways, is their level in the style they
  fight in.
- **A four-way cycle: melee > ranged > magic > stealth > melee**: +25 %
  damage for the favoured side, −25 % for the other (owner: early fights are
  barely shaped by it; at 20–30 damage it shows). Opposite pairs (melee and
  magic, ranged and stealth) are even, so each style has one good matchup, one
  bad one, and two even. A hero fights on their weapon's side (Melee
  barehanded). An enemy's Style is one of the four combat skills, spread so
  every hero style meets good and bad matchups (T-567).
- **No regen in a fight**: below 25 % HP the hero eats food instead of
  swinging; drinks never heal. Elixirs are drunk as a fight starts
  (section 4).
- **Fleeing**: dragging a hero to another job ends their fight, as it ends any
  job (owner). Picking up the enemy being fought ends the fight the same way:
  the hero's statuses come off (owner 2026-11-17). The enemy keeps its damage
  and heals 5 % a second out of a fight (§6 Enemies).
- **Crowded fights step to open space** (brief 360 C4): when a hero reaches
  an enemy and the fight about to start would cover another fight or a hero
  standing there, the enemy walks to the nearest clear spot within 160 u (one
  mat step) and the hero walks beside it; the fight starts there. A lone
  fight, or one with no clear spot that close, starts where it stands. What a
  fight covers is what is drawn over it at the mat's natural size: both
  fighters' art and, above them, the two health bars and the fight button; a
  hero covers their art and their bar; two closer than 8 u crowd. Fights
  count (a fight stepping aside, at the spot it is going to) and heroes
  standing still; Tokens do not, nor a hero walking past, nor one waiting for
  the same enemy. But the enemy is a Token: the spot it steps to must be one
  it may stand on, a full spacing (128 u) from every other Token and on ground
  it may stand on, or the fight starts where it stands. While it steps nothing
  pushes it, and nothing lands within its spacing of the spot it is going to;
  a step let go part-way (its hero sent elsewhere first) leaves the enemy where
  it got to. It is decided once, as the hero arrives: a fight never moves
  once begun, and the next kill of the same enemy fights where it stands. The
  enemy walks at its full speed (90 u/s), so a step delays the first swing by
  its length at that speed, at most about 1.8 s; the QA crowd's steps are
  8 to 48 u. Afterwards the enemy stays where it stepped (enemies stand
  still), and a hero whose job is elsewhere goes back to it, as before. A catch-up steps the same
  fights to the same spots (whole mat units, no random draw). Never saved: a
  save taken mid-step loads with the hero walking up again.
  *(`board/FightRoom.js`)*
- **Random draws, in a fixed order** so a catch-up replays the same fights as
  live play: an enemy draws its target every attack (even with one hero,
  `CombatAttackProcessor.js:202`) and, with two moves or more, its move; then
  each attack draws one number for the miss, on a hit one for the crit, and one
  for the fraction only when the hit has one; On Swing rule chances draw; a
  shot's arrow draws for Preservation (`Arrows.js:59`); a Deals rule or a
  status tick draws for its fraction. At a kill, a weapon with a break chance
  draws one last (§5); without one, nothing.
- **A kill is a combat cycle** (§3; owner 2026-11-20, T-550): it gives XP to
  the style fought in (the weapon's), with the XP bonus. Loot drops on the mat
  through Yield, Double Loot, Double Item (a Cleaver's) and bonus drops, and the
  enemy's rare table; never Refresh, Fail or Giant Harvest. Kill loot counts for
  the collection log and On Produces rules like any loot. A kill reaches its
  neighbours as **On Neighbour's Kill only**, never On Neighbour's Cycle
  (T-552), and an enemy's own On Cycle rules don't fire at its death. A
  double-item chance draws one random number per item it names that landed,
  and none when nothing offers it.
  *(`FormulaRegistry.js`, `CombatFormulas.js`, `src/systems/combat/`)*

### Status effects — Built
- **A status is a library effect with a status block** (`status: { stacks,
  ticks }`, the Status section of the CMS Effect editor): each landing adds a
  stack up to `stacks` (**at most 5**, a number for the tuning page, T-253; 1 =
  it does not stack, landing again renews it), its rules count once per stack,
  and it lasts `ticks` ticks, or the whole fight at 0. What it does each tick is
  an ordinary On Tick rule ("deals 1 damage to itself"); what it changes while
  carried an ordinary Provides (Burn's −50 % Food Healing). Statuses are
  separate from damage types (owner): a Fire weapon does not Burn unless a rule
  says so. *(`LiveEffects.js`, `effectLibrary.statusBlockOf`)*
- **Statuses are fight things**: one lands only on a fighter (a hero in a
  fight, or the enemy), and **every status ends with its fight**: the kill, a
  defeat, the hero leaving, a load. No hero falls to Venom on the way home.
  There is no game-time effect clock (retired, T-542).
- **One shared Rules tick every 3 s** for every lingering effect, statuses
  included (heroes in roster order, then each fight's enemy), so a status's
  first tick comes 0 to 3 s after it lands. A tick that defeats a hero is a
  defeat like any other (one banner, one gear roll); one that finishes the
  enemy is a kill before it attacks again.
- **The statuses** (the owner's numbers): **Venom** stacks to 3, 1 damage per
  stack per tick until the fight ends, and its damage is **Poison** that Poison
  resistance cuts (owner 2026-11-20, T-534); **Burn** does not stack, 1 a tick
  for 3 ticks, and food heals half while it burns; **Sunder** stacks to 3 and
  lasts the fight, each stack taking 10 points off **every resistance** its
  bearer has, never below 0 (a weakness, or no resistance, is untouched; it
  replaces the retired Pierce). Bleed, Stun and Shield wait for a later pass.
  **Flutter is not a status**: it is a move's effect lasting one attack (§6
  Enemies).
- What a fighter carries moves them: **Status Stack Limit** (a status stacks at
  most N lower; at 0 it cannot land) and **Status Immunity** name a status
  effect. A cap lowered mid-fight never strips stacks carried. No content
  carries either yet.
- What lands them: an enemy's move (Active, only if the attack hits, §6
  Enemies), an enemy's passive rule, and any rule's Applies on either side (an
  arrow's "On Hit: applies Sunder to the enemy", a poison's buff).
- **Shipped**: Venom, Burn and Sunder (landed by the Iron Bodkin Arrow). An
  older save's statuses (the old status engine's, which outlasted their
  fights) are dropped on load.

### Boss moves — Built
An enemy's **passive rules** (§6 Enemies) fire on the **fight moments** (§7):
**On Health Below X %** (once a fight) and **When Struck**; a hero's gear rules
keep **On Swing** and **On Hit** (every Nth swing or landed hit) too, but an
enemy's attacks are its moves, picked by weight with no every-Nth timing
(owner 2026-11-20, T-539). The shipped bosses use them:
- a **heavy strike** as a move: the Big Lizard's Tail Smash rides Heavy Strike
  (+100 % Damage) for that attack; the Goblin Chief and Wind Elemental carry
  theirs as moves too once re-authored (T-539);
- a **status attack** as a move: the Fire Elemental Chief's Burn, the Greater
  Slime's, Queen Bee's and Toxic Frog's Venom, each landing only on a hit
  (re-authored as moves, T-539);
- a **heal**: "On Health Below 50%: heals 10 health on itself" (the Water
  Elemental);
- an **enrage**: "On Health Below 30%: applies Enrage to the enemy for the
  fight" (Enrage: faster attacks; the Queen Bee, the Wolf Alpha below 50 %);
- **thorns**: "When Struck: deals 1 damage to the hero" (the Thorn Elemental).

On a monster's own rule "the enemy" is that monster and "the hero" the hero it
fights; "itself" is the monster. Enemies read flat and percentage Damage and
Attack Speed from the effects on them, as heroes do. A fight moment spends no
charge and has no cooldown. A move is announced by **its own name** (Heavy
Strike, Tail Smash), over the enemy and in the log; a passive by the effect it
lands (Enrage) (T-541).
*(`board/FightMoments.js`, `combat/FightHooks.js`)*

### The combat screen — Built (brief 220 C6)
What a player sees of a fight (owner's picks from the mock-ups, 2026-10-24/25).
Statuses are not drawn on the board.
- **On the mat** (owner's pick F, the reduced plate, 2026-11-05; brief 360
  C3): **no plate** under a fight. Over each fighter a small edition of the
  hero bar's health bar, its fill **green, amber or red by health** like every
  HP bar (owner 2026-11-20, T-556; thresholds picked at the eye-check) on a
  stepped black edge, the numbers written on it ("17/30"; the same bar over a
  hurt or hovered hero and a hovered enemy). **Between the two bars** the
  crossed-swords **fight button** opens the fight's detail view; when the
  fighters stand close the bars move outward just enough to leave it a gap.
  The elixir counts are the fight window's. Speech, callouts and "used"
  bubbles over a fighter stand above its bar and the button, never on them.
- **Bubbles over the bar** (owner, 2026-11-05: special moves only): an
  enemy's **special move** by name (one that lands an effect or does not hit:
  "Venom Bite", "Flutter"; a plain hit such as "Shiv" is the window's and the
  log's only) and a status landing on an enemy ("Burn!") in the speech frame
  over the enemy's bar; a
  status landing on the hero ("Venom!") over the hero's, as the hero's own
  line; a boss's own rule by its name over the enemy. They stack in a column,
  never on a number or another bubble, and are gone in about two seconds.
- **The window and the mat show a hit the same way** (owner 2026-11-20,
  T-557): the same look and timing, from one shared set of colours, icons and
  lengths.
- **Floats** rise over the middle of each fighter, just under the bar, and
  are gone in half a second: white on the enemy (on the strike frame of the
  hero's swing), red on the hero, "Miss", a big number under a gold "Crit!",
  green heals (a meal, or a rule's heal on either side), and Venom and Burn
  ticks in red with a drop or a flame. The hit's types, "Weak!" and
  "Resisted" are the fight window's and the log's. Two at once on one fighter
  stack downward.
- **The fight windows** (owner's picks, 2026-11-05: window B "the slim card",
  tab D "faces and bars"): one window per hero, opened by the fight button
  between the two bars, several open at once. A
  window **belongs to its hero**: it shows whatever they fight next ("Kira vs
  Goblin" becomes "Kira vs Wolf") and the last result between fights in its
  title bar, in the one word **Defeated** both ways (`Defeated Goblin in 42s`,
  `Defeated by Goblin after 1m 5s`; owner 2026-11-20, T-559), until its X or Escape closes it (Escape closes the
  top window, one at a time). Its title bar drags it (it stays on the
  screen); pressing a window brings it to the top. One narrow column: the
  **battle**, the owner's battlefield with both fighters at twice their art,
  the hero on the left facing right, moving as on the mat (an enemy without
  an animation sheet stands still: today every enemy but the Cow), the hero
  bar's HP bar with its numbers over each, and what just landed over each
  fighter (the number, Miss, Crit!, Weak! or Resisted and the hit's types,
  heals) with the enemy's named move in a speech bubble over its bar, any
  move, plain hits too; the **stat block** (owner, 2026-11-05: picture B's
  shared column), one row a stat with its icon in a shared middle column, the
  hero's value on the left and the enemy's on the right so each pair reads
  across (style and level, the hero's style icon in the middle and a side
  fighting another style shows its own beside its level; Damage with its types, before the other side's resistances and the matchup:
  the player does the sums; **Attacks every**; resistances and weaknesses, the enemy's as
  they stand in the fight). No swing words anywhere: an unnamed move reads
  **Strike**, and item tooltips say Damage and Attacks every 3s (T-561). The **enemy's attacks**, each with its type in a
  small tile, the last one marked "just used" in gold, and its kinds once
  fought; **what is on each fighter** in two columns (statuses with stacks,
  lingering effects with a gold star); the hero's **elixirs** with the fights
  each has left (one drunk mid-fight is logged at once, T-558); and the **log**, closed until asked for, holding the whole of
  this fight and the last one ("This fight" / "Last fight", newest first, at
  most 400 lines a fight). **Minimize** puts a window away as a **tab** (only
  a minimized window has one): the hero's face, both names (the enemy's gives
  way to the result between fights), both health bars with their numbers,
  the enemy's face, in a strip along the mat's foot above the hero bar from
  its left; clicking it brings the window back where it was. ⚠️ Nothing
  redraws faster than its fight changes (T-198): a window draws again only
  when its fight's record changes, a minimized window draws nothing, and a
  tab only when a name, a health or the result changes. A fight is one enemy
  engaged: each kill starts the next. The log is kept in memory per hero and
  never saved.
- **No enemy hover**: the enemy's Token card shows everything (§6 Enemies,
  T-544). A hero's fight button looks open while that hero's window is open,
  top or not; a minimised window counts as closed (T-562).
- **"While you were away"** says the fights as news, only each enemy defeated
  with its kill count (brief 440); **defeats lead the news column** (T-560). Fights won
  and lost, food and elixirs used and drops are not listed (what was used and
  dropped is in the item list).
- A catch-up records and draws none of it (every listener is a UI listener);
  a fight still running after one is picked up at its next event, or when its
  panel opens. Placeholder icons are drawn in code (`owner_art_list.md`).
  *(`ui/components/combat/` (the windows: `FightPanelPopup.jsx`, `FightPanel.jsx`,
  `FightTab.jsx`, `fightPanelStore.js`), `board/FightLayer.jsx`, `board/fx/fightFloats.js`,
  `board/HealthBar.jsx`, `hud/CatchUpOverlay.jsx`)*

---

## 7. Rules and effects (the statement grammar)

Tokens carry **named effects** from a shared library (`data/effects.json`,
83 effects). An effect is one or more **statements**, readable as a sentence:
`[When <moment>,] <verb> <payload> [to <filter>] [reach] [role] [, costing
<upkeep>]`. *(`src/systems/effects/statements.js`)*

- **16 verbs**: provides, grants, acts_as, requires, restocks, converts,
  cannot, applies, deals, heals, restores, removes, spawns, transforms,
  station, promotes (retired with jobs: it reads, does nothing, and is not offered).
- **16 moments** (On Cycle, On Neighbour's Cycle, On Depleted, On Neighbour's
  Kill, On Engaged, On Tick, On Bank Holds…, the four fight moments: On
  Swing and On Hit, each "every Nth" (a hero's gear), On Health Below X % once
  a fight, and When Struck,
  and **On Work Start**, a carried item's own: below),
  **4 roles** (itself, the hero, that Token, the enemy), **5 filters**,
  **4 reaches**. On Tick fires every 3 s. A fight moment runs only Applies,
  Deals, Heals and Removes (the editor offers it to no other verb), spends no
  charge and has no cooldown.
- **Modifiers** that neighbours (or a hero's items) provide: yield, work
  time, input cost (**Efficiency**: a cost that comes out fractional is made whole by chance as
  the cycle pays, so it averages the exact cost: 10 Coal at −12 % is 8.8, so 9 Coal four times in
  five and 8 one time in five; increases round alike, and there is no minimum of 1, so 1 Coal at
  −20 % is free one time in five. A cycle starts only with the cost rounded up in the Bank, and a
  whole cost draws no chance; owner, 2026-11-11), **grow time** (a growth or a refill's rest, from neighbours
  only), **crop load** (the harvests a Field's crop ripens with:
  a Composter, §3 Farming; read once as it ripens), XP bonus (its fraction of XP paid by chance),
  double loot (every drop of the cycle or kill, the bonus drops a building or a carried effect
  grants it included: owner, 2026-11-12), **double item chance** (a chance
  that one named item, when a cycle or a kill drops it, comes out doubled: the
  Cleaver's Raw Beef), **Refresh** (a chance a cycle spends none of the Token's
  charges, and a Field's harvest none of its load; a failed cycle still spends; rolled
  once per finished cycle, from a building in reach or a Hall star, aimed by the rule's
  Token and narrowed by skill), **Preservation** (a chance a cycle uses none of its
  materials: it still runs, makes its outputs and spends its charges, and a Field's owed
  seed is never paid for that crop (owner, 2026-11-11); a failed cycle still pays and never rolls.
  It also keeps a hero's ammo, Food, a drink's or work potion's new dose, a fight elixir's
  or bait from being used up, and an item its own rule spends as it fires (the rule still
  fires; owner, 2026-11-11), read at the Token the hero works or the enemy they fight.
  From a building in reach or a Hall star, aimed by the rule's Token; narrowed to a skill
  (that work's materials), or to an item or a kind of carried thing: Ammo, Food, Drink,
  Work potion, Fight elixir, Bait), **Lucky** (a higher chance on the Token's rare drop
  table, §3, with the table's own chance as the base: a percentage moves it in proportion,
  +10 % turns 1 % into 1.1 %, and the CMS offers it first; a flat amount adds points, +1
  turns 1 % into 2 %. Aimed by the rule's Token; a Token with no table ignores it, and an
  enemy's table is raised by Lucky aimed at the enemy), **Giant Harvest** (a chance a Farming
  work cycle's drops come in at ten times: every line, the rare table's find and the bonus drops a
  building or a carried effect grants the cycle, and with Double Loot both apply, twenty times; rolled once per finished cycle after Double Loot, **only on Farming
  work** (owner 2026-11-20, T-551; its hover says so), never on a failed cycle, the Guild Hall's
  lap or a kill; a Token output made beside a station is not multiplied. A hit is
  celebrated on the mat over the Token: a gold burst and a "Giant!" float; the Token's card shows
  no chip for it (owner, 2026-11-12). From a Hall star (its
  owner's place, brief 620) or a building in reach, narrowed by skill; owner 2026-11-12),
  **catch weight** (a percentage on one fish's weight in a
  water's catch pool: a better rod's bonus, §3 Fishing), fail chance (Tokens; **camp reach** is
  retired: every camp works the standard reach, so a rule carrying it does nothing, the editors no
  longer offer it and the audits name it); **Recovery** (shorter wounds, the Infirmary's),
  **Regen** (healing out of fights, §4), **loadout slots**, **XP for Everyone**,
  **Long-lasting Brews** and **Strong Drink** (guild-only: read from Guild Hall stars, §8, never
  offered on a Token or item); accuracy,
  damage, **dodge, crit chance** (capped at 75 %, §6; no Crit Damage), **Type
  Damage %** (the bearer's hits of a type, or every type: "Poisoner's Cloak:
  Poison 15"), **Type Resistance %** (hits of that type the bearer takes;
  negative is a weakness; no groups), **Sunder** (points off every
  resistance the bearer has, never below 0: put on a status), status immunity
  and **status stack limit** (one status effect stacks at most N lower or
  higher; at 0 it cannot land), **Attack Speed** and
  **food healing** (percentages, on a lingering effect: an enrage, Burn)
  (heroes, and enemies through effects on them). Most combat rows are flat
  amounts, and a new rule on one starts flat. **Damage, Attack Speed and accuracy** may be narrowed
  to a **combat style** (Melee, Ranged, Magic, Stealth): the rule then counts only while the hero
  fights in that style (the weapon's; barehanded is Melee), "but only for Melee fighters"; with
  no style it counts in every style. These three are the only combat rows a hero also reads from
  the guild (Guild Hall stars, §8), for the style they fight in; enemies never
  do. **Retired**: Block (a miss is
  the only failed hit), and Armor, flat Resistance and Pierce (brief 280:
  defence is percentages by type, Pierce became the Sunder status); they are
  no longer offered, do nothing, and the audits name any rule that still
  provides them.
- **The standard floor for speed-ups** (owner 2026-10-24, brief 230 S1a): every
  speed-up of a time (work time, grow time) stacks, but together they cut at most
  **80 %** of the authored time, one code constant (`loopConstants.MAX_SPEED_UP_CUT`;
  a CMS page for it is for a later ticket): five Minecarts at −20 % on a 10 s vein give 2 s,
  not nothing. A work cycle is still never under 1 s. A slow-down is never capped.
  *(`TileModifiers.floorSpeedUp`)*
- **Statuses** are library effects with a status block (§6): stacks, ticks,
  and an end with their fight. An enemy's move may land one (§6 Enemies).
- **Gear families**: a weapon or armour family's ability is one library
  effect every tier references with its own scale (1–5), so the tier raises
  the number. Gear's own resistances and damage cuts are fields of the item
  (§4 Equipment), not rules, so each piece reads as the owner's example does
  ("Iron Chestplate: Slash, Crush and Stab resist 20 %; Magic damage −30 %"); a Type
  Resistance % rule on gear still counts beside them. A tool's or weapon's
  **break chance** is a field of the item too (§5), not a rule.
- **An arrow's rules** count only on the shot that spends it: carried, it lends
  nothing; its On Swing and On Hit rules join the hero's for that swing.
- **Spawns and enemies**: a `Spawns` rule never makes an enemy, a boss or not
  (§6, Encounters: no node ambushes). The editor does not offer one; the
  game refuses one and the content audit names it.
- **What ships**: tool tiers (`acts_as`), station skills, two neighbour buffs
  (Coast −5 % work time; Windmill +5 double loot on Fields), a placement limit
  (≤ 2 Coasts nearby), bonus drops, Minecart restocking, the two (retired) promotions,
  and **Thorns** (1 damage to the hero on finishing a Redberry Bush; the Thorn
  Elemental's is a When Struck rule, §6). **Everything else in the grammar is Latent.**
- **A hero's milestone perks carry rules too** (§4): library effects held from a skill level,
  read exactly as the loadout's, free of any cost.
- **Items carry rules too** (a hero's loadout): a carried rule on On
  Neighbour's Fight fires as its hero's fight starts. An `Applies` of a
  library effect may last **for the fight** (until that fight ends, at the kill
  or when the hero leaves), which is how an elixir works: "When a fight starts,
  applies Valor to the hero for the fight", Valor being an effect that
  provides +1 Damage. An elixir's rules fire from its 10-fight dose, not per
  firing from the Bank. **For the swing** lasts until the swing being made is
  over (a boss's heavy strike); a status ignores every lifetime, having
  its own. Applies may aim at **the hero** as well as the enemy.
- **On Work Start** (brief 230 S6b) fires as the hero carrying the item starts
  a work cycle, on any Token or only one skill's ("On Forestry Work Start: …");
  a Token never hears it, and it has no cooldown. **For the cycle** lasts until
  that cycle (on that Token) completes; a cycle left part-way ends it at the
  hero's next cycle start, and it never counts on another Token meanwhile. An
  effect carried for a while also reaches the cycle's **bonus drops** with its
  standing Grants (the Birdwatcher's Bird Nest), free. A carried rule with a
  moment fires only on its moment, never again at a cycle's end.
- **A food, drink or potion's always-on rules do nothing** (owner 2026-10-24):
  only gear, weapons and tools act by being carried; a spent item acts only
  through its moment and dose (§4). The CMS and the boot audit say so.
  *(`consumableRule.js`)*
- Authored only in the CMS (the Rules Line editor). Editing a library effect
  changes every Token that carries it.

---

## 8. The Guild Hall and progression

- The Hall stands in the middle of the mat, can't be moved off it or demolished,
  and is excluded from the cap.
- **Scouting Flags is retired** (it widened the area flags that orders and camps
  replaced): a save's bought ranks are dropped without a refund.
- **Upgrade web** (separate full-screen view, a night sky of constellations): nodes unlock
  when linked to the Hall or to a bought node. Three tracks are built in (below; rank *n*
  costs 10 × *n* Oak Wood, *placeholder*); **every other star is content**
  (`data/hallStars.json`, authored through CMS change packs; brief 320): a constellation per
  skill linked to the Hall (its first star buyable at once), and more Hearth and Well stars.
  A star has ranks, each with the owner's tier, its own price, and its **whole** effect
  (not an increment): **rules** in the statement grammar (§7) held for the whole guild while
  the rank is held, in every Region and wherever the Hall stands (a skill's XP, Yield or
  Double Loot and Work Time narrowed to that skill, a combat skill's XP reaching the kills won in
  that style; Token upgrades aimed at a Token or tag:
  Grow Time for a vein's rest or a tree's regrowth (a star's Camp Reach rule is retired and left
  out: the boot audit and the CMS Audit tab name a star carrying one, to delete); the guild-only Recovery
  for the Infirmary (shortening wounds, even one already running, §4), Loadout Slots for one more of a loadout kind, Lap Time for the
  Passive Production lap, and XP for Everyone, below), and **lines** of
  Passive Production the Hall pays each lap beside the Wishing Well's Water. The sky grows to
  hold its constellations and is dragged when it does not fit.
  *(`guildUpgrades.js`, `hallStars.js`, `progression/HallRules.js`)*
- **XP for Everyone** (brief 620 E2; guild-only, a flat amount): a rank bought gives **every hero on
  the roster** XP **in every skill**, once, at the purchase; a hero who **joins later** (Bunk Beds,
  or any hero added) arrives with the whole of the ranks held, at full health. As for every star a
  rank lists the star's whole gift so far (rank 3 of 100 a rank lists 300), so a purchase gives
  what its ranks add (several ranks at once give what as many single buys give) and a recruit the
  held rank's figure; a rank listing no more than the one before gives nothing, and the boot audit
  names it. Nothing is saved for it: the gift stays in the heroes' own XP, a recruit's is worked out
  from the stars and the saved ranks as they join, and a load, a travel or a re-read of the ranks
  gives nothing. The gift is not counted in a hero's XP an hour, and raises max HP as headroom, not
  a heal. Its level-ups show as **ordinary level-ups** do, as if the heroes had earned the XP
  working: each skill that rose gets its float over the hero and its hero-bar alert, a recipe it
  unlocks gets the usual banner and a milestone perk its alert; the level-up sound plays **once
  for the purchase**, not once a level. A recruit's arrival is not a level-up: their own banner says they came. Read off the held ranks,
  never the guild-wide aggregator. The ledger does not rate
  it (it adds no work rate).
  *(`progression/hallModifiers.js` `xpForEveryoneOf`, `GuildUpgradeManager.purchaseRanks`,
  `hero/logic/HeroLifecycle.js`, `hero/everySkillXp.js`)*
- **Combat stars** (brief 620 E4): a constellation per combat style, **Melee, Ranged, Magic and
  Stealth**, with Damage, Attack Speed and Accuracy stars for the heroes
  fighting in that style (the rule narrowed to the style, §7). A star naming no style helps every
  fighter; enemies are never helped. The fight window's hit and swing, and the Hero drawer's combat
  numbers, include them. The star reads "Every Melee fighter hits harder" (swings faster, misses
  less), its rank "10% more damage", and the Hall's effects "Gives every Melee fighter 10% more
  damage in combat." The constellations are content (the CMS pack, brief 620 C1); the boot audit
  names a style rule narrowed to a work skill, and any other combat rule on a star (it reaches no
  one from the Hall). The ledger does not model fights, so it does not rate them.
  *(`combat/CombatFormulas.js`, `progression/hallStarText.js`)*
- **Long-lasting Brews and Strong Drink** (brief 620 E3; guild-only, each may name one kind of
  dose: **drinks**, **potions** (work potions) or **fight elixirs**, or none for all three).
  **Long-lasting Brews** makes a **fresh dose last longer**: a drink's 10 work cycles, a work
  potion's one cycle of its skill, an elixir's 10 fights, moved by a percentage (+10 % on 10 is
  11) or a flat number of cycles or fights, **rounded by chance** as a fresh dose starts (3.6
  is 4 three times in five and 3 two times in five, as Efficiency rounds a cost), never below one. A dose under
  way keeps the count it started with; the next one drunk gets the new length. **Strong Drink**
  makes **every number a dose's effects provide** stronger by a percentage: Beer's +10 % XP at
  +50 % is +15 %, Valor's +1 Damage +1.5, a chance held at 100 %. It counts each time the dose's
  rules fire, so a star bought mid-dose works from the next cycle or fight. Only provided numbers
  move: a grant (Birdwatcher's nest), a heal, damage, an immunity and a status's stack limit stay
  as they are. Strong Drink draws no random number; Long-lasting Brews draws one only as a dose
  of fractional length starts, and what the game shows never draws (a fractional length reads
  "10–11"). The Drink and Elixir tags say how long one lasts
  now, and the Hero drawer's Gear effects say "One lasts 11 work cycles, with Long-lasting Brews."
  and "Merry, 50% stronger with Strong Drink: Gives the hero 15% more XP." while a star moves
  them (nothing extra without one); the Token card's Hero Effects badge shows the stronger
  numbers. The rule reads "Makes every hero's drinks last 10% longer." and "Makes the effects of
  every hero's fight elixirs 20% stronger.", a star "Every hero's drinks last longer.", its rank
  "10% longer". The boot audit names a rule narrowed to something that is no kind of dose. The
  ledger does not yet read them.
  *(`hero/ConsumptionSystem.js` `doseLength`, `doseStrength`, `board/LoadoutMoments.js`,
  `effects/LiveEffects.js`, `effects/effectLibrary.js` `strengthenStatement`)*
- **Ring stars** (brief 380 M4): a star whose `opensRing` names a ring of the world map lets the
  guild settle that ring once its first rank is bought. Ring 1 is open from the start; a star per
  ring from ring 2, the wild rings too, each linked to the one before so they light in order. A
  ring no star opens is left open (the ledger's checks F say so). Its sentence says it opens the
  lands past the next border (no ring numbers for the player) and it wears a map's outline. The
  stars themselves are content, a change pack (`2026-11-06-ring-stars`: the Compass, five stars
  left of the Hall past the Vault, priced by the ledger). *(`world/ringStars.js`, `Settling.js`)*
- **The sky's look** (brief 390): stars spread 1.4 times their authored places apart, each with
  an item's outline over it (by the star's kind, or the star's own `outline`), its title under
  it and its rank only under the pointer; the web runs on under the nav and the drawer. Titles
  never overlap: stars side by side whose titles would touch are staggered when drawn (brief 570).
  The **Upgrade drawer** (brief 570; the side drawer in purple) is closed when the Hall opens and
  opens on a click on a star (a hover changes nothing); its X or Escape closes it, and there is no
  Return button. It gives the star's icon (large, grey), its title, one sentence of what it does
  (built from its rules), and a list of every rank in Roman numerals (Arabic under the pointer),
  each with what it gives, opened on the last bought and the next rank. Clicking a later rank
  chooses it: the foot shows that rank's price (short numbers), the total for every rank up to it
  while the Upgrade button is hovered, and **"Upgrade (+3 Ranks)" buys them all at once**, all or
  nothing (`GuildUpgradeManager.purchaseRanks`: the same Bank, ranks and rules as that many single
  buys, one rank change, one ceremony; a quest counting purchases counts each rank). Greyed with
  what the Bank is short of when it cannot pay. The Hall star's **Effects** list the outputs
  each lap and, as boosts, the lap itself ("Outputs arrive once a lap: every 10:00", the live
  lap) and every other rule held (a Lap Time rule is said by the lap's line).
  *(`GuildHallBoard.jsx`, `hallStarStagger.js`, `hallStarOutline.js`, `HallUpgradeDrawer.jsx`,
  `GuildUpgradeInspection.jsx`, `hallStarText.js`)*
- **The upgrade ceremony** (brief 390 G4): a rank bought while the sky is open plays once: the
  star bursts in hard pixels with a chime; light hops along its lines to the stars that rank
  opened; finishing a constellation (its every star lit) bursts bigger, sparkles its stars in
  turn and flashes its lines, and its picture (owner art,
  `public/assets/playmat/screens/constellation_<id>.png`, drawn at 2× centred on its stars; none
  yet) arrives and stays. Nothing plays on load, in a catch-up, or for a rank bought while the
  Hall was closed; reduced motion shows one still frame. Sounds: `hall_star_chime.ogg` and
  `hall_constellation_chime.ogg` in `public/assets/audio/sfx/`, a Kenney pot sound until they exist.
  *(`hallCeremony.js`, `HallCeremony.jsx`, `AudioSystem.js`)*

| Upgrade | Ranks | Effect |
|---|---|---|
| Bunk Beds | 8 | +1 hero per rank (rank 1 free, held from the start for the first hero) |
| Bank Tabs | 15 | +1 Bank tab (64 slots) per rank |
| Wishing Well | 10 | 10 × *rank* Water a lap as Passive Production, no hero needed (rank 1 free) |

- **Limes's lessons** (brief 480 L4; the lessons switch on the new game screen, on by
  default). Limes, the guide on the Starter Camp's mat, teaches in the concept's order: (1) drag
  your hero to a Redberry Bush, (2) collect the loot, (3) equip the woodaxe from the Bank (the
  scrap heap step waits for its content), (4) chop wood, (5) buy Bunk Beds in the Guild Hall (a
  second hero), (6) buy a Wood Foundation and build the Workbench on it, (7) craft (Charcoal), (8)
  a first fight: food, then win (a sword step waits for its content; the foe is a Goblin until
  the opening's small slime exists). Then the **goal**: Limes opens the world map and names
  settling a place, until one is settled; the first settle is Limes's first **big moment** line.
  Each step opens Limes's bubble by itself and outlines what it names in hard gold; it speaks
  through the Limes the player can see (the mat's at the Starter Camp, or the small Limes of the
  Bank, the Shop's Foundation card, the Guild Hall, Bunk Beds' Upgrade drawer, the world map,
  while that screen is open) and stays until the step is done. **Guides, never locks**: nothing is
  disabled, every step counts from the start, so one done early is simply done when its turn
  comes. **No rewards.** Progress counts from the engine's own events, is kept in the save, and holds through a catch-up, a reload and travel. Lessons off:
  the same start, Limes never speaks by itself (it still talks when clicked). A game made before
  the lessons has none. Every word is in `limesText.js`; the steps and the ids they name in
  `lessonPlan.js`. *(`src/systems/quests/LimesLessons.js`, `ui/components/limes/`)*
- **Quests and bounties are cut for now** (owner 2026-11-21, T-637: "Probably cutting quests and
  bounties until I can figure out a better way to implement them"): no bounty Tokens beside the
  Hall; Limes's lessons stay with the counters they use. **Lessons on or off** is a switch in
  Settings as well as on the new-game screen (T-640).
- **No unlocks and no classes**: progression is skill levels (recipe, Token
  and gear level requirements), each skill's milestone perks (§4), Hall
  upgrades, and affording things. Every hero can grow into anything. The smithing ladder
  (ingots at levels 1, 15, 30, 45, 60, 75, 90) is the longest content ladder.

---

## 9. Screens and UI

One page with overlays (`src/ui/ReactRoot.jsx`), left to right: **bubble menu
→ notification column → playmat (top bar above, hero dock below) →
drawers**. The menu can be flipped to the right.

- **The title screen** is the only screen before play: the game's name in the
  display size over a banner picture (`b_guild_hall`, framed), and the three
  save slots beneath in the kit. A filled slot shows its heroes, playtime and
  the time away it has built up (the away summary's words, `24 h (max)` past
  the cap; its tip gives the last save) as Lucide marks, then Load and a delete
  with a confirm; an empty one
  New Game; one whose save can't be read says Damaged and can still be loaded
  (for the message) or deleted. The owner's logo and title painting replace the
  name and the banner when their files exist (`src/ui/components/title/titleArt.js`).
  In the desktop game an **Open Saves Folder** button under the slots (and in
  Game settings) shows the folder the saves are files in.
- **Bubble menu**: Guild Hall, Item Bank, Shop, Settings.
- **Top bar**: the Region's name over its banner (at 3×, running on under the middle and fading
  out), Tokens / cap and upkeep per minute (each opens its summary on hover, staying while the
  pointer moves into it; the Token Summary's rows light their Tokens on the mat), and Demolish
  with its cursor's pixel X.
- **Token card** (a click on a Token): the name as a header, then a stat block
  (level, XP, time, charges; an enemy's HP, level, XP) and sections: the recipe
  picked, **Requires** (tools and what is used up), **Makes** or a water's
  catches, **Events** (regrowing, growing, spawning), Boosted by, Drops. A section
  with nothing to say is left out. The art sits behind the whole card, a window
  of it between the name and a see-through panel, and draws at whole-pixel
  scales, 2× or more. A card taller than three quarters of the screen scrolls,
  its arrows inside the card over the art. A station's recipe list keeps the
  header and the art.
- **Notifications**: item stubs at the right under the top bar (one per item,
  its net flow; gold "New!" for a first find) and banners at the top centre for
  what must not be missed, each staying until clicked: gold for a new recipe,
  hero, guild upgrade or **a place settled** (the place's name, from the
  Atlas's `created` news; the first camp of a new game says nothing), red for
  a defeat, the Bank refusing items or a save problem
  (`concept_notifications.md`, `systems/notifications/`).
- **Settling's title** (brief 380 M5): a moment after a place's gold banner, its
  title lies across the mat above the Guild Hall: a dark band opening from its
  middle line in held frames, the place's banner at the top bar's 3× fading out
  at both ends, gold lines at its edges, the place's name in the display size
  with the hard outline and its land and line under it, and a fanfare (a
  stand-in sound until the owner's). It stays under three seconds; a click or
  any key skips it; under reduced motion it neither opens nor closes. Travel to
  a place settled before shows the plain arrival card instead.
  *(`atlas/SettleTitle.jsx`, `ArrivalCard.jsx`)*
- **Hero bar** (bottom, on every screen: the mat, the Bank, the Shop, the world map and the
  Guild Hall, over the side drawers): the roster, heroes as standing figures with HP numbers
  over a smooth pixel bar, each with their job flag and an alert when wounded or the
  player must act; hover for what they are doing; drag a figure onto the mat
  to give that hero a job; drop an item on a figure to equip it, answered by a speech bubble
  over that hero for about 3 s (what was equipped, or why not, with the numbers); an item dragged
  from one hero's loadout onto another hero is handed over, each saying so, the panel staying put.
  Every HP bar, a hero's or an enemy's, is green, amber or red by health (T-556). Click →
  **Hero drawer**, sliding up from behind the bar across the screen down to its bottom edge,
  the close X and the edit quill in its top right corner, a header across the top (the name over
  the hero, the HP bar over the rest), then three blocks left to right: the hero at twice the
  mat's size with their flag behind the shoulder; the loadout grid under the word Inventory,
  always in view; and a switch between **Skills** (every skill as a large icon, name, level and
  XP bar in columns of four, one list with no specialist group, by kind in one colour (T-643, §4 Skills); hover for the XP, what is
  left and the rate; click for the skill panel over the drawer: what the skill is for and its
  exact XP beside every milestone perk in a scrolling list, one line each, those held in gold) and
  **Combat** (the
  style, the hit, its range against each enemy style and a critical hit, the swing, crit,
  accuracy and dodge, resistances, the cuts worn gear makes to each style, and what the loadout
  lends, all read from the fight's own numbers) → Edit (rename, portrait, flag colour). Nothing
  in it scrolls but the perk list. The Shop and the Hero drawer close each other: one panel over the bar at a time.
- **Bank drawer**: tabbed item lists, search, reorder; drag an item onto a hero
  on the hero bar to equip. While open, the mat is locked; the hero bar stays in front of it.
- **Shop**: a panel that rises from behind the hero bar beside the nav (on either side) and
  stands on it, the bar in front, with a row of same-size cards (name, the Token large, its skill
  icons, the price as up to four have / need pills; arrows left and right when the
  row is longer than the screen). Drag a card onto the mat to buy. Once the card
  is carried up off the panel, **the Shop lowers** (owner, 2026-11-10; brief 580):
  only its header row stays up at the screen's bottom edge, the hero bar drawn over
  it as usual, so the whole mat is free. Bringing the card down onto that
  edge (anywhere from it down to the screen's bottom edge) raises the Shop again, and
  leaving the risen panel upward lowers it again. A card let go over the lowered or
  the risen Shop is a cancel; the Shop stays open after a purchase. **Picking up an
  unbuilt Foundation on the mat lowers the Shop the same way**, whether it was open
  or not: let go over the lowered or the risen Shop, it is refunded (§3,
  Foundations); a Shop raised only by that drag closes after the drop. A Foundation
  picked up where the lowered edge then appears must be carried above it once before
  the edge raises the Shop or takes it, so a pickup let go on the spot is a plain
  put-down. A card you can't afford
  dims its Token and shows the short counts in red; a full Token cap says so on
  the card. Hover a skill icon for its name, a card for what it builds.
  *(`ShopPanel.jsx`)*
- **Guild Hall view**: the upgrade web, the Hall effects popover, and the Upgrade drawer on a
  clicked star (§8).
- **On the mat**: click a Token to inspect it; a station's gear badge opens the
  recipe picker; a job flag is only dragged, to give its hero a new job (hover
  shows its hero and what they are doing);
  alerts sit on Tokens until fixed; loot is collected by hovering.
- **Encyclopedia** (its bubble, a Token card's book button, an ingredient in a
  station's recipe list): a book, search first, whose chart shows what an entry
  comes from on the left and what it goes into on the right; ticks mark what this
  run has. Every line that is not used up carries a small ink word saying what it
  means (made at, built on, tool for, beside, gives, opens, drops, spawns, and the
  rest); an ingredient, a seed planted, bait or a price stays the plain line, and
  hovering a word says it in a sentence. Along the foot of the left page, a count and a small bar per kind
  (Items, Tokens, Enemies, Recipes), read as the book opens, out of what this
  world can give: an entry nothing reaches, or only some worlds hold (a chest),
  joins its total once the run has one. Opened from an ingredient, closing the
  book brings the card back on its recipe list.
- **Settings** (three tabs): **Display** (text size, font, all caps, menu
  side, background, flying items, item stubs), **Game** (auto-save every 10
  minutes, an hour or off, Save Game Now), **Audio** (master, music, SFX;
  **master volume defaults to 0**: the game starts silent). Dev builds add a
  Dev Tools tab (Debug Mode) and a 1-minute auto-save; a shipped build reads a
  stored 1 minute as 10.
- Keyboard: Escape closes one layer at a time; no gameplay hotkeys.

---

## 10. Time and saving

- **Game time** drives everything (cycles, spawns, events). A tick is clamped
  to 1 s; longer gaps are caught up.
- **Offline progress** — **Built (brief 40)**: time away from a closed game or
  a sleeping PC (up to 24 h; the rest is dropped) is played by the real engine,
  sped up, behind a loading bar, then a "While you were away" summary. **Away
  under a minute** (a load or a sleeping PC), the game resumes as saved and no
  time passes; **a minute or more always plays the catch-up and opens the
  summary**, loads included, so the player can accept or reject the time away
  (owner 2026-11-20, T-618: "We need to give the player the option to reject or
  accept the time that has passed"). It replaced the Time Bank, which is gone. **Nothing goes missing (brief 430)**: the
  catch-up keeps its bus quiet, so it hears the news itself (recipes unlocked,
  first finds, the Bank refusing items, defeats; `catchUpNews.js`, only
  reading, so the game plays the same) and the summary lists them in sections
  of their own (a section with nothing is left out). **The news is told once**
  (T-506): after the summary only what still needs the player stays as a
  banner (the Bank or a stack still full, an event still standing), in the
  summary's own words; "Load as I left it" shows none.
- **The summary** (brief 440): the heading centred ("While you were away",
  "You were away 32 min"), then **two columns**, each scrolling with our arrow
  bars. **Left, the items**: each item once with its **net** change, green +
  or red −, gained and spent on hover. The net is the Bank and the mat
  together (loot carried from the mat to the Bank while away counts once), and
  an item with more lying on the mat than before carries a small mat mark,
  its hover saying how many. **Right, the news**, in this order: **defeats**
  (with the gear lost; T-560), events (each that landed or left, and how),
  tools and weapons that broke (each with the hero who stopped, §5), the Bank
  or a stack refusing items, new recipes, first finds, level-ups, Science
  mastery ranks reached (each kind once, at its highest rank), Tokens used
  up (never enemies), the fights (each enemy and its kill count: **a kill
  counts once**, T-619). An
  empty column says so in one muted line. **Both buttons ask first**: Return
  to the Guild (plain wording, nothing is lost; Esc asks the same) and Load
  as I left it (everything from the time away is lost); the banners come
  after Return is confirmed.
- **Saves**: 3 slots with a one-step backup; autosave every 10 min by default
  (10 min, 1 h or off; 1 min in dev builds only). **In the desktop game each
  save is a file** (brief 450 S3): `slot1.json` to `slot3.json` and their
  `.backup.json` in `%APPDATA%\com.tabletopguild.game\saves`, read when the slot
  is opened, so a save can be copied, kept, edited or put back. A save is
  written whole or not at all (a temp file, flushed, renamed over the old one;
  `src-tauri/src/saves.rs`); the save it replaces becomes the backup unless
  it is not even JSON. Closing the window waits for the save to be on the
  disk (5 s at most). A damaged save (broken, hand-edited, unreadable) loads
  its backup with a Save Restored banner, and the next save keeps that backup;
  with none it says the save is damaged and changes nothing. The browser and
  dev builds keep saves in browser `localStorage` (`SaveFiles.js` decides).
  Each slot on the title screen shows the time away it has built up. **Saves from another version are refused,
  not migrated** (`GAME_VERSION = '0.8.1'`, moved by the Atlas's Regions), and
  that stays the policy **until 1.0**; from the first public release on, old
  saves are migrated (owner 2026-10-06 and 2026-11-20; a note for the release
  plan). A new game is saved immediately.
- **Regions** — **Built** (Atlas slice A1; on screen in the Atlas): the save holds
  every Region the guild has settled (`state.atlas`); the mat is the board of
  the Region the guild is in. **Only that Region runs**, offline catch-up
  included; every other Region is frozen exactly as it was left. A new game's
  opening mat is the first Region, the Starter Camp. **Travel** banks the loot
  on the floor (what the Bank cannot hold stays on that Region's floor), takes
  the Guild Hall along (the Hall lands in the middle of a
  Region it has never stood in, and back in its old spot in one it has), and
  leaves each Region's flags behind: going back, every hero starts at the flag
  they left there, with no work claimed and no fight on; a place just settled
  starts with no orders, its heroes walking in to the Hall (§10, the arrival). A settled place's World Map drawer shows
  its Region (its mat drawn small with its Tokens over the cap, its ground, its playtime) and renames it; travel is its
  Travel button. **Each Region keeps its playtime** (`region.playtimeMs`): every tick adds its time to the Region the guild
  is in, so live play and time away (the catch-up plays it through the same tick) both count to the place the guild was
  on (owner, 2026-11-10); a Region from an older save starts at 0. **A settled place is the guild's
  for good**: no archive, restore or abandon (owner 2026-11-20, T-616), and **no Region rules**
  (retired, T-616). A Region left behind stands still, as above (owner 2026-11-20, fine as is).
  *(`src/systems/atlas/`)*
- **The world** — **Built: generated (brief 330 W1) and on screen (W2)**: a new
  game generates its hex world from the seed rolled on the new-game screen (a
  game started with no screen: its creation time) and the world tables, and
  keeps it whole in the save (`state.world`, the seed with it). A roll that
  fails one of the ledger's checks F (a price of its own ring, a key material out
  of reach, an origin the inner rings miss, chests off their ring's value) is
  passed over for the next seed, up to 20 (`World.rollWorld`). A world holds
  the Hall's cell (the Starter Camp), three strict rings, wild rings beyond, six
  wedges by origin line; each cell's origins, tier, kit, specialty, hidden
  extras and price. **The world map** (brief 380 M2, M3; the Atlas's bubble or
  the top bar's place name) is reached by the view **panning down** from the
  mat, as the Guild Hall's glides up; the top bar goes with the mat, the hero
  bar and the nav stay, and the two moves never run together. Beneath it lies a
  **painted world**: a colour field per kind of land from each cell's kit,
  wobbly borders, an ink line where lands meet, sand on shores, tiny pixel
  symbols, fading into fog past the rings shown; it is painted once per world
  and rings shown (about 0.1 to 0.2 s) and kept. Over it the shown cells stand
  as **board tiles** (code stand-ins until the owner's tiles), each with the
  Token its place holds most of and a plate of its first three outputs. The
  three strict rings show from the start; a wild ring once any of its cells is
  settled or can be settled next. **Ring lines** are a rope with knots where
  rings meet, no numbers. **Cell looks**: settled and settle-able in full
  colour; a cell the guild can settle now pulses gold; a frontier cell too dear
  or behind a ring star darkened; a cell further out black and white;
  the pointer over any cell shows it in full colour with a white outline. The
  map is dragged around (or scrolled with the wheel). **The hover** names the
  place ("Elderfield": a name from its cell's seed, which its Region takes on
  settling) over its land and line ("Highland Ores"), then its price as item
  pills with have/need in the 9.9k shorthand, red when short; no ring. A cell
  whose ring waits for its Guild Hall ring star (§8) says so under its price
  ("Light the Guild Hall's Charted Roads star to settle here"), in the hover and
  the drawer.
  **The World Map drawer** (brief 570 D4) is the side drawer, flush to the
  screen's edge away from the nav, full height, the world's blue, open with the
  map; its X closes the map. It shows the chosen place: the guild's flag drawn
  large where it is, the name (renamed behind the quill once settled), its land
  and line; for a settled place its mat drawn small with its **Tokens over the
  cap** in the corner (`28/128`: the guild's cap, the same in every place; the
  place the guild is on counts as the cap does, any other its own frozen
  board); **three ground dials**, Water, Grass and Stone, for every place,
  settled or not (whole percent adding up to 100; Grass is the open land, grass,
  rock or sand: a settled place reads the ground it stored, one not yet settled
  the ground settling it writes, worked out from its cell without placing a
  Token); for a settled place **the time spent there**, time away included;
  what it yields; its price while not settled; and at the foot a large
  **Settle** (frontier only, greyed with what is short or the ring star it
  waits for; settling refuses that ring until the star is bought), which pays the
  whole price at once, writes the cell's Region and takes the guild there, or
  **Travel** to a settled place elsewhere. No Ground, Tokens or Heroes rows and
  no Token list.
  A Region knows its
  cell (`region.cellId`).
- **A place's mat** — **Built (brief 330 W3)**: settling writes the Region from
  its cell (`world/cellMat.js`). **The kit** (Highland, Woodland, Plains,
  Wetland, Riverside) gives each skill its share of natural work in heroes (a
  hero is about five veins, four trees, three crops or herbs, two waters or one
  camp), on its own ground (mountain, forest, meadow, bog, coast); its water,
  stone and grass roll within its **biome's ranges** (T-613, §3 Stone terrain),
  and the four unused biomes (flower meadow, cherry grove, Yellowstone,
  volcano) come into the world as kits (T-615); a skill's Tokens are the cell's own origins of it, else the
  everyday ones the guild already has (earlier rings', the Starter Camp's).
  **The specialty** means better things, not more: its skill gets at least one
  hero's work, all of it the cell's own origins (a cell holding nothing of its
  specialty's line is generated with one of that line's origins for its ring,
  so it shows on the map), one Token of it the rarest of its line's table for
  the ring; a combat specialty makes one of the kit's camps its boss camp.
  Every origin the map shows stands on the mat; work nothing fills goes to the
  cell's own line. A mat keeps at most six heroes of natural work (the rest is
  built): the largest share that is not the specialty's gives way first, then
  the specialty's, then the camps (never the boss camp, never an origin's last
  Token) (owner). Its chests ride along; a wild cell
  has one origin almost everywhere (three quarters of its nodes) or an odd
  layout (islands, mostly water, a chasm of Stone, cramped). **The arrival**: a
  settled place arrives occupied by the enemies its cell lists (3 to 6, more
  further out; never a loose boss, bosses come from camps only, T-547), spread
  out across the mat, one to each even
  share of the circle round the Hall turned by the place's seed, out of the
  Hall's clearing, clear of the heroes' way in below it and short of the mat's
  margin, one use each, tied to no camp and outside the Token cap (§3; the
  no-room rule if they don't fit). They stand still until a hero is sent at them: no fight starts by
  itself. Settling runs, in the owner's order, the gold banner, the place's
  title (§9), then the heroes walking in one after another from the mat's foot
  below the Hall to stand idle in their places by it; they bring no orders
  (each hero's orders stay in the place they were given). Travel to a place
  settled before does none of it. Until every one is beaten the mat is
  **held**: drawn dark (its ground shaded, its Tokens dimmed, the enemies
  bright), a hero may be sent at an enemy and at nothing else ("Beat the
  enemies here first"), and the place's own camps sleep (their clock stands
  at zero, the card says "asleep"), spawning an interval after it is cleared
  (owner); a hero whose enemy falls takes on the nearest one still
  standing, so heroes sent at them keep fighting while the player is away;
  the last one beaten brightens the mat ("The enemies are beaten: … is the
  guild's to work"). The board keeps it (`board.arrival`), so it travels and
  saves with the Region. *(`world/cellMat.js`, `world/cellRegion.js`, `world/Arrival.js`,
  `board/Occupation.js`, `HeroMotion.walkIn`)* The tables are placeholder
  until the CMS syncs `data/world.json` (W6). A save made before worlds has
  none: the world map says so. *(`src/systems/world/`,
  `worldTablesShape.js`, `ui/components/atlas/WorldScreen.jsx`, `WorldMap.jsx`,
  `WorldDrawer.jsx`, `GroundDials.jsx`, `world/placeGround.js`, `WorldCamera.jsx`, `worldPicture.js`; the art it reads,
  `config/worldMapArt.js`)*
- **Desktop**: packaged with Tauri (Windows installers); the game runs in the
  webview, its settings stay in the webview's storage and its saves are files
  (above).

---

## 11. Tools around the game
*⚠️ Stale since 2026-10-08: the bench has 12 scenarios, not 7; see [doc_audit.md](../active/review/doc_audit.md).*

- **The CMS** (`cms/`, a separate local app): the **only** way to author
  content (Tokens, items, recipes, Maps, effects). Its **Recalculate** runs the
  economic simulator (Tempo bands → anchor items → prices → tuning → XP →
  checks) and writes numbers back. **Sync to Game** overwrites `data/items.json`
  (maps included), `tokens.json`, `tokenRecipes.json` and `effects.json` from the
  CMS's own store and auto-commits `data/`. Never hand-edit those files.
  - **Tempo bands** (cycle time at level 1): quick 2–4 s, fast 4–12 s, medium
    12–20 s, slow 20–30 s, heavy 30–120 s; slower by `1 + (level−1)/70`.
  - The simulator still speaks of "gold per hour" as an abstract design
    currency; the game has no gold.
- **Dev tools** (dev and test builds, or a perf build with Debug Mode on; a ship build, `tauri:build:ship`, has none): the QA panel
  (owner's picks, 2026-11-12: the essentials only) gives any item (Bank first, the
  rest on the mat), one of every item or a full Bank; hires a hero or a party of
  four, levels every skill, heals everyone or knocks a hero out; puts any Token or
  enemy on the mat or clears it; and holds the owner's two tools, the Sprite
  Animation Studio (also Shift+A) and the **Starter Camp** save (move and remove
  landmarks, save the mat to the CMS). FPS counter. Dev build only: the
  **Perf HUD** and stress boards (`?stress=realistic`). The mat's tuning numbers
  (`matTuning.js`: mat size, Token cap, quest cap, radii, speeds) are set only by
  tests, the benches and the stress boards, in a dev or perf build.
- **Bench** (`npm run bench`): 7 headless scenarios; `--compare` fails if the
  game got slower or **behaves differently**. See
  [TESTING](TESTING.md).

---

## 12. Content snapshot (2026-10-08)
*⚠️ Stale since 2026-10-08: every count below is out of date (146 Tokens, 151 items, 117 recipes, 92 effects in `data/` on 2026-11-06; jobs retired); see [doc_audit.md](../active/review/doc_audit.md).*

| | Count | Notes |
|---|---|---|
| Token types | 86 | 48 resource; 7 spawners; 4 enemies; 2 promotion; 1 Map (inert) |
| Items | 64 | no gear |
| Recipes | 25 | 5 skills have recipes |
| Effects | 22 | most of the grammar unused |
| Shop entries | 10 | five Foundations since brief 410 |
| Skills with content | 10 of 25 | 8 Starting (not Alchemy) + melee + commerce |
| Jobs reachable | Fighter (+ Wizard, no source) of 13 | |

Content is half-authored on purpose; an unfinished Token is not a bug.

---

## 13. Planned and dormant
*⚠️ Stale since 2026-10-07: the Atlas is built, not planned, and `data/stations.json` was deleted (26a434c9); see [doc_audit.md](../active/review/doc_audit.md).*

- **Atlas — Planned for the crunch** (after deep optimization):
  [`docs/active/concept_atlas.md`](../active/concept_atlas.md). Loot Maps and
  Modifiers, combine them in a Cartography screen to generate a Region, and
  relocate the guild to better Regions over time. Many Tokens become fixed
  geography. Owner decisions (2026-10-07, top of the concept): resource nodes
  respawn in place, the Shop sells buildings and tools only, demolition is a
  Construction job with no refund, everything counts toward the cap, and a
  hand-made Starter Camp opens the game. Roadmap and owner answers:
  [`atlas_roadmap.md`](../active/atlas_roadmap.md). Built so far: Regions and
  travel (§10); the Starter Camp and landmarks (A7). Map items are retired: the
  world map (brief 330, §10) settles places instead.
- **Classless heroes — Built (brief 270)**:
  [`docs/active/concept_classless_heroes.md`](../active/concept_classless_heroes.md).
  The class tree of the skill and class rework v2 (brief 20) is retired (§4);
  the two Academies still in `data/` are the owner's to delete in the CMS.
- **Real offline progress — Built (brief 40)**; see section 10.
- **Terrain — Built** (brief 80): the ground is drawn (T2); "Stands on" placement
  and its grid while placing follow (T3, T4).
- **Dormant**: Villager heroes,
  Map bursts and most Map Tokens, `data/stations.json` (nothing loads it).
- **Latent** (code ready, no content):
  rule upkeep, most statement verbs and moments.

---

## 14. Performance Envelope

*Measured 2026-10-21 (brief 90; method and every number in
[PERFORMANCE.md](PERFORMANCE.md) "Performance Envelope (2026-10-21)"). The
reference machine is a slow laptop: the perf build at a 4x CPU slowdown
(Chrome delivered ~3.8x). "Smooth" there means 95 % of frames within 16.7 ms;
on the owner's PC every board measured stays at 98.6 % or better.*

**The reference Region** (owner, 2026-10-21): a busy Region at the base cap
(128 Tokens, 8 working heroes, a few enemies, a fight now and then, loot
collected) reads 88-93 % on the slow laptop, just under smooth. That is
accepted for now; later optimisation passes aim at 95 %. **Content must not
make a Region cost more than the reference.** Anything added is paid for by
taking something away. In Tokens' worth: one item-stub row about 3, one enemy 4-10, one hero about 20, one fight about 30.
What costs most is the moving things (heroes, enemies, fights, stub rows), not
the Token count.

1. **Tokens.** A Region's base design holds at most **128 Tokens**, and a Base
   Map's budget must fit 128, spawned Tokens and landmarks included. The cap is
   fixed at 128 since the Token Cap star retired (brief 320); measured for the
   record: each +16 cost about 2 points on the slow laptop, 192 read 85 % and
   256 read 62 %.
2. **Heroes.** At most **8 heroes** on the mat (`ROSTER_MAX`). A hero costs
   about 20 Tokens' worth; any roster above 8 needs a performance pass first.
3. **Enemies.** A Region keeps at most about **6 enemies alive at once** across
   its camps (a war camp's allowance of 5 counts). 13 read 88 %, 24 read 76 %,
   and many enemies also lengthen the catch-up.
4. **Fights.** Design for at most **1-2 fights at once** on a Region; no content
   that sets all heroes fighting together (4 fights: 78 %, 7: 69 %).
5. **Loot on the floor.** The pile cap stays **40** (owner). Since the piles'
   hover was made cheaper (T-197, 2026-11-03), 40 piles cost a frame what 8 do
   (5.55 and 5.76 ms of work at a 3.2x slowdown; 40 cost 11.10 ms before).
6. **Notifications.** Any rate is fine; keep the number of **different items
   flowing at once** low (each stub row is about 3 Tokens; 26 rows read
   80-86 %). At most 3 banners show, by design.
7. **Catch-up.** A 24-hour absence must catch up in **under 30 s** on the
   owner's PC: 19 s at the 128 cap today. 256 Tokens (38 s) and about 70
   enemies (36 s) miss it until T-199 lands. Content that adds engine work per
   tick lengthens it.
8. **The canvas mat (T-071) is parked** (owner, 2026-10-21): Tokens are the
   cheapest thing on the mat (it would save about 1 ms at 128); the moving
   things are fixed first. Reopen only if 256 must be smooth on a slow laptop.

---

## 15. Glossary

| Term | Meaning today |
|---|---|
| **Mat / playmat** | The free surface Tokens stand on (1920 × 1040 u). |
| **u, step** | Mat unit; a step is 160 u. |
| **Token** | Anything on the mat. A *type* is authored; an *instance* is one on the mat. |
| **Placed / spawned** | Bought or built by the player (fixed, refundable) vs made by the mat (free, pushable). |
| **Cap** | The limit on Tokens on the mat, placed and spawned (128), counted in the active Region only. |
| **Region** | One mat the guild has settled, kept in the Atlas; only the one the guild is in runs (§10). |
| **Charges / uses** | A Token's wear; one per cycle; 0 removes it, unless it respawns; `null` is unlimited; stations and supports never wear. |
| **Resting / respawn** | A Token at 0 charges whose type respawns: unworkable until it refills, or becomes the Token it regrows from. |
| **Cycle** | One unit of work on a Token (or one kill). |
| **Near / reach** | The one standard reach, 240 u centre to centre: how far a rule carries, a camp works and a Forest plants. |
| **Spawner, family, allowance** | A Token that makes Tokens; the types it makes and what they grow into; how many it allows alive. |
| **Upkeep** | Items a spawner (or rule) pays to keep running. Unpaid = it waits. |
| **Passive Production** | Free items the Hall drops once a lap, 10 minutes shortened to 5 by a Guild Hall star (formerly "trickle"). |
| **Foundation** | A placed Token built into a station by choosing a build recipe. |
| **Station** | A Token whose work is a recipe the player picks. |
| **Context Token** | A tool or support Token used by nearby work. |
| **Order / job** | Where the player sent a hero: a Token (they work only it), a camp (they work its kind of Token in its reach), a spot (they wait there) or home. |
| **Job flag** | The small flag in the hero's colour marking their job, behind the top-left of the job's Token (or on the spot). Dragging it gives the hero a new job. |
| **Camp** | A Token built on a Foundation that names a skill: a hero sent to it works every Token of that skill within the standard reach, one at a time. An enemy camp is a spawner of enemies; a hero sent to it hunts them. |
| **Needs a job** | A hero whose job's Token is gone for good, waiting where it stood for a new order. |
| **Rules (Token) / effect / statement** | A Token's behaviours, written as sentences in the CMS. |
| **Bank** | The guild's item store; one slot per kind. |
| **Loot** | Items lying on the mat, collected by hovering. |
| **Perk** | A skill's milestone reward at a set level (10, 25, 50…), held by every hero at or above it, read off their levels. |
| **Damage type** | What a hit is made of: nine types (Slash, Crush, Stab; Fire, Ice, Electric; Poison, Light, Dark), no groups. A weapon has one; a bow shot has two (bow and arrow). |
| **Resistance / weakness** | Percent off (or onto, when negative) hits of a type, applied after boosts. An enemy's come in fixed steps (25/50/100, weak 25/50); all of a fighter's lines for a type add, heroes and enemies alike; gear's are free small numbers. |
| **Damage cut** | Percent off a hero's own hits in a named style while wearing a piece (metal cuts Magic and Stealth): every gear piece's trade-off, shown red. |
| **Arrow** | A consumable a Ranged hero carries; one is spent per shot and adds its own damage in its own type. Without arrows there is no shot: the hero leaves the fight. |
| **Mote** | What a magic weapon spends, one a cast; without one the hero casts at half damage. |
| **Off-hand item** | A hand item that is never swung (a shield): it lends its resistances, cuts and rules like armour. A second weapon lends nothing. |
| **Move** | One of an enemy's attacks (its Active effects), picked by weight each attack: a hit in its own type, an effect on itself or the hero (on a hit only), or both. Unnamed, it reads Strike and hits as Crush. |
| **Venom** | The stacking damage-over-time status; its ticks deal Poison damage. |
| **Defeated** | The one word for a fight's end, both ways: `Defeated Goblin in 42s`, `Defeated by Goblin`. |
| **Sunder** | A stacking status that takes points off every resistance its bearer has for the fight, never below 0. Replaces Pierce. |
| **Wounded** | 5 minutes out after defeat. |
| **Catch-up** | Playing time away (a closed game or a sleeping PC, up to 24 h) on return, with a loading bar and a "While you were away" summary. |
| **Tempo / purpose / anchor** | CMS economy terms: a cycle-time band; what a producer is for; the source that sets an item's value. |
| **Atlas / Region** | Planned: crafting and moving between generated maps. |

Retired words still found in code and old docs: tile, grid, Tray, Vault,
deck, card, area, area flag, flag radius, Work Permissions, Scouting Flags,
gold, Manager, Map burst, Recruit (as a title), class, job tree, promotion,
Promotion Token, banked skill, Mastery, Change Job, Armor/armour (as a flat stat), Pierce, Poison
(as a status: it is Venom). Don't use them for current mechanics. In code a
hero's order is still saved as their "flag" record (`board.flags`).

---

## 16. Owner rulings and open questions

Ruled 2026-10-06 (folded into the sections above; work is in TICKETS or the
crunch plan):

| Question | Ruling |
|---|---|
| Mat Tuner numbers, Debug Mode | Move cap, mat size and quest numbers into the game; hide Debug Mode in shipped builds (T-097). |
| Time Bank | Replace with real offline progress (crunch track). |
| Gear | Coming; keep the system. |
| Item sinks | Upgrades and construction; no selling. |
| Promotion content | **Retired** with classes (owner 2026-10-28, brief 270): every hero holds every skill, the weapon decides the style, milestone perks are the reward. |
| Kill loot | Neighbour bonuses apply to kills like work (T-017). |
| Energy and drinks | Remove energy, separate slots (T-098); drinks never heal, in fights or out (owner 2026-10-24); they are work buffs lasting 10 work cycles, a placeholder (brief 230 S6b). |
| Dormant Maps | Retire (T-002). |
| Wishing Well | Passive, part of Passive Production (T-099). |
| Silent by default | Development convenience; audible default before shipping (T-100). |
| Old saves | Refused until 1.0. |

| Terrain | Returns for the Atlas after a major rework, later in the crunch once the Atlas works. |
| Atlas timing | Moves into the crunch, after deep optimization. |
| Drops over a drawer | A mat Token or flag dropped over the Shop panel or the Hero drawer lands on the mat underneath; intended (owner, certification 2026-10-07). The one exception: an unbuilt Foundation dropped over the Shop, risen or lowered, is refunded (owner, 2026-11-10; brief 580). |
| Token cap | 128, fixed (the Guild Hall's Token Cap star retired, brief 320); spawned Tokens and endgame sites count (D-1); the discard bin is gone (Atlas A3b), so nothing off the mat counts. |
| Trickle | Renamed **Passive Production**, one timer; the Wishing Well joins it, 10 Water a lap per rank (T-099). The lap is 10 minutes, shortened to 5 by Guild Hall stars (owner 2026-11-03, brief 390 G5). |
| Markets | **Cut for now**: items stay the only currency, no exchange rates; revisit if a real need appears (owner 2026-10-09, T-127). |
