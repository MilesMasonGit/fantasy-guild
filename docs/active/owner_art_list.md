# Owner art list

What the owner draws, in one place, so art is ready before the code that uses
it. Sizes are in art pixels (1 art pixel = 1 pixel in the file). Status:
**ADAPT** = existing art needs edits; **NEW** = to draw. Update this page as
pieces are finished (strike them or delete the row).

Sources: [research/terrain_art_list.md](research/terrain_art_list.md) (owner
answers L-1 to L-10, 2026-10-09) and
[research/animation_menu.md](research/animation_menu.md) (owner picks,
2026-10-09). Pixel frames need no art: the demo's two pictures ship
(UI_STYLE "Pixel frames").

## 1. Terrain

**Decided look**: same pixel size as Tokens (the 16 px set,
`public/assets/playmat/terrain/template/ter_*.png`), **muted and a little
dark**: about 85 % brightness and 70 % colour of today's sheets. One
**seamless** 64 × 64 sheet per ground (four copies in a 2 × 2 square show no
seam), 6–10 colours, quieter than Tokens (lower contrast, no dark outlines).
Edges, beach rims, shallows and blends between biomes are done in code:
nothing to draw for them. Terrain code comes with brief 80, after the Atlas.

| Piece | Size | Status | Notes |
|---|---|---|---|
| Muted grass, earth, rock, sand, water sheets | 64 × 64 each (5) | **ADAPT** | Re-colour today's `ter_grass`, `ter_dirt`, `ter_stone`, `ter_sand`, `ter_water` to the muted palette (or brief 80 tints them in code; draw only if the tint looks wrong) |
| Gravel (scree) ground for Mountain | 64 × 64 | **NEW** (or ADAPT from rock) | Lighter loose stones, showing through rock in clumps |
| Grass and rock alternates (optional) | 64 × 64, 1–2 each | **NEW** | So the repeat hides; consider 128 × 128 |
| Forest scatter: wildflowers ×2–3, mushrooms ×1–2, fallen leaves/twigs ×1–2 | 16 × 16 | **NEW** | Flat; must not look workable |
| Forest scatter: ferns / grass tufts ×2 | 32 × 32 | **NEW** | |
| Mountain scatter: pebbles ×2–3, hardy grass tufts ×1–2 | 16 × 16 | **NEW** | No boulders or crystals (those are Tokens) |
| Mountain scatter: flat cracks ×2 | 32 × 32 | **NEW** | |
| Coast scatter: shells ×2, starfish, seaweed | 16 × 16 | **NEW** | |
| Coast scatter: driftwood, reeds ×1–2 | 32 × 32 | **NEW** | |
| Wet-rock scatter (Mountain + Coast) ×1–2 | 16 × 16 | **NEW**, low priority | |

⚠️ `prop_tree_oak` and `prop_tree_maple` are also the Oak and Apple Sapling
Tokens' art; don't redraw them as scenery.

## 2. Effect animations

**Owner's format (2026-10-09): 8 fps (125 ms a frame, like the hero
animations), 64 × 64 cells** to match the Tokens they play over, as a
horizontal strip. The cell sizes below were the research's suggestion; the
owner's 64 × 64 replaces them. Progress is slow and nothing is ready yet; the
player for these is T-138 (built when the first strips exist).

| Effect | When it plays | Frames | Research cell size (superseded: 64 × 64) |
|---|---|---|---|
| Falling leaves | Forestry strikes on trees | 6 | 16 × 16 (or 3 leaf variants 8 × 8) |
| Rock chips and sparks | Mining strikes | 4 | 16 × 16 |
| Dust puff | Construction strikes, buildings finished, Tokens landing | 5 | 32 × 16 |
| Water splash or ripple | Fishing | 5 | 32 × 16 |
| Anvil sparks | Smithing strikes | 4 | 16 × 16 |
| Wood chips | Sawing / woodcutting stations | 4 | 16 × 16 |
| Steam or smoke puff | Cooking stations while worked (loops) | 6 | 16 × 24 |
| Hit spark | A landed combat hit | 3 | 16 × 16 |
| Knockout poof | An enemy beaten | 5 | 32 × 32 |
| Grain puff | Farming | 4 | 16 × 16 |
| Level-up sparkle | A hero levels | 4 | 16 × 16 |
| Rare shine | A rare item on the floor | 4 | 16 × 16 |
| *Later*: loot glint, used-up crumble | — | 3 / 4 | 8 × 8 / 64 × 64 |

## 3. Other art already asked for

- A **quill icon** for the hero panel's Edit button (brief 30 eye-check).
- Hero **recolour presets** need the hero sprites split into recolourable
  parts (clothing, skin): D7, design detail to come.
