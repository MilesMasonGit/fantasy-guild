# Brief 670 — Deep read: the mat's rules

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md); D1 rulings in
[review/STATUS.md](../review/STATUS.md)). Runs after briefs 650 and 660.*

**What the player gets.** No Token is ever swallowed by dropping it on its copy (it lands beside);
Thorns no longer eats a second charge (a Redberry Bush gives 25 harvests, a Thorn Elemental 100 kills),
and the Elemental's thorns prick a hero who strikes it; a tree that grows back or a building that
finishes stays exactly where it stood, because a Stump or a Foundation already holds the full spot;
a hero needs a recipe's level to work it; changing a recipe or coming back from travel starts the work
cycle fresh; and a handful of smaller mat faults (a Sapling counted outside its Forest, a camp's orphans,
the event clock, heroes strolling, a stop flag off the mat, a bounty on another Token, a ripe Field's
card, a lingering potion effect).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the board engine, placement,
flags, timed changes, fights), and each phase's finding in `docs/active/review/D1_the_mat.md` (search the
CR4 id). **Stop and report** where the code disagrees with the finding or a fix would change something
not ruled.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| M1 | T-411 (CR4-108, CR4-102, CR4-117) | **No Token merges, ever** (owner, 2026-11-15). A Token dropped (or right-click moved) onto its copy is placed beside it by the ordinary nudge; the top-up merge, `restock()` and its "Restocked" notice and sound go, with their tests (delete tests only with the code they test). This retires the resting-Token deletion and the partial-merge progress reset. Check the hand-drop from the Shop and the brief 510 F4 fix still behave. | builder |
| M2 | T-410 (CR4-104, CR4-103) | **Thorns costs no charge; the Elemental's thorns on being struck.** (1) One depletion route for a kill: `resolveVictory` hands it to `Charges.destroyToken`, one announcement with `instance` and `heroId`. (2) A new fight moment, **When Struck** (the side carrying the rule reacts when the other side's hit lands on it), beside On Swing, On Hit and On Health Below in `FightMoments.js` and the trigger registry, with its rule text and a CMS option; a chance on it draws in authored order as the others do. Built so an armour piece can carry it later (the owner's Thorns-in-fights idea, `ideas.md`). (3) Content by change pack (content agent): the Redberry Bush's Thorns costs no charge and pricks the hero on 10 % of cycles (1 damage); the Thorn Elemental's Thorns becomes "When Struck, 10 %: deals 1 damage to the hero", no charge. Owner reviews and Syncs; then check both in the running game. Expect WORK CHANGED for the `depleted` figure and the bush's harvests. | engineer, content agent |
| M3 | T-412 (CR4-105) | **One spot for a Token's whole cycle.** A Stump and a Sapling (and a Foundation) take the room of what they become for placement and pushing, though they may be drawn small; a drop beside one keeps that room (`asGrown` in the drop's legality), so the squeeze cannot be made. No work on squeezes already in old saves (owner, 2026-11-17). Content by change pack (content agent): the Fighter's Academy and the Cedar become ordinary size. Expect WORK CHANGED (spacing). | engineer |
| M4 | T-413 (CR4-106) | **A Sapling on the edge of its Forest's reach.** Search planting rings to just inside the reach, and test a transform's legality where it stands without rounding its own point. After M3 (same placement code). | builder |
| M5 | T-414 (CR4-107) | **A hero needs the recipe's level to work it.** Fold the recipe's level into the station check, as Foundations already do; the hero is skipped with the usual "skill too low". The recipe list's divider and the card already say this. WORK CHANGED only if a bench hero is under-levelled for a set recipe. | builder-lite |
| M6 | T-420 (CR4-116), T-423 (CR4-120), T-418 (CR4-112) | **Work cycles start fresh.** (1) Changing a station's recipe resets its work progress. (2) Returning to a Region resets every half-done hero work cycle there; growth, ripening, refill and spawn clocks keep their progress; a reload keeps everything as today. A fresh cycle fires its start moment (drink dose, On Work Start). Rewrite `AtlasTravel.test.js` "there and back equals save and load" to expect work cycles at zero after travel, everything else equal. (3) A hero's for-the-cycle effects end in `Flags.release`. (4) The event clock holds while an event stands (return without adding) instead of zeroing. | builder |
| M7 | T-417 (CR4-111), T-419 (CR4-114, CR4-115), T-428 (CR4-125) | **Camps, walks, bounties.** A camp leaving the mat clears its children's tethers, so the next camp of that kind beside them adopts them (arrival enemies keep `tether: null`). A new order walks at full speed and reads as walking (clear the stroll); right-click stop clamps its point as `Orders.orderAt` does. Travel checks a bounty's remembered spot with `isLegal` before use, else searches. | builder |
| M8 | T-422 (CR4-119) | **A ripe Field's card.** The Abundance row shows the load stored when the Field ripened; a neighbour placed after counts from the next crop (owner, 2026-11-17). | builder-lite |

**Order and parallel work.** M1, M3 and M4 touch placement: one after the other (M1 first, it deletes
code the others would read). M2 (fights, charges) and M6 (cycles, travel) may run beside them, two code
agents at a time. M5, M7 and M8 fill gaps. M2's and M3's content packs can be planned at any time.

## Done when

- Gate green; bench work check on every merge. **WORK CHANGED expected** for M2 (depletion and the
  bush), M3 (spacing), perhaps M5; the rest same work, or the report says why.
- In the running game, named as verified: M1 (drop a Forest on a Forest: it lands beside), M2 (a bush
  gives 25 harvests; strike the Elemental until a prick shows), M3 (place a Furnace tight against a
  Stump: refused or nudged, the tree regrows on its spot), M6 (switch a recipe mid-cycle: the bar starts
  at zero).
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes, one look after M1, M2 and M3** (changed interactions and a look rule): drop Tokens on
copies, watch a Stump regrow beside a neighbour, harvest a Redberry Bush and fight a Thorn Elemental.

## Owner to-do

- Review and Sync the Thorns pack (M2) and the size pack (M3) on `main`.
- **Redo the Cedar's art** at ordinary size (M3).
