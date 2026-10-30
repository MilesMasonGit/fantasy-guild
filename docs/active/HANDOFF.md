# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-10-29 late
evening by the director session of 29–30 October (briefs 270, 290, 310), early,
while overnight benches and two agents run; the owner is asleep and approved
picking up new briefs, with a big review in the morning. Read `CLAUDE.md`, this
file and `STATUS.md`, then verify with `git worktree list` and `git log
--oneline -5`.*

## On `main` (pushed; suite green 6749 at 05034597)

- **Brief 290 ledger L1 complete**: the plan block (status, `plan.tier`, note),
  Planned stubs kept out of `data/` in `cms/plan/plan.json`, the Plan section in
  four editors, the reach/tree/hubs engines (`src/systems/progression/ledger/`),
  the Ledger tab and settings. Owner answered the five ledger questions: as built.
- **The owner's item tags Sync** (pack `2026-10-29-item-search-tags`, brief 310):
  it landed on `feat/classless-k1` by mistake (the folder was on the eye-check
  branch) and was copied to `main` as 05034597; only `tags` on 125 items.
- Brief 290 was revised twice by planning tonight (S0 spike first; a rate
  calculator replaces the pretend player in L5). L1–L3 as built are unaffected.

## Overnight (done, Fri 01:05–01:30)

- **O3 and K1 merged** to `main` 7920232e (pushed): O3 same work; K1 heroHash
  only, accepted under `brief270-K1`; gate on the merged result 6581 tests.
  Worktrees `tb1` and `k1` removed. Classless record archived with the owner's
  CMS to-do: `docs/archive/eyecheck/2026-10-30_classless-ledger.md`.
- **Bank** (`b1`): same work, drag `equip` 50/50. **Perks** (`k4`): hero hashes
  identical to K1's, so same work against the new baseline. Both wait for the
  owner's look; when merging, merge `main` in first and re-run the gate.

## Building

- **270 K4 milestone perks**: `feat/classless-k4` in `k4` (on K1), verified
  (6604 tests, cycles, builds), bench-queued 4th tonight (expect same work),
  eye-check with the Bank: [file](eyecheck/2026-10-30_perks-bank.md). Its example
  pack is git-ignored in `k4/cms/incoming/2026-10-29-example-skill-perks.json`:
  copy it to `main`'s `cms/incoming/` after the merge, before removing `k4`.
- **290 L3 checks A–C and the item page**: merged to `main` on the gate (CMS
  only); the owner looks in the morning; three questions parked in STATUS.
  `l1` can be removed.

## Waiting on the owner (morning review)

- Look: perks + the Bank at scale ([file](eyecheck/2026-10-30_perks-bank.md),
  two branches; switch the folder only when the owner says ready, and back to
  `main` right after), and the ledger L3 CMS look.
- Bank questions from its builder (STATUS row): tools sort by their tier,
  search from the start of a word (both recommended, not built).
- After K1 merges: the CMS to-do in the classless eye-check file (dagger styles,
  gear level requirements, Goblin retune, the Academies and Shrimp Market).
- K4/S9 older eye-checks still open, not blocking.

## Next

Session stopped starting new work at ~60 % context after K4 (rule).

1. 270 K5 classless clean-up (tutorial "Send Your Recruit", the retired
   `promotes` keyword, ON_PROMOTE, promotion fixtures, GDD §2/§8/§16, glossary,
   `Demolition.test.js` subscribing to a removed event), builder, after K4.
2. 290 S0 spike, then L4 first-fill pack; 300 encyclopedia (needs L2: done).
3. 280 combat v2 (needs K1).
Small tickets keep accumulating until the briefs are done (owner rule). Ticket
candidate: `npm run cms:restore` reads `workspace.maps` (gone) and ignores the
plan file.

## Worktrees

- `tb1` O3 (bench tonight, then remove). `k1` K1 (bench, merge, then remove).
- `k4` perks, `b1` Bank, `l1` ledger L3: agents' or waiting.
- `p23b`: director's scratch, detached. `pp`, `pcm`, `pco`, `psk`: planning.
- Remove a worktree: kill its servers, `cmd /c rmdir` both junctions (full
  Windows path, PowerShell), confirm real `node_modules`, `git worktree remove`.

## Lessons

- **Switching the owner's folder to an eye-check branch at night is risky**: the
  owner accepted a CMS pack and synced onto the branch. Switch back to `main`
  as soon as the look is done, or switch only when the owner says they're ready.
- **Planning rewrites briefs while they build**: re-read the brief from `main`
  when a report comes back, and tell agents to read the current text.
- A big merge between two briefs (O3 into K1: 15 conflicts) is best sent back to
  the engineer who wrote one side; it resolved cleanly with notes per file.
- The app can crash mid-session: background timers and agents die with it.
  Resume agents with SendMessage; restart timers.
- Mklink from Git Bash fails on the path; use PowerShell `cmd /c mklink /J`.
