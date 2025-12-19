---
description: How to add Combat Encounters for Area layouts (Questing Phase)
---

# Add Area Combat Encounter Workflow

Area Cards have a **Questing Phase** where players must defeat "Enemy Groups" to progress. This differs from standalone "Combat Cards" found in the wild, though they share the same underlying Enemy definitions.

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
- **Enemy**: What are they fighting? (e.g., Wolf pack)
- **Scale**: How many enemies in the group? (e.g., 5 Wolves)
- **Reward**: What Task does defeating this group unlock? (e.g., Logging)

## Step 3: Check Dependencies

1.  **Enemy Exists?**: Check `src/config/registries/enemyRegistry.js`.
    - If not, create the enemy first (see `/add-task` "Combat" section).
2.  **Task Exists?**: Check `src/config/registries/cardRegistry.js` for the unlocked task.
    - If not, create the task first (see `/add-task`).

## Step 4: Make Changes

### 4a. Update Biome Enemy Groups
File: `src/config/registries/biomeRegistry.js`

Add to `enemyGroups` array in the target biome:

```javascript
// Copy this template:
{
    enemyId: 'ENEMY_ID',      // e.g. 'forest_t1_wolf'
    count: NUMBER,            // e.g. 5
    unlocksTask: 'TASK_ID'    // e.g. 'logging'
}
```

#### Verification Checklist
- [ ] `enemyId` exists in `enemyRegistry.js`?
- [ ] `unlocksTask` exists in `cardRegistry.js`?
- [ ] Comma added after previous entry?

### 4b. Balance Check
- **Tier Consistency**: Ensure the Enemy tier matches the Biome tier.
- **Task Relevance**: The unlocked task should make sense for the area guarded (e.g., defeating Wolves to access the Forest for Logging).

## Step 5: Report to User
Summarize:
- "Added an Enemy Group of **[Count] x [Enemy Name]** to **[Biome]**."
- "Defeating them unlocks the **[Task Name]** task."
