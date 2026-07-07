# Technical Pipeline: Art Production (32px Standard)

This document is a technical handover guide for AI agents working on raster art for *Fantasy Guild*. It defines the mathematical and procedural standards for generating "Vibrant Modern Retro" assets.

## 1. The 32px Logical Standard
We use a **32x32px logic grid**. 

> [!IMPORTANT]
> **Human-in-the-loop Verification**: AI Agents MUST provide the raw 1024x1024 master image for manual review BEFORE proceeding to Step 3 (Processing). This ensures design standards are met even if technical standards are perfect.

- Assets are generated at **1024x1024px**.
- Each **Logical Pixel** is a **32x32 pixel block** on the raw canvas (1024 / 32 = 32).
- **CRITICAL**: The AI (Nano Banana) must produce "Perfect Blocks". Any sub-pixel blur, anti-aliasing, or soft edges will break the point-sampled extraction.

### Core Prompt Template (Nano Banana)
Use **Token Blocks** instead of sentences for higher adherence:
> `[SUBJECT: <Name>] [STYLE: 32x32 Pixel Art] [DENSITY: Perfect 32x32 logic-pixel blocks] [LIGHTING: Top-Left Volumetric] [BACKGROUND: Pure White #FFFFFF] [NEGATIVE: blurring, anti-aliasing, soft edges, outlines, gradients, dithering]`

> `MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.`
> `MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.`
> `MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.`
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
- **Transparency**: Handled via flood-fill. Use `--tolerance N` (default 15) for messy backgrounds.

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

---

## 11. Density Anchors (MANDATORY)

To guarantee the strict 32x32 logic-pixel grid, we use **Density Anchors** in addition to Material Anchors.

**The Anchor**: `public/assets/anchors/density_anchor_32px.png`
*   Use this image as a "Reference Image" in Nano Banana (Image-to-Image).
*   It enforces a mathematical 32x32 grid (1024/32 blocks) onto any subject matter.
*   **Nano Banana Tip**: Use high Image Weight (e.g., `--iw 2.0`) for the Density Anchor.

---

## 12. Background Art Standard (256px/512px)

Parallel pipeline for high-resolution scene setting. These assets are significantly larger than sprites but share the "Perfect Block" philosophy.

- **Logical Pixel Size**: 4px blocks (for 256px output) from 1024px source.
- **Color Palette**: Use `--snap fantasy-guild-256` OR skip snapping for broader palette.
- **Dithering**: **ALLOWED**. Use dithering to create texture and atmospheric gradients.

### 11.1 The Density Transfer Strategy (MANDATORY)
To guarantee the strict 256x256 resolution (4x4 pixel blocks), we DO NOT rely solely on text prompting. We use **Image Anchoring**.

**The Anchor**: `public/assets/backgrounds/masters/Area_Guild Hall.png`
*   Use this image as a "Reference Image" or "Style Anchor" for every generation.
*   It enforces the correct "chunkiness" (4x4 blocks) onto any subject matter.

### 11.2 Prompting Template
**Core Tokens**:
> `MANDATORY: Strict adherence to the pixel density of the reference image.`
> `MANDATORY: The reference image shows the correct 256x256 resolution style (4x4 pixel blocks on 1024 canvas).`
> `MANDATORY: Use this EXACT density. Do not make it chunkier.`
> `MANDATORY: [Subject Matter Description]`
> `MANDATORY: Vibrant fantasy colors. Clean, sharp pixel art. No anti-aliasing.`

**Landscape Enhancers**:
- **Perspective**: `High-angle RPG view` or `Wide-angle scenic shot`.
- **Depth**: `Atmospheric perspective`, `Parallax layering`.
- **Lighting**: `Volumetric shafts`, `Golden hour side-lighting`.

### 11.3 Process Command (256px)
```bash
# Standard 256px Background (Point Sample - No Snap)
node scripts/process_art.cjs [input] backgrounds/[zone_name] [id] --size 256 --nofill
```

### Key Flags
- **`--size 256`**: Downsamples the 1024px master to 256px.
- **`--nofill`**: Backgrounds are full-canvas; preservation of corners.
- **`--snap`**: OPTIONAL. Remove if the generated colors are already perfect.
- **`--debug-map`**: Generates a 1024px overlay showing the exact point-sampled pulse locations.

### 11.4 Playmat Asset Standards (Table & Board)
Playmat assets are split into two categories to balance detail and scale:

- **Tables (Foundational Background)**:
  - **Logical Pixel Size**: 16px blocks from 1024px source.
  - **Final Resolution**: **64x64px**.
  - **Prompting**: MUST include `64x64 pixel art style`.
  - **Processing**: `node scripts/process_art.cjs [input] backgrounds/playmat/[area] pm_table_[area]_[n] --size 64 --nofill`.

- **Boards (Gameplay Tiles)**:
  - **Logical Pixel Size**: 8px blocks from 1024px source.
  - **Final Resolution**: **128x128px**.
  - **Prompting**: MUST include `128x128 pixel art style`.
  - **Processing**: `node scripts/process_art.cjs [input] backgrounds/playmat/[area] pm_board_[area]_[n] --size 128 --nofill`.



