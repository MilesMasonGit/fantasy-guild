# Brief 280 — Combat v2: damage types, gear trade-offs, enemy moves

*Written 2026-10-28 by the planning agent from the owner's interview of the
same day and two analysts' reviews. Concept:
[concept_combat_v2.md](../concept_combat_v2.md) (read it whole). Absorbs brief
270's K2 (armour families) and K3 (Stealth). Amends the built combat of brief
220 (GDD §6).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_combat_v2.md](../concept_combat_v2.md),
[concept_classless_heroes.md](../concept_classless_heroes.md),
[concept_combat.md](../concept_combat.md) (what is being amended), GDD §6, §7,
§14. The GDD's §4 Equipment and §6 enemy tables are stale: trust `data/` and
the code.

Code to start from (verify): `src/utils/CombatFormulas.js`,
`src/config/FormulaRegistry.js`, `src/config/registries/weaponStyles.js`,
`enemyKinds.js`, `src/systems/combat/` (`CombatAttackProcessor.js`),
`src/systems/board/FightMoments.js`, `src/systems/hero/HeroEffects.js` (the
style gate on hand abilities), the status engine (Venom, Burn), the boss-move
machinery, the enemy card and combat screen (brief 220 C6), the CMS item,
token and effect editors, the content audit.

⚠️ **Order**: after brief 270 K1 (classless heroes) has merged.
⚠️ **Determinism**: every new random draw (the fraction sub-roll, the enemy's
move pick) runs in a fixed order so the catch-up replays live play exactly.

## Phases

| Phase | What | Tier |
|---|---|---|
| V1 | **Damage types.** A small registry of the nine types in three groups (Physical: Slash, Crush, Stab; Elemental: Fire, Ice, Electric; Special: Poison, Light, Dark), read by the game and the CMS. One type per weapon (CMS dropdown). **Arrows** as ammo: spent one per shot from the Bank, a shot = bow damage in the bow's type + arrow damage in the arrow's type. **Enemy resistances and weaknesses** in fixed steps (resist 25/50/100, weak 25/50), by type or group, a single-type line replacing its group's; shown on the enemy's info card. **The hit order**: damage × matchup (±25 %, unchanged) × buffs → crit → × type factor (never below 0) → the fraction sub-roll (1.1 = 1, or 2 one time in ten). **Retire** flat Armour, the "at least 1" floor, flat Resistance and Pierce (the Armoured kind becomes a Physical resistance step). Floating numbers and the fight log name the type ("Weak!", "Resisted"). Two Rules bonuses: Type Damage % and Type Resistance %, aimed at a type or group. | engineer |
| V2 | **Gear and defence.** Hero resistances from gear as percentages; each piece's **damage cut to named styles** (red in the tooltip); off-hand items only in the second hand (a shield acts like body armour; a weapon there lends nothing; closes the `HeroEffects` loophole). Content audit: no hero's best possible stack reaches 100 % in any type. The Poison status renamed **Venom**; **Sunder** as a stacking status lowering the target's resistances for the fight. | engineer |
| V3 | **Enemy moves.** Every enemy may list a few moves picked at random each swing, each with its own damage type or effect (owner's chicken: Peck Stab, Scratch Slash, Flutter +50 % Physical resistance for one attack); no moves = a plain Physical hit. Grows the boss-move machinery to all enemies. The combat screen names the move. | engineer |
| V4 | **Style characters.** Melee: engages the next enemy at once after a kill. Stealth: the sneak strike (first hit always crits, harder), high crit chance and big crits, low steady damage. Magic: lower base damage (content numbers). Optional supplies spent by a weapon's rule: **Motes** (some magic weapons), **Throwing Daggers** (stealth). Ranged's arrows already from V1. | engineer |
| V5 | **Content and clean-up.** An agent-written CMS change pack for the owner to review: types on the 12 shipped weapons and resistances and moves on the 18 enemies (the analyst's starter table in the concept), a first arrow line, sample armour with resistances and penalties, a shield. GDD §4, §6, the glossary; `concept_combat.md` marked amended. | builder |

## Done when

- Gate green per phase. The engine bench **will change work** in V1–V4:
  explained per scenario and accepted by the director (`brief280-V1` and so
  on); catch-up identity and fidelity hold.
- In the running game: a Fire wand against a Fire Elemental shows
  "Resisted" and 0 or tiny hits, and an Ice wand shows "Weak!"; a bow with
  Stab arrows spends arrows and shows two types per hit; a mage in an iron
  chestplate deals visibly less than in nothing; a chicken's Peck and Scratch
  appear by name; an Ice-resist hero shrugs off Blizzard but not Smash; a
  dagger hero's first hit is a big crit.
- Eye-checks: V1; V2 with V3; V4; the content pack on the CMS.
- `bench:draw --compare` per eye-check: the combat screen and floats cost no
  more.

## Owner CMS to-do

- After V5: review the content pack; then types, resistances, moves and gear
  trade-offs for new content as you author it.
- Names for Motes and Throwing Daggers' recipes, and the first arrow, shield
  and armour pieces with resistances.
- Whether Dodge stays as a gear stat (decide with the gear pack).
