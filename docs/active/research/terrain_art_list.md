# Terrain art list: what to draw for the first biomes

Read-only research for brief 80's T0 phase, pulled forward so the art can be
drawn long before the terrain code runs (`docs/active/ideas.md`, "Owner art
list"). Nothing here is built or decided. The code still follows the Atlas.

What it rests on:

- **Decided**: terrain paints each Region's biome from its Base Maps and
  blends hybrids (`concept_atlas.md`, owner decisions; brief 80). The first
  Base Maps are **Forest, Mountain, Coast** (`atlas_roadmap.md` §D, D-3). The
  Atlas stores each Region's seed and biome weights for this brief
  (`atlas_roadmap.md:239-240`, `:638`).
- **Mood**: cozy fairytale plus RuneScape; the early game fully cozy, later
  planes stranger (`concept_tone_and_world.md`). The board is largely still,
  with pops of activity.
- **Terrain today is Dormant** (`GDD.md:91`, `:524`).

Nothing was measured for this note: the game, dev server and benches were not
run (another session is measuring). Code claims cite file:line. Numbers marked
**archived** come from the September terrain roadmap
(`docs/archive/dynamic_terrain_roadmap_v1.md`), read only to avoid re-asking
questions the owner already answered; the rest is **reasoned**.

## 1. The short version (for the owner)

- **You already have the ground.** Grass, earth, rock, sand and water exist,
  each in two pixel sizes, with 64 × 64 source sheets (section 2).
- **Edges and blends need no drawing** if the game keeps working out where two
  grounds meet, as you chose in September (D-T13, archived roadmap line 29).
  Hybrid maps then need nothing extra.
- **What's new to draw** is small: a gravel ground for Mountain, the chunky
  sand sheet (if you keep the chunky pixel size), and about 20 small scatter
  pieces (flowers, pebbles, shells…). Section 4 lists them.
- **Ten look questions** decide the rest (section 5). The first one, pixel
  size, changes which existing files count; answer it first.

## 2. Ground art that exists today

All in `public/assets/playmat/` (Git LFS). Sizes read from the PNG headers.

### Ground pieces (the dormant terrain draws these)

| Ground | Chunky set "b" (8 × 8 px pieces) | Fine set "a" (16 × 16 px pieces) | Source sheet (64 × 64 px) | What it looks like |
|---|---|---|---|---|
| Grass | `terrain/ter_grassb0`–`7` (8) | `terrain/ter_grass0`–`5` (6) | `terrain/template/ter_grassb.png`, `ter_grass.png` | Mid green with lighter flecks; 6–11 colours a piece |
| Earth (dirt) | `ter_dirtb0`–`3` (4) | `ter_dirt0`–`5` (6) | `template/ter_dirtb.png`, `ter_dirt.png` | Dark brown speckle |
| Rock (stone) | `ter_stoneb0`–`7` (8) | `ter_stone0`–`5` (6) | `template/ter_stoneb.png`, `ter_stone.png` | Grey cobbles with dark cracks |
| Sand | `ter_sandb0`–`3` (4) | `ter_sand0`–`5` (6) | **only** `template/ter_sand.png` (fine); no chunky sheet | Warm yellow with ripple marks |
| Water | `ter_waterb0`–`7` (8) | `ter_water0`–`3` (4) | `template/ter_waterb.png`, `ter_water.png` | Blue with white wave dashes |

- The pieces are **cut from the sheets**: 47 of the 56 pieces that have a
  sheet match a spot in it pixel for pixel (checked with a small script); the
  rest (3 grass, 6 rock, chunky) look touched up. All are fully opaque.
- The sheets **appear to tile seamlessly**: the colour jump across the
  wrap-around seam is about the same as between neighbouring pixels inside the
  sheet (within ~10 %; a heuristic, not proof; not looked at in the game).
- The variant counts are written by hand in `terrainRegistry.js:137-146`;
  `TerrainRegistry.test.js` checks every claimed file exists and is the
  claimed size.

### Scenery (props)

| File | Size | What it is | ⚠️ |
|---|---|---|---|
| `props/prop_tree_oak.png` | 16 × 16 | Small round oak | **Also the Oak Sapling Token's art** (`sprite-manifest.js:57`, `data/tokens.json:2501`, drawn small) |
| `props/prop_tree_maple.png` | 16 × 16 | Small maple | **Also the Apple Sapling's art** (`sprite-manifest.js:50`, `data/tokens.json:2744`) |
| `props/prop_tree_fir.png` | 16 × 16 | Small fir | Terrain only |

Deleting or redrawing these changes the saplings too.

### Old art that is not ground

| Files | Size | What it is | Use today |
|---|---|---|---|
| `tiles/pm_board_forest_1`–`4`, `mountain_1`–`6`, `village_1`, `farmland_irrigated` (+`_l`, `_r`), `flagstone_all`, `flagstone_n/e/s/w` | 128 × 128 | Tile-era board squares. Forest = grey-green framed panels; mountain = cracked stone slabs with chipped edges; village = flagstone paving; flagstone n/e/s/w = paving edge pieces with see-through middles | **Not drawn anywhere** in game code (only path mapping, `AssetManager.js:83-90`, `:119-122`, and the manifest, `sprite-manifest.js:295-325`). Framed, so not usable as ground. The flagstones could become a Hall plaza (question L-9). |
| `tiles/pm_board_guild_hall_1`–`5` | 128 × 128 | Dark stone panel with a faint glow | `_1` is the Guild Hall view's background (`GuildHallBoard.jsx:88`) |
| `tables/pm_board_farmland_rocky_soil`, `pm_table_farmland_soil` | 128 × 128 | Striped soil rows | Not drawn anywhere |
| `../ui/pm_table_forest`, `_mountain`, `_wood_spruce`, `_wood_planks_oak` | 128 × 128 | Wooden table planks (mossy, grey, spruce, oak) | The **table around the mat**, picked in Settings (`SettingsModal.jsx:178-184`, `ReactRoot.jsx:207-212`). Not ground. |
| `../backgrounds/area/*.png` (`bg_beach`, `bg_lush_forest`, `bg_mountains_snowy`, `bg_swamp`, …) | 256 × 256 | Side-view scene paintings with sky | Card and panel backgrounds. **Colour and mood reference only**. |
| `../tokens/fish/token_coast.png`, `../tokens/nature/token_meadow.png`, lakes, puddle | 64 × 64 | Tokens drawn as little 3/4-view blocks of beach, grass, water | Token art. ⚠️ On a real beach the Coast Token may look doubled (question for later, not a defect). |
| `../tokens/map/map_forest`, `map_mountain`, `map_shore`, … | 64 × 64 | Parchment map icons | The map items' icons (Atlas A5), not ground |

### `raw_assets/` (main checkout only, not in git)

`raw_assets/dataset/` holds ~930 source images for the art pipeline
(`scripts/process_art.cjs`: downscale, quantise, palette snap). The only
ground-like **names** are side-view scene sources (`process/backgrounds/bg_beach`,
`bg_mountains_rocky_hills`, `bg_mountains_arid`, `bg_island_tropical`,
`bg_lush_forest`, `bg_swamp`, …). About 650 files are named "Generated Image
<date>" and were **not opened**; the owner would know if any is a ground
source.

## 3. How big things are on the mat

Everything is measured in **mat units (u)**. The mat is 1760 × 1126 u
(`matGeometry.js:37-52`, 11 steps of 160 u).

| Thing | Art size | On the mat | One art pixel is | Evidence |
|---|---|---|---|---|
| A Token | 64 × 64 px | 128 u across (radius 64 u) | 2 u | `matGeometry.js:73-78` |
| A small Token (saplings) | 32 × 32 px slot | 64 u | 2 u (but the saplings use 16 px prop art, so 4 u) | `matGeometry.js:95-115`; `data/tokens.json:2498-2520` |
| Loot on the floor | 32 × 32 px | 64 u | 2 u | `lootFlight.js:9-12` |
| Ground, fine set "a" | 16 px per 32 u square | — | **2 u** (same as Tokens) | `terrainRegistry.js:56-63`, `TerrainLattice.js:71` |
| Ground, chunky set "b" (today's default) | 8 px per 32 u square | — | **4 u** (twice as chunky) | `terrainRegistry.js:56-74` |
| Props | 16 × 16 px | 32 u (fine) or 64 u (chunky) | follows the ground | `TerrainProps.js:44-50` |

On screen the Token art is snapped to whole pixels (64 or 128 screen pixels a
Token, `TokenSprite.jsx:73-83`). A typical screen shows Tokens at 64 px, one
screen pixel per art pixel.

The whole mat in ground pixels: **440 × 282** (chunky) or **880 × 563** (fine).
A Token is 32 chunky or 64 fine ground pixels wide. A 64 × 64 sheet repeats
every 256 u (two Tokens) chunky, or every 128 u (one Token) fine.

## 4. The art list

Status: **HAVE** = exists and fits; **ADAPT** = exists, needs edits; **NEW** =
to draw. Sizes are given for both pixel sizes ("chunky / fine"); question L-1
picks one. Counts are a starting point, not a quota.

Rules of thumb for every piece:

- Ground sheets are **seamless**: four copies in a 2 × 2 square show no seam.
  The pipeline's downscale can break the wrap, so check after processing.
- Keep each ground to **6–10 colours**, like today's pieces (measured 4–16).
- Ground stays **quieter than Tokens** (lower contrast, no dark outlines), so
  Tokens, heroes and loot read on top (L-7).
- Scatter must **not look workable**: no tree, ore or rock that a player would
  try to chop or mine (L-6).

### Forest (Oak, berries)

| Piece | What | Size (chunky / fine) | Status | Covered by |
|---|---|---|---|---|
| Grass ground | The base | sheet 64 × 64 / 64 × 64 (128 × 128 if fine, to repeat less) | **HAVE** | `ter_grassb` sheet + 8 pieces / `ter_grass` sheet + 6 pieces |
| Worn-earth patches | Bare earth showing through in clumps; placed by code | sheet 64 × 64 | **HAVE** | `ter_dirtb` / `ter_dirt` |
| Forest colouring | Forest grass a shade warmer than meadow; Fir Grove darker and colder | — | **HAVE** (a tint in code, no art) | `terrainRegistry.js:265-279` |
| Forest floor (optional) | Darker green-brown with leaf litter, if the tint alone looks flat | sheet 64 × 64 | **ADAPT** from the grass sheet | — |
| Grass alternates (optional) | 1–2 more grass sheets so the repeat hides | 64 × 64 | **NEW** | — |
| Wildflowers | 2–3 kinds, a few pixels each | 8 × 8 / 16 × 16 | **NEW** | — |
| Ferns and grass tufts | 2 | 16 × 16 / 32 × 32 | **NEW** | — |
| Mushrooms | 1–2 small clusters | 8 × 8 / 16 × 16 | **NEW** | — |
| Fallen leaves, twigs | 1–2 | 8 × 8 / 16 × 16 | **NEW** | — |
| Decorative trees | Only if L-6 is B | 16 × 16 / 32 × 32 | **HAVE** (chunky) / **ADAPT** (fine: redraw at 32 px) | `prop_tree_oak`, `_maple`, `_fir` (⚠️ sapling art) |

### Mountain (Copper, Coal, Stone)

| Piece | What | Size (chunky / fine) | Status | Covered by |
|---|---|---|---|---|
| Rock ground | The base | sheet 64 × 64 | **HAVE** | `ter_stoneb` sheet + 8 / `ter_stone` sheet + 6 |
| Gravel (scree) | Lighter loose stones, worn through the rock in clumps the way earth shows through grass | sheet 64 × 64 | **NEW** (or **ADAPT** from the rock sheet) | — |
| Earth patches | Optional, same as Forest | sheet 64 × 64 | **HAVE** | `ter_dirtb` / `ter_dirt` |
| Rock alternates (optional) | 1–2 more | 64 × 64 | **NEW** | — |
| Pebbles | 2–3, tiny | 8 × 8 / 16 × 16 | **NEW** | — |
| Cracks | 2 flat crack marks | 16 × 16 / 32 × 32 | **NEW** | — |
| Hardy grass tufts | 1–2 | 8 × 8 / 16 × 16 | **NEW** (or reuse Forest tufts, recoloured) | — |
| ⚠️ Avoid | Boulders and crystals: the Stone Outcrop and ore veins are Tokens | — | — | — |

### Coast (the Coast fishing spot)

| Piece | What | Size (chunky / fine) | Status | Covered by |
|---|---|---|---|---|
| Sand ground | The beach | sheet 64 × 64 | **ADAPT** (chunky: only 4 cut 8 × 8 pieces, no sheet) / **HAVE** (fine) | `ter_sandb0`–`3` / `ter_sand` sheet + 6 |
| Sea | The water | sheet 64 × 64 | **HAVE** | `ter_waterb` sheet + 8 / `ter_water` sheet + 4 |
| Shallows, wet sand | Pale water at the shore, darker sand at the waterline | — | **HAVE** (a tint in code; you chose a tint over drawing in September, archived roadmap line 444) | `terrainRegistry.js:282-316` |
| Beach rim | Water never meets grass directly: code always puts sand between (your September rule, archived line 463) | — | **HAVE** (code) | `terrainRegistry.js:312-315`, `TerrainLattice.js:607-650` |
| Drawn shallows / wet sand (optional) | Only if the tints look wrong in the eye-check | sheet 64 × 64 each | **NEW** | — |
| Foam line (optional) | White froth at the waterline | — | code first (a third tint band), art only if that looks wrong | not built |
| Shells | 2 | 8 × 8 / 16 × 16 | **NEW** | — |
| Starfish | 1 | 8 × 8 / 16 × 16 | **NEW** | — |
| Driftwood | 1 | 16 × 16 / 32 × 32 | **NEW** | — |
| Seaweed | 1 clump | 8 × 8 / 16 × 16 | **NEW** | — |
| Reeds at the water's edge | 1–2 | 16 × 16 / 32 × 32 | **NEW** | — |
| Sea animation | Only if L-8 is B or C: 2–4 frames per sea sheet | 64 × 64 each | **NEW** | — |

### Blends between two biomes (hybrid maps)

With computed edges (L-3 A), **nothing new is needed for any pair**:

| Pair | What the code does | Optional art |
|---|---|---|
| Forest + Mountain | Wiggly grass-to-rock edge; earth patches | A "grassy rock" sheet (rock with grass tufts) to soften the meeting: **ADAPT** |
| Forest + Coast | The beach rim appears on its own; grass-to-sand edge | none |
| Mountain + Coast | Rock can meet the sea as a cliff, or go through a beach (one setting, `except`, `terrainRegistry.js:205-206`, `:315`) | Wet-rock scatter: **NEW**, 1–2 pieces |
| Two forests (Oak + Fir) | Same grass, colours fade into each other | none |

If edges are **drawn** instead (L-3 C), each pair of grounds that meet needs
its own edge set, about **16 pieces** for a basic set. The first three biomes
meet in 6–7 pairs (grass/earth, grass/rock, grass/sand, sand/water, rock/sand,
rock/water, earth/rock): **~100 pieces**, per pixel size.

### Every Region

| Piece | What | Status |
|---|---|---|
| Clearing round the Guild Hall | Worn earth round the Hall at the centre of every Region (L-9) | **HAVE** (earth ground; the old `hamlet` setting is grass with 45 % earth, `terrainRegistry.js:298-301`) |
| Stone plaza (only if L-9 is B) | Paving round the Hall | **ADAPT** from `pm_board_village_1` and `pm_board_flagstone_n/e/s/w` (redraw at ground pixel size) |
| Starter Camp ground | Meadow (L-10) | **HAVE** (grass + earth; `terrainRegistry.js:254-260`) |

### Totals (if every recommendation is taken)

About **2 ground sheets** (gravel, chunky sand) and **~20 scatter pieces**,
plus optional alternates (1–2 per ground). Everything else exists.

Later planes reuse the same recipe: one ground sheet or two, a colour tint and
a handful of scatter per biome, with stranger palettes the deeper the guild
goes.

## Owner answers (2026-10-09)

| Q | Answer |
|---|---|
| L-1 | **B, same as Tokens, with muted colours** (decided from `terrain_mockup.html`, 2026-10-09): one ground pixel = one Token pixel (the 16 px / `ter_*.png` set), muted to about `brightness(0.85) saturate(0.7)` of today's colours. Past attempts looked off from chunky pixels and a too-bright palette. The chunky (8 px) set is retired. |
| L-2 | **A**: one seamless sheet per ground, plus 1–2 alternates. |
| L-3 | **A**: computed wiggly edges (the September tuning). |
| L-4 | **A**: the ground follows the nodes. |
| L-5 | **Replaced by a terrain grid** (below). |
| L-6 | **A**: small flat bits only (flowers, pebbles, shells, tufts). |
| L-7 | **A**: muted and a little dark. |
| L-8 | **A**: still at first; a little water shimmer later if the cost log allows. |
| L-9 | **A**: a worn-earth clearing round the Hall. |
| L-10 | **A**: the Starter Camp is meadow (grass with worn earth). |

**The terrain grid (owner idea, 2026-10-09, "thinking out loud" but answered
as below):**
- **The ground is a grid of cells, each with a terrain type** (grass, rock,
  sand, water…), drawn from the cells. **Tokens stay freely placed** on top
  (not a return to the tile board); the cell under a Token's centre is its
  terrain.
- **Some Tokens require a terrain**, set per Token in the CMS: a Dock on the
  coast, a Sailboat on water, a Mineshaft in the mountains. Everything else
  goes anywhere dry.
- **The grid shows only while placing**: allowed cells light up, forbidden ones
  dim (alongside D4's adjacency preview).
- ⚠️ For brief 70 (A4 generation) and brief 80: a generated Region needs a
  terrain cell map that the nodes and the ground agree on (L-4), and placement
  must check it. The dormant code's cell lattice (`TerrainLattice.js`) may be
  the starting point.

## 5. Look questions for the owner

Recommendation first in each. Answer L-1 first: it decides which existing
files count.

**L-1. How big are the ground's pixels?**
- **A (recommended)**: **Chunky, today's default**: one ground pixel is two
  Token pixels (the 8 px set). Calmer behind the Tokens, half the drawing, and
  it matches the Oak Sapling's chunky look. The ground's pixels are bigger than
  the Tokens' (some pixel artists avoid mixing sizes). Ready: grass, earth,
  rock, water; sand needs its sheet. You drew this set after the fine one in
  September and it became the default, but the choice was never closed
  (archived roadmap D-T15 calls the switch scaffolding).
- B: **Same as Tokens**: one ground pixel is one Token pixel (the 16 px set).
  One consistent pixel grid; busier behind the Tokens; the texture repeats
  twice as often unless sheets grow to 128 px. Ready: all five grounds.

**L-2. How is each ground drawn?**
- **A (recommended)**: **One seamless sheet per ground** (like today's
  64 × 64 sheets) plus 1–2 alternates; the game reads it by position. Fewest
  files, no square grid. Needs a small change to the drawing code.
- B: **Many small pieces** shuffled per square (today's 8 or 16 px pieces).
  Already exists; may show faint square seams (not checked in the game).
- C: **One painted picture per biome**, mat-sized (440 × 282 chunky,
  880 × 563 fine). Full control; a lot of drawing; every Forest looks the
  same; hybrids blend badly.

**L-3. How do two grounds meet?**
- **A (recommended, your September choice)**: **Computed wiggly edges**, as
  you tuned them then ("middle ground", `TerrainLattice.js:303-304`). Nothing
  to draw; the edge's character is tuned with sliders, not a pencil.
- B: **Softer**: a fade or dither over a few pixels. Nothing to draw; less
  crisp.
- C: **Hand-drawn edge pieces**: ~16 per pair, ~100 for the first three
  biomes. In September a prototype found that matching wiggly edges need
  ~200 files per direction (archived roadmap §2.5).

**L-4. How does a hybrid Region (two or more Base Maps) look?**
- **A (recommended)**: **The ground follows the nodes**: rock round the ore,
  grass round the trees, sea and beach on the coast side, wiggly edges in
  between. Reads as one place; ground and nodes always agree.
- B: **Big zones by weight**, regardless of nodes (e.g. 60 % forest on the
  left, 40 % mountain on the right). Simple; a copper vein can stand on grass.
- C: **One main ground with patches of the others** mixed through. Softest;
  reads as one place with variety more than as two biomes.

**L-5. Where is the sea on a Coast Region?**
- **A (recommended)**: **A strip of sea along one edge** of the mat, with a
  beach; nothing can be placed on the water and the map keeps nodes off it.
  Clearly a coast; needs a rule that shrinks where Tokens may go.
- B: **Lakes or inlets inside the mat**. The most interesting; the most engine
  work (layout and dropping must avoid water).
- C: **No sea in the ground**: Coast Regions are sand and grass, and water
  lives only in the Coast Tokens. No engine work; reads less like a coast.

**L-6. What decorates the ground?**
- **A (recommended)**: **Small flat bits only** (flowers, pebbles, shells,
  tufts) that can't be mistaken for Tokens. It stays clear what can be worked.
- B: **Also decorative trees and boulders** (today's tree props). Fuller;
  players may try to chop a scenery tree, and the oak and maple are also the
  saplings' art.
- C: **Nothing**. Cleanest; plainest.

**L-7. How loud is the ground?**
- **A (recommended)**: **Muted and a little dark**, so Tokens, heroes and loot
  stand out (today the mat is a dark see-through surface,
  `MatBoard.jsx:349-361`).
- B: **Bright storybook colours** like the scene paintings. Prettier; small
  loot may get lost.

**L-8. Does the ground move?**
- **A (recommended)**: **Still at first**; a little water shimmer later if the
  cost log allows.
- B: **Animated sea from the start**: 2–4 frames per sea sheet, and a drawing
  cost every frame to measure.
- C: **Sea and swaying plants**. The most alive; the most frames and cost.

**L-9. What surrounds the Guild Hall?**
- **A (recommended)**: **A worn-earth clearing** (from the earth ground;
  nothing to draw).
- B: **A stone plaza**, adapted from the old flagstone pieces.
- C: **Nothing special**.

**L-10. What ground does the Starter Camp have?**
- **A (recommended)**: **Meadow**: grass with worn earth (art exists).
- B: **Forest**.
- C: **Chosen on the Starter Camp page in the CMS** (a ground choice there;
  small CMS work).

## 6. The dormant terrain code: what survives

Switched off by one constant, `TERRAIN_ENABLED = false`
(`terrainRegistry.js:49`); while off nothing paints (`BoardState` has no paint
hook, `TerrainOff.test.js:49-64`), the canvas isn't drawn
(`MatBoard.jsx:239-242`, `:363`) and the MAT tuning panel is hidden
(`ReactRoot.jsx:428-429`). Its save fields left the board
(`StateSchema.js:81-82`). The pure logic and its 8 test suites still run.

### Reusable for "paint each Region's biome, blend hybrids"

| Part | Where | Why it fits | What it needs |
|---|---|---|---|
| Stable noise | `hash01`, `TerrainLattice.js:108-116`; `variantAt`, `:240-243` | Same picture on every load from a seed (the Region's seed) | Nothing |
| Wiggly edges | `edgeProfile`, `edgeStrips`, `TerrainLattice.js:337-428` | Works on any grid of ground ids; owner-tuned | The grid's size as width × height |
| Art-pixel map, distances, beach rim | `resolveArtPixels`, `distanceFromSeeds`, `applyFringes`, `TerrainLattice.js:447-650` | Coasts, beaches and every distance-based effect build on it | Square `size × size` everywhere (`:449`, `:464`, `:525-527`) becomes width × height |
| Shallows and wet sand | `TerrainBands.js:52-106` | The Coast's waterline | Nothing |
| Patches | `TerrainPatches.js:91-161` (value noise, calibrated coverage) | Earth through grass, gravel through rock; could also mix hybrids (L-4 C) | Nothing; its noise cache is per size and seed (`:49`) |
| Colour fades | `TerrainTones.js:53-178` | Oak vs Fir forest; fades between biomes on the same ground | Nothing |
| One-buffer compose | `TerrainSurface.js:32-145` | Layering rules (tint, band, patch) are data and tested (`:104-127`) | Loops over `LATTICE_SIZE` (`:87-96`, `:131-142`) become width × height |
| Scatter placement | `TerrainProps.js:63-127` | Seeded, sorted back to front; drops a prop whose foot isn't on its own ground (`:104-108`) | The lattice loop (`:71-72`); new scatter ids |
| Canvas renderer | `TerrainCanvas.jsx:98-225` | One canvas, one buffer, one blit; redraws only when its inputs change (`:213`) | See "dead" below; sprite stride assumes piece size = cell size (`:67`, `:161`), so whole sheets (L-2 A) need a sampling change; at most 16 variants (`:138-140`) |
| Vocabulary | `SUBSTRATES`, `TERRAIN_TYPES`, `terrainRegistry.js:137-317` | `meadow`, `forest`, `fir_forest`, `mountain`, `shore`, `ocean` map onto the biomes | Prune; add gravel and scatter |
| Live tuning panel | `PlaymatTuner.jsx`, `playmatTuning.js` (13 sliders; the two "owner" sliders tune the dead tile claims) | For the eye-check | Unhide with the switch |

### Dead or tile-era

| Part | Where | Why |
|---|---|---|
| Tile claims by paint order | `ownerOf`, `claimants`, `resolveLattice`, `TerrainLattice.js:131-260` | Decides which of 36 **tiles** owns a square, newest drop winning (archived D-T3). No tiles on the free mat; a Region's ground comes from its seed and layout instead. |
| The 928 u legacy square | `LEGACY_*`, `TerrainLattice.js:18-29`; centred blit, `TerrainCanvas.jsx:180-186` | The old 6 × 6 board; the mat is 1760 × 1126 u. Its own comment calls it a stopgap. |
| Token terrain stamp | `BoardState.js:57-62`, `:91-99` | "Nothing reads the stamp today"; Map bursts are retired. |
| Tile-era terrains | `hills` (same as `mountain`), `farmland`, `hamlet`, `diggings`, `terrainRegistry.js:280-305` | Painted by Tokens in the tile era. `hamlet` may live on as the Hall clearing. |
| Art-set switch | `terrainRegistry.js:51-122`, `PlaymatTuner.jsx:25-29`, `:80`, `engineEvents.js:202-203` | Experiment scaffolding (archived D-T15); goes once L-1 is answered. |
| The "no edge art" test | `TerrainRegistry.test.js`, "has no edge or corner art" | Fails if a `masks` folder appears; only matters if L-3 is C. |
| Free-mat guard allow-list | `FreeMatGuards.test.js:185-192` | Says it is deleted when terrain returns. |

### Stale comments (hypotheses, checked)

- `terrainRegistry.js:46` names `TerrainPainting.test.js`; no such file exists.
- `terrainRegistry.js:111` says `TestDashboard` publishes the art-set event;
  `PlaymatTuner.jsx:29` does.
- `engineTokens.js:21-23` cites a `TerrainRegistry` "accounts for all N
  Tokens" check; the test file has none (the table went 2026-10-06).
- `mapRegistry.js:40` mentions "terrain assignment"; nothing assigns terrain.

## 7. What needs measuring (left for brief 80)

Not decided here because each needs `bench:draw` or the Perf HUD:

1. **Repaint cost on the free mat.** Archived: 9.8–15 ms per repaint for the
   old 232 × 232 square (53,824 pixels), after a rewrite from 55–63 ms
   (archived roadmap §6e). The free mat is 124,080 pixels chunky (×2.3) or
   495,440 fine (×9.2). If cost grows with area, as that doc says, that is
   **~23–35 ms chunky, ~90–140 ms fine** (reasoned). Fine only if it happens
   once per travel or settle, never per tick; a ground that depends on live
   Tokens would break that.
2. **Cost of a mat-sized still canvas under everything**, per frame at 4×
   slowdown. Needs a `terrain` draw switch beside `background` in
   `DRAW_SWITCHES` (`drawSwitches.js:10-14`); today's table background costs
   nothing measurable (`PERFORMANCE.md:87`).
3. **Pixel snapping.** Tokens snap to whole screen pixels
   (`TokenSprite.jsx:73-83`); the ground canvas is scaled with the mat's
   fractional fit, so ground pixels may come out uneven. Eye-check, then the
   cost of drawing it snapped.
4. **Animated water** (L-8 B/C): needs its own small layer; per-frame cost.
5. **Distance fields at the fine size**: bands, beach and fades each run one
   over the whole map (×9.2 the old area).
6. **Short-lived memory per repaint**: archived ~1 MB on the old square;
   ×2.3–9.2 here.
7. **The Token cap rising to 128–256** (D-9) changes brief 60/90's budget the
   ground must fit inside.

## 8. Open questions (not the owner's)

- **Where a hybrid's ground comes from** (L-4 A): the Atlas layout (A4) must
  say which Base Map each node came from, or the ground maps node types to
  biomes. Unknown until A4 is built.
- **The sea strip** (L-5 A/B) needs a per-Region placement rule
  (`MatPlacement`) and the layout must keep nodes off the water: Atlas work,
  not paint.
- **Mat size**: the ground's resolution depends on it, and today it is a
  per-device tuning value (`matTuning.js`, "Mat size"); T-097 makes it a game
  value. 1126 u is not a whole number of ground pixels (281.5 chunky), so the
  last row needs rounding.
- **The Starter Camp's ground** (L-10 C) needs a field on the CMS page from D-2.
- **The unopened raw sources**: whether any of the ~650 "Generated Image"
  files in `raw_assets/dataset/` are ground sources.
- **Unused tile-era art** (`pm_board_*` except `guild_hall_1`, the two
  `tables/` soils): not drawn anywhere. Owner art; left alone.
