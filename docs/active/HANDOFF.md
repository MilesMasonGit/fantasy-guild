# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-11-06, late
evening, at the end of the director session that prepared the code review
round 4. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5`.*

## The owner's goal

**The code review and optimisation pass, round 4**
([concept_code_review_2026.md](concept_code_review_2026.md), approved
2026-11-06, with the owner's six rulings recorded in it). The preparation
phase (phase 0) is done, the CMS eye-check included (merged 2026-11-07, 4897fd3d). The review itself runs in
`/reviewer` sessions, one area each; the planning agent turns findings into
tickets and fix briefs ([review/README.md](review/README.md)); the director
runs the fix briefs as usual.

## On `main` (pushed 31e61032; suite 632 files, 7,875 green, 1 failing = T-334, 5 skipped; cycles 0 dangerous; game and CMS build)

Merged today, all docs or tooling, no eye-check needed:
- knip (`npm run dead-code`), dependency-cruiser (`npm run depcruise`, rules
  in `.dependency-cruiser.cjs` describing the real layering), the Chrome
  DevTools MCP (`.mcp.json`, project-scoped: the app asks the owner to
  approve it once).
- `docs/reference/ARCHITECTURE.md`: the code as it is, every claim with a
  path and line. Read it before reading code.
- `docs/active/review/`: the concept's working folder (README with the
  finding format and the finding-to-ticket flow, STATUS with the session
  table, `baseline/` with the five tools' reports, `doc_audit.md`).
- The `/reviewer` skill (`.claude/skills/reviewer/SKILL.md`); the planning
  skill has a "review intake" step; CLAUDE.md points at both.
- The doc audit's fixes: stale notes on GDD §3, §11, §12, §13; TESTING and
  cms/README corrections; three October director handoffs archived; 51 done
  tickets moved to `tickets_done.md`.
- `npm run bench:soak` (the memory soak: heap, nodes, listeners, subscribers
  over a long idle in headless Chrome, a hidden phase, slopes and verdicts,
  `--snapshot` for a class-by-class heap diff). One 3-line dev-only getter in
  `src/ui/dev/perf/perfHarness.js`. No baseline yet.
- Tickets: T-333 (a hidden page piles up detached nodes and listeners,
  confirmed by the soak baseline 2026-11-07), T-335 (visible heap grows 52
  KB a minute, steady; closures and contexts lead the snapshot diff). T-334
  is merged (d5a5fa9e): the suite is fully green, 632 files, 7,876 tests.
- Lesson: a worktree needs both junctions, `node_modules` and
  `cms/node_modules`, or every CMS test file fails to resolve `zustand`
  (63 files "failed" with 0 failing tests). Check before trusting a count.

## Branches and worktrees (verified at writing)

- **The owner's folder is back on `main`** (4897fd3d, pushed). The CMS
  eye-check passed (owner all ok 2026-11-07, Q1 a and Q2 a as built,
  [archived file](../archive/eyecheck/2026-11-06_cms_disk_workspace.md));
  `prep/cm` is merged and can be deleted. The owner may Sync as usual.
- **The CMS workspace lives in `cms/workspace/workspace.json`** (git-ignored)
  since the migration on 2026-11-07, with a backup
  `cms/backups/migrated_2026-11-07T06-33-45-801Z.json`. Nothing was cleared
  from the browser.
- `.claude/worktrees/cm`: detached, no longer needed; its `cms/node_modules`
  is a real folder, its root `node_modules` a junction (rmdir the junction
  before `git worktree remove`).
- `.claude/worktrees/t334` (`fix/droplap-test`, merged d5a5fa9e): no longer
  needed; both `node_modules` are junctions (rmdir both, then
  `git worktree remove`, `git branch -d fix/droplap-test`). The app's
  classifier refuses worktree removals by the director; the owner or a
  terminal does it.
- `.claude/worktrees/p23b`: detached, the bench scratch folder.
- `pcm`, `pco`, `pp`, `psk`: the planning agents' branches, left as they are.
- `eyecheck/fights-rivers`: unmerged on purpose (retired Terrain QA buttons).

## Bench state and queue

- Engine and draw baselines and the calibration stamp retaken on `main`
  85cefe1f in the 01:00 window on 7 Nov (3f336e14; work changed only on the
  S2 family and C240/C256 against the old baseline, as expected from the bench
  fights and still enemies).
- Soak baseline taken 2026-11-07 10:34 on `main` 44b75a7a
  (`bench/soak-baseline.json`, full report `review/baseline/soak.txt`):
  hidden phase FAIL as expected (T-333 confirmed, 294 nodes and 136
  listeners a minute); new WARN, the visible heap grows 52 KB a minute,
  steady (T-335). Bundle size in `review/baseline/bundle.txt`, suite time in
  `review/baseline/suite.txt`. `review/STATUS.md`'s baseline table is full.
- **Nothing queued for the next window.** Later soaks compare against the
  baseline with `npm run bench:soak -- --compare`.

## For the reviewer and the planning agent

- `review/doc_audit.md` names eight archive candidates the planning agent
  owns (four roadmaps, four built concepts) and the stale sections of the GDD.
- ARCHITECTURE.md §10 lists twelve stale docs and comments; §2.1 lists
  dead-code leads (about 7,160 lines unreachable from `main.jsx`, mostly the
  CMS-only ledger; 15 unused files, none in `src/`).
- The schemas' six unknown keys (items `regen`, `restoreType`; tokens
  `theme`, `mapId`, `effectBlocks`, `enemy.hostile`) and five fields the game
  never reads are review input for R8.
- Known cost leads from the crunch: T-326, T-325, T-324 (see TICKETS).

## Owner to-dos

1. Approve the Chrome DevTools MCP when the app asks.
3. Accept the Swift Laps pack if not yet (it is synced: `star_well_lap` is in
   `data/hallStars.json` since 421c58bd); type the two Foundation descriptions
   (T-332).
4. Art and sound when convenient (`owner_art_list.md`).

## Lessons from this session

- Switching the owner's folder to a branch that changes `cms/vite.config.js`
  restarts their running CMS server on the spot; plan for it (here it was the
  intended migration, with a backup first).
- A merge commit that brings the owner's `CMS sync:` beside code trips the
  content/code hook; `ALLOW_CONTENT_CODE_MIX=1` is the documented escape, not
  `--no-verify`.
- `grep -r` over `.claude/` walks every worktree's `node_modules` junction;
  name the folders.
- The classifier refuses stopping other processes; let Vite restart itself
  or ask the owner.
- Lint in the main folder counts the worktrees under `.claude/` (581 errors
  there, 74 in a clean tree).
