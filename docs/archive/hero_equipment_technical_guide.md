# Technical Guide: Hero & Equipment Systems

This document provides a technical deep-dive into the Hero Management and Equipment systems for Fantasy Guild Idle. It is intended as a reference for future AI agents and developers.

## 1. Hero Skill System (Rule of 9)

The game uses a consolidated **9-Skill System**. The legacy `defence` skill has been deprecated and removed.

### Core Architecture
- **Combat Specialization**: Every hero has exactly one primary combat skill (`melee`, `ranged`, or `magic`).
- **Parent Skills**: There are 8 non-combat "parent" skills (e.g., `industry`, `crime`, `science`).
- **Data Source**: [traitRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/traitRegistry.js) determines skill bonuses and modifiers.

### Implementation Details
- **Filtering**: [HeroGenerator.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/hero/HeroGenerator.js) enforces the 9-skill limit during generation.
- **UI Rendering**: [HeroIdentityStrip.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/HeroIdentityStrip.jsx) renders skills in a vertical list, calculating XP progress via [getSkill(id).getXpProgress()](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/skillRegistry.js#194-216).

---

## 2. Equipment & Modifier System

Equipment bonuses are no longer hard-coded into stat calculations. Instead, they use a centralized **Modifier Aggregator** pattern.

### Modifier Aggregator ([ModifierAggregator.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js))
- **Storage**: Modifiers are stored in a `Map` keyed by effect type (e.g., `DAMAGE`, `DEFENSE`).
- **Querying**: Use `aggregator.query(type, category)` to get the sum of flat bonuses or [getMultiplier()](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js#107-124) for percentage buffs.
- **Sources**: Modifiers are tagged with a `source` (e.g., `equip:armor`) to allow for clean removal without affecting other buffs.

### Equipment Manager ([EquipmentManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js))
- **[equipItem(heroId, itemId, slot)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js#88-176)**:
    1. Validates skill requirements.
    2. If the slot is occupied, calls [unequipItem](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js#177-215) first.
    3. Removes the `itemId` from `InventoryManager`.
    4. Updates `hero.equipment[slot]`.
    5. Adds persistent modifiers to `hero.aggregator` with `source: "equip:{slot}"`.
- **[unequipItem(heroId, slot)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js#177-215)**:
    1. Removes all modifiers associated with the source `equip:{slot}`.
    2. Returns the item to `InventoryManager`.
    3. Clears the slot.

---

## 3. Drag & Drop Equipping Flow

Equipping items is handled via a global DND context in [ReactRoot.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/ReactRoot.jsx).

### Interaction Flow
1. **Drag Source**: [InvView.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/InvView.jsx) (items in the Vault).
2. **Drop Target**: [HeroIdentityStrip.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/HeroIdentityStrip.jsx).
    - Uses `useDroppable` with `data: { type: 'hero', id: heroId }`.
    - Features a light highlight `ring-1 ring-gi-primary/30` when hovered with an item.
3. **Collision Detection**: `customCollisionDetection` in [ReactRoot.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/ReactRoot.jsx) filters targets based on the dragged entity type. [item](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/itemRegistry.js#895-903) drags are permitted to collide with `hero` targets.
4. **Resolution**: `handleDragEnd` detects an [item](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/itemRegistry.js#895-903) on a `hero` drop and dispatches:
    ```javascript
    const slot = getItem(entityId).equipSlot;
    engine.EquipmentManager.equipItem(overHeroId, entityId, slot);
    ```

---

## 4. Engine Integration

The systems are exposed to the React layer via the `EngineContext`.

### Global Exposure ([main.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/main.jsx))
- `EquipmentManager` is explicitly imported and added to the `window.Game` object.
- This ensures that [useEngine()](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/hooks/useEngine.js#4-16) hooks in React components can access `engine.EquipmentManager.equipItem` and [unequipItem](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/equipment/EquipmentManager.js#177-215).

### Key Events ([EventBus.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/EventBus.js))
- `hero_equipment_changed`: Emitted by `EquipmentManager` to notify UI about slot updates.
- `heroes_updated`: General refresh event for the roster.

---

## 5. Summary of Data Structures

### Hero Equipment State
```javascript
{
  id: "hero_iris",
  // ...
  equipment: {
    weapon: "iron_sword",
    armor: "leather_armor",
    food: null,
    drink: null
  }
}
```

### Item Template ([itemRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/itemRegistry.js))
```javascript
{
  id: "iron_armor",
  equipSlot: "armor",
  defense: 10,
  weight: 20
  // ...
}
```
