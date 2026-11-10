# Fantasy Guild — Game Design Document

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

**Long-term pull.** Exploring new Regions through the Atlas (§13): set up a
Region, exhaust it, move the guild to a better one. **The Atlas is not built.**
Today the pull is skill levels, their milestone perks and Guild Hall upgrades.

---

## 2. The core loop as built

1. **A new game** opens in the **Starter Camp** (Atlas A7): the Tokens, their
   points and the opening Bank the owner laid out in a dev game, saved with the
   QA panel's Save this mat as the Starter Camp, reviewed on the CMS's Starter
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
   to a family cap, some paying an item per spawn (e.g. a seed).
7. **Quests** (Tokens beside the Hall) teach the game, then offer bounties.

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
- **Who draws over whom**: Tokens and flags by where they stand, lower on the mat in
  front; a Token being worked in front of those at rest. **Heroes are always on top of
  every Token and flag**, working, idle or walking, lower on the mat in front of each
  other. Over the heroes: loot, plates, numbers, callouts, bubbles. **Hovering a Token
  doesn't move it** in the stack (the Mat Tuner's "Hover lifts a Token" brings the old
  jump back); only its name and gear come up over the rest. A press goes to the Token
  whose centre is nearest the pointer, whichever is drawn on top, except on a hero's
  drawn pixel, which is the hero's. *(`matLayers.js`, `pressRouting.js`)*
- **A Forest or Orchard plants with room for the tree**: within its reach, a Token that grows lands
  at the gap its grown form will need, from what its neighbours will grow into too, so growing
  moves nothing and no tree drifts out of reach. With no such spot in reach it takes the small gap
  rather than not planting. *(`EffectActions.js`)*
- **A player drop never pushes anything.** Arrivals (spawns, growth, builds)
  may push **spawned** Tokens aside; **placed Tokens are never pushed**.
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
  yet); not quests or the Hall. A landmark is never pushed, cannot be moved by
  the player or demolished, and its inspection shows what its challenge needs
  (`Landmarks.js`). Enforced by the Shop and by recipes that make Tokens;
  a spawner waits while the mat is at the cap (as well as at its family cap).
  A save already over the cap keeps everything; adding waits until it is
  under. *(`MatCap.js`)*
- One Mythic of a type may be placed at a time (the only gameplay use of
  rarity). *(`Placement.js:84-93`)*
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
  its "Stands on" (the mines and quarries of W4 will). Drawn as pale rock and scree, a code-drawn
  stand-in until the owner's Stone pieces. *(`StoneShapes.js`, `Layout.js`, `terrainRegistry.js`)*

### What a Token is — Built
*⚠️ Stale since 2026-10-08: the Token counts below (86 types) no longer match `data/tokens.json` (146); see [doc_audit.md](../active/review/doc_audit.md).*
Everything on the mat is a Token: resource nodes, tools, stations, spawners,
Foundations, enemies, quests, the Guild Hall. 86 Token types ship
(`data/tokens.json`): resource 48, context 10, station 8, spawner 7, enemy 4,
buff 4, promotion 2, map 1, manager 1, market 1. Plus the engine-owned quest
Token.
- **Work cycle**: `config` = skill, level required, cycle time, XP, inputs,
  outputs (each output a chance and a quantity range). Example: Oak Tree,
  forestry 1, 3 s, 1–2 Oak Wood + 20 % Oak Seed, 5 charges.
- **Charges** (`uses`): one is spent per cycle by default; at 0 the Token is
  removed, unless its type **respawns** (below). `null` = unlimited (Workbench,
  Furnace, Cooking Pot).
- **Stations and supports never wear out** (owner 2026-10-24, brief 230 S1a): a
  `Works as` station, and a support (a Token whose rules help its neighbours by
  standing there: an `Acts as` capability, or a standing Provides or Grants that
  reaches past itself), is unlimited whatever `uses` its type or a saved copy
  holds. Grandma's Kitchen, the Ceramics Kiln, the Windmill, the Coast and the
  Copper Anvil all became unlimited; a saved copy's old number is cleared as its
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
  other work and the Token says "Needs Pickaxe". Tools only gate. ⚠️ Water is
  the exception (Fishing, below): it takes any kind its catch pools name, at any
  tier ("Needs Fishing Rod or Fishing Net").

### Reach — Built
Rules reach `nearby` (default), `self`, `self_and_nearby` or `board`.
**Near = 164 u centre to centre**: the four side neighbours of a 1×1, not the
diagonals. There is no Close/Far. *(`reachRegistry.js`, `matTuning.js:46-52`)*

### Spawners — Built
A spawner puts new Tokens beside itself on an interval, up to a **family cap**:
the sum of `allowance` over all live spawners of that family (two Oak Forests
→ 10 trees). Order per attempt: cap, upkeep, pick, land, then pay, so a spawn
with no room costs nothing. **An enemy camp's clock stands at zero while the
camp is full** (owner, 2026-10-24), so a goblin, guardian or boss beaten in a
full camp comes back one whole interval later; every other spawner (forests,
mines) keeps counting while full and replaces a loss on the next tick.
- **Planting within its reach** (brief 230 S2a; `spawner.withinReach`, a box in
  the CMS Spawner block, for Forests): the spawner lands each Token only within
  its reach (Near), at the free spot nearest it, never pushing (nowhere free
  there: it waits, says no room, pays nothing), and its allowance counts its
  family standing **in its reach** (Saplings, Trees and Stumps, a map's
  included) against its own allowance, not the mat-wide cap; two such Forests
  far apart each fill their own. Its allowance adds nothing to a mat-wide
  family's cap. No shipped spawner uses it yet.
- **An enemy camp counts its own** (owner, 2026-10-29; T-266): a spawner whose
  family holds an enemy counts only what it spawned (the Tokens tethered to
  it) against its own allowance, so goblins standing at one camp never keep
  another from spawning, and its allowance adds nothing to any other
  spawner's cap. An older save's untethered enemies join their nearest camp on
  the first tick, before any camp counts; an enemy placed by hand, or one
  whose camp is gone, counts toward none. Every other spawner keeps the
  mat-wide count.

*(`SpawnerSystem.js`, `TimedChanges.js`)*

| Spawner | Spawns | Allowance | Every | Upkeep per spawn |
|---|---|---|---|---|
| Oak Forest | Oak Sapling | 5 | 20 s | 1 Oak Seed |
| Wheat Field | Wheat Sprout | 3 | 30 s | 1 Wheat Seed (⚠️ goes with the S8 pack: a Field grows itself, §3 Farming) |
| Apple Orchard | Apple Sapling | 2 | 45 s | 1 Apple Seed |
| Copper Mine / Coal Mine / Quarry | ore vein / coal vein / stone outcrop | 3 | 30 s | — |
| Goblin Camp | Goblin (95) / Goblin Chief (5) | 3 | 30 s | — |

### Transforms — Built
- **Growth**: Oak Sapling → Oak Tree (30 s), Wheat Sprout → Ripe Wheat (30 s),
  Apple Sapling → Apple Tree (45 s).
- **Turns**: Coast ⇄ Shrimp Coast, 30 % chance every 60 s. ⚠️ Water no longer
  shifts (owner 2026-10-24, brief 230 S5): new content will not use `turns`, and
  the engine keeps it dormant. A Shrimp Coast in an old save still rolls to turn
  back (30 % a minute) after the Coast loses its block, even if the content pack
  deletes the Shrimp Coast type, and is a Coast from then on.
- A transform keeps the Token's origin, starts fresh clocks and loses any cycle
  in progress. *(`TimedChanges.js`)*
- **A growth may need a Token in reach and cost an item** (brief 230 S2a; the
  CMS Grows block's **Needs one of these in reach** and **Costs when it
  grows**): a Stump grows into a Sapling only while a Forest of its species
  stands within its reach; without one its clock **stands still** where it is
  (a Forest planted later carries on from there) and it says so with a yellow
  mark ("Needs an Oak Forest nearby to grow"). When it falls due it pays its
  cost (a seedling) from the Bank, then the loot on the mat, only once its new
  Token has landed; short of it, it is **stopped** at its finish, says "Needs
  Oak Seedling" over itself as it stops (the red callout look of "Needs Coal",
  no more often than that) and wears the yellow mark, and grows the tick one
  arrives. Only the Stump's growth asks: **a Sapling whose Forest goes finishes
  growing** (director's call, owner-approved default). The Forest answer is
  read once per Token when its neighbourhood changes, never per tick, like Grow
  Time. Its card and inspection say what it waits for, needs and pays. No
  shipped Token uses it yet. *(`Growth.js`, `TileModifiers.nearbyGateMet`)*
- **Grow Time** (brief 230 S1a): a support in reach speeds a growth and a
  refill's rest (`Provides Grow Time −X %`, aimed by tag or id, or narrowed to
  the growing Token's skill: its own, or what it grows into). Speed-ups stack,
  but together cut at most 80 % of the time (the standard floor, §7), and a rest
  never goes under 1 s. A clock already counting keeps its time; only the finish
  moves. Read once per Token when its neighbourhood, the Region's rules or the
  content change, never per tick, so a day's catch-up does not pay it 86,400
  times. No shipped Token provides it yet. *(`TileModifiers.growTimeOf`)*
- **Respawn** (built; no shipped Token uses it yet): a Token type with a
  Respawns block in the CMS comes back after it runs out. *Refill*: it stays
  where it stands, **resting** (greyed, a countdown bubble), nobody can work it,
  and after its time (12 s by default, at least 1 s) it refills to full at once.
  A refill may name a **resting sprite** (brief 230 S3): while it rests it is
  drawn as that picture instead of greyed, and every vein names the same
  **empty rock**; its card and inspection then name it ("Copper Ore Vein:
  resting, refills in 0:42"), and so does its hover. A refill that falls due
  part-way through a tick is worked only for the rest of that tick, so the
  catch-up's 1 s steps mine exactly what live play does. A refill may also
  **need a Token in reach** (brief 230 S2b; the CMS Respawns block's **Refills
  only with one of these in reach**): without one its rest **stands still**
  where it is, as a Stump's growth does (above), it wears the yellow mark
  ("Needs an Apple Orchard nearby to refill") and its card and inspection say
  it waits for one; one placed later carries the rest on from there.
  *Regrow*: it becomes its `into` Token (Oak Tree → Oak Sapling), whose own
  growth brings it back. Its hero moves on with no red alert; it is never
  depleted (no On Depleted rules, not counted as used up); a regrowing tree
  still counts toward its Forest's family cap. Never on enemies, spawners or
  Foundations. A hero with nothing else in reach **waits for it silently**
  (brief 230 S1b): no bubble, not counted idle, the flag's hover and the Dock
  say "Waiting for Copper Vein", and they work it the moment it refills. So
  does a hero whose only work in reach is a Stump or Sapling growing back into
  work they could do (brief 230 S2a: skill, level, tool and rule checked against
  what it grows into): "Waiting for Oak Stump", then "Waiting for Oak Sapling",
  and they fell the tree the moment it stands. A Stump that is not coming back
  (no Forest in reach, or stopped for want of its seedling) is nothing to wait
  for: idle as before, and so is a resting Token whose refill needs a Token in
  reach that is not there (a Bare apple tree with no Orchard). Worked out when
  the flag's words, the speech or the idle mark ask, never on the flag's pass,
  so it costs a catch-up nothing.
  *(`Respawn.js`, `Flags.waitingOf`)*
- **Mining** (brief 230 S3; built as content shapes, the S8 pack ships them):
  a **vein** refills all at once after its rest (Copper about 5 ore, about a
  minute, set per ore in the CMS), shows the shared empty rock while it
  rests, and stays where it stands. A **Mine** is a support:
  `Provides Double Item Chance 25 (flat), narrowed to its ore, to [its veins],
  nearby`, so each Mine in reach gives that ore a 25 % chance to come out
  doubled, stacking to a sure double at four; gems and anything else the vein
  drops are never doubled (owner, 2026-10-24). A **Minecart** is a support:
  `Provides Work Time −X % to [its veins], nearby`, stacking down to the
  standard floor (§7). A miner waiting on a resting vein waits silently (above).
  Mines that stop spawning veins and veins placed by maps are content (S8,
  brief 240). *(`OutputRules.doubleItemDrop`, `Respawn.restingSpriteOf`)*
- **Orchards** (brief 230 S2b; built as content shapes, the S8 pack ships
  them): a fruit tree is **picked, not felled**. Fruiting, it is worked for its
  fruit; picked empty it rests **Bare** (its resting sprite, per fruit) and
  then fruits again all at once in place, a refill that **needs an Orchard of
  its fruit in reach** (above): a Bare tree with none stays Bare. An **Orchard**
  is a spawner that plants its Saplings within its reach (`withinReach`, up to
  its allowance, a seed each; a Bare tree still counts toward it) and a support
  that speeds its trees' fruiting (`Provides Grow Time −X % to [its tree]`,
  floored). Fruit trees stay where they stand. Sapling, Fruiting and Bare art
  per fruit. *(`Respawn.gateMet`, `TimedChanges` refill row)*

### Foundations — Built
Buy a Foundation, pick a build recipe on it, and a hero builds it into a
station in place (30 s, level 1). *(`Foundations.js`)*

Each kind of Foundation is for its own kind of building (owner, 2026-11-03; brief 410).
The Shop sells only Foundations, in the order below; each shows skill icons that
hint at what it is good for. The icons and the place in the list are authored in
the CMS on the Token's `shop` block (`skills`, `order`), not worked out from its
recipes: several buildings have no skill of their own. The kinds are
`FOUNDATION_KINDS` (`tokenConstants.js`); a building recipe names the kinds it
builds on. Prices are *placeholders*. *(The Excavation and Battlefield rows, and
the moves, arrive with the owner's Sync of the Foundations pack.)*

| Foundation | Price | Skill icons | Builds |
|---|---|---|---|
| Wood Foundation | 15 Oak Wood | Crafting, Cooking, Alchemy, Fishing, Forestry | Workbench, Cooking Pot, Brewery, Alchemy Table, Tannery, Fir Workbench, Windmill, Composter, Beehive, Dock, Fishing Hut, Logging Camp, Farmstead, Minecart, Mining Camp |
| Stone Foundation | 10 Stone + 5 Oak Wood | Smithing, Faith | Furnace, Iron Furnace, Copper Smithy, Iron Smithy, Well, Fighter's Academy (retired) |
| Farmland | 10 Oak Wood | Farming, Forestry | Field, Herb Garden, Grapevine, Apple Orchard, the planted forests |
| Excavation | 15 Oak Wood (no Stone: the first Quarry is what gets you Stone) | Mining | Copper Mine, Coal Mine, Quarry |
| Battlefield | 15 Oak Wood | Melee, Ranged, Magic | The 18 enemy spawners built from a banner (Goblin Camp, Wolf Den, Slime Pit and the rest) |

### Fishing — Built (brief 230 S5); no content yet
Owner rulings 2026-10-24. **Water** is a Token with **catch pools**
(`catchPools: [{ tool, bait?, catches: [{ itemId, weight }] }]`, the CMS Token
editor's Catch pools block), one weighted pool per **tool kind × bait**; the
pool with no bait is the water's **basic** catch. One sprite per water type
(sea, river, lake) is content.
- **The card says what bites**: with a hero on the water, what their tool and bait
  land now, at the odds rolled; the water's other pools, or all of them with no
  hero on it, sit in shut lists by tool, at their authored odds.
- **Each finished cycle lands one catch** picked from a pool, in place of the
  Token's own Outputs, then widened like any output (Yield, Double Item Chance).
  A **rare catch drops like any other item**: no pop, no twinkle (owner
  2026-10-24).
- **The tool picks the pool**: the first tool in the hero's hands (grid order)
  that the water has a pool for; a rod in the first hand and a net in the second
  fish with the rod. Water needs any kind its pools name; **a tool's tier never
  gates**. **A better rod has its own bonus** through the **Catch Weight** rule
  (§7): +900 % on a Dolphin weighted 10 beside 50 and 40 makes it 100 of 190.
- **Bait** is carried in a Consumable cell: the first, in grid order, that a pool
  for the hero's tool takes and the Bank holds is used, and **one is spent per
  catch**. None left: the hero fishes the basic pool. A failed cycle catches
  nothing and keeps its bait. A tool with only baited pools here catches nothing
  without bait (the audit names such content).
- **Water never runs out** (`wearRule`: unlimited whatever its charges say) and
  **does not shift** (Transforms, above).
- **A Dock in reach speeds fishing**: content, a `Provides Work Time −X %` to the
  water, stacking to the standard floor (§7).
- Every pick draws one number from the game's random stream in a fixed place of
  the finished cycle (none for a one-fish pool), so a catch-up catches exactly
  what live play does, bait running out on the same catch.
- **The CMS prices water from its no-bait pools**: one catch a cycle, each fish
  at its share (several no-bait pools share the cycles evenly); baited pools and
  the water's own Outputs are not counted, and Recalculate never writes Outputs
  onto water (`cms/src/engine/sim/fieldAdapter.js` `waterOutputs`).
  *(`catchPools.js`, `Fishing.js`, `BoardRunner.completeCycle`)*

### Farming — Built (brief 230 S4); no content yet
Owner rulings 2026-10-24. **A Field is one Token that grows itself**: a station
(Works as Farming, kind **Field**; a **Herb Garden** is kind Herb Garden, its own
crop list) with a **Field** block in the CMS (its shared empty and growing
pictures). **Each crop is a Farming recipe** the Field offers (director's call,
S0 Q4): the player picks it on the Field with the gear (**"Choose crop"**) and the
same list as a station's recipes, crops unlock by Farming level, and the pick
**sticks** for every sowing after. The recipe's **inputs are its seed**, paid
once per sowing, never per harvest; its **Crop** row in the CMS sets how long it
**grows** (about an hour for wheat; 1 h by default), its **load** (harvests a
ripe Field holds; 10 by default) and its **ripe picture**.
- **Empty → growing → ripe.** Picking a crop on an empty Field sows it on the
  next tick for one seed from the Bank (then the loot on the mat). Growing, it
  counts down (the timer bubble, the card, the inspection) and is drawn as the
  shared growing picture; ripe, as its crop's ripe picture. Its state is saved
  on the Token (`field: { cropId, load, full }`, `clocks.fieldMs`).
- **A ripe Field holds a load of harvest cycles**: a Farming hero harvests it like
  any work, each cycle making the crop's outputs (Yield, Double Item Chance and
  bonus drops apply as anywhere). **The last cycle sows it again** with the
  pick, its growth counting from the moment that cycle ended; a seed that cycle
  dropped can pay. **No seed: the Field is stopped** (empty, the pick kept),
  wears the yellow mark, says "Needs Wheat Seed" as it stops (the "Needs Coal"
  look) and sows the tick one arrives.
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
  Wheat 25 %"); mat-wide rules never light. A Token's card lists **Boosted by**
  and **Boosts** (each Token in reach and its effects) and notes when its
  speed-ups are held at the floor. A doubled item and a Composter's extra
  harvests pop quietly over the Token (a spark from the support and a rising
  +N, no name); a catch-up draws none.
- **A map's wild wheat patch is a ready-planted Field** (owner 2026-10-24): a
  Field type whose Field block **starts ripe with** a crop, which is also its
  pick; it sows again from the Bank like any Field.
- **Old saves**: a Wheat Field saved as a spawner, once the pack makes it a
  Field, loads as an empty Field with nothing picked; Wheat Sprouts and Ripe
  Wheat finish and leave as before if their types are kept (S8 keeps them).
- A Field never wears out (it is a station); its load is not its charges.
  *(`Fields.js`, `TimedChanges.js` field row, `RecipeResolver`, `BoardRunner.completeCycle`)*

### Demolition — Built (Atlas A3a, A3b); replaced the discard bin
Mark a Token for demolition and a hero holding Construction (level 1) removes
it in 10 s of work: no refund, no loot, no XP, never a depletion. While marked
it is only that job: its recipe, build, training, spawning, growth, refill and
Passive Production stop (what it gives its neighbours by standing there
carries on until it is gone). Unmarking makes it itself again and loses the
half-done demolition. Anything bought, built, spawned or planted can be marked,
a resting Token included; the Guild Hall, landmarks, a map's nodes, quests and
enemies can't, except a map's node whose type is marked **Can be cleared where a
map placed it** (`clearable`, a box in the CMS Token editor: wild Forests and
the Stumps of felled map trees, brief 230 S2a). The Starter Camp's own Tokens
stay as laid whatever their type. **Demolish** on the Token's inspection marks it (where it
can't be, the inspection says why), **Cancel demolition** takes the mark off.
A marked Token wears the Construction badge, its inspection reads "Marked for
demolition" with the time left once a hero is on it, and "Demolished …" pops
up where it stood. A **bounty** quest has **Dismiss bounty** on its
inspection instead: it leaves with no reward and frees its place; tutorial
steps stay until claimed. The discard bin (and its refunds) is gone.
*(`Demolition.js`, `QuestTokens.dismissBounty`, `TokenInspection.jsx`)*

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
a marsh of many small ponds (`terrainRegistry.js`); the QA panel's Terrain
views use it. Map bursts, the Map shop, the Explore skill and the old Map
catalogue are retired too; the last Map Token, **Volcanic
Island**, does nothing and is the owner's to delete in the CMS.

---

## 4. Heroes

### Roster — Built
- Heroes come from the **Bunk Beds** Hall upgrade: each rank adds one hero,
  **max 8** (`ROSTER_MAX`). Rank 1 is free and held from the start: it is the
  first hero, made on the new-game screen (§1). *(`guildUpgrades.js`,
  `EngineBootstrap.createFirstHero`)*
- Every new hero is identical: every skill at level 1 (below), 11 HP, a random
  name. Differences are earned. No retirement. (Classless heroes, brief 270
  K1; the "Recruit" title is gone.)
- One flag colour per hero (8 colours): the small flag that marks their job.

### Skills — Built
**20 skills** in three layers, and **every hero holds every one** from level 1
*(`skillRegistry.js`, the source of truth; classless heroes, brief 270 K1)*:
- **Starting (9)**: mining, forestry, fishing, smithing, crafting, cooking,
  farming, alchemy, construction.
- **Combat (4)**: melee, ranged, magic, stealth. The style a hero fights in is
  their weapon's (see Equipment and The fight).
- **Specialist (7)**: fletching, faith, summoning, enchanting, crime, taming,
  science. **Placeholders** (owner ruling D7): names, descriptions and emoji
  icons that work like any skill, with no mechanics of their own until the
  owner's specialist-skill rework. Shown at level 1 so players see what is coming.

Leadership, Commerce, Trapping, Armory and Shadowcraft were **cut** (K1): content
naming one is listed by the boot audit and the CMS Economy Audit, and an older
save's levels in them are dropped on load.
Forestry is the old Logging, renamed with its id (it keeps the Logging art);
Explore and the other v1 skills were dropped. Only the Starting skills (Alchemy
has none yet) and melee have content today.

- **If the skill is high enough, the hero can do it**: the gate on any work is
  the skill level, a tool or an item, never a class.
- XP comes from work cycles (the recipe's or Token's `xp`) and kills (into the
  style the hero fought in: their weapon's, Melee barehanded). Level cap 99; XP to level 99 ≈ 13 million
  (RuneScape-style curve, `XPCurve.js`).
- **XP bonuses apply per skill, kills included** (owner 2026-11-07, brief 530): a bonus aimed at a
  skill widens that skill's XP wherever it is earned, a work cycle of it or, for Melee, Ranged, Magic
  and Stealth, a kill won in that style; a bonus aimed at no skill widens every skill's XP, kills too.
  Gear, perks, potions, a Token's neighbours and Guild Hall stars all count, summed into one bonus
  (a positive bonus always adds at least 1 XP). *(`BoardRunner.js`, `CombatResolutionProcessor.js`)*
- A skill level gives no work speed: a cycle takes its authored time whoever works it (owner 2026-10-09, T-125).
- **Hero level** = the average of all their skills (display only).
- **Content that still says `logging`** (data/ and the CMS workspace, until the
  owner's next Sync) is read as `forestry` as it loads
  (`skillIdMigration.js`, to be removed under T-114). Content naming a skill
  that does not exist, or carrying a retired Promotes rule, is listed by the
  boot audit and the CMS Economy Audit.

### Milestone perks — Built (brief 270 K4); no perks authored yet
- **Each skill may carry a perk table**: fixed perks at set levels (the CMS offers 10, 25, 50, 75
  and 99; any whole level from 2 to 99), each a **library effect** (§7). Every hero who reaches the
  level holds the perk and keeps it; no choices. *(`data/skillPerks.json`, written by the CMS's
  Skill Perks page and Sync; `perkTable.js`, `HeroPerks.js`)*
- **Held, not granted**: a hero's perks are read off their levels whenever asked, never saved, so a
  level-up, a load and a catch-up agree and none is granted twice.
- A perk's rules reach the hero **as a carried item's do** (the Token they work, their fights, On
  Work Start, the combat numbers), and it spends nothing. A work rule should be narrowed to its
  skill; the audits say when one is not.
- **Shown**: the level-up number over the hero names the perk underneath, the hero bar gives it an
  alert of its own, and the hero sheet's skill row lists the perks held and the next one.

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
- **Regen 1 HP / 10 s while idle or working; none in a fight**, where only
  food heals.
- Below 25 % HP a hero eats equipped food from the Bank (in a fight eating
  takes that swing). **Drinks never heal**, in a fight or out (owner
  2026-10-24): an equipped drink is left alone, unspent, and a drink's restore
  amount is ignored (the item tooltip and the CMS no longer offer it). Out of a
  fight, healing is food and regen only. Drinks are work buffs (below). Heroes
  have no energy (removed, T-098).
- **Drinks** (brief 230 S6b): a drink whose rules wait on **On Work Start** is
  drunk from the Bank as its hero starts a work cycle and **lasts 10 work
  cycles** (one number for every drink, `DRINK_CYCLES`, a placeholder; a fight
  is not a work cycle). Its rules fire from that dose ("On Work Start: applies
  Coffee to the hero for the cycle", Coffee being work 50 % faster); a rule
  naming a skill counts only that skill's cycles. A fresh one is drunk when the
  dose runs out, and the dose keeps working after the Bank runs dry. The count
  left is saved on the hero (`drinkCycles`); a drink with no work rule does
  nothing. *(`ConsumptionSystem.startWorkDoses`, `LoadoutMoments.js`)*
- **Work potions** (Alchemy, brief 230 S6b): a Consumable whose rules wait on
  On Work Start is **spent only when a cycle of its own skill starts**, one
  potion for that one cycle: the Birdwatcher ("On Forestry Work Start: applies
  Birdwatcher to the hero for the cycle", Birdwatcher granting a Bird Nest a
  quarter of the time as the cycle completes). The hero keeps it while doing
  other work.
- **Nothing acts by sitting in the Bank**: a food, drink or potion's always-on
  rules do nothing (§7); it acts only through its moment and its dose.
- **Food Healing** (a Rules row) moves what a meal heals in a fight: while
  **Burning** (−50 %) a Shrimp's 5 heals 3, rounded halves up.
- **Elixirs** (the unlimited consumable slot): an elixir whose rules wait on
  the fight-start moment is drunk as a fight starts and **lasts 10 fights**
  (one number for every elixir, `ELIXIR_FIGHTS`; each enemy engaged is one
  fight). Every equipped elixir type works at once and their effects stack; a
  type is drunk again from the Bank when its last dose runs out, and keeps
  working for the rest of its 10 fights after the Bank runs dry. The count
  left is saved on the hero (`elixirFights`). A consumable with no fight rule
  is never drunk by a fight. *(`ConsumptionSystem.js`, `LoadoutMoments.js`)*
- **The "used" bubble**: when a hero eats, or drinks an elixir, a drink or a
  work potion on the mat, a small bubble over their head shows the item's icon
  and what it did ("+5 ♥", or the item's name), tinted by the item's kind, for
  1.5 s, one at a time per hero. A work potion shows it every cycle it is drunk
  for. Not drawn during a catch-up. *(`matFx.js`)*
- **Defeat** (0 HP): the hero loses their job, limps home, loses 25 % of
  the whole Bank stack of each carried food and drink (elixirs exempt), a
  10 % chance per gear piece to lose that piece (the hero's own copy), and is
  **wounded for 5 minutes** of game time, returning at 50 % HP (*placeholder*
  numbers). Healed, they wait at the Hall for a new job; a healing hero takes
  no job ("Ana is healing: 0:42").

### Equipment — Built
A 3×3 loadout grid with category caps (hand 2 — two hands: a weapon, a tool
or an off-hand item takes one, a two-handed weapon both — hat 1, chest 1,
trinket 2, food 1, drink 1, consumable unlimited). Gear, weapons and tools are
one copy per hero: equipping takes the copy out of the Bank. **Bait** for
fishing and **arrows** for a bow are carried in consumable cells and spent from
the Bank, one per catch or per shot (§3 Fishing, §6 The fight).
- **Moving items by drag.** Dropped on another slot of the same hero, an item
  moves there and swaps with what is there; no slot has rules of its own, so a
  swap can never be refused, and a tool moved mid-job keeps the hero working.
  The first weapon or tool in grid order is the one used, so a move can change
  which that is. Dropped on another hero in the bar or the Bank's column, it
  leaves the giver (food and potions too; their stack stays in the Bank) and
  lands in the receiver's first empty slot. A full loadout, a level the receiver
  lacks or an item they already carry refuses with the reason and the item
  stays. Past a category's cap or a full pair of hands, what the receiver puts
  down goes to the Bank, as with any equip. A hero handed away from their work
  tool stops, keeps their flag and shows the yellow alert.
- **Tools and weapons that break** (brief 480 L1): a tool or a weapon may carry
  a **break chance** (§5). Nothing equips a spare from the Bank when one breaks:
  no order, camp or rule equips anything by itself; only the player does.
- **A weapon** is anything held in the hands that is not a gathering tool or an
  off-hand item. It names **one style** (`styles: ['melee']`; an older list of
  two fights in its first and the audits say so), its **damage**, its **speed**
  (fast 2 s, normal 3 s, slow 4 s) and its **damage type** (`damageType`, one
  of the nine, §6; a weapon without one hits in its style's default: Melee
  Slash, Ranged and Stealth Stab, Magic Fire). **The weapon decides the
  style**: any hero may hold any weapon, and fights in its style. A weapon
  naming no style is Melee. Older content's single `skillRequired` style is
  read as its style. The type comes from the family and its name, never the
  tier: swords are Slash at every metal, and a magical type is named on the
  item ("Ember Wand").
- **The hands** (owner: off-hand items only in the second hand): **only the
  weapon swung lends anything**, the first in the hands whose level the hero
  meets; a weapon in the second hand lends nothing, whatever its style. Taking
  up a weapon puts the one held down in its place, and taking up an off-hand
  item puts the one held down; a tool stays beside either. A two-hander clears
  both hands. An older save holding two weapons keeps them until the next
  weapon is taken up. *(`weaponStyles.js`, `EquipmentManager.js`)*
- **An off-hand item** (`offHand: true`, CMS "Held as: an off-hand item") is a
  hand item that is never swung: a **shield** acts like a piece of body armour
  (its resistances, cuts and rules, no block chance); a quiver or a focus orb
  lends its rules. It carries no weapon numbers.
- **Defence is percentages, by damage type** (flat Armour, flat Resistance and
  Pierce are retired). Every worn piece (a hand item, hat, chest or trinket) may
  carry **resistances** (`resistances: { physical: 20, fire: 10 }`: percent off
  hits of that type or group the wearer takes; negative is a weakness) and a
  **damage cut** to named styles (`damageCut: { magic: 30 }`: percent off the
  wearer's own hits while they fight in that style, shown red in the tooltip).
  **Every piece is a trade-off** (owner): metal resists Physical and cuts Magic
  and Stealth, so a mage is worse off in an iron chestplate than in nothing.
  **Gear lines add** across pieces and within one (Physical 20 and Slash 10
  resist Slash 30), unlike an enemy's. There is **no cap**: gear numbers are kept
  small instead, and the content audit names any type a hero's best possible
  stack (best hat, chest, two trinkets, hands, every perk) takes to 100 % or
  more. *(`gearDefence.js`, `gearDefenceRule.js`)*
- **Level requirement** (K1): a weapon may ask a level in its own style
  (`levelRequired`: "Iron Sword: Melee 15"); armour, off-hand items and
  trinkets name the style (`skillRequired`) beside the level. Equipping below
  it is refused, "Needs Melee 15". Gear held below its level (an older save, or
  a level added later) stays in its slot, lends nothing, and a weapon is not
  swung. *(`weaponStyles.js`, `EquipmentValidator.js`)*
- **A family's ability is a Rules effect on the item.** Every tier of a family
  points at the same library effect (the Dagger: Provides 5 Crit Chance), each
  with its own **scale** (copper 1, iron 2…), so the tier raises the number.
  Armour may carry abilities the same way (a Hide Vest: Venom stacks at most 1
  lower; Type Resistance % rows count beside its own lines). An ability may
  touch anything the grammar reaches, work included (a Cleaver's chance to
  double Raw Beef works on a kill and on a work cycle alike).
- **What ships** (copper and iron): Sword, Dagger, Cleaver, Greatsword (two
  hands), Bow and Wand at each metal; Leather Hat and Chest, Copper and Iron
  Helmet and Chestplate; the Elixirs of Valor and Ironskin. The combat content
  pack (brief 280 V5, in the owner's CMS review) gives the weapons their types
  (swords and cleavers Slash, greatswords Crush, daggers Stab and Stealth only,
  bows Electric, the Copper Wand Fire, the Iron Wand Ice), re-authors the
  armour as resistances and cuts, and adds the first arrows and a Copper Shield.
  Until it is accepted the shipped armour still names the retired Armor row and
  does nothing.

### Orders: how heroes get work — Built (the heart of the game)
Heroes do not choose their own work: **the player sends each hero to a job by
dragging them** (hero orders, brief 260; owner 2026-10-28: one hero, one job,
less micromanagement than area flags).
- **Heroes live on the mat.** One with no job waits in a row in front of the
  Guild Hall. The hero bar is the roster: it finds a hero on the mat, opens
  their sheet, says on hover what they are doing, wears a yellow alert when only
  the player can get them going or a red one when wounded, and can be dragged from.
- **Drag a hero onto a Token** they can work (their figure, their job flag, or
  their figure on the hero bar): they walk there and work **only that Token**,
  a tree, a vein, a station, a Field, an enemy or a boss (a retired Promotion
  Token is nothing to work: K1).
  Onto **bare ground**: they walk there and wait (the flag marks the spot until
  they arrive). Onto the **Guild Hall**: they go home. **Right-click** a hero
  to send them home.
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
  followed through its Stump and Sapling and felled again when it stands. **A
  Token gone for good** (used up, removed, demolished, or a Foundation built:
  the build ends the builder's job) leaves the hero where it stood with a
  yellow **"needs a job"** mark, and they say "I need a job."
- **One hero per link** (owner): a hero no longer mines and then smelts on
  their own. A miner feeds the Bank and the Furnace's hero draws from it.
- **Sticky**: a hero never leaves mid-cycle. A new order or a recall resets
  the progress of the Token left behind; a moved Token keeps its hero and its
  progress (the hero walks after it).
- **Camps** (brief 260 O2) are Tokens built on a Foundation, each naming a
  skill and a reach (CMS: the Camp block): **Logging Camp** (Forestry),
  **Mining Camp** (Mining), **Fishing Hut** (Fishing), **Farmstead** (Farming:
  it harvests the ripe Fields and picks the bushes in its reach). A hero sent
  to a camp works the **nearest free Token of its skill they can work within
  its reach**, finishes each cycle and keeps the Token while it can run, then
  moves to the next; with only resting or growing Tokens left they wait
  silently by the camp; with everything taken they say "Nothing to work near
  Logging Camp". **Any number of heroes** may work from one camp, one hero per
  Token. A drop on a camp whose Tokens the hero can work none of says why; an
  empty camp takes the order. Hovering a camp, or a hero working from one,
  shows its **reach ring** (an enemy camp shows none).
- **Enemy camps** (a Goblin Camp, a boss's den) take the same order: the hero
  hunts what the camp spawns, one at a time, and waits beside it for the next.
- **Walking costs time**: heroes walk at 120 u/s (≈15 s across the mat) in
  straight lines; the cycle starts on arrival. Idle heroes potter within 80 u.
  *(`HeroMotion.js`)*
- **Returning to a Region**, heroes take up their jobs there again. An old
  save's flags load as orders: a flag on a Token becomes a job on it, an area
  flag a hero waiting where it stood.
- **Speech bubbles** are for moments (going idle, a job gone, a Token used
  up). Max 3 per hero. Lines: [`speech_bubble_lines.md`](speech_bubble_lines.md).
- *(`Flags.js`, the orders and the claims; `Orders.js`, the drop; `Camps.js`)*

---

## 5. Economy and items

- **Items are the only currency** *(`GoldRetired.test.js`)*. Every price is a
  list of items. Nothing can be sold. The Shrimp Market Token runs but pays
  nothing; markets are cut for now (§16, T-127).
- **Item sinks**: surplus and high-tier items are meant to be spent on
  **upgrades and construction** (Hall upgrades, stations, recipes), not sold
  (owner 2026-10-06).
- **64 items** (`data/items.json`): 41 materials, 17 food, 5 drinks, 1 potion.
  An item's `value` is set by the CMS simulator for balancing; **the game never
  shows or spends it**.
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
- **Looking at an item in the Bank** (brief 400): hovering a tile gives the
  tooltip (name, count, type, tags). **Clicking it opens the inspection
  window** along the Bank's foot: the sprite at 4×, the count, type and tags,
  everything the tooltip leaves out (a weapon's stats, resists, what it
  restores, the description), how many were collected this run, and a book to
  its Encyclopedia page; its X, Escape or a second click closes it. A press
  that moves 8 px is a drag instead, and the click that ends a drag opens
  nothing; in Select mode a click selects. Nothing is discarded or sold there
  (T-306). *(`BankItemWindow.jsx`)*
- **Supply is automatic**: Tokens take inputs from the Bank, then from loot on
  the mat. A cycle is all-or-nothing; first come, first served.
- **Tools and weapons that break** — **Built (brief 480 L1); no content uses
  it yet.** An item's `breakChance` (CMS: Break chance %, on a tool or a weapon
  only; a percent above 0 and up to 100) is rolled **only as a cycle it was
  used for completes**, never part-way (owner 2026-11-05: the swing is just
  art): a **tool** at the end of each work cycle on a Token that needs it (the
  first fitting tool in the hands, the one the cycle used; a failed cycle
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
- **Recipes** (25, `data/tokenRecipes.json`): smithing 10 (copper → darkmetal
  ingots at levels 1–90, tools, nails), cooking 7, crafting 2 (Charcoal,
  Torch), farming 2, construction 4. Each costs the station 1 charge. A new
  station is idle until the player picks a recipe. Example: Copper Ingot =
  4 Copper Ore + 1 Coal, 8 s.
- **A station offers the recipes of its skill that its kind makes** (brief
  230 S6a): its `Works as` rule may name a **station kind** (Furnace, Smithy,
  Kitchen, Brewery, Workbench, Alchemy Table, Summoning Circle; one game-defined
  list), and a recipe may name the kinds that make it (`stationKinds`, the CMS's
  "Made at"). A Furnace smelts and a Smithy makes tools, though both work as
  Smithing; better versions of a station (Campfire then Kitchen) share a kind.
  Both sides are opt-in: a recipe naming no kind is offered by every station of
  its skill, and a station with no kind offers its whole skill, so shipped
  content is unchanged until it is tagged. A saved station set to a recipe its
  kind no longer offers says "Choose a recipe". A recipe's context tags (the
  Copper Anvil) still work beside the kind. *(`recipePoolRegistry.recipesForStation`,
  `stationKindOf`, `STATION_KINDS`)*
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
- **The Shop** sells the Foundations only (see §3, Foundations), all available
  from the start; price is the only gate (*placeholder* prices). Coast and Goblin
  Camp come from the Starter Camp and the world map's tables instead. *(`Shop.js`)*

---

## 6. Combat and enemies

### Enemies — Built
Enemies are Tokens with `enemy: { level, style, kinds?, boss?,
resistances?, moves? }`. **The level fills every number from the level
table**: HP 20 + level, plus 4 HP per 30 levels (the old armour step), a hit of
1 + 1 per 20 levels, a swing every 3 s, XP 10 × 1.065^(level − 1), no Dodge or
Accuracy, a 5 % crit (the table and its worked duels: `concept_combat.md`,
"The level table and weapon tiers").
- **Resistances and weaknesses** come in **fixed steps** (owner): resist 25,
  50 or 100 %, weak 25 or 50 % (`resistances: { physical: 50, crush: -50 }`),
  by damage type or group, several per enemy. A **type's line replaces its
  group's** for that type ("Skeleton: Physical resist 50 %, Crush weak 50 %"
  reads as written). Readable from the creature: a shell resists Slash, a fire
  elemental ignores Fire. Most enemies have 0–1 lines, bosses up to 3, and no
  enemy shuts out every type a style can reach at its tier. Shown on the enemy
  card from the start. *(`damageTypes.js`)*
- **Moves** (owner: "each enemy has a few attacks, picked at random"): an enemy
  may list moves, one made each swing, picked by weight (`moves: [{ name,
  damageType, hits, effectId, target, lasts, weight }]`). A move hits with the
  enemy's own hit in its own type or group, or lands an effect on itself or the
  hero, or both: the owner's chicken Pecks (Stab), Scratches (Slash) and
  Flutters (no hit: +50 % Physical resistance on itself for one attack); a
  Smash may ride a Heavy Strike for that swing. An effect lasts **one attack**
  (until the next attack on its bearer is over, hit or miss), **the swing** (on
  itself only) or **the fight**; a status keeps its own lifetime. An enemy with
  no moves swings a plain **Physical** hit, as before. The moves show on the
  enemy card from the start; the log and the fight window name the move
  made, and a **special** move (one that lands an effect, or does not hit) is
  also said in a bubble over the enemy's bar on the mat; a plain hit, named or
  not, is not. *(`enemyMoves.js`, `isSpecialMove`)*
- **Kinds** (none, one or two, CMS presets the player discovers by fighting):
  **Armoured** Physical resistance 50 % and slow (4 s, same hit; an author's
  own Physical line replaces it); **Nimble** +15 Dodge; **Swift** a swing every
  2 s at 2/3 of the level's hit; **Brute** a swing every 4 s at 4/3 of the
  level's hit and at least 1 more; **Venomous** lands a stack of the **Venom**
  status on the hero with every hit that leaves them standing (the library's
  `effect_venom`). Swift clashes with Armoured and Brute (both set the swing);
  the CMS refuses the pair. Kinds never change HP or XP. *(`enemyKinds.js`)*
- **Order**: the level table (older content's `budgetScale` multiplies its HP,
  hit and XP, rounded halves up, at least 1), then each kind in the order
  ticked (hits rounded halves up, at least 1), then **any number written beside
  the level** (`hp`, `hit`, `speed` fast/normal/slow, `xp`, `dodge`,
  `accuracy`, `critChance`) **replaces the result outright**, and an authored
  resistance line replaces a kind's on the same key. The retired `armor` and
  `pierce` fields are ignored and named by the audits. The CMS shows every
  number filled from the level and kinds, greyed "from level", until the
  author types one ("yours", with a button back). *(`enemyProfile.js`)*

18 ship, across all four styles, on plane 1 and plane 2 (Fire Elemental,
Sulphur Lizard, Frog and their bosses):

| Enemy | Level | Style | Kinds | Boss |
|---|---|---|---|---|
| Thorn Elemental | 1 | melee | — | |
| Cow | 1 | melee | — | |
| Crab | 3 | melee | Armoured | |
| Wolf | 4 | melee | Swift | |
| Goblin | 5 | melee | — | |
| Bee | 6 | stealth | Nimble | |
| Greater Slime | 8 | melee | Armoured | yes |
| Wolf Alpha | 10 | melee | Brute | yes |
| Water Elemental | 12 | magic | Armoured | yes |
| Wind Elemental | 12 | ranged | Swift | yes |
| Queen Bee | 14 | stealth | Venomous | yes |
| Frog | 15 | stealth | Nimble | |
| Sulphur Lizard | 16 | melee | Armoured | |
| Fire Elemental | 17 | magic | Brute | |
| Goblin Chief | 20 (hit 4) | melee | Brute | yes |
| Toxic Frog | 22 | stealth | Venomous | yes |
| Big Lizard | 24 | melee | Armoured | yes |
| Fire Elemental Chief | 25 | magic | Brute | yes |

Their resistances, weaknesses and moves come with the combat content pack
(brief 280 V5, in the owner's CMS review; the analyst's starter table in
`concept_combat_v2.md`), which also brings the Goblin Chief to level 12 with a hit of 3.

- Goblins come from the Goblin Camp. **Enemies stand still** (owner,
  2026-11-05): an enemy stays where it spawned (a spot round its camp), where
  it is placed, or where the player drops it; a moved camp leaves its enemies
  where they stood. The only time one moves is a short step to open space
  before a crowded fight (§6, Fights), and it stays where it stepped. No walk
  animation is needed; the step slides in the idle pose.
- **No ambushes: combat is always started by the player** (owner,
  2026-11-05). No enemy attacks first: a hero fights only an enemy they are
  sent at (or one their enemy camp hands them), and nothing pulls a hero off
  their job. A hero working right beside a goblin camp is never attacked. The
  old Hostile mark is gone from the CMS; one left in `data/` is read by
  nothing.
- **Boss** (`enemy.boss: true`, a CMS tick): fights only the heroes sent at
  it, like every enemy. Never made by a rule. Comes from a camp of its own or a Summoning Circle
  (Encounters, below). Boss moves will hang on this mark.
- Each kill uses one of the enemy's uses; at 0 it's gone. Otherwise it
  respawns at full HP after a 2 s pause.
### Encounters — Built (brief 220 C5)
- **Every fight is one-on-one**, bosses and guardians included: a Token holds
  one hero's claim. A second hero sent to a busy enemy waits beside it, takes
  it within a second of it coming free, and meets it at full HP. No random
  roll. The waiting hero says "Waiting for {enemy}.", their job flag's hover
  reads "{enemy} — {hero} is fighting it", and the roster line says "Waiting
  for {enemy}". A save holding two heroes on one enemy loads into one fight
  (the second waits).
- **Bosses and guardians come from camps of one**: an ordinary spawner (a
  "Warlord's Den", a "Guardian's Hollow") whose spawn list names the one enemy,
  allowance 1, on its own interval: the same machinery and CMS fields as any
  camp. The boss or guardian stands by its camp; a place brings one through
  the world tables' camps. The camp's clock stands at zero
  while the camp is full, so a beaten boss or guardian comes back one whole
  interval after it falls (§3, Spawners).
- **A guardian** is simply a tough enemy whose camp stands by a rich node. It
  blocks nothing and attacks no one: a hero works the node in peace, and
  another may be sent at the guardian.
- **A Summoning Circle** is an ordinary station whose recipe uses up a
  summon item (its input) and makes its boss beside it (a Token output). It
  works as a Starting skill, so any hero may work it (it becomes the
  Summoning skill's station when the specialist skills are designed). Its
  recipe is picked once, as any station's. Without the item it waits ("needs"
  the item, the usual yellow mark); with several in the Bank it calls one per
  cycle while a hero works it. A boss it called is gone once beaten.
- **No node ambushes** (owner, 2026-11-05): a Token's rule never spawns an
  enemy. Enemies come only from camps and Summoning Circles. A `Spawns` rule
  that names an enemy (the Iron Ore Vein's old Fire Elemental Ambush) is
  refused, rolls nothing and costs nothing; the editor offers no enemy to a
  Spawns rule, and the content audit names such a rule so it can be deleted.
- **Enemy camps** are spawners; a hero sent to one hunts what it spawns (§4,
  Orders). Hovering or dragging one shows no ring (its enemies stand where
  they spawned, and nothing it does reaches its neighbours). Lure buildings
  are parked.
- **A beaten enemy**: the hero who beat it says "{enemy} Beaten" (a Token used
  up says "{token} Depleted").

### The fight — Built
- **Swings.** A hero swings at their weapon's speed: fast 2 s, normal 3 s,
  slow 4 s (barehanded: 3 s). The weapon swung is the first in the hands the
  hero may hold (its level met); its style is the hero's for the fight. An enemy swings at
  its own speed (3 s unless a kind or the author says otherwise).
- **Damage types** (owner, brief 280): nine types in three groups.

  | Group | Types | Mostly reached by |
  |---|---|---|
  | **Physical** | Slash, Crush, Stab | Melee (all three), Stealth (Stab), Ranged (the arrow) |
  | **Elemental** | Fire, Ice, Electric | Magic, Ranged (the bow) |
  | **Special** | Poison, Light, Dark | Stealth (Poison, Dark), Ranged (the bow), later content |

  **Only weapons and ammo give a hit its type**: a weapon has one, a ranged shot
  two (the bow's and the arrow's). Armour, off-hand items and elixirs only
  boost or resist types. A fist is Crush. *(`damageTypes.js`)*
- **The hit, in order**: (the weapon's damage, a fist 1 + 1 per 20 combat
  levels + flat Damage from gear) × the matchup × Damage % buffs × (1 − the
  hero's damage cut for the style, from gear) → × 2 on a crit → each part × its
  **type factor** (1 + the attacker's Type Damage % for that type − the
  target's resistance to it after Sunder; never below 0) → the parts summed →
  **the fraction rolls**: 1.1 does 1 nine times in ten and 2 one time in ten.
  No flat armour and **no "at least 1"**: a resisted hit can do 0, and immunity
  means 0. A landed hit that does 0 is still a hit (On Hit rules fire). An
  enemy's hit is its Hit (+ flat Damage) the same way, in its move's type, or
  as Physical with no move: only the hero's Physical lines resist a plain
  swing, a Slash line alone does not.
- **Arrows**: a hero fighting with a Ranged weapon shoots the first arrow
  carried in a consumable cell that the Bank still holds, **one per shot, hit
  or miss**. A shot is the bow's damage (with the level step and flat Damage)
  in the bow's type plus the arrow's damage in the arrow's type (`arrow: {
  damage, damageType }` on a Consumable; usually Stab), so a ghost immune to
  Physical still takes the bow's part. With none left **the bow shoots its own
  part alone** (owner). An arrow's own On Swing and On Hit rules count only on
  the shot that spends it (a Sundering arrow sunders only when shot).
  *(`combat/Arrows.js`)*
- **Misses**: 10 % at an even level, 1 point less per level the attacker is
  above the defender (more when below), that part kept between 5 % and 25 %;
  then + the defender's Dodge − the attacker's Accuracy, kept between 5 % and
  40 %. Both sides roll the same way.
- **Crits**: 5 % (gear adds Crit Chance), doubling the hit before the type
  factor. Enemies crit at 5 % unless authored.
- **The fight window and the log name the type**: "Weak!" when the target's
  weaknesses outweigh its resistances across the hit's parts, "Resisted" the
  other way; a shot shows both its types.
- **Barehanded is a Melee punch**: 1 + the Melee level step, every 3 s, on the
  melee side of the cycle, in Crush, earning Melee XP. A hero's level for the
  damage step and the miss gap, both ways, is their level in the style they
  fight in.
- **A four-way cycle: melee > ranged > magic > stealth > melee**: +25 %
  damage for the favoured side, −25 % for the other (owner: early fights are
  barely shaped by it; at 20–30 damage it shows). Opposite pairs (melee and
  magic, ranged and stealth) are even, so each style has one good matchup, one
  bad one, and two even. A hero fights on their weapon's side (Melee
  barehanded). An enemy's Style is one of the four combat skills.
- **No regen in a fight**: below 25 % HP the hero eats food instead of
  swinging; drinks never heal. Elixirs are drunk as a fight starts
  (section 4).
- **Fleeing**: dragging a hero to another job ends their fight, as it ends any
  job (owner).
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
  the same enemy. It is decided once, as the hero arrives: a fight never moves
  once begun, and the next kill of the same enemy fights where it stands. The
  enemy walks at its full speed (90 u/s), so a step delays the first swing by
  its length at that speed, at most about 1.8 s; the QA crowd's steps are
  8 to 48 u. Afterwards the enemy stays where it stepped (enemies stand
  still), and a hero whose job is elsewhere goes back to it, as before. A catch-up steps the same
  fights to the same spots (whole mat units, no random draw). Never saved: a
  save taken mid-step loads with the hero walking up again.
  *(`board/FightRoom.js`)*
- **Random draws, in a fixed order** so a catch-up replays the same fights as
  live play: an enemy with two moves or more draws its move first in its
  swing; then each swing draws one number for the miss, on a hit one for the
  crit, and one for the fraction only when the hit has one. At a kill, a weapon
  with a break chance draws one last (§5); without one, nothing.
- Kills give XP to the style fought in (the weapon's) and count as a work cycle for
  neighbour rules. Loot drops on the mat, through the same yield, double-loot,
  double-item (a Cleaver's) and bonus-drop rules as a station's output (T-017).
  A double-item chance draws one random number per item it names that landed,
  and none when nothing offers it.
  *(`FormulaRegistry.js`, `CombatFormulas.js`, `src/systems/combat/`)*

### Status effects — Built
- **A status is a library effect with a status block** (`status: { stacks,
  ticks }`, the Status section of the CMS Effect editor): each landing adds a
  stack up to `stacks` (1 = it does not stack, landing again renews it), its
  rules count once per stack, and it lasts `ticks` ticks, or the whole fight
  at 0. What it does each tick is an ordinary On Tick rule ("deals 1 damage to
  itself"; a Deals rule's damage is untyped and lands whole); what it changes
  while carried an ordinary Provides (Burn's −50 % Food Healing). Statuses are
  separate from damage types (owner): a Fire weapon does not Burn unless a rule
  says so. *(`LiveEffects.js`, `effectLibrary.statusBlockOf`)*
- **Statuses are fight things**: one lands only on a fighter (a hero in a
  fight, or the enemy), and **every status ends with its fight**: the kill, a
  knockout, the hero leaving, a load. No hero falls to poison on the way home.
- **One Rules tick every 3 s** for every lingering effect, statuses included
  (heroes in roster order, then each fight's enemy). A tick that knocks a hero
  out is a defeat like any other (one banner, one gear roll); one that
  finishes the enemy is a kill before it swings again.
- **The statuses** (the owner's numbers): **Venom** (once named Poison, now
  that Poison is a damage type) stacks to 3, 1 damage per stack per tick until
  the fight ends; **Burn** does not stack, 1 a tick for 3 ticks, and food heals
  half while it burns; **Sunder** stacks to 3 and lasts the fight, each stack
  taking 10 points off **every resistance** its bearer has, never below 0 (a
  weakness, or no resistance, is untouched; it replaces the retired Pierce).
  Bleed, Stun and Shield wait for a later pass; Well Fed and Cookout go with
  the drinks.
- **The Venom rename** is a content migration (`effectIdMigration.js`):
  `effect_poison` is read as `effect_venom` wherever content names it, as the
  game loads `data/` and on every CMS load path, so the owner's next Sync
  writes the new id. No save needs it (every status ends with its fight).
- What a fighter carries moves them: **Status Stack Limit** (a Hide Vest:
  Venom stacks at most 1 lower; at 0 it cannot land) and **Status Immunity**
  name a status effect. A cap lowered mid-fight never strips stacks carried.
- What lands them: the Venomous kind, an enemy's move, and any rule's Applies
  on either side (a spear's or an arrow's "On Hit: applies Sunder to the
  enemy", a boss's status attack).
- **Shipped**: Poison (read as Venom) and Burn. The combat content pack adds
  Sunder (landed by the Iron Bodkin Arrow) and Flutter (a Bee's move). An
  older save's statuses (the old status engine's, which outlasted their
  fights) are dropped on load.

### Boss moves — Built
Beside its moves (§6 Enemies, made one a swing at random), any enemy can carry
rules on the three **fight moments** (§7): **On Swing** (every Nth swing,
before it is rolled), **On Hit** (every Nth landed hit, after its damage) and
**On Health Below X %** (once a fight). These still run on every swing,
whatever the move; a move that does not hit counts as a swing, not a hit. The
shipped bosses use them:
- a **heavy strike**: "On Every 6th Swing: applies Heavy Strike to the enemy
  for the swing" (Heavy Strike: +100 % Damage, so that swing hits double; the
  Goblin Chief, the Wind Elemental every 3rd);
- a **status attack**: "On Every 3rd Hit: applies Burn to the hero" (the Fire
  Elemental Chief; the Greater Slime lands Venom);
- a **heal or a resistance**: "On Health Below 50%: heals 10 health on itself"
  (the Water Elemental), or "…: applies Stone Skin to the enemy for the fight"
  with Stone Skin a Type Resistance % row;
- an **enrage**: "On Health Below 30%: applies Enrage to the enemy for the
  fight" (−50 % Swing Time; the Queen Bee, the Wolf Alpha below 50 %).

On a monster's own rule "the enemy" is that monster and "the hero" the hero it
fights; "itself" is the monster. Enemies read flat and percentage Damage and
Swing Time from the effects on them, as heroes do. A fight moment spends no
charge and has no cooldown; a move says its effect's name over the enemy.
The QA panel's Statuses and boss moves section sets up a Venomous goblin, a
burning imp and a four-move warlord, with a live readout of the statuses.
*(`board/FightMoments.js`, `combat/FightHooks.js`)*

### The combat screen — Built (brief 220 C6)
What a player sees of a fight (owner's picks from the mock-ups, 2026-10-24/25).
Statuses are not drawn on the board.
- **On the mat** (owner's pick F, the reduced plate, 2026-11-05; brief 360
  C3): **no plate** under a fight. Over each fighter a small edition of the
  hero bar's health bar, its fill in the same green, amber and red on a
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
- **Floats** rise over the middle of each fighter, just under the bar, and
  are gone in half a second: white on the enemy (on the strike frame of the
  hero's swing), red on the hero, "Miss", a big number under a gold "Crit!",
  green heals (a meal, or a rule's heal on either side), and Venom and Burn
  ticks in red with a drop or a flame. The hit's types, "Weak!" and
  "Resisted" are the fight window's and the log's. Two at once on one fighter
  stack downward.
- **The QA panel's Combat screen section** sets up a crowd of seven fights
  below the Guild Hall, to judge the motion of a busy mat and see the fights
  that would cover one another step apart as their heroes arrive.
- **The fight windows** (owner's picks, 2026-11-05: window B "the slim card",
  tab D "faces and bars"): one window per hero, opened by the fight button
  between the two bars, several open at once. A
  window **belongs to its hero**: it shows whatever they fight next ("Kira vs
  Goblin" becomes "Kira vs Wolf") and the last result between fights (Won or
  Lost in its title bar), until its X or Escape closes it (Escape closes the
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
  fighting another style shows its own beside its level; hit with its types, before the other side's resistances and the matchup:
  the player does the sums; swing; resistances and weaknesses, the enemy's as
  they stand in the fight); the **enemy's attacks**, each with its type in a
  small tile, the last one marked "just used" in gold, and its kinds once
  fought; **what is on each fighter** in two columns (statuses with stacks,
  lingering effects with a gold star); the hero's **elixirs** with the fights
  each has left; and the **log**, closed until asked for, holding the whole of
  this fight and the last one ("This fight" / "Last fight", newest first, at
  most 400 lines a fight). **Minimize** puts a window away as a **tab** (only
  a minimized window has one): the hero's face, both names (the enemy's gives
  way to Won or Lost between fights), both health bars with their numbers,
  the enemy's face, in a strip along the mat's foot above the hero bar from
  its left; clicking it brings the window back where it was. ⚠️ Nothing
  redraws faster than its fight changes (T-198): a window draws again only
  when its fight's record changes, a minimized window draws nothing, and a
  tab only when a name, a health or the result changes. A fight is one enemy
  engaged: each kill starts the next. The log is kept in memory per hero and
  never saved.
- **The enemy card** shows by the pointer resting on an enemy: level, style,
  health, hit, swing, its resistances and weaknesses and its moves (from the
  start), and its kinds once the guild has fought one ("? fight one to learn"
  before).
- **"While you were away"** says the fights as news, only each enemy beaten
  with its kill count (brief 440); knock-outs lead the news column. Fights won
  and lost, food and elixirs used and drops are not listed (what was used and
  dropped is in the item list).
- A catch-up records and draws none of it (every listener is a UI listener);
  a fight still running after one is picked up at its next event, or when its
  panel opens. Placeholder icons are drawn in code (`owner_art_list.md`). The
  QA panel's Combat screen section sets up two fights and an enemy nobody has
  fought, and plays 20 minutes away.
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
  Kill, On Engaged, On Tick, On Bank Holds…, the three fight moments: On
  Swing and On Hit, each "every Nth", and On Health Below X % once a fight,
  and **On Work Start**, a carried item's own: below),
  **4 roles** (itself, the hero, that Token, the enemy), **5 filters**,
  **4 reaches**. On Tick fires every 3 s. A fight moment runs only Applies,
  Deals, Heals and Removes (the editor offers it to no other verb), spends no
  charge and has no cooldown.
- **Modifiers** that neighbours (or a hero's items) provide: yield, work
  time, input cost, **grow time** (a growth or a refill's rest, from neighbours
  and Region rules only), **crop load** (the harvests a Field's crop ripens with:
  a Composter, §3 Farming; read once as it ripens), XP bonus (a positive bonus always adds at least 1 XP),
  double loot, **double item chance** (a chance
  that one named item, when a cycle or a kill drops it, comes out doubled: the
  Cleaver's Raw Beef), **catch weight** (a percentage on one fish's weight in a
  water's catch pool: a better rod's bonus, §3 Fishing), fail chance, **camp reach** (a camp's,
  as a percentage) (Tokens); **wound time** and **loadout slots** (guild-only: read from
  Guild Hall stars, §8, never offered on a Token or item); accuracy,
  damage, **dodge, crit chance**, **Type Damage %** (the bearer's hits of a
  type or group, or every type: "Poisoner's Cloak: Poison 15"), **Type
  Resistance %** (hits of that type the bearer takes; negative is a weakness;
  a group's row counts on each of its types), **Sunder** (points off every
  resistance the bearer has, never below 0: put on a status), status immunity
  and **status stack limit** (one status effect stacks at most N lower or
  higher: the Hide Vest's Venom −1; at 0 it cannot land), **swing time** and
  **food healing** (percentages, on a lingering effect: an enrage, Burn)
  (heroes, and enemies through effects on them). Most combat rows are flat
  amounts, and a new rule on one starts flat. **Retired**: Block (a miss is
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
  ("Iron Chestplate: Physical resist 20 %; Magic damage −30 %"); a Type
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
  and **Thorns** (1 damage to the hero on finishing a Redberry Bush or Thorn
  Elemental). **Everything else in the grammar is Latent.**
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
  Grow Time for a vein's rest or a tree's regrowth, Camp Reach; the guild-only Wound Time
  for the Infirmary, Loadout Slots for one more of a loadout kind, and Lap Time for the
  Passive Production lap), and **lines** of
  Passive Production the Hall pays each lap beside the Wishing Well's Water. The sky grows to
  hold its constellations and is dragged when it does not fit.
  *(`guildUpgrades.js`, `hallStars.js`, `progression/HallRules.js`)*
- **Ring stars** (brief 380 M4): a star whose `opensRing` names a ring of the world map lets the
  guild settle that ring once its first rank is bought. Ring 1 is open from the start; a star per
  ring from ring 2, the wild rings too, each linked to the one before so they light in order. A
  ring no star opens is left open (the ledger's checks F say so). Its sentence says it opens the
  lands past the next border (no ring numbers for the player) and it wears a map's outline. The
  stars themselves are content, a change pack (`2026-11-06-ring-stars`: the Compass, five stars
  left of the Hall past the Vault, priced by the ledger). *(`world/ringStars.js`, `Settling.js`)*
- **The sky's look** (brief 390): stars spread 1.4 times their authored places apart, each with
  an item's outline over it (by the star's kind, or the star's own `outline`), its title under
  it and its rank only under the pointer; the web runs on under the nav and the details panel.
  The **details panel** (purple frames) gives a star's name, one sentence of what it does (built
  from its rules), its rank, what it gives now and next and at its top rank, its price as item
  ribbons with have/need, and the Upgrade button. The Hall star's **Effects** list the outputs
  each lap and, as boosts, the lap itself ("Outputs arrive once a lap: every 10:00", the live
  lap) and every other rule held (a Lap Time rule is said by the lap's line).
  *(`GuildHallBoard.jsx`, `hallStarOutline.js`, `GuildUpgradeInspection.jsx`, `hallStarText.js`)*
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

- **Quests are Tokens** beside the Hall; click a finished one to claim its
  reward as loot. *(`src/systems/quests/`)*
  - **Tutorial** (the cartographer's, `tutorialQuests.js`): 11 steps, one at
    a time (the first hero exists from the start, so there is no recruit step):
    equip a Woodaxe, **send your hero to a tree**, gather,
    collect loot, buy a Foundation, build a station, craft, **build a first
    camp** (a Logging Camp on a Wood Foundation; any camp counts); then the
    Starter Camp's end, **make a first tool** (copper, the camp's metal) and
    **beat a Goblin**; then the last step, **settle your first place**: it
    arrives with the cartographer opening the world map, his words heading
    its inspection panel, and is done when a place of the world map is
    settled (brief 330 W3).
  - **Bounties**: random "collect N items" or "defeat N Goblins", each paying
    10 Oak Wood (*placeholder*). Cap 2 (the Notice Board star retired with brief 320); a
    new one every 3 min of game time. A bounty with no room to land beside the Hall is
    missed, and the next comes 3 min later, as a spawner's missed spawn does. A tutorial
    step with no room arrives as soon as something on the mat moves, leaves or arrives.
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
  a knock-out, the Bank refusing items or a save problem
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
  over that hero for about 3 s (what was equipped, or why not, with the numbers). Click →
  **hero sheet** (loadout grid, every skill two side
  by side as icon, level and XP bar; hover for its name, purpose and perks, click for its exact
  XP and rate; scroll arrows when it does not fit; close and edit in the side space beside it,
  down to the bar) → Edit (rename, portrait, flag colour). The Shop and the hero sheet close
  each other: one panel over the bar at a time.
- **Bank drawer**: tabbed item lists, search, reorder; drag an item onto a hero
  on the hero bar to equip. While open, the mat is locked; the hero bar stays in front of it.
- **Shop**: a panel that rises from behind the hero bar beside the nav (on either side) and
  stands on it, the bar in front, with a row of same-size cards (name, the Token large, its skill
  icons, the price as up to four have / need pills; arrows left and right when the
  row is longer than the screen). Drag a card onto the mat to buy; the panel drops
  to a lip while you carry it over the mat, rises again over the panel (a drop
  there is a cancel), and stays open after a purchase. A card you can't afford
  dims its Token and shows the short counts in red; a full Token cap says so on
  the card. Hover a skill icon for its name, a card for what it builds.
  *(`ShopPanel.jsx`)*
- **Guild Hall view**: the upgrade web, Hall effects panel, upgrade inspector.
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

- **Game time** drives everything (cycles, spawns, quests). A tick is clamped
  to 1 s; longer gaps are caught up.
- **Offline progress** — **Built (brief 40)**: time away from a closed game or
  a sleeping PC (up to 24 h; the rest is dropped) is played by the real engine,
  sped up, behind a loading bar, then a "While you were away" summary. Gaps
  under 2 minutes (a background browser tab) are played quietly. It replaced
  the Time Bank, which is gone. **Nothing goes missing (brief 430)**: the
  catch-up keeps its bus quiet, so it hears the news itself (recipes unlocked,
  first finds, the Bank refusing items, knock-outs; `catchUpNews.js`, only
  reading, so the game plays the same) and the summary lists them in sections
  of their own (a section with nothing is left out); when it closes they
  arrive as live play would show them, merged: one banner per kind and at
  most six gold "New!" stubs, with their sounds. A gap with no summary shows
  them at once; "Load as I left it" shows none.
- **The summary** (brief 440): the heading centred ("While you were away",
  "You were away 32 min"), then **two columns**, each scrolling with our arrow
  bars. **Left, the items**: each item once with its **net** change, green +
  or red −, gained and spent on hover. The net is the Bank and the mat
  together (loot carried from the mat to the Bank while away counts once), and
  an item with more lying on the mat than before carries a small mat mark,
  its hover saying how many. **Right, the news**, in this order: knock-outs
  (with the gear lost), tools and weapons that broke (each with the hero who
  stopped, §5), the Bank refusing items, new recipes, first finds,
  level-ups, Tokens used up, the fights (each enemy and its kill count). An
  empty column says so in one muted line. **Both buttons ask first**: Return
  to the Guild (plain wording, nothing is lost; Esc asks the same) and Load
  as I left it (everything from the time away is lost); the banners come
  after Return is confirmed.
- **Saves**: 3 slots with a one-step backup; autosave every 10 min by default
  (10 min, 1 h or off; 1 min in dev builds only). **In the desktop game each
  save is a file** (brief 450 S3): `slot1.json` to `slot3.json` and their
  `.backup.json` in `%APPDATA%\com.fantasyguild.game\saves`, read when the slot
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
  that stays the policy **until 1.0** (owner 2026-10-06). A new game is saved
  immediately.
- **Regions** — **Built** (Atlas slice A1; on screen in the Atlas): the save holds
  every Region the guild has settled (`state.atlas`); the mat is the board of
  the Region the guild is in. **Only that Region runs**, offline catch-up
  included; every other Region is frozen exactly as it was left. A new game's
  opening mat is the first Region, the Starter Camp. **Travel** banks the loot
  on the floor (what the Bank cannot hold stays on that Region's floor), takes
  the Guild Hall and the quest Tokens along (the Hall lands in the middle of a
  Region it has never stood in, and back in its old spot in one it has), and
  leaves each Region's flags behind: going back, every hero starts at the flag
  they left there, with no work claimed and no fight on; a place just settled
  starts with no orders, its heroes walking in to the Hall (§10, the arrival). A settled place's panel on the world map shows
  its Region (its mat drawn small, its facts) and renames it; travel is its
  Travel button. Archive and abandon have no button since the Regions page
  left (brief 380 M3); the engine keeps them. *(`src/systems/atlas/`)*
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
  the panel.
  **The inspection panel** (thin, on the right) shows the chosen place's name,
  the guild's flag drawn large where it is, what it yields and its price, and a
  large **Settle** (frontier only, greyed with what is short or the ring star it
  waits for; settling refuses that ring until the star is bought), which pays the
  whole price at once, writes the cell's Region and takes the guild there; a
  settled place shows its mat drawn small, its facts, a rename, and **Travel**.
  A Region knows its
  cell (`region.cellId`); abandoning it returns the cell to the frontier.
- **A place's mat** — **Built (brief 330 W3)**: settling writes the Region from
  its cell (`world/cellMat.js`). **The kit** (Highland, Woodland, Plains,
  Wetland, Riverside) gives each skill its share of natural work in heroes (a
  hero is about five veins, four trees, three crops or herbs, two waters or one
  camp), on its own ground (mountain, forest, meadow, bog, coast) with its own
  Stone outcrops; a skill's Tokens are the cell's own origins of it, else the
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
  further out, sometimes a boss), spread out across the mat, one to each even
  share of the circle round the Hall turned by the place's seed, out of the
  Hall's clearing, clear of the heroes' way in below it and short of the mat's
  margin, one use each and tied to no camp. They stand still until a hero is sent at them: no fight starts by
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
  saves with the Region. The QA panel's Atlas section settles a fixture place
  of each kit for free, beats its arrival at once, and jumps the tutorial to
  its last step. *(`world/cellMat.js`, `world/cellRegion.js`, `world/Arrival.js`,
  `board/Occupation.js`, `HeroMotion.walkIn`)* The tables are placeholder
  until the CMS syncs `data/world.json` (W6). A save made before worlds has
  none: the world map says so. The QA panel's Atlas section meets the
  frontier's prices at a click (with the price of a ring star a frontier cell
  waits for, to buy in the Hall), puts the ring stars' pack in the sky until it
  is synced, and shows a world in words. *(`src/systems/world/`,
  `worldTablesShape.js`, `ui/components/atlas/WorldScreen.jsx`, `WorldMap.jsx`,
  `WorldPanel.jsx`, `WorldCamera.jsx`, `worldPicture.js`; the art it reads,
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
- **Dev tools** (dev builds, or a perf build with Debug Mode on; shipped builds have none): QA panel (give
  items, advance time, hire heroes, …), **Mat Tuner** (mat size, Token cap,
  quest cap, radii, speeds — stored per device, not in the save), FPS counter.
  Dev build only: the **Perf HUD** and stress boards (`?stress=realistic`), and
  the **Starter Camp** tools (place any Token, move and remove landmarks, save
  the mat to the CMS).
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
- **Latent** (code ready, no content): gear, statuses, ranged/magic enemies,
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
| **Near / reach** | 164 u centre to centre; how far a rule carries. |
| **Spawner, family, allowance** | A Token that makes Tokens; the types it makes and what they grow into; how many it allows alive. |
| **Upkeep** | Items a spawner (or rule) pays to keep running. Unpaid = it waits. |
| **Passive Production** | Free items the Hall drops once a lap, 10 minutes shortened to 5 by a Guild Hall star (formerly "trickle"). |
| **Foundation** | A placed Token built into a station by choosing a build recipe. |
| **Station** | A Token whose work is a recipe the player picks. |
| **Context Token** | A tool or support Token used by nearby work. |
| **Order / job** | Where the player sent a hero: a Token (they work only it), a camp (they work its kind of Token in its reach), a spot (they wait there) or home. |
| **Job flag** | The small flag in the hero's colour marking their job, behind the top-left of the job's Token (or on the spot). Dragging it gives the hero a new job. |
| **Camp** | A Token built on a Foundation that names a skill and a reach: a hero sent to it works every Token of that skill in its reach, one at a time. An enemy camp is a spawner of enemies; a hero sent to it hunts them. |
| **Needs a job** | A hero whose job's Token is gone for good, waiting where it stood for a new order. |
| **Rules (Token) / effect / statement** | A Token's behaviours, written as sentences in the CMS. |
| **Bank** | The guild's item store; one slot per kind. |
| **Loot** | Items lying on the mat, collected by hovering. |
| **Perk** | A skill's milestone reward at a set level (10, 25, 50…), held by every hero at or above it, read off their levels. |
| **Damage type / group** | What a hit is made of: nine types (Slash, Crush, Stab; Fire, Ice, Electric; Poison, Light, Dark) in three groups (Physical, Elemental, Special). A weapon has one; a bow shot has two (bow and arrow). |
| **Resistance / weakness** | Percent off (or onto, when negative) hits of a type or group. An enemy's come in fixed steps (25/50/100, weak 25/50), a type's line replacing its group's; gear's are free small numbers that add. |
| **Damage cut** | Percent off a hero's own hits in a named style while wearing a piece (metal cuts Magic and Stealth): every gear piece's trade-off, shown red. |
| **Arrow** | A consumable a Ranged hero carries; one is spent per shot and adds its own damage in its own type. Without arrows the bow shoots its own part alone. |
| **Off-hand item** | A hand item that is never swung (a shield, a quiver): it lends its resistances, cuts and rules like armour. A second weapon lends nothing. |
| **Move** | One of an enemy's attacks, picked at random each swing: a hit in its own type, an effect on itself or the hero, or both. No moves = a plain Physical hit. |
| **Venom** | The stacking damage-over-time status once named Poison (Poison is now a damage type). |
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
| Drops over a drawer | A mat Token or flag dropped over the Shop panel or the hero sheet lands on the mat underneath; intended (owner, certification 2026-10-07). |
| Token cap | 128, fixed (the Guild Hall's Token Cap star retired, brief 320); spawned Tokens and endgame sites count (D-1); the discard bin is gone (Atlas A3b), so nothing off the mat counts. |
| Trickle | Renamed **Passive Production**, one timer; the Wishing Well joins it, 10 Water a lap per rank (T-099). The lap is 10 minutes, shortened to 5 by Guild Hall stars (owner 2026-11-03, brief 390 G5). |
| Markets | **Cut for now**: items stay the only currency, no exchange rates; revisit if a real need appears (owner 2026-10-09, T-127). |
