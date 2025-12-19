# Card & Registry Schema Reference

> **Purpose**: Reference document for AI-assisted content creation. Use this when adding new Tasks, Items, Combat, Enemies, or Biomes.

---

## Persistence & Usage

- **Workflow files persist** in `.agent/workflows/` and are version-controlled
- **Use `/add-task`** to trigger the add-task workflow conversationally
- **This document** should be read at the start of any content creation task

---

## Terminology: Templates vs Instances

| Term | Definition | Where Defined |
|------|------------|---------------|
| **Task** | Base template defining what a task does | `cardRegistry.js` |
| **Task Card** | Runtime instance of a Task, affected by biome/rarity | Created by game systems |
| **Enemy** | Base template for a combat opponent | `enemyRegistry.js` |
| **Combat Card** | Runtime instance linking to an Enemy | `cardRegistry.js` |
| **Item** | Template for an inventory object | `itemRegistry.js` |
| **Biome** | Environment type with task pools and effects | `biomeRegistry.js` |
| **Project** | Building/ritual unlocked by completing Areas | `projectRegistry.js` |

> **Important**: When creating a "Task Card", you are creating the **Task template**. The game system creates Card instances from templates at runtime.

---

## Quick Reference: Adding New Content

### Adding a Task
1. **Create required Items first** → `itemRegistry.js` (inputs and outputs)
2. **Add Task template** → `cardRegistry.js` → `CARDS` object
3. **Add to Biome taskPool** → `biomeRegistry.js` (if biome-specific)
4. (Optional) Add items to starting inventory → `StateSchema.js`

### Adding an Item
1. **Add Item template** → `itemRegistry.js` → `ITEMS` object
2. **Include appropriate tags** for matching (e.g., `['tool', 'pickaxe']`)
3. (Optional) Add to starting inventory → `StateSchema.js`

### Adding Combat (Enemy + Combat Card)
1. **Create loot Items first** → `itemRegistry.js`
2. **Add Enemy template** → `enemyRegistry.js` → `ENEMIES` object (with inline `drops[]`)
3. **Add Combat Card** → `cardRegistry.js` → `CARDS` object
4. **Add to Biome taskPool** → `biomeRegistry.js`

### Adding a Biome
1. **Confirm with user first** (AI must always ask)
2. **Add Biome template** → `biomeRegistry.js` → `BIOMES` object
3. **Define taskPool** with initial Tasks/Combat Cards
4. **Define effects** (bonuses for tasks in this biome)
5. **Set guaranteedProject** (building unlocked by Area completion)

### Adding a Project (Building/Ritual)
1. **Add Project template** → `projectRegistry.js` → `PROJECTS` object
2. **Define costs** (items required to build)
3. **Define effects** (passive bonuses when built)
4. **Link from Biome** → `guaranteedProject` field

### Adding a Skill
1. **Add Skill definition** → `skillRegistry.js` → `SKILLS` object
2. **Update hero generation** if skill should have starting bonuses

### Dependency Order
Always create content in this order to avoid missing references:
```
1. Items (materials, tools, equipment)
2. Enemies (with inline drops)
3. Tasks / Combat Cards
4. Biomes (include tasks/combat in taskPool)
5. Projects (linked from biomes)
```

---

## Design Tier System (1-5)

> Tiers are a **design philosophy** guide, not a hard game mechanic. They inform balanced stat/requirement values.

### Tier Reference Table

| Tier | Description | Skill Req | Duration | Energy | XP Awarded | XP Ratio | Example |
|------|-------------|-----------|----------|--------|------------|----------|---------|
| **1** | Starter | 0 | 5-10s | 0-5 | 5-10 | 1:1 | Foraging, Well, Rat |
| **2** | Early game | 20 | 10-20s | 5-15 | 15-30 | 1:1.5 | Logging, Mining, Wolf |
| **3** | Mid game | 40 | 20-35s | 15-40 | 50-90 | 1:2.5 | Smelting, Bears, Elementals |
| **4** | Late game | 60 | 35-50s | 40-70 | 120-200 | 1:3.5 | Rare ores, Dragons, Alloys |
| **5** | End game | 80 | 50-60s | 70-100 | 250-300 | 1:5 | Bosses, Legendary crafting |

### Tier Progression Philosophy

- **Skill requirements** increase by ~20 per tier, naturally gating content
- **Duration** scales from 5s to 60s max - longer tasks feel more meaningful
- **Energy costs** scale from 0 to 100 max - requires energy management progression
- **XP rewards** scale from 1:1 (duration:XP) at Tier 1 to 1:5 at Tier 5
- **Outputs** become more valuable to justify the investment

### Drop Table Complexity by Tier

| Tier | Drop Table Size | Rare Drop Chance | Ultra-Rare |
|------|-----------------|------------------|------------|
| 1 | 1-2 items | 10-20% | N/A |
| 2 | 2-3 items | 5-15% | N/A |
| 3 | 3-5 items | 2-10% | 1-2% |
| 4 | 4-6 items | 1-5% | 0.5-1% |
| 5 | 5-8 items | 0.5-2% | 0.1-0.5% |

### Input Complexity by Tier

| Tier | Input Slots | Input Types | Notes |
|------|-------------|-------------|-------|
| 1 | 0-1 | None or basic material | Simple gathering |
| 2 | 1-2 | Materials, optional tool | Basic crafting |
| 3 | 2-3 | Materials + tool required | Multi-step processes |
| 4 | 3-4 | Mixed tags, fuels, tools | Complex crafting chains |
| 5 | 4-6 | Rare materials + multiple tools | Legendary item creation |

### Metal Tier Example

| Metal | Tier | Skill Req | Duration | Inputs | Notes |
|-------|------|-----------|----------|--------|-------|
| Copper | 1 | 0 | 8s | None | Starter metal |
| Iron | 2 | 20 | 15s | Pickaxe | Early upgrade |
| Steel | 3 | 40 | 25s | Iron + Coal + Fuel | Alloy process |
| Mithril | 4 | 60 | 40s | Rare ore + Flux + Fuel | Rare ore |
| Adamantine | 5 | 80 | 55s | Ultra-rare ore + 2 fuels + Master tools | End-game |

---

## Task Card Schema (cardRegistry.js)

### Template Structure

```javascript
{
    // === REQUIRED FIELDS ===
    id: 'task_id',                    // Unique identifier (snake_case)
    name: 'Task Name',                // Display name
    cardType: CARD_TYPES.TASK,        // Always 'task' for tasks
    
    // === CATEGORIZATION ===
    taskCategory: TASK_CATEGORIES.XXX, // See categories below
    skill: 'skill_id',                // Primary skill (see skill list)
    biomeId: 'biome_id' | null,       // Associated biome or null for universal
    
    // === TIMING & COST (scale with tier) ===
    baseTickTime: 10000,              // Duration in ms (10000 = 10 seconds)
    baseEnergyCost: 5,                // Energy consumed on completion
    skillRequirement: 0,              // Minimum skill level to assign hero
    
    // === UNIQUENESS ===
    isUnique: false,                  // true = only one instance allowed (e.g., Well)
    
    // === INPUTS ===
    inputs: [],                       // See Input Types below
    
    // === OUTPUTS ===
    outputs: [],                      // See Output Types below
    outputMap: {},                    // For dynamic outputs (open slots)
    
    // === REWARDS (scale with tier) ===
    xpAwarded: 10,                    // XP granted to primary skill
    
    // === DISPLAY ===
    description: 'What this task does.',
    icon: '⛏️',                        // Emoji icon
}
```

### Input Types

| Type | Structure | Behavior |
|------|-----------|----------|
| **Fixed Item** | `{ itemId: 'wood', quantity: 3 }` | Specific item consumed from inventory |
| **Open Slot (Tag)** | `{ acceptTag: 'fuel', quantity: 1, slotLabel: 'Any Fuel' }` | Player drags any item with matching tag |
| **Tool** | `{ acceptTag: 'pickaxe', quantity: 1, isTool: true, slotLabel: 'Pickaxe' }` | Durability consumed, item NOT removed |

**Open Slot Notes:**
- `acceptTag` matches against item's `tags[]` array in itemRegistry
- `slotLabel` is displayed in the UI slot
- Assigned item ID stored in `cardInstance.assignedItems[slotIndex]`

### Output Types

| Type | Structure | Behavior |
|------|-----------|----------|
| **Guaranteed** | `{ itemId: 'wood', quantity: 1, chance: 100 }` | Always drops |
| **Chance Drop** | `{ itemId: 'gem', quantity: 1, chance: 5 }` | 5% chance to drop |
| **Currency** | `{ currencyId: 'influence', quantity: 1, chance: 100 }` | Grants currency (Influence) |
| **Dynamic (outputMap)** | See below | Output depends on open slot input |

**Dynamic Output Example (Smelting):**
```javascript
inputs: [
    { acceptTag: 'ore', quantity: 1, slotLabel: 'Any Ore' },
    { acceptTag: 'fuel', quantity: 1, slotLabel: 'Any Fuel' }
],
outputs: [],  // Leave empty when using outputMap
outputMap: {
    'copper_ore': [{ itemId: 'copper_ingot', quantity: 1, chance: 100 }],
    'iron_ore': [{ itemId: 'iron_ingot', quantity: 1, chance: 100 }]
}
```

### Available Task Categories

| Category | Constant | Example Tasks |
|----------|----------|---------------|
| Water | `TASK_CATEGORIES.WATER` | Well |
| Logging | `TASK_CATEGORIES.LOGGING` | Tree cutting |
| Mining | `TASK_CATEGORIES.MINING` | Ore extraction |
| Fishing | `TASK_CATEGORIES.FISHING` | Catching fish |
| Foraging | `TASK_CATEGORIES.FORAGING` | Herbs, berries |
| Hunting | `TASK_CATEGORIES.HUNTING` | Animal hunting |
| Smelting | `TASK_CATEGORIES.SMELTING` | Ore processing |
| Crafting | `TASK_CATEGORIES.CRAFTING` | Item creation |
| Cooking | `TASK_CATEGORIES.COOKING` | Food prep |
| Combat | `TASK_CATEGORIES.COMBAT` | Fighting |

### Available Item Tags (for acceptTag)

| Tag | Items with this tag |
|-----|---------------------|
| `axe` | Wooden Axe, Iron Axe |
| `pickaxe` | Copper Pickaxe, Iron Pickaxe |
| `ore` | Copper Ore, Iron Ore |
| `fuel` | Wood, Coal |
| `building` | Wood, Stone |
| `drink` | Water |

> **Note:** New tags can be added by including them in an item's `tags[]` array in itemRegistry.js

### Checklist: Adding a New Task

1. **cardRegistry.js** — Add task template to `CARDS` object
   - [ ] Unique `id` (snake_case)
   - [ ] Set `cardType: CARD_TYPES.TASK`
   - [ ] Choose appropriate `taskCategory`
   - [ ] Set `skill` (primary skill for XP)
   - [ ] Set tier-appropriate values: `baseTickTime`, `baseEnergyCost`, `skillRequirement`, `xpAwarded`

2. **itemRegistry.js** — Ensure all referenced items exist
   - [ ] All `itemId` values in `inputs` exist
   - [ ] All `itemId` values in `outputs` exist
   - [ ] All `acceptTag` values have matching items with that tag

3. **biomeRegistry.js** — Add to biome's `taskPool` (if biome-specific)
   - [ ] Add `{ taskId: 'your_task_id', weight: X }` to appropriate biome
   - [ ] Weight determines spawn frequency relative to other tasks

4. **Optional: New Category or Tag** — See sections below

### Adding a New Task Category

If a task doesn't fit existing categories, add a new one:

**1. Add to cardRegistry.js:**
```javascript
export const TASK_CATEGORIES = {
    // ... existing categories ...
    ALCHEMY: 'alchemy',       // New category
};
```

**2. Use in task template:**
```javascript
taskCategory: TASK_CATEGORIES.ALCHEMY,
```

> **Note:** Categories are used for Project bonuses (e.g., "All MINING tasks get +10% XP"). If your task fits an existing category's theme, prefer using that.

### Adding a New Item Tag

Tags enable open slots to accept groups of items. To add a new tag:

**1. Add to existing items in itemRegistry.js:**
```javascript
iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    type: ITEM_TYPES.WEAPON,
    tags: ['weapon', 'melee', 'iron'],  // Add relevant tags
    // ...
}
```

**2. Use in task input:**
```javascript
inputs: [
    { acceptTag: 'melee', quantity: 1, slotLabel: 'Melee Weapon' }
]
```

**Common Tag Patterns:**
| Pattern | Use Case |
|---------|----------|
| Material type | `ore`, `ingot`, `gem` |
| Tool type | `axe`, `pickaxe`, `hammer` |
| Consumable type | `fuel`, `food`, `drink` |
| Equipment slot | `weapon`, `armor`, `accessory` |
| Material tier | `iron`, `steel`, `mithril` |

---

## Combat Card + Enemy Schema

Combat encounters require two linked definitions:
1. **Combat Card** in `cardRegistry.js` — spawns in biome pools, triggers combat
2. **Enemy** in `enemyRegistry.js` — combat stats, drops, XP rewards

### Combat Card Template (cardRegistry.js)

```javascript
{
    // === REQUIRED FIELDS ===
    id: 'combat_wolf',                // Format: combat_{enemy_short_name}
    name: 'Fight Wolf',               // Display name
    cardType: CARD_TYPES.COMBAT,      // Always 'combat'
    description: 'A fierce pack hunter.',
    
    // === ENEMY REFERENCE ===
    enemyId: 'forest_t1_wolf',        // References enemyRegistry.js
    
    // === CATEGORIZATION ===
    biomeId: 'forest',                // Biome where this spawns
    skill: 'melee',                   // Primary combat skill: 'melee', 'ranged', or 'magic'
    skillRequirement: 0,              // Minimum skill level to attempt
    
    // === FLAGS ===
    isUnique: false,
    icon: '🐺'
}
```

### Enemy Template (enemyRegistry.js)

```javascript
{
    // === IDENTIFICATION ===
    id: 'forest_t1_wolf',             // Format: {biome}_t{tier}_{name}
    name: 'Wolf',
    biomeId: 'forest',
    tier: 1,                          // 1-5 (see tier guidelines)
    
    // === COMBAT STATS (scale with tier) ===
    hp: 25,
    attackSkill: 8,                   // Hit chance modifier
    defenceSkill: 5,                  // Damage reduction modifier
    minDamage: 2,
    maxDamage: 4,
    attackSpeed: 3000,                // ms between attacks (lower = faster)
    energyCost: 2,                    // Energy consumed per round
    
    // === DROPS (inline - recommended) ===
    drops: [
        { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },   // Guaranteed
        { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 60 },   // Common
        { itemId: 'wolf_fang', minQty: 1, maxQty: 1, chance: 25 }   // Uncommon
    ],
    
    // === XP REWARDS (scale with tier) ===
    xpAwarded: {
        combat: 15,                   // XP to melee/ranged/magic skill
        defence: 10                   // XP to defence skill
    },
    
    // === DISPLAY ===
    icon: '🐺',
    isBoss: false                     // Optional: true for boss enemies
}
```

### Drop Entry Structure

| Field | Type | Description |
|-------|------|-------------|
| `itemId` | string | Item from itemRegistry |
| `minQty` | number | Minimum quantity dropped |
| `maxQty` | number | Maximum quantity dropped |
| `chance` | number | Drop probability (0-100) |

### Enemy Stat Guidelines by Tier

| Tier | Skill Req | HP | Attack | Defence | Damage | Speed (ms) | Combat XP | Defence XP |
|------|-----------|-----|--------|---------|--------|------------|-----------|------------|
| 1 | 0 | 15-35 | 4-12 | 2-10 | 1-6 | 2500-3500 | 10-25 | 5-15 |
| 2 | 20 | 35-70 | 12-20 | 8-16 | 4-10 | 2200-3200 | 25-50 | 15-30 |
| 3 | 40 | 70-120 | 20-30 | 16-25 | 8-16 | 2000-2800 | 50-100 | 30-60 |
| 4 | 60 | 120-200 | 30-42 | 25-35 | 14-25 | 1800-2600 | 100-180 | 60-100 |
| 5 | 80 | 200-350+ | 42-55 | 35-48 | 22-40 | 1600-2400 | 180-300 | 100-180 |

### Drop Table Complexity by Tier

| Tier | Drop Count | Rare Chance | Ultra-Rare | Notes |
|------|------------|-------------|------------|-------|
| 1 | 2-3 | 15-30% | N/A | Basic materials |
| 2 | 3-4 | 10-20% | N/A | Crafting materials |
| 3 | 4-5 | 5-15% | 1-3% | Specialty items |
| 4 | 5-6 | 2-10% | 0.5-1% | Rare reagents |
| 5 | 6-8 | 1-5% | 0.1-0.5% | Legendary materials |

### Checklist: Adding a New Combat Encounter

1. **enemyRegistry.js** — Add enemy template with inline drops
   - [ ] Unique `id` (format: `{biome}_t{tier}_{name}`)
   - [ ] Set tier-appropriate stats using guidelines above
   - [ ] Add `drops[]` array with items and chances
   - [ ] Set `xpAwarded` for combat and defence

2. **cardRegistry.js** — Add Combat Card template
   - [ ] Unique `id` (format: `combat_{enemy_short_name}`)
   - [ ] Set `cardType: CARD_TYPES.COMBAT`
   - [ ] Link `enemyId` to the enemy you created
   - [ ] Set `biomeId` and `skill`

3. **itemRegistry.js** — Ensure drop items exist
   - [ ] All `itemId` values in `drops[]` exist

4. **biomeRegistry.js** — Add to biome's `taskPool`
   - [ ] Add `{ taskId: 'combat_xxx', weight: X }` to appropriate biome
   - [ ] Balance weight against other tasks in pool

---


## Biome Schema (biomeRegistry.js)

### Template Structure

```javascript
{
    // === IDENTIFICATION ===
    id: 'forest',
    name: 'Forest',
    description: 'Dense woodland filled with timber and wildlife.',
    category: BIOME_CATEGORIES.NATURAL,  // See categories below
    icon: '🌲',
    color: '#2d5a27',                    // Hex color for UI borders/accents
    
    // === THEMATIC HINTS ===
    taskHints: ['logging', 'foraging', 'hunting'],  // AI reference for content themes
    
    // === EFFECTS (Future Phase) ===
    effects: [
        { type: 'speed_skill', skills: ['nature'], bonus: 0.05 }
        // Effect system will be expanded in a later phase
    ],
    
    // === TASK SPAWN POOL ===
    taskPool: [
        { taskId: 'logging', weight: 35 },
        { taskId: 'foraging', weight: 30 },
        { taskId: 'combat_wolf', weight: 15 }  // Combat cards use same pool
    ],
    
    // === PROJECT ===
    guaranteedProject: 'lumber_mill'      // Building unlocked by completing area (null if none)
}
```

### Biome Categories

| Category | Constant | Use For |
|----------|----------|---------|
| Natural | `BIOME_CATEGORIES.NATURAL` | Surface outdoor areas (forest, plains, mountain) |
| Underground | `BIOME_CATEGORIES.UNDERGROUND` | Caves, mines, dungeons |
| Aquatic | `BIOME_CATEGORIES.AQUATIC` | Water-related (swamp, river, ocean) |
| Mystical | `BIOME_CATEGORIES.MYSTICAL` | Magic-themed areas |
| Special | `BIOME_CATEGORIES.SPECIAL` | Non-discoverable biomes (guild_hall) |

### Existing Biomes (Draft)

| Biome ID | Icon | Category | Primary Skills | Notes |
|----------|------|----------|----------------|-------|
| `forest` | 🌲 | Natural | nature, industry | Timber, wildlife |
| `plains` | 🌾 | Natural | nature | Grasslands, farming |
| `mountain` | ⛰️ | Natural | industry | Mining, ores |
| `cave` | 🕳️ | Underground | industry | Deep mining |
| `swamp` | 🐸 | Aquatic | nature | Herbs, wetland creatures |
| `guild_hall` | 🏛️ | Special | all | Universal crafting (with debuffs) |

> **Note:** This table is a draft. Additional biomes will be added (volcano, tundra, desert, etc.)

### Checklist: Adding a New Biome

1. **biomeRegistry.js** — Add biome definition
   - [ ] Unique `id` (lowercase, snake_case)
   - [ ] Set `category` from BIOME_CATEGORIES
   - [ ] Choose `icon` (emoji) and `color` (hex)
   - [ ] Add `taskHints` for thematic guidance
   - [ ] Configure `effects` (optional, future phase)
   - [ ] Leave `taskPool` empty initially (populated as tasks are added)
   - [ ] Set `guaranteedProject` (null if no building unlocked)

2. **cardRegistry.js** — Create tasks for the biome
   - [ ] Add Task Cards with `biomeId: 'new_biome_id'`
   - [ ] Add Combat Cards with `biomeId: 'new_biome_id'`

3. **enemyRegistry.js** — Create enemies for the biome
   - [ ] Add enemies with `biomeId: 'new_biome_id'`
   - [ ] Link to Combat Cards via `enemyId`

4. **biomeRegistry.js** — Populate taskPool
   - [ ] Add task/combat cards to `taskPool[]` with weights
   - [ ] Weights determine relative spawn frequency

5. **Optional: Explore Card**
   - [ ] May need to update explore card generation to include new biome

### AI Content Creation Note

> [!IMPORTANT]
> **AI MUST ASK USER** before creating a new biome when a task/enemy doesn't fit existing biomes thematically. Use this prompt format:
> 
> *"This task seems to need a new biome. Should I create a **[Biome Name]** biome with the following properties? [describe theme, category, color, effects]"*

---


## Item Schema (itemRegistry.js)

### Template Structure

```javascript
{
    // === REQUIRED ===
    id: 'item_id',                    // Unique identifier (snake_case)
    name: 'Item Name',                // Display name
    type: ITEM_TYPES.MATERIAL,        // See types below
    icon: '🪨',                        // Emoji icon
    
    // === OPTIONAL ===
    tags: ['building', 'fuel'],       // For acceptTag matching in tasks
    description: 'Description.',
    stackable: true,                  // Default: true
    maxStack: 999,                    // Default: 999
    
    // === TOOL-SPECIFIC ===
    maxDurability: 100,               // Durability for tools
    skillBonus: { skill: 'industry', value: 2 },  // Bonus when equipped
    
    // === WEAPON-SPECIFIC ===
    equipSlot: 'weapon',
    skillRequired: 'melee',           // Skill needed to equip
    levelRequired: 1,                 // Minimum level to equip
    damage: 5,                        // Damage dealt
    tickSpeedBonus: -200,             // Attack speed bonus (negative = faster)
    
    // === FOOD/DRINK-SPECIFIC ===
    equipSlot: 'food' | 'drink',
    restoreAmount: 10,                // HP or Energy restored
    restoreType: 'hp' | 'energy'
}
```

### Item Types

| Type | Constant | Use For |
|------|----------|---------|
| Material | `ITEM_TYPES.MATERIAL` | Basic resources (wood, stone, ore, ingots) |
| Tool | `ITEM_TYPES.TOOL` | Equipment that provides skill bonuses (axe, pickaxe) |
| Weapon | `ITEM_TYPES.WEAPON` | Combat equipment (swords, bows) |
| Armor | `ITEM_TYPES.ARMOR` | Defensive equipment |
| Food | `ITEM_TYPES.FOOD` | Consumables that restore HP |
| Potion | `ITEM_TYPES.POTION` | Crafted consumables with special effects |
| Currency | `ITEM_TYPES.CURRENCY` | Special tracking items (gold, tokens) |
| Drop | `ITEM_TYPES.DROP` | Monster parts and loot |

### Item Tags Reference

Tags enable open slots in tasks to accept groups of items via `acceptTag`.

| Tag | Use For | Example Items |
|-----|---------|---------------|
| **Material Tags** |||
| `building` | Construction materials | wood, stone |
| `fuel` | Furnace/smelting | wood, coal |
| `ore` | Raw mining outputs | copper_ore, iron_ore |
| `ingot` | Smelted metals | copper_ingot, iron_ingot |
| `metal` | Any metal item | ores, ingots |
| **Consumable Tags** |||
| `food` | Edible items | berries, raw_meat, fish |
| `drink` | Drinkable items | water |
| `ingredient` | Cooking/crafting inputs | herbs, raw_meat |
| `raw` | Unprocessed food | raw_meat |
| **Tool Tags** |||
| `tool` | All tools (required for tools) | axes, pickaxes |
| `axe` | Chopping tools | wooden_axe |
| `pickaxe` | Mining tools | copper_pickaxe |
| **Equipment Tags** |||
| `weapon` | Combat weapons | swords, bows |
| `melee` | Melee weapons | wooden_sword |
| **Other Tags** |||
| `crafted` | Player-made items | torch, wooden_sword |
| `light` | Light sources | torch |
| `alchemy` | Potion ingredients | herbs |

> **Note:** New tags can be added freely—just include them in the item's `tags[]` array.

### Checklist: Adding a New Item

1. **itemRegistry.js** — Add item template
   - [ ] Unique `id` (snake_case)
   - [ ] Set appropriate `type` from ITEM_TYPES
   - [ ] Add relevant `tags[]` for task input matching
   - [ ] Set `icon` (emoji)
   - [ ] For tools: set `maxDurability` and `skillBonus`
   - [ ] For weapons: set `damage`, `equipSlot`, `skillRequired`
   - [ ] For food/drink: set `restoreAmount`, `restoreType`, `equipSlot`

2. **Verify Task Compatibility**
   - [ ] If item is a task output: ensure task `outputs[]` references correct `itemId`
   - [ ] If item is a task input: ensure item has matching tag for `acceptTag`
   - [ ] If item is an enemy drop: ensure enemy `drops[]` references correct `itemId`

3. **Optional: Add Crafting Recipe**
   - [ ] If craftable: add a Task Card that produces this item

---


## Task Categories (`TASK_CATEGORIES`)

Categories group related tasks for Project bonuses (future phase).

| Category | Constant | Use For | Default Skill |
|----------|----------|---------|---------------|
| Water | `TASK_CATEGORIES.WATER` | Water collection | nature |
| Logging | `TASK_CATEGORIES.LOGGING` | Tree cutting | industry |
| Mining | `TASK_CATEGORIES.MINING` | Ore extraction | industry |
| Fishing | `TASK_CATEGORIES.FISHING` | Catching fish | nature |
| Foraging | `TASK_CATEGORIES.FORAGING` | Herbs, berries | nature |
| Hunting | `TASK_CATEGORIES.HUNTING` | Animal hunting | nature |
| Smelting | `TASK_CATEGORIES.SMELTING` | Ore processing | industry |
| Crafting | `TASK_CATEGORIES.CRAFTING` | Item creation | crafting |
| Cooking | `TASK_CATEGORIES.COOKING` | Food preparation | culinary |
| Combat | `TASK_CATEGORIES.COMBAT` | Fighting enemies | melee/ranged/magic |
| Intrigue | `TASK_CATEGORIES.INTRIGUE` | Social manipulation | occult/crime |

> **Note:** Additional categories will be added as content expands.

> [!IMPORTANT]
> **AI MUST ASK USER** before creating a new Task Category. Use this prompt format:
> 
> *"This task doesn't fit existing categories. Should I create a **[Category Name]** category for [description of task types]?"*

---


## Skills Reference

| Skill ID | Icon | Category |
|----------|------|----------|
| `melee` | ⚔️ | Combat |
| `ranged` | 🏹 | Combat |
| `magic` | ✨ | Combat |
| `defence` | 🛡️ | Combat |
| `crafting` | 🔨 | Production |
| `culinary` | 🍳 | Production |
| `industry` | ⚙️ | Gathering |
| `nature` | 🌿 | Gathering |
| `nautical` | ⚓ | Special |
| `crime` | 🗡️ | Special |
| `occult` | 🔮 | Special |
| `science` | 🔬 | Special |

> **Note:** Additional skills may be added as content expands.

---

## Example: Complete Task + Combat Creation

**User**: "Add fire-themed content for a volcano biome - gathering ash and fighting fire elementals"

**AI confirms**: "I'll create a **Volcano** biome. Should I proceed?"

**User**: "Yes"

**AI creates**:

### 1. New Biome (biomeRegistry.js)
```javascript
volcano: {
    id: 'volcano',
    name: 'Volcano',
    description: 'Scorching volcanic terrain with rare minerals and fire creatures.',
    category: BIOME_CATEGORIES.NATURAL,
    icon: '🌋',
    color: '#cc3300',
    taskHints: ['mining', 'gathering', 'combat'],
    effects: [
        { type: 'xp_skill', skills: ['industry'], bonus: 0.10 }
    ],
    taskPool: [
        { taskId: 'gather_ash', weight: 35 },
        { taskId: 'combat_fire_elemental', weight: 25 }
    ],
    guaranteedProject: 'forge'
}
```

### 2. New Item (itemRegistry.js)
```javascript
volcanic_ash: {
    id: 'volcanic_ash',
    name: 'Volcanic Ash',
    type: ITEM_TYPES.MATERIAL,
    tags: ['material', 'alchemy'],
    description: 'Fine ash from volcanic vents.',
    stackable: true,
    icon: '�ite️'
}
```

### 3. New Task (cardRegistry.js)
```javascript
gather_ash: {
    id: 'gather_ash',
    name: 'Gather Volcanic Ash',
    cardType: CARD_TYPES.TASK,
    taskCategory: TASK_CATEGORIES.FORAGING,
    description: 'Collect ash from volcanic vents.',
    skill: 'nature',
    skillRequirement: 15,  // Tier 2
    biomeId: 'volcano',
    isUnique: false,
    baseTickTime: 10000,
    baseEnergyCost: 5,
    inputs: [],
    outputs: [
        { itemId: 'volcanic_ash', quantity: 2, chance: 100 }
    ],
    xpAwarded: 15,
    icon: '🌋'
}
```

### 4. New Enemy + Combat Card
```javascript
// enemyRegistry.js
volcano_t2_fire_elemental: {
    id: 'volcano_t2_fire_elemental',
    name: 'Fire Elemental',
    biomeId: 'volcano',
    tier: 2,
    energyCost: 5,
    hp: 45,
    attackSkill: 15,
    defenceSkill: 10,
    minDamage: 5,
    maxDamage: 9,
    attackSpeed: 2500,
    drops: [
        { itemId: 'fire_essence', minQty: 1, maxQty: 2, chance: 100 },
        { itemId: 'ember_shard', minQty: 1, maxQty: 1, chance: 25 }
    ],
    xpAwarded: { combat: 25, defence: 18 },
    icon: '🔥'
}

// cardRegistry.js
combat_fire_elemental: {
    id: 'combat_fire_elemental',
    name: 'Fight Fire Elemental',
    cardType: CARD_TYPES.COMBAT,
    description: 'Battle a creature of living flame.',
    enemyId: 'volcano_t2_fire_elemental',
    biomeId: 'volcano',
    skill: 'melee',
    skillRequirement: 10,
    isUnique: false,
    icon: '🔥'
}
```
