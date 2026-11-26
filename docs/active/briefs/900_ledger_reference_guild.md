# Brief 900 — The ledger times a real guild, from one rulebook

*Written 2026-11-26 by the planning agent at the balancer's request. Every ruling is already the
owner's, in [BALANCE_RULES.md](../../reference/BALANCE_RULES.md) (sections 1, 2, 5, 7, 8) and
[balance_method_review.md](../balance_method_review.md); this brief adds none. Closes T-716, T-715,
T-713 and T-717. Builds on brief 880 (L1 to L3 on `main`; its 2.2 gatherers-per-maker cap stays as
the interim until B1 replaces it).*

**What the player gets.** Nothing to see. The balancer can then trust the engine on boosts and the
early game: the ledger times the guild a player really runs (eight heroes arriving one a tier,
gatherers shared between chains, buildings stacked round a node), and the simulator, the coin
prices and three missing checks all read the same rules.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the ledger, the content
boundary), BALANCE_RULES sections 1, 2, 5, 7, 8, the method review, brief 880, and the four tickets
in `docs/reference/TICKETS.md`. Code named in the tickets (read 2026-11-25 by the balancer; the code
wins): `cms/src/engine/ledger/` (`pace.js`, `profiles.js`, `rates.js`, `settings.js`, `coins.js`,
`checks.js`, `calibration.js`), `cms/src/engine/sim/dials.js`. Every phase may **stop and report
rather than guess**; a design question goes to the balancer, who asks the owner.

## Phases

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| B1 | T-716 | **The reference guild** (section 8). (1) A guild of **8 heroes** running two or three chains, one maker to about 2 gatherers; a gatherer's output is **allocated once** among crafting, prices, boosts and selling (`supplyOf` no longer hands one flow to every asker). (2) **Heroes arrive about one a tier** (one at copper, two at iron, on to eight): each stage is timed with the heroes the guild has then. (3) **Nodes in reach from the reference set-ups** (bare one node half busy; typical and optimized a camp of two or more, fully busy), not `campMembers: 3`; report a sparse and a dense layout and warn where they differ past the tolerance. (4) **A work site is timed by its building places** (brief 890: 12 places round a node, about 8 for buildings, at most about 4 of one kind; the same building all game, more of them as it goes, section 5), not one building of each kind. (5) **Count what profiles drop**: a camp variant's own rules (Sawmill, Mine Head) and more than one building of a kind in reach. (6) **Retake the calibration stamp** (18 Nov, nine one-hero set-ups). L1's read-out carries the new numbers. | engineer | — |
| B2 | T-715 | **One rulebook for the simulator** (sections 1 and 7). Recalculate's XP curve comes from section 1 (XP an hour doubling every 20 levels), not `dials.js`'s own pins; the **purpose tilt** is the owner's moderate one: training 1.5x the XP and half the goods, balanced both in full, earning half the XP and 1.5x the goods; the **worth (gold an hour) curve doubles every 20 levels**, 1,200 at level 1 to about 35,000 at 99. Read the numbers from one place the ledger also reads; say where the simulator can't. | builder | — (parallel with B1: different files) |
| B3 | T-713 | **Two coin curves** (section 7). An **everyday** curve (Shop Tokens, Foundations: one level's time of selling, section 7's points) and a **big** one (settling a place, a Guild Hall star: half the payback curve), with **no multiplier for a star's rank**; the default curve set to the everyday points (`settings.js` `coinCurve`, `coins.js`, `pace.coinPrices`). | builder | B1 (both in `pace.js`) |
| B4 | T-717 | **Three checks** (sections 1 and 5): a chain's **total XP per raw unit** (ore to ingot to dagger pays three times; flag chains far off their tier's median); a consumable batch **paying back at least 4x** its making time, ingredients included (a drink or work potion: 25 cycles a dose, 5 a craft, twice as strong; today any net gain passes, `profiles.js`); a **Hall star's payback over all the work it boosts**, on the payback curve, not one work against a flat 24 hours (`pace.js`). | builder | B1 |

**Order.** B1 and B2 side by side; B3 and B4 after B1 (either order). All CMS-side: **same work** in
the game.

## Done when

- Gate green each phase; same work (CMS and ledger only).
- `npm run cms -- ledger` runs on today's workspace and a sandbox, saves nothing, and shows: stages
  timed by the heroes on hand; a sparse and a dense layout with any warning; sites timed by building
  places; the two coin curves; the three checks with what they flag. The CMS Ledger page loads and
  shows the same.
- Recalculate's XP and worth come out on section 1's and section 7's curves (spot-check level 1, 40
  and 99 against BALANCE_RULES).
- The director tells the balancer (a line in `STATUS.md`) as each phase reaches `main`.

## Eye-check

No: the CMS's own pages, no game look.

## Owner CMS to-do

None.
