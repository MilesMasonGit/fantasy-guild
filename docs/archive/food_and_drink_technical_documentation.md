# Technical Documentation: Food & Drink System

## Overview
The Food and Drink system in *Fantasy Guild Idle* allows heroes to automatically sustain themselves during combat. It transitions from traditional consumable usage to a **Persistent Link Model**, where items remain assigned to the hero even when the vault stack is empty.

## Core Architecture

### 1. Persistent Link Model
Unlike traditional inventory systems, food and drink are **equipped** as a reference to a vault stack.
- **Assignment**: `EquipmentManager` links the `itemId` to the hero's `food` or `drink` slot.
- **Non-Consumptive**: Equipping does NOT remove the item from the vault.
- **Syncing**: Performance is maintained by syncing bonuses (if any) and quantity data during the engine tick.

### 2. Auto-Consumption Logic
The logic resides in [CombatSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/combat/CombatSystem.js) and executes during the combat loop.

- **Trigger**: [checkAndConsumeFood(card, hero)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/combat/CombatSystem.js#463-541) and `checkAndConsumeDrink(card, hero)`.
- **Threshold**: Controlled by `CONSUMPTION_THRESHOLD` in [CombatFormulas.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/CombatFormulas.js) (default: 20%).
- **Process**:
    1. Check if the hero's primary stat (HP or Energy) is below the threshold.
    2. Retrieve the assigned `itemId` from the hero's equipment.
    3. Verify item existence and vault stock via `InventoryManager.hasItem(itemId, 1)`.
    4. Apply restoration to the hero's current stat based on the item's `restoreAmount`.
    5. Decrement the vault stack via `InventoryManager.removeItem(itemId, 1)`.
    6. **Publish Event**: `combat_consumed`.

### 3. Dynamic Restoration
Items are not locked to a specific stat. The system prioritizes the `restoreType` property from the item registry:
- **`restoreType: 'hp'`**: Restores Health.
- **`restoreType: 'energy'`**: Restores Energy.
- **Fallbacks**: Food defaults to `hp`, Drink defaults to `energy`.

## UI Integration

### Hero Equipment Grid ([EquipmentGrid.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/hero/EquipmentGrid.jsx))
- **Durability Bar**: Displays the current durability percentage for the primary item in the stack.
- **Quantity Sync**: Updates in real-time as the vault stack is consumed.
- **Empty State**: Displays a grayscale filter and an **"EMPTY"** overlay when the vault quantity hits zero.

### Vault List ([InvView.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/InvView.jsx))
- Each row in the vault now includes a compact [ItemDurabilityBar](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/vault/ItemDurabilityBar.jsx#4-38) for all gear and consumables, providing immediate feedback on item health.

## Key Files
- [src/systems/combat/CombatSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/combat/CombatSystem.js): Main consumption loop.
- [src/utils/CombatFormulas.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/CombatFormulas.js): Consumption thresholds and triggers.
- [src/systems/inventory/InventoryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/inventory/InventoryManager.js): Vault stock management.
- [src/ui/components/hero/EquipmentGrid.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/hero/EquipmentGrid.jsx): Hero-side UI components.
- [src/config/registries/itemRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/itemRegistry.js): Template definitions for restoration values.

## Future Maintenance
- **Adjusting Thresholds**: Modify `CONSUMPTION_THRESHOLD` in [CombatFormulas.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/CombatFormulas.js).
- **Adding New Consumables**: Ensure `equipSlot` is set to either 'food' or 'drink' and provide `restoreAmount`.
