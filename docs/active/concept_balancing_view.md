Status: built 2026-11-19 (approved by the owner 2026-11-19): the [Guild Balance Dials](https://claude.ai/artifact/LFSTcCGMiCsQUSDArMH3z6) page

# The balancing view: rules and dials set the game, the system fills in the details

*Owner interview with the content agent, 2026-11-18. It builds on [concept_balancing.md](concept_balancing.md) (the paper pass) and [BALANCE_RULES.md](../reference/BALANCE_RULES.md) (the formulas), and reads the planned content from [the catalogue](content_catalogue.json). The art board's sister page: the art board is for drawing, this one is for numbers.*

## The owner's rulings (2026-11-18)

- **"Generally I want the game to be balanced according to the rules and parameters we set. We need the system to adjust the details like recipe inputs and XPH to keep the game smoothly balanced."** You set rules and dials. The system works out each entry's numbers, and nobody fixes numbers one at a time.
- **A page now, the ledger later.** A page built from the catalogue and the balance rules shows the planned game's numbers before anything is in the CMS. Once the plan is in the CMS (T-305), the ledger's engine-checked timing is the proof; where the two disagree, the ledger wins and the page's rule is fixed.
- **Numbers are worked out from the rules, not stored.** A rule change moves the whole game at once. A hand nudge, if one is ever needed, is an exception with its reason.
- **Dials to try.** The page has the rules' dials and re-times the planned game as they move. Nothing is saved on the page: the owner says which settings to keep, and the content agent writes them into the rules page and its script.
- **It answers three questions**: is the pace right, do the item numbers make sense, and what does a player have when. The boost budget waits for later.
- **Two players, side by side**: optimized (the curve's own player) and typical.
- **Two clocks, side by side**: hero time (the crafter's own hours, which is what the level curve paces) and guild time (those hours plus the gathering behind every ingredient).
- **"What a player has when" is worked out, with no targets**: when each entry arrives for each player. There is no milestone sheet to meet.
- **The system may adjust, on its own**: XP per action, ingredient counts, action times, and **unlock levels a little**.
- **What it can't smooth, it flags for content.** An empty stretch (levels with nothing new to make, where the old task slows into a wall) becomes a question for a content session: add an unlock or move one. Nothing is forced.
- **How numbers reach the game**: the owner approves a set of dials, the agent writes them into the rules, and the numbers go to the CMS as a change pack the owner reviews and Syncs, once the plan is there (T-305). The ledger then checks them.

## The page

**Dials**, from [BALANCE_RULES.md](../reference/BALANCE_RULES.md):

| Dial | Today | What it moves |
|---|---|---|
| Pace: minutes at level 1 | 3 | Every level's length |
| Pace: each level longer by | 6.25 % (owner's range 6 to 6.5 %, 2026-11-25) | Quick early, slow late |
| Old task slowdown a tier later | 2x | How hard staying on an old task gets |
| Action time growth every 20 levels | 1.15 | Late cycles' length |
| Base seconds: gather, prepare, make | 6, 8, 12 | Every action's length |
| Raw counts double every | 40 levels | Late raw cost |
| Typical player behind optimized | 1.1x early to 1.4x late (three quarters of each boost; owner, 2026-11-26) | The typical line |
| Unlock move allowed | up to 3 levels | How much the system may shift an unlock |
| Longer per extra bar | +50 % (owner, 2026-11-25; was +20 %) | A 5-bar Chestplate against a 1-bar Dagger |
| Boosts between tiers | climb each level (owner, 2026-11-25; was a step at each tier) | How the optimized player's boosts arrive |

**Three views**, each with the optimized and typical lines:

1. **Pace, skill by skill**: levels 1 to 99 as a strip per skill, each level's time against the curve, in hero time with guild time beside it. Empty stretches are marked, with the levels and the skill.
2. **Item numbers**: every entry's worked-out XP an action, XP an hour, action time, ingredient counts and its raw cost all the way down, filterable by skill and rung like the art board. What the system moved from the plain rule is marked, e.g. "unlock moved 42 → 44, to even out Smithing 40 to 50".
3. **When things arrive**: for each entry, the time from a new game until the optimized and the typical guild can first make it, in hours and days. Sorted by arrival, it reads as the game's timeline.

**The one flag**: empty stretches the system can't smooth. Everything else the system adjusts, within the rules.

## The system's limits

- **XP per action** is set so a level takes the curve's time for the optimized player, at the level the work unlocks. The old-task slowdown then follows from the rule.
- **Ingredient counts** stay on the rule's doubling (rounded), and fixed counts by kind stay fixed (Dagger 1 bar, Chestplate 5).
- **Action times** stay within the rule's band for their kind.
- **Unlock levels** move by at most the dial (3), never across a tier's opening level, never before a tool or ingredient they need, and never two onto one level. A move is shown, and the catalogue keeps the level the owner set.
- **An entry the owner has locked on the art board** may still have its numbers adjusted: a lock settles the name, kind and look, and numbers stay the ledger's (CONTENT_PHILOSOPHY, 2026-11-18).

## Planning agent's calls (simplest choice, said in a line)

- **One solver, written once in JavaScript**, kept in the balancer's skill folder (moved from the content skill's 2026-11-25): the page runs it as the dials move, and the pack script runs the same file under Node, so the page and the pack never disagree. `balance_rules.py`'s tables on the rules page are then regenerated from it.
- **Each entry's kind of work** (gather, prepare, make) and whether its ingredients are raw comes from its catalogue type through one mapping table in the solver; an entry the table can't place gets a `work` field in the catalogue.
- **Guild time counts one gatherer per raw ingredient at its source's rate**, with the yield rule (one gather gives the same at every tier). It's a planning estimate; the ledger's rate calculator is the real count.
- **The CMS ledger already has a balancing preview** for live content (`ledger/balance.js`: XP, gates, costs, boosts). The page is its planning-time cousin. When T-305 lands, the ledger's preview runs over the same plan, and a disagreement means the page's solver learns from the ledger, not the other way round.
- **The content agent builds the page and the solver** (skill scripts and an artifact, no game code). Only the pack step after T-305 needs the director.

## As built (2026-11-19)

- **The page**: [Guild Balance Dials](https://claude.ai/artifact/LFSTcCGMiCsQUSDArMH3z6), built by `.claude/skills/balancer/build_balance.py` from the catalogue and the solver, `.claude/skills/balancer/balance_solver.cjs` (`node .claude/skills/balancer/balance_solver.cjs` prints the same summary).
- **On the rules as they stand**, every skill the rules can time reaches 99 in 14.9 to 16.2 days optimized (the curve: 15.3) and about 27 to 29 days typical. 22 unlocks move by up to 3 levels. **32 empty stretches** are flagged, most in the gathering skills (Fishing, Mining, Forestry and Fletching, where tiers leave gaps by design) and the late ends of skills. The first one fixed: **Alchemy had nothing to train before level 5**; Birdwatcher moved to 1 (owner, 2026-11-19), leaving 31.
- **The optimized boost factor** in XP per action is the boost budget's (section 5: 1.4x at copper to 3x at darkmetal), not 1 as section 1 allows until that table is filled. Without it, the optimized player would climb faster than the curve.
- **Unlocks on a tier's opening level never move** (agent's call): Iron Ore Vein at 20 is the iron tier arriving.
- ⚠️ **The rules' formulas are in two places** until the rules page's tables are regenerated from the solver: `balance_rules.py` and `balance_solver.cjs`. A dial the owner keeps changes both.

## What it needs

- **Nothing in the game's code to start**: the catalogue, the rules and an artifact.
- **The dial settings the owner keeps** go into `BALANCE_RULES.md` and its script, recorded as rulings.
- **T-305** (the plan in the CMS, after T-294) for numbers to reach the game; **T-337** (the new XP table) for the game to use them.

## Open links

- **The boost budget** is a fourth view, for later (concept_balancing, "The boost budget").
- **Rules not covered yet** ([BALANCE_RULES.md](../reference/BALANCE_RULES.md), "Not covered yet"): arrows per craft, recipes with several outputs, food healing, station and tool prices, combat XP. The solver leaves those entries' numbers blank and says why.
- **Cooking's levels still use the old bands**, so its pace strip will show it until Cooking's levels move to the 20-level tiers.
