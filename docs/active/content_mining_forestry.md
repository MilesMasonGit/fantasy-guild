Status: approved 2026-11-04, **Mining and Forestry amended 2026-11-24 by the owner's review** ([brief 860](briefs/860_gathering_rework.md); a CMS pack still to come)

# Content roadmap: Mining and Forestry Tokens

*Part of the gathering sessions of [concept_content_roadmap.md](concept_content_roadmap.md). From the owner's picks, 2026-11-04. Levels are the planning agent's and rough; yields and timings are the ledger's.*

## The owner's rulings (2026-11-04)

"Forestry doesn't really have an item chain progression like the others... Same with Mining. For these, I think we could try coming up with some creative tokens to practice these skills on. They have big gaps between tiers, and we could put a couple interesting resources in there, such as Clay and Quartz for Mining."

**Picked**: Clay, Quartz, Geode, Fallen Star, Fossil Bed; Hollow Tree, Driftwood Logjam (the owner's idea), Giant Mushroom, Bamboo Grove. **One Geode gives all the gems.** Metals and woods stay on their 20-level tiers. Tokens don't use up a recipe level.

**Bold** names are new. Art: H have, A adapt, N new.

## Mining

*This list (14 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Mining and Forestry. The rulings and reasoning stay on this page.*

**Stone**: three tiers, Stone, Marble and Basalt (owner, 2026-11-04; [Construction](content_construction.md)). Granite and Sandstone are cut or go to another skill.

## Forestry

**Better trees need better axes** (owner, 2026-11-05), as better metals need better picks: Copper for Oak and Fir, Iron for Birch and Maple, Mythril for Cedar, Adamantine for Mahogany, Darkmetal for Ebony.

*This list (11 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Mining and Forestry. The rulings and reasoning stay on this page.*

## What this changes

- **Metals and woods move to the 20-level tiers**: today's veins and trees ask for 15, 30, 45, 60, 75 and 90 (world tables and CMS, T-294).
- **Silk** stays with spiders (enemy session). **Mushrooms** go to Alchemy's and Cooking's lists when those sessions take them up.
- **One Geode for all gems**: it opens at 15, so ⚠️ a Diamond can come very early by luck, and Crafting's and Enchanting's gem levels have to allow that. Rare enough that the ledger treats it as a bonus.
- **Late Forestry has no special Tokens** after level 35.
- **Trees change**: every tree asks for a copper axe today, or none. The higher trees move up to the axes above, and the game can already ask for that.
- **New behaviours** (a burst, a rich one-off, standing on water, a tiny fast yield) are Token rules. Which exist today hasn't been checked; each needs checking when it's briefed.

## Amended 2026-11-21 (content agent, building T-624)

- **A vein asks the pickaxe of the metal before its own**, not its own: a Mythril Vein that asked the Mythril Pickaxe would need mythril to get mythril, a loop the pack gate caught. Copper, Coal, Stone, Clay, Quartz and Iron: Copper Pickaxe; Silver and Mythril: Iron; Gold and Adamantine: Mythril; Darkmetal: Adamantine. The Darkmetal Pickaxe opens Basalt and the Fossil Bed when they come. Trees keep the owner's axe list (2026-11-05), which has no loop.
- **Adamantine, not Adamantium**: the pickaxe and the vein take the ore's name (ids unchanged).

## Amended 2026-11-24: Mining review (owner)

*The owner's review of the gathering skills, after Fishing ([content_fishing.md](content_fishing.md)).
Replaces the lines it clashes with above and in [concept_skill_loops.md](concept_skill_loops.md)
"Mining" (the count of about 5 ore).*

1. **A vein goes to rest by chance**: each cycle has a chance the vein empties (Copper about 1 in 5,
   keeping today's average), **no counter**; the rest and the refill all at once stay. Nothing counts
   down on the mat (playmat declutter §15); a resting vein shows its resting look.
2. **The pickaxe gate stays**: each ore asks the pickaxe of the tier below (21 Nov); a better pick is
   also faster (730 D6). Fishing's kind-only rule is Fishing's own.
3. **Veins stay put**: they come from the map (or an Excavation) and never drift like fishing spots.
4. **Excavation, Mining's gathering foundation, digs a new vein**
   ([concept_gathering_foundations.md](concept_gathering_foundations.md)). Building it needs an
   **Ore Prospecting Map** for that ore (one item per ore, spent on the build): a **rare drop from
   mining that ore**, or from other sources (a Rock Golem's drops). Any Region; **as many as the
   Token cap allows**. Mines and Minecarts stay on today's Foundations.
5. **Geode, Fallen Star and Fossil Bed are rich event nodes**: they land now and then like the Fish
   Shoal, give a rich rush, and go when worked out ([content_events.md](content_events.md)). Clay and
   Quartz are ordinary veins.

## Amended 2026-11-24: Forestry review (owner)

*Replaces the lines it clashes with above and in [concept_skill_loops.md](concept_skill_loops.md)
"Forestry" (logs per tree as a count; a seedling per new Sapling).*

1. **A tree is felled by chance**: each chop has a chance it becomes a Stump (an Oak about 1 in 5,
   keeping today's average of 5 logs), **no counter**.
2. **The axe gate stays** (5 Nov): Copper for Oak and Fir, Iron for Birch and Maple, Mythril for
   Cedar, Adamantine for Mahogany, Darkmetal for Ebony; a better axe is also faster.
3. **Farmland becomes a Forest** (owner 2026-11-25: no Nursery; Farmland on grass builds Forests as well as Fields) of a chosen species, paid in that
   species' seeds as a Forest is today
   ([concept_gathering_foundations.md](concept_gathering_foundations.md)). Wild Forests on the map stay.
4. **No seedling per Sapling**: a Forest in reach regrows Stumps and plants Saplings for free; the
   seeds are paid once, to build the Forest. ⚠️ Overturns 2026-10-22 and 2026-10-24 ("a Stump spends
   one seedling", "every new Sapling costs one seedling").
5. **A Stump with no Forest of its kind in reach still never regrows** (kept); it can be demolished.
6. **Hollow Tree, Driftwood Logjam, Giant Mushroom and Bamboo Grove are rich event nodes**: they land
   now and then, give a rich rush, and go when worked out ([content_events.md](content_events.md)).

### Forests are tree spawners (owner, 2026-11-24, same review)

*Replaces "Forests speed up nearby regrowth", "Forests stack fully, down to a floor" and the 2026-10-22
"a Forest both plants and regrows" mechanics in [concept_skill_loops.md](concept_skill_loops.md); "less
complicated" (owner).*

7. **A Forest is a tree spawner**: it plants **a few trees of its species** within its reach (about 4
   or 5, per species in the CMS), and **regrows the trees it spawned**: its own Stumps come back on
   their own. **No speed boost to other trees, no stacking, no floor.** Spawned trees count toward the
   Token cap (T-102).
8. **Every tree a Region starts with belongs to one of its wild Forests**: one rule for all trees.
9. **Regrow time is fixed per species** (an Oak about 5 minutes, felled to harvestable), **and can be
   shortened by later upgrades** (a Guild Hall star or a Forestry building, to be designed). **The first is the Hall star Green Thumb** (owner 2026-11-24): its Grow Time shortens a Forest's own regrowth (T-698).
10. **A demolished Forest's trees stay** as lone trees; once felled, their Stumps never regrow (point 5;
    clear them with Demolish).

**The pack** (content agent, 2026-11-24; `2026-11-24-forests-own-trees`, 23 entries, lands with brief
860 R2's code): each Forest plants **5 trees for Oak, Fir and Birch, 4 for Maple, Cedar, Mahogany and
Ebony** (the slower woods a little fewer); no seedling upkeep, no Growth boost (the eight Growth
effects go), and its Stumps regrow free at today's times (Oak 5 minutes, up to 10 for the late woods).
The Apple Orchard keeps its 2 Apple Trees, free, which fruit again while it stands.

