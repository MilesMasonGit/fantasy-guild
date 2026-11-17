# Brief 690 — Deep read: screens and drag-and-drop

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md); D4 rulings in
[review/STATUS.md](../review/STATUS.md)). Runs after briefs 650 and 660, beside 670 and 680 where files
allow. CR4-170, CR4-174 and CR4-192 wait for the owner's desktop try and may join later.*

**What the player gets.** Health on the hero bar moves with every hit; a Token's "!" is right after a
PC sleep; drops never land on something hidden; heroes cannot be dragged under the Encyclopedia, the
Guild Hall or the world map; a Token's card follows it when it becomes something else; the recipe list
shows the base time with the station's real time beside it; one click buys one rank; and a long list of
smaller screen faults (Bank order and search, Escape, readouts that say "working" or "ready" when they
are not, clipped reasons, the text-size reset, a dead Reload button).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (drawing, React plumbing,
`src/ui/dnd/`), `docs/reference/UI_STYLE.md`, and each phase's finding in
`docs/active/review/D4_screens_and_drag.md` (D1 for CR4-110, D2 for CR4-133, 134, 136). **Stop and
report** where the code disagrees. Anything drawn: `npm run bench:draw -- --compare` once for the
batch; drag code changes (U2, U3): the drag bench.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| U1 | T-461 (CR4-168), T-462 (CR4-169) | **Readouts that stand still.** The hero bar's figure and the Hero drawer's HP get the mat bar's HP events (hits, food, poison and burn ticks) for their hero, from one shared place; projections stay flat. A Token's spawner and growth alerts are re-read on `GAME_RESET`, so a catch-up cannot leave a "!" wrong. | builder |
| U2 | T-463 (CR4-171, CR4-181), T-469 (CR4-180), T-475 (CR4-190, CR4-191) | **Drops land where they look.** A target inside a scrolling box is no target when the pointer is outside that box's visible part, and a Bank tile covered by the Hero drawer is none either (one guard in `pointerWithinBoxes`). A hero dropped outside the mat is a miss (stays where they were). Mat callouts are clamped inside the mat (below the Token when there is no room above), the carried hero's red reason bubble too; the Guild Hall's "cannot be removed" is said only when no target took the drop. Drag bench. | builder |
| U3 | T-476 (CR4-193) | **No hero drag while a full-screen view is open** (owner, 2026-11-17). List every full-screen view (the Encyclopedia, the Guild Hall, the world map, others found); with one open, heroes cannot be lifted off the hero bar; item drags keep working. The hero figure shows it cannot be dragged, so a press does not look broken: render two or three looks on a screenshot page for the owner to pick first, then build the picked one. Drag bench. | builder |
| U4 | T-416 (CR4-110), T-472 (CR4-186, CR4-187), T-473 (CR4-188), T-477 (CR4-194) | **The Token card.** The card follows its Token on `TOKEN_TRANSFORMED` (Foundation to Workbench, Tree to Stump) and closes when its Token leaves the mat (owner, 2026-11-17). A Token marked for demolition shows no XP cell; a station with no recipe shows no time or XP, and its level once a recipe is chosen. The "same selection" test compares the instance id and the recipe list is keyed by it (search text and scroll follow). Each recipe row shows the recipe's base time with the station's real time beside it (`workTimeOf`, the card's number) (owner, 2026-11-16); off the mat, base only. The input half is T-406, not here. | builder |
| U5 | T-471 (CR4-183, CR4-184, CR4-185) | **Bank order and search.** A forward drop takes the target's place (as `HeroRoster.reorderHero`); `setGroupOrder` keeps ids it was not given (out of stock, hidden) at their relative places; filing into a never-arranged tab writes its shown order first, so "the end" is the end the player sees; search drops apostrophes on both sides. Saved tab orders still load. | builder |
| U6 | T-464 (CR4-173), T-465 (CR4-175), T-466 (CR4-176), T-467 (CR4-177), T-470 (CR4-182) | **Layers and Escape.** Travel keeps the hero bar's level-up alerts. The last lesson opens the world map through the nav's close-everything path, held while a drag is live. The rename box gets its own Escape layer and `WorldScreen`'s document Escape listener goes. Clicking an event banner with the Encyclopedia open closes the book, then pulses the Token. The Hero drawer ignores presses inside an open dialog (Edit Hero). | builder |
| U7 | T-468 (CR4-178, CR4-179), T-434 (CR4-133, CR4-134), T-436 (CR4-136), T-474 (CR4-189), T-478 (CR4-195) | **Small screen faults.** A healing hero lights no Token green (`canOrderOnto`); a flag's hover uses the hero bar's line and its colour when the Token is stuck. XP an hour and "Next level" count the first gain's own interval and the open panel re-reads every second or two; an item stub's "/hr" counts floor spending and a catch-up's spending (no new random draw). The Accuracy and Dodge tips say "never below 5 % or above 40 %". Text size's Reset Defaults is a preview until Save & Close. A second Upgrade click within about half a second of a successful buy is ignored (owner, 2026-11-17). | builder |
| U8 | T-479 (CR4-196) | **The crash panel.** Each error catcher's fallback takes clicks (`pointer-events-auto`) and is placed in its own surface's corner, so the mat and the hero bar stay; the Encyclopedia, notification and fight-tab catchers show theirs where it is seen. Test by throwing in one drawer in a dev build. | builder-lite |

**Order and parallel work.** U2 and U3 both touch `src/ui/dnd/`: one after the other. U4 (the card)
and U5 (the Bank) may run beside them. U1, U6, U7 and U8 fill gaps on files the others leave alone.
Two code agents at a time.

## Done when

- Gate green; bench work check: **same work** for every phase (screens only); one `bench:draw --compare`
  for the batch; the drag bench after U2 and U3.
- In the running game, named as verified: U1 (one hero fighting: the bar falls hit by hit), U2 (the
  finding's flick repro at a 1440 px window), U3 (Encyclopedia open: a hero cannot be lifted, items can),
  U4 (open a Foundation's card, let it finish: the card shows the building), U5 (drag the first Bank
  tile onto the second: they swap), U6 (Escape in the rename box keeps the map open), U7 (double-click
  Upgrade: one rank).
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes, one look after U3 and U4** (a changed interaction, the card and the recipe list). The
U3 look is picked from screenshots first. The rest one line each in STATUS.

## Owner to-do

- Pick the "cannot be dragged" look from the screenshot page (U3).
