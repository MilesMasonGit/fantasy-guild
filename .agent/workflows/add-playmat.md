---
description: How to generate and process tileable Playmat Art (Table: 64px, Board: 128px)
---

Follow this workflow to produce "Vibrant Modern Retro" playmat assets. We distinguish between the **Table** (foundational background) and the **Board** (interactive gameplay tiles).

## 1. Asset Definitions

- **Table**: The true background surface. Low-detail material focused. Strictly **64x64px**.
- **Board**: The interactive tiles for cards. Structural and gameplay focused. Strictly **128x128px**.

---

## 2. Phase 1: Generate Table (Foundational Background)
Before generating specific board tiles, you must establish the "Table" material.

### Prompting (Table)
1. **Resolution Token**: `64x64 pixel art style`
2. **Subject**: Material focused (e.g., Rustic Wood Planks, Polished Stone, Mossy Earth).
3. **Draft**:
   `Pixel art playmat table background of [Material]. [Material Details]. 64x64 pixel art style. Vibrant fantasy colors. Seamlessly tileable.`

---

## 3. Phase 2: Generate Board (Gameplay Tiles)
Once the table is established, generate the "Board" tiles that sit on top.

### Prompting (Board)
1. **Resolution Token**: `128x128 pixel art style`
2. **Subject**: Functional/Structural (e.g., Carved Stone Slab, Wooden Game Board, Runed Floor Tile).
3. **Draft**:
   `Pixel art board tile of [Structure]. [Structure Details]. 128x128 pixel art style. Vibrant fantasy colors. Seamlessly tileable.`

---

## 4. Phase 3: User Verification (Mandatory)
**STOP CURRENT TASK.** Present the raw 1024px generation to the user and verify:
- [ ] **Density**: Check against resolution (64px = 16px blocks, 128px = 8px blocks).
- [ ] **Tiling**: Does the image look like it will tile seamlessly?
- [ ] **Type**: Is this a Table or a Board asset?

**Proceed ONLY after explicit user approval.**

---

## 5. Phase 4: Storage & Processing
Once the generation is approved, process it using `process_art.cjs`.

### Storage Path
- Tables: `public/assets/backgrounds/playmat/[Area]/pm_table_[Area]_[n].png`
- Boards: `public/assets/backgrounds/playmat/[Area]/pm_board_[Area]_[n].png`

### Processing (Table - 64px)
// turbo
```bash
# Usage: node scripts/process_art.cjs [InputPath] backgrounds/playmat/[Area] [OutputName] --size 64 --nofill
node scripts/process_art.cjs "C:/Path/To/Raw.png" backgrounds/playmat/[Area] pm_table_[Area]_[n] --size 64 --nofill
```

### Processing (Board - 128px)
// turbo
```bash
# Usage: node scripts/process_art.cjs [InputPath] backgrounds/playmat/[Area] [OutputName] --size 128 --nofill
node scripts/process_art.cjs "C:/Path/To/Raw.png" backgrounds/playmat/[Area] pm_board_[Area]_[n] --size 128 --nofill
```

---

## 6. Verification & Final Location
- Processed assets: `public/assets/backgrounds/playmat/[Area]/pm_[type]_[name].png`.
- Masters: `public/assets/backgrounds/playmat/[Area]/masters/pm_[type]_[name].png`.

### Verification Checklist:
- [ ] **Density**: Does it look correct for its target size (64px or 128px)?
- [ ] **Naming**: Does it follow the `pm_table_` or `pm_board_` prefix?
- [ ] **Paths**: Are both master and asset in the correct [Area] subfolder?

