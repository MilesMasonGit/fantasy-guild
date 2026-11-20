# A27: Milestone perks
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Each skill may carry a table of perks at set levels. Every hero who reaches a
perk's level holds it and keeps it: there are no choices, and nothing is
saved, because the game reads a hero's perks off their levels whenever it
asks. A perk is a library effect, like an item's, and works as if the hero
carried it, free of any cost. Today nine perks exist, one per work skill,
all at level 10 and all small: 5 % faster, +10 % XP, +10 % Yield, or 5 %
Double Loot on that skill. The combat skills (Melee, Ranged, Magic, Stealth)
and the specialist skills have none yet, which is unfinished content.

## What the player sees and does

- **Reaching a perk**: the level-up number over the hero names the perk
  underneath in gold, and the hero bar adds an alert of its own, "Perk: Clean
  Felling", after the level alert.
- **The Hero drawer's skill panel** lists every perk of the skill, lowest
  level first: "10 Clean Felling: ×2 loot 5% (Forestry)". Held perks are gold,
  the rest dimmed. A skill with no perks says so.
- **On a Token's badge hover**, a perk is listed as one of the sources, named
  with the hero ("Ana's Clean Felling").
- Nothing to buy, pick or equip.

## What really happens underneath

- **Read off the levels, never stored**: a level-up, a load and a time-away
  catch-up all agree, and a perk cannot be given twice.
- **A perk works like a carried item's rule**: on the Token the hero works,
  in fights, on When-rules, with no cost.
- **Two perks naming one effect** (say Forestry 25 and 50 both Clean Felling)
  merge, their scales adding up to 5 times the base, as items do. A perk and
  an item naming the same effect both count in full, past that cap (T-516,
  filed in A29, drops both caps).
- **Every perk is written "nearby"**, which does nothing on a hero; it simply
  helps the hero's own work.
- **A perk's work rule should be narrowed to its skill**; the boot audit says
  when one is not (a Mining perk that speeds every skill). All nine are
  narrowed.
- The boot audit also names a perk on a skill that does not exist, at a level
  no hero reaches (perks sit at levels 2 to 99), or pointing at a deleted
  effect.

## What the owner controls in the CMS

The Skill Perks page: for each skill, rows of level, effect (from the effect
library) and scale (1 to 5). New tables start at levels 10, 25, 50, 75, 99,
movable to any level from 2 to 99. The effect itself (its rules, its wording)
is edited in the effect library.

Data today:

| Skill | Level | Perk | Does |
|---|---|---|---|
| Mining | 10 | Steady Pick | 5% faster Mining |
| Forestry | 10 | Clean Felling | Double Loot 5% on Forestry |
| Fishing | 10 | Patient Line | +10% XP Fishing |
| Smithing | 10 | Even Heat | +10% XP Smithing |
| Crafting | 10 | Nimble Fingers | 5% faster Crafting |
| Cooking | 10 | Second Helping | Double Loot 5% on Cooking |
| Farming | 10 | Green Thumb | +10% Yield Farming |
| Alchemy | 10 | Steady Hand | +10% XP Alchemy |
| Construction | 10 | Quick Builder | 5% faster Construction |

## What it touches, and where it overlaps another system

- **Effects** (S0): a perk is one more source summed with gear, stars and
  buildings, under the stacking rule settled in A29 (add in full, T-516).
- **Skills and XP** (A26): perks are the reward for a level; XP perks feed
  back into levelling.
- **Equipment** (A29): a perk works like a carried item and shares its reach
  (none, T-519).
- **Telling the player** (done): the effect wording (T-492 to T-495) and the
  level-up alert apply to perk lines.

## Where it differs from the GDD

- GDD §4 says "no perks authored yet"; nine are.
- Otherwise the code matches §4.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: a hero, and push one hero's Forestry to
   level 9 (or work a tree until just before 10).
2. **Watch them reach Forestry 10**: the level-up number shows "Clean
   Felling" in gold underneath, and the hero bar adds "Perk: Clean Felling".
3. **Double-click the hero, open Forestry in the skill panel**: the perk list,
   Clean Felling gold, and what it does.
4. **Open another skill**, Melee: no perks.
5. **Send the hero to a tree and hover its Double Loot badge**: the hero's
   perk is one of the listed sources.
6. Ask yourself: is a small bonus at 10 the reward you want, and what should
   the later levels (25, 50, 75, 99) and the combat skills give?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **What perks are**: small early, signature late. Majors stay at 10, 25,
  50, 75, 99; later majors change how the skill plays.
- **Small milestones every 5 levels** between the majors, in the same table,
  not marked minor: "small, repeatable improvements".
- **Combat skills** get perk tables like the work skills.
- **Showing a milestone**: every one the same, float and bar alert, no banner.
  "I want levelling up to be more of an event. It should show the new perk,
  new recipes unlocked, and when we have more animations something flashy."
- **Signature perks**: a draft concept doc now, worked out later skill by
  skill. The owner asked that tickets be sorted by who takes them: the
  director (code), the content agent (CMS content and change packs) or the
  planning agent (concept docs, the GDD); every audit ticket now says which.

## What it became

- **T-522** (content agent): perk tables for every skill that levels, small steps every 5 levels, combat skills too.
- **T-523** (director): a new perk table starts with a row every 5 levels.
- **T-524** (director): levelling up is an event: every milestone shown the same, with what the level unlocks.
- **[concept_milestone_perks.md](../concept_milestone_perks.md)** (planning agent, draft): signature perks skill by skill, step sizes, the flashy level-up.
- T-519 now covers perks' "nearby" too; T-521 fixes GDD §4 Milestone perks too; T-516 already drops the perks' cap of 5.
- Design pass note: a flashy level-up once more animations exist.
- Fine as is: no choices, nothing stored, no banner.

All three tickets blocked on the Effects group.

## Evidence

- Perks read off levels, never stored; villagers none → `src/systems/hero/HeroPerks.js:5-36`
- Same effect merges to 5 → `HeroPerks.js:38-53`; perks kept apart from items, free → `src/systems/hero/HeroEffects.js:234-262`
- Table shape, levels 2 to 99, default 10/25/50/75/99, scale 1 to 5 → `src/systems/hero/perkTable.js:10-53`
- Loaded from the CMS file → `src/config/registries/perkRegistry.js:6-42`
- Boot audit findings (unknown skill, bad level, missing effect, not narrowed) → `src/systems/core/perkRule.js:20-67`
- Shown: level-up float → `src/ui/components/board/LevelUpFloat.jsx:15, 83-87`, `levelUpFloats.js:66`; hero bar alert → `src/ui/components/dock/heroBarBubbles.js:10-11, 36-46`; skill panel → `src/ui/components/dock/HeroSkillPanel.jsx:25, 125-152`; perk lines → `src/ui/components/dock/heroPerks.js:41-51`
- Badge source named with the hero → `src/systems/board/EffectBreakdown.js:526-527`
- Perks join the hero's work rules → `src/systems/board/TileModifiers.js:1106-1121`
- Data: nine perks at level 10, all "nearby" → `data/skillPerks.json`, `data/effects.json` (`stm_k4_*`)
- Skills, combat and specialist with no table → `src/config/registries/skillRegistry.js:48-160`
