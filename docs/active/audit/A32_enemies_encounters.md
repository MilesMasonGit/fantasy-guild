# A32: Enemies and encounters
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

An enemy is a Token with a level, a Style, kinds, resistances and moves. The
level fills its numbers from a table (health 20 + level, a hit of 1 + 1 per
20 levels, a swing every 3 s, XP growing 6.5% a level, crit 5%); kinds, then
any number the author writes, change them. Enemies stand still and never
start a fight: the player sends a hero, one hero per enemy, and a second
hero waits. Enemies come from camps (spawners on a clock), and when a new
place is settled, from its **arrival**: a band of enemies that holds the mat
until beaten, sometimes with a boss. Nineteen enemies exist, eleven of them
bosses with a camp of one.

## What the player sees and does

- **Sending a hero**: drag them onto an enemy or its camp; a hero at a camp
  hunts the nearest of its enemies. A second hero on a busy enemy says
  "Waiting for Goblin." and takes it when it's free.
- **Two enemy cards that show different things**: the hover on the mat shows
  level, Style, health, hit and type, moves, resistances and weaknesses, swing
  speed and kinds (each "? fight one" until fought), but **no drops**; the
  Token card shows health, Style, level, XP and **drops**, but **no
  resistances, moves or kinds**.
- **Beating one**: "Goblin Beaten" from the hero; its loot drops on the mat.
- **Settling a new place**: its arrival enemies stand round the Hall; until
  they are beaten, that place's own camps spawn nothing.

## What really happens underneath

- **Two ways an enemy comes back**: 17 of the 19 enemies have one use, so a
  kill removes them and their **camp** brings another (every 30 s for
  ordinary camps, 300 s for boss camps, its clock held at zero while full).
  The **Cow and the Thorn Elemental have 100 uses**: they stand back up at
  full health 2 s after each kill, so their camp's clock barely matters.
- **An enemy's health resets whenever its fight ends**: flee, swap heroes or
  leave the Region and it is whole again. Only a reload keeps a hurt enemy
  hurt (for the same hero).
- **Bosses come from three places**: a camp of one (all eleven today), a
  Summoning Circle (none authored yet), and the **arrivals of rings 2 and 3**,
  which roll a loose boss (30% and 50%) with one use and no camp. The GDD
  says bosses come only from camps and Summoning Circles.
- **No guardians** are authored, and nothing marks one; a guardian is only an
  idea (a boss camp by a rich node).
- **Node ambushes are refused** and no content has one left.
- **The written XP is read**, but no enemy writes one, so every enemy pays
  the table. What's ignored is the work-cycle XP and cycle time left on the
  enemy Tokens (the Cow's 2 XP, 12 s and 16 s cycles).
- **Dead fields**: the Goblin's `hostile`, `budgetScale` (no enemy uses it,
  but the CMS still shows it when present), `traits`.
- A **sleeping camp** (while an arrival holds the mat) isn't in the GDD's
  encounters section.

## What the owner controls in the CMS

Per enemy: level, Style, kinds, moves, rules, resistances, uses, drops,
written overrides (health, hit, speed, XP, dodge, accuracy, crit). Per camp:
what it spawns (by weight), how many at once, how often. Per world ring:
arrival bands and their boss chance. Not in the CMS: the level table, the 2 s
stand-up, the arrival enemies' single use.

Data today: 19 enemies (Small Slime, the tutorial's first foe, is missing from
the GDD's table of 18); eleven boss camps of one (300 s); ordinary camps 3 at
a time every 30 s (Cow Pasture and Thorn Thicket every 60 s). The GDD still
lists the Goblin Chief at level 20, hit 4 (now 12, hit 3) and says the
resistances and moves are "in review" (they're in).

## What it touches, and where it overlaps another system

- **Statuses and boss moves** (A33, done): Passive and Active (T-539), kinds
  as effects (T-540), the boss flag cut (T-542).
- **The hit** (A31, done): resistances per type (T-532), the level table's
  numbers on the tuning page (T-253).
- **Spawners** (A2): camps are spawners; two refill ways overlap.
- **The world map** (A38/A39): arrivals, rings, sleeping camps.
- **Winning, losing and loot** (A34): drops, enemy health on return (parked
  there).
- **Telling the player** (ready to brief): hard-coded "Beaten" and "Waiting
  for" texts.

## Where it differs from the GDD

- 19 enemies, not 18; the Goblin Chief's numbers; the content pack has landed.
- Bosses also come from arrivals (rings 2 and 3), loose and campless.
- Camps sleep while an arrival holds the mat.
- "Shown on the enemy card from the start": only on the mat hover; the Token
  card shows none of it.
- "Respawns at full HP after a 2 s pause": only for enemies with more than one
  use (two today).

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game. QA panel: a hero with a Copper Sword and food;
   place a Goblin Camp and a Cow Pasture.
2. **Hover a Goblin on the mat**, then **open its Token card**: compare what
   each shows (moves and resistances vs drops).
3. **Beat a Goblin**: it's gone; the camp brings another within 30 s.
4. **Beat a Cow**: it stands back up 2 s later in the same spot.
5. **Hurt a Goblin, then drag the hero away and back**: it's back to full.
6. **Send two heroes at one Goblin**: "Waiting for Goblin."
7. If you have a later save: **settle a ring 2 place** and look for a loose
   boss among its arrival.

## Owner feedback (date)

## What it became

## Evidence

- Level table → `src/config/FormulaRegistry.js:127-150`; order (table, budgetScale, kinds, written) → `src/config/registries/enemyProfile.js:93-116, 139-162`
- Written XP read → `enemyProfile.js:162`; award → `src/systems/combat/CombatFormulas.js:440-441`, `CombatResolutionProcessor.js:27-46`
- Enemy never starts a fight → `src/systems/board/BoardCombat.js:340-363`; one-on-one → `:375-392`; waiting texts → `heroSpeech.js:58`, `flagText.js:54`; camp hunter picks nearest → `Flags.js:373-384`
- Stand still → `src/systems/board/EnemyMotion.js:1-35`, `FightRoom.js:11-43`
- Uses, 2 s stand-up → `BoardCombat.js:504-537`, `CombatResolutionProcessor.js:53`, `CombatProcessor.js:38-47`; uses in data → `data/tokens.json` (Cow, Thorn Elemental 100; the rest 1)
- Health reset on any fight end → `BoardCombat.js:314, 358-362, 618-621`; kept on reload → `:79-84, 399-407`
- Camp clock held while full → `TimedChanges.js:285`, `SpawnerSystem.js:463-467`; sleeping camps → `SpawnerSystem.js:470-475`
- Arrivals, loose bosses → `src/systems/world/Arrival.js:184-212`, `data/world.json` (bossChance 0.3, 0.5)
- Ambush refused → `TriggerSystem.js:244`, `lifecycleAudit.js:460-467`
- Two enemy cards → `src/ui/components/board/EnemyCard.jsx:35-80`, `tokenCard.js:516-528`
- Hard-coded texts → `heroSpeech.js:58, 64`
- Dead fields → `enemyProfile.js:61, 84-86, 171`; `cms/src/components/editors/TokenEditor.jsx:734-743`
