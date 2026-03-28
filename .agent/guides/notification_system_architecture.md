# Technical Architecture: Notification System

The Fantasy Guild notification system is a specialized, event-driven infrastructure designed to provide non-blocking, additive, and persistent feedback to the player. It is decoupled from game logic via a central `EventBus` and rendered through a React-based UI portal.

## Core Components

### 1. [NotificationSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js) (Logic Layer)
Found in [src/systems/core/NotificationSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js). This is a pure JavaScript module that manages the notification queue and aggregation logic.

- **Queue Management**: Maintains an internal `queue` array.
- **[notify(message, type, options)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js#35-128)**: The primary API.
    - `aggregationKey`: Used to identify notifications that should be updated rather than duplicated (e.g., loot gains, level ups).
    - [meta](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/GameState.js#85-87): Store metadata (like `startLevel`) to preserve state across aggregation events.
    - `duration`: Supports `0` for infinite persistence or milliseconds for auto-dismiss.
- **Additive Aggregation**: 
    - When an `aggregationKey` match is found in the queue, the system updates the existing notification's `count` and `message` properties.
    - **Windowless Matching**: If a key is provided, the system ignores the `groupingWindow` and always aggregates into the existing toast if it's still in the queue.
- **Trimming**: Automatically shifts the queue to maintain `maxVisible` (configurable via [SettingsManager](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/SettingsManager.js#42-161)).

### 2. [ToastContainer.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ToastContainer.jsx) (Portal Layer)
Found in [src/ui/components/base/ToastContainer.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ToastContainer.jsx). A React component that bridges the engine and UI.

- **Event Sync**: Subscribes to `notification_added`, `notification_updated`, and `notification_dismissed`.
- **State Management**: Maps the engine's `queue` state to React `toasts` state, ensuring real-time UI updates.
- **Portaling**: Fixed to `bottom-center` of the viewport with high z-indexing.

### 3. [Toast.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/Toast.jsx) (UI Component)
Found in [src/ui/components/base/Toast.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/Toast.jsx). Responsible for the visual presentation and specialized layout.

- **Dynamic Styling**: Specialized logic for various notification types ([crisis](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js#218-224), [success](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js#190-196), [info](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js#197-203)).
- **Rich Formatting**: 
    - Uses regex-based split to highlight **"Level up!"** in gold and **"X > Y"** ranges in green.
    - Conditionally renders **"+Count"** prefixes for loot/gold alerts.
- **Animations**: Powered by `framer-motion` for layout transitions and exit-animations.

## Key Flows

### Loot Aggregation (+Count)
1. `InventoryManager` publishes `inventory_updated`.
2. `NotificationSystem` catches the event and finds/creates a toast with `aggregationKey: item_[id]`.
3. If found, the `count` increments and the UI renders the new `+Count` prefix.

### Dynamic Level Ups (Old > New)
1. `SkillSystem` publishes `hero_leveled`.
2. `NotificationSystem` identifies the `startLevel` from the toast's [meta](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/state/GameState.js#85-87) or calculates it from the event.
3. The message is reconstructed (e.g., `1 > 2` becomes `1 > 3`) and the `message` property is updated.
4. [ToastContainer](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/ToastContainer.jsx#7-68) triggers a re-render of the specific toast with the updated text.

## How to Extend

### Adding a New Auto-Notification
To hook a new game event into the notification system, add a subscriber at the bottom of [NotificationSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js):

```javascript
EventBus.subscribe('your_event', (data) => {
    NotificationSystem.notify(`Message`, 'info', {
        aggregationKey: 'unique_key_if_additive',
        category: 'settings_category'
    });
});
```

### Adding a New Priority Type
1. Define the style in `TYPE_CONFIG` inside [Toast.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/base/Toast.jsx).
2. Map the type to an icon in [NotificationSystem.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js).
3. Call [notify(msg, 'your_type')](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/NotificationSystem.js#35-128).

## Configuration
The system respects the following keys in [SettingsManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/core/SettingsManager.js) under the `notifications` block:
- `masterToggle`: Boolean
- `defaultDuration`: Number (0 = persistent)
- `maxVisible`: Number
- `[category]`: Per-event toggles

---
**Note for Future Agents**: When updating existing notifications, always ensure that `EventBus.publish('notification_updated', { id, count, message })` is called to sync the UI state.
