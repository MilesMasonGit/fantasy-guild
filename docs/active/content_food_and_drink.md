Status: draft

# Content roadmap: food and drink

*Session 2 of [concept_content_roadmap.md](concept_content_roadmap.md). A full proposal from the planning agent, 2026-11-04, for the
owner to edit. Names, ingredients and rough levels are decided here; quantities, times, heals and prices are the ledger's.
Levels are the ladder's: copper 1, iron 15, silver 38, mythril 50, gold 62, adamantine 74, darkmetal 86. Built around the art already
in `public/assets/items/`: labelled sheet at [research/food_art/food_art_sheet.png](research/food_art/food_art_sheet.png).*

## The shape

- **Rules kept** ([concept_skill_loops.md](concept_skill_loops.md), closed 2026-10-24): food heals in fights; **drinks never heal**, they're
  work buffs; plain recipes; a Campfire or Kitchen for food and a Brewery for drinks; better stations are faster, not new lists.
- **Each rung adds**: crops or fruit, one fish, usually a meat, a few cooked foods, and a drink.
- **Three grades of food**: raw fruit heals least and needs no cooking; a single-ingredient cooked food heals more; **a meal crossing
  chains heals most**, which is why a guild wants farmers, fishers and hunters together.
- **Seven fish, seven rungs**: your seven drawn fish go in order of size and rarity.
- **Stews are the spine.** Your art has three stews in three bowls: plain, beef and carrot, potato and leek; in copper, iron and gold. The
  planning agent reads "bc" and "pl" that way; correct it if wrong.

## By rung

**Art**: H have, A adapt, N new.

### Copper (levels 1 to 14, Starter Camp and ring 1)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Redberry, Apple, Blackberry | fruit | bushes, orchard | Farming | raw food; Apple Juice; Blackberry Pie | H |
| Wheat, Carrot, Potato | crops | fields, from seed | Farming | Flour; stews; Baked Potato | H; Potato Seed A |
| Water | drink | Wishing Well | | Dough, stews, drinks; a small work buff | H |
| Raw Shrimp | fish | coast | Fishing | Shrimp | H |
| Game Meat, Crab Meat | meat | enemy drops | | Roast Meat, Cooked Crab | H; Crab Meat N |
| Honey, Beeswax Comb | | Beehive | Farming | Honey Bread; rods | H |
| Flour, Dough | prep | Windmill; Campfire | Farming; Cooking | Bread, pies | H |
| Shrimp, Baked Potato, Roast Meat, Cooked Crab | food | | Cooking 1 to 5 | fights | H, H, N, N |
| Bread | food | Dough | Cooking 6 | fights | H |
| **Plain Stew** (copper bowl) | meal | Carrot, Potato, Water | Cooking 10 | fights | H |
| Apple Juice | drink | Apple | Cooking 5 | work buff | H |

### Iron (15 to 37, ring 2)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Blueberry, Strawberry, Cherry, Grapes | fruit | bushes, orchard, vine | Farming | raw food; pies; juice | H |
| Onion, Celery, Leek | crops | fields | Farming | Mirepoix; stews | H; seeds A |
| Raw Beef | meat | Cows, pasture | | Steak; stews | H |
| Trout | fish | river, lake | Fishing | Cooked Trout | H |
| Mirepoix | prep | Carrot, Onion, Celery | Cooking 15 | stews | H |
| Cooked Trout, Steak, Honey Bread, Blackberry Pie | food | | Cooking 15 to 25 | fights | N, H, A, H |
| **Beef and Carrot Stew** (copper bowl) | meal | Beef, Carrot, Mirepoix | Cooking 30 | fights | H |
| **Potato Leek Stew** (copper bowl) | meal | Potato, Leek, Mirepoix | Cooking 30 | fights | H |
| Beer | drink | Water, Wheat | Cooking 15 | work buff (XP) | H |
| Grape Juice | drink | Grapes | Cooking 25 | work buff (fishing) | H |

### Silver (38 to 49, ring 2)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Peach, Raspberry, Lemon | fruit | orchard, bushes | Farming | raw food; Lemonade | H |
| Cabbage, Turnip | crops | fields | Farming | Garden Stew | H; seeds A |
| Raw Chicken, Egg | meat | Chickens, coop | Farming | Roast Chicken; Honey Chicken later | H |
| Tropical Fish | fish | coast | Fishing | Cooked Tropical Fish | H |
| Cooked Tropical Fish, Roast Chicken, Blueberry Pie | food | | Cooking 38 to 45 | fights | N, H, H |
| **Garden Stew** (iron bowl) | meal | Cabbage, Turnip, Mirepoix | Cooking 45 | fights | H |
| Lemonade | drink | Lemon | Cooking 40 | work buff | H |

### Mythril (50 to 61, ring 3)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Lime, Orange | fruit | orchard | Farming | Limeade, Orange Juice; raw | H |
| Tomato, Garlic | crops | fields | Farming | Sofrito | H; seeds A |
| Salmon | fish | river, lake | Fishing | Lavender Salmon | H |
| Sofrito | prep | Garlic, Onion, Tomato | Cooking 50 | stews | H |
| Lavender Salmon, Honey Chicken, Cherry Pie | food | | Cooking 50 to 55 | fights | A, H, H |
| **Hearty Beef Stew**, **Hearty Potato Stew** (iron bowl) | meals | as before, with Sofrito | Cooking 58 | fights | H |
| Limeade, Orange Juice | drinks | | Cooking 52, 56 | work buffs | H |

### Gold (62 to 73, ring 3): the ladder's "fine food"

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Pineapple, Banana | fruit | bushes, orchard | Farming | raw food | H |
| Corn | crop | fields | Farming | Golden Stew | H; seed A |
| Lobster | fish | coast | Fishing | Cooked Lobster | H |
| Cooked Lobster | food | | Cooking 62 | fights | H |
| **Golden Stew**, **Royal Beef Stew**, **Royal Potato Stew** (gold bowl) | meals | Corn or Beef or Potato, Sofrito, Honey | Cooking 66 to 70 | fights | H |
| Wine | drink | Grapes, aged | Cooking 65 | work buff | H (`potion_wine_grape`) |

### Adamantine (74 to 85, ring 3)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| Coconut, Watermelon | fruit | orchard, patch | Farming | raw food | H |
| **Emberroot** (name a suggestion) | crop | fields in hot places | Farming | Swordfish Steak | N, seed N |
| Swordfish | fish | coast | Fishing | Swordfish Steak | H |
| Swordfish Steak | food | Swordfish, Emberroot | Cooking 76 | fights | H |
| Mead | drink | Honey, Water | Cooking 78 | work buff | N |

### Darkmetal (86 to 99, ring 3)

| Name | Kind | Comes from | Made with | Used by | Art |
|---|---|---|---|---|---|
| **Voidcap** (name a suggestion) | crop | fields in dark places | Farming | Feast | N, spore N |
| Shark | fish | coast | Fishing | Cooked Shark, Feast | H |
| Cooked Shark | food | | Cooking 86 | fights | H |
| **Guildmaster's Feast** | meal | Shark, Royal Stew, Voidcap | Cooking 92 | the best fight food; Cooking's final challenge? | N |
| Elder Draught (name a suggestion) | drink | Voidcap, Mead | Cooking 90 | the best work buff | N |

## Moved or changed from today

- **Fish and their food move to their rung.** Today's levels are placeholders: Swordfish cooks at 4, Trout at 35.
- **Steak moves up**: it heals 35 at level 1 today, more than anything.
- **Eight fruits placed**, closing that Open link. Lemonade and Limeade placed.
- **Grape Juice keeps a juice picture to draw** if Wine takes `potion_wine_grape` (A).
- **Today's raw foods keep a role**: Slurm's first fight eats Redberries (brief 480).

## New art if approved

| | Count | What |
|---|---|---|
| New | about 10 | Crab Meat, Cooked Crab, Roast Meat, Cooked Trout, Cooked Tropical Fish, Emberroot, Voidcap, Mead, Feast, Elder Draught |
| Adapt | about 11 | nine crop seeds (from `seed_pile`), Honey Bread, Lavender Salmon, a Grape Juice |

## Open links

- **Enemies**: which enemies drop Game Meat, Crab Meat and Raw Chicken; the enemy session may add meats at higher rungs.
- **Wood and buildings**: a Chicken Coop, and any station upgrades.
- **Cooking's final challenge**: whether it asks for the Feast (roll-up).
- **Herbs and potions**: Lavender at mythril; more herbs may join meals.
- **World lines**: crops and waters' per-rung origins need updating (T-294).
- **Smithing**: bowls, if they become items.
