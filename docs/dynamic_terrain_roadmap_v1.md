# Dynamic Playmat Terrain — Roadmap v1

Companion to [`concept_dynamic_playmat_terrain.md`](concept_dynamic_playmat_terrain.md),
which is the vision. **This document is the authoritative plan.** Where the two
disagree, this one wins — §2 lists every place they do.

Written 2026-09-06 from an interview with the owner, on branch `playmat-6x6`.

---

## 1. Locked decisions

Decided in interview on 2026-09-06. Do not re-litigate these without the owner.

| # | Decision |
| :-- | :--- |
| **D-T1** | **The board is one continuous 29×29 subtile lattice.** A terrain sprite is 16px shown at 32px, so four fit across a 128px tile; the 32px gap between tiles is exactly one subtile. 6 tiles × 4 + 5 gaps × 1 = 29, and 29 × 32 = 928px — the full board width, edge to edge with no outer margin. |
| **D-T2** | **Gap subtiles belong to whichever neighbour claims them**, and a tile's terrain may also spill into a neighbour's own subtiles. Boundaries are ragged, not straight. |
| **D-T3** | **Most recently painted wins a contested subtile.** The newest drop asserts its terrain over its neighbours. |
| **D-T4** | **Every token paints terrain** — including context, buff and map tokens, not only place-like ones. |
| **D-T5** | **A token's terrain is inherited from the Map it came from, with a per-token override.** The override wins where authored. |
| **D-T6** | **The Map stamps its terrain onto the token instance when it bursts.** It cannot be looked up later — see §2.2. The stamp persists, so a token that goes board → Vault → board keeps it. |
| **D-T7** | **Tokens that never come from a Map get a terrain authored per token**, seeded from their name and type and corrected by the owner. Roughly 50 of the 75 tokens. |
| **D-T8** | **A terrain type is a substrate plus a prop table.** Two terrain types may share a substrate — "desert" and "desert village" are both sand with different props. This replaces the concept doc's substrate-vs-overlay split (§2.1). |
| **D-T9** | **Terrain types live in a code registry**, `src/config/registries/`, beside the sprite manifest. They are presentation config, not authored game content, and carry no balance numbers. Not a CMS surface. |
| **D-T10** | **Terrain is persistent and history-dependent.** Lift a token and its terrain stays painted. The board is a map the player builds over a session. |
| **D-T11** | **The save stores two small numbers per tile: which terrain, and when it was painted.** ~36 tiles. Everything else — subtile variant choice, which side wins a contested subtile, prop placement — is derived deterministically from tile position, the paint-order numbers and a per-save seed, so the board reloads pixel-identical. The full 29×29 grid is NOT stored. |
| **D-T15** | **Two ground art sets exist and the QA panel switches between them at runtime.** `a` is 16px art at 2×, `b` is 8px at 4×. Both fill the same 32px subtile, so no geometry changes. `artSet()` / `setArtSet()` in `terrainRegistry.js`; `subtileArtPx()` and `edgeAmplitude()` follow, so a coastline is always cut at the resolution the ground is drawn at. Default `b`, remembered per device. ⚠️ **Scaffolding** — the toggle and the losing set both go once the owner settles. |
| **D-T13** | **Terrain edges are computed in code, not drawn as stencil files.** The frontier between two terrains is derived from board coordinates and the save seed. No mask assets exist or will. Decided 2026-09-06 after prototyping both — see §2.6. |
| **D-T14** | **Blending covers the four cardinal edges only, to start.** A subtile blends with the neighbour above, below, left or right. A neighbour that differs only diagonally stays hard-edged. |
| **D-T12** | **Slice one is the base layer only**: flat terrain fills, gaps claimed, hard edges between different terrains. No masks, no blending, no props, no animation. |

---

## 2. Where this overturns the concept doc

### 2.1 Substrate biomes vs civilisation overlays — simplified

Concept §10C splits biomes into *substrate* (plains, forest, ocean) and
*civilisation overlays* (village, ruins) that preserve the ground beneath and
selectively clear props, producing "village on coast" and "village on mountain"
as emergent combinations.

**Not building that.** Per D-T8 a terrain type is one flat thing: a substrate
plus a prop table. "Desert village" is its own terrain type that happens to
share the sand substrate with "desert". This is more authoring and less
emergence, and the owner chose it deliberately — it means the look of every
terrain type is decided rather than computed, and there is no override
hierarchy to reason about.

### 2.2 Map-inherited biomes cannot be a lookup

Concept §10A says tokens "originating from specific regional maps automatically
adopt that region's biome profile," which reads as though the map is
discoverable from the token. It is not:

* **Only 26 of 75 tokens appear in any Map pool at all.** The other 50 are
  crafted, produced, or otherwise never come from a Map.
* **6 of those 26 are in more than one pool.** `token_coal_vein` is in both
  `map_bronze_hills` and `map_test_map`, so its "region" is ambiguous.

Hence D-T6 (stamp at burst) and D-T7 (author the other 50).

### 2.3 The alpha-mask architecture is unbuildable today

Concept §5 and §6 — the mask library, the seam contract, multi-tier gradient
bands — are the bulk of the document and depend on assets that **do not exist**.
The 31 terrain sprites in `public/assets/playmat/terrain/` are seamless noise
fills (5 materials × 4–6 variants), which is exactly the *textures* half of §5.
There are zero alpha stencils. Deferred past slice one; needs art before it can
be scheduled at all.

### 2.4 Props are one subtile

`prop_tree_oak` and its siblings are 16px, so a prop occupies a single subtile —
one sixteenth of a tile. Concept §8's "grand continuous mountain range" spanning
slots implies a much larger prop scale. Unresolved; not slice one.

### 2.5 The alpha-stencil *library* is not being built — the technique is

⚠️ **Supersedes §2.3 above, which said masks were blocked on art.** They are not
blocked; they are not going to be files at all (D-T13).

Concept §5 assumes a modular library of drawn alpha stencils, and lists seam
continuity as a separate problem to solve on top (§6). Both were prototyped on
2026-09-06 and the sprite route costs far more than it looks:

* A stencil that tiles seamlessly needs a **border contract** — its frontier
  pinned to a known depth at each flank, so the next stencil starts where the
  last one ended. That works.
* But pinning every stencil to the *same* depth makes the boundary cross the
  midline every 16px, and it reads as a decorative scalloped fringe rather than
  a coast. Avoiding that means a stencil per *pair* of endpoint depths: about 25
  shapes per direction, ~200 files.
* And §6B's multi-tier bands (ocean → foam → wet sand → dry sand) work by
  drawing **the same contour at different insets**. Every tier would need its
  own matched set of ~200, agreeing pixel-for-pixel, or the foam detaches from
  the shore.

Computing the frontier instead makes all three problems vanish: continuity is by
construction, there is no repetition to avoid, and a second band is the same
function with a different inset. Concept §6's own solution 3 ("Continuous Global
Coordinate Sampling") is this, so the doc already contains the answer.

**The cost, stated plainly:** the character of an edge is tuned by changing
numbers, not by drawing. The owner accepted that trade knowingly.

### 2.6 The concept doc has no §4

It jumps from §3 to §5. Nothing appears to be missing; the numbering is just
wrong.

---

## 3. Foundations already in place

* **The lattice arithmetic already works.** `BOARD_SIZE` 6, `TILE_PX` 128,
  `TILE_GAP_PX` 32 in `src/config/boardGeometry.js` give exactly D-T1's 29×29.
  This is why the playmat was moved to 6×6/32px first (`c3c9d1f`).
* **Terrain art exists** — `public/assets/playmat/terrain/ter_{dirt,grass,sand,
  stone,water}{0..5}.png`, 16px, seamless. Not referenced anywhere in the code
  yet, and not in `sprite-manifest.js`.
* **Three props exist** — `public/assets/playmat/props/prop_tree_{fir,maple,
  oak}.png`, 16px. Also unwired.
* **Tiles already paint a floor.** `BoardTile.jsx:305` picks one of five
  `pm_board_guild_hall_*` images by tile index. That is the placeholder this
  feature replaces.
* **The board is cheap to render today** — 53 DOM nodes under
  `[data-board-origin]`, 272 on the whole page. See the risk in §6.

---

## 4. What does NOT exist and must be built

* No terrain field on any token or Map. `theme` exists on all of them and is
  `""` everywhere; it was **deliberately deleted** as a vocabulary in August
  (CR2-125) and `tokenConstants.js:99` says "Do not reintroduce this field."
  ⚠️ The new field must not be called `theme` and must not revive that one.
* No terrain registry.
* No terrain state on the board, and no save schema for it.
* No record on a token instance of the Map it came from.
* No alpha masks (§2.3).

---

## 5. Phases

### P0 — Terrain registry and token/Map terrain data ✅ done 2026-09-06
`src/config/registries/terrainRegistry.js` holds the substrates (5, matching the
art on disk) and the terrain types (8, on those 5 substrates — `farmland`/
`hamlet` share dirt and `forest`/`meadow` share grass, which is D-T8 working).
`terrainAssignments.js` holds `MAP_TERRAIN` (all 7 Maps), `TOKEN_TERRAIN` (all
50 pool-less Tokens) and the `terrainForToken` resolver. 20 tests in
`src/tests/TerrainRegistry.test.js`.

**Deviation from the plan as written:** the Map terrain and per-token override
live in the code registry keyed by id, *not* as new fields in `data/maps.json`
and `data/tokens.json`. §6.5 named this as one of the two safe routes and it is
the one that needs no CMS work — adding a data field without a matching CMS
control would have it erased on the next sync. Consequence: the owner cannot
author terrain without a code edit. Revisit if that friction bites.

**Not done here, deliberately:** nothing reads these tables yet, and the burst
does not stamp anything. That is P1.

### P1 — Paint state and persistence ✅ done 2026-09-06
`board.terrain` holds `{ terrainId, paintedAt }` per tile, alongside
`nextPaintOrder` and `terrainSeed`, all declared in `StateSchema`. Painting
hangs off `BoardState.setToken`, which is the one choke point every arrival
passes through — player drag, Manager restock, cascade, Vault withdrawal — so no
route can skip it. Clearing a tile deliberately does not touch terrain (D-T10).
`Cartographer.openMap` stamps the Map's terrain onto everything it bursts, and
the stamp survives the sprite layer, the Vault and Vault consolidation. 18 tests
in `src/tests/TerrainPainting.test.js`.

**⚠️ No save migration, and none needed.** Terrain is purely additive: an older
save has no terrain and is otherwise identical, so `GAME_VERSION` is unchanged
and old saves still load. A save loaded with Tokens already on the board paints
under them on first read, so it does not appear as bare ground.

**Two things found while building it, both fixed:**

* *The backfill guard never fired.* It watched for `board.terrain` being absent,
  but the save loader merges the declared schema into whatever it loads, so an
  old save arrives with `terrain` already created as `{}`. Caught by running the
  real game against a real pre-terrain save, not by the tests — which had
  constructed the "old save" by deleting the key, a shape the game never
  produces. The guard is now `nextPaintOrder === 0`, which is true of both a new
  game and a pre-terrain save and self-limits after one run.
* *Vault consolidation dropped the stamp.* `TokenBank.consolidate` pools charges
  and repacks, so the copies coming out are not the ones going in. The first
  stamp among the merged copies is now applied to all of them — see the comment
  there for why there is no better answer.

**~~Known gap~~ — closed 2026-09-06.** A Token that *is* in a Map pool but was
obtained some other way had no stamp and no override, so it painted the default.
It was dismissed as not biting in practice. It bit immediately: the QA panel's
"Fill Tray" creates unstamped instances, so a board filled from it put grass
under Shrimp Coast, and the owner reasonably read that as the terrain feature
not working.

The fix is the third precedence tier that was sketched at the time — the terrain
of the sole Map that lists a Token, when exactly one does. Derived from the Map
pools rather than authored, so it cannot drift. Tokens in two pools still fall
to the default, because guessing between them is exactly what the burst stamp
exists to avoid.

**Lesson worth keeping:** "the only routes are ones that are covered" was true of
the *game's* routes and false of the *developer's*, and the developer's routes
are how the feature gets looked at.

### P2 — The base layer renders ✅ done 2026-09-06
`src/systems/board/TerrainLattice.js` resolves the 29×29 lattice — pure
arithmetic, no React — and `TerrainCanvas.jsx` draws it under the tiles.
Each tile keeps an untouchable 2×2 core; its outer ring and the gap subtiles are
contested by score: distance, recency rank (D-T3) and a jitter that is mostly
sampled from a coarse grid so boundaries meander in runs rather than fizzing per
subtile. 15 tests in `src/tests/TerrainLattice.test.js`.

**Risk 1 (DOM weight) did not materialise.** One canvas, not 841 divs: the board
went from 53 elements to 84, and all 31 of those are Tokens placed during
testing, not terrain. Terrain cannot be hovered or hit-tested as a result, which
costs nothing — dropping and inspection belong to the tiles above it.

**The placeholder floor is kept for unpainted tiles.** Drawing nothing on a tile
nobody has painted would make it invisible, and the player has to see where a
Token may be dropped. The slate now means "nobody has been here yet" and burns
off tile by tile as the board fills.

**The grid marks undrawn ground only (owner ruling, 2026-09-06).** The question
raised by this phase — a painted board has no visible grid — was answered: an
unpainted tile carries a faint outline and a slight wash, and that disappears
the moment anything paints over it. So a painted board is landscape with no grid
on it at all, and the outlines are the record of where you have not been. The
`pm_board_guild_hall_*` slate floor is gone from the playmat entirely (the Guild
Hall upgrade board still uses it).

The owner's intended successor to this is a **map-discovery effect** on unpainted
ground — a replacement for the outline, not an addition to it. Not scheduled.

⚠️ **The outline's exact weight was tuned half-blind.** The board scales to fit
its window (0.64 in a 1500px one) and screenshots downscale again, so a hairline
that is legible in person all but vanishes in a capture. An outline alone tested
as invisible and a faint wash was added to make the slot read as a shape at any
scale. The alphas are two constants in `BoardTile.jsx` and may want adjusting on
a real monitor.

### P3 — Blended edges ✅ done 2026-09-06
`edgeProfile` in `TerrainLattice.js` returns one signed displacement per art
pixel along a boundary; `TerrainCanvas` walks every boundary between two
*different* terrains in a second pass and repaints the displaced strip. Ownership
is untouched — P3 only softens the line where two owners already meet.

**⭐ The seam problem is closed, exactly.** Concept §6's sawtooth happens when
each boundary segment wanders off on its own. Here a segment's endpoint depths
are properties of the **junction**, not the segment: both boundaries meeting at
a junction read the same hash of its coordinates, so they agree without knowing
about each other. Measured across 94,080 junctions and 60 seeds: **worst step
0 pixels**, and a test asserts exact equality.

⚠️ That required tapering the per-pixel wobble to nothing at both ends of a
segment. Without the taper each end got its own wobble and neighbouring segments
could differ by up to 4px — a visible step, the very thing the contract exists to
prevent. Measured 3–4px before the taper, 0 after, with no loss of raggedness.

**Cost: none measurable.** 20 forced redraws of a four-terrain board still time
at 0ms, and the DOM is unchanged — it is all one canvas.

### ⚠️ P3 did not actually work until 2026-09-06, three commits later

The renderer clipped each strip to a rectangle in the **loser's** subtile and
then drew the texture positioned over the **winner's** subtile. Those two are
adjacent and never overlap, so the clip discarded every draw. Pass two painted
nothing, on any board, ever.

**How it survived two rounds of "verified in the running game":** the ownership
model already makes boundaries ragged at *subtile* resolution — 32px steps — and
at the board's usual 0.64 scale in a downscaled screenshot that is very hard to
tell from pixel-level blending. The zoomed images that looked convincing were
**offline Python renders**, which used the real lattice and the real profiles
but re-implemented the drawing, and re-implemented it correctly. They proved the
data and said nothing about the canvas.

The owner caught it by pointing out that no screenshot had ever come from the
game itself.

**What proved it, in the end:** reading pixels back out of the live canvas and
asking where the boundary sits on each row. Broken, it sat at exactly x=128 on
all 128 rows and every boundary position was a multiple of 32. Fixed, it takes
thirteen distinct positions stepping in single art pixels.

**What stops it happening again:** the strip geometry moved out of the renderer
into `edgeStrips()`, which returns it as data. The invariant that was violated —
*a strip must lie inside the subtile it is painted into* — is now a test over
every boundary on the board, and it fails when the bug is reintroduced.

An edge against **bare table stays hard**. There is no ground under it to blend
into, and the shape of an island's outline is the ownership model's job.

### P4 — Props ✅ trees done 2026-09-06
`TerrainProps.js` decides where every prop stands — pure data, sorted, drawn by
a third canvas pass that does nothing but paint the list in order.

* **Trees on the grass terrains only.** `forest` at 0.22 of its subtiles,
  `meadow` at 0.05. Everything else is declared empty rather than guessed at:
  rocks on stone and reeds on water are obvious, but there is no art and
  half-authored scenery looks worse than none. Adding some is two registry
  fields and no code.
* **§2.4's scale question, answered:** a prop is drawn at the ground's own zoom,
  so 16px art becomes 64px — half a tile. Any other size gives a prop finer
  pixels than the ground it stands on, which is the same error as cutting a
  coastline finer than the ground it runs through. Props therefore change size
  with the art set, because the whole world's pixel scale does.
* **Scattered, never centred.** Each prop is anchored at a jittered point inside
  its subtile, with a margin so the trunk cannot wander onto a neighbour's
  ground — a fir standing in the sea would not look obviously wrong, since the
  canopy overlaps its neighbours anyway.
* **Depth by the base.** The list is sorted by the anchor's y, so a tree lower
  on the board draws over one behind it. Sorted by where it *stands*, not by the
  top of its sprite, which matters as soon as props differ in height.
* Four separate hash channels — presence, species, x, y — so turning the density
  up does not also reshuffle where the survivors stand.

⚠️ **Not built:** the concept doc's §8 clustering, where adjacent same-biome
tiles merge canopies and grow connected mountain ranges. What exists is
independent scatter.

### P5+ — Deferred, not scheduled
Multi-tier coastline bands (§6B — cheap now the frontier is a function); ambient
animation; macro clustering and mountain ranges (§8); road auto-connecting; the
map-discovery effect on unpainted ground.

---

## 6. Risks, named before the work

1. **DOM weight.** 841 subtiles × up to 3 layers is ~2,500 elements against the
   53 the board draws today. The page total is 272. A per-subtile `<div>`
   approach may not survive; a canvas layer is the likely answer, and there is
   already one canvas on the page. Decide in P2, not before.
2. **"Living" was chosen but is only half-implemented by D-T11.** The owner
   picked living terrain, and the paint-order model delivers "the board changes
   every time you act on it" — not "terrain drifts on its own over time." If
   spontaneous drift is wanted later, D-T11 has to become the full 29×29 grid.
3. **D-T4 (every token paints) plus D-T7 means 50 authored terrains** before the
   board stops looking flat. That is a content pass, and half-authored tokens
   are expected rather than a defect.
4. **Terrain is playmat-only.** The Guild Hall upgrade board kept 8px gaps —
   a quarter of a subtile — so the lattice does not tile across it. Do not
   apply terrain there without revisiting its geometry.
5. **The CMS sync destroys unmodelled content.** ~~If a terrain field is ever
   added to `data/tokens.json` or `data/maps.json` without a matching CMS
   control, the next sync erases it.~~ **Resolved in P0** by keeping terrain
   entirely in the code registry, keyed by id. `data/` is untouched, so there is
   nothing for a sync to erase. Note also that `sprite-manifest.js` is written
   by the CMS (`cms/vite-plugin-cms-api.js`), which is why terrain art paths
   live in `terrainRegistry.js` instead.

6. **`map_guild_hall_map` lists a Token that does not exist.** Its pool
   references `token_fallen_oak_tree`, which is absent from `data/tokens.json`.
   Found while auditing pool coverage for P0; a pre-existing content bug, out of
   scope for this feature, and the terrain tests skip over it explicitly.

---

## 7. Implementation status

| Phase | Status | Notes |
| :--- | :--- | :--- |
| P0 — registry + terrain data | ✅ Done 2026-09-06 | Code registry, not CMS — see P0 note |
| P1 — paint state + persistence | ✅ Done 2026-09-06 | No migration needed — additive |
| P2 — base layer renders | ✅ Done 2026-09-06 | **Slice one complete** |
| P3 — blended edges | ✅ Done 2026-09-06 | Slice two. Seams measured at 0px |
| P4 — props | ✅ Trees done 2026-09-06 | Grass only; no clustering |
| P5+ — tiers, animation, clustering | Deferred | |
