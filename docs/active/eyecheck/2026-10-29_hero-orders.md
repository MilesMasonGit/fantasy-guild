# Eye-check 2026-10-29: Hero orders, parts 1 and 2 (brief 260 O1, O2)

**Branch:** your folder is on `feat/hero-orders-o2` (it holds part 1 too); the
game runs at http://localhost:5173. ⚠️ **Don't Sync the CMS while on this
branch**: the director switches your folder back to `main` after the look.

**Save slot:** start a **New Game in an empty slot**. Loading your usual save
(slot 3) on this branch turns its flags into orders for good (a pinned flag
becomes a job, a free-standing flag a hero idling where it stood), and `main`
can't read it back until this merges. To see the old-save conversion safely, use
QA panel → Hero orders → "Load an old save" in the empty slot.

Shots: `docs/active/eyecheck/shots/2026-10-28_orders_o1_*.png`,
`2026-10-29_orders_o2_*.png` (sent by phone).

## Part 1: orders

1. **Send a hero to work.** Drag a hero (on the mat or from the roster at the
   bottom) onto a tree: while you carry them, the Tokens they can work get a
   green outline. They walk there and chop; the pennant stands at the tree's
   top. When it's felled they wait by the Stump and fell it again when it
   regrows.
   Verdict: ok / change: ___
2. **Refusals.** Drop a hero without a pickaxe on a Copper vein: "Needs
   Pickaxe" shows and the hero stays on their old job. Drop one on a Forest or
   a quest board: "Nothing to work here".
   Verdict: ok / change: ___
3. **Open ground and home.** Drop a hero on bare grass: they walk there and the
   pennant fades when they arrive; never ambushed there. Drop on the Hall, or
   right-click the hero: they go home and wait by the Hall.
   Verdict: ok / change: ___
4. **The roster.** The bottom bar shows each hero as Idle / Busy / Hurt; click
   one to find them; hover one to see their job outlined. No Work Permissions
   anywhere; a skill's purpose shows on the hero sheet's skill list (hover the
   skill).
   Verdict: ok / change: ___
5. **QA panel → Hero orders** (dev buttons): "Ambush and needs-a-job scene" (a
   goblin ambushes a hero chopping by its camp, the hero fights back and
   returns; a hero whose bush is gone shows the yellow '!' and "I need a
   job"); "Knock out a hero" (they limp home, heal greyed at the Hall, then
   wait there).
   Verdict: ok / change: ___

## Part 2: camps (placeholder art)

6. **QA panel → Camps** "Place the four camps", then "Send the hands": two
   woodcutters on the Logging Camp take two different trees and move on as
   trees fall; the Mining Camp hero waits while veins rest; the Fishing Hut
   hero fishes; the Farmstead hero harvests one Field, then the next.
   Verdict: ok / change: ___
7. **Reach ring.** Rest the pointer on a camp, or on a hero working from one
   (on the mat or in the roster): a gold ring shows the camp's reach.
   Verdict: ok / change: ___
8. **Hunting.** Drag a hero onto the Goblin Camp (or "Hunt at the Goblin
   Camp"): they fight each goblin, then wait ("Waiting for Goblin") for the
   next.
   Verdict: ok / change: ___
9. **Scouting Flags is gone** from the Guild Hall's upgrades.
   Verdict: ok / change: ___

## Ruled already (2026-10-28/29)

Non-work drop refuses; a finished Foundation ends the builder's order;
right-click sends home; open-ground heroes never ambushed (ambushes otherwise
left for later); Farmstead picks bushes too; a full camp's newcomer idles; an
empty camp accepts; a Token dragged out of reach is let go. Enemy camps will
each count their own enemies (ticket, next batch).

## Owner CMS steps (after the merge, on `main`)

- Review the camps pack (Logging Camp, Mining Camp, Fishing Hut, Farmstead:
  art, reach, Foundation recipes) in the CMS inbox, then Sync.
- As you play: shorter rest, regrow and respawn times where a waiting hero
  idles too long; the Bunk Beds price, so a second hero comes early.
