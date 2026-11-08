Status: approved 2026-11-04 (a CMS pack of Planned entries still to come)

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

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Redberry | bush | Redberry Tea | H |
| Apple | orchard | Apple Juice, Apple Pie, Harvest Platter | H |
| Blackberry | bush | Blackberry Pie, Builder's Brew | H |
| Wheat | field | Beer, Stout, Builder's Brew and 1 more | H |
| Flour | Windmill, from Wheat (Farming) | Dough | H |
| Carrot | field | Carrot Soup, Plain Stew, Mirepoix and 2 more | H |
| Potato | field | Baked Potato, Plain Stew, Buttered Potato and 4 more | H, seed A |
| Water | Wishing Well | Dough, Carrot Soup, Redberry Tea and 21 more | H |
| Raw Shrimp | coast | Shrimp | H |
| Game Meat | enemy drop | Roast Meat | H |
| Crab Meat | enemy drop | Cooked Crab | N |
| Honey | Beehive | Honey Bread, Hot Milk, Stout and 5 more | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 1 | Shrimp | food | Raw Shrimp | H |
| 2 | Baked Potato | food | Potato | H |
| 3 | Roast Meat | food | Game Meat | N |
| 4 | Dough | prep | Water, Flour | H |
| 5 | Cooked Trout | food | Trout | N |
| 6 | Apple Juice | drink: Farming | Apple | H |
| 7 | Bread | food | Dough | H |
| 8 | Cooked Crab | food | Crab Meat | N |
| 9 | Carrot Soup | food | Carrot, Water | A |
| 10 | Redberry Tea | drink: Forestry | Redberry, Water | N |
| 11 | Plain Stew | food | Carrot, Potato, Water | H |
| 12 | Honey Bread | food | Dough, Honey | A |
| 13 | Beer | drink: Mining | Water, Wheat | H |
| 14 | Blackberry Pie | food | Dough, Blackberry | H |
| 15 | Apple Pie | food | Dough, Apple | A |
| 16 | Mirepoix | prep | Carrot, Onion, Celery | H |
| 17 | Steak | food | Raw Beef | H |
| 18 | Onion Soup | food | Onion, Water | A |
| 19 | Grape Juice | drink: Fishing | Grapes | A |

## Iron (levels 20 to 29)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Blueberry | bush | Blueberry Pie, Blueberry Tonic | H |
| Strawberry | bush | Strawberry Milk, Strawberry Tart | H |
| Cherry | orchard | Cherry Cordial, Cherry Pie | H |
| Grapes | vine | Grape Juice, Wine, Harvest Platter | H |
| Onion | field | Mirepoix, Onion Soup, Steak and Onions and 2 more | H, seed A |
| Celery | field | Mirepoix | H, seed A |
| Leek | field | Trout and Leek, Potato Leek Stew, Hearty Potato Stew | H, seed A |
| Raw Beef | Cows, pasture | Steak, Beef and Carrot Stew, Steak and Onions and 6 more | H |
| Milk | Cows, pasture | Butter, Hot Milk, Cheese and 3 more | N |
| Trout | river, lake | Cooked Trout, Trout and Leek | H |
| Oyster | Oyster Bed | Oyster Stew | N |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 20 | Butter | prep | Milk | N |
| 21 | Buttered Potato | food | Potato, Butter | A |
| 22 | Blueberry Pie | food | Dough, Blueberry | H |
| 23 | Hot Milk | drink: Cooking | Milk, Honey | N |
| 24 | Cherry Cordial | drink: Melee | Cherry, Water | N |
| 25 | Oyster Stew | food | Oyster, Water | A |
| 26 | Cheese | prep | Milk | N |
| 27 | Trout and Leek | food | Trout, Leek | A |
| 28 | Cheese Bread | food | Bread, Cheese | A |
| 29 | Cherry Pie | food | Dough, Cherry | H |

## Silver (levels 30 to 39)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Peach | orchard | Peach Nectar, Peach Pie | H |
| Raspberry | bush | Raspberry Cordial, Raspberry Tart | H |
| Lemon | orchard | Lemonade, Lemon Fish, Pineapple Punch | H |
| Cabbage | field | Garden Stew | H, seed A |
| Turnip | field | Garden Stew | H, seed A |
| Raw Chicken | Chickens, coop | Roast Chicken, Chicken Soup, Honey Chicken and 1 more | H |
| Egg | Chickens, coop | Boiled Egg, Omelette | H |
| Tropical Fish | coast | Cooked Tropical Fish, Lemon Fish | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 30 | Cooked Tropical Fish | food | Tropical Fish | N |
| 31 | Beef and Carrot Stew | food | Raw Beef, Carrot, Mirepoix | H |
| 32 | Strawberry Milk | drink: Crafting | Strawberry, Milk | N |
| 33 | Potato Leek Stew | food | Potato, Leek, Mirepoix | H |
| 34 | Stout | drink: Smithing | Water, Wheat, Honey | A |
| 35 | Strawberry Tart | food | Dough, Strawberry, Butter | N |
| 36 | Blueberry Tonic | drink: Ranged | Blueberry, Water | N |
| 37 | Steak and Onions | food | Raw Beef, Onion, Butter | A |
| 38 | Builder's Brew | drink: Construction | Water, Wheat, Blackberry | A |
| 39 | Roast Chicken | food | Raw Chicken | H |

## Mythril (levels 40 to 49)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Lime | orchard | Limeade, Watermelon Cooler | H |
| Orange | orchard | Orange Juice, Orange Chicken | H |
| Tomato | field | Sofrito, Tomato Soup, Lobster Bisque | H, seed A |
| Garlic | field | Sofrito, Garlic Steak | H, seed A |
| Salmon | river, lake | Cooked Salmon, Lavender Salmon, Seafood Platter | H |
| Lavender | Herb Garden | Lavender Salmon, Lavender Tea | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 40 | Cooked Salmon | food | Salmon | N |
| 41 | Boiled Egg | food | Egg | A |
| 42 | Lemonade | drink: Alchemy | Lemon, Water | H |
| 43 | Garden Stew | food | Cabbage, Turnip, Mirepoix | A |
| 44 | Peach Nectar | drink: Magic | Peach, Water | N |
| 45 | Omelette | food | Egg, Cheese, Onion | N |
| 46 | Peach Pie | food | Dough, Peach | A |
| 47 | Raspberry Cordial | drink: Stealth | Raspberry, Water | A |
| 48 | Chicken Soup | food | Raw Chicken, Mirepoix | A |
| 49 | Raspberry Tart | food | Dough, Raspberry, Butter | A |

## Gold (levels 50 to 59)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Pineapple | bush | Pineapple Punch, Pineapple Cake, Sunset Punch | H |
| Banana | orchard | Banana Smoothie, Banana Bread | H |
| Corn | field | Corn Chowder, Golden Stew | H, seed A |
| Lobster | coast | Cooked Lobster, Buttered Lobster, Lobster Bisque and 1 more | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 50 | Cooked Lobster | food | Lobster | H |
| 51 | Lemon Fish | food | Tropical Fish, Lemon | A |
| 52 | Sofrito | prep | Garlic, Onion, Tomato | H |
| 53 | Tomato Soup | food | Tomato, Water | A |
| 54 | Limeade | drink: Fletching | Lime, Water | H |
| 55 | Honey Chicken | food | Raw Chicken, Honey | H |
| 56 | Orange Juice | drink: Science | Orange | H |
| 57 | Lavender Salmon | food | Salmon, Lavender | A |
| 58 | Garlic Steak | food | Raw Beef, Garlic, Butter | A |
| 59 | Lavender Tea | drink: Faith | Lavender, Water, Honey | N |

## Adamantine (levels 60 to 79)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Coconut | orchard | Coconut Milk, Coconut Swordfish, Coconut Pie and 1 more | H |
| Watermelon | patch | Watermelon Cooler, Sunset Punch | H |
| Emberroot | field, hot places | Emberroot Soup, Ember Steak, Ember Ale and 4 more | N, seed N |
| Swordfish | coast | Swordfish Steak, Coconut Swordfish, Swordfish in Sofrito | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 60 | Orange Chicken | food | Raw Chicken, Orange | A |
| 61 | Hearty Beef Stew | food | Raw Beef, Carrot, Sofrito | A |
| 62 | Hearty Potato Stew | food | Potato, Leek, Sofrito | A |
| 63 | Swordfish Steak | food | Swordfish | H |
| 64 | Wine | drink: Enchanting | Grapes | H |
| 65 | Corn Chowder | food | Corn, Milk, Potato | A |
| 66 | Pineapple Punch | drink: Crime | Pineapple, Lemon, Water | N |
| 67 | Buttered Lobster | food | Lobster, Butter | A |
| 68 | Golden Stew | food | Corn, Sofrito, Mirepoix | A |
| 69 | Banana Smoothie | drink: Taming | Banana, Milk, Honey | N |
| 70 | Banana Bread | food | Dough, Banana | A |
| 71 | Royal Beef Stew | food | Raw Beef, Sofrito, Wine | A |
| 72 | Pineapple Cake | food | Pineapple, Dough, Butter | N |
| 73 | Royal Potato Stew | food | Potato, Cheese, Sofrito | A |
| 74 | Lobster Bisque | food | Lobster, Tomato, Butter | A |
| 75 | Coconut Milk | drink: Summoning | Coconut | N |
| 76 | Emberroot Soup | food | Emberroot, Water | A |
| 77 | Watermelon Cooler | drink: any work | Watermelon, Lime, Water | N |
| 78 | Mead | drink: any work | Honey, Water | N |
| 79 | Coconut Swordfish | food | Swordfish, Coconut | A |

## Darkmetal (levels 80 to 99)

**New ingredients**

| Ingredient | Comes from | Used by | Art |
|---|---|---|---|
| Voidcap | field, dark places | Voidcap Soup, Voidcap Tea, Voidcap Pie and 4 more | N, spore N |
| Shark | coast | Cooked Shark, Ember Shark, Shark Soup and 2 more | H |

**Recipes**

| Level | Name | Kind | Made with | Art |
|---|---|---|---|---|
| 80 | Coconut Pie | food | Dough, Coconut, Butter | A |
| 81 | Ember Steak | food | Raw Beef, Emberroot | A |
| 82 | Ember Ale | drink: any work | Wheat, Emberroot, Water | A |
| 83 | Cooked Shark | food | Shark | H |
| 84 | Swordfish in Sofrito | food | Swordfish, Sofrito | A |
| 85 | Spiced Wine | drink: any work | Wine, Emberroot | A |
| 86 | Ember Stew | food | Raw Beef, Emberroot, Sofrito | A |
| 87 | Voidcap Soup | food | Voidcap, Water | A |
| 88 | Voidcap Tea | drink: any work | Voidcap, Water, Honey | A |
| 89 | Ember Shark | food | Shark, Emberroot | A |
| 90 | Voidcap Pie | food | Dough, Voidcap, Butter | A |
| 91 | Dark Mead | drink: any work | Mead, Voidcap | A |
| 92 | Shark Soup | food | Shark, Sofrito | A |
| 93 | Harvest Platter | food | Bread, Cheese, Apple, Grapes | N |
| 94 | Void Stew | food | Voidcap, Raw Beef, Sofrito | A |
| 95 | Sunset Punch | drink: any work | Pineapple, Watermelon, Coconut | A |
| 96 | Seafood Platter | food | Lobster, Salmon, Shark | N |
| 97 | Elder Draught | drink: any work | Voidcap, Emberroot, Mead | N |
| 98 | Royal Banquet | food | Royal Beef Stew, Roast Chicken, Wine | N |
| 99 | Guildmaster's Feast | food | Shark, Royal Beef Stew, Voidcap, Wine | N |

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
