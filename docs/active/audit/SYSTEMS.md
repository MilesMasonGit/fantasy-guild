# Systems Audit — the systems list

*Owner, 2026-11-18. This is what counts as one system, so the auditor knows
what a session covers. Each row is one system card (`A<n>_<system>.md`). The
GDD sections and code folders are starting points for reading, not
boundaries; check the code. The S0 sweep may propose merging, splitting or
adding rows. The owner approves every change, and this file is updated with
the date.*

**Rules for the list (owner, 2026-11-18):**
- **One card per skill** that has content: each skill should have its own
  identity. The work cycle the skills share is audited once, in the sweep.
- **Combat is split into five systems**, each small enough to play and judge
  in one sitting.
- **The specialist skills are in** (owner, 2026-11-18): fletching, faith,
  summoning, enchanting, crime, taming and science are placeholders with no
  mechanics yet. Their sessions are identity sessions: the card says what
  exists today (name, description, any content or rule that names the skill,
  any concept or content doc about it), and the talk-through decides whether
  the skill is cut, merged into another, or given a defined identity. A
  defined identity becomes a draft concept doc.
- **Alchemy** has no content yet. Its card covers the rules it will use, or it
  waits; the auditor asks the owner.
- **The sweep's topics** (part 1) are audited across all systems in S0. The
  single-system cards then refer back to S0 rather than re-auditing them.

## Changes

- **2026-11-19 (owner, from S0):** A3 Demolition merged into A1, now
  "Placing, reach and removal". A14 Alchemy is audited for its rules only,
  inside the Making group. The groups and the order are in
  [STATUS.md](STATUS.md).

## 1. Shared machinery (the S0 sweep)

| Topic | What it covers | GDD | Code to start from |
|---|---|---|---|
| The work cycle | How a hero works a Token: claiming, walking, cycle time, inputs, outputs, XP, charges | §2, §4 Orders | `src/systems/board/` (BoardRunner, workTime, InputCost, OutputRules, RecipeResolver, Charges) |
| Effects and rules | Buffs, statuses, Token neighbours, gear, perks, Stars, Food, Events' buff Tokens; how bonuses are summed | §7, §6 Status effects | `src/systems/effects/`, `board/` (EffectActions, StatusApplication, TileModifiers, TriggerSystem), `hero/HeroEffects.js` |
| Things on a clock | Growing, refilling, spawning, transforms, timed changes, upkeep | §3 | `board/` (Growth, Respawn, SpawnerSystem, TimedChanges, BlockUpkeep), `events/EventClock.js` |
| Things that appear and disappear | Spawned Tokens, transforms, event Tokens, demolition, loot on the mat | §3 | `board/` (SpawnerSystem, EventTokens, Demolition, Placement) |
| How systems speak to the player | Cards, badges, bars, glows, banners, effect breakdowns | §9 | `board/` (EffectFeedback, EffectBreakdown, TokenGlows), `src/systems/notifications/`, `src/ui/` |

## 2. The mat

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A1 | Placing, reach and removal (A3 Demolition merged in, owner 2026-11-19) | The mat, placing and moving Tokens, the cap, reach, Foundations; taking Tokens off the mat and what comes back | §3 The mat, What a Token is, Reach, Foundations, Demolition | `board/` (MatPlacement, Placement, MatCap, Foundations, nearby, reachDisplay, Demolition) |
| A2 | Spawners and transforms | How Tokens make new Tokens and change into others | §3 Spawners, Transforms | `board/` (SpawnerSystem, TimedChanges) |
| A4 | Events | Event nodes and buff Tokens that land on the mat | §3 Events | `board/EventTokens.js`, `src/systems/events/` |
| A5 | The Shop | Buying with items | §5 | `board/Shop.js` |

## 3. Skills (one card each)

| # | Skill | Notes | GDD | Code to start from |
|---|---|---|---|---|
| A6 | Mining | | §4 Skills, §5 | `board/` work cycle, `data/tokens.json` |
| A7 | Forestry | | §4 Skills | as above |
| A8 | Fishing | Owner's idea: Fishing spot Tokens appear on water sites and disappear after a while | §3 Fishing | `board/Fishing.js` |
| A9 | Farming | | §3 Farming | `board/Fields.js`, `board/Growth.js` |
| A10 | Smithing | | §4 Skills, §5 | `board/` (StationRecipe, RecipeList) |
| A11 | Crafting | | as above | as above |
| A12 | Cooking | | as above | as above |
| A13 | Construction | | §4 Skills, §8 | as above, `board/Foundations.js` |
| A14 | Alchemy | No content yet; audited for its rules only, inside Making (owner, 2026-11-19) | §4 Skills | as above |
| A15 | Melee | Combat styles: each style's identity (weapons, damage types, what it is good at) | §4 Skills, §6 The fight | `src/systems/combat/`, `src/systems/equipment/` |
| A16 | Ranged | Bows and arrows, two damage types per shot | as above | as above, `combat/Arrows.js` |
| A17 | Magic | | as above | as above |
| A18 | Stealth | | as above | as above |
| A19 | Fletching | Placeholder. See also `content_fletching.md`: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A20 | Faith | Placeholder: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A21 | Summoning | Placeholder: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A22 | Enchanting | Placeholder. See also `content_enchanting.md`: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A23 | Crime | Placeholder: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A24 | Taming | Placeholder: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |
| A25 | Science | Placeholder: cut, merge, or define an identity | §4 Skills | `src/systems/hero/SkillSystem.js`, the skill registry, any content naming it |

## 4. Heroes

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A26 | Roster and XP | Hiring, the XP curve, XP bonuses, hero level | §4 Roster, Skills | `src/systems/hero/` (HeroManager, HeroGenerator, SkillSystem, xpBonus) |
| A27 | Milestone perks | Perks earned at skill levels | §4 Milestone perks | `hero/HeroPerks.js`, `hero/perkTable.js` |
| A28 | Health, food and defeat | Health, eating, regen, being wounded | §4 Health, food, defeat | `hero/` (ConsumptionSystem, RegenSystem), `combat/WoundedSystem.js`, `combat/DefeatPenalties.js` |
| A29 | Equipment and tools | Loadout, tools, wear and breakage, what gear unlocks | §4 Equipment | `src/systems/equipment/` |
| A30 | Orders | How heroes get work and choose what to do | §4 Orders | `board/Orders.js`, `board/Occupation.js`, `board/walking.js` |

## 5. Combat (five systems)

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A31 | The hit | Swings, weapon speed, damage types, crits, resistances, the damage formula | §6 The fight | `combat/` (CombatAttackProcessor, CombatFormulas), `board/DealDamage.js` |
| A32 | Enemies and encounters | Enemy kinds, camps, how fights start, enemy movement | §6 Enemies, Encounters | `board/` (Camps, EnemyMotion, BoardCombat, FightRoom) |
| A33 | Status effects and boss moves | Statuses in fights, boss moves | §6 Status effects, Boss moves | `board/StatusApplication.js`, `board/FightMoments.js`, `combat/FightHooks.js` |
| A34 | Winning, losing and loot | The end of a fight, defeat penalties, wounds, loot and rare drops | §6 The fight | `combat/` (CombatResolutionProcessor, LootSystem, DefeatPenalties), `board/` (RareDrops, RareTables) |
| A35 | The combat screen | What the player sees during a fight | §6 The combat screen | `src/ui/` |

## 6. Progression and economy

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A36 | Items and the Bank | Items as currency, Bank tabs, search and sort, item sinks | §5 | `src/systems/inventory/` |
| A37 | The Guild Hall and Stars | The Hall, the star web, upgrades | §8 | `src/systems/progression/` |
| A38 | Quests and Limes | The tutorial NPC, lessons, quest bounties: how the game teaches itself | §8, §9 | `src/systems/quests/` |

## 7. World and time

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A39 | The world map and settling | The world map, settling new places, travel | §3 Maps (retired), §10 | `src/systems/world/` |
| A40 | Regions | Region rules, ground and terrain, region modifiers | §3 | `src/systems/atlas/`, `board/` (GroundRules, SiteRules) |
| A41 | Time away and saving | Catch-up after being away, what a reload keeps, save files | §10 | `src/systems/core/` (CatchUp, SaveManager, SaveFiles, TimeManager) |

## 8. Screens and feedback

| # | System | What it covers | GDD | Code to start from |
|---|---|---|---|---|
| A42 | Notifications | Banners, catch-up news, recipe unlocks | §9 | `src/systems/notifications/` |
| A43 | Cards, badges and bars | How a Token, hero or item tells the player what it is doing | §9 | `src/ui/`, `board/` (EffectFeedback, TokenGlows) |
