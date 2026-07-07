# Crafting Cards & Blueprint System Architecture

This document serves as the technical reference for configuring, creating, and modifying **Crafting Task** cards and their associated **Blueprint** specializations within *Fantasy Guild Idle*.

---

## 1. Overview & Mechanics
Crafting Cards (e.g., Kitchen, Forge) use a decoupled **Generic Slots + Recipe Evaluator** architecture. 
Instead of spawning input slots explicitly tied to a single, static recipe (e.g., a "Flour" slot and a "Water" slot), the building renders **Generic Input Slots** that accept broad arrays of tags (e.g., `["food", "drink"]`).

Players freely drop tagged items into these generic slots. Every time an item, hero, or blueprint is moved, the backend **Recipe Evaluator** scans the specific items currently resting in the slots and attempts to lock in a matching **Recipe** to begin a workcycle.

### Recipe Priority
The Evaluator attempts to match recipes in this strict order:
1.  **Spec Recipe** (Highest): Found inside `blueprint.grantedRecipeTraits` if a Blueprint is slotted.
2.  **Native Recipe** (Lowest): Found inside `template.nativeRecipeTraits` on the building itself.

If the items in the generic slots perfectly fulfill all `itemId` requirements of a recipe in the pool, the building's output transforms to match that recipe. If no recipe is matched, the items rest safely in the generic slots and the building remains idle.

---

## 2. Core Components & Definitions

### A. The Schema (JSON Definitions)
When creating a new Crafting Card in the registry, you must define the generic slots independently from the native recipe requirements:

```json
{
    "config": {
        "skill": "culinary",        // The building's inherent skill 
        "acceptsBlueprints": true,  // Flags the engine to spawn a Blueprint drop slot
        "genericSlots": [           // Defines the UI drop zones
            { "acceptTags": ["food", "drink"] },
            { "acceptTags": ["food", "drink"] }
        ],
        "baseTickTime": 5000,
        "xp": 5
    },
    "nativeRecipeTraits": {         // The fallback core recipe
        "inputs": [
            { "itemId": "flour", "quantity": 1 },
            { "itemId": "drink_water", "quantity": 1 }
        ],
        "outputs": [
            { "itemId": "dough", "quantity": 1 }
        ]
    }
}
```

### B. The Recipe Evaluator ([CardManager.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js))
*   **[evaluateBuildingRecipe(cardId)](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#456-525)**: 
    *   Fires dynamically on drops and unassignments.
    *   Builds the Priority Pool and checks if `building.assignedItems` explicitly satisfies `req.itemId` for any recipe.
    *   Writes the matched recipe object directly to `building.activeRecipe`.
    *   Calls `CardAssembler.ensureModular()` to sync the outputs to the UI.
*   **[smartAssignEntity](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#710-802)**: 
    *   Controls physical droppability. Intercepts incoming drag-and-drops by checking if the dragged item's `.tags` array overlaps with the generic slot's `acceptTags` array. It does **not** evaluate recipes.

### C. Trait Generation ([CardAssembler.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardAssembler.js) & [card-presets.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/cards/card-presets.js))
*   **[card-presets.js](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/config/cards/card-presets.js) (CRAFTING_TASK)**: Loops over `config.genericSlots` and writes out `inputslot` traits containing the `acceptTags` array payload.
*   **`CardAssembler.ensureModular()`**: Syncs `card.outputs` to match `card.activeRecipe.outputs`. It specifically **skips** destructively wiping existing input slots if `config.genericSlots` is defined.
*   **Bug Warning**: Do not map `card.outputs` directly to `loot.outputs` during trait generation. Ensure it maps to `loot.items`. ([LootModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/LootModule.jsx) natively expects `trait.items`).

### D. The UI Layer ([InputSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/InputSlotModule.jsx) & [BlueprintSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/BlueprintSlotModule.jsx))
*   **[InputSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/InputSlotModule.jsx)**: Parses the `acceptTags` array to render generic placeholder text (e.g., dynamically rendering `"Food / Drink"`) when empty.
*   **[BlueprintSlotModule.jsx](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/ui/components/card-modules/BlueprintSlotModule.jsx)**: Replaces the generic "Slot Blueprint" text with `"Requires: [Skill] Spec"`, derived automatically from the host building's `config.skill` parameter.

---

## 3. Creating a Blueprint (Spec) Card
Blueprints act as the priority overrides. They require their own `grantedRecipeTraits` block which completely mirrors the structure of a `nativeRecipeTraits` block:

```json
{
    "id": "blueprint_pie_tin",
    "cardType": "blueprint",
    "requiredSkill": "culinary", // Must explicitly match building.skill
    "grantedRecipeTraits": {
        "inputs": [
            { "itemId": "dough", "quantity": 1 },
            { "itemId": "apple", "quantity": 1 }
        ],
        "outputs": [
            { "itemId": "apple_pie", "quantity": 1 }
        ],
        "xp": 15,
        "baseTickTime": 10000
    }
}
```

### Assignment Rules:
*   A Blueprint can only be slotted into a building if its `requiredSkill` explicitly matches the building's `config.skill`. 
*   If `requiredSkill: "smithing"`, it will bounce off a `"culinary"` kitchen, ensuring logical workflow constraints.
*   When dragged off the building, `CardManager.unassignBlueprint` calculates an empty grid slot (`CardManager.findFirstEmptyCell()`) and triggers [updateCardPosition()](file:///c:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/src/systems/cards/CardManager.js#1175-1195) to ensure the Blueprint snaps back into physical visibility immediately, bypassing refresh requirements.
