Status: briefed 2026-10-28 (approved 2026-10-28; brief 280)

# Combat v2: styles with character, damage types, mix and match

*Owner interview, 2026-10-28, after an analyst's review of the built combat
(brief 220) in the light of [concept_hero_orders.md](concept_hero_orders.md)
and [concept_classless_heroes.md](concept_classless_heroes.md). Owner's aim:
with every style open to every hero, **there must be reasons to mix and
match styles and gear; a simple attack is not interesting.** Amends
[concept_combat.md](concept_combat.md) where it says so below.*

## What the review found (built combat, 2026-10-28)

- Weapon speeds are tuned to the same damage per second; family abilities
  are small nudges (Dagger +5 crit, Bow +5 accuracy; Sword, Greatsword, Wand
  none); every armour piece is +1 Armour.
- At copper numbers the ±25 % cycle rounds away (a 2 stays 2 on the bad
  side), and the "a hit does at least 1" floor makes fast weapons beat armour,
  backwards from the design.
- Enemy kinds make enemies harder but rarely ask for a particular answer.
- Only the first weapon in the hands is swung. Once styles stop gating
  weapons, an unswung weapon in the second hand would lend its ability for
  free (`HeroEffects.js` gates it by style today): the off-hand rule below
  closes that.

## Styles have a character, not a single trait (owner)

The owner rejected one-line traits per style. Each style has a **character**
expressed through several mechanics:

| Style | Character (owner) | Mechanics (accepted starting point) | Supplies (owner) |
|---|---|---|---|
| **Melee** | Lots of damage; very good at killing many small enemies quickly while consuming few resources. | Highest base damage per tier. After a kill the next enemy is engaged at once, with no pause: fast camp clearing. | None. |
| **Ranged** | Costs ammo, but hits with several kinds of damage. | Every hit deals **two damage types**: the arrow's (physical, e.g. Stab) and the bow's (a magical type). A ghost immune to Physical still takes the bow's part. | **Always**: one arrow per shot, made in bulk by Fletching. |
| **Magic** | Access to a variety of damage types, so with the right gear it works against lots of enemies. | Lower base damage; each wand or staff carries one damage type (Fire, Ice, Electric), and off-hand items and armour shape it. A mage owns several weapons. | **Sometimes**: some weapons or spells spend **Motes**. |
| **Stealth** | Really high burst damage, but inconsistent: good for bosses while the player watches and can pull out if it goes badly. | The sneak strike opener, high crit chance and big crits, low steady damage. | **Sometimes**: **Throwing Daggers**. |

- **The four-way cycle stays at ±25 %** (owner): low-level combat is not meant
  to be shaped strongly by these systems; at 20–30 base damage the 25 %
  shows.
- **"Unseen at work" is dropped** from classless heroes (a single-purpose
  trait).

## Damage types (owner; analyst's review 2026-10-28)

### The list: three groups, nine types

| Group | Types | Mostly reached by |
|---|---|---|
| **Physical** | Slash, Crush, Stab | Melee (all three), Stealth (Stab), Ranged (the arrow) |
| **Elemental** | Fire, Ice, Electric | Magic, Ranged (the bow) |
| **Special** | Poison, Light, Dark | Stealth (Poison, Dark), Ranged (the bow), later content (Light) |

- No Earth (owner). An enemy resisting **all** of Special is very rare (owner).
- Stealth's types: Stab, Poison, Dark (Dark replaces the sketch's "Shadow").

### Design philosophy (analyst's rules; owner approved the decisions they rest on)

1. **Only weapons and ammo give a hit its type.** A weapon has one type; a
   ranged shot has two (arrow and bow). Armour, off-hand items and elixirs
   only boost or resist types; they never add one.
2. **The type comes from the weapon family and its name, never the tier.**
   Swords are Slash at every metal; magical types are named on the item
   ("Ember Wand", "Frost Bow").
3. **A type earns its place**: at least one weapon carries it and at least
   three enemies in a tier band care about it, or it waits.
4. **Enemies stay readable**: most have 0–1 entries, bosses up to 3; no enemy
   shuts out every type a style can reach at its tier.
5. **Resistances can be guessed from the creature**: a shell resists Slash, a
   fire elemental ignores Fire.

### Rules

- **Gear boosts types by percentages** ("Poisoner's Cloak: +15 % Poison"),
  free numbers. A gear line may name a type or a group.
- **Enemy resistances and weaknesses come in fixed steps** (owner): resist
  25 / 50 / 100 %, weak 25 / 50 %. Several per enemy are allowed.
- **A group line and a single-type line**: the single type replaces the group
  (owner). "Skeleton: Physical resist 50 %, Crush weak 50 %" reads as written.
- **Shown on the enemy's info card** (owner).
- **Statuses are separate from damage types** (owner): the Poison status is
  renamed **Venom**; Burn is already its own thing, not Fire damage. A Fire
  weapon does not Burn unless a rule says so.
- **Ranged: the arrow adds its own damage** (owner): a shot is the bow's
  damage in the bow's type plus the arrow's damage in the arrow's type. Bow
  and arrow are each tuned to about **half** of a comparable weapon.
- **Order of a hit** (analyst; routine, updated for Defence below): weapon
  damage × style matchup × buffs → crit → × the type factor (1 + the
  attacker's boosts − the target's resistance to that type, after Sunder;
  never below 0) → the fraction sub-roll. No flat armour and no "at least 1"
  floor: a resisted hit can do 0, and immunity means 0.

### Enemies attack with moves (owner)

- **Each enemy has a few attacks, picked at random** each swing, each with its
  own damage type or effect. Owner's example, a chicken: **Peck** (Stab),
  **Scratch** (Slash), **Flutter** (a status: +50 % Physical resistance for
  one attack).
- So **hero armour with type resistances matters on defence** as well as
  offence. An enemy with no moves authored hits as today, as Physical.
- This grows the built boss-move machinery (GDD §6, "Boss moves") to every
  enemy; the pick is one random draw per swing in a fixed order.

### Starter table (analyst's draft, for the owner's CMS pass)

Weapons: Sword and Cleaver Slash; Greatsword Crush (no Mace yet); Dagger Stab;
Copper Wand Fire, Iron Wand Ice; bows carry an Elemental or Special type,
arrows a Physical one. Enemies, e.g.: Crab resist Slash 50, weak Crush 50;
Frog resist Poison 50; Fire Elemental resist Fire 100, weak Ice 50; Wind
Elemental resist Physical 50; Cow and Goblin none. Content gaps: no arrows,
no Electric, Light or Dark weapon, no Mace, no type-resisting armour, no
Throwing Daggers, Motes or off-hand items.

## Small numbers: a damage sub-roll (owner)

- Combat numbers stay small (brief 220's scale). A hit whose sum has a
  fraction **rolls for the fraction** instead of rounding: 1.1 does 1 damage
  90 % of the time and 2 damage 10 % of the time. Bonuses add variance early
  and show plainly later.
- This replaces "every percentage rounds to the nearest whole, halves up" and
  "damage is fixed, no spread" for hits. One extra random draw per hit with a
  fraction, in a fixed order, so the catch-up replays the same fights.

## Gear and defence (owner)

- **No flat Armour stat.** Defence is **percentage resistances by type or
  group** on each piece of gear (owner): metal pieces resist Physical; cloth
  and leather lean Elemental; a fur-lined cloak resists Ice ("helps a wizard
  build stay safe against an Ice Elemental"). The armour families are a
  guide for authoring, not a rule (variety per Token).
- **Every piece is a trade-off** (owner): it lists a **damage cut to named
  styles** ("Iron Chestplate: Physical resist 20 %; Magic damage −30 %,
  Stealth damage −15 %"), so a hero with a wand is worse off in an iron
  chestplate than in nothing. Shown in red in the tooltip. Pieces mix freely.
- **No resistance cap; small numbers instead** (owner): gear values are kept
  low enough that a hero can never reach 100 % in any type (the content audit
  checks the best possible stack). A hero may stack one type high, but
  **enemy move sets make that a bad idea**: Ice-resist gear nearly shrugs off
  the Ice Elemental's Blizzard and leaves the hero bare to its Physical Smash.
  Optimal play balances gear against each enemy's moves.
- **The flat Resistance stat retires** (owner): one resistance idea, not two.
- **Pierce becomes a status, Sunder** (owner): each landing lowers the target's
  resistances for the rest of the fight, stacking to a limit (a status block
  like Venom's). Spears and some arrows carry it.
- **Attacks can miss** (owner: "we need some sort of accuracy mechanic"): the
  level-gap miss chance stays, with Accuracy from gear. Whether Dodge stays as
  a gear stat beside it is settled with the gear content pack.
- **Off hand: off-hand items only** (owner). **A shield acts like a piece of
  body armour** (owner): resistances and its effect, no block chance. Quivers,
  focus orbs and the like lend their bonus. A weapon in the second hand lends
  nothing. A two-handed weapon takes both hands.
- Enemies' **Armoured** kind (+armour) becomes a Physical resistance step.

## Fleeing (owner)

- **Dragging a hero somewhere else ends their fight**, as it ends any job
  (hero orders). No special rule; it is what makes a watched stealth boss
  fight safe to try.

## Amends

- [concept_classless_heroes.md](concept_classless_heroes.md): "Stealth plays its
  own way" becomes the character above, without "unseen at work"; "Armour
  families" becomes resistances and trade-offs (Gear and defence). Brief 270's
  K2 and K3 fold into this concept's brief.
- [concept_combat.md](concept_combat.md): "styles have no traits of their own",
  "weapon traits are a later idea", the rounding rule, the fixed damage, "the
  first weapon in the hands is swung", flat Armour, Pierce and flat
  Resistance.
- GDD §4 Equipment and §6 are partly stale already (12 weapons and armour
  ship; 18 enemies across all four styles): fix with the clean-up.

## Next steps

1. ~~Damage-type analysis and interview~~ done 2026-10-28.
2. ~~Owner approval~~ approved 2026-10-28; [brief 280](briefs/280_combat_v2.md), after brief 270 K1.

## Damage types (built in V1, 2026-10-30; for the V5 content author)

*What the CMS writes and the game reads. Nothing in `data/` uses it yet. The list lives in
`src/config/registries/damageTypes.js`.*

**A weapon** gains one field:

| Field | Type | Meaning | Default when absent |
|---|---|---|---|
| `damageType` | one of `slash`, `crush`, `stab`, `fire`, `ice`, `electric`, `poison`, `light`, `dark` | every hit's type (the CMS Weapon block's Damage type) | by its style: Melee `slash`, Ranged `stab`, Magic `fire`, Stealth `stab`; a fist is `crush` |

**An arrow** is a Consumable with an `arrow` block (CMS: the item's Arrow tick):

| Field | Type | Meaning | Default when absent |
|---|---|---|---|
| `arrow.damage` | whole number ≥ 1 | added to the bow's damage on every shot, in the arrow's type | 0 (adds nothing; the audit says so) |
| `arrow.damageType` | a damage type | the arrow's part of the shot | `stab` |

A hero whose weapon is Ranged and who carries arrows in consumable cells shoots the first in grid
order the Bank still holds, one per shot, hit or miss. A shot = the bow's damage (plus the level
step and gear's flat Damage) in the bow's type + the arrow's damage in the arrow's type. With none
left the bow shoots its own part alone (owner question parked in the V1 report).

**An enemy** gains one field; `armor` and `pierce` retire (ignored, named by the audits):

| Field | Type | Meaning | Default when absent |
|---|---|---|---|
| `resistances` | `{ <type or group>: <step> }`, steps `100`, `50`, `25` (resist) and `-25`, `-50` (weak) | `{ physical: 50, crush: -50 }`: a type's line replaces its group's for that type | none; the Armoured kind gives `{ physical: 50 }`, and the author's line on the same key replaces it |

An enemy's plain swing is a Physical hit (the group as a whole: a hero's Physical resistance takes
from it, a resistance to Slash alone does not) until V3 gives enemies moves.

**Two Rules rows** (Provides, flat number = percent, aimed at a type, a group, or every type):
**Type Damage %** (the bearer's hits of that type: "Poisoner's Cloak: Poison 15") and **Type
Resistance %** (hits of that type the bearer takes; negative is a weakness). A group's row counts on
each of its types. On an enemy (through a lingering effect, a boss move) they work the same.
**Armor**, **Resistance** (flat) and **Pierce** are no longer offered, do nothing, and the audits
name the rules that still provide them (today: Leather, Copper Plate, Iron Plate, Ironskin).

**The hit**: (weapon or hit + level step + flat Damage) × the matchup × Damage % buffs → × 2 on a
crit → each part × its type factor (1 + attacker's Type Damage % − target's resistance; never below
0) → summed → the fraction rolls (one draw, only when there is a fraction, after the miss and crit
draws). No floor: a resisted hit can do 0.

**Choices made in V1 the rulings did not spell out** (each small to change):

- **Defaults for untyped weapons** as above, so content from before keeps fighting as it did.
- **Armoured = Physical resistance 50 %** (it was +2 armour: on copper weapons 50 % hits as hard as
  the old armour did).
- **The level table's armour (1 per 30 levels) became 4 HP per 30 levels**: without it the even
  fight at the start of the gold, mythril, adamantine and darkmetal tiers fell to about 9.4 swings,
  under the owner's 10 (`CombatRules.test.js` checks every level). No shipped enemy is level 30 or
  more, so nothing shipped changes.
- **The floats' words are about the target**: "Weak!" when its weaknesses outweigh its resistances
  across the hit's parts, "Resisted" the other way; the attacker's own Type Damage % says nothing.
- **A landed hit that does 0 is still a hit**: On Hit rules and Venomous fire on it.
- **Resistances show on the enemy card from the start**, before the guild has fought one (kinds
  still wait for a fight).
- **A Deals rule's damage is untyped** and lands whole (its "ignoring armour" is gone with armour).

## Gear and defence (built in V2, 2026-10-30; for the V5 content author)

*What the CMS writes and the game reads. Nothing in `data/` uses it yet. The shapes live in
`src/config/registries/gearDefence.js`; the audit in `src/systems/core/gearDefenceRule.js`.*

**Any worn piece** (a hand item, a hat, a chest, a trinket) gains two fields, the CMS Item editor's
Defence block:

| Field | Type | Meaning | Default when absent |
|---|---|---|---|
| `resistances` | `{ <type or group>: <whole number, −99 to 99, not 0> }` | percent off hits of that type the wearer takes; negative is a weakness. **Lines add**: `{ physical: 20, slash: 10 }` resists Slash 30, Crush and Stab 20 (the Type Resistance % rows add the same way; an enemy's lines differ: a type's replaces its group's) | none |
| `damageCut` | `{ <combat style>: <whole number, 1 to 100> }` | percent off the wearer's hits while they fight in that style (the weapon's; Melee barehanded), the whole hit, an arrow's part included. Cuts from several pieces add; 100 or more leaves nothing. Shown red in the tooltip | none |

**An off-hand item** is a hand item with `offHand: true` (CMS: Held as, "An off-hand item"): it takes
one hand, is never swung, and lends its resistances, cuts and rules like a piece of armour (a shield;
a quiver or a focus orb lends its rules). It carries no weapon numbers (the audit names any) and may
ask a level like armour (`skillRequired` and `levelRequired`).

**The hands** (owner: off-hand items only in the second hand):
- **Only the weapon swung lends anything**: the first weapon in the hands the hero meets the level
  of. A weapon in the second hand lends nothing, whatever its style (closes the loophole where a
  second dagger lent its crit).
- **Taking up a weapon puts the one held down**, in its place; taking up an off-hand item puts the
  one held down. A tool stays beside either. A two-hander still clears both hands, and a one-hand item
  taken up still puts a two-hander down. An older save holding two weapons keeps them until the next
  weapon is taken up; the second lends nothing meanwhile.

**Sunder** is a status the CMS authors (a library effect with a Status block), with the new Rules row
**Sunder** (Provides, flat, points): every resistance the bearer has is that much lower, never below 0;
a weakness, or no resistance, is untouched. A status's rules count once per stack, so "Sunder:
stacks up to 3, lasts the fight; Provides Sunder 10" takes up to 30 off. It lands like any status: a
spear's "On Hit: applies Sunder to the enemy", an arrow's (below), an enemy's on the hero. The retired
**Pierce** row's audit line points at it. The QA scene's is Sunder 10, 3 stacks.

**An arrow's rules count on the shot that spends it**: carried, an arrow lends nothing; its moment
rules (On Swing, On Hit) join the hero's for the swing that shoots it, even when that shot spends the
last one. So a "Sundering Bodkin" with "On Hit: applies Sunder to the enemy" sunders only when shot,
never for a sword hero carrying it, and never when another arrow ahead of it in the grid is the one
shot.

**Venom** is the status once named Poison (Poison is a damage type now). **A content migration**
(`src/systems/effects/effectIdMigration.js`, beside the Logging → Forestry one) reads `effect_poison`
as `effect_venom` wherever content names it: the library entry (keeping its place, its name following
while it is still "Poison"), a bearer's effects list, an Applies or Removes, a Status Immunity or Stack
Limit's narrowing, a perk row. It runs over `data/` as the game loads and over the CMS workspace on
every load path, so the owner's next Sync writes `effect_venom` into `data/`. No save needs it: every
status ends with its fight and is taken off on load. The Venomous kind names `effect_venom`.

**The audit** (boot and the CMS Economy Audit, Critical): for every damage type and group, the best
stack a hero could wear: the best hat, chest, two trinkets, and the best hands (one weapon and one
off-hand item or tool, or a two-hander), each piece's own lines plus its always-on Type Resistance %
rows at its scale, plus every milestone perk (a hero at 99 holds them all). Any type at 100 % or more
is named with the pieces. Elixirs and statuses last a fight and are left out; two pieces sharing one
effect are counted twice, so the sum can only overstate. Also named: a line on an unknown type, off
the range or not whole; resistances or a cut on something that is not worn gear; a cut on a non-combat
style; an off-hand mark on a non-hand item or a tool; weapon numbers on an off-hand item. Today's
content: no finding (shipped armour still carries the retired Armor rows).

**Choices made in V2 the rulings did not spell out** (each small to change):

- **Gear's resistances and cuts are fields of the item**, not Rules rows, so each piece reads as the
  owner's example does ("Iron Chestplate: Physical resist 20 %; Magic damage −30 %"). The Type
  Resistance % row still works on gear too, and the audit counts both.
- **Gear lines add** (a group's beside a type's), unlike an enemy's, where a type's replaces its
  group's: gear stacks across pieces, so adding is the only reading that works for a stack.
- **The cut is on the whole hit**, after the matchup and buffs, before the crit, on every part (an
  arrow's too); untyped Deals rules and status ticks are not cut.
- **Sunder never makes a weakness**: it strips resistance to 0 at most (Pierce, which it replaces,
  never made armour negative). It lowers a hero's resistances the same way when an enemy lands it.
- **A weapon taken up replaces the one held** rather than being refused, so swapping weapons stays one
  drag.
- **The fight panel shows an enemy's resistances as they stand** in a live fight (after effects on it
  and Sunder); the enemy card still shows what was authored.

## Enemy moves (built in V3, 2026-10-30; for the V5 content author)

*What the CMS writes and the game reads. Nothing in `data/` uses it yet. The shape lives in
`src/config/registries/enemyMoves.js`; the engine in `combat/CombatAttackProcessor.js` and
`board/FightMoments.js`.*

**An enemy** gains one field, the CMS Token editor's Moves block:

| Field | Type | Meaning | Default when absent |
|---|---|---|---|
| `moves` | a list of moves (below) | each swing makes one, picked at random by weight | none: a plain Physical hit, as before |
| `moves[].name` | text | what the float, the log, the panel and the card call it | "Attack" on screen (the audit names it) |
| `moves[].hits` | `false` or absent | `false`: no damage, nothing rolled (Flutter) | a hit |
| `moves[].damageType` | a damage type or group | the hit's type: the enemy's Hit (+ flat Damage), × matchup and buffs, crit, × the hero's resistance to that type, the fraction rolls | Physical (the group: only a hero's Physical lines count) |
| `moves[].effectId` | a library effect id (a status too) | an effect the move lands | none |
| `moves[].target` | `self` or `hero` | on itself as the move is made (before the roll); on the hero with the hit that lands, or as a move that does not hit is made | `hero` |
| `moves[].lasts` | `attack`, `swing` or `fight` | `attack`: until the next attack on its bearer is over, hit or miss (on itself, the hero's next swing; on the hero, the enemy's next swing after this one); `swing`: this swing (on itself only: a heavy strike); `fight`. A status keeps its own lifetime | `fight` |
| `moves[].weight` | a number above 0 | how likely against the others (2 is twice as likely as 1) | 1 |

The owner's chicken, as the QA scene authors it: `[{ name: 'Peck', damageType: 'stab' }, { name: 'Scratch',
damageType: 'slash' }, { name: 'Flutter', hits: false, effectId: <Flutter: Provides Type Resistance % Physical 50>,
target: 'self', lasts: 'attack' }]`. The concept's Ice Elemental: Blizzard `ice`, Smash `crush` (or `physical`).

**The draw**: one random number a swing, first in the swing (before its On Swing rules), and only for an enemy
with two moves or more; one move or none draws nothing, so content without moves fights and draws exactly as
before. A move's effect always lands (no chance roll). Boss rules on the fight moments (every Nth swing, On Hit,
On Health Below) still run on every swing whatever the move; a move that does not hit counts as a swing, not a hit.

**The audit** (boot and CMS Economy Audit, Critical) names: moves that are not a list; a move that is not one; no
name; `hits` neither yes nor no; an unknown type; a move that neither hits nor lands an effect; an effect not in
the library; an unknown target or lifetime; an effect on the hero "for the swing" (over before it matters; a
status passes); a weight not above 0.

**Choices made in V3 the rulings did not spell out** (each small to change):

- **A move may hit and land an effect at once** (a Venom Bite: Poison, Venom on the hero with the bite), and
  an effect on itself may ride a hit (a Smash: Crush, Heavy Strike for the swing).
- **A weight per move** (1 when blank), so a boss's big move can be rare.
- **"For one attack" is a new lifetime, for moves only** (the Rules line does not offer it): spent by a miss
  as surely as a hit; a hero who eats instead of swinging has not attacked, so it stays.
- **A move's type may be a group** (Physical, Elemental, Special), read like the plain swing: only that
  group's lines resist it.
- **The moves show on the enemy card from the start**, like resistances (kinds still wait for a fight).
- **A move's hit is the enemy's Hit**: no per-move damage; a heavier move is an effect on itself for the swing.
