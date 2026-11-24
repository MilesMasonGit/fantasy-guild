# Brief 860 — Gathering rework: chance, spawning Forests, gathering foundations

*Written 2026-11-24 by the planning agent from the owner's review of Mining, Forestry and Farming the
same day (after Fishing, [brief 850](850_fishing_spots.md)). The rulings live in
[content_mining_forestry.md](../content_mining_forestry.md) ("Mining review", "Forestry review",
"Forests are tree spawners"), [content_farming.md](../content_farming.md) ("Farming review") and
[concept_gathering_foundations.md](../concept_gathering_foundations.md) (approved 2026-11-24).*

**What the player gets.** Veins, trees and ripe fields run out by chance rather than by a count, so
nothing needs counting on the board. A Forest plants and regrows its own trees (and an Orchard its
fruit trees) instead of speeding up others. Each gathering skill has its own foundation that builds
its sources: Excavation a vein (with a Prospecting Map), Nursery a Forest, Farmland a Field, Orchard
or Herb Garden, the Dock Fishing's buildings. Wood and Stone Foundations build the support buildings.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the tick, the content
boundary, the ledger), the review sections above, and [concept_skill_loops.md](../concept_skill_loops.md)
"Mining", "Forestry" and "Farming" for what they replace. Code read 2026-11-24 (the code wins):
`src/systems/board/Respawn.js`, `Growth.js`, `Fields.js`, `Foundations.js`, `SpawnerSystem.js`,
`Camps.js`; the CMS ledger (`pace.js`, profiles) that reads yields. Every phase may **stop and report
rather than guess**.

## Phases

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| R1 | T-688 | **Running out by chance.** One rule for a gathering source that ends: each cycle has a **chance to end it** (a vein rests, a tree becomes a Stump, a ripe Field is harvested out and replants), authored per Token in the CMS **in place of the count** (convert today's counts so the average stays: about 1 in 5 for Copper and Oak, 1 in 10 for Wheat). The **Composter** lowers its Fields' end chance instead of adding to a load. Rests, refills, regrowth and replanting are otherwise unchanged. The ledger and the CMS's rate calculator read the average (1 / chance). Nothing shows a count on the mat (brief 830 §15). | engineer | — |
| R2 | T-689 | **Forests and Orchards spawn their own trees.** A Forest is a spawner: it plants **a few trees of its species** in its reach (a per-species count in the CMS), **regrows only its own Stumps**, and boosts nothing else: no regrowth speed-up, no stacking, no floor, **no seedling per Sapling**. An Orchard does the same with its fruit trees (picked, not felled: they rest and fruit again). Spawned trees count toward the Token cap. A **demolished Forest's trees stay** as lone trees whose Stumps never regrow. **Every tree a Region starts with belongs to a wild Forest** (world generation and map tables). Regrow time is fixed per species; leave room for a later upgrade to shorten it. | builder | R1 |
| R3 | T-690 | **Gathering foundations.** Four new foundation Tokens, bought like the Wood and Stone Foundations and built by a Construction hero: **Excavation** (stands on stone) → a vein of the ore named by an **Ore Prospecting Map**, the map spent on the build; **Nursery** (any land) → a Forest of a chosen species, paid in its seeds; **Farmland** (grass) → a Field, Orchard or Herb Garden; **Dock** (the shore, touching water) → the Fishing Hut, the spot building, and the Bait Shed (from brief 850; lures stay Crafting recipes, no Lure Workshop). Wood and Stone Foundations keep only support buildings (Mines, Minecarts, Logging Camps, Well, Composter, Beehive, Windmill); Fields and Forests leave them. Uses the "Stands on" terrain rule. | builder | R2; 850 F3 for the Dock's list |

**Order and parallel work.** R1 → R2 → R3, all on gathering files, one code subagent at a time.
R1 may run beside brief 850 only if their files don't meet (Fishing has no count; check). **After R3**:
the content agent's pack (T-691): the end chances, Forest and Orchard tree counts, the four foundations'
prices, one **Ore Prospecting Map** per ore as a rare drop from mining it and from other sources (a Rock
Golem), the moved build lists, and the **rich event nodes**: Mining's Geode, Fallen Star and Fossil Bed,
Forestry's Hollow Tree, Driftwood Logjam, Giant Mushroom and Bamboo Grove (as the Fish Shoal: land now
and then, a rich rush, gone when worked out; [content_events.md](../content_events.md)).

## Done when

- Gate green each phase. **Work check: WORK CHANGED expected** in R1 (chance replaces counts: same
  averages, different rolls) and R2 (Forests no longer speed regrowth); say what moved and why, and
  retake the baseline with the owner's yes.
- Seen in the running game: a vein resting after a random number of swings; an Oak felled by chance;
  a Field harvested out and replanting with a seed; a Forest planting its trees and regrowing a Stump;
  a demolished Forest's Stump staying; each foundation placed on its ground (refused elsewhere) and
  built into its sources; an Excavation refused without a Prospecting Map.
- `CHANGELOG.md` entries; tickets closed.

**Eye-check: yes**, after R3 (how gathering plays).

## Owner to-do

No CMS work in the code phases. After R3, review and Sync the content agent's pack. Art when you like:
the four foundations, the Prospecting Map items, the special event nodes.
