---
description: How to add new Task Cards, Combat Cards, and Items conversationally
---

# Add Task Workflow

This workflow enables efficient content creation through natural conversation.

## Step 1: Read the Schema Reference
**Always read this first:**
```
docs/CARD_SCHEMA.md
```

This contains:
- Tier system (1-5) for stat scaling
- Task Card, Combat Card, Enemy schemas
- Biome creation guidelines
- AI defaults for missing info


## Step 2: Code Quality Checklist
**Before writing code, verify:**
- [ ] **No `require`**: Use top-level static `import` only.
- [ ] **No Circulars**: Ensure new imports don't create circular dependencies.
- [ ] **Constants**: Use existing constants (e.g. `TASK_CATEGORIES`) instead of raw strings.

## Step 3: Parse User Request
Extract from user description:
- **Content type**: Task, Combat, Item, or all?
- **Tier**: Explicit or inferred (default: 1)
- **Biome**: Existing or needs new one?
- **Theme**: What skill/category does it belong to?

## Step 3: Check for New Biome Requirement

**CRITICAL**: If the task/enemy doesn't fit existing biomes, **ASK USER FIRST**:

> "This content seems to need a new **[Biome Name]** biome. Should I create it with these properties?
> - Theme: [description]
> - Effects: [skill bonuses]
> - Would include: [list of planned tasks/combat]"

Existing biomes: `forest`, `plains`, `mountain`, `cave`, `swamp`, `guild_hall`

## Step 4: Apply Tier-Based Defaults

Use the tier system from CARD_SCHEMA.md:

| Tier | Skill Req | Duration | Energy | XP |
|------|-----------|----------|--------|-----|
| 1 | 0 | 5-8s | 0-3 | 5-10 |
| 2 | 10-15 | 8-12s | 3-6 | 10-20 |
| 3 | 20-30 | 12-18s | 6-10 | 20-35 |
| 4 | 40-50 | 18-25s | 10-15 | 35-50 |
| 5 | 60+ | 25-40s | 15-25 | 50-100 |

## Step 5: Make Changes (in order)

### 5a. Create New Biome (if needed)
File: `src/config/registries/biomeRegistry.js`
- Add to `BIOMES` object
- Include: id, name, description, category, icon, color, effects, taskPool

### 5b. Add Item Definitions (if new items)
File: `src/config/registries/itemRegistry.js`
- Add to `ITEMS` object
- Include: id, name, type, tags, icon, stackable

### 5c. Add Enemy (for combat cards)
File: `src/config/registries/enemyRegistry.js`
- ID format: `{biome}_t{tier}_{name}`
- Scale stats by tier (see CARD_SCHEMA.md)

### 5d. Add Drop Table (for combat cards)
File: `src/config/registries/dropTableRegistry.js`
- Add drops that make thematic sense

### 5e. Add Task/Combat Card Definition
File: `src/config/registries/cardRegistry.js`
- Add to `CARDS` object

### 5f. Add to Biome Pool
File: `src/config/registries/biomeRegistry.js`
- Add `{ taskId: 'new_task', weight: N }` to biome's `taskPool`
- Combat cards also go in taskPool

### 5g. Add Starting Items (if needed for testing)
File: `src/state/StateSchema.js`
> [!WARNING]
> If adding a **Task** or **Combat** card to `StateSchema.js`:
> You MUST manually initialize runtime properties that `CardManager` usually handles, or the card will be buggy.
> - `assignedHeroId: null`
> - `assignedItems: {}`
> - `progress: 0`
> - `status: 'idle'`

## Step 6: Report to User

Summarize:
- What was added (list files and entries)
- What tier was applied
- What assumptions were made
- What items/biomes were created

## Example Conversations

### Simple Task
**User**: "Add mushroom foraging for caves"

**AI**:
1. No new biome needed (cave exists)
2. Tier 1 assumed (foraging)
3. Adds `mushroom` item
4. Adds `forage_mushrooms` task to cardRegistry
5. Adds to cave taskPool

### Combat Card
**User**: "Add a tier 2 goblin enemy for mountain"

**AI**:
1. No new biome needed
2. Tier 2: skillReq 10, HP ~45, combat XP ~25
3. Adds `mountain_t2_goblin` to enemyRegistry
4. Adds `goblin_drops` to dropTableRegistry
5. Adds `combat_goblin` to cardRegistry
6. Adds to mountain taskPool

### New Biome Required
**User**: "Add fire elemental combat for volcano"

**AI asks**:
> "I'll need to create a **Volcano** biome. Should I proceed with:
> - Effects: +10% industry XP
> - Color: #cc3300
> - Would include fire elemental combat"

**User**: "Yes"

**AI creates biome, enemy, drops, combat card**

## Common Patterns

### Gathering Task (no inputs)
```javascript
inputs: []
outputs: [{ itemId: 'x', quantity: 2, chance: 100 }]
```

### Crafting Task (consumes items)
```javascript
inputs: [{ itemId: 'x', quantity: N }]
outputs: [{ itemId: 'crafted', quantity: 1, chance: 100 }]
biomeId: null  // Universal
```

### Tool-Using Task
```javascript
inputs: [{ acceptTag: 'pickaxe', quantity: 1, isTool: true, slotLabel: 'Pickaxe' }]
// Tool durability consumed, not quantity
```

### Combat Card Template
```javascript
// Copy this template:
COMBAT_CARD_ID: {
    id: 'COMBAT_CARD_ID',
    name: 'DISPLAY_NAME',
    cardType: CARD_TYPES.COMBAT,
    description: 'DESCRIPTION',
    enemyId: 'ENEMY_ID',      // Must exist in enemyRegistry
    biomeId: 'BIOME_ID',
    skill: 'SKILL',           // 'melee', 'ranged', or 'magic'
    skillRequirement: 0,
    isUnique: false,
    icon: 'ICON'
},
```

### Enemy Template
```javascript
// Copy this template into enemyRegistry.js:
ENEMY_ID: {
    id: 'ENEMY_ID',
    name: 'DISPLAY_NAME',
    biomeId: 'BIOME_ID',
    tier: TIER,               // 1-5
    combatType: 'COMBAT_TYPE',// 'melee', 'ranged', 'magic'
    energyCost: 2,
    hp: HP,
    attackSkill: ATK,
    defenceSkill: DEF,
    minDamage: MIN_DMG,
    maxDamage: MAX_DMG,
    attackSpeed: MS,          // Milliseconds
    drops: [
        { itemId: 'ITEM_ID', minQty: 1, maxQty: 1, chance: 100 }
    ],
    xpAwarded: XP,
    icon: 'ICON'
},
```
