# Eye-check 2026-10-31: strolling goblins drawn cheaper (draw regression fix)

**Branch:** tell the director when you're ready; the director switches your
folder to `fix/walker-glide`, starts the game at http://localhost:5173 and
switches back to `main` right after. ⚠️ **Don't Sync the CMS** on the branch.

**Why:** strolling goblins cost about half of each frame's drawing work on a
busy mat (see `docs/active/research/draw_regression_2026-10-31.md`). Each step
of a goblin's glide now moves a whole screen pixel at a time instead of
sliding smoothly between pixels; it stays sharp (the pixel rule) and costs
about a quarter of what it did. Frames before and after:
`docs/active/research/walker_glide/`.

## Checks

1. **Strolling goblins.** QA panel → Hero orders → "Ambush and needs-a-job
   scene", send nobody to the Old Oak, and watch the goblins stroll round their
   camp (or any camp with no hero working beside it). They should walk at the
   same speed and look as smooth as before; the goblin and the Tokens beside it
   stay sharp. Look for stutter, a goblin running ahead of its pace, or nearby
   Tokens going soft or jumping a pixel.
   Verdict: ok / change: ___
2. **Faster walkers.** Mat Tuner → "Enemy walk speed" up: still smooth.
   Verdict: ok / change: ___

(Already on `main`, not new: an occasional whole-step snap when a goblin passes
another Token.)
