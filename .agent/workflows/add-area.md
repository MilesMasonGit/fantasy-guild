---
description: How to add new Areas (Biomes) and configure their Questing/Project phases
---

# Add Area (Biome) Workflow

This workflow guides you through creating a new Area (Biome), which is the core progression container in the game. Areas have three phases: **Exploration** (finding it), **Questing** (Clearing Enemy Groups to unlock tasks), and **Projects** (Building infrastructure).

## Step 1: Read the Schema Reference
**Always read this first:**
```
docs/CARD_SCHEMA.md
```


## Step 2: Code Quality Checklist
- [ ] **No `require`**: Use top-level static `import` only.
- [ ] **No Circulars**: Ensure new imports don't create circular dependencies.
- [ ] **Constants**: Use `BIOME_CATEGORIES` instead of raw strings.

## Step 3: Define Biome Properties
Extract the following from the user's request:
- **Theme/Name**: e.g., "Volcano", "Sunken City"
- **Category**: `NATURAL`, `UNDERGROUND`, `AQUATIC`, `MYSTICAL`, or `SPECIAL`
- **Primary Resources**: What does this area provide? (e.g., Ash, Obsidian)
- **Questing Difficulty**: How many enemy groups? What types?
- **Project Goal**: What building does this area unlock? (e.g., Forge)

## Step 3: Check Dependencies

Before creating the biome, ensure you have:
1.  **Enemies**: Do the enemies for the `enemyGroups` exist in `enemyRegistry.js`?
    - If not, run `/add-combat-encounter` first.
2.  **Tasks**: Do the tasks that `enemyGroups` unlock (e.g. `unlocksTask: 'gather_ash'`) exist in `cardRegistry.js`?
    - If not, run `/add-task` first.
3.  **Project**: Does the project for the `projectChain` exist?
    - If not, likely define it *after* or *during* this workflow using `/add-project`.

## Step 4: Make Changes (in order)

### 4a. Add Biome Definition
File: `src/config/registries/biomeRegistry.js`

Add to `BIOMES` object:
```javascript
new_biome_id: {
    id: 'new_biome_id',
    name: 'Biome Name',
    description: 'Flavor text.',
    category: BIOME_CATEGORIES.NATURAL, // Choose appropriate category
    icon: '🌋',
    color: '#hexcode',
    
    // explorationCost defines the "Explore Card" requirements to find this
    explorationCost: {
        base: { torch: 10, rations: 5 }, // Items consumed over time
        specific: { climbing_gear: 1 }    // Gating items (not consumed, just required)
    },

    // Questing Phase: Enemy Groups
    // These must be defeated to unlock the Area's tasks
    enemyGroups: [
        { enemyId: 'enemy_id_1', count: 5, unlocksTask: 'task_id_1' },
        { enemyId: 'enemy_id_2', count: 3, unlocksTask: 'task_id_2' }
    ],

    // Project Phase: Buildings to construct after questing
    projectChain: ['project_id_1', 'project_id_2'],

    // Completed Phase: Random spawns (for Area Cards in 'complete' state)
    taskPool: [
        { taskId: 'task_id_1', weight: 50 },
        { taskId: 'task_id_2', weight: 30 },
        { taskId: 'combat_card_id', weight: 20 }
    ]
}
```

### 4b. Verify Registry Exports
Ensure the new biome is reachable via `getBiome` (it should be automatic if added to `BIOMES`).

## Step 5: Report to User
Summarize the new Area:
- **Exploration Cost**: What it takes to find.
- **Quest Chain**: Enemies to fight and Tasks unlocked.
- **Projects**: What buildings are built here.

## Example Conversation

**User**: "Add a Volcano biome. It needs torches to find. You fight Fire Elementals to unlock Ash Gathering. Then you build a Magma Forge."

**AI**:
1. Checks if `fire_elemental` and `gather_ash` exist. (If not, asks to create them).
2. Checks if `magma_forge` exists.
3. Creates `volcano` biome in `biomeRegistry.js`.
4. Sets `explorationCost: { base: { torch: 10 } }`.
5. Sets `enemyGroups: [{ enemyId: 'fire_elemental', count: 5, unlocksTask: 'gather_ash' }]`.
6. Sets `projectChain: ['magma_forge']`.
