# Ring stars in the running game (brief 380 M4, 2026-11-06)

Dev server from the `m4` worktree on its own port and Vite cache (`vite.m4.config.mjs`), headless
Chrome through the bench's CDP driver (`play.mjs`, read only), a fresh profile each run. The steps
and what was read are in `play_main.txt` and `play_sky.txt`.

1. A new game; QA panel, Atlas: **Tutorial: jump to the world map step**, **Ring stars in the sky**,
   **Meet the frontier's prices**. The tutorial's step opens the world map with the cartographer.
2. `02_ring1_ready.png`: a ring-1 place, no lock line, Settle live. Settled: the tutorial's first
   settle is unaffected.
3. `03_ring2_locked_tip.png`: a ring-2 cell beside it, its price met, still darkened; the hover
   says "Light the Guild Hall's Charted Roads star to settle here".
4. `04_ring2_locked_panel.png`: its panel, Settle greyed with the same words; `settleCell` refused
   ("Light its Guild Hall star first").
5. `05_hall_sky_full.png`, `06_hall_ring_star_sheet.png`: the Hall; Charted Roads left of the Hall
   above Bank Tabs, buyable; its sheet ("The guild may settle the lands past the next border of
   the world map."), price 1,700 Cherry. Every star, title and constellation name in the sky
   measured from the page: none touch (105 boxes).
6. `07_hall_ring_star_bought.png`: bought (gold, its line to the Hall lit).
7. `08_ring2_open_panel.png`: back on the map the ring-2 cells pulse gold; Settle settled it.
8. `09_hall_compass.png` (taken again after two stars were renamed): the sky dragged to the
   Compass, Charted Roads lit and gold, its line to the Hall bright: Charted Roads, Far Horizons,
   Wild Lands, Untamed Reaches, Edge of the World in a row, "The Compass" under them; measured
   again, no star, title or name in the sky touches another (105 boxes). The closest pair to the
   eye is the Edge of the World and Untamed Reaches titles, about 25 px apart.

Not looked at: the screens on a narrow window; reduced motion (nothing here moves).
