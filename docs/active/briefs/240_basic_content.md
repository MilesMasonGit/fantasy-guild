# Brief 240 — Basic content: Starter Camp to plane 2

**Source of truth:** [`concept_basic_content.md`](../concept_basic_content.md)
(approved 2026-10-24; "The world at a glance" table wins over the rounds).
Also read [`200_cms_change_packs.md`](200_cms_change_packs.md) and
`cms/incoming/README.md` (how a pack is written), GDD §14 (the Envelope: at
most 128 Tokens, ~6 enemies alive, 1-2 fights at once per Region), and
[`220_combat.md`](220_combat.md) (enemy fields, bosses in lairs, ambushes).

**Who:** the Systems director. **Needs:** K0 needs nothing. K1-K3 need brief
220's C2 (gear and enemy fields) and C5 (lairs, ambush rules) merged, so the
packs use the new fields instead of being redone; if the skill-loops brief
changes how nodes are authored (forests, veins) and is merged first, the packs
follow it, otherwise they use today's blocks and say so.

**The owner is away from the PC until about 2026-10-26** (phone only): K0
can be built and checked from screenshots; the packs wait in the inbox until
the owner reviews them in the CMS. **The owner accepts these packs**, not
the director (unlike 220 C0).

## What already works (checked 2026-10-24, no code needed)

- A Token without a `respawn` block leaves the mat at 0 charges, so a
  **one-time cache** is plain content (`Respawn.js`, `Charges.destroyToken`).
- A map with **bounty weight 0** is never paid by a bounty
  (`questBounties.js` filters weight > 0).
- Map items, camps (`camps`), treasures (`treasures`), bounty weight and
  modifiers' density / threat / treasure effects are all read by
  `mapItems.js` and `Budget.js`. Enemy drop tables can hold map items.

## K0 — The engine gaps (one branch, `content/engine-gaps`)

Each is small; one builder takes them in order, committing each.

1. **Change packs carry the Starter Camp** (`cms/src/engine/changePacks.js`
   `KINDS`, the review screen, undo): a `starterCamp` entry whose value is
   the Starter Camp page's shape (Tokens and positions, the opening Bank),
   shown in review as a before/after list of Tokens added, moved, removed.
   Done when: a test pack moving one Token and adding one is reviewed,
   applied and undone in the running CMS, `data/` untouched.
2. **The tutorial gives only the tutorial maps** (`tutorialQuests.js`
   `firstMapsReward`): a Base Map field "given by the tutorial" (CMS Map
   editor, a checkbox) replaces "every map nothing upcycles into". The step
   that pays them is the Starter Camp's end: **a first copper tool made and
   a goblin beaten** (two tutorial steps or one with two goals, whichever
   the tutorial code takes more cleanly; the cartographer's text drafted for
   the owner, per concept_quests_tutorial.md). Done when: tests cover the
   flag and the steps; a new game in the running build pays exactly the
   flagged maps after both goals.
3. **"First kill always drops"** on an enemy's drop table: an entry may be
   marked first-kill-guaranteed; the first time the save kills that enemy
   type it drops for certain, afterwards at its normal chance. Remembered in
   the save (old saves: treated as not yet killed). If brief 220's bosses
   already give this, use theirs and skip. Done when: tests cover first,
   second and an old save; offline catch-up honours it.
4. **The Bog biome** (`Budget.js` `BIOME_GROUND`, `BIOME_WATER`,
   `terrainRegistry.js`): a `bog` biome on grass with the darker grass
   texture, marsh water (ponds and the small waters, more of them than a
   forest), from the existing ground textures; no new art. Also add the
   missing `meadow` entry to `BIOME_GROUND` (it falls back to grass today).
   ⚠️ Drawn: `bench:draw --compare` once. **Eye-check: yes** (a screenshot
   of a Bog preview and a settled Bog Region is enough for the owner's
   phone).
5. **Guild Hall upgrade prices follow the planes** (`guildUpgrades.js`
   `prices`): ranks 1-2 of the Token cap and Cartography slots in oak,
   stone and copper; ranks 3-4 in fir planks or wood and iron ingots;
   ranks 5+ keep today's placeholder (later planes price them). First-pass
   numbers by the builder, listed in the report for the owner. ⚠️ Check
   brief 210 batch 4 (Guild Hall) first: if it moved prices into the CMS,
   this becomes a pack entry instead.

**Tier:** builder. **Gate:** TESTING.md; engine work check `npm run bench --
--compare` (expected: same, except K0.2 on the tutorial path).

## K1 — Pack 1: the Starter Camp and plane 1

**Tier:** builder writes the pack; the director checks it (format and
game-code checks, every id the pack names exists or is created in it, the
GDD §14 limits per map) and puts it in the inbox.

- **Starter Camp** (a `starterCamp` entry, K0.1): add a few oak trees,
  copper and coal veins, a stone outcrop, a berry bush, a fishing spot, a
  wheat patch and a Goblin Camp around the owner's existing layout (the Hall
  and the 25 ruins stay where they are); the opening Bank's test seed counts
  set back to a small opening. The owner may rearrange and re-save.
- **Plane-1 Base Maps** (edit the 6 that exist): Forest, Mountain, Coast
  (all three "given by the tutorial"), Meadow (common), Flower Meadow and
  Cherry Grove (rare: low bounty weight and low drop chance). Nodes, one
  camp and one boss lair each, and one copper-chest cache each, as in the
  concept's table; points so a single map fills its share of the 64-Token
  node limit.
- **Creatures and bosses** (Tokens, existing sprites): Wolves, Crabs, Bees
  (new; camps as spawner Tokens), Cows and Thorn Elementals (exist,
  peaceful), Goblins (exist); bosses Wolf Alpha (bigger wolf), Goblin Chief
  (exists), Water Elemental, Greater Slime, Wind Elemental, Queen Bee
  (bigger bee), each in a lair (220 C5), staying near its spot. Drops: the
  map's materials, plane-1 maps and modifiers steadily, plane-2 maps rarely,
  and each boss's **first kill always drops a plane-2 map** (K0.3). Levels,
  kinds and stats from brief 220's level table. The Starter Camp's goblins
  drop plane-1 maps (never plane-2).
- **Items and recipes**: copper weapons and armour (220's families, copper
  versions; use "copper", not "bronze", unless the combat concept has ruled
  both), meat from wolves, crabs and bees' honey into Cooking.
- **Level and pace targets** (first-pass numbers, each noted in the pack):
  Starter Camp ~30 min, plane 1 ~1.5 h, main skills ~15 after ~2 h from a
  new game. The XP curve itself is the skill-loops brief's; if it isn't
  built, say in the report what the current curve gives at 2 h.
- Respect the bounty weights: plane-1 maps > 0, plane-2 maps 0.

## K2 — Pack 2: plane 2

Same tier and checks as K1.

- **Base Maps**: Volcano and Yellowstone (edit), **Bog** (new, banner from
  the existing swamp map sprite `t_map_swamp`), all bounty weight 0.
- **Nodes** at level 15: iron ore (Mining), fir (Forestry), trout (Fishing),
  grapevines (Farming), Lavender (Alchemy 1); stone, coal, hot springs
  (Yellowstone's look). Copper tools work them (the standing rule).
- **Creatures and bosses**: Fire Elementals (Volcano; also an ambush rule on
  iron veins, 220 C5), Sulphur Lizards (Yellowstone; drop Lizard Scale),
  Frogs (Bog); bosses a tinted Fire Elemental chief, a Big Lizard, a Toxic
  Frog, with good loot (materials, modifiers). Iron-chest caches.
- **Buildings and recipes**: Iron Anvil (iron tools, weapons, armour),
  Tannery (Lizard Scale → leather; boots, gloves, tunic), Alchemy Table
  (Lavender → healing potion; the potion's effect is 220's), a better
  Furnace (smelter sprite) and Workbench built from fir and iron; trout and
  grapes into Cooking.
- Pace target: plane 2 lasts about a day.

## K3 — Pack 3: modifiers and caches

- **Density**: Overgrown (exists; trees), Rich Veins (ore), Teeming Waters
  (fish), Bountiful (fruit and crops). **Threat**: one extra-camp modifier
  per creature (Goblin Camp exists). **Treasure**: one modifier adding a
  cache. **Fir Grove** is deleted (the owner accepts or rejects the delete).
- Which enemies drop which modifier, at what rate (drafted, noted).
- Check every map plus one modifier of each kind stays inside GDD §14
  (≤ 64 nodes at the base cap, ≤ ~6 enemies alive with the Region's camps).

## K4 — The play-through check

- A **reachability test** (extend A7's): from the Starter Camp, every
  plane-1 and plane-2 material, tool, building and the first plane-2 map is
  reachable through the authored content (no item needed that nothing
  makes or drops).
- The director plays a new game in the running build with the QA speed-up
  through the camp, one plane-1 Region and the first plane-2 Region, and
  writes the eye-check file: screenshots of each step for the owner's phone,
  then the owner plays it when back.

**Eye-check:** K0.4 (Bog look) and K4 (the play-through). The packs
themselves are reviewed in the CMS.

## Owner to-do

1. Look at the Bog screenshots (phone is fine).
2. When back at the PC: review packs 1, 2 and 3 in "Changes to review",
   accept or tweak each entry, Sync on `main`; rearrange the Starter Camp
   if wanted and "Save this mat as the Starter Camp", Sync.
3. Play from a new game; tune numbers in the CMS; notes into
   `owner_feedback.md`.
4. Optional art, any time: a bigger or tinted sprite for the Wolf Alpha,
   Queen Bee, Fire Elemental chief and Big Lizard (they borrow the base
   sprite until then), and a Bog ground of your own if the borrowed one
   doesn't feel right.
