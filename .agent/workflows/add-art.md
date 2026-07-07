---
description: How to generate and process new AI-Assisted Art (32px Standard)
---

Follow this workflow to produce "Vibrant Modern Retro" assets using Forge 2.0 processing standards.

## 1. Phase 0: Design Dialogue (Mandatory)
Before generating, ask the user these clarifying questions to establish the design goals:
1.  **Material Anchor**: Which anchor from **Section 10 of `TECHNICAL_PIPELINE.md`** should this follow? (e.g., Metal, Organic, or Mineral).
2.  **Perspective**: (Isometric 3/4 for depth, or Frontal for simple icons).
3.  **Silhouette**: (Chunky/oversized vs. sleek/realistic).
4.  **Specific Features**: (e.g., "Rusty," "Glowing," "Mossy," "Glinting").

---

## 2. Phase 1: Generation (Structured)
Construct a prompt using **Token Blocks** and Nano Banana specific constraints.

### The Template
Use plain language to describe the subject, materials, lighting, and composition. Do NOT include resolution, pixel density, canvas size, or anti-aliasing directives — these are handled by Retro Diffusion's generation settings.

`[Subject Name]. [Material properties]. Top-left volumetric lighting, 3/4 perspective. Vibrant fantasy colors. Solid white background.`

### Mandatory Constraints
> `MANDATORY: NO BLACK BORDERS or OUTLINES.`
> `MANDATORY: Solid white #FFFFFF background, grid-less.`

### The Style Anchors (MANDATORY)
When calling `generate_image`, **MUST** pass both a **Density Anchor** and a **Material Anchor** from `public/assets/anchors/`. This enforces pixel alignment AND lighting/shading consistency.

- **Density Anchor**: `public/assets/anchors/density_anchor_32px.png` (Enforces 32px blocks)
- **Material Anchor**: `public/assets/anchors/iron_ingot_master_v10_shading.png` (Enforces lighting and shading detail)

> [!TIP]
> **Nano Banana Tip**: Use high Image Weight (e.g., `--iw 2.0`) for the Density Anchor to ensure strict grid adherence.

---

## 3. Phase 2: User Verification (Master)
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Logic Pixels**: Are they visible as crisp 32px mathematical squares?
- [ ] **Lighting**: Is it consistently from the Top-Left?
- [ ] **Density**: Does it match the Style Anchor's shading detail?
- [ ] **Background**: Is it pure white with NO shadows?

---

## 4. Phase 3: Processing Step 1 (Extraction)
Use `process_art.cjs` to extract the 32px sprite and remove the background. **Do NOT apply snapping/recoloring in this step.**

```bash
# Extracts 32px and removes background. Saves to workspace/
node scripts/process_art.cjs "public/assets/sprites/masters/[id].png" workspace "[id]_raw" --size 32 --pulse --nofill
```

**STOP CURRENT TASK.** Present the raw 32px extraction to the user for verification.

---

## 5. Phase 4: Processing Step 2 (Finishing)
Apply color snapping or modular recoloring to the verified 32px extraction.

```bash
# Snaps to material ramps and universal palette.
node scripts/process_art.cjs "public/assets/sprites/workspace/[id]_raw.png" workspace "[id]" --size 32 --snap universal,[material] --nofill
```

---

## 6. Phase 5: Implementation (Manual)
Approved files are manually moved from `workspace/` to their final game category in `public/assets/sprites/implemented/`.

---

## 7. Troubleshooting & Verification

### A. Messy Backgrounds (Halos)
If Nano Banana produces a "textured" white background that doesn't clear, use the `--tolerance` flag:
```bash
node scripts/process_art.cjs [path] workspace [id] --size 32 --pulse --tolerance 25
```

### B. Grid Alignment Check
If the extraction looks "shimmery" or blurry, run with `--debug-map` to see where the pulses are hitting on the master:
```bash
# This creates [id]_debug.png in public/assets/masters/
node scripts/process_art.cjs [master_path] workspace [id] --size 32 --pulse --debug-map
```

---
> [!IMPORTANT]
> **Separation of Concerns**: Always verify the raw 32px extraction before applying color snapping to prevent "destructive" processing.
