---
description: Automated workflow for generating and processing 64px enemy sprites using AI Studio and the local watcher script
---

# Automated Enemy Art Generation & Processing (64px)

This workflow describes the design rules, prompt structure, and automated pipeline for generating **64x64px Enemy sprites**.

---

## 1. Outlining Style Standards

* **Enemies / Monsters**: Use a **dark charcoal or dark colored outline** matching their palette to look organic, rather than a harsh, mechanical black outline, unless they are robotic/golem-like.
* **Size & Resolution**: 64x64px grid (allowing for double the detail density of standard 32px items).

---

## 2. Structured Prompt Template (64px)

Use this token block prompt in Google AI Studio. Note the updated density constraints matching the 64x64 logic grid:

```text
[SUBJECT: <detailed enemy description, e.g., a fiery skeleton warrior holding a rusted scythe>] [STYLE: 64x64 Pixel Art] [DENSITY: Perfect 64x64 logic-pixel blocks, clearly defined dark charcoal colored outline border around the character shape] [LIGHTING: Top-Left Volumetric] [BACKGROUND: Pure White #FFFFFF] [NEGATIVE: blurring, anti-aliasing, soft edges, gradients, dithering]
MANDATORY: 64x64 drawing complexity rendered on a 1024x1024 canvas.
MANDATORY: Every single logic-pixel MUST be a solid 16x16 pixel square block.
MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.
MANDATORY: Solid white #FFFFFF background, grid-less.
MANDATORY: Distinct dark charcoal colored border outline around the asset silhouette.
```

---

## 3. Automatic Processing Pipeline

### Directory Structure
* **Input Directory**: `public/assets/dataset/input64/`
* **Output Directory**: `public/assets/dataset/`
* **Backup Directory**: `public/assets/dataset/input64/backup/`

### Automated Workflow Steps
1. **Save/Download**: Drop your generated master image (JPG/PNG) directly into the enemy input folder:
   `public/assets/dataset/input64/`
2. **Auto-Downsampling**: The background script `scripts/watch_assets.js` will detect the file, wait 1 second for the download to complete, run `process_art.cjs` at size **64**, and generate a transparent `64x64px` PNG inside the parent `dataset/` directory.
3. **Queue Cleanup**: The master file will be automatically moved to `public/assets/dataset/input64/backup/`.

### Running the Watcher
To run or restart the watcher script:
```bash
node scripts/watch_assets.js
```
