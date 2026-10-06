# Spike: hard pixel shadows and coloured outlines

*Throwaway measurement spike, 2026-09-30, for the owner's idea of the same day (a solid black
silhouette as the shadow; sharp coloured outlines instead of the glow). Nothing here merges.
The code ran in a detached worktree of `main` at `0e62aeb`, which has since been deleted. The
only files kept are this report and the pictures in `spike_shadows/`.*

**Every number below: dev build (React development mode), headless Chrome 154 on the owner's
GPU (NVIDIA RTX 3060, ANGLE / Direct3D 11, GPU compositing on; checked before measuring),
1600×900 window, 2026-09-30.** Other programs were open (Firefox, Discord, other Claude
sessions and their dev servers). Machine load before each run ranged from 8 to 100 %, and
each run's load is in the tables. Only compare rows within one table.

---

## 1. For the owner, in plain language

- **The hard shadow looks the way you described and costs almost nothing.** A ready-made black
  copy of each sprite, drawn under it and nudged down and right, is just a second picture. It
  adds no live effect for the graphics card to recalculate. In the same batch it ran as fast
  as having **no shadow at all** (§2, table B).
- **The hard shadow alone does not free up the frame rate, because the green "working" glow
  is the real cost on this board today.** With only the shadow swapped, the busy board went
  from about 92 to about 114 frames a second, and the graphics card stayed about 90 % busy.
  When the glow was also replaced by an outline, it went to about **155 frames a second**. That
  is the same as switching every effect on the mat off (R6's upper bound). In this headless
  browser about 158 is the ceiling.
  - ⚠ This does not match R6 exactly. R6 found the contact shadows were the bigger cost and
    the glow the smaller one. Here it was the other way round in all three batches. Either
    way, **the owner's full idea (hard shadow plus outlines) reaches the "everything off"
    speed**.
- **Which offset: 1, 2 or 3 pixels makes no difference to speed.** It is the same picture,
  moved by a different amount. Choose on looks alone (pictures in §3).
- **Outline technique: ready-made outline pictures (O1) clearly beat the CSS filter (O2).**
  - On the busy board, O1 had 83–86 % of frames made within the 6 ms budget, against 64–70 %
    for O2.
  - On the torture board, O1 ran at 84–96 frames a second, against 43–82 for O2.
  - The filter version has to be recalculated every time a hero's animation frame changes
    (8 times a second each). The picture version never does.
  - The two look the same, pixel for pixel.
- **The recommendation, if you like the look: hard shadow plus O1 outlines.** It is as fast as
  "no effects at all" and keeps the crisp pixel style. What's left is a look choice: the
  offset, and whether loot's floating shadow is too heavy (§3).

---

## 2. Results

Columns:

- **fps**: frames drawn per second.
- **frame work**: P3's estimate of how long the page spent making each frame.
- **≤ 6.06 ms (interval / work)**: the share of frames whose gap, or whose work, fitted the
  165 Hz budget. ⚠ Headless Chrome tops out at about 158 fps (a 6.3 ms gap), so the interval
  share cannot exceed ~42 %. **Read the "work" share.**
- **GPU busy**: the graphics process's main thread (`CrGpuMain`), from a 5-second trace.
- **Mat images**: `<img>` elements inside the mat, with the silhouettes and outline images
  included in that count shown in brackets.
- **Live filters**: elements on the mat with a CSS `filter`, with the animated ones in
  brackets.

Each row is the mean of 2 runs (round 1 in the listed order, round 2 reversed). Each run was
20 s to settle, a 30 s `__perf` window, then a 5 s trace.

### A. S2 Realistic (102 Tokens, 8 heroes): the main batch

| Variant | fps (run 1 / run 2) | Frame work p50 / p99 ms | ≤ 6.06 ms: interval / **work** % | GPU busy % | Mat images (sil / outline) | Live filters (animated) | Load before % |
|---|---|---|---|---|---|---|---|
| **V0** today | 91.5 (102.0 / 81.1) | 7.75 / 18.9 | 14.8 / **22.6** | 91.5 | 123 (0 / 0) | 236 (19) | 63 / 40 |
| **V-off** every mat filter off | **157.7** (158.4 / 157.0) | 4.66 / 16.6 | 42.2 / **79.7** | 65.0 | 120 | 0 | 51 / 41 |
| **V1** hard shadow 1 px, glow kept | 113.7 (119.1 / 108.3) | 7.36 / 17.6 | 23.9 / **28.6** | 92.0 | 243 (121 / 0) | 121 (15) | 46 / 21 |
| **V2** hard shadow 2 px, glow kept | 114.2 (116.5 / 111.9) | 7.25 / 17.8 | 23.7 / **30.2** | 89.5 | 241 (120 / 0) | 121 (15) | 36 / 26 |
| **V3** hard shadow 3 px, glow kept | 100.7 (112.9 / 88.4) | 7.86 / 21.4 | 17.9 / **22.5** | 91.5 | 241 (120 / 0) | 121 (15) | 34 / 57 |
| **V1+O1** outline images | **155.3** (154.4 / 156.1) | **4.21** / 16.8 | 41.3 / **83.0** | 83.5 | 256 (120 / 15) | 107 (1) | 36 / 37 |
| **V1+O2** CSS filter outline | 135.6 (154.1 / 117.1) | 5.35 / 19.4 | 36.4 / **64.3** | 80.0 | 241 (120 / 0) | 121 (1) | 38 / 43 |
| V1+O1, plus the remaining small filters off *(extra)* | 155.5 (153.5 / 157.5) | 4.16 / 18.6 | 41.9 / **84.1** | 70.0 | 256 (120 / 15) | 0 | 100 / 45 |

### B. S2: control batch (does the silhouette cost anything over no shadow?)

"No shadow" removes the sprites' `drop-shadow` and draws nothing in its place. The glow is
kept.

| Variant | fps (run 1 / run 2) | Frame work p50 / p99 | ≤ 6.06: interval / **work** % | GPU busy % | Load % |
|---|---|---|---|---|---|
| V0 today | 98.5 (100.8 / 96.2) | 7.05 / 16.6 | 19.4 / **33.6** | 93.5 | 23 / 44 |
| No shadow, glow kept | 107.5 (114.4 / 100.6) | 7.25 / 17.8 | 21.3 / **29.3** | 95.5 | 30 / 71 |
| V1 hard shadow, glow kept | 92.2 (115.8 / **68.6**) | 8.65 / 23.1 | 13.5 / **15.3** | 92.0 | 35 / **100** |
| V1+O1 | **143.3** (149.7 / 137.0) | 4.96 / 24.1 | 39.0 / **64.9** | 74.0 | 29 / 46 |

The silhouette and no shadow are level within noise: their first runs were 114 and 116 fps.
V1's second run coincided with 100 % machine load. **With the glow still on, the graphics
card stays at 92–96 % busy whatever the shadow is.**

### C. S2: O1 against O2, again, with V-off

| Variant | fps (run 1 / run 2) | Frame work p50 / p99 | ≤ 6.06: interval / **work** % | GPU busy % | Load % |
|---|---|---|---|---|---|
| V1+O1 | **157.8** (157.7 / 157.9) | **4.15** / 15.6 | 42.4 / **86.0** | 78.0 | 39 / 35 |
| V1+O2 | 142.4 (136.8 / 148.0) | 4.76 / 19.6 | 38.4 / **70.2** | 80.0 | 38 / 23 |
| V-off | 157.9 (157.0 / 158.7) | 4.66 / 15.7 | 42.6 / **78.5** | 74.0 | 45 / 52 |

### D. S3 Torture (~310 Tokens): V0 and the two best, two batches

| Variant | fps (run 1 / run 2) | Frame work p50 / p99 | ≤ 6.06: interval / work % | GPU busy % | LoAF / 30 s | Mat images (sil / outline) | Load % |
|---|---|---|---|---|---|---|---|
| *batch 1* V0 | 64.4 (66.7 / 62.1) | 12.00 / 70.3 | 7.0 / 0.0 | 88.5 | 24.5 | 327 (0 / 0) | 43 / 36 |
| V1+O1 | **83.9** (88.8 / 79.1) | 11.65 / 72.6 | 18.5 / 0.3 | 69.5 | 22.5 | 672 (328 / 15) | 39 / 35 |
| V1+O2 | 43.4 (35.4 / 51.3) | 17.66 / 199 | 4.5 / 0.0 | 71.5 | 50.5 | 657 (328 / 0) | 65 / **100** |
| *batch 2* V0 | 80.6 (76.1 / 85.1) | 10.15 / 54.6 | 14.5 / 0.9 | 89.5 | 19.5 | 329 | 26 / 8 |
| V1+O1 | **96.1** (88.9 / 103.3) | 10.10 / 75.6 | 25.6 / 4.7 | **58.5** | 26.5 | 667 (326 / 15) | 37 / 16 |
| V1+O2 | 81.8 (63.8 / 99.9) | 11.71 / 79.6 | 19.4 / 3.2 | 65.0 | 26.5 | 653 (326 / 0) | 28 / 26 |

S3 stays far from its target whatever happens here. Its long frames are the engine tick (R6
§4.2, P2), and its renderer main thread is 98 % busy. What this spike changes at S3 is the
graphics card: from 89 % busy down to 58–70 %, and about +20 % fps.

### What the page carries

| | S2 V0 | S2 V1+O1 | S3 V0 | S3 V1+O1 |
|---|---|---|---|---|
| Elements inside the mat | ~1,005 | ~1,280 | ~2,480 | ~3,170 |
| `<img>` on the mat | 123 | 256 (+120 silhouettes, +15 outlines) | 327 | ~670 (+326, +15) |
| Elements with a live filter | 236 (19 animated) | 107 (1 animated) | ~645 | ~310 |

The extra elements are:

- one wrapper and one silhouette per sprite;
- one outline image per outlined sprite (O1);
- three clipping layers per hero (sprite sheets).

The remaining ~107 filters at S2 are the Token-name and count labels' text shadows, plus the
bouncing "!" icons' glows. Removing them too (the "extra" row in table A) changed nothing
measurable, apart from 13 points less GPU busy.

---

## 3. The pictures (`docs/review_v3/spike_shadows/`)

All of them are from the S2 board, cropped from the same screen area (420×240 screen pixels
around the Guild's middle row), about 8 s after the board starts. One Token is **hovered**
(the pink heart, top of the bottom row). One Token was **forced into the alert state** for
the pictures (the coin sack, `?demoAlert=bench_camp`), because no Token happened to be in an
alert at that moment.

⚠ The board is live, so the heroes and the walking goblin are in slightly different places in
each picture. The Tokens do not move.

| File | What it is |
|---|---|
| `compare_4x.png` | **Start here.** Side by side, the gear Token, a working hero and a flag, 4× enlarged (nearest-neighbour, so every screen pixel is a crisp square) |
| `compare_2x.png` | The same six variants, a wider area, 2× |
| `V0_1x.png`, `V0_2x.png`, `V0_4x.png` | today: soft blurred shadow, breathing green glow |
| `V1_*`, `V2_*`, `V3_*` | hard shadow at 1, 2 and 3 pixels, glow unchanged |
| `V1+O1_*` | 1 px hard shadow; working = green outline, hovered = white, alert = red (outline images) |
| `V1+O2_*` | the same, with the outline made by the CSS filter |

`_1x` is the game's normal size, `_2x` and `_4x` are enlargements of the same pixels.

What to look at:

1. **The gear** (a Token, top left) shows the offset best. At 1 px it reads as a crisp edge.
   At 3 px the black shows through the gear's hole and it looks like a separate shape.
2. **The heroes.** ⚠ Today's animated heroes have **no contact shadow at all** (only the
   glow). In the spike they get one. They are dark-clothed, so the shadow is subtle on them.
3. **The flag**: it gets the same hard shadow as a Token.
4. **Loot** (the orange ore cluster, top right in some pictures) floats. It casts its shadow
   2 px further than resting things (3 px at V1) and stays still while the item bobs. At 2×
   it reads as a **heavy black blob**, the strongest look question the spike raises.
5. **O1 against O2**: same colour, same 1-pixel thickness, same square corners. They should
   look identical, and they do.

---

## 4. How the real implementation would work

**The generator.** A Node step using `sharp` (already a devDependency) reads each sprite PNG's
alpha. It writes:

- a **silhouette**: black where alpha > 0, clear elsewhere, the same size;
- one **outline** per colour: the silhouette grown by one pixel, filled with the colour.

The spike's version is `gen-silhouettes.mjs`, about 80 lines. It handled 628 sprites in
**11 s**, producing 7 MB. It needs:

- **When it runs:** as a Vite plugin, on `buildStart` for production builds and on dev-server
  start. Plus a file watcher on `public/assets/**`, so a new or edited sprite gets its
  silhouette at once. The CMS's art upload should call the same function.
- **Where the output lives:** a generated folder (for example `public/_gen/`), git-ignored,
  with a small manifest (`src path → [width, height, cell]`). A cache keyed by file hash keeps
  restarts instant. Nothing goes into `public/assets/`, and nothing is hand-edited.
- **The lookup:** one helper, `silhouetteOf(src)`, used by `PixelArt`. A sprite without a
  generated silhouette (a brand-new file before the watcher fires, a CMS data URL) simply
  draws no shadow. It never breaks.

**How a sprite is drawn.** `PixelArt` becomes a small box with three layers:

1. the silhouette `<img>`, moved by `transform: translate(n, n)`;
2. the outline `<img>` (only when an outline is asked for);
3. the sprite itself.

No filters anywhere. The box takes the caller's position and classes.

- **Keep all offsets in whole screen pixels.** The mat is scaled by one transform, and some
  sprites are drawn at half their art size: heroes, and small Tokens at 1×. So "1 art pixel"
  can be half a screen pixel. The spike rounds the offset to whole screen pixels using the mat
  fit (`useMatFit`). That means a hero's "1" is 1 screen pixel (2 of its art pixels).
- **Flipped sprites:** the flip goes inside the offset, so the shadow always falls
  down-right.

The other surfaces:

- **Lifted (drag ghost).** The shadow moves further away (the spike used offset + 2) and the
  sprite lifts 4 px. Both are transform changes, so nothing is re-rasterised mid-drag.
- **Landing bounce (`gi-token-land`).** Keeps its bounce, but its keyframes must lose their
  animated `drop-shadow`. Today the animation also *holds* the resting shadow forever through
  `fill-mode: both`, which would put a live filter back on every landed Token.
- **Loot.** The silhouette sits on the ground while the item bobs above it. The offset and
  darkness are a look decision (§3, point 4).
- **Heroes and enemies (sprite sheets).** Generate a **silhouette sheet** and an **outline
  sheet**, the same size as the sheet. They are drawn with exactly the same frame offset as
  the sprite, so one frame change updates all three layers together; nothing is re-filtered.
  - Enemies are one element with `background-position`, so they get sibling elements with
    the same background maths.
  - Heroes clip each layer to one frame.
  - Outlines on sheets must be grown **within each 64 px frame cell**, so one frame's outline
    never bleeds into its neighbour's. The generator needs the sheet's cell size: the spike
    used "files named `ani_*` are 64 px cells". A real version should read it from the
    animation registry.
- **Outlines (O1).** Show one when the Token or hero is hovered, worked or alerted, in that
  priority. Half-size sprites need an outline grown by 2 art pixels, so it still lands as one
  screen pixel. The spike generated both radii (`ol-*` and `ol2-*`) and picked by scale. Each
  extra colour is one more set of images.
- **The dock and other surfaces** outside the mat use the same `PixelArt`, so they get the
  shadow for free. If that is wanted there, check each for clipping.

---

## 5. Risks and unknowns

- **Headless and dev build.** The fps ceiling here is ~158, not the owner's 165. The best
  variants sit on that ceiling, so beyond it the GPU-busy column is the only separator. A real
  window, a production build, and the owner's own checklist (C.md) are what certify this.
- **A noisy machine.** Other sessions were running, and load hit 100 % during some runs
  (flagged in the tables). Single runs swing by up to 40 fps. The conclusions above hold
  across all three S2 batches; the small differences (V1 against V2, "no shadow" against V1)
  are within noise.
- **This disagrees with R6's §4.1.** R6 found "contact shadows off" gave 108 → 153 fps. Here
  "no shadow, glow kept" gave only 98 → 107, and removing the glow is what unlocked the frame
  rate. Not explained. The glow code or its number of users may have changed since R6, or the
  two filters interact. It doesn't change the recommendation, because the owner's idea
  replaces both.
- **More elements.** It adds about +250 elements at S2 and about +700 at S3. That's harmless
  at S2. At S3, R6's element ceiling (§5) matters, and the renderer main thread was already at
  98 %. Worth a real-window check at S3. A cheaper structure is possible: for Tokens, draw the
  silhouette with the sprite's own box as a CSS `background` layer on the wrapper, instead of
  an extra `<img>`.
- **Look details not settled:**
  - the heavy loot shadow;
  - square outline corners (O1 could use rounded, 4-neighbour corners instead; O2 cannot);
  - how shadows overlap neighbouring sprites on a crowded mat;
  - animated heroes gaining a shadow they don't have today;
  - the hover state still adds its `brightness` filter (one element at a time, not measured).
- **Kept out of scope:** the Token-name labels' text shadows (~105 static filters) and the
  bouncing "!" icons' glows (animated filters). Removing them measured as no fps change here.
- **Half-scale O1 outlines.** These need their own radius-2 image. If a future sprite size
  lands at another fraction, the generator needs that radius too.
- **CMS-authored art** that is not a file in `public/assets` gets no silhouette until the
  generator learns about it. The fallback is "no shadow", not a broken sprite.
- **Pictures are from a live board.** The heroes differ between pictures, and the alert state
  was forced for display.
