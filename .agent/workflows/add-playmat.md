---
description: How to generate and process tileable Playmat/Floor Art (256px Standard)
---

Follow this workflow to produce "Vibrant Modern Retro" playmat tiles. This is a two-stage process: establishing an Area Base Anchor and then generating specific tile variants.

## 1. Phase 1: Establish Area Base (Anchor Selection)
Before generating specific tiles, you must create a "Base Anchor" for the target Area.

### The Global Anchor
You **MUST** use this image as the style/density reference for creating a new Area Base:
`public/assets/backgrounds/playmat/global/pm_stone_base.png`

### Generation (Area Base)
1. **Subject**: Define the material for the area (e.g., Mossy Brick, Dark Wood, Sandy Stone).
2. **Prompt**: 
   `Pixel art playmat tile of [Material]. MANDATORY: Strict adherence to the pixel density of the reference image. The reference image shows the correct 256x256 resolution style (4x4 pixel blocks on 1024 canvas). Use this EXACT density. [Material Details]. Vibrant fantasy colors. Clean, sharp pixel art. No anti-aliasing.`

---

## 2. Phase 2: User Verification (Mandatory)
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Density**: Are the pixels visible as 4x4 blocks? (Check against Global Anchor).
- [ ] **Tiling**: Does the image look like it will tile seamlessly?
- [ ] **Content**: Does it match the requested material for the area?

**Proceed to Phase 3 ONLY after explicit user approval.**

---

## 3. Phase 3: Establish Area Base (Storage & Processing)
Once the generation is approved:
1. **Save Master**: Save the 1024px raw generation to `public/assets/backgrounds/playmat/[Area]/masters/pm_[Area]_base.png`.
2. **Process Asset**: Downsample using `process_art.cjs` (see Phase 5) and save to `public/assets/backgrounds/playmat/[Area]/pm_[Area]_base.png`.

---

## 4. Phase 4: Generate Variants
Once the `pm_[Area]_base.png` is processed and confirmed, use it as the `ImagePaths` anchor for variants.

### Step 1: Design Dialogue
Ask the user what variants are needed (e.g., "Cracked," "Mossy," "Glinting," "Patterned").

### Step 2: Generation (Variants)
1. **Anchor**: Pass the **Area Base Master** (`public/assets/backgrounds/playmat/[Area]/masters/pm_[Area]_base.png`) in the `ImagePaths` argument.
2. **Prompt**:
   `Pixel art playmat tile of [Material] with [Variant Detail]. MANDATORY: Strict adherence to the pixel density and color palette of the reference image. [Variant Details]. Vibrant fantasy colors. Clean, sharp pixel art. No anti-aliasing.`

---

## 5. Phase 5: User Verification (Variants)
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Consistency**: Does it match the color and lighting of the Area Base?
- [ ] **Detail**: Is the variant detail (cracks, moss) clear and sharp?

**Proceed to Phase 6 ONLY after explicit user approval.**

---

## 6. Phase 6: Variant Storage & Processing
Once the variant is approved:
1. **Naming**: Variants are numbered (e.g., `pm_forest_1.png`, `pm_forest_2.png`).
2. **Save Master**: Save to `public/assets/backgrounds/playmat/[Area]/masters/pm_[Area]_[N].png`.
3. **Process Asset**: Downsample using `process_art.cjs` (see Phase 7) and save to `public/assets/backgrounds/playmat/[Area]/pm_[Area]_[N].png`.

---

## 7. Phase 7: Processing (Point Sample)
Use `process_art.cjs` to downsample using Nearest Neighbor.

**Critical Rules:**
*   **Size**: `--size 256` (Downsamples 1024 -> 256).
*   **Fill**: `--nofill` (Tiles are full-bleed).
*   **Target**: `backgrounds/playmat/[Area]`

// turbo
```bash
# Example: Processing a forest tile variant
# Usage: node scripts/process_art.cjs [InputPath] backgrounds/playmat/[Area] [OutputName] --size 256 --nofill
node scripts/process_art.cjs "C:/Path/To/Raw.png" backgrounds/playmat/forest pm_forest_1 --size 256 --nofill
```

---

## 4. Phase 4: Verification & Final Location
- Processed assets: `public/assets/backgrounds/playmat/[Area]/pm_[subject].png`.
- Masters: `public/assets/backgrounds/playmat/[Area]/masters/pm_[subject].png`.

### Verification Checklist:
- [ ] **Density**: Check against `pm_stone_base.png`.
- [ ] **Tiling**: Does the edge transition smoothly if repeated?
- [ ] **Naming**: Is it `pm_[area]_base` or `pm_[area]_[n]`?
- [ ] **Paths**: Are both master and asset in the correct [Area] subfolder?
