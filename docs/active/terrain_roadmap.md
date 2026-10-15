# Terrain roadmap (brief 80)

*Phase T0, written 2026-10-14 by the engineer tier from a read-only pass over
`main` at `0cc3da68` (the Atlas, brief 60's P2 slices and T-145 merged). Source
of truth: [`briefs/80_terrain.md`](briefs/80_terrain.md), the owner's answers
L-1 to L-10 and the **terrain grid** ruling in
[`research/terrain_art_list.md`](research/terrain_art_list.md), the owner
decisions in [`concept_atlas.md`](concept_atlas.md) and
[`atlas_roadmap.md`](atlas_roadmap.md) §D.*

**Evidence tags.** **[code]** read in the code at the file and line given.
**[disk]** read from the art files with a throwaway script (sizes, colours,
seams). **[measured]** timed in Node 24 (V8) on this PC at 1×, median of 7,
with other sessions loading the CPU (~37 %); not the browser, not the bench.
**[reasoned]** my inference, not checked by running anything.

**What was measured and what was not.** Measured: the art on disk; the cell
maps A4's generator writes for three hybrid Regions; the dormant terrain
pipeline's cost per pixel on its own lattice; a ground-pixel copy loop at the
free mat's sizes. **Not measured: any drawing cost in the browser.** The brief
allowed one `bench:draw --only=S2` with the dormant layer switched on in a
scratch build *without code changes*; that is not possible: `TERRAIN_ENABLED`
is a constant (`terrainRegistry.js:49`), nothing stores terrain on the board
any more (`TerrainOff.test.js:49-64`), the files the canvas asks for no longer
exist (A-2), and there is no `terrain` draw switch (`drawSwitches.js:10-15`).
The per-frame cost below is reasoned, and T2 measures it.

---

## Locked decisions

Settled by the owner's answers plus the evidence in A and B; slices build on
these without asking again. **The owner answered §D on 2026-10-14: TD-1, TD-2,
TD-3 and TD-5 are settled as A, so T1 and T3 build on them; TD-4 was struck
(there is no clearing, decision 4).**

1. **The ground is the Atlas's cell map.** One terrain per 32-unit cell
   (`TERRAIN_CELL`, `TerrainMap.js:19`), 55 × 36 cells on the shipped mat,
   written at settle by A4 (`Layout.js:454-466`) and stored on every settled
   Region as `region.terrain`, about 2 KB (`Atlas.js:115`, `:297`;
   `StateSchema.js:109-111`). No second grid: drawing and placement both read
   this one, and nothing else writes it. The dormant lattice's tile claims
   retire (B).
2. **The ground follows the nodes (L-4 A), as A4 built it.** A node's own
   cell takes its biome's terrain; every other dry cell the nearest node's
   within 256 units, else the main biome's (`TerrainMap.js:123-143`). Hybrids
   therefore blend **by place**: rock round the ore, grass round the trees,
   sand on the Coast's shore, the sea along one edge (`carveWater`,
   `TerrainMap.js:52-87`). The drawing then softens every meeting (decision
   10). v1 changes nothing in the generator except honouring per-Token terrain
   needs (T3).
3. **A Region with no stored map is meadow**: all grass. That covers the
   Starter Camp (L-10 A: its record has `terrain: null`), the dev console's
   empty Regions, and every bench and test board (they become the Starter Camp
   in `Atlas.ensureState`, `Atlas.js:75-94`). Computed on read, never stored:
   **no save change and no migration**. Every Region settled since A4 already
   carries its map (A4 wrote the grid the day settle landed, `aabf2927`), and
   older saves are refused anyway (Atlas D-5 A).
4. **No clearing: the ground is static and the Hall leaves no mark** (owner,
   2026-10-14, striking the research doc's L-9 answer). The ground round the
   Hall is whatever its cells are, with the same wear as anywhere else. A Hall
   the player moves changes nothing in the ground.
5. **One look per terrain per Region**, from the biome that owns that terrain
   (`region.ground.terrains`, `Budget.js:179-186`): forest grass, mountain
   rock, coast sand, the sea; grass with no owning biome is meadow. Five
   styles in a code table (presentation config, as today's registry is; T-090
   stays open). ⚠️ Two biomes sharing one terrain in one Region (a future
   Plains beside a Forest) would need the biome per cell stored: not needed by
   the first three Base Maps, whose terrains are all different.
6. **One ground pixel = one Token pixel on screen, at every window size**
   (L-1 B's intent, and UI_STYLE's sprite rule). Tokens step their art to a
   whole number of screen pixels per art pixel (`boardArtSteps`,
   `TokenSprite.jsx:72`); the ground uses the same function, so a ground pixel
   is `boardScaleAt(fit)` mat units (`TokenSprite.jsx:78`), not a fixed 2. The
   fine 16-px set (L-1 B); the mute (about `brightness(0.85) saturate(0.7)`)
   is **baked into each sheet's pixels once at load**, never a CSS filter.
7. **Built in two stages, never per frame.** (a) A **ground plan** per Region:
   which ground, wear, band and scatter at every 2-unit pixel (880 × 563 on the
   shipped mat), independent of the window, pure and tested. (b) A **screen
   pass** that resamples the plan onto the screen's ground-pixel grid and
   samples the sheets per pixel. The plan is rebuilt when the Region changes
   (travel, load) or a tuning slider moves; the screen pass when the art step
   or fit changes (a window resize, debounced). Nothing in a tick or a frame.
8. **One canvas under the Tokens that stays in the mat's own layer**: CPU-backed
   (`getContext('2d', { willReadFrequently: true })`, which Chrome does not
   composite [reasoned]), no `will-change`, no filter; the scatter, the rounded corners
   and the mat's inset vignette are drawn into the same picture. This is the
   T-145 rule (`MatPixelLayers.test.js:27-41`) applied to the ground, proven in
   T2 by `bench:profile`'s layer count and `bench:crisp`.
9. **A `terrain` draw switch** beside `background` (`drawSwitches.js:10-15`):
   off, the ground is not mounted. It is how the cost log measures it.
10. **Computed wiggly edges (L-3 A)** from the surviving `edgeProfile`, plus the
    beach rim where water meets land, shallows and wet sand, and clumps of wear.
    The September values carry over as fractions of a cell and are retuned at
    the eye-check with the Playmat Tuner (they were tuned on the 8-px set).
11. **Still water (L-8 A).** Shimmer only later, if the cost log allows.
12. **Scatter (L-6 A)** comes from the owner's seven 4 × 4 sheets of 16-px props
    (`props/prop_*.png`), drawn one prop pixel per ground pixel, muted like the
    ground, with the dormant placement rules (scattered, never on a lattice,
    dropped where its foot is not on its own ground).
13. **Alternate sheets swap per Region** (by its seed), never per cell: two
    seamless sheets side by side show a square seam (L-2's "1–2 alternates").
14. **Placement gets a fourth rule** in `MatPlacement` (beside on-the-mat,
    not-crowding and `Cannot`): the cell under the Token's centre must be one
    its **`standsOn`** list allows (the CMS field "Stands on"); a Token with no
    list may stand anywhere dry. Every placement path goes through it: drops,
    nudges, pushes, spawns, Shop arrivals, recipe Tokens, travel, the mat
    shrinking, and the Atlas layout. Tokens already standing somewhere a later
    rule forbids are left where they are; the rule applies from their next move.
15. **The engine bench's work is unchanged by construction**: bench boards are
    meadow (decision 3) and no fixture Token has `standsOn`, so every check
    passes exactly as today. T3 proves it with `--compare`.
16. **The budget: the ground adds nothing measurable** to a hands-off frame or a
    drag on `cap128` (brief 60's must board), and its one-off build stays under
    the bars in B3. "Within brief 60's budget" cannot mean passing "smooth": the
    128 board is not smooth today with or without terrain (A-6).
17. **`TERRAIN_ENABLED` goes** in T2 (with `TerrainOff.test.js`); the branch
    merges only after the owner's eye-check, so no master switch is needed.

---

## A. What the docs say versus the code and the disk

| # | The doc says | The code or disk says | Evidence |
|---|---|---|---|
| A-1 | Research §2: the ground exists as cut pieces (`ter_grassb0`–`7`, `ter_grass0`–`5`…), `template/` sheets, and tree props. | Stale since the owner's art reorganisation the same day (`56ecc3e4`, 2026-10-09 19:58): every piece, `template/` and the three tree props are gone. Today `terrain/` holds **one 64 × 64 sheet per ground**: `ter_grass`, `ter_grassb`, `ter_dirt`, `ter_gravel` (new), `ter_sand`, `ter_stone`, `ter_water`, `ter_waterb`; all redrawn (none matches an old sheet). | [disk] `git show --stat 56ecc3e4`, blob ids |
| A-2 | `terrainRegistry.js:157-161`: a variant lives at `ter_<id><set><n>.png`. | No such file exists; the registry's own note says so (`:137-139`). The canvas would draw nothing. | [code] [disk] |
| A-3 | Research §2: `prop_tree_oak` and `_maple` are also the saplings' art. | No longer: the saplings point at `tokens/nature/tree/token_sap_*.png` (`sprite-manifest.js:91`, `:98`). Removing ground props touches no Token. | [code] |
| A-4 | `terrainRegistry.js:177-180`: props are "4×4 sheets of 16px props". | True of the seven loose sheets in `props/` (`prop_bush`, `_bush_dark`, `_coast`, `_flowers`, `_mushroom`, `_rock`, `_rock_sand`: 64 × 64, 16 props each, clean 16-px grid, 18–71 colours, fully opaque or fully clear). `props/sheets/` holds seven 256 × 256 sheets packed **irregularly** (generator output, four of them `_dim` copies): source material, not sliceable by a grid. | [disk] contact sheets |
| A-5 | Research L-2: "plus 1–2 alternates". | `ter_grassb` and `ter_waterb` are **recolours** of `ter_grass` and `ter_water` (same pattern, same colour shares: 33/22/19/11 % and 70/8/5/4 %): `grassb` a darker green (mean `#395831` against `#4e673c`), `waterb` a bright blue (`#0f71bd` against a dark teal `#204d63`). Which is for what is TD-2. All sheets tile with no visible seam in a 2 × 2 test (seam jump 0.64–1.20 × the inside's). | [disk] |
| A-6 | Brief 80, done-when: "the drawing cost stays within the budget brief 60 set". | Brief 60's "smooth" (≥ 95 % of frames within 16.7 ms at 4× on `cap128`) is not met today: 52 % after P2-1, 66 → 76 % after T-145 (`STATUS.md`, wave 2). The terrain can be held to "adds nothing measurable", not to "smooth". | [doc] `PERFORMANCE.md:337-368` |
| A-7 | Research §3: one ground pixel is 2 mat units (fine set). | Exact only where 2 × fit is whole (fit 0.5, 1.0, 1.5). The mat is CSS-scaled by a fit rounded to whole percent (`useBoardScale.js:45-56`), and Tokens step their art to whole screen pixels (`TokenSprite.jsx:55-81`): at a fit of 0.73 a Token pixel is 1 screen pixel, a 2-unit ground pixel 1.46, drawn as uneven 1- and 2-pixel columns. Hence decision 6. | [code] [reasoned] |
| A-8 | The terrain grid ruling: the grid shows "alongside D4's adjacency preview". | No adjacency preview exists: it is a skill-loops idea (`concept_skill_loops.md:25-28`), prototyped after the Atlas. The grid goes in today's drag preview, beside the landing ring (`MatRings.jsx`). | [code] [doc] |
| A-9 | The ruling's examples: a Dock, a Sailboat, a Mineshaft. | None exists as a Token yet (86 Tokens; the water-ish ones are Coast, Shrimp Coast, Fishing Net, Copper and Coal Mine). Unfinished content: the field waits for them. | [data] |
| A-10 | `terrainRegistry.js:46` names `TerrainPainting.test.js`; `:111` says `TestDashboard` publishes the art-set event; `engineTokens.js:21-23` cites a `TerrainRegistry` "accounts for all N Tokens" check. | No such test file; `PlaymatTuner.jsx:29` publishes; no such check. Fixed when T1 rewrites the registry and T2 its events. | [code] |
| A-11 | The ruling: everything without a terrain need "goes anywhere dry". | Placement can say so (T3). **Walking** is not placement: idle heroes potter and enemies wander (`EnemyMotion.js:20`, `:60`) without asking `MatPlacement`, so they may stroll over the sea. Not in this brief: a ticket after T3. | [code] |
| A-12 | `FreeMatGuards.test.js:185-192`: the dormant terrain files are allow-listed "until terrain is revived". | Still allow-listed. T1 re-lattices the files over the cell map, so T2 removes the allow-list. | [code] |

---

## B. What survives, and how the ground works

### B1. The dormant system, module by module

The eight dormant suites and the Tuner's pass today: 114 tests, 2 skipped (run
2026-10-14 in this worktree). Cost: the dormant pipeline on its own 464 × 464
lattice at the fine set (215,296 pixels) [measured]: a coast-and-forest crop 68 ms (317 ns a
pixel), a forest-and-mountain crop 51 ms (237 ns). By stage, on a half-forest,
shore and sea test board: art pixels and edges 4.8 ms, bands and beach 13.9 ms,
wear patches 26.2 ms the first time for a seed and 5.7 ms after, tones 14.6 ms,
props 0.2 ms.

| Part | Where | Fits the grid ruling? | Cost | Verdict |
|---|---|---|---|---|
| Stable noise (`hash01`, `variantAt`) | `TerrainLattice.js:108-116`, `:240-243` | Yes: a picture from the Region's seed, the same on every load | — | **Keep** `hash01`; `variantAt` goes (no per-cell variants, decision 13) |
| Tile claims (`ownerOf`, `claimants`, `resolveLattice`, `split`, `isCore`, jitter, recency) and the 928-unit legacy square | `TerrainLattice.js:18-29`, `:118-231`, `:251-260` | **No**: they decide which of 36 tiles owns a square, newest drop winning. The Atlas cell map is the owner now. | (not timed) | **Goes**, with its tests (the "lines up", "Ownership", "Recency" groups) |
| Wiggly edges (`edgeProfile`, `edgeStrips`) | `TerrainLattice.js:337-428` | Yes: works on any grid of ground ids; the owner's September tuning | part of the 4.8 ms | **Keep**, over `cols × rows` cells of 16 pixels |
| Pixel map, distances, beach rim (`resolveArtPixels`, `distanceFromSeeds`, `applyFringes`) | `TerrainLattice.js:447-650` | Yes; square `size` everywhere becomes width × height | 4.8 ms (+ the rim inside bands' 13.9) | **Keep**, generalised |
| Shallows and wet sand | `TerrainBands.js` (19 tests with the beach) | Yes: the Coast's waterline | 13.9 ms on a full-width shore | **Keep** |
| Wear patches | `TerrainPatches.js` (12 tests) | Yes: earth through grass, as the dormant design had it (meadow 18 %, forest 12 %, `terrainRegistry.js:262-280`); gravel through rock is new, from the research art list (the owner drew `ter_gravel` for it), not from the dormant code | 26.2 ms first build per seed | **Keep**, with the noise taken from cached corner values (four hashes a pixel today). None of this wear existed for the clearing; only the tile-era `hamlet` (grass with 45 % earth, `:306-309`), which the research doc proposed as the clearing, was, and it goes with the other tile-era terrains |
| Tones (fades between two looks on one ground) | `TerrainTones.js` (11 tests) | Not needed in v1: one look per terrain per Region (decision 5), so two looks on one ground never meet; the forest's colour is its own sheet | 14.6 ms | **Goes** with its tests (TD-3 A; git keeps it) |
| One-buffer compose, layering rule (tone < band < wear) | `TerrainSurface.js` (9 tests) | Yes | small | **Keep**, minus tones and per-cell variants |
| Scatter placement | `TerrainProps.js` (17 tests) | Yes: seeded, scattered, back to front, foot-on-its-ground check | 0.2 ms | **Keep**; props become cells of the 4 × 4 sheets, density per look |
| Vocabulary (`SUBSTRATES`, `TERRAIN_TYPES`, art-set switch, variant counts, tile-era terrains `hills`, `farmland`, `hamlet`, `diggings`, `desert`) | `terrainRegistry.js` (11 tests) | Partly | — | **Rewritten** as the five looks over the eight sheets; art-set switch, variants and tile-era terrains go |
| Live tuning | `playmatTuning.js`, `PlaymatTuner.jsx` (9 tests) | Yes: the eye-check's tool | — | **Keep**: drop "Tile bleed", "Bleed smoothness" (tile claims) and the two tone sliders; add mute brightness and saturation; a "Copy values" button so the owner can paste a tuned look into chat |
| Canvas renderer | `TerrainCanvas.jsx` | Its idea (one buffer, one blit, sheets decoded once) yes; its geometry no | — | **Rewritten** (decisions 6–8): screen-pixel grid, CPU canvas, props in the same buffer, no accelerated context, no centred legacy blit |
| Master switch and guards | `terrainRegistry.js:49`, `TerrainOff.test.js`, `MatBoard.jsx:240-243`, `:362`, `ReactRoot.jsx:434-435` | — | — | **Go** in T2 (decision 17) |
| The board's terrain selector | `MatBoard.jsx:240-243` (`state.board.terrain`) | No: terrain lives on the Region | — | **Goes**; the mat reads the active Region's ground |
| The Token terrain stamp | `BoardState.createTokenInstance`'s third argument (`BoardState.js:51`) | No reader | — | **Left alone** (many callers pass it positionally): a ticket |

### B2. Biome weights → the cell map → the ground plan

- **Already built (A4).** `Budget.budget()` blends the Base Maps' points and
  says which terrain each biome's ground is and how much water the maps bring
  (`Budget.js:50-72`, `:161-293`); `Layout.layout()` carves the sea along one
  edge, places the nodes, and gives every cell a terrain that follows them; the
  Region stores the encoded map. Three hybrids generated with the dev recipes
  [measured, cell maps printed]: Forest + Mountain 1,137 grass / 843 rock cells
  in irregular blobs round the ore; Forest + Coast 1,427 grass, 288 sand, 265
  water (13 %) with the sand round the Coast nodes; Mountain + Coast 1,413
  rock, 259 sand, 308 water (16 %). Layouts take 2–8 ms.
- **The reader** (T1): `regionGround(region, mat)` decodes the stored map once
  (cached on the map object, so a load or a travel gets a fresh one) and
  returns its cells and the look of each terrain (decision 5); `terrain: null`
  gives the meadow (decision 3). A device whose Mat
  Tuner made the mat bigger or smaller than the shipped one reads clamped cells
  (`cellIndex` already clamps, `TerrainMap.js:37-41`) until T-097 fixes the size.
- **The ground plan** (T1): from the cells and the Region's seed, one value per
  2-unit pixel: the ground (after the wiggly edges and the beach rim), its band
  (shallows, wet sand), its wear (patches), and the scatter list. Pure; tests pin it.

### B3. Drawing, and what it costs

**What runs when.** [reasoned from the code paths]

| Event | Work | Cost |
|---|---|---|
| A frame, hands off | none: the picture is a cached display item in the mat's own layer | ~0 script; raster of the tiles that something else invalidated draws the picture under them on the GPU raster threads |
| A drag | none for the ground; T4's grid is drawn once at pickup (≤ 1,980 cells) | well under 1 ms [reasoned] |
| Travel or load | the plan (≈ 495,000 pixels) and a screen pass | dormant code scaled to the plan's size, without tones, ≈ 103 ms at 1× the first time [measured per pixel, scaled by area], ≈ 56 ms once the wear noise reads cached corners [reasoned]; ×4 at the slow-laptop throttle |
| Window resize | a screen pass, 250 ms after the fit stops changing | a copy loop of 0.5–1.1 M ground pixels: ~5 ms at 1× [measured]; plus `putImageData` and one upload |
| A tuning slider (dev) | the plan and a screen pass | as travel |

**Ground pixels on screen.** The screen pass's grid is `boardScaleAt(fit)`
units a pixel: 880 × 563 at fit 1.0 or 0.5; 660 × 422 at fit 0.75 (art step 2);
the most is just below fit 0.75 (art step 1): 1,302 × 833 ≈ 1.08 M.

**Against "smooth"** (brief 60: ≥ 95 % of frames within 16.7 ms, interval
p99.9 ≤ 33.4 ms, drags' longest frame ≤ 33.4 ms; `cap128` at 4×):
- **Hands-off frames: reasoned no change**, *provided the canvas is not a
  composited layer.* An accelerated canvas would be one, and every Token drawn
  after it would become a layer by overlap: the T-145 softness and more
  Layerize, already the largest share of a frame (39 % paint and compositing,
  `PERFORMANCE.md:457`). A CPU-backed canvas is painted into its parent's
  layer [reasoned from how Chrome decides what to composite]. **T2 measures**:
  composited layers on `cap128` equal with and without `?off=terrain`
  (`bench:profile`), `bench:crisp` passes, and `bench:draw` on `cap128` at 1×
  and 4× (interleaved A/B, or `--switches`) shows the `terrain` row within
  noise.
- **Drags: reasoned no change** for the ground; T4 measures the grid's pickup
  with `bench:drag --board=cap128` at 1× and `--cpu=4`.
- **One-off builds** are outside "smooth" (no scene travels or resizes) but
  are felt: bars below. If T2 misses them, T6 moves the plan to a worker.

**The build bars** (checked with performance marks in the perf build, on travel
to the Forest + Coast dev Region, the costliest of the three): the plan ≤ 60 ms
and the screen pass ≤ 15 ms at 1× at the bench's window; at 4× together ≤
0.35 s.

**Memory** [reasoned]: the plan's typed arrays ≈ 5 MB while building; the
screen buffer and the canvas 4.3 MB each at the largest grid; the eight sheets
decoded once (128 KB).

### B4. Placement

- **The field**: `standsOn`, a list on the Token type, authored in the CMS's
  Token editor as **"Stands on"** (chips; none ticked = anywhere dry). Values
  per TD-1 A: `water`, `shore`, `grass`, `rock`, `sand`. A Token
  passes if the cell under its centre is any one it lists; `shore` is a dry
  cell touching water (8 neighbours), worked out once per Region.
- **The rule** (T3): `MatPlacement`'s fourth test, after the mat edge and
  crowding, before `Cannot` (`legalIn`, `MatPlacement.js:245-255`; the inline
  test in `findSpot`, `:323-325`; `relax`'s pushes, `:452`; `findSpotAnywhere`;
  and a reason in `whyRefused`, `:651`: "Needs water." and the like, the words
  in one place). A no-op fast path when the type has no list and the Region
  has no water, so a meadow costs one property read per candidate. The failure memo (`:276-293`) adds
  the ground's identity to its stamp.
- **The layout** honours it through the existing seam (`terrainAllows`,
  `Layout.js:133-134`, `:273-275`; `layoutInputs.js:65-77`), widened to say
  whether a cell is shore; a node that needs water stands on water and its cell
  stays water.
- **Shown while placing** (T4): with a Token in the hand, the cells it may stand
  on light up and the others dim, drawn once at pickup under the Tokens, beside
  the landing ring; only when the Token in the hand cannot stand everywhere
  here (TD-5 A).

---

## C. Slices

Each leaves a playable game. "Bench" says what the director runs in a window;
subagents stop at tests, cycles and build.

### T1 — The ground plan, pure (engineer)

- **Files**: `src/systems/board/TerrainLattice.js` (keep `hash01`, the edges, the
  pixel map, distances and the beach rim over `cols × rows` cells of 16
  pixels; delete the tile claims and `LEGACY_*`), `TerrainBands.js`,
  `TerrainPatches.js` (noise from cached corners),
  `TerrainSurface.js` (no tones, no variants), `TerrainProps.js` (sheet cells,
  density per look); delete `TerrainTones.js` (TD-3 A);
  `src/config/registries/terrainRegistry.js` rewritten as the looks and the
  eight sheets (keep `TERRAIN_ENABLED` until T2); `src/config/playmatTuning.js`
  (sliders per B; widths in mat units); new `src/systems/atlas/regionGround.js`
  (B2's reader) and `TerrainMap.decodeTerrain`.
- **Tests first**: the plan of a stored map is the same on every build and
  changes with the seed; every cell's pixels are its terrain except within the
  edge swing of a boundary; two neighbouring boundaries meet without a step
  (the junction contract, re-based); water never meets grass or rock without
  the beach rim; shallows only on water beside land, wet sand only on sand
  beside water; wear covers what its coverage says (calibrated) and never
  crosses onto the sand; the ground round the Hall is plain ground (no
  clearing); no prop stands with its foot off its own ground or on water; the
  meadow default for `terrain: null`; a hybrid's grass takes the forest look
  and its rock the mountain look; a 55 × 36 map decodes back to what
  `encodeTerrain` wrote. The existing suites are rewritten for the new shapes
  (say which test changed and why); the tile-claim and tone tests go with
  their code.
- **Done when**: tests green; the plan of the Forest + Coast dev Region builds
  in ≤ 60 ms in Node (a printed figure in the report).
- **Bench**: none (nothing at runtime calls it yet). **Eye-check**: no.
- **Parallel**: with T3 (no shared file). **Waits for**: nothing (TD-2 and
  TD-3 answered A).

### T2 — The ground on the mat (engineer)

- **Files**: `src/ui/components/board/TerrainCanvas.jsx` (rewritten: the screen
  pass at `boardScaleAt(fit)` from `MatFitContext`; the sheets muted once; CPU
  canvas; scatter, corners and vignette in the picture; rebuild on Region,
  tuning, art step or fit as B3 says), `MatBoard.jsx` (mount from the active
  Region's ground on `ATLAS_CHANGED`, `GAME_RESET` and `STATE_CHANGED`; the
  board selector goes; the surface's inset shadow moves into the picture while
  the ground is drawn), `src/ui/dev/perf/drawSwitches.js` (`terrain`),
  `terrainRegistry.js` (`TERRAIN_ENABLED` goes) with `src/tests/TerrainOff.test.js`,
  `ReactRoot.jsx` (the Tuner in dev builds), `PlaymatTuner.jsx` (no art-set
  toggle; Copy values), `engineEvents.js` (the art-set event becomes a tuning
  event), `FreeMatGuards.test.js` (the allow-list goes), new
  `src/ui/dev/TerrainDevSection.jsx` in `TestDashboard.jsx`: **buttons that
  settle a dev Region for free and travel there** (Forest, Mountain, Coast,
  Forest + Mountain, Forest + Coast, Mountain + Coast), **Reroll it**, and
  **Back to the Starter Camp**, so every eye-check view is a click.
- **Tests first**: the ground's 2D context is asked for with
  `willReadFrequently: true`, and the canvas carries no `will-change` or filter
  (`MatPixelLayers.test.js` gains these); the ground pixel is
  `boardScaleAt(fit)` units for fits 0.5–1.6; 100 engine ticks rebuild nothing;
  a travel rebuilds once; a fit change runs one screen pass and no plan
  rebuild; the switch off mounts nothing; pixels outside the mat's rounded
  corners are clear.
- **Done when** (dev build, in the game): the Starter Camp shows meadow; each
  dev Region shows its biome's ground, the hybrids blend;
  at two window sizes a zoomed screenshot shows ground pixels the size of
  Token pixels; no console error.
- **Bench** (director, a window): `bench:crisp` passes; `bench:profile
  --scene=cap128 --cpu=4` layer count equal with and without `?off=terrain`;
  `bench:draw` on `cap128` at 1× and 4×, the ground on against off (interleaved),
  within noise; the build marks against B3's bars; a cost-log line. Engine
  bench: no engine file changes.
- **Eye-check**: **yes, TM1** (the look). **Waits for**: T1.

### T3 — Terrain in placement (engineer)

- **Files**: `src/config/registries/tokenRegistry.js` (`standsOnOf`),
  `src/systems/atlas/TerrainMap.js` (the `STANDS_ON` words and
  `allowsTerrain`, importable by the CMS like `TERRAIN` is), new
  `src/systems/board/GroundRules.js` (the active Region's decoded cells and
  shore mask, fast path, reset when the board is swapped or loaded),
  `MatPlacement.js` (B4), `layoutInputs.js` and `Layout.js` (the seam),
  `ContentAudit.js` (a `standsOn` word the game does not know; a map node whose
  `standsOn` its biome's ground can never give).
- **Tests first**: a water-only Token is refused on land and lands on water; a
  shore Token lands only on dry cells touching water; a Token with no list is
  refused on water and allowed everywhere dry; a drop on a forbidden cell
  nudges to the nearest allowed spot within reach, else flies back saying why;
  a push never shoves a Token onto a cell it may not stand on; a Shop arrival
  and a spawn land on allowed cells; travel resets the cached ground; the
  layout puts a water node on water and never a dry node there; **a meadow
  Region's placements are exactly today's** (same spots for the same calls);
  the audit lines.
- **Done when**: tests; cycles; build.
- **Bench**: `npm run bench -- --compare` exit 0, same work (decision 15); S7
  (the waiting room, placement-heavy) timing within noise.
- **Eye-check**: no (nothing shows until T4). **Parallel**: with T1 and T2.
  **Waits for**: nothing (TD-1 answered A).

### T4 — "Stands on" in the CMS, and the grid while placing (builder)

- **Files**: `cms/src/components/editors/TokenEditor.jsx` ("Stands on" chips in
  the Lifecycle section beside Landmark), a CMS round-trip test (verified on a
  throwaway route only, TESTING "The CMS"), new
  `src/ui/components/board/TerrainGridOverlay.jsx` (one small canvas, cells light
  or dim for the Token in the hand, drawn at pickup and cleared at drop, under
  the Tokens), `MatBoard.jsx` (mount beside `MatRings`), the refused-drop
  callout's text, and in the Terrain dev section three dev-only test Tokens
  (needs water, needs shore, needs rock) placed by a button.
- **Tests first**: the overlay draws only while a Token is in the hand and per
  TD-5; allowed cells are exactly those T3 allows; the CMS keeps `standsOn`
  through a Sync and drops an empty list.
- **Done when**: in the game, each dev test Token dragged over a Coast hybrid
  lights the right cells, a drop on a dim cell flies back with its reason, and
  an ordinary Token on the meadow shows what TD-5 says.
- **Bench**: `bench:drag --board=cap128` (plain, and `--cpu=4`): pickup's longest
  frame within noise of `main`. **Eye-check**: **yes, TM2**, with the owner's
  first "Stands on" in the CMS. **Waits for**: T2, T3 (TD-1 and TD-5 answered A). An engineer
  takes it instead if the pickup misses.

### T5 — The look's fix round (builder)

The owner's TM1 and TM2 verdicts: tuned numbers (pasted from the Tuner's Copy
values) into the look table, scatter density, beach and band widths. On the T2/T4 branch before
it merges (TESTING item 6). **Eye-check**: yes, a short re-look.

### T6 — The plan in a worker (engineer; only if T2 misses its build bars)

The plan's modules are pure and read no game state; tuning values are passed in.
Built off the main thread, handed back as typed arrays. **Bench**: the build
marks again.

### Docs, as slices land

GDD (Terrain from Dormant to Built, §13; placement's fourth rule in §3),
CHANGELOG, the research doc to `docs/archive/` after TM2 (its §2 is stale, A-1),
the stale comments in A-10, tickets for A-11 and the Token terrain stamp (B).

**T3 result (2026-10-15, `crunch/terrain-t3`).** Built as B4 says. The words,
`allowsTerrain` and the refusal sentence (`needsText`) are in `TerrainMap.js`
(the CMS's chips: `STANDS_ON_CHOICES`); `standsOnOf` drops a word the game
does not know. `GroundRules.js` decodes the active Region's map once per map
object (so travel and a load read afresh, even mid-travel) and returns null for
a Token with no list on a Region with no water, the fast path every meadow and
bench board takes. `MatPlacement` asks it in `legalIn`, `findSpot`, `relax`
(the newcomer's own spot, and every shoved Token), `whyRefused` (before
`Cannot`) and the failure memo's stamp; an arrival with no cell at all here
says what it needs. The layout seam is told which dry cells are shore, groves,
camps and treasures start on ground their Token may stand on, and a node in the
water keeps its cell water. Two fingerprints recorded before the rule existed
pin a meadow's placements and a list-free layout to the bit. Not covered: a
`here` spawn replaces its bearer on the very spot and skips every placement
rule, as it always has.
**T1 result** (2026-10-15, `crunch/terrain-t1`; nothing calls it yet, so no
CHANGELOG line).
- **Built**: `regionGround(region, mat)` (B2's reader; decodes once per stored
  map object, meadow for `terrain: null`), `TerrainMap.decodeTerrain`, and
  `TerrainSurface.buildGroundPlan(ground)`: per 2-unit pixel, row by row, the
  terrain (`terrainAt`), wear (`wearAt`), bands (`bands[].mask`) and the
  drawing answer the screen pass samples (`sheetAt` into `sheets`, `tintAt`
  into `tints`), plus the props (`{sheet, index, x, y}` in plan pixels, `index`
  the cell of the 4 × 4 sheet, back to front). `muteTexels` bakes the mute into
  a decoded sheet. The registry is the five looks over the eight sheets and
  seven prop sheets. `TerrainTones` and the tile claims are gone.
- **Tuning**: the beach, shallows and wet-sand widths and the wear clump size
  are sliders in mat units (three widths, not one multiplier: the shallows and
  the wet sand differ); mute brightness and saturation added; the tile and
  tone sliders gone. The ground's drawing subscribes with `onTuningChanged`;
  the art-set event is retired (nothing listened once the canvas stopped).
- **Measured** (Node 24 on this PC at 1×, other sessions loading it ~30 %):
  the Forest + Coast dev Region's plan, 880 × 563, **7–10 ms warm, 30–33 ms the
  first build in a fresh process** (`npx vitest bench --config
  bench/micro/vitest.config.mjs --run bench/micro/groundPlan.bench.js` prints
  both). The first straight port of the dormant pipeline (`03013203`) measured
  24–29 ms warm and 68–78 ms cold, interleaved with the final code; the
  difference is mostly distances that walk out from the edges between
  terrains instead of from every pixel. Not measured: the browser.
- **For T2**: `TerrainCanvas.jsx` is a stub that draws nothing and the Tuner
  lost its art-set toggle (both needed for the build once the art-set switch
  went). `sheets[p]` is palette entry `p`'s sheet, so a sheet can be listed
  twice and an unused legend terrain's sheet is listed too.

---

## D. Owner questions (one batch)

Only what the plan cannot settle. Recommendation first.

### Owner answers (chat, 2026-10-14)

| Q | Answer | Date |
|---|---|---|
| TD-1 | **A**: Water, Shore, Grass, Rock, Sand; nothing ticked means anywhere dry. | 2026-10-14 |
| TD-2 | **A**: `ter_grass` is meadow, `ter_grassb` forest ground, `ter_water` the sea; `ter_waterb` waits. | 2026-10-14 |
| TD-3 | **A**: one forest look per Region, whatever trees grow on it. | 2026-10-14 |
| TD-4 | **Struck, neither option**: "No worn clearing. I've never suggested there was. The terrain is static." There is no clearing at all; the research doc's L-9 answer was recorded wrongly (amended there). | 2026-10-14 |
| TD-5 | **A**: the grid shows only when the Token in the hand cannot stand everywhere here. | 2026-10-14 |

The questions as asked, kept for the record:

**TD-1. Which grounds can a Token ask for in "Stands on"?**
- **A (recommended)**: **Water, Shore, Grass, Rock, Sand.** Shore means dry
  land touching the water, so a Dock stands at the water's edge (half its
  picture over the sea), a Sailboat on Water, a Mineshaft on Rock. Tick
  several to allow several. Nothing ticked: anywhere dry.
- B: Only the four grounds (Grass, Rock, Sand, Water). Simpler, but a Dock "on
  Sand" could stand far up the beach, away from the water.
- C: Biomes instead (Forest, Mountain, Coast). Reads naturally, but a Coast
  Region's grass and sand are both "Coast", so it can't put a Dock by the water.

**TD-2. What are the two "b" sheets for?** (`ter_grassb` is your grass in a
darker green; `ter_waterb` is your water in a bright blue.)
- **A (recommended)**: **`ter_grass` is meadow** (the Starter Camp) and
  **`ter_grassb` is forest ground**, so a Forest Region looks a little deeper
  than the camp; **`ter_water` is the sea**, and `ter_waterb` waits (it is much
  brighter than the muted, slightly dark look you chose in L-7; it could be a
  lake later).
- B: They are alternates of the same ground: the game picks one of each pair
  per Region, for variety.
- C: Something else: tell us.

**TD-3. Should a Fir Grove look different from an Oak forest?**
- **A (recommended)**: **Not in this rework.** A Region's forest ground is one
  look whatever trees grow on it. Cheaper to build and to draw; a modifier
  could tint its ground later.
- B: Yes: the ground round the firs goes darker and colder and fades into the
  oak ground (your September "tones", kept and re-tuned). Adds drawing time to
  every Region build.

**TD-4. The worn clearing round the Guild Hall, now that you can move the Hall:**
- **A (recommended)**: **The clearing is ground: it stays at the centre**, where
  every Region's Hall starts. Move the Hall and the worn patch reads as the old
  camp site.
- B: The clearing follows the Hall: the ground is redrawn when you drop it
  somewhere new (a short pause on a slow laptop, each time).

**TD-5. When does the grid show while you place a Token?**
- **A (recommended)**: **Only when the Token in your hand can't stand
  everywhere here**: it needs a ground, or the Region has water. Then the cells
  it may stand on light up and the rest dim. Most drags on the Starter Camp show
  no grid.
- B: On every Token drag, everywhere.
- C: Only for Tokens with a "Stands on"; a plain Token dropped on the water just
  flies back with "Needs dry land".

### Owner to-do

**CMS** (after T4 merges):
1. Tick "Stands on" on the Tokens that need a ground. Your call; candidates
   today: Coast and Shrimp Coast (Shore?), Copper and Coal Mine (Rock?). Later,
   the Dock (Shore), the Sailboat (Water) and the Mineshaft (Rock) once they
   exist.
2. When you author map items: each Base Map's "Ground" and "Water" fields
   already exist in the Map editor (A5); left blank they use the biome's
   (forest grass, mountain rock, coast sand with 30 % water).

**Art** (none blocks the build):
1. ~~Answer TD-2.~~ Answered A, 2026-10-14.
2. Optional: an alternate sheet per ground (used one per Region), only if the
   repeat shows at the eye-check.
3. Optional scatter still missing from the research list: rock cracks,
   driftwood, reeds, twigs and leaves as 16-px pieces. Some exist in your
   generator sheets (`props/sheets/`), which the game does not read: cut them
   into a 4 × 4 sheet like the others if you want them.
4. Sea animation frames: not until the cost log allows (L-8).

---

## E. Notes for the director

### Order

- **Now, in parallel**: **T1** (pure, `crunch/terrain` in `terrain`) and **T3**
  (placement, its own worktree and branch; mergeable to `main` on the gate,
  nothing shows). No shared file.
- **Then T2** on `crunch/terrain` after T1; it is the first slice with a look,
  so it waits for TM1 before merging. T1 can merge on the gate on its own
  (nothing calls it) or ride with T2.
- **Then T4** after T2 and T3 (TD-1 and TD-5 are answered); TM2.
- **T5** inside the TM1/TM2 fix rounds; **T6** only on a missed bar.

### Eye-check milestones

- **TM1** (T2): the Starter Camp's meadow (the owner's slot), then
  the six dev Regions from the Terrain dev section, the Tuner open beside them;
  checks: the mute, ground pixel size against the Tokens, edges, the beach,
  shallows and wet sand, wear, scatter, the corners, the repeat.
- **TM2** (T4): the three dev test Tokens dragged over a Coast hybrid; the grid;
  a refused drop's words; the owner ticks a first "Stands on" and Syncs.

### Risks

1. **Compositing.** An accelerated canvas becomes a layer and drags every Token
   above it onto layers (the T-145 fault, more Layerize). Guard: the CPU
   context, the `MatPixelLayers` tests, `bench:profile`'s layer count, `bench:crisp`.
2. **The one-off build** at 4× (travel, resize).
   Bars in B3; T6 if missed.
3. **Uneven edge steps**: the plan is at 2 units a pixel and resampled to the
   screen grid, so where a screen ground pixel is smaller than 2 units (fits
   0.5–0.74, 1.0–1.24, 1.5–1.74) a 1-pixel wiggle becomes 1 or 2 ground pixels.
   Never finer than the ground's own pixel (the September warning,
   `terrainRegistry.js:65-69`), but irregular. If TM1 sees it: build the plan on
   the screen grid instead (a plan rebuild on every resize; costlier).
4. **Stored maps are permanent.** Any later change to how `Layout.js` makes
   ground applies to new Regions only, and must not move a node
   (`AtlasLayout.test.js`, `AtlasTerrain.test.js` pin determinism).
5. **Mat size is still per device** (T-097): the ground reads clamped cells on a
   resized mat; placements on a bigger mat's extra rim follow the edge cells.
6. **Walking over water** (A-11), and floor loot dropped near a shore Token may
   land on a water cell: look only; a ticket.
7. **Shared files with later briefs**: brief 120 C1/C2 change the mat layer and
   hover (`MatBoard.jsx` neighbours, the draw cost log). Keep T2's and C1's
   draw measurements in separate windows; merge in order.
8. **DPR**: the whole-pixel rule is in CSS pixels, so at Windows scaling of
   125 % Tokens and ground alike come out uneven; that is the sprite rule's
   limit, not this brief's.
9. **CMS checks** on a throwaway route only: a test "Stands on" left in the real
   workspace is synced into `data/`.

### Bookkeeping this unlocks

- GDD: Terrain Built; placement's fourth rule. CHANGELOG per merged slice.
- New tickets: heroes and enemies stroll over water (A-11); the unused Token
  terrain stamp (`BoardState.createTokenInstance`'s third argument).
- T-090 (terrain through the CMS) stays open: the looks live in code.
- Archive `research/terrain_art_list.md` after TM2.
