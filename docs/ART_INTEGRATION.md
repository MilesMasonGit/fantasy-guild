# Art Integration Strategy

> **Status**: Implementation Phase (AI-Raster Transition)
> **Purpose**: Roadmap for transitioning from placeholder emojis to high-quality AI-generated raster assets.

---

## 1. Core Philosophy: AI-Assisted Raster Assets
We have moved away from manual Vector-Pixel (SVG) art in favor of an **AI-Assisted Raster Pipeline**. This allows for richer textures, consistent lighting, and faster iteration while maintaining a crisp "Modern Retro" aesthetic.

### Data Schema
We use an `img` property in all registries. Emojis remain as fallback.
```javascript
iron_sword: {
    id: 'iron_sword',
    icon: '⚔️',
    img: 'items/weapons/copper_sword.png', 
}
```

---

## 2. The Style Bible: "Vibrant Modern Retro"

To ensure consistency across hundreds of assets generated in different sessions, we adhere to these strict visual tokens:

### Visual Tokens
*   **Fidelity**: Modern Retro (Pixel art aesthetic, but smooth gradients and 32-bit detailing allowed).
*   **Outlines**: Heavy **2px Black Stroke** (`#000000`) for maximum readability.
### The "Vibrant Modern Retro" Style Bible
| Feature | Rule | Mandatory Prompt Tokens | Technical Reason |
| :--- | :--- | :--- | :--- |
| **Grid** | **Mandatory 64x64 pixel grid look** | `64x64 pixel grid`, `chunky pixels` | Ensures 16:1 downscale hits "solid" blocks. |
| **Outlines** | **Bold 2px Solid Black** | `heavy 2px solid black outline`, `bold stroke` | The "Barrier" for the Flood Fill algorithm. |
| **Background** | **Flat Pure White** | `on a solid flat white background`, `clean white` | Allows for noise-free transparency removal. |
| **Fidelity** | 32-bit Modern Retro | `modern retro pixel art`, `high quality` | Balances chunky feel with modern detailing. |
| **Colors** | High Saturation | `vibrant colors`, `high contrast`, `saturated` | Prevents the "faded" look after processing. |
| **Lighting** | Cel-Shaded (Top-Left) | `cel-shaded`, `top-left lighting`, `2-tone` | Creates a consistent 3D depth across all icons. |
| **Exclusions** | **Zero Artifacts** | `no shadows`, `zero blur`, `sharp edges` | Prevents "dirty" alpha edges and ghosting. |

### The Prompting Framework (Bulletproof Template)
To ensure the **Washer** works perfectly, every prompt must follow this structure:

```text
A 2x2 grid sprite sheet containing 4 unique variants of [SUBJECT] icon for a video game. 
[SPECIFIC SUBJECT DETAILS: e.g. "dark brown cedar bark, fresh tan rings"], 
modern retro 32-bit pixel art style, 
MANDATORY: 64x64 pixel grid aesthetic, chunky pixels, 
MANDATORY: heavy 2px solid black outline for every variant, 
MANDATORY: vibrant fantasy colors, high contrast, 
cel-shaded with top-left lighting, 
centered frontal perspective, 
MANDATORY: solid flat white background, sharp edges, 
MANDATORY: zero blur, no shadows, no gradients on background.
```

#### Why these tokens are "Mandatory":
1.  **Solid White Background**: Our Flood Fill starts in the corners. If there are shadows or gradients in the background, the "clear" will fail and leave "smudges" around the icon.
2.  **Heavy 2px Black Outline**: This acts as the physical wall. If the outline is too thin or "soft," the transparency will "leak" into the subject (e.g., making a potion look transparent when it shouldn't be).
3.  **64x64 Grid Aesthetic**: This forces the AI to draw with 16x16 pixel "chunks." When we perform our 16:1 downscale, these chunks line up with the target grid, resulting in a crisp, non-blurry final image.

---

## 3. Phase 0: The Design Dialogue (Mandatory)
Before constructing a prompt, you **MUST** ask the user clarifying questions about the asset:
1.  **Perspective**: (e.g., Bird's Eye Frontal for depth, or Flat Frontal for simplicity).
2.  **Materials**: (Specific colors/textures e.g., "Dark Oak" or "Weathered Bronze").
3.  **Unique Details**: (e.g., moss, cracks, specialized hilt designs, or magical glows).
4.  **Silhouettes**: (e.g., chunky/oversized vs. sleek/thin).

### Material Palettes (Standardized)
| Material | Base | Highlight/Glint | Shadow |
| :--- | :--- | :--- | :--- |
| **Iron/Metal** | `#7f8c8d` | `#ecf0f1` (Sharp) | `#2c3e50` |
| **Copper** | `#b87333` | `#e39a71` | `#704214` |
| **Wood** | `#8e5e3a` | `#dfbb9d` (Rings) | `#5d3a1a` |
| **Greenery** | `#27ae60` | `#2ecc71` | `#1b5e20` |
| **Red Liquid** | `#c0392b` | `#e74c3c` (Glowing) | `#922b21` |

### Posing Rules
*   **Weapons/Tools**: 45-degree tilt (pointing Top-Right).
*   **Consumables/Resources**: Flat, front-facing, symmetrical (sitting on ground/shelf).
*   **Bottle/Liquid**: Transparent glass (clear neck), internal glowing bubbles, vertical rim light stripe.

---

## 3. Production Pipeline

### Phase 0: The Design Dialogue (Mandatory)
Before any image is generated, the AI **MUST** engage in a brief dialogue with the user to refine the item's design. This ensures the 2x2 sprite sheet variants are diverse and accurate.

**The AI should ask covering:**
1.  **Perspective Balance**: e.g., Flat frontal vs. Bird's eye vs. Profile.
2.  **Materiality**: e.g., Rugged cedar bark vs. Polished birch; Shining cold iron vs. Rusty scrap.
3.  **Unique Features**: e.g., Moss, cracks, leaves, glowing runes, or specific handle wrappings.
4.  **Height/Proportions**: e.g., Tall cylinder vs. Flat disc; Oversized blade vs. Needle-thin rapier.

### Step 1: Generation (The "Sprite Sheet" Strategy)
To maximize variety and quality while maintaining technical alignment, we use a **2x2 Grid** approach.

1.  **Generate**: Request a `2x2 grid sprite sheet` of 4 variants on a 1024px canvas.
    *   This gives each icon a **512px "cell"**, providing ample detail for the AI.

### Step 2: Prompt Verification (Checkpoint)
Before processing, the user reviews the raw sheet. 
*   **Failed?**: If the prompt was misinterpreted or silhouettes are poor, refine the dialogue and RE-GENERATE.
*   **Passed?**: If the sheet is acceptable, move to **Batch Processing**.

### Step 3: Batch Processing (Multi-Wash)
Instead of picking one variant immediately, we process **ALL 4 VARIANTS** using the Washer. 
*   **The Cartoony Sweep (Optional)**: If the AI generation has high "scattering" noise, we apply a **Median Filter** (size 2) via the `--smooth` flag. This eliminates noise but can be destructive to fine details on clean assets (like metal bars).
*   **Pure Point Sample**: Each variant is then mask and downscaled via Nearest Neighbor.
*   **Result**: 4 unique files (e.g., `item_v1.png`, `item_v2.png`, etc.).

### Step 4: Browser Verification (`art_viewer.html`)
The AI updates the **Art Viewer** to display all 4 processed variants side-by-side.
*   **Mandatory Sizes**: Every variant must be shown at both **64px** and **256px**.
*   **Center-Pulse Verification**: Inspect the outlines at 256px. They should be clean, non-blurry, and significantly thinner than raw downscales due to the **8px alignment offset**.
*   **Decision**: The user makes the Final Selection.

### The Center-Pulse Alignment (8px Offset)
AI models generate "chunky" pixels as clusters of high-res pixels (e.g., a 16x16 cluster at 1024px). 
*   **Problem**: Standard downsampling often hits the *edges* of these clusters, which are anti-aliased and "soft," leading to muddy colors and thick, blurry outlines.
*   **Solution**: We apply an **8px horizontal and vertical offset** during extraction. This shifts the "pulse" of our Nearest-Neighbor sampler to the geometric center of the AI's chunky pixels, capturing the pure core color and the sharpest possible outline.

### Method 3: Grid-Synced Generation (Precision Geometry)
Used for: **Ingots, Gems, Weapons, and Geometric icons.**

For items where a "crooked" 1px line is unacceptable, we move from "averaging" to **1:1 Data Extraction**.

#### 1. The Math of the 64-Grid
We generate at **1024px** but command a logical **64x64 grid**. 
*   $1024 / 64 = 16$
*   We force the AI to draw using **exactly 16px raw blocks**.

#### 2. The "Hard-Grid" Prompting Strategy
To differentiate from previous "chunky" attempts, we use **Terminal Tokens**:
*   `MANDATORY: Every color block must be exactly 16x16 raw pixels.`
*   `No sub-pixel rendering. Zero anti-aliasing.`
*   `Style: Minecraft-style raw block textures upscaled 16x.`

#### 3. Mid-Point Sampling (`--pulse`)
Because the AI's "edges" are always the most wobbly part of a block, we use the `--pulse` flag (or `--offset 8,8`) during extraction.
*   Instead of sampling at the edge of the 16px block (0, 16, 32...), we sample at the **dead center** (8, 24, 40...).
*   This ensures that even if the AI draws a "fuzzy" 16px block, we only grab the color from the high-confidence center point.

#### 4. The "Zero-Reduction" Chain
Unlike Method 2 (Lanczos), we use **Pure Point Sampling**:
```powershell
node scripts/process_art.cjs [path] [cat] [name] --tile 1,1 --grid 1x1 --pulse --nofill --snap aap-splendor128
```
By skipping Lanczos and Median filters and adding **Palette Snapping**, we get a direct, mathematically pure 1:1 readout of the AI's grid.

### Case Study: Mithril Ingot
*   **Problem**: Diagonal edges looked "jittery" because the AI's blocks didn't align with the 64px grid.
*   **Outcome**: By using 16px blocks at 1024px and sampling at exactly +8px (the center), the diagonal became a perfect 1-pixel staircase.

---

### Method 4: Master Template & Material Recoloring
Used for: **Material Variants (e.g. Iron vs Gold vs Cobalt).**

To maintain perfect design consistency while allowing for material progression, we use **Discrete Palette Mapping**.

#### 1. The Grayscale Template
We generate a single "Master" asset using a strictly controlled grayscale ramp:
*   **Indices**: (0) Pure Black, (1) Dark Gray, (2) Medium Gray, (3) Light Gray, (4) Pure White.
*   The AI is prompted to only use these 5 values.

#### 2. The Material LUT (Look-Up Table)
We define color ramps in a `materials.json` or within the script:
*   `iron`: `[#000000, #2d2d30, #55555a, #8a8a8f, #e0e0e5]`
*   `gold`: `[#000000, #3d2b00, #b8860b, #ffd700, #fffacd]`

#### 3. Automated Re-mapping
The `process_art.cjs` script can take a `--recolor [material]` flag. It iterates through the pixel buffer, identifies the grayscale index (0-4), and replaces it with the target hex from the material ramp.

---

#### Standardizing the Palette: AAP-Splendor128
To ensure visual cohesion and "premium" aesthetics, all generated assets adhere to the **AAP-Splendor128** palette.

*   **Logic**: 128 colors with smooth, natural ramps for skin, wood, and metal.
*   **The Snap Flag**: Use `--snap aap-splendor128` in the processing script.
*   **How it works**: The script calculates the **Euclidean distance** from every pixel to the nearest neighbor in the palette.
*   **Benefit**: Eliminates "Dirty Blacks" and "AI Noise" by forcing every pixel to a hand-picked, vibrant hex code.
### The Super-Sample Wash (Geometric Assets)
For assets with strict geometric shapes (like Ingots or Planks), standard Point Sampling can result in "jaggy" lines due to subtle AI line wobble.
*   **Technique**: Use the `--super` flag in `process_art.cjs`.
*   **Process**: 
    1.  **Lanczos Smooth**: Resize to 256px first to average out AI wobbles into smooth anti-aliased paths.
    2.  **Point Lock**: Resize the 256px result to 64px using Nearest Neighbor to lock the "average" into the pixel grid.
### 1. Modular Material Snapping (Oklab)
The `process_art.cjs` script uses **Oklab Perceptual Snapping** instead of raw RGB distance. This prevents color drift and keeps the "Vibrant" look intact.

#### The Modular Tag System:
Instead of a single global palette, we use comma-separated **Tags** to build a context-aware snapshot palette:
```bash
--snap universal,iron,glint
```
*   **universal**: Loads [universal_palette.json](file:///data/palettes/universal_palette.json) (Outlines, Shadows, Glints).
*   **[material]**: Loads a specific ramp from [materials_library.json](file:///data/palettes/materials_library.json).
*   **[optional]**: Any other custom palette file found in `/data/palettes/`.

### 2. Output Formatting
*   **Bit-Depth**: 8-bit PNG.
*   **Transparency**: Boolean alpha (0 or 255) for crisp pixel edges (no semi-transparency).
*   **Scale**: Consistent 64x64 grid for game-readiness.
*   **Result**: Straighter, more stable edges that maintain the pixel-art aesthetic.

### Step 5: Final Registry Integration
The chosen variant is renamed to the final asset name and linked in the registry.

### Step 6: The Asset Library (Safe Spot)
To ensure we never lose the source quality and maintain a clean production environment:
1.  **Production Spot**: The 64px icon is saved to `public/assets/icons/[category]/[item_id].png`.
2.  **The High-Res Library**: The original 512px crop (High Fidelity) is saved to `raw_assets/library/[category]/[item_id]_highres.png`. 
3.  **Naming Sequence**: Use `snake_case` for all IDs (e.g., `copper_sword`, `red_potion`).

### The "Pure Point" Washing Philosophy
*   **Zero Blurring**: We avoid Lanczos/Bicubic scaling which "smears" colors.
*   **Integer Downsampling**: We use **Nearest Neighbor** to pick every 16th pixel (1024 -> 64).
*   **100% Vibrance**: Colors are never averaged, ensuring the AI's intended palette remains punchy.
*   **High-Res Masking**: Background removal (Flood Fill) happens on the high-res source *before* the downsample to ensure pixel-perfect edges.

### Step 3: UI Integration
Assets are stored in `public/assets/`.
*   **Icons**: `public/assets/icons/[category]/[name].png`

---

## 4. UI Rendering & CSS

### The `renderIcon` Helper
We use a centralized utility to handle the Emoji -> Image transition.

### CSS Enhancement (The "Sticker" Effect)
To make cutouts pop against dark card backgrounds:
```css
.game-icon--img {
    filter: drop-shadow(1px 1px 0px black); /* Hard 1px shadow */
    image-rendering: pixelated; /* Keep it crisp */
}
```

---

## 5. Animation Strategy
For simple loops (e.g., flickering torch), we prefer **CSS Sprite Strips** (2-4 frames side-by-side) over heavy GIFs.
*   **Format**: Side-by-side PNG.
*   **Method**: CSS `steps()` animation.
















