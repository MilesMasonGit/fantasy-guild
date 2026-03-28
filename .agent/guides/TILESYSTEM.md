# Tile & Background System Documentation

The **Tile System** is a performance-optimized 3-layer rendering engine designed for high-refresh-rate 512px playmat boards. It supports infinite panning, diamond/cross layouts, and dynamic canvas scaling.

## 1. 3-Layer Architecture

The system renders in three distinct visual layers to balance visual depth with interaction performance.

| Layer | Component | Description | Z-Index |
| :--- | :--- | :--- | :--- |
| **Layer 1** | `ActiveCard` / `AreaDeckHub` | Interactive cards and central area hubs. | 50 - 200 |
| **Layer 2** | `GridCell` | "Assembled" terrain tiles (plains, forest, etc.) forming the board. | 0 |
| **Layer 3** | `PlaymatViewport` (BG) | Infinite repeating texture (wood, stone) rendering behind the grid. | -1 |

### Rendering Mechanics
1. **Layer 3 (Infinite BG)**: Managed in `PlaymatViewport.jsx`. Uses `framer-motion` to transform a single repeating `background-image` CSS property. Bypasses React re-renders during panning.
2. **Layer 2 (Assembled Tiles)**: Rendered by individual `GridCell.jsx` components. Each cell draws its own terrain artwork. Stacking contexts are managed via `isolation: isolate`.
3. **Layer 1 (Cards)**: Positioned dynamically using `CoordinateUtils.js` to map logical `{x, y}` grid coordinates to pixel offsets.

---

## 2. Grid Initialization & State

The grid is not static. It is initialized per-area to support unique shapes (Diamonds, Crosses, Clearings).

### Initialization Flow (`AreaSystem.js`)
When an area is loaded (e.g., `guild_hall_v1`), `AreaSystem.initGridForArea()`:
1. Fetches `gridConfig` from the `areaSetRegistry.js`.
2. Populates `GameState.state.grid.validCells` with the specific layout.
3. Published a `state_changed` event.
4. `CardView.jsx` subscribes to `state_changed` to re-render the physical `GridCell` components.

---

## 3. Configuration & Standards

### Tile Registry (`tileRegistry.js`)
Define terrain types here. Use **Sprite Manifest IDs** for the `sprite` field.
```javascript
swamp: {
  id: 'swamp',
  name: 'Murky Swamp',
  sprite: 'tile_swamp_base', // Manifest ID
  bonuses: [
    { type: 'speed', value: -0.2, category: 'logging', range: 'self' }
  ]
}
```

### Area Layouts (`areaSetRegistry.js`)
Define the physical grid shape and background.
```javascript
gridConfig: {
    width: 9, height: 9,
    hubPosition: { x: 4, y: 4 }, 
    validCells: [
        // Example: 8x8 Diamond calculation
        ...Array.from({ length: 9 * 9 }, (_, i) => ({ x: i % 9, y: Math.floor(i / 9) }))
           .filter(cell => Math.abs(cell.x - 4) + Math.abs(cell.y - 4) <= 4)
    ]
}
```

---

## 4. Performance & Layout Patterns

### Unified 512px Pitch
All spatial logic assumes a `GRID_PITCH` of **512px**. This is synchronized across `layoutConstants.js` and CSS.

### Coordinate Transformation
Use `getLogicalPosition(x, y, minX, minY)` from `CoordinateUtils.js` to calculate the center point of any grid cell. This handles the padding and camera offsets automatically.

### Stacking & Visibility
To ensure Layer 2 tiles render reliably above the infinite background:
- **`isolation: isolate`**: Used in `GridCell.jsx` to create a local stacking context.
- **`useGameState` Subscriptions**: `CardView.jsx` must include `state_changed` in its dependency array to Reactively respond to grid shape changes.
