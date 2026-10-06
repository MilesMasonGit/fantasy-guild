---
description: How to add new Cards (Task, Combat, Crafting, etc.) to the game using JSON format
---

# Add New Card Workflow

This workflow creates cards in the JSON format stored in `data/cards/{type}/{area}.json`.

## Step 1: Gather Card Information

Fill in the following template:

### Basic Info
- **Card ID**: `[unique_snake_case_id]` (e.g., `apple_orchard`)
- **Card Name**: `[Display name]` (e.g., "Apple Orchard")
- **Card Type**: `[task | combat | crafting | explore | invasion | treasure]`
- **Description**: `[Flavor text, 1-2 sentences]`

### Parent Info
- **Area ID**: `[area this card belongs to]` (e.g., `forest`, `guild_hall`, `mountain`)
- **Parent Quest ID**: `[quest that unlocks this card]` or `null` if starting card

### Configuration
- **Skill**: `[nature | industry | crafting | culinary | combat | occult]`
- **Duration (ms)**: `[e.g., 8000 for 8 seconds]`
- **XP Awarded**: `[e.g., 10]`

### Inputs (if any)
Format: `{ "itemId": "item_name", "quantity": 1 }` or `{ "acceptTag": "fuel", "slotLabel": "Any Fuel" }`

**Important: Infer inputs from card name/description!**
- **Kilns, Furnaces, Smelters** → require fuel (wood, coal, charcoal)
- **Crafting stations** (workbenches, forge) → require raw materials
- **Processing cards** (mill, kiln, charcoal making) → require input items to transform
- **Cooking cards** → require raw ingredients

- Input 1: `[fill or remove]`
- Input 2: `[fill or remove]`

### Outputs / Loot
Format: `{ "itemId": "item_name", "quantity": 1, "chance": 100 }`

- Output 1: `[fill]`
- Output 2: `[fill or remove]`

### Art
- **Icon Asset**: `[itemId for sprite]` (fallback to emoji if not found)
- **Icon Fallback**: `[emoji, e.g., 🍎]`
- **Background**: `[bg_areaname or bg_skill]` (e.g., `bg_forest`, `bg_culinary`)

---

## Step 2: Determine Preset

**Critical Rule: If the card has INPUTS, use CRAFTING_TASK, not BASIC_TASK!**

Based on card type, choose preset:

| Card Type | Preset | When to Use |
|-----------|--------|-------------|
| Task (no inputs) | `BASIC_TASK` | Pure gathering (foraging, fishing, mining ore) |
| Task (with inputs) | `CRAFTING_TASK` | Any transformation: smelting, cooking, charcoal making, crafting |
| Combat | `BASIC_COMBAT` | Fight single enemy, repeatable |
| Crafting | `RECIPE_SELECTOR` | Choose from multiple recipes |
| Explore | `EXPLORE` | Discover new areas |
| Invasion | `INVASION` | Combat with timer, removed when defeated |
| Treasure | `TREASURE` | One-time reward chest |

---

## Step 3: Generate JSON

// turbo
Create the JSON entry in the appropriate file: `data/cards/{type}/{area}.json`

Example for a task card:
```json
{
  "apple_orchard": {
    "id": "apple_orchard",
    "name": "Apple Orchard",
    "cardType": "task",
    "preset": "BASIC_TASK",
    "description": "Pick fresh apples from the orchard trees.",
    "areaId": "farmland",
    "parentQuest": "farmland_quest_1",
    "background": "bg_nature",
    "icon": "apple",
    "iconFallback": "🍎",
    "config": {
      "skill": "nature",
      "baseTickTime": 6000,
      "actionLabel": "Picking Apples...",
      "xp": 8,
      "outputs": [
        { "itemId": "apple", "quantity": 2, "chance": 100 }
      ]
    }
  }
}
```

---

## Step 4: Update Parent Quest

If this card is unlocked by a quest, update the quest definition to include this card in its rewards.

---

## Step 5: Verify

1. Restart the game (or refresh if dev server is running)
2. Check console for validation warnings
3. Trigger the unlock condition and verify card appears

---

## Common Questions for AI

When creating a new card, the AI should ask:

1. **What area does this card belong to?** (determines file location and background)
2. **What quest unlocks this card?** (or is it available from the start)
3. **Does this card require inputs?** (determines BASIC_TASK vs CRAFTING_TASK)
4. **What items does this card produce?** (outputs/loot)
5. **What skill is used?** (determines XP type and speed bonuses)
6. **What is the base duration?** (affects balance)

---

## File Locations by Type

| Card Type | File Location |
|-----------|---------------|
| Task | `data/cards/tasks/{area}.json` |
| Combat | `data/cards/combat/{area}.json` |
| Crafting | `data/cards/crafting/{area}.json` |
| Explore | `data/cards/explore/{area}.json` |
| Invasion | `data/cards/invasion/{area}.json` |
| Treasure | `data/cards/treasure/{area}.json` |
