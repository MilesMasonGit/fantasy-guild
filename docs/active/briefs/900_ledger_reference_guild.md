# Brief 900 — The ledger times a real guild, from one rulebook

*Written 2026-11-26 by the planning agent at the balancer's request. Every ruling is already the
owner's, in [BALANCE_RULES.md](../../reference/BALANCE_RULES.md) (sections 1, 2, 5, 7, 8) and
[balance_method_review.md](../balance_method_review.md); this brief adds none. Closes T-716, T-715,
T-713, T-717, T-724, T-736 and T-737. Builds on brief 880 (L1 to L3 on `main`; its 2.2 gatherers-per-maker cap stays as
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
| B1 | T-716 | **The reference guild** (section 8). (1) A guild of **8 heroes** running two or three chains, one maker to about 2 gatherers; a gatherer's output is **allocated once** among crafting, prices, boosts and selling (`supplyOf` no longer hands one flow to every asker). (2) **Heroes arrive about one a tier** (one at copper, two at iron, on to eight): each stage is timed with the heroes the guild has then. (3) **Nodes in reach from the reference set-ups** (bare one node, busy about a fifth of the time; typical and optimized a camp of 4 or 5 nodes, fully busy; a node gives 15 s of work and is back in 60 s, section 2), not `campMembers: 3`; report a sparse and a dense layout and warn where they differ past the tolerance. (4) **A work site is timed by its building places** (brief 890: 12 places round a node; about 5 for buildings at a gathering site, about 8 at a maker's station, section 5; the same building all game, more of them as it goes, section 5), not one building of each kind. (5) **Count what profiles drop**: a camp variant's own rules (Sawmill, Mine Head) and more than one building of a kind in reach. (6) **Retake the calibration stamp** (18 Nov, nine one-hero set-ups). L1's read-out carries the new numbers. | engineer | — |
| B2 | T-715 | **One rulebook for the simulator** (sections 1 and 7). Recalculate's XP curve comes from section 1 (XP an hour doubling every 20 levels), not `dials.js`'s own pins; the **purpose tilt** is the owner's moderate one: training 1.5x the XP and half the goods, balanced both in full, earning half the XP and 1.5x the goods; the **worth (gold an hour) curve doubles every 20 levels**, 1,200 at level 1 to about 35,000 at 99. Read the numbers from one place the ledger also reads; say where the simulator can't. | builder | — (parallel with B1: different files) |
| B3 | T-713 | **Two coin curves** (section 7). An **everyday** curve (Shop Tokens, Foundations: one level's time of selling, section 7's points) and a **big** one (settling a place, a Guild Hall star: half the payback curve), with **no multiplier for a star's rank**; the default curve set to the everyday points (`settings.js` `coinCurve`, `coins.js`, `pace.coinPrices`). | builder | B1 (both in `pace.js`) |
| B4 | T-717 | **Three checks** (sections 1 and 5): a chain's **total XP per raw unit** (ore to ingot to dagger pays three times; flag chains far off their tier's median); a consumable batch **paying back at least 4x** its making time, ingredients included (a drink or work potion: 25 cycles a dose, 5 a craft, twice as strong; today any net gain passes, `profiles.js`); a **Hall star's payback over all the work it boosts**, on the payback curve, not one work against a flat 24 hours (`pace.js`). | builder | B1 |
| B5 | T-724 | **Numbers onto the plan, and a ledger that times it** (concept_balancer_agent step 8). (a) **A pack writer**, a CMS command (named in `USAGE` and `cms/README.md`): from the balance solver's rows (`node .claude/skills/balancer/balance_solver.cjs`, keyed by catalogueId) write a number pack giving each Planned entry (T-305's six packs) its work as the CMS holds it, a recipe or a Token's cycle: level, seconds, XP, inputs with counts, what it makes and how many, its station. Entries **stay Planned** and never reach the game; the writer saves nothing to the workspace, it only writes the pack for the balancer to stage and gate with `pack check`. Where a catalogue entry maps to no clear recipe or Token cycle, **ask the content session, don't guess**. (b) **`ledger --with-planned`**: the read-out times Planned work as if it were live, marked as Planned; without the flag nothing changes. | builder | (a) any time, beside B1 (CMS tooling); (b) after B1 (the ledger) |
| B6 | T-736 | **The boosts pack writer** (section 5, the owner's budget of 2026-11-26: only what a hero holds at once counts). `pack boosts --out=<pack.json>`, built like `pack numbers` (B5a): CMS tooling, writes only the pack, **never into `cms/incoming`**, with an **unclear list**. For each effect statement that changes work time, XP, yield or doubles, rare finds or regrowth, classify its source and write the rule's size, keeping its name and what it does: (1) a **placed building** on what it reaches: 5 % off work time, +2.5 % XP, +50 % yield (Double Output), +12.5 % rare finds, 10 % off regrowth; the coin building stays +10 %; (2) a **station's own upgrade**: 5 % off work time a step (one Faster Work building's worth); (3) **skill perks**: a skill's perks add up to the tier's speed total x 0.25 by darkmetal (15 %), spread over its perk levels; (4) **Guild Hall stars**: all ranks of one star add up to about 10 % of its kind, in even steps; (5) **the one consumable**: a speed drink the tier's speed total x 0.25 (5 % at copper to 15 % at darkmetal), an XP drink or potion the tier's XP total (10 to 20 %), a yield potion +50 %, a rare-finds potion +100 %. Tier totals are the ledger's `boostBudget` (maxed). Anything that fits none of these, or mixes kinds, goes to the unclear list. Mapping doubts to the content session, number doubts to the balancer. The number pack and this boosts pack **land together** (owner 2026-11-26). | builder | B5 (a) (`pack numbers` exists) |
| B7 | T-737 | **Nodes at 15 s of work, back in a minute** (owner 2026-11-26 via the balancer, replacing 30 s and 30 s; section 2). (1) `pack numbers`, both modes: a gathering Token's end chance = 100 x cycle / 15 s, its refill 60 s, a Stump's regrowth 60 s. (2) The ledger's layouts: a gathering site is a camp, its spawner and 4 or 5 nodes (6 or 7 of the 12 places, about 5 left for buildings); sparse and dense become 2 and 5 nodes, or one Forest and its allowance (`layoutSpawners`, `sitePlaces`, the layout check). (3) **Waits for an owner ruling on the game side**: the ledger's profiles hold one consumable in all (a drink or a potion), while the game today allows one drink plus any number of potions (`equipmentCategories.js`); build (3) only once the game rule is decided. | builder | (1) B5 (a); (2) B1 |

**Order.** B1, B2 and B5(a) side by side; B3, B4 and B5(b) after B1; B6 after B5(a); B7 (1) after B5(a), (2) after B1. All CMS-side: **same work** in
the game.

## Done when

- Gate green each phase; same work (CMS and ledger only).
- `npm run cms -- ledger` runs on today's workspace and a sandbox, saves nothing, and shows: stages
  timed by the heroes on hand; a sparse and a dense layout with any warning; sites timed by building
  places; the two coin curves; the three checks with what they flag. The CMS Ledger page loads and
  shows the same.
- B5: the writer turns the solver's rows into a pack that `pack check` passes and that applies cleanly in a sandbox after the six Planned packs, with every entry still Planned; `ledger --with-planned` times them and the plain read-out is unchanged.
- B6: `pack boosts` writes a pack that `pack check` passes and that applies cleanly in a sandbox; its unclear list names every effect it left alone.
- B7: `pack numbers` writes the 15 s and 60 s node numbers; the read-out's sites hold 4 or 5 nodes and about 5 building places.
- Recalculate's XP and worth come out on section 1's and section 7's curves (spot-check level 1, 40
  and 99 against BALANCE_RULES).
- The director tells the balancer (a line in `STATUS.md`) as each phase reaches `main`.

## Eye-check

No: the CMS's own pages, no game look.

## Owner CMS to-do

None.
