# World map hexes and the world picture: mock-ups (brief 380 M1)

*2026-11-05. Pictures only: nothing here is in the game. Pick from the two comparison pictures.*

- **`contact_hexes.png`**: the hex looks **A, B, C** side by side, with close-ups of a cell you can
  settle now (steady gold, and the pulse's two frames).
- **`contact_world_picture.png`**: the world picture under the hexes, **D, E, F** side by side.
- Full screens (1920 x 1080): `hex_A.png`, `hex_B.png`, `hex_C.png` (each over world picture E),
  `world_D.png`, `world_E.png`, `world_F.png` (the picture alone).

All from one real generated world (seed 1055225627, a new game on today's `main`): every cell's real
outputs and item art, and for E and F each cell's real mat, laid out as settling it would write it,
drawn by the game's own ground code. The moment shown: the Hall and four places settled, ring 2's
star bought and ring 3's not, the guild at the flag. Hex radius 84 px (the book's was about 50),
so the three rings fill the screen height beside a thinner panel; no hexes past ring 3; beyond it
the world fades into fog.

**Cell states, the same in every look**: settled and settle-able in full colour; can settle now:
gold (steady 1-pixel outline, or a 2-pixel outline pulsing between two golds, as UI_STYLE allows);
next to you but too costly or behind a ring star: darkened; not next to anything you hold: black and
white, its items too, still readable; under the pointer: full colour with a white outline. **Ring
lines**: a decorated border on every edge where two rings meet (not round the Hall's cell), no
numbers.

## The hexes

| | Look | Code-drawn | Would want the owner's art | Cost |
|---|---|---|---|---|
| **A** | **Clear glass.** The world picture is the hex: each cell shows the ground beneath it; a fine dark line between cells; items in a small dark plate; ring lines gold with a diamond at each corner. | Everything. | Nothing needed. Optional: the corner diamond as a 7 x 7 sprite. | The outlines and states over the picture: about 40 ms once (throwaway loop), then one still picture. |
| **B** | **Framed tiles.** Each hex its own window onto its mat's ground, bevelled (lit top-left), a 2-pixel gap and the house's hard shadow; items with hard shadows, no plate; ring lines a bronze inlay in the gap with studs. | Everything. | Optional: one hex frame sprite (the bevel) and one stud sprite. | About 80 ms once. |
| **C** | **Board tiles.** Thick tiles standing on the world, top in the cell's ground, a side in its land's earth colour; the cell's commonest Token stands on it; items in a plate below; ring lines a rope with knots. | The tile, side, shadow, rope (stand-ins). | **A tile base per kind of land** (Highland, Woodland, Plains, Wetland, Riverside, the Hall: 6 sprites about 84 x 78 art px) and rope pieces (a straight piece at the three hex angles and a knot). Tokens: existing art. | About 95 ms once, plus 37 Token sprites. |

The tooltip and panel are M3's; the right column in the full screens is a stand-in for the thinner panel.

## The world picture underneath

| | Picture | Made from | Would want the owner's art | Cost |
|---|---|---|---|---|
| **D** | **Painted map.** Colour fields per kind of land with wobbly borders, an ink line where lands meet, sand on the shores, tiny pixel symbols (trees, peaks, reeds, field rows, waves). | Each cell's kit only. | Optional: the 5 symbols as 8 x 8 sprites. | Under 0.1 s once when written properly (0.4 s in this throwaway). No mat needed. |
| **E** | **Real ground.** Each cell's own mat ground (the game's ground code, the same grass, rock, water and sand as on the mat), stitched with wobbly seams; each cell shows the most varied stretch of its mat. | Each cell's mat: its layout and its ground. | Nothing. | **The heavy one**: the game's ground builder took about 78 ms per cell for a whole mat (37 cells about 3 s; all 127 of this world's cells about 10 s), plus about 4 ms per cell for the layout. Built once per world, in small slices while idle, then kept as one picture (960 x 540 art px, about 2 MB in memory). Building only a hex-sized patch per cell should cut it to roughly a tenth (estimate, not measured). |
| **F** | **Miniature world.** E plus each cell's own commonest Tokens standing on it, at half the mat's size (the same ratio of Token to ground as on the mat). | E, and each cell's Tokens. | Nothing. | E's cost plus about 0.1 s to place the Tokens. |

⚠️ For E and F a cell's picture comes from its layout with its own seed; settling may move to a
later seed when a layout does not fit (`Settling.js`, `seedFor`), so a settled mat could differ a
little from its picture. Building the picture with `seedFor` would match it exactly, at a little
more cost.

## Recommendation

**A over E**: the glass look lets the cell's real ground be the "terrain sample" the owner asked for,
needs no new art, is the cheapest to draw, and the states read most clearly because nothing else
competes. F is the most charming picture but busy behind the item plates; it could be used only
outside the hexes (beyond ring 3), if the owner likes it. For a cell you can settle now: the pulse.

## How these were made

`_tools/` (throwaway): `vite.m1.config.mjs` runs the game's dev server on port 5403 with its own
cache; `dump_world.mjs` starts a new game in headless Chrome and writes `world.json` and each cell's
ground to `_tools/ground/` (not committed: rerun to regenerate); `mock.html` and `mock.js` draw a
look (`?hex=A|B|C|none&world=D|E|F&pulse=0|1`); `capture.mjs` saves the screens to `_tools/raw/`
(not committed) and `timings.json`; `contact.mjs` builds the two comparison pictures and needs
`sharp`.
