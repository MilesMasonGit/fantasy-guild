Status: approved 2026-11-07, amended the same day after a critical review (samples in the review's notes, below)

# Balance rules

*The formulas that give every item, recipe, Token and upgrade its starting numbers, from the owner's rulings in [concept_balancing.md](../active/concept_balancing.md) (2026-11-07). A script turns them into CMS change packs; the progression ledger then times the result and nudges what's off the curve. Every number here comes from `.claude/skills/content/balance_rules.py`: change a constant there, re-run, and copy the tables. Combat (damage, defence, healing, enemy strength) is its own segment, later.*

## How to read this page

**Everything follows the level a thing unlocks at** (written L). Tiers start at copper 1, iron 20, silver 30, mythril 40, gold 50, adamantine 60 and darkmetal 80, so "one tier later" means about 20 levels on.

**Five rules, one per kind of number:**

| Number | Rule | In one line |
|---|---|---|
| XP | The new XP table and **XP an hour doubling every 20 levels** | An old task is 2x slower a tier later, 4x two tiers on |
| Action time | **A little longer every 20 levels** (x1.15) | So work-speed buildings keep paying |
| Ingredient counts | **Double every 40 levels**, raw ingredients only | 2 ore a copper bar, 8 a darkmetal bar |
| Drops and finds | **Set as finds a day** for one hero | Basic drops every kill; bonus finds 20 a day; rare gear drops 1 a day |
| Upgrade prices | **Payback from 1 hour to 1 day**, by tier | Always worth buying, late ones are goals |

**These are starting numbers.** The ledger reads them, times the whole game at the Bare, Typical and Maxed players, and its balancing preview proposes nudges. A nudge that goes beyond what these rules allow means the rule changes, on this page.

## 1. XP

**The pace curve** (the ladder's ruling) says how long one level takes: 3 minutes at 1, 8 at 10, 30 at 20, 3 hours at 40, 12 hours at 60 and a day at 99, smoothly in between. One skill's climb is about 34 days.

**XP an hour doubles every 20 levels** (owner, 2026-11-07: "2x a tier"). A task unlocked at level L pays **1,660 × 2^((L − 1) / 20) XP an hour**. That's what level 1's 83 XP in 3 minutes makes, so the start stays as it is today.

**The XP table follows from the two**: the XP a level needs is that level's XP an hour × its minutes ÷ 60. ⚠️ This replaces today's table (the RuneScape formula in `src/utils/XPCurve.js`), which would make every tier's work pay the same XP an hour up to level 45. It's a code change (T-337), and it shifts levels in old saves.

| Level | Minutes a level | XP an hour, new work | XP to the next level | XP to reach it |
|---|---|---|---|---|
| 1 | 3 | 1,660 | 83 | 0 |
| 5 | 5 | 1,907 | 147 | 418 |
| 10 | 8 | 2,268 | 302 | 1,421 |
| 20 | 30 | 3,207 | 1,603 | 8,587 |
| 30 | 73 | 4,535 | 5,555 | 38,453 |
| 40 | 180 | 6,414 | 19,241 | 141,911 |
| 50 | 360 | 9,071 | 54,423 | 463,001 |
| 60 | 720 | 12,828 | 153,932 | 1,371,179 |
| 70 | 860 | 18,141 | 260,034 | 3,342,273 |
| 80 | 1,027 | 25,655 | 439,271 | 6,672,004 |
| 90 | 1,227 | 36,282 | 742,052 | 12,296,861 |
| 98 | 1,415 | 47,874 | 1,128,746 | 19,480,579 |

About 20.6 million XP to 99. Today's table needs about 13 million.

**XP per action** = the XP an hour × the action's seconds ÷ 3,600, rounded, at least 1. The seconds are **the work cycle alone**: rests don't count, because the rest rule (section 2) keeps a lone hero busy most of the time.

**Which level's XP an hour**: the level halfway between this unlock and the skill's next one, not the unlock itself. In a skill with few unlocks (Mining's metals, Fletching), XP an hour stays flat while the table keeps rising, so without this those skills climb about 40 % slower than the curve (review: Mining 47.7 days against 34.4; with the midpoint, 35.0). Where the next unlock is the next level, it's the same as the unlock level.

**Pick action seconds that give whole XP early on**: at 3 to 12 XP an action, rounding can be 13 % off.

- **An old task falls behind**: 2x slower a tier later, 4x two tiers on, and about 30x slower at 99. Reaching 99 on a level-1 task alone would take about 517 days of one hero's work.
- **Crafting and gathering pay the same an hour** at the same level (owner). A craft pays more per action only because it takes longer.
- **Each link of a chain pays its own XP**, to its own skill. A late item earns the guild several skills' XP, and the guild pays for that in materials.
- **Aimed at a hero with no boosts.** A Typical player's buildings and drinks make them a little faster than the curve. The ledger checks that Bare stays playable and Maxed doesn't trivialise it (within 3x of the curve), and nudges XP if it doesn't.

## 2. Action time

**Seconds = the kind's base × 1.15^(L / 20)**: a little longer each tier, so Faster Work buildings and speed drinks keep their worth late (owner).

| Kind | What | At 1 | 20 | 40 | 60 | 80 |
|---|---|---|---|---|---|---|
| Gather | Veins, trees, crops, fishing, herbs | 6.0 | 6.9 | 7.9 | 9.1 | 10.5 |
| Prepare | Ingots, planks, cloth, leather, cut gems, flour | 8.1 | 9.2 | 10.6 | 12.2 | 14.0 |
| Make | Gear, tools, food, drinks, potions, jewellery, enchanting | 12.1 | 13.8 | 15.9 | 18.3 | 21.0 |

The base times (6, 8 and 12 seconds) are starting values (agent's call). Builds, growth and fights aren't timed here: builds and growth follow the ledger's one-off step rule (no wait longer than the pace allows there), and fights belong to combat.

**A make step takes longer the more bars it uses**: seconds × (1 + 0.2 × (count − 1)). A Chestplate (5 bars) takes 1.8x a Dagger (1 bar). Without it, XP per bar favours the smallest item, and players grind Daggers (review: 263 XP a bar for a darkmetal Dagger, 151 for a Chestplate).

**The rest rule**: a gathering Token's uses × its cycle is at least 3 × its rest, so one hero on one copy is busy at least 75 % of the time. Today's veins hold 5 uses of 3 to 4 seconds, then rest 60 to 90 seconds, so a lone hero waits most of the time and a camp of three copies earns 3 to 4x as much (review, from `rates.js`).

## 3. Ingredient counts

**Only steps made from raw things grow.** Ore, wood, crops, herbs, fish and drops are raw: their count is **base × 2^(L / 40)**, rounded, doubling every two tiers (owner). A step made from made things (bars, cloth, leather, a Sofrito) uses **a fixed count for its kind** at every tier. Late gear costs more because its bars cost more, and never piles into hundreds of ore (owner's first ruling).

| Base | At 1 | 20 | 30 | 40 | 50 | 60 | 80 | 99 |
|---|---|---|---|---|---|---|---|---|
| 1 (most raw ingredients) | 1 | 1 | 2 | 2 | 2 | 3 | 4 | 6 |
| 2 (ore per bar, wood per plank) | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 11 |

**What one gather action gives stays the same at every tier** (owner, after the review): "Increased ingredient gain is expected through building and Star upgrades. In practice we do grow yields, but for the base numbers they should not." So a Bare guild needs more gatherers per crafter as it climbs (about 2 per smelter at copper, 8 at darkmetal), and **yield boosts close the gap**: Double Output buildings, the Logging and Mining Camps' variants, and the Hall's yield stars. Their targets grow by tier so a Typical guild keeps about one or two gatherers per crafter (section 5).

**Fixed counts by kind** (agent's call, starting values): Dagger 1, Sword 2, Woodaxe and Pickaxe 2, Gloves and Boots 2, Helmet or Hat 3, Shield 3, Mace and Cleaver 3, Cape 3, Chestplate, Chest, Robe and Tunic 5. A handle is 1 wood. Nails, Arrowheads, Chain and Bands take 1 bar and make several. Weird items in potions are 1. Water and juices in drinks and potions are 1.

## 4. Drops and finds

**A rate is set as finds a day**, for one hero working all day, then turned into a chance: **chance = finds a day × the action's seconds ÷ 86,400** (owner: "a low drop rate is still a steady source"). Only repeatable work counts; a one-off find that wears out (a Fallen Star, a Shipwreck) is still luck.

| Kind | Rule | Example |
|---|---|---|
| **Basic drop** (Hide, Silk, meat, scales) | Every kill; quantity base 1 to 2 × 2^(L / 40) (owner: "near-sure... maybe in larger quantities") | 1 to 2 at copper, 4 to 8 at darkmetal |
| **Bonus find** (gems while mining, Bird Nests, Pearls) | **About 20 a day** (owner) | 1 in 715 on a copper vein; 1 in 412 on a darkmetal vein |
| **Rare gear drop** | **About 1 a day** (owner) | 1 in 7,200 on a 12-second fight (0.014 %) |
| **Byproducts that keep a loop going** (seeds, seedlings) | Enough to replant; the ledger checks every loop | |
| **Boss drops** | With the enemies session | |

**The same finds a day at every tier** (owner), so the chance per action rises slightly as actions lengthen.

**Rare items are a gate** (owner, after the review): "Rare items are a gate that can be passed by having multiple heroes working on similar tasks, or by using boosts." 20 a day is the default for one unboosted hero. A find whose gate needs more (or fewer) is set by that: one hero alone is slow to pass it, and several heroes or boosts pass it in good time. The review's count, about 600 gems a month from a few miners against 44 pieces worn, is the check to run when the jewellery pack is made.

## 5. Boosts and upgrades

**Boosts of one kind add up** in the game (`ModifierAggregator`): +30 % and +20 % make +50 %, not +56 %. Speed boosts cut the time, and **no stack cuts more than 80 %** (`workTime.js`).

**Speed: keep the cap, lower the targets** (owner, after the review). Every speed boost a Maxed hero can hold, Hall included, adds up to **at most a 65 % cut**, inside the 3x bound and short of the 80 % cap, so one more Faster Work building always still helps. The Hall's late +100 % is no longer a speed target: its speed stars share the budget.

| Kind | Target |
|---|---|
| A Faster Work building | about −20 % time |
| A speed drink | about −10 % time |
| Hall speed stars, all ranks of a skill | about −35 % time |
| **Yield** (Double Output, camps' variants, Hall yield stars) | grows by tier, so a Typical guild needs one or two gatherers per crafter: about +50 % at iron to +300 % at darkmetal together |
| **A rare-find potion** | **+100 %, rising to +200 % for late potions** (owner) |
| **A Rare Finds building** | **+50 %** (owner); with a potion, x2.5 to x3.5 |
| Other Hall stars (XP, more finds) | +10 % early, up to +100 % late |

**Consumables last a number of cycles, and crafts make batches** (owner, after the review: "A dose is meant to last a number of cycles, not time. But also we will make batches."). **A batch must pay back at least 4x**: the work time the whole batch saves (or the finds it adds) is at least four times the hero time it took to make, its ingredients included. ⚠️ Today a work potion lasts 1 cycle and a drink 10 (`consumableRule.js`), so a batch would need to be very large: the dose lengths are worth raising (T-338).

**Upgrade prices go by payback** (owner): the hours of the boosted work it takes to earn back the price. **For a Hall star that boosts the whole guild, payback counts all the work it boosts**, not one hero's. **Payback = 1 hour × 24^(L / 80)**: 1 hour at 1, 2.2 at 20, 4.9 at 40, 10.8 at 60, a day at 80. That covers Guild Hall stars and building variants, priced in the tier's materials.

## Worked examples

**Ingots, copper to darkmetal** (Smithing; prepare):

| Metal | L | Ore | Coal | Seconds | XP | A Chestplate (5 bars) |
|---|---|---|---|---|---|---|
| Copper | 1 | 2 | 1 | 8.1 | 4 | 10 ore, 5 coal |
| Iron | 20 | 3 | 1 | 9.2 | 8 | 15 ore, 5 coal |
| Silver | 30 | 3 | 2 | 9.9 | 12 | 15 ore, 10 coal |
| Mythril | 40 | 4 | 2 | 10.6 | 19 | 20 ore, 10 coal |
| Gold | 50 | 5 | 2 | 11.3 | 29 | 25 ore, 10 coal |
| Adamantine | 60 | 6 | 3 | 12.2 | 43 | 30 ore, 15 coal |
| Darkmetal | 80 | 8 | 4 | 14.0 | 100 | 40 ore, 20 coal |

The ores themselves (gather): copper ore 6.0 s and 3 XP, iron 6.9 s and 6 XP, mythril 7.9 s and 14 XP, adamantine 9.1 s and 33 XP, darkmetal 10.5 s and 75 XP.

**Bread, a short chain** (four links, each paying its own skill):

| Link | L | Kind | Seconds | XP |
|---|---|---|---|---|
| Wheat (Farming) | 4 | gather | 6.2 | 3 |
| Flour | 4 | prepare | 8.2 | 4 |
| Dough (Cooking) | 4 | prepare | 8.2 | 4 |
| Bread (Cooking) | 7 | make | 12.6 | 7 |

**Master's Draught, a late potion** (Alchemy 90): 5 Starflower and 5 Moonpetal (base 1 at L 90), 1 Voidcap as the weird item, 1 Elder Draught as the base. It takes 22.5 s and pays 227 XP. Its herbs pay Farming 75 XP (Starflower, L 80) and 33 XP (Moonpetal, L 60) each, and the Elder Draught pays Cooking.

## Not covered yet

The review listed numbers no rule sets yet; each needs a rule when its chain is balanced:

- **Arrows and Kunai per craft**: an archer can loose about 1,200 arrows an hour, so a craft must make many.
- **Recipes with several outputs, or chance outputs**: how their XP is split.
- **Food's healing** against the time it takes to make, with combat.
- **Station charges, Construction prices and tool prices**, against what they save.
- **Combat XP**, with combat.

## What this page needs elsewhere

- **The ladder's pace curve and stage budgets in the ledger's settings** (T-294).
- **The new XP table in the game** (T-337).
- **Rare finds judged by finds a day, and rare-find boosts with their own target** (T-336).
- **Longer doses, a ledger that counts gatherers per crafter, and the speed budget** (T-338).
- **A script that writes these numbers onto the Planned entries**, once they're in the CMS (T-305): a brief for the director.
- **Combat's power curve**: its own segment.
