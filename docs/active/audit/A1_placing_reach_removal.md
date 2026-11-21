# A1: Placing, reach and removal (with A3 Demolition)
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

The mat is one open surface with room for 128 Tokens. The player buys
Foundations from the Shop, drops them where they like (exactly there, nudged
up to 160 u, or flown back), picks a building and a hero builds it in place.
Most Tokens can be dragged anywhere; trees, veins, map nodes and planted
Tokens stay where they stand. One reach, 240 u, is used by every rule that
cares about neighbours, shown by a gold ring and dots. Taking a Token off
the mat is mostly demolition: mark it in the top bar's map mode and a
Construction hero clears it in 10 s, for nothing back. Only an unbuilt
Foundation can go back to the Shop for its price.

## What the player sees and does

- **Drop a Token**: it lands where let go if the spot is legal (inside the
  mat, not crowding a neighbour, on ground it may stand on, breaking no
  "cannot" rule); otherwise the nearest legal spot within 160 u; otherwise it
  flies back. A Token takes the room of the largest thing it can become (a
  Stump its Tree's, a Foundation its largest building's).
- **Move a Token**: drag it; it keeps its progress and its hero follows.
  Trees, fruit trees and veins (marked Stays where it stands), map nodes,
  camp fixtures and planted Tokens can't be dragged.
- **Carry a Token**: while in the hand it stops working, growing and
  turning; its upkeep and rule cooldowns carry on.
- **The cap**: the top bar shows "n/128", red at the cap; the Shop says
  "Token cap full"; a blocked station or spawner shows it. Quest Tokens, event
  Tokens and the Hall don't count.
- **Reach**: hovering or carrying a Foundation, a camp or a Token with a
  nearby rule draws the gold ring; every Token inside wears a cream dot.
- **Foundations**: five kinds (Wood, Stone, Farmland, Excavation,
  Battlefield). Drop one, choose what to build, a Construction hero builds it
  (30 s to 4 minutes, levels 1 to 10); materials are taken when the build
  finishes.
- **Taking Tokens off**, four ways:

  | Way | For | Gives back |
  |---|---|---|
  | Demolish (top bar's map mode, click to mark) | anything bought, built, spawned or planted | nothing; a Construction hero works 10 s, no XP |
  | Drag onto the Shop | an unbuilt Foundation only | its whole Shop price |
  | Dismiss bounty (the card) | a quest bounty | nothing; a new bounty comes |
  | Remove now (layout tool) | a placed Token, with the dev layout tool on | nothing, at once |

  Dragging a Token off the mat isn't a removal: it flies back. The Hall,
  landmarks, camp fixtures, map nodes (unless marked clearable), quests and
  enemies can't be demolished.

## What really happens underneath

- **A hero lets go when a Foundation becomes a building**, but follows a
  Token that grows or changes; after a build they look for new work.
- **A built building can't be undone for value**: its Foundation and
  materials are gone; demolition gives nothing back (the build cost is
  remembered but unused).
- **The cap is checked** by the Shop, crafted Tokens, spawners and rule
  spawns; **not** by arrival enemies (they count once landed) or the QA
  panel.
- **Demolition stops** the marked Token's recipe, build, growth, spawning and
  passive production, but its upkeep and what it gives neighbours carry on.
  Unmarking loses the half-done work.
- **One Mythic at a time** is checked on a drop only; the only Mythics (the
  Hall and the Campfire) are never sold or built, so it never applies.
- **One reach for rules**, 240 u everywhere, except a world-layout number
  written as its own 240.
- **Coded but unused**: landmarks, Tokens that can't leave the mat, "Stands
  near" rules, a "bench" Foundation kind with no Token, a free drop route no
  screen uses.

## What the owner controls in the CMS

Per Token: Stays where it stands, Can be cleared where a map placed it,
Stands on, cannot rules, landmark, the Shop block (price, icons, order),
Foundation kind; per build recipe: which Foundations, time, level. Not in the
CMS: the 128 cap, the 240 reach, the 160 nudge, the crowding rule, the 10 s
demolition at level 1 with no XP.

## What it touches, and where it overlaps another system

- **Spawners** (A2, done): one no-room rule (T-598), limits in reach (T-599).
- **Events** (A4, done): event Tokens outside the cap; demolishing an event
  needs a hero (T-603).
- **Construction** (A13): builds, levels, times.
- **The Shop** (A5): buying and refunds.
- **Orders** (A30): heroes following or letting go.
- **The world map** (A39): arrivals.

## Where it differs from the GDD

- GDD: Foundations build in 30 s at level 1; builds take 30 s to 4 minutes,
  levels 1 to 10.
- GDD: "Demolish on the Token's inspection"; it's only the top bar's map mode.
- GDD: the cap is enforced by the Shop, recipes and spawners; also by rule
  spawns, and not by arrival enemies.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game with some Oak Wood and Stone (QA panel).
2. **Buy a Wood Foundation** and drop it tight against a tree: it nudges or
   flies back. Hover it: the gold ring and dots.
3. **Choose a Workbench**; watch a hero build it; the hero then walks off.
4. **Buy another Foundation and drag it back onto the Shop**: its price
   returns.
5. **Top bar, map mode: mark the Workbench** for demolition; a hero clears it,
   nothing back.
6. **Try dragging a tree or a vein**: it won't move.
7. Ask yourself: should a built building give anything back when removed,
   and should demolition live on the Token's card as well as the map mode?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **A building's refund**: nothing, as now.
- **Where to demolish**: both, map mode and the Token's card.
- **After a build**: the hero stays if they can work it.
- **Arrival enemies**: outside the cap, like events.
- **Demolition XP**: a little.
- **The cap, reach and demolition time**: on the tuning page.
- **One Mythic at a time**: retire it.

## What it became

- **T-607** (director): demolish from the Token's card too.
- **T-608** (director): a builder stays to work the new building.
- **T-609** (director): arrival enemies stand outside the cap.
- **T-610** (director): demolishing gives a little Construction XP.
- **T-611** (director): leftovers (the Mythic rule retired, unused code, stale comments).
- **T-612** (planning agent): GDD §3.
- T-253 now lists the cap, the reach, demolition's time and XP.
- Fine as is: a demolished building gives nothing back; dragging off the mat flies back; carrying keeps upkeep running.

All six tickets blocked on the living mat group.

## Evidence

- Drops → `src/ui/components/board/dropOnMat.js:88-144`; land, nudge, fly back → `src/systems/board/Placement.js:142-185`, `src/systems/board/MatPlacement.js:324-337, 431-438`; room for the whole cycle → `MatPlacement.js:61-107`
- Fixed Tokens → `src/systems/board/FixedTokens.js:72-79, 100-103`; move keeps progress → `Placement.js:228-245`
- Carrying → `src/systems/board/BoardRunner.js:581-602`, `src/systems/board/TimedChanges.js:465`, `src/systems/board/TriggerSystem.js:254-262`
- Cap 128, what counts → `src/systems/board/MatCap.js:18-36`; checked → `src/systems/board/Shop.js:107`, `Placement.js:265`, `src/systems/board/SpawnerSystem.js:375`, `TriggerSystem.js:242-247`; not → `src/systems/world/Arrival.js:206`; shown → `src/ui/components/board/MatCapBadge.jsx:246-262`
- Reach 240 → `src/config/registries/reachRegistry.js:45`, `src/systems/board/nearby.js:27-29`; ring and dots → `src/ui/components/board/MatRings.jsx:31-98`, `src/systems/board/reachDisplay.js:22-48`; layout literal → `src/systems/atlas/Layout.js:133`
- Builds: room, materials at the end, in place → `src/systems/board/Foundations.js:43-84`, `BoardRunner.js:455-466`; times and levels → `data/tokenRecipes.json`
- Hero lets go after a build → `src/systems/board/Flags.js:757-768`
- Refund → `Shop.js:192-236`
- Demolition: who, what, what stops → `src/systems/board/Demolition.js:42-55, 115-127, 168-175`, `BoardRunner.js:480-500`; map mode only → `src/ui/hooks/useMapMode.js:57-65`, `src/ui/components/drawer/LeaveMatControl.jsx:14-58`
- Mythic rule → `Placement.js:82-88`
- Unused: `bench` → `src/config/registries/tokenConstants.js:118`; free drop route → `dropOnMat.js:122-125`
- GDD → `docs/reference/GDD.md:92-171, 222-247, 371-420, 512-531`
