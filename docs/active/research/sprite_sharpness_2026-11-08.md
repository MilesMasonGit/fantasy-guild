# Sprite sharpness diagnosis (T-393), 2026-11-08

*An engineer-tier diagnosis agent's report, condensed by the planning agent, who checked the file and line
claims against the code. Measured in headless Chrome 156 with GPU on, on the S2 board of a dev server, game loop
frozen, real mouse hovers, Chrome's layer counts and screenshot pixel checks. **Not tested in the Tauri/WebView2
build.** No code was changed.*

## 1. Tokens and heroes go soft

**A. Hovering a hero blurs Tokens (measured).** `FlagLayer.jsx` (~195, 219) brings a hero's faded spot flag back
while the hero is hovered, with a 700 ms `transition-opacity`. Chromium runs that fade on the compositor, and flags
sort in among the Tokens, so every Token drawn after the flag gets its own layer and is drawn resampled: layers
9 → 28 at fit 0.76, 8 → 15 at fit 0.83; 6 to 8 of 12 still Tokens moved a screen pixel and changed shape, and
not all returned after the fade (the flicker). The same fade plays when a hero reaches or leaves a spot, when
their roster tab is hovered, and at 30 % during a drag. **Fix**: `will-change: contents` on the flag button, the
codebase's own rule (`tailwind.css` ~597-606). Measured: layers stayed at 9, no Token moved, the fade looked the
same.

**B. A walking hero is blurred (measured).** `MatHero.jsx` (~286-296) moves the box with
`transition: transform 100ms linear` on the compositor: the hero is drawn blurred, and everything drawn above
heroes (loot, work plates, bubbles, later heroes) is re-layered while any hero walks (8 → 15 layers). **Fix**:
the enemies' method, `will-change: contents` plus the stepped glide (`walkerGlide.js`, as `MatToken.jsx`
~344-375), on the hero box and on the speech-bubble stack (`HeroBubbleLayer.jsx` ~279). Measured crisp with no
extra layers. The "never `will-change`, 3× slower" note in `MatHero.jsx` is about `will-change: transform`, not
`contents`. **Cost not measured**: the enemies' stepped glide measured cheap
(`research/walker_glide/README.md`), but this needs a bench before merging.

**C. Turning (reasoned).** Heroes without an animation sheet (most portraits; `AssetManager.js` ~63-75) flip with
a 200 ms `scaleX` transition (`MatHero.jsx` ~328), a squeeze through zero width. Animated heroes already flip
instantly.

**Ruled out**: the `-translate-x-1/2` centring; art at exactly 2× stays crisp at any sub-pixel offset.
**Possible extras (reasoned only)**: the loot hop (`lootArc.js` ~52, 61) and the limp filter fade
(`MatHero.jsx` ~304).

## 2. Loot shadow drifts and 3. loot pinches (measured)

`lootBob.js` moves the pile -3 to -9 mat units, which is not whole art pixels at most fits (-2.49 to -7.47
screen px at fit 0.83). The shadow sits inside the moving box (`TokenSprite.jsx` ~177-205), placed by `left/top`
that rounds differently from the art's transform, so the gap under the item went 4/4/3/3/3/3/4 px, and the art
was drawn 51 px tall instead of 52 at some steps (two or three shapes across one bob). With whole-art-pixel steps
(k × `boardScaleAt(fit)` mat units) there was one shape and a constant gap; with the shadow held still, the gap
grew exactly 2 px a step. The reduced-motion rule (`tailwind.css` ~326, `translateY(-6px)`) has the same flaw.

## Why it slipped through

`bench/crisp.mjs` never tested a flag fade, never judged the walking hero itself, and never checked loot shape
across bob steps.

## Not verified

WebView2 and the built app; the owner's window size; Tokens going soft while a hero walks (not reproduced: Tokens
are drawn below heroes); work animations; any performance cost.

## Evidence

Screenshots and measurement scripts in the planning session's scratchpad (temporary):
`C:\Users\16048\AppData\Local\Temp\claude\2ef84ffb3e66eeb3\964f6c31-a24a-4893-ae45-6b1b3e2c2abe\scratchpad\`
(`hero_walk_cmp.png`, `shots_1600x1000\pair_spot_in_80.png`, `loot_1920x1080\`, `diag393c.mjs`,
`loot393.mjs`; the scripts need a dev server on port 5391). Rerun the measurements rather than rely on them.
