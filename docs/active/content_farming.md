Status: approved 2026-11-04, **amended 2026-11-24 by the owner's review** ([brief 860](briefs/860_gathering_rework.md); a CMS pack still to come)

# Content roadmap: Farming

*Part of session 2 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; times and loads are the ledger's. A script takes each level from [the Cooking list](content_food_and_drink.md).*

## The owner's rulings (2026-11-04)

- **A crop's Farming level matches its first Cooking recipe**, as with fish. **"Try and keep one unlock per level."** Where two would share a level, one comes a level or two sooner.
- **No tool**: progress is "crop levels and places, it'll have a variety of buildings to boost production."
- **Animal goods stay enemy drops**: Beef, Milk, Chicken, Eggs. "I'll think about what to do about Wool."
- **"I think we'll have quite a few herbs for alchemy."**
- **Kept**: Fields grow long, then give a load of harvests; the player picks the crop; Farming owns all planting.

## Unlocks

**One unlock per level** (owner, 2026-11-04), including the fruit trees and bushes. A planted unlock comes from its seed; wild ones also stand in places on the world map. Crop levels sit at or just before the first recipe that uses them, so a cook is never left waiting.

*This list (38 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Farming. The rulings and reasoning stay on this page.*

**38 unlocks, 61 levels open** for anything later. Open: 7, 8, 10, 11, 13, 17, 18, 21, 23, 25, 26, 28, 29, 31, 33, 34, 36, 37, 38, 39, 45, 46, 48, 49, 50, 53, 55, 57, 58, 59, 61, 62, 63, 64, 67, 68, 70, 71, 72, 73, 74, 78, 79, 81, 82, 83, 84, 85, 86, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99.

Tree and bush pictures are drawn (`tree_apple`, `tree_cherry`, `bush_blue` and so on); the fruit trees here are the ones you have: Apple, Cherry, Lemon, Peach, Lime, Orange, Banana, Coconut. Fields use your shared growing picture, with a ripe picture per crop to draw or adapt. Pear, Plum or others aren't in the art, so aren't listed.

## Herbs

**Eight, in the catalogue** ([Alchemy](content_alchemy.md)): grown in Herb Gardens, or wild in fitting places.

## Buildings that boost production

From [Construction](content_construction.md): **Well** (shorter growth), **Composter** (bigger loads), **Beehive** (honey, doubling), **Windmill** (Flour), and the **Farmstead** with its Barn, Greenhouse and Manor Farm. Which others to add is open.

## What this changes

- ⚠️ **Sickles go**: Fields, Herb Gardens and Ripe Wheat ask for one today (`needsTool`), and those five Tokens drop that need. Redberry Bushes and Apple Trees already need no tool.
- **Today's Cow Pasture** stays as a lure; **Chicken Coop** on [Construction's open links](content_construction.md) isn't needed for now, and [Cooking](content_food_and_drink.md)'s pasture notes change.
- **Wool drops from a Sheep enemy** (owner, 2026-11-22, once Taming was cut): a level 1 Sheep from a Sheep Pasture camp in Highland lands, with a rare Pasture Map that builds one, as the Cow has. [Tailor](content_tailor.md)'s tier 2 and the Sail use it. Pack `2026-11-22-sheep-wool`.
- **Milk as an enemy drop**: Butter and Cheese rely on it; the enemy session gives it a source.
- **Seaweed**: the Composter could take it; otherwise it needs another user.

## Building it (2026-11-21, content agent)

The Sickle goes first (pack `2026-11-21-farming-no-sickle`). **The levels come with the new crops**, not before: alone, Wheat at 4 and Lavender at 5 leave a new hero nothing to train on until Potato (2) and Flax (3) exist, and the pack gate blocks it. The new crops come with the recipes that use them (Cooking, Tailor), so no crop arrives without a job.
- **The crops came with Cooking** (pack `2026-11-21-cooking-and-crops`): Potato to Voidcap, each a Field recipe from its seed, on the plan's levels with the bushes and trees. A Bird Nest can hold every new seed, Potato's always, so the first seed of each crop is a nest away; harvests keep seeds back after that. Flax waits for Tailor; the herb gardens for Alchemy.

## Amended 2026-11-24: Farming review (owner)

*The owner's review of the gathering skills, after Fishing, Mining and Forestry. Replaces the lines it
clashes with above and in [concept_skill_loops.md](concept_skill_loops.md) "Farming".*

1. **A ripe Field is harvested out by chance**: each harvest cycle has a chance to finish it (Wheat
   about 1 in 10, keeping today's average load), **no counter**; the last cycle replants. The
   **Composter** now lowers that chance (a bigger harvest on average) instead of adding to a count.
2. **Seeds stay for Fields**: each replant spends a seed of the picked crop; with none, the Field
   waits with its yellow '!'. Harvests give some seeds back. (Forestry dropped its seedlings; Farming
   keeps them as its own loop.)
3. **Farmland, Farming's gathering foundation, becomes a Field, an Orchard, a Herb Garden or a Forest (owner 2026-11-25, no Nursery)**
   ([concept_gathering_foundations.md](concept_gathering_foundations.md)). The supports (Well,
   Composter, Beehive, Windmill) stay on today's Foundations.
4. **Orchards follow Forests**: an Orchard plants a few fruit trees of its kind and refruits its own;
   fruit trees are picked, not felled (picked empty, they rest and fruit again). No boost to other
   trees, no seedling per tree ([content_mining_forestry.md](content_mining_forestry.md) "Forests are
   tree spawners").
5. **The supports stay** (owner: Farming's progress is crops, places and buildings that boost
   production): Well (faster growth, to the floor), Composter (bigger harvests), Beehive (a chance of
   bonus crops or seeds; honey and wax), Windmill (mills grain).
6. **Grow time stays 1 to 2 hours** per crop (Wheat about 1 hour).
7. **No special Farming event Tokens for now.**

