# Brief 80 — Terrain rework

Runs once the Atlas works (owner, 2026-10-06: "a major rework, later in the
crunch").

**Decided:** terrain paints each **Region's biome** from its Base Maps,
blending them on hybrid maps (owner, 2026-10-07). Today the old terrain system
is switched off (`TERRAIN_ENABLED = false`, `terrainRegistry.js`), with its
lattice, bands, patches, props and tones code and tests still present; the
tile-era "which Token paints which ground" table was deleted (2026-10-06).

**Branch:** `crunch/terrain`. **Tier:** engineer. **Eye-check:** yes; it is
mostly art and look.

**Owner input already gathered (2026-10-09):** read
[`../research/terrain_art_list.md`](../research/terrain_art_list.md) first: the
art inventory, what of the dormant code survives, and the owner's answers to
the look questions L-1 to L-10, including the **terrain grid** (cells with
terrain types; some Tokens require a terrain; grid visible only while
placing). L-1 (pixel size) is decided from a mockup.

## T0 — Plan (engineer, read-only first)

Decide with evidence what of the dormant system survives (the substrate art,
the lattice/blend code, the draw cost: it has a `background`-style switch to
add), and write a short roadmap: biome → ground, hybrid blending, how it
draws within the performance budget (measure with `bench:draw`; the old
system's draw cost is unknown on the free mat). Batch owner questions on the
look (the owner has terrain art).

**Done when** (brief): each Base Map's Region shows its biome's ground, hybrid
maps blend, and the cost log shows the drawing cost stays within the budget
brief 60 set.
