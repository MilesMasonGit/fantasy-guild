Status: briefed 2026-10-28 (ledger and content fixes approved 2026-10-28; amended 2026-10-29: the plan lives in the CMS; brief 290 rewritten). Gating moved to concept_world_map.md.

# Progression ledger: tracking when content arrives

*Owner interview, 2026-10-28, after an analyst's audit of today's data. Owner's
concern: as content grows, tracking it and its dependencies feels cobbled
together; when content becomes available is core to progression and needs
careful balancing; "we need a cohesive pacing plan that covers each item,
token, enemy and recipe to plan out the game writ large." Builds on the
approved, unbuilt CMS dependency map and collection log
([concept_knowledge.md](concept_knowledge.md)). **How content is gated (maps or
otherwise) is a separate open question**, below.*

## What the audit found (data of 2026-10-28)

- **The Starter Camp already holds almost all of plane 1's crafting** (all
  copper gear, honey, apples, beer, most buildings); plane 1 adds mostly
  enemies, bosses and fruit.
- **The first iron is the least readable step**: only the Volcano map has
  iron; a sure Volcano map comes from the Goblin Chief (level 20, above
  plane 2's enemies) or the Queen Bee on a rare map; otherwise 3 % per boss.
  Fir is easy, and the iron buildings need both.
- **Walls**: the five plane-2 buildings need Construction 15 while builds pay
  5–20 XP (checked: Iron Smithy, Iron Furnace, Fir Workbench, Tannery, Fir
  Forest); no recipe makes the Copper Sickle, Fishing Rod or Trap (checked),
  so one hero at a time can fish or harvest.
- **Loose ends**: fish, bones, beeswax, grape seed made but unused; 39 items
  and 41 Token types unreachable, many parked on purpose, and nothing tells
  parked from broken; the plan's tables and the data disagree in places.
- **Tools today** (the CMS Economy Audit, the simulator, the progression
  screen) answer "what is it worth", never "when does the player get it". The
  game already records where each item came from (a collection-log base,
  `RegistryManager.js`), unshown.

## The tool's goals (owner interview, 2026-10-29)

*Before a deeper analysis; the owner asked for an analyst to plan what the
system needs. These goals steer it.*

- **For**: the owner, planning and balancing; and **content agents**, whose
  change packs **must pass its checks** (and the simulated player) before they
  reach the owner's CMS inbox.
- **The key question: is the game well paced?** When a player reaches each
  thing; walls, empty stretches and crowded spots, per skill and per tier.
- **Horizon: the whole game**, including unmade content as Planned stubs, so
  the full shape can be judged before content exists.
- **Timing by a simulated player**: a virtual guild plays through the content
  (heroes, one job each, levels, travel, building) and reports first-reach
  times and how long each wall lasts.
- **Changes show a before-and-after of pacing**: what moved earlier or later,
  walls that grew or shrank, checks that turned red or green, before syncing.
- **Visual first, tables underneath**: a timeline per skill, a tree diagram per
  item, sortable tables a click away.
- **Success** (owner's words): "I want the content to make sense, be robust,
  and well balanced." **Later it is tied to the calculator** (the CMS's
  economic simulator, Recalculate) so XP returns and other pacing elements
  give balanced gameplay.

## Pathing and a rate calculator, not a pretend player (owner, 2026-10-29)

*Supersedes every "pretend player" / "simulated player" line in the sections
below (kept as the record). The owner's worry: a pretend player cannot model
every factor in gameplay rates, would create bad data and throw off
decisions. The owner's answer: "we really just need pathing and a good rate
calculator to balance XP and cycle time for tokens and recipes", also used
to tune how effective boosts should be.*

- **Pathing**: the reach and tree engine (what leads to what, at which level).
- **A rate calculator with factor switches** (owner): for every Token and
  recipe, cycle time, items per hour and XP per hour, from the data and **the
  game's own formulas and rules code** (shared, not rewritten), listing every
  factor applied. Factors switch on or off: buildings and supports, perks,
  Guild Hall upgrades, consumables, tools and gear. **Balance around the full
  spectrum of possible rates** (owner).
- **Profiles**: **Bare** (levels and basic tools), **Typical** (a sensible
  investor at that point: upgrades and supports that pay back in reasonable
  time, consumables that pay for themselves) and **Maxed** (every boost).
  **The pace curve aims at Typical**; Bare must stay playable and Maxed must
  not trivialise it, within bounds that are settings (default: at most 3x
  slower or faster than the curve) (owner).
- **Boost strength by kind** (owner): targets for how much each kind of boost
  contributes at each tier (e.g. buildings up to +30 %, consumables +20 %,
  Hall up to +100 % late); the calculator shows where actual boosts sit
  against them, and balancing later adjusts them.
- **Walls and stage times come from path time at each profile** (owner): for
  each unlock, the time along its path (levels to gain, items to gather) at
  that profile's rates; a wall is a step over twice the curve's expectation;
  a stage's time is the sum along its path. Static and readable, every step
  shown.
- **An "unmodelled factor" check** (planning agent's default, from the trust
  discussion): any rule, effect or mechanic the calculator can't interpret is
  listed, never silently ignored.
- **Report first, balance after proof** (owner): automatic balancing starts
  only after the calculator agrees with real play on a few milestones (the
  test build's comparison with the real engine, and real play); until then
  its proposals are a preview.

## The rate calculator, proved against the engine (S0 spike, 2026-10-30)

*Engineer's findings for brief 290 phase S0. Measured: every number below came from a run;
reasoned: the decision and the notes for L5.*

**In plain words.** The calculator works out, from the content alone, what one hero earns on any
Token or recipe: how long a cycle takes, how many cycles an hour the work can offer, the items and
XP an hour, what it spends, and which factor moved each number. It was played against the real
engine on five small boards of shipped content, eight game-hours each, three luck seeds: every rate
agrees within 1 %, far inside the ±15 % the brief asked. It rates all of today's content in about
5 ms. It found one engine fault and one placement trap on the way.

**The numbers** (engine = the game's own catch-up, mean of seeds 1-3 × 8 game-hours after a warm-up;
calculator = `chainRates` on the same setup; per hour):

| Setup | Rate | Engine | Calculator | Diff |
|---|---|---|---|---|
| One hero on a Copper Ore Vein | ore | 359.0 | 360.0 | +0.3 % |
| | Mining XP | 240.0 | 240.0 | 0.0 % |
| Vein with a Minecart and a Copper Mine in reach, feeding a Furnace on Copper Ingots (coal in stock) | ore | 466.5 | 468.8 | +0.5 % |
| | ingots | 116.6 | 117.2 | +0.5 % |
| | Mining XP | 250.0 | 250.0 | 0.0 % |
| | Smithing XP | 116.6 | 117.2 | +0.5 % |
| Oak Forest worked from a Logging Camp by one forester | oak wood | 565.8 | 562.5 | -0.6 % |
| | oak seedlings | 76.2 | 75.0 | -1.6 % |
| | bird nests (3 %) | 12.1 | 11.3 | -6.9 % (luck: ~95 nests a seed) |
| | Forestry XP | 377.6 | 375.0 | -0.7 % |
| The vein with Beer (+10 % XP) | Mining XP | 480.0 | 480.0 | 0.0 % |
| | Beer drunk | 28.9 | 24.0 | -16.9 % (engine fault, below) |
| The forest with Lemonade and Birdwatcher potions | oak wood | 624.0 | 618.8 | -0.8 % |
| | bird nests | 106.0 | 106.1 | +0.1 % |
| | Lemonade / Birdwatcher drunk | 37.8 / 377.5 | 37.5 / 375.0 | -0.7 % |
| | Forestry XP | 377.6 | 375.0 | -0.7 % |

Cycle counts match exactly on the veins (240 and 250 an hour) and within 0.7 % on the forest; what
is left is luck on the rolls. Re-run with `node bench/calibrate.mjs` (all five, about a minute);
`--only=vein --hours=4 --seeds=1,2` narrows it; `--trace` records the board events of a run.

**How it works** (`src/systems/progression/ledger/rates.js`, pure, data passed in like the reach
engine): for a Token or a recipe at a station it collects the rules that reach the worked Token
(its own `self` rules and the supports named in the setup), the hero's (the tool and worn gear, the
effect a drink or work potion puts on them for each cycle, milestone perks at their level) and the
guild-wide ones (a Region's rules, guild modifiers), resolves each axis through one set of buckets
as the board does, and takes every chance at its average. A work's rate is the smaller of the hero's
pace (an hour over the cycle) and what the Token can offer between rests: a vein's charges over its
charges' work plus its rest, a felled tree's charges over its work plus the grow times of its stump
and sapling (times the spawner's family taking turns), unlimited for a station. `chainRates` runs
several works off one Bank and slows a station to the inputs the works beside it make.

**The game's own code, shared, not copied.** The three buckets (`ModifierAggregator`), the speed-up
and one-second floors, the XP floor, the output range, a cycle's charge cost, the reach and filter
rules, the dose rules and a Region's rules are imported. Five of them lived in modules that load the
board, so they moved, unchanged, into small pure modules the board now reads from (`workTime.js`,
`xpBonus.js`, `cycleCharges.js`, `regionModifiers.js`, `tokenConstants.outputRange`, and
`filterRegistry.targetModeMatches`). Two pieces could not be shared without reworking a hot path:
which ambient rules reach a Token (`TileModifiers.applicableStatements`) and what a hero's items add
(`heroContributions`). The calculator follows them step by step, and `LedgerRates.test.js` places
the same supports (near, far, a no-stack copy twice, a self-only rule, a board-wide rule), worn
gear, a drink, a perk and a Region rule on a real board and checks every axis against
`TileModifiers.resolveAxis`, and the grow times against `growTimeOf`. Neutering the reach check, the
no-stack guard, the XP floor or the hero's skill narrowing each fails that test.

**Factors modelled** (each switchable by id or by kind, `off: ['support:token_copper_mine']`,
`off: ['consumable']`): supports in reach (and board-wide ones), the tool (its tier gates the work;
no shipped tool speeds work yet), worn gear, drinks and work potions (with what they cost an hour),
milestone perks (none shipped yet; tested on a fixture table), a Region's rules (none shipped yet),
guild-wide modifiers (no Hall upgrade moves a rate today), the hero's level (a gate only: a level
adds no work speed in the game), failure chance, double loot, one-item doubles, bonus drops, input
cost, refill and regrow times, a spawner's family. **Not modelled yet, each listed in the result's
`unmodelled` rather than dropped**: fights (until brief 280), water and its catch pools, Fields and
crop loads, builds on a Foundation (paid once), Passive Production, triggered rules (an ambush on a
vein's cycle), statuses a Token puts on its worker, filters that read a Token's charges, effects that
last a time rather than a cycle, gear level requirements, more than one hero on one family
(queueing), and walking (measured: inside the 1 % above on these boards).

**Speed** (i7-8700, Node 24): every Token and recipe of today's content (228 asked, 153 rated, the
rest not work or not modelled) in 23 ms cold and about 5 ms warm; a busier setup (three supports and
a drink) about 9 ms; one rate 0.09 ms. All 99 levels × 3 profiles × every rate is 1.7 s, so L5
should rate per profile and per gate change, not per level (rates do not change with level today).
The engine plays a game-hour of these small boards in 0.14-0.29 s.

**Workspace size with stubs** (the CMS's localStorage copy, built from today's `data/` and the
first-fill pack, `2026-10-30-ledger-first-fill.json`, 367 edits and 15 creates): 207,242 characters
before, 239,626 after (+32,384, +15.6 %): about 28,500 for the plan blocks and 4,600 for the 15
Planned stubs (about 300 each). That is 4.6 % of a 5 MiB quota counted in characters, 9.1 % counted
in bytes; about 7,700 more stubs would fit at the strict reading. No size problem. The Sync strip
(Planned stubs and plan blocks kept out of `data/`) was built in L1 (`cms/src/engine/planFile.js`)
and is unchanged.

**Found on the way.**
- **Engine fault: a vein that refills at the end of a step announces its next cycle twice.** The
  refill tick leaves the cycle's clock at exactly zero, so the next tick starts it again
  (`BoardRunner.tick`, the negative carry from `TimedChanges.lateRefillsThisTick`). Nothing is made
  twice, but a drink's dose counts one cycle too many and a work potion is drunk twice after every
  refill: Beer goes 20 % faster than its rule on a copper vein. Measured on the catch-up's 1 s steps
  (traced: two cycle starts at every refill); live 100 ms ticks should land the 60 s rest on a tick
  boundary the same way (reasoned, not measured). Proposed as a ticket; the calibration marks it
  known.
- **A camp must reach the whole family.** With the Logging Camp two steps from the Oak Forest, two of
  the five trees stood outside its 360 u reach, were never felled and still counted against the
  forest's allowance: the forest ran at 60 % (225 cycles an hour against 375). One step away, all
  five are worked. The calculator takes the family's size from the setup (the allowance by default);
  where things stand on the mat is the player's, not the calculator's.
- **The XP floor doubles a +10 % XP drink on a 1-XP cycle**: Beer takes copper mining from 240 to
  480 XP an hour (a positive bonus always adds at least 1 XP). The calculator shows it because it
  uses the game's floor; whether that is wanted is a balance question.

**Decision: build L5 on this calculator, keep the calibration.** The rate calculator is the right
core: it agrees with the engine to within 1 % on every setup, runs in milliseconds, runs Planned
stubs as soon as they carry numbers, and names every factor. L5 adds the profiles (Bare, Typical by
payback, Maxed) as setups, the remaining kinds of work (water, Fields, Passive Production, coarse
fights), path time per unlock, the pace curve and checks D, and turns `bench/calibrate.mjs` into
`npm run bench:calibrate` with its stamp and the "calibration stale" check. The calibration runs in
its own processes and never loads the bench's fixtures (their recipe pools take over shipped skills).
Nothing to throw away.

## The pace in full (L5, 2026-10-30)

*Engineer's notes for brief 290 phase L5. Measured: the calibration table and the numbers on
today's data. Reasoned: the rules below, each a choice the owner can overrule in the Ledger
settings or by answer.*

**What the Ledger now says.** For every Token and recipe, its rate at three profiles with every
factor named and switchable; for every entry, when a new game first has it (path time) at each
profile, step by step; per skill, how long each level takes and where the XP comes from; and the
pacing problems (group D) beside checks A to C. A **Pace** page shows the stages against their
budgets, the per-skill breakdown and the Guild Hall's paybacks. The timeline is L6.

**Every kind of work is rated** (`rates.js`): veins, trees and bushes as before, and now water (one
catch a cycle by weight, Catch Weight read, bait spent), Fields (harvested their load, then regrown;
Crop Load and Grow Time read; the seed paid once a sowing), builds on a Foundation (the recipe and
the Foundation's Shop price are its inputs, so Construction XP has a rate), Passive Production (the
Guild Hall's lines and the Wishing Well's Water by rank) and fights (coarse: one kill a fight
cycle, as fast as the enemy's camp spawns it, first-kill drops not a rate, combat XP listed as
unread). A camp hands one hero several copies of a vein or Field (`campMembers`, default 3) or a
forest's whole family.

**The profiles** (`profiles.js`). **Bare**: only what the work needs to run (the Forest a stump
regrows beside, the camp that spawns an enemy, the Hall ranks that are free), one copy, the lowest
tool. **Typical, a sensible investor**: boosts are tried one at a time, the quickest payback first,
each against what is already chosen; a building, camp, better tool or gear is taken when its price
(in Bare hours of work, the starter camp's own buildings free) over the hours it adds an hour is
within `paybackHours` (default 2 h); a drink or work potion when it adds more than it costs as it is
drunk. **Maxed**: Typical's choices plus every other boost that lifts the rate, whatever it costs (one
drink, every helpful potion, the best of each gear slot, every support once). A boost the guild
cannot make by then is never on offer. What a boost adds is the items' worth (each at the Bare hours
one takes) plus XP (an hour's worth at the rate before it), times the share of the work the guild
can feed.

**Supply and path time** (`pace.js`). An item's supply at a stage is its best source reachable by
then, fed by one hero on the best source of each input (one job per hero; a loop's own input taken
as in stock). A skill's level takes the XP it needs over the best fed XP an hour among the work open
at that level and reachable by the stage that first asks for it. An entry's path time follows the
path the reach engine shows: a step starts once everything it needs is had and its level gates are
reached (skills level side by side), then takes its own time (gathering a one-off price, a build, a
cycle, a chance at average luck). Heroes work through check-ins and nights; a step that waits on the
player is not delayed (owner question below).

**Checks D.** A **wall**: a run of levels whose Typical time is over `wallFactor` times the curve,
filed under the skill with what waits on it (and shown on each waiting entry's page). A **long wait
for one unlock**: a step's own time over `wallFactor` times what the curve gives a level where the
player is by then, at least a check-in. A **stage off its budget**: the slowest entry planned for it
at Typical against the cumulative budget, ±tolerance. **Bare or Maxed out of bounds**: the time to
the top level each stage asks, against the curve, beyond `profileBounds`. A **Guild Hall rank slow
to pay back** (only the ranks that add a rate: Bunk Beds a hero, the Wishing Well Water; the rest
are listed as not a rate). A **boost over its target** (by kind and stage, at Maxed, once per set of
boosts with every work it lifts). **What the calculator cannot read**, per entry. **Calibration
stale**: `npm run bench:calibrate` writes `bench/calibration/stamp.json` with a hash of every file
the calculator imports or follows; when one changes, the Ledger says so until it is run again.

**Calibration, measured** (`npm run bench:calibrate`, 3 seeds × 8 game-hours each, engine against
calculator): the five S0 setups as before (all within 1 %, bird nests -6.9 % by luck, Beer's known
engine fault), and three new ones: a Mining Camp working three Copper Ore Veins (ore -0.1 %, XP
0.0 %), one fisher on the Coast (catches -5.1 % to +0.4 %, XP 0.0 %), one farmer on a Wild Wheat
Patch (wheat -0.3 %, seeds +2.4 %, XP -0.8 %). Builds, fights and Passive Production are not
calibrated.

**Not modelled, each listed rather than dropped**: triggered rules, statuses a Token puts on its
worker, filters on a Token's live charges, effects that last a time, combat XP and whether a fight is
won, bounties and trading maps up (their steps are untimed, so a path through them is a floor),
taking a building down, walking, several heroes queueing on one family.

## The system design (owner, 2026-10-29)

*From the analyst's [system plan](research/ledger_system_plan_2026-10-29.md);
the owner's answers to its questions.*

- **A planning desk in the CMS** with a `plan` block on every entity
  (status, `plan.tier` kept apart from the existing gear `tier` field, note,
  optional targets, later wedge and ring), a shared reach-and-tree engine,
  a **pretend player** (a fast abstract model of a guild, not the real engine,
  kept honest by calibration against the real engine), about thirty checks
  in six groups, four views (item page, timeline, hubs and problems,
  before-and-after) and an agent gate.
- **Drafts sync into the game like Live** (owner); only Planned stubs stay
  out. The ledger labels Drafts.
- **The budgets assume the target player** (owner): game open in the
  background, checks in every 30–60 minutes, away 8 hours overnight.
- **A stage turns red beyond ±25 % of its budget** (owner).
- **Pacing philosophy** (owner): **players fly through the first levels; the
  last levels need specialised setups and resources to gain a level every few
  days.** The tool holds a **target time-per-level curve** (a few points the
  owner sets; the curve drawn between them); **a wall** is where the pretend
  player waits much longer than the curve expects for its next unlock or
  level (default: more than twice the expected time).
- **Luck: average only** (owner): luck averages out over long play; no
  bad-luck runs.
- **Balancing is automatic** (owner): "I don't want control over individual
  numbers. A human won't be able to plan that well, we need it
  algorithmically balanced." Later, Recalculate **sets the numbers itself**
  (XP returns, level requirements, costs, times) to bring pacing onto the
  curve, as today's Recalculate already writes prices back. The owner sets the
  curve and the plan; the algorithm sets the numbers.
- **Build: a test build first, and tied into the CMS as early as possible**
  (owner): the ledger lives in a CMS tab from its first phase, and every later
  phase adds to that tab.
- **Every rate source counts in the pace curve** (owner, 2026-10-29): the
  player invests in Guild Hall upgrades, **buildings** (supports such as Mines,
  Minecarts, a Well's Grow Time, Composters, camps) and **consumables** (drinks,
  work potions, elixirs) to raise rates, as well as tools, gear and milestone
  perks. The pretend player models all of them.
- **The curve assumes a sensible investor** (owner): the pretend player buys an
  upgrade or builds a support when it pays back in reasonable time. **Every
  Guild Hall upgrade must "pay off" after an amount of time** (owner): the time
  it saves outweighs the time spent gathering its price; the ledger checks
  each rank's payback time, and the automatic balancing prices ranks to it.
- **Consumables are used when they pay for themselves** (owner): only if the
  time saved is worth more than making them, counting the guild's time spent
  making them; their recipes are balanced against the rates they give.
- **A per-skill breakdown of rate sources** (owner): for each skill, where its
  rate comes from at each point (base, Hall boosts, buildings, consumables,
  tools, perks), so a late game leaning too heavily on one source shows.
- The virtual guild follows the game's real roster rules (planning agent's
  default).

## The ledger (owner; amended 2026-10-29)

*Amended 2026-10-29 (owner): the plan lives **inside the CMS**, not in a
separate spreadsheet. The owner's reasons: the world map's origins and
complex crafted items need a bigger solution than rows in a sheet.*

**What it must do** (owner, all four): show **every item's sources and
uses**; show a **crafted item's whole tree** down to its origins; **plan
where things belong**, including things not yet authored; **catch problems
automatically**. "Prioritize" means **when the player gets things** and
**what matters most to balance** (owner).

- **The plan lives in the CMS** (owner). Every item, Token, enemy and recipe,
  authored or only planned, is an entry with a **status: Planned, Draft,
  Live or Parked**. A Planned entry is a stub (a name, a tier, a note) that a
  later content pack fills in. Parked entries are silenced in the checks. An
  export to a spreadsheet stays possible for overviews.
- **Every item gets a tier set by the owner** (owner: always hand-set, crafted
  items included). The tool **computes the tree** behind each item and checks
  it against the set tier.
- **Computed from the tree** (owner): each item's **total effort** (time across
  all its ingredients down to the origins; the simulator already prices
  effort), **the skills it touches**, **its depth**, and **its earliest reach**
  (tier, levels, and later wedge and ring): "42 min of work, 4 skills, needs
  tier-2 ores and tier-1 herbs".
- **A time budget per stage** (owner, 2026-10-28): camp about 30 minutes,
  plane 1 about 1.5 hours, plane 2 about a day; stages are tiers for now.
- **The reach engine** works out when each thing is actually first reachable
  and by what path ("Iron Ore ← Iron Vein (Mining 15) ← …"), as one shared
  module the CMS and later the game's encyclopedia and collection log use.
- **Automatic checks**: reachable earlier than its tier (a leak), later or
  never (a break); a tree whose ingredients come from a later tier than the
  item's; luck-only sources; a level gate unreachable inside its stage's
  budget; a tool no recipe makes; produced-but-unused, used-but-never-produced;
  Planned stubs nothing points to.
- **Views, in the owner's order of use** (owner):
  1. **Item page**: all sources (wild nodes, drops, side sources, recipes), all
     uses, the full tree, effort, earliest reach, status, set tier.
  2. **Progression timeline**: every item by when a player first reaches it
     (time and levels), per skill; crowded and empty stretches stand out.
  3. **Economy hubs and problems**: items ranked by how many recipes depend on
     them (where balance hinges), and the list of automatic problems.
  4. Later, with the world map: a **World plan** grid of wedges by ring.
- **The world map comes later** (owner): the ledger is built on tiers now;
  when [concept_world_map.md](concept_world_map.md) is approved, **wedge and
  ring** are added to origins and the World plan view arrives. Meanwhile the
  ledger helps price the world map's cells.
- Tiers will move as content settles (owner): Ores and Trees are mostly
  settled; Crops and Herbs are still undefined.

## Content fixes (owner: the recommended set, one agent pack)

After the ledger exists, so its red rows guide the pack, reviewed in the CMS:

- Camp leaks move to their plane: Beehive, Alchemy Table, Apple Orchard,
  the bird-nest route to lavender, the Goblin Camp in the Shop.
- Plane-2 buildings down to about Construction 5–8, build XP raised.
- Copper recipes for the sickle, rod and trap.
- A use in its plane for each unused item (fish, bones, beeswax, grape seed).
- The Goblin Chief down to about level 12.

## Gating: open (owner)

> **Moved on 2026-10-28/29**: the workshop became [concept_world_map.md](concept_world_map.md) (draft): a world map of fog cells around the Hall, requirements per cell, an arrival fight, landmarks per tier; map items retire.

None of the options so far satisfied the owner: crafting maps from a boss
trophy, explaining drops better, a Charter checklist, ore-fragment hints,
Cartography Table ranks, no map gate, a plane guardian. The owner wants to
**approach the problem differently: first pin down what is wrong with the
mechanic and where we want to be.** What a good gate does (owner):

- **The player sees it coming**: the next plane is a visible goal long
  before it is reached.
- **It feels like discovery**: an achievement or surprise, not a checklist.
- **It uses many skills**: gathering, crafting and combat together.

What is wrong today (owner): maps as the gate are **hard to balance** and
**feel indirect** (the player cannot see why iron is missing or what to do).

### How we pin it down (owner, 2026-10-28)

Both, then a workshop: a **player-journey walkthrough** of the first hours
under today's rules (scored against the three goals) and **a study of how
other games gate progression**, saved in `docs/active/research/`; then a
workshop session to name the problem and the target before any fix.
