# HANDOFF — what a fresh director resumes from

*Replaced whole each time. Written Sat 21 Nov 2026, late evening, mid batch 12; branches list extended Sun 22 Nov, 13:00. Read `CLAUDE.md`,
this file and `STATUS.md` (batch 12 section: rows, the Mon 01:00 merge order, content packs owed,
questions for the owner), then verify with `git worktree list` and `git log --oneline -5`.*

## The owner's goal

Briefs 710 to 800 (rows 70 to 82 of `briefs/README.md`): the Systems Audit's fixes plus mat polish.
Owner, 2026-11-21: work autonomously, beyond the usual builder cap; eye-checks only where the look
changes, batched. The audit build is tagged `audit-build` (1c04f5f6).

## On `main`

Batch 11 and earlier are all merged and pushed (690, 700, the saves fixes, the Token card). Batch 12
has only docs on main so far (task ring screenshots, STATUS). Everything else is on branches.

## Branches (each in `.claude/worktrees/<name>`; details per row in STATUS)

- **Built, waiting for the Mon 01:00 bench (work check), in STATUS's merge order:** D9 `gd9`;
  D1 `hd1` → D2 `hd2` → D3 `hd3`; C1 `cb1` (on D2); D5 `gd5` (commit 51490898, its agent never sent a
  final report: run its gate yourself) → V1 `hv1`, D6 `gd6`; V2 `hv2`; D7 `gd7`; D8 `gd8`.
- **Wording stack** on 710 P2: W1 `tw1` → W2 `tw2` → W3 `tw3` → W6 `tw6`, W7 `tw7`. W3 and above
  carry 16 red CMS round-trip tests until a CMS Sync rewrites 26 stored Token descriptions (owner
  question; recommended: the director runs the CMS sync command on main right after W3 merges, as a
  data-only commit).
- **Look stack**, combined and gated in scratch `eye/mat-look` (`eye`, c7125d85, 712 files green),
  test build `_builds/2026-11-21-mat-look`, eye-check tab `mat-look-2`: n1, n2 → n3, ar → fl → tr4, hv3.
  Merge after the owner's verdicts (drag bench for the ring and flags, one bench:draw --compare).
- **Waiting on content packs:** C2 `cb2` (group-split pack Synced first), C4 step 1 `cb4` (merges
  after C2; step 2 after the six-enemy pack).

## Built Sun 22 Nov (owner: use the extra bandwidth)

Twenty-two more branches, each verified by the director (diff read, touched tests re-run) and listed in
STATUS rows with their merge notes; the merge order's steps 7 to 13 place them. Worktrees: lv1 lv2 lv4
lv5 lv6 lv7, rw1 rw2 rw3 rw4, hj1 hj2 hj3 hj4 hj5 hj6, mg3 mg4, tw5 tw8, cb3 cb6, ms1 ms2. Nothing is
running. W4 (effect descriptions) was tried and abandoned: it conflicts with W5 until both are on main.

## Next phases (not started)

790 W4 (after W3, in sequence with D7 on ItemTip.jsx), W5 (after D7 and D8 merge), W8 (after W3);
795 M1 to M3; 730 D4 (after the three-star pack Sync); 735 V4 (planning agent's lines); 740 C3 (after
W3), C5 (after 730 merges), C6 to C10; then 750, 760, 765, 770, 780, 800 per the briefs table.

## Owner to-dos

The mat look eye-check; the questions in STATUS (description Sync, two task ring calls, earlier
shape questions); Sync each content pack in STATUS's list on main only after its code merges.

## Lessons this session

- Six code agents at once overloaded the PC (28 vitest processes, suites over 30 min): four is the
  practical ceiling, and each agent runs its full suite once.
- Agents left `waiting on background work` with uncommitted code: check `git log main..HEAD` in their
  worktree and send a commit nudge.
- A worktree made with bash `git worktree add` has no node_modules junction; make them with
  PowerShell `New-Item -ItemType Junction` before running tests (vite build still passes without).
- Agents use separate origins (`http://<name>.localhost:<port>`) so they never overwrite the owner's
  dev slots.
