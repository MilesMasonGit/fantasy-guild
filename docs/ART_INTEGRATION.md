# Art Integration Strategy

> **Status**: Planning Phase
> **Purpose**: Roadmap for transitioning from placeholder emojis to custom art assets without disrupting the existing UI.

---

## 1. Core Philosophy: Graceful Degradation
The system should support a "hybrid" mode where some content has custom art while others remain as emojis. This allows to be added art piece-by-piece rather than requiring a massive "big bang" update.

### Data Schema Update
We will introduce an optional `img` property to all registry entries (Cards, Items, Enemies, Biomes).

**Example (`itemRegistry.js`):**
```javascript
// Current
iron_sword: {
    id: 'iron_sword',
    icon: '⚔️', // Fallback
    // ...
}

// Future
iron_sword: {
    id: 'iron_sword',
    icon: '⚔️',           // Always keep for fallback/text logs
    img: 'items/weapons/iron_sword.png', // Priority display
    // ...
}
```

**Resolution Logic:**
1. Check if `img` property exists AND file is valid (optional runtime check).
2. If yes -> Render `<img>` tag.
3. If no -> Render `<span>{icon}</span>`.

---

## 2. Rendering Architecture

### The Problem
Currently, renderers directly output HTML strings like:
```javascript
`<span class="card-icon">${item.icon}</span>`
```
Refactoring this one by one later will be tedious and error-prone.

### The Solution: `RenderUtils` Helper
We will abstract icon rendering into a single utility function. This becomes the **Single Point of Truth** for art display.

```javascript
// src/ui/utils/RenderUtils.js (Proposed)

export function renderIcon(entity, classes = '') {
    const baseClass = 'game-icon';
    
    // Check for custom image
    if (entity.img) {
        return `<img src="./assets/${entity.img}" 
                     class="${baseClass} ${baseClass}--img ${classes}" 
                     alt="${entity.name}" />`;
    }
    
    // Fallback to emoji
    return `<span class="${baseClass} ${baseClass}--emoji ${classes}" 
                  role="img" 
                  aria-label="${entity.name}">
                  ${entity.icon || '❓'}
            </span>`;
}
```

---

## 3. CSS & Layout Normalization

Emojis are text; Images are blocks. To make them interchangeable without breaking layout, we must force them to occupy the same coordinate space.

### CSS Tokens
We will define standard sizing variables for icons to ensure consistency.

```css
:root {
    --icon-size-xs: 1rem;   // Inline text icon
    --icon-size-sm: 1.5rem; // Slot icon
    --icon-size-md: 2.5rem; // Card header icon
    --icon-size-lg: 4rem;   // Hero portrait / Biome background
}

.game-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
}

/* Force images to behave nicely */
.game-icon--img {
    width: 1em; /* Scales with parent font-size by default */
    height: 1em;
    object-fit: contain; /* Prevent aspect ratio distortion */
}

/* Emojis sometimes need help centering */
.game-icon--emoji {
    line-height: 1;
    font-family: "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
}
```

---

## 4. Scaling & Resolution Considerations

Different UI contexts require different sizes (e.g., Inventory Slot vs. Card Header).

### Single Source vs. Multi-Size
Since this is a web-based UI, we can rely on browser scaling for most cases rather than manually creating strict mipmaps.
*   **Recommendation**: specific source assets at **256x256px** (or 512px for hero portraits). This is large enough for "Detail Views" but small enough to load efficiently.

### Dynamic Sizing Strategy
The `renderIcon` function should allow checking specific size contexts, but primarily rely on **CSS inheritance**.

**1. Context-Based Classes**
We will pass a `size` prop to `renderIcon(entity, size)`:
*   `xs` (16px) - Inline text logs
*   `sm` (24px) - Inventory grid
*   `md` (48px) - Card slots
*   `lg` (64px+) - Headers/Portraits

**2. Pixel Art vs. High-Res**
If we choose a **Pixel Art** style, we MUST enforce distinct CSS rules to prevent blurriness:
```css
.pixel-art {
    image-rendering: pixelated; /* Crisp edges */
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
}
```
If using **Vector/Painted** art, standard browser interpolation is fine.

### 3. The "Readability Risk" at Small Sizes
While we *can* technically scale a 256px image down to 16px, it doesn't mean we *should* rely on it looking perfect.
*   **Fidelity Loss**: Scaling down indiscriminately causes "mosh" — fine details disappear and lines become noisy.
*   **Art Design Rule**: Art should be designed with a **strong silhouette** and minimal noise so it remains readable when shrunk.
*   **Alternative**: If high-detail scaling looks bad, we can support "Variant Icons" (e.g., `iron_sword_sm.png` specifically drawn for 16px), but this increases asset workload significantly. For now, we will assume **Single Source** and prioritize identifiable shapes.

---

## 5. Asset Organization (Proposed)

We should establish a clean directory structure for assets early to avoid clutter.

```
/public/assets/
├── ui/              # Generic UI elements (frames, buttons, panels)
├── icons/
│   ├── items/       # Inventory icons
│   ├── skills/      # Skill badges
│   └── actions/     # Status effects / Action verbs
├── portraits/       # Hero faces
├── cards/           # Card illustrations (larger art)
└── biomes/          # Background textures
```

---

## 5. Implementation Roadmap (Future)

1.  **Refactor Phase**: Create `RenderUtils.js` and replace standard `${icon}` interpolations in existing Renderers with `renderIcon()`.
    *   *Effect*: No visual change, but code is ready.
2.  **Pipeline Phase**: specific folder in `public/assets` and configure build tool (Vite/Webpack) to serve static assets correctly.
3.  **Content Phase**: Begin adding `img` paths to `itemRegistry.js` for a small test batch (e.g., just Potions).
4.  **Polish Phase**: Adjust CSS `object-fit` and centering as real art lands.

---

## 6. Best Practices for Art Creation

To ensure icons look good at **SM (24px)** and **MD (48px)** while keeping the **256px** source:

1.  **Canvas Setup**: Work on a 256x256 canvas.
2.  **The "Zoom Out" Rule**: Constantly check your work at 10-20% zoom. If you can't tell what it is at that size, simplify the design.
3.  **Thick Lines**: Avoid single-pixel lines at 256px. They will vanish when scaled down. Use bold strokes.
4.  **High Contrast**: Subtle gradients often turn into mud at small sizes. Use strong, distinct colors.
5.  **Margins**: Leave a small buffer (e.g., 10-20px) around the edge of the 256px canvas so the icon doesn't touch the borders when scaled.

---

## 7. Animation Strategy (Lightweight)

You requested support for simple 2-frame cycling (e.g., a pickaxe moving, or a torch flickering). We can handle this efficiently using **CSS Sprites**.

### The Technical Approach
Instead of heavy GIFs or multiple image files, we use a single "strip" image.
*   **Format**: A single PNG containing both frames side-by-side (Width: 512px, Height: 256px).
*   **Data Schema**:
    ```javascript
    torch: {
        id: 'torch',
        img: 'items/torch_anim.png',
        frames: 2,  // Tells renderer this is a sprite
        // ...
    }
    ```

### The Rendering Logic
The `renderIcon` function adds a specific class and CSS variable:
```javascript
// RenderUtils.js logic
if (entity.frames > 1) {
    return `<div class="game-icon animated-icon" 
                 style="background-image: url(${entity.img}); 
                        --frame-count: ${entity.frames};">
            </div>`;
}
```

### The CSS Magic
We use the `steps()` timing function to instantly "snap" between frames rather than sliding.
```css
.animated-icon {
    width: 1em; height: 1em;
    background-size: calc(100% * var(--frame-count)) 100%;
    animation: sprite-cycle 1s steps(var(--frame-count)) infinite;
}

@keyframes sprite-cycle {
    from { background-position: 0 0; }
    to { background-position: 100% 0; }
}
```

### Why this is better than GIF:
1.  **Performance**: Single GPU texture, no per-frame decoding cost.
2.  **Control**: We can pause the animation via CSS (e.g., only animate when `cardInstance.isWorking` is true).
3.  **Crispness**: GIFs often have color banding; PNG sprites support full alpha transparency.

---

## 8. Beyond Sprites: CSS Micro-Animations

CSS is powerful for adding "Juice" without needing new art assets. We can combine static images with code-driven motion.

### Supported "Native" Effects
We can add these properties to any entity in the registry (e.g., `animEffect: 'float'`):

1.  **Floating/Bobbing**: Gentle up-down sine wave. Good for flying enemies or magic items.
2.  **Breathing/Pulse**: Subtle scale (98% to 102%). Good for "Boss" enemies to make them feel heavy.
3.  **Shaking**: Random X/Y translation. Good for "taking damage" feedback.
4.  **Flash**: Brightness filter 100% -> 500% -> 100%. Good for "hit" frames.

### Particle Effects logic
**Can we do particles? Yes, but with limits.**

*   **Simple "Shiny" Effects**: ✅ **Yes**.
    *   *Technique*: A CSS `::after` pseudo-element with a white gradient sweeping diagonally across the icon.
    *   *Cost*: Nearly zero. Great for "Rare" items.
    
*   **Complex Explosions/Rain**: ❌ **No (Not via CSS)**.
    *   *Reason*: animating 100 individual HTML elements for a fire explosion is too heavy for the browser layout engine.
    *   *Solution*: **Pre-rendered Sprites**. If you want a cool explosion, render it in your art tool (After Effects / Aseprite) and export it as a 10-frame Sprite Strip (Method #7). This looks better and runs faster.

---

## 9. AI Asset Generation Workflow

Since you are using an AI assistant (Me) to build this, we can streamline the art pipeline significantly.

### My Capabilities
**Yes, I can generate images for you.** I have access to image generation tools that can create assets directly within our session.

### Proposed Workflow
1.  **Context**: You tell me "Make an icon for the Iron Sword."
2.  **Generation**: I use my image tool to generate a 256x256 PNG based on our style guide (thick lines, high contrast).
3.  **Review**: You see it immediately in the chat/preview.
4.  **Integration**:
    *   If you like it: I save it to `public/assets/icons/items/iron_sword.png`.
    *   I automatically update `itemRegistry.js` to add `img: 'icons/items/iron_sword.png'`.
    
### Advantages to "In-House" Generation
*   **Context Awareness**: I know the item's lore, stats, and tier, so I can tune the image (e.g., "It's a Tier 1 sword, so make it look rusty/chipped").
*   **Style Consistency**: We can define a "System Prompt" for art (e.g., "dark fantasy, cel-shaded, black outline") and I will apply it to every request, ensuring your Potion matches your Sword.

### External Tools?
You are free to use Midjourney/Stable Diffusion if you want very specific control. If you do:
1.  Generate elsewhere.
2.  Drop files into `public/assets/...`.
3.  Tell me "I added art for the sword, please link it."

---

## 10. The Hybrid "Vector-Pixel" Strategy

You asked if we can do **Pixel Art style using Vectors**.
**Yes, and it is a very clever technique.**

### How it works
Instead of a raster image (grids of colors), we write SVG code that draws **exact squares** on a coordinate grid.
*   **The Look**: Identical to pixel art.
*   **The Tech**: It is mathematically perfect. When zoomed in, edges remain razor sharp (no blur).

**Example Code:**
```xml
<svg viewBox="0 0 16 16">
  <!-- Draw "pixels" as vector rectangles -->
  <rect x="5" y="7" width="1" height="1" fill="#000" />
  <rect x="6" y="7" width="1" height="1" fill="#000" />
</svg>
```

### Pros
1.  **Crispness**: Solves the "blurry browser scaling" issue completely.
2.  **File Size**: extremely small (often smaller than PNG for simple icons).
3.  **Recoloring**: We can use CSS classes inside the SVG (e.g., `<rect class="blade-color" ...>`) to change an Iron Sword to a Gold Sword using *only CSS*.

### Cons
1.  **Generation Complexity**: I have to write code to draw every single pixel. This is harder for me than just "imagining" a PNG, but I can do it.
2.  **No "Grit"**: You lose the ability to have noisy textures or subtle lighting. It looks very "clean" retro (like Shovel Knight), not "grimy" retro (like Dark Souls).

**Recommendation**: This is the **Gold Standard** for clean indie games. If you like the look of the "Pixel Candle" I made (which is technically this method!), this is the way to go.

---

## 11. Production Impact: Vector-Pixel Art

You asked how the "Code-Heavy" nature of this style affects development.

### 1. Generation Speed (FASTER)
*   **Traditional**: I ask the Image Model for a "Sword". It takes 10-20 seconds to "paint" it.
*   **Vector-Pixel**: I ask my Code Model (the one chatting with you) to "Write SVG code for a Sword." It takes 1-2 seconds.
    *   **Result**: We can iterate much faster. "Make the handle longer" is an instant code edit, not a re-paint.

### 2. File Size & Storage (LIGHTER)
*   **PNG**: ~5-10KB per icon. 1000 items = 5MB to download.
*   **SVG**: ~0.5KB per icon. 1000 items = 0.5MB.
    *   **Result**: The game loads instantly.

### 3. Complexity "Ceiling" (LOWER)
*   **The Limit**: I am writing code to place rectangles. I cannot "code" a photorealistic dragon face with 10,000 unique shades of color. 
*   **The Aesthetic**: apt for **Iconic/Symbolic** art (See: Minecraft items).
*   **The Risk**: If you later decide "I want a painted portrait of the King," this method fails. You would need to mix-and-match (SVG for items, PNG for portraits).

### 4. Dynamic Recoloring (HUGE PERK)
We can generate **One** sword file: `sword_base.svg`.
In the game code:
```javascript
// Render generic sword with different palettes
renderIcon('sword_base', { palette: 'iron' })  // Greys
renderIcon('sword_base', { palette: 'gold' })  // Yellows
renderIcon('sword_base', { palette: 'void' })  // Purples
```
*   **Result**: We need 1/10th the number of art assets.

---

## 12. Style Guide: The Vector-Pixel Standard

To ensure consistency across hundreds of generated SVGs, we will adhere to these strict rules.

### 1. The Grid: 32x32 (Primary Target: MD/48px)
You indicated that **MD (48px)** is the most important size. A 16x16 grid looks too blocky at that size.
*   **Recommendation**: We will author at **32x32**.
*   **Why 32?**:
    *   At **MD (48px)**: It looks detailed (each "pixel" is 1.5 screen pixels).
    *   At **SM (24px)**: It scales down cleanly (0.75 ratio), remaining readable.
    *   At **XS (16px)**: It will lose some detail, but since this is a "secondary" size, we accept this trade-off for better art elsewhere.

### 2. The Palette: Limited & Shared
To avoid a "clown vomit" look, we restrict colors.
*   **Outlines**: Always `#000000` or extremely dark purple `#1a0b1a`.
    *   *Rule*: All objects must have a 1-pixel outline.
*   **Shading**: 2-Tone maximum (Base color + 1 Highlight or Shadow).
*   **Restricted Hues**:
    *   Metals: `#bdc3c7` (Iron), `#f1c40f` (Gold), `#8e44ad` (Mythic).
    *   Wood: `#8e5e3a` (Base), `#5e3a1f` (Dark).

### 3. The Composition: Centered & Iconic
*   **Padding**: Leave at least 1px of empty space on all sides.
*   **Perspective**:
    *   Items (Weapons/Tools): **45-degree angle**.
    *   Resources: **Front-facing pile**.

### 4. Code Template
Updated for 32x32 grid:
```xml
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <title>item_id_here</title>
  <!-- Example: A more detailed blade -->
  <rect x="14" y="4" width="4" height="20" fill="#bdc3c7" />
</svg>
```

</svg>
```

---

## 13. The Official Art Style: "High-Bit Fantasy"

We have established a single, consistent art direction for the project. These rules apply to every asset generated.

### The Baseline Prompt
> *"Style: SNES/32-bit Vector-Pixel. Vibrant colors, distinct black outlines, clear readability. Focus on 'Iconic' representation over realism."*

### Core Tenets
1.  **Solid Outline**: Every object must have a **1px solid black (`#000000`) outline**.
    *   *Exception*: **Elemental/Organic Parts** (Fire, Water, Leaves, Magic) may use colored outlines (e.g., Dark Red for Fire) to look softer and more glowing.
2.  **Standard Lighting**: Light source is always **Top-Left**. Highlights go on top/left edges, Shadows on bottom/right.
3.  **Vibrant contrast**: Avoid muddy mid-tones. Use high-saturation colors to ensure the item is readable at 24px (SM size).
4.  **Perspective**:
    *   **Items/Weapons**: 45-degree angle (Bottom-Left to Top-Right).
    *   **Resources**: **Isometric** (Minecraft Style).
        *   **Geometry**: Use distinct "Parallelogram" tops for bars (Short Left Axis, Long Right Axis). Avoid perfect diamonds.
        *   **No Gaps (Precision Fill)**: Fills must precisely match the coordinates of the enclosing Silhouette Outline (Start X to End X). The outline is drawn on top, ensuring 100% coverage without overpainting the background.
        *   **No Opacity**: All pixels must be **100% Opaque**. Do not use alpha channels. Calculate the blended color and use the solid hex code (e.g., `#eef2f3`).
        *   **Distinguished Edges**: Internal face boundaries must be sharp and distinct.
            *   **Crease Lines**: Use a darker shade of the base color to separate faces. **Do NOT use black outlines** inside the silhouette.
            *   **Rim Lighting**: Use bright/white highlights on top-left edges.
            *   **Wrapping**: Ensure top-face colors wrap over the edge (1px depth) before the side-face color begins.

5.  **Technical Constraints (Critical)**:
    *   **Rects ONLY**: For "Pixel Art" style, use `<rect>` elements for every pixel. **Do NOT use `<path>`** for fills, as they create anti-aliased diagonal lines that break the grid illusion.
    *   **Grid Compliance**: All coordinates must be integers matching the 32x32 grid.
    *   **Slope Ratios**: Use strictly 2:1 or 1:1 pixel steps for diagonals.


### Fine-Tuning Keywords
Use these standard terms to adjust specific assets:
*   **"Condition"**:
    *   *Pristine* (Default): Clean lines, new look.
    *   *Weathered*: Chipped edges, rust pixels orange/brown.
*   **"Material"**:
    *   *Matte*: Standard finish (wood, stone).
    *   *Metallic*: High contrast diagonal banding.
    *   *Magical*: Glowing internal pixels, floating particles.

### Character Standards: "True Chibi"
Heroes and Enemies must follow these proportion rules to fit the 32x32 grid while remaining expressive.
*   **Head Size**: Large (approx 12-14px height). ~40-50% of the total sprite.
*   **Eyes**: **"Anime Style"**. Large (3-4px tall), sparkly (white pixel highlight), small mouth. Expressive.
*   **Body**: Small, compact. Limbs are 2-3px thick.
*   **Variation**: **Static Class Sprites**. We generate multiple "Skin/Hair" variants per class (e.g., `hero_warrior_a`, `hero_warrior_b`). We do NOT use dynamic paper-dolls for armor.
*   **Facing**:
    *   **Heroes**: Face **Right**.
    *   **Enemies**: Face **Left**.

### Color Logic: "Material Based"
We reject arbitrary "MMO Tier Colors" (e.g., Purple = Epic).
*   **Realism**: An Iron Sword looks grey. A Gold Sword looks yellow.
*   **Recoloring Strategy**: For equipment, we generate a **Base Asset** (e.g., `item_plate_armor.svg`) using a standard "Grey" palette. We then use CSS/JS to swap these colors for specific variants (Mithril, Adamantite).
    *   *Note*: Future specific color palettes TBD.

### Visual Metaphors (Items vs Skills)
We rely on **Context** rather than visual gimmicks to distinguish types.
*   **No Artificial Borders**: A sword icon is just a sword, whether it's an item or a skill.
*   **Skill Readability**: Skills are often displayed in smaller UI slots (e.g., buff icons). Therefore, Skill assets must be **Extra Simple**.
    *   *Rule*: Verify Skill icons at **XS (16px)** size. Complex details must be removed.

### Animation Rules
*   **Breathing (Idle)**: Heroes and Enemies will breathe (gentle squash/stretch 98%-102%).
    *   *Constraint*: Only plays when the unit is in an **Active Slot** (Working/Fighting). Idle units in the roster are static.
*   **Hit Flash**: Disabled.
### Enemy Standards: "Lighthearted Monster"
*   **Tone**: **"Dragon Quest"**. Round, goofy, distinct silhouettes. Avoid "scary/jagged".
*   **Outline**: Standard 1px Black.
*   **Vibe**: Even a skeleton should look a bit cute (big head, round bones).

### Item Standards: "Chunky Iconography"
*   **Proportions**: **"Warcraft Style"**. Thick handles, wide blades. Exaggerated features to read at small sizes.
*   **Rarity Exceptions**:
    *   **Common/Uncommon**: Strict Black Outline.
    *   **Common/Uncommon**: Strict Black Outline.
    *   **Rare/Legendary**: Allowed to break rules with **Colored Outlines** (e.g., Gold glow) and **Sparkles**.

### Environment Standards
*   **Projects (Buildings)**: **"Illustration Style"**.
    *   **Size**: Double (64x64) or Quad (128x128).
    *   **Detail**: High detail "portraits" of the structure (Forge, Altar).
*   **Areas (Biomes)**: **"Background Style"**.
    *   **Format**: Panoramic art meant to sit *behind* the Area Card content.
    *   **Style**: Muted, atmospheric, less contrast (so text pops over it).
*   **UI Resources**: **"Literal"**.
    *   **XP**: Use text "XP" or very simple shapes. Avoid "Item-like" icons to prevent confusion with inventory.
















