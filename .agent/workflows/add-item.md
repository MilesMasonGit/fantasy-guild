---
description: How to add new Task Cards, Combat Cards, and Items conversationally
---

# Add Item Workflow

This workflow guides the process of adding new items to the `itemRegistry.js`, ensuring they align with the modern naming conventions and the Discovery System v2.

## Step 1: Define the Item Schema
**Read the existing registry for examples:**
```
src/config/registries/itemRegistry.js
```

### Required Fields
- **id**: MUST follow `[Type]_[Material]` or `[Type]_[Subtype]` convention (e.g., `ore_iron`, `sword_mithril`).
- **name**: Display name (e.g., "Iron Ore").
- **type**: From `ITEM_TYPES` (material, tool, weapon, etc.).
- **tags**: Array of category tags (e.g., `['ore', 'metal']`).
- **description**: Internal lore/utility text.
- **icon**: Emoji fallback (must be present).
- **stackable**: Boolean (default `true`).

### Optional Fields (Type-Specific)
- **maxStack**: Number (default `999`).
- **equipSlot**: `weapon`, `armor`, `food`, `drink`.
- **restoreAmount**: For food/drink.
- **restoreType**: `hp` or `energy`.
- **damage/defense**: For equipment.
- **maxDurability**: For tools/weapons/armor.
- **skillBonus**: `{ skill, value }`.

## Step 2: Naming Convention Enforcement
**CRITICAL**: Every item ID must align with the folder structure in `public/assets/sprites/implemented/items/`.

| Item ID Prefix | Implementation Folder |
|----------------|-----------------------|
| `ore_`         | `mining/ore/`         |
| `ingot_`       | `mining/ingot/`       |
| `battleaxe_`   | `equipment/battleaxe/`|
| `longsword_`   | `equipment/longsword/`|
| `staff_`       | `equipment/staff/`    |
| `key_`         | `crime/key/`          |
| `drink_`       | `drink/`              |
| `wood_`        | `wood/`               |

*If the item doesn't fit these, it will use the **Discovery Probe** which is slightly slower.*

## Step 3: Implementation Steps

### 3a. Add to itemRegistry.js
Find the appropriate section (Resources, Unique, Drops) and insert the new object.

```javascript
export const ITEMS = {
    // ...
    [ID]: {
        id: '[ID]',
        name: '[NAME]',
        type: ITEM_TYPES.[TYPE],
        tags: ['[TAG1]', '[TAG2]'],
        description: '[DESCRIPTION]',
        stackable: true,
        icon: '[EMOJI]'
    },
    // ...
}
```

### 3b. Verify Sprite Availability
Check if a matching sprite exists in `public/assets/sprites/implemented/items/`.
If not, remind the user to generate art using the `@[/add-art]` workflow.

## Step 4: Verification
1. Open the game.
2. Grant yourself the item in `main.js` (temporary) or via an existing task.
3. Verify:
   - [ ] Icon displays (Sprite found or Emoji fallback).
   - [ ] Tooltip shows correct name/description.
   - [ ] Item can be stacked/assigned as expected.

## Example
**User**: "Add a mithril ingot."

**AI**:
1. ID: `ingot_mithril`
2. Type: `ITEM_TYPES.MATERIAL`
3. Path: `mining/ingot/ingot_mithril.png` (mapped automatically by AssetManager)
4. Adds to `itemRegistry.js`.
5. Verifies existing `ingot` sprites.
