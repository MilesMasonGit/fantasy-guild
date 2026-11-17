# Brief 650 — Deep read: heroes and fights

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md); rulings also in
[review/STATUS.md](../review/STATUS.md), D1 and D2 questions). No concept doc: these are fixes and the
owner's rulings on them. Runs first with brief 660 (owner, 2026-11-17: the P1s lead).*

**What the player gets.** A hero knocked out in one place is no longer knocked out a second time, or
put to work while healing, when the guild travels back; a hero's gear cannot be swapped while they trade
blows (and the game says why); closing the game mid-fight no longer resets the enemy's health; lifting an
enemy ends its fight instead of letting poison run on; eating between kills is the same watched or away;
a second Food is eaten when the first runs out; heroes clear a newly settled place in parallel; a shared
knock-out banner says what each hero lost; no two heroes share a name; an XP bonus is a true percentage;
handing an item to a hero with a full loadout swaps it in; and a guild that loses its only pickaxe can
always find a Rusty one.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the board, combat and hero
sections), and for each phase its finding in `docs/active/review/D1_the_mat.md` or
`D2_heroes_combat_gear_xp.md` (search the CR4 id: Where, What, Fix sketch and "Must not change", with
`path:line` at the review's commit). The code wins over the finding; where they disagree, or a fix would
change something the owner did not rule on, **stop and report** rather than guess.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| H1 | T-409 (CR4-101) | **A healing hero takes no work.** One rule in one place: a wounded hero takes no claim (`canTake` / `evaluate` in `Flags.js`), so every board, load and arrival obeys it; `resolveDefeat` does nothing (no penalties, no event) for a hero already wounded before this fight. The owner's rule for other Regions: on the guild's arrival, a hero's orders there are kept if the hero has healed, cleared if still knocked out. Test the finding's scenario (order onto an enemy, travel, lose, travel back) and a tree order the same way. Must not change: heroes picking up their old orders on return (`AtlasTravel.test.js:413`), the defeat penalties themselves. | builder |
| H2 | T-439 (CR4-139, CR4-172, CR4-130) | **No loadout changes mid-fight.** One guard inside the engine's equip, unequip and hand-over functions covers all seven routes CR4-172 lists (Bank drop on a hero, slot move within a loadout, hand-over giver and taker, right-click, drag to the Bank, drop on the figure). Locked from the moment an enemy steps up until it falls or the hero leaves; open between enemies. The refusal reaches the player through the existing refusal paths ("{hero} is fighting"). Engine-side changes stay outside the guard (a lost fight's gear loss, `destroyEquipped`); eating is unaffected (a hero eats from the Bank stack). This also ends CR4-130's elixir count and CR4-139's XP and burst tricks; check both in a test. | builder |
| H3 | T-425 (CR4-122) | **A reload remembers the enemy's health.** Save the enemy's current health with the board (a save-format change; an older save loads the enemy whole, as today) and count an elixir once per enemy across a reload (count at the kill, or a "counted for this enemy" mark cleared at the kill). The second engagement after a load must still put back the for-the-fight effects (`Elixirs.test.js:260-269`). Live play unchanged: a hero who walks away still finds the enemy whole (owner, 2026-11-17). After H1 (both touch the fight's start). | builder |
| H4 | T-415 (CR4-109), T-421 (CR4-118) | **Lifting a fought enemy ends the fight**, as the hero walking away does (statuses off the hero, enemy whole). **Out-of-fight eating on game time**: at most one meal per second of rest, the same in a catch-up's 1,000 ms steps as in 100 ms ticks. Expect WORK CHANGED for fight scenarios; say why in the report. Measure the finding's case (same fight at 100 and 1,000 ms steps) before and after. | builder |
| H5 | T-429 (CR4-126), T-438 (CR4-138), T-433 (CR4-131) | **Three small rule fixes.** (1) With two Foods, eat the earlier slot's, moving on when the Bank runs out of it (`consumeEquipped`; the random stream for a one-Food hero stays the same). (2) An XP bonus carries its fraction by chance (`RNG.roundByChance`), the at-least-1 floor goes; expect WORK CHANGED (`heroXp`); T-338 item (4) is superseded. (3) A hand-over dropped on a full hero's figure replaces like a Bank drop (the replaced piece to the Bank); change `docs/reference/GDD.md` (the hand-over lines near 740) and the test that pins the refusal. | builder |
| H6 | T-431 (CR4-128), T-432 (CR4-129), T-435 (CR4-135) | **Encounters, banners and names.** (1) After a kill on a newly settled place, a hero goes to the nearest arrival enemy no other hero fights, waiting beside a fight only when all are taken; the pick stays deterministic (distance, then written order). (2) A many-hero knock-out banner lists each hero's losses. (3) A recruit picks from names no hero on the roster holds (any name when all are taken), and the list in `src/config/registries/nameRegistry.js` grows to about double, in the style of today's 96 (owner: the builder picks them, no review step). | builder |
| H7 | T-437 (CR4-137) | **Rusty tools.** Content first: the content agent plans a Rusty Pickaxe and a Rusty Woodaxe (work like copper tools, 1 % break chance) and their source, as a change pack the owner reviews (the reviewer's notes in the finding: the source must need no tool and no fight a weak guild can lose for good, so a tool-free early Token is safer). After the owner's Sync on `main`: these are the first shipped items with a `breakChance`, so exercise `Breakage.js` in the running game (work a vein until one breaks; the notice and the Bank are right). The defeat roll on tools stays. | content agent, then builder |

**Order and parallel work.** H1, then H3 (both touch the fight's start). H2 and H5 touch the equip and
consumption code: one after the other. H4 and H6 may run beside H1 or H2 (different files), two code
agents at a time. H7's pack can be planned at any time; its build phase waits for the owner's Sync.

## Done when

- Gate green (`TESTING.md`) for every phase; bench work check on every merge. **WORK CHANGED expected**
  for H4 (fights) and H5 (XP); every other phase same work, or the report says why.
- In the running game, named as verified: H1 (the travel scenario), H2 (try three of the seven routes
  mid-fight: each refused with the reason; between enemies they work), H3 (close mid-fight, reload, the
  enemy's health is where it was), H4 (lift a fought enemy: the fight ends), H7 (a Rusty tool works and
  can break).
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes, one short look after H2 and H7** (a changed interaction and a new item): try changing a
fighting hero's gear, and find and use a Rusty tool. Everything else one line in STATUS.

## Owner to-do

- Review the Rusty tools pack from the content agent; Sync on `main` (H7).
