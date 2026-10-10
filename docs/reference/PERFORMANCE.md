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
| `npm run bench:draw -- --switches --cpu=4` | Cost of each system: S2 with one switch off at a time (`--only=cap128` for another board) | ~13 min |
| `npm run bench:draw -- --only=cap128,camp128,cap256` | The realistic mix at the Token cap: 128, the Starter Camp at 128, 256 | ~6 min per condition |
| `npm run bench:profile -- --scene=cap128 --cpu=4` | Where a frame's time goes: a trace, a CPU profile and the composited layers | ~2 min |
| `npm run bench:drag` | Drag reliability, real mouse input, and frame stalls at pickup, carry and drop | ~19 min |
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

⚠️ Since U1 (brief 10) the Token bubbles are the `bubbles` switch; `rings` now
hides only the Near ring, drawn while hovering or dragging. Today's table, on the
128 board: "Deep optimization (brief 60)", at the end.

## UI rework cost log

One line per UI rework phase (brief 10, brief 30): `npm run bench:draw -- --compare`
before and after, S2 at 4× (perf build). Measure, don't fix.

| Phase | Date | FPS before → after | Frame work p50 before → after (ms) | Note |
|---|---|---|---|---|
| U1 Bubbles | 2026-10-07 | 58.5 → 57.0 | 19.61 → 20.01 | Back-to-back A/B, 3 repeats each: no measurable change. Bubbles are still ~half the frame (96.9 fps with `bubbles` off): S2 at rest keeps its work-cycle and HP bubbles live by design, so hover-only saves little here. |
| U2 Health bars | 2026-10-07 | 57.8 → 55.3 | 19.31 → 20.60 | Stash A/B, 3 repeats each; ranges just touch, so possibly noise. Bars exist only in a fight or on enemy hover. |
| U3 Callouts | 2026-10-07 | 44.7 → 56.4 | 25.0 → 20.4 | The "before" looks like a slow outlier (U2's "after" was 55.3 / 20.60), so read this as no change, not a gain. |
| U4 Sidebars | 2026-10-08 | 56.1 → 55.8 | 19.7 → 20.41 | No change. The wider mat crosses the 2× art step at the bench's 1600×1000 (owner keeps 2×). Drag bench after the grab-by-circle and bin fixes (plain / overlays): flag → mat 94 / 72 %, Token → mat 92 / 100 %, all else 100 %. |
| U5 Shop layout and groups | 2026-10-08 | 52.1 → 53.5 | 21.61 → 21.30 | No change (Shop closed in S2). Shop row → mat 100 % in both drag passes. |
| U6 Top bar, Token Summary, Upkeep | 2026-10-08 | 55.4 → 46.7 / 60.3 | 19.5 → 23.5 / 17.6 | Two after-runs disagree; read as noise (the summary does nothing per frame while shut). Bench boards lift the new 80-Token cap so they keep measuring the same load. |
| U7 Token inspection | 2026-10-08 | 50.9 → 57.3 | 22.1 → 19.6 | No change (popup closed in S2; the before run was noisy, 47–66 fps). |
| U8 Motion and polish | 2026-10-08 | 41.7 → 59.9 | 26.21 → 18.51 | No change; the before run was a slow outlier. S2 has almost no spawns, so the spawn pop-out's own cost isn't measured here (`spawnMotion` switch exists for that). |
| H1 Hero bar | 2026-10-08 | 63.9 → 83.0 | 17.21 → 13.11 | No change: the before run was slow (another agent's worktree busy; it flagged S2, shop, notify, loot and inspect at 4×, the after run flagged bank and S3 instead). S2 keeps every level-up as a bar bubble now. Drag bench after (plain / overlays): hero dock → mat 100 / 100 %, flag → mat 92 / 92 %; no failure had a bar bubble under the pointer. |
| H2 Hero panel | 2026-10-08 | 48.0 → 61.4 | 47.36 → 18.61 | No change: the before run had one stalled window (10.8 fps; the other 85.2) with another agent's work loading the machine (~40 % CPU with the benches idle), and S2 keeps the panel shut. Drag bench after (plain / overlays): hero dock → mat 100 / 100 %, flag → mat 94 / 78 %, Token → mat 90 / 100 % (plain misses were a neighbouring Token picked up), Bank item → dock hero 100 / 100 %. |
| H3 Work rules panel | 2026-10-08 | 62.6 → 69.3 | 17.65 → 16.15 | No change: no draw scene opens the rules panel, and both runs were slow against the baseline on every scene (other agents' work loading the machine; the engine bench showed the same uniform slowdown at H2's code). Drag bench after (plain / overlays): hero dock → mat 100 / 100 %, flag → mat 88 / 70 %, Token → mat 84 / 100 %, all else 100 %. Every flag miss was a press landing on a neighbouring hero or Token, or under the mat's top bar; none touched the bar or the panel (closed throughout). |
| H4 The flag | 2026-10-08 | 62.5 → 59.5 | 17.65 → 19.05 | No change: the flag lost two elements (gear, idle chip; 36 fewer DOM nodes in S2), which cannot add cost; other agents kept the CPU at ~46 % with the benches idle. Drag bench after, two runs (plain / overlays): flag → mat 94 / 68 % and 86 / 74 %, hero dock → mat 100 / 100 %; every flag miss was a Token or a neighbouring hero picked up (T-105, T-106). |
| H1/H2/H4 eye-check fixes | 2026-10-08 | 48.1 → 64.8 | 22.25 → 16.70 | No change: both runs were far below the baseline (84 fps) on every 4× scene with another builder's benches loading the machine; S2 + hero sheet open 54.3 → 51.3 / 20.61 → 22.36 and S2 + Bank open both noise-sized. The flag drag's green dots are worked out once per pointer move (one pass over the mat's Tokens through `Flags.pinRefusal`): 0.011 ms a call with 11 Tokens in the game, so about 0.1 ms at the 80-Token cap. Drag bench after, two runs (plain / overlays): flag → mat 94 / (run aborted) and 90 / 84 %, hero dock → mat 100 / 100 %; every flag miss was a Token or a neighbouring hero picked up at the press (T-105, T-106), before any dot is drawn. The first run aborted because the bench took the hero panel, now left open beside the Bank, for the Bank itself; `BANK_OPEN` in `bench/browser/scenes.mjs` now leaves the hero panel out. |
| H3 v2 Work rules grid | 2026-10-08 | 51.9 → 74.7 | 20.81 → 15.00 | No change: the drawer is shut in every draw scene and renders nothing while shut (no drop target, no subscriptions); both runs shared the machine with other agents' benches (the before run was cut short after S2 at 4×; the after run's S3 at 1× read 107 fps, 154 fps on a lone re-run). Drag bench after (plain / overlays): hero dock → mat 100 / 100 % with 8 heroes beside the new button, flag → mat 90 / 88 %, Token → mat 84 / 96 %, Token → bin 100 / 96 %, all else 100 %; no miss touched the button or the drawer (neighbouring Tokens or heroes picked up, or a press under a bar hero's head). |
| O3 Catch-up bar and summary | 2026-10-08 | 61.6 → 49.0 | 18.15 → 24.41 | No change expected or claimable: neither is on any scene (both exist only during and after a catch-up). Back-to-back A/B with two other agents' draw benches running the whole time; the after run's two S2 repeats were 29.5 and 68.5 fps. The bar is a translucent full-screen cover (`bg-black/75`) over a mat that is not animating (the UI is quiet during a catch-up), moved only by `transform`; in the dev page it drew ~18 frames a second during a catch-up, one per 50 ms slice. The summary keeps the same cover over the live mat until closed. |
| O3 eye-check fixes | 2026-10-08 | 53.8 → 58.3 | 20.66 → 18.86 | No change expected or claimable: the summary is on no scene (it exists only after a shown catch-up). Back-to-back A/B, source stashed for the before run; the machine was busy (both runs took ~23 min). The new entrance animates only the summary's rows, opacity and transform for 220 ms each, staggered 35 ms (capped at 14 rows), then the class comes off; nothing is laid out again. The panel keeps the bar's translucent cover over a live mat until closed. |
| O3 second look | 2026-10-08 | 56.2 → 63.1 | 19.61 → 17.70 | No change expected or claimable: the summary is on no scene (it exists only after a shown catch-up). Back-to-back A/B in a worktree while other sessions loaded the machine (CPU ~36 % busy with nothing of ours running); both runs REGRESSED against the baseline at 4×, the before run worse. The summary now draws Item Bars (EntityRibbon): a hovered bar scales its 32 px sprite to 2× and crossfades two count spans, opacity and transform only; the confirmation swaps the two buttons for two others. Same translucent cover over the live mat until closed. |
| D2 Hit-testing (brief 50) | 2026-10-09 | 76.7 → 55.0 | 14.41 → 20.95 | No change. The after run read slower on every busy scene at 4× alike (S3, Bank, Shop, notify, loot too) on a busier machine (it took 40 min against 23); an interleaved A/B minutes later (`--ab`, A,B,B,A, at 4×) read D2 58.8 fps / 18.95 ms against the build before it 59.0 / 19.16 ms on S2 (S3 17.4 / 16.3 fps, Bank 64.5 / 63.1 fps). At 1× nothing moved (S2 work 2.00 → 2.01 ms). D2 changes the press path (once per press) and the mat cell's overflow (clip, not hidden); the last press fix (`2a60ee69`) is press-only and was not in the measured build. |
| D3 Redraws (brief 50) | 2026-10-09 | 55.0 → 62.0 | 20.95 → 18.11 | No change. The compare run flagged S2, S3, Bank, Shop, loot and hero sheet at 4× against the 2026-10-07 baseline (84 fps on S2, which no run this week has read), and S3's in-budget share at 1× (79.3 %; D2's run read 80.9 %). Interleaved A/Bs straight after against the build before D3 (`e25a0b2d`; `--ab`, A,B,B,A, at 4×), D3 / before: S2 60.3 / 60.0 fps (work 19.05 / 19.01 ms), Shop open 57.0 / 60.8 fps and on a second A/B 57.3 / 57.2, loot 32.3 / 30.5, notifications 53.1 / 52.0. At 1× S2 work 2.06 ms, 99.6 % in budget. No draw scene drags. |
| P2-1 Cycle ring (brief 60) | 2026-10-10 | 55.3 → 68.0 | 21.30 → 16.15 | cap128 at 4×, not S2: interleaved A/B against the build before (`86fbf8ad`), A,B,B,A twice, every window at a delivered 4.07–4.89×; within 16.7 ms 35.3 → 51.8 %. At 1× 2.65 → 2.35 ms, 98.7 % within 6.06 ms both. The rings step together ten times a second instead of each on its own frames; the `bubbles` switch still saves ~1 ms at 1× (see "P2-1 result"). |
| P2-2 Tutorial beacon (brief 60) | 2026-10-10 | 77.9 → 82.7 | 14.01 → 12.35 | Interleaved A/B against the build before (`a0a3edf1`, served from its own folder), A,B,B,A, every 4× window at a delivered 4.07–4.86×. cap128 at 4× 69.5 → 75.9 fps, 16.66 → 14.25 ms, within 16.7 ms 49.9 → 56.7 %; the new `hall` scene (both beacons showing) 117.2 → 125.8 fps. At 1× S2 2.35 → 2.10 ms and cap128 3.11 → 2.41 ms (a second cap128 A/B: 2.25 → 2.06 ms). The two beacons no longer query the page every frame: 43.6 ms/s (4.4 % of the 4× main thread) became ~7 ms/s on the step clock (see "P2-2 result"). |

## Drag baseline (`npm run bench:drag`, perf build, S2, 50 drags per kind and pass)

Re-taken 2026-10-09 in the drag deep-dive (brief 50): after briefs 10 and 30,
before its hit-testing fixes (D1, `5207889e`), and after them (D2: `c1d32ef2`,
then `2a60ee69` and a diagnostics re-run, 100 % every time).

| Drag | Plain: D1 → D2 | With bubbles showing: D1 → D2 |
|---|---|---|
| hero dock → mat | 100 → 100 % | 100 → 100 % |
| flag → mat | **92** → 100 % | **86** → 100 % |
| Token → mat | **86** → 100 % | **98** → 100 % |
| Token → bin | 100 → 100 % | 100 → 100 % |
| bin → mat | 100 → 100 % | 100 → 100 % |
| Shop row → mat | 100 → 100 % | 100 → 100 % |
| Bank item → hero | 100 → 100 % | 100 → 100 % |

The first baseline (2026-10-07, before the UI rework), plain / bubbles: hero dock
100 / 90, flag 94 / 74, Token → mat 100 / 82, Token → bin 98 / 100, bin → mat
100 / 98, Shop 100 / 82, Bank 100 / 100 %.

The D1 misses: a hero's see-through pixels refusing the press (T-105); flags
wholly over Token bodies, which ruling B5 left with nothing to press (now their
cloth takes it, T-130); the mat scrolled 30 px under the top bar by focus; and
the bench pressing where the game's rules give the press to something else
(Token bodies measured by their art box, bigger since brief 10; the top Token
rather than the nearest centre; bubbles, flags and heroes drawn over a flag).
D2 fixed the first three in the game and brought the bench's press points in
line with the game's rules ([`bench/README.md`](../../bench/README.md), fairness
rules). A flag wholly under things drawn in front of it (a worked Token is drawn
above every resting flag) cannot be pressed on the mat by anyone; the bench
passes it over and names what covers it. Seen with bubbles showing in each D2 run
(8, 20 and 14 of the 50 picks passed one flag over); in the run that recorded it,
a worked Token's round body, drawn in front of the flag, covered all of its cloth.

**Frames per drag phase** (D2 run, plain pass): the longest frame of 50 drags /
the median drag's longest, in ms, and in brackets how many of the 50 drags had a
frame over 16.7 ms.

| Drag | pickup | carry | drop |
|---|---|---|---|
| hero dock → mat | 55 / 24 (50) | 36 / 6 (1) | 36 / 24 (50) |
| flag → mat | 42 / 24 (50) | 12 / 6 (0) | 37 / 18 (49) |
| Token → mat | 42 / 30 (50) | 12 / 6 (0) | 43 / 24 (50) |
| Token → bin | 43 / 30 (50) | 36 / 12 (3) | 42 / 24 (50) |
| bin → mat | 36 / 30 (50) | 6 / 6 (0) | 49 / 30 (50) |
| Shop row → mat | 43 / 30 (50) | 18 / 12 (2) | 49 / 36 (50) |
| Bank item → hero | 49 / 36 (50) | 42 / 12 (5) | 55 / 24 (50) |

Reading: every pickup and nearly every drop has a frame over 16.7 ms, typically
24–36 ms and up to ~55 ms, in the perf build at 1× (T-033, the drag deep-dive's
D3). Carrying is smooth. The bubbles pass reads the same. In the D1 run carrying
stuttered more over the bin, the Shop and the Bank (a frame over 16.7 ms in 19,
29 and 47 of 50 plain drags; 34, 31 and 28 with bubbles); in the three D2 runs it
fell to 0–10. Not explained: D2's only change on that path is the mat's cell no
longer being a scroll container (`overflow-clip`). Re-measure before relying on it.

**D3 findings (brief 50, 2026-10-09).** Re-measured first, at `e25a0b2d` (full
run, plain pass): every kind had a frame over 16.7 ms in 47–50 of 50 pickups and
44–50 of 50 drops; carrying stalled in 0–8 of 50 drags (the bin 8, the Bank 5),
so D2's carry figures hold. What the long frame was, from CPU-profiled traces of
real drags (the perf build with source maps) and React's own commit log (dev
build): about 90 % JavaScript, forced layout and style under 2 ms. dnd-kit
changes its internal context three or four times per pickup and per drop (the
drag starts, the dragged node is measured, the first target is found; the same
at the drop), and each change re-rendered every component holding a drag or drop
hook: each of ~105 Tokens in full, about 1,000 components a change, with 8 mat
heroes, 8 flags, 8 hero-bar figures (whose reorder slots re-measured their
layout), the bin, and with a drawer open the Shop rows, Bank tiles and tabs, the
hero column and sheet. Besides: clearing the hover at pickup, and the moved Token
at a drop, re-ranked the mat's dense stack order and redrew 17–97 Tokens;
dnd-kit's drop-target boxes re-read the scroll position of every scrolling box
around each target, the page's included, on every collision check (~7 ms of a
traced pickup, ~50 ms with the Bank open), and measuring the targets at pickup
walked their ancestors once more; the notification column re-measured every
toast at drag start and end; a Shop purchase redrew the catalogue and the toasts
in the drop's own frame. Carrying was already smooth: R7's per-move costs had
been fixed before D3.

**What D3 changed** (ten commits, one cause each, each held by a render-count or
layout-read test: `src/tests/DragRedraws.test.js`, `DragRedrawsDrawers.test.js`,
`DragCollisionReads.test.js`, `DragDropAftermath.test.js`): a drag redraws only
what changes look (the thing in the hand, the target under it, the bar's
insertion gap). Each draggable is a thin shell holding the drag hook around a
memoised body; every mat Token is picked up through one shared drag source
instead of each holding its own; the stack order is written straight to the
Tokens' z-index; drop targets are measured once at pickup from their own boxes
and corrected only for boxes that scroll during the drag; the page itself is
never auto-scrolled (the drawers' lists still are); the notification column and
the Shop catalogue redraw after a drop's frame instead of in it. Look and
behaviour unchanged.

**After D3** (`7773c43c`, S2, plain pass, same format as above):

| Drag | pickup | carry | drop |
|---|---|---|---|
| hero dock → mat | 36 / 6 (2) | 42 / 6 (2) | 18 / 6 (1) |
| flag → mat | 12 / 6 (0) | 6 / 6 (0) | 18 / 6 (1) |
| Token → mat | 18 / 12 (3) | 7 / 6 (0) | 18 / 12 (5) |
| Token → bin | 18 / 12 (1) | 18 / 6 (1) | 12 / 6 (0) |
| bin → mat | 12 / 6 (0) | 12 / 6 (0) | 12 / 6 (0) |
| Shop row → mat | 12 / 6 (0) | 12 / 6 (0) | 24 / 12 (11) |
| Bank item → hero | 36 / 12 (9) | 36 / 6 (2) | 55 / 12 (6) |

With bubbles showing, pickups stall in 0–10 of 50 drags (Bank 10, Token → mat 7)
and drops in 5–13 (Token → mat and Shop 13). The bench's screen refreshes at
165 Hz, so frames come in steps of ~6 ms: 12 ms is one missed refresh, 18 ms two.
S2 with nobody touching it: 3 frames over 16.7 ms in a minute (0.03 %).

S3 (~320 Tokens), plain pass: the median drag's longest frame in ms (drags of 50
with a frame over 16.7 ms), before D3 (`e25a0b2d`) → after (`7773c43c`):

| Drag | pickup | carry | drop |
|---|---|---|---|
| hero dock → mat | 73 (50) → 12 (12) | 30 (50) → 12 (9) | 67 (50) → 24 (46) |
| flag → mat | 73 (50) → 12 (24) | 12 (18) → 12 (6) | 67 (50) → 24 (42) |
| Token → mat | 79 (50) → 24 (47) | 12 (13) → 12 (8) | 73 (50) → 24 (48) |
| Token → bin | 79 (50) → 18 (50) | 36 (50) → 12 (20) | 61 (50) → 18 (41) |
| bin → mat | 79 (50) → 12 (19) | 18 (26) → 12 (13) | 67 (50) → 18 (46) |
| Shop row → mat | 79 (50) → 12 (11) | 30 (50) → 12 (12) | 73 (50) → 24 (49) |
| Bank item → hero | 85 (50) → 18 (38) | 37 (50) → 12 (10) | 61 (50) → 18 (42) |

S3 runs drift with the machine: the run above read worse than one at `ee9a5b5a`
an hour earlier, yet an interleaved A/B of those two builds straight after
(A,B,B,A, 25 drags a side) read `7773c43c` equal or better on every kind and
phase (pickups stalling in 8–37 of 50 drags against 10–44, drops 26–46 against
31–50). S3 with nobody touching it has 28 frames over 16.7 ms a minute (0.29 %);
while carrying after D3, 0.3–0.8 % of frames (before D3, 0.6–14 %).

**What remains** (T-033), traced at `7773c43c` on S3 (four Token and four Bank
drags, CPU profiler on, so times read a little high). The pickup is one task of
16–26 ms: React's pickup render and effects 8–14 ms, of which ~4 ms is React
walking the whole tree for dnd-kit's context changes (at most ~90 components
render a commit now, against ~1,000 before D3), then restyling 200–420 elements
4–8 ms and layout ~2 ms. The drop is one task of 25–42 ms: restyling 330–1,190
elements 7–15 ms (the stack order rewritten to the Tokens' z-index: the ranks are
dense, so one Token moving re-ranks many), React's drop work 6–9 ms, layout 2–5
ms. With the Bank open, dnd-kit spends ~8 ms of each pickup measuring the drop
targets and the scrolling boxes around the dragged item, and equipping opens the
hero sheet inside the drop's task (~5 ms). The tutorial beacon's box read every
frame (T-131) takes 4–6 ms of each pickup's and drop's window. On S2 the same
costs are smaller and mostly fit in a frame. Next, by size: a sparse stack order
(ranks with gaps, so moving one Token rewrites one), then fewer dnd-kit context
changes per drag or a provider that wraps less of the tree.

## Owner certification run (2026-10-07)

The owner ran the certification checklist
(`docs/archive/certification_checklist.md`)
on their PC: dev build, Chrome 154, 1920 × 953, a 163.9 Hz screen. ⚠️ At
163.9 Hz a perfect frame is 6.10 ms, just over the 6.06 ms line, so the HUD's
"≤ 6.06" frame figure reads ~42 % even when nothing is late; use **frame work**
and **missed refreshes** instead.

| Check | Target | Result | |
|---|---|---|---|
| A4 busy board (S2), 5 min hands off | ≥ 99 % in budget, no freezes | **99.1 %** frame work in budget; 0.2 % refreshes missed; 0 long frames; worst 1-in-1,000 frame 12.2 ms | ✅ |
| A4 mat redraws | ≤ 1 / s | 5.1 / s own renders (9.5 subtree) — not measurable as specified (heroes always walk on a stress board); the review measured ~40 | ⚠️ |
| A7 torture board (S3, ~320 Tokens) | ≥ 95 % in budget | **83 %** frame work in budget (the perf build at 1× gives 87 %); longest frame 66 ms | ❌ known: crunch optimization / Envelope |
| A6 a kill on S3 (the old CR3-250 stall) | no freeze | Owner saw none; game tick max **5.9 ms** with 4 kills (was 120–220 ms per kill) | ✅ fixed |
| B1 pick up / drop, S2 | — | **~90 ms pause at every pickup**, ~60 ms at every drop (owner saw "a slight hitch at the start of the drag"); 226 ms / 177 ms on S3 | ❌ T-033 |
| B2 carrying over the dock, S2 | — | the mat redraws ~115×/s while a Token is carried (9×/s otherwise); 6 % of frames over 16.7 ms (judder) | ❌ T-033 |
| B4, B5, B8, C1–C6, D1–D4, E1 | the fixed behaviour | all as intended (the old review's bugs CR3-100, 300, 401, 405, 409, 450, 451, 010 confirmed fixed by eye); a quick flick lands where released | ✅ |
| B3 | — | skipped: describes the retired Vault-era design | — |
| F, G (engine bench, 60-min soak) | — | F done by the director the same morning (above); G skipped | — |

Owner ruling from B6/B7: a mat Token or flag dropped over the Shop drawer or
the hero sheet **lands on the mat underneath**; that is the intended behaviour.

The pickup/drop stalls are dev-build numbers (React's development build
re-renders several times slower than players see), so players get a smaller
hitch: in the perf build `bench:drag` measured ~24–36 ms frames at pickup and
drop before D3, and after it a typical S2 pickup or drop has no frame over 12 ms
(Drag baseline, above). In the dev build itself (`bench:drag -- --dev`, S2, 15
drags per kind, back to back, 2026-10-09) the median drag's longest pickup frame
went from 164–212 ms before D3 to 12–24 ms after, and the drop's from 55–127 ms
to 18–36 ms.

## Deep optimization (brief 60): ranking and plan, 2026-10-09

**Owner rulings (2026-10-09):** the must board is the **128-Token board**
(the Starter Camp and 256 are reported, not gated); the **top cap of 256 is
decided after the P2 fixes**; the cycle ring uses the **cheap version now**,
and bubble styles get a later design pass for a polished look at a stable
framerate. The owner also expects terrain (brief 80) to be static, not
animated, so it stays cheap, and hopes static Tokens can yield more gains.


Brief 60 P1: the post-rework game re-measured, the causes of drawing cost ranked,
and the P2 plan. Branch `crunch/optimize`: measured at `b5c313a6` (brief 50 on top
of the old `main`) in the morning and at `0a304871` (current `main` merged in:
briefs 40 and 50, T-120, T-129, A9) in the afternoon. **The merge did not change
what a frame costs**: an interleaved A/B at 1× on the 128 board (A,B,B,A twice)
read 3.46 ms frame work p50 on both builds (156 / 151 fps). Planned for the
owner's cap (Atlas roadmap D-9): **128 Tokens to start, +16 a rank, up to 256**.

New tools for it (bench/README.md): the cap boards `cap128`, `camp128` and
`cap256` (`?stress=` in game, `--only=` in `bench:draw`, `--board=` in
`bench:drag`); `bench:draw` reports frames within 16.7 ms, frame work p95 and the
1-in-1,000 frame interval, and runs `--switches` on any one board;
`npm run bench:profile` (a trace, a CPU profile and the composited layers of one
settled scene, mapped to `src/` lines); and the delivered-slowdown check below.

### "Smooth", defined

On the perf build at **4× CPU slowdown** (the crunch plan's slow laptop), 1600 ×
1000, hands off, `bench:draw`'s 20 s settle and 20 s window, the median of three
windows (or of an interleaved A,B,B,A pair), each window at a delivered slowdown
within 25 % of 4× (see "Chrome's throttle", below):

1. **≥ 95 % of frames' work within 16.7 ms** (the `≤16.7 %` column).
2. **Frame interval p99.9 ≤ 33.4 ms**: at most one frame in a thousand misses two
   or more refreshes of a 60 Hz screen (`interval p99.9`).
3. **Picking up and dropping** (`bench:drag -- --cpu=4` on the same board, plain
   pass): the median drag's longest frame ≤ 33.4 ms at pickup and at drop, for
   every kind.

The **must** is the realistic board at the base cap, **`cap128`** (130 on the mat
with the Hall and a quest). The Starter Camp at that cap (`camp128`, 155 on the
mat) and the top cap (`cap256`, 258) are measured against the same lines and
reported, not gated (owner questions below).

Why these lines:
- **16.7 ms, not 6.06.** 4× stands in for a slow laptop, and a slow laptop has a
  60 Hz screen. 6.06 ms is the owner's 165 Hz screen at full speed, where the
  certification's bar (A4: ≥ 99 % in budget on S2) still holds: at 1× the 128
  board does 99.5 % of frames within 6.06 ms.
- **95 %** is the owner's own certification bar for a board under strain (A7).
  A4's 99 % is the full-speed bar; at 4× Chrome's throttle multiplies any other
  load on the PC, and identical windows here differed by up to 18 points.
- **p99.9, not "no frame over 33 ms"**: the certification judged freezes by the
  worst 1-in-1,000 frame (A4: 12.2 ms). One garbage collection in a 20 s window
  would fail a "never" rule; a hitch that recurs fails this one.
- **Drags** are what players feel most (T-033, certification B1/B2). The median
  drag is the bench's robust figure; 33.4 ms is two missed 60 Hz frames.

### Conditions, and Chrome's throttle

The PC was shared all day: other agents' engine benches, test suites and dev
servers in sibling worktrees, and the owner's art app open (about 23 % of the
GPU). A load log (every 20 s) records which windows overlapped what; overlapped
runs were stopped and re-run, or are marked below. Between about 23:05 and 23:20
the shared `node_modules` was partly deleted and reinstalled (a cleanup mistake);
runs in that window are marked suspect.

⚠️ **Chrome's CPU throttle does not deliver what it is asked on this PC.** Asked
for 4×, it delivered anywhere from 1.0× to 21.8× (timed with a fixed piece of
JavaScript at 1× and at the throttle, before and after each window), sometimes
changing inside one window. Such a window runs at 4–8 fps or at 120 fps for no
reason in the game (the engine tick slows with it; MatBoard's renders stay
normal). It explains the bimodal windows (Shop open 13.3 / 120.5 fps, hero sheet
8.5 / 48.7 fps, an all-on window of the 4× cost table at 23.7 fps) and the
wide noise of every 4× table this week. In the morning the 4× windows agreed
within ~10 fps; in the afternoon most were 25 % or more off and were re-measured.
`bench:draw` now checks every throttled window and measures it again when the
slowdown is off; `bench:profile` and `bench:drag` print it. **At 1× the numbers
are steady**, so P2 gates on an interleaved A/B at 1× first and confirms at 4×.

### Fresh numbers

**At 1×** (`0a304871`, three windows each, quiet apart from the art app):

| Board | On the mat | fps | Frame work p50 / p95 / p99 | ≤ 6.06 ms | ≤ 16.7 ms | Interval p99.9 |
|---|---|---|---|---|---|---|
| S2 realistic | 102 | 161.6 | 2.91 / 6.41 / 10.10 ms (windows 2.1–4.5 p50) | 93.8 % | 99.9 % | 18.2 ms |
| **cap128** | 130 | 164.9 | 2.31 / 4.70 / 5.70 ms | **99.5 %** | 100 % | 6.3 ms |
| camp128 | 155 | 164.7 | 2.51 / 5.01 / 7.61 ms | 98.0 % | 100 % | 12.1 ms |
| cap256 | 258 | 161.4 | 2.81 / 7.60 / 11.90 ms | 92.2 % | 99.6 % | 18.0 ms |
| S3 torture | 310 | 155.0 | 3.60 / 10.20 / 15.71 ms | 78.9 % | 99.4 % | 24.3 ms |

**At 4×, morning** (`b5c313a6`, three windows each, 10:20–10:40, the windows
agreeing within 65–76 fps on the S2-sized boards; the slowdown check did not
exist yet). The build does the same work per frame as the merged one (A/B
above), so this is the best 4× picture of the current game:

| Board | fps | Frame work p50 / p95 / p99 | ≤ 16.7 ms | Interval p99.9 | Long frames (n / worst) |
|---|---|---|---|---|---|
| S2 realistic | 73.5 | 15.71 / 33.81 / 47.70 ms | 54.5 % | 60.7 ms | 1 / 91 ms |
| **cap128** | 71.6 | 16.10 / 33.41 / 43.40 ms | **52.2 %** | **42.5 ms** | 0 |
| camp128 | 71.7 | 15.90 / 34.50 / 46.01 ms | 52.5 % | 54.6 ms | 0 |
| cap256 | 45.3 | 25.31 / 51.01 / 62.91 ms | 24.7 % | 78.8 ms | 3 / 60 ms |
| S3 torture | 24.0 | 49.81 / 89.21 / 144.10 ms | 3.6 % | 218.1 ms | 18 / 179 ms |

**At 4×, afternoon** (`0a304871`, only windows at a delivered 3.1–4.9×, on a
busier PC: the same boards read ~45 % more frame work at 1× then): S2 61.3 fps,
44.3 % within 16.7 ms; cap128 46.5 fps, 23.2 %; camp128 50.2 fps, 30.6 %;
cap256 27.6 fps, 4.0 %; S3 16.9 fps, 0.3 %.

**Against "smooth"**: the 128 board at 4× has 23–52 % of frames within 16.7 ms
(the line is 95 %) and a 1-in-1,000 frame of 42–67 ms (the line is 33.4 ms). Its
p95 frame is ~33 ms: the typical bad frame must roughly halve. Frame cost barely
grows from S2 (102) to the Starter Camp (155): **most of it does not scale with
the number of Tokens** (below). 256 doubles it.

**All scenes, morning** (`b5c313a6`, two windows each, `--compare` against the
2026-10-07 baseline): 1× S1 0.65 ms p50, S2 2.11 ms (98.9 % within 6.06), S3
3.55 ms (81.5 %), Bank 1.91, Shop 2.11, notifications 2.51, loot 3.55, hero sheet
2.46 ms; nothing over 16.7 ms in more than 0.7 % of frames. 4× S2 71.1 fps (53 %
within 16.7 ms), Bank 65.5 (48 %), notifications 48.7 (32 %), loot 28.9 (20 %),
S3 18.1 (1.4 %); Shop and hero sheet bimodal (off-throttle windows). The compare
flagged S3, Bank, Shop, notifications, loot and hero sheet at 4×: every 4×
number this week reads below the 2026-10-07 baseline (84 fps on S2), and the
throttle finding above is the likeliest reason; at 1× only S3's in-budget share
(81.5 % against 87.4 %) and the p99 of loot and hero sheet were flagged.

**The torture board (T-071)**: perf build at 1×, 78.9–81.5 % of frames within
6.06 ms (the certification read 83 % in the dev build, 87 % in the perf build);
at 4×, 0 % within 6.06 ms and 0.3–3.6 % within 16.7 ms.

**Engine** (`npm run bench -- --compare`, `0a304871`): exit 0, the same work as
the baseline in all ten scenarios (S8, S8L, S8F included); S2 tick 0.315 /
0.611 ms p50 / p99 (baseline 0.297 / 0.593), S3 0.792 / 1.638 ms.

**Drags on the 128 board** (`0a304871`, plain pass, 20 a kind, at 1×; run inside
the `node_modules` repair window, so suspect): 100 % but flag → mat 19 / 20 (a
hero over the flag, T-132); the median drag's longest frame 6–12 ms at pickup, 6
ms carrying, 12–18 ms at drop; Bank equip drops up to 55 ms. **At 4× not
measurable today**: per kind Chrome delivered 1.1× to 11.9×, with four other
test suites running.

### Where a hands-off frame goes (128 board, 4×, `bench:profile`)

Traced at a delivered 4.2× (`0a304871`; tracing slows the page, so shares, not
times): the main thread is busy the whole second. **Paint and compositing 39 %**
(Layerize 18 %, Paint 11 %, PrePaint 6 %, Commit 3 %, layer updates 1 %),
**script 22 %**, **style 18 %**, task overhead 13 %, layout 7 %. One style pass,
one paint and one full layerize **every frame**: on a hands-off mat something
changes every frame, and every change pays for the whole page's layers.

- **What changes every frame** (invalidation trace): running animations restyle
  ~540 elements a second (the worked Tokens' hit loops, ~280; the floor loot's
  idle bob; the charge floaters); hero sprites write ~290 inline styles a second
  (16 sprites: 8 on the mat, 8 in the hero bar, each on its own timer, 128 timer
  callbacks a second); the cycle rings rewrite their arc ~235 times a second.
- **Layers**: 73 composited layers; 30 exist only because they are drawn over
  another composited layer ("Overlap": Token art boxes, heroes, flags, name
  badges above the 7 worked Tokens' hit-loop animations), 5 are toasts with a
  backdrop blur inside the closed notification column, 4 are bobbing loot.
- **Script** (entry points, ms per second at 4×, traced): the tutorial beacon 38
  (two animation-frame loops, each a whole-document `querySelector` every
  frame), React's scheduler 37, the engine tick 35, hero sprite timers 22, the
  cycle-ring sweep 18, framer-motion 10, the particle canvas 7, the Perf HUD
  harness ~15 (in every run alike).
- **At 256** the same causes, larger: Layerize 6.9 ms a frame (128: 4.3), React
  54 ms/s (33), layout 98 ms/s (52).

**What each system costs at 1×** (`--switches --only=cap128`, `4129b17b`, the
merged game; noise 0.39 ms; all on 2.40 ms p50). Clean first half: **`bubbles`
1.20 ms (half the frame)**, `itemFlight` 0.50, `heroAnim` 0.49 ms, above the
noise; `speech` 0.39, `walkDraw` 0.39, `tooltips` 0.29, `alerts` 0.19,
`enemyAnim` and `rings` nothing. The second half (`notifications`, `bin`, `dock`,
`drawers`, `spriteFx`, `background`, `particles`, `spawnMotion`) ran over another
agent's engine bench, a minute at 100 % CPU and the `node_modules` repair, and
reads as negative savings: not usable; re-run it in P2-4's "before". The 4× table (`b5c313a6`) is unusable too: its
three all-on windows read 23.7, 55.8 and 80.2 fps (an off-throttle window), and
only `bubbles` stood clear (5.8 ms against 14.0–21.2 ms all on).

### Causes, ranked

Ranked by cost × how often a player meets it. Costs are on the 128 board;
"measured" is a switch-off or trace figure, "reasoned" is not yet measured.

| # | Cause | Cost now | Where | How often | Candidate fix | Look risk | Expected gain |
|---|---|---|---|---|---|---|---|
| 1 | **Token bubbles**, driven by the cycle ring's sweep: every worked Token rewrites its arc up to 400 times a cycle through the shared frame clock, so nearly every frame restyles, repaints and re-layerizes; the bubble rows add ~200 DOM nodes, the charge floaters' animations and half the layouts (14.3 → 6.7 a second with bubbles off, one traced pair) | 1.20 of 2.40 ms at 1× (measured); 4×: 5.8 ms against 14–21 ms all on (one window) | `TokenBubbles.jsx:26` (`RING_STEPS`), `:167-228` (the sweep), `RingBadge.jsx:54` (`paintRing`), `:124` (three blurred text shadows), `frameClock.js:31` | every frame while any hero works: all of play | stop the per-frame repaint: (a) a composited sweep (the arc turned by a transform animation, no main-thread paint); (b) all rings stepped together on one clock at whole-pixel steps | (a) none if pixel-identical (screenshot diff); (b) a slightly stepped sweep: owner | up to the switch's 1.2 ms at 1× (half the frame); at 4× the largest single gain |
| 2 | **Compositing over 73 layers**: every frame's paint pays a full layerize; 30 layers exist only by overlap with the worked Tokens' infinite hit-loop animations; 5 toasts keep a backdrop blur inside the closed (invisible) notification column | ~39 % of the 4× main thread is paint and compositing (traced); the split by source is not measured | `TokenHitArt.jsx:52` (`iterations: Infinity`), `Toast.jsx:58` (`backdrop-blur-md`), `PopOutSidebars.jsx:17` (panels stay mounted while closed), `tailwind.css:309-326` (loot bob) | every frame | layer diet: the closed column draws no blur or animation while shut; then a spike on the hit loops (not composited, or contained so nothing above them becomes a layer) | closed column: none; hit loops: pixel check | reasoned: the part of Layerize (18 %) and Commit the extra layers cost; measure layers and Layerize ms per slice |
| 3 | **Loot flights** (`itemFlight`): arcs and absorb slides on the mat, collection flights on a full-window canvas every 2.5 s (auto-collect), every floor sprite redrawn when any changes | 0.50 ms at 1× (measured); loot burst scene 28.9 fps at 4× | `SpriteLayerView.jsx:53` (`allSprites`), `:93` (`playLootArc`), `ParticleOverlay.jsx:86` (window-sized canvas), `:130` | every cycle drops loot; auto-collect every 2.5 s | memoise the floor sprites on their own data; a canvas only as big as the flights | none | ≤ 0.5 ms at 1×; most in loot bursts |
| 4 | **Hero sprite steps**: 16 sprites, each on its own `setTimeout`, so most frames carry one sprite's style write | 0.49 ms at 1× (measured); 128 timer tasks a second | `AnimatedHeroSprite.jsx:51-72`, `DockHeroFigure.jsx:275` (the bar's figures use it) | always (8 on the mat, 8 in the bar) | one shared clock stepping every sprite in the frame its step falls due (same frames, same phases) | none | ≤ 0.5 ms at 1× |
| 5 | **Tutorial beacon** (T-131): two animation-frame loops, each a whole-document `querySelector` every frame (the targets are missing on the bench boards), and a JS-driven `borderWidth` pulse when shown | ~4 % of the 4× main thread (38 ms/s, traced) | `TutorialAideOverlay.jsx:92-133`, `:103`, `:171` | every frame while the recruit-hero step is active: every new player, and every bench board | find the target on events, run the loop only while a target exists and moves | none | ~4 % at 4× (measured share) |
| 6 | **Engine tick and the React work it sets off**: 10 ticks a second, each with its synchronous listeners and a React commit | tick 2.1–2.8 / 9.9–14 ms p50 / p99 at 4×; tick 35 and React 37 ms/s traced | `GameLoop.js:34`, listeners in `useGameState.js:98`, `tokenEvents.js` | 10 frames a second | profile the tick's listeners and commits; coalesce per-tick commits | none | reasoned: the p95–p99 frames |
| 7 | **Dense stack order**: a spawn, a used-up tree, a hero starting work, the hover or a drop re-ranks every Token between; at the cap a spawner refills every freed place, so this churns | D3: 330–1,190 elements restyled per drop on S3 (measured); a ~90 ms task restyling ~350 elements at the same moment of two traced S2 + hero sheet windows (what restyled them is not identified yet; a re-rank is the likeliest) | `matLayers.js:39` (`TOKEN_SPAN`), `:73` (`matStackOrder`), `stackWriter.js`, `MatBoard.jsx:325-333` | spawns and depletions every few seconds at the cap; every drag | sparse ranks (moving one Token rewrites one) | none (same order) | drop and spawn spikes; also fixes a look fault at 256 (below) |
| 8 | **Picking up and dropping** (T-033): dnd-kit's context changes reach every drag-hook holder; re-ranks (#7); the Bank measuring its targets | 1×: median longest frame 6–18 ms (fine); 4×: not measurable today | `DndKit.jsx:483-513`, `Bubble.jsx:11`, `SpriteLayerView.jsx:82`, `MatHero.jsx:120` | every drag | after #7: fewer context changes per drag, a provider that wraps less | none | reasoned |
| 9 | **Notification column while shut**: each toast measures its layout (`layout="position"`) and glows by a JS box-shadow animation inside an invisible panel | notification burst scene 48.7 fps at 4× (S2 71) | `Toast.jsx:51`, `:111`, `ToastContainer.jsx` | every item notification (~1.3 a second with auto-collect) | no layout animation or glow while the panel is shut | none | reasoned; folds into #2's first slice |
| 10 | **The minimised desktop app keeps drawing** (T-117) | battery and GPU, no frame time | Tauri window events | whenever minimised | pause drawing on minimise | none | not a frame cost |

### P2: the slices, in order

One cause per slice. Every slice: before and after **back to back** as an
interleaved A/B (`bench:draw -- --ab=<the build before> --only=cap128,S2`) **at
1× (the gate: steady)** and **at 4× (confirmation, delivered slowdown checked)**;
`bench:profile -- --scene=cap128 --cpu=4` before and after for the mechanism
(the events, restyles, layers or script entries the slice targets);
`npm run bench -- --compare` exits 0 (same work); the full test suite; the smooth
check on `cap128` at 4× (three windows) at the end; and a line in this file. Stop
when the must is met, or when the next fix needs a design change (ask the owner,
batched).

| Slice | Cause | Files | Guard tests to write | Owner? |
|---|---|---|---|---|
| P2-1 | #1 cycle-ring sweep | `TokenBubbles.jsx`, `RingBadge.jsx`, `frameClock.js` | a running cycle writes nothing to the page per frame (or at most N steps a second, with every ring in the same frame); the ring shows the right fraction at a given time and restarts on `CYCLE_COMPLETE`; blocked rings freeze; `TokenBubbles`, `RingGlide` and `FrameClock` tests stay green | only for option (b) |
| P2-2 | #5 tutorial beacon (T-131) | `TutorialAideOverlay.jsx` | extend `TutorialBeaconRect.test.js`: no document query and no box read per frame while the target is missing or still; it still follows a moving target | no |
| P2-3 | #4 hero sprite clock | `AnimatedHeroSprite.jsx`, `AnimatedEnemySprite.jsx`, `frameClock.js` | `SpriteFrameSequence` and `SpriteFramesWithoutReact` stay green; 16 sprites make one scheduled callback per due frame, not 16 timers; the strike frame still meets the hit animation | no |
| P2-4 | #2 and #9: the shut notification column | `Toast.jsx`, `ToastContainer.jsx`, `PopOutSidebars.jsx` | while shut: no backdrop filter, no layout measuring, no glow animation; opening shows the same toasts as before; layer count in `bench:profile` | no |
| P2-5 | #2: hit-loop layers | `TokenHitArt.jsx` (a spike first, in its own worktree) | `HitAnimations` stays green; a pixel diff of a worked Token over its loop; the layer count drops | if pixels differ |
| P2-6 | #3 loot | `SpriteLayerView.jsx`, `ParticleOverlay.jsx` | one sprite's change redraws one sprite; flights still land where the item went (`MatFrameDrops` stays green) | no |
| P2-7 | #7 sparse stack order | `matLayers.js`, `stackWriter.js`, `MatBoard.jsx`, `FlagLayer.jsx` | for random boards of 10–300 Tokens and flags, the pairwise order equals today's rules; a moved Token rewrites only its own boxes; at 256 + 25 sites every Token keeps its own place (no clamp) | no |
| P2-8 | #6 tick and React per tick | engine listeners, `useGameState.js` | per-tick commit count on S2 (dev build); the engine bench's same-work gate | no |
| P2-9 | #8 drags | `DndKit.jsx` and its consumers | `DragRedraws*`, `DragCollisionReads`, `DragDropAftermath` stay green; context changes per pickup counted | no |
| P2-10 | #10 T-117 | `src-tauri`, one window listener | the minimise event stops the frame loop; restore resumes it | no |

**In parallel** (separate worktrees; files disjoint): P2-2, P2-4 and P2-10 can
each run beside any other slice. P2-1 and P2-3 share `frameClock.js`: one after
the other. P2-5 and P2-7 both touch the mat's stacking: one after the other.
⚠️ **Measuring is never parallel**: one bench at a time on this PC (a second
bench, a test suite or a build moves every number, and the 4× throttle with
them), and every slice's A/B serves the build before it from its own worktree
and port.

### P2-1 result: the cycle ring (2026-10-10)

**What changed** (`f737c422`): a running cycle ring is written only on the shared
step clock (`frameClock.onStep`: a timer, then one animation frame; ten steps a
second, every ring in the same frame). An engine progress event only moves the
ring's model, so a time-skip draws once, where its last progress put it. Blocked
rings freeze, `CYCLE_COMPLETE` restarts, and a ring that remounts mid-cycle
(after a drag) is drawn at once. The inspection's Time and XP rings read the mat
ring's cycle (`cycleShare.js`) and step with it; they used to jump every 300 ms on
the engine's progress while the mat ring swept. The look is the same ring: a still
of the same Token mid-cycle differs in 3 of 2,025 pixels (the arc's end, 0.511
against 0.512); the motion is ten steps a second (a 12 s cycle moves under a pixel
a step at play size, a 3 s cycle about 3 px). Guards: `CycleRingSteps.test.js`
(each guard fails when its part is neutered), `FrameClock.test.js`.

**Measured** (`bench:draw --only=cap128 --ab`, the build before served from its own
worktree, A,B,B,A twice, quiet PC; before → after):

| | fps | Frame work p50 / p95 / p99 | ≤ 6.06 ms | ≤ 16.7 ms | Interval p99.9 |
|---|---|---|---|---|---|
| 1× | 164.9 → 165.0 | 2.65 / 5.11 / 6.31 → 2.35 / 4.95 / 6.21 ms | 98.7 → 98.7 % | 100 → 100 % | 6.3 → 6.3 ms |
| 4× (all 8 windows at a delivered 4.07–4.89×) | 55.3 → 68.0 | 21.30 / 42.6 / 53.3 → 16.15 / 39.0 / 50.1 ms | 0.2 → 14.0 % | **35.3 → 51.8 %** | 54.6 → 51.6 ms |

A second sample of the same after-build (the B side of a later A/B): 1× 2.21 ms,
4× 15.66 ms, 53.1 % within 16.7 ms. S2 at 1× (A,B,B,A): 2.26 → 2.11 ms (noise-sized).
The Perf HUD on the dev build (cap128, 1×, A,B,B,A): 2.61 → 2.31 ms, 97.9 → 98.3 %
within 6.06 ms. **The mechanism** (`bench:profile --scene=cap128 --cpu=4`, one traced
window each): the frame clock's 18.8 ms a second at 41.5 calls (every frame) became
6.5 ms at 10.2 steps plus a 1.0 ms timer; Paint events 597 → 401 a second; the main
thread's cost a frame 24.0 → 17.6 ms.

**Not done by it: the bubbles still cost about 1 ms at 1×.** The cost table
(`--switches --only=cap128`, 1×) read `bubbles` saving 1.01 ms of 2.41 before (noise
0.11) and 0.99 ms of 2.30 after (noise 0.21). Cause #1 put the bubbles' cost on the
sweep; at 1× the sweep was ~0.3 ms of it. The rest is the bubbles being there on every
frame something else changes (hero sprites, hit loops: P2-3, P2-5): with them off
(after-build, traced at 4×) a frame's Layerize is 2.8 ms against 3.6, Paint 0.9 against
1.8 ms, and layouts 5.5 against 11.7 a second (each worked ring's number changes once
a second). Making each ring a relayout boundary (`contain: size layout`) halved the
dirty objects per layout and cut traced layout time by a third, but an A/B (A,B,B,A
twice, 1× and 4×) showed no change (1× 2.31 against 2.21 ms, 4× 15.2 against 15.7 ms),
so it was dropped. Against "smooth" the 128 board at 4× is now at ~52 % of frames
within 16.7 ms (the line is 95 %).

### P2-2 result: the tutorial beacon (2026-10-10)

**What changed**: a beacon looks its target up and reads its box once a step
(`frameClock.onStep`, ten a second) and on a window resize or scroll, never every
frame. When a step finds the target moved it follows it every frame until it has
stood still for 10 frames, then drops back to steps; a target that goes takes the
beacon with it at the next step, and one that comes back brings it back. A fresh
resolver function each render no longer restarts the beacon. Guards:
`TutorialBeaconRect.test.js` (each per-frame guard fails against the old loop and
against a neutered step clock; following, settling and going were each neutered
and caught).

**Measured** (`bench:draw --ab --only=S2,cap128,hall`, the build before served by
Vite preview from its own folder, A,B,B,A; before → after): see the cost-log line.
**The mechanism** (`bench:profile --scene=cap128 --cpu=4`): the beacons' frame
loop, 43.6 ms/s at 78.7 calls (4.4 % of a 993 ms/s main thread), is gone; the step
clock's `runStep` went 7.1 → 14.5 ms/s, so the two beacons' lookups cost ~7 ms/s
there (~0.35 ms a step at 4×: two whole-page attribute queries that find nothing).
The after-trace shared the machine with another agent's engine bench for part of
its window (delivered 4.07× → 4.59×); an earlier after-trace read the same
`runStep` (14.5 ms/s) at a delivered 2.38×.

**Not done by it**: on every board but the Guild Hall the standing beacons' targets
are missing, so the remaining cost is those two queries ten times a second. Giving
the roster node and the upgrade button an id (an O(1) lookup), or mounting the
standing beacons only while the Guild Hall is open, would take it to nothing; both
touch files outside this slice. The `borderWidth` pulse (`:171` in cause #5) is
unchanged: it runs only while a beacon shows.

### Owner questions

1. **Which board must be smooth?**
   - **A (recommended)**: the realistic board at the base cap (128). The Starter
     Camp (155 on the mat with its 25 uncounted sites, Atlas D-1 B) and 256 are
     measured after every slice and reported. Today the Starter Camp costs the
     same as the 128 board.
   - B: the Starter Camp at the base cap must pass too.
   - C: every cap up to 256 must pass. At 4× the 256 board is at 25 % within
     16.7 ms today; it likely needs the canvas mat (T-071), a design change.
2. **The top cap, 256**: at 4× it doubles the 128 board's frame cost, and the
   stack order runs out of ranks there (below).
   - **A (recommended)**: keep 256; brief 90 (Envelope) states how it runs on a
     slow laptop, with brief 60's numbers.
   - B: lower the top cap to what passes once P2 is done.
   - C: decide after P2.
3. **The cycle ring**, only if P2-1's composited sweep does not come out
   pixel-identical:
   - **A (recommended)**: the composited sweep anyway (same look, smoother cost),
     shown to you side by side first.
   - B: rings that step a whole pixel at a time, every ring on one clock.
   - C: leave the rings as they are.

### Wrong against the code (found in P1)

- "What each system costs" above (2026-10-07): `rings` was the bubbles then.
  Since U1 the Token bubbles are the `bubbles` switch (`MatToken.jsx:121`,
  `MatHero.jsx:168`); `rings` now hides only the Near ring (`MatBoard.jsx:428`),
  which draws only while hovering or dragging, so it costs nothing hands off.
- Brief 60 and NOW: "the torture board at 83 % of frames in budget" is the dev
  build at 1× against 6.06 ms on the owner's screen, not a 4× figure (at 4×: 0 %
  within 6.06 ms, 0.3–3.6 % within 16.7 ms).
- Brief 60 and NOW: "the Token cap counts everything on the mat". It leaves out
  the Hall and quest Tokens (`MatCap.js:29`) and counts the bin; with D-1 B the
  Starter Camp's 25 sites do not count either, so that mat holds 153 Tokens plus
  the Hall and quests at the base cap.
- `matLayers.js:98`, "under the cap every rank is dense": true at 128, not at
  256. The order has 226 ranks (`TOKEN_SPAN`, `:39`); 256 Tokens plus 8 flags
  overflow it, the resting Tokens past rank 208 share one z, and page order
  decides between them: flags (drawn after the Tokens) then cover every clamped
  Token whatever their place on the mat. P2-7 fixes it.
- T-131: on the bench boards the beacons' targets are missing, so the per-frame
  cost is a whole-document `querySelector` per beacon, not a box read.
- `tailwind.css` (the charge floater, the loot bob): "on the compositor" means no
  JavaScript, but Chrome still restyles each running element every frame
  (~540 animation restyles a second on the 128 board).
- `bench/README.md`: S2 is "~108 Tokens"; the live drawing board holds 102 on the
  mat once settled (trees used up and refilled).
- The Perf HUD's "≤ 6.06" columns kept every 4× figure near 0 %; the 60 Hz line
  (`≤16.7 %`) is now beside it.
