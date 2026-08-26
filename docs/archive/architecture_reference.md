# Fantasy Guild Idle — Architecture Reference

> **Post-refactor documentation (March 2026).** This document describes the codebase after the Protocol-First standardization. If you are an agent working on this project, read this first.

---

## 1. High-Level Architecture

Fantasy Guild Idle is a Vite + React idle card game. The architecture separates cleanly into three layers:

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React)                               │
│  src/ui/  — Components, hooks, modals, styles   │
│  Read-only access to GameState. Never mutates.  │
├─────────────────────────────────────────────────┤
│  Engine Layer (Vanilla JS)                      │
│  src/systems/  — All game logic, 16 subsystems  │
│  Mutates GameState. Publishes events via Bus.   │
├─────────────────────────────────────────────────┤
│  Data Layer                                     │
│  src/config/   — Registries, formulas, consts   │
│  src/state/    — GameState, StateSchema         │
│  data/cards/   — JSON card definitions          │
└─────────────────────────────────────────────────┘
```

**Key Principle**: The engine layer is React-agnostic. No system in `src/systems/` should import from `src/ui/`. React components consume engine state via the `useEngine()` hook and react to `EventBus` events.

---

## 2. Directory Map

### `src/config/` — Static Data & Configuration

| Path | Purpose |
|------|---------|
| `FormulaRegistry.js` | **Centralized game math**. All balance constants, scaling curves, XP tables, combat formulas. Every system references this — never inline magic numbers. |
| `constants.js` | Game-wide constants (tick rates, max heroes, etc.) |
| `uiConstants.js` | UI-specific constants (card dimensions, z-indices) |
| `cards/card-presets.js` | Trait preset templates for card archetypes |
| `cards/CardValidator.js` | Validates card definitions at startup |
| `registries/` | 24 registry files (see §2.1) |

#### 2.1 Registry Files (`src/config/registries/`)

| Registry | Description |
|----------|-------------|
| `cardRegistry.js` | Master card registry. Loads JSON from `data/cards/`, expands presets, exports `getCard()`, `CARD_TYPES` |
| `itemRegistry.js` | All items (resources, tools, food, equipment). `getItem(id)` |
| `enemyRegistry.js` | Enemy definitions with stats, abilities, loot tables |
| `skillRegistry.js` | Skill tree definitions and XP curves |
| `areaSetRegistry.js` | Area/biome configurations (Guild Hall, Farmland, etc.) |
| `projectRegistry.js` | Building/ritual project definitions with tiered requirements |
| `invasionRegistry.js` | Invasion event definitions with horde configs |
| `dungeonRegistry.js` | Dungeon floor sequences |
| `questRegistry.js` | Quest encounter definitions |
| `sprite-manifest.js` | Sprite path resolution for pixel art assets |
| `layoutConstants.js` | `PLAYMAT_PADDING`, `GRID_PITCH` for card grid layout |
| `index.js` | Re-exports common lookups (`getItem`, `getCard`, `getEnemy`, etc.) |

### `src/state/` — Game State

| File | Purpose |
|------|---------|
| `GameState.js` | Singleton state container. `GameState.state` is the root. Handles Flyweight serialization (see §4). |
| `StateSchema.js` | `initNewState()` — generates a clean save. Defines all state shape defaults. |

### `src/systems/` — Engine Layer (16 Subsystems)

| Directory | Key Files | Responsibility |
|-----------|-----------|---------------|
| `core/` | `GameLoop.js`, `EventBus.js`, `SaveManager.js`, `AudioSystem.js`, `TimeManager.js`, `NotificationSystem.js`, `SettingsManager.js`, `DiscoveryManager.js` | Game loop tick dispatch, pub/sub events, save/load, audio, notifications |
| `cards/` | `CardManager.js`, `CardAssembler.js`, `ModuleProcessors.js`, `DeckSystem.js`, `LibraryManager.js`, `PackSystem.js`, `RecruitSystem.js`, `CardCraftingSystem.js` | Card CRUD, trait generation, tick processing, deck management |
| `dnd/` | `DndRouter.js` | **All drag-and-drop resolution logic.** Extracted from ReactRoot. 12 D&D branches. |
| `economy/` | `CurrencyManager.js`, `TransactionProcessor.js` | Gold/influence management, unified reward granting |
| `hero/` | `HeroManager.js`, `HeroGenerator.js`, `SkillSystem.js` | Hero lifecycle, stat calculations, skill XP |
| `inventory/` | `InventoryManager.js` | Item storage, quantity tracking |
| `combat/` | `CombatSystem.js` | Combat tick resolution, damage calculation |
| `effects/` | `EffectEngine.js` | Modifier/buff system, adjacency effects |
| `equipment/` | `EquipmentSystem.js` | Hero equipment slots, equip/unequip |
| `area/` | `AreaStateManager.js` | Area progression, biome unlocks |
| `exploration/` | `ExplorationSystem.js` | Explore card work cycles, quest generation |
| `project/` | `ProjectManager.js` | Building/ritual tiered progression |
| `progression/` | `ProgressionManager.js` | Milestone tracking, unlock gates |
| `threat/` | `ThreatSystem.js` | Regional threat escalation, debuff milestones |
| `global/` | `RegenSystem.js` | Passive hero HP/energy regeneration |
| `task/` | (mostly deprecated) | Legacy task system remnants |

### `src/ui/` — React UI Layer

| Path | Purpose |
|------|---------|
| `ReactRoot.jsx` | Top-level React component. Mounts dnd-kit provider, calls `DndRouter.resolve()` on drag end. |
| `components/CardView.jsx` | Renders a single card. Iterates traits → calls `ModuleRegistry.renderTraitModule()`. |
| `components/card-modules/` | **20 card module components** (one per trait type). All wrapped in `React.memo`. |
| `components/card-modules/ModuleRegistry.jsx` | Maps trait types to React components. Central dispatch for module rendering. |
| `components/base/` | Shared UI primitives: `CardSlot`, `EntityDraggable`, `ItemIcon`, `GridCell`, `PlaymatViewport` |
| `components/combat/` | `CombatDisplay.jsx` — combat-specific UI |
| `hooks/useEngine.js` | Provides engine singleton to React components |
| `hooks/useGameState.js` | Reactive state subscription hook |
| `context/` | React context providers |
| `modals/` | Modal dialogs (settings, hero customize, library, etc.) |

---

## 3. Card System — The Core Abstraction

Every game entity on the playmat is a **Card**. Cards are pure data containers with a `traits` array that drives both engine behavior and UI rendering.

### 3.1 Card Types

Defined in `cardConstants.js`:

```javascript
CARD_TYPES = { TASK, CRAFTING, COMBAT, INVASION, PROJECT, DUNGEON, BLUEPRINT, RECRUIT, AREA }
```

### 3.2 Trait System

Each card has `card.traits = [...]`, an ordered array of trait objects. Each trait has a `type` field that determines:
1. Which **engine processor** handles its tick logic (`ModuleProcessors.js`)
2. Which **React module** renders its UI (`ModuleRegistry.jsx`)

Key trait types:

| Trait Type | Engine Behavior | UI Module |
|-----------|----------------|-----------|
| `header` | None | `CardHeaderModule` — name, icon, status badges |
| `description` | None | `InfoModule` — card description text |
| `heroslot` | Hero assignment validation | `CardAssignmentModule` — hero drop zone |
| `toolslot` | Tool speed modifier | `ToolSlotModule` — tool drop zone |
| `inputslot` | Input consumption check | `InputSlotModule` — item drop zone |
| `blueprintslot` | Recipe configuration | `BlueprintSlotModule` — blueprint drop zone |
| `workcycle` | Progress bar tick, completion trigger | `TaskStage` — progress bar |
| `combat` | Damage exchange, death check | `CombatModule` — HP bars |
| `loot` | None (display only) | `LootModule` — output preview |
| `unifiedreward` | XP/item grant on cycle complete | (internal, no UI) |
| `projectpanel` | Project tier progression | `ProjectProgressModule` |
| `invasionpanel` | Threat display | `ThreatModule` |

### 3.3 Card Lifecycle

```
1. CardRegistry loads JSON definition from data/cards/
2. CardManager.createCard() instantiates a live card
3. CardAssembler.ensureModular() generates traits + slots map
4. Card placed on playmat grid → rendered by CardView.jsx
5. GameLoop ticks → ModuleProcessors.processModularTick() runs trait processors
6. On save → GameState.serialize() strips static props (Flyweight)
7. On load → GameState.initFromSave() rehydrates from CardRegistry
```

### 3.4 Card Slots Map (`card.slots`)

Every card now has a unified `card.slots` map generated by `CardAssembler.buildSlotsFromTraits()`. This is the **canonical assignment model**.

```javascript
card.slots = {
    'hero-0':      { type: 'hero',      entityId: 'hero_abc', config: { title: 'Worker' } },
    'tool-0':      { type: 'tool',      entityId: 'iron_pickaxe', config: { toolType: 'pickaxe', minTier: 1 } },
    'input-0':     { type: 'item',      entityId: 'oak_log', config: { itemId: 'oak_log', quantity: 5 } },
    'blueprint-0': { type: 'blueprint', entityId: null, config: { acceptedBlueprints: [...] } },
};
```

**Slot API** (in `CardManager.js`):
- `assignToSlot(cardId, slotKey, entityId)` — Assigns entity, syncs legacy props, bridges HeroManager
- `unassignSlot(cardId, slotKey)` — Removes entity, syncs legacy props

**Important**: Legacy assignment properties (`assignedHeroId`, `heroSlots`, `assignedToolId`, `assignedItems`, `assignedBlueprintId`) are still maintained in parallel via the slot API's legacy sync bridge. All existing code reads from these legacy properties. The `card.slots` map is the **new canonical source** and should be preferred for new code.

**Serialization**: `card.slots` is in `VOLATILE_CARD_PROPS` — it's stripped on save and rebuilt from traits + legacy props on load by `buildSlotsFromTraits()`.

---

## 4. Flyweight Serialization Protocol

Save files are lean. `GameState.serialize()` strips two categories from each card:

1. **Static props** (`STATIC_CARD_PROPS`): `name`, `description`, `icon`, `traits`, `config`, `outputs`, `inputs`, etc. These are re-attached from `CardRegistry` on load.
2. **Volatile props** (`VOLATILE_CARD_PROPS`): `_rev`, `aggregator`, `currentTickTime`, `adjacencyEffects`, `progress`, `slots`. These are recalculated on load.

What remains in the save: `id`, `cardType`, `templateId`, `position`, `assignedHeroId`, `heroSlots`, `assignedToolId`, `assignedItems`, `assignedBlueprintId`, `status`, `enemyHp`, `combatState`, `level`, `inputProgress`.

On load, `GameState.initFromSave()` loops through saved cards and calls `CardAssembler.ensureModular()` to rebuild traits + slots from the template.

---

## 5. Drag & Drop Architecture

All D&D uses `@dnd-kit/core`. The resolution logic is fully decoupled from React:

1. **ReactRoot.jsx** mounts `<DndContext>` and handles `onDragEnd`
2. `handleDragEnd` is a thin proxy: cleans up CSS → calls `DndRouter.resolve(event, engine)`
3. **DndRouter.js** (`src/systems/dnd/`) contains ALL 12 D&D branches:
   - Card grid placement / card swap
   - Hero assignment (slot-specific, smart routing)
   - Hero unassignment / swap between cards
   - Tool assignment / item assignment
   - Blueprint assignment
   - Item sell (drop on sell zone)
   - Inventory reordering / group moves
   - Tavern/roster panel drops

Each branch returns `{ success, action, ... }` for the caller to optionally flash animations.

---

## 6. TransactionProcessor

`src/systems/economy/TransactionProcessor.js` — Unified reward/cost processing.

**All reward-granting code should use this module.**

```javascript
import * as TransactionProcessor from '../economy/TransactionProcessor.js';

// Simple grant
TransactionProcessor.apply({
    entries: [
        { type: 'ITEM', id: 'oak_log', amount: 5 },
        { type: 'XP', skill: 'woodcutting', amount: 25 },
        { type: 'CURRENCY', id: 'gold', amount: 100 },
    ]
}, heroId);

// Weighted loot table pick (grants one random reward)
TransactionProcessor.weightedPick(lootTable, heroId);

// Convert legacy outputs array to transaction schema
const tx = TransactionProcessor.fromOutputs(outputs, skill, xpAmount);
```

Entry types: `ITEM`, `CURRENCY` (`gold`, `influence`), `XP`.
Entries can have `chance` (0-100) for individual roll probability.

---

## 7. FormulaRegistry

`src/config/FormulaRegistry.js` — **Single source of truth for all game math.**

All balance constants and scaling functions live here. Systems import from this file rather than defining their own:

```javascript
import { XP_PER_ACTION, HERO_BASE_HP, toolSpeedMultiplier } from '../../config/FormulaRegistry.js';
```

Key exports: `XP_PER_ACTION`, `HERO_BASE_HP`, `HERO_BASE_ENERGY`, `BASE_REGEN_RATE`, `HERO_BASE_ATTACK`, `HERO_BASE_DEFENSE`, `ENERGY_REGEN_PER_SECOND`, `getHeroMaxHP()`, `getHeroAttack()`, `getHeroDefense()`, `toolSpeedMultiplier()`, `getXpForLevel()`, `getSkillXpForLevel()`.

**Rule**: If you need a formula or balance constant, check here first. If it doesn't exist, add it here — not inline.

---

## 8. EventBus

`src/systems/core/EventBus.js` — Pub/sub message bus connecting engine ↔ UI.

```javascript
EventBus.publish('cards_updated', { cardId, source: 'slot_assign' });
EventBus.subscribe('inventory_updated', callback);
```

Key events:
- `cards_updated` — Card state changed (assignment, status, position)
- `inventory_updated` — Item quantities changed
- `hero_updated` — Hero stats/status changed
- `module_cycle_complete` — A workcycle finished on a card
- `transaction_applied` — TransactionProcessor granted rewards
- `audio:play` — Trigger a sound effect
- `state_changed` — Generic state mutation (use sparingly)

---

## 9. React Performance Conventions

### Stable Keys
Card modules use `${trait.id || trait.type}-${index}` as React keys — **never `_rev`**. Using `_rev` in keys causes full unmount/remount every tick.

### React.memo
All 15 of 16 card modules are wrapped in `React.memo`. When adding a new module, always wrap it:

```jsx
export const MyModule = React.memo(({ trait, card }) => {
    // ...
});
```

### CSS Transitions (Not framer-motion)
Slot drawer expand-on-hover uses CSS classes, not `motion.div`:

```jsx
<div
    style={{ width: isHovered ? 228 : 72 }}
    className={cn("gi-slot-drawer", ...)}
>
    <div className={cn("gi-slot-label", isHovered && "gi-slot-label--visible")}>
```

CSS classes defined in `src/styles/components.css`:
- `.gi-slot-drawer` — `transition: width 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)`
- `.gi-slot-label` — opacity/transform transition
- `.gi-slot-label--visible` — visible state

**Exception**: `TaskDisplay.jsx` uses framer-motion for complex looping choreography — this is acceptable for multi-step keyframe animations.

---

## 10. Game Loop & Tick Processing

`GameLoop.js` runs at ~60fps, accumulating delta time and dispatching to systems:

```
GameLoop.tick(deltaTime)
  → ModuleProcessors.processModularTick(card, deltaTime)  // For each active card
      → processWorkCycle()    // workcycle trait
      → processCombat()       // combat trait
      → processExpiration()   // expiration trait
  → ThreatSystem.tick(deltaTime)
  → RegenSystem.tick(deltaTime)
  → InvasionSystem.tick(deltaTime)
```

`ModuleProcessors.js` is the central dispatcher for card-specific tick logic. It routes based on trait type. The `completeWorkCycle()` function handles:
1. Input consumption (checking `assignedItems` against `inputs`)
2. Weighted output selection (loot tables)
3. Reward granting (via `TransactionProcessor`)
4. Combat transformation triggers

---

## 11. Adding New Content — Quick Reference

### New Card Type
1. Add type to `CARD_TYPES` in `cardConstants.js`
2. Add JSON definitions in `data/cards/<type>/`
3. Add trait generator in `CardAssembler.js` (`generateXxxTraits()`)
4. Add `ensureModular` case for the type
5. Add tick processor in `ModuleProcessors.js` if the card ticks
6. Add UI module in `card-modules/` and register in `ModuleRegistry.jsx`

### New Item
1. Add to `itemRegistry.js` with `id`, `name`, `icon`, `type`, `rarity`, etc.
2. If it has a sprite: add to `sprite-manifest.js` and place the asset in `public/sprites/`

### New Slot Type
1. Add trait generator in the relevant `generateXxxTraits()` function
2. The `buildSlotsFromTraits()` function will need a new `else if` clause
3. The `assignToSlot()`/`unassignSlot()` functions will need a new case

### New System Event
1. Publish via `EventBus.publish('event_name', data)`
2. Subscribe in the consuming system or UI component
3. Add to the Key Events list in this document

---

## 12. File Size Quick Reference

These are the largest and most critical files — handle with care:

| File | Lines | Role |
|------|-------|------|
| `CardManager.js` | ~1780 | Card CRUD, all assignment APIs, grid placement |
| `ModuleProcessors.js` | ~1010 | All card tick logic, work cycles, combat |
| `CardAssembler.js` | ~510 | Trait generation, slot building, blueprint sync |
| `ReactRoot.jsx` | ~560 | React root, D&D context mount |
| `CardView.jsx` | ~560 | Single card renderer, trait iteration |
| `itemRegistry.js` | ~700 | All item definitions |
| `enemyRegistry.js` | ~400 | All enemy definitions |
| `projectRegistry.js` | ~350 | All project definitions |

---

## 13. Git History (Refactor Commits)

| Commit | Session | Description |
|--------|---------|-------------|
| `c51080e` | Baseline | Pre-refactor state |
| `0083bef` | S1 | Legacy cleanup, dead code removal |
| `d6e5efb` | S2 | FormulaRegistry centralization |
| `af3bd25` | S3 | Flyweight serialization |
| `5116761` | S4 | DndRouter extraction, TransactionProcessor |
| `50938a9` | S5 | Unified slot model + API |
| `3facc61` | S6 | React.memo, CSS transitions, key fix |
