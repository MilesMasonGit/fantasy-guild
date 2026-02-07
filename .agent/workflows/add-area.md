---
description: How to add new Areas (Biomes) and configure their Questing/Project phases
---

# Add Area (Biome) Workflow

This workflow guides you through creating a new Area (Biome). Areas are the core progression containers.

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
Extract from user request:
- **Theme/Name**: e.g., "Volcano"
- **Category**: `NATURAL`, `UNDERGROUND`, `AQUATIC`, `MYSTICAL`, or `SPECIAL`
- **Questing Difficulty**: Enemy groups that must be cleared.
- **Project Goal**: Building unlocked by completing the area.

## Step 3: Check Dependencies

1.  **Enemies**: Do the enemies for `enemyGroups` exist in `enemyRegistry.js`?
2.  **Tasks**: Do the tasks that `enemyGroups` unlock exist in `cardRegistry.js`? (Must be **Modular Tasks**)
3.  **Project**: Does the project for `projectChain` exist? (See `/add-project`)

## Step 4: Make Changes

### File: `src/config/registries/biomeRegistry.js`

Add to `BIOMES` object:
```javascript
new_biome_id: {
    id: 'new_biome_id',
    name: 'Biome Name',
    description: 'Flavor text.',
    category: BIOME_CATEGORIES.NATURAL,
    icon: '🌋',
    color: '#hexcode',
    
    // Exploration Cost (Requirements to find this area)
    explorationCost: {
        base: { torch: 10, rations: 5 }, // Items consumed over time
        specific: { climbing_gear: 1 }    // Gating items (required but not consumed)
    },

    // Questing Phase: Enemy Groups
    // Defeating these unlocks Modular Task Cards
    enemyGroups: [
        { enemyId: 'enemy_id_1', count: 5, unlocksTask: 'modular_task_id_1' },
        { enemyId: 'enemy_id_2', count: 3, unlocksTask: 'modular_task_id_2' }
    ],

    // Project Phase: Buildings to construct
    projectChain: ['project_id_1', 'project_id_2'],

    // Completed Phase: Random spawns (Modular Cards)
    taskPool: [
        { taskId: 'modular_task_id_1', weight: 50 },
        { taskId: 'modular_task_id_2', weight: 30 },
        { taskId: 'modular_combat_id', weight: 20 }
    ]
}
```

## Step 5: Report to User
Summarize:
- **Exploration Cost**: Requirements to find the area.
- **Quest Chain**: Enemies to fight and Modular Tasks unlocked.
- **Projects**: Buildings constructed here.
