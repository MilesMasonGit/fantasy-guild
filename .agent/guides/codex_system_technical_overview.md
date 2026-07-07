# Technical Overview: Codex & Discovery System

This document provides a technical deep-dive into the Codex and Discovery infrastructure implemented for "Fantasy Guild Idle". This system is designed to be highly decoupled, event-driven, and robust against metadata variations.

## 1. System Architecture

The system follows a standard Manager-State-View pattern, mediated by a central `EventBus`.

- **Source of Truth**: [GameState.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/GameState.js) (Centralized collection state).
- **Control Logic**: [DiscoveryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js) (Event-driven discovery engine).
- **UI Layer**: [CollectionModal.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/modals/CollectionModal.jsx), [LootModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/LootModule.jsx), [ItemIcon.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ItemIcon.jsx).
- **Glue**: `EventBus.js` (Decouples game systems from discovery logic).

---

## 2. Data Model

Discovery state is persisted in `GameState.state.collection`.

```javascript
collection: {
    discoveredItems: { "item_id": true },
    discoveredEnemies: { "enemy_id": true },
    discoveredCards: { "template_id": true },
    itemLifetimeCounts: { "item_id": number },
    enemyKillCounts: { "enemy_id": number }
}
```

- **Discovered Flags**: Binary true/false tracking.
- **Lifetime Counts**: Incremental tracking for "found" items and "defeated" enemies.

---

## 3. Discovery Engine ([DiscoveryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js))

The `DiscoveryManager` is the brain of the system. It initializes on game start and subscribes to key game events:

### Event Subscriptions
- `inventory_updated`: Triggers [discoverItem](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#69-97) if quantity is added.
- `card_spawned`: Triggers [discoverCard](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardCraftingSystem.js#76-106) (for Tasks) and [discoverEnemy](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#115-137) (for Combat).
- `card_transformed`: Triggers [discoverEnemy](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#115-137) (for Ambushes/Combat starts).
- `combat_victory`: Triggers [recordEnemyKill](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#138-157).

### Key Methods
- [discoverItem(itemId, amount)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#69-97): Flags item and increments lifetime count.
- [discoverEnemy(enemyId)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#115-137): Flags enemy as discovered (Encounter-based reveal).
- [recordEnemyKill(enemyId)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js#138-157): Increments kill counter for Bestiary.

> [!IMPORTANT]
> Every discovery event publishes `state_changed`. This is critical for reactive UI hooks like [useDiscovery](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/hooks/useDiscovery.js#4-65) to invalidate and re-render.

---

## 4. Asset & Icon Pipeline

### [AssetManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/AssetManager.js)
The [resolveSpritePath](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/AssetManager.js#16-74) utility is hardened against malformed IDs and missing metadata. It follows a strict priority:
1.  **Explicit `.sprite` override** on the entity.
2.  **Manifest Lookup** (`SPRITE_MANIFEST`).
3.  **Smart Path Guessing** for legacy item folders (e.g., `ore_` -> `mining/ore/`).

### [ItemIcon.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ItemIcon.jsx)
A unified renderer that handles:
- **Discovery Masking**: Automatically shows `❓` if `isDiscovered=false`.
- **String Resolution**: If passed a string ID instead of an object, it looks up the item/enemy registry to find the correct icon/sprite.
- **Emoji Fallback**: Gracefully falls back to emojis if no sprite is found in the manifest or guesser.

---

## 5. UI Implementation

### [CollectionModal.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/modals/CollectionModal.jsx) (The Codex)
Organizes discovery into two primary tabs: **Item Log** and **Bestiary**.
- Uses [EntityDetailView](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/modals/CollectionModal.jsx#190-330) for rich info (stats, sources, usages).
- Implements `?` masking in the grid to encourage exploration.

### [LootModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/LootModule.jsx) (Loot Tables)
A resilient module used in both Combat cards and Task cards.
- **Logic**: Formats raw drop arrays into a standard loot display.
- **Masking**: Uses [ItemIcon](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ItemIcon.jsx#7-90) with [isDiscovered](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardCraftingSystem.js#67-75) computed from the global discovery state.

---

## 6. Reward Processing ([ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js))

Work cycle rewards use a **Weighted Pick** system.
- Calculate `totalWeight` of all `outputs`.
- Roll a single value between 0 and `max(100, totalWeight)`.
- Grant **EXACTLY ONE** reward per cycle (either an item or a combat trigger).

---

## 7. Developer Notes & Extension Points

### Adding a New Discovery Type
1.  Update [StateSchema.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/StateSchema.js) to include the new collection category.
2.  Add a tracking method to [DiscoveryManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/DiscoveryManager.js).
3.  Subscribe to the relevant event in `DiscoveryManager.init()`.
4.  Update [CollectionModal.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/modals/CollectionModal.jsx) to include a new tab or filter.

### Troubleshooting Missing Icons
- Check [AssetManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/utils/AssetManager.js) to see if the ID matches a "Smart Guess" folder.
- Ensure the item is in `sprite-manifest.js` if it's a new pixel art asset.
- Verify `item.icon` (emoji) is set as a fallback in the registry.
