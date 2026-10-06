---
description: How to add new Tiles and configure their bonuses/layout
---

# Add Tile Workflow

This workflow guides the process of adding new tile types to the game and placing them in an area layout.

## Step 1: Register the Sprite (Manifest)
Before the tile system can render the art, the asset must be registered in the sprite manifest.

**File:** `src/config/registries/sprite-manifest.js`

Add the sprite path mapping:
```javascript
export const SPRITE_MANIFEST = {
    // ...
    'pm_my_new_tile': 'assets/backgrounds/playmat/global/test_tiles/pm_my_new_tile.png',
    // ...
};
```

## Step 2: Define the Tile Type (Tile Registry)
Define the logical properties, visual identifiers, and bonuses for the tile.

**File:** `src/config/registries/tileRegistry.js`

Add a new entry to `_TILE_TYPES`:
```javascript
const _TILE_TYPES = {
    // ...
    my_new_tile: {
        id: 'my_new_tile',
        name: 'My New Tile',
        icon: '💎',             // Emoji fallback
        sprite: 'pm_my_new_tile', // Manifest ID from Step 1
        color: '#ffffff',       // Selection/UI tint
        description: 'A brief description of the tile.',
        bonuses: [
            { 
                type: 'speed',   // speed, yield, xp, etc.
                value: 0.2,      // 0.2 = +20%
                category: 'mining', // From TASK_CATEGORIES
                range: 'adjacent'   // self, adjacent, radius
            }
        ]
    },
    // ...
};
```

## Step 3: Place the Tile (Area Registry)
Add the tile to a specific area's initial layout.

**File:** `src/config/registries/areaSetRegistry.js`

Locate the area's `gridConfig` and update the `tileMap`:
```javascript
export const AREA_SETS = {
    guild_hall_v1: {
        // ...
        gridConfig: {
            // ...
            tileMap: {
                'x,y': 'my_new_tile', // e.g., '2,2': 'nature_boost'
                // ...
            }
        },
    },
};
```

## Verification Steps
1. **Run Build**: Execute `npm run build` to ensure no syntax errors were introduced in the registries.
2. **Reload Game**: Verify the tile appears at the correct coordinates.
3. **Check Badge**: Use the Coordinate Badge (top-left of tile) to confirm (x,y) placement.
4. **Hover Tooltip**: Hover over the tile to verify the Name, Description, and Bonuses are displayed correctly.
