# D2: Heroes, combat, gear and XP, read deep

*Reviewer session D2, 2026-11-15, read at commit **dcb3ff40** in the worktree `.claude/worktrees/rw`.
The second session of the deep read the owner asked for on 2026-11-15: hunt bugs a player can hit,
one area properly. Method: the area was cut into eight pieces (combat maths; a fight's life from the
hero's side; defeat and healing; food, drink and elixirs; gear and tools; XP, skills and perks;
effects and modifiers; loot and the Bank) and two cross-cutting traces (every per-hero field across
save, load, travel and catch-up; every number shown about a hero against the engine). Ten read-only
readers each read their files whole and tried to disprove each lead before reporting it. Nothing was
run: no tests, no bench, no game. Focus: bugs a player can hit. Every finding below still waits for
its second reader (`Verified by: pending`).*

## Summary for the owner

TODO

---

## Findings

### CR4-126  With the Larder star, a hero never eats their second Food, even when the first has run out
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/hero/ConsumptionSystem.js:43-45`, `src/systems/hero/ConsumptionSystem.js:72-76`, `src/systems/hero/ConsumptionSystem.js:101-106`, `src/systems/equipment/loadoutCaps.js:12-17`, `src/systems/equipment/EquipmentManager.js:35-47`, `src/systems/equipment/EquipmentManager.js:150`, `src/config/registries/equipmentCategories.js:58`, `src/systems/combat/DefeatPenalties.js:31-40`, `src/systems/combat/CombatAttackProcessor.js:82`, `src/systems/hero/RegenSystem.js:56`, `src/systems/combat/Arrows.js:42-48`, `src/systems/board/Fishing.js:41-52`, `data/hallStars.json` (`star_larder`)
- **What**: The Guild Hall star Larder ("Every hero may carry a second Food", 4,000 Cherries) lets a hero carry two different Foods, but eating only ever looks at the first Food in grid order. While the Bank holds any of the first, only that one is eaten. When the Bank runs out of the first, the hero stops eating altogether, in a fight and out of one. Buy Larder, give a hero Redberry in an earlier slot and Blueberry Pie in a later one (or Shrimp and Steak), let the first run out and send the hero at an enemy: they drop under a quarter health, never touch the second Food, and are knocked out with food in hand. So the star buys nothing today, it hides the "out of food" state behind a loadout that looks stocked, and on a knock-out the second stack still loses its quarter.
- **Evidence**: `equippedOfCategory(hero, 'food')` is `getEquippedEntries(hero).find(e => e.category === categoryId)`: the first match, whatever the Bank holds. `consumeEquipped` then returns null at `if (!InventoryManager.hasItem(entry.itemId, 1)) return null;` (`:76`) with no look at the next Food. `tryEat` (`:101-106`) is the only eating path (callers `CombatAttackProcessor.js:82`, `RegenSystem.js:56`; grep for `tryEat(` and `equippedOfCategory`). The cap really is raised: `loadoutCapOf` adds the guild aggregator's `LOADOUT_SLOTS` for the category (`loadoutCaps.js:15`), `star_larder` provides `LOADOUT_SLOTS` flat 1 on `food`, Food's base cap is 1, and `resolveTargetSlot` only displaces once `held.length >= cap` (`EquipmentManager.js:39-42`). The same Food twice is refused (`EquipmentManager.js:150`), so the second is always a different item. Arrows and bait, written later, do skip an empty stack ("the first in grid order the Bank still holds"), so food is the odd one out. No shipped Food carries a rule of its own (all 25 have no effects), so a second Food has no other use. Found independently by two readers (consumption, effects); the consumption reader left the cap step assumed, the effects reader traced it.
- **Fix sketch**: In `consumeEquipped`, walk the hero's entries of the category in grid order and eat the first one the Bank still holds, as arrows and bait do. Which of two stocked Foods is eaten first (grid order, or the smaller heal first) is an owner call; grid order is the simplest. Must not change: one meal per call, the quarter-health threshold, the Preservation draw (one, for the item actually eaten, and none when no Preservation rule reaches), Burn's halving, and the random stream when the hero carries one Food (the bench's work check).
- **Verified by**: pending
- **State**: open

### CR4-127  A hero holding gear whose item was renamed or deleted in the CMS keeps a dead loadout slot for good, and every try says "Bank full"
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/inventory/InventoryManager.js:238-239`, `src/systems/equipment/EquipmentManager.js:252`, `src/systems/equipment/EquipmentManager.js:192-198`, `src/systems/equipment/EquipmentManager.js:286-300`, `src/systems/equipment/heldCopies.js:66-72`, `src/systems/hero/logic/HeroRehydration.js:68-80`, `src/systems/combat/DefeatPenalties.js:45`, `src/systems/hero/HeroEffects.js:53-54`
- **What**: Give any hero a piece of gear (say `item_copper_shield`), save, rename or delete that id in the CMS, Sync, load. The slot still holds the old id with its "holds a copy" mark. Right-click to unequip is refused with "Bank full" (the callout names the raw id), and so is dropping another item on the slot. The slot draws as empty ("+") because the item no longer resolves, so the player sees an empty slot that refuses everything. The hero is down to eight usable slots for good, and the copy itself is gone. It needs a CMS rename or delete of a gear id while a save has a hero holding it; the owner does rename ids.
- **Evidence**: `hasRoomFor` returns false for any id with no template (`InventoryManager.js:238-239`). `unequipItem` refuses when `holdsCopy && !hasRoomFor([itemId])` (`EquipmentManager.js:252`). `equipItem` onto that slot puts it in `leaving`, then `returning`, and `firstWithoutRoom` names it, so `bankFull` (`:192-198`). The load does not clear it: `rehydrateHero` copies every id as is (`HeroRehydration.js:69-71`), `normaliseHeldCopies` keeps the mark for any non-empty slot (`heldCopies.js:69`), and `reconcileHeldCopies` reaches the branch `!takesCopy && held && putBack(...)` where `putBack` fails on the same missing template, so nothing changes and nothing is reported in the "gear lost" notice (`EquipmentManager.js:297`). Defeat cannot clear it either: its category is null, so it is never rolled. `moveItem` still moves it, which only moves the dead slot. Such an item lends nothing and counts against no cap (`HeroEffects.js:53-54`). A shared item (food, drink, potion) with a deleted id is fine: no mark, so `vacate` empties it.
- **Fix sketch**: In `reconcileHeldCopies`, empty a slot whose id is not in the item registry and add it to the `lost` list so the one load notice says so. Must not change: a held copy of an item that still exists but is no longer gear goes back to the Bank as today.
- **Verified by**: pending
- **State**: open

### CR4-128  On a newly settled place, a hero whose enemy falls goes and stands behind another hero's fight while other arrival enemies stand free
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / medium
- **Confidence**: reasoned
- **Where**: `src/systems/board/Flags.js:538-547`, `src/systems/board/Occupation.js:70-84`, `src/systems/board/Flags.js:372-377`, `src/systems/board/Flags.js:385-386`, `src/systems/board/Flags.js:425-427`, `src/systems/board/Flags.js:883-884`, `src/systems/board/BoardRunner.js:857-859`, `src/systems/world/Arrival.js:199`, `src/systems/board/Flags.js:616`
- **What**: Settle a new place (its arrival enemies stand spread over the mat). Send hero A at arrival enemy 1 and hero B at arrival enemy 2, with a third enemy further off. When A wins first, A's order moves to the arrival enemy nearest the one that fell. If that is enemy 2, B is already fighting it, so A walks over and waits beside B's fight for as long as it lasts, while enemy 3 stands untouched. When B wins, both orders lapse together and both heroes are sent to the same next enemy: one fights, the other waits again. With two or more heroes the encounter is cleared roughly one enemy at a time, and a waiting hero shows no idle mark, so a returning player is not told.
- **Evidence**: `lapsePins` re-pins with `Occupation.nextEnemyAfter(flag.pinnedTo, flag)` (`Flags.js:540-542`). `nextEnemyAfter` loops `standingEnemies()` and keeps the smallest distance; it never asks who holds a claim (`Occupation.js:74-82`). The hero is then on a plain Token order whose `evaluate` has one candidate, the pinned Token (`Flags.js:373-376`); another hero holding it gives `SKIP.CLAIMED` and no pick, so `choose` only sets a one-second retry. Nothing re-runs `nextEnemyAfter` while the pinned enemy still stands (`Flags.js:537`). `waitingOf` reports `kind: 'fight'` and `isHeroIdle` returns `!kind` for a Token order, so no yellow mark. A camp order would pick the nearest free enemy, but arrival enemies belong to no camp (`Arrival.js:199`, `tether: null`) and a held mat refuses every camp order (`Flags.js:616`). The step the reader assumed: that an arrival holds three or more enemies (`src/systems/world/Arrival.js:21` says 3 to 6 and `data/world.json` carries `arrival` blocks; `generate.js` was not traced). Everything in the board code is traced.
- **Fix sketch**: In `nextEnemyAfter` (or its caller) prefer the nearest standing arrival enemy that no other hero has claimed, falling back to the nearest when all are taken. Must not change: the pick stays deterministic (distance, then written order) so a catch-up chooses as live play does, and a hero still waits rather than idling when every enemy is taken.
- **Verified by**: pending
- **State**: open

### CR4-129  Two heroes knocked out close together: the banner names them but drops what each one lost
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: reasoned
- **Where**: `src/systems/notifications/bannerKinds.js:68-77`, `src/systems/notifications/Banners.js:105-117`, `src/systems/notifications/routing.js:124-128`, `src/systems/board/BoardCombat.js:522`, `src/systems/board/BoardCombat.js:532`, `src/systems/notifications/catchUpNews.js:58-67`
- **What**: A knock-out's losses (a quarter of each carried food and drink stack, any gear piece that failed its 10 % roll, gone for good) are told to the player by one banner. When a second knock-out arrives while the first banner is still waiting behind another banner, the two merge, and the merged line is "Ana and Bo knocked out and carried home" with no losses at all. A sword destroyed in that moment is never mentioned. To see it: send two heroes at enemies they cannot beat (two Thorn Elementals, or a camp's enemies) while any other banner is on screen (a level-up, a first find), and let both fall within the queue's wait.
- **Evidence**: `knockout.text` prints `Lost: ...` only in the `heroes.length === 1` branch; the other branch is `${nameList(heroes)} knocked out and carried home` (`bannerKinds.js:72-74`). `knockout` defines `merge` and not `mergeShown`, so `Banners.push` folds a new knock-out into a waiting knock-out banner (`Banners.js:109`), never into the one on screen. The merged `parts.lost` is still held (`union(a.lost, b.lost)`, `:76`) and simply not printed; `union` also folds two identical strings into one, so "3 Shrimp" lost by each of two heroes would read once even if printed. The catch-up's return report is not affected: it keeps a row per hero with that hero's own list. The step the reader assumed: that no other live surface lists a knock-out's losses (the banner, the routing and the catch-up news were read; the log panel and the hero sheet were not).
- **Fix sketch**: Print the losses in the many-hero line too, per hero ("Ana lost: Iron Sword. Bo lost: 3 Shrimp."), which means carrying `lost` per hero in the banner's parts rather than as one merged list. Must not change: one banner per knock-out in the ordinary case, and the single-hero wording.
- **Verified by**: pending
- **State**: open

### CR4-130  The fight panel shows an elixir as working, one fight too high, when it was put on mid-fight
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/ui/components/combat/fightView.js:140-155`, `src/systems/hero/ConsumptionSystem.js:185-212`, `src/systems/board/BoardCombat.js:388-398`, `src/systems/board/Flags.js:1062`, `src/systems/quests/QuestManager.js:197`
- **What**: An elixir is counted and its effect put on only at the moment an enemy steps up. A hero who has fights left on an Elixir of Valor (drank one earlier, took it off, or handed it away and got it back) and equips it during a fight is listed in the fight panel as having it working, with the count "fights left + 1", but this fight has no Valor on the hero and is not counted. At the next enemy the count is taken for real, so the number on screen drops by two across one kill.
- **Evidence**: `activeElixirsOf` lists an elixir when `working || left > 0` and shows `count: inFight ? left + 1 : left`; `working` (the effect is on the hero) is not required for the +1. `startFightElixirs` runs only from `LoadoutMoments.fire(..., 'COMBAT_ENGAGED')`; nothing fires on `HERO_EQUIPMENT_CHANGED` (its only engine listeners are `Flags.js:1062`, which marks flags dirty, and `QuestManager.js:197`).
- **Fix sketch**: Show the +1 only when the elixir's effect is on the hero for this fight (`working`); otherwise show `left`. Engine unchanged.
- **Verified by**: pending
- **State**: open

### CR4-131  An item handed from one hero to another by dropping it on the hero is refused when the taker's nine slots are full, where the same item from the Bank would simply replace what they hold
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/equipment/EquipmentManager.js:161-163`, `src/systems/equipment/EquipmentManager.js:168-170`, `src/systems/equipment/EquipmentManager.js:40-41`, `src/systems/equipment/EquipmentManager.js:192-198`, `src/ui/components/dock/DockHeroFigure.jsx:79`
- **What**: Hero B has all nine slots filled, one of them a Copper Sword. Drag hero A's Iron Sword onto B's figure (not onto a slot): "No free slot in the loadout". Drag the same sword from the Bank onto B's figure: it replaces the Copper Sword. The same holds for a hat onto a hero with a hat, and so on.
- **Evidence**: The hand-over branch refuses on `findFreeSlot(hero) === -1` before the slot is resolved, though the code just below would put a weapon in the rival weapon's slot (`:168-170`) or displace the oldest of a capped category (`resolveTargetSlot`, `:40-41`), and the Bank-room check for what is displaced already runs for hand-overs (`:192-198`, `freed` null).
- **Fix sketch**: Drop the early refusal and let the normal slot resolution decide; it already returns "No free slot" when nothing can be displaced. Must not change: a hand-over never touches the Bank's copy count for the handed item.
- **Verified by**: pending
- **State**: open

### CR4-132  The Fine Fishing Rod's "100% more bites of any fish" changes nothing
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `data/effects.json:1192-1213` (`effect_keen_line`), `data/items.json:1887` (`item_fine_fishing_rod`), `src/systems/board/Fishing.js:84-85`, `src/config/registries/catchPools.js:106-122`, `src/systems/effects/statementText.js:202-205`, `src/systems/board/TileModifiers.js:1094`
- **What**: Catch Weight is "how often one fish bites": a percentage on that fish's weight in the water's pool, the fish being the rule's narrowing. Keen Line, the Fine Fishing Rod's only effect, is authored with no fish named, and the engine then applies +100 % to every fish in the pool alike. The catch is picked by relative weight, so doubling every weight gives exactly the same odds as before. The card says "Gives the hero 100% more bites of any fish", which reads as a real bonus; in play the rod is identical to the plain rod. Fish any water with each rod: same catch odds, same cycle time, same yield.
- **Evidence**: `catchOf` resolves each fish's weight through `resolveAxis(instanceId, CATCH_WEIGHT, c.weight, c.itemId)` (`Fishing.js:84`); a carried rule with no `category` passes the hero-side narrowing for every category (`TileModifiers.js:1094`), so every weight becomes `w * 2`. `pickCatchIndex` rolls `random() * total` over the weights (`catchPools.js:119`), which is scale-free. Nothing else reads `CATCH_WEIGHT` (grep: `Fishing.js:84` only). The sentence for a blank category is written to say "any fish" (`statementText.js:203`), so the CMS presents the no-op form as a meaningful one. The payload in `data/effects.json`: `type CATCH_WEIGHT, bucket percentage, value 1`, no `category`.
- **Fix sketch**: Either name the fish in Keen Line (a content fix) or decide what "any fish" should mean and say so; which is the owner's call. In both cases have `ContentAudit` name a Catch Weight rule with no fish, since the engine cannot make it do anything. Must not change: the pick's single draw.
- **Verified by**: pending
- **State**: open

### CR4-133  XP an hour, "Next level" time and an item's "/hr" read too high, most after a single gain or on slow work, and the skill panel's figures freeze while it stays open
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/hero/XpRateTracker.js:10-11`, `src/systems/hero/XpRateTracker.js:57-70`, `src/systems/inventory/ItemRateTracker.js:12`, `src/systems/inventory/ItemRateTracker.js:63-79`, `src/ui/components/dock/heroPanelSkills.js:72-89`, `src/ui/components/dock/heroPanelSkills.js:108-114`, `src/ui/components/dock/HeroSkillPanel.jsx:90`, `src/ui/components/dock/HeroSkillPanel.jsx:314-315`, `src/ui/components/drawer/HeroInspectionSheet.jsx:59-74`, `src/ui/components/drawer/HeroInspectionSheet.jsx:293-294`
- **What**: The rate is "everything gained in the last 5 minutes" divided by "the time since the first of those gains", with a 15 s minimum (30 s for items). The first gain is counted in the total but the time it took to earn is not, so n gains are divided by n-1 gaps: the figure is right just before a gain and too high just after one. A hero who wins one fight worth 39 XP and is recalled shows about +9,360 XP an hour for 15 s, +2,340 a minute later, and a falling "rate" for five minutes though nothing is being earned. In steady work it is a sawtooth at or above the truth: under 2 % for a 5 s vein, about 4 % for a 12 s station cycle, up to 25 % for a kill a minute, up to double for a boss beaten every 2.5 minutes, where "Next level" (which divides by this rate) reads half the real time. Second part: the skill panel and the skill hover read the rate only when they draw, and they redraw only when that hero's skills or health change. A hero taken off Mining with the Mining panel left open keeps the last "+1,234 XP/h" and "Next level 4:05" on screen for as long as nothing about them changes; closing and reopening shows "–".
- **Evidence**: `getRate`: `totalAmount` is the sum of every entry and `durationMs = Math.max(now - entries[0].timestamp, MIN_WINDOW_MS)` (`XpRateTracker.js:62-67`; the same shape in `ItemRateTracker.js:69-78`). `prune` drops entries older than 5 minutes. N evenly spaced gains just after the Nth give N·x / ((N-1)·T), against a true x / T. `skillDetail` turns it into the time to level (`left / rate * 3600`, `heroPanelSkills.js:87`) and uses the figure as given. `SkillNumbers` calls `XpRateTracker.getRate` in its render body with no poll or subscription (`HeroSkillPanel.jsx:314-315`); its parent's signature holds only name, hp and skills (`HeroInspectionSheet.jsx:59-74`); `DockEquipmentGrid` has `onPoll`, this does not. `recordGain` records what was banked (`src/systems/hero/SkillSystem.js:106`), so the amounts themselves are right; XP for Everyone is left out on purpose and is not part of this. Found independently by two readers (XP and skills; shown against real), with the same arithmetic. The item stub's other fault (what it counts, not how it divides) is CR4-134.
- **Fix sketch**: Divide by the span the gains cover including the first one's own interval (or count n-1 gains over the span from first to last and show nothing until there are two), and let the open panel look again every second or two. Must not change: the 5-minute window, "not counted: XP for Everyone", and the readout staying on the game clock (`GameClock.now()`) so a catch-up's last minutes read the same as live play.
- **Verified by**: pending
- **State**: open

### CR4-134  The per-hour figure on an item stub counts loot the moment it drops, and misses spending that never passes through the Bank
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified for the floor case (every step traced); the catch-up case is reasoned
- **Where**: `src/systems/board/SpriteLayer.js:286`, `src/systems/board/SpriteLayer.js:485-499`, `src/systems/board/InputAllocator.js:57-63`, `src/systems/notifications/routing.js:69-78`, `src/systems/notifications/routing.js:292`, `src/systems/inventory/ItemRateTracker.js:63-96`, `src/ui/components/notifications/ItemStubColumn.jsx:140`, `src/ui/components/notifications/ItemStubColumn.jsx:173`, `src/systems/core/SaveManager.js:30`
- **What**: The net per hour shown on an open or pinned item stub is too high for any item a station eats off the floor. Put a hero on a tree making Oak Wood and a hero on a station whose recipe takes Oak Wood, with the Bank holding none (or auto-collect off, or the Bank's 64 kinds full): the station pays from the piles on the mat, and the pinned Oak Wood stub reads the full gathering rate as net gain while the Bank's count does not move. The same after time away: for the first five minutes back, every item's figure shows what was made in the last five minutes of the catch-up with none of what was spent. The reader rated it P3, or P2 if the owner reads the pinned stubs as the measure of a chain, since that is the only number the readout exists to give.
- **Evidence**: Gains are recorded when a sprite is created, not when it is banked: `SpriteLayer.addSprite` calls `ItemRateTracker.recordGain(refId, quantity)` (`:286`). Spending is recorded only in the notifications route for `INVENTORY_UPDATED` with `removed > 0` (`routing.js:72-74`; its comment: "Gains are counted where they are made, spending here"). `InputAllocator.consumeInputs` takes from the Bank first, then calls `SpriteLayer.consumeFromSprites` for the rest; that reduces the piles and publishes only `SPRITES_CHANGED`: no `INVENTORY_UPDATED`, no `recordLoss`. Every route in `routing.js` is subscribed as a `UI_LISTENER` (`:292`), and a catch-up's quiet bus skips those (`EventBus.js:96-98`, `src/systems/core/CatchUp.js:274`), while `addSprite` still records gains on the game clock. Same root, smaller: a gain that enters the Bank without a sprite is never counted (a Shop refund, `Shop.js:230-232`), and a pile the full Bank refuses counts as gained for as long as it is produced. `ItemRateTracker.clearAll()` runs on load, which is before the catch-up, not after. The step assumed for the catch-up case: that a catch-up shorter than 24 h ends with its clock at about the wall clock, so the last five game minutes stay inside the window (`CatchUp.run` was not read whole).
- **Fix sketch**: Record the loss where the floor is spent (`consumeFromSprites`), and record Bank spending in an engine listener rather than a UI route so a catch-up counts it (or clear the tracker when the catch-up ends). Must not change: gains counted once (not again on collection), and no new `Math.random` draw or engine-visible effect from the tracker (the bench's work check).
- **Verified by**: pending
- **State**: open

### CR4-135  Two heroes can arrive with the same name
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/config/registries/nameRegistry.js:39-41`, `src/systems/hero/HeroGenerator.js:24`, `src/systems/hero/logic/HeroLifecycle.js:47-71`, `src/systems/progression/GuildUpgradeManager.js:168`
- **What**: A recruit's name is one random pick from 96 names, with no look at the roster. With seven recruits after the first hero (a roster of 8), about one guild in five ends up with two recruits sharing a name, and more if a recruit matches the name the player typed for the first hero. Every notice that names a hero then cannot be told apart: the "joined" banner, the recipe-unlocked banner, the knock-out banner ("Wren was knocked out"), the "While you were away" level-up and knock-out rows. Reproduce: buy Bunk Beds ranks until two heroes share a name (or use the QA panel's hire button a few dozen times).
- **Evidence**: `getRandomName()` is `FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]`; `generateHero` uses it when no name is given; `createHero` and `addHero` check the id for duplicates (`addHero` only) and never the name. 1 - (95/96 × 94/96 × … × 90/96) ≈ 0.20 for seven picks. What softens it: ids are unique (`hero_` + `nanoid(8)`), so nothing in the engine confuses the two, and the player can rename a hero (`HeroState.updateHeroProfile`).
- **Fix sketch**: Pick from the names no hero on the roster holds, falling back to any name when all are taken. Must not change: a name the player typed stays as typed; the pick stays one `Math.random()` draw at a purchase (it is outside the tick, so the bench's work is untouched).
- **Verified by**: pending
- **State**: open

### CR4-136  The Accuracy and Dodge rows do not say a miss chance is held between 5 % and 40 %, so a bow's Accuracy can show and do nothing
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/ui/components/dock/HeroCombatView.jsx:76-81`, `src/i18n/en.json:653`, `src/config/FormulaRegistry.js:55-68`, `src/systems/combat/CombatFormulas.js:159-161`, `src/systems/combat/CombatFormulas.js:222-224`, `src/ui/components/combat/fightView.js:30-31`
- **What**: The hero drawer's Combat view shows "Accuracy 5%" for a Copper Bow (10 % for an Iron Bow, the same effect at scale 2) with the tip "Taken off the hero's chance to miss". The engine's miss chance is 10 minus the level gap (kept 5 to 25), plus the enemy's Dodge, minus Accuracy, then kept between 5 and 40. Against any enemy at or below the hero's level with no Dodge, 5 points of Accuracy already reach the 5 % floor, so the Iron Bow's second 5 changes nothing; five levels above the enemy, no Accuracy changes anything. The same holds for Dodge against the 40 % ceiling. Example: a Ranged hero at level 6 with an Iron Bow against a Cow (level 1): the row says 10 %, the miss chance is 5 % with the bow and 5 % without it. A state with no text, not a wrong number.
- **Evidence**: `missChance` clamps twice (`FormulaRegistry.js:64-68`, `MISS.MIN: 5`, `MISS.MAX: 40`). `heroAccuracy` is the raw sum (`CombatFormulas.js:159-161`) and that is what the row prints (`HeroCombatView.jsx:76-78`). The CMS's own hint for Dodge says "misses stay between 5% and 40%" (the DODGE row of `modifierPalette.js`); the player's tip does not. Nothing on screen shows the resulting miss chance (by design, "no forecast"), so the floor is invisible.
- **Fix sketch**: Add the bounds to the two tips ("…, never below 5% or above 40%"). Must not change: the formula and "no forecast".
- **Verified by**: pending
- **State**: open

### CR4-137  Losing a fight can destroy the guild's only pickaxe or woodaxe, and the starter tools are never given again
- **Tag**: bug, owner-decision
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/combat/DefeatPenalties.js:44-51`, `src/config/loopConstants.js:84`, `src/systems/equipment/StarterTools.js:34-52`, `src/systems/equipment/EquipmentManager.js:262-271`, `data/tokenRecipes.json:42-78` (Copper Pickaxe), `data/tokenRecipes.json:79-109` (Copper Woodaxe)
- **What**: Every gear piece a defeated hero carries has a 10 % chance to be lost, and gathering tools are gear (`equipSlot: "hand"`). A new guild owns exactly one of each starter tool. A hero who carries the pickaxe into a Goblin fight and loses can lose it. Each starter is recorded as given and is never granted again, even when the guild owns no tool of that kind. Making another Copper Pickaxe needs 4 Copper Ingots, which come from Copper Ore, which comes from a vein that needs a pickaxe. The only other routes in shipped content are Goblin drops (ore 30 %), the Goblin Chief (ingot) and a Copper Chest; the Woodaxe needs Coal too (a Coal Vein needs a pickaxe; otherwise Fire Elementals or a chest). So it is not a hard lock, but an early guild with an empty Bank can be left unable to mine or chop until it wins fights, and the defeat notice says nothing of this beyond the item's name.
- **Evidence**: `isGearCategory('hand')` is true and the loop makes no exception for `toolOf(item)` (`DefeatPenalties.js:45-48`); `destroyEquipped` drops the held copy without return. `grantStarterTools` skips any id already in the record (`progress.starterTools`, `StarterTools.js:44`). Token tool needs and outputs were read from `data/tokens.json` (Copper Ore Vein, Coal Vein, Oak Tree, Goblin, Goblin Chief, Copper Chest); the recovery routes were read from `data/`, not played. The consumption reader raised the same question as a lead.
- **Fix sketch**: The owner's call, as multiple choice: (a) tools are exempt from defeat loss; (b) the last tool of a kind the guild owns is exempt; (c) keep as is. Must not change: weapons and armour still roll.
- **Verified by**: pending
- **State**: open

### CR4-138  A "+10 % XP" perk doubles the XP of every 1-XP job (Fishing, Smithing, Alchemy at level 10)
- **Tag**: bug, owner-decision
- **Priority / Effort / Risk**: P3 / S / medium
- **Confidence**: verified
- **Where**: `src/systems/hero/xpBonus.js:15-18`, `src/systems/board/BoardRunner.js:400-406`, `src/systems/combat/CombatResolutionProcessor.js:27-32`, `src/systems/board/EffectBreakdown.js:249-263`, `data/skillPerks.json` (fishing, smithing, alchemy at level 10), `data/effects.json` (`effect_patient_line`, `effect_even_heat`, `effect_steady_hand`, `effect_merry`, `effect_starry_night`)
- **What**: Any positive XP bonus adds at least 1 whole XP to an award. On a 1-XP cycle "+10 %" is therefore +100 %; on 2 XP it is +50 %, on 3 XP +33 %, on 5 XP +20 %, and it only becomes a true 10 % from about 15 XP up. A hero who reaches Fishing 10 (perk Patient Line, +10 % XP at Fishing) and works a Coast, River, Lake, Shrimp Coast or Fish Shoal (all 1 XP) now banks 2 XP a cycle instead of 1. The same for Smithing 10 (Even Heat) on Copper Ingot, Copper Pickaxe, Copper Dagger and Copper Sickle, and Alchemy 10 (Steady Hand). A second bonus on top (Merry's +10 % all-skill) adds nothing more at 1 XP, so the stacking the cards promise is also invisible at low XP.
- **Evidence**: `applyXpBonus(base, bonused)`: `if (bonused - base > 1e-9) return base + Math.max(1, Math.round(bonused - base))`. Its own comment states the intent ("+10% on a 1 XP award is 2, not a rounded-away 1"), so this is a deliberate floor, not a slip; the finding is its size against today's content, where most gathering Tokens and the first recipes pay 1 to 3 XP (script over `data/tokens.json` and `tokenRecipes.json`: 30+ Tokens at `xp: 1`). `EffectBreakdown.measureXp` uses the same function, so the Token card's XP row agrees with the engine; the perk's own text is the "+10 %". What that line reads on the hero sheet is reasoned: the reader read `heroPerks.perkLines` and `supportTag`, not the rendered text.
- **Fix sketch**: The owner picks: keep the floor (then the perk text could say "at least +1"), or carry the fraction by chance as blows do (`RNG.roundByChance`: 1.1 XP is 2 XP one time in ten), which makes +10 % mean +10 % at every size. The second changes the random-number stream and `heroXp` in the bench fingerprint. Must not change: a bonus is resolved once, where the XP is earned, never again in `addXP`.
- **Verified by**: pending
- **State**: open

### CR4-139  Changing a fighting hero's weapon just before the kill sends the whole kill's XP to the new weapon's skill, skips the weapon's wear roll, and can give two swings at once
- **Tag**: bug, owner-decision
- **Priority / Effort / Risk**: P3 / M / medium
- **Confidence**: reasoned
- **Where**: `src/systems/combat/CombatResolutionProcessor.js:41-45`, `src/systems/combat/CombatFormulas.js:64-67`, `src/systems/combat/CombatProcessor.js:74-80`, `src/systems/combat/CombatAttackProcessor.js:133`, `src/systems/combat/CombatFormulas.js:128-130`, `src/systems/equipment/Breakage.js:69-73`, `src/systems/equipment/EquipmentManager.js:135-141`, `src/systems/board/Flags.js:1062`
- **What**: The style, the swing time and the swung weapon are all read live, with nothing remembered per fight. Three things follow. **XP**: a hero with Melee 30 and Magic 1 fights a Goblin Chief with an Iron Sword; with the Chief nearly dead the player swaps in a Copper Wand, and the kill's full XP goes to Magic. Any style can be trained with the strongest weapon the hero has. **Wear**: unequip the weapon before the last swing lands (a punch, or a poison tick, finishes it) and the weapon that did the fight is never rolled for breaking. **Burst**: a hero 3.9 s into an Iron Greatsword's 4 s swing who is handed an Iron Dagger (2 s) swings on the next tick with 2 s still banked, and again the tick after: two dagger hits 100 ms apart.
- **Evidence**: `handleVictory` reads `getHeroCombatStyle(h)` at the kill and pays the award into it; the style is the weapon in hand now. `Breakage.afterKill` rolls `getHeroWeaponSlot(hero)` at the kill (`Breakage.js:72`), and barehanded there is nothing to roll. The swing timer accumulates regardless of weapon, the swing time is re-read every tick, and one swing's time is subtracted per swing. `equipItem` checks only `EquipmentValidator.canHeroEquip`, which has no test of the hero's status or of a live fight; nothing subscribes to `HERO_EQUIPMENT_CHANGED` to end or restart a fight (`Flags.js:1062` only re-runs its choice pass); the fight object stores no style or weapon. The step the reader assumed: that the hero's loadout screen lets the player change gear while the hero is in a fight. The engine has no guard; the UI was not read.
- **Fix sketch**: The owner's call, since either fix takes something the player can do today: refuse loadout changes to the hands while `BoardCombat.fightOfHero(heroId)` is set, or note the style on the fight at each engagement, pay XP and roll wear from that, and zero the hero's swing timer on a weapon change. Must not change: food, arrows and elixirs staying swappable mid-fight, and the draw order of a swing.
- **Verified by**: pending
- **State**: open

### CR4-140  A timed buff on a hero (none exists yet) would stop counting in fights after every reload, and "Load as I left it" would wipe it
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / M / medium
- **Confidence**: verified
- **Where**: `src/systems/core/LoadedState.js:19-22`, `src/systems/hero/logic/HeroRehydration.js:42`, `src/systems/equipment/EquipmentManager.js:311-337`, `src/systems/effects/LiveEffects.js:540-567`, `src/systems/effects/LiveEffects.js:333-344`, `src/systems/effects/LiveEffects.js:451-458`, `src/systems/effects/LiveEffects.js:190-192`, `src/systems/board/BoardCombat.js:569-572`, `src/systems/core/GameClock.js:17-19`, `src/systems/core/SaveManager.js:445-454`, `src/state/GameState.js:9-12`
- **What**: Latent: no shipped effect is applied "for N seconds or minutes", but the CMS can author one today (a "Well Fed: +25 % damage for ten minutes", a crit potion "for a while"). Two things would go wrong. **(1) Its fight numbers vanish on load.** The effect is saved on the hero and still shows in their effect list after a reload, but the Damage, Armor, Dodge, Resistance or Food Healing it provides is no longer counted in fights until that hero's effect list changes for some other reason. Its board numbers (work time, loot, XP) are unaffected. The same save loads differently depending on whether the hero was mid-fight when it was written. **(2) "Load as I left it" does not leave it as it was.** The effect's end is stored as a wall-clock moment. An undone catch-up rewrites the save's date to now and loads without a catch-up, so the first 3-second effects tick sees a wall clock already past the stored end and drops the buff, however much of it was left when the player closed the game. How this differs from ticket T-077 (the timer across a reload): in (1) the time left may be right and the number is still gone. Part (2) is about the same wall-clock stamp T-077 covers, by the undo route; triage should check it against that ticket.
- **Evidence**: (1) A hero's combat numbers sit on their aggregator under three sources: gear and perks (`equip:loadout`), the enemy they fight (`fight:<id>`), and carried effects (`live:effects`). `rehydrateHero` does `hero.aggregator = new ModifierAggregator(hero.id)` (`HeroRehydration.js:42`); `loadSavedState` follows it with `recalculateEquipmentModifiers(hero)` only, which writes `equip:loadout` alone (`EquipmentManager.js:324`). `LiveEffects.syncAggregator` is the only writer of `live:effects` and is called only from inside `LiveEffects.js` (grep: nine call sites), each time guarded by "something changed": `applyTo`, `endFightEffects` only `if (ended)` (`:339-340`), `tickBearer` only when something expired (`:454-456`). The load's own handler (`BoardCombat.js:571`) calls `endFightEffects` for every hero, so the timed effect is re-registered only if the hero also carried a for-the-fight effect when the game was saved. `GameState.js:9-12` says every stripped field must be rebuilt unconditionally by `rehydrateHero`; the aggregator object is, its `live:effects` contents are not. (2) `expiresAt = GameClock.now() + durationMs`; `GameClock.now()` is `Date.now()` outside a catch-up. `restoreAndReload` sets `data.savedAt = now` (`SaveManager.js:448-451`) and the reload opens the slot with `catchUp: false` (`takeResumeSlot`), so `tickBearer`'s filter `e.expiresAt > now` (`LiveEffects.js:452`) removes it. What saves shipped content: every effect a hero can carry today is for the fight or a status (stripped on load and re-applied at the next engagement: Valor, Ironskin, Venom, Burn) or for the cycle with board numbers only (the six drinks, Birdwatcher), which are read live from the list. `data/effects.json` has no `Applies` with `durationMs` above 0 (all 27 are 0 with `forFight`, `forCycle`, `forSwing`, or a status). Found independently by three readers (consumption, effects, the hero-state trace). They differ on two points: the consumption reader rated it P3 and the other two P2 for the day content reaches it (taken); and the effects reader counts a for-the-cycle effect with a combat number as hit too, where the consumption reader counted timed ones only (no shipped cycle effect carries a combat number either way).
- **Fix sketch**: Call `LiveEffects.syncAggregator(hero)` for every hero beside `recalculateEquipmentModifiers(hero)` in `loadSavedState` (after the fight-bound effects are stripped, or again after), or unconditionally in `BoardCombat`'s `GAME_LOADED` handler. For the second half, store a timed effect's remaining time rather than a wall-clock end, or shift every `expiresAt` by the amount `restoreAndReload` shifts `savedAt`. Must not change: for-the-fight and for-the-cycle instances keep `Number.MAX_SAFE_INTEGER`; the bench fingerprint of a save with no timed effect.
- **Verified by**: pending
- **State**: open

### CR4-141  A stronger tier (II to V) of an elixir, drink or arrow whose effect "Applies" something would be no stronger (no shipped item has one)
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / M / medium
- **Confidence**: verified
- **Where**: `src/systems/effects/statements.js:144`, `src/systems/effects/statements.js:387-390`, `src/systems/effects/effectLibrary.js:90-119`, `src/systems/effects/effectLibrary.js:189-208`, `src/systems/effects/LiveEffects.js:164-171`, `src/systems/effects/LiveEffects.js:255-294`, `src/systems/hero/HeroEffects.js:78-91`
- **What**: Latent, P2 when content reaches it. Every elixir, drink and potion works through a wrapper effect whose one rule is "Applies X" (Elixir of Valor applies Valor; Water Drink applies Refreshed; a bodkin's Sundering applies Sunder). An item refers to its effect with a scale, and the title shows it ("Elixir of Valor II"). For a `Provides` effect the scale multiplies the number (an Iron Dagger's Dagger II is +10 crit: that works). For an `Applies` effect the scale multiplies a field no authored rule has and no code reads, so nothing is multiplied: an "Elixir of Valor II" would give the same +1 damage as the plain one, a "Sundering III" arrow would land one stack like the plain one, and two items that merge onto one Applies effect add up to nothing more. Tiered drinks and elixirs are the obvious next content, and the CMS will show the numeral.
- **Evidence**: `scaleStatement` takes the field from the palette row or, for `Applies`, from the keyword (`scales: 'stacks'`, `statements.js:144`), then `const current = Number(payload[field]); if (!Number.isFinite(current)) return statement;` (`effectLibrary.js:110-111`): with no `stacks` field the statement comes back untouched. The blank `Applies` payload is `{ effectId, scale, durationMs, chance, target }` (`statements.js:390`). `payload.stacks` or `spec.stacks` is read nowhere in `src` or `cms/src` and written nowhere in `data/` (grep; the only hit is a test that hand-writes the field, `EffectLibrary.test.js:351`, which therefore pins behaviour content cannot reach). `applyStatus` adds exactly one stack per landing (`LiveEffects.js:275`), and `applyTo` takes the applied effect's strength from the payload's own `scale` (`:171`), which the bearer's scale never touches. Shipped: every Applies wrapper is referenced at scale 1 (items listed by script).
- **Fix sketch**: For `Applies`, let the bearer's scale multiply the payload's `scale` (the applied effect's tier, capped at 5) for an ordinary effect, and the number of stacks landed for a status; or have the CMS and `ContentAudit` refuse a scale above 1 on an effect whose rules are all `Applies`. Must not change: scale 1 behaviour (everything shipped).
- **Verified by**: pending
- **State**: open

### CR4-142  Loot rules and drop shapes that mean one thing on a station and another on a kill (no shipped content reaches them)
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / M / medium
- **Confidence**: verified in code for each item; that the CMS can author item 1 is reasoned
- **Where**: `src/systems/combat/LootSystem.js:41-46`, `src/systems/combat/LootSystem.js:51-52`, `src/systems/combat/LootSystem.js:58-60`, `src/systems/combat/LootSystem.js:66`, `src/systems/combat/LootSystem.js:80`, `src/systems/combat/LootSystem.js:130-132`, `src/systems/combat/CombatResolutionProcessor.js:27-32`, `src/systems/combat/CombatResolutionProcessor.js:44-45`, `src/config/registries/enemyProfile.js:194-204`, `src/utils/RNG.js:14-16`, `src/config/registries/tokenConstants.js:506-512`, `src/systems/effects/ModifierAggregator.js:275-281`, `src/systems/board/BoardRunner.js:350-352`, `src/systems/board/BoardRunner.js:368-372`
- **What**: Latent, P2 once content uses any of them. Four differences between "a kill is a cycle of the enemy Token" as written and as coded; none is reachable with shipped data (checked by script).
  1. **A loot rule narrowed to a combat style never reaches a kill.** "+10 % XP on Melee" works on a kill and "Double Loot on Melee" does not; un-narrowed rules do apply. `LootSystem` resolves Double Loot, Yield and Lucky with `skill = typeDef?.config?.skill || ''` (`:51`), every shipped enemy has `config.skill: ""`, and a targeted rule matches only when its category equals the asked one or is its parent (`ModifierAggregator.js:277-281`). The kill's XP, a few lines away, is resolved with the hero's style.
  2. **An enemy with no item drop lines and no rare table gets no nearby Bonus Drop.** `handleCombatVictory` returns at `:43-46` before `OutputRules.dropBonusGrants` at `:80`; a station with no outputs still rolls its bonus grants.
  3. **An enemy output that names a Token is dropped without a word.** `enemyDropsOf` keeps only outputs with an `itemId` (`enemyProfile.js:197`); a station places a `tokenId` output beside itself.
  4. **A drop line with min above max rolls a different range on a kill.** `randomInt(5, 2)` is `floor(random * -2) + 5`: 3 or 4, never 2 or 5. A station's `outputRange` swaps an inverted range first (`tokenConstants.js:511`) and rolls 2 to 5. The rare table normalises its own range (`rareTables.js:41`) and is unaffected.
- **Evidence**: As cited per item. Checks that could have saved it and did not: no normalisation between `enemyDropsOf` and `randomInt`; no fallback from `''` to the fighter's style; `TARGET_CATEGORIES.ALL` is matched only on the rule's side, not the asker's. For item 1 the reader did not open the CMS's effect editor to confirm it offers a combat style as a loot rule's narrowing; the runtime accepts it. Data by script: 18 enemy Tokens, all with item drop lines, none with a rare table; no output with min above max; no shipped loot rule narrowed to a combat style.
- **Fix sketch**: Resolve a kill's loot axes with the fighter's combat style (as `killXp` does), roll kill lines through `rollOutputQuantity`, and let a drop-less kill still reach `dropBonusGrants`. Must not change: the order and count of `Math.random` draws for today's content (one per line with chance under 100, then the range roll, then `roundUp`), which the bench's work check pins.
- **Verified by**: pending
- **State**: open

### CR4-143  Shapes the CMS can author today that the hero, gear and fight code gets wrong (no shipped content reaches them yet)
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified, except item 9 (reasoned)
- **Where**: listed per item
- **What**: The readers found these faults waiting for the first item, perk or enemy that uses the shape. Each is a defect the day content arrives, and the content agent should know them before planning such content.
  1. **A fighter whose swing takes under a second swings only once a second in a catch-up, then unloads the backlog when live play resumes.** This is CR4-124 item 9 found again from the hero's side, with more detail. Swing Time is clamped to a factor of 0.25 to 4, so a fast (2 s) weapon or enemy can be brought to 500 ms; a catch-up advances 1,000 ms a step and each side swings at most once per step, so a 500 ms swinger lands half its swings while the player is away and its timer grows by 500 ms every step without limit. Back in live play it then swings every tick until the stored time is spent: after ten minutes away, about ten minutes' worth of missed swings arrive in a minute. Neither side loops and neither caps the carried time (`src/systems/combat/CombatProcessor.js:74-80`, `src/systems/combat/CombatAttackProcessor.js:133`, `:188-199`, `src/config/FormulaRegistry.js:180`, `src/config/loopConstants.js:23`, `:36`, `src/systems/combat/CombatFormulas.js:128-130`, `:199-201`). Fix: make both swings a `while` over the accumulated time, or floor a resolved swing time at the engine's largest step; the draw order within one swing and the carried overshoot must not change. The combat-maths reader corrects CR4-124 item 9's "exactly 1,000 ms": see Notes.
  2. **A loadout slot whose item is no longer equippable costs a quarter of that item's Bank stack on defeat.** The food-and-drink loss is written as "everything that is not gear and not a Consumable". If the owner turns a hat a hero wears into a plain crafting material (Equip slot cleared) and Syncs, that hero's next knock-out destroys a quarter of the guild's whole Bank stack of the material and the banner reads "Lost: 25 Wolf Pelt". The load only puts the held copy back in the Bank and unmarks the slot; it never empties it (`src/systems/combat/DefeatPenalties.js:31-40`, `src/config/registries/equipmentConstants.js:63-73`, `src/config/registries/equipmentCategories.js:114-121`, `src/systems/equipment/EquipmentManager.js:282-305`, `src/systems/hero/logic/HeroRehydration.js:68-80`). Every `equipSlot` in `data/items.json` is one of the seven categories today. Fix: only categories of kind `sustenance` lose a share; separately the load could empty such a slot.
  3. **A gathering tool held below a level requirement added later still works**, while a weapon or armour in the same state does nothing. The tool gate (`fittingToolSlotOf`, `catchToolOf`) never asks `meetsGearRequirements` (`src/systems/equipment/HeroTools.js:73-83`, `:49-55`, `src/config/registries/weaponStyles.js:110-116`, `src/systems/hero/HeroEffects.js:55`, `src/systems/combat/CombatFormulas.js:49-56`). No shipped item carries a requirement. Fix: add the requirement test beside `slotBacked` in `toolsOfHero` and `fittingToolSlotOf`.
  4. **A level a piece of gear asks for is enforced but never shown before the drop is refused.** The item tooltip, the Bank's Item drawer and the Encyclopedia never list it; the only place the player learns "Melee 15" is the refusal bubble ("Can't equip Iron Sword. Melee skill too low. (12/15)"). Gear already in a slot whose requirement the hero does not meet lends nothing and a weapon is not swung, with no mark on the slot: the Combat view just reads "Barehanded" (`src/ui/components/drawer/ItemTip.jsx:71-96`, `src/systems/equipment/EquipmentValidator.js:36-41`, `src/config/registries/weaponStyles.js:79-88`, `src/systems/hero/HeroEffects.js:55`, `src/systems/combat/CombatFormulas.js:53`, `src/ui/components/dock/dockEquip.js:21`). The CMS's Gear level field (`cms/src/components/editors/GearLevelField.jsx`) writes the requirement. Fix: one "Needs Melee 15" line in `itemTipFacts`, and a dimmed slot when the requirement is unmet.
  5. **A rule that lowers XP can take XP away after a kill; after work it stops at nothing.** "Award 5 less XP" or "100 % less XP" on a kill hands a negative award to `addXP`, which subtracts it. The level never drops, but the sheet shows a level with the bar of the level below it and "XP to next" larger than a whole level (`src/systems/combat/CombatResolutionProcessor.js:27-32`, `:45`, `src/systems/hero/SkillSystem.js:98-112`, `src/systems/hero/xpBonus.js:17`, `src/systems/effects/ModifierAggregator.js:69-73`; compare `src/systems/board/BoardRunner.js:404`). Every `XP_BONUS` in `data/` is positive. Fix: floor a kill's award at 0 as the work path does; a positive award is still at least 1.
  6. **A fight perk would not work for a hero recruited at or above its level** until they change gear, level up or the game is reloaded. A recruit arrives with the Hall's XP for Everyone and may already be at, say, Melee 10; a perk there that gives a combat number is listed on the sheet but is not registered, because the recruit path never calls `recalculateEquipmentModifiers` where both other level-raising paths and the load do (`src/systems/hero/logic/HeroLifecycle.js:42-45`, `:47-71`, `:93-95`, `src/systems/equipment/EquipmentManager.js:311-337`, `src/systems/hero/HeroEffects.js:246-259`, `src/systems/hero/SkillSystem.js:111-118`, `:177-181`). It needs two things no shipped content has: an XP for Everyone star (`XP_FOR_EVERYONE` appears nowhere in `data/`) and a perk on a combat axis (all nine shipped perks are work rules, read live). In practice the first weapon handed over cures it. Fix: call it after `createHero()` returns, for example in `GuildUpgradeManager.purchaseRanks` (`src/systems/progression/GuildUpgradeManager.js:168`), minding the import direction (`src/systems/hero/everySkillXp.js:10-11`). Found by two readers (XP and skills; the hero-state trace).
  7. **An item with a stack limit, or marked not stackable, sticks on the mat with a "Bank full" banner**, and the part that did fit is not counted as collected. A pile beyond the ceiling is retried on every sweep and raises "Bank full" although the Bank has free slots; on a partial fit the banked part never publishes `SPRITE_COLLECTED`, so no flight to the Hall and no count toward a "collect N" quest (`src/systems/inventory/InventoryManager.js:46-49`, `:151-172`, `src/systems/board/SpriteLayer.js:408-419`, `:445-456`, `src/systems/quests/QuestManager.js:144-152`). No shipped item has `maxStack` or `stackable: false`. Fix: say a different thing for "stack full" than for "no slot", skip such piles in the sweep, and announce the collected part.
  8. **A status's "Stacks up to N" shows the status's own limit, not the limit the hero's gear has moved it to.** With gear giving "Venom stacks at most 1 lower", Venom stops at 2 stacks but the fight window's tip still says "Stacks up to 3" (`src/ui/components/combat/fightView.js:163`, `src/ui/components/combat/FightPanel.jsx:393`, `src/systems/effects/LiveEffects.js:266-267`, `src/systems/combat/CombatFormulas.js:178-181`). No shipped item provides Status Stack Limit. Fix: the view asks `heroStatusStackCap`.
  9. **An elixir whose rule names no role drops out of the fight window in its last fight, while its effect is still on** (reasoned). A rule without a role is applied through `applyAt`, which reads the source id from the payload where the stamp lives on the statement, so the effect carries no source and the window reads "No elixirs" for that fight (`src/systems/board/StatusApplication.js:78`, `src/systems/board/LoadoutMoments.js:135-137`, `src/ui/components/combat/fightView.js:140-155`). Both shipped elixirs aim "the hero" by role and are fine; the test that pins "1 in its last fight" uses a role-aimed fixture (`CombatScreen.test.js:74-76`). The step assumed: that the CMS lets a carried Applies rule be saved with no role (the engine accepts one). Fix: give `applyAt` the statement's `sourceEffectId`.
  10. **The enemy's "Hit" in the fight window leaves out flat Damage and Type Damage a rule has lent it.** The display is `profile.hit * damageMultiplierOf(profile)`; the engine adds the flat part and applies each type's boost (`src/ui/components/combat/fightView.js:275-276`, `src/systems/combat/CombatFormulas.js:380-386`). Shipped enemy buffs are percentage Damage and Swing Time, which the window does show. Fix: build the live figure from `(hit + flat) × multiplier` and list a type boost as the hero's side does.
- **Evidence**: Each reader checked `data/` for the shape and found none (items, effects, Tokens, perks and Hall stars, by script), as noted per item.
- **Fix sketch**: Not one fix. Either a content audit rule per item (the cheap guard: `ContentAudit.js` refuses or warns on the shape until the engine supports it) or the fix sketched per item when the first content needs it.
- **Verified by**: pending
- **State**: open

---

## Notes (leads without a finding)

**Combat maths**

- **Correction to CR4-124 item 9: a 1.5 s enemy swing lands late in a catch-up.** Item 9 says the fastest shipped swing is 1,000 ms, "a fast enemy under Enrage". The reader finds no Swift enemy that enrages: the two Enrage users are the Wolf Alpha (Brute, 4 s, so 2 s enraged) and the Queen Bee (Venomous only, 3 s, so **1.5 s** enraged) (`data/tokens.json` `token_wolf_alpha`, `token_queen_bee`; `data/effects.json` `effect_enrage`, -50 %). At 1.5 s nothing is halved, but in 1,000 ms steps the Queen's swings land at 2 s, 3 s, 5 s, 6 s instead of 1.5, 3, 4.5, 6: every other swing is 500 ms late, and lands after the hero's swing in that step instead of before it (`src/systems/combat/CombatProcessor.js:66-89`, `src/systems/combat/CombatAttackProcessor.js:186-199`). Same count of swings over a long fight; the hero gets a slightly kinder order while away. Size not measured; probably too small to file by itself, but item 9's "exactly 1,000 ms" should be corrected.
- **Crit Chance and Dodge are read from the hero only, never from the guild**, while Accuracy and Damage add the guild's (`src/systems/combat/CombatFormulas.js:164-171`, `:141-144`, `:159-161`). No Hall star, perk or Region rule carries either axis today; if the CMS lets a star carry one, it would do nothing. Not checked.
- **A flat Damage, Dodge, Accuracy or Crit rule lent to an enemy counts only if it names no category** (`src/systems/combat/CombatFormulas.js:134`, `:186-196`, `:382`): "Damage +2 on Melee" applied to an enemy would be silently zero. No shipped effect does this; overlaps CR4-043 in spirit. The shown-against-real reader raised the same lead and could not confirm the CMS offers that narrowing on an enemy's own rule.
- **An enemy Token's own standing `Provides` on a combat axis is lent to its hero once, at fight creation, as flat** (`src/systems/board/BoardCombat.js:146-160`, `:355`). Nothing shipped has such a rule; a rehydrate mid-session was not traced.
- **Empty quiver**: with no arrow in the Bank a Ranged hero keeps shooting the bow's own damage with no arrow part (`src/systems/combat/Arrows.js:42-47`, `:56-61`, `src/systems/combat/CombatAttackProcessor.js:101-110`). The file's own note says whether an empty quiver should stop the shot is an owner call not yet made.
- **Re-planting a hero on the same enemy during the 2 s rest after a kill starts the next fight at once** (`src/systems/board/BoardCombat.js:346-357`). Manual, every kill, at most 2 s each; the re-plant path in `Flags` was not confirmed line by line.

**A fight's life**

- **A hero ordered straight onto one enemy may claim a same-kind enemy standing at exactly the dead one's point** for one pass, opening a fight (an elixir counts it) that the next pass releases (`src/systems/board/Flags.js:511-518`, `:533-551`, `:461`). Needs the camp to land its next spawn on the very same point on the very next tick; the landing search was not traced.
- **A camp hero dropped onto the enemy they are already fighting has their order replaced**: the fight ends, the enemy is whole again, and the hero is on a one-enemy order that lapses when it falls (`src/systems/board/Flags.js:654-658`, `src/systems/board/Orders.js:143-158`). The comment at `Orders.js:150-151` says a drop there "would change nothing". Owner's call whether a deliberate drop should do this.
- **A kill whose rule downs the victor (Thorns, hero at 1 HP) says `defeat` then `victory`** for the same Token, and `Breakage.afterKill` still rolls for the downed hero's weapon (`src/systems/board/BoardCombat.js:462-475`). The numbers look intended; what the fight UI shows was not checked.
- **After a weapon breaks the order lapses at the hero's body point with no offset**, so the hero should walk about 100 units up and right before standing (`src/systems/board/Flags.js:803-806`, `:817-820`). Cosmetic if true; not checked in the running game.

**Defeat and healing**

- **A knocked-out hero's effect clock is skipped whole**, so a timed effect stays listed through the five minutes and carries on after healing if its time has not run out (`src/systems/effects/LiveEffects.js:420-421`, `:452`, `src/systems/board/BoardCombat.js:521`). No shipped content puts a timed harmful effect on a hero.
- **Breakage is unreachable today** (no item has `breakChance`) and reads sound. One harmless oddity: a hero knocked out by Thorns on the cycle that completes still gets the tool's or weapon's break roll after the knock-out's own gear rolls (`src/systems/equipment/Breakage.js`, `src/systems/board/BoardRunner.js:430`, `:465`).
- **A hero pricked to 0 by a bush is resolved through the fight's defeat**, publishing `COMBAT_RESOLVED` with outcome `defeat` and the bush's id (`src/systems/board/BoardCombat.js:533-539`); whether the mat shows a fight ending on a bush is unknown (`fightWatch.js:465`, `matFx.js:526` not read).
- **A hero left on a Redberry Bush with no food is knocked out and rolls gear loss today** (1 damage a harvest against 1 health per 10 s; `data/effects.json`, `effect_thorns`). The owner's Thorns ruling changes the arithmetic; whether a bush can still knock a hero out afterwards was not worked out.

**Food, drink and elixirs**

- **Sending a hero elsewhere mid-cycle costs another drink dose or work potion at the next cycle start** (`src/systems/board/Flags.js:236-256`, `src/systems/board/BoardRunner.js:749-754`, `src/systems/hero/ConsumptionSystem.js:267-285`). Reads as the rule; the owner may want a recalled cycle not to cost a potion. The effects reader raised the same lead (same family as CR4-116 and CR4-122); how often it happens in ordinary play is unknown.
- **A piece of gear and a drink or elixir naming the same library effect would fire once in the ordinary pass and once from the dose** (`src/systems/board/LoadoutMoments.js:109-115`). No two shipped items share an effect.
- **A hero holding a weapon and a shield who takes up a tool puts down the first hand item in grid order**, usually the weapon (`src/systems/equipment/EquipmentManager.js:171-178`, `:54-68`). Looks like design.
- **An elixir's effect lands after the first combat tick of each fight** (`src/systems/board/BoardCombat.js:381-398`). No swing can happen in that tick with shipped swing times, except together with the 500 ms case (CR4-143 item 1).
- **An elixir taken off mid-fight keeps its effect until that fight ends** (`src/systems/effects/LiveEffects.js`, `endFightEffects`). Harmless.
- The lead on the only pickaxe lost to a knock-out (`src/systems/combat/DefeatPenalties.js:44-51`) is settled by CR4-137.

**Gear and tools**

- **`takeOut` announces `INVENTORY_UPDATED` before the displaced copies are put back, and `vacate` ignores `putBack`'s answer** (`src/systems/equipment/EquipmentManager.js:201-202`, `:112`, `src/config/registries/triggerRegistry.js:351-356`). If a listener added a new kind to an exactly full Bank in that gap, the displaced copy would be destroyed; whether a rule can bank an item directly was not traced.
- **A starter tool is recorded as given before `addItem` is known to have worked** (`src/systems/equipment/StarterTools.js:45-48`, `src/systems/core/EngineBootstrap.js:263`, `:354`, `src/systems/inventory/InventoryManager.js:137-139`). Only reachable when a tool is newly marked Starter and the save's Bank has no free slot.
- **A weapon breaking at the kill ends the order and the fight inside `resolveVictory`, which then carries on** (`src/systems/board/BoardCombat.js:476-490`, `src/systems/board/Flags.js:803-806`). The order of the two endings was not traced; no shipped item has `breakChance`.
- **A gear item authored `stackable: false` could not be unequipped while the Bank holds another of it** (`src/systems/inventory/InventoryManager.js:245`). No shipped gear is non-stackable.
- **A collection bounty counts only the Bank**, so equipping a wanted gear item can un-finish the bounty (`src/systems/quests/QuestTokens.js:324-333`). Reads as intended; whether bounties can ask for gear is for the quests reader.

**XP, skills and perks**

- **A skill record with a `level` but no `xp` would jump to level 99 on its first award** (`src/systems/hero/SkillSystem.js:102-108`, `src/utils/XPCurve.js:33-42`). No shipped path writes such a record; it needs a hand-edited or imported save.
- **A demolition may not be shortened by the Construction 10 perk Quick Builder** though a build is (`src/systems/board/BoardRunner.js:475-499`). The comment calls demolition "a fixed time"; whether `workConfigOf` folds Work Time in was not read.
- **A perk and an equipped item naming the same library effect would share per-statement state** (`src/systems/hero/HeroEffects.js:241-259`). Latent only if a perk effect with a triggered or upkeep rule is also put on gear.
- **`addHero` does not set health to full after the Hall XP raises max health** (`src/systems/hero/logic/HeroLifecycle.js:93-95`). Only the QA panel and fixtures call it.

**Effects and modifiers**

- **An enemy Token's own `Provides` on a combat axis is registered on the hero fighting it** (`src/systems/board/BoardCombat.js:146-160`, `src/systems/board/ContentAudit.js:274`): an author giving a boss "+20 Type Resistance on Physical" as its armour would armour the hero instead. No shipped enemy has such a rule.
- **A perk row with no scale would make a merged scale NaN** and silently drop the earlier tiers (`src/systems/hero/HeroPerks.js:50`). Shipped rows all carry `scale: 1`.
- **The six drinks' rules name no skill, so a dose counts down on every work cycle of any skill** (`src/systems/hero/ConsumptionSystem.js:263-265`, `data/effects.json`): a miner carrying Lemonade drinks it for nothing. Probably a content call, noted for the content agent.
- The lead on whether an item whose id no longer exists can be unequipped is settled by CR4-127.

**Loot and the Bank**

- **A station output naming an item id not in `items.json` drops a pile that can never be collected nor skipped by the sweep** (`src/systems/board/SpriteLayer.js:281-284`, `:445-448`, `src/systems/board/BoardRunner.js:338-340`); likewise a Bank entry whose id has left the registry keeps its slot. Needs an item deleted or renamed in the CMS; whether the load or the CMS's rename cleans it up is unknown.
- **"Collect" quest counts follow `SPRITE_COLLECTED`**, so they count a Shop refund's overflow pile and do not count items a station ate off the floor (`src/systems/quests/QuestManager.js:144-152`). Which quest target types shipped bounties use was not checked.
- **`removeItem` results are ignored in the consumption paths** (`src/systems/hero/ConsumptionSystem.js:83`, `:200`, `:272`, `src/systems/hero/HeroEffects.js:315`). The consumption reader found each spend is `hasItem` then `removeItem` in one step, so sound.
- **A knock-out destroys a share of the Bank's whole stack**, which every hero carrying that food shares (`src/systems/combat/DefeatPenalties.js:34-38`). The GDD says the whole Bank stack; flagged only in case the owner meant the hero's own share.

**Trace 1: per-hero state**

- **`getHero` rebuilds an empty aggregator for any hero whose aggregator is missing**, and nothing registers gear or effects again (`src/systems/hero/logic/HeroLookup.js:14-17`). No path in the engine removes the aggregator in play.
- **The regeneration and effects-tick remainders are never reset on load or travel** (`src/systems/hero/RegenSystem.js:14`, `src/systems/effects/LiveEffects.js:39`). Worth at most 10 s of regeneration and 3 s of a tick per load.
- **A skill's saved level is trusted, never recomputed from its XP** (`src/systems/hero/logic/HeroRehydration.js:39-56`). Harmless while the XP curve is fixed.
- **The load settles held copies before the Bank's size is recomputed** (`src/systems/equipment/EquipmentManager.js:282-305`, `src/systems/core/SaveManager.js:375`). Needs a CMS category change on a held item plus a full Bank.

**Trace 2: shown against real**

- **An effect carried "for the cycle" at one Token still counts on the combat axes anywhere** (`src/systems/effects/LiveEffects.js:540-566`). Shipped cycle effects carry no combat axis; it would matter for a drink that gives Damage.
- **"Gear effects" lists every rule of a carried food, drink or potion, including an always-on one the engine ignores** (`src/ui/components/dock/heroCombatStats.js:73-88`). No shipped item has one and the CMS warns.
- The lead on whether a tool below its level still counts (`src/systems/hero/HeroEffects.js:55`) is settled by CR4-143 item 3.
- **Already filed and seen again**: CR4-043 (confirmed still as written by this reader; the effects reader found its dropped Food Healing category no longer true of the code, so triage should re-read it), CR4-101, CR4-109, CR4-111, CR4-116, CR4-118, CR4-120, CR4-122, T-077.

## What the readers found sound (so nobody re-checks it)

**Combat maths**

- **Miss chance and crit**: the level part is clamped 5 to 25 and the total 5 to 40; a crit is rolled only on a hit and doubles before the type factor on both sides.
- **No NaN and no stuck zero**: every read falls back to a number, enemy HP and hit are forced finite and at least 1, and a small blow lands by chance, so nothing is permanently 0 except authored immunity.
- **Resistances**: a hero's Physical resistance counts against every shipped enemy move; an enemy's type line replaces its group line; Sunder never turns a resistance into a weakness.
- **Heavy Strike, Enrage and Flutter** reach the right side, last as long as written, and Flutter refreshes rather than stacks.
- **Swing time** is clamped to ×0.25 to ×4 and cannot reach 0; shipped values are 2, 3 and 4 s, and 1.5 s or 2 s enraged.
- **Arrows**: one spent per shot, hit or miss, none on a turn used to eat, none by a hero not using a Ranged weapon; a carried arrow lends nothing by itself.
- **Overkill** carries nothing over; the next enemy starts full with both swing timers at 0.
- **Both sides on one tick**: the hero swings first, a kill returns before the enemy's swing, and a hero downed inside any of it is resolved once.
- **1,000 ms steps against 100 ms ticks**: for every shipped swing time except the enraged Queen Bee, the number and order of swings, the meals and the 2 s rest are identical.
- **On Health Below** fires once per fight per rule and re-arms for each new enemy.

**A fight's life**

- **Every way a hero lets go of an enemy ends the fight in the same call**; an enemy never fights without a hero and never attacks one walking past.
- **No hero is left marked "in combat"** (which would stop regeneration and eating): every fight end, load and journey stands them down.
- **One hero per fight**: a second hero waits beside a busy enemy and never joins; when the first is knocked out the enemy is whole for the second, so no tag-teaming a boss.
- **Fights across load, travel and catch-up**: cleared on load and travel with for-the-fight effects taken off; a catch-up keeps the board, so fights carry through correctly.
- **A knock-out from inside the combat step, by a status away from a fight, or with the enemy in the player's hand** goes through the one defeat path, once.
- **An enemy's lent numbers leave with the fight**; an enemy moved or pushed mid-fight keeps its fight and its hero.
- **A step to open space cannot strand a hero**; a camp marked for demolition releases its hunters cleanly.
- **Heroes cannot be dismissed**, so no fight, order or note can name a hero who no longer exists.

**Defeat and healing**

- **What a defeat takes** matches the GDD line for line: a quarter of the Bank stack of each carried food and drink (rounded up, never more than the stack), one 10 % roll per gear piece on the hero's own copy; elixirs, potions and arrows are exempt.
- **Taken once**: a defeat is resolved once per knock-out by every route; the only double charge is CR4-101's.
- **No knock-out loop**: a defeat takes the hero's flag down whatever kind it was; a healed hero waits at the Hall.
- **Health and the wounded mark agree**: every path that lowers health marks the hero or announces it to an engine listener; nothing takes `wounded` off but recovery, which puts the hero back at half health.
- **The healing timer** counts game time, is saved, runs through a catch-up and travel, and is restored by "Load as I left it"; Wound Time is read once as the wound starts.
- **A healing hero** cannot take an order, eat or regenerate; they can be equipped or stripped without touching the wound.
- **Regeneration**: one health per 10 s, identical at either step size, clamped at max, skipped in a fight and while wounded.
- **Eating**: only under a quarter of health; every shipped food restores at least 2 (1 under Burn), so no meal heals 0 and a hero cannot burn through a stack for nothing.
- **Dying on the winning blow**: a hero dropped by Thorns as the kill completes keeps the kill's XP and loot and is knocked out once; a victory never overwrites `wounded`.

**Food, drink and elixirs**

- **Carried counts cannot go negative or be spent twice**: two heroes sharing one last Shrimp, the first eats and the second goes without.
- **Drinks never heal and the card does not promise it.**
- **The elixir counter** never goes below 0, is per hero and per item, survives unequip and re-equip without a free or lost fight, and keeps working after the Bank's stack runs out.
- **A held copy cannot be held twice or minted**, and nothing is lost to a full Bank: an unequip or a displacing equip is refused whole first.
- **Loadout caps** are read only when equipping; nothing trims a loadout, and caps only rise in shipped content.
- **Work doses** are counted once per cycle start; a stalled Token charges nothing; heroes resting at the Hall drink nothing.
- **Catch-up**: doses, elixirs, bait and arrows run through the same code at 1,000 ms steps (the one difference is CR4-118).
- **Preservation, Long-lasting Brews, Strong Drink**: no rule in `data/` provides them, and their paths draw no random number without one.

**Gear and tools**

- **Equip, unequip, swap and hand-over never mint or drop a copy**: the room check simulates exactly the order the moves run in, and a refusal happens before anything moves.
- **Hands**: a two-handed weapon clears the other hand; one weapon and one off-hand item at most; all displaced copies are room-checked together.
- **Stats from gear are applied once**: every change replaces one set, on load and level-up too, and only worn copies feed it.
- **A hero without the needed tool is told so**, and a tool taken off mid-cycle makes the hero let go on the next check; the same rule picks the tool that counts, fishes and would break.
- **Breakage** (latent): rolled once, only as a cycle completes, and an item with no chance draws no random number.
- **Older saves**: a gear slot without a mark takes a copy from the Bank in roster order or is emptied with one notice.
- **Starter tools** are given once per id and not duplicated on reload.
- **Gear level requirements** (latent): checked on equip and hand-over and re-read live for weapons and everything that lends effects (tools are CR4-143 item 3).

**XP, skills and perks**

- **The curve at its edges**: level 1 at 0 XP, 99 at the cap, nothing reads past the table; XP past the cap keeps adding with a full bar.
- **One award crossing several levels** announces each level once, with each level's recipe unlocks and perks.
- **Perks cannot be granted twice or missed**: nothing is stored, they are read off the levels each time; all nine shipped perks reach the right work.
- **Bonuses are applied once**, in one three-bucket pass where the XP is earned; percentages add, they do not compound.
- **Combat XP**: one award per kill, to the one fighter, into the style of the weapon in hand at the kill (CR4-139 is what that allows).
- **Level-up mid-fight and during a catch-up** loses nothing: the level, max health and combat numbers are set inside the award, not by a listener.
- **Recipe-unlock notices**: one recipe is announced once, by the first hero to reach it.
- **XP for Everyone** (unshipped): given once at the purchase as the difference, a recruit arrives with the whole, a load gives nothing.
- **Hero generation**: every field later code reads is present; ids are unique; the roster cap is checked.

**Effects and modifiers**

- **The kept loadout cannot go stale**: it re-checks every slot, definition, Bank backing, skill record and library entry on every read.
- **Only the swung weapon lends**; a second weapon lends nothing.
- **Burn** halves a meal only in a fight and is gone by the between-kills rest; **Sunder** stacks to 3, lowers only a positive resistance, and counts Flutter's lent resistance.
- **Three-bucket order** is the same everywhere a hero's number is resolved, and the guild's and hero's percentages go into one bucket.
- **A drink's or potion's effect is still on the hero when the cycle's outputs and XP are rolled**, and its always-on rules never count merely by being carried.
- **Hall stars**: exactly the held rank's rules are registered, put back on load, new game, travel and catch-up; **Region rules** likewise, by their own source ids.
- **Timed effects' clock** is the game clock; the 3 s tick fires once per 3,000 ms at either step size.
- **Saving** strips the aggregator and there is no second restore path.
- **Signs and units**: every time axis shortens on a negative; resistances and cuts are clamped 0 to 100; a proc's chance is clamped after scaling.

**Loot and the Bank**

- **A kill pays once**, loot lands while the enemy Token is still on the mat, and a hero downed by the enemy's swing gets none.
- **Nothing re-pays on load or travel**: fights are not saved, dropped loot is saved as piles, passive income runs on a saved clock, a quest's reward is paid on claim.
- **Drop chances and rare tables**: right at 0, decimals and 100; bad table entries are normalised away; Lucky is applied to the table's chance and clamped.
- **A full Bank at the moment of a reward loses nothing**: everything lands as a pile and waits; no duplicate on a refused collection.
- **Removes are all or nothing**: recipes, upkeep, conversions, settling, quest hand-ins and Hall upgrades each check the whole price before taking any of it.
- **Slot limits hold from every entry point.**
- **First-find records and kill counts** are written once, in a catch-up as in live play.
- **Loot ages** on the game clock across a reload and a catch-up; **travel** banks what fits and leaves the rest on the old Region's board.

**Trace 1: per-hero state**

- **The strip list is honest**: the five stripped fields are all rebuilt unconditionally; everything else on a hero is saved as it stands.
- **A hero recruited mid-session has every field a loaded hero has** (the latent perk case aside, CR4-143 item 6).
- **Renames**: Poison to Venom needs no save migration, and Logging to Forestry cannot be in a loadable save; the shapes 0.8.1 saves really had are all covered.
- **A defeat cannot be left half-done in a save**: it all happens inside one tick handler.
- **Drink and elixir counters** are saved; a load mid-cycle does not count a drink twice.
- **Held copies** stay in step with the grid through every equip, move, break and defeat.
- **Max health** is recomputed on every load and level-up, current clamped down, never healed by a rise.
- **Travel changes nothing on a hero** except standing them down from a fight.
- **An undone catch-up** reloads the page, so no module state survives it (the timed-effect case aside, CR4-140).
- **One odd hero cannot make a save unloadable.**

**Trace 2: shown against real**

- **Every fighting figure shown is the engine's own function called live**: the Combat view, the fight window and the mat's badges, for Hit, Damage range, Swing, Crit, Accuracy, Dodge, resists and style cuts.
- **Gear and elixir numbers** (Dagger crit, Bow Accuracy, Valor, Ironskin) are registered flat and printed flat; the Cleaver's double Raw Beef is rolled only while it is the weapon swung.
- **Perk rows, kill XP and the XP badge** use the same walk as the engine.
- **Arrow tooltip and elixir counts** match what is spent; counts survive an empty Bank.
- **Enemy card and item tooltip** come from the same blocks the fight and the rolls use.
- **Skills grid, level-up alerts and floats** agree with the record.
- **Health texts** (max health, recovery at half, regeneration, eating under a quarter) and the healing time on the flag and roster match the code.

## Inventory: every piece of per-hero state

From the hero-state trace, copied as written. In the tables, "latent finding 1" is CR4-140 and "latent finding 2" is CR4-143 item 6.

### Fields on the hero object (`state.heroes[i]`)

| Field | Written where | Saved? | Restored / rebuilt on load | Travel | Catch-up / undo | Verdict |
|---|---|---|---|---|---|---|
| `id` | `HeroGenerator.js:41` | yes | as saved | unchanged | unchanged | sound |
| `name` | `HeroGenerator.js:42`, `HeroState.js:23` | yes | as saved | - | - | sound |
| `icon`, `spriteId` | `HeroGenerator.js:43-44`, `HeroState.js:27,31`, `HeroRehydration.js:47-48` (only if missing) | yes | as saved; old sprite names renamed (`SaveMigration.js:82-90`) | - | - | sound |
| `flagColour` | `FlagColours.js:101`, `HeroState.js:36` | yes | as saved; given if missing (`LoadedState.js:24`) | - | - | sound |
| `aggregator` (object) | `HeroGenerator.js:46`, `HeroRehydration.js:42`, `CombatProcessor.js:72`, `HeroLookup.js:16` | no (stripped) | new, empty, every load | kept | kept; undo reloads | sound as an object; contents below |
| aggregator source `equip:loadout` (gear, perks, resistances, cuts) | `EquipmentManager.js:311-337` on every equip change and level-up | no | `LoadedState.js:21`, again after `reconcileHeldCopies` if it changed anything | kept | kept | sound; **not registered for a recruit** (latent finding 2) |
| aggregator source `live:effects` (a carried effect's fight numbers) | `LiveEffects.js:540-567` on every change to `hero.effects` | no | **not rebuilt** unless a for-the-fight effect was also saved | kept | kept | **latent finding 1**; harmless today (for-the-fight effects are stripped on load anyway, for-the-cycle ones carry no fight number) |
| aggregator source `fight:<tokenId>` (an enemy's debuff) | `BoardCombat.js:146-160` | no | gone with the aggregator; fights restart | removed by `clearAll` | - | sound |
| `className`, `traitName` | `HeroRehydration.js:44-46` | no | rebuilt (`''` / removed) | - | - | sound (vestigial) |
| `level` (average of skills) | `HeroRehydration.js:55,113` | no | rebuilt | - | - | sound |
| `_rev` | `HeroRehydration.js:89` | no | rebuilt (counts from 1) | - | - | sound (UI counter) |
| `hp.current` | `HeroState.js:57`, `WoundedSystem.js:86`, `HeroLifecycle.js:58`, `HeroRehydration.js:104` | yes | as saved, clamped to max | - | regen and eating play at 1 s steps | sound |
| `hp.max` | `HeroRehydration.js:103` | yes, but never trusted | recomputed from best combat skill every load and level-up | - | - | sound |
| `status` (`idle`, `combat`, `wounded`; `working` is never set by anything) | `HeroState.js:14` via `CombatProcessor.js:71`, `CombatResolutionProcessor.js:11,54`, `BoardCombat.js:260,517`, `WoundedSystem.js:83` | yes | `'combat'` becomes `'idle'` on load (`BoardCombat.js:296`); `'wounded'` kept | `'combat'` becomes `'idle'` | - | sound |
| `woundedRemainingMs` | `WoundedSystem.js:61,66,89` | yes | as saved; a wounded hero without one gets the full time | keeps draining | drains by game time | sound |
| `woundedUntil` | `HeroGenerator.js:51`, `WoundedSystem.js:62,88` | yes (always null) | as saved | - | - | sound (kept for the bench fingerprint) |
| `skills[id].xp`, `.level` | `HeroGenerator.js:28`, `SkillSystem.js:102,112`, `everySkillXp.js:25,28`, `HeroRehydration.js:27,32` | yes | as saved; missing skills added at level 1, retired ones dropped; level **not** recomputed from xp (lead) | - | - | sound |
| `statuses` | `HeroGenerator.js:56`, `HeroRehydration.js:61` | yes (always `[]`) | reset to `[]` | - | - | sound (vestigial) |
| `equipment[0..8]` | `EquipmentManager.js:113,205,230-231,293`, `HeroRehydration.js:79` | yes | as saved, padded/truncated to nine in place; legacy object collapsed | - | - | sound |
| `heldCopies[0..8]` | `heldCopies.js:34-37,70-71`, `HeroRehydration.js:77` | yes (absent when no copy held) | normalised to the grid; older links settled against the Bank (`SaveManager.js:375`) | - | - | sound |
| `effects[]` (`effectId, scale, expiresAt, sourceId, boost?, forFight?, forSwing?, forAttack?, forCycle?, stacks?, ticksLeft?`) | `LiveEffects.js:43,208,241,287,310,324,337,378,403,452` | yes | for-the-fight ones (statuses included) stripped on `GAME_LOADED`; the rest kept as saved | fight ones stripped for heroes in a fight | timed ones expire by the catch-up's clock; **an undo expires them by wall clock** (latent finding 1) | sound today |
| `effects[].forCycle` (a Token id) | `LoadoutMoments.js:127-129` | yes | kept; the Token id is saved with the board | kept, dropped at the next cycle start elsewhere (`LoadoutMoments.js:100`) | - | CR4-120 / CR4-116, filed |
| `elixirFights[itemId]` | `ConsumptionSystem.js:207-208` | yes | as saved | - | - | CR4-122, filed |
| `drinkCycles[itemId]` | `ConsumptionSystem.js:283-284` | yes | as saved | - | - | sound |
| `isVillager` | nothing in `src/systems` writes it | yes if present | read only (`HeroRehydration.js:23,44,100`) | - | - | no villager can exist in play |
| `jobId`, `energy`, `classId`, `traitId`, `createdAt`, `flagRules` | old saves only | - | deleted (`HeroRehydration.js:35,83-86`, `SaveMigration.js:122-126`) | - | - | sound |

### State about a hero kept off the hero object

| State | Where | Saved? | Reset / rebuilt | Verdict |
|---|---|---|---|---|
| `board.flags[heroId]` (the order) | `StateSchema.js:63` | yes, per Region | each Region's frozen board keeps its own | sound (CR4-101 covers a wounded hero's old orders) |
| `board.workClaims[heroId]` | `StateSchema.js:74` | yes | load: hero stood back at the Token (`Flags.js:1017`); travel: dropped (`:1044`) | sound |
| Where a hero stands, walks, their claim, retry and skip notes | board runtime (`BoardState.js:511` WeakMap, `HeroMotion.js:142`) | no | keyed on the board object; `Flags.reset` on load and travel | sound (D1) |
| `fights` (hero id inside each fight) | `BoardCombat.js:49` | no | cleared on load and travel | sound |
| `heroCarryIn` / `heroCarryOut` (a cycle's leftover time, by hero id) | `BoardRunner.js:105-106` | no | cleared when the board object changes (`:118-123`); one tick's life | sound |
| `XpRateTracker.history` (`heroId:skillId`) | `XpRateTracker.js:9` | no | cleared on load and new game (`SaveManager.js:29-32`) | sound (display only) |
| Loadout statement cache | `HeroEffects.js:137` (WeakMap by hero object) | no | re-validated every read | sound |
| Regen remainder `hpTimer`, effects tick remainder `clock` | `RegenSystem.js:14`, `LiveEffects.js:39` | no | never reset | lead only (seconds) |
| Catch-up summary rows by hero id | `CatchUp.js:180-184` | no | local to one run | sound |
| Roster limit | `progress.rosterLimit` | yes, not trusted | recomputed on load (`GuildUpgradeManager.js:209`) | sound |
