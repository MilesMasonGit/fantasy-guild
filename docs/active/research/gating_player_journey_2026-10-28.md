# The first 3–4 hours, from the player's chair (research, 2026-10-28)

*For the gating workshop ([concept_progression_ledger.md](../concept_progression_ledger.md),
"Gating: open"). Written by an analyst from `data/` and `src/` as of
2026-10-28, under today's rules **plus the approved hero orders and
classless heroes**. Diagnosis only, no fixes. Times are estimates (1 XP per
gathering cycle today, checked on the Oak Tree; level 2 = 83 XP, 10 = 1,154,
15 = 2,411, 20 = 4,470). Each moment is scored on the owner's three goals:
**sees it coming / discovery / many skills** (+, −, neutral).*

## Act 1: the Starter Camp (0:00–0:50)

The mat: the Hall, four Oak Trees, an Oak Forest, two Copper and two Coal
Veins, a Stone Outcrop, a Redberry Bush, a Wild Wheat Patch, a Coast, a
Goblin Camp. Bank: 10 Oak Wood, 5 Oak Seedlings, 5 Wheat Seed, 15 Shrimp; one
free copy each of Copper Pickaxe, Copper Woodaxe, Fishing Rod, Copper Sickle,
Trap. No heroes.

- **Tutorial steps** (recruit, equip, send to a tree, gather, collect, buy a
  Foundation, build, craft): clear, pay at once. Heroes cost 20 and 30 Oak;
  with hero orders the player buys heroes to fill jobs. *Neutral / neutral /
  +.* The player always sees the next step, never anything past the camp:
  **the 25 endgame ruins meant to show the final goal are not in the shipped
  `starterCamp.json`** (checked), and their tutorial step was removed.
- **"Make a Copper Tool"**: the Copper Pickaxe needs Smithing 2 (83 XP); an
  ingot pays 1 XP, so it is ~40 nails, ~160 ore, ~80 coal from veins resting
  60 s every 5 uses: a 20–30 minute loop, for a tool already in the Bank.
  *− / − / +.*
- **"Beat a Goblin"** (level 5, 25 HP): an easy win; the cartographer hands
  over the **Forest, Mountain and Coast Maps**. *+ / + / +*: the camp's best
  gate, set up in story, earned in a fight, fed by crafting.

## Act 2: settling plane 1 (0:50–1:45)

- **Settling** (one map at a time, as the tutorial suggests; inspecting a map
  lists what it writes): Forest (oak, berries, Wolf Den, Alpha Den, Copper
  Chest), Mountain (copper, coal, stone, Goblin Camp, Chief Tent, Copper
  Chest), Coast (fishing, Crab Rocks, Tide Pool, Copper Chest). Chests: a
  burst of loot, 10 % Meadow Map, 5 % each Flower Meadow and Cherry Grove.
  *+ / + / neutral.*
- **Plane 1 brings mostly enemies and fruit**: its crafting was already in the
  camp. *Neutral / − / −.*
- **The Wolf Alpha** (level 10): a level 5–8 hero with a sword and Shrimp
  wins; its card says "Yellowstone Map 10 %", and it drops: **guaranteed on
  the first kill, and nothing says so.** *− / + / neutral*: a surprise read as
  luck, so it can't be planned or repeated. The Water Elemental gives a Bog
  Map the same way. Bounties pay only plane-1 maps.
- **The Goblin Chief** (level 20, hits 4 every 4 s, Heavy Strike every 6th
  swing, 40 HP): a level-8 hero misses a quarter of the time, deals 2, takes
  ~4; usually a loss. Its card shows "Volcano Map 10 %" among 14 lines; the
  player doesn't know the Volcano has iron, or that this is the sure Volcano.
  *− / − / −*: **the key gate of the stretch looks like an optional boss**,
  above plane 2's own enemies (15–17); the answer is ~340 Goblins of combat
  XP.

## Act 3: plane 2 arrives sideways (1:45–3:00)

- **Yellowstone**: Fir Trees ("Needs Forestry 15"), Grapevines (Farming 15),
  Sulphur Lizards (16), Big Lizard (24), an Iron Chest. A full-time forester
  is ~10–12. *+ / neutral / −*: honest and readable, but a single-skill grind,
  slower than the plan's "levels 1–15 in ~1.5 h".
- **The Iron Chest** (Crafting 1): Iron Ore and Fir Wood always, 50 % an Iron
  Ingot, 5 % a Volcano Map. The first iron often comes from here, in a Region
  with no iron. *− / + / neutral*: a lovely one-off that leaves the player
  holding iron with no lead to more (the owner's "indirect").
- **Bog**: lavender, trout, Frogs (15), another Iron Chest; no iron node.
- **The Volcano hunt**: 3 % per kill from three bosses (one every 5 min, only
  the active Region runs: ~33 kills, ~2.5–3 h); the Queen Bee's sure drop
  behind a rare map; 0.25 % per common enemy; the Chief out of reach. The game
  points to none of them. *− / − / −*: **the worst stretch**, luck and combat
  alone, and hard to balance (10+ stacked drop sources).
- **The Hall**: after ranks 1–2, the Cartography Table's rank 3 asks "50 Fir
  Wood, 10 Iron Ingots". *+ / neutral / +*: the only place the game names
  iron as a goal, tucked away on the upgrade screen.

## Act 4: first fir, first iron (3:00–4:00)

- **First fir** at Forestry 15 (~2.5–3 h of nothing else). *+ / neutral / −*:
  earned, quiet.
- **First iron**: the Volcano's Iron Veins need Mining 15 (a copper pick
  works; 2 % Fire Elemental ambushes, level 17); the Iron Ingot needs
  Smithing 15 at the old camp Furnace, hidden behind "???" silhouettes;
  Smithing is the slowest skill (~4–7 XP a minute, fed by miners). The five
  plane-2 buildings need Construction 15 and are only ~30 % speed-ups, but
  look mandatory. *− / − / +*: on paper many skills; in play three level-15
  walls of very different lengths plus an optional wall that looks required.
  A steady supply of iron ingots likely doesn't arrive in this window.
- **Single-copy tools**: "Needs Fishing Rod" on the second fisher, no way to
  make another. *− / neutral / −.*

## Where gating goes flat or confusing

1. The Goblin Chief is the sure Volcano map and looks like an ordinary boss;
   neither "first kill always drops" nor "the Volcano has iron" shows.
2. The Volcano hunt is luck and boss farming: 10+ sources at 0.25–3 %, ~2.5–3 h
   expected, no hint what to chase.
3. Every level-15 wall is far slower than the plan (2+ h per gathering skill,
   many hours for Smithing).
4. The Construction 15 buildings look mandatory but are speed-ups.
5. Plane 1 adds no new crafting.
6. The first iron comes from a chest in a Region with no iron node.
7. First-kill map drops read as luck ("10 %", not "guaranteed").
8. The early "Make a Copper Tool" wall, and no long-term goal visible in the
   camp (the ruins are missing).

## Where it works

1. The cartographer's three maps for a beaten Goblin.
2. Settling a Region: a map's inspection shows what it writes; chests make
   arriving exciting.
3. The first Wolf Alpha or Water Elemental kill: a new world drops.
4. "Needs Forestry 15" on the first Fir Tree: an honest, visible goal.
5. The Hall's rank-3 price in Fir Wood and Iron Ingots: the one place the next
   plane is named ahead of time.
