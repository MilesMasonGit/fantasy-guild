---
description: How to generate and process new AI-Assisted Art (32px Standard)
---

Follow this workflow to produce "Vibrant Modern Retro" assets that adhere to the 32px logical grid and Forge 2.0 processing standards.

## 1. Phase 0: Design Dialogue (Mandatory)
Before generating, ask the user these clarifying questions to establish the design goals:
1.  **Material Anchor**: Which anchor from **Section 8 of `TECHNICAL_PIPELINE.md`** should this follow? (e.g., Metal, Organic, or Rugged).
2.  **Perspective**: (Isometric 3/4 for depth, or Frontal for simple icons).
3.  **Silhouette**: (Chunky/oversized vs. sleek/realistic).
4.  **Specific Features**: (e.g., "Rusty," "Glowing," "Mossy," "Glinting").

---

## 2. Phase 1: Generation
Construct a prompt using the "Perfect Block" tokens and Style Anchors.

### The Template
`Highly detailed 32x32 drawing complexity pixel art of a [Item Name], [Perspective], dramatic volumetric shading, [Materials], NO outlines, solid white #FFFFFF background --style raw --v 6.0`

### Mandatory Tokens
> `MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.`
> `MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.`
> `MANDATORY: NO BLACK BORDERS or OUTLINES.`
> `MANDATORY: Solid white #FFFFFF background, grid-less.`

### The Style Anchor
When calling `generate_image`, pass the selected Style Anchor master in the `ImagePaths` argument for shading/light consistency.
- **Metal Anchor**: `public/assets/masters/iron_ingot_master_v10_shading.png`

---

## 3. Phase 2: User Verification
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Logic Pixels**: Are they visible as crisp 32px mathematical squares?
- [ ] **Lighting**: Is it consistently from the Top-Left?
- [ ] **Density**: Does it match the Style Anchor's shading detail?
- [ ] **Background**: Is it pure white with NO shadows?

---

## 4. Phase 3: Initial Processing (Forge)
Use the **Forge** wrapper to extract the 32px master and move it to the review zone.

// turbo
```bash
# Saves 1024px to masters/, extracts 32px, snaps to iron, and saves to Workspace/
# [id] should follow [type]_[material] convention: e.g. ore_iron, battleaxe_mithril
node scripts/forge.cjs master "[raw_path].png" "[id]"
```

---

## 5. Phase 4: Verification & Branching
**STOP CURRENT TASK.** Present the processed asset from the `public/assets/workspace/` folder to the user.

- **Option A (Approved)**: 
  - If a single asset -> Manually move to its sorted home in `implemented/` (see `@[/implement-sprite]`).
- **Option B (Recolors Needed)**:
  - Move to `public/assets/templates/` as `[id]_template.png`.
  - Create variants: `node scripts/forge.cjs variant "[id]" iron,gold,copper,mithril`.
  - Present variants from `workspace/` to user for final approval.

---

## 6. Phase 5: Implementation (Manual)
Approved files are manually moved from `workspace/` to their final game category in `public/assets/sprites/implemented/`.

---
> [!IMPORTANT]
> **No Overlap**: Do not include integration steps or animation logic here. This workflow ends at the creation of the processed asset.
