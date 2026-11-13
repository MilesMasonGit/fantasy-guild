Status: draft 2026-11-13 (pack `2026-11-13-events-first` in `cms/incoming/`; the owner reviews it in the CMS and Syncs on `main`)

# Events: the first list

*Content agent, 2026-11-13, for brief 640 C1. The rules are in [concept_events.md](concept_events.md); the
engine is on `main` (E1). The owner's answers of 2026-11-13 below.*

## Rulings (owner, 2026-11-13)

- **Rich nodes are about 2 hours of one hero's normal work**: 100 charges, 4x the normal Token's yield a
  cycle, the same level, cycle, XP and tool as the Token they copy (the owner's Copper Comet: 6 ore a cycle).
- **Each buff is themed to its effect** ("a Warm Sun might help Farming regrow faster while a Deep Vein might
  help Mining nodes refresh faster"). **Most boost one skill; special ones may boost all.**
- **All weights equal** (10).

## The list

Every event lands once an hour or so, one at a time; buffs stay 20 minutes and can be dragged; nodes stay put
until worked out (or leave after an hour if no hero can work them).

| Event | Kind | Where it lands | What it gives | Copies | Art (stand-in) |
|---|---|---|---|---|---|
| Copper Comet | node | anywhere | 6 Copper Ore a cycle, 100 charges (600 ore); Mining 1, Pickaxe | Copper Ore Vein | N (copper vein) |
| Iron Comet | node | anywhere | 6 Iron Ore a cycle, 100 charges; Mining 15, Pickaxe | Iron Ore Vein | N (iron vein) |
| Mythril Comet | node | anywhere | 6 Mythril Ore a cycle, 100 charges; Mining 60, Iron Pickaxe | Mythril Ore Vein | N (mythril vein) |
| Fallen Maple | node | grass | 6 Maple Wood a cycle, 100 charges; Forestry 45, Woodaxe | Maple Tree | A (fallen oak) |
| Fish Shoal | node | water | 4 fish a cycle (Trout 70 %, Salmon 30 %), 100 charges; Fishing 1, Rod | River | N (fish spot) |
| Berry Thicket | node | grass | 6 Redberries, plus Blackberries and Strawberries by chance, 100 charges; Farming 1 | Redberry Bush | A (redberry bush) |
| Rainfall | buff | anywhere | +20 % Double Loot on Farming in reach | | N (forest shrine) |
| Warm Sun | buff | anywhere | Farming in reach regrows 30 % faster | | N (forest shrine) |
| Deep Vein | buff | anywhere | Mining in reach refills 30 % faster | | N (forge shrine) |
| Morning Mist | buff | anywhere | Forestry work in reach 20 % faster | | N (forest shrine) |
| Fair Winds | buff | anywhere | Fishing work in reach 20 % faster | | N (red banner) |
| Starry Night | buff | anywhere | +15 % XP on every Token in reach, any skill (the special one) | | N (red banner) |

## Own calls (simplest choice, say so)

- **Morning Mist** added so each gathering skill has a buff; **Lucky (Rainbow) left out** for now, since few
  Tokens have a rare table yet.
- **Starry Night** is the all-skills one, at +15 % rather than +20 % because it touches everything in reach.
- Nodes carry no rare table and no seedlings; the Berry Thicket hurts nobody (the Redberry Bush's thorn is
  not copied).
- Every event Token is tagged `Event` and has no `sim` tag, so Sync's Recalculate leaves its numbers alone.
- **Strength against the boost budget** (BALANCE_RULES 5): a buff is 20 minutes in an hour, near one camp.
  Speed −20 % is inside the copper speed cell's 20 % optimized cut for its time; Double Loot and Growth have
  no cell yet. Clearly better, not a jackpot.

## Open links

- The ledger reads event Tokens as "never reachable" (warnings, not blocks): T-408.
- Event-only materials and the events constellation of Stars come later (concept doc).
- Art: twelve new event Tokens on the owner's list, at their pace.
