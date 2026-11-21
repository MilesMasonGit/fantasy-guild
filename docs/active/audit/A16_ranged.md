# A16: Ranged
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Ranged is the style of a hero holding a bow. Each shot is two parts added
together: the bow's damage in the bow's type (both bows are Electric), plus
an arrow's damage in the arrow's type (Stab), spent from the Bank one per shot,
hit or miss. So a Ranged shot carries two damage types at once, and an enemy
immune to one still takes the other. With arrows, a bow out-damages a sword
of the same metal; that is the price of ammo. But **no player can get an
arrow today**: the two arrows exist as items, and nothing makes, drops or
sells them, so in a real game a bow always shoots its own part alone.

## What the player sees and does

- **Equip a bow** (Copper Bow, damage 2; Iron Bow, damage 3; both normal
  speed, Electric, +5 and +10 accuracy) and **carry arrows in a consumable
  cell**, like bait. The first carried arrow the Bank holds is shot.
- **The arrows**: Copper Arrow (1 Stab) and Iron Bodkin Arrow (1 Stab, lands
  Sunder on a hit). Their tooltip: "Arrow: +1 Stab a shot, from a bow".
- **The fight window** shows the next arrow, its part and how many the Bank
  holds; with none, a tooltip line says the bow shoots alone. Nothing else
  says so: no bubble, no log line.
- **Bows are made by Smithing** (Copper Bow at level 4, Iron Bow at 23).

| With arrows | Damage a shot | A second (3 s) | Like-for-like melee |
|---|---|---|---|
| Copper Bow + Copper Arrow | 2 Electric + 1 Stab | 1.00 | Copper Sword 0.67 |
| Iron Bow + Copper Arrow | 3 Electric + 1 Stab | 1.33 | Iron Sword 1.00 |
| Bow alone (today) | 2 or 3 Electric | 0.67 or 1.00 | the same as a sword |

## What really happens underneath

- **One roll for the whole shot**: one miss roll, one crit (doubling both
  parts). Damage %, the matchup and gear cuts apply to both parts; each part
  then meets the enemy's resistance to its own type. The two are summed and
  the fraction rolled once.
- **The level step and flat Damage go to the bow part only**, never the arrow.
- **The arrow is spent before the miss roll**: a miss still costs one.
- **Preservation can save an arrow** (a chance per shot, read from the
  fight's place, the Hall and the hero), but no content gives any.
- **An arrow's own rules count only on the shot that spends it** (the
  Bodkin's Sunder), and only if the enemy survives the hit, so it helps from
  the next shot on.
- **Running out is silent**: the bow shoots alone. Your ruling (2026-11-20,
  the silent-moments topic): no bow without arrows, the hero stops with a
  speech bubble. Not built; the code still calls it "not yet made".
- **The fight log never names the arrow**; the time-away summary counts food,
  elixirs and drops in a fight, not arrows.
- **Ranged meets one Ranged enemy** (the Wind Elemental) and is strong against
  the eleven Melee ones (T-567 spreads them).
- **Fletching** is still a placeholder skill whose text promises "arrows, bows
  and hunting gear"; Smithing makes the bows.
- **Oddities**: both bows wear the arrow picture and are marked stackable;
  arrows are typed "material" while the game treats them as consumables; the
  Ranged default type (Stab) never applies, as both bows name Electric; the
  GDD mentions a quiver off-hand item that doesn't exist.

## What the owner controls in the CMS

Per bow: as any weapon (style, damage, speed, type, effects). Per arrow: the
Arrow tick box, its damage and type, its rules. Preservation rules can aim at
ammo. Not in the CMS: one arrow per shot, the grid-order pick, the arrow part
without the level step, the default arrow type (Stab), the bow-alone shot.

## What it touches, and where it overlaps another system

- **Fishing** (A8): bait works the same way (a consumable cell, one per
  catch); your ruling there is no fishing without bait, here no shooting
  without arrows. The two should stop alike.
- **The hit** (A31, done): two-part shots, types without groups (T-532).
- **Melee** (A15, done): the identity doc, weapon traits (T-565), levels by
  metal (T-566), enemy styles (T-567).
- **Effects** (ready to brief): Preservation, Sunder.
- **Telling the player** (ready to brief): the silent moments topic.
- **The combat screen** (A35, done): the log; time away.

## Where it differs from the GDD

- GDD: "with none left the bow shoots its own part alone (owner)": your
  newer ruling says no shot.
- GDD's off-hand quiver: none exists.
- GDD gives Ranged Special damage via the bow: both bows are Electric.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give a hero a Copper Bow, 20 Copper
   Arrows and 5 Iron Bodkin Arrows, and food; place a Goblin Camp and a Crab.
2. **Carry the Copper Arrows** in a consumable cell; fight a Goblin. Watch
   the fight window's arrow line and the Bank count fall, misses too.
3. **Hover the arrow** in the Bank: "+1 Stab a shot, from a bow".
4. **Swap to the Bodkin** and fight the Crab: Sunder from the second shot on.
5. **Let the arrows run out**: the bow keeps shooting alone, with no word.
6. Ask yourself: what is Ranged for, beside Melee's steady self-sufficiency?
   Two types a shot? Hard hits paid for in arrows? Something else?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **Identity**: hits harder, paid in arrows; arrows change the shot; two
  damage types a shot.
- **Who makes arrows**: Fletching, now. An approved plan already exists
  (content_fletching.md, 2026-11-04), so it is built rather than redesigned.
- **Out of arrows**: the hero leaves the fight and says so; with a bow and no
  arrows no fight starts.
- **A miss**: "Spent hit or miss, but we will need upgrades and effects that
  will give ammo preservation, allowing the stack to last longer."
- **Saving arrows**: "Other gear or trinkets may have this, such as a piece of
  ranger armor or a ring." Ranged perks and Hall stars too; no quiver.
- **Bow type**: "Bows primarily add Stab damage, though a few special ones may
  have elemental damage on the bow as well."
- Leftovers filed without asking.

## What it became

- **T-572** (content agent; planning agent: open links): build the Fletching plan, so arrows exist; bows mostly Stab.
- **T-573** (director): no shot without arrows; the hero leaves the fight and says so.
- **T-574** (content agent): ways to save arrows (gear, trinkets, perks, a Hall star).
- **T-575** (director; content agent: data): Ranged leftovers.
- **T-576** (planning agent): GDD on Ranged.
- concept_combat_styles.md: Ranged's section filled.
- Fine as is: one roll for the whole shot; the arrow part gets no level step; an arrow spent hit or miss; the Bodkin's Sunder from the next shot on.

All five tickets blocked on the Combat group.

## Evidence

- Shot order, arrow spent before the miss roll → `src/systems/combat/CombatAttackProcessor.js:94-110`
- Two parts, one multiplier, per-part resistance → `src/systems/combat/CombatFormulas.js:344-348, 359-382`; fraction once → `:411-413`
- Arrow pick, one per shot, Preservation, bow alone, "not yet made" → `src/systems/combat/Arrows.js:14-62`; Preservation read → `src/systems/board/CycleSavings.js:23-26, 66-69`
- Arrows and bows in data → `data/items.json:1497-1518, 2289-2310, 2728-2774`; no recipe, drop or shop for arrows → `data/` at the tag (ids only in items.json); bows by Smithing → `data/tokenRecipes.json:511-528, 915-933`
- Fight window arrow line, tooltip → `src/ui/components/combat/fightView.js:94-102, 239-267`, `src/i18n/en.json:150, 482`, `src/ui/components/drawer/ItemTip.jsx:83-93`
- Log ignores the arrow; time away → `CombatAttackProcessor.js:117, 128`, `src/systems/core/CatchUp.js:44, 269-321`
- Arrow rules only on its shot → `src/systems/board/FightMoments.js:84-92`, `src/systems/hero/HeroEffects.js:57`
- Ranged default Stab, arrow default Stab → `src/config/registries/damageTypes.js:62-73`
- Fletching placeholder → `src/config/registries/skillRegistry.js:128-129`, `en.json:705`
- CMS arrow fields → `cms/src/components/editors/ItemEditor.jsx:164-210, 313`
- GDD → `docs/reference/GDD.md:742-745, 781-784, 1226-1230, 1245-1253`
