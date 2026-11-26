Status: approved 2026-11-04, amended 2026-11-21 (Planned entries staged 2026-11-26 in the `2026-11-26-planned-*` packs, T-305; the owner reviews and Syncs)

# Content roadmap: Fletching

*Part of session 7 of [concept_content_roadmap.md](concept_content_roadmap.md), brought forward by the owner. Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; damage, quantities, times and prices are the ledger's.*

## The owner's rulings (2026-11-04)

- **A bow and an arrow per tier.** "Arrows are crafted from wood, feathers, and arrowheads."
- **"Bows are primarily made out of wood (Oak Bow, Birch Bow, etc) whereas crossbows use metal."**
- **"Basic arrows (Copper arrow, mythril arrow) should just do physical stab damage, but magical variants will mix this up."**
- **Silver and gold may be one ingredient on higher level bows. Silver arrowheads yes, gold no.**
- **"I'm okay with some more gaps in Fletching."** Later skills such as Alchemy add things like poisoned arrows.
- **Materials**: wood from Forestry, String, Feathers.
- **Five woods only**: Oak, Fir, Maple, Mahogany, Ebony. "Birch and Cedar won't be used for Fletching. We'll make use of these with Enchanting/wandmaking."
- **String comes from Tailor**, a new skill (owner, 2026-11-04).

## Amended 2026-11-21 (Systems Audit, T-572)

The owner's rulings from the audit of Ranged ([A16](audit/A16_ranged.md)).

- **Fletching makes bows and arrows now**, by this plan, so arrows exist; today the two arrows have no recipe, drop or shop. The Copper and Iron Bows retire once it lands; the Iron Bodkin Arrow becomes the Iron Arrow.
- **"Bows primarily add Stab damage, though a few special ones may have elemental damage on the bow as well."** This replaces the call that the bow keeps its own damage type (below). Today both bows are Electric.
- **No shot without arrows** (T-573): the hero leaves the fight and says so ("Needs Copper Arrow": running out always reads "Needs X", owner 2026-11-21), and a hero with a bow and no arrows starts none. Arrows are spent hit or miss; saving them comes from gear, trinkets, perks and a Hall star (T-574), not a quiver.

## The list

Tiers follow the 20-level rule; woods and metals open at the ladder's amended levels.

*This list (16 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Fletching. The rulings and reasoning stay on this page.*

**16 recipes; every other level stays open** for magical and poisoned arrows and whatever later skills add.

**Art: 1 have, 13 adapt, 2 new.** One bow and one crossbow to draw, then recolours. String is on Tailor's list and the station is the Fletcher's Lodge (2026-11-21).

## Planning agent's calls

- **Crossbows fire the same arrows**, with no separate bolts, so ammo doesn't double. Their job is **slow and strong**, against the bow's faster shots; the ledger sets the numbers.
- **The bow keeps its own damage type**, as combat has it; plain arrows add Stab. Which bow carries which type is for the magical variants. *Amended 2026-11-21: bows mostly add Stab; only a few special bows carry an element.*
- **Silver on the Mahogany Bow, gold on the Ebony Bow.** The Silver Arrow uses Fir, the wood open at that level.

## Moved or changed from today

- **Copper Bow and Iron Bow retire** for Oak Bow and Fir Bow; they leave the Smithy. Iron Bodkin Arrow becomes Iron Arrow.
- **Fletching has no station or content today.** Until it's built, ⚠️ Ranged must keep a way to get a bow: retire the old ones only when this lands.

## Open links

*Brought up to date 2026-11-21 (T-572), as far as approved plans and rulings settle them.*

- **String: settled.** Tailor makes String from Flax at Tailor level 1 ([Tailor](content_tailor.md)), so the Oak Bow at Fletching 1 can be made early. The Flax Field opens at Farming 3, so the first bow waits on a farmer reaching level 3.
- **Feathers: settled.** Early, a **Bird Nest breaks into a few Feathers** (owner 2026-11-21), so the Copper Arrow at Fletching 2 does not wait on Forestry 10; a recipe or a break-down the content agent writes in the pack, a few Feathers per Nest. The Hollow Tree gives them steadily from Forestry 10 ([Mining and Forestry](content_mining_forestry.md)); Alchemy's Swift Hands uses them too.
- **The building: settled.** Fletching works at the **Fletcher's Lodge**, a skill building at Construction 1 with Bowyer's Hall and Arrow Works variants ([Construction](content_construction.md)), by the rule of one structure per skill. The "Fletcher's Bench" this list once asked for is that Lodge.
- **Alchemy**: poisoned arrows stay a possible Fletching recipe for later; Alchemy's own poisons are for Stealth only (T-587). **Enchanting**: magical variants, and which skill makes them, still open.
