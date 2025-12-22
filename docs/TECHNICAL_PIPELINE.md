# Technical Pipeline: Art Production (32px Standard)

This document is a technical handover guide for AI agents working on raster art for *Fantasy Guild*. It defines the mathematical and procedural standards for generating "Vibrant Modern Retro" assets.

## 1. The 32px Logical Standard
We use a **32x32px logic grid**. 
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
