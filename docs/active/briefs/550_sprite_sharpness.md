# Brief 550 — Sharp sprites: no blur on hover, walk or turn; crisp floating items

*Written 2026-11-08 by the planning agent from the owner's bug report (T-393) and a diagnosis agent's measured
report. Read [the diagnosis](../research/sprite_sharpness_2026-11-08.md) first: it has the causes, the
measurements and the file:line evidence. Verify them; it was measured in Chrome, not the built app.*

**The owner's report.** In the production build every Token on the mat flickers in and out of sharpness, set
off by hovering a hero; walking heroes are worst; turning and work also blur. Floating items pinch during their
bob, and their shadow drifts out of step. **The owner's main problem with the build: no dependency, run it first
if the queue allows.**

**Rulings (owner, 2026-11-08).** A hero turns **instantly**, no squeeze. A floating item's **shadow stays still
on the ground** while the item rises and sinks. The bob moves in **whole sprite pixels, 1 to 4 art pixels**
high, same 14 steps of 140 ms. The hover **flag fade stays**, looking and timing as today. Walking heroes get
the **enemies' crisp glide, merged only after the bench** shows it costs no more than today.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md` (drawing), `docs/reference/TESTING.md`, the diagnosis,
`docs/active/research/walker_glide/README.md`, the `will-change: contents` rule in `src/tailwind.css` (~597).

## Phases

| Phase | What | Tier |
|---|---|---|
| X1 | **Nothing blurs on hover or turn; floating items crisp.** (a) The spot flag's fade (`FlagLayer.jsx`) gets `will-change: contents`, so it no longer pushes the Tokens drawn after it onto their own layers; check every path that fades it (hover on the mat or the roster tab, reaching or leaving a spot, the 30 % during a drag). (b) The facing flip in `MatHero.jsx` loses its transition: instant. (c) The loot bob (`lootBob.js`) steps in whole art pixels at the current fit (k × `boardScaleAt(fit)` mat units, k = 1 to 4), and the shadow moves out of the moving box so it stays still on the ground (`TokenSprite.jsx`'s layered art), placed so it doesn't round differently from the art; the reduced-motion hold goes the same way (from JavaScript, not `tailwind.css`'s fixed px). Check the loot hop (`lootArc.js`) still lands its shadow under the item. (d) Look at the limp filter fade and work animations for the same fault; fix only what you measure, report the rest. (e) Extend `bench/crisp.mjs` to catch all of this: a flag fade, the loot's shape and shadow gap across bob steps. | engineer |
| X2 | **Walking heroes crisp.** The hero box (`MatHero.jsx`) and the speech-bubble stack (`HeroBubbleLayer.jsx`) move as enemies do: `will-change: contents` and the stepped glide (`walkerGlide.js`, as in `MatToken.jsx`). Correct the "never `will-change`" comment: the 3× cost was `will-change: transform`. `bench/crisp.mjs` judges the walking hero itself. **Ready for bench**: `bench:draw --compare` and the drag bench; merge only if walking costs no more than today; if it does, stop and report with the numbers. | engineer |

X1 and X2 touch `MatHero.jsx` both: one branch, X1 first, or X2 after X1 merges.

## Done when

- Gate green (`TESTING.md`); engine work **same** (drawing only); X2's bench numbers in STATUS.
- `bench:crisp` passes with the new cases, at fits 0.55, 0.76, 0.83 and 1.
- **In the built app** (Tauri, WebView2), not only the dev server, at a small and a large window, named as
  verified with zoomed screenshots: hovering a hero leaves every Token crisp; a hero turns instantly and stays
  crisp; a walking hero is crisp; a working hero; a floating item keeps one shape through its bob with its shadow
  still on the ground; reduced motion holds an item raised and crisp.
- **Eye-check: yes**, one look, in the built app.

## Not in this brief

Anything not measured as a blur. New art.

## Owner to-do

The eye-check, in the built app. No CMS work and no new art.
