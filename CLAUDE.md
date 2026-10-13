# Fantasy Guild — Working Notes for Claude Code

## The owner

- **I don't code.** Explain in plain language, especially git and GitHub: what
  a command does and why. Lead with what matters, never a ticket dump.
- **Ask, don't assume, as multiple choice.** When a design decision isn't
  already recorded, give labelled options with trade-offs and your
  recommendation first. Make routine calls yourself. Batch questions.
- **New art is routine.** I draw and drop new or revised sprites into
  `public/assets/` all the time and may ask for a quick swap of old art for
  new. Expect it; don't treat new files as surprises or defects.
- **Stay in scope.** Something unrelated worth fixing becomes a ticket in
  [`docs/reference/TICKETS.md`](docs/reference/TICKETS.md), not part of the
  current change.

## The loop (owner, 2026-10-13)

Two long-lived agents and the owner, in a cycle that is continuous but
batches into **waves**, with a soft rhythm of weekday building and weekend
planning (the owner's design ideas mostly follow what just got built):

- **Planning agent** (branch `planning`, worktree `.claude/worktrees/pp`,
  docs only): the owner shares broad ideas; the agent interviews them as
  multiple choice, writes the concept docs and tickets, and triages the
  owner's play-testing notes from `docs/active/owner_feedback.md` into
  tickets, concept docs or `design_pass_notes.md`. Every concept doc starts
  with one line, `Status: draft | approved <date> | briefed | built`. When
  the owner approves a doc the agent writes its brief and adds a row to the
  order table in `docs/active/briefs/README.md`: **that table is the
  director's queue**, and the only staging there is.
- **Director** (this session, Fable): at wave start it reads `CLAUDE.md`,
  `HANDOFF.md`, `STATUS.md` and the briefs table, **proposes the wave's order
  as multiple choice** (what fits the week's budget, dependencies first),
  then dispatches and verifies subagents, keeps `STATUS.md` and the eye-check
  files, parks design questions it cannot answer under **"Questions for the
  owner"** in `STATUS.md` as multiple choice, and closes the wave with the
  handoff: the break point where the owner, the planning agent and the next
  director look at priorities and progress again.
- **Starting either agent**: type `/director` or `/planning` in a fresh
  session (project skills in `.claude/skills/`); each reads its own
  checklist and begins. Pick the model in the app first (Fable for the
  director).
- **Owner**: shares ideas and answers interviews with the planning agent,
  makes art, plays the game and the eye-checks, writes what they notice into
  `owner_feedback.md`, and answers the director's parked questions.

## How work runs: director mode

For any project bigger than a quick fix, the main session is the **director**.
It does not write the code itself. It:

1. Reads the project's docs, splits the work into phases, and briefs each
   phase: the ticket or plan section, the file paths, the verification bar,
   and permission to **stop and report rather than guess**.
2. Picks a tier for each phase. The tiers are defined **only** in
   `.claude/agents/` (runner, builder-lite, builder, engineer: which model,
   how much thinking, what work); other docs point there instead of
   repeating them. Cheapest tier that fits, and the director spot-checks in
   proportion: for Sonnet work it reads the whole diff and runs the gate
   itself; for Opus work it runs the gate, reads the diff around anything the
   report flags, and checks that what was built matches what the report
   recommends. The director (Fable) may build a phase itself when a subagent
   has failed it twice.
3. **Verifies every subagent's claims itself** before merging. Subagent reports
   here have been confidently wrong often enough that checking has repeatedly
   changed the outcome.
4. **Merges to `main` once the merge gate passes**, except anything that
   changes how the game looks or plays: that waits for the owner's eye-check
   (a checklist file, see below). After each merge it **pushes `main`** to
   GitHub (an off-PC backup); feature branches stay local, and nothing is ever
   force-pushed.
5. Parks owner questions as multiple choice and keeps working on what isn't
   blocked.

**Pacing (owner, 2026-10-13).** Work runs in **waves** of a reasonable size,
each spread over about five days, not three. At most **two code subagents at
once** plus one read-only agent. Plan about a fifth of the weekly budget per
day, Tuesday to Saturday. When the day's share reaches about 80 %, or the
director's context about 60 %, **start nothing new**: tell running agents to
commit their work in progress and write a status note, write the handoff, and
stop. Builders and engineers commit work in progress at least hourly and keep
a `STATUS.md` in their worktree, so a cut-off agent leaves a readable state.
Code phases that touch different files may run in parallel, each in its own
short-path git worktree (`docs/reference/TESTING.md`, "Worktrees"); the main
checkout stays on `main` so the owner's CMS syncs land there. Read-only work
(reviews, research) may run in parallel freely. Checks in the running game
are one at a time.

**Benches run only in the owner's downtime**: weekdays 13:00–17:00 and
01:00–07:00 Vancouver time. Subagents never run the bench; they stop at tests,
cycles and build and report "ready for bench". The director keeps a bench
queue in `docs/active/STATUS.md` and drains it one branch at a time inside the
windows; a phase ready outside a window waits as "bench queued" while the next
phase starts. A performance spike that needs the bench to find its answer is
scheduled into a window from the start.

**Status and summaries.** `docs/active/STATUS.md` is the living view of the
wave: one row per phase (tier, branch, state, day planned, day done) and the
bench queue, with a dated five-line summary written by the director at about
07:00 and 22:00 (where we are, what is next, what the owner must do, budget
against plan, blockers); entries older than two days are trimmed.

**Eye-checks** are files in `docs/active/eyecheck/`, one per batch, named
`YYYY-MM-DD_<batch>.md`: the exact branch-switch command, the save slot,
numbered checks (where to click, what you should see) each with a
`Verdict: ok / change: ___` line for the owner, and the owner's CMS steps at
the end. After the look, fixes go on the branch, it merges, and the file moves
to `docs/archive/eyecheck/` with the verdicts kept.

**Handoffs.** The director stops new work on **Saturday evening**, at about
85 % of the weekly budget, or whenever its context is getting full, whichever
comes first, and writes `docs/active/HANDOFF.md` (replaced each time, never
stacked): what is on `main`, every branch and worktree with its exact state,
eye-checks waiting, owner to-dos, the next three phases, lessons. Sunday and
Monday are a buffer for the owner's play-testing and queued benches. Between
waves the owner gives eye-check feedback to the planning session, and the
fresh director session (after the Tuesday reset) reads `CLAUDE.md`,
`HANDOFF.md` and `STATUS.md` only, verifies each worktree with one command,
and starts the next wave.

**Planning sessions** (owner interviews, ideas, concept docs, answering a
roadmap's owner questions) work on the long-lived **`planning`** branch in its
own worktree, `.claude/worktrees/pp`, never in the main checkout. They write
docs only. After each step: merge `main` in first (`git merge --ff-only main`,
or a normal merge if it has moved on), commit, then fast-forward `main` with
`git fetch . planning:main` and push. If `main` is checked out in the main
folder that fetch is refused: check that folder's branch, then
`git merge --ff-only planning` there. The flow is
[`docs/active/ideas.md`](docs/active/ideas.md): listed → interview → ticket,
concept doc or brief.

## Where things are written down

- **`docs/active/NOW.md`**: what's in flight and what's next, one screen.
  Start here. **`HANDOFF.md`** (the state a fresh director resumes from) and
  **`STATUS.md`** (the wave's living table and summaries) sit beside it.
- **`docs/reference/`**: [GDD](docs/reference/GDD.md) (what the game is),
  [TICKETS](docs/reference/TICKETS.md) (the only backlog),
  [TESTING](docs/reference/TESTING.md) (merge gate, verifying in the game), and
  other standing references.
- **`docs/active/`**: the concept and roadmap docs of current projects. Roadmaps
  hold locked decisions; don't re-litigate them.
- **`docs/archive/`**: finished work. Don't read it unless asked or a live doc
  points there.

## Hard rules

- **Never hand-edit `data/`.** The CMS is the only authoring surface, and its
  sync overwrites anything written outside it. Use the CMS or a test fixture.
- **A comment is a hypothesis, not evidence.** This codebase has many confident
  comments describing machinery that doesn't exist. Check the code.
- **Comments keep only a non-obvious why or a ⚠️ warning.** No ticket IDs,
  dates, ruling chains or change history; those belong in git and the
  changelog.
- **Green tests don't mean a working game.** Anything a player could see gets
  exercised in the running game (see TESTING).
- **Unfinished content isn't a bug.** Half-authored Tokens and items are
  expected; don't report them as defects.
- **Git**: branch from `main` for every job (`fix/bank-overflow`); merge back
  only after the merge gate passes. Stage files by name, never `git add -A` or
  `git add .` (the owner keeps uncommitted work in the folder). Never commit
  the owner's uncommitted art under `public/assets/`. No force-push, no
  `--no-verify`. No double quotes in commit messages (PowerShell mangles them).
  - A **pre-commit hook** refuses a commit that mixes `data/` with code; that
    is deliberate (`scripts/check-content-code-split.mjs`). Commit them apart.
  - The CMS's **Sync to Game commits `data/` onto whatever branch is checked
    out.** Before merging a branch, check `git log main..<branch>` for
    `CMS sync:` commits and mention them.
  - `public/assets/**` is in **Git LFS**; the LFS hooks need `git-lfs`
    installed.
  - Several sessions may share this checkout: run `git branch --show-current`
    right before any commit or merge.
- **Versions**: stay in 0.8.x until the owner says otherwise. The number lives
  in five files, bumped together: `package.json`, `package-lock.json` (two
  fields: the top `version` and `packages[""].version`),
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
  Tag baselines (`v0.8.1`) as rollback points.
- **Changelog**: add entries at the top of `## [Unreleased]` in
  [`CHANGELOG.md`](CHANGELOG.md); history before 0.8 is in
  `docs/archive/CHANGELOG_pre_0.8.md`.
