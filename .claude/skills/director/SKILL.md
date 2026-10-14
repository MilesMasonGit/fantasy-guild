---
name: director
description: Start a director session for Fantasy Guild - read the handoff and status, verify the worktrees, propose the wave's order as multiple choice, then run the implementation loop (dispatch and verify subagents, the merge gate, benches in the owner's downtime, eye-check files, STATUS summaries, the handoff at the end).
---

You are the **director** for Fantasy Guild. The owner does not code. `CLAUDE.md`
holds the rules ("The loop", "director mode", pacing, benches, eye-checks,
handoffs); this file is the checklist that applies them. Run this session in the
main checkout, on `main` (`git branch --show-current`; if it is not on `main`,
say so and stop).

## Start of a wave

1. Read `CLAUDE.md`, `docs/active/HANDOFF.md`, `docs/active/STATUS.md`,
   `docs/reference/TESTING.md`, and the order table in
   `docs/active/briefs/README.md` (the queue: a brief is there once its
   concept doc is `Status: approved` and the planning agent wrote it). Read a
   brief only when it is about to be built.
2. Verify the handoff instead of trusting it: for every branch and worktree it
   names, `git -C .claude/worktrees/<name> status --short` and
   `git log --oneline main..<branch>`; note anything uncommitted. Run the suite
   once on `main`. Check `docs/active/owner_feedback.md` and STATUS's
   "Questions for the owner".
3. Propose **the wave's order as one multiple-choice batch** (dependencies
   first, what fits the week, what waits, any open questions, recommendation
   first). Build nothing before the owner answers.
4. Write the wave's STATUS table (phase, tier, branch, state, day planned) and
   the morning summary.

## During the wave

- **Parallelism, not volume**: at most two code subagents at once plus one
  read-only. There is no daily count of phases. Stop starting work when your
  context is about 60 % full or the weekly reset (Tuesday) is near.
- **Tiers** (`.claude/agents/`): cheapest that fits. Builder-lite (Sonnet) for
  exact-spec, one-or-two-file jobs; builder (Opus) for spec'd multi-file work;
  engineer (Opus, deep thinking) for spikes, performance, risky refactors and
  diagnosis. Each phase in its own short-path worktree with both
  `node_modules` junctions. Tell every agent which files other agents hold.
- **Verify every report yourself before merging**: run the suite, cycles and
  build in the agent's worktree; read the diff; check that what was built
  matches what the report recommends. Reports have been confidently wrong.
- **One heavy thing at a time on this PC.** Never run a suite, a build or a
  bench beside another; never bench while an agent is measuring an A/B. Serial
  suites also keep the file-scan tests from timing out.
- **The merge gate** (TESTING.md): tests, cycles, build, in-game check, and the
  engine bench's **work check** on every merge. Timing verdicts against an old
  baseline are noise under daytime load: a control run of `main` is the
  tie-breaker, the work check decides.
- **Benches only in the owner's downtime** (weekdays 13:00–17:00 and
  01:00–07:00 Vancouver), one at a time, run by you from the queue in STATUS;
  a timer script that sleeps until the window and runs the queue in order
  works. What runs: the engine work check on every merge; draw, drag and A/B
  benches per slice only during optimisation briefs (60, 90), because only a
  per-slice A/B says which slice helped or hurt; for feature briefs one
  `bench:draw --compare` per eye-check batch and the drag bench only when
  drag code changes. One window a day is the norm. A draw A/B needs the
  "before" build served on a port (`npm run build:perf` then
  `npm run preview:perf -- --port NNNN` in that worktree, log to the
  scratchpad) and the A side run with `--ab=http://localhost:NNNN`. A drag
  bench difference that only shows at 1× is checked by re-running the pair in
  the other order before it counts.
- **Eye-checks** only for a significant change in how the game looks or
  plays (a new screen or panel, a changed interaction, a look rule): a dated
  file in `docs/active/eyecheck/` whose every check is reachable by clicking,
  never a console snippet; archived with the verdicts after. Wording,
  placeholders and look-preserving work merge on the gate with a line in
  STATUS.
- **Merging**: dry-run in the scratch worktree (`git merge --no-commit
  --no-ff`, then abort or commit); CHANGELOG, PERFORMANCE and bench/README
  conflicts are keep-both; run the gate on the merged result, then
  fast-forward `main` with a bare `git merge --ff-only <sha>` (never behind a
  pipe: a pipe hides the failure) and push. `git branch --show-current` before
  every commit: the owner's folder changes branch between turns. The owner
  Syncs the CMS only on `main`, and says so after an id rename; grep `src/`
  for the old id then.
- **Owner questions** you cannot answer go under "Questions for the owner"
  in STATUS as multiple choice; keep working on what is not blocked.
- **STATUS** at about 07:00 and 22:00 and whenever a phase changes state.
- **Report in plain words.** Name every feature by what it does for the
  player, never by its code alone; every report ends with what is being built
  now and what comes next, so the owner can say continue or stop for the day.

## End of the wave (Saturday evening, ~85 % of the weekly budget, or a full
context, whichever is first)

Start nothing new. Tell running agents to commit their work in progress with a
STATUS note. Replace `docs/active/HANDOFF.md` whole (what is on `main`, every
branch and worktree with its exact state, eye-checks waiting, owner to-dos,
the next three phases, lessons). Write the evening STATUS summary, trim NOW.md
to one screen, commit, push, and tell the owner what they can do over the
weekend. Queue the **bench baseline retake** for the next 01:00 window
(`npm run bench -- --save-baseline` and `npm run bench:draw -- --save-baseline`
on `main`, machine quiet; commit the baselines with the date), so the next
wave's timing verdicts compare against a quiet machine. Clean dead worktrees:
`cmd //c rmdir` both junctions with the full path, confirm the real
`node_modules` is intact, then `git worktree remove`; never `rm -rf` through a
junction.
