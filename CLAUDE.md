# Fantasy Guild — Working Notes for Claude Code

## The owner

- **I don't code.** Explain in plain language, especially git and GitHub: what
  a command does and why. Lead with what matters, never a ticket dump.
- **Ask, don't assume, as multiple choice.** When a design decision isn't
  already recorded, give labelled options with trade-offs and your
  recommendation first. Make routine calls yourself. Batch questions.
- **Stay in scope.** Something unrelated worth fixing becomes a ticket in
  [`docs/reference/TICKETS.md`](docs/reference/TICKETS.md), not part of the
  current change.

## How work runs: director mode

For any project bigger than a quick fix, the main session is the **director**.
It does not write the code itself. It:

1. Reads the project's docs, splits the work into phases, and briefs each
   phase: the ticket or plan section, the file paths, the verification bar,
   and permission to **stop and report rather than guess**.
2. Picks a tier for each phase (definitions in
   `.claude/agents/`):
   - **runner** (Sonnet, low thinking): tests, bench, builds, mechanical
     edits.
   - **builder** (Opus, medium thinking): fixes whose design is already
     written down.
   - **engineer** (Opus, extra-high thinking): risky refactors, performance
     work, turning a new design into code, diagnosing unexplained failures.
   - The director (Fable) may build a phase itself when a subagent has
     failed it twice.
3. **Verifies every subagent's claims itself** before merging. Subagent reports
   here have been confidently wrong often enough that checking has repeatedly
   changed the outcome.
4. **Merges to `main` once the merge gate passes**, except anything that
   changes how the game looks or plays: that waits for the owner's eye-check.
   After each merge it **pushes `main`** to GitHub (an off-PC backup); feature
   branches stay local, and nothing is ever force-pushed.
5. Parks owner questions as multiple choice and keeps working on what isn't
   blocked.

Cheapest tier first, but during the crunch the engineer tier may be used
whenever a phase genuinely needs judgement. Code phases that touch different
files may run in parallel, each in its own short-path git worktree
(`docs/reference/TESTING.md`, "Worktrees"); the main checkout stays on `main`
so the owner's CMS syncs land there. Read-only work (reviews, research) may
run in parallel freely. Checks in the running game are one at a time.

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

- **`docs/active/NOW.md`**: what's in flight and what's next. Start here; update
  it at the end of a session.
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
