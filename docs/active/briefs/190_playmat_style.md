# Brief 190 — Playmat style: Clean ground at 2×, shadows, ambient life

**Source:** the visual style study with the owner, 2026-10-18 (rounds V1–V9).
Pages: V1–V2 https://claude.ai/artifact/MvC3ttno7ods7rcNgHKj2q, V3–V4
https://claude.ai/artifact/GhryA48D1FJoHir3uhkSLn, V5–V6
https://claude.ai/artifact/9iuBYG1XU8nCLTtKPzGCvN, V7–V9
https://claude.ai/artifact/VxDLR5aNDBarKjiWfdamuF. Prototypes in
`docs/active/research/ground_gen/`: `style2.py` (Clean, the table `P`),
`style4.py` (2× ground), `style5.py` (quieter decorations `quiet_decor`, the rim
`rim`), `style7.py` (animation: `shimmer9`, `gust9`, `particles`, `birds9`,
`clouds9`). Real captures to compare against in `ground_gen/capture/`.

**Why (measured, V1):** the ground was louder than the Tokens: twice as
colourful (65 vs 31) and brighter (61 vs 34), 90 % green, so groves blended into
the lawn and the eye went to the grass. 3× Token scale was tried and ruled too
cluttered; the fix is a quieter, coarser ground and the Tokens kept at 2×.

**Owner rulings:** a first pass to improve later (owner, 2026-10-18). Sharp,
never soft: no colour washes, no bloom, no blur on screen. Rejected and not to
be built: per-biome colour balancing and light washes (V3), worn clearing,
footpaths, base scatter (V5), edge scenery from Token art (V6), the bird flock,
constant motion (V7–V8).

## P1 — The ground's look (engineer; eye-check)

Code: `src/systems/board/TerrainGrass.js`, `TerrainSurface.js`,
`TerrainLattice.js`, `TerrainBlend.js` (G6), `src/ui/components/board/groundScreen.js`,
`src/config/registries/terrainRegistry.js`, `src/config/playmatTuning.js`.

1. **Clean palettes** per look: colour strength lower, the grassy looks a touch
   towards olive and the woods towards blue-green so trees separate from the
   ground, brightness as in `style2.py`'s table `P` (strength, hue nudge,
   brightness per biome). In the palettes (ramps), not a filter.
2. **The ground drawn at 2× pixel size**: one ground pixel = two art pixels
   (4 mat units) for the whole generated ground, water and beaches included;
   Tokens stay at their art size. The generator draws at that size (blades,
   tufts, clumps sized for it), not a downscale of today's picture. Expect the
   plan to get cheaper (a quarter of the pixels).
3. **Quieter decorations**: the ground's flowers, pebbles and props pulled about
   halfway towards the ground round them (colour and brightness), water left
   alone.
4. **Darker rim**: the mat's own ground two hard steps darker in a ragged band
   at its edge (about 4 and 11 ground pixels), as `style5.py`'s `rim`.
5. Ground tuner sliders for each (strength, hue nudge, brightness per look;
   decoration quieting; rim on/off and width), defaults from the prototypes.

Done when: side-by-sides against `style4/*_clean_x2.png` for all eight biomes
and two two-biome Regions; tests for the pure parts; the ground build time
before and after; engine work check same; `bench:draw --compare`; eye-check.
Built on top of the G7 placement and G6 blends work (the owner's eye-checks of
those come first).

## P2 — Shadows (builder; eye-check; after brief 110 and 120 merge)

The game's hard shadow (`src/config/spriteFx.js`: a black silhouette 2 art
pixels down-right, today only on lifted Tokens and floating loot) **under every
resting Token** on the mat; a **further, lighter shadow for lifted things**
(about 6 art pixels away, see-through, as the V2 "lifted, further shadow"
sample), dragged Tokens and floating loot. Heroes and enemies: resting shadow
too. `TokenSprite.jsx`, `MatToken.jsx` and `spriteFx.js` are also edited by the
features director's briefs 110 and 120, so this waits until those merge. Measure
the drawing cost (one more layer per Token): `bench:draw` A/B against `main`.

## P3 — Ambient life (engineer; eye-check; after P1)

Slow, lazy and subtle (owner): long quiet stretches, occasional events. On its
own thin layer over the ground, never a redraw of the ground; paused when the
game is minimised; off under reduced motion; a Ground tuner switch per effect.

1. **Water shimmer**: a slow faint swell and a few short-lived sparkles on
   lakes, rivers, ponds and the sea (`shimmer9`).
2. **Particles per biome**: falling leaves (forest), drifting petals (cherry
   grove), rising embers with the lava cracks pulsing (volcano); sparse.
3. **Birds**: small 3-art-pixel birds, **one light colour per biome**, that
   now and then fly in slowly, land on an idle Token (not one being worked),
   sit a while (an occasional head turn), and fly off; a few at most.
4. **An occasional slow gust**: once in a while a gust crosses the mat and only
   the drawn grass pieces (blades, tufts, which the generator knows) lean one
   ground pixel downwind and spring back; the grass colour is untouched.
5. **Cloud shadows**: small clouds at a finer pixel size than V9 (the ground's
   2× pixel), **one level of see-through shade**, each keeping **the same
   silhouette for its whole trip** across the mat (a shape that moves, not a
   noise field), drifting slowly.

Done when: each effect on its own switch, seen in the running game in several
biomes; the drawing cost measured per effect (`bench:draw` A/B, the effect on
vs off), each within budget or reported; eye-check.
