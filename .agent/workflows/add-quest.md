---
description: How to add Quest Encounters (Combat or Collection) for Area layouts
---

# Add Quest Encounter Workflow

Area Cards have a **Questing Phase** where players must complete sequential "Quests" to progress. These quests can be **Combat Encounters** (defeating enemies) or **Item Collection** (gathering resources).

## Step 1: Read the Schema Reference
**Always read this first:**
```
docs/CARD_SCHEMA.md
```

## Step 2: Code Quality Checklist
- [ ] **No `require`**: Use top-level static `import` only.
- [ ] **No Circulars**: Ensure new imports don't create circular dependencies.

## Step 3: Define Encounter Properties
Extract from user request:
- **Biome**: Where does this encounter happen? (e.g., Forest)
- **Type**: Is it Combat or Collection?
- **Reward**: What Task does completing this quest unlock? (e.g., Logging)

### Option A: Combat Encounter
- **Enemy**: What are they fighting? (e.g., Wolf pack)
- **Scale**: How many enemies in the group? (e.g., 5 Wolves)

### Option B: Collection Encounter
- **Name**: Name of the quest (e.g., "Repair Bridge")
- **Description**: Flavor text explaining the task.
- **Requirements**: Map of Item IDs (or tags) to quantities (e.g., `wood: 5`, `tag:tool`: 1).

## Step 4: Check Dependencies

1.  **Task Exists?**: Check `src/config/registries/cardRegistry.js` for the unlocked task.
    - If not, create the task first (see `/add-task`).
2.  **(Combat Only) Enemy Exists?**: Check `src/config/registries/enemyRegistry.js`.
    - If not, create the enemy first (see `/add-task` "Combat" section).
3.  **(Collection Only) Items Exist?**: Check `src/config/registries/itemRegistry.js`.

## Step 5: Make Changes

### File: `src/config/registries/biomeRegistry.js`

Add to the `enemyGroups` array in the target biome:

#### A. Combat Encounter Template
```javascript
{
    enemyId: 'ENEMY_ID',      // e.g. 'forest_t1_wolf'
    count: NUMBER,            // e.g. 5
    unlocksTask: 'TASK_ID',   // e.g. 'logging'
    // Optional Rewards (in addition to normal loot)
    rewards: [{ itemId: 'item_id', count: 1 }], 
    xpRewards: [{ skill: 'skill_id', amount: 100 }]
}
```

#### B. Collection Encounter Template
```javascript
{
    type: 'collection',
    name: 'Quest Name',       // e.g. "Repair Bridge"
    description: 'Flavor text description.',
    requirements: {
        'item_id': 5,         // Specific item
        'tag:tool_type': 1    // Tag requirement (e.g. 'tag:axe')
    },
    unlocksTask: 'TASK_ID'    // e.g. 'mining_cave'
}
```

#### Verification Checklist
- [ ] `enemyId` / `itemId` / `unlocksTask` exist in registries?
- [ ] Comma added after previous entry?
- [ ] `requirements` object is valid (no quotes around keys unless tags)?

## Step 6: Report to User
Summarize:
- "Added a **[Quest Type]** Quest to **[Biome]**."
- "Requirements: **[Details]**"
- "Unlocks: **[Task Name]**"
