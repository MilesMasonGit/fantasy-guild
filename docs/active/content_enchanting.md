Status: approved 2026-11-04, amended 2026-11-21 (Planned entries staged 2026-11-26 in the `2026-11-26-planned-*` packs, T-305; the owner reviews and Syncs)

# Content roadmap: Enchanting

*Part of session 7 of [concept_content_roadmap.md](concept_content_roadmap.md), brought forward by the owner. Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; damage, quantities, times and prices are the ledger's.*

## The owner's rulings (2026-11-04)

- **Enchanting makes "tiered Wands and Staffs, as well as enchanting jewelry (made by crafting) and magic gear (made by Tailor)."** Space stays open for "other special weapons (such as a Flame Sword for Melee heroes)".
- **"Five tiers, but each one uses a mix of wood. Cedar and Ebony might be needed to craft the highest tier, for example. First tier should just use Oak wood, so it can be made early on."**
- **"Perhaps Staffs have group of types (Fire Staff, Ice Staff) but wands don't. Wands can have their elemental damage modified by Tomes held in the off hand. Sort of like Bow/Arrows, but easier to mix and match."** *Amended 2026-11-21: no off-hand Tome; Wands, Staffs and Tomes are three weapon kinds (below).*
- **Motes are basic items used in bulk for crafting, possibly ammo for magic too.** *Settled 2026-11-21: "Motes are for crafting and casting"; every cast spends one (below).*
- **"Leylines do produce the Motes. Getting access to the specific type of Leyline effectively 'unlocks' that kind of Magic."**
- **Leylines are part of Enchanting, with no skill of their own, and give very little XP.**
- **Motes needn't match damage types.** A set of Motes may lean toward one use, as with enchanting Chestplates.
- **One Leyline in the Starter Camp.**
- **The starter set of Motes: "Fire, water, wind, nature, light, dark."** "We can mix themes in the recipes (such as an Electric Staff using both Wind and Light motes)." More may come at higher tiers.

## Amended 2026-11-21 (Systems Audit, T-577, T-579, T-582)

The owner's rulings from the audit of Magic ([A17](audit/A17_magic.md)). They replace the lines they clash with on this page.

- **Wands, Staffs and Tomes are three magic weapon kinds**, "the equivalent of Swords, Axes, Maces for warriors." A Tome is held as the weapon, not in the off hand, and no longer changes a Wand's element. Each kind carries a small trait of its own, as every weapon kind does (T-565).
- **Every magic weapon names its element and the Mote a cast spends** (a field on the weapon). Motes needn't match the damage type.
- **Every cast spends one Mote**, carried and taken from the Bank like arrows. With none left the hero keeps casting at half damage in the weapon's element and says so once ("Needs Fire Mote": running out always reads "Needs X", owner 2026-11-21). The half is a dial on the tuning page (T-253).
- **Leylines give Motes for both crafting and casting**, so a Magic hero's running cost is a Leyline worked by an Enchanting hero.
- **Leather and cloth don't cut Magic damage; metal does** (T-580).
- **The Copper and Iron Wands retire** once this lands, as below.

**What the content agent builds from this** (planning agent's calls, simplest first):

- **One Wand per tier, taking the element of the Mote it burns** (owner 2026-11-21): Novice Fire (Fire Motes), Adept Ice (Water Motes), Expert Electric (Wind Motes), Master Dark (Dark Motes), Grandmaster Light (Light Motes). Each Wand opens a new element.
- **One Tome per tier, as Wands** (owner 2026-11-21): the six Tomes on the list become five, one at each tier's level. ⚠️ Which element each tier's Tome carries is the content agent's call when it writes the pack; Poison Magic has no other source (Wands give Dark and Light), so one Tome must carry Poison.
- **A weapon's cast Mote is the first Mote in its recipe** unless the content agent finds a reason otherwise (a Novice Fire Staff spends Fire Motes, an Ice Staff Water Motes).

## Leylines and Motes

A hero with Enchanting works a Leyline, like a vein, and gets its Motes and very little XP. Not recipes, so they take no levels on the list. Better items just use more Motes.

*This list (6 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Enchanting. The rulings and reasoning stay on this page.*

**Six Leyline Tokens**: one to draw, then recolours; `t_enchant` may suit.

## The recipes

**55 recipes and 44 levels open** (the Tomes now count as weapons; amended 2026-11-21; the counts move by one when the six Tomes become one per tier), for Tailor's magic gear, special weapons like a Flame Sword, and magical arrows. Five tiers at 1, 20, 40, 60, 80; each has a Wand (its Mote's element), a Tome, and Fire, Ice and Electric Staffs. Wood is Oak at tier 1, then the tier's main wood with Birch or Cedar.

*This list (55 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Enchanting. The rulings and reasoning stay on this page.*

**Art: 52 adapt, 3 new.** To draw: one wand, one staff, one tome. Enchanted jewellery could be your 24 pieces with a shine added in code, and Warded Chestplates your plates likewise. `body_mage_plus` and `hat_mage_plus` suit enchanted Tailor gear.

## Planning agent's calls

- **Names are suggestions**: Novice to Grandmaster, Warded.
- **Mixes**: Ice is Water and Wind; Electric is Wind and Light (the owner's example); Poison is Nature and Dark.
- **Where they're found**: Light in ring 1, because the Electric Tome and Staff need it from tier 1; Dark in ring 2, as the first use is Poison at level 22.
- **Each Wand asks for a different Mote** (Fire, Water, Wind, Dark, Light), so reaching the next Wand means finding that Leyline. Since 2026-11-21 that Mote is also what it spends to cast, and its element is the Wand's (owner).
- **Gems also go into Staffs from tier 2**: Ruby Fire, Sapphire Ice, Topaz Electric. Each gem's jewellery uses a matching Mote: Ruby Fire, Sapphire Water, Emerald Nature, Topaz Wind, Amethyst Dark, Diamond Light.
- **Warded Chestplates** give Nature Motes a job, on the five main metals, soon after Smithing makes each.

## Moved or changed from today

- **Copper Wand and Iron Wand retire** for Novice and Adept Wands, when this lands. ⚠️ They set Magic's damage type today (Fire, Ice), so Magic heroes need a new Wand, Staff or Tome first (amended 2026-11-21: no Tome in the off hand).
- ⚠️ **New mechanisms**: ~~a Wand with no type of its own, an off-hand Tome that sets it~~ (dropped 2026-11-21), and **Motes spent on every cast** (kept 2026-11-21, T-579, with the half-damage cast). Combat v2 set Motes aside; this amends [concept_combat_v2.md](concept_combat_v2.md).
- **Enchanting's play**: the old sketch of a table with three slots ([concept_skill_loops.md](concept_skill_loops.md)) is replaced by working Leylines and a table, unless the owner wants it kept.

## Open links

- ⚠️ **A Leyline you can't reach is a wall**: a run whose world lacks an element must still reach it. World generation must place them (T-294), and every recipe's Motes must be reachable by its level.
- **Very little XP**: Enchanting levels come mostly from recipes, so its early levels depend on making Wands and Tomes (ledger).
- **Blank Books** for Tomes come from Crafting.
- **Tailor**: its gear, for enchanted versions. **Crafting**: its 24 pieces of jewellery, which these need first.
- **Fletching**: which magical arrows, and who makes them.
- **Mining**: gems must be available by level 24.
