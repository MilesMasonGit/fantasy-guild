Status: approved 2026-11-07, amended the same day after a critical review and the owner's smooth curve

# Balance rules

*The formulas that give every item, recipe, Token and upgrade its starting numbers, from the owner's rulings in [concept_balancing.md](../active/concept_balancing.md) (2026-11-07). A script turns them into CMS change packs; the progression ledger then times the result and nudges what's off the curve. Every number here comes from `.claude/skills/balancer/balance_rules.py`: change a constant there, re-run, and copy the tables. Combat (damage, defence, healing, enemy strength) is its own segment, later.*

## How to read this page

**Everything follows the level a thing unlocks at** (written L). Tiers start at copper 1, iron 20, silver 30, mythril 40, gold 50, adamantine 60 and darkmetal 80, so "one tier later" means about 20 levels on.

**Seven rules, one per kind of number, and the reference guild they are measured on (section 8):**

| Number | Rule | In one line |
|---|---|---|
| XP | The new XP table and **XP an hour doubling every 20 levels** | An old task is 2x slower a tier later, 4x two tiers on |
| Action time | **A little longer every 20 levels** (x1.15) | So work-speed buildings keep paying |
| Ingredient counts | **Double every 40 levels**, raw ingredients only | 2 ore a copper bar, 8 a darkmetal bar |
| Drops and finds | **Set as finds a day** for one hero | Basic drops every kill; bonus finds 20 a day; rare gear drops 1 a day |
| Upgrade prices | **Payback from 1 hour to 1 day**, by tier | Always worth buying, late ones are goals |
| Gates | **No gate holds an optimized player past about two levels' time**; places priced on the same 1 hour to 1 day curve | A steady climb, every gate visible |
| Coins | **Worth is the time in an item; an everyday coin cost is one level's time of selling, a big one half its item price's work** | A second gate: does the guild make more than it uses |

**The curve describes a well-optimized player** (owner, 2026-11-07): one who holds the boosts a good player would at that point. A typical player is slower than the curve, about 1.1x early to 1.4x late, and a player with no boosts at most 3x.

**These are starting numbers.** The ledger reads them, times the whole game at each player, and its balancing preview proposes nudges. A nudge that goes beyond what these rules allow means the rule changes, on this page.

## 1. XP

**The pace curve is one smooth rule** (owner, 2026-11-07): "I want our progression curve to be consistent across the game." **Each level takes 6.25 % longer than the one before**, starting at 3 minutes: about 5 minutes at 10, 32 at 40, 1.8 hours at 60, 6 at 80, 11 at 90 and 19 at 99. **One skill's climb is about 12.6 days** for a well-optimized player and about 17.6 for a typical one (three quarters of each boost). **The step's range is 6 % to 6.5 %** (owner, 2026-11-25: "I would want to tighten the level up speed for late game... our desired range is somewhere within 6% and 6.5%. This might vary as we balance the game, as we may have more powerful buffs added."); 6.25 %, the middle of the range, is the working value until the boosts are balanced (owner, 2026-11-25). At 6.5 % levels 81 to 98 took 10 days optimized and 20 typical; at 6.25 % they take 8.4 and 16. *The CMS Ledger holds the same rule (3 minutes, 6.25 % a level, range 6 to 6.5 %) and works its stage budgets out from it (built 2026-11-26). For reference, in minutes a level: 1 = 3, 10 = 5, 20 = 9, 30 = 17, 40 = 32, 50 = 59, 60 = 107, 70 = 197, 80 = 361, 90 = 661, 99 = 1141.*

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

**XP follows the boosts that exist** (owner, 2026-11-27). The rule above divides by the budget's boost factor, which assumes a well-set-up hero holds the whole budget. Where the game's content holds fewer boosts than that, the rule's XP makes the game slow (the first trial of both packs: 19 to 40 days a skill against 12.6). So numbers reach the game in three steps, in this order: **the number pack** (levels, times, counts and the rule's XP), **the boosts pack** (every boost at its rule size), then **the ledger's XP corrections** on top (`changePackTool balance --levers=xp`), which fit the curve to the boosts a maxed hero really has. As content adds boosts the balancer re-runs the third step and XP comes down toward the rule's figure. Trialled 2026-11-27: with all three, every skill but Fishing runs within about 0.6 to 1.1 of the curve across the levels its content covers, and walls fall from 22 to 1.

**A correction never lets old work out-pay new work** (owner, 2026-11-27, round 2). The XP corrections may raise a work's XP only while it stays under the XP an hour of whatever was the best work at every later level. Without that ceiling a starter recipe raised to put its own first levels on the curve becomes the best XP for 40 levels, because the next station runs it about 1.7 times faster (Copper Ingot, Charcoal, Birdwatcher). Levels the ceiling leaves slow are **a gap for content** (a recipe of their own, or an early boost), listed in `docs/active/balance_gaps.md`, never an XP raise by hand. The tool applies the ceiling and prints those levels. The first pack landed with five starter recipes held this way; the early levels of Smithing, Crafting and Alchemy run about twice the curve until content fills them.

**Which level's XP an hour**: the level halfway between this unlock and the skill's next one, not the unlock itself. In a skill with few unlocks (Mining's metals, Fletching), XP an hour stays flat while the table keeps rising, so without this those skills climb about 40 % slower than the curve (review, on the old curve: Mining 47.7 days against 34.4; with the midpoint, 35.0). Where the next unlock is the next level, it's the same as the unlock level.

**Pick action seconds that give whole XP early on**: at 3 to 12 XP an action, rounding can be 13 % off. The solver does this itself (balancer, 2026-11-25): it rounds the XP, then trims the action's length by up to 15 % so the whole XP pays the rule's XP an hour exactly. A Copper Ingot is 8.9 s for 3 XP.

- **An old task falls behind**: 2x slower a tier later, 4x two tiers on, and about 30x slower at 99. Reaching 99 on a level-1 task alone would take about 237 days of one hero's work.
- **One total reward an hour, tilted by purpose** (owner, 2026-11-25, replacing "crafting and gathering pay the same XP an hour"): every hour of work at a level is worth the same in total, XP and goods together; a Token or recipe leans toward XP or toward goods, so work that hands over valuable goods teaches less. **The tilt is moderate** (owner): training work pays 1.5x the XP and half the goods, balanced work both in full, earning work half the XP and 1.5x the goods. The plan's entries carry no leaning yet, so the solver treats all of them as balanced until the content session tags them.
- **Construction earns from builds and from repeatable work** (owner, 2026-11-21). A build pays XP by its price: the hours its materials took to gather, at the build's level's XP an hour, so a big build pays big. Builds alone leave Construction about 4x behind the curve to 20 and 8x to 85 (the ledger), so Construction also gets repeatable work between builds, priced like any make step; what that work is, the content agent proposes and the owner picks (T-656).
- **Each link of a chain pays its own XP**, to its own skill. A late item earns the guild several skills' XP, and the guild pays for that in materials.
- **Aimed at a well-optimized hero.** The ledger checks that a typical player lands about 1.1 to 1.4x slower and a player with no boosts no more than 3x slower, and nudges XP if not.

## 2. Action time

**Seconds = the kind's base × 1.15^(L / 20)**: a little longer each tier, so Faster Work buildings and speed drinks keep their worth late (owner).

| Kind | What | At 1 | 20 | 40 | 60 | 80 |
|---|---|---|---|---|---|---|
| Gather | Veins, trees, crops, fishing, herbs | 6.0 | 6.9 | 7.9 | 9.1 | 10.5 |
| Prepare | Ingots, planks, cloth, leather, cut gems, flour | 8.1 | 9.2 | 10.6 | 12.2 | 14.0 |
| Make | Gear, tools, food, drinks, potions, jewellery, enchanting | 12.1 | 13.8 | 15.9 | 18.3 | 21.0 |

The base times (6, 8 and 12 seconds) are starting values (agent's call). Builds, growth and fights aren't timed here: builds and growth follow the ledger's one-off step rule (no wait longer than the pace allows there), and fights belong to combat.

**A make step takes longer the more bars it uses**: seconds × (1 + 0.5 × (count − 1)). A Chestplate (5 bars) takes 3x a Dagger (1 bar): about 40 s for a Copper Chestplate, 69 s for a Darkmetal one. *Owner, 2026-11-25, raised from 0.2:* at 0.2 a bar spent on Daggers earned 2.8x the XP of a bar spent on Chestplates, so a guild short on ore ground Daggers; at 0.5 it is 1.7x, still the thrifty choice and no longer the only sensible one.

**The rest rule** (owner, 2026-11-26, replacing the 30 seconds and two nodes ruled the day before: "We can make the node refresh take longer. I want the player to ideally need 4 or 5 nodes to keep them busy all the time."): **a node gives about 15 seconds of work and is back in about a minute.** A hero alone at one node works about a fifth of the time; **a camp with 4 or 5 nodes keeps a hero fully busy**, about 4.5 times faster, and nodes past that are room for more heroes. Regrowth boosts keep their job: each one lets a camp stay busy on fewer nodes, which frees a place for a building. ⚠️ Today's nodes are far from it (an Oak Tree is 15 seconds of work and a 5-minute stump); the number pack brings them to the rule. The reference set-ups: bare is one node, typical and optimized a camp with 4 or 5.

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
| **Typical** | Holds about **three quarters** of each speed and XP boost (owner, 2026-11-26, was half): a typical player fills most of a site's places and chooses less well. About 1.1x behind optimized early, **about 1.4x behind late** |
| **Gatherers** | Yield boosts grow with the tier so **a typical guild needs about 2 gatherers per crafter at every tier**, against 9 at darkmetal with no boosts |
| **Speed ceiling** | At most a 65 % cut at Maxed, inside the game's 80 % cap, so one more Faster Work building always still helps |

| Tier | Speed cut | XP | Yield | Rare finds | Earns, against no boosts | Optimized over typical | Gatherers per crafter: none, typical, optimized |
|---|---|---|---|---|---|---|---|
| Copper (1) | 15 / 20 % | +8 / +10 % | +2 / +27 % | +0 / +100 % | 1.26x / 1.38x | 1.09x | 2.2 / 2.2 / 1.8 |
| Iron (20) | 22 / 30 % | +8 / +10 % | +41 / +77 % | +0 / +100 % | 1.39x / 1.57x | 1.13x | 3.1 / 2.2 / 1.8 |
| Silver (30) | 26 / 35 % | +11 / +15 % | +68 / +110 % | +0 / +100 % | 1.51x / 1.77x | 1.17x | 3.7 / 2.2 / 1.8 |
| Mythril (40) | 30 / 40 % | +11 / +15 % | +100 / +150 % | +50 / +150 % | 1.59x / 1.92x | 1.21x | 4.4 / 2.2 / 1.8 |
| Gold (50) | 34 / 45 % | +15 / +20 % | +138 / +197 % | +50 / +150 % | 1.74x / 2.18x | 1.26x | 5.2 / 2.2 / 1.8 |
| Adamantine (60) | 38 / 50 % | +15 / +20 % | +183 / +254 % | +50 / +250 % | 1.84x / 2.40x | 1.30x | 6.2 / 2.2 / 1.8 |
| Darkmetal (80) | 45 / 60 % | +15 / +20 % | +300 / +400 % | +50 / +250 % | 2.09x / 3.00x | 1.43x | 8.8 / 2.2 / 1.8 |

*Cells are typical / optimized, at each tier's opening level; between openings the speed and XP columns climb level by level (owner, 2026-11-25). "Earns" is speed and XP together. Made by `balance_rules.py`; the speed and XP columns, the typical share and the yield gap are its settings.*

**Who carries it, at darkmetal for an optimized hero** (earlier tiers in the same shares). **Buildings carry the most speed** (owner); the yield and XP shares are the agent's calls:

| Kind | Shared out |
|---|---|
| Speed | Faster Work buildings and station steps −20 % (four at 5 %), skill perks −15 %, Guild Hall stars −10 %, the one consumable as a speed drink −15 % (owner, 2026-11-26) |
| Yield | Double Output buildings +200 % (four at +50 %; owner, 2026-11-26: "Bigger yield buildings"), Guild Hall stars +10 %, camp variants and perks the rest (about +190 % by the table: ⚠️ not yet matched by content, so late chains need more than 2 gatherers until it is) |
| XP | More XP buildings +10 % (four at 2.5 %), Guild Hall stars +10 %. An XP drink or potion takes the speed drink's place |
| Rare finds | A rare-find potion +100 %, rising to +200 % for late potions (owner); a Rare Finds building +50 % (owner), from mythril, when the first Rare Finds variants come |

⚠️ **Today's Hall is over budget on XP**: its Lore stars give +15 % XP (Builder's Lore +30 %) in the first tiers, where the whole XP budget is +10 %. The paper pass brings them in. A Double Output building can give at most +100 % (a sure double), so most late yield is the Hall's.

**Only what can be held at once counts** (owner, 2026-11-26: "all budgets can't be active at the same time. A hero can only have one potion active"). **A hero has one drink active, and drinks, potions and elixirs are all drinks** (owner, 2026-11-26: "One drink, one other type of boost item (such as scrolls). Drinks, potions, elixirs, these are all the same. Consumables like poisons, bait, arrows, motes all don't provide buffs so they're different."). A second boost item of another type, such as a scroll, may be held beside it; none is designed yet, and it will need its own share when one is. Poisons, bait, arrows and Motes are not boosts and are not limited. ⚠️ The game today allows one drink and any number of work potions and elixirs together (T-738); a site leans one or two ways; perks and Guild Hall stars are always on. The table's totals are a speed-leaning hero's: the one consumable is a speed drink, and a hero who takes an XP, yield or rare-finds potion gives the speed drink up. **Guild Hall stars are small steps**: all the ranks of one star add up to about 10 % of its kind (owner: "Hall stars are meant for small incremental gains, and the buildings and potions are meant for larger buffs").

**What may carry a work boost** (owner, 2026-11-26):

| Source | Ruling |
|---|---|
| **Gear** | "Gear is primarily for boosting Combat, not work." Worn gear carries no share of the work budget; a ring's work effect, where it has one, is an effect of its own, not raw speed, XP or yield |
| **Tools** | A tool gates work (a better pickaxe reaches better veins) and need do no more: tools carry no speed in the budget |
| **Skill perks** | **Speed and yield perks are fine; XP perks are not**, "since the player doesn't have a choice in getting the perk or not". A yield perk is worth the same slice as a speed perk: 5 % off work time or +25 % yield (balancer's call) |
| **Consumables by tier** | A speed drink is a quarter of the tier's speed total (5 % at copper to 15 % at darkmetal); an XP one the tier's XP total; a yield one +10 % at copper, 15, 20, 25, 30, 40 and +50 % at darkmetal (balancer's call); a rare-finds potion +100 %, +200 % from adamantine |
| **Camp variants and station steps** | Each is one building's worth of its kind, standing in the camp's or the station's own place |
| **Outside the budget** | World events (temporary luck), bonus drops (section 4), masteries |

**Consumables last a number of cycles, and crafts make batches** (owner, after the review: "A dose is meant to last a number of cycles, not time. But also we will make batches."). **A batch must pay back at least 4x**: the work time the whole batch saves (or the finds it adds) is at least four times the hero time it took to make, its ingredients included. **A drink or a work potion lasts 25 work cycles, a craft makes 5, and it is twice as strong** (owner, 2026-11-26: "I prefer shorter and stronger, but for both drinks and potions"; it replaces the 50 cycles ruled on 2026-11-25). One craft covers 125 cycles at double strength, the same payback as 250 at single: at least 4x for every planned drink but the level-95 Sunset Punch, a little short. A drink then lasts roughly 4 to 8 minutes of work and a hero gets through 8 to 14 an hour. ⚠️ Today a drink lasts 10 cycles and a work potion 1 (`consumableRule.js`): the 25 lands with the first number pack (T-338 part 1).

**Boosts are placed, and a site must choose** (owner, 2026-11-26). Several buildings may boost one node; that is the game's spatial puzzle.

| Rule | Ruling |
|---|---|
| **Places** | **Reach 240 u, Tokens at least 128 u apart (edges touching): 12 places round a node** (owner, 2026-11-26, [concept_token_spacing.md](../active/concept_token_spacing.md), brief 890). A maker's station has about 8 places for buildings. **A gathering site spends 6 or 7 on its camp, its spawner and its 4 or 5 nodes, leaving 5 or 6 for buildings**, so gatherers choose harder than makers |
| **Choosing** | **A perfect site cannot max every kind**: about 4 places max one kind (speed, yield, XP or rare finds), so a site leans one or two ways. One building's number is the kind's building share ÷ 4 |
| **Typical** | **A typical player fills most of the places** (6 or more). Players differ by which boosts they pick, not by how many they fit |
| **Station upgrades** | **A station's own upgrade is a boost** and shares the tier's budget with the buildings round it. Today's upgraded stations run up to 60 % faster by themselves; they come down to the budget |

**The same building all game, and more of them** (owner, 2026-11-26). A building's number does not grow by tier; what grows is how many of a kind an optimized guild holds at a site, because price and payback let it afford one early and four late.

| Kind | One building | Copper | Iron | Silver | Mythril | Gold | Adamantine | Darkmetal |
|---|---|---|---|---|---|---|---|---|
| Faster Work, or a station's own upgrade step | 5 % off work time | 1 | 2 | 2 | 3 | 3 | 3 | 4 |
| More XP | +2.5 % XP | 2 | 2 | 3 | 3 | 4 | 4 | 4 |
| Double Output | +50 % yield | 0 | 1 | 1 | 2 | 2 | 3 | 4 |
| Rare Finds | +12.5 % rare finds (balancer's call: the +50 % ruled for one building, over four places) | 0 | 0 | 0 | 2 | 2 | 4 | 4 |

*How many an optimized site holds, from the tier's budget for buildings ÷ one building. A site has about 8 places, so it cannot hold four of every kind: at darkmetal, two kinds in full or a mix. A station's own upgrade takes Faster Work's share when it has one.*

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

## 7. Coins

*Owner interview with the balancer, 2026-11-25, on top of [concept_gold_coins.md](../active/concept_gold_coins.md): coins are a second cost beside items, the measure of whether a guild makes more than it uses.*

**An item's worth is the work in it** (owner): every step counts, so a Copper Dagger is worth its ore, its smelting and its forging together. A worth set by hand is an exception with its reason. ⚠️ *Corrected 2026-11-25:* the balancer first wrote that an hour of work earns the same coins whatever is sold. It does not: the CMS's simulator prices work at its level's gold an hour, a curve rising 260 times from level 1 to 99, plus at least 15 % a making step, so later goods sell for far more an hour. **Ruled 2026-11-26: worth follows the XP rule**: an hour of work is worth twice as much every 20 levels (29 times from level 1 to 99, not 260), so work a tier old earns half the coins and half the XP of current work. The simulator's gold curve is set from it (T-715).

**Several outputs share one worth, and a rare one is worth more in proportion** (owner, 2026-11-27). When one piece of work gives several items, what a cycle gives on average adds up to the cycle's worth. An output's abundance is its chance times its average count. **Every output carries an equal share of the cycle's worth, and one piece is worth its share divided by its abundance**: a drop ten times rarer is worth ten times as much a piece. An output that already has its worth from another source keeps it, and only the rest is shared out. Worths are whole coins, so the total lands near the target, not on it; where a common output is kept at the floor of 1 coin, the excess comes out of the other outputs' shares (the total is within about 0.2 % of the target). Built 2026-11-27 (`splitByScarcity` in `cms/src/engine/sim/pricingPass.js`); before it the simulator counted scarcity twice, which made a Bird Nest worth 85 and about 60 % of a woodcutter's coins. It is now 23, and a worker's selling an hour at Typical runs 3,857 in the Starter Camp, 4,194 in Plane 1, 9,549 in Plane 2 and 16,116 to 53,752 in Plane 3.

**An item that is used passes its worth to what it gives** (balancer's call, 2026-11-27, applying the owner's rule above; the Use branch in the same file). Using an item from the drawer takes no hero and no time, so it adds no work: the drops together are worth the item used, shared out by scarcity as above, with no labour and no craft margin on top. A Use counts as an item's source from the level the used item is first had, and where a Token or a recipe gives the same item at the same level, that one sets the worth. Example: a Bird Nest worth 85 gives seeds worth about 86 on average, the rare seeds worth far more than the common.

**A coin cost is one hero's selling for a set time at the price's stage**, by kind of purchase:

| Purchase | The coin part asks | At copper | Mythril | Darkmetal |
|---|---|---|---|---|
| **Everyday** (a Shop Token, a Foundation) | **One level's time** at that stage, on the pace curve | 5 min | 32 min | 6 h |
| **Big** (settling a place, a Guild Hall star) | **Half the item price's work**, on the payback curve (section 5) | 30 min | 2.5 h | 12 h |

- The everyday points for the ledger's coin curve, in minutes: copper 5, iron 9, silver 17, mythril 32, gold 59, adamantine 107, darkmetal 361 (each tier's opening level's time at the 6.25 % pace; copper takes level 10's, since few purchases come in the first minutes). They move with the pace step.
- The big points are half of 1 hour × 24^(L / 80): 30 min, 66 min, 99 min, 2.5 h, 3.6 h, 5.4 h, 12 h.
- **A Hall star's coins follow its item price at each rank**, with no extra multiplier for rank (balancer's call). Distance is the stage: a far place sits at a later stage, so it costs more.
- One level's time is half the gate rule's limit of two levels (section 6), so coins and items together stay inside it.

**Enemy coins: a fighter earns about half a worker's coins** (owner): fighting already pays in drops and combat XP. A Hideout's stolen coins are priced the same way (balancer's call). Every live enemy pays coins a kill, and every camp that is robbed of coins pays coins a theft, each sized as half a worker's selling an hour there over the kills or thefts an hour (the coin reset pack, 2026-11-27); they move again when combat numbers are balanced.

**The Starter Camp's prices sit between two answers** (balancer's call, 2026-11-27). What a hero sells an hour there depends on which Guild Hall ranks the reference guild can afford, so the coin curve gives two numbers by turns (a Shop Token 210 or 300, a Hall rank 1,200 or 1,800, ring 1 1,900 or 2,700). The pack takes a number inside the tolerance of both: 250, 1,500 and 2,100.

**The coin building adds at most 10 %** to enemy and Hideout coins in its reach (owner: "Probably only a 10% increase at most. Remember, the player may have multiple buildings affecting the same token."). Several buildings can reach one Token and their boosts add up, so a building's own number stays small.

**A well-run guild is comfortable** (owner, 2026-11-26): a guild that keeps its chains fed usually has the coins when it has the goods; coins hold it up only on big buys or when it is run wastefully.

**No coin stars, no coin costs on recipes** (the concept's rulings).

## 8. The reference guild

*What "a normal guild" means in every sum (owner, 2026-11-25; [balance_method_review.md](../active/balance_method_review.md)). Both tools read from this; neither does fully yet (T-716).*

| | Ruling |
|---|---|
| **Heroes** | 8, the game's limit. Skills are each hero's own: 8 heroes with 20 skills each |
| **What they do** | **A few chains at a time**: two or three supply chains staffed at once, the guild moving between chains over days. A skill climbs only while its chain is staffed |
| **A chain** | One maker and **about 2 gatherers, at every tier**; yield boosts grow with the tier to hold it there (section 5) |
| **A gatherer** | Bare: one node, busy about a fifth of the time. Typical and optimized: a camp with 4 or 5 nodes in reach, fully busy (section 2) |
| **A typical player** | **Buys what pays back soon**: of the boosts that exist, those that earn back their price within about 2 hours of play, a day for Hall stars (the ledger's Typical). The Dials page's "half of every boost" is a planning estimate only, used until the content is in the CMS |
| **Heroes by tier** | **About one a tier** (owner, 2026-11-26): one at copper, two at iron, on to eight at darkmetal. An early chain is one or two heroes doing everything in turn, and early arrivals are counted that way |
| **Who levels a skill** | **Two or three heroes share each job** (owner, 2026-11-26), so the guild climbs each skill two or three times |
| **Uptime** | A typical hero works nearly all of every day (owner, 2026-11-26) |
| **The curve's hero** | **Half and half** (owner, 2026-11-26): time split between training work and supplying the guild, which with the moderate tilt averages to the plain rate. Only training: up to 1.5x faster than the curve. Only supplying: 2x slower |
| **Boosts and layout** | **Several buildings may boost one node, and that is the game** (owner, 2026-11-26): boosts act on the node, and a building takes a place a node could have had. The boost budget (section 5) counts one of each and is to be restated as places in reach × a small number each, once spacing and reach are settled (T-718; the owner's target is at most 12 Tokens in a radius) |
| **A late recruit** | **XP for Everyone brings a new hero to about half the guild's level** in every skill (owner, 2026-11-26): a catch-up, not a second way to level |
| **Summoned workers** | Outside the roster: capped by charges, priced like a consumable (owner, 2026-11-26) |
| **The first sitting** | **The Starter Camp ends at level 10**, 35 minutes in on the curve; **a skilled, efficient player using the early boosts leaves it in about 20 minutes** (owner, 2026-11-26). Only-training work at 1.5x gives 23 minutes, so the early boosts need add little more |
| **Leaving a stage** | **Leaving means settling the next place** (owner, 2026-11-26): one hero reaches the place's level in the one or two skills it asks and pays its price; that is what a stage's budget times. Everything else a stage offers (the Starter Camp asks nine skills, about 15 hours of one hero's work today) is done over the following hours, alongside the new place |
| **What the places ask** | **A player reaches the first ring of places at about level 10, and the coins get them there, not the level asked** (owner, 2026-11-27, replacing the ruling of level 10 and 20): ring 1 asks level 5 and 2,100 coins, and earning the coins takes one hero to about 41 minutes in, when they are level 10 or 11 (the budget is 35 minutes, so it sits 19 % over, inside the tolerance). Asking level 10 as well would put the way out at about 65 minutes. **The three rings arrive at about level 10, 30 and 50** (owner, 2026-11-27: about 40 minutes, 4 hours and 15 hours in for one hero), each gated the same way: a level a few below the target and a coin price on the big-purchase curve, so a guild that sells well arrives a little sooner. The iron-age places move into ring 1 so they still open at level 20; ring 2 holds what opens from level 30 to 49 (silver, mythril) and ring 3 what opens from 50 (gold onward), by the owner's level bands (the content agent re-places them, `balance_gaps.md`). Until that lands, rings 2 and 3 keep their levels (15, 30) and coins (590, 8,700); the balancer then sets their levels, coins and the stage time targets in one pack. |
| **A lone hero makes slowly** | **Accepted** (owner, 2026-11-27): in the Starter Camp the one hero gathers for the maker too, so the first 15 levels of a making skill (Smithing, Crafting, Alchemy) take about twice the curve; a second hero and the next station close it in Plane 1. It is not a gap and not an XP correction. |
| **The pace that governs** | **One skill, for one hero** (section 1). Every skill at 99 on all 8 heroes is then a goal of one to one and a half years for a typical player, and that is accepted (owner: "Keep 6 to 6.5%") |

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
