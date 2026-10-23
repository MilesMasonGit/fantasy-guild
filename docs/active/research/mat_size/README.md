# Mat size: the candidates and the pick (T-211)

**The owner picked b: 12 × 6.5 steps, 1920 × 1040 u**, and it is now the game's mat. Pictures from
the running game after the change, taken 2026-10-23:

- `after_b_1920.png`, `after_b_1366.png`: a fresh New Game on the new mat (zoom 0.92 and 0.63,
  Token art 128 and 64 px, exactly as `b_1920.png` and `b_1366.png` below predicted).
- `oldsave_before_1920.png`: a save made on the old 1760 × 1126 mat with three Oak Forests along
  its bottom edge (y 1050, 1050 and 1000).
- `oldsave_after_b_1920.png`: the same save opened with the slot screen's Load button on the new
  mat: the three Forests are pulled up to y 976, just inside the new edge; every Token is on the mat.

The rest of this page is the comparison the owner picked from.


Pictures of the whole game window on a fresh New Game, one per mat size and window size, taken
2026-10-22 from the dev build. **Nothing is baked yet**: the owner picks, then stage 2 makes it the
game's size. File names are `<candidate>_<window width>.png`.

A **step** is 160 mat units, the distance between two neighbouring Tokens, so "room" below is how
many Tokens fit side by side across and down at ordinary spacing.

| Pictures | Mat (mat units) | Room (across × down) | Room vs today |
|---|---|---|---|
| `today_*` | 11 steps at 0.64: 1760 × 1126 | 11 × 7.0 | |
| `a_*` | 12 × 7 steps: 1920 × 1120 | 12 × 7 | 9 % more |
| `b_*` | 12 × 6.5 steps: 1920 × 1040 | 12 × 6.5 | about the same (1 % more) |
| `c_*` | 13 × 6.5 steps: 2080 × 1040 | 13 × 6.5 | 9 % more |
| `d_*` (suggested extra) | 12 × 6 steps: 1920 × 960 | 12 × 6 | 7 % less |

## What each looks like on screen (measured in these pictures)

The mat is drawn and then shrunk to fit the space between the top bar, the nav orbs and the hero
dock. **Zoom** is how much; the gaps between Tokens on screen follow it. **Token art** is only ever
drawn at a whole size (64 or 128 px) and drops from 128 to 64 px when the zoom falls below 0.75.
**Spare height** is the empty wood above and below the mat: how much taller the top bar (the next
phase, A2) can get before the mat has to shrink.

| | 1920 × 1080: zoom · Token art · spare height | 1366 × 768: zoom · art · spare | 1680 × 1050: zoom · art |
|---|---|---|---|
| today | 0.86 · 128 px · 4 px | 0.58 · 64 px · 7 px | 0.83 · 128 px |
| a | 0.86 · 128 px · 9 px | 0.58 · 64 px · 10 px | (0.79 · 128 px, computed) |
| b | **0.92** · 128 px · 15 px | **0.63** · 64 px · 5 px | (0.79 · 128 px, computed) |
| c | 0.85 · 128 px · **88 px** | 0.58 · 64 px · **57 px** | **0.73 · 64 px: Tokens half size** |
| d | **0.92** · 128 px · **89 px** | **0.63** · 64 px · **55 px** | 0.79 · 128 px |

In plain words:

- **a** only gets wider. Today's mat is limited by the window's height, and a is just as tall, so
  it frees no height: a taller top bar would shrink it exactly as it shrinks today's.
- **b** fills the width, so everything on it is drawn about 7 % bigger (Tokens further apart on
  screen); it frees almost no height (15 px).
- **c** keeps today's zoom at 1920 × 1080 and 1366 × 768 and frees the most height for the top bar.
  ⚠️ But it is wide enough that on a 16:10 window (1680 × 1050, 1600 × 1000) the zoom falls below
  0.75 and **every Token is drawn at half size**: compare `today_1680.png` with `c_1680.png`.
- **d** (not in the brief, suggested) gets b's bigger drawing *and* c's free height, and keeps
  full-size Tokens on the 16:10 window (`d_1680.png`). Its cost: 7 % less room than today.

## If the top bar grows (computed)

Zoom with today's 44 px bar, then 20 px taller, then 40 px taller:

| | 1920 × 1080 | 1366 × 768 |
|---|---|---|
| today | 0.86 → 0.84 → 0.82 | 0.58 → 0.56 → 0.55 |
| a | 0.86 → 0.85 → 0.83 | 0.58 → 0.57 → 0.55 |
| b | 0.92 → 0.91 → 0.89 | 0.63 → 0.61 → 0.59 |
| c | 0.85 → 0.85 → 0.85 | 0.58 → 0.58 → 0.58 |
| d | 0.92 → 0.92 → 0.92 | 0.63 → 0.63 → 0.63 |

So with b the bar can grow by 40 px and the mat is still drawn at least as big as today's is now;
with c and d the bar's growth costs nothing at these two windows.

## Other window sizes (computed from the game's own fit rule, which matched all 13 pictures)

Token art in px at each window, today's bar; in brackets with a top bar 20 px taller:

| Window | today | a | b | c | d |
|---|---|---|---|---|---|
| 1366 × 768, 1440 × 900, 1536 × 864 | 64 | 64 | 64 | 64 | 64 |
| 1600 × 900 | 64 | 64 | 128 (64) | 64 | 128 |
| 1600 × 1000 | 128 | 128 | 128 | **64** | 128 |
| 1680 × 1050 | 128 | 128 | 128 | **64** | 128 |
| 1920 × 960 (a browser on a 1080p screen) | 128 (**64**) | 128 (**64**) | 128 | 128 | 128 |
| 1920 × 1080, 1920 × 1200 | 128 | 128 | 128 | 128 | 128 |
| 2560 × 1440 | 128 | 128 | 192 | 128 | 192 |

## Files

- `capture_mat_sizes.mjs`: takes these pictures again (`node docs/active/research/mat_size/capture_mat_sizes.mjs <outDir>`);
  it starts its own dev server on port 5201 and its own headless Chrome, and stops both.
- `probe.json`: the raw measurements behind the tables (zoom, mat box on screen, every Token and
  whether it is inside the mat).
- To try a size live in the dev build: **TUNER** (bottom right) → *The mat* → **Mat size** (width in
  steps) and **Mat shape** (height over width: a 0.583, b 0.542, c and d 0.500).
