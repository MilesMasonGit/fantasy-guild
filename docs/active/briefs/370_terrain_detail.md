# Brief 370 — Detail pass: rivers, water and ground

*Written 2026-11-03 by the planning agent from the owner's picks on a live comparison.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "Terrain round". The
owner's wish: "Improving the terrain styling for one, making the rivers look more
organic, improving water appearance."*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, GDD §3 and §14. **The pictures the owner
picked from**: [`research/terrain_round/`](../research/terrain_round/) (`contact_rivers.png`,
`contact_water.png`, `contact_terrain.png`, `contact_together.png`). **A working
prototype**, research code to learn from and not to paste:
`research/terrain_round/_tools/trx.js`, `patches.mjs`, with every measure in
`results.json`. It runs against today's real ground code with hooks added in memory.

Code to start from (verify): `src/systems/atlas/WaterShapes.js`, `Layout.js`,
`Budget.js`, `src/ui/components/board/groundBuilds.js`, `groundSheets.js`,
`TerrainCanvas.jsx`, `ambientGround.js`.

⚠️ `WaterShapes.js`'s determinism warning binds: + − × ÷ and sqrt only, integer-hash
noise, seeded randomness, coordinates stored whole, because the layout stores what the
field makes. The prototype's river bend measure uses `**`; write it as products.

## The owner's picks (2026-11-03)

| Topic | Pick | Not picked |
|---|---|---|
| **Rivers** | **The A and C looks**: real bends and changing width. Plus the owner's additions: **wider sections, or more tightly winding rivers, and different positions for the rivers, depending on the map generation**. | B (from a source, thin upstream) |
| **Water** | **A, depth bands**. | B (too bright); C (movement) |
| **Ground** | **A, ragged borders**, and **B, settled dirt**. | C (calmer grass) |

**These amend earlier rulings**, as the owner saw and chose: brief 180's "gentler bends"
and its lake band distances; the blend band narrows (160 to 44 units in the prototype), so
the mixed band and islands of world rounds W2 to W4 show far less; round 4's "sunken earth
edges" soften.

## Phases

| Phase | What | Tier |
|---|---|---|
| R1 | **Rivers.** Build the A and C course: real bends, varying width, never doubling back (the same check), at least a placing cell wide everywhere. **Variety by world**: from the seed, rivers differ in where they run on the mat, in how tightly they wind, and in having wider sections. Keep to a few simply stated dials, on the settled world tables or layout rules if that's where such things live. **The bank**: A has the thin settled bank and C a wider one; the owner liked both, so make the width one number and show both at the look. The split river's arms must still join sensibly; the prototype left its shape alone, so say what you did. ⚠️ **Expect WORK CHANGED**, because the layout places Tokens round the water: explain it scenario by scenario, and check the ledger's checks F (every world passes), that every Token still fits, and that fishing Tokens still find water. Fresh games only; a stored Region keeps its old water. | engineer |
| R2 | **Water and ground** (the drawing). **Water A**: depth bands, lake and river, no brighter than today (lake L* about 44). **Ground A**: ragged borders. **Ground B**: settled dirt. ⚠️ Ground B alone measured 6 to 8 % busier, and the owner did not pick calmer grass: report the measure with both on, and show it at the look rather than quietly adding grass changes. All still pictures: no per-frame cost. Say whether narrowing the blend band changes any stored data or placement; if it does, stop and report. | builder |

R1 and R2 touch different files and may run in parallel, unless the water bands read R1's
new field; say which.

## Done when

- Gate green (`TESTING.md`). R1's WORK CHANGED accepted by the director with the reasons
  in STATUS; R2's engine work **same**.
- Measured against the comparison's numbers (`results.json`): river width variation and
  bend at or beyond the picks'; river in one colour near 25 %, lake near 55 %; border length
  in a two-ground Region about halved; the dirt's edge step down by about a fifth; ground
  no more than about 2 L* brighter, Tokens still darker than it.
- The Region build stays within brief 180's "well under 100 ms per Region" for the plan
  (the prototype measured 72 to 92 ms, not a bench number). `bench:draw --compare` once for
  the eye-check batch.
- In the running game, named as verified: several seeds' rivers visibly differ, on meadow,
  forest and mountain ground; a lake, a river, a sea and a Stone Region all read properly.
- GDD §3 updated.
- **One eye-check after R1 and R2**, in play: pictures can read differently from the game.
  Several fresh worlds; the river bank width to pick; a Coast and a Stone Region. A bake once
  came out too bright when judged only in play, so show greyscale and today's beside it.

## Not in this brief

Moving water (water C): not picked. Calmer grass: not picked, and the shade pattern's long
straight lines show more only with it. T-296, boards at the Hall: separate.

## Owner to-do

No CMS work and no new art.
