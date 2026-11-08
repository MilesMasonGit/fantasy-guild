Status: approved 2026-11-07 (the rules: [BALANCE_RULES.md](../reference/BALANCE_RULES.md))

# Balancing the game's numbers

*Opened 2026-11-07 (owner), with the `/content` agent. How ingredient counts, drop rates, work times, XP and upgrade prices get set across the whole roadmap, so early gains are quick and exciting and later ones slow and rewarding. Builds on the progression ledger ([concept_progression_ledger.md](concept_progression_ledger.md)); the content itself is in [the content roadmap](concept_content_roadmap.md).*

## Where things stand (checked in the code, 2026-11-07)

- **The old Recalculate** in the CMS is the economy simulator from before. It works from item values (the GP idea) and XP-per-hour pins.
- **The progression ledger** (brief 290, built) is the newer tool, and it measures time:
  - **The rate calculator** gives items and XP an hour for every Token and recipe. It agrees with the real game within 1 % (`npm run bench:calibrate`).
  - **Three players**: Bare, Typical and Maxed.
  - **The pace curve**: minutes a level should take. Today it's 3 min at 1, 8 at 10, 30 at 20, 3 h at 40, 1 day at 60 and 3 days at 99. **The ladder's ruling** (12 h at 60, 1 day at 99) **isn't in it yet** (T-294).
  - **Stage budgets and boost-strength targets.**
  - **A balancing preview** that proposes XP per action, level gates, one-off costs and build times, and boost strengths. Balancing packs 1 to 3 came from it.
- **What nothing sets yet**:
  - ingredient quantities
  - drop and rare-find rates
  - gathering cycle times
  - Guild Hall prices (their own pass is waiting)
  - combat numbers
- **The roadmap's 400 or so planned recipes have no numbers at all**, so the ledger can't time them.

## The owner's rulings (2026-11-07)

- **Formulas first, then the ledger.** Rules per tier give every entry its starting numbers, and the ledger times them and nudges what's off the curve. **The formulas carry design philosophy, not just maths**: "later ingot recipes need to consume more ore and coal than earlier ones, but also we shouldn't have an ingot require hundreds of ore to produce one ingot."
- **XP and cycle time are balanced together.** "Later recipes providing more, as well as factoring in the work cycle time for the task. It should be essentially impossible to reach max level just using early level tasks, because the XP gain would be too low. High level tasks provide more, but also require more complex ingredient chains. This is why our balancing needs to be precise."
- **Combat gets the same kind of balancing, as a separate segment**: "combat is a more self-contained system". Gear, food and enemy strength follow a power curve, planned on its own after this.
- **The rules live on a rules page, and a script turns them into numbers**: CMS change packs the owner reviews and Syncs, as content arrives now. No code is needed to start.
- **Ingredient counts double every two tiers.** For example, ore per ingot goes 2, 3, 4, 6, 8, and gear made from ingots multiplies it again, so miners stay busy and late items need stockpiling. This sits within the owner's first ruling: more ore late, never hundreds per ingot.
- **An old task is about 2x slower one tier later**, 4x two tiers on, and about 30x at 99 (owner, 2026-11-07, amending "about 4x" from the same day). The maths showed that today's XP table and the pace curve give every tier's work about the same XP an hour up to level 45. The owner picked a new XP table at 2x a tier over 4x (bigger numbers) or keeping today's (T-337).
- **Crafting and gathering earn about the same XP an hour at the same level**, "however we should consider that the player is consuming resources (paying a cost) when crafting, but also getting multiple payouts (XP from crafting an item in each link of the chain)."
- **Actions take a little longer each tier**: "I want players to be motivated to build work-speed increasing buildings." So Faster Work buildings must stay clearly worth building late, and the boost targets (buildings up to +30 % today) are checked against that.

### Drops, finds and prices (owner, 2026-11-07)

- **Basic drops are near-sure**: "those basic drops are going to be near-sure and dropping every kill, maybe in larger quantities too." Hide, Silk, meats and scales come every kill, and rarer materials come from tougher enemies.
- **Rare drops for powerful gear are very rare**: "special rare drops that may happen only 0.1% of the time or less, to let the player grind and hunt for rare items for powerful equipment."
- **Bonus finds are 1 in 100 or rarer**: "There are multiple heroes working on these tasks for hours or days at a time, so a regular drop rate will give them a flood of items. Players need a reason to craft potions or other consumables that will boost those drop rates to effectively farm those rare items. The purpose of our basic items that are easy to get (herbs, wood, ore) is to utilize them to get the more challenging items."
- **A very low rate on repeatable work still counts as a steady source**: "Heroes produce a lot, and with a extremely low 0.1% drop rate and a 10s work cycle, a hero will still find at least a couple of an item if they work at a node all day long." That's 8,640 cycles a day, so about 8 finds a day. Pearls from the Oyster Bed and gems from the Geode stand as they are.
- **Upgrade payback grows with the tier**: an early upgrade earns back its price in about an hour of the work it boosts, a late one in about a day, following the pace curve.

- **Finds a day, unboosted, for one hero** (owner, 2026-11-07):
  - **Bonus finds** (gems while mining, Bird Nests, Pearls): **about 20 a day**, about 1 in 400 actions at 10 seconds.
  - **Rare gear drops**: **about 1 a day**, about 1 in 7,000 kills at 12-second fights (0.014 %).
  - **The same finds a day at every tier.** Late actions take a little longer, so the chance per action rises slightly to match.
- **Rare-find boosts** (owner, 2026-11-07): **a rare-find potion doubles finds**, rising to x3 for late potions, and **a Rare Finds building adds x1.5**, so together x3 to x4.5. ⚠️ This is an exception to the boost-strength targets (consumables +20 % today): the ledger's settings need a rare-finds target of its own, or its balancer will weaken these.

### What these mean for the rules

- **A rate is judged as finds a day**, not as a chance: (86,400 seconds ÷ cycle seconds) × chance, for one hero working all day. A rare item's rate is set from how many a day it should give, and boosts (work potions, Rare Finds buildings) multiply that.
- **Basic materials feed the hunt**: herbs, wood and ore become the potions and boosts that make rare finds farmable. Rare-find potions are therefore a main reason to run Alchemy, and their strength is a balancing target of its own.
- **A one-off find** (a Fallen Star, a Shipwreck) that wears out for good is still luck and isn't a steady source. Only repeatable work counts.
- ⚠️ **The ledger disagrees today**: it warns on any drop under 5 % with no sure way (`LUCK_BELOW`), so every rare find will show as "Luck only". T-336 changes it to finds a day.

### After the critical review (owner, 2026-11-07)

*A reviewer ran sample guilds through real chains. The XP spine held (one skill climbs in exactly 34.4 days); four things broke when a guild feeds a chain. The owner's answers:*

- **Base gather yields stay flat**: "Increased ingredient gain is expected through building and Star upgrades. In practice we do grow yields, but for the base numbers they should not." Yield boosts carry the gatherer-to-crafter balance, so their targets grow by tier.
- **Doses last a number of cycles, and crafts make batches**: "A dose is meant to last a number of cycles, not time. But also we will make batches." A batch pays back at least 4x its making time.
- **Speed boosts keep today's adding and the 80 % cap, with smaller targets**: everything at Maxed cuts at most 65 %.
- **Rare items are a gate**: "Rare items are a gate that can be passed by having multiple heroes working on similar tasks, or by using boosts."
- **Agent's calls from the review, written into the rules**: XP from the work cycle alone, with a rest rule (uses × cycle ≥ 3 × rest); XP an hour taken halfway to the skill's next unlock, so skills with few unlocks keep pace; a make step's time grows with its bar count, so Daggers aren't the best XP; T-337 keeps each saved hero's level; a guild-wide Hall star's payback counts all the work it boosts.
- **The calendar**: 21 skills × 34.4 days ÷ 8 heroes is about 90 days with no slack, a little over the 3-month aim, as the ladder already said. *(Superseded the same day by the smooth curve: 21 × 15.3 ÷ 8 is about 40 days optimized.)*

## How we test and balance it (owner, 2026-11-07)

*The owner: "We also need to consider how our various boosts are balanced, as well as the upgrade costs. How we gate items is also a factor... We need a plan for how we're going to test and balance all of these."*

### The owner's rulings

- **All at once on paper**: "I want the progression logic to be consistent throughout the game. As an example, I want level 10 to take 8 mins of well-optimized work to level up, then level 11 to take 12 mins. I want level 90 to take 4 hours, level 91 to take 5 hours. These numbers are just examples." The whole planned game is balanced in one pass, by rule, then played.
- **The curve describes a well-optimized player.** A typical player is slower, about 1.5 to 2x; no boosts, at most 3x.
- **One smooth curve: each level 6.5 % longer**, 3 minutes at 1, a day at 99, about 15 days a skill optimized. It amends the ladder's 34 days a skill: about 6 weeks for the whole game optimized, 2 to 3 months typical ([BALANCE_RULES.md](../reference/BALANCE_RULES.md) section 1).
- **Proof in three steps**: the ledger on every change, the real engine on fixed boards, then the owner's play against a milestone sheet.
- **Boosts are held to a budget per kind and tier.**
- **Late tiers are tested from start-at-a-tier saves.**

### The paper pass, in order

Each step reads the one before, so the order matters:

| Step | What | Settles |
|---|---|---|
| 1 | **The curve and the XP table** | How long every level takes for the optimized player; the XP each level needs (T-337) |
| 2 | **The boost budget** (below) | What the optimized and typical players hold at each tier, so the XP per action can allow for it |
| 3 | **Base numbers by the rules** | Every planned entry's XP, action time, ingredient counts and drop rates (the script, on T-305's Planned entries) |
| 4 | **Upgrade prices** | Each Hall star and building variant priced by payback against what step 2 says it gives |
| 5 | **Gates** (below) | Every unlock's gate checked for walls and luck |
| 6 | **The ledger over the whole plan** | Walls, stage times and every player's pace from 1 to 99 in every skill; fixes by rule, never one number at a time |

### The boost budget

**One table, one row per tier, one column per kind of boost**: speed, yield, XP, rare finds. Each cell holds the total a typical and an optimized player hold there, and every building, drink, potion, tool, perk and Hall star is counted against it. The ledger adds the boosts up per player and flags a total over its cell. A new boost then shows at once what it uses up. It grows from the boost targets the ledger already has, and the speed cap ruled after the review (at most a 65 % cut at Maxed) is its ceiling.

**Settled 2026-11-07** ([BALANCE_RULES.md](../reference/BALANCE_RULES.md) section 5): the optimized advantage grows to 3x by darkmetal; a typical player is about 1.2x behind early and 2x late; yield boosts keep a typical guild at about 2 gatherers per crafter at every tier; **buildings carry the most speed** (owner).

### Gates

**Every unlock is behind one or more gates**, and each kind is checked by what the ledger already measures:

| Gate | What it is | Checked by |
|---|---|---|
| A level | The skill level to make or work it | The curve: no step over 2x its expected time (walls) |
| A tool | A pick or axe of a tier, a rod, a harpoon | The tool's recipe lands before what it gates (the tool rule) |
| A place | A ring, unlocked by Hall stars (ring stars), or a special Token | Checks F, over 100 seeds: every world reaches it |
| A building | A station or camp built first | Its price against payback; the one-off step rule |
| A rare item | A find or rare drop | Finds a day (T-336): several heroes or boosts pass it in good time |
| A chain | Ingredients from other skills | The ledger's path time: no skill waits on another past its wall |

**A gate is balanced when the optimized player's path through it stays on the curve**, and the typical and bare players stay inside their bounds.

### The proof

1. **The ledger, on every change**: minutes, run by the content agent and the pack gate before a pack reaches the inbox.
2. **The real engine on fixed boards, one per tier**: what `npm run bench:calibrate` does for five boards today, extended to a board for each tier with its boosts. It proves the ledger's rates within a few percent, so the paper pass can be trusted.
3. **The owner's play, against a milestone sheet**: a short list per tier ("the first iron bar by about 1 h optimized", "a level 40 skill by day 2"). The game logs real times beside the ledger's forecast. A gap over the tolerance sends the cause back to the rules.
4. **Start-at-a-tier saves**: a QA button builds a save at the start of any tier, from the ledger's typical player (levels, tools, buildings, a stock of materials), so an hour of mythril or darkmetal play takes an hour, not weeks.

### Tools this needs

- **The ledger**: the smooth curve, the optimized player as the curve's target, and the boost budget table and its check (T-339, with T-336 and T-338).
- **Testing**: a calibration board per tier, a milestone sheet with a play log, and start-at-a-tier saves (T-340).
- **The numbers script** on the Planned entries (a brief, after T-305).

## The shape (agent's proposal, to settle in the next round)

Three layers, each with one job:

1. **The pace curve** (exists): how long a level should take at each level. The single dial for "quick early, slow late".
2. **The rules page** (new, `docs/reference/BALANCE_RULES.md` once approved): per tier, in plain words with a table:
   - **XP per action, from the curve**: an action's XP is set so that, at the level it unlocks, a Typical hero levels at the curve's pace.
   - **XP falls behind with level**: the same action stays the same while levels need far more, so an old task is about 2x slower one tier later. That's the "can't reach 99 on copper" rule.
   - **Crafting and gathering earn the same per hour.** A chain pays at every link, so a whole guild earns several skills' XP from one late item, and it pays for that in materials.
   - **Ingredient counts double every two tiers**, and stay well short of hundreds per ingot.
   - **Cycle times** grow a little each tier, so work-speed buildings pay off.
   - **Drops and finds**: basic drops near-sure every kill; bonus finds 1 in 100 or rarer; rare gear drops 0.1 % or less; all set as finds a day.
   - **Upgrade prices** (Guild Hall, building variants): payback from about an hour early to about a day late, as the ledger measures it.
3. **The ledger** (exists): times the result for every entry, flags walls and empty stretches, and its balancing preview nudges the outliers. Nudges stay within what the rules allow, or the rule changes.

## Steps

| Step | What | Who |
|---|---|---|
| 1 | Settle the rules with the owner (this page, multiple choice) | `/content` |
| 2 | ~~Write `BALANCE_RULES.md`~~, done 2026-11-07 as a draft, with its script `.claude/skills/content/balance_rules.py` | `/content` |
| 3 | Put the ladder's pace curve and stage budgets in the ledger's settings (T-294); the new XP table (T-337); rare finds by the day (T-336) | director |
| 4 | A script turns the rules into numbers on the Planned entries (needs T-305's packs) | brief for the director |
| 5 | The ledger times the whole planned game at each player; the owner sees walls and stage times | director, owner |
| 6 | Nudge, re-check, and prove a few milestones in real play before any number is final | director, owner |
| 7 | Combat's power curve, its own segment | later |

## Open questions

- **Boss drops**: settled with the enemies session.
- **How the costs of a chain show the player its worth**: whether a crafted item's XP accounts for the materials spent, beyond the same-rate rule.
