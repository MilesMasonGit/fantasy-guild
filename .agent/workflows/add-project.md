---
description: How to add new Projects (Buildings/Rituals) to the game
---

# Add Project Workflow

Projects are large-scale construction or ritual efforts that take place in an Area *after* the questing phase is complete. They typically unlock passive bonuses or new capabilities.

## Step 1: Read the Schema Reference
**Always read this first:**
```
docs/CARD_SCHEMA.md
```


## Step 2: Code Quality Checklist
- [ ] **No `require`**: Use top-level static `import` only.
- [ ] **Constants**: Use `PROJECT_EFFECTS` (if available) or standard strings.

## Step 3: Define Project Properties
Extract from user request:
- **Name**: e.g., "Magma Forge"
- **Cost**: High-value resources required (e.g., 50 Stone, 10 Obsidian).
- **Effect**: What passive bonus does it give? (e.g., +10% Smithing XP, Double Ore output).
- **Biome**: Which biome is this for?

## Step 3: Make Changes

### 3a. Add Project Definition
File: `src/config/registries/projectRegistry.js`

Add to `PROJECTS` object:
```javascript
```javascript
// Copy this template:
PROJECT_ID: {
    id: 'PROJECT_ID',
    name: 'DISPLAY_NAME',
    description: 'DESCRIPTION',
    
    // Cost to build (Gradual Input)
    resourceCost: {
        ITEM_ID: QUANTITY, // e.g. 'stone': 50
    },

    // Effect types: 'xp_skill', 'speed_skill', 'output_double', 'passive_resource'
    effectType: 'EFFECT_TYPE', 
    effectConfig: {
        skills: ['SKILL_1'],  // e.g. ['industry']
        bonus: AMOUNT         // e.g. 0.15 for 15%
    },

    icon: 'ICON'
},
```

### 3b. Link to Biome
File: `src/config/registries/biomeRegistry.js`

Add the project ID to the target biome's `projectChain` array:
```javascript
volcano: {
    // ...
    projectChain: ['magma_forge'] // Add here
}
```

## Step 4: Report to User
Summarize:
- **Project Name & Cost**
- **Effect**
- **Location** (Biome linked)
