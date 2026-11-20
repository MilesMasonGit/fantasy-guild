# A28: Health, food and defeat
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A hero's health is 10 plus their best combat level (11 for a new hero, 109 at
99). Out of a fight they heal 1 point every 10 seconds; in a fight only food
heals. Below a quarter of their health a hero eats the food in their loadout
from the Bank, one at a time. Drinks never heal (owner ruling 2026-10-24);
they are work buffs. At 0 health the hero is knocked out: the job ends, they
limp home, lose a quarter of the Bank's stack of each food and drink they
carry, have a 10% chance per gear piece to lose it, and are wounded for 5
minutes, coming back at half health. Most of these numbers are placeholders
in code, not in the CMS.

## What the player sees and does

- **Health bar** on the hero bar and the hero; a whole number.
- **Eating**: below 25% the hero eats; a small "used" bubble shows "+5 ♥". In
  a fight a meal costs that swing; out of a fight at most one meal a second.
- **Knocked out**: the "knockout" banner names the hero and what was lost;
  after time away the summary says "Knocked out" with a count and the losses.
  Nothing warns of the losses beforehand.
- **Wounded**: the hero limps home; the hero bar shows a red alert, "hurt",
  and "Healing 4:12"; ordering them says "Ana is healing: 0:42" and is
  refused.
- **Recovered**: nothing at all (the silent moments topic, T-497, adds
  "Recovered, ready to work!").
- **The Infirmary star** (three ranks, Wound Time −10% and up) shortens
  wounds.

## What really happens underneath

- **A level adds headroom, not a heal**: max health rises, current health
  stays.
- **Regen runs for every idle hero, which includes working and walking ones**
  (the "working" state is never set), in every Region and during time away.
  It stops in a fight and while wounded. Nothing can speed it: an effect type
  for it exists (`HP_REGEN`) but nothing reads it.
- **Wound time is read once, when the wound starts**: an Infirmary rank
  bought mid-wound only helps the next one. Wounds count game time, in every
  Region and during time away.
- **Food Healing** (Burning: −50%) changes only a meal eaten **in a fight**;
  the same meal out of a fight heals in full even while still Burning.
- **Rounding goes several ways**: a fight meal under Food Healing rounds
  halves up; coming back from a wound rounds down; the Heals rule and rule
  damage (poison) round to nearest; enemy and hero hits round by chance. In
  practice health stays whole.
- **Healing besides food and regen**: only the Heals rule, used today by one
  enemy (the Water Elemental heals itself). No potion, building, perk or star
  heals a hero.
- **Knockouts are counted twice** in time away (two tallies of one event).
- **Enemies' health works differently**: it lives on the fight, never
  regenerates, and an enemy is back to full if the hero leaves the Region and
  returns.
- **Villagers** keep flat health in the code, but the game never makes one.

## What the owner controls in the CMS

Each food's heal amount (25 foods: Redberry 2 to Steak 35, most 5); the
Infirmary star's ranks; the Food Healing rule on an effect (Burning). Not in
the CMS: max health's formula, regen (1 per 10 s), the 25% eating line, the
one-meal-a-second gap, the 5-minute wound, coming back at 50%, the defeat
losses (25% food and drink, 10% per gear piece), enemy health.

Leftover data: six drinks still carry a heal amount (Water 1, Apple Juice 20,
Lemonade 25, Limeade 30, Beer 15, Grape Juice 20); the CMS hides it on drinks
but **offers it on consumables** ("Flat HP restored when consumed", filled in
as 5 by default), so the **Shrimp Trawler Potion's tooltip says "Restores 5
HP"**, which never happens. `regen` and `restoreType` on three items are read
by nothing.

## What it touches, and where it overlaps another system

- **Effects** (S0): Wound Time from stars, Food Healing from statuses; the
  durations (drinks 10 cycles, elixirs 10 fights) sit in A29's loadout.
- **Combat** (group 2): enemy blows, poison, Heals, enemy health.
- **Equipment** (A29): the defeat gear loss; food and drink slots.
- **Telling the player** (done): recovery speaks (T-497); time words (T-488);
  Wound Time renamed Recovery (T-494).
- **Time away** (A41): regen, wounds and eating all run during time away.

## Where it differs from the GDD

- GDD says "the item tooltip and the CMS no longer offer" a drink's heal; the
  CMS still offers it on consumables, and the potion's tooltip promises it.
- GDD says regen runs "while idle or working"; it also runs while walking,
  because a working hero is "idle" to the code.
- GDD doesn't say Food Healing is ignored out of a fight, name the Infirmary,
  or say recovery is silent.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: give yourself Shrimp, Lemonade, the
   Shrimp Trawler Potion if listed, and place a strong enemy near the Hall.
2. **Equip Shrimp and Lemonade on a hero, send them at the enemy.** Below a
   quarter health they eat Shrimp ("+5 ♥"); the Lemonade is never drunk for
   health.
3. **Hover the Shrimp Trawler Potion in the Bank**: it says "Restores 5 HP".
4. **Let the hero lose.** The knockout banner: what was lost (Shrimp stack
   down a quarter, maybe a gear piece). Did anything warn you beforehand?
5. **Watch the wounded hero**: limping home, red alert, "Healing 4:59";
   try to send them to work: refused.
6. **Wait out the wound** (5 minutes): they come back at half health, with
   no message.
7. **Watch a working hero's health** after a scratch: it climbs 1 every 10
   seconds while they work.

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **Healing out of fights**: boostable, a Regen effect like Speed and Recovery.
- **Infirmary bought mid-wound**: shortens the wound at once.
- **Knockout losses**: "Knockout losses should be explained by Limes before
  the first combat encounter."
- **Health numbers**: on the CMS tuning page (T-253).
- **Potions**: "Only food heals. Drinks are meant to be consumables that give
  buffs. Shrimp Trawler Potion is meant to buff Raw Shrimp production."
- **Burning and food**: Food Healing on every meal while the status lasts.
- **Enemies back to full health**: parked for the Combat group (A31).

## What it became

- **T-525** (director; content agent's change pack): only food heals, and only food says so.
- **T-526** (content agent): the Shrimp Trawler Potion buffs Raw Shrimp.
- **T-527** (director): a Regen effect.
- **T-528** (director): Recovery shortens running wounds.
- **T-529** (director): Food Healing on every meal while it lasts.
- **T-530** (planning agent, then director): Limes explains knockout losses before the first fight.
- **T-531** (director): health leftovers (knockouts tallied twice, dead villager and working paths).
- T-253 now lists the health numbers; T-521 now fixes GDD §4 Health too.
- A31 The hit: enemy health on return, in its STATUS row.
- Fine as is: drinks never heal (ruled 2026-10-24).

All seven tickets blocked on the Effects group, now ready to brief.

## Evidence

- Max health 10 + best combat level → `src/config/FormulaRegistry.js:22-26`, `src/systems/combat/CombatFormulas.js:106`; level keeps current → `src/systems/hero/logic/HeroRehydration.js:99-105`
- Regen 1 per 10 s → `FormulaRegistry.js:185-187`, `src/systems/hero/RegenSystem.js:36-43`; idle or working only → `RegenSystem.js:54`; out-of-fight eating → `:66-70`; `HP_REGEN` unread → `src/systems/effects/constants.js:50`
- Eating line, one at a time, meal gap → `src/config/loopConstants.js:54, 61`, `src/systems/hero/ConsumptionSystem.js:38-41, 106-111`
- Food Healing only in a fight, halves up → `ConsumptionSystem.js:55-62, 84-85`
- Wound 5 min, read at start, back at 50% floored, recovery published unheard → `src/systems/combat/WoundedSystem.js:16-26, 83-94`; Infirmary → `data/hallStars.json:2268-2271`
- Wounded shown and refused → `src/systems/board/flagText.js:57-71, 156, 192`, `Orders.js:68-69`, `Flags.js:236-240`
- Defeat sequence → `src/systems/board/BoardCombat.js:555-585`, `Flags.js:790-801`; losses → `src/systems/combat/DefeatPenalties.js:33-51`, `loopConstants.js:87-91`; banner → `src/systems/notifications/routing.js:134-141`; summary → `catchUpNews.js:61-70`; counted twice → `src/systems/core/CatchUp.js:298-300`
- Rounding → `ConsumptionSystem.js:61`, `WoundedSystem.js:85`, `src/systems/board/EffectActions.js:113`, `src/systems/board/DealDamage.js:82, 101`, `CombatFormulas.js:411-420`
- Heals used once (Water Elemental) → `data/effects.json:1820-1840`
- Enemy health on the fight, back to full → `BoardCombat.js:154, 616-621`, `FormulaRegistry.js:144`
- Drinks' heal hidden, consumables offered → `cms/src/components/editors/ItemEditor.jsx:22, 307, 518-529`; tooltip promise → `src/ui/components/drawer/ItemTip.jsx:99, 164-165`
- Villagers never made → `HeroRehydration.js:95, 100` (only tests set `isVillager`)
