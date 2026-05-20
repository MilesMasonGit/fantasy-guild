---
description: How to add new Areas and configure their Playmats and Pack Systems
---

# Add Area & Playmat Workflow

This workflow guides you through creating a new Area in the Fantasy Guild Idle system. Areas are the physical "playmats" where gameplay occurs. They define the visual background (table), the shape of the grid, the board tiles, boost placements, and the pool of cards available in Area Booster Packs.

## Step 1: Asset Registration
Before defining the logic, you must register the physical assets (sprites) for the playmat.

### File: \`src/config/registries/sprite-manifest.js\`
Register the physical board and table sprites:
\`\`\`javascript
// Playmat: [Area Name]
'pm_table_[texture_name]': 'assets/backgrounds/playmat/[area]/pm_table_[texture_name].png',
'pm_board_[area]_1': 'assets/backgrounds/playmat/[area]/pm_board_[area]_1.png',
// ... add variants as needed
\`\`\`

## Step 2: Tile Registry
Define logical tile variants that map to the sprites you just registered.

### File: \`src/config/registries/tileRegistry.js\`
Add the new board tiles. Boost tiles (like \`nature_boost\`) are usually pre-existing, so you only need to add the Area's specific board tiles:
\`\`\`javascript
[area]_board_1: { id: '[area]_board_1', name: '[Area] Board 1', sprite: 'pm_board_[area]_1' },
[area]_board_2: { id: '[area]_board_2', name: '[Area] Board 2', sprite: 'pm_board_[area]_2' },
\`\`\`

## Step 3: Area Set Configuration
This is the core definition of the Area. You will inject a new object into the \`AREA_SETS\` registry.

### File: \`src/config/registries/areaSetRegistry.js\`

Append your new Area to the \`AREA_SETS\` object.
*Warning: Ensure you add it as a top-level sibling to existing Areas, not nested inside another Area by accident.*

**Template:**
\`\`\`javascript
    new_area_v1: {
        id: 'new_area_v1',
        name: 'New Area',
        icon: '🏔️',
        areaArt: 'bg_area_card_art', // The Area Card portrait
        backgroundImage: 'pm_table_[texture_name]', // The underlying table texture
        backgroundMode: 'tiled-grid', // Standard for playmats
        
        // --- Pack & Progression System ---
        totalFragments: 3, // Map fragments needed to unlock
        packBaseGoldCost: 100, // Starting gold cost for Booster Packs
        packCostScaling: 10,   // Gold cost increase per pack purchased
        
        // What drops from the booster packs?
        cardPool: [
            { cardId: 'mining', weight: 10 },
            { cardId: 'foraging', weight: 5 },
        ],
        // The maximum capacity for each card in the Binder
        deckList: {
            mining: 4,
            foraging: 2,
        },

        // --- Physical Playmat Layout ---
        gridConfig: {
            width: 5,   // Bounding box width
            height: 5,  // Bounding box height
            max_width: 5,
            max_height: 5,
            hubPosition: { x: 2, y: 2 }, // The (x,y) coordinate where the Area Card sits
            baseTileTemplate: 'new_area', // Prefix for fallback tiles
            baseTileVariants: 2,
            
            // Array of exact {x,y} coordinates defining the playmat shape.
            // Omitted coordinates will be "empty space" showing the table beneath.
            validCells: [
                { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
                { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
                { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
            ],
            
            // Explicitly map specific cells to specific tiles (like boosts or variants)
            tileMap: {
                "1,1": "nature_boost",
                "3,1": "industry_boost",
                "2,1": "new_area_board_1",
                // ...
            }
        },

        // --- Global & Local Bonuses ---
        masteryBonuses: {
            setMastery: { yieldChanceMultiplier: 0.15 },
            questMastery: { workSpeedMultiplier: 1.10 }
        },
        
        // Passive exploration resource yields
        exploration: {
            itemPool: ['stone', 'copper_ore'],
            cardId: 'explore_new_area' // Generates a unique task card
        }
    },
\`\`\`

## Step 4: Programmatic Grid Generation (Tip)
For complex playmat shapes (like diamonds, overlapping squares, or pyramids), do **not** write the \`validCells\` manually. Instead, use a scratch node script with \`fs.writeFileSync\` to dynamically generate the JSON array using Math loops, then paste or inject it cleanly into \`areaSetRegistry.js\`.

**Example:**
\`\`\`javascript
const validCells = [
    // 5x5 Diamond (Manhattan distance <= 2 from center 2,2)
    ...Array.from({ length: 5 * 5 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5)
    })).filter(cell => Math.abs(cell.x - 2) + Math.abs(cell.y - 2) <= 2)
];
\`\`\`

## Step 5: Verification
1. Open the QA Dashboard in-game.
2. Ensure the new Area loads without console errors.
3. Verify the grid layout matches your expectations, the Boost tiles are on the correct coordinates, and the table texture is visible beneath.
