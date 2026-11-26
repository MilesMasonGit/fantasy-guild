Status: approved 2026-11-07, amended the same day after a critical review and the owner's smooth curve

# Balance rules

*The formulas that give every item, recipe, Token and upgrade its starting numbers, from the owner's rulings in [concept_balancing.md](../active/concept_balancing.md) (2026-11-07). A script turns them into CMS change packs; the progression ledger then times the result and nudges what's off the curve. Every number here comes from `.claude/skills/balancer/balance_rules.py`: change a constant there, re-run, and copy the tables. Combat (damage, defence, healing, enemy strength) is its own segment, later.*

## How to read this page

**Everything follows the level a thing unlocks at** (written L). Tiers start at copper 1, iron 20, silver 30, mythril 40, gold 50, adamantine 60 and darkmetal 80, so "one tier later" means about 20 levels on.

**Six rules, one per kind of number:**

| Number | Rule | In one line |
|---|---|---|
| XP | The new XP table and **XP an hour doubling every 20 levels** | An old task is 2x slower a tier later, 4x two tiers on |
| Action time | **A little longer every 20 levels** (x1.15) | So work-speed buildings keep paying |
| Ingredient counts | **Double every 40 levels**, raw ingredients only | 2 ore a copper bar, 8 a darkmetal bar |
| Drops and finds | **Set as finds a day** for one hero | Basic drops every kill; bonus finds 20 a day; rare gear drops 1 a day |
| Upgrade prices | **Payback from 1 hour to 1 day**, by tier | Always worth buying, late ones are goals |
| Gates | **No gate holds an optimized player past about two levels' time**; places priced on the same 1 hour to 1 day curve | A steady climb, every gate visible |

**The curve describes a well-optimized player** (owner, 2026-11-07): one who holds the boosts a good player would at that point. A typical player is slower than the curve, about 1.5 to 2x, and a player with no boosts at most 3x.

**These are starting numbers.** The ledger reads them, times the whole game at each player, and its balancing preview proposes nudges. A nudge that goes beyond what these rules allow means the rule changes, on this page.

## 1. XP

**The pace curve is one smooth rule** (owner, 2026-11-07): "I want our progression curve to be consistent across the game." **Each level takes 6.25 % longer than the one before**, starting at 3 minutes: about 5 minutes at 10, 32 at 40, 1.8 hours at 60, 6 at 80, 11 at 90 and 19 at 99. **One skill's climb is about 12.6 days** for a well-optimized player and about 23 for a typical one. **The step's range is 6 % to 6.5 %** (owner, 2026-11-25: "I would want to tighten the level up speed for late game... our desired range is somewhere within 6% and 6.5%. This might vary as we balance the game, as we may have more powerful buffs added."); 6.25 % is the balancer's working value, the middle of the range, until the boosts are balanced. At 6.5 % levels 81 to 98 took 10 days optimized and 20 typical; at 6.25 % they take 8.4 and 16. *The CMS Ledger's pace curve writes it as points, in minutes a level: 1 = 3, 10 = 5, 20 = 9, 30 = 17, 40 = 32, 50 = 59, 60 = 107, 70 = 197, 80 = 361, 90 = 661, 99 = 1141 (these replace the 6.5 % points confirmed earlier on 2026-11-25).*

**XP an hour doubles every 20 levels** (owner, 2026-11-07: "2x a tier"). A task unlocked at level L pays **1,660 × 2^((L − 1) / 20) XP an hour**. That's what level 1's 83 XP in 3 minutes makes, so the start stays as it is today.

**The XP table follows from the two**: the XP a level needs is that level's XP an hour × its minutes ÷ 60. ⚠️ This replaces today's table (the RuneScape formula in `src/utils/XPCurve.js`), which would make every tier's work pay the same XP an hour up to level 45. It's a code change (T-337), and it shifts levels in old saves.

| Level | Minutes a level | XP an hour, new work | XP to the next level | XP to reach it |
|---|---|---|---|---|
| 1 | 3 min | 1,660 | 83 | 0 |
| 5 | 4 min | 1,907 | 122 | 384 |
| 10 | 5 min | 2,268 | 196 | 1,127 |
| 20 | 9 min | 3,207 | 507 | 4,244 |
| 30 | 17 min | 4,535 | 1,316 | 12,328 |
| 40 | 32 min | 6,414 | 3,411 | 33,291 |
| 50 | 59 min | 9,071 | 8,845 | 87,649 |
| 60 | 1.8 h | 12,828 | 22,936 | 228,602 |
| 70 | 3.3 h | 18,141 | 59,474 | 594,093 |
| 80 | 6.0 h | 25,655 | 154,217 | 1,541,815 |
| 90 | 11.0 h | 36,282 | 399,887 | 3,999,274 |
| 98 | 17.9 h | 47,874 | 857,000 | 8,571,820 |

About 9.4 million XP to 99. Today's table needs about 13 million.

**XP per action** = the XP an hour × the action's seconds ÷ 3,600 ÷ **the optimized boost factor** for that tier, rounded, at least 1. The factor is how much faster a well-optimized hero earns than a hero with no boosts (speed and XP boosts together), read from the boost budget (section 5). **Between tier openings the factor climbs level by level** (owner, 2026-11-25), in a straight line from one tier's budget to the next: with a step at each tier, a new tier's first recipes paid a hero up to 17 % less than the old tier's last ones for about three levels. The seconds are **the work cycle alone**: rests don't count, because the rest rule (section 2) keeps a lone hero busy most of the time.

**Which level's XP an hour**: the level halfway between this unlock and the skill's next one, not the unlock itself. In a skill with few unlocks (Mining's metals, Fletching), XP an hour stays flat while the table keeps rising, so without this those skills climb about 40 % slower than the curve (review, on the old curve: Mining 47.7 days against 34.4; with the midpoint, 35.0). Where the next unlock is the next level, it's the same as the unlock level.

**Pick action seconds that give whole XP early on**: at 3 to 12 XP an action, rounding can be 13 % off. The solver does this itself (balancer, 2026-11-25): it rounds the XP, then trims the action's length by up to 15 % so the whole XP pays the rule's XP an hour exactly. A Copper Ingot is 8.9 s for 3 XP.

- **An old task falls behind**: 2x slower a tier later, 4x two tiers on, and about 30x slower at 99. Reaching 99 on a level-1 task alone would take about 237 days of one hero's work.
- **Crafting and gathering pay the same an hour** at the same level (owner). A craft pays more per action only because it takes longer.
- **Construction earns from builds and from repeatable work** (owner, 2026-11-21). A build pays XP by its price: the hours its materials took to gather, at the build's level's XP an hour, so a big build pays big. Builds alone leave Construction about 4x behind the curve to 20 and 8x to 85 (the ledger), so Construction also gets repeatable work between builds, priced like any make step; what that work is, the content agent proposes and the owner picks (T-656).
- **Each link of a chain pays its own XP**, to its own skill. A late item earns the guild several skills' XP, and the guild pays for that in materials.
- **Aimed at a well-optimized hero.** The ledger checks that a typical player lands about 1.5 to 2x slower and a player with no boosts no more than 3x slower, and nudges XP if not.

## 2. Action time

**Seconds = the kind's base × 1.15^(L / 20)**: a little longer each tier, so Faster Work buildings and speed drinks keep their worth late (owner).

| Kind | What | At 1 | 20 | 40 | 60 | 80 |
|---|---|---|---|---|---|---|
| Gather | Veins, trees, crops, fishing, herbs | 6.0 | 6.9 | 7.9 | 9.1 | 10.5 |
| Prepare | Ingots, planks, cloth, leather, cut gems, flour | 8.1 | 9.2 | 10.6 | 12.2 | 14.0 |
| Make | Gear, tools, food, drinks, potions, jewellery, enchanting | 12.1 | 13.8 | 15.9 | 18.3 | 21.0 |

The base times (6, 8 and 12 seconds) are starting values (agent's call). Builds, growth and fights aren't timed here: builds and growth follow the ledger's one-off step rule (no wait longer than the pace allows there), and fights belong to combat.

**A make step takes longer the more bars it uses**: seconds × (1 + 0.5 × (count − 1)). A Chestplate (5 bars) takes 3x a Dagger (1 bar): about 40 s for a Copper Chestplate, 69 s for a Darkmetal one. *Owner, 2026-11-25, raised from 0.2:* at 0.2 a bar spent on Daggers earned 2.8x the XP of a bar spent on Chestplates, so a guild short on ore ground Daggers; at 0.5 it is 1.7x, still the thrifty choice and no longer the only sensible one.

**The rest rule**: a gathering Token's uses × its cycle is at least 3 × its rest, so one hero on one copy is busy at least 75 % of the time. Today's veins hold 5 uses of 3 to 4 seconds, then rest 60 to 90 seconds, so a lone hero waits most of the time and a camp of three copies earns 3 to 4x as much (review, from `rates.js`).

## 3. Ingredient counts

**Only steps made from raw things grow.** Ore, wood, crops, herbs, fish and drops are raw: their count is **base × 2^(L / 40)**, rounded, doubling every two tiers (owner). A step made from made things (bars, cloth, leather, a Sofrito) uses **a fixed count for its kind** at every tier. Late gear costs more because its bars cost more, and never piles into hundreds of ore (owner's first ruling).

| Base | At 1 | 20 | 30 | 40 | 50 | 60 | 80 | 99 |
|---|---|---|---|---|---|---|---|---|
| 1 (most raw ingredients) | 1 | 1 | 2 | 2 | 2 | 3 | 4 | 6 |
| 2 (ore per bar, wood per plank) | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 11 |

**What one gather action gives stays the same at every tier** (owner, after the review): "Increased ingredient gain is expected through building and Star upgrades. In practice we do grow yields, but for the base numbers they should not." So a Bare guild needs more gatherers per crafter as it climbs (about 2 per smelter at copper, 8 at darkmetal), and **yield boosts close the gap**: Double Output buildings, the Logging and Mining Camps' variants, and the Hall's yield stars. Their targets grow by tier so a Typical guild keeps about one or two gatherers per crafter (section 5).

**A recipe with a made base takes 1 of each raw ingredient, at every level** (owner, 2026-11-25): a stew on Sofrito, a potion on a Draught, a pie on Dough. The made base already carries the rising cost; only a recipe made from raw things alone grows.

**Fixed counts by kind** (agent's call, starting values): Dagger 1, Sword 2, Woodaxe and Pickaxe 2, Gloves and Boots 2, Helmet or Hat 3, Shield 3, Mace and Cleaver 3, Cape 3, Chestplate, Chest, Robe and Tunic 5. A handle is 1 wood. Nails, Arrowheads, Chain and Bands take 1 bar (counts below). Weird items in potions are 1. Water and juices in drinks and potions are 1. Water is 1 in every recipe, soups and stews too, and the fixed counts by kind are gear's alone: food, drinks and potions take 1 of each made ingredient (balancer, 2026-11-25).

**What one craft makes** (owner, 2026-11-25). Most crafts make 1. The exceptions:

| Craft | Makes | Why |
|---|---|---|
| Arrows (Fletching) | **40**, from 1 wood, 1 feather and 40 Arrowheads | An archer shooting non-stop uses about 1,200 arrows an hour. At 40, keeping one archer shooting costs about half a hero's work at copper, 1.4 heroes at darkmetal with no boosts, about 0.6 with a typical guild's yield boosts |
| Arrowheads, Kunai | **40 a bar** | One bar's Arrowheads feed one arrow craft; Kunai are thrown and used up like arrows |
| Nails | **5 a bar** | A Fishing Rod, Trap or Frame costs a fifth of a bar in nails |
| Ring Band, Chain, Gears | 1 a bar | Jewellery and machines take one part each |
| Drinks | **5 a craft** | With the dose below, one craft covers 250 work cycles |

**XP goes by the time the craft takes, however many it makes.** These counts are the same at every tier, like a gather's yield.

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

**The boost budget** (owner, 2026-11-07). One table says what a **typical / optimized** player holds at the start of each tier, for each kind of boost. Every building, drink, potion, perk and Hall star is counted against its cell, and the ledger flags a total over it (T-383). Farming's growth time counts as speed.

| Rule | Ruling |
|---|---|
| **Size** | An optimized hero earns 1.4x a hero with no boosts at copper, rising to **3x at darkmetal**, the most the 3x bound allows. Boosts matter more as the game goes on |
| **Typical** | Holds about half of each speed and XP boost: close to optimized early (about 1.2x), **about 2x behind late** |
| **Gatherers** | Yield boosts grow with the tier so **a typical guild needs about 2 gatherers per crafter at every tier**, against 9 at darkmetal with no boosts |
| **Speed ceiling** | At most a 65 % cut at Maxed, inside the game's 80 % cap, so one more Faster Work building always still helps |

| Tier | Speed cut | XP | Yield | Rare finds | Earns, against no boosts | Optimized over typical | Gatherers per crafter: none, typical, optimized |
|---|---|---|---|---|---|---|---|
| Copper (1) | 10 / 20 % | +5 / +10 % | +2 / +27 % | +0 / +100 % | 1.17x / 1.38x | 1.18x | 2.2 / 2.2 / 1.8 |
| Iron (20) | 15 / 30 % | +5 / +10 % | +41 / +77 % | +0 / +100 % | 1.24x / 1.57x | 1.27x | 3.1 / 2.2 / 1.8 |
| Silver (30) | 18 / 35 % | +8 / +15 % | +68 / +110 % | +0 / +100 % | 1.30x / 1.77x | 1.36x | 3.7 / 2.2 / 1.8 |
| Mythril (40) | 20 / 40 % | +8 / +15 % | +100 / +150 % | +50 / +150 % | 1.34x / 1.92x | 1.43x | 4.4 / 2.2 / 1.8 |
| Gold (50) | 22 / 45 % | +10 / +20 % | +138 / +197 % | +50 / +150 % | 1.42x / 2.18x | 1.54x | 5.2 / 2.2 / 1.8 |
| Adamantine (60) | 25 / 50 % | +10 / +20 % | +183 / +254 % | +50 / +250 % | 1.47x / 2.40x | 1.64x | 6.2 / 2.2 / 1.8 |
| Darkmetal (80) | 30 / 60 % | +10 / +20 % | +300 / +400 % | +50 / +250 % | 1.57x / 3.00x | 1.91x | 8.8 / 2.2 / 1.8 |

*Cells are typical / optimized, at each tier's opening level; between openings the speed and XP columns climb level by level (owner, 2026-11-25). "Earns" is speed and XP together. Made by `balance_rules.py`; the speed and XP columns, the typical share and the yield gap are its settings.*

**Who carries it, at darkmetal for an optimized hero** (earlier tiers in the same shares). **Buildings carry the most speed** (owner); the yield and XP shares are the agent's calls:

| Kind | Shared out |
|---|---|
| Speed | Faster Work building −30 %, skill perks −15 %, drink −10 %, Hall stars −5 % (perks took 10 % of the stars' share, owner 2026-11-21, [concept_milestone_perks.md](../active/concept_milestone_perks.md)) |
| Yield | Double Output building (a sure double at most) +100 %, Hall stars +200 %, camp variants and perks +100 % |
| XP | More XP building +10 %, Hall stars +5 %, drink +5 % |
| Rare finds | A rare-find potion +100 %, rising to +200 % for late potions (owner); a Rare Finds building +50 % (owner), from mythril, when the first Rare Finds variants come |

⚠️ **Today's Hall is over budget on XP**: its Lore stars give +15 % XP (Builder's Lore +30 %) in the first tiers, where the whole XP budget is +10 %. The paper pass brings them in. A Double Output building can give at most +100 % (a sure double), so most late yield is the Hall's.

**Consumables last a number of cycles, and crafts make batches** (owner, after the review: "A dose is meant to last a number of cycles, not time. But also we will make batches."). **A batch must pay back at least 4x**: the work time the whole batch saves (or the finds it adds) is at least four times the hero time it took to make, its ingredients included. **A drink lasts 50 work cycles and a craft makes 5** (owner, 2026-11-25): one craft has to cover about 100 to 250 cycles to pay back 4x (a drink carries a sixth of the speed budget and a quarter of the XP budget), and 250 covers every planned drink but the level-95 Sunset Punch, which falls a little short. A drink then lasts roughly 8 to 15 minutes of work and a hero gets through 4 to 7 an hour. ⚠️ Today a drink lasts 10 cycles and a work potion 1 (`consumableRule.js`): the drink's 50 lands with the first number pack (T-338 part 1); the work potion's dose is set with the Alchemy run.

**Upgrade prices go by payback** (owner): the hours of the boosted work it takes to earn back the price. **For a Hall star that boosts the whole guild, payback counts all the work it boosts**, not one hero's. **Payback = 1 hour × 24^(L / 80)**: 1 hour at 1, 2.2 at 20, 4.9 at 40, 10.8 at 60, a day at 80. That covers Guild Hall stars and building variants, priced in the tier's materials.

## 6. Gates

**Every unlock sits behind one or more gates, and no gate holds a well-optimized player longer than about two levels' worth of time** (owner, 2026-11-07: no pause at a new tier, stay on the curve). That is the ledger's wall rule, a step over twice the curve's time. The ring star, a place's price and its arrival fight are paid along the way.

| Gate | Rule |
|---|---|
| **A level** | One unlock per level as far as real items allow (the content philosophy); an ingredient's gathering level matches the first recipe that uses it |
| **A place** (a world map cell) | **Its price is the hours of the whole guild's optimized work at its tier, on the payback curve**: about 1 hour at copper, 2 at iron, 5 at mythril, 11 at adamantine, a day at darkmetal (owner). Paid in its tier's goods; nearer places stay cheaper, as the world map rules say. **It asks for its tier's opening level** in one or two of the skills its goods need: an iron place asks Mining 20 or Forestry 20 (owner) |
| **A ring star** (the Hall star that opens a ring) | Priced so the ring opens as the stage before it ends, as built (brief 380 M4) |
| **A tool** | **The gating tool's recipe lands within 2 levels of what it gates**, counting the skills as climbing together (agent's call). The Harpoons now land with their fish: Smithing 63 and Swordfish at Fishing 63; Smithing 83 and Shark at Fishing 83 (2026-11-07) |
| **A building** | A station or camp needed for work is priced by the one-off step rule: no wait past the pace there |
| **A rare item** | Set by finds a day (section 4): one hero alone passes it slowly; several heroes or boosts in good time |
| **A chain** | No skill waits on another past the wall rule: the ledger's path time, at each player |

**A gate is balanced when the optimized player's path through it stays on the curve**, and the typical and no-boost players stay inside their bounds (section 5).

## Worked examples

**Ingots, copper to darkmetal** (Smithing; prepare):

| Metal | L | Ore | Coal | Seconds | XP | A Chestplate (5 bars) |
|---|---|---|---|---|---|---|
| Copper | 1 | 2 | 1 | 8.9 | 3 | 10 ore, 5 coal |
| Iron | 20 | 3 | 1 | 8.8 | 5 | 15 ore, 5 coal |
| Silver | 30 | 3 | 2 | 9.8 | 7 | 15 ore, 10 coal |
| Mythril | 40 | 4 | 2 | 10.8 | 10 | 20 ore, 10 coal |
| Gold | 50 | 5 | 2 | 11.3 | 13 | 25 ore, 10 coal |
| Adamantine | 60 | 6 | 3 | 12.1 | 18 | 30 ore, 15 coal |
| Darkmetal | 80 | 8 | 4 | 13.9 | 33 | 40 ore, 20 coal |

The veins themselves (gather): copper 6.0 s and 2 XP, iron 7.4 s and 5 XP, mythril 7.9 s and 8 XP, adamantine 9.1 s and 16 XP, darkmetal 10.4 s and 27 XP. A Copper Chestplate (Smithing 16) takes 40.4 s and pays 22 XP; a Darkmetal Chestplate (93) takes 68.9 s and pays 280 XP.

*These tables are the solver's (`balance_solver.cjs`, 2026-11-25): XP is what a hero with no boosts is paid, so it is the rule's XP an hour divided by the optimized boost factor, and the seconds are trimmed to pay whole XP exactly.*

**Bread, a short chain** (four links, each paying its own skill):

| Link | L | Kind | Seconds | XP |
|---|---|---|---|---|
| Wheat (Farming) | 4 | gather | 5.5 | 2 |
| Flour | 4 | prepare | 8.2 | 3 |
| Dough (Cooking) | 4 | prepare | 8.2 | 3 |
| Bread (Cooking) | 7 | make | 12.6 | 5 |

**Master's Draught, a late potion** (Alchemy 90): 1 Starflower, 1 Moonpetal, 1 Voidcap as the weird item, 1 Elder Draught as the base; a recipe with a made base takes 1 of everything (owner, 2026-11-25). It takes 22.5 s and pays 90 XP. Its herbs pay Farming 28 XP (Starflower, L 80) and 15 XP (Moonpetal, L 60) each, and the Elder Draught pays Cooking.

## Not covered yet

The review listed numbers no rule sets yet; each needs a rule when its chain is balanced:

- **Recipes with chance outputs**: how their XP is split (a craft that makes several of one thing pays by its time, section 3).
- **A work potion's dose and batch**, with the Alchemy run.
- **Food's healing** against the time it takes to make, with combat.
- **Station charges, Construction prices and tool prices**, against what they save.
- **Combat XP**, with combat.

## What this page needs elsewhere

- **The ladder's pace curve and stage budgets in the ledger's settings** (T-294).
- **The new XP table in the game** (T-337).
- **Longer doses, a ledger that counts gatherers per crafter, and the speed budget** (T-338).
- **A script that writes these numbers onto the Planned entries**, once they're in the CMS (T-305): a brief for the director.
- **Combat's power curve**: its own segment.
