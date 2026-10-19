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
