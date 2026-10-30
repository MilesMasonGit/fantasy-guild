Status: briefed 2026-10-29 (encyclopedia and collection log revisited and approved 2026-10-29; brief 300). The dependency map moved to the progression ledger (brief 290).

# Knowledge: dependency map, encyclopedia, collection log

*D5 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview, started
2026-10-09. **Done** (owner closed it 2026-10-09).*

**One "what comes from where" graph, built once**, used by the CMS (authoring
checks), the encyclopedia (players) and map previews. It is **worked out
automatically** from what the owner authors in the CMS (Tokens, recipes,
drops, maps, rules): nothing extra to keep up to date. The player should never
need an outside wiki.

## The encyclopedia and collection log (owner, revisited 2026-10-29)

*Revisited 2026-10-29 (owner): the 2026-10-09 rulings on spoilers and
discovery are reversed. **The player must be able to find exactly what they
are looking for**: they can't make something if they don't know its recipe or
its source. Brief 300.*

- **No silhouettes, no discovery gating** (owner): every item, Token, enemy,
  recipe and place is shown in full from the start.
- **One screen, with collected ticks** (owner): the encyclopedia is also the
  collection log. Each entry carries a tick once the player has obtained,
  made, beaten or settled it; each kind shows its progress ("Items 48/149").
- **Organised by kind** (owner): Items, Tokens, Enemies, Recipes, Places;
  searchable.
- **An entry shows the full tree, folded** (owner): every source and the whole
  ingredient tree down to the wild origins (from the ledger's shared tree
  engine, [concept_progression_ledger.md](concept_progression_ledger.md)),
  opened a level at a time, and everything the item is used in. **Moving up
  and down the tree changes the focus**: clicking a node makes it the entry
  shown, so the player can walk the tree.
- **No wedge or cell in entries** (owner): the encyclopedia says *what* a thing
  comes from (an Iron Ore Vein, a Goblin, a Furnace recipe); the player then
  goes to the world map, whose cells show their core outputs, to find *where*.
- **No goal tracker** (owner): a reference only.
- **First collection is silent** (owner): the tick appears; the toast
  notifications' existing "New" pop is enough.
- **Rewards: pride only** (owner, unchanged).
- **Access** (owner): its own button with search, plus a link from anything
  inspected (item, Token, enemy, recipe cards; Bank items).
- **The ticks reset at the ritual** (owner, unchanged): each run starts fresh.

## The CMS dependency map

*Superseded 2026-10-29 by the progression ledger
([concept_progression_ledger.md](concept_progression_ledger.md), brief 290),
which plans, traces, checks and simulates every entry in the CMS.*

## The Bank at scale

Several hundred items after loops and gear: **search and filters** (name,
skill, type), **automatic sorting** on demand, and player-made **tabs stay**.
