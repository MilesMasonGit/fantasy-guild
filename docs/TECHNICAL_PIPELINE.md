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

## 7. Sprite Integration Checklist (One-Move Discovery)

To scale to thousands of assets, we use a **Convention-over-Configuration** system. Implementing a sprite no longer requires editing code.

### 1. The "Final Home" Rule
Move the processed sprite to its category folder in `public/assets/sprites/implemented/`.
*   **Path**: `public/assets/sprites/implemented/[category]/[id].png`
*   **Categories**: `items`, `skills`, `heroes`, `biomes`.
*   **Convention**: The filename **MUST** exactly match the registry ID (e.g., `gold_ore.png`).
*   **Rule**: Remove all version suffixes (`_v1`, `_attempt2`) when moving to `implemented`.

### 2. Automatic Discovery
Once the file is in place, the **Sprite Manifest System** handles the rest:
1.  **Scanning**: On every `npm run dev`, a script scans the folders and builds a `sprite_manifest.json`.
2.  **Resolution**: The `AssetManager` automatically finds the path if a filename matches an ID.
3.  **Fallback**: If no sprite is found, the game automatically falls back to the registry's emoji `icon`.

### 3. Verification
Refresh your browser. The game will automatically detect the new asset and render it.

---

## 8. Visual Style Anchors (The Reference Gallery)

To maintain consistent "Vibrant Modern Retro" quality across 1,000+ assets, use the following **Style Anchors** as image-to-image references during generation.

### 8.1 Material Anchors (Surface Quality)
These define how different materials react to light, their level of detail, and shading style.

| Material Type | Style Anchor (Master) | Key Visual Tokens |
| :--- | :--- | :--- |
| **Metal / Hard Surface** | [iron_ingot_master_v10](file:///public/assets/masters/iron_ingot_master_v10_shading.png) | High volumetric shading, top-left light source, zero black outlines. |
| **Organic (Soft)** | *[Candidate: Water Drop v9]* | Smooth gradients, translucent highlights, bulbous forms. |
| **Rugged (Mineral)** | *[Candidate: Copper Ore v4]* | Jagged cluster forms, sharp color transitions, matte finish. |

### 8.2 Entity Anchors (Composition)
These define the "Visual weight" and framing for different types of game elements.

| Entity Category | Framing Logic | Zoom / Crop Standard |
| :--- | :--- | :--- |
| **Item Icon** | Centered in 32x32px. | 16-24px logical content area (leave margin). |
| **Hero Portrait** | [Future anchor required] | Head and shoulders, consistent eye-line level. |
| **Project / Area** | [Future anchor required] | Multi-element, fills the 32px grid more aggressively. |

### 8.3 The "Commandments" of Generation
When generating a new asset, ALWAYS include the relevant **Material Anchor** and follow these rules:
1.  **Top-Left Key Light**: All assets must share a consistent light source.
2.  **No Contiguity Outlines**: Shape should be defined by color value shifts, not by black 1px lines.
3.  **Color Saturation**: Use high saturation in Oklab space to prevent the "muddy" pixel art look.

---

## 9. Verification Checklist (Pixel Forge)
Before moving an asset to `implemented/`, use the **[Pixel Forge](file:///C:/Users/16048/.gemini/antigravity/scratch/fantasy_guild_v2/public/pixel_forge.html)** to verify:

1.  **Pixel Fit**: Does the asset snap exactly to a 32x32 logic-grid? (Use the Logic-Grid Precision Test).
2.  **No Artifacts**: Are there any semi-transparent pixels or stray "shimmer" dots on the magenta background?
3.  **Color Integrity**: Does it strictly follow the Material Anchor's shading style (Top-Left lighting, volumetric depth)?
4.  **One-Move Discovery**: Is the filename lower_snake_case and does it match the registry ID exactly?

---
> [!IMPORTANT]
> **Anchor Priority**: If a prompt conflicts with an anchor, the **Anchor** is the source of truth. Mimic the shading density of the anchor even if the text prompt asks for more/less detail.

> [!TIP]
> **Disciplined Implementation**: By manually following this ritual for *one asset at a time*, we avoid mass-registry reverts and broken path errors.
