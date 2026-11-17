# Deep read D1 to D4: which findings touch a design choice (2026-11-17)

*Planning agent. The owner asked, before any ticket is filed for the 97 deep-read findings
(CR4-101 to CR4-197), to be shown every finding whose fix would change a design choice: how the
review says the game works today, and how the fix would change it. Nothing here is filed yet.*

The 97 sort into four groups:

| Group | Count | What it means |
|---|---|---|
| A. Already ruled by the owner | 33 | You answered these in the reviewer sessions (D1 to D4); the fix follows your ruling. Listed so you can check nothing was misread. |
| B. Touch a design choice, not yet ruled | 15 questions | The fix would change how something plays or reads, or the reviewer left the choice open. **Answers needed.** |
| C. Desktop tries | 5 | You tried them and saw nothing wrong; one quick check per finding of what you saw. |
| D. Plain faults | the rest | The fix makes the game do what its own text, card, GDD or code already says. No design change. Listed in one line each so you can pull any out. |

---

## A. Already ruled by you (the fix follows the ruling)

- **Thorns costs no charge** (CR4-104, with CR4-103's double "ran out").
- **A hero needs the recipe's level to work it** (CR4-107).
- **No Token merges, ever** (CR4-108, with CR4-102 and CR4-117).
- **One spot for a Token's whole cycle; no double-size buildings** (CR4-105).
- **A healing hero's orders in other Regions**: kept if healed on arrival, cleared if not (CR4-101).
- **The next camp adopts a demolished camp's enemies** (CR4-111).
- **A reload remembers the enemy's health** (CR4-122).
- **Two Foods: the earlier slot first** (CR4-126).
- **A hand-over onto a full loadout replaces, like a Bank drop** (CR4-131).
- **Rusty Pickaxe and Rusty Woodaxe as a fallback** (CR4-137).
- **+10 % XP is a true 10 % by chance** (CR4-138).
- **No loadout changes mid-fight** (CR4-139, with CR4-130 and the work list CR4-172).
- **Saves follow a CMS rename** (CR4-160, with CR4-158, 159, 162, 163, 127's rename case).
- **An unanswered away summary is offered again** (CR4-164).
- **Banners come back after a reload** (CR4-147, with CR4-146).
- **Old Tokens stay endless** (CR4-165: closes, no ticket).
- **The browser build is for development** (CR4-145 and CR4-157 drop to P3).
- **No hero drag under a full-screen view** (CR4-193).
- **The recipe list shows base and real time** (CR4-194).
- **One click buys one rank** (CR4-195).
- **The Fine Fishing Rod** (CR4-132): already covered by T-402 (retire catch weight); linked, not filed again.

---

## B. Design choices to rule on

Each: **Today** (what the review says happens), **The fix** (what would change), options with my
recommendation first.

### B1. Changing a station's recipe mid-cycle, and work left half-done when the guild travels (CR4-116)
- **Today**: switch a Furnace from a 16 s recipe to an 8 s one when it is 15 s in, and the new
  recipe finishes on the next tick, as if it had been worked from the start, and any drink or
  "On Work Start" rule is skipped for that cycle. When the guild travels away and back, every
  Token keeps its half-done work (this is deliberate and pinned by a test), and the hero who takes
  it up on return finishes it without drinking a dose.
- **The fix**: a recipe change starts the cycle again from zero. Travel either keeps the half-done
  work and counts the dose for the returning hero, or also starts from zero.
- (a) **A recipe change restarts the cycle; travel keeps the half-done work and the returning hero's
  drink counts** (recommended: switching recipes is a choice, so restarting is fair; travel is not
  the player's fault, so the work is kept).
- (b) Both restart from zero.
- (c) Both keep their progress; only the missing drink and start rules are fixed.

### B2. Eating between kills (CR4-118)
- **Today**: in the two-second rest after a kill a hero under a quarter health may eat once per
  game tick: about twenty chances while you watch, about three while you are away (the catch-up
  takes bigger steps). So the same fight can end in a knock-out only while you are away. Eating in
  the rest is also free, where eating mid-fight costs a swing; the reviewer notes that may be the
  intended "rest".
- **The fix**: out-of-fight eating runs on game time, one meal per fixed interval, so watching and
  away give the same result. It changes the bench's numbers for fights once.
- (a) **One meal per second of rest** (recommended: about the same as today while watching, and
  away play matches it).
- (b) One meal per rest, whatever the health.
- (c) Leave it: away fights are a little harder, by accident.

### B3. Picking up an enemy while a hero fights it (CR4-109)
- **Today**: lifting a fought enemy in the hand pauses the fight (nobody swings), but poison and
  burn keep ticking on the hero, who cannot eat or regenerate meanwhile, and can be knocked out
  while the fight shows nothing happening.
- **The fix**, one of:
- (a) **Lifting the enemy ends the fight, as walking away does** (recommended: the smallest change,
  and it matches what a let-go already does: statuses come off, the enemy is whole again).
- (b) An enemy being fought cannot be picked up (says why).
- (c) Poison and burn pause too while it is held.

### B4. An enemy's health when its hero walks away in live play (follow-up to your CR4-122 ruling)
- **Today**: a hero who leaves a fight (recalled, re-ordered) and comes back finds the enemy at
  full health again. Your ruling makes a reload remember the enemy's health; the reviewer left open
  whether live play should too.
- (a) **Leave live play as it is: walking away lets the enemy recover** (recommended: the reload
  ruling is about closing the game not changing a fight; walking away is a choice with a cost).
- (b) An enemy keeps its wounds in live play too, until it is killed.

### B5. The Cedar's size (follow-up to your CR4-105 ruling)
- **Today**: the Cedar is a size-2 Tree (twice the width), the only one. Your ruling said all
  Tokens take the same space and named the Fighter's Academy; the reviewer asked whether the Cedar
  goes ordinary size too.
- (a) **The Cedar becomes ordinary size, by change pack** (recommended: your sentence covers it).
- (b) The Cedar keeps size 2 and its Stump and Sapling hold the large spot.

### B6. Full-screen views: item drags too? (follow-up to your CR4-193 ruling)
- **Today**: you ruled heroes cannot be dragged off the hero bar while a full-screen view is open
  (the Encyclopedia, the Guild Hall, the world map). The reviewer asked whether dragging items
  (from the Bank, from a loadout) is blocked too.
- (a) **Heroes only; item drags still work where they have a place to land** (recommended: the
  Bank and loadouts sit above the view, so item drags never reach the hidden mat).
- (b) Block every drag while a full-screen view is open.

### B7. A Token's card when the Token becomes something else (CR4-110)
- **Today**: an open card stays up after its Token is built, felled, used up, killed or claimed,
  still on the old name ("Wood Foundation" over the new Workbench). Its buttons do nothing.
- **The fix**: the card closes when its Token leaves, or follows it to what it became.
- (a) **Follow it when it becomes something (Foundation to Workbench, Tree to Stump); close when it
  is gone** (recommended: you are usually watching for exactly that moment). Needs an eye-check.
- (b) Always close.

### B8. Which enemy a hero goes to next on a newly settled place (CR4-128)
- **Today**: when a hero beats an arrival enemy, they head for the nearest one left, even if
  another hero is already fighting it, and wait behind that fight while a free enemy stands
  untouched. Two heroes end up clearing the place one enemy at a time.
- **The fix**: prefer the nearest enemy nobody else is fighting; wait only when all are taken.
- (a) **Yes, prefer a free enemy** (recommended).
- (b) Leave it.

### B9. The Encyclopedia's tick for a Token you have had (CR4-156)
- **Today**: a chest (or any one-use Token) that came with a settled place is ticked while it
  stands, and loses its tick once it is opened and gone. A Token you bought, built or that spawned
  keeps its tick for ever. The GDD says ticks mark "what this run has".
- **The fix**: any Token on a place's mat counts as had from when the guild holds it, for good.
- (a) **Had once, ticked for good** (recommended: it matches bought and built Tokens).
- (b) Ticked only while it stands somewhere, for every Token (bought ones lose the tick too).

### B10. A pinned item tracker while you are away (CR4-148)
- **Today**: a pinned item stub counts gained minus spent since it was pinned, but nothing the
  catch-up plays: after a night away the Bank has moved by hundreds and the stub has not, and from
  then on they disagree.
- **The fix**: the catch-up's gains and spending are added to every pinned stub.
- (a) **Count time away** (recommended: like your Playtime ruling, the guild's whole time).
- (b) Count only time watched, and say so on the stub.

### B11. A ripe Field's harvest and a neighbour placed after it ripened (CR4-119)
- **Today**: a Field's harvest size is fixed the moment it ripens. A Composter placed beside a ripe
  Field afterwards shows "Abundance +1" on the card, but the Field still gives the old amount.
- **The fix**: the card shows the fixed amount for a ripe Field.
- (a) **The card shows the fixed amount; a neighbour counts from the next crop** (recommended:
  the number on the card is the number you get).
- (b) A ripe Field's harvest follows its neighbours until it is harvested.

### B12. Two heroes with the same name (CR4-135)
- **Today**: a recruit's name is one random pick from 96, with no look at the roster; about one
  guild in five ends up with two heroes of the same name, and every banner that names them is
  ambiguous.
- (a) **Pick only names nobody on the roster has** (recommended).
- (b) Leave it: the player can rename.

### B13. A gear slot holding an item deleted in the CMS (CR4-127, the delete case)
- **Today**: your rename ruling covers renames. For a real delete, the hero's slot looks empty
  ("+") but refuses everything with "Bank full", and cannot be cleared; it works again only if the
  item comes back in the CMS.
- **The fix**: the slot shows the missing item by its id, and the player can clear it (the copy is
  thrown away; restoring the item later does not bring it back).
- (a) **Show it as missing and let the player clear it** (recommended: a delete is for good, and
  a slot that refuses everything looks broken).
- (b) Keep it locked until the item returns, but show what it holds.

### B14. Starting the desktop game twice (CR4-152)
- **Today**: two copies can run on the same slot and silently overwrite each other's saves;
  closing a forgotten minimised copy can wipe an hour of play in the other.
- **The fix**: a second launch brings the first window forward instead of opening another game.
- (a) **One copy at a time** (recommended).
- (b) Allow two, but stop saving in the older one and say so.

### B15. Faults waiting for content nobody has authored yet (CR4-124, 141, 142, 143, 167, 197)
- **Today**: the CMS lets you author rule shapes the engine gets wrong, though nothing shipped uses
  them: for example a stronger tier of an elixir ("Elixir of Valor II") that is no stronger than
  the plain one, a kill's loot that ignores the hero's fighting style where a station's would not,
  a Shop price of more than four items, a rule with a cooldown.
- **The fix**, one of:
- (a) **The CMS warns on each shape now, and the engine is fixed when the first content needs it**
  (recommended: cheap, and nothing you plan is blocked: a warning, not a refusal; the content
  agent gets the list).
- (b) Fix the engine for all of them now.
- (c) Leave them; fix each when it is hit.

---

## C. Desktop tries (you saw nothing wrong; one check each)

The reviewer asked, before filing, what you saw in each. A finding you saw no sign of is filed P3
at most, or closed as moot.

1. **"Catching up" after a PC sleep** (CR4-144): did the "Catching up" bar appear on wake at all?
   (If not, the finding cannot happen as written and closes.)
2. **Double-click on Load** (CR4-149): did the time away look shorter than it should, or the game
   jump?
3. **The away summary with Settings open** (CR4-170): could you click the summary's buttons?
4. **Ten minutes minimised** (CR4-174): was the selected hero still selected, and the fight
   window's log still there?
5. **Alt-Tab from the Guild Hall** (CR4-192): did the sky follow the pointer with no button held?

---

## D. Plain faults (no design change)

The fix makes the game do what its card, text, GDD or code already says. One line each; say if
any should move to B.

**The mat** (D1): a Sapling on the edge of its Forest's reach counts as outside it (CR4-106);
going back to a Region with an old event wipes the wait for the next one, though the GDD says the
clock waits (CR4-112); an event's banner follows the guild to another Region (CR4-113: comes down
on leaving, back on return, per your banner ruling); an idle hero sent somewhere new walks at
stroll speed and reads as idle (CR4-114); a hero stopped near the left or bottom edge puts their
flag off the mat (CR4-115); a "for the cycle" potion stays listed on a hero whose cycle never
finished (CR4-120); a crash right after settling leaves the place with no arrival enemies (CR4-121);
"Load as I left it" can undo more than the summary shows: the summary will name both absences
(CR4-123); travel can put a quest bounty on another Token (CR4-125).

**Heroes and fights** (D2): knock-out losses dropped from a shared banner (CR4-129); XP an hour and
"Next level" read too high and freeze in an open panel (CR4-133); an item's "/hr" counts loot on
the floor and misses floor spending (CR4-134); the Accuracy tip does not say the 5 to 40 % bounds
(CR4-136); a timed buff (none ships) would stop counting in fights after a reload (CR4-140).

**Saves and time away** (D3): a settle or a new game saves half-way through (CR4-150); a failed
"Load as I left it" cannot be retried (CR4-151); a failed save on closing closes anyway, unseen:
the fix holds the window once and shows the banner (CR4-153); "Save Game Now" gives no sign it
saved: the fix shows "Saved" (CR4-154); a new player's master volume is lost once (CR4-155); a
star whose top rank was removed in the CMS gives nothing: the fix gives the new top rank (CR4-161);
a slot with a missing file but a good backup shows "Empty" (CR4-166).

**Screens and drag** (D4): a fighting hero's health on the hero bar and drawer stands still
(CR4-168); a Token's "!" wrong after a PC sleep (CR4-169); a quick flick from a long Bank list can
reorder instead of equip (CR4-171); travel wipes level-up alerts meant to stay until clicked
(CR4-173); the last lesson opens the world map under an open Bank or Shop: the fix closes them
first and waits for a drag to end (CR4-175); Escape in a place's rename box closes the map
(CR4-176); clicking an event banner with the Encyclopedia open shows nothing: the fix closes the
book, as the map and Hall do (CR4-177); a healing hero lights every Token green (CR4-178); a flag
says "Working" in green while its station is stuck (CR4-179); a hero let go off the mat is sent to
its edge, though the code says it should stay put (CR4-180); a covered Bank tile takes a drop on
the Hero drawer (CR4-181); the first click in Edit Hero closes the drawer behind it (CR4-182); a
Bank item dropped forward lands one place short (CR4-183); the Bank forgets an item's place once it
runs out (CR4-184); Bank search misses "chiefs" for "Chief's" (CR4-185); a Token marked for
demolition shows XP it never pays (CR4-186); a station with no recipe shows a time, level and XP
from no recipe: the fix leaves them out until a recipe is picked (CR4-187); a second station's gear
at the same height does not move the card (CR4-188); Text size's Reset then X loses custom sizes
(CR4-189); a reason over a Token on the mat's top row is cut off (CR4-190); the Guild Hall dropped
on a bad spot says it "cannot be removed" (CR4-191); after a crash in a drawer the Reload button
cannot be clicked (CR4-196).

---

## Answers (owner, 2026-11-17, interview in the planning session)

Where an answer differs from the options offered, the answer wins.

### Design questions

- **B1 (CR4-116): both restart.** Changing a station's recipe starts the cycle from zero, and so
  does coming back from travel: every half-done cycle in a Region the guild returns to restarts.
  Follow-up: **a reload keeps the work** as it is today; only travel restarts. So travel no longer
  equals a save and load for work progress: the pinning test (`AtlasTravel.test.js`, "there and
  back equals save and load") is rewritten to expect cycles at zero after travel, everything else
  equal. A restarted cycle fires its start moment (drink dose, On Work Start) as any new cycle does.
- **B2 (CR4-118): one meal per second of rest.** Out-of-fight eating runs on game time, at most one
  meal per second; watching and away agree. The bench fingerprint shifts once (a WORK CHANGED to
  accept, with this reason).
- **B3 (CR4-109): lifting a fought enemy ends the fight**, as the hero walking away does (statuses
  off, enemy whole).
- **B4 (CR4-122 follow-up): live play unchanged.** Walking away from a fight lets the enemy
  recover; only a reload remembers its health.
- **B5 (CR4-105 follow-up): the Cedar becomes ordinary size**, by change pack. **Owner to-do: redo
  the Cedar's art** at ordinary size.
- **B6 (CR4-193 follow-up): heroes only.** Item drags keep working under a full-screen view.
- **B7 (CR4-110): follow, or close.** The card follows its Token when it becomes something else and
  closes when it is gone. Eye-check.
- **B8 (CR4-128): prefer a free enemy**, waiting beside a fight only when every enemy is taken.
- **B9 (CR4-156): had once, ticked for good.**
- **B10 (CR4-148): count time away** on pinned stubs.
- **B11 (CR4-119): the ripe Field keeps its original number** and the card shows that number; a
  neighbour placed after it ripened counts from the next crop.
- **B12 (CR4-135): no repeated names, and a longer name list.** The builder adds names in the style
  of today's 96 (`src/config/registries/nameRegistry.js`); no review step.
- **B13 (CR4-127, delete case): show it as missing and let the player clear it.**
- **B14 (CR4-152): one copy at a time**; a second launch brings the open window forward.
- **B15 (CR4-124, 141, 142, 143, 167, 197): fix the engine now**, not a CMS warning.
  - **Tiers** (CR4-141), the owner's own rule, wider than the options: **no tier ladders of the same
    item** (no Elixir of Valor I to V; five tiers of one arrow is clutter). Tiered effects belong to
    hero gear and enemies. But an item's effect may carry a strength: "an Elixir of Brambles gives
    its hero Thorns 3", and there is no higher Elixir of Brambles. So the engine fix stands for
    every item: a strength on an "Applies" effect makes the applied effect that strong. Not ruled:
    whether a status's strength also means more stacks per hit; the brief keeps one stack a hit and
    uses the strength as the effect's own number unless the owner says otherwise. The no-ladder rule
    is for the content agent.
  - **Thorns in fights**, new idea from the same answer: an enemy that applies Thorns and a special
    armour piece that applies Thorns. Listed in [ideas.md](../ideas.md) for its own interview; not
    part of this triage.

### Desktop tries

- **CR4-144**: the "Catching up" bar did appear after the PC slept. The finding stands as written
  (the close during that bar was not tried); filed as reviewed.
- **CR4-149**: after a double-click on Load the time away looked correct. No sign of the fault:
  filed at P3.
- **CR4-170, CR4-174, CR4-192**: not tried yet; the owner will try them tonight. Held, not filed,
  until then.

## Tickets filed (2026-11-17)

T-409 to T-480 in [TICKETS.md](../../reference/TICKETS.md), section "Code review deep read", one ticket per fix (findings that share a fix share a ticket), and T-077 reopened for CR4-140 (latent, fixed now with the rest). CR4-132 goes with T-402; CR4-165 is owner-no; CR4-170, CR4-174 and CR4-192 wait for the owner's desktop try. T-338 item (4) is superseded by T-438. Every finding's State line in D1 to D4 names its ticket. Fix briefs are the next step.

## Answers while writing the briefs (owner, 2026-11-17)

- **Squeezes already in old saves (T-412)**: skip. Only new squeezes are prevented; an old save's squeezed tree may still hop once (old saves are not protected).
- **Travel restart scope (T-420)**: hero work cycles only. Growth, ripening, refill and spawn clocks keep their progress.
- **Brief order**: the P1s first (briefs 650 and 660), then the mat rules (670), saves (680), screens (690), and the future-content faults last (700).
- **No tier ladders of one consumable** recorded in `CONTENT_PHILOSOPHY.md` (Rules for items) for the content agent.
- **The Thorn Elemental (T-410)**: build a When Struck fight moment now (10 %, 1 damage to the hero who hits it, no charge), so armour can use it later; the Thorns-in-fights interview builds on it.
- **Briefs written**: 650, 660, 670, 680, 690, 700, rows 64 to 69 in the order table.
