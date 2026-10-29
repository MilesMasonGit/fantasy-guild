Status: draft

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

## The ledger (owner)

- **A spreadsheet file in the repo** (`docs/`, opens in Excel or Google
  Sheets) holds the plan: every item, Token, enemy and recipe, including
  things not yet authored, with its intended **stage** (Starter Camp, Plane 1,
  Plane 2, … or Parked) and, where it matters, a target time.
- **A time budget per stage** (owner): camp about 30 minutes, plane 1 about
  1.5 hours, plane 2 about a day (from
  [concept_progression.md](concept_progression.md)); an optional target on a
  single entity.
- **The CMS reads the spreadsheet and flags disagreements** (owner): a "reach
  engine" works out when each thing is actually first reachable and by what
  path ("Iron Ore ← Iron Vein (Mining 15) ← Volcano map ← Goblin Chief first
  kill"), and lists:
  - reachable earlier than planned (a leak), later, or never (a break);
  - reachable only by luck;
  - a level gate the skill cannot reach inside its stage's time budget (the
    simulator's XP rates);
  - a tool no recipe makes; produced but unused, used but never produced;
  - in the plan but not in the CMS, or in the CMS but not in the plan.
  Parked rows are silenced.
- **Views**: a chain view (stages as columns, filter by skill) and a pacing
  strip per skill (level gates against the level expected at each stage's
  time).
- **The game's encyclopedia and collection log** later read the same reach
  engine, so the player's "found on …" matches the owner's ledger path.
- An agent drafts the first spreadsheet from
  [concept_basic_content.md](concept_basic_content.md)'s tables and the data;
  the owner reviews it.

## Content fixes (owner: the recommended set, one agent pack)

After the ledger exists, so its red rows guide the pack, reviewed in the CMS:

- Camp leaks move to their plane: Beehive, Alchemy Table, Apple Orchard,
  the bird-nest route to lavender, the Goblin Camp in the Shop.
- Plane-2 buildings down to about Construction 5–8, build XP raised.
- Copper recipes for the sickle, rod and trap.
- A use in its plane for each unused item (fish, bones, beeswax, grape seed).
- The Goblin Chief down to about level 12.

## Gating: open (owner)

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
