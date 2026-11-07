Status: approved 2026-11-06

# Code review and optimisation pass, round 4 (2026)

*Owner interview 2026-11-06 with the director (Fable). Rounds 1 to 3 live in
`docs/archive/` (`code_review_guide.md`, `code_review_v2_guide.md`,
`review_v3/`); their method is inherited, their findings are history. Tickets
from this round carry the origin `CR4-NNN`; the findings live in
[`review/`](review/README.md).*

## Why

Fantasy Guild is an idle game meant to run for hours beside a player's other
programs, so memory and idle cost matter as much as speed, and it must feel
fluid and tactile when the player does act. The engine is feature-complete
for now. The code was written entirely by AI agents, through a long
prototyping history with less capable models, so the owner expects dead code,
duplicated logic, confident comments about machinery that no longer exists,
and stale docs. This round finds all of that, measures what can be measured,
and turns it into tickets the usual director loop fixes afterwards.

## Owner rulings (2026-11-06)

1. **Features are preserved.** A feature may be removed or downgraded only
   with the owner's explicit approval; a finding that would need that carries
   the flag `owner-decision` and waits in the triage batch as multiple choice.
2. **A dedicated reviewer agent** runs the review (`/reviewer`, read-only on
   code), not the director and not the planning agent.
3. **Findings live in `docs/active/review/`**, one file per area; only
   verified findings become tickets, filed by the planning agent in
   `TICKETS.md` with the `CR4-NNN` origin.
4. **Measure first**: the existing benches plus a new browser memory soak
   (`npm run bench:soak`), so "optimisation" means a before/after number.
5. **The CMS** keeps a usable UI; its authoritative workspace moves to disk
   and validate, pack apply, Recalculate and Sync run from the command line.
   The Studio (the owner's art tools) is untouched.
6. **Tooling added**: knip (`npm run dead-code`), dependency-cruiser
   (`npm run depcruise`, layer rules in `.dependency-cruiser.cjs`) and the
   Chrome DevTools MCP (`.mcp.json`) for heap and performance traces of the
   running game.

## Goals, in the order they matter

1. **Idle cost and memory**: no growth over hours, as little work as possible
   while nothing happens, and near-zero while the window is hidden.
2. **Feel**: drag, drop and clicks respond inside a frame; nothing hitches
   when a tick lands.
3. **Correctness**: outright bugs found while reading become P1/P2 tickets.
4. **Maintainability**: dead code gone, duplicated logic merged, import cycles
   cut, layering honest, comments true, docs true. This is what makes the next
   year of agent work cheaper.

## Scope

In: everything in `src/` (engine, UI, state, config), the content boundary
(`data/` to the registries), the CMS's command-line and server layer, the
bench and test tooling, the Tauri shell and build, and the docs agents read.
Out: the Studio's editors (`cms/src/studio`, RecolorEditor, AnimationEditor),
art, and game design (balance, content). Design questions that surface go to
`owner_feedback.md` or a concept doc, not to this round's tickets.

## Phases

| Phase | What | Who | Done when |
|---|---|---|---|
| 0 Prepare | Tooling in, architecture doc, doc audit, soak bench, CMS pipeline, this doc, the reviewer skill | director and subagents (2026-11-06) | all merged on `main`, the CMS eye-check passed |
| 1 Measure | Quiet-machine baselines: `bench --save-baseline`, `bench:draw --save-baseline`, `bench:soak --save-baseline` (30 min visible, 5 hidden), bundle size, suite time; recorded in `review/baseline/` | director, in a downtime window | every number in the baseline folder with date and commit |
| 2 Map | knip, depcruise, cycles, jscpd and lint reports saved to `review/baseline/`; ARCHITECTURE.md checked against them | reviewer, session R0 | reports saved, counts in the review STATUS |
| 3 Read | One reviewer session per area (table below), each writing verified findings | reviewer | every area has a findings file with a session summary |
| 4 Triage | Findings go to the owner in batches as multiple choice (the `owner-decision` ones first); the planning agent files tickets and writes fix briefs | planning and owner | every verified finding is a ticket, moot, or an owner no |
| 5 Fix | Director runs the briefs: safe cleanups first (dead code, cycles, duplicates), then measured performance work with a per-slice A/B, then structural refactors last | director with builders and engineers | each brief's bar; the bench work check on every merge |

Phases 1 and 2 can run in the same day; phase 3 sessions are independent and
two may run at once (read-only); phase 4 happens as areas finish, in batches,
so phase 5 can start on the first batch while later areas are still being
read.

## Areas (one reviewer session each)

| Session | Area | Where | Looks for |
|---|---|---|---|
| R0 | The map | tooling reports, ARCHITECTURE.md | counts, the layering violations, orphans, what the tools say in plain words |
| R1 | Tick and time | `systems/core` GameLoop, TimeManager, CatchUp, the event bus | per-tick allocations, handler order, bus fan-out, catch-up fidelity |
| R2 | Board and mat engine | `systems/board`, placement, flags, spawners, nearby | quadratic scans, re-sorts, caches that never invalidate, dead paths |
| R3 | Heroes, combat, equipment, progression | `systems/hero`, `combat`, `equipment`, `progression` | per-tick churn, duplicated stat maths, ledger cost |
| R4 | Drawing | `ui/components/board`, terrain, atlas drawing, notification layers, CSS filters | per-frame work, layout thrash, filters, canvases that redraw while idle, drawingPause coverage |
| R5 | React plumbing | `ui/context`, hooks, selectors, modals, dnd | renders per tick, context size, selectors that return new objects, listeners that never unsubscribe |
| R6 | State and saves | `state/`, StateSchema, slots, migrations | derived data stored, dead fields, save size and frequency, migration safety |
| R7 | World, atlas, quests | `systems/world`, `atlas`, `quests` | generation cost, caches, retired-concept code |
| R8 | Content boundary and CMS layer | DatabaseManager, registries, `cms/` server and CLI | load-time cost, validation gaps, logic duplicated between UI and CLI |
| R9 | Dead code, duplicates, cycles, lint | knip, jscpd, depcruise, eslint output | what is safe to delete, what to merge, which lint errors are real |
| R10 | Tests | `src/tests` (627 files, about 7,350 tests, 2 to 3 min) | slow files, tests that test nothing, duplicated fixtures, flakiness under seeds |
| R11 | Memory and idle | `bench:soak` results, heap snapshots via the Chrome DevTools MCP | growth per hour, detached nodes, listener growth, hidden-window cost |
| R12 | Shell, build, startup | `src-tauri`, Vite config, bundle, first paint | bundle size, startup work, Tauri settings that cost idle CPU |

## Ground rules for the review

- **Read-only.** The reviewer never edits `src/`, `cms/src`, `data/` or
  tests. It writes only under `docs/active/review/`.
- **Evidence or nothing.** Every finding cites `path:line` and, for anything
  about speed or memory, a number from a bench or a profile with the scenario,
  commit and machine, or it is marked `reasoned` and gets no priority above P2.
- **Verified twice.** A finding is `verified` only after a second check (a
  verifier subagent, or the reviewer re-reading the code cold with the claim
  in hand) confirms the cited code does what the finding says. Unverified
  findings never become tickets. Round 3 reopened one of its own "fixed"
  tickets because a line was cited inside a function nothing called; that is
  the failure this rule exists for.
- **Comments are hypotheses.** A comment or doc describing a mechanism counts
  as a lead, never as evidence.
- **Measure before you optimise.** The baselines from phase 1 are the before;
  a perf finding states the hypothesis the bench should confirm.
- **Don't re-litigate.** Locked roadmap decisions stay locked; a finding that
  disagrees with one is recorded as a design question for the owner.
- **No scope creep.** Content oddities and half-authored Tokens are not
  defects. Design ideas go to `owner_feedback.md`.
- **One heavy thing at a time on the owner's PC.** Benches only by the
  director, in the downtime windows.

## What the owner does

- Answers each triage batch (multiple choice, recommendation first), above
  all the `owner-decision` items: each names the feature in plain words, what
  it costs today, and the options (keep, change, drop).
- Eye-checks: the CMS disk workspace (this session), and later any fix wave
  that changes how the game looks or plays.
- Plays the game after the measured fix waves and writes what they notice in
  `owner_feedback.md`.

## Done

The round is done when every area has a findings file whose session summary
is written, every verified finding is a ticket, moot, or an owner no, the fix
briefs are in the director's queue, and the baselines are re-recorded after
the last fix wave with the before/after table in `PERFORMANCE.md`.
