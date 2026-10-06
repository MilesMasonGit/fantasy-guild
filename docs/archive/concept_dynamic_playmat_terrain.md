# Concept Document: Dynamic Playmat & Micro-Tile Terrain System

## 1. Overview & Vision
Currently, the playmat consists of flat, placeholder grid boxes for tokens. The **Dynamic Playmat Terrain System** transforms the board into an organic, living landscape that evolves as tokens are placed, moved, and interacted with.

Instead of monolithic, static square slots, each token slot is composed of a **subgrid of micro-tiles (e.g., 4x4)** that blend seamlessly with neighboring slots to create rich, continuous biomes and natural transitions.

---

## 2. Core Pillars

### A. Token-Driven Biomes
* Every token (or token category) is associated with a specific **terrain archetype / biome** (e.g., *Deep Forest, Sandy Coast / Beach, Rocky Crag, Ancient Ruins, Volcanic Plains*).
* When a token is placed on a playmat slot, the slot's terrain morphs to represent that token’s natural setting.

### B. Micro-Tile Grid Resolution (e.g., 4x4 per Slot)
* Each macro slot (where a token resides) is internally divided into a **subgrid of micro-tiles** (such as 4×4 = 16 micro-cells).
* This higher fidelity allows:
  * Non-rectangular biome boundaries.
  * Organic coastlines, meandering pathways, riverbanks, and transitional margins.
  * Flexible placement of props and sub-features.

### C. Seamless Neighbor Transitions & Blending
* Biomes are not isolated square islands. Neighboring micro-tiles react to adjacent slots:
  * **Edge Blending / Overhangs:** A beach token can spill sand tiles across the border of an adjacent water or forest slot.
  * **Autotiling / Bitmasking Rules:** Micro-tiles select appropriate edge/corner sprites based on neighboring biomes (e.g., sand-to-water transition curves).

### D. Layered Visual Depth (3-Tier Composition)
To create a dimensional, rich look, each slot renders across three primary visual layers:

```
+-----------------------------------------------------------+
| Layer 3: Props & Doodads (Trees, rocks, stumps, ruins)    |  <-- Highest Z-index (below tokens)
+-----------------------------------------------------------+
| Layer 2: Terrain Features & Blends (Edges, decals, water) |  <-- Uses transparency & bitmasks
+-----------------------------------------------------------+
| Layer 1: Base Ground Terrain (Dirt, grass, sand, stone)   |  <-- Solid foundation
+-----------------------------------------------------------+
```

1. **Base Layer (Ground):** The foundational substrate (flat grass, base stone, bedrock sand).
2. **Feature Layer (Transitions & Decals):** Overlapping fringe textures, paths, water edges, patches with alpha transparency showing the base or neighboring substrates below.
3. **Props Layer (Dimensional Objects):** Vertical elements (trees, foliage, boulders, small structures) with slight perspective/shadows that add depth to the scene.

---

## 3. Structural Breakdown

```
Playmat Macro Grid (e.g., 3x3 Slots)
┌───────────────────────┬───────────────────────┬───────────────────────┐
│ Slot (0,0)            │ Slot (1,0)            │ Slot (2,0)            │
│ [Forest Token]        │ [Forest Token]        │ [Beach Token]         │
│ ┌───┬───┬───┬───┐     │ ┌───┬───┬───┬───┐     │ ┌───┬───┬───┬───┐     │
│ │   │   │   │   │     │ │   │   │   │   │     │ │░░░│░░░│~~~│~~~│     │
│ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │
│ │ ♣ │ ♣ │   │   │     │ │   │ ♣ │ ♣ │   │     │ │░░░│░░░│░░░│~~~│     │
│ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │
│ │ ♣ │   │   │   │     │ │   │   │   │░░░│ <-- │(Sand spills into slot)│
│ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │ ├───┼───┼───┼───┤     │
│ │   │   │   │   │     │ │   │   │░░░│░░░│     │ │░░░│░░░│░░░│░░░│     │
│ └───┴───┴───┴───┘     │ └───┴───┴───┴───┘     │ └───┴───┴───┴───┘     │
└───────────────────────┴───────────────────────┴───────────────────────┘
  (4x4 micro-cells per slot create continuous coastlines and dense forests)
```

---

## 5. Layer 2: Masking & Cutout Architecture (Punching Holes)

### The Problem: Combinatorial Explosion
If we try to pre-draw every combination of terrain transitions (e.g., *Grass on Dirt*, *Grass on Sand*, *Grass with sparse patches*, *Grass on Ridge Stone*), the number of required sprite assets explodes ($N \text{ biomes} \times M \text{ neighbors} \times K \text{ variations}$).

### The Solution: Alpha Masking / Stencil Cutouts
Instead of pre-baked composite sprites, we decouple **Textures** from **Shapes**:
1. **Seamless Fill Textures:** Clean, repeating textures (pure grass, pure dirt, pure stone, pure sand).
2. **Modular Mask Library (Alpha Stencils):** A reusable set of grayscale/alpha cutout shapes:
   - **Border & Corner Transitions:** Standard 4-bit / 8-bit edge masks (straight edges, inner corners, outer corners).
   - **Ridge & Elevation Cuts:** Jagged cliff edges or sloping borders.
   - **Sparse Patch & Noise Masks:** Dithered or organic punch-out holes that create natural wear, patches of bare earth, or pebble spots.

```
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│  Layer 2 Source │       │   Alpha Mask    │       │     Result on Board    │
│  (Solid Grass)  │   ⨉   │ (Cutout Stencil)│   =   │ Grass with Dirt Holes  │
│  [▓▓▓▓▓▓▓▓▓▓▓▓] │       │ [██  ██   ████] │       │ (Dirt shows through    │
│  [▓▓▓▓▓▓▓▓▓▓▓▓] │       │ [  ████  ██   ] │       │  from Layer 1 beneath) │
└─────────────────┘       └─────────────────┘       └────────────────────────┘
```

### Key Advantages
1. **Asset Efficiency ($O(N + M)$ instead of $O(N \times M)$):** 
   - 6 biomes + 12 mask shapes = 18 assets, which can produce **dozens of biome transition combinations**.
2. **Infinite Variations:** Any mask can be applied to *any* biome pair (e.g., the same "patchy wear" mask can make patchy grass-over-dirt, patchy snow-over-ice, or patchy moss-over-cobblestone).
3. **Rotational Symmetry:** A single corner mask or edge mask can be rotated (0°, 90°, 180°, 270°) and flipped (X/Y) to cover all 4 cardinal directions and corners.

### Technical Implementation Approaches for Web/Canvas
* **Canvas 2D (`globalCompositeOperation = 'destination-out'` or `'destination-in'`):**
  - Draw the top terrain tile to a temporary offscreen buffer.
  - Apply the mask sprite with `destination-in` (keep shape) or `destination-out` (punch holes).
  - Stamp the resulting masked tile onto the main board over Layer 1.
* **CSS `mask-image` / `-webkit-mask-image`:**
  - If rendering via DOM elements/divs, apply `mask-image: url('assets/masks/patch_01.png')` directly to the micro-cell div.
* **Pixel-Art Crispness (1-Bit Alpha):**
  - For crisp retro pixel art, binary 1-bit alpha masks (fully opaque or fully transparent) prevent unwanted blurry semi-transparent edge artifacts and keep the clean pixel aesthetic intact.

---

## 6. Seam Continuity & Multi-Tier Gradient Transitions

### A. The Seam Problem: Preventing "Sawtooth" / Broken Edges
When a coastline, cliff, or biome edge crosses from one micro-tile into the next, naive random masking can produce disconnected steps or jarring sawtooth breaks.

```
Sawtooth Break (Bad):             Continuous Seam (Good):
┌──────────┬──────────┐           ┌──────────┬──────────┐
│░░░░░░\   │░░░░░░░░░░│           │░░░░░░\   │          │
│░░░░░░ \  │          │   VS      │░░░░░░ \  │          │
│~~~~~~~~│░░░\      │           │        \░░░░░░░░░│
│~~~~~~~~│░░░ \     │           │         \░░░░░░░░│
└──────────┴──────────┘           └──────────┴──────────┘
(Jarring step at border)          (Smooth shared junction)
```

#### Solutions for Perfect Seam Alignment:
1. **Standardized Edge Junction Anchors (The Border Contract):**
   - Micro-tile edge masks are designed with fixed entry/exit connection coordinates (e.g., standard entry at $Y=50\%$, $Y=25\%$, or $Y=75\%$).
   - A `Coast_East_Center` tile always meets seamlessly with a `Coast_West_Center` tile.
2. **Neighbor Bitmasking (Autotile Grammar):**
   - The engine inspects the 8 surrounding micro-neighbors (N, NE, E, SE, S, SW, W, NW).
   - The bitmask calculation determines the exact transition archetype (e.g., outer corner, straight edge, inner cove) so edge lines naturally flow into each other.
3. **Continuous Global Coordinate Sampling (Noise Thresholding):**
   - If masks are procedurally shaped, calculating the mask value from absolute board coordinates `(gridX * 16 + localX, gridY * 16 + localY)` guarantees that noise contours are mathematically continuous across tile borders.

---

### B. Multi-Tier Gradient Bands (e.g., Ocean → Shoreline/Foam → Sand)
Natural landscapes rarely transition abruptly from one state to another. They feature intermediate buffer zones (e.g., *Deep Ocean → Shallow Turquoise Waters / Foam → Wet Sand → Dry Sand*).

#### The Concentric Masking Architecture:
Rather than treating transitions as binary (Sand vs Water), we apply **multi-tiered stacked layers with nested mask thresholds**:

```
Z-Layer 3 (Top):     [Dry Sand]        (Mask Cutout Threshold: Tight / Inward)
                          │
Z-Layer 2 (Middle):  [Shallow Shore / Foam / Wet Sand] (Mask Cutout Threshold: Wide / Outward)
                          │
Z-Layer 1 (Bottom):  [Deep Ocean / Bedrock] (Solid base substrate)
```

```
Visual Cross-Section:
[  Dry Sand  ]────┐
                  ├───> [ Wet Sand / Foam ]────┐
                                               └───> [ Deep Ocean ]
```

#### How it works cleanly:
1. **Shared Contour, Different Insets:** Layer 2 (Shallow Shore) uses the same coastline curve as Layer 3 (Dry Sand), but expanded outwards by a few pixels (or with a lower mask threshold).
2. **Automatic Buffer Generation:** The foam/shallow water naturally outlines the sand coast with zero manual alignment needed.
3. **Layer Ordering Rules:**
   $$\text{Deep Water} \longrightarrow \text{Shallow Water} \longrightarrow \text{Wet Sand} \longrightarrow \text{Dry Sand} \longrightarrow \text{Grass} \longrightarrow \text{Rocky Ridge}$$

---

## 7. Layered Environmental Animations (Living Biome Effects)

To elevate the playmat from a static map to a vibrant, living world, subtle ambient animations can be applied per-layer. These effects should be gentle and atmospheric so they don't distract from gameplay or card reading.

### A. Shoreline Waviness & Water Lapping
Because we separate the **Base Ocean**, **Shallow Shore/Foam**, and **Dry Sand** into distinct layers, we can animate water movement very naturally:

1. **Foam Lapping & Receding (Mask Pulse):**
   - By smoothly expanding and contracting the **Shallow Shore / Foam Mask** inward and outward by 1–2 pixels on a 3–4 second sine cycle, the water physically appears to lap onto the beach and recede.
2. **Water Shimmer & Wave Crests:**
   - A repeating 2-frame or 4-frame animated pixel wave sprite / UV offset on Layer 1 (Deep Ocean) creates rhythmic ocean swell without needing full-screen redraws.
3. **Shoreline Foam Dissolve:**
   - Edge foam can alternate between two dithered patterns to mimic bubbling froth on the wet sand.

```
Wave In:  [Sand]====[Shallow Foam~~~~]====[Deep Ocean]
Wave Out: [Sand]==========[Foam~~]========[Deep Ocean]
```

### B. Biome-Specific Ambient Motion
| Biome | Layer | Subtle Ambient Effect |
| :--- | :--- | :--- |
| **Ocean / Coast** | Layer 1 & 2 | Water swell shimmer, shore wave expansion/contraction |
| **Forest / Woods** | Layer 3 (Props) | Gentle 1-pixel horizontal tree canopy sway, drifting leaf particles |
| **Volcanic / Forge** | Layer 1 & 3 | Slow pulsing heat glow in magma crevices, floating cinder motes |
| **Ruins / Crypts** | Layer 2 & 3 | Flickering torchlight radius, faint runic glow |
| **Meadow / Plains** | Layer 2 | Wind ripple wave crossing grass patches |

### C. Pixel-Art Animation Principles
- **Pixel-Snapped Stepping:** Motion should snap to integer pixel coordinates (or step across 2–4 distinct sprite frames) to avoid fractional-pixel blurring and preserve the crisp pixel-art aesthetic.
- **Low Overhead Compositing:** Animated masks and texture offsets can be driven by a lightweight global tick timer or CSS keyframe transforms, avoiding heavy per-frame physics or full canvas re-renders.

---

## 8. Layer 3: Props, Clustering & Macro-Features (e.g., Mountain Ranges)

Layer 3 introduces verticality and visual landmarks (trees, rocks, mountain peaks, ruins, shrines).

### A. Valid Placement Logic (Mask Collision Check)
Props must not spawn haphazardly over invalid terrain (e.g., a mountain peak or oak tree should not float in the ocean portion of a hybrid coastal micro-tile).
- **Alpha-Validation Rule:** A prop checks the alpha mask value of its anchor micro-cell. If the mask indicates water/void or an invalid substrate, the prop is suppressed or substituted with an appropriate doodad (e.g., driftwood or buoy).

### B. Macro Clustering & Connected Features (The Mountain Range Effect)
When isolated, a token might only show a couple of modest hills or a standalone copse of trees. However, when **adjacent tokens share a biome type** (e.g., two Mountain tokens placed next to each other):
1. **Ridge & Range Extension:** The system connects the peaks across the slot boundary, rendering a continuous, grand **Mountain Ridge** rather than two disconnected little hilltops.
2. **Canopy Merging:** Adjacent forest tokens merge their Layer 3 canopies into one uninterrupted, dense woodland.
3. **Neighbor Bleed & Asymmetry:** Random micro-cells reach slightly across the macro-grid boundaries, breaking the rigid square grid and creating natural, jagged silhouettes.

```
Individual Slots:                     Adjacent / Clustered Slots:
┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────────────────┐
│     ▲     ▲     │ │     ▲     ▲     │ │     ▲    ▲▲▲    ▲▲    ▲     ▲     │
│   ▲▲▲   ▲▲▲▲    │ │   ▲▲▲▲   ▲▲▲    │ │   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲   ▲▲▲   │
└─────────────────┘ └─────────────────┘ └───────────────────────────────────┘
(Isolated little hills)                 (Grand continuous connected mountain range)
```

---

## 9. The "World Painting" & Terrain Persistence Metaphor

A fundamental player experience goal is **tactile map crafting**:

1. **Persistent Terrain ("Painting the Board"):**
   - When a token is placed, it "imprints" its biome and micro-tiles onto the playmat.
   - When the token is picked up or moved, **the terrain remains etched into the board** rather than vanishing into an empty void.
2. **Player Agency in World Creation:**
   - Players can intentionally cluster related tokens to mold contiguous biomes (e.g., building a northern mountain wall, an eastern coastline, or a southern enchanted grove).
   - Even when focusing purely on resource/token efficiency, the resulting board organically evolves into a coherent, picturesque fantasy map.
3. **Overwriting & Land Transformation:**
   - Placing a new, different token over an existing terrain slot smoothly converts the micro-tiles to the new biome (with smooth transition masks blending into the neighboring old terrain).

---

## 10. Biome Taxonomy & Override Hierarchies

### A. Biome Assignment Logic
- **Map-Inherited Biomes:** Tokens originating from specific regional maps automatically adopt that region's biome profile.
- **Explicit Metadata Overrides:** Neutral tokens (e.g., special characters, non-map quest cards) define their biome explicitly in their JSON definition (falling back to a default theme).

---

### B. Core Initial Biome Roster
| Biome | Category | Base Substrate (Layer 1) | Transition Features (Layer 2) | Props & Doodads (Layer 3) |
| :--- | :--- | :--- | :--- | :--- |
| **Grasslands** | Substrate | Lush green soil / turf | Wildflower decals, dirt paths | Bushes, wooden fences, signposts |
| **Ocean / Coast** | Substrate | Deep blue water | Shallow turquoise foam, wet sand | Driftwood, buoys, seafoam ripples |
| **Forest** | Substrate | Rich loam / mossy turf | Leaf clutter, dirt clearings | Dense oaks, pine clusters, stumps |
| **Mountain** | Substrate | Slate / rocky bedrock | Scree gravel, cliff ridge cuts | Mountain peaks, boulders, crags |
| **Village / Town** | **Overlay** | *Inherits underlying ground* | Cobblestone roads, dirt paths, plazas | Houses, cottages, market stalls, lamps |

---

### C. Substrate Biomes vs. Civilization Overlays (Selective Override)
Not all biomes replace the underlying ground terrain. We distinguish between two fundamental categories:

1. **Substrate Biomes (Geographical Foundations):**
   - *Plains, Forest, Ocean, Mountain, Desert.*
   - These define the fundamental ground color, texture, and natural elevation.
2. **Civilization / Structural Overlays (Development & Settlements):**
   - *Village, Ruins, Mining Outpost, Harbor.*
   - **Selective Prop Clearing:** Placing a Village token clears wild natural doodads (felling dense trees, clearing wild boulders) and replaces them with structured buildings and geometric shapes.
   - **Path & Road Carving:** Lays down cobblestone or dirt paths in Layer 2.
   - **Substrate Retention:** It *preserves the underlying environment*—allowing for emergent contextual settings:
     - **Village on Plains:** Cozy rural hamlet with dirt lanes.
     - **Village on Coast:** Coastal fishing harbor with wooden docks.
     - **Village on Mountain:** Alpine mining settlement nestled on rocky slopes.

```
┌────────────────────────────────────────────────────────┐
│ Village Token Dropped on Forest Slot                   │
├────────────────────────────────────────────────────────┤
│ Layer 3: [Oak Trees Cleared] ──> [Houses & Cottages]   │
│ Layer 2: [Leaf Litter]       ──> [Cobblestone Paths]   │
│ Layer 1: [Grass/Dirt Ground] ──> [Retained Turf]       │
└────────────────────────────────────────────────────────┘
```

---

## 11. Summary Architecture Diagram

```
+─────────────────────────────────────────────────────────────────────────+
| [TOKEN / CARD LAYER] (Characters, Quests, Activities)                   |
+─────────────────────────────────────────────────────────────────────────+
| LAYER 3: PROPS & CLUSTERS (Houses, mountain ridges, dense tree canopies)|
+─────────────────────────────────────────────────────────────────────────+
| LAYER 2: CUTOUT MASKS & BLENDS (Road networks, foam borders, dirt cuts) |
+─────────────────────────────────────────────────────────────────────────+
| LAYER 1: BASE SUBSTRATE (Persistent terrain grid: Sand, Grass, Rock)    |
+─────────────────────────────────────────────────────────────────────────+
```

---

## 12. Key Exploration Topics & Next Steps

1. **Road & Path Auto-Connecting:** How roads from adjacent Village / Settlement tokens connect across slots.
2. **Micro-Tile Data Schema (JSON):** Defining token biome properties, prop lists, and placement probability weights.
3. **Technical Performance & Compositing Strategy:** Offscreen canvas rendering buffers, CSS tiling, or WebGL batching.





