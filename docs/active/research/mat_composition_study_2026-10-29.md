# What goes on each mat (research, 2026-10-29)

*A design analyst's study for the owner's question: alternatives for the
playmat and world map that give **a diverse selection of activities on any
mat** (every mat supports most skills, plus a specialty), **discovery on
arriving somewhere new**, expansion, and balance (worries: **lucky or unlucky
worlds**, **skills progressing unevenly**). Read-only; nothing decided.
Compared against [concept_world_map.md](../concept_world_map.md) (draft).*

## What's wrong today

- **One Base Map writes ~61 points**; at the 128 cap a map places at most 64
  Tokens (half kept for building). Forest: ~47 Oak Trees, 3 Oak Forests, 12
  berry bushes, no ore, water or Field. Mountain: 26 copper, 17 coal, 17
  stone, nothing else. Coast: 24 fishing waters, nothing else. Across the 9
  Base Maps fishing is on 2, forestry on 2, mining on 3, the wheat Field on 1.
  Blending maps mixes them, by which maps you happen to hold.
- **The draft keeps single-resource mats** ("layout from its biome"); its
  guarantees are per ring, never per mat.
- **More of the specialty buys nothing past ~5 Tokens per hero**: a copper
  vein works 5 cycles then rests 60 s, so ~5 veins keep one miner busy; 47
  trees could keep 9–10 woodcutters busy and the roster tops out at 8. **A
  specialty has to mean better or rarer things, not more.**
- **Some skills are slow even where they exist**: fishing ~450 XP/h (8 s per
  catch, 1 XP) against mining or forestry ~1,000–1,200 XP/h; and no recipe
  makes a second rod or sickle.
- **Luck**: random cells, modifiers and treasures remain, with no bound on how
  good or bad a world rolls.

## A composition model any structure can use

Every mat in three layers, out of 64 Tokens at cap 128:

1. **Everyday kit (~26)**: a minimum per gathering skill sized as "one hero
   working without waiting" (Mining ~5 veins, Forestry ~4 trees, Fishing 2
   waters, Farming 1 Field and 2 bushes, Alchemy 2 herbs from plane 2,
   Combat 1 camp), using materials the guild already has (no tier leaks).
2. **Specialty (~28)**: one, or two split 60/40: enough for 4–6 heroes, the
   new-tier node, one rare or rich node, its biome's look and camp.
3. **Wild card (~10)**: modifiers, a treasure, local flavour.

The kit stays a fixed minimum as the cap grows. Fits the code: `Budget.js`
already blends weighted maps and "more of" modifiers; add a shared
"Hinterland" recipe for the kit and one rule (after blending, raise every
skill to its minimum, trim the specialty). `Layout.js` handles mixed biomes.

**Against luck**: a **specialty bag per ring** (each specialty once or twice;
every gathering skill appears as a specialty each ring); a **pity rule** (a
skill not offered in the last 4 options comes next); **every world contains**
each ring's key materials on at least 2 frontier cells and a strong specialty
for every gathering skill; a **value budget per cell** (modifiers and
treasures scored; a cell within ±10 % of its ring's target).

**Even skills (a ledger check)**: every gathering skill keeps at least one
hero busy on every mat; per-hero XP/h across gathering skills within ±25 %
(retune fishing); the kit feeds one crafter per processing skill. The ledger
generates 100 worlds and reports low, typical and high per skill and cell.

## Five structures

- **A. The draft plus the model**: every settled cell mixed with a specialty;
  arriving strong. Keeps the tome (as the world map), Budget/Layout,
  modifiers, treasures, terrain, travel. Medium cost; risks ~200 cells mostly
  unsettled and a routine late game.
- **B. Home and frontiers**: the Hall's cell a permanent home mat (the camp
  grown up, endgame ruins, processing, camps); frontier mats specialty-heavy
  with a thin kit. Arriving strong; but diversity only at home, and trips home
  stop the frontier (only the active Region runs). Low–medium cost.
- **C. Patchwork mats**: a cell's own biome in the centre (~60 %) plus edge
  strips from each settled or charted neighbour on the side facing it (~8
  Tokens each); the Hinterland fills gaps. Settle beside the coast and a
  shoreline runs along that edge. Strongest cohesion ("a place within the
  world"); picking cells for their mix becomes the puzzle. Needs new code to
  place a biome on a chosen side; edges fixed once settled. Medium cost.
- **D. One growing mat with zones**: ~6 sectors around the Hall opened by
  clearing; the cap allows ~3 live zones, so zones rotate. Expansion on the
  mat itself; arriving weak; specialties squeezed (~20 Tokens); loses travel,
  moving day and the plane-travelling Hall. High cost.
- **E. Seasons**: a small hand-made world (~10–12 places per plane, same each
  run), each with a fixed kit and a specialty that turns over with seasons
  every 3–4 days. Excellent balance; weak arrival; against "a new world each
  run". Better later as a seasonal modifier.

| | A | B | C | D | E |
|---|---|---|---|---|---|
| Variety on each mat | Good | Medium | Very good | Good, squeezed | Good |
| Discovery on arrival | Strong | Strong | Strongest | Weak | Weak |
| Expansion | Strong | Medium | Strong | Strongest on the mat | Weak |
| Luck balanced | Good | Good | Good | Very good | Very good |
| Even skills | Good | Home only | Good | Very good | Very good |
| Hero orders and camps | Good | Very good | Good | Good | Good |
| Build cost | Medium | Low–medium | Medium+ | High | Medium + authoring |

## The analyst's recommendation

**A with the composition model and C's patchwork edges**: every mat gets the
everyday kit, filled first from its settled neighbours' biomes and topped up
by the Hinterland; one or two specialties make each place distinct by quality
(the new-tier node, a rare node), not by quantity; a specialty bag, a pity
rule and a value budget keep worlds fair; the ledger runs 100 worlds against
per-skill bands. Retune fishing's XP rate. Keep the Hall's cell as a small
permanent home with the endgame ruins (B's best idea). Seasons later as
modifiers.
