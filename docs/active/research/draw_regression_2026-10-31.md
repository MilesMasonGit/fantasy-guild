# Draw regression on S2, 29-31 Oct: bisect and cause

Engineer diagnosis, 2026-10-31, 02:15-04:10 Vancouver (owner's downtime, quiet machine, one
heavy run at a time). Scratch worktree `p23b`, detached. Nothing fixed, nothing in `src/` changed
on any branch.

## In plain words

The mat got about twice as expensive to draw on the S2 bench board because **goblins now walk
about on it**, and each walking goblin's smooth glide is drawn the expensive way. No new slow
code arrived in the range. Two changes, both correct for the game, let the goblins walk:

1. **22af5033** (owner rule 2026-10-28, "a hero on a spot order is never ambushed"). S2 sends
   heroes 1 and 2 to a spot beside each goblin camp, so since this commit the goblins never
   attack them, nobody kills the goblins, and they stay alive and stroll.
2. **fff7a2ae** (T-264, bug fix). Goblins spawned at a non-whole point used to stand frozen;
   now they stroll too.

The cost is the glide itself: a walking goblin's box slides to each new step with a CSS
`transform 100ms linear` transition, deliberately run on the main thread (`will-change:
contents` in `MatToken.jsx`, the crisp-pixel look rule at `.gi-token-land` in `tailwind.css`).
While any goblin glides, Chrome redoes its paint and layer work on every single frame.

## Bisect (S2 only; `npm run bench:draw -- --compare --only=S2`, two invocations a point)

Frame work p50 (workP50), ms. Each cell is one invocation (two windows). "own/s" is MatBoard's
own renders a second, a cheap second signal.

| Commit | What | 4× run 1 | 4× run 2 | 1× run 1 | 1× run 2 | own/s | Verdict |
|---|---|---|---|---|---|---|---|
| a4a124be | start (29 Oct) | 7.45 | 7.50 | 1.10 | 1.00 | 0.6-0.9 | good |
| 70754a0b | hero orders O1, before the spot rule | 5.90 | 5.85 | 1.06 | 0.96 | 0.7-0.85 | good |
| **22af5033** | **spot orders never ambushed** | 8.86 | 8.01 | 1.56 | 1.71 | 1.6-1.8 | **first bad (step 1)** |
| 2c7fa845 | O1 merged with main | 8.91 | 9.16 | 1.61 | 1.46 | 1.4-2.0 | bad, same level |
| d125ecfa | end of O2 (camps) | 9.46 | 8.61 | 1.55 | 1.60 | 1.5-1.9 | bad, same level |
| 88918eea | after flags, names, drag snap; before T-264 | 9.21 | 9.40 | 1.55 | 1.50 | 1.6-2.0 | bad, same level |
| **9c5ae29f** | **T-264 merged (fff7a2ae; only bench and docs after it)** | 12.76 | 11.86 | 1.95 | 1.85 | 3.3-3.6 | **second bad (step 2)** |
| 3d3af0a6 | main (director's runs, plus two of mine) | 11.45, 12.36 | 13.46, 12.30 | 1.75, 1.81 | 1.90, 1.91 | 3.8-4.2 | bad, same level |

- The director's earlier a4a124be runs read 7.25 and 6.16 at 4×; mine read 7.45 and 7.50.
- The flag, Token-name and drag-snap work (d125ecfa to 88918eea) moved nothing beyond noise.
- Nothing after T-264 moved anything beyond noise (classless heroes K1, milestone perks K4 and the
  perks Sync, the Bank work, T-275): 9c5ae29f and main read the same.
- 2c7fa845 run 1 and a4a124be run 2 exited 3 because one 4× window was rejected for a bad
  slowdown; the kept windows are in the table.

## What the board is doing (probe, 1×, 20 s settle then 20 s sampled every 100 ms)

| Commit | enemies on the mat | walking at once | fights | enemy walk events/s | transform transitions running | MatBoard renders/s |
|---|---|---|---|---|---|---|
| a4a124be | 1.1 | 0 | 0.9 | 0 | 0.4 | 1.0 |
| 70754a0b | 1.5 | 0 | 1.1 | 0 | 0.4 | 0.8 |
| 22af5033 | 3.9 | 0.66 | 0.6 | 6.8 | 1.7 | 1.1 |
| 9c5ae29f | 3.7 | 1.46 | 0.5 | 10.0 | 3.1 | 3.6 |
| 3d3af0a6 | 3.9 | 1.33 | 0.6 | 7.2 | 3.0 | 4.1 |

The browser stress board has no seeded random and runs on the wall clock
(`stressScenarios.js`), so these are one sample each; the trend is what matters.

## The cause, measured (main 3d3af0a6, one build, windows interleaved by the cost table)

Experimental switches were added to a scratch copy only (never committed): goblin glide off
(the box jumps each tick), goblin glide on the compositor (`will-change` dropped from the walker
box), and goblin glide in three steps a tick (`steps(3, end)`, still on the main thread).

| Variant | 1× workP50 | 4× workP50 | saved at 1× | saved at 4× |
|---|---|---|---|---|
| all on (n=3) | 1.90 / 1.91 / 1.91 | 12.30 / 12.21 / 12.40 | | |
| `walkDraw` off (goblin and hero glides off) | 0.90 | 5.80 | 1.0 | 6.5 |
| goblin glide off only | 1.01 | 6.20 | 0.9 | 6.1 |
| goblin glide on the compositor | 1.10 | 7.60 | 0.8 | 4.7 |
| goblin glide in 3 steps a tick | 1.21 | 8.10 | 0.7 | 4.2 |

An earlier cost table on clean main agreed: `walkDraw` off saved 7.41 ms at 4× (13.21 → 5.80)
with the goblins still alive and walking (104 Tokens, MatBoard 4.25 renders/s in that window).

**Profiles** (`npm run bench:profile -- --scene=S2 --cpu=4`, same build, goblins walking in both
traces at 9-10 walk events/s): with the goblin glide on, a frame took 15.4 ms against 9.0 ms
off. Per frame, Chrome's **Layerize** step went 1.6 → 3.7 ms, style 1.9 → 2.9 ms a pass, Paint
plus PrePaint plus Commit 1.5 → 2.3 ms. Transition events (`transitionrun`, `transitionstart`,
`transitioncancel`, `transitionend`, 30-70 a second each, all through React's root listener)
cost about 12 ms a second of script at 4×: small. The trace files are in
`bench/results/profile/` of the scratch worktree (git-ignored).

## Cost per frame

- Goblin glide on S2 today: **about 0.9 ms a frame at 1×** (half of S2's frame work) and **about
  6 ms at 4×**. Hero glides add about 0.1 ms at 1× (reasoned: their boxes carry no `will-change: contents`, so Chrome can run them on the compositor).
- Step 1 (22af5033): +0.5-0.7 ms at 1×, +2-3 ms at 4×. Step 2 (T-264): +0.3-0.4 ms at 1×,
  +3 ms at 4×.
- The MatBoard re-renders (about 0.8 → 4 a second) come from walkers changing who stands in front
  of whom (`tokensRaw` in `MatBoard.jsx`); they lengthen a few frames (p95, p99), not the median.

## Recommendation

1. **Fix the glide, keep the look rule** (engineer, small, eye-check). Step each walking goblin's
   glide on whole screen pixels: `steps(n, end)` with n the screen pixels the step covers (from
   the mat's fit), set per step where `useWalkerFollow` moves the boxes. It stays on the main
   thread, so it stays crisp; pixel art at a fractional offset already shows only whole-pixel
   moves, so the motion should look the same. The 3-steps proxy saved 0.7 of 0.9 ms at 1× (4.2 of
   6.1 at 4×). Prove it with `bench:crisp` and an owner eye-check of goblins strolling; then a
   `bench:draw --compare` and a fresh draw baseline. Moving the glide to the compositor saves a
   little more but breaks the crisp-pixel rule, so it is not recommended.
2. **Decide what S2 should measure** (director; owner-invisible). S2's heroes 1 and 2 were placed
   "beside goblin camps, where the goblins will find them"; since 22af5033 the goblins never do.
   - (A, recommended) Order heroes 1 and 2 onto a Token inside each camp's watch in
     `bench/scenarios/realistic.mjs`, so S2 has its fights again; wandering goblins stay measured
     by the `enemies<N>` envelope scenes. Changes the engine bench work (WORK CHANGED) and needs
     both baselines re-taken. Builder-lite.
   - (B) Keep S2 as it is now (unopposed goblins wander) and re-take the draw baseline: S2 then
     carries the glide cost on purpose.
   - (C) Leave S2 alone until the glide fix lands, then re-take the draw baseline once.
3. Until one of those lands, every `bench:draw --compare` on `main` reads REGRESSED against the
   a4a124be draw baseline; that is this, not the change under test.

## Measured and reasoned

- **Measured**: the bisect table; the probe counts; the two cost tables; the two pairs of
  profiles (main against 70754a0b, and main glide on against off).
- **Reasoned, not measured**: why a main-thread transform animation costs Chrome a full
  re-layerization each frame (a moving non-composited box changes its paint chunk's place and
  transform, so the layer assignment cannot take its fast path); that pixel-quantized steps look
  the same as the linear glide; how far the S2 numbers carry to a player's mat (any camp left
  without a hero working near it lets its goblins wander, so a player pays this too).
