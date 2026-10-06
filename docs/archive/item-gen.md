---
description: Automated workflow for generating and processing 32px standard items using AI Studio and the local watcher script
---

# Automated Item Art Generation & Processing

This workflow utilizes the Google AI Studio Web UI for rapid image generation combined with a local background file watcher for instant, zero-effort processing and downsampling.

---

## 1. Outlining Style Standards

When generating items, adhere to the following outline rules:
* **Natural/Organic Items** (food, plants, raw ingredients, monster drops): Use **dark, colored outlines** matching their palette.
* **Inorganic/Crafted Items** (weapons, armor, tools, jewelry): Use **solid black outlines**.

---

## 2. Structured Prompt Template

Construct prompts using the following structured token block template in Google AI Studio:

```text
[SUBJECT: <detailed subject description, e.g., a ripe strawberry / an iron shield>] [STYLE: 32x32 Pixel Art] [DENSITY: Perfect 32x32 logic-pixel blocks, clearly defined <dark colored / solid black> outline border around the <subject> shape] [LIGHTING: Top-Left Volumetric] [BACKGROUND: Pure White #FFFFFF] [NEGATIVE: blurring, anti-aliasing, soft edges, gradients, dithering]
MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.
MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.
MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.
MANDATORY: Solid white #FFFFFF background, grid-less.
MANDATORY: Distinct <dark colored / solid black> border outline around the asset silhouette.
```

---

## 3. Automatic Processing Pipeline

Once images are generated and downloaded, the processing is entirely automated by the watch script.

### Directory Structure
* **Input Directory**: `raw_assets/dataset/input32/`
* **Output Directory**: `raw_assets/dataset/`
* **Backup Directory**: `raw_assets/dataset/input32/backup/`

### Automated Workflow Steps
1. **Save/Download**: Save your generated master image (JPG or PNG) directly to the input folder:
   `raw_assets/dataset/input32/`
2. **Detection & Debounce**: The background script `scripts/watch_assets.js` detects the new file and waits 1 second to ensure the write/download is complete.
3. **Downsampling & Flood-Fill**: The script spawns `process_art.cjs` to:
   * Remove the solid white background (converting it to alpha transparency).
   * Downsample the image to a crisp `32x32px` sprite.
   * Save the final sprite to `raw_assets/dataset/[filename].png`.
4. **Backup Queue**: The original high-resolution master file is automatically moved to `raw_assets/dataset/input32/backup/` to clean the queue and prevent reprocessing.

### Running the Watcher
To start the watcher manually if it's not already running:
```bash
node scripts/watch_assets.js
```
