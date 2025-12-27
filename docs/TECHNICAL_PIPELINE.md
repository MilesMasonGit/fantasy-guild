# Technical Pipeline: Art Production (32px Standard)

This document is a technical handover guide for AI agents working on raster art for *Fantasy Guild*. It defines the mathematical and procedural standards for generating "Vibrant Modern Retro" assets.

## 1. The 32px Logical Standard
We use a **32x32px logic grid**. 

> [!IMPORTANT]
> **Human-in-the-loop Verification**: AI Agents MUST provide the raw 1024x1024 master image for manual review BEFORE proceeding to Step 3 (Processing). This ensures design standards are met even if technical standards are perfect.

- Assets are generated at **1024x1024px**.
- Each **Logical Pixel** is a **32x32 pixel block** on the raw canvas (1024 / 32 = 32).
- **CRITICAL**: The AI must produce "Perfect Blocks". Any sub-pixel blur, anti-aliasing, or soft edges will break the point-sampled extraction.

### Core Prompt Tokens
Add these to EVERY generation:
> `MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.`
> `MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.`
> `MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.`
> `MANDATORY: NO BLACK BORDERS or OUTLINES.`
> `MANDATORY: Solid white #FFFFFF background, grid-less.`

## 2. Geometric vs. Organic Strategies

### Geometric (Swords, Ingots, Gems)
- **Method**: Single asset generation + Point-Sampled extraction.
- **Pulse Extraction**: We use the `--pulse` flag in `process_art.cjs`.
- **Logic**: Targets the exact center of the 32x32 raw blocks (Offset: 16px). This bypasses AI edge jitter.

### Organic (Meat, Bark, Potions)
- **Method**: 2x2 Sprite Sheet generation + Lanczos Downsampling.
- **Logic**: Handled via `--grid 2x2` and `--tile x,y`. Better for assets that don't need bit-perfect grid alignment but still need to match the 32px palette.

## 3. Processing Standards (`process_art.cjs`)

### Output Format
- **Size**: Always `--size 32`.
- **Canvas**: **NO TRIM**. We preserve the exact 32x32 bounds with transparent padding.
- **Transparency**: Handled via flood-fill on the `SEED_OFFSET: 2` (corners).

### Color Philosophy (Oklab Snapping)
We use perceptual snapping to preserve vibrance. Use tags to load modular palettes:
- `--snap universal,iron,glint`
- `universal`: Midnight (`#0a0a12`), Ivory (`#fffdf0`).
- `iron`: 5-8 color material ramp.

## 4. UI Rendering (Pixel Shimmering Prevention)
To ensure these 32px assets look perfect on all displays (even at 110% zoom):
- **CSS Styles**:
  ```css
  image-rendering: pixelated;
  will-change: transform;
  transform: translateZ(0);
  ```
- This prevents the browser from applying sub-pixel anti-aliasing to our bit-perfect art.

## 5. Recolor Workflow (Template Logic)
To support a modular materials system, we use **Luminance-Based Recoloring**.

### How it Works
1.  **Template Generation**: A high-res source (e.g., Attempt 10 Ingot) is desaturated into a **Greyscale Template**.
2.  **Luminance Mapping**: The `process_art.cjs` script calculates the luminance (0.0 to 1.0) of each pixel.
3.  **Ramp Injection**:
    - The script loads a material ramp from `materials_library.json`.
    - It maps the pixel's luminance to the corresponding index in the ramp.
    - Pure white/black backgrounds or glints (L > 0.98 or L < 0.02) can be preserved or specifically mapped.
4.  **Batch Variation**: A single template can generate Iron, Copper, Gold, and Oak variants in seconds.

## 6. Verification Checklist for AI
- [ ] Is the raw generation a clean 1024x1024?
- [ ] Are the "Logic Pixels" visible as mathematical squares?
- [ ] Is there **Zero** black outline (unless explicitly requested)?
- [ ] Does the processed file metadata show exactly 32x32px?
- [ ] Is the filename lower_snake_case and descriptive?

## 7. The Folder Hierarchy (Gated Pipeline)

To maintain high quality, all art moves through four specific "Gates". Each serves a unique purpose in the lifecycle of an asset.

| Gate | Folder | Purpose | Approved? |
| :--- | :--- | :--- | :--- |
| **1. Source** | `public/assets/sprites/masters/` | Original 1024x1024 AI generation (Backup). | N/A |
| **2. Review** | `public/assets/sprites/workspace/` | Initial 32px processing (Snapped & Snapped). | **Pending** |
| **3. Pivot** | `public/assets/sprites/templates/` | Greyscale 32px files for assets requiring recolors. | N/A |
| **4. Final** | `public/assets/sprites/implemented/` | Approved assets ready for game logic. | **100%** |

## 8. Manual Implementation & Sorting

Once a sprite is approved by the user in the **Workspace**, implementation is handled **manually** by moving the file to its final category. 

### Hierarchy of Implemented
Assets inside `public/assets/sprites/implemented/` MUST be sorted into logical subfolders. Current item categories:
- `/items/crime/`
- `/items/drink/`
- `/items/equipment/`
- `/items/mining/`
- `/items/wood/`
- `/biomes/`
- `/heroes/`
- `/skills/`

### Automatic Discovery System
- **Naming**: The filename MUST match the Registry ID using the **[Type]_[Material]** convention (e.g., `ore_iron.png`, `ingot_copper.png`, `battleaxe_mithril.png`).
- **Discovery**: The game discovers assets by checking for the existence of files matching the Registry ID in the `implemented/` subfolders.
- **Manual Manifest**: If the manifest needs updating, it is done manually or via a separate stable process. `forge` no longer triggers automatic scanning.

---

## 9. Verification Ritual (The Workspace)

Before moving an asset to `implemented/`, the user MUST verify it in the **[Pixel Forge](file:///C:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/public/pixel_forge.html)**.

1.  **Selection**: Use the **Workspace** tab to see pending review items.
2.  **Logic-Grid Check**: Confirm no sub-pixel jitter or semi-transparency.
3.  **Branching Decision**:
    - **Single**: If approved and only one version exists -> Move to `Implemented/`.
    - **Recolor**: If approved but needs variants -> Move to `Templates/` as `[id]_template.png` and run `forge variant`.

---

## 10. Visual Style Anchors (The Reference Gallery)

Maintain "Vibrant Modern Retro" quality using these anchors for image-to-image reference.

### 10.1 Material Anchors
| Material Type | Style Anchor (Master) | Key Visual Tokens |
| :--- | :--- | :--- |
| **Metal** | [iron_ingot](file:///public/assets/masters/iron_ingot_master_v10_shading.png) | High volumetric shading, top-left light source. |
| **Organic** | [water_drop](file:///public/assets/masters/water_drop_master.png) | Smooth gradients, translucent highlights. |
| **Mineral** | [copper_ore](file:///public/assets/masters/copper_ore_master_v4.png) | Jagged clusters, sharp transitions. |
