# A17: Magic
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Magic is the style of a hero holding a wand. Today that is all it is: two
fast wands from the Smithy (Copper Wand, Fire; Iron Wand, Ice) that hit like
any weapon, in an element. There are no spells, staves, tomes, focus orbs,
runes or magic resource in the code, no wand carries a rule, nothing boosts
an element, and every armour piece in the game cuts Magic damage. Your
direction (Magic specialised through many items, using weaknesses and
elements) is already planned in two approved content roadmaps, Enchanting
(wands, staffs, tomes, Leylines and Motes) and Tailor (mage clothing), none of
it built.

## What the player sees and does

- **Equip a wand**: Copper Wand (1 damage, fast 2 s, Fire), Iron Wand (2,
  fast, Ice). Both made by Smithing (level 4 and 23), copper or iron with a
  wood.
- **Damage a second**: Copper Wand 0.50 (Copper Sword 0.67), Iron Wand 1.00
  (Iron Sword 1.00). Fast weapons gain most from the level step: at level 20
  the Copper Wand matches the Copper Sword.
- **Armour hurts a mage**: every helmet, chestplate and the shield cuts Magic
  damage, leather too. An Iron Wand at 1.00 a second falls to 0.85 in leather,
  0.65 in copper, 0.40 in iron with a shield. No robe or cloth exists, so the
  best mage outfit is none.
- **Elements against enemies** (19 enemies):

  | Element | Weak to it | Resists it |
  |---|---|---|
  | Fire (Copper Wand) | Thorn Elemental, Bee, Queen Bee, Greater Slime | Water Elemental, Sulphur Lizard, Big Lizard (50); Fire Elemental and its Chief (immune) |
  | Ice (Iron Wand) | Fire Elemental and its Chief, Sulphur Lizard, Big Lizard | none |
  | Electric (bows only) | Crab, Water Elemental, Frog, Toxic Frog | none |

  So a wand finds a weakness about one fight in five, and the Iron Wand is
  never resisted. No wand hits Electric.
- **The hero sheet** says Magic "Fights with staves, wands and tomes".

## What really happens underneath

- **No Magic code of its own**: the hit is the same as every style's. Words
  about focus orbs, scrolls and runes appear only in code comments.
- **The element comes from the weapon**: the GDD's rule is that a type comes
  from a weapon's family, never its tier ("Ember Wand"); the two wands differ
  by tier under metal names.
- **Element boosts are ready, unused**: the engine reads Type Damage (+% to
  one element) and rules narrowed to Magic, but no item, effect or star
  carries one.
- **No wand carries a rule**, while the dagger, bow and cleaver do (T-565
  gives every weapon kind one).
- **The world's Arcane category** names Magic (the Wishing Well, the Quartz
  Deposit); whether that does anything wasn't confirmed.

## The planned Magic (approved roadmaps, not built)

- **Enchanting** ([content_enchanting.md](../content_enchanting.md), approved
  2026-11-04): tiered wands and Fire, Ice and Electric staffs (levels 1 to
  80); "Wands can have their elemental damage modified by Tomes held in the
  off hand. Sort of like Bow/Arrows, but easier to mix and match." Leylines
  give Motes (Fire, water, wind, nature, light, dark), possibly magic ammo;
  reaching a kind of Leyline unlocks that magic. The Smithy's wands retire.
  The off-hand Tome setting a wand's element is a new mechanism: today only
  weapons and arrows give a hit its type.
- **Tailor** ([content_tailor.md](../content_tailor.md), approved
  2026-11-04): Magic hat, robe, slippers, gloves and cloak per tier.
- Enchanting and Tailor are both placeholder or new skills today.

## What the owner controls in the CMS

Per wand: as any weapon (style, damage, speed, type, rules). Per armour: its
Magic cut. Effects: Type Damage, rules narrowed to Magic. Not in the CMS: the
fast speed (2 s), the matchup, Fire as the default Magic type.

## What it touches, and where it overlaps another system

- **Ranged** (A16): arrows and bows are the model for tomes and wands.
- **Melee** (A15): the identity doc, weapon traits (T-565), levels by metal
  (T-566), enemy styles (T-567).
- **The hit** (A31, done): types, boosts after resistance (T-533).
- **Equipment** (A29, done): off-hand items, armour cuts.
- **Enchanting** (A22) and the Tailor roadmap: where Magic's items come from.

## Where it differs from the GDD

- GDD's focus orb off-hand item: none exists.
- GDD: a type comes from the family, never the tier; the two wands differ by
  tier.
- GDD lists ranged and magic enemies as latent; three Magic enemies ship.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give a hero a Copper Wand, an Iron Wand,
   an Iron Helmet and food; place a Bee, a Fire Elemental and a Goblin Camp.
2. **Fight a Goblin with the Copper Wand**, no armour: fast small hits.
3. **Put the Iron Helmet on** and fight again: smaller hits.
4. **Copper Wand on the Bee**: Weak!. **Copper Wand on the Fire Elemental**:
   nothing gets through. **Iron Wand on the Fire Elemental**: Weak!.
5. Ask yourself: with the Enchanting and Tailor plans in mind, what should
   Magic need, and what should a mage's kit look like?

## Owner feedback (2026-11-20)

Interviewed in three rounds without playing first.

- **Identity**: pick the element for the enemy; a kit to collect. Glass
  cannon at first, then: "On second thought, I want the glass cannon feel to
  be more for the Stealth style."
- **Motes**: "Motes are for crafting and casting." Every cast spends one; the
  weapon names which.
- **Weapon kinds**: "I think there's just going to be different types of
  magic weapons. Tomes, Staffs, Wands, etc. These are the variants that are
  the equivalent of Swords, Axes, Maces for warriors." So tomes are weapons,
  not off-hand items changing a wand's element (the Enchanting plan is
  amended).
- **Out of Motes**: casts weakly, half damage in its element.
- **Armour**: metal cuts Magic, leather and cloth don't.
- **The plans**: build Enchanting and Tailor now.

## What it became

- **T-577** (content agent; planning agent amends the plan): build Enchanting: wands, staffs and tomes, Leylines and Motes.
- **T-578** (content agent): build Tailor: mage clothing.
- **T-579** (director; content agent): every cast spends a Mote; half damage without.
- **T-580** (content agent): leather stops cutting Magic.
- **T-581** (director): Magic leftovers.
- **T-582** (planning agent): GDD on Magic, and the Enchanting plan amended.
- T-253 now lists the half-damage cast.
- concept_combat_styles.md: Magic's section filled; glass cannon moved to Stealth.

All six tickets blocked on the Combat group.

## Evidence

- No Magic-only code → `src/systems/combat/CombatFormulas.js:376-382`; mentions only in comments → `src/config/registries/weaponStyles.js:18`, `src/config/registries/equipmentCategories.js:22`
- Wands → `data/items.json` (Copper Wand, Iron Wand); recipes → `data/tokenRecipes.json` (Smithing 4 and 23)
- Speeds, level step → `src/config/FormulaRegistry.js:28-32, 40-44`
- Magic cuts on all armour → `data/items.json` (`damageCut`); applied → `CombatFormulas.js:311-319, 378`
- Enemy resistances → `data/tokens.json` (`resistances`); weakness as negative resistance → `CombatFormulas.js:321-324`
- Type Damage ready, no content → `CombatFormulas.js:272`; `data/effects.json`, `data/hallStars.json` at the tag
- Default Magic type Fire → `src/config/registries/damageTypes.js:62-67`
- Skill texts → `src/config/registries/skillRegistry.js:116-118`, `src/i18n/en.json:694`
- Arcane category → `src/config/registries/worldPlaceholder.js:57`, `data/world.json` (unconfirmed effect)
- GDD → `docs/reference/GDD.md:768-773, 783, 791, 816, 2081`
- Plans → `docs/active/content_enchanting.md:1-47`, `docs/active/content_tailor.md:1`
