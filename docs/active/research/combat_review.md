Status: draft

# Combat review

*Design review of [concept_combat.md](../concept_combat.md) after the detail
pass (rulings of 2026-10-22, Depth section included), read against GDD §4, §6,
§7 and §14 and the skill-loops and basic-content concepts. Nothing here is
ruled; every suggestion that would change an owner ruling says so.*

## 1. How combat works once built

**Before the fight.** The player gives a hero a weapon of their own style
(a Fighter swings swords and daggers, a Rogue daggers), armour on hat and
chest, two trinkets, one food, one drink and any number of elixirs, then
drops the hero's flag near enemies. That is all the player decides: there
are no tactics settings and no win forecast.

**Starting a fight.** A hero fights an enemy in its flag area (a camp, a
lair boss, a guardian on a rich node), or is ambushed: some resource Tokens
have about a 5 % chance per finished work cycle to spawn a local enemy that
attacks the worker. Every fight is one hero against one enemy; a second
hero waits or picks another enemy. At the start the hero drinks one of each
equipped elixir (+damage, +armour, faster swings and so on) for that fight.

**The swings.** Each side swings on its weapon's clock: fast 2 s, normal
3 s, slow 4 s. A hit does the weapon's fixed number (about 2 for a copper
sword, about 8 for the last tier, +1 per 20 combat levels), adjusted ±25 %
by the style cycle (melee > ranged > magic > stealth > melee). Armour takes 1
off each hit per point, but a hit always does at least 1. About 1 swing in 10
misses (more if the enemy is higher level or nimble, less with Accuracy
gear; between 5 % and 40 %); about 1 in 20 crits for double, doubled before
armour, so crits are what breaks through armour. HP is 10 + combat level.

**Supplies.** Below 25 % HP the hero eats its equipped food, spending its
swing. Food is the only heal in a fight; nobody regenerates mid-fight
(outside fights about 1 HP every 10 s). Drinks become small buffs (their
details belong to the skill-loops planner).

**Statuses.** Poison (stacks, 1 damage per stack every 3 s) and Burn (1 per
tick for a few ticks, food heals half meanwhile). Both end with the fight.

**Gear and abilities.** Each weapon or armour family carries one ability
kept across tiers: Spear pierces armour, Bow adds Accuracy, Rapier adds Crit,
a Cleaver sometimes doubles Meat. Boss drops are fixed pieces, never rolled.
Getting stronger mostly means crafting the next tier.

**Enemies.** An enemy has a level (the CMS fills HP, hit, armour, speed and
XP from it, overridable), a style, and none, one or two hidden kinds:
Armoured, Nimble, Swift, Brute, Venomous. Camps last forever and drop
materials; guardians and bosses return on timers and are the only map
droppers. Bosses add scripted moves (heavy strike, poison or burn, a heal,
enrage).

**Defeat.** At 0 HP the hero is knocked out: its flag is furled, 25 % of
each equipped food and drink stack is lost, each gear piece has a 10 %
chance to be destroyed, and the hero is wounded for 5 minutes, returning at
half HP.

**What the player sees.** HP bars with number and percentage on both
fighters, floating numbers ("2", "Miss", "Crit!", green heals, poison
ticks), a 1.5 s "used" bubble when food or an elixir fires, the two style
icons in the bubble row, and a small combat icon that opens a panel with
everything. Overnight, the catch-up summary gets a combat block.

**A worked example.** A level-10 Fighter (20 HP), copper sword (2, every
3 s), copper chest (armour 1), against a level-10 wolf (20 HP, hits 2 every
3 s, no armour). The Fighter lands about 1.9 per swing on average, so the
wolf falls in about 11 swings, roughly 33 s. The wolf's 2 becomes 1 through
armour: the Fighter ends on about 10/20 and eats nothing. Take the chest off
and the wolf does 2 a hit: the Fighter drops below 5 HP around swing 8,
eats, and wins on its last few points. One point of armour was the
difference between a free win and a supply-burning one; that is the system's
strength and its sharpest edge.

## 2. Contradictions and gaps

**Contradictions between rulings or docs**

1. **Maps.** "Maps drop only from bosses and guardians" (combat, Depth)
   against basic content: goblins drop plane-1 maps, ordinary plane-1
   enemies drop plane-2 maps rarely, and every camp leader's first kill
   always drops a plane-2 map. Missing decision: is a camp leader (Goblin
   Chief) a guardian, a boss, or an ordinary enemy, and which doc gives way?
   The Direction line "each dropping that place's materials and maps" is
   also not marked amended.
2. **Poison against "wears off faster".** Poison lasts until the fight ends,
   yet the Hide Vest's example ability makes poison "wear off faster". There
   is nothing to wear off. Needed: a poison duration, or a different vest
   example.
3. **Boss shield without Shield.** The first boss moves include "heal or
   shield", but Shield is deferred to a later pass.
4. **Healing potions and healing drinks** live on in
   `concept_skill_loops.md` (Alchemy "healing and buff potions", Cooking
   drinks "heal from their own slot"), against the rulings that only food
   heals. Not marked there.
5. **"Can tell whether winnable"** is amended to "learn by playing and the
   panel", but kinds are hidden, there is no weak-to line, and nothing says
   the panel or hover shows an enemy's numbers *before* a fight. With all
   three, the only way to learn is to lose, and losing destroys gear.
6. **"Bandaged, never ruined"** against defeat costs. The code takes 25 % of
   the **whole Bank stack** of the equipped food (all heroes share it):
   one knockout with 200 bread banked burns 50. A copper pickaxe lost to a
   5 % ambush leaves a gatherer unable to work. Boss gear is one copy per
   hero and can vanish on a 10 % roll.
7. **Duel length against the performance envelope.** §14 designs for 1–2
   fights at once and about 6 enemies alive. Duels of 30 s or more with
   one-on-one fights mean heroes spend most of their time mid-fight, so
   several heroes on a camp make several simultaneous fights. The cost is
   concurrency, not swing count; the ⚠️ in the rulings points at the wrong
   number.
8. **Stale lines not marked amended**: Direction's "roles through style
   traits" (melee holds attention, magic hits groups) is dead with no
   traits and one-on-one fights; the "Deferred to the later pass" list is
   mostly decided; the doc's Status line still says direction only. GDD §4
   (Recruits can't fight, 50 HP, regen in fights) and §6 will need updating
   at briefing.

**Things a builder would have to guess**

9. **Eating at 25 % with tiny HP.** At 11 HP the hero eats at 2. Eating waits
   for its own swing, so a 4 s weapon against a Swift enemy can take two hits
   before the bite; a Brute hitting 3+ knocks it out from above the
   threshold. Missing: does eating happen at once or on the swing, and is the
   threshold a share or "one enemy hit"?
10. **Rounding.** ±25 % on a 2-damage hit is 2.5 or 1.5. Rounded down, a good
    matchup does nothing and a bad one halves damage. Burn halving a 5-heal
    food needs the same rule. Missing: round, or carry fractions.
11. **Level gap.** How many percent per level of difference? Does the enemy's
    miss chance use the same rule, and can heroes get Dodge? "Plus the small
    damage step": is that the +1 per 20 levels or a separate gap bonus?
12. **The level fill.** "The CMS fills HP, hit, armour, speed and XP for a
    tier" has no table. Without one, nothing else can be balanced.
13. **Venomous scaling.** One stack per hit, never ending: an enemy hitting
    every 3 s for 30 s stacks to about 9, adding about 45 poison damage, as much as
    a level-35 hero's HP. Needs a cap or a chance.
14. **Elixir drain.** One of each type per fight. A hero farming a camp
    overnight fights about 80–100 times an hour; ambushed gatherers would
    drink combat elixirs too. Alchemy cannot supply that, and there is no
    "save for bosses" setting.
15. **Unarmed promoted heroes.** A gatherer with a two-handed tool setup, or
    a Wizard whose staff is two-handed, has no weapon when ambushed. Do they
    punch for 1 like a Recruit, and do they earn XP?
16. **Wield requirement.** Can a level-1 Fighter use the last-tier sword?
    Nothing gates gear by combat level, so progress is purely smithing.
17. **Who swings first**, and do both clocks start at engagement? Matters a
    lot in 10-swing duels.
18. **Resting between fights.** A hero at 4/30 HP walks into the next camp
    enemy and eats at once. Do heroes wait to heal first (1 HP per 10 s is
    four minutes to refill)?
19. **Saving mid-fight.** Fight state is never saved; with 30 s+ boss duels,
    closing the game mid-fight needs a rule (restart, or resolve).
20. **Guardians between attempts**: do they heal to full like bosses? Can a
    guardian be ambushed into, and does it block work offline?
21. **Two hours to level 15** (basic content) means early combat XP must be
    fast; the long duels halve kills per hour. The XP fill needs to know.

**Scaling over 99 levels.** HP grows 10 → 110 (eleven times), damage about
2 → 13 (weapon 8 + 5 from levels), armour subtracts flat. The ratio holds if
each tier's enemies grow the same way, so the scale itself is sound. Two
edges: early, armour is worthless against 1-damage enemies then halves
2-damage ones (a cliff, not a curve); late, the +25 % matchup and +1 per 20
levels become the only gradual growth, so a hero gets stronger in big tier
jumps with almost nothing in between. On a RuneScape curve most play time is
spent at high levels where HP gains 1 per long level; that is fine if tiers
keep coming.

## 3. Underdeveloped

- **The four styles feel the same.** With no traits, a Fighter and a Ranger
  differ only by which side of the cycle they sit on. The weapon families are
  the natural place for identity but no family list per style exists.
- **Armour**: which slots give how much, and the budget per tier ("one point
  under the tier's typical hit" is only in the research).
- **The enemy roster and the level table** (see gap 12): Wolves, Crabs,
  Boars, Rock Elementals, Bears, Bog Toads and the camp leaders all wait on
  it.
- **Guardians**: return timer, what they block, how the player sees one.
- **Hero choice within a flag**: which enemy a hero picks, and fight versus
  work priority with the one combined Fight rule.
- **Loot tables**: rates, the recap's content, and what to do with duplicate
  one-copy boss gear when nothing can be sold.
- **Drinks**: they keep a slot but have no trigger or effect yet.

## 4. Overcomplicated

- **Hidden enemy kinds.** Five kinds that change what gear wins, deliberately
  unshown, add rules without adding choices: a passive player cannot react to
  what they cannot see, and finding out costs gear.
- **Burn's half-healing food.** A special exception for one status, with a
  rounding problem, that a passive player will rarely notice. Burn as plain
  damage over time does the job.
- **Three supply triggers** (food on low HP, drink on something, elixirs per
  fight, skill elixirs per cycle) with different drains. Hard to read in the
  recap and to budget.
- **Gear loss by random roll** for a game where gear is crafted, one copy per
  hero and never wears out. It punishes the idle player for something they
  were not there to see.
- **Swift and Brute** largely repeat what weapon speed already expresses;
  fine as presets, but they are numbers, not new rules.

## 5. Suggestions (most valuable first)

1. **Show the enemy's card on hover and in the panel: level, style icon,
   HP, hit, armour, speed, and its kinds once met.** *Fixes a gap.*
   Without it "learn by playing" means "learn by losing"; this keeps the
   no-forecast ruling. Touches the hidden-kinds ruling (kinds revealed after
   the first meeting).
2. **Publish the level table** (enemy HP, hit, armour, speed, XP per level,
   tied to the weapon tiers). *Fixes a gap.* Every other number, the roster
   and the 2-hour level-15 target hang on it.
3. **Eat at once (not on the swing), when HP falls to 25 % or below one enemy
   hit, whichever is higher.** *Fixes a gap; amends "eating takes that
   swing".* Stops knockouts with food in the bag at 10–30 HP.
4. **Soften defeat: lose 25 % of the food the hero carried into the fight,
   not of the Bank stack, and no gear loss (or gear dropped as loot at the
   fight spot).** *Simplifies; amends the defeat ruling.* Keeps "bandaged,
   never ruined" and protects tools and boss gear.
5. **Elixirs last a time (say 5 minutes) or a number of fights, not one per
   fight.** *Fixes a gap; amends the elixir ruling.* Makes Alchemy's supply
   possible to keep up and stops ambushes wasting them.
6. **Cap poison at 3 stacks (or Venomous poisons on 1 hit in 4).** *Fixes a
   gap.* Prevents one kind beating every hero of its tier.
7. **Settle the map question with basic content: camp leaders count as
   guardians for map drops.** *Fixes a gap; amends one doc or the other.*
   Two planners currently promise different sources.
8. **Give each style its identity through its weapon families** (Bows
   +Accuracy, Daggers +Crit, wands Pierce, swords Guard). *Adds depth.*
   Uses an existing ruling; no traits needed.
9. **Heroes rest to about 75 % HP before starting a chosen fight**
   (ambushes excepted). *Adds depth, cheaply.* A default, not a tactics
   setting; saves food and makes overnight farming sane.
10. **One rounding rule: modifiers apply to the final hit, round to nearest,
    minimum 1.** *Fixes a gap.* Makes the matchup and Burn behave as the
    rulings intend.
11. **Burn: plain damage over time, no food penalty.** *Simplifies; amends
    the Burn ruling.* One fewer exception.
12. **Budget fights against §14 by concurrency**: one fight per enemy alive,
    camps capped so a Region never runs more than about 3 at once.
    *Fixes a gap.* Points the ⚠️ at the real cost.

Small fixes to make at briefing without a ruling: decide who swings first
(both clocks start at engagement, the enemy half a swing late), saving
mid-fight (restart the duel on load), unarmed promoted heroes (punch for 1,
earn XP), and wield levels per tier. Mark the stale Direction lines and the
other two concept docs' healing-drink and healing-potion lines as amended.
