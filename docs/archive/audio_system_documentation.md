# Technical Documentation: Reactive Audio System

## 1. Overview
The **Audio System** in *Fantasy Guild Idle* is a centralized, event-driven singleton designed for lightweight, performant audio management. It handles background music (BGM) transitions between biomes, punctuating global sound effects (SFX), and contextual (hover-focused) sounds.

## 2. Architecture
The system resides in `src/systems/core/AudioSystem.js` and implements a singleton pattern:

- **Integration**:
  - `EventBus`: All audio triggers are received via the global `EventBus`.
  - `GameState`: Used for initial BGM state on boot.
  - `SettingsManager`: Reactive volume control via the `settings_updated` event.
  - `Logger`: Detailed diagnostic logging for all playback attempts.

## 3. Sound Effects (SFX)
SFX are divided into two logic layers:

### A. Global SFX
Always play regardless of player focus. Used for UI clicks, level-ups, and major game milestones.
- **Trigger**: `EventBus.publish('audio:play', { clip: 'hero_assign' })` or specific named events like `hero_leveled`.
- **Method**: `AudioSystem.playSfx(clipName)`.

### B. Contextual SFX
Only play if the player is actively **hovering** over the relevant card. This prevents "audio clutter" during high-intensity periods (like multi-hero combat).
- **Focus Tracking**: `GICard.jsx` publishes `audio:focus_changed` on pointer enter/leave.
- **Trigger**: `EventBus.publish('combat_hero_attack', { cardId: '...' })`.
- **Method**: `AudioSystem.playContextualSfx(cardId, clipName)`.

## 4. Background Music (BGM)
BGM covers entire `AreaSet` biomes and loops automatically.
- **Trigger**: Subscribes to `area_switched`.
- **Auto-Start**: In `AudioSystem.init()`, it checks `GameState.activeAreaId` to play music immediately on load.
- **Fading**: Currently handles direct stop/start (stubbed for future cross-fading).

## 5. Volume Mixing & Calibration
The system uses a **Normalization Layer** to handle varying asset loudness:

- **GLOBAL_MIXER_GAIN = 0.2**: This provides a "safety ceiling."
- **Recalibrated Sliders**: A 50% setting on the UI slider results in **10% actual gain** (`0.5 * 0.2 = 0.1`). 
- **Persistence**: Volumes are pulled from `SettingsManager.get('audio.*')`.

## 6. Asset Mappings
The system maps logical keys to file paths in `/assets/audio/sfx/kenney_rpg-audio/Audio/` and `/assets/audio/bgm/`.

| Logical Key | File Mapping | Notes |
| :--- | :--- | :--- |
| `ui_click` | `handleSmallLeather.ogg` | Used by `Button.jsx` |
| `hero_assign` | `handleSmallLeather.ogg` | UI drag-and-drop |
| `item_assign` | `bookPlace2.ogg` | UI drag-and-drop |
| `unassign` | `clothBelt2.ogg` | Manual/Eviction removal |
| `hit` | `metalClick.ogg` | Contextual combat |
| `guild_hall_v1` | `The_Unlit_Gallery.mp3` | Area BGM |

## 7. Event API Reference

| Event Name | Data Object | Description |
| :--- | :--- | :--- |
| `audio:play` | `{ clip: string, type: string }` | Global SFX trigger |
| `audio:focus_changed`| `{ cardId: string }` | Updates focus for contextual SFX |
| `area_switched` | `{ from: string, to: string }` | Triggers BGM swap |
| `settings_updated` | `settings` | Forces volume recalibration |

---
**Developer Note**: When adding new sounds, update the `map` inside `_getSfxPath` or `_getMusicPath`. Avoid direct `new Audio()` calls outside this system to ensure volume settings are respected.
