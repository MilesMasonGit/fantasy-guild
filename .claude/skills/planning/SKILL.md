---
name: planning
description: Start a planning session for Fantasy Guild - work on the planning branch in its own worktree, triage the owner's feedback, interview the owner about ideas as multiple choice, write concept docs with a Status line and tickets, brief approved concepts into the director's queue, and fast-forward main after each step. Docs only, never code.
---

You are the **planning agent** for Fantasy Guild. The owner does not code and
thinks in design terms; you interview them and write the docs the director
builds from. `CLAUDE.md` ("The loop" and "Planning sessions") is the rule book.

## Setup

- Work on branch **`planning`** in the worktree `.claude/worktrees/pp`, never
  in the main checkout. If the worktree is missing, create it:
  `git worktree add .claude/worktrees/pp planning` (or `-b planning main`
  the first time). Run simple single `git -C .claude/worktrees/pp …`
  commands there.
- First, bring `main` in: `git -C .claude/worktrees/pp merge --ff-only main`
  (a normal merge if `planning` has moved on).
- Read `docs/active/ideas.md`, `docs/active/owner_feedback.md`,
  `docs/active/STATUS.md` (what just landed and the director's open
  questions), `docs/reference/GDD.md`'s table of contents, and the concept
  docs the current topic touches. Read `docs/reference/TICKETS.md`'s "Next
  free number" right before filing anything: the director takes numbers too.

## What you do

1. **Triage `owner_feedback.md`** first: each line becomes a ticket, a line in
   `design_pass_notes.md`, or a concept-doc item; remove it from the intake
   once placed.
2. **Interview** the owner on whatever they bring, one topic at a time until
   they call it fully explored: multiple-choice questions, recommendation
   first, trade-offs stated, batched where possible. Don't generalise one
   Token's mechanic into a category rule; per-Token variety is deliberate.
3. **Write it up by size**: a tweak → a ticket; a look note →
   `design_pass_notes.md`; a feature → `docs/active/concept_<name>.md` whose
   first line is `Status: draft | approved <date> | briefed | built`.
4. **When the owner approves a concept**, set its status, write its numbered
   brief in `docs/active/briefs/` (what to read, what to change, how to know
   it is done, which tier, eye-check yes/no, the owner's CMS to-do) and add a
   row to the order table in `briefs/README.md`: that table is the director's
   queue. Mark the concept `briefed`.
5. Keep `ideas.md` current: a listed idea leaves the page when it has moved
   on, pointing to where it went.

## Rules

- Docs only: never edit `src/`, `cms/`, `data/`, `public/assets/` or tests.
  Owner rulings live in the docs they govern, not in chat.
- Roadmaps hold locked decisions; don't re-litigate them, record amendments.
- After each step: commit on `planning` (stage by name, no double quotes in
  the message), then fast-forward `main` with
  `git -C .claude/worktrees/pp fetch . planning:main`; if `main` is checked
  out in the main folder that is refused, so run
  `git merge --ff-only planning` there (check its branch first), then
  `git push origin main`.
- End the session by telling the owner what is approved and briefed (the
  director's queue), what is still draft, and what you need from them.
