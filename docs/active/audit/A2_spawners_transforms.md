# A2: Spawners and transforms
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Two things make the mat change by itself. **Spawners** put new Tokens beside
themselves on a clock, up to a limit: 22 of them, all built on a Foundation
(the Oak Forest, Fir Forest and Apple Orchard on Farmland, the Quarry on an
Excavation, 18 enemy camps on a Battlefield). **Transforms** turn one Token
into another: a Sapling grows into a Tree, a felled Tree becomes a Stump, a
Stump grows back into a Sapling. Random turning (`turns`) is used by no
content and you ruled to retire it. Your other ruling, cut Saplings so a
Stump grows straight back into a Tree, means deciding what the Forests and
the Orchard plant instead.

## What the player sees and does

- **Build a spawner** on its Foundation; it plants or spawns every few
  seconds until its limit, then waits.

  | Spawner | Puts down | Limit | Every | Costs each |
  |---|---|---|---|---|
  | Oak Forest | Oak Sapling | 5 in its reach | 20 s | 1 Oak Seedling |
  | Fir Forest | Fir Sapling | 5 in its reach | 30 s | 1 Fir Seedling |
  | Apple Orchard | Apple Sapling | 2 in its reach | 45 s | 1 Apple Seed |
  | Quarry | Stone Outcrop | 3 on the mat | 30 s | nothing |
  | 9 enemy camps | their enemy | 3 each | 30 s (Cow, Thorn 60 s) | nothing |
  | 9 boss camps | their boss | 1 each | 300 s | nothing |

- **The tree chains** (oak and fir; birch, maple, mahogany, ebony and cedar
  the same without a Forest):

  ```
  Forest plants → Sapling → (150 s oak, 240 s fir) → Tree
  Tree felled 5 times (others 100, cedar 1000) → Stump
  Stump → (150 s / 240 s, needs its Forest in reach, costs a seedling) → Sapling
  ```

  The other trees' Stumps grow back with no Forest needed (300 s and a
  seedling); no spawner plants them. Birch, Maple and Mahogany "Forests" are
  not spawners but big nodes that run dry and rest.
- **The Apple Orchard** plants Apple Saplings (45 s to a tree); an Apple Tree
  is picked 3 times, rests 180 s and fruits again, only with an Orchard in
  reach.
- **No room**: a spawner with nowhere to put its Token says so with an alert
  and tries again a whole interval later, paying nothing.

## What really happens underneath

- **Three ways of counting a limit**:
  - **Forests and the Orchard** count their trees standing in their reach
    (Saplings, Trees and Stumps, map trees too).
  - **Camps** count only the enemies they spawned.
  - **Everything else** (only the Quarry today) counts mat-wide, against the
    sum of all such spawners' limits.
- **Camp clocks stand at zero while full**, so a beaten enemy comes back a
  whole interval later; other spawners keep counting and replace a loss on
  the next tick. A camp also sleeps while its place's arrival enemies stand.
- **The mat cap** (128 Tokens) stops a spawner too; quest and event Tokens and
  the Hall don't count toward it.
- **A transform keeps** where the Token came from and its camp; it **loses**
  its uses, clocks and any work in progress, and its hero lets go.
- **Random turning** (Coast into Shrimp Coast) is gone from content but its
  machinery still runs every tick and the CMS still offers it.
- **Rule spawns**: one effect would spawn a Fire Elemental (2% a cycle), but
  no Token carries it and the game refuses rule spawns of enemies anyway. No
  content transforms by rule.
- **Seven ways something new finds a spot, five answers to no room**:

  | What lands | How | No room |
  |---|---|---|
  | A spawner's Token | nearest free spot (in reach for Forests) | alert, waits an interval, pays nothing |
  | A bounty | beside the Hall | tries next lap |
  | An event | random spots, no shoving | tries another event, then later |
  | A crafted Token | room checked before the cycle pays | if it still fails, the inputs are gone (a log line only) |
  | Arrival enemies | near the Hall, no cap check | left out silently (a log line) |
  | A Shop buy | where dropped, cap checked | flies back, nothing charged |
  | A building | in place on its Foundation | checked before building |

- **Orphans**: the Wheat Sprout grows into Ripe Wheat, but nothing makes a
  Wheat Sprout (Fields use their own block now).

## What the owner controls in the CMS

Spawner block: what it spawns (by weight), limit, interval (at least 1 s),
cost, plant within reach. Grows block: into, time, needs one of these in
reach, cost. Respawns block: refill (rest, resting picture, needs in reach)
or regrow (into). Turns block (still offered). Not in the CMS: the nearest
free spot, the reach size, the mat cap 128, how a family is counted, camp
clocks held at zero, the instant regrow.

## What it touches, and where it overlaps another system

- **Forestry** (A7) and **Farming** (A9): trees, Stumps, Orchards, Fields;
  the four ways "it comes back".
- **Enemies** (A32, done): camps only, every enemy one use (T-545), bosses from
  camps (T-547).
- **Placing and reach** (A1): Foundations, the mat cap, finding a spot.
- **Events** (A4) and **Quests** (A38): their own landing rules.
- **The world map** (A39): arrivals and sleeping camps.
- **Telling the player** (ready to brief): spawn notices, no-room alerts.

## Where it differs from the GDD

- The spawner table is stale: Oak Seed (now Oak Seedling), a Wheat Field and
  Copper and Coal Mine spawners (gone), a Goblin Chief in the Goblin Camp
  (gone); Fir Forest and 17 camps missing.
- "Two Oak Forests → 10 trees": Forests count in their reach, not mat-wide.
- Growth times (Oak Sapling 30 s in the GDD, 150 s in data); the regrow
  example (Oak Tree → Oak Sapling; data: → Oak Stump); "no shipped Token uses
  it yet" for needs-in-reach and cost (the Stumps do).
- The Coast ⇄ Shrimp Coast row (gone).

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game (it has an Oak Forest and a Goblin Camp). QA panel:
   20 Oak Seedlings.
2. **Watch the Oak Forest** plant Saplings every 20 s up to five; watch one
   grow into a Tree.
3. **Fell a tree five times**: it becomes a Stump; with the Forest in reach
   it grows back into a Sapling, then a Tree.
4. **Pick up the Oak Forest** while a Stump is growing: the Stump's clock
   stops, with a yellow mark.
5. **Fill the mat around the Goblin Camp**: the no-room alert.
6. Ask yourself: with Saplings cut, what should a Forest put down: a Stump
   that grows, or a full Tree?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **What a Forest plants** (Saplings cut): a full Tree.
- **Stumps**: every Stump needs its Forest; every wood gets a spawner Forest
  and the big rest-and-refill Forest nodes retire.
- **Seedlings**: every new or regrown Tree costs one.
- **No room**: one rule: wait, pay nothing, say so.
- **Limits**: in reach for all but camps.
- **Camp clocks**: keep the difference.
- Random turning retired (ruled 2026-11-20, hover vs card topic); leftovers
  filed without asking.

## What it became

- **T-596** (director; content agent): no Saplings: Forests plant full Trees, Stumps grow into Trees.
- **T-597** (content agent): every wood has a Forest that plants it.
- **T-598** (director): one rule for no room.
- **T-599** (director): spawner limits count in reach, camps their own.
- **T-600** (director; content agent): leftovers (random turning retired, the Wheat Sprout and ambush effect, stale comments).
- **T-601** (planning agent): GDD §3 Spawners and Transforms.
- Fine as is: camp clocks stand at zero while full; rule spawns of enemies refused.

All six tickets blocked on the living mat group.

## Evidence

- Spawners in data → `data/tokens.json` (`spawner` blocks); built in place → `data/tokenRecipes.json`, `src/systems/board/Foundations.js` (buildInPlace), `src/systems/board/EffectActions.js:392-431`
- Spawn attempt order, no room, paid after landing → `src/systems/board/SpawnerSystem.js:369-421`; alert → `:389-393, 526-530`
- Families → `SpawnerSystem.js:210-234`; three counts → `:178-183, 294-309`
- Camp clock held at zero, sleeping → `src/systems/board/TimedChanges.js:285, 438-441`; retry while held → `:471-474`
- Mat cap → `src/systems/board/MatCap.js:28-36`
- Tree chains → `data/tokens.json` (`grows`, `respawn` on the oak, fir, birch, maple, mahogany, ebony, cedar Trees, Stumps and Saplings; Apple Tree)
- Transform keeps and loses → `EffectActions.js:392-431`, `TimedChanges.js:65-68`; regrow next tick → `:332`
- Turns machinery, no content → `TimedChanges.js:239-277`; CMS → `cms/src/components/editors/LifecycleBlocks.jsx:228-256`
- Rule spawns refused for enemies → `src/systems/board/TriggerSystem.js:240-247`; the ambush effect → `data/effects.json` (`effect_fire_elemental_ambush`)
- Landing ways → `EffectActions.js:171-229`, `src/systems/quests/QuestTokens.js:188-211`, `src/systems/events/EventClock.js:210-223, 316-321`, `src/systems/board/BoardRunner.js:165-188`, `src/systems/world/Arrival.js:204-216`, `src/systems/board/Shop.js:107`
- Wheat Sprout orphan → `data/tokens.json` (`token_wheat_sprout`, no maker)
- CMS blocks → `LifecycleBlocks.jsx:117-256, 405+`
- GDD → `docs/reference/GDD.md:248-300, 325-370`
