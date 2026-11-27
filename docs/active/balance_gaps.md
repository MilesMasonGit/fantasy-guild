# Gaps for content

*The balancer's hand-back list (owner, 2026-11-25; [concept_balancer_agent.md](concept_balancer_agent.md)).
An empty stretch is a run of levels in a skill with nothing new to make or gather, where the old task
slows into a wall and the rules can't smooth it. The balancer adds a gap here; `/content` reads this
page at session start, fills a gap by adding or moving an unlock, and strikes it (~~like this~~) with
the date and what filled it. The balancer removes struck gaps on its next run once the solver agrees.*

## Open

*A gap is a stretch that lasts **more than a day of typical play** with nothing new (owner, 2026-11-25).
None is a wall: the slowest level in any of them is 1.3x the curve. Times are for one hero, at the
6.25 % pace.*

| Skill | Levels | What's missing | Suggestion | Added |
|---|---|---|---|---|
| Alchemy | 81-89 | 3.1 days optimized, 6.0 typical on Elixir of Legends | One strong late potion around 85 | 2026-11-25 |
| Alchemy | 91-98 | 4.9 days optimized, 9.3 typical on Master's Draught | A capstone at 95 or later, as Smithing has at 98 and 99 | 2026-11-25 |
| Crafting | 87-98 | 6.6 days optimized, 12.7 typical on Dragonscale Chest | One or two capstones from 90 up | 2026-11-25 |
| Farming | 81-86 | 45 hours optimized, 3.6 days typical on Starflower | A late crop around 84 | 2026-11-25 |
| Farming | 88-98 | 6.2 days optimized, 11.9 typical on Voidcap | One or two late crops from 90 up | 2026-11-25 |
| Fishing | 64-82 | 3.1 days optimized, 5.7 typical on Swordfish | A catch or a creative water around 70 to 75 | 2026-11-25 |
| Fishing | 90-98 | 5.3 days optimized, 10.2 typical on Anglerfish | A capstone catch at 95 or later | 2026-11-25 |
| Fletching | 69-79 | 44 hours optimized, 3.4 days typical on Adamantine Crossbow | One item around 74 | 2026-11-25 |
| Fletching | 86-98 | 7.0 days optimized, 13.4 typical on Darkmetal Crossbow | One or two capstones from 90 up | 2026-11-25 |
| Forestry | 61-79 | 2.6 days optimized, 4.6 typical on Mahogany | A creative Token around 70 | 2026-11-25 |
| Forestry | 81-98 | 8.9 days optimized, 16.9 typical on Ebony: the longest in the game | Two creative Tokens, around 87 and 94 | 2026-11-25 |
| Mining | 61-69 | 21 hours optimized, 36 typical on Adamantine | A creative Token around 65 | 2026-11-25 |
| Mining | 71-79 | 39 hours optimized, 3.0 days typical on the Fallen Star | A creative Token around 75 | 2026-11-25 |
| Mining | 91-98 | 4.9 days optimized, 9.3 typical on the Fossil Bed | A capstone Token at 95 or later | 2026-11-25 |
| Tailor | 92-98 | 4.4 days optimized, 8.3 typical on Void Cape | A capstone at 96 or later | 2026-11-25 |

## Early makers run slow with one hero (2026-11-27, corrected the same day)

*Not missing content, and not for `/content` yet. First listed as early levels with no work of their own;
the content session pointed out that Smithing, Crafting and Alchemy have a recipe at nearly every level
from 1 to 16, and the ledger agrees: each pays about the same XP an hour as the starter recipe.*

The cause is the guild, not the recipes. In the Starter Camp the reference guild has **one hero**, who
must gather for the maker as well: Copper Ingot needs about 0.6 of a gatherer, so the smith works at about
60 % of full pace, and the camp holds fewer boosts than the budget assumes. Together that is the 1.7 to 2.2
times the curve seen in Smithing 1 to 15, Crafting 1 to 15 and Alchemy 1 to 14. From Plane 1 a second hero
and the next station close it. Raising any early recipe to cover it makes that recipe the best XP to level
40 (BALANCE_RULES section 1, the ceiling), so XP is not the lever.

A question for the owner, with the coin reset: accept it (a lone hero cannot run a chain at full pace; the
Starter Camp is left on a gathering skill at level 10 anyway), or ask `/content` for an early boost.

## Waiting on something else

- **Construction** 61-79 and 86-98 (4.6 and 13.4 days typical): its eight building parts aren't its
  training; the repeatable work between builds is being planned (T-656). Checked again once that lands.

## Checked, no gaps

- **Cooking**, **Smithing**, **Enchanting** (balancer, 2026-11-25): no stretch flagged.

## Dropped: under a day of typical play (2026-11-25)

*Flagged by the solver, left alone by the owner's rule that gaps beat filler.*

| Skill | Stretches |
|---|---|
| Alchemy | 2-7 (27 min), 51-59 (under a day) |
| Fishing | 6-14, 16-24, 31-39 (each under 5 hours) |
| Fletching | 9-19, 32-39, 42-47, 49-59, 62-67 (each under a day) |
| Forestry | 11-19, 41-49, 51-59 (each under a day) |
| Mining | 2-7, 21-29, 31-39, 51-59 (each under a day) |
| Construction | 2-9, 11-19, 21-39, 41-47, 49-59 (each under a day) |

*Fishing's old list (2-11, 13-21, 31-47, 49-82, 84-98) was mostly the solver's mistake: it didn't
count a catch with its own level (Salmon at 40, Lobster at 50, Swordfish at 63) as something new.*
