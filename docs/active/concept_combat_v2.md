Status: draft

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
- **Order of a hit** (analyst; routine): weapon damage × style matchup × buffs
  → crit → minus armour (at least 1) → × the type factor (1 + boosts −
  resistances, never below 0) → the fraction sub-roll. Resistance comes after
  the armour floor so a resisted fast weapon really does less, and immunity
  means 0.

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

## Gear

- **Off hand: off-hand items only** (owner): shields, quivers, focus orbs and
  the like, each lending its bonus. A weapon in the second hand lends nothing.
  A two-handed weapon takes both hands.
- **Armour families defend differently and mix freely** (owner): e.g. metal
  Armour, leather Dodge, cloth resistance to statuses, dark cloth Dodge and
  crit (placeholders). Each piece counts on its own; an off-style piece
  carries its family's penalty. Armour may also carry damage-type bonuses and
  resistances (the cloak example above).

## Fleeing (owner)

- **Dragging a hero somewhere else ends their fight**, as it ends any job
  (hero orders). No special rule; it is what makes a watched stealth boss
  fight safe to try.

## Amends

- [concept_classless_heroes.md](concept_classless_heroes.md): "Stealth plays its
  own way" becomes the character above, without "unseen at work"; "Armour
  families" becomes "defend differently, mix freely". Brief 270's K2 and K3
  wait for this concept.
- [concept_combat.md](concept_combat.md): "styles have no traits of their own",
  "weapon traits are a later idea", the rounding rule, the fixed damage, and
  "the first weapon in the hands is swung".
- GDD §4 Equipment and §6 are partly stale already (12 weapons and armour
  ship; 18 enemies across all four styles): fix with the clean-up.

## Next steps

1. ~~Damage-type analysis and interview~~ done 2026-10-28.
2. Owner approval; one brief, after brief 270 K1.
