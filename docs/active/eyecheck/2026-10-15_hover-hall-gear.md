# Eye-check: hover outline, the Guild Hall movable again, the gear alert

*Owner: play on the branch, fill in each Verdict line, hand the file back (or
answer in chat). Fixes go on the branch, it merges, and this file moves to
`docs/archive/eyecheck/` with your verdicts. Every check is by clicking.*

**Branch:** `fix/hover-and-hall` (= `main` + the three hover/Hall tickets + the gear alert).
Switch with:

```bash
git switch fix/hover-and-hall
```

Switch back before any CMS Sync:

```bash
git switch main
```

**Save slot:** any; 3 is fine. The first start after switching redraws the
outline sheets (a few seconds).

## Checks

1. **Hover a resting Token** nobody works. A crisp white line one art pixel
   wide around the art; the Token does not hop or lift; the faint ring at its
   foot stays.
   Verdict: ok / change: ___
2. **Hover a hero on the mat.** The same white outline, no hop. Then look at a
   working hero (green outline) mid-swing: the outline goes all the way round
   the bow tip and the feet, not cut off at the frame edge (this was the old
   clipping bug).
   Verdict: ok / change: ___
3. **An animated enemy.** QA panel, Starter Camp section, Place, type
   `token_cow`. Hover the cow: a full white outline, not cut at the edges.
   Verdict: ok / change: ___
4. **Drag the Guild Hall** somewhere else on the mat. It moves and stays, and
   shows the faint ring at rest with the grab cursor. Director's call to
   confirm: the Hall is dragged only by you; spawns, growth and builds never
   push it (as before).
   Verdict: ok / change: ___
5. **Drag the Hall off the mat** (onto the left menu) and let go. It flies
   back and says it cannot leave the playmat.
   Verdict: ok / change: ___
6. **Click the Hall.** Its card says it cannot be demolished and has no
   Demolish button.
   Verdict: ok / change: ___
7. **The gear alert.** QA panel, Clear the board, type `token_wood_foundation`
   in the Place box, Place. The gear on the Foundation holds still, with a
   thin gold edge whose colour steps between yellow-gold and pale gold about
   every 0.8 s; no swell, no glow. Hover it: it does not grow. Known
   limitation: the gear is drawn at three-quarters of its art size, so the
   edge is thinner than one screen pixel; if it reads too thin, say so and the
   gear gets drawn at full size on a later pass.
   Verdict: ok / change: ___
8. **Choose a recipe** on that Foundation. The gold edge goes, and the gear
   grows slightly on hover again as before.
   Verdict: ok / change: ___

## Not changed, your call later

- The bottom hero bar's own hover lift stays (it is not on the mat). Say if
  you want it gone too.
