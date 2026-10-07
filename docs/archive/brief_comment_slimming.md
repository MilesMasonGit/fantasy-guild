# Brief — comment slimming pass (before the crunch)

**Ruled by the owner 2026-10-06.** One dedicated pass, director-run in a fresh
session. Read `CLAUDE.md` and `docs/reference/TESTING.md` first.

## Why

About 40 % of the game's source lines are comments (`src/systems` 12,300 of
30,000 lines; `src/config` 49 %), carrying ~1,500 ticket and decision IDs
(CR3-, FB-, TL-, FP-, SP-, D-…). Every agent reads them, which costs context,
and several have turned out to describe things that aren't true. History
belongs in git, the changelog and the archive.

## The rule (owner)

A comment may keep only:
1. **A non-obvious why**: the reason the code isn't the obvious way.
2. **A ⚠️ warning or trap** that would bite the next editor.

Everything else goes: ticket and decision IDs, dates, "owner ruling of…"
chains, change history ("was X, now Y"), descriptions of retired systems, and
comments that restate the code. A kept "why" is one or two plain sentences.

Before keeping a comment, **check it is true** against the code. A false
comment is deleted (or corrected if the truth is a useful why), and listed in
the report. TICKETS T-093 lists known stale ones.

## Scope and order

1. `src/config/` (highest comment ratio)
2. `src/systems/` one subfolder per batch
3. `src/ui/`
4. `src/state/`, `src/utils/`
5. `cms/src/`
6. `src/tests/`: only file-header essays; keep each test's description of
   what it proves. Test names are not touched.

## How

- **Comments only.** No code change of any kind: no renames, no reformatting,
  no import changes. A diff line that isn't a comment line is a failure.
- Builder tier (Sonnet), one folder per subagent, one commit per folder on the
  branch `chore/comment-slimming`.
- After each batch the director checks: the diff touches comment lines only
  (spot-read it, and grep the diff for non-comment changes); `npm test` same
  result; `npm run bench -- --compare` exits 0 (same work); `npm run build`.
- Don't touch `data/`, `public/assets/`, or `src/config/registries/sprite-manifest.js`.
- JSDoc on exported functions may stay if it says what the function does and
  what it returns; strip its history.

## Done when

Every folder above is done and merged, and the report lists: lines removed per
folder, comments found to be false (file:line, what they claimed), and any
comment the agent was unsure about and left in place.
