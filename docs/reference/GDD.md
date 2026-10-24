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
3. **Plant a flag**: drag a hero from the dock onto the mat. The hero walks out
   of the Hall and works suitable Tokens within the flag's radius.
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
- **Origin**: *placed* (bought or built: fixed, refundable) or *spawned*
  (free, pushable, no refund). Both count toward the Token cap.
- **Size**: 1 (art radius 64 u) or 2 (144 u); growing stages are half-size.
- **Context Tokens** are support Tokens (an anvil) that stand near a worker;
  some recipes spend their charges. **Gathering tools are hero gear**, not
  Tokens (T-126): pickaxes, woodaxes, fishing rods and sickles are items held in
  one hand (`tool: { kind, tier }`); a gathering Token names the kind and lowest
  tier it needs (`needsTool`), and only a hero holding one may work it. No tool:
  the hero does other work and the Token says "Needs Pickaxe". Tools only gate.

### Reach — Built
Rules reach `nearby` (default), `self`, `self_and_nearby` or `board`.
**Near = 164 u centre to centre**: the four side neighbours of a 1×1, not the
diagonals. There is no Close/Far. *(`reachRegistry.js`, `matTuning.js:46-52`)*

### Spawners — Built
A spawner puts new Tokens beside itself on an interval, up to a **family cap**:
the sum of `allowance` over all live spawners of that family (two Oak Forests
→ 10 trees). Order per attempt: cap, upkeep, pick, land, then pay, so a spawn
with no room costs nothing. *(`SpawnerSystem.js`)*

| Spawner | Spawns | Allowance | Every | Upkeep per spawn |
|---|---|---|---|---|
| Oak Forest | Oak Sapling | 5 | 20 s | 1 Oak Seed |
| Wheat Field | Wheat Sprout | 3 | 30 s | 1 Wheat Seed |
| Apple Orchard | Apple Sapling | 2 | 45 s | 1 Apple Seed |
| Copper Mine / Coal Mine / Quarry | ore vein / coal vein / stone outcrop | 3 | 30 s | — |
| Goblin Camp | Goblin (95) / Goblin Chief (5) | 3 | 30 s | — |

### Transforms — Built
- **Growth**: Oak Sapling → Oak Tree (30 s), Wheat Sprout → Ripe Wheat (30 s),
  Apple Sapling → Apple Tree (45 s).
- **Turns**: Coast ⇄ Shrimp Coast, 30 % chance every 60 s.
- A transform keeps the Token's origin, starts fresh clocks and loses any cycle
  in progress. *(`TimedChanges.js`)*
- **Respawn** (built; no shipped Token uses it yet): a Token type with a
  Respawns block in the CMS comes back after it runs out. *Refill*: it stays
  where it stands, **resting** (greyed, a countdown bubble), nobody can work it,
  and after its time (12 s by default, at least 1 s) it refills to full at once.
  *Regrow*: it becomes its `into` Token (Oak Tree → Oak Sapling), whose own
  growth brings it back. Its hero moves on with no red alert; it is never
  depleted (no On Depleted rules, not counted as used up); a regrowing tree
  still counts toward its Forest's family cap. Never on enemies, spawners or
  Foundations. *(`Respawn.js`)*

### Foundations — Built
Buy a Foundation, pick a build recipe on it, and a hero builds it into a
station in place (30 s, level 1). *(`Foundations.js`)*

| Foundation | Price | Builds |
|---|---|---|
| Wood Foundation | 15 Oak Wood | Workbench, Cooking Pot (5 Oak Wood each) |
| Stone Foundation | 10 Stone + 5 Oak Wood | Furnace (5 Stone), Fighter's Academy (10 Stone + 10 Oak Wood) |
| Farmland | 10 Oak Wood | Wheat Field (1 Wheat Seed), Apple Orchard (1 Apple Seed) |

### Demolition — Built (Atlas A3a, A3b); replaced the discard bin
Mark a Token for demolition and a hero holding Construction (level 1) removes
it in 10 s of work: no refund, no loot, no XP, never a depletion. While marked
it is only that job: its recipe, build, training, spawning, growth, refill and
Passive Production stop (what it gives its neighbours by standing there
carries on until it is gone). Unmarking makes it itself again and loses the
half-done demolition. Anything bought, built, spawned or planted can be marked,
a resting Token included; the Guild Hall, landmarks, a map's nodes, quests and
enemies can't. **Demolish** on the Token's inspection marks it (where it
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
enemy camps and treasures, and its ground; a Modifier has effects (more of a
node, a better node instead, an enemy camp, a treasure). The generation engine
reads it (`systems/atlas/mapItems.js` → `Budget.js`); inspecting one in the Bank
lists what it writes. Settling a Region takes the slotted maps from the Bank
(`Cartography.js`). A claimed bounty pays a map 25 % of the time, drawn at the
claim, weighted by each map's bounty weight. The simulator prices no map. Map
bursts, the Map shop, the Explore skill and the old Map catalogue
(`data/maps.json`) are retired; the last Map Token, **Volcanic Island**, does
nothing and is the owner's to delete in the CMS.

---

## 4. Heroes

### Roster — Built
- Heroes come from the **Bunk Beds** Hall upgrade: each rank adds one hero,
  **max 8** (`ROSTER_MAX`). Rank 1 is free. *(`guildUpgrades.js`)*
- Every recruit is identical: a **Recruit** with the 9 Starting skills at
  level 1, 10 HP, a random name. Differences are earned. No retirement.
- One flag colour per hero (8 colours).

### Skills — Built
**25 skills** in four layers *(`skillRegistry.js`, the source of truth;
class rework v2, brief 20)*:
- **Starting (9)**: mining, forestry, fishing, smithing, crafting, cooking,
  farming, alchemy, construction. Every hero holds all nine, always.
- **Combat (4)**: melee, ranged, magic, stealth. A promoted hero holds one.
- **Advanced (4)**: leadership, fletching, enchanting, crime. One on a basic
  class, two on a master class.
- **Master (8)**: faith, trapping, summoning, taming, commerce, science,
  armory, shadowcraft. One master class each.

The Advanced and Master skills are **placeholders** (owner ruling D7): names,
descriptions and emoji icons that work like any skill (Tokens and recipes can
name them; XP; levels), with no mechanics of their own until the owner's
specialist-skill rework. Stealth fights like the other three styles and
takes its place in the four-way matchup cycle (see The fight).
Forestry is the old Logging, renamed with its id (it keeps the Logging art);
Explore and the other v1 skills were dropped. Only the Starting skills (Alchemy
has none yet), melee, magic and commerce have content today.

- A hero can only do work for a skill they **hold**, at a high enough level.
- XP comes from work cycles (the recipe's or Token's `xp`) and kills (into the
  hero's one combat skill). Level cap 99; XP to level 99 ≈ 13 million
  (RuneScape-style curve, `XPCurve.js`).
- A skill level gives no work speed: a cycle takes its authored time whoever works it (owner 2026-10-09, T-125).
- **Hero level** = the average of held skills (display only).
- **Content that still says `logging`** (data/ and the CMS workspace, until the
  owner's next Sync) is read as `forestry` as it loads
  (`skillIdMigration.js`, to be removed under T-114). Content naming a skill or
  job that does not exist is listed by the boot audit and the CMS Economy
  Audit.

### Jobs and promotion — Built, mostly without content
- Job tree *(`jobRegistry.js`)*: **Recruit** → 4 basic classes → 8 master
  classes:

  | Basic class | Its skills | Master classes (adds) |
  |---|---|---|
  | Fighter | melee + leadership | Paladin (enchanting + faith), Knight (fletching + armory) |
  | Ranger | ranged + fletching | Beastmaster (enchanting + taming), Hunter (crime + trapping) |
  | Wizard | magic + enchanting | Necromancer (crime + summoning), Scholar (leadership + science) |
  | Rogue | stealth + crime | Merchant (leadership + commerce), Assassin (fletching + shadowcraft) |

- A hero holds the 9 Starting skills plus their class's skills: Recruit 9,
  basic class 11 (+1 combat, +1 advanced), master class 13 (+1 more advanced,
  +1 master). A Recruit fights barehanded: a punch of 1 every 3 s, with no
  style and no combat XP (see The fight).
- **Promotion is a Token rule**: "Promotes the hero to Fighter." A qualified
  hero trains on the Token for one cycle (30 s default), then a ceremony asks
  Accept / Not yet. *(`BoardPromotion.js`, `PromotionSystem.js`)*
- **Gate**: a basic class needs two named Starting skills at 10 (ruling D3):
  Fighter Mining + Smithing, Ranger Forestry + Crafting, Wizard Alchemy +
  Cooking, Rogue Fishing + Crafting. The pairs are the `gateSkills` of each
  job in the job table. A master class needs its parent's combat and advanced
  skill at 25. Re-training passes the same gate as a first promotion, and
  banked skills count. The Change Job planner shows what is missing
  ("Needs Mining 4/10, Smithing 0/10").
- **Price**: free (ruling D4). A Promotes rule costs nothing unless its author
  sets a price in the CMS cost strip, so an unpriced Academy keeps its uses
  and never wears out. An authored price is spent on accepting, and a Token
  that cannot pay does not train.
- Changing branch banks the skills the new job doesn't use, at their level;
  they return if the hero comes back. The Change Job screen only plans; the
  act happens on the board.
- **Mastery** (ruling D2): an Advanced or Master skill at level 99 is never
  banked. It stays on the hero through every later job change, on top of the
  new class's skills, so a hero can hold more than 13. Combat skills are
  excluded and bank as usual (a hero fights with exactly one combat skill).
  The promotion preview lists a mastered skill as kept, not set aside.
- **Content**: Fighter's Academy (buildable on a Stone Foundation) and Wizard
  Academy (no source found) are the only promotion Tokens. The Ranger and
  Rogue Academies and the eight master-class Tokens are the owner's CMS work
  (brief 20 R3; ruling D5).
- Skill and job icons for the new skills and classes are emoji placeholders.

### Health, food, defeat — Built
- **Max HP = 10 + combat level** (the held combat skill; a Recruit, holding
  none, is level 0): 10 for a Recruit, 11 at level 1, 109 at 99. Recomputed on
  every level-up (a level adds headroom, not a heal) and on load (an older
  save's stored max is replaced and current HP clamped to it).
  *(`FormulaRegistry.js`, `CombatFormulas.js`)*
- **Regen 1 HP / 10 s while idle or working; none in a fight**, where only
  food heals.
- Below 25 % HP a hero eats equipped food from the Bank (in a fight eating
  takes that swing). Out of a fight, if still below, they also drink the
  equipped drink, which heals like food. **In a fight drinks do not heal**: an
  equipped drink is left alone, unspent (drink buffs are the skill-loops
  design's, not built). Heroes have no energy (removed, T-098).
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
- **The "used" bubble**: when a hero eats, drinks or drinks an elixir on the
  mat, a small bubble over their head shows the item's icon and what it did
  ("+5 ♥", or the elixir's name) for 1.5 s, one at a time per hero. Not drawn
  during a catch-up. *(`matFx.js`)*
- **Defeat** (0 HP): the hero's flag is furled, they limp home, lose 25 % of
  the whole Bank stack of each carried food and drink (elixirs exempt), a
  10 % chance per gear piece to lose that piece (the hero's own copy), and are
  **wounded for 5 minutes** of game time, returning at 50 % HP (*placeholder*
  numbers).

### Equipment — Partial
A 3×3 loadout grid with category caps (hand 2 — two hands: a tool takes one,
a two-handed weapon both — hat 1, chest 1, trinket 2,
food 1, drink 1, consumable unlimited). Gear, weapons and tools are one copy
per hero: equipping takes the copy out of the Bank.
- **A weapon** is anything held in the hands that is not a gathering tool. It
  names its **style(s)** (`styles`: a Dagger is Melee and Stealth), its
  **damage** and its **speed** (fast 2 s, normal 3 s, slow 4 s). **A hero
  equips only weapons of their own style**; a weapon naming no style suits any
  promoted hero. **A Recruit holds no weapon** ("Recruits fight barehanded:
  promote Bjorn to use the Copper Sword"); a hero of another style is told
  whose weapon it is ("Mira fights with Magic: the Copper Sword is a Melee
  weapon"). A weapon of another style still in a hero's hands (from before a
  re-training) is not swung and its ability is off. Older content's single
  `skillRequired` style is read as a one-style list. *(`weaponStyles.js`,
  `EquipmentValidator.js`)*
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

### How heroes choose work — Built (the heart of the game)
- A **flag** has no skill: the hero works every skill they hold within the
  **flag radius (240 u: all eight neighbours; +40 u per Scouting Flags rank)**, shaped by per-skill
  **rules** (allowed on/off, priority 1–5, default 3; one combined Fight rule).
- Choice order: a Promotion Token or the Hall directly under the flag first;
  then by priority, distance, and placement order. One hero per Token.
- **Sticky**: a hero never leaves mid-cycle for something better; they switch
  at cycle end, only to a strictly better priority. Leaving resets progress.
- **Pinned flags**: drop a flag on a Token to work only that Token; the flag
  follows it, and turns into an area flag when the Token is gone.
- **Walking costs time**: heroes walk at 120 u/s (≈15 s across the mat) in
  straight lines; the cycle starts on arrival. Idle heroes potter within 80 u.
  *(`HeroMotion.js`)*
- **Speech bubbles** explain why a hero is stuck ("I need Copper Ore…"), plus
  a few moments (idle, level-up). Max 3 per hero. Lines:
  [`speech_bubble_lines.md`](speech_bubble_lines.md).

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
- **Hostile** enemies ambush a hero inside the flag radius around their
  spawner; the hero fights back even if their Fight rule is off. Recruits are
  ambushed too and fight back barehanded.
- Each kill uses one of the enemy's uses; at 0 it's gone. Otherwise it
  respawns at full HP after a 2 s pause.

### The fight — Built
- **Swings.** A hero swings at their weapon's speed: fast 2 s, normal 3 s,
  slow 4 s (barehanded: 3 s). The weapon swung is the first in the hands of
  the hero's own style; one of another style is ignored. An enemy swings at
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
- **Recruits punch for 1 every 3 s**, whatever is in their hands, with no
  style (even with every enemy) and no combat XP. A promoted hero with no
  weapon punches too: 1 + the level step, on their own style.
- **A four-way cycle: melee > ranged > magic > stealth > melee**: +25 %
  damage for the favoured side, −25 % for the other (a 2 becomes 3, or stays 2).
  Opposite pairs (melee and magic, ranged and stealth) are even, so each style
  has one good matchup, one bad one, and two even. A hero always fights on
  their own combat skill's side (a Dagger is melee for a Fighter, stealth for a
  Rogue). An enemy's Style is one of the four combat skills (the CMS dropdown
  follows the skill registry). Every shipped enemy is melee.
- **No regen in a fight**: below 25 % HP the hero eats food instead of
  swinging; drinks do not heal in a fight. Elixirs are drunk as a fight starts
  (section 4).
- Each swing draws one random number for the miss and, on a hit, one for the
  crit, from the game's random stream in a fixed order, so a catch-up replays
  the same fights as live play.
- Kills give XP to the hero's combat skill and count as a work cycle for
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

---

## 7. Rules and effects (the statement grammar)

Tokens carry **named effects** from a shared library (`data/effects.json`,
22 effects). An effect is one or more **statements**, readable as a sentence:
`[When <moment>,] <verb> <payload> [to <filter>] [reach] [role] [, costing
<upkeep>]`. *(`src/systems/effects/statements.js`)*

- **16 verbs**: provides, grants, acts_as, requires, restocks, converts,
  cannot, applies, deals, heals, restores, removes, spawns, transforms,
  station, promotes.
- **15 moments** (On Cycle, On Neighbour's Cycle, On Depleted, On Neighbour's
  Kill, On Engaged, On Tick, On Bank Holds…, and the three fight moments: On
  Swing and On Hit, each "every Nth", and On Health Below X % once a fight),
  **4 roles** (itself, the hero, that Token, the enemy), **5 filters**,
  **4 reaches**. On Tick fires every 3 s. A fight moment runs only Applies,
  Deals, Heals and Removes (the editor offers it to no other verb), spends no
  charge and has no cooldown.
- **Modifiers** that neighbours (or a hero's items) provide: yield, work
  time, input cost, XP bonus, double loot, **double item chance** (a chance
  that one named item, when a cycle or a kill drops it, comes out doubled: the
  Cleaver's Raw Beef), fail chance (Tokens); armour, resist, accuracy,
  damage, **dodge, pierce, crit chance**, status immunity and **status stack
  limit** (one status effect stacks at most N lower or higher: the Hide
  Vest's Poison −1; at 0 it cannot land), **swing time** and **food healing**
  (percentages, on a lingering effect: an enrage, Burn) (heroes, and enemies
  through effects on them). Most combat rows are flat amounts, and a new rule
  on one starts flat. Block is gone (a miss is the only failed hit).
- **Statuses** are library effects with a status block (§6): stacks, ticks,
  and an end with their fight.
- **Gear families**: a weapon or armour family's ability is one library
  effect every tier references with its own scale (1–5), so the tier raises
  the number.
- **What ships**: tool tiers (`acts_as`), station skills, two neighbour buffs
  (Coast −5 % work time; Windmill +5 double loot on Fields), a placement limit
  (≤ 2 Coasts nearby), bonus drops, Minecart restocking, the two promotions,
  and **Thorns** (1 damage to the hero on finishing a Redberry Bush or Thorn
  Elemental). **Everything else in the grammar is Latent.**
- **Items carry rules too** (a hero's loadout): a carried rule on On
  Neighbour's Fight fires as its hero's fight starts. An `Applies` of a
  library effect may last **for the fight** (until that fight ends, at the kill
  or when the hero leaves), which is how an elixir works: "When a fight starts,
  applies Valor to the hero for the fight", Valor being an effect that
  provides +1 Damage. An elixir's rules fire from its 10-fight dose, not per
  firing from the Bank. **For the swing** lasts until the swing being made is
  over (a boss's heavy strike); a status ignores all three lifetimes, having
  its own. Applies may aim at **the hero** as well as the enemy.
- Authored only in the CMS (the Rules Line editor). Editing a library effect
  changes every Token that carries it.

---

## 8. The Guild Hall and progression

- The Hall stands in the middle of the mat, can't be moved off it or demolished,
  and is excluded from the cap.
- **Upgrade web** (separate full-screen view): nodes unlock when linked to the
  Hall or to a bought node. Price: rank *n* costs 10 × *n* Oak Wood
  (*placeholder*). *(`guildUpgrades.js`)*

| Upgrade | Ranks | Effect |
|---|---|---|
| Bunk Beds | 8 | +1 hero per rank (rank 1 free) |
| Bank Slots | 10 | +32 Bank slots per rank |
| Bank Tabs | 15 | +1 Bank tab per rank |
| Scouting Flags | 5 | +40 u flag radius per rank |
| Wishing Well | 10 | 10 × *rank* Water every 5 min as Passive Production, no hero needed (rank 1 free) |
| Notice Board | 3 | +1 bounty quest cap per rank |

- **Quests are Tokens** beside the Hall; click a finished one to claim its
  reward as loot. *(`src/systems/quests/`)*
  - **Tutorial**: 11 steps, one at a time: recruit, plant a flag, fell an Oak
    Tree, collect loot, open the Bank, visit the Shop, buy a Foundation, build a
    Workbench, craft Charcoal, plant Farmland, harvest Wheat.
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
- **Hero dock** (bottom): heroes as standing figures with HP bars; drag onto
  the mat to deploy, drop a flag or hero on it to recall. Click → **hero
  sheet** (loadout grid, skills with XP rates, banked skills) → Edit (rename,
  portrait, flag colour, Change Job planner).
- **Bank drawer**: tabbed item lists, search, reorder; drag an item onto a hero
  to equip. While open, the mat is locked and a vertical hero panel appears.
- **Shop drawer**: drag a row onto the mat to buy; it slides aside while you
  carry an item over the mat.
- **Guild Hall view**: the upgrade web, Hall effects panel, upgrade inspector.
- **On the mat**: click a Token to inspect it; a station's gear badge opens the
  recipe picker; a flag is only dragged (hover shows its hero and reach);
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
| **Charges / uses** | A Token's wear; one per cycle; 0 removes it, unless it respawns; `null` is unlimited. |
| **Resting / respawn** | A Token at 0 charges whose type respawns: unworkable until it refills, or becomes the Token it regrows from. |
| **Cycle** | One unit of work on a Token (or one kill). |
| **Near / reach** | 164 u centre to centre; how far a rule carries. |
| **Spawner, family, allowance** | A Token that makes Tokens; the types it makes and what they grow into; how many it allows alive. |
| **Upkeep** | Items a spawner (or rule) pays to keep running. Unpaid = it waits. |
| **Passive Production** | Free items the Hall drops on one 5-minute timer (formerly "trickle"). |
| **Foundation** | A placed Token built into a station by choosing a build recipe. |
| **Station** | A Token whose work is a recipe the player picks. |
| **Context Token** | A tool or support Token used by nearby work. |
| **Flag** | A hero's work anchor: an area (radius) or pinned to one Token. |
| **Rules (flag)** | Per-skill allowed/priority settings for one hero. |
| **Rules (Token) / effect / statement** | A Token's behaviours, written as sentences in the CMS. |
| **Bank** | The guild's item store; one slot per kind. |
| **Loot** | Items lying on the mat, collected by hovering. |
| **Recruit / job / promotion** | Starting job; the job tree; changing job on a Promotes Token. |
| **Banked skill** | A skill set aside by a job change, kept at its level. |
| **Hostile / ambush** | An enemy that attacks heroes near its spawner. |
| **Wounded** | 5 minutes out after defeat. |
| **Catch-up** | Playing time away (a closed game or a sleeping PC, up to 24 h) on return, with a loading bar and a "While you were away" summary. |
| **Tempo / purpose / anchor** | CMS economy terms: a cycle-time band; what a producer is for; the source that sets an item's value. |
| **Atlas / Region** | Planned: crafting and moving between generated maps. |

Retired words still found in code and old docs: tile, grid, Tray, Vault,
deck, card, area, gold, Manager, Map burst. Don't use them for current
mechanics.

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
| Energy and drinks | Remove energy; drinks heal like food out of fights, separate slots (T-098); in fights only food heals (brief 220). |
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
