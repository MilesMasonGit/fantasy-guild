# Eye-check: six pieces built overnight (6 Nov)

**Branch:** `look/2026-11-06`, already switched in your folder by the director. It holds all six
pieces together: drag hints, enemies stand still (with crowded fights stepping apart), the Bank,
the top bar, notifications, and the encyclopedia corner; plus the fight windows' rust backdrop.
To switch yourself: `git switch look/2026-11-06`; back afterwards: `git switch main`.

**Save:** a New Game in any empty slot, then an older save with a few places settled for checks 4,
8 and 12. Restart your dev game first if it was already running. **Restart the CMS dev server**
too if you use it (repaired overnight).

## Drag hints

1. QA panel (the QA button, bottom right) → Hero orders → **Drag hints scene**. Pick up a hero and
   hold it over a Token (a tree, an ore, a fish spot): every hero shows a small green or red tool
   mark and skill mark, saying who could work it. Drop or let go: the marks leave.
   Verdict:

## Enemies stand still

2. On the Starter Camp and a settled place, watch the enemies for a minute: none wander, no ambush
   starts by itself, no ring of enemies round a camp. Drag a camp to a new place: it moves cleanly.
   Verdict:
3. Send three or four heroes at enemies standing close together: fights that would overlap step a
   little apart, then fight (approved yesterday; here only to see it still works with still
   enemies).
   Verdict:

## The Bank

4. Open the Bank: a coloured pixel backdrop sits behind the panel (each kind of panel has its
   tone). Hover an item: the new item tooltip. Click an item: its inspection window opens.
   Verdict:
5. Open a fight (send a hero at an enemy, open its window): the fight window has the rust
   backdrop.
   Verdict:

## The top bar

6. The place's name banner across the top is 3× (4× is in the screenshots,
   `docs/active/research/top_bar/built/`): **A. 3× (built); B. 4×.**
   Verdict:
7. Hover the top bar's Token count: the Token Summary opens; move away, it closes. Demolish shows a
   pixel X.
   Verdict:

## Notifications

8. QA panel → Notifications → **Time away with news (20 min)**, then **Long time away, lots of
   news (3 h)**: the summary lists everything that happened, nothing missing; at most six New!
   entries. **Clear banners** between tries.
   Verdict:
9. Settle a new place on the world map: a gold banner says the place is settled.
   Verdict:

## The encyclopedia corner

10. Open the encyclopedia: in the bottom left corner, a count and small progress bar for items,
    Tokens, enemies and recipes. On the older save the bars are further along.
    Verdict:
11. Open a Token with recipes (a station): click an ingredient in its recipe list, its page opens;
    the back arrow returns. Choosing the recipe itself still works.
    Verdict:
12. ⚠️ A total can grow when you find something that normally can't be reached: **A. fine (built);
    B. leave such things out of the total entirely.**
    Verdict:

## Still open from earlier

13. **Bounties on a full board:** A. a due bounty with no room is skipped, the next in 3 minutes
    (built); B. it appears as soon as room opens.
    Verdict:

## After the look (owner, in the CMS, on `main`)

Once the director has merged this and says so: delete the **Iron Ore Vein's Fire Elemental
Ambush** rule (ambushes are gone), then **Sync to Game** on `main`.
