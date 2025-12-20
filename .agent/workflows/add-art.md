---
description: How to generate and add new Vector-Pixel art assets
---

# Add Art Workflow

Use this workflow when the user asks to add an icon or image for an item, enemy, or skill.

## 1. Style & Constraints (Strict)

We use a **32x32 Vector-Pixel** style. This means generating an SVG that mimics pixel art using vector rectangles.

*   **Grid**: `viewBox="0 0 32 32"`
*   **Core Logic**: Use strict `32x32` pixel grid.

    *   **Colors**: Use solid Hex colors only. **NO OPACITY** allowed (e.g., no `fill-opacity="0.5"`). If you need a highlight, calculate the blended hex color and use that.
    *   *Reason*: Transparent pixels create visual artifacts in the web renderer.
*   **Outline**: 
    *   **Silhouette**: 1px Solid Black (`#000000`) around the entire outer shape.
    *   **Internal**: Do NOT use black lines inside the object. Use "Crease Lines" (darker shade of the base color) to separate faces (e.g., Top vs Side).
*   **Lighting**: Top-Left source. Top Face = Brightest. Left Face = Mid. Right Face = Darkest/Shadow.
*   **Perspective**:
    *   **Items/Weapons**: 45-degree angle (Bottom-Left to Top-Right).
    *   **Resources**: **Isometric** (Minecraft Style). Ensure **Precision Fill** (Fill matches Outline coordinates exactly), **No Opacity** (Solid Colors Only), and distinct internal edges.
    *   **Potions/Vials**: Upright vertically.
*   **Output**: Pure SVG code only. No markdown, no commentary.

## 5. File Naming Convention
Strictly prefix files based on type:
*   `item_NAME.svg`
*   `enemy_NAME.svg`
*   `hero_NAME.svg`
*   `skill_NAME.svg`
*   `ui_NAME.svg`

**For Equipment:** Use the **Base Name**.
*   ✅ `item_plate_armor.svg` (Generic, can be colored Gold/Mithril).
*   ❌ `item_mithril_plate_armor.svg` (Too specific, prevents reusing the shape).



## 2. Generation Prompt (System Instructions)

When generating the SVG code, you MUST adhere to these Style Rules:

> **System Prompt:**
> "Generate a 32x32 Vector-Pixel SVG. 
> Style: **High-Bit Fantasy (SNES Era)**.
> 1. **Outline**: 1px Solid Black (`#000000`) on rigid objects. **Colored Outlines** allowed for Elements (Fire/Magic/Water).
> 2. **Lighting**: Top-Left Light Source.
> 3. **Contrast**: High saturation. No muddy colors.
> 4. **Perspective**: 45-degree angle for items.
> 5. **Technique**: Use `<rect>` only. No anti-aliasing. No blurs."

### Category-Specific Rules
*   **Heroes**: Style="True Chibi". Head is 50% of height. **Faces RIGHT**.
    *   *Features*: Large Anime Eyes (2x2 with white highlight). Small mouth.
    *   *Variation*: Generate 3 variants per class (A/B/C) with different hair/skin.
*   **Enemies**: Style="True Chibi", Tone="Dragon Quest". **Faces LEFT**.
    *   *Approach*: Round, goofy, distinct silhouette. Not too scary.
*   **Items**: Style="Chunky Iconography".
    *   *Proportions*: Thick handles (2-3px) to read at small size.
    *   *Focus*: **NO Extras**. Just the object itself. (e.g., A candle has no holder. A sword has no scabbard.)
    *   *Rare/Legendary*: Allowed to have Colored Glows/Sparkles.
*   **Projects**: Style="Illustration".
    *   *Size*: 64x64 or 128x128. High detail structure portrait.
*   **Biomes**: Style="Background Panorama".
    *   *Use*: Muted atmosphere. Low contrast.

### Template Logic
```xml
<svg width="256" height="256" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <title>{asset_id}</title>
  
  <!-- 1. Draw Base Shape -->
  <rect x="10" y="10" width="12" height="12" fill="#bdc3c7" />
  
  <!-- 2. Apply Shading (Top-Left Highlight, Bottom-Right Shadow) -->
  <rect x="10" y="10" width="12" height="1" fill="#ecf0f1" /> <!-- Highlight -->
  <rect x="10" y="21" width="12" height="1" fill="#7f8c8d" /> <!-- Shadow -->
  
  <!-- 3. Finalize with 1px Black Outline -->
  <rect x="10" y="9" width="12" height="1" fill="#000" /> <!-- Top Edge -->
  <rect x="9" y="10" width="1" height="12" fill="#000" /> <!-- Left Edge -->
  <!-- ... etc ... -->
</svg>
```

## 3. Execution Workflow

1.  **Assess Requirements**: Identify the asset type (Item, Hero, Resource) and applied Style Rules.
2.  **Drafting (Underpainting)**:
    *   *Step*: Generate just the base silhouette/underpainting first to validate perspective and shape.
    *   *Check*: Ensure no gaps (Safe Overlap) and correct isometric projection.
3.  **Final Generation**: Apply the detailing and shading layers on top of the approved silhouette.
4.  **Save**: Write the file to `public/assets/icons/{category}/{item_id}.svg`.
    *   Categories: `items`, `skills`, `enemies`, `ui`.
5.  **Link**: Update the registry (e.g., `itemRegistry.js`) to point to the new file.
    ```javascript
    // In itemRegistry.js
    iron_sword: {
        // ... existing data ...
        img: 'icons/items/iron_sword.svg'
    }
    ```
6.  **Verify**: Confirm the path matches and the file was created.

## 4. Animation (CSS Sprites) [Optional]

If the user requests animation (e.g., flickering torch):
1.  Create a **64x32** SVG (Double width).
2.  Draw Frame 1 in `x=0..31` and Frame 2 in `x=32..63`.
3.  Update registry with `frames: 2`.
