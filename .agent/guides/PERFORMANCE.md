# UI Performance Guide

> **Lessons learned from the drag-and-drop performance optimization.**
> Read this before adding new components, hooks, or event subscriptions.

## Architecture Overview

```
ReactRoot                         ← App state (modals, panels)
  └─ DndProvider                  ← Drag state (activeDragData, handlers)
       ├─ {children}              ← Stable ref — NOT re-rendered by drag state
       ├─ DragOverlay             ← Re-renders on drag (intentional)
       └─ (collision detection)   ← Frame-throttled via cache
```

**Key insight**: `DndProvider` receives the app tree as `children`. React preserves this reference, so drag state changes (`setActiveDragData`) do NOT cascade re-renders to the app tree.

---

## Rules for New Components

### 1. Use Specific Event Subscriptions

```js
// ❌ BAD — fires every engine tick (~10Hz), causes selector + deep equality check
useGameState(state => state.heroes, ['state_changed']);

// ✅ GOOD — fires only when heroes actually change
useGameState(state => state.heroes, ['heroes_updated']);
```

**Available specific events** (use instead of `state_changed`):
| Event | Fires when |
|-------|-----------|
| `heroes_updated` | Hero roster changes (hire, assign, retire, XP, regen) |
| `inventory_updated` | Items added, removed, or moved |
| `cards_updated` | Cards spawned, removed, or repositioned |
| `quest_state_changed` | Quest progress or status changes |

Only fall back to `state_changed` if no specific event covers your data.

### 2. Always Memoize Exported Components

```jsx
// ❌ BAD
export default MyComponent;

// ✅ GOOD
export default React.memo(MyComponent);
```

Without `React.memo`, parent re-renders cascade to ALL children regardless of prop changes.

### 3. Use `useCallback` for Handler Props

```jsx
// ❌ BAD — new function reference on every render, breaks child memoization
<ChildComponent onClick={() => doThing(id)} />

// ✅ GOOD
const handleClick = useCallback(() => doThing(id), [id]);
<ChildComponent onClick={handleClick} />
```

### 4. Droppable Components: Minimize `isOver` Usage

`useDroppable`'s `isOver` causes the component to re-render on every droppable boundary crossing during drag. Prefer CSS-driven highlighting:

```jsx
// ❌ BAD — React re-render on every hover change during drag
const { setNodeRef, isOver } = useDroppable({ id });
return <div ref={setNodeRef} className={isOver ? 'highlighted' : ''} />;

// ✅ GOOD — CSS handles the visual, zero React overhead
const { setNodeRef } = useDroppable({ id });
return <div ref={setNodeRef} data-droppable-id={id} />;
```

The `DndProvider` sets `data-drag-over="true"` on the hovered droppable via direct DOM manipulation. Style it in CSS:
```css
[data-drag-over="true"] > :first-child {
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.25);
}
```

### 5. State Mutations Must Go Through Managers

```js
// ❌ BAD — only fires state_changed, components listening to specific events won't update
engine.GameState.state.heroes.push(newHero);
engine.EventBus.publish('state_changed');

// ✅ GOOD — fires heroes_updated, all hero-subscribed components update
engine.HeroManager.addHero(newHero);
```

Manager methods fire the correct specific events. Direct state mutation + `state_changed` is a compatibility anti-pattern.

---

## Drag Performance Patterns

### CSS-Driven Highlighting (data attributes on `document.body`)

On drag start, `DndProvider` sets these on `document.body`:
- `data-dragging-type` — `"hero"`, `"item"`, or `"card"`
- `data-dragging-id` — the entity ID
- `data-dragging-tags` — space-separated tags

Use these for CSS-only slot highlighting with zero React cost:
```css
body[data-dragging-type="hero"] .hero-slot {
  border-color: cyan;
}
```

### Pointer Events Killed During Drag

```css
body[data-dragging-type] .no-pan {
  pointer-events: none !important;
}
```

All GICards have `.no-pan`. During drag, they receive NO pointer events — no `pointerMove`, no `mouseEnter`, no hover state changes. This eliminates all card-level event handler overhead.

### Collision Detection is Frame-Throttled

`customCollisionDetection` caches results per animation frame. Multiple calls within the same frame return the cached result instantly. This caps collision computation to ~60/sec regardless of pointer event frequency.

---

## Common Pitfalls

| Pitfall | Why it's bad | Fix |
|---------|-------------|-----|
| Subscribing to `state_changed` | Fires every engine tick, triggers selector + deep equality check | Use specific event (`heroes_updated`, `inventory_updated`, etc.) |
| Using `isOver` from `useDroppable` | Re-renders component on every drag boundary crossing | Use `data-droppable-id` + CSS `[data-drag-over]` |
| Forgetting `React.memo` on exports | Parent re-renders cascade to all unmemoized children | Always wrap: `export default React.memo(Component)` |
| Direct state mutation in dev tools | Only fires `state_changed`, specific listeners miss it | Use manager methods (`HeroManager`, `InventoryManager`, etc.) |
| `console.log` in hot paths | Each log = browser task, visible in flame chart | Remove or guard with `if (DEV)` |
| `getBoundingClientRect` in event handlers | Forces synchronous layout recalculation | Cache on enter, not on every move |
