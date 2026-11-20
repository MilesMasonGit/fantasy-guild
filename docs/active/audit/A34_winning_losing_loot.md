# A34: Winning, losing and loot
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

When a hero beats an enemy, they get XP in the style they fought with and the
enemy's drops hop out beside it as loot, like a work cycle's output: each drop
line rolls its own chance and amount, widened by Yield, Double Loot, Double
Item and bonus drops. The kill spends one of the enemy's uses and counts as a
work cycle for neighbouring Tokens' rules. After a 2-second rest the hero
fights again. Losing (knockouts, wounds, losses) was covered in A28. Every
enemy drops something; bosses drop more and carry better odds at the rare
map items.

## What the player sees and does

- **On a win**: the enemy's knockout animation, a victory sound, loot hopping
  out; the hero says "Goblin Beaten"; the fight window says "Ana beats Goblin"
  and "Drops Bones, Copper Ore"; the fight's summary "Beat Goblin in 0:42".
- **No win banner and no XP number** (a work cycle shows none either).
- **Loot** is collected by hovering it, by auto-collect after 2.5 s, or swept
  into the Bank once 40 piles lie about; with a full Bank it waits on the mat.
- **Leaving a fight** (dragging the hero away, picking up the enemy) gives no
  XP and no loot.

## What really happens underneath

- **A kill is like a work cycle, but not quite**:

  | | Kill | Work cycle |
  |---|---|---|
  | Yield, Double Loot, Double Item, bonus drops, XP bonus | yes | yes |
  | Lucky and the rare table | yes, but no enemy has a rare table | yes |
  | Giant Harvest | no | yes (gathering) |
  | Fail chance, Refresh, a neighbour's statuses on the hero | no | yes |
  | Counts for the collection log | no | yes |
  | A neighbour's On Produces rule, a quest counting items made | no | yes |

- **A neighbour's rules on Cycle and on Kill both fire on one kill**, so a
  Token with both reacts twice.
- **An enemy's own On Cycle rule would fire on its death** and could knock
  out the hero who just won. No enemy has one: the Thorn Elemental's thorns
  are already When Struck (`effect_thorns_struck`); the Redberry Bush's
  Thorns is the work-cycle version.
- **No rare tables exist on any Token**: the rare finds are ordinary drop
  lines (every enemy's banner map at 0.5%, 2% on bosses; the Coal Prospecting
  Map at 3%, 25% on the Goblin Chief), so Lucky does nothing on them. The rare
  twinkle is switched off.
- **Bonus drops are left out** of the fight window's "Drops" line and the time
  away tally.
- **The drop list is fixed when a fight starts**; an edit mid-fight applies
  next fight.
- **Two quest counters** count one kill (cycle completed and combat victory).
- **The 2 s rest is in code**, and leftover time at its end is lost (a work
  cycle keeps it).
- A dead branch banks loot directly when there's no enemy Token (only tests
  reach it); `isFleeing` is read but never set.

## What the owner controls in the CMS

Per enemy: drops (item, chance, min–max), a rare table (unused), XP (unused;
the level table pays). Per effect: Yield, Double Loot, Double Item, bonus drops,
Lucky. Not in the CMS: the 2 s rest, the 2.5 s auto-collect, the 40-pile sweep.

Drops today (every enemy drops something; Small Slime has no banner map):
plane 1 enemies drop Bones, meat, ore, honey, sea food; plane 2 coal, iron,
lizard scales, lavender; bosses drop 2 to 4 of their kind's items at 100%. The
18 banner items are all named "… Map" and 10 share one icon (placeholder art,
not a fault).

## What it touches, and where it overlaps another system

- **Health, food and defeat** (A28, done): losing.
- **Enemies** (A32, done): uses, camps, enemy health (T-546 settled the note
  parked here).
- **Effects** (ready to brief): Yield, Double Loot, Lucky, bonus drops.
- **Making** (the work cycle): the comparison above.
- **Quests and the collection log**: what a kill counts for.
- **Telling the player**: bonus drops in the Drops line; "Beaten" hard-coded
  (T-548).

## Where it differs from the GDD

- GDD: kill loot follows "the same" rules as a station's output; it skips
  Fail, Refresh, Applies and On Produces.
- GDD lists Giant Harvest on a rare find; a kill can't have one.
- GDD describes rare tables as shipped; no content uses one.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: a hero with a Copper Sword and food;
   place a Goblin Camp, a Cow Pasture and a Thorn Elemental's Thorn Thicket.
2. **Beat a few Goblins**: Bones every time, Copper Ore about a third of the
   time; watch the fight window's "Drops" line.
3. **Watch the loot**: hover it in, or wait 2.5 s for auto-collect.
4. **Fight a Thorn Elemental**: its thorns sometimes hit back when you strike it.
5. **Drag the hero away mid-fight**: no loot, no XP.
6. Ask yourself: should a kill feel like a finished cycle (all the same
   bonuses), or have its own rules?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **A kill and a work cycle**: "A kill is a cycle, but a different kind. We
  have Combat Cycles and Work Cycles. Some buffs might affect one but not the
  other. We should be specific about what a buff does. Something like Giant
  Harvest should only affect Work Cycles, and probably just Farming tasks."
  Combat cycles get Yield, Double Loot, bonus drops and Double Item; not
  Refresh. Giant Harvest: Farming only.
- **Kill loot counts** for the collection log and item-made quests and rules.
- **Neighbours**: a kill fires On Kill only.
- **Thorns**: "That Thorns effect is configured wrong. It should be a passive
  effect that triggers when it is hit by the Hero." Checked: the Thorn
  Elemental already uses a When Struck Thorns; the reader had mixed it up with
  the Redberry Bush's work-cycle Thorns. The card is corrected.
- **Rare tables**: "We need the content agent to build in rare drop tables,
  such as Gems for Mining tasks and Treasure for Fishing tasks." Enemies' rare
  finds move into rare tables too.

## What it became

- **T-550** (director): combat cycles and work cycles; loot is loot; a kill counts once for quests.
- **T-551** (director): Giant Harvest for Farming only.
- **T-552** (director): a kill reaches neighbours as On Kill only.
- **T-553** (content agent): rare drop tables for work and enemies.
- **T-554** (director): loot leftovers (bonus drops shown, the 2 s rest, drop list read per kill, dead code).
- **T-555** (planning agent): the GDD on kills and rare tables.
- T-253 now lists the 2 s rest.

All six tickets blocked on the Combat group.

## Evidence

- Kill order: XP, rest, victory, loot, use spent, cycle event, kill event, breakage, removal → `src/systems/combat/CombatResolutionProcessor.js:27-62`, `src/systems/combat/LootSystem.js:26`, `src/systems/board/BoardCombat.js:495-537`
- Loot rules on a kill → `LootSystem.js:50-92`; work cycle's → `src/systems/board/BoardRunner.js:264-420`
- Kill skips On Start, On Produces → `BoardRunner.js:607-616, 767`, `BoardCombat.js:517-522`, `TriggerSystem.js:529-532`; Cycle and Kill both fire → `triggerRegistry.js:86-91`, `TriggerSystem.js:646`
- Loot as sprites, auto-collect 2.5 s, 40-pile sweep, full Bank → `LootSystem.js:77-82`, `SpriteLayer.js:23-31, 412-415, 535-566`
- No rare tables in data → `data/` at the tag (no `rareTable`); twinkle off → `src/ui/utils/lootEffects.js:9`
- Bonus drops not in LOOT_GENERATED → `LootSystem.js:90-91`, `CatchUp.js:318`
- Messages → `src/ui/components/combat/fightWatch.js:347-365`, `heroSpeech.js:64`, `src/i18n/en.json:388, 439`; no win banner → `src/systems/notifications/routing.js:135`
- Leaving ends with nothing → `BoardCombat.js:283-291, 358-361`, `BoardRunner.js:598-601`
- 2 s rest, leftover lost → `CombatResolutionProcessor.js:53`, `CombatProcessor.js:39-41`
- Drops fixed at fight start → `BoardCombat.js:401`; two quest counters → `QuestManager.js:130-139, 214-218`
- Dead branch, `isFleeing` → `LootSystem.js:84-88`, `CombatProcessor.js:80`
