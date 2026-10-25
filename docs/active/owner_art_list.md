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
- **Loadout slot kind marks** (NEW, 8 × 8, drawn at 2× in the bottom-right
  corner of a hero's filled loadout slot; code-drawn placeholders in
  `PixelGlyph` until drawn, shown on the style sheet page under "Loadout slot
  kind marks"). One per equip kind, suggested name `ui/u_slot_<kind>.png`
  (swapping them in for the placeholders is a small code change):
  - Hand (a held tool or weapon)
  - Hat
  - Chest
  - Trinket
  - Food
  - Drink
  - Consumable (potions, scrolls)

## 4. Skill loops (brief 230)

From the skill loops interview (owner, 2026-10-22 to 2026-10-24,
[concept_skill_loops.md](concept_skill_loops.md)). Token size, like today's
Tokens. Stand-ins from existing sprites until drawn.

| Piece | Status | Notes |
|---|---|---|
| Stump, one per tree species (Oak first, Fir next) | **IN ASSETS** (redraw if wanted) | A felled tree waiting to regrow. `t_stump_oak`, `_birch`, `_cedar`, `_ebony`, `_fir`, `_mahogany`, `_maple` are already in `public/assets/tokens/forest/` (S2a's QA scene uses the Oak and Birch ones); no Stump Token is authored yet (S8) |
| Forest Token, one per species (Oak first) | **IN ASSETS** (ADAPT if wanted) | Plants and regrows its own species nearby. `t_forest_*` exist for the same seven species |
| Sapling and Tree per species | **IN ASSETS** | `t_sapling_*` and `t_tree_*` for the same seven species |
| A Stump waiting for its Forest or its seedling | — (no new art) | Wears the yellow problem mark (`u_alert_yellow`, the placeholder every waiting Token uses) and, when stopped, the "Needs Oak Seedling" callout in the speech frame (S2a) |
| Fruit tree: Sapling, Fruiting, Bare per fruit (Apple first) | **NEW** / ADAPT | Picked, not felled (brief 230 S2b). Fruiting: `t_tree_apple` exists. Bare: drawn in place of the tree while it rests (the CMS Respawns block's Resting sprite, per fruit); stand-in `t_tree_oak`, a tree with no fruit, so a Bare apple tree looks like an oak until drawn. Sapling: today's Apple Sapling wears `t_sapling_maple` (no apple sapling picture yet). The S2b QA scene uses these stand-ins |
| Apple Orchard | **IN ASSETS** (redraw if wanted) | `t_orchard_red`; plants Apple Saplings in its reach and speeds their fruiting |
| A Bare tree waiting for its Orchard | — (no new art) | Wears the yellow problem mark, "Needs an Apple Orchard nearby to refill" on hover (S2b) |
| Empty vein rock, one shared | **NEW** | Every ore vein while it rests (brief 230 S3: drawn in place of the vein, not greyed; its name says which ore). Stand-in: `t_vein_stone`, which the Stone Outcrop also wears, so a resting vein looks like an outcrop until this is drawn. Name the new file anything; it is picked per vein in the CMS (Respawns, Resting sprite) |
| Mine, Minecart | ADAPT | Today's Copper Mine and Minecart sprites may do (`t_mineshaft_*`, `t_minecart_*` for seven ores; the S3 QA scene uses the copper ones) |
| Field: empty, growing (shared); ripe per crop (Wheat first) | **NEW** / ADAPT | Herb Garden likewise (ripe per herb). Built in S4: the empty and growing pictures are picked on the Field Token (CMS, Field block), the ripe one per crop on its recipe (CMS, Crop row). The S4 QA scene stands in `t_farmland` (empty), `t_garden` (growing), `t_field_wheat` (ripe wheat) and `t_field_lavender` (ripe herb); a wild wheat patch on a map is a Field drawn the same way |
| Herb Garden Token | **NEW** / ADAPT | Its own picture for the Shop and build list; on the mat it is drawn by its state like a Field. Stand-in `t_greenhouse` |
| Well, Composter, Beehive, Windmill, Dock | **NEW** | Support Tokens built on Foundations. S4 QA stand-ins: `t_well_wishing` (Well), `t_lumberpile` (Composter), `t_meadow` (Beehive; greyed while it rests and refills, or a resting picture of its own if drawn: an empty hive), `t_windmill` exists |
| Honey (item) | **NEW** | What a Beehive fills with beside Beeswax Comb (`i_honey`, which the comb wears today). The S4 QA scene registers a QA Honey on `i_honey` |
| Water types: sea, river, lake | ADAPT | One fishing-spot sprite each; the Shrimp Coast goes. The S5 QA scene stands in `t_coast` (sea), `t_fish_spot` (river), `t_lake_small` (lake), and `t_foundation_wood` for the Dock |
| Smithy | **NEW** | Hero-worked; replaces the Copper Anvil |
| Brewery, Kitchen, Alchemy Table | **NEW** / ADAPT | Stations; upgrades only faster |
| Bait, worms, a work potion, two drinks (items) | **NEW** | Item icons. The S6b QA scene stands in `i_potion_donut_green` (Birdwatcher), `i_potion_donut_orange` (Coffee) and `i_nest_bird` (Bird Nest); Beer has `i_beer` |
| Fishing Net and Trap (tool icons) | **NEW** / ADAPT | Held in one hand like the rod (brief 230 S5); a new game starts with a Trap in the Bank. Stand-ins: the Trap uses `i_fish_trap`; no net picture yet |
| Fish for the first catch pools | ADAPT / **NEW** | Trout, Salmon, Shark, Lobster, Tropical Fish icons exist (`items/fish/`); a Dolphin or Crab, if the pools want them, is new |

