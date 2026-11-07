Status: draft

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
- **An old task is about 4x slower one tier later**, and about 15x two tiers on. Usable to top up a skill, clearly not worth it, and 99 on copper is out of reach.
- **Crafting and gathering earn about the same XP an hour at the same level**, "however we should consider that the player is consuming resources (paying a cost) when crafting, but also getting multiple payouts (XP from crafting an item in each link of the chain)."
- **Actions take a little longer each tier**: "I want players to be motivated to build work-speed increasing buildings." So Faster Work buildings must stay clearly worth building late, and the boost targets (buildings up to +30 % today) are checked against that.

### Drops, finds and prices (owner, 2026-11-07)

- **Basic drops are near-sure**: "those basic drops are going to be near-sure and dropping every kill, maybe in larger quantities too." Hide, Silk, meats and scales come every kill, and rarer materials come from tougher enemies.
- **Rare drops for powerful gear are very rare**: "special rare drops that may happen only 0.1% of the time or less, to let the player grind and hunt for rare items for powerful equipment."
- **Bonus finds are 1 in 100 or rarer**: "There are multiple heroes working on these tasks for hours or days at a time, so a regular drop rate will give them a flood of items. Players need a reason to craft potions or other consumables that will boost those drop rates to effectively farm those rare items. The purpose of our basic items that are easy to get (herbs, wood, ore) is to utilize them to get the more challenging items."
- **A very low rate on repeatable work still counts as a steady source**: "Heroes produce a lot, and with a extremely low 0.1% drop rate and a 10s work cycle, a hero will still find at least a couple of an item if they work at a node all day long." That's 8,640 cycles a day, so about 8 finds a day. Pearls from the Oyster Bed and gems from the Geode stand as they are.
- **Upgrade payback grows with the tier**: an early upgrade earns back its price in about an hour of the work it boosts, a late one in about a day, following the pace curve.

### What these mean for the rules

- **A rate is judged as finds a day**, not as a chance: (86,400 seconds ÷ cycle seconds) × chance, for one hero working all day. A rare item's rate is set from how many a day it should give, and boosts (work potions, Rare Finds buildings) multiply that.
- **Basic materials feed the hunt**: herbs, wood and ore become the potions and boosts that make rare finds farmable. Rare-find potions are therefore a main reason to run Alchemy, and their strength is a balancing target of its own.
- **A one-off find** (a Fallen Star, a Shipwreck) that wears out for good is still luck and isn't a steady source. Only repeatable work counts.
- ⚠️ **The ledger disagrees today**: it warns on any drop under 5 % with no sure way (`LUCK_BELOW`), so every rare find will show as "Luck only". T-336 changes it to finds a day.

## The shape (agent's proposal, to settle in the next round)

Three layers, each with one job:

1. **The pace curve** (exists): how long a level should take at each level. The single dial for "quick early, slow late".
2. **The rules page** (new, `docs/reference/BALANCE_RULES.md` once approved): per tier, in plain words with a table:
   - **XP per action, from the curve**: an action's XP is set so that, at the level it unlocks, a Typical hero levels at the curve's pace.
   - **XP falls behind with level**: the same action stays the same while levels need far more, so an old task is about 4x slower one tier later. That's the "can't reach 99 on copper" rule.
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
| 2 | Write `BALANCE_RULES.md`, with worked examples per chain (copper to darkmetal ingots, a potion, a meal) | `/content` |
| 3 | Put the ladder's pace curve and stage budgets in the ledger's settings (T-294) | director |
| 4 | A script turns the rules into numbers on the Planned entries (needs T-305's packs) | brief for the director |
| 5 | The ledger times the whole planned game at each player; the owner sees walls and stage times | director, owner |
| 6 | Nudge, re-check, and prove a few milestones in real play before any number is final | director, owner |
| 7 | Combat's power curve, its own segment | later |

## Open questions

- **Target finds a day** for each kind of rare: a bonus find, a rare gear drop, a boss drop.
- **How strong rare-find boosts are**: how many times a potion or a Rare Finds building multiplies a rate.
- **How the costs of a chain show the player its worth**: whether a crafted item's XP accounts for the materials spent, beyond the same-rate rule.
