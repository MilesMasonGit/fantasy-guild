# A33: Status effects and boss moves
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A status is a library effect with stacks and a length in ticks. It lands only
on a fighter, ticks every 3 seconds, and ends with its fight however the fight
ends. Three exist: Venom (1 damage a tick per stack, up to 3, all fight), Burn
(1 a tick for 3 ticks, food heals half) and Sunder (10 off every resistance per
stack, up to 3, all fight). Enemies put effects on heroes, and on themselves,
three ways: their **kind** (Venomous lands Venom on every hit), a **rule** on
the enemy (every Nth swing or hit, or once below a health line), or a
**move** picked at random each swing. Bosses use the rules for heavy strikes,
status attacks, heals and enrages.

## What the player sees and does

- **A status landing**: "Venom!" over the hero (or the enemy); the fight log
  says "Venom on Ana ×2".
- **Moves**: the fight log says "Goblin uses Tongue Lash"; a special move (one
  that lands an effect or doesn't hit) also shows its name over the enemy.
- **Boss rules** show the name of the effect that holds them, so the Goblin
  Chief's heavy strike reads **"Goblin Chief Moves"**, not "Heavy Strike".
- **No icons** for statuses on the mat; the fight window lists them.
- Nothing the player can wear blocks a status yet (no item carries Status
  Immunity or a stack limit).

## What really happens underneath

- **Landing again** adds a stack (to the status's limit), keeps the stronger
  strength, and restarts the tick count. All stacks share one timer.
- **The tick is global**: every 3 s for everyone, so a status's first tick
  comes 0 to 3 s after it lands.
- **Three ways to land an effect, behaving differently**:
  - **Kind** (Venomous): on every landed hit, no chance. Queen Bee, Toxic Frog.
  - **Rule**: every Nth swing (lands even if the swing misses) or every Nth
    hit (only on a landed hit), with a chance (all 100% today). Goblin Chief,
    Wind Elemental (Heavy Strike); Greater Slime (Venom); Fire Elemental Chief
    (Burn); Queen Bee and Wolf Alpha (Enrage below a health line); Water
    Elemental (heals below half); Thorn Elemental (deals 1 back when struck,
    10%).
  - **Move**: picked by weight each swing; an effect on itself lands before
    the miss roll; never a chance. Big Lizard's Tail Smash (Heavy Strike),
    Bee and Queen Bee's Flutter.
  - The same effect comes by different routes: **Heavy Strike** is a rule on
    the Goblin Chief and Wind Elemental but a move on the Big Lizard; **Venom**
    is a kind on the Queen Bee and Toxic Frog but a rule on the Greater Slime.
- **Enemy kinds and effects move the same numbers**: Armoured (Physical 50,
  slow), Nimble (Dodge +15), Swift (fast, hit ×2/3), Brute (slow, hit ×4/3),
  Venomous. Enrage, Heavy Strike and Flutter then move speed, damage and
  resistance again on top. Kinds are fixed in code; the CMS only ticks them.
- **Four fight moments, not three**: On Swing, On Hit, On Health Below X%,
  and When Struck (the Thorn Elemental's). No charges or cooldowns.
- **Nine "how long"s**: a status's ticks or the fight, for the fight, for
  the swing, for one attack, for the work cycle, a game-time clock (no
  content), elixirs 10 fights, drinks 10 cycles, an event buff's 20 minutes on
  the mat.
- **A "boss" flag** on enemies changes nothing in play.
- **Stacks are capped at 5** by code, whatever the CMS says.

## What the owner controls in the CMS

Each status (the Effect editor's Status section): stacks, ticks, what it does
each tick and while carried. Each enemy: kinds (tick boxes), moves (name, hit,
type, effect, on itself or the hero, how long, weight), rules on the fight
moments (every Nth, health line, chance), the boss flag. Not in the CMS: the
kind presets' numbers, the 3 s tick, the 5-stack limit, the elixir and drink
lengths, a move's chance (always lands).

## What it touches, and where it overlaps another system

- **The hit** (A31, done): Venom becomes Poison damage (T-534); all damage
  rolls (T-535); Sunder and resistances (T-532, T-533); Attack Speed (T-536,
  Enrage).
- **Health** (A28, done): Burn's Food Healing on every meal (T-529).
- **Effects** (ready to brief): durations, the same effect from several
  sources (T-516).
- **Enemies** (A32): kinds, moves, the boss flag.
- **Telling the player** (ready to brief): status popups (T-496), effect
  hovers (T-495).

## Where it differs from the GDD

- GDD lists Flutter with the statuses; it isn't one (it lasts one attack).
- GDD names Stone Skin and a Hide Vest; neither exists in the content.
- GDD: three fight moments; there are four (When Struck).
- GDD: a move says its effect's name; it says the move's name, and only for
  special moves. Rules say their holder's name ("Goblin Chief Moves").
- GDD doesn't mention the 5-stack limit or the shared tick.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game; QA panel: a hero with a Copper Sword and food;
   place a Toxic Frog, a Goblin Chief, a Fire Elemental Chief and a Bee.
2. **Fight the Toxic Frog**: "Venom!" on every hit it lands, stacking to 3;
   the hero loses 1 health per stack every 3 s.
3. **Fight the Goblin Chief**: every 6th swing a double hit, announced as
   "Goblin Chief Moves".
4. **Fight the Fire Elemental Chief**: Burn every 3rd hit; watch it last 3
   ticks.
5. **Fight a Bee**: Flutter named over it; misses rise for one attack.
6. **Flee mid-fight** (drag the hero elsewhere): Venom ends at once.
7. Ask yourself: should one effect (Venom, Heavy Strike) always come by one
   route, and should boss moves be named by the move?

## Owner feedback (date)

## What it became

## Evidence

- Status block, stacks capped at 5 → `src/systems/effects/effectLibrary.js:39, 50-59`
- Landing: in a fight only, immunity and cap, add a stack, keep stronger, reset ticks → `src/systems/effects/LiveEffects.js:283-322`; per stack → `:552-557`
- Global 3 s tick → `src/config/FormulaRegistry.js:174`, `LiveEffects.js:466-498, 623-629`
- Ends with the fight → `src/systems/board/BoardCombat.js:283-291, 384, 397, 499-500, 556, 563, 612-619`, `BoardRunner.js:598-599`
- Kind lands on every hit, no chance → `src/systems/board/FightMoments.js:40-56`; kind presets → `src/config/registries/enemyKinds.js:32-67`; applied → `enemyProfile.js:109-116`; CMS ticks only → `cms/src/components/editors/TokenEditor.jsx:845-851`
- Rules: chance → `src/systems/board/StatusApplication.js:60-63, 109`; every Nth, health line once → `FightMoments.js:148-157`; On Hit only on a landed hit → `src/systems/combat/CombatAttackProcessor.js:163-178`
- Moves by weight, chance 100, self effect before the miss → `src/systems/combat/enemyMoves.js:53-65, 85-105`, `FightMoments.js:104-119`, `CombatAttackProcessor.js:146-156`
- When Struck → `src/systems/effects/triggerRegistry.js:339`
- Rule named by its holder → `effectLibrary.js:210`, `FightMoments.js:198`, `CalloutLayer.jsx:120-123`; data "Goblin Chief Moves" → `data/effects.json:1791`
- Durations → `LiveEffects.js:176-194, 240, 255, 306-361, 401`; elixir and drink lengths → `src/config/loopConstants.js:67, 74`
- Boss flag unused → `src/config/registries/enemyProfile.js:63` (callers only in tests)
- No Stone Skin, no Hide Vest, no Status Immunity or Stack Limit in data → `data/effects.json`, `data/items.json` at the tag
