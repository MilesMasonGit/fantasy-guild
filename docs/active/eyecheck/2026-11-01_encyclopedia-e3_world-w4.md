# Eye-check 2026-11-01: the encyclopedia as a searchable chart (300 E3) and building nodes by terrain (330 W4)

**Branch:** `look/2026-11-01` (holds both). The director switches your folder
to it and starts the game at http://localhost:5173 before telling you; it
switches back to `main` after the look. ⚠️ **Don't Sync the CMS** on this
branch.

**Save slot:** any save with a few items collected (checks 1–7); a **New Game in
an empty slot** for checks 8–11 (only new games have a world to settle).

Shots from the builders: the session scratchpad `shots/` (`e3_01`–`e3_11`,
`01`–`03`). Both features passed the gate (tests, cycles, build) and the bench
gives the same results.

## Part 1: the encyclopedia

1. **Opening page.** Click the book bubble (left column). You see the book with
   a search box on the left page, and on the right page "Recently viewed"
   (empty at first) and "Recently collected" (your last 8 new items, newest
   first, with ticks).
   Verdict: ok / change: ___
2. **Search.** Type `iron`. Rows for Iron Ore, Iron Ingot, the Iron Smithy and
   more, grouped by kind.
   Verdict: ok / change: ___
3. **The chart.** Click **Iron Ingot**. It sits in the middle; Iron Ore (×6) and
   Coal (×2) flow in from the left through a "Furnace" chip with the skill and
   level; other ways to get it stack below with "or" between them (dropped by
   an enemy, found in a chest). Uses go out to the right (the 8 first, then
   "N more"). Have/need is red where you're short; a level no hero has is red.
   Verdict: ok / change: ___
4. **Walk the chart.** Click **Iron Ore**: it grows to the left (its vein, the
   enemies that drop it) and becomes the focus; the view glides to keep it in
   sight. Drag the page to look around. Press **Back to start**.
   Verdict: ok / change: ___
5. **The panel.** The small panel in the right page's top corner describes the
   focused entry. Click the **Furnace** chip: the panel shows that recipe.
   **Chart from here** starts a new chart from the focused entry. **Contents**
   returns to the opening page, where "Recently viewed" now lists what you
   opened.
   Verdict: ok / change: ___
6. **From a Token.** Close the book, click a Coal Vein on the mat, press the
   card's book button: the encyclopedia opens straight on its chart.
   Verdict: ok / change: ___
7. **The Bank.** A plain click on a Bank tile opens nothing now (as you asked;
   it returns with the future item panel).
   Verdict: ok / change: ___

Builder's calls to judge while looking: things are boxes, "where it happens" is
a chip on the link (station name, "Gathered", "Dropped 40%", "Found"); the most
usual way first (repeatable ways before drops before one-off finds); amounts are
per step, have/need counts back to one of the entry you searched; long lists
show 8 then "N more"; dark boxes with a bronze line, ink arrows. "Recently
viewed" is kept until you reload (question a below).

## Part 2: building nodes by terrain

Set-up: New Game → QA panel → **Atlas** section → **Highland** (settles a
ring-1 Highland place) → **Beat this mat's arrival** → **Lay the building
test**. This puts Wood Foundations on the mat's Stone, at its shore and on
plain ground, a Test Leyline, and a QA Builder hero if you have none. The test
builds (Test Mine, Test Quarry, Clay Pit, a crystal) are stand-ins for the
real content.

8. **The recipe list shows the ground.** Click a Foundation: the Test Mine and
   Test Quarry rows carry a "STONE" bar, the Clay Pit a "SHORE" bar; red where
   this Foundation doesn't stand on it.
   Verdict: ok / change: ___
9. **Wrong ground holds.** On a Foundation that is **not** on Stone, choose the
   Test Mine. It gets a red mark; hover it: "Needs stone." Nobody works it and
   nothing is spent.
   Verdict: ok / change: ___
10. **Moving fixes it.** Drag that Foundation onto plain rock: it flies back
    with "Needs stone.". Drag it onto the Stone patch: it lands, a hero builds
    the mine.
    Verdict: ok / change: ___
11. **Near and anywhere.** A planted Forest builds on any dry ground. The
    crystal holds with "Needs a Test Leyline nearby." until you drag the
    Leyline beside it.
    Verdict: ok / change: ___

## Questions (answer with the verdicts)

a. **Recently viewed after a reload?** (A, rec.) forgotten on reload, as built;
   (B) remembered in the browser for every slot; (C) kept in each save.
b. **The Starter Camp and mines.** Once the content follows the new rule (mines
   on Stone with a prospecting map), the Starter Camp (all meadow) can't build
   a Copper or Coal Mine and can't move its built-in one. (A, rec.) the Starter
   Camp gets a small patch of Stone, and its first mine recipe needs no map;
   (B) the Starter Camp is exempt from the mine rules; (C) mines start on
   ring 1, the Starter Camp keeps only its built-in one. The content pack waits
   for this answer and for the world pack (W6) to give the maps a source.
c. **Built nodes run slower.** The machinery is in ("Built copies slower by %"
   on a Token in the CMS), but no Token has a number yet. (A, rec.) the world
   pack (W6) proposes the numbers through the ledger; (B) you set them in the
   CMS yourself.

## Owner's CMS steps after the merge

None yet: the mines pack comes with question b's answer.
