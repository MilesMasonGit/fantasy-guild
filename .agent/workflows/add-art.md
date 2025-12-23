---
description: How to generate and add new AI-Assisted Raster art assets (32px Standard)
---

Follow this workflow to generate "Vibrant Modern Retro" assets that adhere to the project's consistent visual standards.

## 1. Phase 0: Design Dialogue (Mandatory)
Before generating, ask the user these clarifying questions:
1.  **Material Anchor**: Which anchor from **Section 8 of `TECHNICAL_PIPELINE.md`** should this item follow? (e.g., Metal, Organic, or Rugged).
2.  **Perspective**: (Isometric 3/4 for depth, or Frontal for simple icons).
3.  **Silhouette**: (Chunky/oversized vs. sleek/realistic).
4.  **Specifics**: (e.g., "Rusty," "Glowing," "Mossy").

---

## 2. Phase 1: Generation
Construct a prompt using the "Perfect Block" tokens and our established Style Anchors.

### The Template
`Highly detailed 32x32 drawing complexity pixel art of a [Item Name], [Perspective], dramatic volumetric shading, [Materials], NO outlines, solid white #FFFFFF background --style raw --v 6.0`

### Mandatory Tokens
> `MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.`
> `MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.`
> `MANDATORY: NO BLACK BORDERS or OUTLINES.`
> `MANDATORY: Solid white #FFFFFF background, grid-less.`

### The Style Anchor
When calling `generate_image`, you **MUST** pass the selected Style Anchor master in the `ImagePaths` argument to ensure shading/light consistency.
- **Metal Anchor**: `public/assets/masters/iron_ingot_master_v10_shading.png`

---

## 3. Phase 2: User Verification
**STOP CURRENT TASK.** You must present the raw 1024px generation to the user.
- [ ] Are the "Logic Pixels" visible as mathematical squares?
- [ ] Is the lighting from the Top-Left?
- [ ] Does it match the Style Anchor's density?

---

## 4. Phase 3: Processing
Use `process_art.cjs` to extract the bit-perfect 32px sprite.

// turbo
```bash
# Point-Sampled Extraction (Targets block centers)
node scripts/process_art.cjs [source].png [category] [id] --pulse --size 32 --snap universal,[material],glint
```

### Snap Tags
- `universal`: Midnight (`#0a0a12`), Ivory (`#fffdf0`).
- `material`: Use the relevant ramp (e.g., `iron`, `copper`, `wood`).

---

## 5. Phase 4: Implementation (One-Move Discovery)
Implementation is zero-code. Just move the file.

// turbo
```bash
# Move to final home (Convention: filename == registry ID)
mv public/assets/sprites/approved/[name].png public/assets/sprites/implemented/items/[id].png
```

### Refresh Verification
1.  Run `npm run dev` (if not already running) to trigger the manifest scanner.
2.  Refresh the game browser. The `AssetManager` will automatically discover and render the new sprite.

---
> [!IMPORTANT]
> **Disciplined Execution**: Complete one asset at a time. Never batch generate multiple items in a single turn.
