Status: approved 2026-11-04 (Planned entries staged 2026-11-26 in the `2026-11-26-planned-*` packs, T-305; the owner reviews and Syncs)

# Content roadmap: food and drink

*Session 2 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's proposal, 2026-11-04, revised after the owner's first answers, for the
owner to edit. Names, ingredients and rough levels are decided here; quantities, times, heals and prices are the ledger's.
Built around the art in `public/assets/items/`: [the labelled sheet](research/food_art/food_art_sheet.png). Most names are suggestions.*

## The owner's rulings (2026-11-04)

- **"We need 99 Cooking recipes"**: one for every level, so Cooking has something new at each one. "There's going to be a lot of food and drink."
- **One bowl for every stew: iron.** "Probably will not have tiered soups like this. I'll pick one for our standard, and the different stews will just use that color."
- **Late food goes fantastical** (Emberroot, Voidcap, a Guildmaster's Feast).
- **Raw fruit needs no cooking and also goes into recipes** ("apples can be made into apple pie").
- **A drink for every skill, probably more.**
- **"We'll need to synchronize cooking recipe levels for the fish and the fishing level to catch it. If a salmon needs level 40 to be caught, it should be cooking level 40."** Each fish's first recipe is at its catch level ([Fishing](content_fishing.md)).
- **Tiers every 20 levels** (the ladder's amendment): this list now uses copper 1, iron 20, silver 30, mythril 40, gold 50, adamantine 60, darkmetal 80. Iron's crops and meat come from 15, as Cooking's Mirepoix and Steak sit there.

## Rules kept

From [concept_skill_loops.md](concept_skill_loops.md): food heals in fights; **drinks never heal**, they're work buffs; plain recipes; food at a Campfire or Kitchen, drinks at
a Brewery; better stations are faster, not new lists.

## The count

**66 foods, 28 drinks and 5 prepared ingredients.** Every one of the 20 skills has a drink; 8 more serve any work. A script checked that every ingredient is available by its recipe's level, that every prepared ingredient has a use, and that levels run 1 to 99 with no gaps.

## Copper (levels 1 to 19)

**New ingredients**

*This list (12 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (19 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Iron (levels 20 to 29)

**New ingredients**

*This list (11 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (10 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Silver (levels 30 to 39)

**New ingredients**

*This list (8 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (10 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Mythril (levels 40 to 49)

**New ingredients**

*This list (6 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (10 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Gold (levels 50 to 59)

**New ingredients**

*This list (4 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (10 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Adamantine (levels 60 to 79)

**New ingredients**

*This list (4 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (20 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Darkmetal (levels 80 to 99)

**New ingredients**

*This list (2 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

**Recipes**

*This list (20 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Cooking. The rulings and reasoning stay on this page.*

## Art

Recipes: **24 have, 48 adapt, 27 new** (H, A, N above). Adapt means a recolour or small change of an existing picture, for example a soup from the iron bowl or a pie from `pie_cherry`. Ingredients add Milk, Crab Meat, Oyster, Emberroot, Voidcap and about 11 seeds. `stew_copper`, `stew_gold`, `stew_bc_1`, `stew_bc_3`, `stew_pl_1` and `stew_pl_3` go unused, by the one-bowl ruling. Wine uses `potion_wine_grape`, so Grape Juice wants a picture of its own.

## Moved or changed from today

- **Fish recipes match their catch levels**: Shrimp 1, Trout 5, Oyster 25, Tropical Fish 30, Salmon 40, Lobster 50, Swordfish 63, Shark 83 (each waits for its Harpoon, 2026-11-07). Other recipes shift a level or so around them. Today's levels are placeholders: Swordfish cooks at 4, Trout at 35.
- **Steak moves up**: it heals 35 at level 1 today, more than anything.
- **The eight tier 3 fruits are placed**, closing that Open link; so are Lemonade and Limeade.
- **Limes's first fight still eats Redberries** (brief 480).
- **Which drink helps which skill replaces today's effects**, by the ledger; Beer's XP and Grape Juice's fishing buff are starting points.

## Open links

- **Enemies**: which enemies drop Game Meat and Crab Meat; the enemy session may add meats at higher rungs.
- **Wood and buildings**: a Chicken Coop, milking at the pasture, any station upgrades.
- **Cooking's final challenge**: whether it asks for the Feast (roll-up).
- **Herbs and potions**: Lavender at mythril; more herbs may join meals.
- **World lines**: the crops and waters lines' per-rung origins need updating (T-294).
- **The ledger**: 99 recipes means an XP curve and a heal curve to fit; a heal grade for each rung.

## Building it (2026-11-21, content agent)

- **In the Cooking pack**: every recipe whose ingredients have a source, on the plan's levels; the Cow gives Milk (half the time), so Butter, Cheese and the milk drinks can come in; a drink for every skill, each giving +10 % XP in its skill while it lasts (any-work drinks give Merry), the ledger to tune; today's Cooked Swordfish becomes the Swordfish Steak at 63.
- **Held**: dishes needing Raw Chicken or Eggs (no chicken enemy yet: Roast Chicken, Boiled Egg, Omelette, Chicken Soup, Honey Chicken, Orange Chicken, Royal Banquet) and those needing Oyster or Shark (the Fishing pack: Oyster Stew, Cooked Shark, Ember Shark, Shark Soup, Seafood Platter, Guildmaster's Feast).
- **Pictures**: stews and soups use the iron bowl, pies the cherry pie, drinks the juice or beer picture, until drawn; each is marked for art in the review.
- ⚠️ **Late walls the ledger flags, needing content not numbers**: Cooking 96 to 97, Farming 79 to 87 (the open levels).
