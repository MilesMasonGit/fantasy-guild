# Fantasy Guild - Granular Implementation Plan

## Overview

This plan implements Fantasy Guild in **44 granular phases**, each focused on a single feature or closely related files. This enables frequent testing and verification.

---

## Phase Summary

### MVP (Phases 0-22)

| # | Phase | Focus |
|:--|:--|:--|
| 0 | Project Setup | Vite, index.html, folder structure |
| 1 | CSS Foundation | Design tokens, variables, reset |
| 2 | Panel Layout | 3-column grid, TopBar, empty panels |
| 3 | Core Utilities | RNG, Formatters, XPCurve |
| 4 | Core Systems | GameLoop, TimeManager, EventBus |
| 5 | State Foundation | GameState, INITIAL_STATE |
| 6 | Hero Registries | Skills, Classes, Traits, Names |
| 7 | Hero Generation | HeroGenerator, HeroManager |
| 8 | Skill System + ModifierAggregator | Skills, XP, levels, bonus calculations |
| 9 | Hero UI | HeroCardComponent, LeftPanel |
| 10 | Notification System | Toast messages, user feedback |
| 11 | Regen System | RegenSystem, HP/Energy tick |
| 12 | Card Registry | Basic task card templates |
| 13 | Card Manager | CardManager CRUD |
| 14 | Drag & Drop | DragDropHandler, hero drag |
| 15 | Task System | TaskSystem, progress, completion |
| 16 | Item Registry | Basic items |
| 17 | Inventory Core | InventoryManager, add/remove |
| 18 | Inventory UI | Groups, RightPanel, item display |
| 19 | Task Output | Connect tasks to inventory |
| 20 | Save Core | SaveManager, localStorage |
| 21 | Save UI | Slot selection, modals |
| 22 | Auto-Save | Interval saving, beforeunload |

### Post-MVP (Phases 23-44)

| # | Phase | Focus |
|:--|:--|:--|
| 23 | Biome & Modifier Registries | World data |
| 24 | Explore Cards | ExploreSystem, area options |
| 25 | Area Cards | AreaCardRenderer |
| 26 | Project System | ProjectSystem, global bonuses |
| 27 | Recipe Registry | Recipe definitions |
| 28 | Recipe Cards | RecipeSystem, dynamic I/O |
| 29 | Enemy Registry | Enemies, drop tables |
| 30 | Combat Formulas | Hit/damage calculations |
| 31 | Combat + Loot System | CombatSystem, WoundedSystem, LootSystem |
| 32 | Invasion Registry | Invasion templates, threats |
| 33 | Invasion System | Multi-hero, threat meter |
| 34 | Equipment System | EquipmentManager, hero equipment UI |
| 35 | Perk Registry | 180 perks |
| 36 | Perk System | Milestone detection, selection |
| 37 | Recruit Cards | Hero recruitment flow |
| 38 | Tool/Consumable Systems | Durability, auto-eat |
| 39 | Offline Progress | Time-away rewards |
| 40 | Export/Import | Save file download/upload |
| 41 | Card Upgrading | Consume 5 → get 1 higher |
| 42 | Hero Details Modal | Full hero stats view |
| 43 | Settings & Options | Volume, auto-save interval |
| 44 | Final Polish | Testing, optimization |
| **45** | **Cleanup** | **Remove dev code before production** |

---

## Phase 0: Project Setup

### Files
| File | Purpose |
|:--|:--|
| `package.json` | Vite dev server, dependencies |
| `index.html` | Entry point, root element |
| `main.js` | Empty bootstrap |
| `/js/` folder | Create directory structure |

### Commands
```bash
npm create vite@latest ./ -- --template vanilla
npm install
npm install nanoid
```

### Verification
- [ ] `npm run dev` starts server
- [ ] Browser shows empty page at localhost

---

## Phase 1: CSS Foundation

### Files
| File | Purpose |
|:--|:--|
| `/styles/main.css` | CSS reset, variables |

### Key Content
```css
:root {
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-text-primary: #eaeaea;
  /* ... all design tokens */
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; }
```

### Verification
- [ ] Variables load correctly
- [ ] Body has correct background/font

---

## Phase 2: Panel Layout

### Files
| File | Purpose |
|:--|:--|
| `/styles/panels.css` | Grid layout |
| `/ui/panels/TopBar.js` | Top bar render |
| `/ui/panels/LeftPanel.js` | Empty left panel |
| `/ui/panels/CenterPanel.js` | Empty center panel |
| `/ui/panels/RightPanel.js` | Empty right panel |
| `/ui/ViewManager.js` | Render panels |
| Update `main.js` | Import and call ViewManager |

### Verification
- [ ] 3-column layout displays
- [ ] TopBar at top with placeholder buttons
- [ ] Panels scroll independently
- [ ] Responsive at 1024px+

---

## Phase 3: Core Utilities

### Files
| File | Purpose |
|:--|:--|
| `/utils/RNG.js` | `randomInt()`, `randomChoice()`, `weightedChoice()` |
| `/utils/Formatters.js` | `formatTime()`, `formatNumber()` |
| `/utils/XPCurve.js` | `xpForLevel()`, `levelFromXp()` |

### Tests
```javascript
// /tests/utils.test.js
test('randomInt returns within range', ...)
test('xpForLevel(1) equals 83', ...)
```

### Verification
- [ ] All tests pass
- [ ] Functions callable from console

---

## Phase 4: Core Systems

### Files
| File | Purpose |
|:--|:--|
| `/systems/core/EventBus.js` | `subscribe()`, `publish()`, `unsubscribe()` |
| `/systems/core/TimeManager.js` | `getDelta()`, `pause()`, `resume()` |
| `/systems/core/GameLoop.js` | `start()`, `stop()`, `tick()`, `onTick()` |

### Tests
```javascript
// /tests/coreSystems.test.js
test('EventBus notifies subscribers', ...)
test('GameLoop ticks at interval', ...)
```

### Verification
- [ ] GameLoop ticks visible in console
- [ ] Pause/Resume works
- [ ] Events fire correctly

---

## Phase 5: State Foundation

### Files
| File | Purpose |
|:--|:--|
| `/state/GameState.js` | Root state object, `serialize()` |
| `/state/StateSchema.js` | `INITIAL_STATE`, `validateSaveData()` |

### Verification
- [ ] `GameState` accessible globally
- [ ] `INITIAL_STATE` has all required sections
- [ ] `validateSaveData()` catches missing fields

---

## Phase 6: Hero Registries

### Files
| File | Purpose |
|:--|:--|
| `/config/registries/skillRegistry.js` | 11 skills with categories |
| `/config/registries/classRegistry.js` | 9 classes with bonus skills |
| `/config/registries/traitRegistry.js` | 9 traits with bonus skills |
| `/config/registries/nameRegistry.js` | 50+ hero names |

### Tests
```javascript
// /tests/registries.test.js
test('each class has exactly 3 bonus skills', ...)
test('each trait has exactly 3 bonus skills', ...)
```

### Verification
- [ ] Registries import correctly
- [ ] All 9 classes defined
- [ ] All 9 traits defined
- [ ] All 11 skills defined

---

## Phase 7: Hero Generation

### Files
| File | Purpose |
|:--|:--|
| `/systems/hero/HeroGenerator.js` | `generateHero()`, `generateCandidates()` |
| `/systems/hero/HeroManager.js` | `createHero()`, `getHero()`, `getAllHeroes()` |

### Tests
```javascript
test('generateHero creates valid hero object', ...)
test('createHero adds to GameState', ...)
```

### Verification
- [ ] `HeroManager.createHero()` in console creates hero
- [ ] Hero appears in `GameState.heroes`
- [ ] Class/Trait bonuses apply to skills

---

## Phase 8: Skill System + ModifierAggregator

### Files
| File | Purpose |
|:--|:--|
| `/systems/hero/SkillSystem.js` | `getSkillLevel()`, `getEffectiveLevel()`, `addXP()`, `meetsRequirement()` |
| `/systems/hero/ModifierAggregator.js` | `getModifiers()`, `invalidateCache()`, bonus calculation |

### Key Design
- ModifierAggregator collects bonuses from Class, Trait (and later: Equipment, Perks, Projects)
- Caches results per hero, invalidates on relevant state changes
- `getEffectiveLevel()` = base level + aggregated bonuses

### Tests
```javascript
test('addXP increases skill XP', ...)
test('level up occurs at correct XP threshold', ...)
test('class bonus adds +10 starting levels', ...)
test('ModifierAggregator caches correctly', ...)
test('getEffectiveLevel includes bonuses', ...)
```

### Verification
- [ ] `SkillSystem.addXP()` works
- [ ] Level calculated correctly from XP
- [ ] Event fires on level up
- [ ] Class/Trait bonuses reflected in effective level

---

## Phase 9: Hero UI

### Files
| File | Purpose |
|:--|:--|
| `/ui/components/ProgressBarComponent.js` | Reusable progress bar |
| `/ui/components/HeroCardComponent.js` | Hero card display |
| `/styles/components.css` | Progress bar, hero card styles |
| Update `/ui/panels/LeftPanel.js` | Render hero list |

### Verification
- [ ] Hero cards display in Left Panel
- [ ] HP/Energy bars render correctly
- [ ] Status badge shows "Idle"
- [ ] Class/Trait icons display

---

## Phase 10: Notification System

### Files
| File | Purpose |
|:--|:--|
| `/systems/core/NotificationSystem.js` | `notify()`, `getQueue()`, `dismiss()` |
| `/ui/components/ToastNotificationComponent.js` | Toast display |
| `/styles/notifications.css` | Toast styles, animations |

### Key Design
- Queue-based with auto-dismiss (3-5s configurable)
- Types: `success`, `info`, `warning`, `error`
- Stacks max 5 toasts, older ones dismissed
- Message grouping for repeated notifications

### Verification
- [ ] `NotificationSystem.notify('Test', 'success')` shows toast
- [ ] Toast auto-dismisses after timeout
- [ ] Multiple toasts stack correctly
- [ ] Click to dismiss works

---

## Phase 11: Regen System

### Files
| File | Purpose |
|:--|:--|
| `/systems/hero/RegenSystem.js` | `tick()` → regenerate HP/Energy for idle heroes |
| Update `GameLoop.js` | Call RegenSystem.tick() |

### Verification
- [ ] Heroes with < max HP regenerate over time
- [ ] Heroes with < max Energy regenerate over time
- [ ] UI bars update in real-time

---

## Phase 12: Card Registry

### Files
| File | Purpose |
|:--|:--|
| `/config/registries/cardRegistry.js` | `well`, `logging`, `mining` task templates |

### Key Content
```javascript
export const CARDS = {
  well: { id: 'well', name: 'Well', cardType: 'task', skill: 'nature', ... },
  logging: { ... },
  mining: { ... }
};
```

### Verification
- [ ] 3+ basic task cards defined
- [ ] Each has required fields (skill, tickTime, outputs)

---

## Phase 13: Card Manager

### Files
| File | Purpose |
|:--|:--|
| `/systems/cards/CardManager.js` | `createCard()`, `getCard()`, `getActiveCards()`, `discardCard()`, `assignHero()`, `unassignHero()` |
| Update `GameState.js` | Add `cards` section |

### Tests
```javascript
test('createCard adds to active cards', ...)
test('assignHero sets heroSlotId', ...)
```

### Verification
- [ ] `CardManager.createCard()` works
- [ ] Cards appear in `GameState.cards.active`
- [ ] Can assign/unassign hero

---

## Phase 14: Drag & Drop

### Files
| File | Purpose |
|:--|:--|
| `/ui/DragDropHandler.js` | Drag/drop event handling |
| Update `HeroCardComponent.js` | Make draggable |
| `/styles/components.css` | Drag states (.dragging, .drop-zone--valid) |

### Verification
- [ ] Can drag hero cards
- [ ] Visual feedback on drag
- [ ] Valid/invalid drop zones highlight

---

## Phase 15: Task System

### Files
| File | Purpose |
|:--|:--|
| `/ui/components/CardComponent.js` | Base card structure |
| `/ui/renderers/TaskCardRenderer.js` | Task-specific body |
| `/styles/cards.css` | Card styling |
| `/systems/cards/TaskSystem.js` | `tick()` → process progress, completion |
| Update `GameLoop.js` | Call TaskSystem.tick() |
| Update `CenterPanel.js` | Render cards |

### Verification
- [ ] Task cards render in Center Panel
- [ ] Drop hero on card → hero assigned
- [ ] Progress bar advances each tick
- [ ] XP awarded on completion
- [ ] Notification shows on completion

---

## Phase 16: Item Registry

### Files
| File | Purpose |
|:--|:--|
| `/config/registries/itemRegistry.js` | `wood`, `stone`, `water`, etc. |

### Verification
- [ ] 10+ basic items defined
- [ ] Each has id, name, type, stackable

---

## Phase 17: Inventory Core

### Files
| File | Purpose |
|:--|:--|
| `/systems/economy/InventoryManager.js` | `addItem()`, `removeItem()`, `getItem()`, `hasItem()` |
| Update `GameState.js` | Add `inventory` section |

### Tests
```javascript
test('addItem increases quantity', ...)
test('removeItem decreases quantity', ...)
test('items stack up to maxStack', ...)
```

### Verification
- [ ] `InventoryManager.addItem()` works
- [ ] Items appear in `GameState.inventory.items`
- [ ] Stacking works correctly

---

## Phase 18: Inventory UI

### Files
| File | Purpose |
|:--|:--|
| `/ui/components/InventoryGroupComponent.js` | Collapsible group |
| `/ui/components/InventoryItemComponent.js` | Item display |
| `/systems/economy/InventoryGroupManager.js` | Group CRUD |
| Update `RightPanel.js` | Render inventory |

### Verification
- [ ] Inventory groups display
- [ ] Items show icon, name, quantity
- [ ] Groups collapse/expand
- [ ] Can create/rename groups

---

## Phase 19: Task Output Connection

### Files
| File | Updates |
|:--|:--|
| `TaskSystem.js` | Call `InventoryManager.addItem()` on completion |
| `TaskCardRenderer.js` | Show output slot |

### Verification
- [ ] Complete task → item appears in inventory
- [ ] Correct item type and quantity
- [ ] UI updates immediately
- [ ] Notification shows item gained

---

## Phase 20: Save Core

### Files
| File | Purpose |
|:--|:--|
| `/systems/core/SaveManager.js` | `save()`, `loadSlot()`, `getSlotInfo()`, `getAllSlotInfos()`, `deleteSlot()` |
| `/systems/core/migrations.js` | `migrate()`, `VERSION_ORDER` |

### Tests
```javascript
test('save writes to localStorage', ...)
test('loadSlot reads and parses', ...)
test('migration transforms old format', ...)
```

### Verification
- [ ] Save writes to localStorage
- [ ] Load restores state
- [ ] Check data in DevTools > Application > localStorage

---

## Phase 21: Save UI

### Files
| File | Purpose |
|:--|:--|
| `/ui/components/ModalComponent.js` | Modal wrapper |
| `/ui/modals/SlotSelectionModal.js` | 3 save slots |
| Update `main.js` | Show slot selection on start |

### Verification
- [ ] Modal displays on game start
- [ ] 3 slots shown with info
- [ ] Can select slot to load
- [ ] Can start new game

---

## Phase 22: Auto-Save

### Files
| File | Updates |
|:--|:--|
| `GameLoop.js` | Auto-save check on tick |
| `SaveManager.js` | Add auto-save interval logic |
| Update `TopBar.js` | Manual save button |

### Verification
- [ ] Auto-save triggers every 30s
- [ ] Manual save button works
- [ ] beforeunload saves
- [ ] Refresh preserves state

---

## Phases 23-44: Post-MVP

*Each follows the same granular pattern. Abbreviated for space.*

| Phase | Focus | Key Files |
|:--|:--|:--|
| 23 | Biome & Modifier Registries | `biomeRegistry.js`, `modifierRegistry.js` |
| 24 | Explore Cards | `ExploreSystem.js`, `ExploreCardRenderer.js` |
| 25 | Area Cards | `AreaCardRenderer.js` |
| 26 | Project System | `projectRegistry.js`, `ProjectSystem.js` |
| 27 | Recipe Registry | `recipeRegistry.js` |
| 28 | Recipe Cards | `RecipeSystem.js`, `RecipeCardRenderer.js` |
| 29 | Enemy Registry | `enemyRegistry.js`, `dropTableRegistry.js` |
| 30 | Combat Formulas | `CombatFormulas.js` |
| 31 | Combat + Loot System | `CombatSystem.js`, `WoundedSystem.js`, `LootSystem.js` |
| 32 | Invasion Registry | `invasionRegistry.js`, `threatRegistry.js` |
| 33 | Invasion System | `InvasionManager.js`, `ThreatSystem.js` |
| 34 | Equipment System | `EquipmentManager.js`, hero equipment UI |
| 35 | Perk Registry | `perkRegistry.js` (180 perks) |
| 36 | Perk System | `PerkSystem.js`, `PerkChoiceModal.js` |
| 37 | Recruit Cards | `RecruitSystem.js`, `RecruitCardRenderer.js` |
| 38 | Tool/Consumable | `ToolDurabilitySystem.js`, `ConsumableSystem.js` |
| 39 | Offline Progress | `OfflineProgressSystem.js`, `OfflineProgressModal.js` |
| 40 | Export/Import | Update `SaveManager.js` |
| 41 | Card Upgrading | `CardUpgradeSystem.js` |
| 42 | Hero Details Modal | `HeroDetailsModal.js`, full skill breakdown |
| 43 | Settings & Options | `SettingsModal.js`, volume, intervals |
| 44 | Final Polish | Full testing, optimization, cleanup |

---

## Per-Phase Verification Template

After **each phase**, complete:

1. **Automated Tests**
   - [ ] Run `npm test -- [phase]`
   - [ ] All tests pass

2. **Manual Verification**
   - [ ] Execute phase-specific checklist
   - [ ] Confirm feature works end-to-end

3. **Optimization Pass**
   - [ ] No console errors
   - [ ] Profile if performance-critical

4. **UI Polish**
   - [ ] Visual review
   - [ ] Correct colors, spacing, fonts
   - [ ] Responsive at 1024px

5. **Codebase Review**
   - [ ] Naming conventions followed
   - [ ] No unused imports
   - [ ] Consistent patterns

---

## File Count by Phase

| MVP Phases | Files |
|:--|:--|
| 0-5 (Foundation) | 15 |
| 6-11 (Heroes + Notifications) | 15 |
| 12-15 (Tasks) | 10 |
| 16-19 (Inventory) | 8 |
| 20-22 (Save) | 6 |
| **Total MVP** | **~54 files** |

| Post-MVP Phases | Files |
|:--|:--|
| 23-26 (Explore/Areas) | 8 |
| 27-28 (Recipes) | 4 |
| 29-31 (Combat + Loot) | 7 |
| 32-33 (Invasions) | 5 |
| 34-36 (Equipment + Perks) | 5 |
| 37-44 (Extras) | 13 |
| **Total Post-MVP** | **~42 files** |

**Grand Total: ~96 files across 44 phases**

---

## Key Sequencing Changes Applied

| Change | Reason |
|:--|:--|
| **ModifierAggregator → Phase 8** | Needed for `getEffectiveLevel()` to include class/trait bonuses |
| **Notifications → Phase 10** | Needed for level-ups, task completions, item rewards in MVP |
| **Combat + Loot merged → Phase 31** | Tightly coupled systems, test together |
| **Equipment → Phase 34** | Before Perks so perk effects can reference equipment |
| **Perks → Phases 35-36** | After Equipment for proper dependency order |
