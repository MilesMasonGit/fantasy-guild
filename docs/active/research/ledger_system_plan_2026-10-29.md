# Progression tracking system: design plan (research, 2026-10-29)

*A systems analyst's plan for the ledger, from the owner's goals in
[concept_progression_ledger.md](../concept_progression_ledger.md) ("The
tool's goals"). Read-only; the owner's answers to its questions decide what
is adopted. Paths and counts checked by the planning agent where marked.*

## In plain words

A **planning desk inside the CMS**: every item, Token, enemy and recipe,
including unmade ones, has an entry with a status and a tier the owner sets.
Underneath sit two engines: **a map of how things connect** (what makes what,
down to the raw materials) and **a pretend player** (a virtual guild that
plays the game very fast and notes when it first gets each thing). About
thirty **automatic checks** turn rows red when plan and game disagree or
pacing goes wrong. Four **pictures**: the item page, the timeline, hubs and
problems, before-and-after. Content agents run their packs through the same
checks and pretend player before a pack reaches the owner's inbox. Later, a
two-way link with Recalculate.

## What the analyst checked (today's data)

- 149 items (71 only from Token outputs, 50 only from recipes, 9 both, 19
  neither: drops, Shop or stubs); 134 Tokens; 84 recipes. Recipe depth is
  small (90 items at 0, 24 at 1, 28 at 2, 5 at 3, 1 at 4, 1 at 5): the graph
  fits in memory and a layered SVG tree is enough; no graph library needed.
- **A `tier` field already exists** on weapons and many Tokens (checked: 24
  in items, 133 in tokens), meaning gear or building tier: the owner's plan
  tier must be a **separate field** (`plan.tier`).
- Ids come from names (`autoSyncId`), so a rename changes the id;
  `useEntityStore` already repoints references on rename (the precedent).
- The headless catch-up plays ~1 game-hour in ~1.9 s on a 109-Token board
  (~45 s a game-day). The economic simulator is pure and runs in Node
  (`cms/src/engine/sim/dryRun.mjs`, checked). `cms/changePackTool.mjs`
  (checked) already loads the workspace in Node: the agent gate goes there.

## Data model

- **A `plan` block on each entity** in the CMS workspace: `{ status, tier,
  note, targets?: { reachByMin?, skill?, level? }, wedge?, ring?, waivers?:
  [{ check, note, by: 'owner' }] }`. Stubs are entities with
  `plan.status: 'Planned'` and minimal fields (name, kind, tier, note, an
  optional `plannedSource: { skill, level, minutes }` estimate). On the
  entity, the plan travels through renames and pack create/edit for free.
- **Sync** strips `plan` from game files, drops Planned entities, writes
  `cms/plan/plan.json` (every plan block and stub, committed with `data/`;
  the restore script reads it back); `syncGuard.js` shows stubs as "not
  synced", not removed. Tests: Planned never in `data/`; round-trip; a rename
  keeps the plan and repoints stub references.
- **Settings** (`plan.settings`): stages and cumulative budgets (camp 30 min,
  plane 1 1.5 h, plane 2 24 h), tolerances, player profile, wall and gap
  thresholds.
- **Derived, never stored**, in a shared pure module
  `src/systems/progression/ledger/` (beside the `mapItems.js` precedent),
  data passed in so it runs in the CMS, Node and later the game:
  `buildGraph` (every way a thing appears: Starter Camp, Shop, spawners,
  growth and regrowth, catch pools and bait, drops with chance, first-kill
  drops, construction, Foundations, station and tool kinds and tiers, Passive
  Production; later world cells and seed-item builds); `reach` (earliest tier
  and path, a fixpoint over AND/OR nodes); `tree` (cheapest recipe per node,
  alternates kept, effort from `runSim`'s cycle times, skills, depth, luck
  flags, loops cut); `hubs` (fan-out).
- Only the before-and-after baseline is cached (memory or a Worker), plus a
  `cms/plan/pacing_snapshot.json` per Sync for "since last Sync".

## The simulated player

- **Models**: the guild under the roster rules; classless heroes (brief 270);
  one job per hero (brief 260); XP per cycle and levels (`XPCurve.js`); level,
  tool kind and tier (a tool copy is a resource: one sickle means one
  harvester), station kinds, Foundations; a virtual Bank; respawn and rest
  windows, spawner upkeep; Shop, construction, Passive Production; places
  (only the active one runs, with a travel cost); combat as kill time and win
  chance from levels (coarse until brief 280; then the real combat maths if
  pure); check-ins by a player profile, offline capped at 24 h.
- **Policy, goal-driven**: the frontier is the unreached entries of the lowest
  unfinished stage; for each, the remaining path (missing levels, items,
  buildings, tools); heroes go to the longest critical task first, one per
  link; spare heroes feed hubs or grind the gating skill; re-plan only at
  events. Two modes: expected value (deterministic, for the gate) and bad
  luck (drops at P90).
- **Reports**: first reach per entry (time, levels, path); level curves;
  **walls** (the frontier waiting on one blocker, with its length); empty and
  crowded stretches per skill; stage time against budget; hero idle %; hub
  Bank curves; never-reached entries with reasons. Timings through Planned
  stubs use `plannedSource` and are marked "estimated" (hatched).
- **Speed**: event-driven; whole game under 1 s today, under 3 s at 1,000
  entries; a debounced Web Worker per edit; a Node CLI for agents.
- **Architecture: an abstract model, not the headless engine.** The engine is
  faithful but ~45 s a game-day, needs a player placing Tokens and issuing
  orders (a project in itself), **can't run Planned stubs**, and carries
  global singletons. The abstract model is fast, runs stubs and is
  repeatable; its risk is **drift from the real game**, kept honest by a
  **calibration harness** (`npm run bench:calibrate`, reusing
  `bench/lib/harness.mjs` and `CatchUp.run`, both checked) that plays small
  fixed setups in the real engine (one hero on a vein; mine plus smelt; a
  spawner forest; a goblin camp) and writes efficiency factors per kind of
  work, stamped with the commit; a **calibration stale** check when the engine
  or rules change; rates only from data and `runSim`; later, owner
  play-throughs and the game's collection-log record.

## The checks (Block, Warn or Info; Parked silenced; owner waivers per entry)

- **A. Integrity**: unknown references; used but never produced; produced but
  unused; never reachable; a loop with no way in; a tool kind or tier nothing
  makes (also "one tool limits a skill to one hero"); a station or Foundation
  kind nothing provides; a recipe nothing can host; a pricing refusal.
- **B. Plan vs data**: leak (before its tier); late or never; a later-tier
  ingredient; a Live item or stub with no tier; an orphan stub; **Live content
  needing a Planned or excluded entry** (Block: breaks in game); a missed
  target time.
- **C. Luck and access**: luck only (under 5 %, no sure source); a single
  fragile source; first-kill only; Shop-only above the stage's means.
- **D. Pacing** (simulated player): a stage over or under budget beyond
  tolerance; a wall over the threshold; an empty stretch per skill; a crowded
  spot; a level gate unreachable in its budget; heroes idle over the
  threshold; a skill unused in a stage; level gaps; XP return off its band;
  calibration stale.
- **E. Economy**: a hub with one source; a stock with no sink; spawner upkeep
  above output; value per effort-minute far off the norm.
- **F. World map** (later): a ring-N cell asking ring-N materials; key
  materials not guaranteed; inner rings not covering every Live entry; an
  origin with no wedge; a cell's value off by more than ±10 %.

## The views (picture first, table a click below)

1. **Item page**: status chip; set tier against computed tier (traffic
   light); first reach ("~42 min · Mining 15, Smithing 10"); effort; skills;
   sources left, uses right; a **layered tree diagram** coloured by tier (red
   edges for later-tier ingredients, dashed for luck only); its problems and
   notes.
2. **Timeline**: a lane per skill, simulated time split into stages with
   budget bands; dots for first reaches; walls as red hatched bars labelled
   with the blocker; empty stretches grey; crowded clusters glowing; axis
   switchable to levels; click to the item page.
3. **Hubs and problems**: a fan-out bar chart coloured by tier; the problems
   list filterable by severity, tier, status and pack.
4. **Before-and-after**: the timeline with ghost dots and arrows; cards for
   stage time changes, walls grown or shrunk, checks turned red or green;
   moved entries by distance; in pack review and against the last Sync.
5. **World plan** (later): the hex grid by wedge and ring with the F checks.

## The agent gate

`node cms/changePackTool.mjs gate <pack>`: validate; apply in memory (pure
functions in `packReview.js`); run `runSim`, reach, checks and the simulated
player before and after; embed `pack.gate = { workspaceFingerprint,
toolVersion, summary, deltas }`. **Blocks** on any new Block finding, Live
entries referencing Planned ones, a stage time moving beyond tolerance unless
the pack declares the intent and matches it, and waivers the pack adds itself
(only the owner waives). Old problems are listed, not blocking. The inbox
flags packs with no or a stale gate and re-runs it on open; a plain-language
summary sits at the top.

## The calculator tie-in

- **Now**: the ledger calls `runSim` for cycle times, XP per cycle and values
  (shared dials: XPH pins, Tempo bands); "numbers stale, Recalculate first"
  when stored numbers differ from a fresh run.
- **Later**: stage budgets become inputs; a pacing solver proposes lever
  changes (level requirements, XP pins, build costs) as a **change pack**,
  never written automatically. One Balance chain: Recalculate → simulated
  player → checks → suggestions.

## The analyst's phased plan

| # | What | Tier | Done when |
|---|---|---|---|
| S0 | **Spike**: an abstract Starter Camp model against the headless engine on 3 setups; speed; Sync strip prototype | engineer | Within ±15 % on items and XP per skill; camp model under 50 ms; decision written |
| L1 | `plan` block, statuses, `plan.tier`, Sync strip, `cms/plan/plan.json`, rename repointing, pack fields | engineer | Planned never in `data/`; round-trip; rename keeps the plan |
| L2 | Shared reach and tree engine on a fixture world | engineer | Iron Ingot's tree to Iron Ore and Coal with effort; Iron Ore "Volcano map only" |
| L3 | Checks A–C and the item page | builder | The audit's findings on today's data; CMS eye-check |
| L4 | First fill pack: tiers on every Live item, stubs from the concept tables | builder | Owner reviews and syncs |
| L5 | Simulated player v1, `bench:calibrate`, checks D | engineer | Whole game under 1 s; the Construction 15 wall shows; calibration written |
| L6 | Timeline and hubs-and-problems views | builder | CMS eye-check; click-through to the item page |
| L7 | Before-and-after, the `gate` command, inbox display | builder | A sample pack shows its changes; a bad pack is blocked |
| L8 | Content fix pack, through the gate | builder | The audit rows clear; the timeline improves |
| L9 | Calculator suggestions and checks E | engineer | A suggested pack moves a stage toward its budget |
| Later | Wedge and ring, checks F, World plan; combat detail after brief 280 | engineer / builder | — |

Smallest useful version: L1–L4 (checks and the item page, no simulated
player).

## Risks

Drift from the real game (calibration, the stale check, play-throughs); a
moving target as briefs 260, 270 and 280 change the rules (model the
post-brief rules with a rules-version knob, re-calibrate after each merge);
a policy too dumb or too clever giving false walls (show every wall's
blocker and hero assignments); Planned stubs leaking or the `tier` fields
colliding (L1 tests, `plan.tier`); stub estimates looking certain (hatching);
workspace size in localStorage (measure in S0); up- and down-cycle loops in
the tree; a stale gate (fingerprint, re-run on open).
