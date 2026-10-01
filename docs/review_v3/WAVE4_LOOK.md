# Wave 4 — the eye-check before it is kept

*Branch `draw/wave4` (not merged — owner ruling Z §11 Q4: this batch waits for your look).
Written 2026-10-01 by the Wave 4 engineer. Pictures are in [`wave4_look/`](wave4_look/).*

## In plain language

Wave 4 is ten changes to **how** the playmat is drawn, none to **what** the game does. The aim:
the busy board draws more frames per second, so walking, rings and sparkles look smoother. The
game's rules are untouched — the engine benchmark reports **exactly the same work** as before.

On the realistic busy board (about 100 Tokens, 8 heroes), measured on this PC in a hidden test
browser, back to back with today's `main`:

| | today (`main`) | Wave 4 branch |
|---|---|---|
| Frames drawn per second | ~121 | **~148** |
| Frames that fit the 165 Hz budget (6.06 ms) | 53 % | **83 %** |
| Graphics card busy | 94 % | **75 %** |
| React redraws of the mat a second | ~41 | **~8** |
| React redraws of the hero dock a second | ~34 | **~1** |

On the 300-Token torture board: ~85 → ~112 frames a second, and 1 % → 20 % of frames within
budget (still far from the target; that board is a separate decision, R6-Q3).

**Everything should look the same — with one thing for you to judge (item 1 below).**

## What to look at (R6 §1, extended to this wave)

1. **Heroes, walking goblins and speech bubbles while they walk.** They now glide by a
   different method (a "transform" instead of moving the box). Standing still they look
   **identical** (picture pair `ab_standing_hero_*`: same hero, same moment, both ways — the only
   difference is the green glow's breathing). **While gliding, the sprite and its bubble can look
   a touch softer**: the graphics card draws them between whole pixels for the tenth of a second
   each step lasts. Compare `main_hero_walking_*.png` (crisp) with `branch_hero_walking_*.png`
   (slightly soft), both enlarged 4× mid-step. At normal size and full speed it may be
   invisible — that is what you are judging. *Question W4-1 below.*
2. **The progress ring** still sweeps smoothly. It now redraws in 400 small steps per cycle
   instead of on every screen refresh (each step is under a pixel). `*_ring_*.png`.
3. **Heroes swing on the same beat as the Token they hit**, and **a limping hero (defeated,
   walking home) still walks slowly.** The animation frames are now drawn without React, from
   the same clock. Tests pin the exact frame order for every case.
4. **Loot flying to the Hall: the first sparkle after a quiet spell appears at once.**
   *Small, intended change:* a big "Collect All" now flies **at most 12 sparkles, 60 ms apart**
   (your ruling R6-Q4 = A — the old design, restored). All the loot is still collected.
5. **The -1 / +50 charge numbers** rise and fade exactly as before (same 3-second curve, now run
   by the browser instead of a script).
6. **Speech bubbles** sit over the head and follow the walk. `*_bubble.png`.
7. **On a very busy board (300 Tokens)**: a Token a hero is working, and the Token under your
   pointer, are drawn **in front** again. Before, past ~225 things they tied with ~95 others and
   could be hidden (a real bug, CR3-354). Boards under ~225 things are unchanged.

## How to try it yourself

1. **Ask the director to open the Wave 4 branch** (`draw/wave4`) in the game folder.
2. In a terminal in the game folder: **`npm run dev`**. It prints an address, usually
   `http://localhost:5173/`.
3. **Your own game:** open that address and load your save as usual. Watch heroes walk between
   jobs, the rings under worked Tokens, and collect a pile of loot after a quiet moment.
   (Nothing about your save changes — this wave touches no rules.)
4. **The busy board** (does not touch your saves; it lives only in that tab):
   `http://localhost:5173/?stress=realistic` — 8 heroes, ~100 Tokens, lots of walking.
   Leave it 20 seconds and watch the heroes and bubbles.
5. **The torture board:** `http://localhost:5173/?stress=torture`. Hover a Token a hero is
   working: it should come to the front.
6. To compare with today's game, ask the director to switch back to `main` and repeat.
   Close the tab (or reload without `?stress=`) to get your own game back.

## Decision for you

**W4-1 — Walkers may look slightly soft while gliding.**
- **(A) Recommended: keep it if you can't see it at normal size.** It is where most of the
  frame-rate gain on walking comes from (R6: ~99 → ~124 fps on its own).
- (B) Keep the speed but make them glide in whole-pixel steps (crisp, like the Token landing
  bounce): a small follow-up change, measured again before it is kept.
- (C) Put walkers back on the old method. Crisp, but gives back that part of the gain.

## What changed, ticket by ticket

| Ticket | What | Visible? |
|---|---|---|
| CR3-301 | Hero and enemy animation frames drawn without React | No (same frames, same clock) |
| CR3-011 | One shared frame clock for all the progress rings | No |
| CR3-351 | Rings redraw only when they move a visible step | No (eye-check 2) |
| CR3-007 | Heroes, bubbles, enemy Tokens glide by transform | **Eye-check 1** |
| CR3-458 | Tutorial beacon stops redrawing itself when its target is still | No |
| CR3-303 | Heroes, flags, loot, rings, alerts only redraw when they change | No |
| CR3-353 | Speech bubbles measured only when their words change | No |
| CR3-357 | Charge numbers animated by the browser, not a script | No |
| CR3-354 | Worked and hovered Tokens keep their place in front on a 300-Token board | Fixes a bug |
| CR3-352 | A big collection flies at most 12 sparkles, 60 ms apart | Intended (your ruling) |

Not in this wave: the shadows and outlines (Wave 5, built on top of this branch).

## The measurements in full (for the director)

Headless Chrome 153 over the DevTools protocol, dev build, this PC's GPU (RTX 3060 via
ANGLE/D3D11), 1600×900, DPR 1. `main` (`1616891`, its own worktree and Vite cache) and the
branch served side by side; each scenario run main, branch, branch, main (20 s settle, 30 s
`__perf` window, 5 s trace). Machine load 20–42 % before each run (the owner's Firefox was busy).
**Not representative; only the comparison counts.** All runs `representative: true`,
React counting armed.

**S2 realistic** (102–105 Tokens, 8 heroes; 2026-10-01 02:36–02:41):

| | fps (r1 / r2) | frame work p50 / p99 ms | ≤ 6.06 ms | GPU busy | MatBoard own renders/s | mat subtree commits/s | HeroDock commits/s | over 16.7 ms frames / 30 s |
|---|---|---|---|---|---|---|---|---|
| main | 120.7 (116.2 / 125.2) | 5.91 / 12.9 | 53.1 % | 94 % | 3.8 | 41.4 | 33.6 | 311 / 150 |
| branch | **148.4** (149.0 / 147.8) | **3.86 / 9.8** | **82.8 %** | **75 %** | 3.3 | **7.8** | **0.7** | **30 / 41** |

**S3 torture** (310+ Tokens; final branch `7a53e77`, 02:48–02:53):

| | fps (r1 / r2) | frame work p50 / p99 ms | ≤ 6.06 ms | GPU busy | MatBoard own renders/s | mat subtree commits/s | HeroDock commits/s | over 16.7 ms frames / 30 s | LoAF / 30 s |
|---|---|---|---|---|---|---|---|---|---|
| main | 85.0 (82.5 / 87.5) | 10.30 / 33.7 | 0.8 % | 89 % | 8.6 | 36.4 | 26.0 | 545 / 483 | 5.5 |
| branch | **111.8** (109.7 / 113.9) | **8.00 / 27.3** | **19.9 %** | **76 %** | 9.7 | **13.4** | **1.1** | **258 / 228** | 6.5 |

An earlier S3 pair (before the CR3-354 follow-up commit) showed the branch's longest React commit
at 96 ms against main's 75 ms: the first version of the z fix moved its clamp whenever a hero
started work, redrawing ~90 Tokens. Fixed with a fixed-size reserve (`7a53e77`, with a test);
re-measured above (longest commit 76–78 ms vs main 80–82 ms).

How the pictures were made: `?stress=realistic`, 10 s settle, crops enlarged with
nearest-neighbour so pixels stay pixels. The two `ab_standing_hero_*` pictures are the same
hero on the same page at the same moment (sprite clock frozen), drawn by translate and then by
left/top. Static parts of the board captured mid-walk are byte-identical between main and the
branch.
