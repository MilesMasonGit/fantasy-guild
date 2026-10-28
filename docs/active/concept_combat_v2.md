Status: draft (damage types and their groups need their own analysis first)

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

## Damage types (owner)

- Each style reaches its own damage types: **Melee Slash / Crush / Stab;
  Stealth Stab / Poison / Shadow; Magic Fire / Ice / Electric**; Ranged
  combines an arrow's physical type with the bow's magical one.
- **Gear boosts types by percentages** ("Poisoner's Cloak: +15 % Poison
  damage"), and that is a loadout choice: the poisoner picks the Poisoner's
  Cloak over the Swashbuckler's Cuirass (+Slash).
- **Enemies have resistances and weaknesses as percentages, several each**
  ("Toad: Poison Resistance 50 %").
- **Groups** let one line cover similar types ("Ghost: 100 % resistance to
  Physical", covering Stab, Crush and Slash).
- ⚠️ **Open, needs its own analysis and interview** (owner): which types the
  game has, which groups, a design philosophy that gives each weapon the
  right types, and how resistances are taught to the player.

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

1. A read-only analysis of damage types and groups (list, groups, the
   philosophy for giving weapons and enemies types, a starter table for the
   shipped weapons and enemies), then an owner interview.
2. Approve this concept with the damage-type section filled in; one brief,
   after brief 270 K1.
