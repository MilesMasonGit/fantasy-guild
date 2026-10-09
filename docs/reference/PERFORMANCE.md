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
| H1/H2/H4 eye-check fixes | 2026-10-09 | 48.1 → 64.8 | 22.25 → 16.70 | No change: both runs were far below the baseline (84 fps) on every 4× scene with another builder's benches loading the machine; S2 + hero sheet open 54.3 → 51.3 / 20.61 → 22.36 and S2 + Bank open both noise-sized. The flag drag's green dots are worked out once per pointer move (one pass over the mat's Tokens through `Flags.pinRefusal`): 0.011 ms a call with 11 Tokens in the game, so about 0.1 ms at the 80-Token cap. Drag bench after, two runs (plain / overlays): flag → mat 94 / (run aborted) and 90 / 84 %, hero dock → mat 100 / 100 %; every flag miss was a Token or a neighbouring hero picked up at the press (T-105, T-106), before any dot is drawn. The first run aborted because the bench took the hero panel, now left open beside the Bank, for the Bank itself; `BANK_OPEN` in `bench/browser/scenes.mjs` now leaves the hero panel out. |
| H3 v2 Work rules grid | 2026-10-08 | 51.9 → 74.7 | 20.81 → 15.00 | No change: the drawer is shut in every draw scene and renders nothing while shut (no drop target, no subscriptions); both runs shared the machine with other agents' benches (the before run was cut short after S2 at 4×; the after run's S3 at 1× read 107 fps, 154 fps on a lone re-run). Drag bench after (plain / overlays): hero dock → mat 100 / 100 % with 8 heroes beside the new button, flag → mat 90 / 88 %, Token → mat 84 / 96 %, Token → bin 100 / 96 %, all else 100 %; no miss touched the button or the drawer (neighbouring Tokens or heroes picked up, or a press under a bar hero's head). |
| D2 Hit-testing (brief 50) | 2026-10-09 | 76.7 → 55.0 | 14.41 → 20.95 | No change. The after run read slower on every busy scene at 4× alike (S3, Bank, Shop, notify, loot too) on a busier machine (it took 40 min against 23); an interleaved A/B minutes later (`--ab`, A,B,B,A, at 4×) read D2 58.8 fps / 18.95 ms against the build before it 59.0 / 19.16 ms on S2 (S3 17.4 / 16.3 fps, Bank 64.5 / 63.1 fps). At 1× nothing moved (S2 work 2.00 → 2.01 ms). D2 changes the press path (once per press) and the mat cell's overflow (clip, not hidden); the last press fix (`2a60ee69`) is press-only and was not in the measured build. |

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
hitch: in the perf build `bench:drag` measures ~24–36 ms frames at pickup and
drop (Drag baseline, above).
