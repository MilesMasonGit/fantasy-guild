Status: briefed 2026-11-25 (approved by the owner 2026-11-25): brief 880 for the ledger work; the `/balancer` skill drafted in `.claude/skills/balancer/`

# The balancer: an agent for the game's numbers

*Owner interview with the planning agent, 2026-11-25. Part of the content and
balance fortnight (30 Nov to about 13 Dec 2026). It splits the numbers off the
content agent: [concept_balancing_view.md](concept_balancing_view.md) (the Dials
page), [concept_balancing.md](concept_balancing.md) (the paper pass),
[BALANCE_RULES.md](../reference/BALANCE_RULES.md) (the formulas) and
[concept_progression_ledger.md](concept_progression_ledger.md) (the engine's
timing) are its ground.*

## What it is

A new agent, started with **`/balancer`** in a fresh session (pick **Opus** in the
app). It keeps the game's numbers in line with the rules and dials the owner sets:
XP per action, ingredient counts, action times, small unlock moves, the pace curve.
It never decides names, chains or what an item is for; that stays with `/content`.
Combat numbers are out of scope.

## Settled before the interview (owner, 2026-11-25)

- The balancer owns `BALANCE_RULES.md`, the balance scripts (`balance_rules.py`,
  `balance_solver.cjs`, `build_balance.py`, the page template), the
  [Guild Balance Dials](https://claude.ai/artifact/LFSTcCGMiCsQUSDArMH3z6) page, and
  reading the progression ledger.
- It **proposes** dial changes and number packs; the owner approves them.
- `/content` keeps names, chains and placements.
- **Week 1** it is tried on two chains already in the catalogue: food and drink,
  and metal and gear. **Week 2** it times the whole game. The weeks overlap with
  the content session putting every skill and enemy in the CMS as Planned entries.

## The owner's rulings (2026-11-25)

- **Its own branch and folder**: `planning-balance` in `.claude/worktrees/pba`, so it
  runs beside `/content` without clashing. It publishes to `main` after each step,
  as the other planning agents do. Docs and its own scripts only: never `src/`,
  `cms/src/`, `data/`, `public/assets/` or tests.
- **What it may do on its own: anything inside the rules.** The system's
  adjustments within the limits already set (XP per action, ingredient counts,
  action times, unlocks moved by up to 3 levels, per concept_balancing_view's "The
  system's limits"), script fixes, and rebuilding the Dials page. **Waits for the
  owner's yes**: any change to a dial or a rule, and every number pack for the CMS.
- **Reports**: the Dials page stays current, and each run adds a short **balance
  report** on the page: what it checked, what moved, and what it proposes, each
  proposal as a multiple-choice question with the recommendation first. A problem
  in game code becomes a ticket for the director.
- **Empty stretches go back to `/content` on a shared list**: a "Gaps for content"
  list (skill, levels, what's missing, a suggestion) in
  `docs/active/balance_gaps.md`. `/content` reads it at session start and strikes
  a gap once it adds or moves an unlock. No ticket per gap.
- **The balance scripts move** from `.claude/skills/content/` to
  `.claude/skills/balancer/` (they read only the catalogue, nothing of the content
  scripts). `/content` stops rebuilding the Dials page.
- **Order of the code work: ledger first, XP table last.** Week 1 needs no code.
  During week 1 the director builds the ledger tickets (T-294, T-383, T-338 part 2)
  so that in week 2 the ledger can time the whole planned game once it is in the
  CMS (T-305). The new XP table (T-337) and dose lengths (T-338 part 1) land with
  the first number pack, not before.
- **Week 1 ends with**: an approved set of dials for the two chains (recorded as
  rulings in `BALANCE_RULES.md`), the gaps list filled for them, and the
  balancer's own instructions adjusted from what the trial taught. No CMS pack.
- **Week 2 ends with**: one approved set of dials over every non-combat skill, the
  gaps list handed to `/content`, and, **if the plan is in the CMS and the ledger
  agrees with the page**, the first number pack for the owner to Sync, together
  with the new XP table. If the ledger isn't ready, only the pack waits.
- **Taming leftovers go to `/content`** (Taming was cut 2026-11-22, confirmed
  2026-11-25): drop the Stable from the plan, give Banana Smoothie a different
  drink job, and send a change pack deleting the CMS's Taming Draught effect.

## How a session runs

1. Bring `main` in; read `BALANCE_RULES.md`, the gaps list, this doc, and the
   chains the run covers.
2. Run the solver over the catalogue (`node .claude/skills/balancer/balance_solver.cjs`),
   and, once the plan is in the CMS, the ledger's read-out for the same entries.
3. Compare: where the page and the ledger disagree, **the ledger wins** and the
   solver's rule is fixed (concept_balancing_view's ruling).
4. Within-limit adjustments: make them. Anything else: a proposal on the report.
   Unsmoothable empty stretches: the gaps list.
5. Rebuild and republish the Dials page with the report; ask the owner the
   proposals as multiple choice, batched.
6. Kept dials: record as rulings in `BALANCE_RULES.md`, change the solver and
   `balance_rules.py` together, rebuild.
7. A number pack (after T-305): staged in the scratchpad, copied to
   `cms/incoming/` only when every check passes; the owner reviews and Syncs.
8. Commit by name, publish to `main`, end by saying what's approved, what's
   proposed, and what's waiting.

## Planning agent's calls (simplest choice, said in a line)

- **The ledger needs a read-out an agent can run.** Today the ledger runs only
  inside the CMS page (`cms/src/engine/ledgerReport.js` and friends); there is no
  command. The brief adds a `ledger` command to the CMS command line (`npm run cms -- ledger`, brief 880 L1), writing the pace per skill
  and each entry's arrival and numbers as JSON, so the balancer reads the
  engine's timing without the owner copying it out.
- **The gaps list is a doc, not the Dials page**, so `/content` can edit it on its
  own branch; the page links it.
- **T-305 is the content session's goal 1** (every skill and enemy in the CMS as
  Planned entries); the balancer doesn't write that pack, it waits for it.

## What it needs

- **Week 1**: the move of the scripts and the `/balancer` skill (docs and
  tooling only). Nothing in game code.
- **Week 2**: T-294, T-383 and T-338 part 2 built; the ledger read-out; the plan
  in the CMS (T-305, the content session).
- **The first number pack**: T-337 and T-338 part 1, landing with it.

## Open links

- **The boost budget** (T-383, concept_balancing "The boost budget") becomes the
  Dials page's fourth view once the ledger counts it.
- **Rules not covered yet** (BALANCE_RULES "Not covered yet": arrows per craft,
  several outputs, food healing, station and tool prices) are the balancer's to
  propose as the fortnight reaches them.
- **Combat numbers** come later, in their own pass.
