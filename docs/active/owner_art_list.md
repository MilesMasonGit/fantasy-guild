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
| Rare shine | A rare item on the floor | 4 | 16 × 16 |
| *Later*: loot glint, used-up crumble | — | 3 / 4 | 8 × 8 / 64 × 64 |

## 3. Other art already asked for

- A **quill icon** for the hero panel's Edit button (brief 30 eye-check).
- Hero **recolour presets** need the hero sprites split into recolourable
  parts (clothing, skin): D7, design detail to come.
- **Token card art, 256×256, one scene per activity** (NEW,
  [concept_info_layers.md](concept_info_layers.md)): the full-art backdrop
  behind a Token's card. One per Starting skill and trade (mining, forestry,
  farming, cooking, smithing and the rest); a Token can also name its own
  picture in the CMS (Token editor, **Card art**). Exists today: one fishing scene and four stations in
  `public/assets/backgrounds/`.
  - **In use since brief 120 C3**: fishing (`skills/b_fishing`), mining
    (`cards/b_mine`), smithing (`station/b_smithy`), cooking
    (`station/b_kitchen`). A spawner uses the scene of what it spawns.
  - **Missing, so those cards are plain**: forestry, farming, crafting,
    commerce, construction, and one for fights (enemies). Name a new one
    `backgrounds/skills/b_<skill>.png` (`b_forestry.png`) and the game picks
    it up for that skill with no code change.
- **Small UI icons** for the card's lines and the mat (NEW; placeholders until
  drawn): clock (cycle time), charges, regrow, spawn, grow, turn, the problem mark
  ("!", recoloured yellow and red in code).
  - **The card's icons are on the card now** (brief 120 C3), 8 × 8 drawn at
    2×, in the text colour. The placeholders are drawn in code
    (`PixelGlyph`; the style sheet page shows them under "Card icons").
    **Turn** (a Token that may turn into another) joins the list.
  - **The problem mark is on the mat now** (brief 120 C1), 16 × 16, drawn at
    the Token's own pixel size at a Token's centre with a hard black shadow.
    The placeholder is today's `ui/u_alert_yellow.png` and `ui/u_alert_red.png`;
    a new single "!" replaces both.
- **Map mode cursors** (NEW, [concept_map_tools.md](concept_map_tools.md)):
  the cursor over a Token in Disallow mode (muted grey) and in Demolish mode
  (red); about 11 × 11, drawn at 2×. Code-drawn placeholders (a crossed
  circle, an X) stand in until then.
- **Top bar icons** (NEW, [concept_map_tools.md](concept_map_tools.md)): a
  Token icon (Tokens 45/128) and an upkeep icon (Upkeep 2/min), shown at
  32 px in the bar's item bars (the Region name has no icon now: its banner
  lies behind it). Placeholders until drawn: the tree and coins from
  `public/assets/ui/`.
- **Quest board Token** (NEW 2026-10-20, [concept_quests_tutorial.md](concept_quests_tutorial.md)
  "The quest board"): one notice board standing at the bottom-left of every
  mat; placeholder until drawn.
- **Banner ribbon** (NEW 2026-10-19, [concept_notifications.md](concept_notifications.md)
  "Banners"): a wide scroll or ribbon (~480 px) with a gold-edged and a
  red-edged version, room for a big sprite on the left and two lines of text;
  the style kit's studded frame until drawn. (The log button icon is dropped
  with the log, T-193.)
- **Night-sky backdrop for the Hall screen** (**HAVE**, 2026-10-15:
  `playmat/screens/bg_nightsky_1.png` and `bg_nightsky_cloud_layer.png`;
  [concept_guild_hall.md](concept_guild_hall.md) "The look of the sky").
- **Upgrade star sprites** (NEW): one per state (locked, buyable with two
  twinkle frames, bought, maxed gold), drawn to read apart from the
  backdrop's stars; code-drawn stars stand in until then.
- **The Atlas tome** (NEW, [concept_atlas_tome.md](concept_atlas_tome.md)): a giant open book seen from above,
  filling ~90 % of the screen, as the backdrop the Atlas UI sits on; the map
  table's edge with a candle and a compass around it; ribbon bookmarks for
  the two sections. Placeholders until drawn.
- **Area banners**: the 19 in `backgrounds/area/` are in use (Region rows,
  the top bar, travel, the Cartography preview); each Base Map names one in
  the CMS, so a new Base Map may want a new banner.
