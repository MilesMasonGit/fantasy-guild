# Performance — baseline and how to measure

**Baseline recorded 2026-10-07** on the owner's PC, before the crunch's UI
rework. This is the "before" every UI change is measured against
("measure, don't fix"). Re-record it only on a quiet machine, and say why.

Still to write (T-069): the mat-era guide to *keeping* it fast (draft in
`docs/archive/review_v3/R6.md` §8 and `R7.md` §4). The Performance Envelope
(design limits) goes in the GDD §14 at the end of the crunch.

## The machine and conditions

- Intel i7-8700 (6 cores / 12 threads), NVIDIA RTX 3060 (Chrome: ANGLE /
  Direct3D 11, GPU compositing on), Windows 10, Node 24.
- Drawing: headless Chrome with GPU, window 1600 × 1000 at DPR 1, the **perf
  build** (production React plus the measuring harness), CPU at 1× and slowed
  4× (Chrome's throttle, standing in for a slow laptop). 20 s settle, 20 s
  window, 3 windows per scene.
- The screen's ceiling is ~165 FPS (6.06 ms per frame).
- Recorded at `main` `9a07e320`, with the owner's uncommitted Atlas edit to
  `StateSchema.js` in the folder.
- ⚠️ Numbers are machine-specific. Compare only runs from this PC.

## How to measure

| Command | What | Time |
|---|---|---|
| `npm run bench -- --compare` | Engine ticks, no drawing; fails on slower (exit 1) or **different work** (exit 2) | ~2 min |
| `npm run bench:draw -- --compare` | Drawing, perf build, 1× and 4×, all scenes | ~35 min |
| `npm run bench:draw -- --quick` | One quick S2 check (not comparable with full runs) | ~1 min |
| `npm run bench:draw -- --switches --cpu=4` | Cost of each system: S2 with one switch off at a time | ~13 min |
| `npm run bench:drag` | Drag reliability, real mouse input | ~13 min |
| `npm run check:perf-build` | Proves the shipped build has no measuring code | ~1 min |

Details, options and exit codes: [`bench/README.md`](../../bench/README.md).
In the game (dev or perf build): `?stress=realistic` + the Perf HUD, and
`?off=rings,speech` to switch systems' drawing off.

## Engine baseline (`bench/baseline.json`)

| Scenario | Tokens | tick p50 | tick p99 |
|---|---|---|---|
| S1 quiet hall | 9 | 0.034 ms | 0.105 ms |
| S2 realistic late game | 109 | 0.297 ms | 0.593 ms |
| S3 torture | 313 | 0.750 ms | 1.787 ms |
| S5 rebuild storm | 109 | 0.317 ms | 0.825 ms |
| S6 long idle | 109 | 0.287 ms | 0.525 ms |
| S7 waiting for room | 189 | 1.909 ms | 2.495 ms |

The engine is far inside its 1.5 ms target; drawing is where the cost is.

## Drawing baseline (`bench/draw-baseline.json`)

FPS (range of 3 runs) and frame work p50 / p99. "In budget" = frames done
within 6.06 ms.

| Scene | 1×: FPS | 1×: work | 4×: FPS | 4×: work | 4×: in budget |
|---|---|---|---|---|---|
| S1 quiet | 165 | 0.8 / 2.4 ms | 165 | 2.9 / 7.0 ms | 98 % |
| **S2 realistic** | **164** | 2.1 / 8.7 ms | **84** (83–84) | 12.6 / 48 ms | 6 % |
| S3 torture (~310 Tokens) | 159 | 3.2 / 12.9 ms | 26 (25–27) | 40 / 199 ms | 0 % |
| S2 + Bank open | 164 | 1.8 / 6.9 ms | 98 (79–101) | 11.9 / 36 ms | 5 % |
| S2 + Shop open | 164 | 2.0 / 8.4 ms | 81 (79–84) | 14.1 / 50 ms | 4 % |
| S2 + notification burst | 161 | 2.1 / 10.3 ms | 72 (68–79) | 13.7 / 71 ms | 5 % |
| S2 + loot burst | 158 | 3.0 / 10.7 ms | **40** (37–41) | 24.6 / 133 ms | 0 % |
| S2 + hero sheet open | 164 | 2.1 / 8.7 ms | 71 (70–81) | 15.1 / 55 ms | 2 % |

**Reading it:** on this PC the game is at the screen's ceiling. On a slow
laptop (4×) the realistic mat runs at ~84 FPS but almost no frame fits the
6 ms budget, and loot bursts drop it to ~40 FPS.

## What each system costs (S2, perf build, 4×)

Turning one system's drawing off at a time. All on: 79.6 FPS, frame work
13.7 ms (p50). Noise between identical runs: 8 FPS, 1.8 ms.

| System off | FPS | Frame work saved (p50) | Above noise |
|---|---|---|---|
| **rings** (progress / charge / spawn "bubbles") | 125.6 | **8.0 ms** (58 %) | yes |
| **heroAnim** (hero sprite frames) | 104.5 | 3.7 ms | yes |
| **notifications** (toast column) | 107.2 | 3.3 ms | yes |
| particles (particle canvas) | 95.1 | 2.3 ms | yes |
| itemFlight | 88.0 | 2.1 ms | yes |
| alerts | 87.2 | 1.9 ms | yes |
| bin | 82.9 | 1.9 ms | yes |
| enemyAnim, dock, speech, walkDraw | 82–88 | 0.5–1.7 ms | no |
| drawers, background, tooltips, spriteFx | 75–78 | none | no |

**The rings are over half the drawing cost** of a realistic mat, then hero
animation and the notification column. All three are in the owner's UI
rework list — the rework should measure them before and after.

## Drag baseline (`npm run bench:drag`, 50 drags per kind)

| Drag | Plain | With bubbles and alerts showing |
|---|---|---|
| hero dock → mat | 100 % | 90 % |
| flag → mat | **94 %** | **74 %** |
| Token → mat | 100 % | 82 % |
| Token → bin | 98 % | 100 % |
| bin → mat | 100 % | 98 % |
| Shop row → mat | 100 % | 82 % |
| Bank item → hero | 100 % | 100 % |

Pickup is instant once the pointer moves 8 px. Almost every failure is one of
the drag tickets: the closed hero sheet's invisible drop slots (T-104, most
failures), a hero sprite blocking its flag (T-105), a flag grabbing a Token
(T-106), an alert mark blocking a Token (T-107). Goal: 100 % everywhere.
