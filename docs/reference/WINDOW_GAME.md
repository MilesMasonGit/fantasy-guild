# `window.Game`: the engine handle for checks in the running game

Agents checking the running game read and drive it from the browser console
(`javascript_tool`) through `window.Game`. **The game itself never reads it**:
it exists for debugging and checks, and nothing breaks if an entry is renamed,
except the checks and docs that use it. (For how to run a check in the game,
see [`TESTING.md`](TESTING.md), "Running the game for verification".)

## Where it comes from

- `src/main.jsx` sets `window.Game` to `EngineBootstrap.getEngine()` and
  `window.GameState` to the same `GameState` object, **in the dev build only**
  (`import.meta.env.DEV`). A production or perf build has neither.
- On the perf build the drawing and drag benches use `window.__perf.game`
  instead (`src/ui/dev/perf/perfHarness.js`): every `window.Game` entry plus
  `NotificationSystem`, `Shop`, `MatCap`, `EquipmentValidator` and
  `getAllItems`.
- The list is `getEngine()` in `src/systems/core/EngineBootstrap.js`. To add an
  entry, add it there, then add its row below.
- Each entry is the **live module**, not a copy: what you change through it,
  the game sees. Calls that skip the game's own paths (adding a hero with
  `HeroManager.addHero` instead of recruiting) can produce states a player
  can't reach; prefer the dev panel or a QA fixture save for anything the
  owner will look at.

## The entries (32)

| Entry | What it is | Reached for most |
|---|---|---|
| `GameState` | the whole save in memory; `GameState.state` is the raw object | `.state`, `.heroes`, `.inventory`, `.board`, `serializeJson()` |
| `EventBus` | the engine's events | `subscribe(name, fn)`, `publish(name, payload)`, `setLogging(true)` then `getEventLog(50)`, `hasSubscribers(name)` |
| `SaveManager` | save slots | `save()`, `loadSlot(i)`, `newGame(i)`, `deleteSlot(i)`, `getCurrentSlot()`, `exportSave()` |
| `InventoryManager` | the Bank | `addItem(itemId, amount)`, `removeItem(itemId, amount)`, `getItemCount(itemId)` |
| `HeroManager` | the roster | `getAllHeroes()`, `getHero(id)`, `getIdleHeroes()`, `modifyHeroHp(...)` |
| `SkillSystem` | hero skills and XP | `getSkillLevel(heroId, skillId)`, `addXP(heroId, skillId, amount)` |
| `PromotionSystem` | promoting a mastered hero | `canPromote`, `promote`, `previewPromotion` |
| `WoundedSystem` | wounded heroes and recovery | `getWoundedHeroes()`, `recoverHero(...)`, `isWounded(...)` |
| `LootSystem` | kill loot rolls | `previewDrops(...)` |
| `EquipmentManager` | hero gear | `equipItem`, `unequipItem`, `getAllEquipment` |
| `BoardState` | what is on the mat | `tokens()`, `getTokenById(id)`, `tokensAtPoint(x, y)`, `heroesOnBoard()`, `createTokenInstance(typeId)` |
| `BoardPlacement` | putting things on the mat | `placeTokenAt(instance, point)`, `moveTokenTo(id, point)`, `removePlacedToken(id)`, `plantFlagAt(heroId, point)`, `recallHeroById(heroId)` |
| `SpriteLayer` | loot lying on the mat | `getSprites()`, `collectAll()`, `countOnBoard(...)` |
| `BoardRunner` | the per-Token work each tick | `isHeroIdle(...)` |
| `InputAllocator` | which inputs a Token can draw on | `checkInputs`, `getStarvationStats()` |
| `TileModifiers` | the cached effects Tokens put on their neighbours | `rebuildAll()`, `getTokenAggregator(...)` |
| `RecipeResolver` | which recipe a Token runs, and why not | `resolveRecipe`, `getMissingRequirements` |
| `BoardCombat` | fights on the mat | `getFight(...)`, `fightOfHero(heroId)`, `endFight(...)` |
| `BoardPromotion` | promotion Tokens | `getOffer`, `accept`, `decline` |
| `Flags` | heroes' flags (where a hero works) | `plant`, `assignHero`, `statusOf`, `setRule` |
| `FlagRules` | a flag's work rules | `ruleOf`, `rowsFor` |
| `Demolition` | taking Tokens down | `canDemolish`, `mark`, `unmark`, `markedTokens()` |
| `QuestManager` | quests | `getActiveQuests()`, `claimQuest(...)`, `getTutorialStep()` |
| `QuestTokens` | quests and bounties as Tokens on the mat | `questTokens()`, `spawnQuest`, `spawnBounty` |
| `EnemyMotion` | enemies walking | `isWalking`, `bodyOf` |
| `Hostiles` | enemies noticing heroes | `scan` |
| `Atlas` | Regions and travel | `list()`, `activeRegion()`, `travel(id)`, `devCreateEmptyRegion()`, `devGrantMaps(count)`, `devSettle()` |
| `TimeManager` | the game clock and pause | `pause()`, `resume()`, `getIsPaused()`, `getGameTime()` |
| `GuildUpgradeManager` | the Guild Hall upgrade tree | `getRanks()`, `canAfford(...)`, `purchase(...)` |
| `GameLoop` | the tick loop | `runHandlers(ms)`, `stop()`, `start()`, `getTickCount()` |
| `CatchUp` | offline progress | `run({ savedAt, ... })` (async), `isRunning()`, `lastResult()` |

The middle column is a summary; check a function's arguments in its file
before relying on them (the file is the import in `EngineBootstrap.js`).

## Recipes agents use

- **Run game time without waiting** (the preview pane barely ticks):
  `for (let i = 0; i < 400; i++) Game.GameLoop.runHandlers(100)` runs 40 s of
  game time in 100 ms steps.
- **See which events fired**: `Game.EventBus.setLogging(true)`, do the
  thing, then `Game.EventBus.getEventLog()`. (`setLogging` has no caller in
  the code on purpose; don't delete it as dead.)
- **Catch a notification**: subscribe to `'notification_added'` on
  `Game.EventBus` before the action.
- **Stop the loop for a measurement**: `Game.GameLoop.stop()`, and `start()`
  after.
