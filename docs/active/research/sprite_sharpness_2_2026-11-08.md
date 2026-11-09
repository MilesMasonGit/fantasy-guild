# Sprite sharpness, part 2: uneven outlines and the twitch (2026-11-08)

*Engineer diagnosis, 2026-11-08 evening, after brief 550. Diagnosis only: nothing changed on any
branch; the fixes below were tried in a throwaway copy. Measured in **Edge 157.0.4341.42 headless**,
the same engine and version as this PC's WebView2 runtime (157.0.4341.42), which the built app draws
with; GPU on, DPR 1; the perf build of `fix/sprite-sharpness` 99b1b998 (brief 550 X1 and X2); board
S2; game loop stopped. Not run in the built app itself (see "Not verified").*

**Window sizes.** A maximised window with Windows' own title bar has a client area of the screen's
work area less the 23-px title bar. This PC's screens are 1920 × 1080 with a 40-px taskbar, so the
owner's maximised game is **1920 × 1017** (reasoned from Windows' metrics, read on this PC:
work area 1920 × 1040, caption 23 px). The same rule gives 2560 × 1377, 1600 × 837 and 1366 × 705
for the other common screens; 1920 × 1080 and 2560 × 1440 are the same screens full-screen.

## In short

1. **Uneven outlines: cause found, measured.** The mat is drawn at its own size and shrunk to the
   window with one CSS `transform: scale(fit)`. Each sprite is sized so that, after the shrink, it is
   an exact multiple of its art (`boardScaleAt`: 166.23 mat units → 128 screen px at fit 0.77). But
   Chrome rounds every picture's box to **whole mat units before the shrink** (166 or 167), so the art
   lands 127.8 or 128.6 px wide: one row or column of art pixels comes out a pixel **thinner** (or
   **thicker**), at a place that depends on where the Token stands, so it changes when the window is
   resized. The coloured outline is a second picture, rounded on its own, so it slips against the art.
   At the owner's 1920 × 1017, **23 of 106** Tokens have such a row or column; at 2560 × 1377,
   **90 of 107**. Only a fit of exactly 1 (or ½) is clean.
2. **The twitch: partly reproduced.** The "Nothing to work here" bubble's 120 ms pop runs on the
   compositor (its own layer), but it is drawn above every Token, and **no Token's drawing changed
   while it played**, at fits 0.55, 0.77, 0.83 and 1. What does change Tokens today is any redraw of
   the mat's own composited layer: a Token whose art is a pixel off (fault 1) can come out with its
   thin row moved by one art pixel (1 to 4 Tokens per redraw, measured), and the spawn pop pushes
   Tokens onto layers (T-394, measured). I could **not** reproduce "all Tokens twitch at once" in
   headless Edge.
3. **Recommendation: option D, draw the mat with CSS `zoom` instead of `transform: scale`.** Chrome
   then lays the mat out at screen size and rounds in screen pixels: **every Token exact and every
   outline exactly one art pixel round its art, at every window size measured**, the board the same
   size as today, the mat no longer a composited layer of its own (3 layers at rest instead of 8–10 below fit 1),
   and the redraw and spawn effects gone (0 Tokens changed). Risk: moderate (it changes how the whole
   mat is scaled); cost on frame time not measured: **ready for bench** once built.

## 1. Uneven outlines

### What happens (measured)

`Board.jsx` draws the mat at its natural size (S2: 1760 × 1126 mat units) and fits it to the window
with `transform: scale(fit)` (`useBoardScale`, fit floored to whole percent). Sprites are sized in mat
units by `boardScaleAt(fit)` so that, through the transform, a Token's art is exactly
`boardArtSteps(fit) × 64` screen px: so **screen pixels per art pixel is whole by design** (1 below fit
0.75, 2 from 0.75 to 1.24, 3 from 1.25), and **Token positions are not whole** (none or 1 of 107 Tokens on
a whole screen pixel at every fit measured but 1 and ½, where 49 of 107 are). Neither is the fault on its own.

The fault is Chrome's rounding. Blink snaps each image's box to whole CSS px **in the element's own
coordinates**, which are mat units here, before the mat's scale applies. Read from Chrome's own drawing
record of the mat's layer (`LayerTree.snapshotCommandLog`) at 1920 × 1017 (fit 0.77): the 32-px Token
pictures are drawn into boxes of **166 × 166 mat units (76 of them), 167 × 166 (20), 166 × 167 (7),
167 × 167 (2)**, all at whole mat-unit positions; asked for 166.23. 166 units are 127.8 screen px,
167 are 128.6. Spread across the picture with nearest-neighbour sampling, the shortfall or excess lands
on one row or column: a pixel thinner or thicker than its neighbours. Where it lands depends on the
Token's sub-pixel position, so the same Token changes when the window is resized.

The coloured outline (white hover, green work, red alert) is a separate picture one art pixel bigger
all round (`spriteFx.layerStyle`, a background image at `-pad`), so it is rounded separately and its
edge slips against the art's: in a bare test page (sprites and outlines as the game draws them), **0 or
1 of 40** outlines sat exactly one art pixel round their art at fits 0.55–0.95; 40 of 40 at fit 1.

The hypothesis in the brief was half right: an art pixel is a whole number of screen pixels as far as
the game asks, but Chrome draws the art 0.2 to 0.6 px off that size.

### How it was measured

Every Token's picture on the frozen board was swapped for a 64 × 64 test picture in which every pixel
has its own colour, and the screenshot read back: for each art pixel, how many screen pixels it got.
Only runs bounded on both sides by the same Token's own neighbouring art pixels count, so anything drawn
over a Token (a hero, a flag, another Token) never reads as a fault. A Token is "exact" when every art
pixel got the same width. (S2's Token pictures are 32 × 32, so there one real art pixel is 4 screen px at
fits 0.75–1.24; most of the game's own Token art is 64 × 64, 2 screen px an art pixel, the same grain
as the test picture.) Scripts: the scratchpad, listed at the end.

### Per window size (measured)

| window | what it is | fit | screen px per art px | mat drawn (px) | today: Tokens with a thin or thick row or column | with D (zoom) |
|---|---|---|---|---|---|---|
| 1366 × 705 | 1366 × 768, maximised | 0.50 | 1 | 880 × 563 | 1 of 106 | 0 of 106 |
| 1600 × 837 | 1600 × 900, maximised | 0.61 | 1 | 1074 × 687 | **37 of 106** | 0 of 105 |
| **1920 × 1017** | **1920 × 1080, maximised (the owner)** | **0.77** | 2 | 1355 × 867 | **23 of 106**, 5 drawn soft | 0 of 106, 1 soft |
| 2560 × 1377 | 2560 × 1440, maximised | 1.09 | 2 | 1918 × 1227 | **90 of 107** | 0 of 107 |
| 1920 × 1080 | full screen | 0.83 | 2 | 1461 × 935 | 26 of 107, 5 soft | 4 of 107 (see below), 1 soft |
| 2560 × 1440 | full screen | 1.15 | 2 | 2024 × 1295 | 51 of 106 | 0 of 107 |
| 1200 × 770 | bench:crisp size | 0.55 | 1 | 968 × 619 | 11 of 105, 5 soft | 0 of 105 |
| 1600 × 1000 | bench default | 0.76 | 2 | 1338 × 856 | 45 of 104, 4 soft | 2 of 105 (see below), 2 soft |
| 2060 × 1266 | bench:crisp size | 1.00 | 2 | 1760 × 1126 | 1 of 106 | 1 of 107 |

"Soft" means drawn blended, not pixel for pixel: 4 or 5 Tokens today at the fits below 1, scattered
over the mat (no filter, no animation on them; cause not traced); with zoom 4 of those 5 are crisp at
1920 × 1017. D's leftovers at 1920 × 1080 and 1600 × 1000 are Tokens in the mat's bottom row, all with
the same art row thin; cause not traced; at 1920 × 1017, the owner's size, there are none. The same board swapped to zoom in place
(no reload) gave the same counts: 1920 × 1017 today 23 / zoom 0; 2560 × 1377 today 90 / zoom 0;
fit 1 identical.

Why `bench:crisp` did not catch it (reasoned): its "drawn exactly" check judges the middle 60 % of each
sprite, tries the picture at quarter-pixel offsets up to a pixel either way and passes at 98 % of
pixels; a single row a pixel off, or one near the edge, passes. It did report "2 to 3 soft at rest".

### Screenshots of the fault (3×, nearest-neighbour)

All in `sprite_sharpness_2/`. Each pair is the **same frozen board**, before and after swapping the
mat's transform for zoom in place.

- `option_today_1920x1017.png` against `option_D_zoom_1920x1017.png`: a hero with the green work
  outline at the owner's size. Today the outline stands off the left hand by a column and the art's
  own black outline is uneven; with zoom the outline hugs the art.
- `token_today_1920x1017.png` against `token_D_zoom_1920x1017.png`: a ring Token; today some art
  rows are 3 px and some 5 px where all should be 4.
- `token_today_2560x1377.png` against `token_D_zoom_2560x1377.png`: the worst size measured.

## 2. The twitch

### What the drag and the bubble animate (measured)

While a hero is carried:

- **the carried flag** (the drag ghost): its own composited layer (`will-change: transform`), outside
  the mat, drawn over everything;
- **the dashed order line**: an SVG path rewritten every frame, on the main thread, no layer;
- **the flags' 30 % fade**: on the main thread since brief 550 X1 (`will-change: contents`);
- **green outlines** on every Token the carried hero could work, from the drag's start (intended);
- over a Token, the **hint marks** over every hero and, where the hero cannot work it, the red
  **"Nothing to work here" bubble** (`OrderDragLine.jsx` `AimedLabel`), whose `order-reason-pop`
  (`components.css`, 120 ms, `steps(2, end)`, a transform) has no `will-change: contents`, so Chrome
  runs it on the compositor: one more composited layer while it plays (reason
  `ActiveTransformAnimation`; 9 → 10 at 1920 × 1017, 8 → 10 at 1920 × 1080);
- after a refused drop, the **refusal callout** (`.callout-bubble`, 2.2 s, transform and opacity):
  also on the compositor (one more layer while it plays).

The bubble and the callouts are drawn at `MAT_Z.CALLOUT`, above every Token and flag (only hero
speech is higher), so unlike the flag fade they cannot push a Token onto a layer of its own.

### Does the bubble change the Tokens? (measured: no)

Real drags (browser mouse input on a hero, moved over Tokens until one said "Nothing to work here"),
the pop lengthened to 4 s so it could be photographed mid-play, Tokens striped as above, ambient life,
hero and enemy frames and Token effects switched off so nothing else moves. Counted: Tokens whose
drawing changed shape (an art pixel's width changed) between the bubble playing and played out, only
where nothing covers them.

| window | fit | Tokens judged | changed while the bubble plays | layers at rest / carrying / bubble playing |
|---|---|---|---|---|
| 1200 × 770 | 0.55 | 105 | 0 | 9 / 11 / 12 |
| 1920 × 1017 | 0.77 | 107 | 0 | 9 / 9 / 10 |
| 1920 × 1080 | 0.83 | 107 | 0 | 8 / 9 / 10 |
| 2060 × 1266 | 1.00 | 107 | 0 | 3 / 4 / 7 |

**Frame by frame**, with the real 120 ms pop (not lengthened): every frame Chrome drew was captured
(`Page.startScreencast`, full size, PNG) from 0.6 s before the pointer reached the Token until 0.9 s
after it left, at 1920 × 1080. **70 frames, no Token changed shape in any of them**, and the number of
soft Tokens stayed at 5 throughout. (6 Tokens being worked shift by an art pixel now and then, their
work shake; that is in both modes and not counted.)

### What does change Tokens today (measured, small)

The mat is drawn into **a composited layer of its own** today (Chrome's reasons:
`RootScroller|OverflowScrolling`), sized to everything painted on the mat. Its screen offset has a
sub-pixel part that depends on how far the mat's drawing reaches: 345.91, 65.60 at rest at
1920 × 1017, 342.06, 60.21 once a hero is carried (the drag draws further out). When part of that layer
is redrawn, a Token whose art is a pixel off (section 1) can come out with its thin or thick row in a
different place: the twitch, one art pixel, on that Token.

- **A 2-px dot painted near the mat layer's edge** (a stand-in for any small redraw): 1–2 Tokens
  changed shape at 1920 × 1080, 3–4 at 1920 × 1017; removing it put them back. With zoom: **0**.
- **Picking up a hero**: 2–3 Tokens changed shape at 1920 × 1080 (two runs), 1 at 1920 × 1017, 0 at
  fits 0.55 and 1. With zoom: **0** at 1920 × 1080 and 1920 × 1017.

### Other bubbles and the spawn pop (T-394, measured)

- **Hero speech** (`HeroBubbleLayer`): no animation, `will-change: contents` since 550 X2: no layer.
- **Callouts** (`callout-pop`: the refusal after a drop, "! Spawned Oak Tree"): on the compositor
  (one more layer while one plays today), drawn above the Tokens: **0 Tokens changed**, today and with
  zoom.
- **The spawn pop** (T-394). The game's pop (`spawnMotion.playSpawn`) runs on the main thread
  (`will-change: contents`) and still adds layers today. Two stand-ins on the back-most Token, held
  4 s: `bench:crisp`'s (with its `scale(0.5)`) and the game's own shape (whole art pixels, no scale):

  | | 1920 × 1080 today | 1920 × 1080 zoom | 1920 × 1017 today | 1920 × 1017 zoom |
  |---|---|---|---|---|
  | layers at rest → while it plays | 8 → 11 to 13 | 3 → 3 | 9 → 28 | 3 → 3 |
  | still Tokens changed shape | 4 | 0 | 7 (and 9 moved) | 0 |

  So T-394 is real (fewer Tokens than `bench:crisp`'s 14–61, which counts any pixel change, the popping
  Token passing over its neighbours included; reasoned) and
  has a different cause from the flag fade: the pop is already off the compositor, but a Token box
  whose transform changes every frame inside the mat's composited layer still splits it into layers
  (reasoned from the layer counts; Chrome's own reason not read). With zoom there is no mat layer to
  split: no layer, no change.

### Not reproduced, and what is left

"All the Tokens twitch" at once did not happen in any headless run: per redraw it was a handful. What
could make it all of them in the built app is reasoned only: WebView2 presents through Windows'
compositor (headless does not), and a composited layer whose sub-pixel offset changes (as the mat's
does when a hero is picked up or a bubble reaches past its edge) may be shown for a frame from its old
tiles at the new offset, resampled, until Chrome redraws it; that would shift or soften every Token on
the mat for a frame. With D the mat is no longer a layer of its own, so that path is gone too; whether
the twitch is gone is for the owner's eye in the built app (a check in the eye-check list, below).

## 3. Options

Screenshots: `sprite_sharpness_2/`, the same patch of the S2 board at the owner's 1920 × 1017
(maximised 1920 × 1080), 3× nearest-neighbour; the board shown today for comparison is
`option_today_1920x1017.png`.

| | what | screenshot | board size (mat width) at 1366 × 705 / 1600 × 837 / **1920 × 1017** / 2560 × 1377 (and 1920 × 1080, 2560 × 1440 full screen) | risk |
|---|---|---|---|---|
| **A** | Snap the fit down to a clean scale: 1 when the mat fits at 1 or more, else ½ (the only fits Chrome draws exactly through a transform). | `option_A_strict_1920x1017.png`, `overview_A_strict_1920x1017.png` | 880 / 880 / **880** / 1760 px, against today's 880 / 1074 / **1355** / 1918: **−0 / −18 / −35 / −8 %** (−40 % and −13 % full screen). At 1920 × 1017 and 1920 × 1080 the Tokens are also drawn **half size** (64 px instead of 128). | Low in code (one rule in `fitScale`); large in look. Measured exact: 107 of 107 Tokens at 1920 × 1017 and 2560 × 1377. |
| **B** | A, with the empty band round the smaller mat filled by the ground picture scaled up. | A's (the play area and every Token are A's; only the band changes; not built) | as A | Medium: the ground has to be drawn beyond the mat, out of reach of drops and Tokens; the shrink of the play area stays. Not recommended. |
| **C** | Draw the mat at 1× and let the browser shrink the whole picture once, smooth or nearest. | `option_C_smooth_1920x1017_simulated.png`, `option_C_nearest_1920x1017_simulated.png` (simulated: a fit-1 screenshot of the same board shrunk ×0.77) | same as today, but the sprites shrink with the mat (128 → 99 px at 0.77): the "art steps while the spacing glides" rule goes. | Smooth: **every sprite soft**. Nearest: rows and columns dropped all over, worse than today. Not recommended. |
| **D** | Scale the mat with CSS `zoom: fit` instead of `transform: scale(fit)` (plus `isolation: isolate`, so the mat stays the stacking context the z-order relies on). Chrome lays the mat out at screen size and rounds in screen pixels. | `option_D_zoom_1920x1017.png` | **none**: the same size as today at every window | Moderate: one style in `Board.jsx`, but it changes how the whole mat is scaled. Measured: every Token exact at every size but one bottom row at two sizes (table above), the outline aligned, 3 composited layers instead of 8–10, no Token changed by redraws, a pick-up or the spawn pop, and a carried hero aims at the Token under the pointer (30 of 30 Token centres, as today). Frame cost **not measured** (bench). |

Also considered, reasoned only: keep the transform and pick fits from a ladder (64/k) where every sprite
is a whole number of mat units. The outline's one-art-pixel offset stays fractional at almost every step
of the ladder, so the outline would still slip; D does the same job without restricting the fit.

### What D needs when it is built (reasoned, from reading the code and a test page)

- `Board.jsx`: `zoom: fit.scale` and `isolation: 'isolate'` instead of the transform and its origin
  (the z-values in `matLayers.js` run to 34 million and stay inside the mat only because the mat is a
  stacking context; a transform made one, zoom does not).
- Anything reading the mat's geometry: `getBoundingClientRect()` answers in screen px under zoom as it
  did under the transform (checked in a test page: a 200 px box at zoom 0.77 reports 154), and
  `offsetWidth` stays in mat units (200), as `HeroBubbleLayer`'s measure expects. `pointerToMat`,
  `matRectForDrag`, the drag ghost (`data-board-scale`), `ParticleOverlay`, alpha hit-testing and the
  Hall's camera need a check in the running game; the hero-drag aim was checked (30 of 30 Token
  centres aimed at that Token, as today).
- `bench:crisp` gains the test-picture check above (art pixel widths), which is what found this.
- The bench: `bench:draw --compare` and the drag bench, since what Chrome composites changes.

## Recommendation, and what I built

| | |
|---|---|
| **Recommend** | **D** for both: the mat scaled by CSS `zoom`. It removes the uneven rows and the slipping outlines at every window size, at no cost in board size, and with them the redraw twitch and T-394's spawn effect (measured: 0 Tokens changed). The bubble's pop needs no change (measured harmless to Tokens, today and with zoom). Then the owner looks at the twitch again in the built app; if it is still there, the next step is to measure inside the built app itself (a test build with its own identifier, with Chrome's debugging port opened through `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`). |
| **Built** | Nothing on any branch. In a throwaway worktree (`dx`, detached, removed): a URL switch in `Board.jsx` (`?matmode=zoom`) and in `useBoardScale.js` (`?matmode=strict`, option A) to take the measurements; and the same-board shots swapped the mat's style in place. |

**Owner question (for the director to put in the batch), recommendation first:**
How should the mat be scaled so pixel art stays even? **(a) D, zoom: same board size, every sprite
exact (recommended)**; (b) A, clean fits only: exact, but the board 35 % smaller and Tokens half size at
1920 × 1080; (c) leave it: uneven rows on a quarter to most of the Tokens, depending on the window.

## Measured and reasoned

- **Measured** (Edge 157 headless, perf build): Chrome's recorded box sizes (166/167 mat units); the
  per-size table, today and zoom, by reload and by in-place swap; the outline alignment in a test page;
  layer counts and reasons at rest, dragging, with the bubble and callout; the bubble changing no Token
  at four fits; the dot and pick-up redraws; the spawn stand-ins; option A exact; zoom's layout readings.
- **Reasoned**: the owner's window size (from Windows' metrics, not the running app); why the
  top-edge Tokens draw soft; why the bench missed it; the possible full-board twitch in WebView2;
  option B; option C (simulated from a screenshot, not drawn by Chrome); the build notes for D.
- **Not verified**: the built app (WebView2 with Windows' compositor) at all; D's frame cost; D across
  the rest of the game (Hall, Atlas, drawers, CMS previews).

## Files

Scripts (scratchpad of this session, temporary; rerun rather than rely on them):
`C:\Users\16048\AppData\Local\Temp\claude\2ef84ffb3e66eeb3\d333e011-b2c2-45ca-a45c-16b112f36fb1\scratchpad\dx\`
— `game1.mjs` (per-size table), `stripe.mjs` (the test picture and its judge), `judge.mjs`,
`table.mjs`, `exp4.mjs` and `probe2.mjs` (Chrome's command log), `exp5.mjs` (zoom against transform,
outlines), `shots.mjs` (same-board swap), `game2.mjs` (drag and bubble), `game3.mjs` (redraw dot),
`game4.mjs` (spawn), `game5.mjs` (frame by frame), `simc.mjs` (option C). They need `CHROME_PATH` set to
Edge and a perf build with the scratch `?matmode` switch.
