---
description: How to generate and add new AI-Assisted Raster art assets
---

# Add Art Workflow

Use this workflow when the user asks to add an icon for an item, resource, or consumable. This workflow relies on **AI Generation** followed by **Automated Processing**.

## 1. Style Bible: "Vibrant Modern Retro"
All assets MUST adhere to these tokens to maintain consistency.

*   **Logic**: 32x32px Bit-Perfect Standard. Each "logical pixel" is a single color block.
*   **Perspective**: Isometric 3/4 Perspective for geometric items; Frontal for consumables.
*   **Outline**: **Zero Outlines**. Edges are defined by high-contrast surface color.
*   **Lighting**: Volumetric & Dramatic. Top-Left source. Use spectral highlights (ivory/white) for polished surfaces.
*   **Colors**: "Vibrant Fantasy" - High saturation, perceptual palette snapping (Oklab).
*   **Canvas Preservation**: Files must be exactly 32x32px. NO `.trim()`.
*   **Posing**:
    *   **Weapons/Tools**: 45-degree tilt (pointing Top-Right).
    *   **Consumables/Resources**: Front-facing or isometric 3/4 based on object type.

### Material Palettes
| Material | Base | Highlight | Shadow |
| :--- | :--- | :--- | :--- |
| **Iron/Metal** | `#7f8c8d` | `#ecf0f1` (Sharp) | `#2c3e50` |
| **Copper** | `#b87333` | `#e39a71` | `#704214` |
| **Wood** | `#8e5e3a` | `#dfbb9d` (Rings) | `#5d3a1a` |
| **Red Liquid** | `#c0392b` | `#e74c3c` | `#922b21` |

---

## 2. Phase 0: The Design Dialogue (Mandatory)
Before constructing a prompt, you **MUST** ask the user clarifying questions about the asset:
1.  **Perspective**: (e.g., Bird's Eye Frontal for depth, or Flat Frontal for simplicity).
2.  **Materials**: (Specific colors/textures e.g., "Dark Oak" or "Weathered Bronze").
3.  **Unique Details**: (e.g., moss, cracks, specialized hilt designs, or magical glows).
4.  **Silhouettes**: (e.g., chunky/oversized vs. sleek/thin).

---

1.  **Choose Strategy**:
    *   **Geometric (Grid-Synced)**: Single asset, 1:1 Point-sampled. Mandatory for Ingots, Swords, Gems.
    *   **Organic/Sprite Sheet**: 2x2 grid, Lanczos-scaled. Use for items with irregular shapes (Potions, Meat).
2.  **Construct Prompt**: 
    *   *For Geometric (32px Peak)*:
        `Highly detailed 32x32 drawing complexity pixel art of a [Item Name], isometric 3/4 perspective, dramatic volumetric lighting, [Material Traits - e.g. "polished iron"], heavy shading, deep shadows, bright specular highlights, clean silhouette, NO black borders, NO outlines, solid white #FFFFFF background, grid-less --style raw --v 6.0`
    *   **MANDATORY Prompt Rules**:
        *   `MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.`
        *   `MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.`
        *   `MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.`
        *   `MANDATORY: NO BLACK BORDERS or OUTLINES.`
        *   `MANDATORY: Solid white #FFFFFF background, grid-less.`
    *   *For Organic*: Request a **2x2 grid sprite sheet** (4 variants). 
3.  **Generate**: Call `generate_image`.
4.  **PHASE: Mandatory User Verification**: 
    *   **CRITICAL**: You MUST present the raw 1024px generation to the user BEFORE processing.
    *   **Check**: Does it exhibit true 64x64 drawing complexity, or did it simplify to 32x32/16x16?
    *   **Check**: Is the background solid flat white without any grid lines?
    *   Proceed to processing ONLY if the user confirms the raw source meets specifications.

The `process_art.cjs` script automatically applies a **Median Filter (size 2)**. 
*   **Reason**: This eliminates AI-generated scattering noise and ensures solid, cel-shaded color blocks while preserving fine detail.

## 4. Batch Processing & Browser Review

1.  **Point-Sampled Extraction**: 
    Run `process_art.cjs` with `--pulse` and `--size 32`. 
    The `--pulse` flag targets the center of the 32x32 logical blocks (Offset: 16px).
    Always include `--snap universal,[material],glint`.
    // turbo
    ```bash
    # Extract & Scale (The 32px Standard)
    node scripts/process_art.cjs raw_assets/[file].png [cat] [name] --tile 1,1 --grid 1x1 --pulse --snap universal,[material],glint --size 32
    ```
2.  **Viewer Update**: 
    Add a temporary section to `art_viewer.html` showcasing all 4 options.

## 4. Final Selection & Archive (Safe Spot)

1.  **Selection**: The user reviews the side-by-side 64px/256px comparisons in `art_viewer.html` and picks a winner.
2.  **Naming & Deployment**: 
    // turbo
    ```bash
    # Move the winner (e.g. v2) to the final name
    Rename-Item "public/assets/icons/[cat]/[name]_v2.png" "[name].png"
    ```
3.  **Library Archival**: 
    Save the original 512px crop (the high-res source) to `raw_assets/library/[category]/[name]_highres.png`. This is the "Safe Spot" for future high-fidelity needs.
4.  **Integration**: Update the game registry with the final path.

## 4. Animation (CSS Sprites)
For loops (torches, bubbles):
1.  Generate/Create/Arrange frames side-by-side in a single PNG.
2.  Update registry with `frames: [count]`.
3.  Renderer will handle the `steps()` CSS animation.
