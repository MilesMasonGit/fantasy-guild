# HANDOFF — what a fresh director resumes from

*Replaced whole each time. Written Mon 23 Nov 2026, 05:00, after batch 12 merged. Read `CLAUDE.md`,
this file and `STATUS.md` (batch 12 section: the 05:00 summary, rows, content packs owed, the notes
for the planning agent), then verify with `git worktree list` and `git log --oneline -5`.*

## On `main`

Batch 12 is merged and pushed (939f3d05): briefs 710, 720, 730, 735 V1-V3, 740 C1, C3, C6, 760 V1-V7,
765 W1-W4, 770 G3/G4 code parts, 780 J1-J6, 790 W1-W3, W5-W8, 795 M1-M2 and follow-ups, the task ring
as the owner accepted it, plus the owner's three CMS Syncs (183 Tokens, 359 items, 322 recipes) and the
Description Sync. Tickets closed d879fea9. Bench baseline: fingerprints updated for T-599, T-637,
T-304, timings kept from 14 Nov (a quiet-machine retake is due, T-181). Known red: `LedgerPace`
"Maxed is never slower than Typical" (Cooking, the new recipes; red on main before the join).

## Branches still waiting

- `fix/types-without-groups` (740 C2, `cb2`) and `fix/enemy-moves-named` (C4 step 1, `cb4`): wait for
  the content agent's group-split and six-enemy packs; they are on the old base and need re-joining.
- `merge/batch12` (`b12`) and every batch 12 phase worktree are merged: clean them up (junctions first,
  `cmd //c rmdir`, then `git worktree remove`; never `rm -rf`).

## Eye-check waiting

`batch-12` on the Guild Eye-checks page, build `_builds/2026-11-23-batch-12/Fantasy Guild.exe`, 12 checks.
After the verdicts: fixes on new branches, archive to `docs/archive/eyecheck/2026-11-23_batch-12.md`.
The broken-tool bubble and its Token "!" have no click path (needs a QA way to break a tool).

## Owner to-dos

The eye-check; on main, Ledger > World: check the Biome terrain card, Sync; Goodbye lines per event.

## Next phases

790 W4 (effect descriptions, now unblocked); 740 C5 (after C2/C4 packs), C7 to C10; 750 (after 740);
770 G1 (out of bait or seed, uses `raiseNeedsItem`) and G2 (after the amended fishing plan); 795 M3;
735 V4 (Limes' lines first); 800; and the planning agent's new briefs 810 (skill identities) and 820
(Tabletop Guild rename). Small follow-ups: heroBubbles' level line should call `levelNeed`; the
fishing_net kind goes once the pack deletes `effect_fishing_net`; the one-line Recalculate strip of
`stationChargeCost` after its pack; the retired station kinds' reader after 8 recipes and 7 effects
stop naming them.

## Lessons this session

- Join everything ahead of the window on a scratch branch, gate each step, tag it, and bench only the
  tags in the window: 32 steps benched in about two hours.
- Builders never bench, so a fixture problem (S8's hunters starting the hour nearly dead) surfaced only
  at merge: diagnose before blaming the engine, and bench step by step with `--compare --save-baseline`
  carried forward for attribution.
- The owner Syncs on main while branches wait: before joining, id-diff data between the base and main
  and grep src/ for deleted ids.
- Four agents is the practical ceiling on this PC; agents report twice when their own tests keep
  running, so kill leftover vitest processes by worktree.
