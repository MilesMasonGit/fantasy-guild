# Crunch prep P3 — measurement tools (plan)

**Status:** approved scope 2026-10-06 (owner interview); not started.
**Blocked on:** the comment-slimming pass merging (both touch `src/ui/`; one
code change at a time in the checkout).
**Read first:** `CLAUDE.md`, `docs/reference/TESTING.md`, `bench/README.md`,
`src/ui/dev/perf/` (the Perf HUD and stress boards from review round 3).

## Goal

Before the UI rework changes anything, be able to answer — repeatably, by any
agent, with one command — "how much does drawing this screen cost, which system
costs it, and does dragging always work?" Then record the baseline.

## What exists

- `npm run bench`: headless **engine** benchmark (no drawing), with a baseline
  and a same-work gate.
- **Perf HUD** (`?stress=realistic`, `window.__perf`): frame times, frame work,
  long frames, engine tick, React commits per surface. **Dev builds only.**
- Round 3 measured drawing in headless Chrome over the DevTools protocol with
  one-off scripts that were never committed (`docs/archive/review_v3/WAVE5_LOOK.md`).

## Owner decisions (2026-10-06)

| | Decision |
|---|---|
| Drawing benchmark | One command, like the engine bench, with a saved baseline |
| Production numbers | A **perf build mode**: the production build plus the measuring harness; the shipped build stays clean |
| Switches | All four groups: mat overlays, motion, side UI, mat art |
| Drag | An automated **drag-reliability test** is part of P3 |

## Phases

### P3.1 — Perf build mode *(builder)*
- `npm run build:perf` (and `preview:perf`): `vite build --mode perf`, identical
  to production except the harness in `src/ui/dev/perf/` is kept.
- The harness is gated on one flag (dev **or** perf mode) instead of
  `import.meta.env.DEV` alone. Mat Tuner / QA panel stay dev-only.
- Guard test: a normal `npm run build` bundle still contains no harness
  (grep `dist/` for `fg-perf-hud`, as round 3 proved by hand).

### P3.2 — Per-system switches *(builder)*
- One registry of named switches, all **on** by default, readable cheaply by
  components, and **absent from the normal production build**.
- Set by URL (`?off=rings,speech`) or `window.__perf.off('rings')`.
- **A switch stops drawing only, never game logic**: the engine bench must
  report *same work* with every switch off.
- Switches:
  - **Mat overlays**: progress/charge/spawn rings and badges (`rings`), alert
    icons (`alerts`), hero speech bubbles (`speech`), hover tooltips and
    popups (`tooltips`).
  - **Motion**: hero sprite animation (`heroAnim`), enemy animation
    (`enemyAnim`), walking drawn as a jump instead of a glide (`walkDraw`),
    item flight and loot particles (`itemFlight`).
  - **Side UI**: notification column (`notifications`), discard bin (`bin`),
    hero dock (`dock`), drawers (`drawers`).
  - **Mat art**: outlines and drag/loot shadows (`spriteFx`), background
    texture (`background`), particle canvas (`particles`).
- New UI built in the crunch adds its own switch (e.g. spawn pop-out).

### P3.3 — `npm run bench:draw` *(engineer)*
- A Node script (no new packages: Node 24's built-in WebSocket speaks the
  Chrome DevTools protocol) that starts a server (dev, or `preview:perf`),
  launches the installed Chrome headless with background throttling disabled,
  and for each scene: sets the window size, sets CPU slowdown, loads the
  scene, settles, resets `__perf`, measures a fixed window, reads the report.
- **Scenes**: S1 quiet, S2 realistic, S3 torture (existing stress boards),
  plus UI scenes on S2: Bank drawer open, Shop drawer open, a notification
  burst, a loot burst, hero inspection sheet open.
- **Cost table**: S2 once with everything on, then once per switch off; the
  difference is that system's cost.
- **Standard conditions**: perf build and dev build × CPU 1× and 4×; window
  1600 × 1000 (the desktop app's window) at DPR 1 (*director default; owner may
  overrule*).
- Output: a table plus JSON in `bench/results/draw/` (git-ignored);
  `--save-baseline` / `--compare` against `bench/draw-baseline.json`, with a
  looser tolerance than the engine bench (drawing is noisier) and an
  interleaved A/B mode for comparing two branches, as round 3 did by hand.
- ⚠️ Numbers are machine-specific: the baseline is the owner's PC only.

### P3.4 — `npm run bench:drag` *(engineer)*
- Same Chrome driver, but drags are **real browser input**
  (`Input.dispatchMouseEvent`), not JavaScript-made events, so it exercises
  the real hit-testing — where "other UI is blocking the drag" bugs live.
- On a busy S2 mat, N drags each of: hero dock → mat, flag → mat, Token → mat,
  Shop row → mat, Bank item → hero, Token → bin and back.
- **Success** = the game state changed as intended. Reports per kind: success
  rate, pickup delay (press → drag start), and for each failure the element
  that was actually under the pointer (`elementFromPoint`), naming the blocker.
- Also runs while speech bubbles and alerts are showing, since those overlay
  the mat.

### P3.5 — Baseline *(runner + director)*
- On a quiet machine (also re-save the engine baseline, T-004): engine bench,
  draw bench in all standard conditions, cost table, drag test.
- Record the numbers in `docs/reference/PERFORMANCE.md` (the mat-era
  performance guide, T-069): conditions, results, how to re-run. This is the
  "before" for the UI rework's "measure, don't fix" log.

## Done when

`build:perf`, the switches, `bench:draw` and `bench:drag` are merged with
tests; the baseline is recorded; the engine bench reports *same work* with
every switch off; the normal production bundle contains no harness.
