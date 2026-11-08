# Brief 520 — Code review round 4: the measurements, one bench window

*Written 2026-11-07 by the planning agent from the round-4 triage. Every area that asked to "measure
first" is batched here, so the director can take the numbers in one downtime window (the 60-minute soak in
the 01:00 window) and the perf tickets after it are judged on numbers, not guesses.*

**What the player gets.** Nothing directly. The numbers decide which of the review's speed fixes are worth
building (a fix whose number is too small is closed as moot).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md` (benches, downtime windows), `bench/README.md`,
`docs/reference/PERFORMANCE.md`, `docs/active/review/STATUS.md` (the baselines table), and each
measurement's finding (search its CR4 id in `docs/active/review/`; the "Hypothesis to test" line says what
the number should show if the finding is real).

## M0, before the window: the instruments (builder-lite, bench and tooling only)

Small additions, no game behaviour changes; gate green, bench work check "same work".

1. `bench/soak.mjs`: one more heap snapshot at the last hidden sample (today's snapshots are visible-phase
   only, CR4-092); add "page task ms/s" and "style passes/s" to the compared metrics (CR4-094); a header
   line saying when snapshots are taken (part of T-382).
2. A readable perf build for the soak only (`build.minify: false` or kept function names under the perf
   mode, CR4-093); check the draw calibration stamp for a frame-cost change and report it.
3. Boot `performance.mark`s at `src/main.jsx`'s steps (page ready, settings, engine init, art ready, React
   mounted, splash gone), printed by the perf harness and read by `bench:draw` (CR4-097).
4. In a dev build, log each save's `json.length` and `GameState.serializeJson` time; add the save size to the
   soak's report (CR4-069).
5. A small bench script (or a QA-panel-free dev hook) that times `Atlas.settle` and `worldView()` on a fresh
   world and on one with six settled Regions (CR4-073, CR4-074).

## The measurements (director, in a downtime window)

| # | What | Command or method | Decides |
|---|---|---|---|
| M1 | A CPU profile of the 24-hour catch-up on the realistic board, and of C240 at p99 | `bench/catchup/time.mjs --scene` with a profile; the engine bench's C240 | T-345, T-346, T-347; the before for brief 510 F5 (T-078) |
| M2 | The ground plan's build marks while moving sliders and on a fit change | `npm run bench:draw -- --compare` with M0's marks | T-352 |
| M3 | A pointer-move trace over the mat and the drag bench's hero drag | a 20 s DevTools trace of pointer moves; `bench:drag --kinds=dockHero` | T-349 |
| M4 | React commits per tick on an idle and a walking mat | `node bench/tick-commits.mjs` | T-351 |
| M5 | The soak: **after brief 510 F3**, `npm run bench:soak -- --hidden=20 --snapshot` (T-333 should close); a 10-minute visible idle run for the task-time and style-pass lines (T-350); in the 01:00 window, a 60-minute run of the readable build with snapshots (T-335) | `bench:soak` | T-333, T-335, T-350 |
| M6 | The save's size and stringify time on the owner's slot (a **copy**, never the original) and on cap128 with six Regions; `Atlas.settle` and `worldView()` times | M0's logs and script | T-353, T-354 |
| M7 | The desktop app minimised ten minutes, perf build, with the Perf HUD's task-time counter (or the harness's long-task observer) logged | the Tauri app, by hand | brief 510 F7 (T-344) |
| M8 | Boot timings from M0's marks, cold and warm | `bench:draw` | T-355 |
| M9 | The suite under a second seed, after brief 510 F2 | `FG_TEST_SEED=b npx vitest run` | T-340 closes; the second-seed run joins the bench window's routine (T-382) |

## Done when

- A results file `docs/active/review/baseline/measurements_<date>.md` with one row per measurement: the
  number, the scenario, the commit, the machine's state (quiet or busy).
- Each ticket in the "Decides" column updated in `TICKETS.md` (the director may edit status and add the
  number): "open, measured: <number>" when worth building, or closed as moot with the number when it is too
  small to matter (judge against `PERFORMANCE.md`'s targets; ask in STATUS when unsure).
- The STATUS bench queue drained; nothing else built in this brief.

**Eye-check: no.**

## Owner to-do

None, except a copy of a current save slot if the director cannot find one (M6).
