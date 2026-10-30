# Brief 290 — Progression ledger: plan, trace, simulate and balance in the CMS

*Written 2026-10-28, rewritten 2026-10-29 twice; this version follows the
analyst's [system plan](../research/ledger_system_plan_2026-10-29.md) and the
owner's answers. Concept: [concept_progression_ledger.md](../concept_progression_ledger.md)
(read "The tool's goals", "The system design" and "The ledger" whole). The
world map ([concept_world_map.md](../concept_world_map.md)) is a draft: build
on **tiers** now; wedge and ring come later.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, the concept,
[the system plan](../research/ledger_system_plan_2026-10-29.md) (data model,
pretend player, checks, views, gate: the technical source for this brief),
[concept_progression.md](../concept_progression.md),
[concept_basic_content.md](../concept_basic_content.md), GDD §3, §10, §11.

Code to start from (verify; paths checked by the planning agent):
`cms/src/stores/useEntityStore.js` (entities, Sync, rename repointing),
`cms/src/engine/sim/` (`simRunner.js`, `dryRun.mjs`: rates, XP, values),
`cms/src/engine/connectivityAuditor.js` (existing checks to absorb),
`cms/src/engine/progressionRows.js`, `ProgressionPanel.jsx`,
`cms/changePackTool.mjs` and `cms/src/engine/packReview.js` (the agent
gate), `bench/lib/harness.mjs` and `src/systems/core/CatchUp.js` (the
calibration harness), `src/systems/atlas/mapItems.js` (the precedent for
code shared by game and CMS), `src/utils/XPCurve.js`.

⚠️ **Owner rulings that bind this brief**
- The ledger lives **in a CMS tab from L1**, and every phase adds to it
  (owner: "tied into our CMS as early in development as possible").
- `plan.tier` is **separate** from the existing gear/building `tier` field.
- **Planned stubs never reach `data/`**; **Drafts sync like Live**.
- Budgets assume **the target player** (background, check-ins every 30–60
  min, 8 h overnight); a stage is red beyond **±25 %**.
- **Pacing**: a **target time-per-level curve** the owner sets in a few
  points; a **wall** is a wait over twice the curve's expectation.
- **Average luck only.**
- **Every rate source counts** (owner, 2026-10-29): Hall upgrades, buildings
  and supports, consumables, tools, gear and perks. The pretend player is **a
  sensible investor**: it buys or builds when the payback is reasonable and
  uses consumables only when they pay for themselves (counting the time to
  make them). Each Hall rank's **payback time** is checked and priced to;
  views show a **per-skill breakdown of rate sources**.
- **Balancing is automatic** (L9): Recalculate sets the numbers itself to
  bring pacing onto the curve; no per-number owner approval.
- The virtual guild follows the game's real roster rules; model the rules
  **after** briefs 260 and 270 (one job per hero, classless heroes) with a
  rules-version setting; combat stays coarse until brief 280 lands.

## Phases

| # | What | Tier | Done when |
|---|---|---|---|
| S0 | **Spike.** An abstract model of the Starter Camp against the headless engine (`CatchUp`) on 3 small setups (one hero on a vein; mine plus smelt; a spawner forest); speed measured; a Sync-strip prototype; workspace size with stubs measured. Stop and report if the model can't get within ±15 %. | engineer | Within ±15 % on items and XP per skill; camp model under 50 ms; the architecture decision written in the concept |
| L1 | **The plan in the CMS.** The `plan` block (status, `plan.tier`, note, targets), Planned stubs, Sync stripping `plan` and dropping Planned, `cms/plan/plan.json` (committed with `data/`, read back by restore), rename repointing, pack fields; **a Ledger tab** listing entries with status and tier, editable. Settings: stages and budgets, tolerance, the target-player profile, the pace-curve points. | engineer | Tests: Planned never in `data/`; round-trip; a rename keeps the plan; the tab works in the CMS |
| L2 | **Reach and tree engine** (`src/systems/progression/ledger/`, pure, data passed in): every way a thing appears, earliest tier and path, the tree with effort from `runSim`, skills, depth, hubs. | engineer | On today's data: Iron Ingot's tree to Iron Ore and Coal with effort; Iron Ore "Volcano map only" |
| L3 | **Checks A–C and the item page** in the Ledger tab (integrity; plan vs data; luck and access), with the layered tree diagram. | builder | The audit's known findings on today's data; CMS eye-check |
| L4 | **First fill pack**: `plan.tier` on every Live entry, Planned stubs from the concept tables. | builder | The owner reviews and syncs |
| L5 | **The pretend player** v1 (event-driven, goal-driven policy, average luck, target-player check-ins and overnight), `npm run bench:calibrate` writing calibration factors, the pace curve, **checks D** (pacing, walls against the curve), the investor policy (Hall upgrades, supports, consumables by payback), a payback-time check per Hall rank, and the per-skill rate-source breakdown. | engineer | Whole game under 1 s; plane 2's Construction 15 wall shows; calibration written; "calibration stale" works |
| L6 | **Timeline and hubs-and-problems views** (a lane per skill against the pace curve; walls labelled with their blocker; fan-out chart; problems list). | builder | CMS eye-check; click-through to the item page |
| L7 | **Before-and-after and the agent gate**: ghost dots and moved entries per edit (Web Worker) and since last Sync; `changePackTool.mjs gate` blocking packs that add Block findings or move a stage beyond tolerance undeclared; inbox shows the gate and re-runs it on open. | builder | A sample pack shows its changes; a bad pack is blocked |
| L8 | **Content fix pack**, through the gate (camp leaks to their plane; plane-2 buildings to about Construction 5–8 and more build XP; copper recipes for the sickle, rod and trap; uses for fish, bones, beeswax, grape seed; the Goblin Chief to about level 12). | builder | The audit rows clear; the timeline improves |
| L9 | **Automatic balancing**: Recalculate gains a pacing pass that sets XP returns, level requirements, costs and times so the pretend player follows the pace curve and each stage meets its budget; **checks E** (economy). | engineer | On today's data, a Recalculate brings every stage within ±25 % and no wall over twice the curve, or reports which content can't be balanced by numbers alone |
| Later | Wedge and ring, checks F, the World plan view (with the world map's brief); combat detail after brief 280. | — | — |

## Done when (whole brief)

- Gate green each phase (`TESTING.md`); the game changes only through synced
  packs and Recalculate's numbers (engine bench work changes accepted as
  content).
- The Ledger tab answers, for any item: where it comes from, what it feeds,
  its tree, when the pretend player gets it, and whether pacing is on the
  curve.
- CMS eye-checks after L3, L6 and L7; the owner reviews L4's and L8's packs.

## Owner to-do

- After L1: set the pace-curve points (e.g. level 10 within the first hour,
  a level every few days near 99) in the Ledger settings.
- Review L4's tiers-and-stubs pack and L8's fix pack; Sync on `main`.
- From then on, plan new content as Planned stubs; agents' packs arrive
  gated.
