# A18: Stealth
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Stealth is the style of a hero holding a dagger. Two fast Stab daggers from
the Smithy carry a crit bonus (Copper +5, Iron +10), so a Stealth hero crits
10 to 15% of the time against everyone else's 5%. That is all Stealth has: no
sneak strike, no poison, no bigger crits, no hero dodge gear. It plays as a
quick, lightly crit-flavoured fighter, about as steady as a sword over a
fight, and the Iron Dagger out-damages the Iron Sword. The "wild,
inconsistent glass cannon" you want isn't there yet. Your combat v2 table
(2026-10-28) described Stealth as burst damage with a sneak strike opener and
big crits; you dropped those mechanics on 2026-10-30 (V4).

## What the player sees and does

- **Equip a dagger**: Copper Dagger (1 damage, fast 2 s, Stab, +5 crit),
  Iron Dagger (2, fast, Stab, +10 crit). Smithing makes them (levels 2 and
  16, one ingot each). Both wear the longsword pictures (placeholder art).
- **Damage a second** with crits, before misses:

  | Weapon | Crit | A second | Against the sword |
  |---|---|---|---|
  | Copper Dagger | 10% | 0.55 | 79% (sword 0.70) |
  | Iron Dagger | 15% | 1.15 | 110% (sword 1.05) |

  At level 20 the Copper Dagger passes the Copper Sword (fast weapons gain
  most from the level step).
- **How swingy**: each dagger hit varies a little more than a sword's, but
  daggers hit half again as often, so over a fight they're about as steady.
- **Armour**: metal cuts Stealth damage (a full iron set with the shield, 35%);
  leather doesn't.
- **The hero sheet** says Stealth "Fights from the shadows with daggers"; the
  older text adds "cloaks and poisons". Stealth has no skill picture yet.

## What really happens underneath

- **No Stealth code of its own**: the matchup, Stab as its default type and
  the metal armour cut are all that name it.
- **Crits are fixed at double**: nothing can raise the crit multiplier; there
  is no Crit Damage effect. "Big crits" can't be authored today.
- **Crit chance has no cap**: at 100 every hit crits.
- **Guild Crit doesn't reach heroes** (T-512 fixes it).
- **Hero Dodge exists** (it makes enemies miss more, within the 5 to 40%
  limits), but no Stealth item carries it.
- **Poison and Dark**: the GDD gives Stealth both; no hero item deals either
  (only enemies hit with Poison).
- **Only the swung weapon lends its rules**, so two daggers don't add up.

## The planned Stealth (approved roadmaps, not built)

- **Smithing** ([content_smithing.md](../content_smithing.md), approved
  2026-11-04): Kunai as Stealth ammo (flagged as new), a Silver Dagger, a
  Bomb. It puts the Iron Dagger at level 22 (the recipe says 16).
- **Tailor** ([content_tailor.md](../content_tailor.md), approved, building
  now via T-578): Stealth hood, grips, soft boots, tunic and cloak per tier.
- **Alchemy** ([content_alchemy.md](../content_alchemy.md), approved): a
  Poison that coats a dagger (flagged as needing new machinery).
- **Crime** (a placeholder skill with crowbar and lockpick art) is not linked
  to Stealth.

## What the owner controls in the CMS

Per dagger: as any weapon. Effects: Crit Chance (flat, no limit), Dodge,
Accuracy and Damage (narrowable to Stealth). Not in the CMS: crit ×2, base
crit 5%, Stab as the default.

## What it touches, and where it overlaps another system

- **The hit** (A31, done): crit, miss, types.
- **The Guild Hall** (A37, done): guild Crit for heroes (T-512).
- **Melee, Ranged, Magic** (A15 to A17, done): the identity doc, weapon
  traits (T-565), levels by metal (T-566), enemy styles (T-567); Motes and
  arrows as the model for Kunai.
- **Tailor** (T-578), **Alchemy** and **Crime** (A23): Stealth's kit.

## Where it differs from the GDD

- GDD: "the Dagger: Provides 5 Crit Chance"; the Iron Dagger gives 10.
- GDD: Stealth hits Poison and Dark; it hits Stab only.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give one hero an Iron Dagger and another
   an Iron Sword, and food; place a Goblin Camp and a Cow Pasture.
2. **Fight Goblins with each** and watch the fight logs: how often Crit!
   shows, how fast the fights end.
3. **Fight a Cow with the dagger** (melee, which Stealth beats): bigger hits.
4. Ask yourself: what would make Stealth feel wild and glass-cannon? Bigger
   crits? An opening strike? Fragile defence? Poison? Kunai?

## Owner feedback (2026-11-20)

Interviewed in three rounds without playing first.

- **Identity**: big crits; low steady damage, high crit chance; fragile. The
  opening strike stays dropped.
- **Crit cap**: yes, on the tuning page.
- **Kunai**: a thrown weapon kind that spends itself; "Keeps one, fights with
  half damage, like Magic motes."
- **Poison**: "Optional consumable that can be used with stealth weapons.
  Works like a potion, providing a buff for a set of attacks if using a
  stealth weapon." Taken like an elixir; each poison says what it does.
- **Big crits**: a Crit Damage effect on gear.
- **Fragile**: its gear trades defence away.

## What it became

- **T-583** (director): a Crit Damage effect.
- **T-584** (director): crit chance has a ceiling.
- **T-585** (content agent): Stealth weapons, low steady and high crit.
- **T-586** (director; content agent): Kunai, a thrown weapon that spends itself.
- **T-587** (director; content agent): poisons for Stealth weapons.
- **T-588** (planning agent): GDD on Stealth; the Alchemy and Smithing plans amended.
- T-253 now lists the crit cap and the last Kunai's half; T-578 says Stealth clothes trade defence away.
- concept_combat_styles.md: Stealth's section filled; all four styles written.
- Fine as is: the opening strike stays dropped; placeholder dagger art.

All six tickets blocked on the Combat group, which is now ready to brief.

## Evidence

- Daggers, scale 1 and 2, longsword pictures → `data/items.json` (`item_copper_dagger`, `item_iron_dagger`); effect → `data/effects.json` (`effect_dagger`, Crit Chance 5, scales by value, `src/config/registries/modifierPalette.js:641-650`)
- Recipes → `data/tokenRecipes.json` (Smithing 2 and 16)
- Crit 5%, ×2 fixed → `src/config/FormulaRegistry.js:73-74`, `src/systems/combat/CombatFormulas.js:170-172, 362`; no cap → `CombatFormulas.js:225-228`, `modifierPalette.js:809-823`
- Hero Dodge → `modifierPalette.js:617-626`, `CombatFormulas.js:165, 237-238`; miss limits → `FormulaRegistry.js:64-67`
- Guild Crit not read → `CombatFormulas.js:133-152`
- Only the swung weapon lends rules → `src/systems/hero/HeroEffects.js:56`
- Stab default → `src/config/registries/damageTypes.js:66`; stealth cuts → `data/items.json` (`damageCut`)
- Skill texts, no sprite → `src/config/registries/skillRegistry.js:121-125`, `src/i18n/en.json:695`
- V4 dropped → `docs/active/concept_combat_v2.md:36, 172-177`
- Plans → `docs/active/content_smithing.md:11, 65-71, 85`, `docs/active/content_tailor.md:13-29`, `docs/active/content_alchemy.md:28, 52`
- GDD → `docs/reference/GDD.md:805, 1229, 1258`
