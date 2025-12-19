---
description: How to configure Explore Cards (Exploration Requirements) for finding Areas
---

# Add Explore Card Workflow

"Adding an Explore Card" technically means configuring the **Exploration Requirements** for a Biome. The game dynamically creates "Explore Cards" based on these configurations.

## Step 1: Understand Exploration Logic
- **Base Cost**: Resources consumed *gradually* while the Explore Card ticks (like fuel).
- **Specific Cost**: Resources *required* to start/complete the exploration (gates), often tools.
- **Explore Points**: How long/difficult the search is.


## Step 2: Code Quality Checklist
- [ ] **No `require`**: Use top-level static `import` only.
- [ ] **Constants**: Use standard biome IDs.

## Step 3: Define Exploration Requirements
Extract from user request:
- **Biome**: Which area is being discovered?
- **Difficulty**: Easy (Torches) vs Hard (Climbing Gear, Maps, Expensive Supplies).
- **Theme**: Dark? Needs lights. Cold? Needs warm clothes/wood.

## Step 3: Make Changes

### 3a. Configure Biome Exploration
File: `src/config/registries/biomeRegistry.js`

Update the `explorationCost` of the target biome:

```javascript
// Example: Exploring a Deep Cave
explorationCost: {
    // Consumed gradually over time (Fuel/Supplies)
    base: { 
        torch: 20,    // Darkness requires light
        rations: 10   // Long journey
    },
    
    // Gating requirements (Tools/Key Items - NOT consumed unless specified elsewhere)
    specific: { 
        climbing_gear: 1, // Need this in inventory to start
        map_fragment: 1 
    },

    // Optional: Override base exploration difficulty (default is usually calculated or static)
    // defined in ExploreSystem constants usually, but can be scaled here if supported
}
```

## Step 4: Report to User
Summarize the requirements to find the area:
- "To find [Biome], players will need [Tools] and will consume [Resources] over the course of the exploration."
