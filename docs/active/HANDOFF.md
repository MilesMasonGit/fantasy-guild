# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-10-29 evening
at the close of the director session of 28–29 October (briefs 250 and 260).
The older per-director handoffs (`HANDOFF_systems.md`, `HANDOFF_backlog.md`,
`HANDOFF_features.md`) are history now: this file is the one to resume from.
Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5`.*

## On `main` (pushed; suite green, 6675 tests before O3)

- **Brief 250 Token bars, complete**: one plate for every Token (idle Tokens on
  hover, no output icon, round rings retired); enemies show no charges; Token
  names over the art's bottom edge, just above the plate; one gear size (the
  '!' footprint) and the '!' → gear swap is instant on hover.
- **Card wording** (S9 rough edges #4, #5, #9, #10, #11, #12).
- **Brief 260 Hero orders, O1 and O2 merged** (88918eea): drag a hero onto a job;
  roster dock; camps (Logging Camp, Mining Camp, Fishing Hut, Farmstead; enemy
  camps as hunting grounds); Scouting Flags retired; old saves migrate. The job
  flag is Lucide `FlagTriangleRight` in each hero's colour (owner's pick; dark
  green drawn pink), behind the top-left of the job's Token, fanned when heroes
  share a Token, on the hero bar; a marching gold dashed order line while
  dragging; the flag snaps to a workable Token (steady) and a red bubble says why
  not ("Needs Pickaxe", "Farming level too low (needs 15)").
- **T-264** frozen goblins fixed (645900d2). Bench work changes accepted under
  `brief260-O1-O2` and `T-264`; bench baselines retaken 2026-10-29 01:30.
- **Owner Syncs checked**: stumps Art size Small (a4a124be), the camps pack
  (e7517dc3: exactly 4 Tokens + 4 recipes); content tests fixed (09bfa810).
- Icon audit for planning: `docs/active/research/icon_audit_2026-10-29.md`;
  the owner's icon rule is in `owner_feedback.md` (pixel for the game world,
  Lucide for meta marks such as the job flag and gear slot icons; to be planned).

## Waiting to merge: brief 260 O3

`feat/hero-orders-o3` in worktree `tb1` (f0c22ad5, `main` merged in): tutorial
steps "Send Your Recruit to a Tree" and "Build a Camp", the area-flag engine
and FlagRules removed, ~102 tests moved to orders, GDD §2/§4/§6/§8/§9 and the
glossary rewritten. Gate on the merged result: 6663 tests, cycles 0, build.
**Owner said merge** after the engine work check. The check runs at 01:05 Fri
(timer in the closing session; log `…/scratchpad/o3_bench.log`, which a new
session cannot see). **If O3 is not on `main` when you start**: in a bench
window run `npm run bench -- --compare` in `tb1`; expect **same work** (the
builder's reasoning: bench heroes never had area flags or rules); then merge
`main` into it, `git merge --ff-only` on `main`, push, and remove `tb1`
(junctions first). Owner: tutorial wording is fine as built (the tutorial will
be overhauled once the early game is set); "Nothing to work here." is approved.

## Next (owner 2026-10-29)

1. **Brief 270, classless heroes** (`docs/active/briefs/270_classless_heroes.md`;
   needs 260 O1, done). Propose its phases as one multiple-choice batch.
2. Then 280 combat v2 and 290 (progression ledger, content fixes) per the queue.
3. **Small tickets wait**: owner rule 2026-10-29: let them accumulate until the
   existing briefs are done, then one pass. Open from this session: T-265 (round
   spawn points), T-266 (each enemy camp counts its own enemies; owner chose this),
   T-267 (drawer inspection: enemy charges, "Nothing yet").

## Waiting on the owner

- K4 play-through and S9 skill-loops eye-check verdicts (files in
  `docs/active/eyecheck/`; not blocking).
- Shorter rest/regrow/respawn times and the Bunk Beds price, as they play orders.
- Ambushes: the owner may remove them with the new controls; left as built.

## Worktrees

- `tb1`: O3, above. `p23b`: the director's scratch worktree, detached.
- `pp`, `pcm`, `pco`, `psk`: the planning agents'. Removed this session: tb2–tb4.

## Lessons

- **The owner's CMS tab can lose its server**: a "Sync Error" with nothing
  written meant the tab's port (5174) had no server. Start the CMS on the tab's
  port from the main folder (`npm --prefix cms run dev -- --port <port>
  --strictPort`, Bash background); the workspace lives in that origin's storage.
- **Timing under load lies**: a 13:00 run read S2 p99 ×10; the cure is a `main`
  control run, then the branch, back to back, or interleaved single-scenario
  worker runs. The work check decides; an unexplained draw-count jump is worth a
  diagnosis (it found T-264).
- **Fold late fixes into the pending bench**: fast-forward the bench worktree to
  the newest commit before the window opens; one bench covers the stack.
- Headless screenshots: wait ~1.1 s after advancing time, or loot hops show as
  black ground shadows in the stills.
- The owner reviews by phone: send 1920×1080 frames plus tight crops with
  SendUserFile, a caption per check, and ask verdicts as multiple choice.
