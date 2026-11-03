Status: draft

# The content roadmap: everything the game will contain

*Opened 2026-11-02 (owner). Many iterative sessions, each on one part of the
supply chain.*

## The goal (owner, 2026-11-02)

Lay out the essential roadmap of items, skills, recipes and so on, so that **when
the owner creates art, they know exactly what they are making**: specific food,
recipes and their ingredients, those supply chains, enemy drops, weapon effects,
all of it.

**What this adds to earlier docs**: [concept_basic_content.md](concept_basic_content.md)
covers the camp to plane 2 and [concept_skill_loops.md](concept_skill_loops.md)
how each skill plays. Neither lists the whole game. Roadmap sessions extend
them; they don't re-open their rulings.

## Where the game stands (counted from `data/` and the ledger's plan, 2026-11-02)

| Tier | Budget | Live items | Live Tokens | What it holds |
|---|---|---|---|---|
| 0 Starter Camp | 30 min | 49 | 41 | copper tools, weapons and armour; first food |
| 1 Plane 1 | 25 min | 32 | 28 | fruit, cooked meat and fish, Beer |
| 2 Plane 2 | 1 day | 47 | 29 | iron gear, leather, first potions |
| 3 and on | **none** | 41 | 33 | raw materials and three pickaxes |

- **The last tier holds five metals and five woods** (silver, gold, mythril,
  adamantine, darkmetal; birch, maple, cedar, mahogany, ebony) but no weapons,
  no armour, and no cooked food: only raw fruit and two drinks. **What those
  materials are for isn't designed yet.**
- **The first ritual is aimed at 1 to 3 months of play**
  ([concept_progression.md](concept_progression.md)), while budgets stop at about
  a day. Nearly all of the game's length has no plan.
- **Recipes by skill**: Construction 51, Smithing 34, Cooking 16, Crafting 11,
  Farming 3, Alchemy 2.
- **Seven specialist skills have no content**: Fletching, Faith, Summoning,
  Enchanting, Crime, Taming, Science. Arrows wait on Fletching.
- **The Planned list has 15 entries**, for the whole unmade game.
- **Every item has a sprite file**, and one Token (Coconut Tree) has none. That
  doesn't say which are final art: the roadmap's art column records that.

## How a session works

The agent brings a **full proposal for one chain** as tables; the owner edits it.
No item-by-item questions: the simplest choice is taken and said in a line.

Each entry records:

| Field | Example |
|---|---|
| Name and kind | Lavender Salmon, food |
| Rung | where on the ladder it arrives |
| Comes from | wild origin, enemy drop, or recipe |
| Made with | skill, rough level, station, ingredients |
| Used by | what needs it next; **nothing should be a dead end** |
| Art | have, adapt, or new |

**Names, ingredients and rough levels are decided here. Exact quantities, times
and prices are left to the ledger's balancing**, since they change as chains
join up. A chain that needs something not designed yet gets a stub and a line in
**Open links**, picked up when that chain's session comes round.

After each session the new art goes into [owner_art_list.md](owner_art_list.md).

## Session order (owner, 2026-11-02)

1. **The ladder**: the game's rungs from copper to the end, each rung's time
   budget, wood and level band. Everything else hangs from this.
2. **Food and drink**: Farming, Fishing, Cooking, drinks.
3. **Metal and gear**: Mining, Smithing, weapons per style, armour families.
4. **Wood and buildings**: Forestry, Construction, Crafting, stations.
5. **Herbs and potions**: Alchemy.
6. **Enemies**: the roster per rung, drops, bosses, weapon effects.
7. **Specialist skills**, one at a time.
8. **Roll-up**: the full art list, and the ledger run over the whole plan.

Later sessions will revise earlier ones; that is expected.

## Decisions

- **Where it lives** (owner, 2026-11-02): readable chain pages first. An approved
  chain goes into the CMS as Planned entries through a pack, so the ledger can
  check it; Planned entries never reach the game.
- **One rung per metal** (owner, 2026-11-02): seven rungs, copper, iron, silver,
  gold, mythril, adamantine, darkmetal.
- **The seven specialist skills are confirmed for now and designed after the core
  chains** (owner, 2026-11-02); skills may still be added or cut later.
- **Food and drink is the first chain after the ladder** (owner, 2026-11-02).

## Open links

*(Things one chain needs from another not yet designed.)*

- **Arrows need Fletching**, which comes after the core chains. Metal and gear
  plans Ranged with arrows as stubs.
