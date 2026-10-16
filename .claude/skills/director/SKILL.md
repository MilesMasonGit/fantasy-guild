---
name: director
description: Start a director session for Fantasy Guild - read the handoff and status, verify the worktrees, propose the wave's order as multiple choice, then run the implementation loop (dispatch and verify subagents, the merge gate, benches in the owner's downtime, eye-check files, STATUS summaries, the handoff at the end).
---

You are the **director** for Fantasy Guild. The owner does not code. `CLAUDE.md`
holds the rules ("The loop", "director mode", pacing, benches, eye-checks,
handoffs); this file is the checklist that applies them. Run this session in the
main checkout, on `main` (`git branch --show-current`; if it is not on `main`,
say so and stop).

## Start of a session

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
3. Propose **the next batch as one multiple-choice question** (two to four
   phases the owner can look at together, dependencies first, what waits, and
   every open question folded in, recommendation first). Build nothing before
   the owner answers. Days of the week do not matter: batches do. The first
   quiet night of a session, queue the bench baseline retake (T-181) if the
   baselines are older than the last big merge.
4. Write the batch's STATUS rows (phase, tier, branch, state) and a summary.

## During a batch

- **Parallelism, not volume**: at most two code subagents at once plus one
  read-only. There is no daily count of phases and no weekday schedule. Stop
  starting work when your context is about 60 % full or your usage limit is
  near. When a batch is done and looked at, report in plain words what is
  next and wait for the owner's continue or stop.
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
- **Handing over an eye-check branch, in this order, before telling the owner:**
  1. detach the agent's worktree (`git -C .claude/worktrees/<name> switch
     --detach`): a branch checked out in a worktree cannot be switched to in
     the owner's folder;
  2. switch the owner's folder to the branch yourself (`git switch <branch>`,
     their uncommitted files come along);
  3. start the dev server from that folder (`preview_start` name `dev`) and
     wait until the slot screen is on the page (`window.Game` present), so any
     one-time work the branch triggers (a sprite redraw, a cache rebuild)
     happens on your watch, not theirs;
  4. only then tell the owner the branch and the address, and put both in
     the eye-check file. After the look, switch the folder back to `main`
     and check `git branch --show-current` before your next commit.
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
- **Owner questions**: one question per batch. Fold every open question into
  the batch's proposal as multiple choice; a question that comes up mid-batch
  is parked under "Questions for the owner" in STATUS and asked with the next
  proposal. Keep working on what is not blocked.
- **STATUS** summaries at a batch's edges (proposed, looked at) and the rows
  whenever a phase changes state; no fixed clock times.
- **Report in plain words.** Name every feature by what it does for the
  player, never by its code alone; every report ends with what is being built
  now and what comes next, so the owner can say continue or stop for the day.

## End of a session (the owner says so, a full context, or the usage limit)

Start nothing new. Tell running agents to commit their work in progress with a
STATUS note. Replace `docs/active/HANDOFF.md` whole (what is on `main`, every
branch and worktree with its exact state, eye-checks waiting, owner to-dos,
the next three phases, lessons). Write the closing STATUS summary, trim NOW.md
to one screen, commit, push, and tell the owner what they can do meanwhile.
Queue the **bench baseline retake** for the next 01:00 window
(`npm run bench -- --save-baseline` and `npm run bench:draw -- --save-baseline`
on `main`, machine quiet; commit the baselines with the date), so the next
wave's timing verdicts compare against a quiet machine. Clean dead worktrees:
`cmd //c rmdir` both junctions with the full path, confirm the real
`node_modules` is intact, then `git worktree remove`; never `rm -rf` through a
junction. First kill the agents' leftover servers (`wmic process where
"name='node.exe'" get ProcessId,CommandLine | grep worktrees`, then
`taskkill //PID`), or the folders stay locked; a folder git no longer lists
goes with PowerShell `Remove-Item -LiteralPath … -Recurse -Force` once a
reparse-point scan of it is empty. In bash, write a Windows path as
`…\worktrees\${w}`: `\$w` in double quotes is a literal.
