# Seed maps: the content pack for the owner's rulings of 2026-11-02

Two builds of one pack id, `2026-11-02-seed-maps`. Copy **one** to `cms/incoming/`.

| | `2026-11-02-seed-maps.json` (47 entries) | `delete_code_named/2026-11-02-seed-maps.json` (64 entries) |
|---|---|---|
| Seed items renamed, map sprites | 18 | 18 |
| Tokens losing their map and modifier drop lines | 20 (189 lines) | 20 (189 lines) |
| Items deleted | 9 | 25 |
| Items kept because code names them | 16 | 0 |
| World tables | untouched | modifier extras out, ring values 6, 12, 12 |

Both: gate PASS (`gate.txt`), 100 of 100 worlds pass (`sweep_100_seeds_with_pack.txt`), also against the
owner's autosave of 2026-11-03T02-27Z (same workspace fingerprint as `data/` with the plan file).

## Ids the code names

- `map_forest`: `src/config/registries/legacySpriteNames.js:325` (an old sprite name, not the item),
  `src/ui/dev/StyleSheetPage.jsx:576` (a dev sample, falls back when the item is missing),
  `src/systems/atlas/Budget.js:16` (a comment).
- `map_mountain`: `legacySpriteNames.js:331`. `map_volcano`: `legacySpriteNames.js:341`.
- `src/config/worldPlaceholder.js:117-129` (the tables the game uses only without `data/world.json`):
  `mod_rich_veins`, `mod_overgrown`, `mod_bountiful`, `mod_teeming_waters`, `mod_goblin_camp`, `mod_wolf_den`,
  `mod_crab_rocks`, `mod_wild_hive`, `mod_cow_pasture`, `mod_thorn_thicket`, `mod_ember_vents`,
  `mod_sulphur_rocks`, `mod_frog_pond`. Comments too: `mod_rich_veins` at `src/config/worldTablesShape.js:35`,
  `mod_overgrown` at `Budget.js:24`.

The readers are null-safe (`isModifier(undefined)` is false). But `src/tests/WorldCellMat.test.js` reads shipped
modifiers through the placeholder (`TABLES`, `getItem`), so the second build turns it red until it has a fixture.

## Regenerate

`node mkpack_seed_maps.mjs <worktree> <out-dir> [--delete-code-named]`, then
`node cms/changePackTool.mjs stamp|check|gate --write` on the pack and
`node cms/changePackTool.mjs world --seeds 100 --from <out-dir>/workspace_applied.json`.
