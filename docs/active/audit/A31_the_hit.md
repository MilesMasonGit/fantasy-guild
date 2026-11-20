# A31: The hit
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A hero swings at their weapon's speed (fast 2 s, normal 3 s, slow 4 s), an
enemy at its own. Each swing first rolls to miss (10% at even levels, moved by
the level gap, Dodge and Accuracy, kept between 5% and 40%), then to crit (5%,
double damage). The damage is the weapon's, plus 1 per 20 combat levels, plus
flat Damage, times the style matchup (±25% around the cycle melee > ranged >
magic > stealth > melee), times Damage % buffs, then split by damage type
(nine types in three groups) and moved by resistances and weaknesses. A
fraction rolls: 1.1 does 1 nine times in ten, 2 one time in ten. The code
matches the GDD closely; the differences are at the edges.

## What the player sees and does

- **Fights on the mat**: the fight window shows the swings, misses, crits
  and damage; a hit reads "Weak!" or "Resisted" by its type.
- **The weapon decides everything**: style, damage, speed, type. A bow's shot
  is two parts (the bow's type and the arrow's).
- **Gear defends by type**: a chestplate resists Physical, a hat Fire, and so
  on; metal gear also cuts the wearer's Magic and Stealth damage.
- **Enemies** have a Style, speed, hit, moves with types, and resistances or
  weaknesses (the Crab: Physical 50, Crush −50, Electric −25).

## What really happens underneath

- **The level step (+1 per 20 levels) and flat Damage add to the weapon part
  only**, never to the arrow part.
- **Resistance adds up two ways**: on a hero, a Physical line and a Slash
  line both count against Slash. On an enemy, a Crush line replaces its
  Physical line (the Crab takes Crush as a 50% weakness, where the hero's rule
  would give 0). And an effect's resistance on an enemy (Flutter, Physical +50)
  is added on top of either, a third rule: a Fluttering Crab would take Crush
  at 0. Only the Crab has a group line and a type line today.
- **Immunity isn't always 0**: a Type Damage boost goes through a 100%
  resistance (a hero with Poison +15% would do 15% to the Toxic Frog). The
  GDD says immunity means 0. No effect carries Type Damage yet.
- **Poison and Venom are different things**: Poison is a damage type that
  resistance cuts; Venom is a status doing 1 untyped damage every 3 s that
  nothing resists. The Toxic Frog has both: its kind lands Venom on every hit
  (even its Crush tongue), its Toxic Spit is a Poison hit, and it resists
  Poison 100.
- **Rule damage (poison ticks, Deals) rounds to nearest**; a swing rolls its
  fraction. Rule damage never misses, crits or meets resistance.
- **Dodge and Crit from the guild don't reach heroes**, Accuracy does (T-512
  from A37 already fixes it).
- **Swing Speed** (the code's Swing Time) moves both sides' swings, kept
  between a quarter and four times the weapon speed. The GDD's fight section
  never mentions it. It has three names: Swing Time (the CMS rule), Swings
  every (the game), Attacks every (the CMS enemy page).
- **A plain swing with no move** (Physical) is in the code, but every enemy
  has moves, so no content reaches it.
- **An enemy's hit is at least 1** and a weapon with damage 0 hits as a fist;
  neither can be authored lower.
- **Unread data**: `ignoresArmor` on 3 effects; the CMS still offers Armor,
  Resistance and Pierce rule rows marked "does nothing".
- **The CMS's content generator writes the old enemy shape** (combatType,
  combatStat, tier, a 2 s default speed), none of which the game reads.
- **Random draws**: the GDD's list misses three (which hero an enemy targets,
  drawn every swing even with one hero; an arrow's Preservation; On Swing
  rule chances).

## What the owner controls in the CMS

Per weapon: damage, speed (fast, normal, slow), style, damage type, rules.
Per armour: resistances, damage cuts, rules. Per enemy: Style, kind, speed,
hit, crit, dodge, resistances, moves (each a type and a hit), rules. Effects:
Damage, Accuracy, Dodge, Crit Chance, Swing Time, Type Damage, Type
Resistance, Sunder, Venom and the other statuses. Not in the CMS: the miss
formula and its limits, crit 5% and ×2, the ±25% matchup and the cycle, fist
damage 1, the level step (20 levels), the three swing speeds, the Swing Speed
limits, the default damage types per style, the status tick (3 s), enemy
health by level.

Data today: 19 enemies (Style melee 11, stealth 4, magic 3, ranged 1, the
Wind Elemental); no effect uses Type Damage; Sunder 10 a stack, 3 stacks.

## What it touches, and where it overlaps another system

- **Effects** (ready to brief): Damage, Accuracy, Crit, Dodge from the guild
  (T-512); the same effect adding in full (T-516); the effect names (Swing
  Speed, T-494).
- **Status effects and boss moves** (A33): Venom, Burn, Sunder, Flutter, moves.
- **Enemies** (A32): kinds and their numbers; enemy health on return (parked
  here from A28, belongs with A32 or A34).
- **Equipment** (A29): weapons, armour, damage cuts.
- **Ranged** (A16): arrows, now required (owner ruling, 2026-11-20).

## Where it differs from the GDD

- "Immunity means 0": not with a Type Damage boost.
- The random-draw list misses three draws.
- Swing Speed isn't in the fight section.
- An effect's resistance on an enemy adds on top of the enemy's own lines;
  the GDD gives only the replace rule.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give a hero a Copper Sword (Slash), a
   Copper Greatsword (Crush), and a Copper Bow with arrows; place a Crab and a
   Toxic Frog.
2. **Fight the Crab with the sword, then the greatsword.** You should see
   "Resisted" with the sword (Slash under Physical 50) and "Weak!" with the
   greatsword (Crush −50), much bigger hits.
3. **Fight the Toxic Frog** with the sword: Venom lands on you on every hit,
   including its tongue; its Toxic Spit hits as Poison.
4. **Watch a fight's numbers**: some hits do 1, then 2 with the same weapon
   (the fraction roll); misses and the odd crit (double).
5. **Fight a Bee** (Flutter): many more misses? (Flutter is Dodge and
   Physical resistance on the bee).
6. **Hover an enemy's card**: how its speed is worded ("Swings every"), and
   compare the CMS's "Attacks every" if you open the CMS.

## Owner feedback (date)

## What it became

## Evidence

- Hero blow: base, level step, flat Damage, weapon part only → `src/systems/combat/CombatFormulas.js:330-347`; multiplier, crit, type factor, sum → `:359-382`; fraction rolled → `src/systems/combat/CombatAttackProcessor.js:112`, `src/utils/RNG.js:29-35`
- Enemy blow → `CombatFormulas.js:385-401`; hit at least 1 → `src/config/registries/enemyProfile.js:150`
- Type factor, no floor at immunity → `CombatFormulas.js:321-324`
- Enemy resistance replaces → `src/config/registries/damageTypes.js:138-144`; plus effects → `CombatFormulas.js:304`; hero lines add → `src/systems/effects/ModifierAggregator.js:276-280, 304-306`
- Miss → `src/config/FormulaRegistry.js:55-68`; crit 5%, ×2 → `FormulaRegistry.js:73-74`, `CombatFormulas.js:170-172`; guild Dodge, Crit not read → `CombatFormulas.js:165-172`
- Swing speeds and limits → `FormulaRegistry.js:40-44, 180`; Swing Time on both sides → `CombatFormulas.js:115-131, 200-202`
- Matchup ±25%, the cycle → `FormulaRegistry.js:79, 87-92, 108-110`
- Rule damage rounds to nearest, untyped → `src/systems/board/DealDamage.js:78-84, 101, 117-137`
- Venom status, tick 3 s → `src/config/registries/enemyKinds.js:29`, `FormulaRegistry.js:174`; Venomous on every hit → `src/systems/board/FightMoments.js:40-55`
- `ignoresArmor` unread → `data/effects.json` (3), only a comment at `DealDamage.js:21`; dead palette rows → `src/config/registries/modifierPalette.js:561-638`
- Enemy target drawn every swing → `CombatAttackProcessor.js:202`; arrow Preservation draw → `src/systems/combat/Arrows.js:59`
- Weak/Resisted label → `CombatFormulas.js:426-435`, `src/ui/components/combat/FightPanel.jsx:119, 480-482`
- Three names for swing speed → `modifierPalette.js:703`, `src/i18n/en.json:141, 487`, `cms/src/components/editors/TokenEditor.jsx:794`
- Content generator's old enemy shape → `cms/src/engine/contentGenerator.js:131-142, 436-455`
