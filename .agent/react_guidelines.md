# Fantasy Guild Idle: React + Tailwind Architecture Guidelines

## The Strangler Fig Pattern
The game UI has been migrated from vanilla DOM manipulation to React. The core game logic remains in vanilla JavaScript (e.g., `GameState.js`, `CardManager.js`), which acts as the "Backend Engine". React acts strictly as the "Frontend View". 
- **DO NOT** rewrite vanilla core logic in React.
- **DO NOT** store primary game data in `useState`. 

## State Synchronization: `useGameState`
React components subscribe to the vanilla Engine via the `useGameState` hook. 
- The hook listens to the `EventBus` (`state_changed`, `heroes_updated`, etc.) and utilizes deep-equality checks to trigger renders safely.
- `useEngine()` provides access to the global `engine` object (which contains `GameState`, `HeroManager`, `CardManager`, etc.).

**Example:**
```jsx
import { useGameState, useEngine } from '../hooks/useEngine.js';

const MyComponent = () => {
    const engine = useEngine();
    // Subscribe specifically to the gold value
    const gold = useGameState(state => state.currency.gold);
    
    // Mutate state using the vanilla engine API
    const handlePurchase = () => {
        engine.GameState.addGold(-10);
    }
}
```

## Styling & Tailwind v4
- **No SCSS/CSS Modules**: All component styling is handled via Tailwind utility classes. Do not create new `.css` files unless absolutely necessary for complex keyframe animations.
- **Aesthetic**: The game uses a "Retro-Glassmorphism" theme utilizing a custom token namespace (`gi-`). Always use `bg-gi-surface`, `text-gi-primary`, `border-gi-border`. 
- **Utility Merger**: Always use `cn()` from `src/utils/cn.js` when combining static and dynamic class names.

## UI Component Library
Always compose new views using the established base components in `src/ui/components/base/`:
- `GIDraggable` / `GICardSlot`: Core drag-and-drop primitives powered by `@dnd-kit`.
- `GICard`: The main physical card wrapper.
- `GITitleModule`, `GIProgressBar`, `GIIconBadge`: Inner card modules.
- `GIMenu`: Dropdown context menus powered by `@headlessui`.
- `GITabs`: Tabbed navigation interfaces.
- `GIModal`: Dialog popups powered by `@headlessui`.

## Drag and Drop (`@dnd-kit`)
Drag events execute React-side logic to determine collision, and then map backwards to vanilla Engine function calls within `handleDragEnd` in `ReactRoot.jsx`.
- Define a drag payload with `type` and `id` in `GIDraggable`. 
- Define drop targets with `targetType` and `id` in `useDroppable`.
- Map the successful drop to engine adapters (e.g. `engine.CardManager.assignEntityToStack()`).
