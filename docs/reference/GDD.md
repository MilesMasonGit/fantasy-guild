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

1. **A new game** has the Guild Hall in the middle of the mat, an Oak Forest
   and a Copper Mine either side (320 u away), and 3 Oak Seed, 10 Oak Wood and
   2 Wheat Seed in the Bank. There are **no heroes** (`ROSTER_BASE = 0`).
   *(`EngineBootstrap.js:80-110`)*
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
- One continuous surface, **no grid**. Default 11 steps of 160 u =
  **1760 × 1126 u** (fixed aspect 0.64). *(`matGeometry.js`, `matTuning.js`)*
- A dropped Token lands **exactly where it is let go** if the spot is legal;
  otherwise it nudges to the nearest legal spot within 160 u, otherwise it flies
  back. A legal spot: art circle inside the mat; not crowding a neighbour
  (hitbox 80 % of the art radius, up to 40 % overlap); breaks no `Cannot` rule.
  *(`MatPlacement.js`)*
- **A player drop never pushes anything.** Arrivals (spawns, growth, builds)
  may push **spawned** Tokens aside; **placed Tokens are never pushed**.
- **Token cap: 128 Tokens** to start (owner, Atlas D-9: a Guild Hall upgrade
  will add 16 a rank, up to 256; not built yet). The cap is the guild's but
  counts only the Region the guild is in (§10): every Token there, placed or
  spawned, including any in the discard bin; not quests, the Hall, or
  **landmarks** (Token types marked `landmark`: the endgame sites, Atlas D-1;
  none are authored yet). Enforced by the Shop and by recipes that make Tokens;
  a spawner waits while the mat is at the cap (as well as at its family cap).
  A save already over the cap keeps everything; adding waits until it is
  under. *(`MatCap.js`)*
- One Mythic of a type may be placed at a time (the only gameplay use of
  rarity). *(`Placement.js:84-93`)*
- **Disallow mode** (top bar): click Tokens to forbid hero work on them.
- **Terrain** (painted ground) is **Dormant**: `TERRAIN_ENABLED = false`.

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
- **Context Tokens** are tools (pickaxes, axes, fishing net, anvil) that stand
  near a worker; some recipes spend their charges. **Tools are not hero
  equipment.**

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

### Discard bin — Built
Drag a Token onto the bin (9 places). Pull it back, or "Discard all" for a
refund: built station = ½ Foundation + ½ build cost; bought unlimited = ½
price; bought consumable = price × charges left ÷ (starting × 2); spawned =
nothing. Rounded down per item. The Hall and tutorial quests can't be binned.
*(`DiscardBin.js`)*

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
  level 1, 50 HP, a random name. Differences are earned. No retirement.
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
- Each level gives +0.5 % speed to that skill's work.
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
  +1 master). A Recruit **cannot fight**.
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
- Max HP from the combat skill: 50 at level 1, 144 at 25, ~3,700 at 99.
  Regen 1 HP / 5 s while idle, working or fighting.
- Below 25 % HP a hero eats equipped food from the Bank.
- **Defeat** (0 HP): the hero's flag is furled, they limp home, lose 25 % of
  each carried food/drink stack (and 10 % chance per gear piece), and are
  **wounded for 5 minutes** of game time, returning at 50 % HP (*placeholder*
  numbers).
- **Energy** exists on heroes but nothing spends it — **Dormant**, to be
  removed. **Drinks will heal like food** from their own slot (owner
  2026-10-06, T-098); today they can't be drunk.

### Equipment — Partial
A 3×3 loadout grid with category caps (hand 2, hat 1, chest 1, trinket 2,
food 1, drink 1, consumable unlimited). **No gear ships yet**: 64 items are
materials, food, drink and one potion. Weapons, armour and gear loss are
**Latent**. **Gear is coming** (owner 2026-10-06): keep the system; weapons
and armour will be authored as content.

### How heroes choose work — Built (the heart of the game)
- A **flag** has no skill: the hero works every skill they hold within the
  **flag radius (164 u, +40 u per Scouting Flags rank)**, shaped by per-skill
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
Enemies are Tokens with `enemy: { level, style, budgetScale?, hostile? }`.
4 ship, **all melee**:

| Enemy | Level | Hostile | Uses | Drops |
|---|---|---|---|---|
| Goblin | 1 (×0.3) | yes | 1 | Bones, 30 % Copper Ore |
| Goblin Chief | 3 (×0.6) | yes | 2 | 1–2 Copper Ingot, Bones, 25 % Beeswax Comb |
| Cow | 1 | no | 100 | Bones, 50 % Raw Beef |
| Thorn Elemental | 1 | no | 100 | 1–2 Blackberry |

- Goblins come from the Goblin Camp; enemies potter within 128 u of their
  spawner at half of 90 u/s and walk back if moved.
- **Hostile** enemies ambush a hero inside the flag radius around their
  spawner; the hero fights back even if their Fight rule is off. Recruits are
  never ambushed (they can't fight).
- Each kill uses one of the enemy's uses; at 0 it's gone. Otherwise it
  respawns at full HP after a 2 s pause.

### The fight — Built
- Hero attacks every 2.5 s, enemy every 3 s. Roll to hit (base 75 %, ±skill
  difference, clamped 5–95 %), then damage with ±15 % spread. Armour subtracts,
  minimum 1.
- Hero damage today = 4 × growth(skill), with growth = 1.045^(level−1). Enemy
  HP 32 × growth, damage 9 × growth, scaled by `budgetScale`.
- **A four-way cycle: melee > ranged > magic > stealth > melee**: +10 %
  damage and +7 hit for the favoured side, the reverse for the other.
  Opposite pairs (melee and magic, ranged and stealth) are even, so each style
  has one good matchup, one bad one, and two even. An enemy's Style is one of
  the four combat skills (the CMS dropdown follows the skill registry). Every
  shipped enemy is melee, so only melee against ranged or stealth heroes
  triggers it yet.
- Kills give XP to the hero's combat skill and count as a work cycle for
  neighbour rules. Loot drops on the mat. **Kill loot ignores yield/double-loot
  bonuses** (ticket T-017).
- Crit is stubbed at 0. *(`FormulaRegistry.js`, `src/systems/combat/`)*

### Status effects — Latent
7 statuses (Poison, Burning, Bleed, Stun, Armor Shield, Well Fed, Cookout)
tick every 5 s; damage over time can kill. **No shipped content applies any.**

---

## 7. Rules and effects (the statement grammar)

Tokens carry **named effects** from a shared library (`data/effects.json`,
22 effects). An effect is one or more **statements**, readable as a sentence:
`[When <moment>,] <verb> <payload> [to <filter>] [reach] [role] [, costing
<upkeep>]`. *(`src/systems/effects/statements.js`)*

- **16 verbs**: provides, grants, acts_as, requires, restocks, converts,
  cannot, applies, deals, heals, restores, removes, spawns, transforms,
  station, promotes.
- **12 moments** (On Cycle, On Neighbour's Cycle, On Depleted, On Neighbour's
  Kill, On Engaged, On Tick, On Bank Holds…), **4 roles** (itself, the hero,
  that Token, the enemy), **5 filters**, **4 reaches**.
- **Modifiers** that neighbours provide: yield, work time, input cost, XP
  bonus, double loot, fail chance (Tokens); armour, resist, accuracy, block,
  damage, status immunity (heroes).
- **What ships**: tool tiers (`acts_as`), station skills, two neighbour buffs
  (Coast −5 % work time; Windmill +5 double loot on Fields), a placement limit
  (≤ 2 Coasts nearby), bonus drops, Minecart restocking, the two promotions,
  and **Thorns** (1 damage to the hero on finishing a Redberry Bush or Thorn
  Elemental). **Everything else in the grammar is Latent.**
- Authored only in the CMS (the Rules Line editor). Editing a library effect
  changes every Token that carries it.

---

## 8. The Guild Hall and progression

- The Hall stands in the middle of the mat, can't be moved off it or binned,
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
- **Notification column**: toasts (collapse / clear all) and the discard bin.
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
- **Dev tools** (dev build, or Debug Mode on in a built game): QA panel (give
  items, advance time, hire heroes, …), **Mat Tuner** (mat size, Token cap,
  quest cap, radii, speeds — stored per device, not in the save), FPS counter.
  Dev build only: the **Perf HUD** and stress boards (`?stress=realistic`).
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
  travel (§10), from the dev console.
- **Skill and class rework v2 — Engine built (brief 20, 2026-10-08)**:
  [`docs/active/concept_skill_and_class_rework_v2.md`](../active/concept_skill_and_class_rework_v2.md)
  and its [roadmap](../active/class_rework_v2_roadmap.md). The 4 Academies and
  8 master-class Tokens are owner content still to author.
- **Real offline progress — Built (brief 40)**; see section 10.
- **Terrain — Dormant, returns in the crunch** after the Atlas works, as a
  major rework (owner 2026-10-06).
- **Dormant**: energy and drinking, Villager heroes,
  Map bursts and most Map Tokens, `data/stations.json` (nothing loads it).
- **Latent** (code ready, no content): gear, statuses, ranged/magic enemies,
  rule upkeep, most statement verbs and moments.

---

## 14. Performance Envelope

*To be filled in during the crunch (step 8 of the crunch plan): the measured
limits — how many Tokens, heroes, enemies and loot piles the mat holds while
staying smooth — written as design rules.*

Known today: ~100 Tokens with 8 heroes runs at ~163 FPS (the screen's limit)
on the owner's PC, dev build; 300 Tokens at ~147 FPS. Engine tick p99 ≈ 0.8 ms
realistic, ≈ 1.9 ms at 300 Tokens (code review round 3).

---

## 15. Glossary

| Term | Meaning today |
|---|---|
| **Mat / playmat** | The free surface Tokens stand on (1760 × 1126 u by default). |
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
| **Bin** | The 9-place discard area. |
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
| Energy and drinks | Remove energy; drinks heal like food, separate slots (T-098). |
| Dormant Maps | Retire (T-002). |
| Wishing Well | Passive, part of Passive Production (T-099). |
| Silent by default | Development convenience; audible default before shipping (T-100). |
| Old saves | Refused until 1.0. |

| Terrain | Returns for the Atlas after a major rework, later in the crunch once the Atlas works. |
| Atlas timing | Moves into the crunch, after deep optimization. |
| Drops over a drawer | A mat Token or flag dropped over the Shop drawer or the hero sheet lands on the mat underneath; intended (owner, certification 2026-10-07). |
| Token cap | 128 to start, +16 per Guild Hall rank up to 256 (Atlas D-9); spawned Tokens count, endgame sites don't (D-1); binned Tokens count toward spawner caps (T-101, T-102). |
| Trickle | Renamed **Passive Production**, one 5-minute timer; the Wishing Well joins it, about 10 Water per 5 min (T-099). |
| Markets | **Cut for now**: items stay the only currency, no exchange rates; revisit if a real need appears (owner 2026-10-09, T-127). |
