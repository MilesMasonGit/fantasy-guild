# Chaos & Invasion System Architecture

## Overview
The Chaos and Invasion system provides a dynamic regional threat mechanic. It consists of two primary phases: **Peaceful Accumulation (Chaos)** and **Active Escalation (Invasion/Threat)**.

### Data Flow Overview
1.  **Chaos Build-up**: Time ticks while an area is "Peaceful".
2.  **Invasion Trigger**: At 100% Chaos, an Invasion card is spawned.
3.  **Threat Escalation**: The Invasion card generates "Threat" over time.
4.  **Debuff Stacking**: Milestones in Threat apply global debuffs (e.g., Nature Speed penalty).
5.  **Resolution**: Defeating the Invasion horde clears all Threat and resets Chaos to zero.

---

## 1. Regional Chaos System
Managed by [ThreatSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/threat/ThreatSystem.js).

### Configuration
- **Max Points**: 1000 (`CHAOS_MAX`)
- **Stages**: `[250, 500, 750, 1000]`
- **Rate**: 250 points per game-hour (`CHAOS_PER_MS`).

### State Schema
Stored in `GameState.state.areaStates[areaId]`:
```json
{
  "chaosPoints": 420.5,
  "chaosStage": 1,
  "activeInvasionId": null
}
```

### Event Triggers
- **Stages 1-3**: Publishes `spawn_area_event`.
- **Stage 4**: Publishes `spawn_invasion`.

---

## 2. Invasion Management
Managed by [InvasionManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/combat/InvasionManager.js).

### Card Integration
Invasions are registered as a unique `cardType`: `invasion`.
- **Traits**: Typically include `horde_strength` (visual remaining count) and [threat](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/GameState.js#109-111) (visual escalation).
- **Horde Logic**: `CombatSystem` intercepts `invasion` victories to decrement `hordeCount`.

### Registry Format ([invasionRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/invasionRegistry.js))
```javascript
{
    id: 'hostile_hens',
    name: 'Poultry Uprising',
    enemyId: 'farmland_t1_chicken',
    count: 10,           // Total enemies in the horde
    threatRate: 1.0,     // % points added per second
    milestones: [
        { threat: 20, debuffId: 'pecking_order', stacks: 2 }
    ],
    rewards: [{ itemId: 'feather', count: 5 }]
}
```

---

## 3. Threat & Global Debuffs
Managed by [ThreatSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/threat/ThreatSystem.js).

### Logic
While `activeInvasionId` is set, [processInvasionThreat](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/threat/ThreatSystem.js#84-104) runs instead of Chaos.
- **Growth**: `threatRate * deltaTime`.
- **Milestones**: When a milestone threshold is crossed, a debuff is pushed to the global threat list.

### Global Persistence
Stored in `GameState.state.threats.activeDebuffs`:
```json
{
  "activeDebuffs": [
    { "id": "pecking_order", "areaId": "farmland", "stacks": 1, "startTime": 1679872800 }
  ]
}
```

### Modifier Integration
The [ModifierAggregator](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/effects/ModifierAggregator.js#7-189) calls `ThreatSystem.getGlobalMultiplier(effectType, category)`.
- It performs a lookup in [threatRegistry.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/registries/threatRegistry.js) to find the math values (e.g., `-0.1` for a 10% penalty).
- Multipliers are additive: `1.0 + (value * stacks)`.

---

## 4. UI Components

### [ChaosTracker.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/hud/ChaosTracker.jsx)
- **Location**: Top Bar.
- **Function**: Visualizes regional Chaos points and stage markers.
- **Reactivity**: Subscribes to `chaos_updated`.

### [InvasionHUD.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/hud/InvasionHUD.jsx)
- **Location**: Bottom-left of Playmat Viewport.
- **Function**: Summarizes the active invasion name, total threat %, and remaining forces.
- **Reactivity**: Subscribes to `invasion_threat_updated` and `combat_victory`.

### [ThreatModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/ThreatModule.jsx) (On-Card)
- **Location**: Specific to Invasion cards.
- **Function**: High-fidelity visualization of the escalation and active milestones.

---

## Technical Debt & Future Directions
- **Area Events**: Stages 1-3 currently fire `spawn_area_event` but lack a dedicated manager for non-invasion encounters.
- **Registry Decoupling**: Chaos rates and stage values are currently constants in [ThreatSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/threat/ThreatSystem.js). These should move to a `chaosRegistry.js` indexed by `areaId`.
- **Horde Scaling**: Current logic assumes a single enemy ID. Future hordes should support weighted random enemy tables.
