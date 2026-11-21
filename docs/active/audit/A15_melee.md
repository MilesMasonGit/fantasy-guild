# A15: Melee
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Melee is the style of a hero holding a sword, cleaver or greatsword, or
nothing at all: a bare fist is a Melee punch (1 damage, every 3 s, Crush). It
is the best-stocked style: seven of the game's thirteen weapons, the only
two-handed weapons, and the only style that wears metal armour at no cost.
Its level matters only while a melee weapon is in hand: it adds 1 damage per
20 levels and moves the miss chance against the enemy's level. On the matchup
cycle Melee beats Ranged and loses to Stealth. Beyond that, nothing in the
game is Melee's own: no weapon rule, perk, star or effect aims at it yet.

## What the player sees and does

- **Picks a style by the weapon in hand**: put a sword in a hero's hands and
  they fight and train Melee; take it away and they punch, still Melee.
- **The weapons** (none asks a level):

  | Weapon | Damage | Speed | Type | Damage a second | Note |
  |---|---|---|---|---|---|
  | Copper Sword | 2 | normal (3 s) | Slash | 0.67 | |
  | Copper Cleaver | 2 | slow (4 s) | Slash | 0.50 | Double Raw Beef +10 |
  | Copper Greatsword | 3 | slow | Crush | 0.75 | two hands |
  | Iron Sword | 3 | normal | Slash | 1.00 | |
  | Iron Cleaver | 3 | slow | Slash | 0.75 | Double Raw Beef +10 ×2 |
  | Iron Greatsword | 4 | slow | Crush | 1.00 | two hands |
  | Rusty Sword | 2 | normal | Slash | 0.67 | always breaks (break chance 1) |

  The other styles have two weapons each, copper and iron: daggers (fast,
  Stab, +5 crit), bows (Electric, +5 accuracy), wands (fast, Fire and Ice).
  Per second, every iron weapon lands at 1.00 except the cleaver.
- **A greatsword takes both hands**, so no shield. The Iron Greatsword hits no
  harder per second than the Iron Sword; it trades the shield for Crush.
- **The hero sheet** says Melee "Fights up close with blades, axes and
  hammers, or barehanded. Strong against Ranged, weak against Stealth."
- **Kills train Melee** with the whole kill's XP.

## What really happens underneath

- **The first weapon in the hands decides the style**; a weapon naming no
  style is Melee; a shield never decides it.
- **The level used is the style's, live**: a hero with Melee 50 who picks up a
  bow fights at their Ranged level. Health comes from the best of the four.
- **Two defaults disagree**: a fist hits as Crush, a melee weapon with no type
  as Slash.
- **Metal armour is free for Melee and Ranged only**: every helmet,
  chestplate and the shield cuts Magic damage (leather too) and most cut
  Stealth; a full iron set with the shield costs Magic 60% and Stealth 35%.
  No item cuts Melee or Ranged.
- **The enemies are mostly Melee**: 11 of 19, Stealth 4, Magic 3, Ranged 1. A
  Melee hero is even against most enemies, strong against one (the Wind
  Elemental), and weak against four. A Ranged hero is strong against eleven.
- **The machinery to aim at Melee exists, unused**: a rule can be narrowed to
  one combat style ("only for Melee fighters") for Damage, Accuracy and Swing
  Time, and Hall stars can have a Melee constellation; no effect, star or perk
  is authored. Perk tables for the combat skills are already planned (T-522).
- **Level requirements exist, unused**: a weapon may ask a Melee level
  (the GDD's example, "Iron Sword: Melee 15"); no weapon has one, so an Iron
  Sword works at level 1.
- **A weapon tier table** (copper to darkmetal, damage by speed) sits in the
  code as a proposal the game never reads; both cleavers fall one under it.
- **Words that promise more**: "axes and hammers" (none exist; the axes are
  woodcutting tools). The other styles' texts promise crossbows, thrown
  weapons, staves, tomes, cloaks and poisons. Two fight-window texts say a
  hero can fight "with no style", which can't happen. The Battlefield sits
  in the Shop's Melee section with Melee, Ranged and Magic icons, not Stealth.
  Stealth has no skill picture.

## What the owner controls in the CMS

Per weapon: style (one of four), damage type (blank means the style's
default), damage, tier, speed (fast, normal, slow), one or two hands, weapon
or off-hand, level requirement, effects, resistances, damage cuts. Not in the
CMS: the fist (1, normal, Crush), barehanded meaning Melee, each style's
default type, the swing times, the matchup cycle and its 25%, the 20-level
damage step, the miss formula, an enemy's default style (Melee).

## What it touches, and where it overlaps another system

- **The hit** (A31, done): damage, miss, crit, types; Attack Speed (T-536).
- **Equipment** (A29, done): hands, off-hand, level requirements, the tool
  axes.
- **Milestone perks** (A27, done): combat perk tables (T-522).
- **The Guild Hall** (A37, done): combat constellations.
- **Ranged, Magic, Stealth** (A16 to A18, next): the same questions for each;
  what this session decides about a style's identity should hold for all four.
- **Smithing**: where the weapons and armour come from.

## Where it differs from the GDD

- GDD's level example ("Iron Sword: Melee 15"): no weapon asks a level.
- GDD's combat stars per style: the machinery is built, no constellation is
  authored (unfinished content, not a fault).
- The skill texts promise weapons that don't exist.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give one hero a Copper Sword, a Copper
   Greatsword, a Copper Cleaver and a Copper Shield; place a Goblin Camp, a
   Crab and a Cow Pasture.
2. **Fight a Goblin barehanded**, then with the sword: note the hits (1, then
   2) and the speed.
3. **Equip the greatsword with the shield in hand**: the shield comes off.
4. **Fight the Crab with the sword, then the greatsword**: Resisted vs Weak!.
5. **Fight Cows with the cleaver**: more Raw Beef.
6. **Open the hero sheet** and read Melee's text.
7. Ask yourself: what should make Melee feel like Melee, beyond "the default"?
   Tough and armoured? Many weapon kinds? Something the other styles can't do?

## Owner feedback (date)

## What it became

## Evidence

- Style from the first weapon, fist is Melee → `src/systems/combat/CombatFormulas.js:51-68`, `src/config/registries/weaponStyles.js:22-29, 38-54`
- Fist 1, normal, Crush → `src/config/FormulaRegistry.js:35, 42-44`, `CombatFormulas.js:129-131, 260-267`, `src/config/registries/damageTypes.js:62-74, 87-90`
- Level used is the current style's → `CombatFormulas.js:70-84`; best of four for health → `:93-100`; damage step → `FormulaRegistry.js:28-32`
- Weapons → `data/items.json` at the tag (styles, damage, speed, damageType, hands, breakChance); Cleaver effect → `data/effects.json:580-605`
- Level requirement read, none authored → `weaponStyles.js:64-73`; GDD example → `docs/reference/GDD.md:798-801`
- Damage cuts → `src/config/registries/gearDefence.js:19-21, 63-72`, `CombatFormulas.js:311-319`; values → `data/items.json` (`damageCut`)
- Two hands → `src/config/registries/toolKinds.js:121-125`, `src/systems/equipment/EquipmentManager.js:55-69`
- Enemy styles, default Melee → `data/tokens.json` (`style`), `src/config/registries/enemyProfile.js:139`
- Style-narrowed rules → `src/config/registries/modifierPalette.js:590, 611, 707`; no combat stars or perks → `data/hallStars.json`, `data/skillPerks.json`
- Tier table unread → `FormulaRegistry.js:150-166`
- Skill texts → `src/config/registries/skillRegistry.js:100-126`, `src/i18n/en.json:692-695`; "no style" texts → `en.json:465-466`, `src/ui/components/combat/FightPanel.jsx:273`; Battlefield shop → `data/tokens.json` (`token_battlefield.shop`)
- CMS weapon fields → `cms/src/components/editors/ItemEditor.jsx:65-153, 459-482`, `cms/src/components/editors/GearLevelField.jsx:18-33`
