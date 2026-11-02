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
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
2. **Search.** Type `iron`. Rows for Iron Ore, Iron Ingot, the Iron Smithy and
   more, grouped by kind.
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
3. **The chart.** Click **Iron Ingot**. It sits in the middle; Iron Ore (×6) and
   Coal (×2) flow in from the left through a "Furnace" chip with the skill and
   level; other ways to get it stack below with "or" between them (dropped by
   an enemy, found in a chest). Uses go out to the right (the 8 first, then
   "N more"). Have/need is red where you're short; a level no hero has is red.
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
4. **Walk the chart.** Click **Iron Ore**: it grows to the left (its vein, the
   enemies that drop it) and becomes the focus; the view glides to keep it in
   sight. Drag the page to look around. Press **Back to start**.
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
5. **The panel.** The small panel in the right page's top corner describes the
   focused entry. Click the **Furnace** chip: the panel shows that recipe.
   **Chart from here** starts a new chart from the focused entry. **Contents**
   returns to the opening page, where "Recently viewed" now lists what you
   opened.
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
6. **From a Token.** Close the book, click a Coal Vein on the mat, press the
   card's book button: the encyclopedia opens straight on its chart.
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)
7. **The Bank.** A plain click on a Bank tile opens nothing now (as you asked;
   it returns with the future item panel).
   Verdict: **change** (owner 2026-11-01: see the notes after check 7)

Builder's calls to judge while looking: things are boxes, "where it happens" is
a chip on the link (station name, "Gathered", "Dropped 40%", "Found"); the most
usual way first (repeatable ways before drops before one-off finds); amounts are
per step, have/need counts back to one of the entry you searched; long lists
show 8 then "N more"; dark boxes with a bronze line, ink arrows. "Recently
viewed" is kept until you reload (question a below).

**Owner's verdict on Part 1 (2026-11-01): much closer; change.** The rework goes
back to the builder with these points:

1. **No separate box for the method.** The link chips ("Furnace +1",
   "Dropped 60%", "Gathered") go; their information lives on the entry itself.
2. **Crafted items follow the recipe, not the station.** One recipe made at
   several stations (Shrimp at a Cooking Pot and a Kitchen) is one way, not one
   per station: what matters is the hero needs Cooking 1.
3. **Requirements sit above the entry** (skill and level). Combat skills read
   **"Combat"**.
4. **Stem counts.** Each side of an entry shows how many links it has that are
   not on screen: an Iron Pickaxe that also needs Oak Wood shows an arrow and
   "1" on its left; a collapsed entry shows an arrow and the number of its
   uses on its right.
5. **Hide the inspection panel** for now: everything needed goes on the entry.
6. **No "Recently collected" list:** the item toasts do that job. Clicking a
   toast while the encyclopedia is open jumps to that entry.
7. **Drop rates on the entry** (the percentage).
8. **Clicking an open entry collapses it.**

9. **No "Chart from here":** clicking an entry already charts it.
10. **Stations are their own kind of entry:** a recipe's inputs include one
    station entry by type ("Cooking Station"); clicking it shows every station
    of that type.
11. **An inspection icon on each entry:** hover shows extra info, such as
    current inventory and lifetime totals (collected, built, kills).

Owner's answers to the director's interview (2026-11-01): lifetime totals are
**counted from now on** (saved; existing saves start at zero); station entries
group **by skill** ("Cooking Station"); clicking an open entry **collapses it
and keeps it focused**; a toast click jumps **only while the book is open**;
stem counts show **only what's hidden, as "+N"**; an enemy's line reads
**"Combat · Lv 12"**; recently viewed is **forgotten on reload** (question a
answered: A).

Verdicts 1–7: change (above). Re-look after the rework.

## Part 1b: the encyclopedia, second look (after the rework)

Same save as Part 1. The game on the branch already has the rework (reload the
page if it was open). Shots: the scratchpad `shots/e3b_01`–`e3b_10`.

R1. **Iron Ingot.** Search `iron`, open Iron Ingot. On the left, one way for the
    recipe: a **Smithing Station** box beside Iron Ore (×6) and Coal (×2), no
    method boxes. "Smithing 15" sits above Iron Ingot (red if no hero has it);
    hover it: "Made at Furnace, Iron Furnace". Below, the Fire Elemental Chief
    shows **"Combat · Lv 25"** above and **60%** on its box; the Iron Chest 50%.
    Verdict: superseded by the next round
R2. **Stem counts.** "+N" in ink on a box's side when links that way are not on
    screen (Iron Ingot shows "+6" on its right; click it to show all its uses).
    Verdict: superseded by the next round
R3. **Grow and fold.** Click Iron Ore: it grows (its vein, the enemies, the
    chest). Click it again: it folds away and stays selected; again: it grows.
    Verdict: superseded by the next round
R4. **Stations.** Click the Smithing Station box: it grows to every smithing
    station (Copper Smithy, Furnace, Iron Furnace, Iron Smithy). Search
    `shrimp`: one cooking way, "Cooking 1" above.
    Verdict: superseded by the next round
R5. **Inspect mark.** Hover the small magnifier on a box: what it is, Have N,
    and this run's totals (items collected; Tokens built, counted from now on;
    enemies beaten). The side panel is gone.
    Verdict: superseded by the next round
R6. **Toasts.** With the book open, collect something (or wait for a toast):
    click its toast at the right, the book turns to that item. With the book
    closed, a toast click pins as before. The opening page shows the search and
    "Recently viewed" only.
    Verdict: superseded by the next round

Builder's calls to judge while looking: **the book now lies over the mat only**,
so the top bar and the hero dock stay visible above and below it (needed so the
toasts sit on top and can be clicked); boxes are a little wider so long names
fit on two lines; folding a box also forgets what was open under it; a way with
no box (Opening Bank, Starter Camp) shows its words in ink; the magnifier is a
code-drawn stand-in (on your art list).

d. **The "+N" on a box's far side** (e.g. an Iron Pickaxe's other ingredients,
   shown while you chart Iron Ingot): (A, rec.) it only counts; search the item
   to see the rest; (B) clicking it starts a new chart from that box (the "Chart
   from here" you dropped, in another form).

**Owner's verdict on Part 1b (2026-11-01): another step in the right direction;
change.** A display plan comes first, focused on player utility, with mock-ups
for the owner to choose from (director dispatched a spike):
- Which entries are worth showing: e.g. should in-between Tokens such as
  saplings appear in a chain?
- The skill requirement over the entry: perhaps only the skill icon and number,
  over the line that connects two entries.
- **Text legibility:** the "+N" and the skill text are hard to read (dark text
  outlined in black on the parchment) and maybe too small: new font size and
  style.

**Owner's display choices (2026-11-01, from the spike's plan and mock-ups,
`docs/active/research/encyclopedia_display/` on `spike/encyclopedia-display`):**
1. Entries: **fold growing stages** (saplings, sprouts, stumps become a grow or
   regrow mark with its time on the line); a box for anything the player acts on.
2. Stations: **only the right stations** (one station: its own box; several: a
   "Smithing Station" box opening to just those; building recipes read
   "Foundation").
3. Requirement: **skill icon and number on the line** into each step, red when
   no hero has it; hover names the skill and stations.
4. Text: **dark ink, body size (16 px bold), no outline**; a deeper red.
5. Magnifier: **dropped**; resting on the box shows the card.
6. Box content: **just the need number** (director's reading: how many are
   needed, e.g. "6", no have/need pair; have moves to the hover card); drop the
   lone "0" and the kind word; keep drop %, "first kill", the tick, "+N"; the
   Opening Bank, Starter Camp and Tutorial ways leave the chart, Shop stays.
7. Far-side "+N": **opens that side in place** (question d answered: B).

## Part 1c: the encyclopedia, third look (your display choices built)

Same save (reload the page if it was open). Shots: scratchpad `shots/e3c_01`–`e3c_14`.

T1. **Iron Ingot.** No magnifier, no kind words; each way has its skill icon
    and number on its line (⚒ 15, the sword and 25 for the fight, 1 for the
    chest); boxes show just the need ("×6", red when short); darker, larger ink
    for the numbers and "+N". Rest the pointer on a box: its card (have, this
    run's totals).
    Verdict: superseded by the next round
T2. **Exact stations.** The Smithing Station box opens to the Furnace and the
    Iron Furnace only. Search `iron furnace`: it is built on a Stone Foundation.
    Verdict: superseded by the next round
T3. **Growing stages folded.** Search `oak wood`, open Oak Tree: Oak Forest and
    an Oak Seedling join with a grow mark "2:30" on the line; a regrow mark
    "5:00" for a stump's seedling. No sapling or stump boxes.
    Verdict: superseded by the next round
T4. **Far side opens in place.** On Iron Ingot, click the "+1" on the left of
    the Iron Pickaxe: its other ways in open between it and the ingot, the
    pickaxe moves out. Click the Pickaxe: both sides fold.
    Verdict: superseded by the next round

Builder's calls: the need reads "×6" (as the amount did), red when short;
inside an opened far side, needs count per one of that box; "Starter tool"
and "From the start" leave the chart too (the card names them); the Combat mark
is the Melee sword as a stand-in (on your art list); columns are wider so the
grow marks fit.

**Owner's verdict on Part 1c (2026-11-01): change.**
- **Bug: the lines don't show** in the owner's game (they did in the builder's
  headless shots).
- No "or" text: each alternative way sits on a **faint parchment band** instead
  (owner picked the director's idea).
- **Directional arrows instead of "+N"**: an arrow tab on the box's side with a
  small count inside it ("›3").
- **Hover lights the path**: resting on a box brightens its lines to the
  searched entry and dims the rest (director's idea, chosen).
- Not chosen: thicker lines, bigger icons with a gold focus frame.

## Part 1d: the encyclopedia, fourth look

The game server was restarted (reload if the page was open). **Cause of the
missing lines:** the long-running dev server served a stale copy of the style
file after the branch switches, so the new ink colour was undefined in your tab
(director confirmed: empty before the restart, defined after). The lines now use
a fixed ink colour too, so they can't vanish that way again. Shots: scratchpad
`shots/e3d_*`.

U1. **Lines.** Search `iron ingot`: every line and arrowhead shows in dark ink.
    Verdict: superseded by the next round
U2. **Bands, no "or".** Iron Ingot's three ways in each sit on a faint band of
    their own (only where an entry has several ways).
    Verdict: superseded by the next round
U3. **Arrow tabs.** "‹2" / "›6" tabs on the boxes' sides instead of "+N";
    clicking one grows that side (the far side opens in place).
    Verdict: superseded by the next round
U4. **Lit path.** Rest the pointer on Iron Ore's vein (after opening Iron Ore):
    the lines from it to Iron Ingot stay dark, the rest fades.
    Verdict: superseded by the next round

**Owner's verdict on Part 1d (2026-11-01): good, almost there; change.** The
skill requirement marks bigger, in **light text with a dark outline, no tag**
(owner's pick); **no fading** of the other entries when hovering one.

## Part 1e: the encyclopedia, final look

Server restarted. V1. Skill marks larger (icon at 2×, title-size number) in light
words with a dark outline, light red when no hero has the level; grow marks the
same. V2. Hovering a box fades nothing; its route to the searched entry is drawn
thicker. Arrow tabs stay dark ink.
   Verdict: **ok** (owner 2026-11-01: this will work for now; merge)

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
   Verdict: **ok** (owner 2026-11-01: fine for now)
9. **Wrong ground holds.** On a Foundation that is **not** on Stone, choose the
   Test Mine. It gets a red mark; hover it: "Needs stone." Nobody works it and
   nothing is spent.
   Verdict: **ok** (owner 2026-11-01: fine for now)
10. **Moving fixes it.** Drag that Foundation onto plain rock: it flies back
    with "Needs stone.". Drag it onto the Stone patch: it lands, a hero builds
    the mine.
    Verdict: **ok** (owner 2026-11-01: fine for now)
11. **Near and anywhere.** A planted Forest builds on any dry ground. The
    crystal holds with "Needs a Test Leyline nearby." until you drag the
    Leyline beside it.
    Verdict: **ok** (owner 2026-11-01: fine for now)

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
