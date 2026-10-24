# Brief 230 — Skill loops: each starting skill plays its own way

**Source of truth:** [`concept_skill_loops.md`](../concept_skill_loops.md),
section **"The next pass"** and its **"Rulings this pass"** (owner interview
2026-10-22 to 2026-10-24). Those rulings win over the doc's older 2026-10-09
sections wherever they differ. The owner's original wish is SKILLS-01 in
[`research/backlog_intake_2026-10-22.md`](../research/backlog_intake_2026-10-22.md);
⚠️ its file paths and "hooks" are a recording agent's guesses: verify them in
the code.

**Who:** the Systems director. **Owner's call: one brief for all nine
skills** (owner, 2026-10-24), built in the phases below. **Eye-check:** yes,
one at the end (S9), screenshots-friendly; the director may split it in two
(gathering, then stations) if S2–S5 take long.

**The owner is away from the PC until about 2026-10-26** (phone only): build
and check from screenshots; the content pack (S8) waits in the CMS inbox
until the owner reviews it.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, GDD §§ Reach, Spawners,
Transforms (Respawn), Foundations, Health, food, defeat, Equipment and §14 (the Performance
Envelope: nothing may make the 128-Token reference board cost more), the
concept doc's "The next pass", [`200_cms_change_packs.md`](200_cms_change_packs.md)
(how a content pack is written), and for the overlaps
[`220_combat.md`](220_combat.md) C3 and C5 and
[`240_basic_content.md`](240_basic_content.md).

## What already exists (checked 2026-10-24; verify, a comment is a hypothesis)

- **Respawn** (`src/systems/board/Respawn.js`): `refill` (rest at 0
  charges, refill in place) and `regrow` (become an `into` Token that grows
  back). No content uses either yet.
- **Timed changes** (`TimedChanges.js`): `grows` (Sapling → Tree), `turns`
  (Coast ⇄ Shrimp Coast), spawner intervals, all on saved clocks that the
  catch-up fast-forwards.
- **Spawners** with an allowance and a per-spawn upkeep (Oak Forest: 5
  saplings, an Oak Seedling each).
- **Foundations** (`Foundations.js`): buy, pick a build, a hero builds it
  (30 s today).
- **Tools as hero gear** (T-126): `needsTool` kind and tier, "Needs Pickaxe".
- **Loadout grid**: 9 cells, consumable category unlimited; elixirs drawn
  from the Bank (220 C3 wires `consumeLoopConsumables`).
- **Today's content**: Oak Forest → Sapling (30 s) → Oak Tree (5 charges,
  leaves); Copper Mine spawns veins that leave; Wheat Field spawns sprouts;
  Furnace station plus a 20-use Copper Anvil context Token.

## Shared rules (every phase)

- **Support Tokens act within the `nearby` reach** (164 u, centre to centre;
  the mat is free placement, there are no tiles). ⚠️ Brief 210 A3 widens the
  **flag** radius to 240; that is the flag, not this reach. Don't change it
  here.
- **Speed-ups stack, down to one standard floor**: stacked supports cut **at
  most 80 %** of a time (one tuning number for every speed-up, in the CMS
  tuning). Covers Forests (regrow), Minecarts (vein work time), Docks
  (fishing), Wells (field growth), upgraded stations.
- **Gathering, nothing ready in reach: the hero waits silently** and works
  the first Token that becomes ready. No bubble.
- **Station missing an input: it stops, the hero waits there, the Token says
  what's missing** ("Needs Coal", the "Needs Pickaxe" bubble's look).
- **Stations never wear out.** No working sprite: the progress dial is the
  look.
- **Trees, fruit trees and veins can't be dragged** (fixed nodes).
- ⚠️ A resting Token today is drawn greyed with a countdown bubble (GDD
  Transforms). The owner's "wait silently" is about the **hero** (no bubble
  over them); the shared empty rock (S3) replaces the greyed look for veins.
  Keep the Token's countdown unless it clutters; show it in S9.
- **Every new field the engine reads gets its CMS control in the same
  phase** (the CMS is the only authoring surface; never hand-edit `data/`).
  Test fixtures for tests.
- **Art**: stand-ins from existing sprites; every needed picture is listed
  in [`owner_art_list.md`](../owner_art_list.md) §"Skill loops" so the owner
  swaps them in. New art is routine.
- **WORK CHANGED is expected** in most phases (nodes behave differently):
  accepted under this brief; the director names the cause per phase.

## Phases

| Phase | What | Tier | Needs |
|---|---|---|---|
| S0 | **Gap map (read-only).** For every ruling in "Rulings this pass", say what the engine already does, what's missing and where it would go (Respawn, TimedChanges, SpawnerSystem, the Rules/effects grammar, BoardRunner/Flags, ConsumptionSystem, Foundations, the CMS). Check whether the effects grammar already has a reach-scoped speed-up and a bonus-drop chance (GDD mentions bonus drops and Minecart restocking). Propose the order and any splitting of S1–S6; flag anything that threatens GDD §14. **Stop and report**; no code. | engineer | — |
| S1 | **Shared machinery**: reach speed-ups with stacking and the 80 % floor (one number); the station "Needs X" stop; silent waiting on gathering; fixed nodes can't be dragged; stations never wear out (the Copper Anvil's uses go with S6). Tests first. | engineer | S0 |
| S2 | **Forestry and Orchards.** Tree → **Stump** (per species) → Sapling → Tree in place, about 5 min for Oak (per species in the CMS). **Regrowth needs a Forest of the same species in reach**; a Stump with none stays a Stump until one is. **Every new Sapling costs one seedling from the Bank** (a Forest's planting or a Stump's regrow); none in the Bank: the Stump is stopped. **A Forest** plants Saplings within reach up to its allowance, speeds up its own species' regrowth (stacking, floor), has no upkeep, costs seeds to build. **Orchards mirror Forests, but fruit trees are picked, not felled**: Fruiting → picked empty → **Bare** rests → Fruiting (a refill), needing an Orchard in reach; Sapling, Fruiting, Bare per fruit species. Old saves: today's Oak Trees and Apple trees must load sensibly (stop and report if not clean). | engineer | S1 |
| S3 | **Mining.** Veins **refill all at once** after a rest (Copper about 5 ore, about 1 min; per ore in the CMS); a resting vein shows **one shared empty-rock sprite** (inspect names the ore). A **Mine** gives matching veins in reach about **25 % chance each to double drops, stacking** (a sure double at four). A **Minecart** shortens veins' work time in reach (stacking, floor). Mines no longer spawn veins: veins come from maps only. Ambushes on veins are per map (220 C5's, not here). | builder | S1 |
| S4 | **Farming.** A **Field is one Token that grows itself**: empty → growing → ripe; the **seed is picked on the field** from a list (like the recipe picker) and **sticks** for every replant. A ripe field holds a **load** (e.g. 10 wheat) harvested over several cycles; the **last cycle replants**, paying one seed from the Bank; none: the field is stopped. **Grow time 1–2 h per crop** (wheat about 1 h). Art: shared empty and growing field, a ripe sprite per crop. **Herb Gardens** work the same. Supports in reach: **Well/water** faster (floor), **Composter** adds to the load, **Beehive** a chance of bonus crops or seeds and **fills slowly with honey and wax** that a Farming hero collects, **Windmill** a station that mills grain. The Wheat Field's sprout spawner goes. | engineer | S1 |
| S5 | **Fishing.** Water **never runs out** and **doesn't shift** (the Coast's `turns` and the Shrimp Coast go; one sprite per water type: sea, river, lake). **Catch pools**: each water × tool kind × bait combination has a weighted pool in the CMS (owner's example: Rod and Bait 50 % Trout, 40 % Salmon, 10 % Dolphin); no bait gives the water's basic pool. **Tool kinds** (rod, net, cage) pick the pool; **rod tiers don't gate**, a better rod has its own bonus (e.g. more weight on the rare share). **Bait** is carried in the consumable cells and **one is spent per catch**; runs out, the hero fishes plain. Rare catches pop loudly. A **Dock** in reach speeds fishing (floor). | engineer | S1; 220 C3 for the consumable machinery |
| S6 | **Stations, work consumables, Construction.** Smithing: **Furnace** (ore + coal → ingots) and a hero-worked **Smithy** (ingots → tools, later gear) replace the anvil context Token. **Better stations are faster with the same recipes** (Copper → Iron Smithy, Campfire → Kitchen) and are built on a **new Foundation**. Cooking: food stations (Campfire, Kitchen) and a drinks station (Brewery); no fuel at the Campfire. Crafting: the Workbench only. Alchemy: one Alchemy Table. **Work potions** (the Birdwatcher) are spent only when a cycle of **their own skill** starts. **Drinks are work buffs** (e.g. Coffee faster cycles, Beer more XP) lasting a placeholder **10 work cycles**, like an elixir's 10 fights. **Construction builds every support and station on a Foundation**, with **build times per build** (supports ~30 s, stations 1–2 min, big buildings several minutes). | builder | S1; 220 C3 |
| S7 | **Seeing support effects** (concept "Seeing adjacency", locked): while placing, the Tokens a held Token would help (or be helped by) light up with the effect; inspect lists what boosts a Token and what it boosts; quiet pops when a bonus applies. Check what brief 120's hover and card already show first; build only the gap. ⚠️ Drawn: `bench:draw --compare`. | builder | S2–S6 |
| S8 | **Content as a CMS change pack** (brief 200's way): an Oak Forest (and Apple Orchard) with seed costs, Stumps, the empty rock, Mines and Minecarts, Fields with seed lists, Herb Garden, Well, Composter, Beehive, Windmill, Dock, Smithy, the station upgrades, water types and first catch pools, crafted bait (from Raw Shrimp and worms dropped by Farming), a first work potion and two drinks, build times. **Coordinate with brief 240**: whichever pack lands second follows the first's ids; 240's Iron Anvil becomes an Iron Smithy, its map trees need wild Forests. **The owner accepts the pack.** | builder writes, director checks | S2–S6 |
| S9 | **Play-through and eye-check**: a new game and an old save, the Starter Camp and one plane-1 map, every loop seen once (screenshots for the owner's phone). Engine work check `npm run bench -- --compare`, one `bench:draw --compare` for the cost log, the drag bench only if S1's fixed nodes touched drag code. | director | S1–S8 |

## Done means

Every ruling in "Rulings this pass" can be seen in the running game (S9),
the CMS can author every new field, old saves load, the gate passes, and
GDD §14's limits hold. Update the GDD sections the phases change (Spawners,
Transforms, Foundations, Health, food, defeat, Equipment) from what was built.

## Owner to-dos

- Review the S8 change pack in the CMS inbox and Sync on `main`.
- Draw what `owner_art_list.md` §"Skill loops" lists, whenever you like.
- Confirm or change the placeholder: **a drink lasts 10 work cycles**.

## Not in this brief

The XP curve (its own interview later), pastures and animals (specialist
skills), transmutation, Kiln and Loom, specialised stations (Smelter, Weapon
Forge) and the furnace-plus-anvil bonus (set aside, not dropped), food and
elixirs in fights (220), the maps and Starter Camp layouts (240).
