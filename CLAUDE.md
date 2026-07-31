# Fantasy Guild — Working Notes for Claude Code

## How to work with me

- **I don't code.** Explain things in plain language — especially git and
  GitHub. Say what a command does and why, not just the command.
- **Ask, don't assume — as multiple choice.** When a design decision isn't
  already made somewhere, stop and ask me. Give me labelled options with the
  trade-offs spelled out and your recommendation first, rather than an
  open-ended question or a guess.
- **Verify before saying it's done.** Run `npm test` and, for anything I'd
  see on screen, run the game (`npm run dev`) and actually exercise it.
  Report what you observed, not just that code was written.
- **Stay in scope.** If you spot something unrelated worth fixing, tell me
  about it — don't fold it into the current change.
- **Work in small slices.** One coherent chunk per session, committed at the
  end, so there's always a clean point to roll back to.

## Repo conventions

- `main` is canonical. Start new work from `main` on a short-lived branch
  named for the job (`quest-polish`, `fix/bank-overflow`), then merge back
  when it's verified.
- Tag baselines (`v0.3.1`, `v0.4.0`, …) as permanent rollback points rather
  than leaving branches around.
- Version numbers live in **five files** and must be bumped together:
  `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
- Log changes in [`CHANGELOG.md`](CHANGELOG.md) under `## [Unreleased]` as
  they land; rename that heading to the version at release time.

## Where things are written down

Big features each have a concept doc (the vision) and a roadmap doc (the
authoritative plan, with locked decisions and an implementation status table).
I'll point you at the relevant ones at the start of a session — read those
before touching that area, and don't re-litigate decisions marked locked.

Past finished work is archived in
[`PROJECT_HISTORY.md`](PROJECT_HISTORY.md) — background only, not current.
