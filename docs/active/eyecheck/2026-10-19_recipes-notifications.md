# Eye-check: the recipe list and notifications (batch 5)

**Open:** http://localhost:5198/ (the director serves it from the combined
branch `crunch/batch5`; your folder stays on `main`, nothing to switch).
**Save slot:** Slot 3 (your last eye-check save), or a New Game in an empty
slot. Saves here belong to this address only.

Write `ok` or what to change after each `Verdict:`. Small look tweaks can
wait for a refinement pass; say so if you'd rather.

## The recipe list

1. On the mat, click a station that makes things (a furnace, a kitchen) to
   open its Token card, then click **Change recipe**. The card turns into the
   recipe list in place, grows wide enough that every recipe is one line, and
   its art is scaled up behind it.
   Verdict:
2. Look at a row: the level on the left; the inputs with have/need (red when
   short); any tool or upgrade it needs as a hollow bar (red when missing);
   the thing it makes as the headline; extras smaller and grey with their
   chance; XP and time small at the end.
   Verdict:
3. **Hero faces** sit on thin lines between rows: everything above a face,
   that hero can run. Only heroes allowed this skill in Work Permissions get
   a face; the station's current worker has a gold ring. Turn a hero's skill
   off in Work Permissions and reopen: their face goes.
   Verdict:
4. The list opens scrolled to the current recipe, outlined gold. At the
   bottom, two **`???`** recipes show what's coming next (blacked-out
   picture). Are they easy enough to see on dark art?
   Verdict:
5. Type in the **search** box (say "ore" or "oak"): only recipes that use or
   make it stay. Click one: the card flips back showing it. Also try the grey
   **Back** button (new piece) and Escape.
   Verdict:
6. Click the small **gear** on a station on the mat: the card opens straight
   on its list (the old recipe window is gone).
   Verdict:
7. Drop a **Foundation** and open its card: choosing what to build uses the
   same list.
   Verdict:

## Item stubs (top right)

Open **QA** in the top bar → **Notifications** for buttons that make these
happen on demand.

8. **Busy minute of loot**: stubs stack at the top right, amount then
   picture, one per item: green `+` when you're gaining it overall, red `-`
   when it's draining.
   Verdict:
9. Hover a stub: a panel slides out to the left with the name,
   `gained / spent` and the net per hour; nothing else moves.
   Verdict:
10. **Find a new item**: its stub has a shiny gold frame and "New!" in front.
    Verdict:
11. Pin a stub (pin in its hover panel): it moves to the top and keeps
    counting; reset sets it to +0. With many stubs, scroll the column: the
    pinned one stays put. **Clear all** removes the rest, not the pins. Save,
    reload the page, load the slot: the pin is still there. Should a pinned
    stub at rest show a small pin mark? (Today: a faint gold line under the
    pins.)
    Verdict:

## Banners (top centre)

12. **Level-up that unlocks recipes**: one gold banner drops from under the
    top bar ("… unlocked 3 recipes: …"), with a small bounce and a shine
    pass; the level-up float still shows on the hero. Hovering the banner
    outlines the hero on the mat. Click: it lifts away.
    Verdict:
13. **Four banners at once**: three stack, newest on top, with a "+1" tab.
    Verdict:
14. **Knock-out behind three banners**: the red one is counted in a red "+"
    tab and comes on screen next, ahead of waiting gold ones.
    Verdict:
15. **Bank full banner** (red) reads "… waits on the mat until the Bank has
    room" (items are never lost; they wait on the mat). Wording ok?
    Verdict:
16. Try a refused drop (a Token where it can't go): the refusal is a speech
    pop-up at the spot, not a toast. The left-edge notification sidebar is
    gone.
    Verdict:

## After the look

Fixes go on the branch, then it merges to `main`. No CMS steps for this
batch. Your art list has the **banner ribbon** (gold and red); the code-drawn
frame stands in until then.

## Owner's verdict, first pass (2026-10-19)

"Generally looks good for the first pass." Everything ok except the item
stubs (checks 8–11): the stub pops out of the side and the SAME box expands
over the mat as one line (amount, sprite, name, rate), not a second box; no
gained/spent text; the sprite at 2× like floating loot; left-click pins under
a "Pinned" header, right-click clears (resets a pinned one); no pin icons.
Interviewed and written into concept_notifications.md "Item stubs"; the fix
is being built on `crunch/notifications`, then a second look at checks 8–11.

## Second look: item stubs only (built 9b9e873e, merged into `crunch/batch5` 137d95ec)

Same address, http://localhost:5198/ (reload the page). QA → Notifications →
Busy minute of loot, then Find a new item.

17. Stubs sit flush against the right edge and slide out of it; sprites at
    64 px; the "New!" stub is gold.
    Verdict:
18. Hover a stub: the same box grows left into one line (amount, sprite,
    name, rate per hour); the other stubs stay put.
    Verdict:
19. Left-click pins it under a gold "Pinned" header (a small gap under the
    pinned group); left-click again unpins. Pinning keeps the count.
    Verdict:
20. Right-click a pinned stub: back to +0, still pinned. Right-click an
    unpinned one: it slides away. No browser menu.
    Verdict:

Owner, second look: back to 1× (32 px) sprites; no blank space on the left of
a stub, at rest or hovered; a pinned stub always shows the expanded line.
Being fixed on `crunch/notifications`; then a third look at 17–20.

## Third look: item stubs (599bd237, merged into `crunch/batch5` 900c4cc4)

Same address, reload. QA → Notifications → Busy minute of loot, Find a new
item.

21. Sprites at 1× (32 px); each stub as wide as its content, no blank space
    on the left, at rest or hovered; the column's left edge is ragged.
    Verdict:
22. Pin a stub: under "Pinned" it always shows the full line (amount, sprite,
    name, rate), hovered or not.
    Verdict:

Note: items from the QA button go straight to the Bank, so their rate reads
`+0/hr`; real work (loot dropping on the mat) counts the rate.

## Fourth look: stub order, motion and the loot flight (merged into `crunch/batch5` ba7de155)

Same address, reload. The builders could not watch motion at full speed (the
pane was hidden), so the feel of every slide is yours to judge.

23. **Order**: new items join the bottom. Pin one: it goes to the bottom of
    the pinned group; unpin it: it goes to the top of the unpinned stubs. No
    "Pinned" heading, just the normal gap.
    Verdict:
24. **Motion**: stubs ease out of the edge and back in; when one above leaves
    (right-click it), the ones below glide up rather than jump.
    Verdict:
25. **Loot flies to its stub**: QA → Performance → S2 Realistic (workers
    making loot). Collected loot flies to its own item's stub (not the Guild
    Hall) and the number ticks up as each piece lands. A brand-new item's stub
    slides out at +0 first and catches its loot.
    Verdict:
26. **Out of view**: fill the column (QA → Notifications → Find a new item,
    ~15 presses, or a shorter window), then right-click the Oak stub away. The
    next oak makes a new stub below the full column: a copy pops out over the
    bottom stubs, catches the loot, stays ~0.9 s, slides back. Long enough?
    Verdict:
27. **Stubs off**: Settings → Notifications → item stubs off: loot flies to
    the Guild Hall as before. (Switch it back on after.)
    Verdict:
28. Should a stub give a small flash when loot lands, or is the number
    ticking enough? (Builder's recommendation: the tick is enough.)
    Verdict:
