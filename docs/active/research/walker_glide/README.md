# Walking goblins glide in whole screen pixels: measurements

Engineer, 2026-10-31, 04:06-07:00 Vancouver (owner's downtime, one heavy run at a time). Branch
`fix/walker-glide`, worktree `p23b`. Follows `../draw_regression_2026-10-31.md`.

## What changed

A walking enemy's two boxes used to slide to each step with `transform 100ms linear`, painted on
the main thread (`will-change: contents`, the crisp-pixel rule). Chrome then redid its layer and
paint work on every frame while any enemy walked. Now each step jumps a screen pixel at a time:
`transform 100ms steps(n, start)`, with n the screen pixels the step covers on its longer axis
(the mat's fit × the device pixel ratio), set per step where `useWalkerFollow` moves the boxes
(`src/ui/components/board/walkerGlide.js`). A step of a pixel or less simply lands. Still on the
main thread, so still crisp. Heroes are unchanged: their glide already runs on the compositor.

`start`, not `end`: with `end` the last jump lands at the very end of the tick, so a next step
arriving a frame early cuts it off; with one jump the box would never move at all.

## A/B against main, S2, perf build (`--ab`, windows A, B, B, A per invocation)

A = this branch (ecbf7035), B = main eb1ffd1a's perf build served on its own port. Frame work p50, ms.

| | run 1 A | run 1 B | run 2 A | run 2 B | median A | median B | saved |
|---|---|---|---|---|---|---|---|
| 1× | 1.31, 1.41 | 1.91, 1.70 | 1.41, 1.60 | 1.90, 2.01 | 1.36 / 1.50 | 1.80 / 1.95 | 0.44 / 0.45 ms (25 %) |
| 4× | 9.60, 8.10 | 10.11, 14.50 | 9.70, 8.51 | 12.30, 11.50 | 8.85 / 9.11 | 12.30 / 11.90 | 3.45 / 2.79 ms |

The bench's S2 at 1600×1000 has a fit of 0.76: a stroll step (4.5 u) is 3.4 screen pixels, so four
jumps a tick (the diagnosis's three-jump stand-in saved 0.7 ms with fewer jumps).

**What is left** (cost table, fix build, 1×, `--switches --switch-only=walkDraw --only=S2`):
all on 1.30 ms (n=3, noise 0.11), every walk glide off 1.01 ms: the stepped goblin glide and the
heroes' glide together now cost 0.29 ms, against about 1.0 ms on main (diagnosis: 1.90 → 0.90).

## Crisp (`npm run bench:crisp`, S2)

The walk case now plays the game's own glide (stepped, a screen pixel a jump; it used a linear
glide of its own). Fix build: **walk changed 0 of 66 still Tokens, 8 of 11 drawn exactly (as at
rest), no extra composited layer** (9, rest 9). Neutered (`--neuter=anims`): walk changed 70 of 79,
50 layers against 33, so the case catches a glide on the compositor.

The bench exits 1 on main as well, for cases this change does not touch: main run 1 exit 3 ("the
board was not still", 46 changed at rest), main run 2 exit 1 (land 9, spawn 5, hero 1, loot 2 of 70
changed; 2 of 9 soft at rest); fix runs exit 1 for spawn, gear, worked, hero, loot and 3 soft at rest.
That is pre-existing and worth its own ticket.

The hero case adds composited layers (11 against 9 at rest; neutered 52 against 33) and the walk
case adds none: a walking hero is on the compositor, a walking goblin on the main thread. That,
with the diagnosis's cost table (heroes about 0.1 ms at 1×), is why heroes were left alone.

## Frames of a strolling goblin, 1920×1080 (`glideframes.mjs`)

The bench goblin is drawn with the `s_crime` placeholder (the sack of coins). Each file pair is
main (`before_`) and this branch (`after_`): a full screenshot, ten consecutive screenshots of the
goblin side by side at 3× (`*_strip_10frames_x3.png`), and every frame's live position for 1.5 s
(`*_perframe.json`, in screen pixels, sampled each animation frame).

| per frame, 1.5 s of one goblin walking (248 frame pairs) | main | this branch |
|---|---|---|
| frames where its position changed | 240 | 50 |
| frames where the pixel it lands on changed | 68 | 43 |
| biggest jump between frames | 0.2 px (1 px drawn) | 1 px a jump, except one snap below |

The single 4.15 px move in the branch's sample is a whole step landing at once. It is not new:
the same snap shows on main (one goblin over 9 s: 9 snaps on main's linear glide). The box keeps
its transition string, but the running transition is dropped and no new one starts; each snap came
with a second style write on the box in the same frame (measured with a style observer, main and
branch alike). Reasoned, not measured: that is the mat re-rendering the walker as it passes another
Token (its stack order rewritten, its boxes moved in the page), and a moved element loses its
running transition. Worth a ticket; out of scope here.

The screenshots' crispness ratio (`crisp` in `*_frames.json`: pixels with a twin neighbour across
and down) moves with what stands behind the goblin and is not a fair before/after number; the
crisp bench above is the measure.

## Measured and reasoned

- **Measured**: both A/B runs; the cost table; the crisp runs (fix twice, main twice, neutered
  once); the frame samples and the snap log.
- **Reasoned**: that a stepped glide looks the same as the linear one (pixel art painted on the
  main thread lands on whole pixels anyway, and no jump exceeds a pixel on either axis); that the
  engine bench's work cannot change (the change is in `src/ui` drawing only, and the engine bench
  runs no React).
