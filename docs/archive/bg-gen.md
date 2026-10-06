---
description: Automated workflow for generating and processing 256px background art using AI Studio and the local watcher script
---

# Automated Background Art Generation & Processing (256px)

This workflow describes the design rules, prompt structure, and automated pipeline for generating **256x256px Background assets**.

---

## 1. Outlining Style Standards

To ensure cohesive game environments, all backgrounds must follow these rules:

* **Perspective (Grounded View)**: Always use an eye-level, grounded perspective. Do not generate isometric, orthographic, top-down, side-scrolling, or extreme bird's-eye views. The viewpoint should make the player feel like they are standing inside the scene.
* **Composition & Depth**:
  * **Foreground**: Place minor elements or frame borders (e.g., pillars, archways, foliage, or simple ground textures) to establish immediate depth.
  * **Midground**: The focal area where actions or characters reside (e.g., the library table, the ritual altar, the kitchen counter). This area must have a clear flat surface or floor plane.
  * **Background**: Distant structures, skies, windows, walls, or scenery that recedes into the distance.
* **Horizon & Ground Plane**: The horizon line should sit in the lower-to-middle third of the scene to anchor the perspective. A solid, visible ground or floor plane is mandatory.
* **Density & Resolution**: 256x256px grid. Every logic-pixel must represent a clean **4x4 block** when viewed on the 1024x1024 master canvas.
* **Outline & Shading**: Do not use thick black borders around the edges of the canvas (backgrounds are full-bleed). However, inner objects (pillars, furniture, trees) can utilize subtle darker-colored outlines or shading to maintain readability against backgrounds.

---

## 2. Structured Prompt Template (256px)

Use this token block prompt in Google AI Studio to construct background prompts:

```text
[SUBJECT: <detailed background scene, e.g., a dusty stone library filled with ancient scrolls>] [PERSPECTIVE: Eye-level grounded view, clear depth layering with foreground and midground ground planes] [STYLE: 256x256 Pixel Art] [DENSITY: Perfect 256x256 logic-pixel blocks, crisp textures, sharp block edges] [LIGHTING: <lighting/atmosphere, e.g., warm sunlight streaming through high arched windows>] [BACKGROUND: Full-bleed scene] [NEGATIVE: transparent background, floating items, orthographic view, isometric, top-down, blurring, anti-alias, soft edges, gradients, dithering, noise]
MANDATORY: 256x256 drawing complexity rendered on a 1024x1024 canvas.
MANDATORY: Every single logic-pixel MUST be a solid 4x4 pixel square block.
MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.
MANDATORY: Full-bleed scene covering the entire frame, no transparent border.
MANDATORY: Grounded eye-level perspective with visible floor/ground plane.
```

---

## 3. Automatic Processing Pipeline

### Directory Structure
* **Input Directory**: `public/assets/dataset/input256/`
* **Output Directory**: `public/assets/dataset/`
* **Backup Directory**: `public/assets/dataset/input256/backup/`

### Automated Workflow Steps
1. **Save/Download**: Drop your generated master background image (JPG/PNG) directly into the background input folder:
   `public/assets/dataset/input256/`
2. **Auto-Downsampling**: The background script `scripts/watch_assets.js` will detect the file, wait 1 second for the download to complete, and run `process_art.cjs` at size **256** with `--nofill` (since backgrounds are full-bleed and do not need background transparency fill).
3. **Queue Cleanup**: The master file will be automatically moved to `public/assets/dataset/input256/backup/`.

### Running the Watcher
To run or restart the watcher script:
```bash
node scripts/watch_assets.js
```
