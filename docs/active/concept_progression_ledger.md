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
