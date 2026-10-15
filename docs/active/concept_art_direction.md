Status: draft

# Art direction: brightness, palettes and the terrain's look

*Owner interview, 2026-10-15, four rounds; **done** (owner called it fully
explored). Builds on the "Terrain art guide" in
[research/terrain_art_list.md](research/terrain_art_list.md) (owner,
2026-10-15) and reshapes **T-180** (vibrancy pass) and the art side of
[brief 80](briefs/80_terrain.md). A close collaboration: the owner judges
every look; agents build the tools and prepare palettes.*

## How the work runs

- **Tools go through the director** as normal phases (merge gate, tiers):
  the bench page, the brightness script, the Studio's palette import.
- **Look passes are working sessions** between the owner and one agent. What
  the owner decides is recorded here (or in ART_STYLE.md once it exists), not
  left in chat.
- **Brief 80's terrain code runs in parallel on placeholder art**: T0 plans as
  scheduled; the grid, biome painting and scatter placement are built on
  today's ground. The art phases swap the real art in. Nothing waits.

## Decided

- **Brightness comes first**, before any ground art work.
- **The test bench is a standalone web page**, grown from
  [research/terrain_mockup.html](research/terrain_mockup.html), loading the
  real PNGs from `public/assets/`. It shows:
  - **3–4 brightness/saturation presets side by side** on the same sample
    scene;
  - **a chosen ground, scatter and tint** with Tokens, heroes and loot on top.
  It comes **before the first brightness pass**.
- **Brightness by presets**: the brightness script takes its settings as
  inputs; each pass the bench shows presets on the sample families (Oak,
  Copper, Fishing, items beside their Tokens), the owner picks or adjusts, and
  passes repeat until one wins. **Only the winner is baked into the art.**
- **Scope as T-180**: Tokens, items, heroes, enemies. UI icons stay.
  **The 256 px card and banner art stays as it is** (a separate painted style).
- **Tint**: try both on the bench, ground and scatter only vs a faint grade
  over the whole mat, Tokens included, and decide by eye.
- **Palettes the agent prepares**: ground palettes per biome (3–5 colours,
  inside ART_STYLE's value range), scatter ramps that sit on each ground, and
  tint swatches per biome. Not Token material ramps (T-180's Studio action
  moves those).
- **The palette route**: the agent writes palette files to a **drop folder
  outside `data/`**; the Studio lists them and the owner clicks **Import** to
  keep one. Agents never write `data/palettes/` (CMS-owned).
- **ART_STYLE.md**: once the look is settled, a new
  `docs/reference/ART_STYLE.md` beside UI_STYLE.md: Token and ground
  brightness ranges, colour counts, light direction, tint rules, the check
  steps from the terrain art guide. Every future sprite follows it.
- **No art check script**: the owner's eye and the bench are enough.
- **All three biomes at once** for the final art (Forest, Mountain, Coast),
  so the grounds are consistent with each other from the start.

## Phases

| # | Phase | Who | Needs |
|---|---|---|---|
| 1 | **Bench page**: presets side by side; swap ground, scatter, tint; real Tokens, heroes and loot | builder | — |
| 2 | **Brightness script with presets**: settings as inputs; writes previews to a scratch folder the bench reads, never over the art; T-180's backup steps (art committed, `art-before-vibrancy` tag, a dated zip) before any bake | builder | 1 |
| 3 | **Brightness passes** until a preset wins; then the full bake, owner review, commit; the drag filter goes (lift and shadow stay) | owner + agent | 2 |
| 4 | **Lock the style**: write ART_STYLE.md from what phase 3 settled; owner approves | planning | 3 |
| 5 | **Art planning**: confirm the ground sheets and scatter list (terrain_art_list.md §4) against the locked style | owner + agent | 4 |
| 6 | **Studio split and palette import** (T-179 plus the drop folder and Import) | builder | — |
| 7 | **Palettes**: ground palettes, scatter ramps and tint swatches for all three biomes, delivered to the drop folder | agent | 4, 6 |
| 8 | **Recolour and trim** all three biomes: sheets to 3–5 colours, details out of the sheets into scatter, softer water; new scatter drawn | owner | 5, 7 |
| 9 | **Tint experiments** on the bench: ground-only vs the whole mat; per-biome swatches. Also whether the ground's code filter (`brightness(0.85) saturate(0.7)`) still earns its place after phase 8 | owner + agent | 8 |
| 10 | **Integration**: brief 80's code takes the final art and tints; eye-check in the running game; cost-log line | director | 9, brief 80 |
| 11 | **Follow-ups**: Token ground shadows (only if Tokens float), water shimmer, the recipe for later biomes written into ART_STYLE.md | owner + director | 10 |

Phase 6 is independent and can run any time before 7. Phases 1, 2 and 6 are
the director's; 3, 5, 8 and 9 are working sessions.

## Notes for the director

- **T-180 changes**: presets judged on the bench replace the single fixed
  setting; the backup steps stay.
- **T-179 grows**: the palette drop folder and an Import button in the Recolor
  tab.
- Brief 80's look eye-check moves to phase 10; its engine work doesn't wait
  for the art.
