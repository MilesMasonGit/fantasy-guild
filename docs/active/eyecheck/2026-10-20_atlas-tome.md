# Eye-check: the Atlas tome (batch 6)

**Open:** http://localhost:5198/ (served by the director from branch
`crunch/atlas-tome` at 7a678567; your folder stays on `main`).
**Save slot:** a New Game in an empty slot (saves here belong to this address).
**First:** QA (top bar) → Atlas → **Grant test maps** (no map items are
authored yet, so this gives you some to play with).

Write `ok` or what to change after each `Verdict:`. The builders could not
watch motion at full speed; the feel of every move is yours to judge.

## Owner, first look (2026-10-20)

"This is a great start." Instead of the camera move, the Atlas pops up from
the bottom over the mat (the glide is kept for the Guild Hall upgrade screen,
tag `atlas-camera-move`, T-194); new 256 px left and right pages; scale to be
picked by eye. Built in 7e0f9a17; the preview now serves it (reload).

## The pop-up and the scale (second look)

1. Click the **Atlas** bubble: the book slides up from below the screen and
   settles over the mat (~0.3 s, a small overshoot); the mat stays bright
   behind it, no table. Close (bubble, Escape, X or a click outside): it
   slides back down. Feel ok?
   Verdict:
2. **QA → Atlas → Book size 2× / 3× / 4×** (default 2×). Open the Atlas at
   each: 2× fits with mat around it; 3× crops the sides on a 1600-wide
   window; 4× matches the wood and terrain pixel size but covers the mat and
   crops on all sides (ribbons then lie on the book's visible top). Which
   one?
   Verdict:

## The book

4. Your new pages; ribbons (Cartography, Regions) on the top edge; a page
   turn between them; your drawn ribbon on the right page is decoration.
   Verdict:
5. Which section should open first? (Regions today.)
   Verdict:
6. The dark standard panels over the parchment: keep, or lighter panels so
   more page shows?
   Verdict:

## Cartography

7. Click maps or **drag** them into slots; drag between slots (swap); drag a
   map off its slot to empty it. The layout preview shows over the Region's
   banner. Reroll, Cancel (slots clear), Settle, then Stay here.
   Verdict:
8. Reroll and Cancel are framed text buttons (Settle is gold). Keep, or draw
   icons later?
   Verdict:

## Regions

9. Settle two or three more (Mountain Map; Volcano Map + Goblin Camp). The
   Regions page: one row per Region on its **area banner**, down the left
   page then the right; the Starter Camp first; the current one reads
   "Here"; others have a gold **Travel**. About 2½ rows per page; keep the
   size, or slimmer rows (day and Token count on hover) so 3 fit?
   Verdict:
10. Banners without a CMS pick follow the biome. Four have no close match:
    volcano → desert monolith, Yellowstone → desert oasis, cherry grove →
    hidden valley, flower meadow → farmland. Ok until you draw better ones?
    Each row shows the middle band of the picture; ok?
    Verdict:
11. The **…** on a row: Rename, Archive (then the Archive (1) button at the
    foot of the right page, Restore), Abandon (asks first; greyed on the
    Starter Camp with the reason on hover). The … is three drawn pixels:
    want a sprite on your art list?
    Verdict:
12. **Travel** to another Region: the Atlas closes, then that Region's banner shows across the mat with its name for a moment
    (click to skip). The top bar's Region name has a slice of the banner
    behind it.
    Verdict:

## In the CMS (on `main`, after this merges)

13. Maps → any Base Map → **Banner**; Starter Camp → **Banner**: pick
    pictures, then Sync on `main`.
