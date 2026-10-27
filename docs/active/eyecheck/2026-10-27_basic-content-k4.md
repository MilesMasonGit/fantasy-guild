# Eye-check 2026-10-27: basic content, the full-game play-through (brief 240 K4)

*A new game on your synced content (`main` at 402b7182), played through the
UI like a player: clicks on the orbs and Tokens, heroes, gear and food dragged
from the Item Bank, flags dragged onto the mat, loot swept up by hovering.
Waiting was skipped by running the game clock faster; no QA speed-up, no
items, levels or maps were granted. **One step needed a shortcut** (check 1,
"Inspect an Old Site"): without it the tutorial cannot go on. Your slot 3 is
not touched; this ran in a separate headless browser.*

To look yourself: start the game from the main folder (`npm run dev`), New
Game in an empty slot, and play. Shots (1920×1080) are in
`docs/active/eyecheck/shots/2026-10-27_k4_*.png`.

## Checks

1. **The Starter Camp and its tutorial** (about 40 minutes to the first maps).
   New game: the camp with the Hall, trees, veins, coast, wheat, berry bush and
   the Goblin Camp; the first quest says to buy Bunk Beds (`1a`). The first
   Hero from the Guild Hall (`1b`); a pickaxe dragged from the Bank onto him;
   his flag dragged onto the mat by the copper veins (`1c`); a Wood Foundation
   from the Shop and its build list (`1d`); a Workbench crafting Charcoal.
   **"Inspect an Old Site" cannot be done**: the camp has no old sites (`1e`);
   I ticked it by hand to go on. "Make a Copper Tool" (`1f`): a Stone
   Foundation, a Furnace smelting Copper Ingots (`1g`), a second Stone
   Foundation as a Copper Smithy, whose tools need Smithing 2 (`1h`), so the
   second Hero made Copper Nails first, then a Copper Pickaxe (`1i`). "Beat a
   Goblin" (`1j`): Shrimp dragged onto the Hero, his flag on the goblins
   (`1k`); the win pays Forest, Mountain and Coast maps (`1l`). Pulling him out
   of the next goblin fight left him stuck at 2/10 HP for the rest of the run
   (`1m`, rough edge 2).
   Shots `1a`-`1m`.
   Verdict: ok / change: ___
2. **A plane-1 Region: the Forest** ("Fern Bend"). The Forest Map on the
   Cartography table and its preview (`2a`); Settle, then "Travel there"
   (`2b`); the arrival: oaks, berry bushes, a copper chest, a wolf den and the
   Alpha's den (`2c`). Gathering, then a Recruit against a wolf (`2d`): won with
   7 Shrimp, 3/10 HP left.
   Shots `2a`-`2d`.
   Verdict: ok / change: ___
3. **A boss's first kill: the Wolf Alpha** (why this one: the Forest is the
   first map a player settles, and the Alpha is the lowest-level boss on the
   three tutorial maps that does not poison). Two Recruits with only Shrimp
   lost to it in under half a minute each (`3a`), each loss costing a quarter
   of the Shrimp stack, and one a pickaxe. In copper helmet and chestplate a
   Recruit won in about 2 minutes with 8 Shrimp (`3b`); the kill dropped the
   **Yellowstone Map** for certain (first kill) (`3c`).
   Shots `3a`-`3c`.
   Verdict: ok / change: ___
4. **The first plane-2 Region: Yellowstone** ("Honey Reach"). The map's
   preview (`4a`); the arrival: firs, grapevines, stone, ponds, the lizards'
   rocks, the Basking Stone and an iron chest (`4b`). Fir trees ask for
   Forestry 15 (`4c`); a level-1 Hero planted among them says "No work in
   range" (`4d`). An armoured Recruit beats Sulphur Lizards one after another
   (`4e`); the iron chest gives iron ore, fir wood, a Lizard Scale and a
   Bountiful modifier (`4f`); the Big Lizard boss beats the same Recruit (`4g`).
   Shots `4a`-`4g`.
   Verdict: ok / change: ___

## Rough edges the play-through noticed (for you to rank; none fixed yet)

1. **The tutorial stops at "Inspect an Old Site"**: the Starter Camp has no old
   sites (no Token in the content is an endgame site, and the camp layout has
   none of the 25 ruins the concept mentions), so a new player can never
   finish the tutorial, never gets the copper-tool and goblin steps, and never
   receives the first maps. It blocks the whole path (shot `1e`). Either the
   ruins go back into the Starter Camp, or the step comes out of the tutorial.
2. **A Hero pulled out of a fight stays "in a fight" for ever**: no healing and
   no eating out of fights. Hammer won two goblins, chained into a third, was
   re-planted away at 2 HP, and stayed at 2/10 for the next 2 h 40 min of play,
   across travel to two Regions (shot `1m`). Only a win, a knock-out or
   recovering from wounds clears it; a retreat never does (checked in the
   code). Likely also kept in the save (not tested).
3. **Recruits cannot hold weapons, and no one can leave Recruit in this
   stretch**: the Fighter needs Mining 10 and Smithing 10; after 3 h 20 min
   the best Hero had Mining 11 and Smithing 1, the smith Smithing 7. So every
   fight in plane 1 and into plane 2 is a Recruit punching for 1, and the 25
   Copper Swords made are unusable. Copper armour is what wins fights.
4. **The Wolf Alpha punishes trying it unarmoured hard**: two losses in under
   30 s each cost 48 then 36 Shrimp and a pickaxe; nothing hints that armour
   is the answer (brief 220: no warning by design; still, worth your look).
5. **"Make a Copper Tool" says the tool is made at the Furnace**; it is made at
   a Copper Smithy (5 ingots and 5 stone on a Stone Foundation), and a new
   Hero must first raise Smithing to 2 (about 5 minutes of Copper Nails). The
   text offers "a Pickaxe, a Woodaxe or a Sickle", but no recipe makes a
   Copper Sickle, and the Woodaxe needs Smithing 3. The player starts with a
   copper pickaxe, woodaxe and sickle already.
6. **Pace is slower than the targets**: first maps at 40 min (target ~30); the
   main skill at 10 after 2 h 50 min (target ~15 after 2 h); the first boss
   kill at 3 h 11 min. My play knew where to go; a first-time player takes
   longer.
7. **Plane 2 is mostly closed to a party fresh off plane 1**: fir trees,
   grapevines (and iron veins) need level 15; only stone was workable in
   Yellowstone. Fights there work in armour; that is all there is to do at
   first.
8. **"New recipes" and "New hero" banners stay until clicked**, so after an
   hour three of them sit across the top of the mat in every shot. By design
   ("stays until clicked"), but they cover the Region's top edge.
9. The Coast's rod catches (tropical fish, salmon, swordfish) go into no
   recipe yet; only the Trap's raw shrimp cook into food (content still being
   written, noted only because a player fishes with the rod first).
10. Dragging a tool off a Hero's sheet onto the mat or the Bank orb does
    nothing; right-click takes it off (low confidence: I did not try dropping
    it into the open Bank).
11. The Yellowstone Region was named "Honey Reach" (a random name; reads oddly
    for sulphur springs).

Nothing unreachable besides rough edge 1. No errors in the browser console
during the whole run; the only console line is the content check's standing
warning (63 broken references in old Tokens such as the Forge Altar).

## Pace (game time from New Game)

The game clock runs at 1 game second per real second at normal speed; it was
read from the save (`time.gameTimeMs`) at each step. My clicking time also ran
on the clock, so these are the minutes a player at 1× would spend making the
same choices.

| Stage | Game time | Notes |
|---|---|---|
| 1 Starter Camp to the first maps | 0 to 40 min | Recruit 1 min, first gathering 3 min, Workbench 7 min, Furnace 21 min, Copper Smithy 29 min, Smithing 2 at 34.5 min, pickaxe 36 min, goblin won 39.5 min |
| 2 Forest settled and travelled | 50 to 51 min | then back to camp to build a Cooking Pot, a Fighter's Academy, food and armour until ~133 min; first wolf fight 133.6 to 135.1 min |
| 3 Wolf Alpha first kill | 191 min | lost at 137 and 139 min; won after copper armour |
| 4 Yellowstone | 192 to 204 min | 3 lizard wins, the iron chest, a Big Lizard loss |

## Fights

All Heroes were Recruits (10 HP max, punch for 1, no weapons allowed). Food:
Shrimp (heals 5), eaten below 25 % HP.

| Fight | Hero and gear | Food eaten | Result | HP after | Length |
|---|---|---|---|---|---|
| Goblin (L5) | Hammer, no armour | 5 | win | 4/10 | 1.5 min |
| Goblin (L5) | Hammer, no armour | 7 | win | 6/10 | 1.6 min |
| Wolf (L4, swift) | Maple, no armour | 7 | win | 3/10 | 1.5 min |
| Wolf Alpha (L10 boss, brute) | Maple, no armour | 0 | **loss**, lost 48 Shrimp and her pickaxe | 0 | ~20 s |
| Wolf Alpha | Nova, no armour | ~1 | **loss**, lost 36 Shrimp | 0 | ~25 s (boss at 26/30) |
| Wolf Alpha | Maple, copper helmet and chestplate | 8 | **win**, Yellowstone Map | 4/10 | ~2 min |
| Sulphur Lizard (L16, armoured) ×3 | Maple, copper armour | 5, 7, 7 | 3 wins | 4-6/10 | ~2.4 min each |
| Big Lizard (L24 boss) | Nova, copper armour | ~12 | **loss** (boss at 27/44), lost 17 Shrimp | 0 | ~1.4 min |

The three poison bosses (Greater Slime, Queen Bee, Toxic Frog) were not met on
this route: they live on the Meadow, Cherry Grove and Bog maps, none of which
the tutorial gives, so a player meets them later.

Owner CMS steps: none.
