# Technical Architecture Plan

This document explains *how* we will build the game. Since we want to keep things simple and robust, we will use a **"Manager-Registry-State"** pattern.

---

## Table of Contents

**Overview**
- [The Big Picture](#the-big-picture)

**1. Data Layer**
- [1. The Rulebook (Static Data Registries)](#1-the-rulebook-static-data-registries)
  - [Core Registries](#core-registries)
  - [Registry Format & Conventions](#registry-format--conventions)
  - [Key Registry Schemas](#key-registry-schemas)
  - [Registry Schema Documentation](#registry-schema-documentation)
  - [Registry Validation](#registry-validation)

**2. State Layer**
- [2. The Scoreboard (Game State)](#2-the-scoreboard-game-state)
  - [State Conventions](#state-conventions)
  - [Detailed State Structures](#detailed-state-structures)

**3. Logic Layer**
- [3. The Robot (Managers / Systems)](#3-the-robot-managers--systems)
  - [System Naming Convention](#system-naming-convention)
  - [Core Loop](#core-loop)
  - [Hero Systems](#hero-systems)
  - [Card Systems](#card-systems)
  - [Combat Systems](#combat-systems)
  - [Economy Systems](#economy-systems)
  - [Global Systems](#global-systems)
  - [System Dependencies & Call Hierarchy](#system-dependencies--call-hierarchy)
  - [Event Catalog](#event-catalog)
  - [Game Loop Tick Order](#game-loop-tick-order)
  - [Formulas Reference](#formulas-reference)
  - [UI Integration](#ui-integration)
  - [Initial Game State](#initial-game-state-new-game-bootstrap)

**4. Examples**
- [4. How They Work Together (Examples)](#4-how-they-work-together-examples)

**5. Structure**
- [5. Directory Structure](#5-directory-structure)

**6. Extensibility**
- [6. Extension Points](#6-extension-points)

**7. Design Principles**
- [7. Key Design Decisions](#7-key-design-decisions)
  - [Error Handling](#error-handling)
  - [Testing Strategy](#testing-strategy)
  - [Save/Load System](#saveload-system)
    - [Multiple Save Slots](#multiple-save-slots)
    - [Export/Import](#exportimport)
    - [Offline Progress](#offline-progress)

**8. UI**
- [8. UI Architecture](#8-ui-architecture)
  - [Layout Structure](#layout-structure)
  - [CSS Methodology](#css-methodology)
  - [Component Architecture](#component-architecture)
  - [Drag & Drop System](#drag--drop-system)
  - [ViewManager Responsibilities](#viewmanager-responsibilities)
  - [Notification System UI](#notification-system-ui)
  - [Modal System](#modal-system)
  - [Asset Management](#asset-management)

---

## The Big Picture

Imagine the game as a board game being played by a robot.
1.  **The Rulebook (Registries):** This is a list of everything that *can* exist in the game. It doesn't change while you play.
2.  **The Scoreboard (State):** This is the current situation. How much wood do you have? Which heroes are alive? This changes constantly.
3.  **The Robot (Managers):** This is the code that moves the pieces. It reads the Rulebook and updates the Scoreboard.

---

## 1. The Rulebook (Static Data Registries)

These are files where we define the game content. If we want to add a new Sword, we just add it to the list here. **All registries are read-only at runtime.**

### Core Registries

| Registry | Purpose | Example Entries |
| :--- | :--- | :--- |
| **CardRegistry** | Defines all card templates (Tasks, Recipe, Explore, Area, Combat, Invasion, Recruit) | `"Forest_Logging"`, `"Kitchen"`, `"Goblin_Raid"` |
| **ItemRegistry** | Defines all items, their type, and properties | `"Wood"`, `"Iron Sword"`, `"Health Potion"` |
| **SkillRegistry** | Defines all 11 skills and their categories | `"Melee"`, `"Industry"`, `"Occult"` |
| **RarityRegistry** | Defines rarity tiers and their drop probabilities | `Common (70%)`, `Uncommon (30%)`, `Rare (unlocked)` |
| **RecipeRegistry** | Defines all recipes with inputs, outputs, skill requirements, and unlock conditions | `"Bread"` → `[Flour, Water] → Bread`, `"Iron_Sword"` → `[Iron Bar x2] → Iron Sword` |
| **DropTableRegistry** | Defines loot tables for tasks/enemies with item IDs, quantity ranges, and drop chances | `"Goblin"` → `[{Gold, 1-5, 100%}, {Goblin Ear, 1, 20%}]` |

### Hero Registries

| Registry | Purpose | Example Entries |
| :--- | :--- | :--- |
| **ClassRegistry** | Defines 9 Classes with their 3 bonus skills | `"Fighter"` → `[Melee, Defence, Industry]` |
| **TraitRegistry** | Defines 9 Traits with their 3 bonus skills | `"Strong"` → `[Melee, Industry, Crafting]` |
| **PerkRegistry** | Defines all 180 perks (10 per Class, 10 per Trait) | `"Fighter_L10_HeavyLifter"`, `"Strong_L50_Forgemaster"` |
| **NameRegistry** | Name pools for hero generation | `"Sophie"`, `"Blaze"`, `"Mouse"` |

### World Registries

| Registry | Purpose | Example Entries |
| :--- | :--- | :--- |
| **BiomeRegistry** | Defines 40 Biomes with passive bonuses | `"Forest"` → `+1% XP [Nature]` |
| **ModifierRegistry** | Defines 60 Modifiers with passive bonuses | `"Windy"` → `-1% Tick [Nautical]` |
| **EnemyRegistry** | Defines enemies by Biome and Tier | `"Plains_T1_GiantRat"`, `"Cave_T5_Balrog"` |
| **ProjectRegistry** | Defines all 50+ Projects and their bonuses | `"Warehouse"` → `+5 Inventory Slots` |

### Invasion Registries

| Registry | Purpose | Example Entries |
| :--- | :--- | :--- |
| **ThreatDebuffRegistry** | Defines 30 debuff types for Invasions | `"Industrial Decay"` → `+10% Tick Time [Industry]` |
| **InvasionTemplateRegistry** | Defines Invasion event templates | `"Rat_Horde"` → `100 enemies, Plains biome` |

### Registry Format & Conventions

**File Format:** JavaScript modules exporting constant objects (not JSON).
```javascript
// Example: itemRegistry.js
export const ITEMS = {
  wood: { id: "wood", name: "Wood", ... },
  iron_sword: { id: "iron_sword", name: "Iron Sword", ... },
};
```

**Naming Conventions:**
| Element | Convention | Example |
| :--- | :--- | :--- |
| Registry IDs | `snake_case` | `iron_sword`, `goblin_t1`, `explore_plains` |
| Display Names | Natural case | `"Iron Sword"`, `"Giant Rat"` |
| File names | `camelCase.js` | `itemRegistry.js`, `cardRegistry.js` |
| Export names | `SCREAMING_SNAKE_CASE` | `ITEMS`, `CARDS`, `PERKS` |
| Skill IDs | `camelCase` | `melee`, `nature`, `occult` |
| Enum values | `lowercase` | `type: "weapon"`, `rarity: "rare"` |

**Why JS Modules over JSON:**
- Inline comments for documentation
- IDE autocomplete and validation
- Static imports (better optimization)
- Can include helper functions if needed

**Time Units Convention:**
> [!IMPORTANT]
> `GameLoop` passes `deltaTime` to tick handlers in **seconds** (already converted from milliseconds).
> All tick handlers can use `deltaTime` directly without conversion:
> ```javascript
> tick(deltaTime) {
>     // deltaTime is already in seconds
>     const energyCost = rate * deltaTime;  // Works directly
> }
> ```
> This ensures consistency across all systems and eliminates conversion errors.

### Key Registry Schemas

#### ItemRegistry Schema
```javascript
{
  id: string,              // Unique ID (snake_case)
  name: string,            // Display name
  type: "material" | "tool" | "weapon" | "armor" | "food" | "drink" | "potion" | "currency" | "drop",
  
  // Type-specific fields:
  // Tools/Weapons/Armor:
  durability?: number,     // Max durability (if applicable)
  
  // Weapons:
  minDamage?: number,
  maxDamage?: number,
  attackType?: "melee" | "ranged" | "magic",
  
  // Armor:
  defenceBonus?: number,
  
  // Food/Drink/Potion:
  restoreAmount?: number,  // HP or Energy restored
  restoreType?: "hp" | "energy",
  
  // All stackable items:
  stackable: boolean,
  maxStack?: number,       // Default: global maxStack if not specified
  
  // Optional:
  description?: string,
  tier?: number,           // 1-5 for tiered items
  skillRequired?: { skill: string, level: number },
  tags?: string[]          // Category tags for open slot matching (e.g., ['ore', 'fuel'])
}
```

#### CardRegistry Schema
```javascript
{
  id: string,              // Unique ID
  name: string,            // Display name
  cardType: "task" | "recipe" | "explore" | "area" | "combat" | "invasion" | "recruit",
  
  // Common fields:
  biomeId?: string,        // null for Recruit cards
  isUnique?: boolean,      // Unique cards don't count against limit
  
  // Task/Recipe cards:
  skill?: string,          // Skill used (e.g., "industry", "culinary")
  skillRequirement?: number,
  baseTickTime?: number,   // Milliseconds per tick
  baseEnergyCost?: number,
  toolRequired?: string,   // Item ID of required tool type
  
  // Input slots (two formats):
  inputs?: [
    { itemId: string, quantity: number } |           // Fixed input (specific item)
    { acceptTag: string, quantity: number, slotLabel?: string }  // Open input (any item with tag)
  ],
  
  // Output options:
  outputs?: [{ itemId: string, quantity: number, chance?: number }],
  outputMap?: { [inputItemId: string]: [{ itemId: string, quantity: number }] },  // Dynamic outputs based on input
  
  dropTableId?: string,    // Reference to DropTableRegistry
  xpAwarded?: number,
  
  // Recipe cards only:
  availableRecipes?: string[], // Recipe IDs this card can make
  
  // Explore cards:
  progressRequired?: number,
  areaOptions?: number,    // How many areas to offer (default 3)
  
  // Area cards:
  projectOptions?: string[], // Project IDs to offer
  
  // Combat cards:
  enemyId?: string,        // Reference to EnemyRegistry
  
  // Invasion cards:
  enemyCount?: number,
  threatRate?: number,     // Threat per second
  debuffMilestones?: [{ threshold: number, debuffId: string }]
}
```

#### PerkRegistry Schema
```javascript
{
  id: string,              // Format: "{class/trait}_{level}_{name}"
  name: string,            // Display name
  description: string,     // Full description with placeholders
  sourceType: "class" | "trait",
  sourceId: string,        // Class or Trait ID
  level: number,           // 10, 20, 30... 100
  
  // Effect definition:
  effectType: "modifier" | "trigger" | "passive",
  effect: {
    // Modifier type (stat changes):
    stat?: string,         // e.g., "energyCost", "tickTime", "damage"
    operation?: "add" | "multiply" | "set",
    value?: number,
    scaling?: number,      // Multiplier for Hero Level scaling
    condition?: string,    // e.g., "skill:industry", "biome:forest"
    
    // Trigger type (on-event effects):
    trigger?: string,      // e.g., "onHit", "onTaskComplete", "onDefeat"
    chance?: number,       // 0-100 probability
    
    // Special effects:
    special?: string       // For complex effects: "doubleOutput", "hitTwice", etc.
  }
}
```

#### RecipeRegistry Schema
```javascript
{
  id: string,              // Unique ID
  name: string,            // Display name
  skill: string,           // Required skill
  skillRequirement: number,// Minimum skill level
  
  inputs: [
    { itemId: string, quantity: number }
  ],
  
  output: {
    itemId: string,
    quantity: number,
    bonusChance?: number   // Chance for +1 extra
  },
  
  baseTickTime: number,    // Milliseconds
  baseEnergyCost: number,
  xpAwarded: number,
  
  // Optional unlock condition (beyond skill):
  unlockedByProject?: string
}
```

#### EnemyRegistry Schema
```javascript
{
  id: string,              // Format: "{biome}_{tier}_{name}"
  name: string,            // Display name
  biomeId: string,
  tier: number,            // 1-5
  
  // Combat stats:
  hp: number,
  attackSkill: number,     // For hit chance calculation
  defenceSkill: number,
  minDamage: number,
  maxDamage: number,
  attackSpeed: number,     // Milliseconds per attack
  
  // Loot:
  dropTableId: string,     // Reference to DropTableRegistry
  xpAwarded: {
    combat: number,        // XP for the attack skill used
    defence: number        // XP for Defence
  },
  
  // Optional:
  isBoss?: boolean,
  abilities?: string[]     // Special abilities (future feature)
}
```

### Registry Schema Documentation

This section provides a complete reference for all registry field requirements, ensuring consistency during development.

#### Field Requirement Legend
- **Required**: Must be present, validation fails without it
- **Optional**: May be omitted, system uses default
- **Conditional**: Required only when certain conditions are met

#### ItemRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Must be unique, snake_case |
| `name` | ✓ | string | — | Display name |
| `type` | ✓ | enum | — | See valid types below |
| `stackable` | ✓ | boolean | — | — |
| `maxStack` | | number | 100 | Only if stackable |
| `durability` | Cond. | number | — | Required for tool/weapon/armor |
| `minDamage` | Cond. | number | — | Required for weapon |
| `maxDamage` | Cond. | number | — | Required for weapon |
| `attackType` | Cond. | enum | — | Required for weapon |
| `defenceBonus` | Cond. | number | — | Required for armor |
| `restoreAmount` | Cond. | number | — | Required for food/drink/potion |
| `restoreType` | Cond. | enum | — | Required for food/drink/potion |
| `description` | | string | "" | — |
| `tier` | | number | 1 | 1-5 |
| `skillRequired` | | object | null | `{ skill, level }` |

**Valid `type` values:** `"material"`, `"tool"`, `"weapon"`, `"armor"`, `"food"`, `"drink"`, `"potion"`, `"currency"`, `"drop"`

**Valid `attackType` values:** `"melee"`, `"ranged"`, `"magic"`

**Valid `restoreType` values:** `"hp"`, `"energy"`

#### CardRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Unique, snake_case |
| `name` | ✓ | string | — | Display name |
| `cardType` | ✓ | enum | — | See valid types below |
| `biomeId` | | string | null | null for Recruit cards |
| `isUnique` | | boolean | false | Doesn't count against limit |
| `skill` | Cond. | string | — | Required for task/recipe |
| `skillRequirement` | | number | 0 | — |
| `baseTickTime` | Cond. | number | — | Required for task/recipe/explore |
| `baseEnergyCost` | | number | 1 | — |
| `toolRequired` | | string | null | Item ID |
| `inputs` | | array | [] | `[{ itemId, quantity }]` |
| `outputs` | | array | [] | `[{ itemId, quantity, chance? }]` |
| `dropTableId` | | string | null | Reference to DropTableRegistry |
| `xpAwarded` | | number | 0 | — |
| `availableRecipes` | Cond. | array | — | Required for recipe cards |
| `progressRequired` | Cond. | number | — | Required for explore/area cards |
| `areaOptions` | | number | 3 | For explore cards |
| `projectOptions` | Cond. | array | — | Required for area cards |
| `enemyId` | Cond. | string | — | Required for combat cards |
| `enemyCount` | Cond. | number | — | Required for invasion cards |
| `threatRate` | Cond. | number | — | Required for invasion cards |
| `debuffMilestones` | | array | [] | For invasion cards |

**Valid `cardType` values:** `"task"`, `"recipe"`, `"explore"`, `"area"`, `"combat"`, `"invasion"`, `"recruit"`

#### PerkRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Format: `{source}_{level}_{name}` |
| `name` | ✓ | string | — | Display name |
| `description` | ✓ | string | — | Full description with placeholders |
| `sourceType` | ✓ | enum | — | `"class"` or `"trait"` |
| `sourceId` | ✓ | string | — | Class or Trait ID |
| `level` | ✓ | number | — | 10, 20, 30... 100 |
| `effectType` | ✓ | enum | — | `"modifier"`, `"trigger"`, `"passive"` |
| `effect` | ✓ | object | — | See effect structure |

**Effect Object Structure:**
```javascript
{
  // For modifier type:
  stat?: "energyCost" | "tickTime" | "damage" | "xpGain" | "outputChance",
  operation?: "add" | "multiply" | "set",
  value?: number,
  scaling?: number,    // For [Hero Level * X] effects
  condition?: string,  // e.g., "skill:industry", "biome:forest"
  
  // For trigger type:
  trigger?: "onHit" | "onTaskComplete" | "onDefeat" | "onCrit",
  chance?: number,     // 0-100
  
  // For special effects:
  special?: "doubleOutput" | "hitTwice" | "ignoreDefence" | "noWounded"
}
```

#### RecipeRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Unique |
| `name` | ✓ | string | — | Display name |
| `skill` | ✓ | string | — | Required skill |
| `skillRequirement` | ✓ | number | — | Minimum level |
| `inputs` | ✓ | array | — | `[{ itemId, quantity }]` |
| `output` | ✓ | object | — | `{ itemId, quantity, bonusChance? }` |
| `baseTickTime` | ✓ | number | — | Milliseconds |
| `baseEnergyCost` | ✓ | number | — | — |
| `xpAwarded` | ✓ | number | — | — |
| `unlockedByProject` | | string | null | Project ID |

#### EnemyRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Format: `{biome}_{tier}_{name}` |
| `name` | ✓ | string | — | Display name |
| `biomeId` | ✓ | string | — | Reference to BiomeRegistry |
| `tier` | ✓ | number | — | 1-5 |
| `hp` | ✓ | number | — | Base hit points |
| `attackSkill` | ✓ | number | — | For hit chance calculation |
| `defenceSkill` | ✓ | number | — | — |
| `minDamage` | ✓ | number | — | — |
| `maxDamage` | ✓ | number | — | — |
| `attackSpeed` | ✓ | number | — | Milliseconds per attack |
| `dropTableId` | ✓ | string | — | Reference to DropTableRegistry |
| `xpAwarded` | ✓ | object | — | `{ combat, defence }` |
| `isBoss` | | boolean | false | — |
| `abilities` | | array | [] | Future feature |

#### DropTableRegistry Field Requirements

| Field | Required | Type | Default | Notes |
| :--- | :---: | :--- | :--- | :--- |
| `id` | ✓ | string | — | Unique |
| `drops` | ✓ | array | — | `[{ itemId, minQty, maxQty, chance }]` |

**Drop Entry Structure:**
```javascript
{
  itemId: string,      // Reference to ItemRegistry
  minQty: number,      // Minimum quantity (≥1)
  maxQty: number,      // Maximum quantity (≥minQty)
  chance: number       // 0-100 percentage
}
```

### Registry Validation

Add `RegistryValidator.js` to `/utils/` for development-time validation:

```javascript
// RegistryValidator.js
export const RegistryValidator = {
  
  validateItem(item) {
    const errors = [];
    
    // Required fields
    if (!item.id) errors.push('Missing id');
    if (!item.name) errors.push('Missing name');
    if (!item.type) errors.push('Missing type');
    if (item.stackable === undefined) errors.push('Missing stackable');
    
    // Type-specific validation
    if (['weapon', 'tool', 'armor'].includes(item.type)) {
      if (!item.durability) errors.push(`${item.type} requires durability`);
    }
    if (item.type === 'weapon') {
      if (!item.minDamage) errors.push('Weapon requires minDamage');
      if (!item.maxDamage) errors.push('Weapon requires maxDamage');
      if (!item.attackType) errors.push('Weapon requires attackType');
    }
    if (['food', 'drink', 'potion'].includes(item.type)) {
      if (!item.restoreAmount) errors.push(`${item.type} requires restoreAmount`);
      if (!item.restoreType) errors.push(`${item.type} requires restoreType`);
    }
    
    // Enum validation
    const validTypes = ['material', 'tool', 'weapon', 'armor', 'food', 'drink', 'potion', 'currency', 'drop'];
    if (item.type && !validTypes.includes(item.type)) {
      errors.push(`Invalid type: ${item.type}`);
    }
    
    return { valid: errors.length === 0, errors, id: item.id };
  },
  
  validateCard(card) {
    const errors = [];
    
    if (!card.id) errors.push('Missing id');
    if (!card.name) errors.push('Missing name');
    if (!card.cardType) errors.push('Missing cardType');
    
    // Card type-specific validation
    if (['task', 'recipe'].includes(card.cardType)) {
      if (!card.skill) errors.push(`${card.cardType} requires skill`);
      if (!card.baseTickTime) errors.push(`${card.cardType} requires baseTickTime`);
    }
    if (card.cardType === 'recipe') {
      if (!card.availableRecipes?.length) errors.push('Recipe card requires availableRecipes');
    }
    if (card.cardType === 'combat') {
      if (!card.enemyId) errors.push('Combat card requires enemyId');
    }
    if (card.cardType === 'invasion') {
      if (!card.enemyCount) errors.push('Invasion card requires enemyCount');
      if (!card.threatRate) errors.push('Invasion card requires threatRate');
    }
    
    return { valid: errors.length === 0, errors, id: card.id };
  },
  
  validatePerk(perk) {
    const errors = [];
    
    if (!perk.id) errors.push('Missing id');
    if (!perk.name) errors.push('Missing name');
    if (!perk.description) errors.push('Missing description');
    if (!perk.sourceType) errors.push('Missing sourceType');
    if (!perk.sourceId) errors.push('Missing sourceId');
    if (!perk.level) errors.push('Missing level');
    if (!perk.effectType) errors.push('Missing effectType');
    if (!perk.effect) errors.push('Missing effect');
    
    // ID format validation
    if (perk.id && !perk.id.match(/^\w+_\d+_\w+$/)) {
      errors.push(`ID doesn't match format {source}_{level}_{name}: ${perk.id}`);
    }
    
    // Level validation
    if (perk.level && ![10,20,30,40,50,60,70,80,90,100].includes(perk.level)) {
      errors.push(`Invalid level: ${perk.level}`);
    }
    
    return { valid: errors.length === 0, errors, id: perk.id };
  },
  
  validateAllRegistries() {
    const results = { valid: true, registries: {} };
    
    // Validate items
    const itemResults = Object.values(ITEMS).map(i => this.validateItem(i));
    results.registries.items = itemResults.filter(r => !r.valid);
    
    // Validate cards
    const cardResults = Object.values(CARDS).map(c => this.validateCard(c));
    results.registries.cards = cardResults.filter(r => !r.valid);
    
    // Validate perks
    const perkResults = Object.values(PERKS).map(p => this.validatePerk(p));
    results.registries.perks = perkResults.filter(r => !r.valid);
    
    // Check if any failures
    results.valid = Object.values(results.registries).every(r => r.length === 0);
    
    return results;
  }
};
```

#### Registry Validation Tests

```javascript
// registryValidation.test.js
import { ITEMS, CARDS, PERKS, ENEMIES, RECIPES } from '../config/registries';
import { RegistryValidator } from '../utils/RegistryValidator';

describe('ItemRegistry Validation', () => {
  test('all items have required fields', () => {
    Object.values(ITEMS).forEach(item => {
      const result = RegistryValidator.validateItem(item);
      expect(result.valid).toBe(true);
      if (!result.valid) console.log(item.id, result.errors);
    });
  });
  
  test('all item IDs are snake_case', () => {
    Object.keys(ITEMS).forEach(id => {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });
  
  test('all weapons have damage values', () => {
    Object.values(ITEMS)
      .filter(i => i.type === 'weapon')
      .forEach(weapon => {
        expect(weapon.minDamage).toBeDefined();
        expect(weapon.maxDamage).toBeDefined();
        expect(weapon.maxDamage).toBeGreaterThanOrEqual(weapon.minDamage);
      });
  });
});

describe('CardRegistry Validation', () => {
  test('all cards have required fields', () => {
    Object.values(CARDS).forEach(card => {
      const result = RegistryValidator.validateCard(card);
      expect(result.valid).toBe(true);
    });
  });
  
  test('all card types are valid', () => {
    const validTypes = ['task', 'recipe', 'explore', 'area', 'combat', 'invasion', 'recruit'];
    Object.values(CARDS).forEach(card => {
      expect(validTypes).toContain(card.cardType);
    });
  });
});

describe('PerkRegistry Validation', () => {
  test('all perks have required fields', () => {
    Object.values(PERKS).forEach(perk => {
      const result = RegistryValidator.validatePerk(perk);
      expect(result.valid).toBe(true);
    });
  });
  
  test('each class has exactly 10 perks', () => {
    const classes = ['fighter', 'ranger', 'wizard', 'rogue', 'paladin', 'cleric', 'bard', 'alchemist', 'engineer'];
    classes.forEach(classId => {
      const classPerks = Object.values(PERKS).filter(p => 
        p.sourceType === 'class' && p.sourceId === classId
      );
      expect(classPerks.length).toBe(10);
    });
  });
  
  test('each trait has exactly 10 perks', () => {
    const traits = ['strong', 'nimble', 'brilliant', 'tough', 'zealous', 'greedy', 'curious', 'cruel', 'disciplined'];
    traits.forEach(traitId => {
      const traitPerks = Object.values(PERKS).filter(p => 
        p.sourceType === 'trait' && p.sourceId === traitId
      );
      expect(traitPerks.length).toBe(10);
    });
  });
});

describe('Cross-Registry References', () => {
  test('all card dropTableIds reference valid drop tables', () => {
    Object.values(CARDS)
      .filter(c => c.dropTableId)
      .forEach(card => {
        expect(DROP_TABLES[card.dropTableId]).toBeDefined();
      });
  });
  
  test('all drop table itemIds reference valid items', () => {
    Object.values(DROP_TABLES).forEach(table => {
      table.drops.forEach(drop => {
        expect(ITEMS[drop.itemId]).toBeDefined();
      });
    });
  });
  
  test('all enemy biomeIds reference valid biomes', () => {
    Object.values(ENEMIES).forEach(enemy => {
      expect(BIOMES[enemy.biomeId]).toBeDefined();
    });
  });
});
```

---




## 2. The Scoreboard (Game State)

This is the data we save when you close the game. It is organized into logical sections.

### `GameState` (Root Object)

```javascript
{
  meta: { ... },          // Game version, timestamps
  settings: { ... },      // Player preferences (volume, speed, etc.)
  heroes: [ ... ],        // All hero data
  cards: { ... },         // Active cards on the board
  inventory: { ... },     // Items and organization
  currency: { ... },      // Gold and special currencies (future feature)
  progress: { ... },      // Completed projects and unlocks
  threats: { ... },       // Active invasions and debuffs
  modifiers: { ... },     // Calculated global bonuses (cached)
  time: { ... }           // Game time tracking
}
```

### State Conventions

**ID Generation:**
Use `nanoid` (21-character short UUIDs) for all runtime-generated IDs:
```javascript
import { nanoid } from 'nanoid';
const heroId = `hero_${nanoid()}`;  // e.g., "hero_V1StGXR8_Z5jdHi6B-myT"
const cardId = `card_${nanoid()}`;  // e.g., "card_FJkKzXghUvn0TqLmNprOw"
```

**Timestamp Format:**
Use Unix timestamps (milliseconds) instead of Date objects for JSON compatibility:
```javascript
createdAt: Date.now(),  // e.g., 1701849600000
```

**HP/Energy Base Values:**
- Base max HP: **100**
- Base max Energy: **100**
- *Note: Designed for future scaling via perks/projects. Systems should read `hero.hp.max` and `hero.energy.max` rather than hardcoding 100.*

**Durability Consumption Order:**
When consuming stacked items with durability (e.g., multiple swords):
- Use **FIFO** (First In, First Out)
- The `durabilities` array is ordered: index 0 = oldest item, consumed first

### Detailed State Structures

#### `meta` - Save Metadata
```javascript
{
  version: "1.0.0",           // Game version for migration
  createdAt: 1701849600000,   // Unix timestamp (ms) when save was created
  lastSavedAt: 1701936000000, // Unix timestamp (ms) of last save
  totalPlaytime: 3600         // Seconds played (for stats)
}
```

#### `settings` - Player Preferences
```javascript
{
  audio: {
    masterVolume: 0.8,        // 0.0 - 1.0
    musicVolume: 0.5,
    sfxVolume: 1.0,
    muted: false
  },
  gameplay: {
    gameSpeed: 1.0,           // 1.0 = normal, 2.0 = 2x speed (if implemented)
    autoSaveInterval: 30,     // Seconds between auto-saves
    showDamageNumbers: true,
    compactCardView: false
  },
  notifications: {
    showItemGained: true,
    showXpGained: false,      // Can be noisy
    showLevelUp: true,
    showCombatResults: true
  }
}
```

#### `currency` - Gold & Special Currencies (Future Feature)
```javascript
{
  // Skeleton for future currency implementation
  gold: 0,
  // Potential future currencies:
  // gems: 0,
  // guild_tokens: 0
}
```
> **Note:** Currency system is not currently active. This structure is a placeholder for future implementation.

#### `heroes[]` - Hero Array
```javascript
{
  id: "hero_001",
  name: "Sophie",
  classId: "Fighter",
  traitId: "Strong",
  
  // Current Stats (Mutable)
  hp: { current: 100, max: 100 },
  energy: { current: 50, max: 50 },
  status: "idle",             // "idle", "working", "combat", "wounded"
  woundedUntil: null,         // Timestamp when wound heals
  
  // Skills (XP and Levels)
  skills: {
    melee: { xp: 0, level: 20 },    // +20 from Class+Trait overlap
    defence: { xp: 0, level: 10 },
    industry: { xp: 0, level: 20 },
    // ... all 11 skills
  },
  
  // Perks (Choices Made)
  perks: {
    10: "class",    // At level 10, chose Class perk
    20: "trait",    // At level 20, chose Trait perk
    // ... up to level 100
  },
  
  // Equipment Slots
  equipment: {
    weapon: { itemId: "iron_sword", durability: 45 },
    armor: { itemId: null, durability: 0 },
    food: { itemId: "bread", quantity: 10 },
    drink: { itemId: "water", quantity: 25 }
  },
  
  // Assignment
  assignedCardId: null        // Which card this hero is working on
}
```

#### `cards` - Card Management
```javascript
{
  active: [                   // Cards on the Main Panel
    {
      id: "card_001",
      templateId: "task_logging",
      biomeId: "forest",
      modifierId: "windy",
      rarity: "uncommon",
      parentAreaId: "area_001",
      
      // Slots
      heroSlotId: "hero_001",
      toolSlot: { itemId: "axe", durability: 10 },
      
      // Open input slots: maps slot index to assigned item ID
      // Used for cards with acceptTag inputs (e.g., "smelt any ore")
      assignedItems: { 0: "copper_ore", 1: "coal" },
      
      // Progress
      progress: { current: 45, required: 100 },
      
      // Task-specific (for Explore cards)
      selectionState: null,   // null or { options: [...], selected: 0 }
      
      // Recipe-specific (for Recipe cards)
      recipeState: {
        selectedRecipeId: "bread",     // Currently selected recipe
        availableRecipes: ["bread", "stew", "ale"],  // Unlocked recipes for this card
        dynamicInputs: [               // Inputs change based on recipe
          { itemId: "flour", quantity: 1 },
          { itemId: "water", quantity: 1 }
        ],
        dynamicOutput: { itemId: "bread", quantity: 1 }
      },
      
      // Invasion-specific
      enemiesRemaining: null,
      threatLevel: null
    }
  ],
  
  completed: [],              // Completed Area/Project references
  
  limits: {
    max: 10,                  // Max active cards
    currentCount: 8           // Current count (excludes overflow cards)
  }
}
```

**Card Type Field Matrix** — Which fields apply to which card type:

| Field | Task | Recipe | Explore | Area | Combat | Invasion | Recruit |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `cardType` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `templateId` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `biomeId` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `modifierId` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `rarity` | ✓ | ✓ | — | — | ✓ | — | — |
| `parentAreaId` | ✓ | ✓ | — | — | ✓ | — | — |
| `heroSlotId` | ✓ | ✓ | ✓ | ✓ | ✓ | Multi | — |
| `toolSlot` | ✓ | ✓ | — | — | — | — | — |
| `inputSlots` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `progress` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `selectionState` | — | — | ✓ | ✓ | — | — | ✓ |
| `recipeState` | — | ✓ | — | — | — | — | — |
| `enemyId` | — | — | — | — | ✓ | — | — |
| `enemyHp` | — | — | — | — | ✓ | — | — |
| `enemiesRemaining` | — | — | — | — | — | ✓ | — |
| `threatLevel` | — | — | — | — | — | ✓ | — |
| `heroSlotIds` (array) | — | — | — | — | — | ✓ | — |
| `candidates` | — | — | — | — | — | — | ✓ |

> **Important:** Add `cardType: "task" | "recipe" | "explore" | "area" | "combat" | "invasion" | "recruit"` to every card object as a discriminator.


#### `inventory` - Item Storage
```javascript
{
  slots: {
    max: 50,                  // Max unique item types
    used: 23
  },
  maxStack: 100,              // Max count per item type
  
  items: {
    "wood": { quantity: 45 },
    "iron_sword": { quantity: 3, durabilities: [100, 80, 60] },
    "health_potion": { quantity: 12 }
  },
  
  groups: [
    { id: "loot", name: "Loot", items: ["wood", "stone"], collapsed: false },
    { id: "equipment", name: "Equipment", items: ["iron_sword"], collapsed: true },
    { id: "consumables", name: "Consumables", items: ["health_potion"], collapsed: false }
  ]
}
```

#### `progress` - Unlocks and Achievements
```javascript
{
  completedProjects: [
    { projectId: "warehouse", completedAt: Date, areaId: "area_001" }
  ],
  
  unlockedRarities: ["common", "uncommon", "rare"],
  unlockedBiomes: ["plains", "forest", "mountain"],
  
  // Explore progression
  exploreDepth: 3,            // Current tier of exploration
  areasDiscovered: 5
}
```

#### `threats` - Invasion State
```javascript
{
  activeInvasions: [
    {
      cardId: "card_invasion_001",
      templateId: "rat_horde",
      enemiesTotal: 100,
      enemiesDefeated: 23,
      threatMeter: 45,        // 0-100 percentage
      debuffStack: 1          // Number of debuff milestones reached
    }
  ],
  
  activeDebuffs: [
    { debuffId: "industrial_decay", stacks: 2, source: "invasion_001" }
  ]
}
```

#### `modifiers` - Calculated Bonuses (Cached)
```javascript
{
  // Aggregated from Biomes, Modifiers, Projects, Invasions, Perks
  tickTimeMultipliers: {
    industry: 0.95,           // 5% faster (Smithy project)
    nature: 1.10              // 10% slower (Nature's Wrath debuff)
  },
  xpMultipliers: {
    melee: 1.05,
    science: 1.10
  },
  outputChanceBonus: {
    crafting: 0.05            // +5% output chance
  },
  // ... other aggregated modifiers
}
```

#### `time` - Game Time Tracking
```javascript
{
  gameTimeMs: 123456789,      // Total game time in milliseconds
  lastTickAt: Date,           // For calculating delta time
  isPaused: false
}
```

---

## 3. The Robot (Managers / Systems)

This is the "Brain" of the game. Each manager has a **single responsibility**.

### System Naming Convention

To maintain consistency, systems follow this naming pattern:

| Suffix | Purpose | State Ownership | Example |
| :--- | :--- | :--- | :--- |
| `*Manager` | CRUD operations on state | **Owns** specific state | `HeroManager`, `InventoryManager` |
| `*System` | Tick-based processors | Reads/calls other systems | `TaskSystem`, `RegenSystem` |
| `*Formula` | Stateless calculations | None (pure functions) | `CombatFormulas`, `XpFormulas` |
| `*Aggregator` | Collects data from multiple sources | Owns cached results | `ModifierAggregator` |

### Core Loop

| System | Responsibility |
| :--- | :--- |
| **GameLoop** | The heartbeat. Runs every tick (100ms) and orchestrates all other systems. |
| **TimeManager** | Tracks game time, handles pause/resume, calculates delta time for consistent progression. |
| **SaveManager** | Handles localStorage save/load, auto-save intervals, and version migration. |

### Hero Systems

| System | Responsibility |
| :--- | :--- |
| **HeroManager** | Creates heroes, manages recruitment, retirement, and hero state transitions (idle→working→wounded). |
| **HeroGenerator** | Procedural hero generation. Selects random Name, Class, Trait from registries. Calculates starting skill bonuses from Class/Trait overlap. |
| **SkillSystem** | Calculates effective skill levels (base + bonuses), handles XP gain, level-ups. Uses exponential XP curve. |
| **PerkSystem** | Tracks perk milestones, presents choices (Class vs Trait), applies perk effects. Calculates Hero Level. |
| **RegenSystem** | Handles HP/Energy regeneration per hero. Base rate: 1 point per 5 seconds. Modified by perks/projects. |
| **ConsumableSystem** | Monitors HP/Energy <20% thresholds. Auto-consumes Food/Drinks. Handles "consuming takes 1 tick" rule. |

### Card Systems

| System | Responsibility |
| :--- | :--- |
| **CardManager** | Spawning, discarding, and card limit enforcement. Card Factory logic for trait inheritance. |
| **CardUpgradeSystem** | Handles 5-to-1 card upgrading. Extracts traits, validates restrictions, uses RNG for new card generation. |
| **TaskSystem** | Processes active Task cards. Adds progress, consumes inputs, awards outputs and XP per tick. |
| **RecipeSystem** | Manages Recipe cards. Handles recipe selection, dynamic input/output updates, recipe unlock checks. |
| **ExploreSystem** | Handles Explore card mechanics. Progress tracking, Area selection (3 options), revealing Biome/Modifier. |
| **RecruitSystem** | Manages Recruit cards. Generates 3 hero candidates (partial reveal: Class OR Trait), handles player selection, consumes card on recruitment. |
| **ProjectSystem** | Manages Area card Projects. Massive resource consumption, progress tracking, completion bonuses. |

### Combat Systems

| System | Responsibility |
| :--- | :--- |
| **CombatSystem** | Core combat loop for Combat cards. Simultaneous tick cycles, victory/defeat resolution. Uses CombatFormulas for calculations. |
| **CombatFormulas** | *Stateless utility.* `rollHit(attackerSkill, defenderSkill)` → boolean. `computeDamage(attacker, defender, weapon)` → number. Handles crits, perks. |
| **InvasionManager** | Manages multi-hero Invasion cards. Threat meter progression, debuff milestone triggers, horde tracking. |
| **WoundedSystem** | Handles hero defeat. Applies "Wounded" state with recovery timer (based on game time). |

### Economy Systems

| System | Responsibility |
| :--- | :--- |
| **InventoryManager** | Item storage, stack limits, slot limits. Add/remove items. Enforces global limits. |
| **InventoryGroupManager** | UI organization: create, rename, delete, collapse groups. Drag-drop between groups. |
| **EquipmentManager** | Manages hero equipment slots (Weapon, Armor, Food, Drink). Validates item types, handles equip/unequip actions, pulls from inventory. |
| **ToolDurabilitySystem** | Tool degradation per tick. Auto-replace from stack when broken. |
| **EquipmentDurabilitySystem** | Weapon/Armor degradation during combat. |
| **LootSystem** | Calculates drops from tasks/combat. Handles drop tables, quantity ranges, bonus loot perks. |

### Global Systems

| System | Responsibility |
| :--- | :--- |
| **ModifierAggregator** | **The Calculator.** Aggregates all bonuses from: Biomes, Modifiers, Projects, Invasions, Perks. Caches results for performance. |
| **ThreatSystem** | Manages invasion debuffs. Applies/removes debuffs based on threat milestones. Stacking logic. |
| **UnlockSystem** | Tracks permanent unlocks: Rarities and Biomes (both from Projects). Responds to project_completed events. |
| **SettingsManager** | Manages player preferences. Reads/writes `settings` state. Applies audio volume changes, notifies systems of speed changes. |
| **EventBus** | Central pub/sub for game events (e.g., "hero_leveled", "task_completed", "invasion_milestone"). |
| **NotificationSystem** | Manages toast notifications. Queues messages, handles display timing, groups similar notifications (e.g., "+5 Wood" instead of 5x "+1 Wood"). |

### System Dependencies & Call Hierarchy

To avoid ambiguity, here are the explicit ownership rules and call patterns:

#### Equipment Flow
`EquipmentManager` is the **primary owner** for equipping/unequipping:
```
UI → EquipmentManager.equip(heroId, itemId, slot)
     → validates item type matches slot
     → calls InventoryManager.removeItem(itemId, 1)
     → updates hero.equipment[slot]
     → if previous item existed, calls InventoryManager.addItem(previousItemId)
```

#### Task Tick Flow
`TaskSystem` makes **direct calls** for tick-by-tick updates (not events):
```
TaskSystem (on tick):
  → checks hero has energy (via hero state)
  → consumes inputs (calls InventoryManager.removeItem)
  → degrades tool (calls ToolDurabilitySystem.degrade)
  → adds progress to card
  → awards XP (calls SkillSystem.addXP)
  → if complete: generates loot (calls LootSystem.generate → InventoryManager.addItem)
  → publishes "task_completed" event (for notifications, NOT for core logic)
```

#### CombatFormulas (Stateless Utility)
`CombatFormulas` is a **stateless utility module** with pure functions, not a lifecycle system:
```
CombatSystem (on combat round):
  → calls CombatFormulas.rollHit(attackerSkill, defenderSkill) → boolean
  → if hit: calls CombatFormulas.computeDamage(attacker, defender, weapon) → number
  → applies damage to target HP
  → checks victory/defeat conditions
```
> **Location:** `/utils/CombatFormulas.js`

#### Requirement Checks
`SkillSystem` provides a **generic requirement check API** used by multiple systems:
```javascript
SkillSystem.meetsRequirement(heroId, { skill: "culinary", level: 30 }) → boolean
```
Used by:
- `RecipeSystem` - to filter available recipes
- `TaskSystem` - to validate hero can perform task
- `CardManager` - to check if hero can be assigned to card

#### State Mutation Ownership
| State Area | Owner System | Other Systems Must Call Owner |
| :--- | :--- | :--- |
| `heroes[]` | `HeroManager` | Yes, for status changes |
| `heroes[].skills` | `SkillSystem` | Yes, for XP/level changes |
| `heroes[].equipment` | `EquipmentManager` | Yes |
| `cards.active[]` | `CardManager` | Yes, for spawn/discard |
| `cards.active[].progress` | `TaskSystem` / `ExploreSystem` / `ProjectSystem` | Direct (owns their card types) |
| `inventory.items` | `InventoryManager` | Yes |
| `progress.completedProjects` | `ProjectSystem` | Direct |
| `threats.activeDebuffs` | `ThreatSystem` | Yes |

### Event Catalog

The `EventBus` uses a pub/sub pattern. Events are for **notifications and side effects**, not core game logic.

#### Hero Events
| Event | Publisher | Subscribers | Payload |
| :--- | :--- | :--- | :--- |
| `hero_recruited` | `RecruitSystem` | `NotificationSystem` | `{ heroId, name, classId, traitId }` |
| `hero_retired` | `HeroManager` | `NotificationSystem` | `{ heroId, name, recruitCardsGranted }` |
| `hero_leveled` | `SkillSystem` | `NotificationSystem`, `PerkSystem` | `{ heroId, skillId, newLevel }` |
| `hero_level_milestone` | `PerkSystem` | `NotificationSystem` (UI popup) | `{ heroId, heroLevel, classOption, traitOption }` |
| `perk_selected` | `PerkSystem` | `ModifierAggregator`, `NotificationSystem` | `{ heroId, perkId, perkType }` |
| `hero_wounded` | `WoundedSystem` | `NotificationSystem` | `{ heroId, recoveryTime }` |
| `hero_recovered` | `WoundedSystem` | `NotificationSystem` | `{ heroId }` |

#### Card Events
| Event | Publisher | Subscribers | Payload |
| :--- | :--- | :--- | :--- |
| `card_spawned` | `CardManager` | `NotificationSystem` | `{ cardId, cardType, templateId }` |
| `card_discarded` | `CardManager` | — | `{ cardId }` |
| `card_upgraded` | `CardUpgradeSystem` | `NotificationSystem` | `{ newCardId, newRarity, consumedCount }` |
| `task_completed` | `TaskSystem` | `NotificationSystem` | `{ cardId, heroId, outputItems }` |
| `explore_completed` | `ExploreSystem` | `NotificationSystem` | `{ cardId, areaChosen }` |
| `project_completed` | `ProjectSystem` | `UnlockSystem`, `ModifierAggregator`, `NotificationSystem` | `{ projectId, bonusDescription }` |

#### Combat Events
| Event | Publisher | Subscribers | Payload |
| :--- | :--- | :--- | :--- |
| `combat_victory` | `CombatSystem` | `NotificationSystem`, `LootSystem` | `{ heroId, enemyId, cardId }` |
| `combat_defeat` | `CombatSystem` | `WoundedSystem`, `NotificationSystem` | `{ heroId, enemyId }` |
| `invasion_escalated` | `InvasionManager` | `ThreatSystem`, `ModifierAggregator`, `NotificationSystem` | `{ invasionId, newDebuffId, stackCount }` |
| `invasion_completed` | `InvasionManager` | `ThreatSystem`, `NotificationSystem` | `{ invasionId, reward }` |

#### Economy Events
| Event | Publisher | Subscribers | Payload |
| :--- | :--- | :--- | :--- |
| `item_gained` | `InventoryManager` | `NotificationSystem` | `{ itemId, quantity, source }` |
| `item_lost` | `InventoryManager` | — | `{ itemId, quantity, reason }` |
| `inventory_full` | `InventoryManager` | `NotificationSystem` | `{ itemId, quantityLost }` |
| `tool_broken` | `ToolDurabilitySystem` | `NotificationSystem` | `{ itemId, cardId }` |
| `equipment_broken` | `EquipmentDurabilitySystem` | `NotificationSystem` | `{ heroId, slot, itemId }` |

#### Key Rules
1. **Events are fire-and-forget** — publishers don't wait for subscribers
2. **Core logic uses direct calls** — events are for notifications and cache invalidation
3. **ModifierAggregator subscribes to**: `perk_selected`, `project_completed`, `invasion_escalated`, `invasion_completed`
4. **NotificationSystem subscribes to**: Most events (for toast messages)

### Game Loop Tick Order

The `GameLoop` runs every **100ms** (10 ticks per second). Systems are updated in this exact order:

```
GameLoop.tick():
  1. TimeManager.update()           // Calculate delta time, check pause state
  
  // === REGENERATION (before work, so heroes have resources) ===
  2. RegenSystem.update()           // Regenerate HP/Energy for all heroes
  
  // === CONSUMPTION CHECK (before work, may skip work tick) ===
  3. ConsumableSystem.update()      // Auto-consume Food/Drinks if <20%
  
  // === WORK SYSTEMS (main game progression) ===
  4. TaskSystem.update()            // Process all active Task cards
  5. RecipeSystem.update()          // Process all active Recipe cards
  6. ExploreSystem.update()         // Process all active Explore cards
  7. ProjectSystem.update()         // Process all active Area/Project cards
  
  // === COMBAT (after work, combat is separate activity) ===
  8. CombatSystem.update()          // Process all Combat cards
  9. InvasionManager.update()       // Process Invasion threat meters
  
  // === DURABILITY (after work/combat consumed tools) ===
  10. ToolDurabilitySystem.update() // Check for broken tools, auto-replace
  11. EquipmentDurabilitySystem.update() // Check for broken equipment
  
  // === WOUNDED RECOVERY (end of tick) ===
  12. WoundedSystem.update()        // Check if wounded heroes have recovered
  
  // === SAVE (periodic, not every tick) ===
  13. SaveManager.checkAutoSave()   // Every 30 seconds
```

#### Why This Order?
- **Regen before work**: Heroes need energy to work
- **Consumables before work**: If hero auto-drinks, they skip work this tick
- **Work before combat**: Keeps them logically separate
- **Durability after work/combat**: Tools/equipment used this tick are checked after
- **Wounded last**: Recovery is time-based, order doesn't matter

### Formulas Reference

All game calculations with exact formulas. **Rounding rule: Use `Math.floor()` unless specified.**

#### XP & Leveling
```javascript
// XP required for next level (exponential curve, Runescape-style)
xpForLevel(level) = Math.floor(level + 300 * Math.pow(2, level / 7))

// Total XP for a level (sum of all previous)
totalXpForLevel(level) = sum of xpForLevel(1) to xpForLevel(level - 1)

// Hero Level (average of all skills)
heroLevel(hero) = Math.floor(sumOfAllSkillLevels / 11)

// Starting skill level from Class/Trait bonuses
startingLevel(skill, classId, traitId) = 
  (classHasSkill ? 10 : 0) + (traitHasSkill ? 10 : 0)
  // Max +20 if both Class and Trait share the skill
```

#### Combat
```javascript
// Hit Chance (capped 5% - 95%)
hitChance(attackerSkill, defenderSkill) = 
  clamp(50 + (attackerSkill - defenderSkill) * 2, 5, 95)

// Base Damage
baseDamage(weapon) = weapon.minDamage + random(0, weapon.maxDamage - weapon.minDamage)

// Final Damage (after modifiers)
finalDamage(attacker, defender, baseDamage) =
  Math.floor(baseDamage * (1 + attackerBonuses) * (1 - defenderReduction))

// Defence Reduction
defenceReduction(defenceSkill) = Math.min(defenceSkill * 0.5, 50) // Max 50% reduction
```

#### Energy & Regeneration
```javascript
// Base regeneration (per 5 seconds, i.e., every 50 ticks)
baseRegenPerCycle = 1  // Both HP and Energy

// Energy cost per tick (from task definition)
energyCostPerTick(task) = task.baseEnergyCost + modifierAdjustments

// Auto-consume threshold
shouldAutoConsume(current, max) = (current / max) < 0.20  // Below 20%
```

#### Task Progress
```javascript
// Progress per tick (skill-based)
progressPerTick(heroSkillLevel, taskBaseTime) = 
  Math.floor(1 + (heroSkillLevel / 10))  // Higher skill = faster

// Tick time with modifiers (in milliseconds)
effectiveTickTime(baseTickTime, modifiers) = 
  Math.floor(baseTickTime * modifiers.tickTimeMultiplier)
```

#### Perk Scaling
```javascript
// Perks that scale with Hero Level use this pattern:
// "+[Hero Level * 0.5]" means:
perkBonus(heroLevel, multiplier) = Math.floor(heroLevel * multiplier)

// Examples at Level 50:
// "+[Hero Level * 0.5]" = +25
// "+[Hero Level * 0.2]" = +10
// "+[Hero Level * 0.1]" = +5
```

#### Drop Chances
```javascript
// Bonus drop chance from perks/modifiers (additive)
finalDropChance(baseChance, bonuses) = Math.min(baseChance + bonuses, 100)

// Quantity roll
quantityRoll(min, max) = min + Math.floor(Math.random() * (max - min + 1))
```

### UI Integration

How UI components communicate with game systems:

#### UI → Systems (User Actions)
UI components call system methods **directly** for user-initiated actions:
```javascript
// Examples of UI calling systems:
EquipmentManager.equip(heroId, itemId, "weapon")     // Drag item to hero
CardManager.discard(cardId)                          // Click discard button
RecipeSystem.selectRecipe(cardId, recipeId)          // Dropdown selection
HeroManager.retire(heroId)                           // Retire button
RecruitSystem.selectCandidate(cardId, candidateIndex) // Click hero option
```

#### Systems → UI (State Changes)
Systems publish events via `EventBus`. `ViewManager` subscribes and triggers re-renders:
```javascript
// ViewManager subscribes to relevant events:
EventBus.subscribe("task_completed", () => ViewManager.refreshCard(cardId))
EventBus.subscribe("item_gained", () => ViewManager.refreshInventory())
EventBus.subscribe("hero_leveled", () => ViewManager.refreshHeroCard(heroId))
```

#### Render Cycle
```
User clicks button
    → UI calls System.action()
    → System updates GameState
    → System publishes event via EventBus
    → ViewManager receives event
    → ViewManager.refresh() reads GameState and updates DOM
```

#### Key Rules
1. **UI never modifies GameState directly** — always through system methods
2. **Systems never touch the DOM** — they only update GameState and publish events
3. **ViewManager is the only DOM writer** — reads GameState, writes to DOM
4. **GameLoop does NOT trigger UI updates** — events do (to avoid 10 re-renders/second)

### Initial Game State (New Game Bootstrap)

When starting a new game (no save data), initialize with:

```javascript
{
  meta: {
    version: "1.0.0",
    createdAt: Date.now(),
    lastSavedAt: null,
    totalPlaytime: 0
  },
  
  settings: {
    audio: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 1.0, muted: false },
    gameplay: { gameSpeed: 1.0, autoSaveInterval: 30, showDamageNumbers: true, compactCardView: false },
    notifications: { showItemGained: true, showXpGained: false, showLevelUp: true, showCombatResults: true }
  },
  
  heroes: [],  // Empty - player must recruit
  
  cards: {
    active: [
      // Starting cards (from GDD):
      { cardType: "recruit", id: "start_recruit_1", templateId: "basic_recruit" },
      { cardType: "explore", id: "start_explore_1", templateId: "explore_plains", 
        progress: { current: 0, required: 50 } },
      { cardType: "task", id: "start_well_1", templateId: "well", 
        isUnique: true }  // Well provides free Water
    ],
    completed: [],
    limits: { max: 10, currentCount: 3 }
  },
  
  inventory: {
    slots: { max: 20, used: 0 },
    maxStack: 50,
    items: {},
    groups: [
      { id: "loot", name: "Loot", items: [], collapsed: false }
    ]
  },
  
  currency: {
    gold: 0
  },
  
  progress: {
    completedProjects: [],
    unlockedRarities: ["common", "uncommon"],
    unlockedBiomes: ["plains"]
  },
  
  threats: {
    activeInvasions: [],
    activeDebuffs: []
  },
  
  modifiers: {},  // Calculated on first tick
  
  time: {
    gameTimeMs: 0,
    lastTickAt: Date.now(),
    isPaused: false
  }
}
```

#### Bootstrap Sequence
```
main.js:
  1. Check localStorage for existing save
  2. If exists: SaveManager.load() → GameState
  3. If not: GameState = INITIAL_STATE (above)
  4. ModifierAggregator.recalculate()  // Build initial cache
  5. ViewManager.render()              // Initial UI render
  6. GameLoop.start()                  // Begin ticking
```

---


## 4. How They Work Together (Examples)

### Example 1: Hero Mining a Rock

```
1. GameLoop           → "Tick!"
2. TaskSystem         → Looks at Mining Card
3. TaskSystem         → Asks ModifierAggregator: "What's the tick time for Industry?"
4. ModifierAggregator → Returns 0.95 (5% faster from Smithy)
5. TaskSystem         → Asks SkillSystem: "Hero skill level for Industry?"
6. SkillSystem        → Returns 45 (base 35 + 10 from Class)
7. TaskSystem         → Adds progress based on skill level
8. TaskSystem         → Asks RegenSystem: "Consume 2 Energy from Hero"
9. RegenSystem        → Checks if hero has energy. If not, asks ConsumableSystem
10. TaskSystem        → Asks ToolDurabilitySystem: "Degrade Pickaxe by 1"
11. TaskSystem        → If progress complete, asks LootSystem for rewards
12. LootSystem        → Asks InventoryManager: "Add 1 Stone"
13. EventBus          → Publishes "task_tick_completed" event
14. SkillSystem       → Awards Industry XP to hero
```

### Example 2: Combat Round

```
1. GameLoop           → "Tick!"
2. CombatSystem       → Both Hero and Enemy complete their tick cycles
3. CombatSystem       → Hero attacks:
   a. CombatFormulas.rollHit(60, 30) → true (hit chance: 50 + (60-30)*2 = 110%, capped at 95%)
   b. CombatFormulas.computeDamage(hero, enemy, weapon) → 15 (base + weapon + perks)
   c. CombatSystem    → Apply 15 damage to Enemy HP
4. CombatSystem       → Enemy attacks:
   a. CombatFormulas.rollHit(30, 45) → false (hit chance: 50 + (30-45)*2 = 20%)
   b. (miss - no damage)
5. ConsumableSystem   → Check if Hero HP < 20%
   a. If true         → Consume Food, set "consuming" flag (skip next attack)
6. CombatSystem       → Check victory/defeat conditions
   a. Enemy HP = 0    → LootSystem generates drops
   b. Hero HP = 0     → WoundedSystem applies wounded state
7. EventBus           → Publishes "combat_round_completed"
8. SkillSystem        → Awards Melee XP (attack) and Defence XP (block)
```

### Example 3: Invasion Escalation

```
1. TimeManager        → Game time advances (only while unpaused)
2. InvasionManager    → Updates threat meter for each active Invasion
3. InvasionManager    → Threat reaches 25% milestone
4. ThreatSystem       → Activates "Industrial Decay" debuff (1 stack)
5. ModifierAggregator → Recalculates all tick time modifiers (now +10% for Industry)
6. EventBus           → Publishes "invasion_escalated"
7. InvasionManager    → All heroes in Invasion continue combat against horde
8. CombatSystem       → Processes each hero vs current enemy
9. InvasionManager    → Enemy defeated, decrement remaining count
10. InvasionManager   → If all enemies defeated, clear debuffs, grant rewards
```

### Example 4: Perk Selection

```
1. SkillSystem        → Hero total levels reach 110 (11 skills)
2. SkillSystem        → Hero Level = 110 / 11 = 10
3. PerkSystem         → Detects milestone reached (level 10)
4. PerkSystem         → Looks up Class perks: "Fighter_L10_HeavyLifter"
5. PerkSystem         → Looks up Trait perks: "Strong_L10_Laborer"
6. EventBus           → Publishes "perk_choice_available"
7. UI                 → Shows popup with both options
8. PerkSystem         → Player selects "HeavyLifter"
9. PerkSystem         → Records choice: hero.perks[10] = "class"
10. ModifierAggregator→ Recalculates hero's Industry energy cost modifier
```

### Example 5: Card Upgrading

```
1. Player             → Selects 5 Uncommon Task Cards
2. CardUpgradeSystem  → Validates: all same rarity, not Legendary, not Unique
3. CardUpgradeSystem  → Extracts traits from each card (Biome + Modifier)
4. CardUpgradeSystem  → Uses weighted RNG to select new Biome/Modifier
5. CardUpgradeSystem  → Creates new Rare card with inherited traits
6. CardManager        → Removes 5 consumed cards
7. CardManager        → Adds new Rare card (checks limit)
8. EventBus           → Publishes "card_upgraded"
```

### Example 6: Recipe Selection

```
1. Player             → Opens Recipe dropdown on Kitchen card
2. RecipeSystem       → Gets hero assigned to card (heroId)
3. RecipeSystem       → For each recipe in card.availableRecipes:
   a. SkillSystem.meetsRequirement(heroId, { skill: "culinary", level: recipe.skillRequirement })
   b. Filters to recipes where hero meets skill requirement
4. UI                 → Displays filtered recipe list in dropdown
5. Player             → Selects "Stew" recipe
6. RecipeSystem       → Updates card.recipeState.selectedRecipeId = "stew"
7. RecipeSystem       → Reads RecipeRegistry for "stew" inputs/outputs
8. RecipeSystem       → Updates card.recipeState.dynamicInputs = [{itemId: "meat", qty: 1}, {itemId: "potato", qty: 2}]
9. RecipeSystem       → Updates card.recipeState.dynamicOutput = {itemId: "stew", qty: 1}
10. RecipeSystem      → Resets card.progress.current = 0 (recipe changed)
11. ViewManager       → Re-renders card with new input/output slots
```

### Example 7: Hero Recruitment

```
1. Player             → Drags any hero to Recruit Card (triggers recruitment)
2. RecruitSystem      → Card does not have candidates yet, generates them:
   a. HeroGenerator   → Generates 3 random heroes (name, class, trait)
   b. RecruitSystem   → For each candidate, reveals ONLY Class OR Trait (50/50)
   c. RecruitSystem   → Stores in card.candidates = [{name, classId, traitId, revealed: "class"}, ...]
3. UI                 → Shows 3 hero options with partial info
4. Player             → Clicks to select Candidate 2
5. RecruitSystem      → Calls HeroGenerator.finalize(candidate2) → full hero object
6. HeroManager        → Adds new hero to heroes[] with starting skills/equipment
7. CardManager        → Discards the Recruit card
8. EventBus           → Publishes "hero_recruited"
9. NotificationSystem → Shows "Sophie the Fighter has joined your guild!"
```

---

## 5. Directory Structure

```
/js
  /config              ← The Rulebook (Static Definitions)
    /registries
      cardRegistry.js
      itemRegistry.js
      skillRegistry.js
      rarityRegistry.js
      recipeRegistry.js
      dropTableRegistry.js
      classRegistry.js
      traitRegistry.js
      perkRegistry.js
      biomeRegistry.js
      modifierRegistry.js
      enemyRegistry.js
      projectRegistry.js
      threatRegistry.js
      invasionRegistry.js
      nameRegistry.js

  /state               ← The Scoreboard (Mutable Game Data)
    GameState.js       ← Root state object and accessors
    StateSchema.js     ← Validation schema for save data

  /systems             ← The Robot (Game Logic)
    /core
      GameLoop.js
      TimeManager.js
      SaveManager.js
      EventBus.js

    /hero
      HeroManager.js
      HeroGenerator.js
      SkillSystem.js
      PerkSystem.js
      RegenSystem.js
      ConsumableSystem.js

    /cards
      CardManager.js
      CardUpgradeSystem.js
      TaskSystem.js
      RecipeSystem.js
      ExploreSystem.js
      RecruitSystem.js
      ProjectSystem.js

    /combat
      CombatSystem.js
      InvasionManager.js
      WoundedSystem.js

    /economy
      InventoryManager.js
      InventoryGroupManager.js
      EquipmentManager.js
      ToolDurabilitySystem.js
      EquipmentDurabilitySystem.js
      LootSystem.js

    /global
      ModifierAggregator.js
      ThreatSystem.js
      UnlockSystem.js
      SettingsManager.js
      NotificationSystem.js

  /ui                  ← The Visuals (What You See)
    ViewManager.js
    DragDropHandler.js
    /components        ← Reusable UI parts
      CardComponent.js
      HeroCardComponent.js
      InventoryGroupComponent.js
      InventoryItemComponent.js
      ProgressBarComponent.js
      DropdownComponent.js
      ButtonComponent.js
      ToastNotificationComponent.js
      ModalComponent.js
    /renderers         ← Card type-specific renderers
      TaskCardRenderer.js
      RecipeCardRenderer.js
      CombatCardRenderer.js
      ExploreCardRenderer.js
      RecruitCardRenderer.js
      InvasionCardRenderer.js
      AreaCardRenderer.js
    /modals            ← Modal content templates
      HeroDetailsModal.js
      ProjectSelectionModal.js
      DropTableModal.js
      SettingsModal.js
      PerkChoiceModal.js
    /panels
      LeftPanel.js     ← Hero Roster
      CenterPanel.js   ← Card Stack
      RightPanel.js    ← Inventory
      TopBar.js        ← Global Controls

  /utils               ← Helper Functions
    CombatFormulas.js  ← Hit chance, damage calculations
    RNG.js             ← Seeded random number generation
    XPCurve.js         ← Exponential XP calculations
    Formatters.js      ← Number/time formatting
    AssetManager.js    ← Icon/image path resolution

  /assets              ← Static Resources
    /icons             ← Item, skill, and UI icons
    /images            ← Backgrounds, card art
    /audio             ← Sound effects and music (if added)

  /styles              ← CSS Styling
    main.css           ← Root styles and CSS variables
    components.css     ← UI component styles
    cards.css          ← Card-specific styles
    panels.css         ← Panel layout styles

  main.js              ← The Start Button
```

---

## 6. Extension Points

The architecture is designed for easy content additions:

| To Add... | Just Update... |
| :--- | :--- |
| New Item | `itemRegistry.js` |
| New Task | `cardRegistry.js` |
| New Recipe | `recipeRegistry.js` |
| New Drop Table | `dropTableRegistry.js` |
| New Biome | `biomeRegistry.js` |
| New Modifier | `modifierRegistry.js` |
| New Enemy | `enemyRegistry.js` |
| New Project | `projectRegistry.js` |
| New Perk | `perkRegistry.js` |
| New Debuff | `threatRegistry.js` |
| New Invasion Template | `invasionRegistry.js` |
| New Class | `classRegistry.js` + Add perks to `perkRegistry.js` |
| New Trait | `traitRegistry.js` + Add perks to `perkRegistry.js` |
| New Hero Names | `nameRegistry.js` |
| New Skill | `skillRegistry.js` + Update Class/Trait registries |

**No core system changes required** for adding new content—just registry updates.

---

## 7. Key Design Decisions

### Separation of Concerns
- **Registries**: Pure data, no logic
- **State**: Current values only, no behavior
- **Systems**: All logic, no persistent state

### Single Source of Truth
- All modifiers aggregate through `ModifierAggregator`
- All events flow through `EventBus`
- All state changes go through appropriate Manager

### Performance Considerations
- `ModifierAggregator` caches computed values
- Recalculation triggered only when sources change (project complete, invasion milestone)
- Tick frequency configurable (default 100ms)

### Save Data Stability
- `StateSchema.js` validates save data structure
- Version field enables migration for future updates
- Minimal save size—registries are not saved (they're code)

### Error Handling

#### Validation Layer
Validation happens at **two levels**:
1. **UI Layer**: Prevents invalid actions before calling systems (e.g., can't drag hero to full slot)
2. **System Layer**: Validates again before mutating state (defensive programming)

```javascript
// UI checks first (fast feedback)
if (card.heroSlotId !== null) {
  NotificationSystem.show("Slot already occupied", "warning");
  return;
}

// System validates defensively (safety net)
CardManager.assignHero(cardId, heroId)  // Validates internally before mutating
```

#### Return Patterns

**Pattern 1: Return `null` for lookups (not found)**
```javascript
HeroManager.getHero(heroId)       // → Hero | null
CardManager.getCard(cardId)       // → Card | null
InventoryManager.getItem(itemId)  // → { quantity, durabilities } | null
```

**Pattern 2: Return `Result` object for operations**
```javascript
// All mutating operations return a Result object
type Result = { success: true } | { success: false, error: ErrorCode }

EquipmentManager.equip(heroId, itemId, slot)
// → { success: true }
// → { success: false, error: "ITEM_NOT_FOUND" }
// → { success: false, error: "HERO_NOT_FOUND" }
// → { success: false, error: "SLOT_TYPE_MISMATCH" }
// → { success: false, error: "HERO_IN_COMBAT" }

CardManager.assignHero(cardId, heroId)
// → { success: true }
// → { success: false, error: "CARD_NOT_FOUND" }
// → { success: false, error: "HERO_NOT_FOUND" }
// → { success: false, error: "SLOT_OCCUPIED" }
// → { success: false, error: "HERO_BUSY" }
// → { success: false, error: "SKILL_REQUIREMENT_NOT_MET" }
```

**Pattern 3: Never throw in game logic**
```javascript
// BAD: Throwing breaks game flow
if (!hero) throw new Error("Hero not found");

// GOOD: Return error, let caller handle
if (!hero) return { success: false, error: "HERO_NOT_FOUND" };
```

#### Error Codes

Standardized error codes for all systems:

| Category | Error Code | Meaning |
| :--- | :--- | :--- |
| **Not Found** | `HERO_NOT_FOUND` | Hero ID doesn't exist |
| | `CARD_NOT_FOUND` | Card ID doesn't exist |
| | `ITEM_NOT_FOUND` | Item ID doesn't exist in inventory |
| | `RECIPE_NOT_FOUND` | Recipe ID not in registry |
| **State Conflict** | `HERO_BUSY` | Hero already assigned to another card |
| | `HERO_WOUNDED` | Hero is wounded and can't act |
| | `HERO_IN_COMBAT` | Hero is in combat, can't be reassigned |
| | `SLOT_OCCUPIED` | Card slot already has an item/hero |
| | `INVENTORY_FULL` | No space for new items |
| **Validation** | `SKILL_REQUIREMENT_NOT_MET` | Hero lacks required skill level |
| | `SLOT_TYPE_MISMATCH` | Item type doesn't match slot (e.g., food in weapon slot) |
| | `INSUFFICIENT_ITEMS` | Not enough input items for recipe/task |
| | `INSUFFICIENT_ENERGY` | Hero has no energy (auto-consume should handle) |
| **Limits** | `CARD_LIMIT_REACHED` | Max active cards reached |
| | `HERO_LIMIT_REACHED` | Max heroes reached (if implemented) |

#### Error Recovery

| Scenario | Recovery Strategy |
| :--- | :--- |
| Missing hero in card slot | Clear the slot, log warning, continue |
| Invalid item reference | Skip item, notify player, continue |
| Corrupted save data | Attempt partial load, fallback to new game |
| Registry reference missing | Use fallback/default, log error |
| NaN in calculation | Clamp to 0, log warning |

```javascript
// Example: Safe hero lookup with fallback
function getHeroSafe(heroId) {
  const hero = HeroManager.getHero(heroId);
  if (!hero) {
    console.warn(`Hero ${heroId} not found, returning null`);
    return null;
  }
  return hero;
}

// Example: Safe number calculation
function safeAdd(a, b) {
  const result = a + b;
  if (isNaN(result)) {
    console.warn(`NaN detected in calculation: ${a} + ${b}`);
    return 0;
  }
  return result;
}
```

#### User Feedback

Errors reach the player via `NotificationSystem`:

```javascript
// Error code to user message mapping
const ERROR_MESSAGES = {
  HERO_NOT_FOUND: "Hero no longer exists",
  HERO_BUSY: "Hero is already assigned to another task",
  HERO_WOUNDED: "Hero is wounded and cannot work",
  SLOT_OCCUPIED: "This slot is already in use",
  SKILL_REQUIREMENT_NOT_MET: "Hero doesn't meet the skill requirement",
  INSUFFICIENT_ITEMS: "Not enough materials",
  INVENTORY_FULL: "Inventory is full! Some items were lost.",
  CARD_LIMIT_REACHED: "Maximum cards reached. Discard some first."
};

// Usage
const result = EquipmentManager.equip(heroId, itemId, slot);
if (!result.success) {
  NotificationSystem.show(ERROR_MESSAGES[result.error], "error");
}
```

#### Logging Strategy

```javascript
// Log levels
console.info("Game started");           // Normal operations
console.warn("Hero slot was invalid");  // Recoverable issues
console.error("Save data corrupted");   // Critical issues

// In production, errors can be collected for debugging
// but should not interrupt gameplay
```

### Testing Strategy

#### Test Categories

| Category | What to Test | Tools |
| :--- | :--- | :--- |
| **Unit Tests** | Individual functions in isolation | Jest or Vitest |
| **Integration Tests** | System interactions | Jest + mock state |
| **Tick Simulation Tests** | Time-based behavior | Custom time mock |
| **Save/Load Tests** | Data persistence and migration | Jest + localStorage mock |
| **UI Tests** | Component rendering and interactions | Manual or Playwright |

#### Unit Test Targets

**Formulas & Utilities (High Priority)**
```javascript
// CombatFormulas.test.js
test('rollHit returns true when attacker skill much higher', () => {
  // Mock random to always return 0.5
  expect(CombatFormulas.rollHit(80, 20)).toBe(true);  // 110% hit chance
});

test('rollHit caps at 95%', () => {
  expect(CombatFormulas.calculateHitChance(100, 0)).toBe(95);
});

// XPCurve.test.js
test('xpForLevel calculates correctly', () => {
  expect(XPCurve.xpForLevel(1)).toBe(83);
  expect(XPCurve.xpForLevel(10)).toBe(569);
});
```

**Registry Validation**
```javascript
// registryValidation.test.js
test('all items have required fields', () => {
  Object.values(ITEMS).forEach(item => {
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.type).toBeDefined();
  });
});

test('all perk IDs follow naming convention', () => {
  Object.values(PERKS).forEach(perk => {
    expect(perk.id).toMatch(/^(class|trait)_\w+_\d+_\w+$/);
  });
});
```

**State Mutations**
```javascript
// HeroManager.test.js
test('addHero creates hero with correct starting skills', () => {
  const hero = HeroManager.createHero('Fighter', 'Strong');
  expect(hero.skills.melee.level).toBe(20);  // +10 class +10 trait
  expect(hero.skills.defence.level).toBe(10); // +10 class only
});
```

#### Integration Test Targets

**System Flows**
```javascript
// equipmentFlow.test.js
test('equipping item removes from inventory and adds to hero', () => {
  // Setup
  const state = createMockState();
  state.inventory.items['iron_sword'] = { quantity: 1, durabilities: [100] };
  
  // Act
  const result = EquipmentManager.equip(hero.id, 'iron_sword', 'weapon');
  
  // Assert
  expect(result.success).toBe(true);
  expect(state.inventory.items['iron_sword']).toBeUndefined();
  expect(state.heroes[0].equipment.weapon.itemId).toBe('iron_sword');
});
```

#### Time Simulation

For tick-based testing, use a time controller:

```javascript
// timeController.js (test utility)
export const TimeController = {
  currentTime: 0,
  
  advance(ms) {
    this.currentTime += ms;
    return this.currentTime;
  },
  
  reset() {
    this.currentTime = 0;
  }
};

// Mock Date.now() in tests
jest.spyOn(Date, 'now').mockImplementation(() => TimeController.currentTime);

// Usage in tests
test('hero regenerates HP over time', () => {
  const hero = createMockHero({ hp: { current: 50, max: 100 } });
  
  // Simulate 5 seconds (HP regen rate)
  TimeController.advance(5000);
  GameLoop.tick();
  
  expect(hero.hp.current).toBe(51);  // +1 HP
});
```

#### Test Utilities

```javascript
// testUtils.js
export function createMockState() {
  return structuredClone(INITIAL_STATE);
}

export function createMockHero(overrides = {}) {
  return {
    id: `hero_${nanoid()}`,
    name: 'Test Hero',
    classId: 'fighter',
    traitId: 'strong',
    hp: { current: 100, max: 100 },
    energy: { current: 50, max: 50 },
    status: 'idle',
    skills: { /* default skills */ },
    equipment: { weapon: null, armor: null, food: null, drink: null },
    ...overrides
  };
}

export function createMockCard(type, overrides = {}) {
  return {
    id: `card_${nanoid()}`,
    cardType: type,
    templateId: `test_${type}`,
    heroSlotId: null,
    progress: { current: 0, required: 100 },
    ...overrides
  };
}
```

#### QA Checklist (Manual Testing)

**New Game Flow**
- [ ] Game starts with correct initial state
- [ ] Starting cards appear (Recruit, Explore, Well)
- [ ] Can recruit first hero from Recruit card
- [ ] Hero appears in left panel

**Task Flow**
- [ ] Can drag hero to task card
- [ ] Progress bar advances
- [ ] Energy depletes
- [ ] Output items appear in inventory
- [ ] Can unassign hero

**Combat Flow**
- [ ] Can drag hero to combat card
- [ ] HP bars update correctly
- [ ] Victory grants loot
- [ ] Defeat applies wounded state
- [ ] Wounded timer counts down

**Inventory Flow**
- [ ] Items stack correctly
- [ ] Can create/rename/delete groups
- [ ] Can drag items between groups
- [ ] Inventory full notification appears

**Save/Load Flow**
- [ ] Auto-save triggers (check localStorage)
- [ ] Manual save works
- [ ] Refresh page preserves state
- [ ] Clear save starts new game

---

### Save/Load System

#### Storage Mechanism

**Primary Storage:** `localStorage` with key `fantasy_guild_save`

```javascript
// SaveManager.js
const SAVE_KEY = 'fantasy_guild_save';
const AUTO_SAVE_INTERVAL = 30000;  // 30 seconds

export const SaveManager = {
  save() {
    const saveData = {
      version: GAME_VERSION,
      savedAt: Date.now(),
      state: GameState.serialize()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    EventBus.publish('game_saved');
  },
  
  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    
    try {
      const saveData = JSON.parse(raw);
      return this.migrate(saveData);
    } catch (e) {
      console.error('Save data corrupted:', e);
      return null;
    }
  },
  
  clear() {
    localStorage.removeItem(SAVE_KEY);
  },
  
  exists() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
};
```

#### Serialization

Only `GameState` is saved. Registries are code, not save data.

```javascript
// What IS saved:
{
  version: "1.0.0",
  savedAt: 1701936000000,
  state: {
    meta, settings, heroes, cards, inventory, 
    currency, progress, threats, time
  }
}

// What is NOT saved:
// - Registries (they're static code)
// - modifiers cache (recalculated on load)
// - UI state (ViewManager handles this)
```

#### Schema Validation

Before loading, validate save data structure:

```javascript
// StateSchema.js
export function validateSaveData(data) {
  const errors = [];
  
  // Version check
  if (!data.version) errors.push('Missing version');
  
  // Required sections
  const required = ['meta', 'heroes', 'cards', 'inventory', 'progress', 'time'];
  required.forEach(key => {
    if (!data.state[key]) errors.push(`Missing state.${key}`);
  });
  
  // Hero validation
  data.state.heroes?.forEach((hero, i) => {
    if (!hero.id) errors.push(`Hero ${i} missing id`);
    if (!hero.classId) errors.push(`Hero ${i} missing classId`);
  });
  
  // Card validation
  data.state.cards?.active?.forEach((card, i) => {
    if (!card.id) errors.push(`Card ${i} missing id`);
    if (!card.cardType) errors.push(`Card ${i} missing cardType`);
  });
  
  return { valid: errors.length === 0, errors };
}
```

#### Version Migration

When game version changes, migrate old saves:

```javascript
// migrations.js
const MIGRATIONS = {
  '1.0.0_to_1.1.0': (state) => {
    // Example: Add new 'currency' field if missing
    if (!state.currency) {
      state.currency = { gold: 0 };
    }
    return state;
  },
  
  '1.1.0_to_1.2.0': (state) => {
    // Example: Rename field
    state.heroes.forEach(hero => {
      if (hero.hp_current !== undefined) {
        hero.hp = { current: hero.hp_current, max: hero.hp_max };
        delete hero.hp_current;
        delete hero.hp_max;
      }
    });
    return state;
  }
};

export function migrate(saveData) {
  let currentVersion = saveData.version;
  
  while (currentVersion !== GAME_VERSION) {
    const migrationKey = `${currentVersion}_to_${getNextVersion(currentVersion)}`;
    const migration = MIGRATIONS[migrationKey];
    
    if (!migration) {
      console.warn(`No migration for ${migrationKey}, skipping`);
      break;
    }
    
    saveData.state = migration(saveData.state);
    currentVersion = getNextVersion(currentVersion);
  }
  
  saveData.version = GAME_VERSION;
  return saveData;
}
```

#### Corruption Recovery

```javascript
// Fallback strategies
function loadGame() {
  const saveData = SaveManager.load();
  
  if (!saveData) {
    // No save exists, start new game
    return INITIAL_STATE;
  }
  
  const validation = validateSaveData(saveData);
  
  if (!validation.valid) {
    console.error('Save validation failed:', validation.errors);
    
    // Attempt partial recovery
    const recovered = attemptPartialRecovery(saveData);
    if (recovered) {
      NotificationSystem.show('Save data was partially corrupted. Some progress may be lost.', 'warning');
      return recovered;
    }
    
    // Complete failure, offer new game
    if (confirm('Save data is corrupted. Start a new game?')) {
      SaveManager.clear();
      return INITIAL_STATE;
    }
  }
  
  return saveData.state;
}

function attemptPartialRecovery(saveData) {
  try {
    // Keep valid parts, reset invalid parts to defaults
    const state = { ...INITIAL_STATE };
    
    if (saveData.state?.heroes) state.heroes = saveData.state.heroes;
    if (saveData.state?.inventory) state.inventory = saveData.state.inventory;
    if (saveData.state?.progress) state.progress = saveData.state.progress;
    
    // Validate recovered state
    if (validateSaveData({ version: GAME_VERSION, state }).valid) {
      return state;
    }
  } catch (e) {
    console.error('Partial recovery failed:', e);
  }
  return null;
}
```

#### Auto-Save Behavior

```javascript
// Auto-save triggers
GameLoop.onTick(() => {
  const now = Date.now();
  const lastSave = GameState.meta.lastSavedAt || 0;
  const interval = GameState.settings.gameplay.autoSaveInterval * 1000;
  
  if (now - lastSave >= interval) {
    SaveManager.save();
  }
});

// Save on significant events
EventBus.subscribe('hero_leveled', () => SaveManager.save());
EventBus.subscribe('project_completed', () => SaveManager.save());
EventBus.subscribe('hero_recruited', () => SaveManager.save());

// Save before unload
window.addEventListener('beforeunload', () => {
  SaveManager.save();
});
```

#### Multiple Save Slots

Support for multiple save files with slot-based management:

```javascript
// SaveManager.js (extended)
const SAVE_PREFIX = 'fantasy_guild_slot_';
const SLOT_COUNT = 3;  // 3 save slots

export const SaveManager = {
  currentSlot: 0,
  
  // Get save key for a slot
  getSlotKey(slot) {
    return `${SAVE_PREFIX}${slot}`;
  },
  
  // Save to current slot
  save() {
    const saveData = {
      version: GAME_VERSION,
      savedAt: Date.now(),
      slotName: this.getSlotName(this.currentSlot),
      playTime: GameState.meta.totalPlaytime,
      state: GameState.serialize()
    };
    localStorage.setItem(this.getSlotKey(this.currentSlot), JSON.stringify(saveData));
    EventBus.publish('game_saved', { slot: this.currentSlot });
  },
  
  // Load from specific slot
  loadSlot(slot) {
    const raw = localStorage.getItem(this.getSlotKey(slot));
    if (!raw) return null;
    
    try {
      const saveData = JSON.parse(raw);
      this.currentSlot = slot;
      return this.migrate(saveData);
    } catch (e) {
      console.error(`Slot ${slot} corrupted:`, e);
      return null;
    }
  },
  
  // Get slot info for UI (without loading full state)
  getSlotInfo(slot) {
    const raw = localStorage.getItem(this.getSlotKey(slot));
    if (!raw) return { empty: true, slot };
    
    try {
      const data = JSON.parse(raw);
      return {
        empty: false,
        slot,
        slotName: data.slotName || `Slot ${slot + 1}`,
        savedAt: data.savedAt,
        playTime: data.playTime,
        version: data.version,
        heroCount: data.state?.heroes?.length || 0
      };
    } catch (e) {
      return { empty: true, slot, corrupted: true };
    }
  },
  
  // Get all slot infos for slot selection UI
  getAllSlotInfos() {
    return Array.from({ length: SLOT_COUNT }, (_, i) => this.getSlotInfo(i));
  },
  
  // Delete a slot
  deleteSlot(slot) {
    localStorage.removeItem(this.getSlotKey(slot));
  },
  
  // Rename a slot
  renameSlot(slot, newName) {
    const raw = localStorage.getItem(this.getSlotKey(slot));
    if (raw) {
      const data = JSON.parse(raw);
      data.slotName = newName;
      localStorage.setItem(this.getSlotKey(slot), JSON.stringify(data));
    }
  },
  
  getSlotName(slot) {
    return GameState.meta?.saveName || `Slot ${slot + 1}`;
  }
};
```

**Slot Selection UI Flow:**
```
1. Game Start → Show Slot Selection Modal
2. Display 3 slots with:
   - Slot name (editable)
   - Last saved time
   - Total playtime
   - Hero count
   - Empty/New Game option
3. Player selects slot → Load or start new game
```

#### Export/Import

Allow players to backup saves and transfer between devices:

```javascript
// SaveManager.js (extended)
export const SaveManager = {
  // ... existing methods ...
  
  // Export current save as downloadable JSON
  exportSave() {
    const saveData = {
      version: GAME_VERSION,
      exportedAt: Date.now(),
      slot: this.currentSlot,
      state: GameState.serialize()
    };
    
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fantasy_guild_save_${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    NotificationSystem.show('Save exported successfully!', 'success');
  },
  
  // Import save from file
  async importSave(file) {
    try {
      const text = await file.text();
      const saveData = JSON.parse(text);
      
      // Validate import
      const validation = validateSaveData(saveData);
      if (!validation.valid) {
        NotificationSystem.show('Invalid save file: ' + validation.errors[0], 'error');
        return { success: false, error: 'INVALID_FORMAT' };
      }
      
      // Migrate if needed
      const migrated = this.migrate(saveData);
      
      // Confirm overwrite if slot has data
      const existingSave = this.getSlotInfo(this.currentSlot);
      if (!existingSave.empty) {
        const confirmed = confirm('This will overwrite your current save. Continue?');
        if (!confirmed) return { success: false, error: 'CANCELLED' };
      }
      
      // Apply imported save
      localStorage.setItem(this.getSlotKey(this.currentSlot), JSON.stringify(migrated));
      
      NotificationSystem.show('Save imported! Reloading...', 'success');
      setTimeout(() => location.reload(), 1000);
      
      return { success: true };
    } catch (e) {
      console.error('Import failed:', e);
      NotificationSystem.show('Failed to import save file', 'error');
      return { success: false, error: 'PARSE_ERROR' };
    }
  }
};

// UI: File input for import
function setupImportButton() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) await SaveManager.importSave(file);
  };
  
  document.getElementById('import-btn').onclick = () => input.click();
}
```

#### Offline Progress

Calculate and award progress for time spent away (common in idle games):

```javascript
// OfflineProgressSystem.js
export const OfflineProgressSystem = {
  
  // Maximum offline time to calculate (e.g., 24 hours)
  MAX_OFFLINE_MS: 24 * 60 * 60 * 1000,
  
  // Minimum offline time before showing popup (e.g., 1 minute)
  MIN_OFFLINE_MS: 60 * 1000,
  
  // Calculate offline progress on game load
  calculate(lastSavedAt) {
    const now = Date.now();
    let offlineMs = now - lastSavedAt;
    
    // Clamp to max
    offlineMs = Math.min(offlineMs, this.MAX_OFFLINE_MS);
    
    // Skip if too short
    if (offlineMs < this.MIN_OFFLINE_MS) {
      return null;
    }
    
    const offlineSeconds = Math.floor(offlineMs / 1000);
    const offlineTicks = Math.floor(offlineSeconds / 0.1);  // 10 ticks per second
    
    // Calculate rewards (simplified - doesn't simulate full tick logic)
    return this.simulateOfflineProgress(offlineTicks);
  },
  
  simulateOfflineProgress(ticks) {
    const rewards = {
      offlineTime: ticks * 100,  // ms
      itemsGained: {},
      xpGained: {},
      energyRestored: 0,
      hpRestored: 0
    };
    
    // For each hero assigned to a task
    GameState.heroes.forEach(hero => {
      if (hero.status !== 'working' || !hero.assignedCardId) return;
      
      const card = CardManager.getCard(hero.assignedCardId);
      if (!card || card.cardType !== 'task') return;
      
      const template = CARDS[card.templateId];
      if (!template) return;
      
      // Calculate how many task completions during offline time
      const ticksPerCompletion = Math.ceil(template.baseTickTime / 100);
      const completions = Math.floor(ticks / ticksPerCompletion);
      
      // Award outputs (simplified - ignores inputs/energy)
      if (template.outputs && completions > 0) {
        template.outputs.forEach(output => {
          const qty = output.quantity * completions;
          rewards.itemsGained[output.itemId] = (rewards.itemsGained[output.itemId] || 0) + qty;
        });
      }
      
      // Award XP
      if (template.xpAwarded && template.skill) {
        const xp = template.xpAwarded * completions;
        rewards.xpGained[template.skill] = (rewards.xpGained[template.skill] || 0) + xp;
      }
    });
    
    // Heroes regenerate HP/Energy offline
    const regenCycles = Math.floor(ticks / 50);  // 1 regen per 50 ticks (5 seconds)
    rewards.hpRestored = regenCycles;
    rewards.energyRestored = regenCycles;
    
    return rewards;
  },
  
  // Apply calculated rewards to game state
  apply(rewards) {
    // Add items to inventory
    Object.entries(rewards.itemsGained).forEach(([itemId, qty]) => {
      InventoryManager.addItem(itemId, qty);
    });
    
    // Add XP to heroes (distributed)
    // Note: Simplified - real implementation would track per-hero
    Object.entries(rewards.xpGained).forEach(([skill, xp]) => {
      GameState.heroes.forEach(hero => {
        SkillSystem.addXP(hero.id, skill, Math.floor(xp / GameState.heroes.length));
      });
    });
    
    // Restore HP/Energy
    GameState.heroes.forEach(hero => {
      hero.hp.current = Math.min(hero.hp.current + rewards.hpRestored, hero.hp.max);
      hero.energy.current = Math.min(hero.energy.current + rewards.energyRestored, hero.energy.max);
    });
    
    return rewards;
  }
};

// On game load, show offline progress popup
function onGameLoad(saveData) {
  const rewards = OfflineProgressSystem.calculate(saveData.savedAt);
  
  if (rewards) {
    OfflineProgressSystem.apply(rewards);
    showOfflineProgressModal(rewards);
  }
}
```

**Offline Progress Modal:**
```
┌─────────────────────────────────────────────┐
│  Welcome Back!                        [X]   │
│─────────────────────────────────────────────│
│  You were away for 4 hours, 23 minutes      │
│                                             │
│  Your heroes have been working:             │
│                                             │
│  📦 Items Gained:                           │
│     • Wood ×45                              │
│     • Stone ×32                             │
│     • Iron Ore ×12                          │
│                                             │
│  ⭐ XP Gained:                              │
│     • Industry +450                         │
│     • Nature +280                           │
│                                             │
│  ❤️ HP Restored: +50 per hero               │
│  ⚡ Energy Restored: +50 per hero           │
│                                             │
│  [ Collect Rewards ]                        │
└─────────────────────────────────────────────┘
```

#### Version Helper

```javascript
// Helper for migration system
const VERSION_ORDER = ['1.0.0', '1.1.0', '1.2.0', '1.3.0'];

function getNextVersion(currentVersion) {
  const index = VERSION_ORDER.indexOf(currentVersion);
  if (index === -1 || index === VERSION_ORDER.length - 1) {
    return null;
  }
  return VERSION_ORDER[index + 1];
}
```

---



## 8. UI Architecture

This section details how the visual layer is built and how it interacts with game systems.

### Layout Structure

The game uses a **3-column dashboard** with a **fixed top bar**:

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar (Save | Options | Pause) [fixed height: 56px]        │
├────────────┬─────────────────────────────┬───────────────────┤
│ LeftPanel  │      CenterPanel            │    RightPanel     │
│ (Heroes)   │      (Cards)                │    (Inventory)    │
│ [250px]    │      [flex: 1]              │    [300px]        │
│            │                             │                   │
│ Scrollable │      Scrollable             │    Scrollable     │
│ Hero Cards │      Tabs: Active/Completed │    Item Groups    │
│            │      Card Stack             │                   │
└────────────┴─────────────────────────────┴───────────────────┘
```

### CSS Methodology

**Naming Convention:** BEM (Block-Element-Modifier)
```css
/* Block */
.card { }

/* Element (part of a block) */
.card__header { }
.card__hero-slot { }
.card__progress-bar { }

/* Modifier (variation) */
.card--task { }
.card--combat { }
.card--rarity-rare { }
.card--selected { }
```

**CSS Variables (Design Tokens):** Defined in `main.css`
```css
:root {
  /* Colors - Base */
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-bg-card: #0f3460;
  --color-text-primary: #eaeaea;
  --color-text-secondary: #a0a0a0;
  
  /* Colors - Rarity */
  --color-rarity-common: #808080;
  --color-rarity-uncommon: #1eff00;
  --color-rarity-rare: #0070dd;
  --color-rarity-epic: #a335ee;
  --color-rarity-legendary: #ff8000;
  
  /* Colors - Status */
  --color-hp: #e74c3c;
  --color-energy: #3498db;
  --color-progress: #2ecc71;
  --color-warning: #f39c12;
  --color-danger: #c0392b;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 18px;
  
  /* Borders & Shadows */
  --border-radius: 8px;
  --shadow-card: 0 4px 6px rgba(0, 0, 0, 0.3);
  
  /* Animation */
  --transition-fast: 150ms ease;
  --transition-normal: 300ms ease;
}
```

### Component Architecture

**Component Pattern:** Each component is a JS file that:
1. Exports a `render(data)` function returning an HTML string
2. Exports a `bind(element)` function for event listeners
3. Uses BEM classes from the CSS

```javascript
// Example: CardComponent.js
export function render(card) {
  return `
    <div class="card card--${card.cardType} card--rarity-${card.rarity}" data-card-id="${card.id}">
      <div class="card__header">${card.name}</div>
      <div class="card__body">
        ${renderHeroSlot(card.heroSlotId)}
        ${renderProgressBar(card.progress)}
      </div>
    </div>
  `;
}

export function bind(element) {
  element.querySelector('.card__hero-slot').addEventListener('drop', onHeroDrop);
  element.querySelector('.card__discard').addEventListener('click', onDiscard);
}
```

### Component Inventory

| Component | Purpose | Used In |
| :--- | :--- | :--- |
| `CardComponent.js` | Base card rendering, delegates to type-specific renderers | CenterPanel |
| `TaskCardRenderer.js` | Task card body: hero slot, tool slot, inputs, outputs | CardComponent |
| `RecipeCardRenderer.js` | Recipe card: dropdown, dynamic inputs/outputs | CardComponent |
| `CombatCardRenderer.js` | Combat card: enemy sprite, HP bars, combat log | CardComponent |
| `ExploreCardRenderer.js` | Explore: progress, area selection options | CardComponent |
| `RecruitCardRenderer.js` | Recruit: 3 hero candidates with partial info | CardComponent |
| `InvasionCardRenderer.js` | Invasion: threat meter, multi-hero slots, enemy count | CardComponent |
| `AreaCardRenderer.js` | Area: project selection, progress | CardComponent |
| `HeroCardComponent.js` | Hero roster card: name, class, HP/energy bars, status | LeftPanel |
| `InventoryGroupComponent.js` | Collapsible item group with item list | RightPanel |
| `InventoryItemComponent.js` | Single item: icon, name, quantity, durability | InventoryGroup |
| `ProgressBarComponent.js` | Reusable progress bar with label | Multiple |
| `DropdownComponent.js` | Reusable dropdown (recipe selection) | RecipeCard |
| `ToastNotificationComponent.js` | Toast message with auto-dismiss | NotificationSystem |
| `ModalComponent.js` | Modal wrapper with backdrop, close button | Popups |
| `ButtonComponent.js` | Consistent button styles | Multiple |

### Drag & Drop System

Drag & drop is handled by `DragDropHandler.js`:

```javascript
// Drag sources and drop targets
const DRAG_TYPES = {
  HERO: 'hero',      // From LeftPanel to Card slots
  ITEM: 'item',      // From Inventory to Card slots or Hero equipment
  CARD: 'card'       // For card reordering (future)
};

// Drop zones with validation
const DROP_ZONES = {
  'card-hero-slot': { accepts: ['hero'], validate: canAssignHeroToCard },
  'card-tool-slot': { accepts: ['item'], validate: isToolType },
  'card-input-slot': { accepts: ['item'], validate: matchesInputRequirement },
  'hero-weapon-slot': { accepts: ['item'], validate: isWeaponType },
  'hero-armor-slot': { accepts: ['item'], validate: isArmorType },
  'hero-food-slot': { accepts: ['item'], validate: isFoodType },
  'hero-drink-slot': { accepts: ['item'], validate: isDrinkType },
  'inventory-group': { accepts: ['item'], validate: () => true }
};
```

**Visual Feedback:**
- Dragging: Element gets `.dragging` class (semi-transparent)
- Valid drop zone: `.drop-zone--valid` (green highlight)
- Invalid drop zone: `.drop-zone--invalid` (red highlight)
- On drop: Short animation confirming action

**Reassignment Behavior:**
- If a hero is already assigned to a card and dropped on a different card, the hero is automatically unassigned from the previous card and assigned to the new one
- This enables fluid reassignment without requiring manual unassignment first

### ViewManager Responsibilities

`ViewManager.js` is the central UI coordinator:

```javascript
// Public API
ViewManager.render()               // Full initial render
ViewManager.refreshPanel(panelId)  // Re-render entire panel
ViewManager.refreshCard(cardId)    // Re-render single card
ViewManager.refreshHero(heroId)    // Re-render hero card
ViewManager.refreshInventory()     // Re-render inventory
ViewManager.showModal(content)     // Display modal
ViewManager.hideModal()            // Close modal

// Event subscriptions (on init)
EventBus.subscribe('task_completed', ({ cardId }) => refreshCard(cardId))
EventBus.subscribe('hero_leveled', ({ heroId }) => refreshHero(heroId))
EventBus.subscribe('item_gained', () => refreshInventory())
EventBus.subscribe('card_spawned', () => refreshPanel('center'))
// ... etc
```

### Notification System UI

Toast notifications appear at bottom-center, stacking upward:

```javascript
// NotificationSystem handles grouping similar messages
// Example: 5 "+1 Wood" events in 1 second → single "+5 Wood" toast

// Toast types
TOAST_TYPES = {
  info: { icon: 'ℹ️', color: '--color-text-primary' },
  success: { icon: '✓', color: '--color-progress' },
  warning: { icon: '⚠', color: '--color-warning' },
  error: { icon: '✗', color: '--color-danger' },
  levelup: { icon: '⬆', color: '--color-rarity-epic' }
};

// Auto-dismiss timing
DEFAULT_DURATION = 3000;  // 3 seconds
LEVEL_UP_DURATION = 5000; // 5 seconds (more important)
```

### Modal System

Modals are used for:
- **Hero Details**: Full hero stats, equipment, perk history
- **Project Selection**: Choose from 3 project options
- **Drop Table Preview**: Click on output slot to see possible drops
- **Options Menu**: Game settings
- **Perk Selection**: Choose Class or Trait perk at level milestones

```javascript
// Modal content templates
ModalContent.heroDetails(heroId)       // Full hero view
ModalContent.projectSelection(areaId)  // 3 project options
ModalContent.dropTable(cardId)         // Loot table preview
ModalContent.settings()                // Game settings
ModalContent.perkChoice(heroId, level) // Perk selection popup
```

### Asset Management

**Icon References:**
```javascript
// Icons are referenced by ID, resolved to path at render time
import { getIconPath } from './utils/AssetManager.js';

getIconPath('item', 'iron_sword')   // → '/assets/icons/items/iron_sword.png'
getIconPath('skill', 'melee')       // → '/assets/icons/skills/melee.png'
getIconPath('class', 'fighter')     // → '/assets/icons/classes/fighter.png'
getIconPath('enemy', 'goblin_t1')   // → '/assets/icons/enemies/goblin_t1.png'

// Fallback handling
// If asset not found, returns placeholder icon
```

**Asset Directory Structure:**
```
/assets
  /icons
    /items         ← Item icons (iron_sword.png, wood.png)
    /skills        ← Skill icons (melee.png, crafting.png)
    /classes       ← Class icons (fighter.png, wizard.png)
    /traits        ← Trait icons (strong.png, nimble.png)
    /enemies       ← Enemy sprites (goblin_t1.png)
    /ui            ← UI icons (save.png, pause.png, arrow.png)
  /images
    /cards         ← Card backgrounds by rarity
    /biomes        ← Biome backgrounds for cards
    /backgrounds   ← Panel backgrounds
  /audio           ← (Future) Sound effects
```

### Responsive Behavior

**Minimum Supported Width:** 1024px (desktop-focused game)

**Panel Collapse (1024px - 1280px):**
- Left Panel collapses to icons only (hero icons, expand on hover)
- Right Panel collapses to compact view (item icons grid)

**No Mobile Support:** This is a complex management game designed for desktop.

### Performance Optimizations

1. **Selective Re-rendering:** Only affected components update, not entire panels
2. **Event Batching:** Multiple item gains within 100ms batch into single UI update
3. **Virtual Scrolling:** (Future) For very long card/hero lists
4. **CSS Containment:** Cards use `contain: layout style` for paint isolation

---
