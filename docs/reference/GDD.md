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

1. **The mat is a living place.** Things grow, spawn, transform and wander.
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

**Long-term pull.** Exploring new Regions through the Atlas (§13): set up a
Region, exhaust it, move the guild to a better one. **The Atlas is not built.**
Today the pull is skill levels, Guild Hall upgrades and promotions.

---

## 2. The core loop as built

1. **A new game** opens in the **Starter Camp** (Atlas A7): the Tokens, their
   points and the opening Bank the owner laid out in a dev game, saved with the
   QA panel's Save this mat as the Starter Camp, reviewed on the CMS's Starter
   Camp page and synced into `data/starterCamp.json`. Until one is synced it is
   the built-in camp: the Guild Hall in the middle of the mat, an Oak Forest and
   a Copper Mine either side (320 u away), and 3 Oak Seed, 10 Oak Wood and
   2 Wheat Seed in the Bank. There are **no heroes** (`ROSTER_BASE = 0`).
   *(`StarterCamp.js`, `EngineBootstrap.createDefaultGameData`)*
2. **Recruit** in the Guild Hall: the first Bunk Beds rank is free and
   generates a Recruit immediately. The tutorial's first quest asks for this.
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
  (hitbox 90 % of the art radius, up to 40 % overlap); breaks no `Cannot` rule.
  *(`MatPlacement.js`)*
- **A player drop never pushes anything.** Arrivals (spawns, growth, builds)
  may push **spawned** Tokens aside; **placed Tokens are never pushed**.
- **Fixed Tokens** can't be dragged or pushed: a map's node, a Starter Camp
  fixture, a landmark, a planted Token (spawned into a growth chain), and every
  copy of a type marked **Stays where it stands** (`staysPut`, a box in the CMS
  Token editor: trees, fruit trees and veins), wherever it came from, an old save
  included. Demolition still takes any of them but a map's node (unless its type
  can be cleared: Demolition below), the camp's and a landmark. *(`FixedTokens.js`)*
- **Token cap: 128 Tokens** to start (owner, Atlas D-9: a Guild Hall upgrade
  will add 16 a rank, up to 256; not built yet). The cap is the guild's but
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
- **Disallow mode** (top bar): click Tokens to forbid hero work on them.
- **Terrain** (the ground under the Tokens) is **Built** (brief 80): each Region's stored cell map
  drawn as pixel ground, one look per terrain per Region, meadow where a Region stores none (the
  Starter Camp). Static: nothing on the mat changes it. *(`TerrainCanvas.jsx`)*

### What a Token is — Built
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
  family's cap. Every other spawner, enemy camps included, keeps the mat-wide
  count. No shipped spawner uses it yet.

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

| Foundation | Price | Builds |
|---|---|---|
| Wood Foundation | 15 Oak Wood | Workbench, Cooking Pot (5 Oak Wood each) |
| Stone Foundation | 10 Stone + 5 Oak Wood | Furnace (5 Stone), Fighter's Academy (10 Stone + 10 Oak Wood) |
| Farmland | 10 Oak Wood | Wheat Field (1 Wheat Seed), Apple Orchard (1 Apple Seed) |

### Fishing — Built (brief 230 S5); no content yet
Owner rulings 2026-10-24. **Water** is a Token with **catch pools**
(`catchPools: [{ tool, bait?, catches: [{ itemId, weight }] }]`, the CMS Token
editor's Catch pools block), one weighted pool per **tool kind × bait**; the
pool with no bait is the water's **basic** catch. One sprite per water type
(sea, river, lake) is content.
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

### Maps — Items (Atlas A5); no map content yet
A map is an item: a **Base Map** (type `map`) or a **Modifier** (type
`modifier`), authored in the CMS's Map editor and written into `data/items.json`
by Sync, so it banks, drops and pays out like any item. Its Cartography block
says what it writes: a Base Map has a biome, points, weighted nodes, its own
enemy camps and treasures, and its ground (each biome its own look and water:
meadow, forest, mountain, coast, flower meadow, cherry grove, Yellowstone,
volcano, and the **Bog**, dark grass and mud with a marsh of many small ponds;
`Budget.js`, `terrainRegistry.js`); a Modifier has effects (more of a
node, a better node instead, an enemy camp, a treasure). The generation engine
reads it (`systems/atlas/mapItems.js` → `Budget.js`); inspecting one in the Bank
lists what it writes. Settling a Region takes the slotted maps from the Bank
(`Cartography.js`). A claimed bounty pays a map 25 % of the time, drawn at the
claim, weighted by each map's bounty weight. A Base Map ticked **Given by the
tutorial** is one of the first maps the tutorial pays. The simulator prices no map. Map
bursts, the Map shop, the Explore skill and the old Map catalogue
(`data/maps.json`) are retired; the last Map Token, **Volcanic Island**, does
nothing and is the owner's to delete in the CMS.

---

## 4. Heroes

### Roster — Built
- Heroes come from the **Bunk Beds** Hall upgrade: each rank adds one hero,
  **max 8** (`ROSTER_MAX`). Rank 1 is free. *(`guildUpgrades.js`)*
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

- A hero can only do work for a skill they **hold**, at a high enough level.
- XP comes from work cycles (the recipe's or Token's `xp`) and kills (into the
  style the hero fought in: their weapon's, Melee barehanded). Level cap 99; XP to level 99 ≈ 13 million
  (RuneScape-style curve, `XPCurve.js`).
- A skill level gives no work speed: a cycle takes its authored time whoever works it (owner 2026-10-09, T-125).
- **Hero level** = the average of held skills (display only).
- **Content that still says `logging`** (data/ and the CMS workspace, until the
  owner's next Sync) is read as `forestry` as it loads
  (`skillIdMigration.js`, to be removed under T-114). Content naming a skill or
  job that does not exist is listed by the boot audit and the CMS Economy
  Audit.

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

### Jobs and promotion — Retired (brief 270 K1)
Jobs, promotion, Promotion Tokens, the Change Job planner, banked skills and
Mastery are gone: **if the skill is high enough, the hero can do it**
(`concept_classless_heroes.md`). A Token's Promotes rule does nothing; it still
reads as it did, the CMS no longer offers it and marks it retired, and the
audits name the Tokens carrying one (the Fighter's and Wizard Academies, for the
owner to delete). An older save keeps every level: banked skills come back onto
the sheet, the job and cut skills are dropped. Milestone perks (K4) take
promotion's place as the milestone.

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

### Equipment — Partial
A 3×3 loadout grid with category caps (hand 2 — two hands: a tool takes one,
a two-handed weapon both — hat 1, chest 1, trinket 2,
food 1, drink 1, consumable unlimited). Gear, weapons and tools are one copy
per hero: equipping takes the copy out of the Bank. **Bait** for fishing is
carried in a consumable cell and spent from the Bank, one per catch (§3,
Fishing).
- **A weapon** is anything held in the hands that is not a gathering tool. It
  names **one style** (`styles: ['melee']`; an older list of two, the Dagger's,
  fights in its first and the audits say so), its **damage** and its **speed**
  (fast 2 s, normal 3 s, slow 4 s). **The weapon decides the style**: any hero
  may hold any weapon, and fights in its style. A weapon naming no style is
  Melee. Older content's single `skillRequired` style is read as its style.
- **Level requirement** (K1): a weapon may ask a level in its own style
  (`levelRequired`: "Iron Sword: Melee 15"); armour and trinkets name the style
  (`skillRequired`) beside the level. Equipping below it is refused, "Needs
  Melee 15". Gear held below its level (an older save, or a level added later)
  stays in its slot, lends nothing, and a weapon is not swung. A second weapon
  in hand of another style than the one swung lends nothing either.
  *(`weaponStyles.js`, `EquipmentValidator.js`)*
- **A family's ability is a Rules effect on the item.** Every tier of a family
  points at the same library effect (a "Spear" effect: Provides 1 more Pierce),
  each with its own **scale** (copper 1, iron 2…), so the tier raises the
  number. Armour carries its stats and abilities the same way (Provides Armor;
  a Hide Vest: Poison stacks at most 1 lower). An ability may touch anything
  the grammar reaches, work included (a Cleaver's chance to double Raw Beef
  works on a kill and on a work cycle alike).
- **No weapon or armour ships yet** (`items.json` has tools, food, drink,
  materials, maps and one potion); the first come as a CMS change pack (brief
  220 C0).

### Orders: how heroes get work — Built (the heart of the game)
Heroes do not choose their own work: **the player sends each hero to a job by
dragging them** (hero orders, brief 260; owner 2026-10-28: one hero, one job,
less micromanagement than area flags).
- **Heroes live on the mat.** One with no job waits in a row in front of the
  Guild Hall. The hero bar is the roster: it finds a hero on the mat, opens
  their sheet, says Idle, Busy or Hurt, and can be dragged from.
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
  shows its **reach ring**.
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
  **64 slots + 32 per Bank Slots rank; 1 tab + 1 per Bank Tabs rank.** When
  there's no slot for a new kind, it stays on the mat as loot. *(Inventory)*
- **Supply is automatic**: Tokens take inputs from the Bank, then from loot on
  the mat. A cycle is all-or-nothing; first come, first served.
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
  5-minute timer pays every line at once, dropped as loot beside the Hall:
  1 Oak Seed, 1 Wheat Seed and 1 Apple Seed (*placeholder*; the CMS block is
  still called `trickle` in the data), plus the Wishing Well's Water.
  *(`PassiveProduction.js`)*
- **The Shop** sells 10 Tokens, all available from the start; price is the
  only gate (*placeholder* prices): Oak Forest, Coast, Farmland (10 Oak Wood
  each), Copper/Coal Mine and Quarry (15 Oak Wood), Wood Foundation (15 Oak
  Wood), Stone Foundation (10 Stone + 5 Oak Wood), Copper Anvil (5 Copper
  Ingot), Goblin Camp (10 Stone + 10 Oak Wood). *(`Shop.js`)*

---

## 6. Combat and enemies

### Enemies — Built
Enemies are Tokens with `enemy: { level, style, kinds?, hostile? }`. **The
level fills every number from the level table**: HP 20 + level, a hit of 1 + 1
per 20 levels, 1 armour per 30 levels, a swing every 3 s, XP 10 × 1.065^(level
− 1), no Dodge, Accuracy or Pierce, a 5 % crit (the table and its worked
duels: `concept_combat.md`, "The level table and weapon tiers").
- **Kinds** (none, one or two, CMS presets the player discovers by fighting):
  **Armoured** +2 armour and slow (4 s, same hit); **Nimble** +15 Dodge;
  **Swift** a swing every 2 s at 2/3 of the level's hit; **Brute** a swing
  every 4 s at 4/3 of the level's hit and at least 1 more; **Venomous**
  lands a stack of the **Poison** status on the hero with every hit that
  leaves them standing (the library's `effect_poison`; without it the kind
  poisons nobody and the content check says so). Swift clashes with Armoured
  and Brute (both set the swing); the CMS refuses the pair.
  Kinds never change HP or XP. *(`enemyKinds.js`)*
- **Order**: the level table (older content's `budgetScale` multiplies its HP,
  hit and XP, rounded halves up, at least 1), then each kind in the order
  ticked (hits rounded halves up, at least 1), then **any number written beside
  the level** (`hp`, `hit`, `armor`, `speed` fast/normal/slow, `xp`, `dodge`,
  `accuracy`, `pierce`, `critChance`) **replaces the result outright**. The
  CMS shows every number filled from the level and kinds, greyed "from level",
  until the author types one ("yours", with a button back).
  *(`enemyProfile.js`)*

4 ship, **all melee**, none with a kind:

| Enemy | Level | HP · hit · armour | Hostile | Uses | Drops |
|---|---|---|---|---|---|
| Goblin | 1 (×0.3) | 6 · 1 · 0 | yes | 1 | Bones, 30 % Copper Ore |
| Goblin Chief | 3 (×0.6) | 14 · 1 · 0 | yes | 2 | 1–2 Copper Ingot, Bones, 25 % Beeswax Comb |
| Cow | 1 | 21 · 1 · 0 | no | 100 | Bones, 50 % Raw Beef |
| Thorn Elemental | 1 | 21 · 1 · 0 | no | 100 | 1–2 Blackberry |

- Goblins come from the Goblin Camp; enemies potter within 128 u of their
  spawner at half of 90 u/s and walk back if moved.
- **Hostile** enemies ambush a hero **sent to work a Token** inside the camp's
  watch (240 u round their spawner, a Mat Tuner row); the hero fights back,
  barehanded if their hands are empty, then goes back to their job. A hero
  sent to a spot on open ground is never ambushed, however near a camp (owner,
  2026-10-28).
- **Boss** (`enemy.boss: true`, a CMS tick): fights only the heroes sent at
  it. Never hostile (the Hostile box greys out), never made by a rule, so it
  never ambushes. Comes from a camp of its own or a Summoning Circle
  (Encounters, below). Boss moves will hang on this mark.
- Each kill uses one of the enemy's uses; at 0 it's gone. Otherwise it
  respawns at full HP after a 2 s pause.
- **First kill always drops**: a drop line ticked so in the CMS (an enemy's
  Drops) lands for certain the first time the save kills that enemy type, then
  at its own chance. The save remembers each type paid
  (`collection.firstKillDrops`); a save from before the record has been paid
  nothing, whatever its kill counts. Time away pays it as live play does.
  *(`combat/firstKill.js`)*

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
  camp. The boss or guardian potters by its camp; a Base Map brings one by
  listing the camp Token under its camps. The camp's clock stands at zero
  while the camp is full, so a beaten boss or guardian comes back one whole
  interval after it falls (§3, Spawners).
- **A guardian** is simply a tough enemy whose camp stands by a rich node. It
  blocks nothing; if its type is hostile it attacks whoever is sent to work
  nearby (the watch around its camp, as any hostile enemy).
- **A Summoning Circle** is an ordinary station whose recipe uses up a
  summon item (its input) and makes its boss beside it (a Token output). It
  works as a Starting skill, so any hero may work it (it becomes the
  Summoning skill's station when the specialist skills are designed). Its
  recipe is picked once, as any station's. Without the item it waits ("needs"
  the item, the usual yellow mark); with several in the Bank it calls one per
  cycle while a hero works it. A boss it called is gone once beaten.
- **Node ambushes**: a Token's `Spawns` rule that puts an enemy beside it is an
  ambush (a chance on a finished cycle, about **2 %**, is the usual shape; set
  per Token in the Rules line). The enemy attacks the hero the moment names (the
  one who finished the cycle) on the next tick, hostile or not; that hero
  fights back whatever their order says, then goes back to work. An
  ambusher is beaten in one kill, and while it stands its node springs no
  other (its rules roll nothing). With no hero named it waits by its node
  (hostile ones watch around it). Never a boss.
- **Enemy camps** are spawners; a hero sent to one hunts what it spawns (§4,
  Orders). Lure buildings are parked.
- **A beaten enemy**: the hero who beat it says "{enemy} Beaten" (a Token used
  up says "{token} Depleted").

### The fight — Built
- **Swings.** A hero swings at their weapon's speed: fast 2 s, normal 3 s,
  slow 4 s (barehanded: 3 s). The weapon swung is the first in the hands the
  hero may hold (its level met); its style is the hero's for the fight. An enemy swings at
  its own speed (3 s unless a kind or the author says otherwise).
- **Damage is fixed**: the weapon's damage (a fist is 1) + 1 per 20 combat
  levels + flat Damage from gear, times any damage buffs and the matchup,
  rounded halves up. No spread.
- **Misses**: 10 % at an even level, 1 point less per level the attacker is
  above the defender (more when below), that part kept between 5 % and 25 %;
  then + the defender's Dodge − the attacker's Accuracy, kept between 5 % and
  40 %. Both sides roll the same way.
- **Crits**: 5 % (gear adds Crit Chance), doubling the hit **before** armour.
  Enemies crit at 5 % unless authored.
- **Armour is flat**: each point takes 1 off every hit, which always does at
  least 1. **Pierce** ignores that many armour points. Flat Resistance comes
  off after armour.
- Every percentage rounds to the nearest whole, halves up.
- **Barehanded is a Melee punch**: 1 + the Melee level step, every 3 s, on the
  melee side of the cycle, earning Melee XP. A hero's level for the damage step
  and the miss gap, both ways, is their level in the style they fight in.
- **A four-way cycle: melee > ranged > magic > stealth > melee**: +25 %
  damage for the favoured side, −25 % for the other (a 2 becomes 3, or stays 2).
  Opposite pairs (melee and magic, ranged and stealth) are even, so each style
  has one good matchup, one bad one, and two even. A hero fights on their
  weapon's side (Melee barehanded). An enemy's Style is one of the four combat skills (the CMS dropdown
  follows the skill registry). Every shipped enemy is melee.
- **No regen in a fight**: below 25 % HP the hero eats food instead of
  swinging; drinks never heal. Elixirs are drunk as a fight starts
  (section 4).
- Each swing draws one random number for the miss and, on a hit, one for the
  crit, from the game's random stream in a fixed order, so a catch-up replays
  the same fights as live play.
- Kills give XP to the style fought in (the weapon's) and count as a work cycle for
  neighbour rules. Loot drops on the mat, through the same yield, double-loot,
  double-item (a Cleaver's) and bonus-drop rules as a station's output (T-017).
  A double-item chance draws one random number per item it names that landed,
  and none when nothing offers it.
  *(`FormulaRegistry.js`, `CombatFormulas.js`, `src/systems/combat/`)*

### Status effects — Built, no content yet
- **A status is a library effect with a status block** (`status: { stacks,
  ticks }`, the Status section of the CMS Effect editor): each landing adds a
  stack up to `stacks` (1 = it does not stack, landing again renews it), its
  rules count once per stack, and it lasts `ticks` ticks, or the whole fight
  at 0. What it does each tick is an ordinary On Tick rule ("deals 1 damage to
  itself, ignoring armour"); what it changes while carried an ordinary
  Provides (Burn's −50 % Food Healing). *(`LiveEffects.js`,
  `effectLibrary.statusBlockOf`)*
- **Statuses are fight things**: one lands only on a fighter (a hero in a
  fight, or the enemy), and **every status ends with its fight**: the kill, a
  knockout, the hero leaving, a load. No hero falls to poison on the way home.
- **One Rules tick every 3 s** for every lingering effect, statuses included
  (heroes in roster order, then each fight's enemy). A tick that knocks a hero
  out is a defeat like any other (one banner, one gear roll); one that
  finishes the enemy is a kill before it swings again.
- **The first two** (the owner's numbers): **Poison** stacks to 3, 1 damage
  per stack per tick until the fight ends; **Burn** does not stack, 1 a tick
  for 3 ticks, and food heals half while it burns. Bleed, Stun and Shield wait
  for a later pass; Well Fed and Cookout go with the drinks.
- What a fighter carries moves them: **Status Stack Limit** (a Hide Vest:
  Poison stacks at most 1 lower; at 0 it cannot land) and **Status Immunity**
  name a status effect. A cap lowered mid-fight never strips stacks carried.
- What lands them: the Venomous kind, and any rule's Applies on either side
  (a weapon's "On Hit: applies Burn to the enemy", a boss's status attack).
- **None ship**: the combat content pack authors Poison (as `effect_poison`,
  the id Venomous names) and Burn. An older save's statuses (the old status
  engine's, which outlasted their fights) are dropped on load.

### Boss moves — Built, no content yet
Any enemy can carry rules on the three **fight moments** (§7): **On Swing**
(every Nth swing, before it is rolled), **On Hit** (every Nth landed hit,
after its damage) and **On Health Below X %** (once a fight). The first moves
are ordinary rules on them:
- a **heavy strike**: "On Every 4th Swing: applies Heavy Strike to the enemy
  for the swing" (Heavy Strike: +100 % Damage, so that swing hits double);
- a **status attack**: "On Every 3rd Hit: applies Burn to the hero";
- a **heal or +2 armour**: "On Health Below 50%: heals 10 health on itself",
  "…: applies Stone Skin to the enemy for the fight" (+2 Armor; no Shield
  status);
- an **enrage**: "On Health Below 30%: applies Enrage to the enemy for the
  fight" (−50 % Swing Time, or more Damage).

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
- **On the mat**: a thin health bar over each fighter with the number and the
  percentage above it ("17 · 57%", halves up; the same bar over a hurt or
  hovered hero and a hovered enemy); a wide number grows away from the other
  fighter. The **fight plate** stands in the work plate's place under the two
  fighters' feet: both styles with a divider, then the hero's working elixirs
  with the fights each has left, the one under way counted (a fresh dose shows
  10, its last fight 1; between fights, the fights still to come). Speech, callouts (a status landing, a boss move) and "used"
  bubbles over a fighter stand above its number and the chip, never on them.
  A small
  **crossed-swords chip** beside the enemy's bar, on its far side from the
  hero (the flag flies the other way), opens the fight panel.
- **Floating numbers** rise at each fighter's outer side, beside the middle of
  their art, and are gone in half a second: white on the enemy (on the strike
  frame of the hero's swing), red on the hero, "Miss", a big number under a
  gold "Crit!", green heals (a meal, or a rule's heal on either side), and
  poison and burn ticks in red with a drop or a flame. Two at once on one side
  stack upward.
- **The fight panel** opens over the mat beside the chip, one at a time (the
  X, Escape or a click off it closes it): the battlefield strip with both
  fighters at 1×, the hero on the left facing right, moving as on the mat
  (idle, one swing per real swing; an enemy without an animation sheet stands
  still: today every enemy but the Cow); the **versus card**, one shared icon
  column so each pair reads across: style and level, health, hit (before the
  other side's armour and the matchup: the player does the sums), armour,
  swing; the hero's elixirs and statuses (with stacks) beside the enemy's
  kinds (once fought), statuses and lingering moves; and the **log**, closed
  until asked for, holding the whole of this fight and the last one ("This
  fight" / "Last fight", newest first, at most 400 lines a fight). A fight is
  one enemy engaged: each kill starts the next. The log is kept in memory per
  hero and never saved.
- **The enemy card** shows by the pointer resting on an enemy: level, style,
  health, hit, armour, swing, and its kinds once the guild has fought one
  ("? fight one to learn" before).
- **"While you were away"** says the fights in one block: won and lost, the
  enemies beaten, the heroes knocked out, the food and elixirs used and what
  the kills dropped.
- A catch-up records and draws none of it (every listener is a UI listener);
  a fight still running after one is picked up at its next event, or when its
  panel opens. Placeholder icons are drawn in code (`owner_art_list.md`). The
  QA panel's Combat screen section sets up two fights and an enemy nobody has
  fought, and plays 20 minutes away.
  *(`ui/components/combat/`, `board/FightLayer.jsx`, `board/fx/fightFloats.js`,
  `board/HealthBar.jsx`, `hud/CatchUpOverlay.jsx`)*

---

## 7. Rules and effects (the statement grammar)

Tokens carry **named effects** from a shared library (`data/effects.json`,
22 effects). An effect is one or more **statements**, readable as a sentence:
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
  water's catch pool: a better rod's bonus, §3 Fishing), fail chance (Tokens); armour, resist, accuracy,
  damage, **dodge, pierce, crit chance**, status immunity and **status stack
  limit** (one status effect stacks at most N lower or higher: the Hide
  Vest's Poison −1; at 0 it cannot land), **swing time** and **food healing**
  (percentages, on a lingering effect: an enrage, Burn) (heroes, and enemies
  through effects on them). Most combat rows are flat amounts, and a new rule
  on one starts flat. Block is gone (a miss is the only failed hit).
- **The standard floor for speed-ups** (owner 2026-10-24, brief 230 S1a): every
  speed-up of a time (work time, grow time) stacks, but together they cut at most
  **80 %** of the authored time, one code constant (`loopConstants.MAX_SPEED_UP_CUT`;
  a CMS page for it is for a later ticket): five Minecarts at −20 % on a 10 s vein give 2 s,
  not nothing. A work cycle is still never under 1 s. A slow-down is never capped.
  *(`TileModifiers.floorSpeedUp`)*
- **Statuses** are library effects with a status block (§6): stacks, ticks,
  and an end with their fight.
- **Gear families**: a weapon or armour family's ability is one library
  effect every tier references with its own scale (1–5), so the tier raises
  the number.
- **Spawns and enemies**: an enemy a `Spawns` rule puts beside its bearer is an
  ambusher (§6, Encounters): it attacks the hero the moment names, is beaten in
  one kill, and holds the bearer's enemy spawns until it falls. A `Spawns` rule
  never makes a boss (the editor does not offer one; the content audit names
  one that does).
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
- **Upgrade web** (separate full-screen view): nodes unlock when linked to the
  Hall or to a bought node. Price: rank *n* costs 10 × *n* Oak Wood
  (*placeholder*), except the **Token Cap** and the **Cartography Table**,
  priced by the planes: ranks 1–2 in Oak Wood, Stone and Copper Ingots, ranks
  3–4 in Fir Wood and Iron Ingots (first-pass numbers), later ranks the
  placeholder. *(`guildUpgrades.js`)*

| Upgrade | Ranks | Effect |
|---|---|---|
| Bunk Beds | 8 | +1 hero per rank (rank 1 free) |
| Bank Slots | 10 | +32 Bank slots per rank |
| Bank Tabs | 15 | +1 Bank tab per rank |
| Wishing Well | 10 | 10 × *rank* Water every 5 min as Passive Production, no hero needed (rank 1 free) |
| Notice Board | 3 | +1 bounty quest cap per rank |

- **Quests are Tokens** beside the Hall; click a finished one to claim its
  reward as loot. *(`src/systems/quests/`)*
  - **Tutorial** (the cartographer's, `tutorialQuests.js`): 13 steps, one at
    a time: recruit, equip a Woodaxe, **send your Recruit to a tree**, gather,
    collect loot, buy a Foundation, build a station, craft, **build a first
    camp** (a Logging Camp on a Wood Foundation; any camp counts); then the
    Starter Camp's end, **make a first tool** (copper, the camp's metal) and
    **beat a Goblin**, which pays the **first maps** (one of each Base Map
    ticked "given by the tutorial"; while none is ticked, each Base Map nothing
    trades up into); then settle a Region and travel to it.
  - **Bounties**: random "collect N items" or "defeat N Goblins", each paying
    10 Oak Wood (*placeholder*). Cap 2 (+1 per Notice Board rank, max 5); a
    new one every 3 min of game time.
- **No unlocks**: progression is skill levels (recipe and Token level
  requirements), Hall upgrades, and affording things. The smithing ladder
  (ingots at levels 1, 15, 30, 45, 60, 75, 90) is the longest content ladder.

---

## 9. Screens and UI

One page with overlays (`src/ui/ReactRoot.jsx`), left to right: **bubble menu
→ notification column → playmat (top bar above, hero dock below) →
drawers**. The menu can be flipped to the right.

- **Slot select** (3 save slots) is the only screen before play. Its wording
  is a leftover sci-fi theme ("SYSTEM BOOT").
- **Bubble menu**: Guild Hall, Item Bank, Shop, Settings.
- **Top bar**: Tokens / cap, upkeep per minute, disallow mode.
- **Notification column**: toasts (collapse / clear all).
- **Hero bar** (bottom): the roster, heroes as standing figures with HP bars,
  each with their job flag and Idle, Busy or Hurt; drag a figure onto the mat
  to give that hero a job. Click → **hero sheet** (loadout grid, skills with XP rates, banked skills) → Edit (rename,
  portrait, flag colour, Change Job planner).
- **Bank drawer**: tabbed item lists, search, reorder; drag an item onto a hero
  to equip. While open, the mat is locked and a vertical hero panel appears.
- **Shop drawer**: drag a row onto the mat to buy; it slides aside while you
  carry an item over the mat.
- **Guild Hall view**: the upgrade web, Hall effects panel, upgrade inspector.
- **On the mat**: click a Token to inspect it; a station's gear badge opens the
  recipe picker; a job flag is only dragged, to give its hero a new job (hover
  shows its hero and what they are doing);
  alerts sit on Tokens until fixed; loot is collected by hovering.
- **Settings** (5 tabs): typography and fonts, all caps, autosave, background,
  menu side, particles, volume (**master volume defaults to 0**: the game
  starts silent), Debug Mode. Nine controls are "coming soon".
- Keyboard: Escape closes one layer at a time; no gameplay hotkeys.

---

## 10. Time and saving

- **Game time** drives everything (cycles, spawns, quests). A tick is clamped
  to 1 s; longer gaps are caught up.
- **Offline progress** — **Built (brief 40)**: time away from a closed game or
  a sleeping PC (up to 24 h; the rest is dropped) is played by the real engine,
  sped up, behind a loading bar, then a "While you were away" summary. Gaps
  under 2 minutes (a background browser tab) are played quietly. It replaced
  the Time Bank, which is gone.
- **Saves**: 3 slots in browser `localStorage` with a one-step backup;
  autosave every 10 min by default. **Saves from another version are refused,
  not migrated** (`GAME_VERSION = '0.8.1'`, moved by the Atlas's Regions), and
  that stays the policy **until 1.0** (owner 2026-10-06). A new game is saved
  immediately.
- **Regions** — **Built, dev console only** (Atlas slice A1): the save holds
  every Region the guild has settled (`state.atlas`); the mat is the board of
  the Region the guild is in. **Only that Region runs**, offline catch-up
  included; every other Region is frozen exactly as it was left. A new game's
  opening mat is the first Region, the Starter Camp. **Travel** banks the loot
  on the floor (what the Bank cannot hold stays on that Region's floor), takes
  the Guild Hall and the quest Tokens along (the Hall lands in the middle of a
  Region it has never stood in, and back in its old spot in one it has), and
  leaves each Region's flags behind: going back, every hero starts at the flag
  they left there, with no work claimed and no fight on; a new Region starts
  with everyone in the Dock. No Atlas screen yet: `Game.Atlas.devCreateEmptyRegion()`
  and `Game.Atlas.travel(id)` in the dev console. *(`src/systems/atlas/`)*
- **Desktop**: packaged with Tauri (Windows installers); the game runs in the
  webview and saves stay in its storage.

---

## 11. Tools around the game

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

| | Count | Notes |
|---|---|---|
| Token types | 86 | 48 resource; 7 spawners; 4 enemies; 2 promotion; 1 Map (inert) |
| Items | 64 | no gear |
| Recipes | 25 | 5 skills have recipes |
| Effects | 22 | most of the grammar unused |
| Shop entries | 10 | |
| Skills with content | 10 of 25 | 8 Starting (not Alchemy) + melee + commerce |
| Jobs reachable | Fighter (+ Wizard, no source) of 13 | |

Content is half-authored on purpose; an unfinished Token is not a bug.

---

## 13. Planned and dormant

- **Atlas — Planned for the crunch** (after deep optimization):
  [`docs/active/concept_atlas.md`](../active/concept_atlas.md). Loot Maps and
  Modifiers, combine them in a Cartography screen to generate a Region, and
  relocate the guild to better Regions over time. Many Tokens become fixed
  geography. Owner decisions (2026-10-07, top of the concept): resource nodes
  respawn in place, the Shop sells buildings and tools only, demolition is a
  Construction job with no refund, everything counts toward the cap, and a
  hand-made Starter Camp opens the game. Roadmap and owner answers:
  [`atlas_roadmap.md`](../active/atlas_roadmap.md). Built so far: Regions and
  travel (§10), from the dev console; the Starter Camp and landmarks (A7).
- **Skill and class rework v2 — Engine built (brief 20, 2026-10-08)**:
  [`docs/active/concept_skill_and_class_rework_v2.md`](../active/concept_skill_and_class_rework_v2.md)
  and its [roadmap](../active/class_rework_v2_roadmap.md). The 4 Academies and
  8 master-class Tokens are owner content still to author.
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
taking something away. In Tokens' worth: one loot pile is about 4, one
item-stub row about 3, one enemy 4-10, one hero about 20, one fight about 30.
What costs most is the moving things (heroes, enemies, fights, hovering loot,
stub rows), not the Token count.

1. **Tokens.** A Region's base design holds at most **128 Tokens**, and a Base
   Map's budget must fit 128, spawned Tokens and landmarks included. Each Token
   Cap rank (+16) costs about 2 points on the slow laptop; 192 stays near the
   reference (85 %). **256 is kept as the top cap** (owner) but is **not smooth
   on a slow laptop** (62 %).
2. **Heroes.** At most **8 heroes** on the mat (`ROSTER_MAX`). A hero costs
   about 20 Tokens' worth; any roster above 8 needs a performance pass first.
3. **Enemies.** A Region keeps at most about **6 enemies alive at once** across
   its camps (a war camp's allowance of 5 counts). 13 read 88 %, 24 read 76 %,
   and many enemies also lengthen the catch-up.
4. **Fights.** Design for at most **1-2 fights at once** on a Region; no content
   that sets all heroes fighting together (4 fights: 78 %, 7: 69 %).
5. **Loot on the floor.** About **8 piles** in normal play. The pile cap stays
   40 (owner); until the piles' hover is made cheaper (T-197), 38 piles cost as
   much as about 160 Tokens (72 %).
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
| **Passive Production** | Free items the Hall drops on one 5-minute timer (formerly "trickle"). |
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
| **Recruit / job / promotion** | Starting job; the job tree; changing job on a Promotes Token. |
| **Banked skill** | A skill set aside by a job change, kept at its level. |
| **Hostile / ambush** | An enemy that attacks heroes sent to work near its spawner (the camp's watch). |
| **Wounded** | 5 minutes out after defeat. |
| **Catch-up** | Playing time away (a closed game or a sleeping PC, up to 24 h) on return, with a loading bar and a "While you were away" summary. |
| **Tempo / purpose / anchor** | CMS economy terms: a cycle-time band; what a producer is for; the source that sets an item's value. |
| **Atlas / Region** | Planned: crafting and moving between generated maps. |

Retired words still found in code and old docs: tile, grid, Tray, Vault,
deck, card, area, area flag, flag radius, Work Permissions, Scouting Flags,
gold, Manager, Map burst. Don't use them for current mechanics. In code a
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
| Promotion content | 4 Academies (Fighter, Wizard, Rogue, Ranger) on Wood or Stone Foundations, with skill & class rework v2 (crunch track). |
| Promotion cost | Free. |
| Kill loot | Neighbour bonuses apply to kills like work (T-017). |
| Energy and drinks | Remove energy, separate slots (T-098); drinks never heal, in fights or out (owner 2026-10-24); they are work buffs lasting 10 work cycles, a placeholder (brief 230 S6b). |
| Dormant Maps | Retire (T-002). |
| Wishing Well | Passive, part of Passive Production (T-099). |
| Silent by default | Development convenience; audible default before shipping (T-100). |
| Old saves | Refused until 1.0. |

| Terrain | Returns for the Atlas after a major rework, later in the crunch once the Atlas works. |
| Atlas timing | Moves into the crunch, after deep optimization. |
| Drops over a drawer | A mat Token or flag dropped over the Shop drawer or the hero sheet lands on the mat underneath; intended (owner, certification 2026-10-07). |
| Token cap | 128 to start, +16 per Guild Hall rank up to 256 (Atlas D-9); spawned Tokens and endgame sites count (D-1); the discard bin is gone (Atlas A3b), so nothing off the mat counts. |
| Trickle | Renamed **Passive Production**, one 5-minute timer; the Wishing Well joins it, about 10 Water per 5 min (T-099). |
| Markets | **Cut for now**: items stay the only currency, no exchange rates; revisit if a real need appears (owner 2026-10-09, T-127). |
