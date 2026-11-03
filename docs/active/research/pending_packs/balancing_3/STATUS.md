# Balancing pack 3: status (2026-11-02)

`2026-11-03-balancing-3.json` (`build3.mjs`, 16 entries, every one an XP a cycle number, all pinned),
made from the preview on `data/` at `main` ba62dbd9, run again on its own result until it proposed
nothing (14 numbers, then 2, then 0). **Copy it to the main folder's `cms/incoming/` only after
`feat/balance-survives-sync` has merged**: the pin needs the code.

Checks against a workspace from today's `data/` (`fish/mkws.mjs`): `stamp` 16, `check` OK, `gate` PASS
(written into the pack; stage move declared), `world --seeds 100` 100 of 100.

After the pack and an emulated Sync (`balancing_1/postsync.mjs` changes 0 numbers on it), at Typical:

| Stage | Today | After | Budget |
|---|---|---|---|
| Starter Camp | 34 min (+14 %) | 34 min (+14 %) | 30 min |
| Plane 1 | 1 h 32 min (+68 %, out) | 1 h 2 min (+12 %, within) | 55 min |
| Plane 2 | 23 h 29 min (-2 %) | 23 h 29 min (-2 %) | 1 d |

Walls 4 → 0 (Alchemy 1 → 5 and 5 → 15, Forestry 1 → 5 and 5 → 15). The preview on the result proposes
0 numbers.

**What each half does.** The two rises alone (Wild Lavender 1 → 12, Oak Tree 1 → 3) give that whole
table and clear all 4 walls (measured). The 14 cuts (1.9× to 20× down, levels 30 to 75) change no stage
above; they slow the late game to the curve (Mahogany Wood 3 d 11 h → 32 d 5 h, Ebony Wood 5 d 9 h →
67 d 15 h) and clear the "boosts trivialise it" warnings on Forestry 90 and Mining 90. The review
accepts entry by entry, and the preview keeps proposing any cut left out.

The gate adds 3 warnings either way: Frog Banner's own step, and two Guild Hall ranks' payback
(Woodpile 2, Woodsman's Lore 1), which wait for the Hall's balance pass.
