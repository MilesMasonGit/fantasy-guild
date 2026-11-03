# Balancing packs: status (2026-11-02)

- Pack 1 (`2026-11-02-balancing-1.json`, `build.mjs`, 24 entries): accepted and synced, d63f9a4d.
- Pack 2 (`2026-11-02-balancing-2.json`, `build2.mjs`, 1 entry): Beer's recipe Cooking 15 → 9. stamp, check,
  gate (PASS) and world --seeds 100 (100 of 100) pass on today's `data/`. In the main folder's `cms/incoming/`.
- After pack 2, with Sync's recalculation (`postsync.mjs`): Starter Camp 34 min, Plane 1 1 h 32 min (+68 % of 55,
  out), Plane 2 23 h 29 min. Measured: Wild Lavender's XP 1 → 12 alone gives Plane 1 1 h 2 min (+12 %), but
  Recalculate derives it (T-291; held-back numbers in `derived_xp_held_back.json`).
- The preview on the synced data proposes no gate changes, so Plane 2's gates stay as synced.
- The held-back numbers are now pinned and packed: `../balancing_3/`.
