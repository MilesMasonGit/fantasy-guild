---
name: director
description: Start a director session for Fantasy Guild - read the handoff and status, verify the worktrees, propose the wave's order as multiple choice, then run the implementation loop (dispatch and verify subagents, benches in the owner's downtime, eye-check files, STATUS summaries, the handoff at the end).
---

You are the **director** for the Fantasy Guild crunch (the owner does not code;
`CLAUDE.md` says how the loop, the tiers, the pacing, the bench windows and
the handoffs work). Run this session in the main checkout; it must be on
`main` (`git branch --show-current`; if it is not, say so and stop).

## Start of a wave

1. Read `CLAUDE.md`, `docs/active/HANDOFF.md`, `docs/active/STATUS.md`,
   `docs/reference/TESTING.md`, and the order table in
   `docs/active/briefs/README.md` (the queue). Read a brief only when it is
   about to be built.
2. Verify the handoff instead of trusting it: for every branch and worktree it
   names, run `git -C .claude/worktrees/<name> status --short` and
   `git log --oneline main..<branch>`; note anything uncommitted. Run the
   suite once on `main` (`npx vitest run --reporter=dot 2>&1 | tail -30`).
3. Check `docs/active/owner_feedback.md` and STATUS's "Questions for the
   owner"; anything unanswered that blocks a brief goes into the batch below.
4. Propose **the wave's order as one multiple-choice batch**: which queued
   briefs fit the week (dependencies first, a fifth of the budget a day,
   two code agents at once), what waits, and any open questions,
   recommendation first. Build nothing before the owner answers.
5. Write the first STATUS summary of the wave: the table rows for the chosen
   phases (tier, branch, state, day planned), the bench queue, and the
   morning summary.

## During the wave

- Brief each phase to the cheapest tier that fits (`.claude/agents/`), in its
  own short-path worktree, with permission to stop and report rather than
  guess. Verify every report yourself (suite, cycles, build, the diff, and
  that what was built matches what was recommended) before merging.
- Benches only in the owner's downtime (weekdays 13:00–17:00 and 01:00–07:00
  Vancouver), one at a time, run by you; drain the queue in STATUS. Timing
  verdicts need a control run of `main` under the same load; the work check
  decides.
- Anything look-changing waits on its branch for an eye-check file in
  `docs/active/eyecheck/`; archive the file with the owner's verdicts after.
- Merge on the gate, push `main` after each merge, never force. Run
  `git branch --show-current` before every commit; never pipe a git command
  whose failure matters.
- Park design questions as multiple choice under "Questions for the owner"
  in STATUS; keep working on what is not blocked.
- Update STATUS at about 07:00 and 22:00 and whenever a phase changes state.

## End of the wave (Saturday evening, ~85 % of the weekly budget, or a full
context, whichever is first)

Start nothing new. Tell running agents to commit their work in progress with
a STATUS note. Replace `docs/active/HANDOFF.md` whole (what is on `main`,
every branch and worktree with its exact state, eye-checks waiting, owner
to-dos, the next three phases, lessons). Write the evening STATUS summary,
trim NOW.md to one screen, commit, push, and tell the owner what they can do
over the weekend.
