# Technical Documentation: Tool Durability System

This document outlines the architecture and implementation of the Tool Durability system in *Fantasy Guild Idle*. It provides a detailed guide for developers and AI agents to understand, maintain, and extend the system.

## 1. System Overview

The Tool Durability system treats tools as **consumable resources** with their own health (durability). Each time a task (Mining, Logging, etc.) completes a work cycle, the assigned tool loses **1 point of durability**. When an item's durability reaches zero, it is consumed from its inventory stack, and a new item from that same stack automatically takes its place.

## 2. Core Logic

### 2.1 Inventory Management
The central logic for durability lives in [src/systems/inventory/InventoryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js).

- **[decrementDurability(itemId, amount)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js#229-284)**: This is the primary function for reducing health.
- **Stack Reduction**: If `item.dur` reaches 0, the function:
  1. Reduces the `item.quantity` by 1.
  2. If quantity is still > 0, it **resets** `item.dur` to the template's `maxDurability`.
  3. If quantity is 0, the item entry is deleted from the inventory.
- **Events**: Publishes `inventory_durability_updated` for minor health changes and `inventory_updated` when a tool is consumed/removed.

### 2.2 Requirement Enforcement
Tasks will pause automatically if the assigned tool is completely depleted.

- **Modular System**: [ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js)'s [checkRequirements](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js#708-857) function verifies that the assigned `card.assignedToolId` still exists in the inventory via `InventoryManager.hasItem(assignedToolId)`. 
- **Legacy System**: [TaskSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/task/TaskSystem.js)'s [hasRequiredResources](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/task/TaskSystem.js#209-280) follows the same principle.

## 3. Engine Integration

The durability system is integrated into both task-processing engines of the game.

### 3.1 Modular Tasks ([ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js))
Inside [completeWorkCycle(card, trait)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js#175-343):
```javascript
// Consume Tool Durability (if assigned)
if (card.assignedToolId) {
    InventoryManager.decrementDurability(card.assignedToolId, 1);
}
```

### 3.2 Legacy Tasks ([TaskSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/task/TaskSystem.js))
Inside [completeTask(cardInstance, template, hero)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/task/TaskSystem.js#298-455):
```javascript
// 1. Consume Tool Durability (if assigned)
if (cardInstance.assignedToolId) {
    InventoryManager.decrementDurability(cardInstance.assignedToolId, 1);
}
```

## 4. Item Definitions

Tools must be defined with a `maxDurability` property in [src/config/registries/itemRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/itemRegistry.js).

```javascript
copper_pickaxe: {
    id: 'copper_pickaxe',
    name: 'Copper Pickaxe',
    type: ITEM_TYPES.TOOL,
    maxDurability: 100,  // REQUIRED for the system to work
    speedBonus: 0.2,     // 20% speed multiplier
    tier: 1,
    // ...
}
```

## 5. UI/UX Implementation

### 5.1 Tool Slot UI ([ToolSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/ToolSlotModule.jsx))
The UI visualizes durability by syncing directly with the inventory state rather than the card state.

- **Data Sync**: Uses `engine.GameState.inventory.items[assignedToolId]` to get the "live" durability of the current stack.
- **Durability Bar**: Renders the [ItemDurabilityBar](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/vault/ItemDurabilityBar.jsx#4-38) component positioned absolutely at the bottom of the tool icon.
- **Drawer Expansion**: Displays the specific speed bonus and name only when hovering over the slot to reduce visual clutter.

## 6. Future Extensions

- **Damage-over-time**: To change from per-completion to per-tick consumption, move the [decrementDurability](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js#229-284) call into [processModularTick](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js#23-49) in [ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js) and use `deltaTime` to scale the damage.
- **Repair System**: To implement repairs, add a function in [InventoryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js) to set `item.dur = template.maxDurability` for a resource cost (Gold, Spare Parts).
- **Tool Leveling**: Durability could potentially increase based on tool level or player mastery.

## 7. Troubleshooting

- **Task doesn't pause when tool breaks**: Check if the tool is actually being removed from inventory or if [checkRequirements](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js#708-857) in [ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js) is still finding a "ghost" of the item.
- **Durability bar doesn't update**: Verify that [ToolSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/ToolSlotModule.jsx) is successfully retrieving the inventory instance `invItem = engine.GameState.inventory.items[assignedToolId]`.
- **Stack count doesn't reduce**: Ensure [InventoryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js) is using `item.quantity` instead of the legacy `item.qty`.
