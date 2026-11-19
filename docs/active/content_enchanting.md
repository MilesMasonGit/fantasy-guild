Status: approved 2026-11-04 (a CMS pack of Planned entries still to come)

# Content roadmap: Enchanting

*Part of session 7 of [concept_content_roadmap.md](concept_content_roadmap.md), brought forward by the owner. Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; damage, quantities, times and prices are the ledger's.*

## The owner's rulings (2026-11-04)

- **Enchanting makes "tiered Wands and Staffs, as well as enchanting jewelry (made by crafting) and magic gear (made by Tailor)."** Space stays open for "other special weapons (such as a Flame Sword for Melee heroes)".
- **"Five tiers, but each one uses a mix of wood. Cedar and Ebony might be needed to craft the highest tier, for example. First tier should just use Oak wood, so it can be made early on."**
- **"Perhaps Staffs have group of types (Fire Staff, Ice Staff) but wands don't. Wands can have their elemental damage modified by Tomes held in the off hand. Sort of like Bow/Arrows, but easier to mix and match."**
- **Motes are basic items used in bulk for crafting, possibly ammo for magic too.**
- **"Leylines do produce the Motes. Getting access to the specific type of Leyline effectively 'unlocks' that kind of Magic."**
- **Leylines are part of Enchanting, with no skill of their own, and give very little XP.**
- **Motes needn't match damage types.** A set of Motes may lean toward one use, as with enchanting Chestplates.
- **One Leyline in the Starter Camp.**
- **The starter set of Motes: "Fire, water, wind, nature, light, dark."** "We can mix themes in the recipes (such as an Electric Staff using both Wind and Light motes)." More may come at higher tiers.

## Leylines and Motes

A hero with Enchanting works a Leyline, like a vein, and gets its Motes and very little XP. Not recipes, so they take no levels on the list. Better items just use more Motes.

*This list (6 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Enchanting. The rulings and reasoning stay on this page.*

**Six Leyline Tokens**: one to draw, then recolours; `t_enchant` may suit.

## The recipes

**55 recipes and 44 levels open**, for Tailor's magic gear, special weapons like a Flame Sword, and magical arrows. Five tiers at 1, 20, 40, 60, 80; each has a Wand and Fire, Ice and Electric Staffs. Wood is Oak at tier 1, then the tier's main wood with Birch or Cedar.

*This list (55 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Enchanting. The rulings and reasoning stay on this page.*

**Art: 52 adapt, 3 new.** To draw: one wand, one staff, one tome. Enchanted jewellery could be your 24 pieces with a shine added in code, and Warded Chestplates your plates likewise. `body_mage_plus` and `hat_mage_plus` suit enchanted Tailor gear.

## Planning agent's calls

- **Names are suggestions**: Novice to Grandmaster, Warded.
- **Mixes**: Ice is Water and Wind; Electric is Wind and Light (the owner's example); Poison is Nature and Dark.
- **Where they're found**: Light in ring 1, because the Electric Tome and Staff need it from tier 1; Dark in ring 2, as the first use is Poison at level 22.
- **Each Wand asks for a different Mote** (Fire, Water, Wind, Dark, Light), so reaching the next Wand means finding that Leyline.
- **Gems also go into Staffs from tier 2**: Ruby Fire, Sapphire Ice, Topaz Electric. Each gem's jewellery uses a matching Mote: Ruby Fire, Sapphire Water, Emerald Nature, Topaz Wind, Amethyst Dark, Diamond Light.
- **Warded Chestplates** give Nature Motes a job, on the five main metals, soon after Smithing makes each.

## Moved or changed from today

- **Copper Wand and Iron Wand retire** for Novice and Adept Wands, when this lands. ⚠️ They set Magic's damage type today (Fire, Ice), so Magic heroes need a Tome.
- ⚠️ **New mechanisms**: a Wand with no type of its own, an off-hand Tome that sets it, and **Motes as ammo, if kept**. Combat v2 set Motes aside; this amends [concept_combat_v2.md](concept_combat_v2.md).
- **Enchanting's play**: the old sketch of a table with three slots ([concept_skill_loops.md](concept_skill_loops.md)) is replaced by working Leylines and a table, unless the owner wants it kept.

## Open links

- ⚠️ **A Leyline you can't reach is a wall**: a run whose world lacks an element must still reach it. World generation must place them (T-294), and every recipe's Motes must be reachable by its level.
- **Very little XP**: Enchanting levels come mostly from recipes, so its early levels depend on making Wands and Tomes (ledger).
- **Blank Books** for Tomes come from Crafting.
- **Tailor**: its gear, for enchanted versions. **Crafting**: its 24 pieces of jewellery, which these need first.
- **Fletching**: which magical arrows, and who makes them.
- **Mining**: gems must be available by level 24.
