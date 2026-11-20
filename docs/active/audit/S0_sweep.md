# S0: the cross-system sweep
*Read at tag audit-build (1c04f5f6), 2026-11-19. Six read-only readers, one
per shared topic; the main claims re-read by the auditor against the code.*

The one question: **where does the game do the same kind of thing in more
than one way?** Below, in plain words, topic by topic. "Latent" means no
shipped content uses it yet, so a player cannot meet it today. Things already
in a ticket or a review finding are named, not re-told.

## The overlap map

### 1. Effects (on heroes, enemies and Tokens)

The good news first: every number that changes a work cycle (speed, yield,
XP, Double Loot, Preservation, Refresh, Lucky, Giant Harvest, Efficiency,
growth) is added up in **one place**, from three sources: the Token's
neighbours and event buffs, the guild (Stars, Region rules), and the hero
working it. A building and a Star are summed the same way.

What is not aligned:

- **Four rules for "the same effect from two sources".** Two identical
  buildings stack in full, with no cap. Two trinkets naming one effect add
  but cap at 5. A perk and an item naming one effect both count in full,
  past the cap. A lingering effect landing again keeps the stronger and
  restarts its clock. All four are in content today.
- **Fight numbers and work numbers are summed down two pipes**, and the
  copies disagree (already T-360, T-362, T-386).
- **An enemy can put an effect on a hero three ways**: its kind (Venomous,
  every hit), a rule on the Token (every Nth swing, with a chance), or a move
  (random pick, always lands). Content uses more than one for the same
  effect: Heavy Strike is a rule on the Goblin Chief and Wind Elemental and a
  move on the Big Lizard; Venom is a kind on the Queen Bee and Toxic Frog and
  a rule on the Greater Slime.
- **Enemy stat twists exist twice**: kind presets (Nimble, Armoured, Swift,
  Brute) write numbers straight in; effects (Enrage, Flutter) move the same
  numbers another way.
- **Resistance adds up differently on heroes and enemies.** On a hero, a
  Physical line and a Crush line both count. On an enemy, the Crush line
  replaces the Physical one. Shipped example: the Crab (Armoured, Physical
  50, Crush −50) takes Crush as a 50 % weakness; by the hero's rule it would
  be 0.
- **"Poison" and "Venom" are different things.** Poison is a damage type
  enemies resist; Venom is a status whose damage nothing resists. The Toxic
  Frog has both.
- **Six different clocks for "how long"**: elixir fights and drink cycles
  counted on the hero, effects for a fight, a swing, an attack or a cycle,
  status ticks every 3 s, a game-time clock no content uses, an event buff's
  20 minutes on the mat, and a Star rank (forever).
- **Who an effect reaches**, three ways: a filter plus a reach, a role, or
  nothing (on an item or a perk the reach is dropped silently; all 9 perks
  are written with "nearby", which does nothing).
- **Four separate runners for "When…" rules** (Tokens, carried items,
  fights, the 3 s tick), each with its own cooldown and cost rules (partly
  T-427).
- **A bonus drop** pays doubled and ×10 on Giant Harvest when it is a
  standing rule, but its plain amount when a rule fires it (latent: only the
  standing form is used).
- **"Needs a neighbour" can be written three ways**, and one of them
  (`Requires`) is read by nothing at runtime; a second (a neighbouring tool
  Token) is used by no content but still runs every tick. Tools in hand
  (33 Tokens) are the live way.
- **The Guild Hall is exempt by name** from some effects (Double Loot,
  Yield, Giant Harvest, Work Time, bonus drops) but not others (Failure,
  Preservation, Refresh, XP), against "one rule everywhere".
- **Data the game never reads**: `ignoresArmor` on 4 effects; the heal
  amount on the 6 drinks and one potion (only Food heals); `regen` and
  `restoreType` on 3 items. Five stations carry both a cycle time and a
  "Faster Station" self-boost that eats into the shared 80 % speed-up floor.

### 2. Things on a clock

The good news: every clock counts game time, so time away, a minimised
window and the dev skip all fast-forward it alike. Most Token clocks live in
one table.

What is not aligned:

- **"It comes back" is built four ways in content**: veins and bushes rest
  and refill (33), trees regrow as a Stump that grows (7), a spawner plants
  Saplings (the oak and fir Forests, the Apple Orchard), and Fields re-sow
  (3). **Forests themselves split**: oak and fir plant Saplings forever;
  birch, maple and mahogany run dry after 250 and rest 10 minutes. Only the
  oak and fir Stumps need their Forest nearby.
- **When the mat is full or the cap is hit**, four behaviours: a Forest
  refills a felled spot almost at once, a goblin camp and the bounty board
  wait a whole interval, an event retries in 5 minutes, growth retries every
  tick.
- **Paying for a timed thing**, three timings: a Stump pays its seedling at
  the end, a spawner at the spawn, a Field takes its seed at sowing but pays
  it at the first harvest; rule upkeep pays from the Bank only (T-075).
- **What speed-ups reach**: Grow Time speeds growth, rests and crops at once,
  even mid-wait. Wound Time counts only from the next wound. Spawners, events,
  bounties, regen and cooldowns cannot be sped up at all.
- **Another Region's mat stops**: a resting vein, a growing Stump or a
  20-minute buff waits for your return, while wounds, hero effects and the
  bounty board keep running.
- **The Hall's drop lap ignores the times written on its lines** (5, 5 and
  10 minutes in the data); everything pays on one 10-minute lap.
- A buff Token held in the hand does not leave until it is dropped.

### 3. Things that appear and disappear

The good news: every "this Token turns into that one" goes through one shared
step, so growing, regrowing and a finished Foundation behave alike.

What is not aligned:

- **Five ways to find a spot for something new**: spawners and bounties land
  near and can shove things aside; events throw random darts and never
  shove; a crafted Token or an arrival enemy can land anywhere on the mat;
  a Shop drop nudges or flies back.
- **Four answers to "no room"**: wait a whole lap, retry in 5 minutes, retry
  every tick, or (arrival enemies after settling) **lost for good**, with
  only a log line.
- **Who counts toward the 128 cap** differs: arrival enemies skip the check
  but count, so settling a crowded place can put the mat over the cap and
  the Shop then refuses until they are beaten.
- **Four ways to get rid of something**, four gestures: an event Token goes
  instantly when marked, everything else needs a 10-second Construction
  hero, a bounty has a Dismiss button, a Foundation is dragged back to the
  Shop.
- **Three different arrival notices**: a spawn hops out with a callout, an
  event gets its arrival and a banner, and a crafted Token or arrival enemy
  just appears. Leaving is uneven too: an event that times out only loses its
  banner, with no reason given.
- A hero follows a Token that grows or regrows into the next one, but lets
  go when a Foundation finishes building.

### 4. The work cycle (shared by every skill)

The good news: one path for most work (walk, checks, the cycle, pay inputs,
drop outputs on the floor, XP). A full Bank never stops a cycle.

What is not aligned:

- **Two fishing models.** Coast, River, Lake and Bog Pool give exactly one
  fish a cycle from a weighted pool, use bait, take a rod of any tier and
  never run out. The Fish Shoal event and the Shrimp Coast roll each fish on
  its own line, use no bait, need a rod tier and run out (100 and 1000). A
  Shoal cycle gives both fish about 21 % of the time and nothing about 21 %.
- **Where an item is taken from**: recipe inputs, seeds and growth costs
  from the Bank **or the floor**; bait, arrows and anything an item spends
  from the **Bank only**.
- **Running out**, five ways: Coal (a recipe input) gives a red badge, a
  notice and a callout; bait runs out silently (the hero fishes the basic
  pool); arrows run out silently (the bow shoots without them, a ruling
  the code says is still yours to make); a Field with no seed sends its hero
  away with no badge; "no room" fills the ring and holds at 100 % with no
  notice.
- **A kill counts as a cycle but skips most of one**: no Fail chance,
  Preservation, Refresh or neighbour Applies; the Cow's written XP and cycle
  time are ignored (kill loot already T-441).
- Demolition is its own little cycle: no speed-ups, no XP, no tool.
- The Guild Hall's work branches are unreachable; its income runs on its own
  lap.

### 5. How the game tells the player

The good news: nearly every tooltip is one shared box.

What is not aligned:

- **"Time left" is written at least nine ways** with three roundings. The
  same event's hour reads "60:00" on the card, "60 min" in the card's
  hover and "1 h" in the idle hover; a 2.5 s recipe reads "0:03" in the
  Encyclopedia and "2.5s" on the card; a 75-minute wait reads "75:00".
- **The hover on an idle Token and the Token card describe the same timers
  in different words** (grow, ripen, refill, turn, event).
- **One effect, three wordings, opposite signs, on one card**: the badge says
  "Speed +25%", the boosts block says "−25 % work", and perks, gear and
  Stars say "work 5% faster" (partly T-403).
- **Chances are rounded five ways**, and the Encyclopedia ignores Lucky
  while the card counts it. The card and the Encyclopedia work out "where
  an item comes from" with two different readers.
- **Silent moments**: a hero recovering from wounds, a vein starting to rest,
  an event leaving (no reason given live, though the away summary says it),
  every transform (the same unnamed 1 s glow for building, growing and
  turning), what an item's effect does (shown only once it is worn).
- **Wording drift**: rest and respawn said four ways, an event's leaving four
  ways, "Knocked Out!" and "Knocked out", "Needs Melee 15/99" and "Melee
  level too low (needs 15)".
- A second writer for the card's lifecycle lines exists that the game never
  calls (tests only).

## What this means for the order

Three overlaps run under almost everything: **effects** (how strong, how
long, who it reaches, how it stacks), **the living mat** (clocks, spawning,
coming back, leaving) and **telling the player**. Fixing a skill first and
the shared machinery later would mean touching the skill twice, so the shared
groups come first and the words and screens come last, once the rules they
describe have settled.

## Proposed groups

A group is a set of systems whose fixes should reach the director together.

| Group | Systems | Why together |
|---|---|---|
| **Effects** | A37 Guild Hall and Stars, A29 Equipment and tools, A27 Milestone perks, A28 Health, food and defeat | Stacking, strength, duration and "who it reaches" are one decision across Stars, gear, perks and doses |
| **Combat** | A31 The hit, A33 Statuses and boss moves, A32 Enemies and encounters, A34 Winning, losing and loot, A35 The combat screen, then the styles A15 Melee, A16 Ranged, A17 Magic, A18 Stealth | Three ways an enemy lands an effect, resistance sums, Poison and Venom, a kill as a cycle; the styles sit on top |
| **The living mat** | A2 Spawners and transforms, A4 Events, A1 Placing and reach (with A3 Demolition), A40 Regions, A41 Time away and saving | Where new things land, "no room", the cap, leaving, frozen Regions |
| **Gathering** | A8 Fishing, A7 Forestry, A6 Mining, A9 Farming | "It comes back" four ways, the two fishing models, the Forest split, seeds, running out |
| **Making** | A10 Smithing, A11 Crafting, A12 Cooking, A13 Construction, A14 Alchemy, A5 The Shop | Stations, recipes, Foundations; inputs from the Bank or the floor |
| **Heroes and the guild** | A26 Roster and XP, A30 Orders, A36 Items and the Bank, A38 Quests and Limes, A39 The world map and settling | Each mostly stands alone |
| **Specialist skills** | A19 Fletching, A20 Faith, A21 Summoning, A22 Enchanting, A23 Crime, A24 Taming, A25 Science | Identity sessions; easier once combat and making have their identities |
| **Telling the player** | A42 Notifications, A43 Cards, badges and bars | Time formats, effect wording, silent moments; last, so it describes the settled rules |

## Proposed order

Effects → Combat → The living mat → Gathering → Making → Heroes and the
guild → Specialist skills → Telling the player.

Inside each group, the order in the table. Effects opens with the Guild Hall
and Stars because Stars are the cleanest place to see stacking and strength.

## Proposed changes to SYSTEMS.md

1. **Merge A3 Demolition into A1** as "Placing, reach and removal": the four
   ways to get rid of something are best judged beside putting things down.
2. **A14 Alchemy**: no content yet. Audit its rules inside Making, or wait
   until it has content (the owner's call).

## Notes passed to later sessions

Things seen in the sweep that belong to one system's session are listed on
that system's row in [STATUS.md](STATUS.md), so its session starts with them.

## Owner decision (2026-11-19)

- **Order:** shared first, as proposed: Effects, Combat, The living mat,
  Gathering, Making, Heroes and the guild, Specialist skills, Telling the
  player.
- **Groups:** the eight groups as listed.
- **A3 Demolition** merges into A1, "Placing, reach and removal".
- **A14 Alchemy** is audited for its rules only, inside Making.
- No tickets from the sweep itself: what it saw waits on each system's row
  in STATUS for that system's session.

## Evidence

Effects
- One sum for work numbers → `src/systems/board/TileModifiers.js:849-896`
- Item scales add, cap 5 → `src/systems/hero/HeroEffects.js:85-90`; perks kept apart → `HeroEffects.js:240-258`
- Mat copies stack, no cap → `TileModifiers.js:482-523`; lingering effect keeps the stronger → `src/systems/effects/LiveEffects.js:167-233`
- Enemy routes: kind → `src/config/registries/enemyKinds.js:63-66`, `src/systems/board/FightMoments.js:40-56`; Token rule with a chance roll → `FightMoments.js:62-66, 194-198`; move, chance 100, named with its swing → `FightMoments.js:94-120`
- Resistance: enemy type line replaces group → `src/config/registries/damageTypes.js:138-144`; hero counts both → `src/systems/effects/ModifierAggregator.js:298-309`
- Venom damage untyped → `src/systems/board/DealDamage.js:20-21, 82`
- `ignoresArmor` read by nothing → `DealDamage.js:21` (grep of src and cms)
- Only Food heals → `src/systems/hero/ConsumptionSystem.js:104-111`
- Guild Hall exemptions by id → `src/systems/board/BoardRunner.js:264, 285-303, 328-333, 368`
- `Requires` has no runtime reader → `src/systems/effects/statements.js:558-580`; tool Token path → `src/systems/board/RecipeResolver.js:77-92`
- Bonus drop standing vs fired → `src/systems/board/OutputRules.js:98-116`, `src/systems/board/TriggerSystem.js:396-408`

Clocks
- The table → `src/systems/board/TimedChanges.js:238-359`; held at cap or idle → `:438-441, 471-474`
- Forests split → `data/tokens.json` (`token_oak_forest`, `token_fir_forest` spawners; birch, maple, mahogany `respawn: refill, 600000`)
- Wound Time read at wound start → `src/systems/combat/WoundedSystem.js:18-26`
- Grow Time read live → `TimedChanges.js:128-130`, `src/systems/board/Respawn.js:57`, `src/systems/board/Fields.js:160-162`
- Hall lap ignores line times → `src/systems/board/PassiveProduction.js:20-22`
- Other Regions frozen → `src/systems/atlas/Atlas.js:538-542`
- Field seed at sowing, paid at harvest → `Fields.js:197-216, 283-295`
- Event retry 5 min → `src/systems/events/EventClock.js:56, 306-322`

Appear and disappear
- Arrival enemies lost with a log line → `src/systems/world/Arrival.js:181-217`
- Cap: what counts → `src/systems/board/MatCap.js:28-36`; asked at `src/systems/board/Shop.js:107`, `Placement.js:265`, `SpawnerSystem.js:375`, `TriggerSystem.js:242-247`; not at `Arrival.js:206`
- Spawn placement and push → `src/systems/board/EffectActions.js:171-210, 299-343`; event darts → `EventClock.js:199-224`
- Unworked event reported as time up → `TimedChanges.js:349-358`
- Hero follows a transform but not a build → `src/systems/board/Flags.js:757-768`
- Event demolished at once → `src/systems/board/Demolition.js:170-173`

Work cycle
- Completion order → `src/systems/board/BoardRunner.js:213-471`
- Catch pool → `src/systems/board/Fishing.js:80-90`; Fish Shoal lines → `data/tokens.json` `token_fish_shoal` (trout 70, salmon 30, separate lines)
- Bait from the Bank only → `Fishing.js:41-52`; arrows silent and Bank only → `src/systems/combat/Arrows.js:13-19, 45-60`
- Recipe inputs from Bank and floor → `src/systems/board/InputAllocator.js:23-72`
- Only three stop reasons send a notice → `BoardRunner.js:681, 708, 723`
- Kill skips cycle steps → `src/systems/board/BoardCombat.js:495-544`

Telling the player
- Time formats → `src/utils/Formatters.js:131`, `centreAlert.js:25`, `workPlate.js:152`, `fightView.js:111`, `EncyclopediaPanel.jsx:10`, `heroPanelSkills.js:54`, `tokenCard.js:363`, `lifecycleLines.js:24`
- Idle hover vs card → `idlePlate.js:31-57`, `tokenCard.js:332-471`
- Effect wording → `effectBadgeText.js:37`, `EffectBreakdown.js:160, 424`, `supportTags.js:30-34`, `src/systems/effects/statementText.js:168, 269`
- Lifecycle writer only in tests → `src/ui/components/drawer/lifecycleLines.js:302` (no caller outside `src/tests`)
- Hero recovered has no UI listener → `WoundedSystem.js:93` (grep of `src/ui`, `src/systems/notifications`)
