# World W6: the first world content pack

The pack `2026-11-01-w6-first-world.json` (96 entries) is also in `cms/incoming/` on `feat/world-w6`.
It folds in and replaces the held mines pack in `../world_w4/`: accept this one, not that one.

- **Made by** `mkpack_w6.mjs` from the branch's `data/` and `cms/plan/plan.json` (no CMS autosave in
  the worktree; the owner's newest, `cms/backups/autosave_2026-10-29T07-09-52-471Z.json`, is older
  than `data/`), then `node cms/changePackTool.mjs stamp|check|gate --write` against `data/`.
- **Gate**: PASS (`gate.txt`): no stage time moves; 19 entries newly reached, most of the 105 problems
  added are the banners' expected luck notes and T-285's main reach still reading map items.
- **Worlds**: `sweep_100_seeds_with_pack.txt`: 100 of 100 pass checks F and every rule of the world
  (1000 of 1000 too). `audit_w6.mjs` checks each origin's ring against its plan tier and each mat's
  heroes (4.5 to 6.25 over 3600 strict cells; 17 cells a quarter-hero over 6, a plains cell holding three
  guaranteed camps).
- **After the owner Syncs it**, five test files pin today's content and need `post_sync_tests.patch`
  (`git apply` on the branch the Sync lands on): the Goblin's drops, Farmland's nine and the Wood
  Foundation's 35 building recipes, Iron Ore no longer only on the Volcano map, and the ring-3 forests and
  pickaxes K4 must leave aside. `RenderGolden` needs `UPDATE_RENDER_GOLDEN=1 npx vitest run
  src/tests/RenderGolden.test.js` (19 new cases from the pack). Not from this pack: the CMS's
  Poison → Venom migration rides on any Sync from a restored workspace and turns `CMSGearDefence` and
  five golden sentences red as well.
- **Regenerate**: `node mkpack_w6.mjs <worktree> <out-dir>`, then stamp, check, gate and world.
