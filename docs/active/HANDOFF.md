# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-11-06, late
evening, at the end of the director session that prepared the code review
round 4. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5`.*

## The owner's goal

**The code review and optimisation pass, round 4**
([concept_code_review_2026.md](concept_code_review_2026.md), approved
2026-11-06, with the owner's six rulings recorded in it). The preparation
phase (phase 0) is done except the CMS eye-check. The review itself runs in
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
- Tickets filed: T-333 (a hidden page piles up detached nodes and listeners,
  seen in the soak smoke), T-334 (DropLap test pinned pre-Sync content).

## Branches and worktrees (verified at writing)

- **The owner's folder is on `prep/cm`**, not `main`, for the CMS eye-check
  ([eyecheck/2026-11-06_cms_disk_workspace.md](eyecheck/2026-11-06_cms_disk_workspace.md)).
  `prep/cm` = `main` 31e61032 plus the CMS work (d6987558). Gate run by the
  director on the merged result: suite (T-334 only), cycles, game and CMS
  builds, `npm run cms -- validate --data` (0 errors, 6 unknown keys listed
  in the eye-check's brief report). **After the look:** fixes on `prep/cm`,
  then in the owner's folder `git switch main`, `git merge --ff-only prep/cm`
  (the branch already contains main; if main moved, a normal merge; the
  content/code hook may refuse a merge commit that carries the owner's Sync
  beside code: `ALLOW_CONTENT_CODE_MIX=1 git commit` is the documented way),
  push, `npm install --prefix cms` is already done in the owner's folder.
  Archive the eye-check file with the verdicts.
- **The CMS migration already ran** at the switch: changing `cms/vite.config.js`
  made the owner's running CMS server restart with the new code, and their
  open tab moved its browser workspace to `cms/workspace/workspace.json`
  (revision 1, 154 items, 157 Tokens: their unsynced work) after saving
  `cms/backups/migrated_2026-11-07T06-33-45-801Z.json`. The file is
  git-ignored. Nothing was cleared from the browser.
- `.claude/worktrees/cm`: on `main` (detached from `prep/cm`), the director's
  spare worktree for commits on `main` while the owner's folder is on the
  branch; its `cms/node_modules` is a real folder, its root `node_modules` a
  junction (rmdir the junction before removing it).
- `.claude/worktrees/p23b`: detached, the bench scratch folder.
- `pcm`, `pco`, `pp`, `psk`: the planning agents' branches, left as they are.
- `eyecheck/fights-rivers`: unmerged on purpose (retired Terrain QA buttons).

## Bench state and queue

- Baselines still not retaken (see the previous handoff's note); the
  calibration stamp is stale.
- **First quiet window (01:00 or 13:00), on `main` in `p23b`, in order:**
  `npm run bench -- --compare`, `npm run bench -- --save-baseline`,
  `npm run bench:draw -- --save-baseline`, `npm run bench:calibrate`, then
  `npm run bench:soak -- --save-baseline` (30 min visible, 5 hidden; expect
  the hidden phase to FAIL on T-333, record it) and the bundle size and suite
  time into `review/baseline/`; commit the baselines with the date and fill
  `review/STATUS.md`'s baseline table.

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

1. The CMS eye-check and its two questions (workspace file in git: no is
   built; status line in the Backups window: built).
2. Approve the Chrome DevTools MCP when the app asks.
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
