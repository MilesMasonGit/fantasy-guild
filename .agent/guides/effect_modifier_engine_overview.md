# Effect & Modifier Engine: Technical Overview

The Effect & Modifier Engine is a unified, reactive system designed to handle spatial, environmental, and entity-driven bonuses in Fantasy Guild Idle. It replaces legacy adjacency and environmental bonus systems with a scalable, pulse-based architecture.

## Core Architecture

The system consists of three primary layers:

### 1. Unified Modifier Interface (UMI)
All modifiers follow a strict JSON schema to ensure cross-component compatibility.
*   **Source**: `sourceId` (e.g., `aura:hero_123`, `tile:4,5`).
*   **Type**: Uppercase string from `EFFECT_TYPES` (e.g., `SPEED`, `DAMAGE`).
*   **Target**: Object containing `category` (from `TARGET_CATEGORIES`).
*   **Value**: Float (additive stacking, e.g., `0.2` for +20%).

### 2. AuraManager & Spatial Logic
[AuraManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/AuraManager.js) orchestrates grid-wide pulses:
*   **PulseGrid()**: Clears all `aura:` and `tile:` modifiers and rescans the board.
*   **Chebyshev Distance**: Uses 8-way (Moore) neighborhood for card-to-card auras.
*   **Tile Lookups**: Resolves tile IDs via [tileRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/tileRegistry.js) to apply environmental bonuses.

### 3. ModifierAggregator
Each card and hero possesses a [ModifierAggregator](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js#7-148) instance:
*   **Additive Stacking**: Calculates totals using `1 + Sum(modifiers)`.
*   **Hierarchical Matching**: Supports parent-child category matching (e.g., `INDUSTRY` bonuses apply to `MINING` tasks).
*   **Caching**: Memoizes multipliers for O(1) loop performance; invalidates on pulse.

## Integration & Synchronization

### Triggers (The Pulse)
`EffectEngine.pulse()` is the central entry point. It is triggered by [CardManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js) and [AreaSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/area/AreaSystem.js) during:
*   Card movement ([updateCardPosition](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#966-986))
*   Card placement ([createCard](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#106-328))
*   Card removal ([discardCard](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#377-420))
*   Area/Biome switching ([initGridForArea](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/area/AreaSystem.js#72-115))

### UI Reactivity
To eliminate lag, [ModuleProcessors.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js) subscribes to the `effects_pulsed` event. 
When a pulse occurs:
1.  All aggregators are cleared and refilled.
2.  [recalculateAllCardStats()](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/ModuleProcessors.js#126-135) is called immediately.
3.  `card.currentTickTime` is updated for the UI *before* the next game loop tick.

## Key Files
*   [EffectEngine.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/EffectEngine.js): Singleton entry point.
*   [AuraManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/AuraManager.js): Board scanning and aura application.
*   [ModifierAggregator.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js): Multiplier calculation and hierarchy logic.
*   [constants.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/constants.js): `EFFECT_TYPES` and `TARGET_CATEGORIES`.

## Future Expansion
*   **Global Auras**: Register global modifier sources in [AuraManager](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/AuraManager.js#9-147).
*   **Complex Logic**: Use `LOGIC_OVERRIDE` effect types for behavior-changing perks.
*   **Multiplicative Layers**: Add a second pass for multiplicative bonuses if needed.
