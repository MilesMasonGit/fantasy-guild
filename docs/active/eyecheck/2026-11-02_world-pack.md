# Eye-check 2026-11-02: the first world pack (330 W6) and its CMS review

**Branch for Part 1:** `feat/world-w6`. Tell the director when you're ready;
the director switches your folder to it, restarts the game at
http://localhost:5173, and switches back to `main` after. ⚠️ **Don't Sync the
CMS** on this branch.

Both checks passed the gate (7,219 tests, cycles, game and CMS builds; the bench
gives the same results). The engineer also checked 100 and 1,000 generated
worlds: every one gives every enemy and source a place in the ring of its tier.

## Part 1: in the game (on the branch)

1. **The Starter Camp's Stone.** New Game in an empty slot. A small grey Stone
   patch lies under the Copper Mine (screenshot: scratchpad
   `w6_game_starter_camp_stone_zoom.png`). Drag the Copper Mine off it: refused,
   "Needs stone."; back onto it: accepted.
   Verdict: ok / change: ___
2. **Guaranteed camps.** QA panel → Atlas → settle a ring-1 place (any kit):
   once its arrival is beaten, its guaranteed camps are on the mat. (Until the
   pack is synced the game uses the placeholder world, so the camps you see here
   are the placeholder's; the pack's own camps show in the CMS, Part 2.)
   Verdict: ok / change: ___

## Part 2: in the CMS (on `main`, after the director merges Part 1)

The director merges the world pack's code and the T-282 fix (cards named a Token
by its code id), then starts the CMS on `main`. Then:

3. **Changes to review → `2026-11-01-w6-first-world`** (96 entries). The World
   tables row lists, per wedge and ring, the origins and the guaranteed camps.
   The other rows: 18 creature banners (rare drops; a banner + 5 Oak Wood builds
   that camp on a Wood Foundation), the Coal Prospecting Map (Goblins 3 %, Goblin
   Chief 25 %; the Copper Mine stays map-free at the Starter Camp), Copper Mine,
   Coal Mine and Quarry on Stone only, three planted forests (Birch, Maple,
   Mahogany) from seedlings, three late pickaxes, the eight unworkable fruit
   trees given Farming 1, and 17 unfinished entries Parked.
   ⚠️ Parking the Shrimp Market and the Wizard Academy also clears their two
   existing Block findings: reject those two rows if you'd rather fix or delete
   them.
   Verdict: accept all / reject rows: ___
4. **Changes to review → `2026-10-30-hall-first-stars`** (the Guild Hall's first
   star list, 53 entries; re-checked last night against today's content: PASS;
   seven ranks take over a day to pay for themselves and show red).
   Verdict: accept all / reject rows: ___
5. **Finish review, then Sync to Game once.** The Sync guard lists "world map
   placements added" and also "Poison removed, Venom added" (the combat rename
   waiting since 30 October); both expected. Then tell the director, who checks
   every file's ids, fixes the tests that pinned the old content, and pushes.

Calls the engineer took (content details): ring 1 holds the everyday creatures'
camps (11), ring 2 the tier-2 ones (6); banners drop at 0.5 % (everyday) and
2 % (bosses); Wild Lavender is the only herb, so Alchemy can start in ring 1;
Arcane borrows the Wishing Well and the Quartz Deposit until it has content.
