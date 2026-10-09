# Knowledge: dependency map, encyclopedia, collection log

*D5 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview, started
2026-10-09. **Done** (owner closed it 2026-10-09).*

**One "what comes from where" graph, built once**, used by the CMS (authoring
checks), the encyclopedia (players) and map previews. It is **worked out
automatically** from what the owner authors in the CMS (Tokens, recipes,
drops, maps, rules): nothing extra to keep up to date. The player should never
need an outside wiki.

## The encyclopedia

- **Search every entity, Token and item.**
- **Spoilers: discovered things, plus hints at the next step.** Entries unlock
  when first seen or obtained; undiscovered things one step away show as
  silhouettes ("??? — made from Iron Ore at a Furnace"). Discovery stays a
  goal, and the encyclopedia doubles as the collection log.
- **Provenance: two or three steps back by default**, click to go further
  ("Iron Bar ← 2 Iron Ore + 1 Coal at a Furnace (Smithing 15) ← Iron Ore Vein
  on …").
- **Uses: one step ahead**: what an item goes into (recipes, buildings,
  upkeep, the ritual). Answers "why am I hoarding this?".
- **Access**: its own button (bubble menu, with search), and a link from
  anything inspected (item, Token, enemy).
- **Maps both ways**: inspecting a map item shows what it will create (nodes,
  enemies, treasures); an item's sources include "found on: Fir Grove maps";
  the Atlas's Node Summary sums up a mix.

## The collection log

- **A quiet goal with small markers**: each category shows progress
  ("Forestry: 14/22 discovered"); a first discovery is a loud pop (D1). No
  rewards beyond pride. New game plus resets it (nothing carries over, D2).

## The CMS dependency map

For the owner while authoring:
- **See the chain**: a visual graph of how items, Tokens, enemies, maps and
  skills depend on each other (Oak → Tree Ent → Fir map → Fir).
- **Catch dead ends**: an item nothing produces or nothing uses, a recipe
  needing something unreachable, a loop that can't start.
- **Check order and levels**: warns when something needs a higher level or a
  later resource than its place in the chain suggests.
- **Plan the next content**: shows gaps ("nothing uses Fir between Forestry 15
  and 30").

## The Bank at scale

Several hundred items after loops and gear: **search and filters** (name,
skill, type), **automatic sorting** on demand, and player-made **tabs stay**.
