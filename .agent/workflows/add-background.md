---
description: How to generate and process high-res Background Art (256px Standard)
---

Follow this workflow to produce "Vibrant Modern Retro" background assets that strictly adhere to the 256px/4x4 pixel block resolution.

## 1. Phase 0: Design Dialogue (Mandatory)
Before generating, ask the user these clarifying questions to establish the design goals:
1.  **Subject**: What is the core subject? (e.g., Plains, Kitchen, Crypt).
2.  **Atmosphere**: What is the lighting and mood? (e.g., "Golden Hour," "Dank and dark," "Cozy firelight").
3.  **Density Check**: Confirm looking for "Standard 256px" (4x4 blocks).

---

## 2. Phase 1: Generation (Density Transfer)
We DO NOT use text-only prompts for density. We strictly use **Image Anchoring**.

### The Density Anchor
You **MUST** pass this image path in the `ImagePaths` argument for EVERY generation:
`public/assets/backgrounds/masters/Area_Guild Hall.png`

### The Prompt Template
Construct the prompt using these mandatory tokens:

`Pixel art background of [Subject]. MANDATORY: Strict adherence to the pixel density of the reference image. The reference image shows the correct 256x256 resolution style (4x4 pixel blocks on 1024 canvas). Use this EXACT density. Do not make it chunkier. [Subject Details]. [Lighting/Atmosphere]. Vibrant fantasy colors. Clean, sharp pixel art. No anti-aliasing.`

---

## 3. Phase 2: User Verification
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Density**: Are the pixels visible as 4x4 blocks? (Check against the Anchor).
- [ ] **Sharpness**: Are edges clean with zero anti-aliasing?
- [ ] **Content**: Does it match the requested subject?

---

## 4. Phase 3: Processing (Point Sample)
Use `process_art.cjs` to downsample using Nearest Neighbor.

**Critical Rules:**
*   **Size**: `--size 256` (Downsamples 1024 -> 256).
*   **Fill**: `--nofill` (Backgrounds are full-bleed).
*   **Snap**: **SKIP** by default. Only add `--snap fantasy-guild-256` if colors are washed out.

// turbo
```bash
# Example: Processing a plains background
# Usage: node scripts/process_art.cjs [InputPath] backgrounds/[Subfolder] [OutputName] --size 256 --nofill
node scripts/process_art.cjs "C:/Path/To/Raw.png" backgrounds/interiors bg_kitchen --size 256 --nofill
```

---

## 5. Phase 4: Final Asset Location
Processed assets are saved directly to `public/assets/backgrounds/[Subfolder]/`.
Verify the file exists and is ~256x256px (logical resolution).

---
