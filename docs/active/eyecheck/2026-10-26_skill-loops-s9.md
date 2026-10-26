# Eye-check 2026-10-26: skill loops, the play-through (brief 230 S9)

*Everything is on `main` with your synced content (skill loops 47d19bec, basic
content packs 1 and 2). You can look in two ways: the screenshots below
(1920×1080, taken from the real content), or the running game: start the game
from the main folder (`npm run dev`), New Game in an empty slot, and use the QA
panel's skill-loop sections (Forestry, Orchards, Mining, Farming, Fishing,
Stations, Work potions and drinks) to lay out each scene. Your slot 3 is not
touched.*

Shots are in `docs/active/eyecheck/shots/2026-10-26_s9_*.png`.

## Checks

1. **Forestry**: a felled Oak becomes a Stump (card: clock, "Boosted by Oak
   Forest −25 % grow"; hover: "Grows into Oak Sapling … for 1 Oak Seedling");
   the forester waits quietly ("Waiting for Oak Sapling"); a Stump with no
   Forest shows the yellow mark; the Sapling grows back into an Oak.
   Shots `1a`–`1d`.
   Verdict: ok / change: ___
2. **Orchards**: an Apple Tree picked Bare refills with its Orchard (2:05, −25 %);
   a Bare tree with no Orchard shows "Needs an Apple Orchard nearby to refill".
   Shots `2a`–`2c`.
   Verdict: ok / change: ___
3. **Mining**: a resting vein drawn as the empty rock (refill 1:00); a Mine's
   doubled-ore pop; the vein card's "Boosted by" Mine and Minecart. Shots `3a`–`3c`.
   Verdict: ok / change: ___
4. **Farming**: the Field's crop picker; growing (48:00 with a Well); ripe with
   its load (12 = 10 + the Composter's 2); harvested and sown again; a stopped
   Herb Garden ("Needs Lavender Seed to sow"); Farmland's build list.
   Shots `4a`–`4i`.
   Verdict: ok / change: ___
5. **Fishing**: a Lake with a Dock; a hero fishing with a rod and bait counting
   down; bait running out (fishing plain); the Trap at the Coast. Shots `5a`–`5e`.
   Verdict: ok / change: ___
6. **Stations**: the Furnace offers only smelting, the Copper Smithy only
   smithing, the Brewery only drinks; a Furnace out of coal says "Needs Coal".
   Shots `6a`–`6d`.
   Verdict: ok / change: ___
7. **Work potions and drinks**: the Birdwatcher and a drink's "used" bubbles at a
   cycle start; a Bird Nest searched at the Workbench (seeds out). Shots `7a`–`7c`.
   Verdict: ok / change: ___
8. **Seeing support effects**: holding a Well over two Fields lights both with
   "−20 % grow". Shot `8`.
   Verdict: ok / change: ___
9. **An old save** (a test stand-in with an old Wheat Sprout, Ripe Wheat, a Shrimp
   Coast and a Copper Anvil) loads cleanly; old Tokens finish and leave or stand
   inert. Shots `9a`–`9d`.
   Verdict: ok / change: ___

## Rough edges the play-through noticed (for you to rank; none fixed yet)

1. Loot lying on the mat buries what's being worked (ore over the Mine and
   veins, logs and seedlings over the Forest, apples over the tree, wheat over
   the Field).
2. A Mine's spawned veins land in one overlapping heap (the Starter Camp's Mines
   no longer spawn, but maps' still might).
3. A hero's flag standing on a Token hides its yellow problem mark (the Bare tree
   with no Orchard, the Furnace out of coal).
4. A Field with no crop chosen says "Nothing chosen to build".
5. Cards show the base work time even with a speed-up (a vein "3s" with a
   Minecart, the Lake "8s" with a Dock).
6. Stand-in art look-alikes: Farmland, an empty Field and an empty Herb Garden
   match; the Composter looks like Oak Wood; a Bare Apple Tree looks like an Oak.
7. The bait countdown shows only in the hero panel, not on the mat or the card.
8. A Stump with no Forest shows a "2:30" clock that never moves.
9. The Coast card cuts off "Fishing Rod or Trap" and "Tropical Fish".
10. The crop picker doesn't show the grow time or the harvest count; the card
    line "⏲ 1 Wheat Seed" is unclear.
11. An old save's Copper Anvil says "Drives nothing yet", which reads like a bug.
12. A "NEW! +0 Worm Bait" toast.
13. Content: the Copper Woodaxe is made from ore + coal while the other tools use
    ingots; the nest search shows "10–11 Wheat Seed" (Recalculate's tuning);
    a smith's flag says "Nothing to do" rather than naming the missing coal.
14. While dragging, the reach circle may sit a little off the Token (low confidence).

Owner CMS steps: none.
