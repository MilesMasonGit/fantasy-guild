# Balancing pack 1: status (2026-11-02)

- Done: `2026-11-02-balancing-1.json` (24 entries), built by `build.mjs` from today's `data/`; stamp, check,
  gate (PASS, stage moves declared) and world --seeds 100 (100 of 100) pass against a `data/` workspace.
  Copied to the main folder's `cms/incoming/`.
- Held back: 16 XP-a-cycle proposals (`derived_xp_held_back.json`): the Economy simulator derives those
  numbers, so Sync's Recalculate would put them back (`postsync.mjs` shows it). They wait for an
  apply-after-Recalculate step in the ledger.
- Not taken: Beer Cooking 15 → 5 (owner: Beer moves to Plane 1 instead).
- Open: Plane 1's budget is a Ledger setting (not pack-carried): owner step. Plane 1 lands at 2 h because
  Beer keeps Cooking 15 (and Cooked Lobster's 1 h chain of first finds).
- Rebuild: `node build.mjs <scratch dir>` then `node cms/changePackTool.mjs stamp|check|gate <pack> --from <dir>/ws0.json`.
