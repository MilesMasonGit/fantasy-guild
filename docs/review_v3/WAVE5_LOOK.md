# Wave 5 — the eye-check before it is kept

*Branch `draw/wave5`, built on top of `draw/wave4` (neither is merged — owner ruling Z §11 Q4:
the drawing batch waits for your look; review both together). Written 2026-10-01 by the Wave 5
engineer. Pictures are in [`wave5_look/`](wave5_look/). **Updated the same day after your first
look: see "Your follow-up" just below.***

## Your follow-up (2026-10-01, after reviewing the branch live)

You liked the shadows and the speed, and asked for three changes. All three are done:

1. **The outline is redrawn** — the old one "still didn't look right". Two causes, both fixed:
   - it drew **half art pixels** (1 screen pixel on a sprite drawn at 2×), off the art's grid;
   - it had **"doubles"**: L-shaped clumps where the line turns, from pixels that only touched the
     art at a corner.

   Now: **an outline pixel sits only where it touches the art edge to edge** (up, down, left or
   right — never only corner to corner), it is **exactly one art pixel** thick, and it is **scaled
   with the sprite like the art itself**, so every outline pixel is a whole art pixel on the art's
   grid. The art's own black border counts as part of the sprite: the coloured line sits outside
   it. Heroes and enemies follow the same rule, frame by frame. There is no thickness setting any
   more. Pictures: **`outline_v2_compare_1x.png`** (actual size) and
   **`outline_v2_compare_4x.png`** (enlarged): before on the left, after on the right — worked
   (tree and hero), hovered, alert, an enemy (the cow), and a hero on its own.
2. **The charge ring and the spawner's count ring now glide** to a new value over about
   0.8 seconds, slowing as they arrive, instead of jumping. The number inside changes at once;
   the ring slides. Nothing runs while a ring is still, and only the ring that changed moves.
3. **The raised shadow follows the sprite** (your final ruling). The "stays on the ground" option
   and its Mat Tuner row are gone.

The Mat Tuner has no "Look" group any more.

### One question for you: the inside corners

**W5-3 — Where the outline turns an inside corner.** Your rule ("edge to edge only") already
removes the doubles at the outer corners. There is one case it keeps: where the art itself has an
**inside corner** (an L-shaped notch), the outline pixel in the elbow of that L touches the art on
two sides, so by the rule it belongs — and the outline makes a small L there. Across the 196 Token
sprites that is about **2 % of outline pixels** (840 of 39,468), on 169 sprites, so most sprites
have one or two somewhere. Look at the inside corners of the cow's legs and the minecart's wheels
in `outline_v2_compare_4x.png`.
- **(A) Recommended: keep the rule exactly as you gave it** (built). The line stays unbroken
  edge to edge all the way round, and an elbow pixel is still a single art pixel.
- (B) Also drop the elbow pixel at an inside corner, so the line cuts the corner diagonally there,
  the way some pixel artists hand-clean outlines. Slightly lighter corners; the line is then joined
  only corner to corner at those spots. A small change if you want it.

## In plain language

Wave 5 builds **your own design** for shadows and highlights (Z §11, "Shadows and outlines —
owner rulings after the spike"):

- **A Token resting on the board has no shadow at all.** The soft shadow under every sprite is gone.
- **A Token you are dragging, and loot floating on the mat, cast a hard shadow:** a solid black
  copy of the sprite, 2 art pixels down and to the right, pixel-crisp.
- **The soft green glow is replaced by a sharp coloured outline** around the art's own black
  outline: **green = working, white = hovered or selected, red = alert.**

Both are **ready-made pictures**, made from the sprites automatically every time the game is
started (`npm run dev`) or built (`npm run build`), so new art gets them with no extra step. The
graphics card no longer recalculates a blur on every sprite, every frame.

On the busy board, measured on this PC in a hidden test browser, back to back with Wave 4:

| | Wave 4 (today's look) | Wave 5 (your design) |
|---|---|---|
| Frames drawn per second | ~147 | **~163** (the test browser's ceiling) |
| Frames that fit the 165 Hz budget (6.06 ms) | 81 % | **99 %** |
| Graphics card busy | 74 % | **30 %** |

On the 300-Token torture board: ~110 → **~147** frames a second, and 16 % → **76 %** of frames
within budget.

## Your two earlier choices — decided

- **W5-1 Outline thickness:** superseded by your follow-up — exactly one art pixel, edge to edge
  only (above). The 1-screen-pixel version is gone.
- **W5-2 Raised shadow:** **(A) follows the sprite**, 2 art pixels down-right (your final ruling).

## What to look at (the eye-check list)

1. **Resting Tokens have no shadow** (`compare_1x.png`, "Resting" row). Do they still read as
   objects on the board, or do they look printed on? *(Also true off the mat: the Shop's list,
   the inspection panel's header, the discard bin and the flag rules panel lost their soft
   shadow too, as "no shadow at rest" applies everywhere.)*
2. **A Token in your hand** casts the hard black shadow (`*_drag_*.png`). Pick one up and move it
   around the mat.
3. **Floating loot** casts the hard shadow and still bobs (`*_loot_*.png`).
4. **Working = green outline**, on both the Token and the hero working it (`*_worked_*.png`). A
   hero working a stuck Token gets no outline (the Token's red outline and badge say it), as
   today's glow behaved.
5. **Hovered = white outline** (`*_hover_*.png`). The little hop on hover is kept; the brightening
   that came with it on the mat is gone (the white outline says "hovered" now). Clicking a Token to
   inspect it keeps it white while its panel is open; inspecting a hero does the same for the
   hero. Hovering a flag (or its hero) outlines the flag white.
6. **Alert = red outline** (`*_alert_*.png`). *(For the pictures an alert was forced on a minecart;
   a real one appears when a worked Token runs out of inputs or room.)*
7. **The landing bounce** when you put a Token down still drops and rebounds, but no longer
   flashes a shadow.
8. **Animated heroes and enemies**: their outline follows every animation frame.
9. **The outline's shape** (follow-up): one art pixel thick, square to the art's own pixels, no
   pixels hanging off the corners (`outline_v2_*`).
10. **Count rings glide** (follow-up): watch a worked Token's gold charges ring tick down, and a
    spawner's green ring as it fills. Each step should slide, not snap.

## How to try it yourself

1. **Ask the director to open the Wave 5 branch** (`draw/wave5`) in the game folder.
2. In a terminal in the game folder: **`npm run dev`**. The first start after switching takes a
   few extra seconds while the shadows and outlines are drawn (it prints
   `sprite-fx: drawing shadows and outlines…`); later starts are instant.
3. **Your own game:** open the address it prints (usually `http://localhost:5173/`) and play:
   hover Tokens, pick one up, watch working heroes, collect loot.
4. **The busy board** (does not touch your saves): `http://localhost:5173/?stress=realistic`.
5. To compare with Wave 4, ask the director to switch to `draw/wave4` and repeat.

## The pictures (`wave5_look/`)

Taken in a hidden test browser at 2560 × 1440, where a full-size Token is drawn at 2× (the size
most players see). **Real game Tokens** (64-pixel art: oak tree, campfire, minecart, coast,
copper pickaxe, copper ore, the cow), placed on the quiet test board with one hero working the
tree. ⚠ Correction to the first version of this note: the campfire, oak tree and minecart are
**small** Tokens, drawn at half that (one art pixel = one screen pixel); the hero and the cow are
drawn at 2×. That is why the new outline is one screen pixel on the campfire and two on the hero.

| File | What it is |
|---|---|
| `outline_v2_compare_1x.png`, `outline_v2_compare_4x.png` | **Start here (follow-up).** Before (the first outline) against after (one art pixel, edge to edge only): worked tree and hero, hovered campfire, alerted minecart, the cow (enemy sheet), and the hero alone |
| `outline_v2_old_*`, `outline_v2_new_*` (`_1x`, `_4x`) | Each of those subjects on its own, before and after |
| `compare_1x.png` | *First version (superseded by the follow-up).* Actual size. Rows: worked, hovered, alert, resting, dragged, floating loot. Columns: today (Wave 4), outline 1 screen px, outline 1 art px |
| `compare_4x.png` | The same (first four rows), enlarged 4× with every pixel kept square |
| `shadow_dragged_and_loot_4x.png`, `_1x.png` | Choice W5-2: today, shadow follows the sprite, shadow stays on the ground |
| `stress_board_4x.png` | The same three columns on the busy test board (its test Tokens wear small 32-pixel icons, so "1 art px" is 4 screen px there) |
| `today_*`, `screen_*`, `art_*` (`_1x`, `_4x`) | Each subject on its own: today, 1 screen px, 1 art px |
| `full_today.png`, `full_wave5.png` | The whole screen, today and Wave 5 |

⚠ The board is live: heroes, logs and loot are in slightly different places in each column. The
Tokens themselves do not move.

## What changed, step by step

| Commit | What |
|---|---|
| `ef144b8` | The picture generator (`scripts/spriteFx.mjs`, a Vite plugin) and its tests |
| `e526933` | Every sprite a Token can wear gets outlines (not just the tokens folder) |
| `ab437a4` | Sprites drop the soft shadow filter; hard shadow in the hand and on loot; outline layers; the two Mat Tuner rows |
| `28f24a4` | Outlines replace the glow and the hover brightening; selection outlines; the landing bounce loses its shadow |
| `1f45f14` | Follow-up: the outline is one art pixel, edge to edge only (4-connected), scaled with the sprite; the thickness setting goes |
| `094eecf` | Follow-up: the raised shadow always follows the sprite; its setting goes |
| `c41665e` | Follow-up: the charges and spawner count rings glide (a CSS transition, about 0.8 s) |

## The measurements in full (for the director)

Headless Chrome 154 over the DevTools protocol, dev build, this PC's GPU (RTX 3060 via
ANGLE/D3D11), 1600×900, DPR 1, 2026-10-01 03:44–03:54. `draw/wave4` (`179b8e1`, its own worktree,
own Vite cache, port 5392) and `draw/wave5` (`28f24a4`, port 5391) served side by side; each
scenario ran wave4, wave5, wave5, wave4 (20 s settle, 30 s `__perf` window, 5 s trace). Machine
load 29–44 % before each run. **Not representative; only the comparison counts.** All runs
`representative: true`, React counting armed. At this window the mat's fit is 0.63, so the board
draws sprites at 1× (the stress Tokens' 32-pixel icons at 2×).

**S2 realistic** (~102 Tokens, 8 heroes):

| | fps (r1 / r2) | frame work p50 / p99 ms | ≤ 6.06 ms | GPU busy | MatBoard own renders/s | mat subtree commits/s | HeroDock commits/s | LoAF / 30 s |
|---|---|---|---|---|---|---|---|---|
| wave4 | 146.8 (147.8 / 145.7) | 4.06 / 9.9 | 80.8 % | 74.0 % | 4.0 | 8.5 | 0.6 | 2.5 |
| wave5 | **163.4** (163.2 / 163.6) | **2.25 / 6.9** | **98.8 %** | **29.5 %** | 3.7 | 8.4 | 0.7 | 4.0 |

**S3 torture** (310 Tokens):

| | fps (r1 / r2) | frame work p50 / p99 ms | ≤ 6.06 ms | GPU busy | MatBoard own renders/s | mat subtree commits/s | HeroDock commits/s | LoAF / 30 s |
|---|---|---|---|---|---|---|---|---|
| wave4 | 109.7 (109.7 / 109.6) | 8.10 / 28.6 | 15.8 % | 76.0 % | 9.4 | 12.9 | 1.1 | 8.0 |
| wave5 | **147.1** (147.3 / 147.0) | **3.75 / 23.5** | **75.7 %** | **44.0 %** | 9.2 | 12.8 | 1.1 | 5.5 |

What the mat carries (census at the end of each window):

| | S2 wave4 | S2 wave5 | S3 wave4 | S3 wave5 |
|---|---|---|---|---|
| Elements inside the mat | ~1,000 | ~1,240 | ~2,480 | ~3,140 |
| Elements with a live filter (animated) | 233 (21) | 107 (4–6) | 645 (17) | 312 (0–2) |
| Outline layers / silhouettes shown | — | 15 / 1–4 | — | 15 / 1 |

The extra elements are two small boxes per Token (the sprite's layer box and its raise box). The
filters left are outside this wave: the Token-name and count labels' text shadows and the
bouncing "!" alert icons' glows (`TokenEventAlert.jsx`, `TokenBadges.jsx`).

**Engine:** `npm run bench -- --compare` → **same work** for S1–S7, no timing regression.
**Tests:** 1 failed (the known AssetManager "every sprite exists on disk") | 3961 passed | 27
skipped — Wave 4's 3919 plus 42 new. **Build:** `npx vite build` passes from an empty generated
folder (721 sprites drawn in 12.7 s), and `dist/_gen/sprite-fx/` holds the 11,116 images and the
manifest (~4 MB).

### After the follow-up (2026-10-01, afternoon)

- **Engine:** `npm run bench -- --compare` → **same work**, S1–S7. The first run flagged one
  timing (S4 `refusedWorst` ×1.40, a single worst-case sample); no engine file changed since
  `120b077`, and the rerun was clean (×1.04, no regression).
- **Tests:** 1 failed (the same AssetManager "every sprite exists on disk") | 3968 passed | 27
  skipped. New: the generator's ring is checked pixel by pixel against a brute-force
  edge-to-edge reference, with no ring pixel only diagonal to the art and every ring pixel one
  image pixel per art pixel (`SpriteFxGenerator.test.js`); the ring glide (`RingGlide.test.js`);
  the Look rows gone (`SpriteFxLook.test.js`).
- **Build:** `npx vite build` passes; `dist/_gen/sprite-fx/` now holds 2,800 images (one outline
  per colour instead of five) and the manifest, ~4.2 MB.
- **Ring glide checked in a real (headless) browser:** a charges ring's offset went 0 → 59 → 75 →
  78.3 → 78.5 at 0.05 / 0.2 / 0.4 / 0.6 / 1.0 s — a smooth ease-out over 0.8 s.
- **Frame rate not re-measured:** the follow-up draws the same layers (one picture per outlined
  sprite, still no filters); the glide runs only on a ring whose value just changed.

## Noticed, not changed (outside this wave)

- **~65 bouncing alert icons on the busy board still carry an animated glow filter**
  (`TokenEventAlert.jsx`), and ~105 name and count labels a static text shadow. The spike found
  removing them changed no frame rate; they are now most of what filters remain.
- **Floating loot looks slightly soft in all versions** (today's too): its box sits on a
  fractional pixel while the bob animation runs. Not caused by this wave.
- **The first time a sprite shows a given outline colour**, the browser loads that small picture;
  in the desktop app this is from disk and should be invisible, but it may miss a single frame.
- A Token whose art comes from the CMS as a pasted image (not a file in `public/assets`) gets no
  shadow or outline until it is saved as a file. It never breaks; it just draws plain.
