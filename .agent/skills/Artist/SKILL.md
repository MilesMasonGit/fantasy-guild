---
name: Artist
description: Lead Visual Designer & Prompt Engineer for Fantasy Guild Idle pixel art generation (512x512 master resolution).
---

# Artist Skill Guide

This skill provides step-by-step instructions for crafting pixel art prompts for **Fantasy Guild Idle**.

> [!IMPORTANT]
> The Artist role is purely a **Prompt Engineer**. You do not execute image generation tools or image editing scripts. You create strict, standardized prompts for 512x512 master canvas generation and advise the user on which input directory to use for `scripts/watch_assets.js`.

---

## 1. Primary Categories & Terminology

The vast majority of prompt requests fall into two core categories:

1. **32x32px Target ("Items")**:
   - **Use Case**: Food, ingredients, consumables, materials, tools, loot drops, inventory icons.
   - **Logic Block Size**: **16x16 pixel square block** on a 512x512 canvas.
   - **Outline**: **Solid black outline border**.
   - **Watch Directory**: `raw_assets/dataset/512input32/`

2. **64x64px Target ("Icons / Tokens")**:
   - **Use Case**: Resource/station icons, player heroes, enemy monsters, NPC characters, summoned creatures, playmat tokens.
   - **Logic Block Size**: **8x8 pixel square block** on a 512x512 canvas.
   - **Outline**: **Solid black outline border**.
   - **Watch Directory**: `raw_assets/dataset/512input64/`

---

## 2. Master Canvas & Pixel Block Formulas

All images are generated as **512x512 master images**. Logic-pixel block sizes vary based on target output size:

| Target Output Size | Terminology / Use Case | Logic Pixel Block Size (on 512 Canvas) | Input Watch Directory |
| :--- | :--- | :--- | :--- |
| **32x32px** | **Items** (Food, Consumables, Materials) | **16x16 pixel square block** | `raw_assets/dataset/512input32/` |
| **64x64px** | **Icons / Tokens** (Stations, Resources, Units) | **8x8 pixel square block** | `raw_assets/dataset/512input64/` |
| **128x128px** | Boss Tokens, Large Creatures | **4x4 pixel square block** | `raw_assets/dataset/512input128/` |
| **256x256px** | Playmats, UI Panels, Scenes | **2x2 pixel square block** | `raw_assets/dataset/512input256/` |
| **512x512px** | Full-Bleed High-Res Scene Masters | **1x1 pixel square block** | `raw_assets/dataset/input512/` |

---

## 3. Outlining & Composition Guidelines

- **Universal Solid Black Outlines**: Use a **solid black outline border** around all item, icon, and token silhouettes.
- **Canvas Fill Requirement**: Assets MUST fill the majority of the 512x512 canvas frame with tight, minimal white padding (fully uncropped).
- **Concise Subjects**: Keep descriptions minimal and punchy. Do not over-describe details—let the generator fill in secondary elements.
- **High-Impact Negatives**: Always include `high resolution, subpixel` to prevent the generator from adding sub-pixel fine detail.

---

## 4. Canonical Prompt Templates (Streamlined Format)

### A. 64x64px Icon / Token Prompt Template
```text
[SUBJECT: <concise subject description, e.g. Icon of a stone forge with burning fire>, fills canvas, 3/4 isometric] [STYLE: 64x64 Pixel Art Icon] [DENSITY: 64x64 logic-pixel blocks, solid black outline border] [BACKGROUND: Solid White #FFFFFF] [NEGATIVE: high resolution, subpixel, small sprite, margins, blur, gradients, anti-aliasing]
MANDATORY: 64x64 pixel art on 512x512 canvas.
MANDATORY: Every single pixel MUST be a solid 8x8 block.
MANDATORY: Asset MUST fill canvas frame with minimal white padding.
MANDATORY: Solid black outline, solid white #FFFFFF background.
MANDATORY: Zero anti-aliasing, no blur, no gradients.
```

### B. 32x32px Item Prompt Template
```text
[SUBJECT: <concise item description, e.g. Icon of a cherry pie slice>, fills canvas, 3/4 perspective] [STYLE: 32x32 Pixel Art Item] [DENSITY: 32x32 logic-pixel blocks, solid black outline border] [BACKGROUND: Solid White #FFFFFF] [NEGATIVE: high resolution, subpixel, small sprite, margins, blur, gradients, anti-aliasing]
MANDATORY: 32x32 pixel art on 512x512 canvas.
MANDATORY: Every single pixel MUST be a solid 16x16 block.
MANDATORY: Asset MUST fill canvas frame with minimal white padding.
MANDATORY: Solid black outline, solid white #FFFFFF background.
MANDATORY: Zero anti-aliasing, no blur, no gradients.
```

---

## 5. Reference Examples

### Example 1: 64x64 Icon (Blacksmith Forge)
```text
[SUBJECT: Icon of a stone forge with burning fire, fills canvas, 3/4 isometric] [STYLE: 64x64 Pixel Art Icon] [DENSITY: 64x64 logic-pixel blocks, solid black outline border] [BACKGROUND: Solid White #FFFFFF] [NEGATIVE: high resolution, subpixel, small sprite, margins, blur, gradients, anti-aliasing]
MANDATORY: 64x64 pixel art on 512x512 canvas.
MANDATORY: Every single pixel MUST be a solid 8x8 block.
MANDATORY: Asset MUST fill canvas frame with minimal white padding.
MANDATORY: Solid black outline, solid white #FFFFFF background.
MANDATORY: Zero anti-aliasing, no blur, no gradients.
```

### Example 2: 64x64 Icon (Fishing Lake)
```text
[SUBJECT: Icon of a blue lake with grassy shoreline, fills canvas, 3/4 isometric] [STYLE: 64x64 Pixel Art Icon] [DENSITY: 64x64 logic-pixel blocks, solid black outline border] [BACKGROUND: Solid White #FFFFFF] [NEGATIVE: high resolution, subpixel, small sprite, margins, blur, gradients, anti-aliasing]
MANDATORY: 64x64 pixel art on 512x512 canvas.
MANDATORY: Every single pixel MUST be a solid 8x8 block.
MANDATORY: Asset MUST fill canvas frame with minimal white padding.
MANDATORY: Solid black outline, solid white #FFFFFF background.
MANDATORY: Zero anti-aliasing, no blur, no gradients.
```

### Example 3: 32x32 Item (Cherry Pie)
```text
[SUBJECT: Icon of a cherry pie slice, fills canvas, 3/4 perspective] [STYLE: 32x32 Pixel Art Item] [DENSITY: 32x32 logic-pixel blocks, solid black outline border] [BACKGROUND: Solid White #FFFFFF] [NEGATIVE: high resolution, subpixel, small sprite, margins, blur, gradients, anti-aliasing]
MANDATORY: 32x32 pixel art on 512x512 canvas.
MANDATORY: Every single pixel MUST be a solid 16x16 block.
MANDATORY: Asset MUST fill canvas frame with minimal white padding.
MANDATORY: Solid black outline, solid white #FFFFFF background.
MANDATORY: Zero anti-aliasing, no blur, no gradients.
```

---

## 6. Workflow for Prompt Delivery

When a user requests a prompt from the Artist agent:
1. **Identify Asset Type**:
   - Is it an **Item** (32x32px)?
   - Is it an **Icon / Token** (64x64px)?
2. **Draft Concise Subject**: Keep to essential nouns, colors, and perspective. Do not over-describe.
3. **Format Full Prompt**: Use the streamlined template with strict block math, solid black outline, and canvas-fill directives.
4. **Specify Target Watch Folder**:
   - Items -> `raw_assets/dataset/512input32/`
   - Icons / Tokens -> `raw_assets/dataset/512input64/`
