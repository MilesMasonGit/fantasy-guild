# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-11-06 22:10, at the end of the
director session that ran 5–6 Nov. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5`.*

## The owner's next goal

**A thorough code review and optimisation pass, with a fresh agent** (owner, 2026-11-06 evening).
Nothing is in flight to wait for: every code branch is merged and the worktrees are cleaned.

## On `main` (pushed 2846de23; suite 627 files, 7,794 tests green, 4 skipped; cycles 0 dangerous; game and CMS build)

Merged 5–6 Nov, all on the gate (look changes either looked at by the owner or listed below):
the combat look (360 C2–C4); rivers and ground (370); drag hints (490) and the owner's five notes
on them; enemies stand still (500); the Bank (400 B1–B3); the top bar (420 T1, T2 Disallow
removed); notifications (430); the encyclopedia corner, words on its lines (470 E2, E3); the
Guild Hall sky, panel, upgrade ceremony and drop lap (390 G2–G5); the world map, ring stars and
settle ceremony (380 M2–M5), the map now under the whole UI; the time-away summary (440); settings,
title screen, new game and save files (450 S1–S4; save files desktop only); hard pixel (460 P2);
Foundations and the pop-up Shop across the screen (410 S1, S2); tools that break (480 L1); the
bench's fight scenes (T-322); small fixes T-320, T-328, T-330; tests updated after the owner's
Sync (T-293, T-013 closed).

**Owner's CMS:** the Foundations and ring stars packs are accepted and synced (51a648da). The
**Swift Laps pack** (`cms/incoming/2026-11-06-drop-lap.json`, owner picked the ledger's prices)
waits for the owner to accept and Sync; then grep nothing (no id renames). Excavation and
Battlefield need descriptions typed in the CMS (T-332).

**Owner's look list:** looked at and approved 6 Nov late evening, archived (`docs/archive/eyecheck/2026-11-06_merged_while_away.md`); the owner has only minor changes, for the next pass.

## Branches and worktrees (verified at writing)

- `main` in the owner's folder; feature branches all merged and deleted.
- `.claude/worktrees/p23b`: detached on `main`, the director's scratch and bench folder.
- `pcm`, `pco`, `pp`, `psk`: the planning agents' branches (combat, content, planning, skills),
  left as they are.
- `eyecheck/fights-rivers`: unmerged on purpose (the retired Terrain QA buttons, af600b38); safe
  to delete with `git branch -D` if the owner agrees.

## Bench state

- 6 Nov 13:01 on main 32c65b47: engine S1, S4, S7 same work; S2-family and C240/C256 WORK CHANGED
  as predicted (bench fights, brief 500), accepted; identity and fidelity ok; draw: no regression.
- Everything merged after that was checked by comparing the engine work fingerprints with that
  run (new game, settle ceremony: 40 of 40 identical), or is expected same by test (drop lap,
  save files, tools that break, Shop).
- **Baselines not retaken.** A timer for 01:00 7 Nov (engine `--compare`, then
  `--save-baseline` for engine and draw, then `npm run bench:calibrate`) lives in the old session
  and dies with it. **First quiet window: run those four on `main` in `p23b`** and commit the
  baselines. The calibration stamp is stale (`hallStars.js`, ledger files changed).

## For the code review and optimisation pass

- Known cost leads: T-326 (spawners that missed search again every 5 s on full boards, C240 p99
  9.8 ms); T-325 (catch-up pays about 10 % more kills in crowded hunts; a fairness bug, engine
  brief); T-324 (fidelity gate now steady: 240 = 240 kills on seeds 1–5); the 0.5 s first open of
  the world map is now painted in a Web Worker (`worldPicture.worker.js`).
- Lint leftovers seen by builders, not fixed: unused `React` imports (`MatCapBadge.jsx`,
  `MatTopBar.jsx`, `GuildHallBoard.jsx`), unused `RECIPE` in `BoardRunner.js`, unused
  `NotificationSystem` in `EngineBootstrap.js`, unused `e` in `AudioSystem.js`.
- Possibly dead now: `Flags.isHeroWorkable` (only tests call it); the QA ring-star button
  (`qaRingStars.js`) and the lap-star mirror (`qaLapStar.js`) once their packs are in the data;
  `shop.section` (only the Token Summary still sorts by it); `AtlasTome.jsx` and `tomeArt.js`
  (the encyclopedia still imports them).
- Open tickets from these two days: T-315, T-316 (terrain), T-321, T-323 (drag faults on main),
  T-325, T-326, T-329 (swipe Back), T-331 (stale have count on the star panel), T-332 (pack
  descriptions lost on Sync). The 50 px gap beside the short-screen nav (Shop and Bank pad for
  152 px, the nav is 120 px) has no ticket yet.

## Owner to-dos

1. The minor changes from the look, for the next pass.
2. Accept the Swift Laps pack and Sync on `main`; type the two Foundation descriptions.
3. Art and sound when convenient (all on `owner_art_list.md`): world map board tiles and rope;
   title logo and painting; Hall chimes, the settle fanfare; constellation pictures (optional).
4. Owner calls built as recommended, change any at will: title look A framed; drop lap at the
   ledger's prices; ring stars A; settle title size A, reduced motion A; tools that break: a weapon
   breaks at the kill, a broken weapon ends the order, two fitting tools keep working, gold line.

## Lessons from this session

- Builders that touch `data/` content tests break when the owner Syncs a pack: after a Sync, run
  the suite on `main` before anything else (19 tests pinned the pre-Sync Shop).
- Merging `main` into a feature branch after a CMS Sync trips the content/code commit hook, and
  the auto-mode classifier refuses `ALLOW_CONTENT_CODE_MIX`: merge the feature branch into a copy
  of `main` instead (the staged diff is then code only).
- Worktree clean-up that worked: unlink both junctions per worktree from PowerShell
  (`cmd /c rmdir`), check `Get-ChildItem -Recurse -Attributes ReparsePoint` finds none and the
  real `node_modules` counts are unchanged (`ls -A`), remove one worktree as a test, then the rest.
- A PC restart kills the director's background timers and the dev servers: restart `dev` and
  `cms` with `preview_start`, and requeue timers.
- Four builders at once worked (owner's ruling for this week) as long as the director ran every
  suite and bench one at a time and told builders the bench window to keep clear.
