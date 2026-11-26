# Brief 880 — The balancer's ledger: the engine times the whole planned game

*Written 2026-11-25 by the planning agent from the owner's interview the same day
([concept_balancer_agent.md](../concept_balancer_agent.md), approved 2026-11-25). The concept holds
every ruling. Closes T-294, T-383 and T-338 part 2; T-337 and T-338 part 1 go with the first number
pack.*

**What the player gets.** Nothing new to see until the first number pack: every skill then levels at
the pace the owner chose on the Guild Balance Dials page, the planned game's numbers come out of one
set of rules, and the engine (not a page's estimate) has checked them.

**Who uses it.** The new `/balancer` agent (`.claude/skills/balancer/`, drafted by the planning agent
2026-11-25, docs and tooling only). Week 1 of the content and balance fortnight (from 30 Nov) runs on
the Dials page and needs none of this; **week 2 needs L1 to L3 merged** and the plan in the CMS
(T-305, the content session's goal 1).

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the ledger, the content
boundary), `docs/reference/BALANCE_RULES.md`, [concept_progression_ledger.md](../concept_progression_ledger.md),
[concept_balancing.md](../concept_balancing.md) and [concept_balancing_view.md](../concept_balancing_view.md),
the tickets T-294, T-337, T-338 and T-383 in `docs/reference/TICKETS.md`. Code read 2026-11-25 (the
code wins): the CMS command line (`cms/cli.mjs`, `cms/cliCommands.mjs`), the ledger's report
(`cms/src/engine/ledgerReport.js`), `cms/src/engine/ledger/` (`pace.js`, `profiles.js`, `settings.js`,
`world.js`, `balance.js`), `src/systems/progression/ledger/`, and the balancer's solver
(`.claude/skills/balancer/balance_solver.cjs`), whose output L1 mirrors. Every phase may **stop and
report rather than guess**.

## Phases

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| L1 | — | **A ledger read-out an agent can run**: `npm run cms -- ledger [--json=<file>]`, read-only on the workspace (never saves it; `--sandbox` works as for the other commands). It writes, for the optimized and the typical profile, **each skill's pace** (time per level 1 to 99, hero time and guild time) and **each entry's numbers and arrival** (XP an action, action time, ingredient counts, first time each profile can make it), Planned entries included and marked, plus the ledger's checks. Keys and units as close to the solver's summary (`node .claude/skills/balancer/balance_solver.cjs`) as the ledger allows, so the balancer can line them up; say where they can't match. Add it to `USAGE` and `cms/README.md`. | builder | — |
| L2 | T-294 | **Tiers 6 and 7, levels by rung**: open the ledger's plan tiers to 7 (`PLAN_TIERS`), let a cell's settle level and price follow the rung of its main material rather than its ring, and move the ring stars' budget tier (`ringBudgetTier` in `ledger/pace.js`) to the ring before's last tier as the ticket says. Stage budgets and the curve points come from L3, not hand values. | engineer | — |
| L3 | T-383, T-338 (2) | **The smooth curve, the optimized player, gatherers per crafter, the boost budget**: the pace curve as one rule, 3 min x 1.0625^(L − 1) (range 1.06 to 1.065, owner), read from settings (the director set the CMS's points to it 2026-11-25; make it the rule); the curve's target is the **optimized** profile, typical about 1.5 to 2x slower, bare at most 3x (`profiles.js`, the bounds in settings); supply counts **the gatherers a crafter needs** at each profile instead of one hero per input (`pace.js`); the **boost budget** table per tier and kind (speed, yield, XP, rare finds), every boost counted against it, a check for totals over budget (the 65 % speed cap of T-338 part 3 is one row of it). L1's read-out carries the new numbers. | engineer | L2 |
| L4 | T-337, T-338 (1) | **Goes with the first number pack, not before** (owner 2026-11-25): the new XP table, about 9.4 million XP to 99 (`xpForLevel`, `src/utils/XPCurve.js`, BALANCE_RULES section 1), and dose lengths per item: a drink or work potion lasts 25 work cycles (`DOSE_LENGTH`, `src/systems/core/consumableRule.js`; section 5). Built on a branch when the balancer says its pack is ready; merged together with the owner's Sync of that pack. Old saves aren't protected (briefs README), so the ticket's XP rescale is the director's call: say which, in a line. | builder | L3, the pack |

**Order and parallel work.** L1 and L2 may run side by side (different files: the CLI versus the
ledger engine). L3 after L2 (both in `pace.js`). L1 to L3 are CMS-side: **same work** in the game.
Aim to merge L1 to L3 during week 1 of the fortnight (30 Nov to 6 Dec), so week 2 can time the whole
game. L4 waits for the balancer.

## Done when

- Gate green each phase; **same work** for L1 to L3 (CMS and ledger only); L4's work change is the
  point of the pack, with a work check after the owner's Sync.
- L1: the command runs from the repo root on today's workspace and on a sandbox, writes the JSON, and
  saves nothing (the workspace file's hash is unchanged after a run).
- L2 and L3: the CMS Ledger page loads, its pace view shows tiers up to 7 and the optimized line on the
  smooth curve, the boost budget check lists any over-budget totals; L1's read-out shows the same.
- The director tells the balancer (a line in `STATUS.md`) when L1 to L3 are on `main`.

## Eye-check

No for L1 to L3 (the CMS's own pages, no game look). **L4: yes, light**, with the pack: a new game's
hero levels at the new pace, the hero sheet's XP numbers read right with the shorthand.

## Owner CMS to-do

- None for L1 to L3.
- L4: review and Sync the balancer's number pack, on `main`, when the director says L4 is ready.
