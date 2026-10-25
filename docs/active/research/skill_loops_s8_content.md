# Brief 230 S8: the content each phase asked for

*Gathered by the Systems director, 2026-10-25, from the builders' reports for
S1a–S6b (all merged on `main`). The pack's author checks every id against the
newest CMS workspace (`cms/backups/autosave_*.json` or `data/`) before writing;
these are requests, not verified ids. Owner rulings are marked.*

## Shared (S1a, S1b)

- Tick **Stays where it stands** (`staysPut: true`) on every tree, fruit tree,
  vein and Stump type.
- Optional tidy: clear the now-ignored Charges on Grandma's Kitchen, Ceramics
  Kiln, Windmill, Coast and Copper Anvil (stations and supports never wear).

## Stations (S6a)

1. **Furnace** (`token_furnace`): Station kind = Furnace.
2. **Copper Smithy** (new): Works as Smithing, kind Smithy, built on a
   Foundation. Brief 240's Iron Anvil becomes an Iron Smithy (same kind, plus a
   Work Time speed-up on itself).
3. **Smithing recipes**: Made at Furnace: `recipe_copper_ingot`,
   `recipe_mtp8qjj0`–`recipe_mtp8qjj5`. Made at Smithy: `recipe_copper_pickaxe`,
   `recipe_mtozw3la` (woodaxe), `recipe_muily2ph` (nails), the six copper weapons
   (`recipe_copper_bow`, `_cleaver`, `_dagger`, `_greatsword`, `_sword`,
   `_wand`); remove their `requiresContext` anvil entries. ⚠️ Every Smithing
   recipe must be tagged, or it shows on the Furnace.
4. **Copper Anvil**: keep the type, remove its Shop entry.
5. **Cooking**: Campfire becomes Works as Cooking, kind Kitchen, no fuel;
   Grandma's Kitchen and the Cooking Pot kind Kitchen; a new Brewery (kind
   Brewery).
6. **Cooking recipes**: food (`recipe_dough`, `recipe_mtym8vxh` Steak,
   `recipe_shrimp`) Made at Kitchen; drinks (`recipe_mtp8qjj6`–`recipe_mtp8qjj9`)
   Made at Brewery; no charcoal inputs.
7. **Alchemy Table** (new, kind Alchemy Table); its recipes Made at Alchemy
   Table. ⚠️ It must have its kind. A Summoning Circle (if content) gets kind
   Summoning Circle.
8. **Build recipes** (Construction, on Foundations, with build times: supports
   ~30 s, stations 1–2 min) for the Smithy, Brewery, Alchemy Table, and the
   supports below.

## Forestry (S2a)

- `token_oak_tree`: `respawn: { mode: 'regrow', into: 'token_oak_stump' }`,
  `staysPut`, about 5 uses, keep the 20 % seedling drop.
- New `token_oak_stump`: sprite `t_stump_oak`, `staysPut`, `clearable`, an Oak
  species tag, `grows: { into: 'token_oak_sapling', afterMs: ~150000,
  needsNearby: ['token_oak_forest'], cost: [{ itemId: 'item_oak_seedling',
  quantity: 1 }] }`.
- `token_oak_sapling`: `grows.afterMs` about 150000; Oak tag.
- `token_oak_forest`: `spawner.withinReach: true`, keep the 1 Oak Seedling
  upkeep, `clearable`; Provides Grow Time −X % to the Oak tag; built by
  Construction on a Foundation with a seed cost.
- Use a species tag, not `Forest` (a Grow Time aimed at `Forest` reaches every
  species). Other species follow the same shape (sprites exist).

## Orchards (S2b)

- `token_apple_tree`: `respawn: { mode: 'refill', afterMs: <rest>,
  restingSprite: <Bare apple, stand-in t_tree_oak>, needsNearby:
  ['token_apple_orchard'] }`, `staysPut`; keep its 3 charges and skill.
- `token_apple_orchard`: spawner `withinReach: true`, keep the 1 Apple Seed
  upkeep; Provides Grow Time −X % to `token_apple_tree`; `clearable` if maps
  place wild Orchards.
- `token_apple_sapling`: unchanged.

## Mining (S3)

- Veins (copper first; keep `token_copper_ore_vein`): `respawn: { mode:
  'refill', afterMs: 60000, restingSprite: <empty rock, stand-in t_vein_stone> }`,
  about 5 uses, `staysPut`.
- **Mine** (support): Provides Double Item Chance 25 (flat), narrowed to its ore
  only (owner: ore only, not gems), to its veins, reach nearby.
- **Minecart** (support): Provides Work Time −X % to its veins; drop the old
  `Restocks` rule (does nothing).
- Mines stop spawning veins only once the Starter Camp has its own veins (brief
  240 K0.1 + K1).

## Farming (S4)

- `token_wheat_field`: drop the spawner; Works as Farming (kind Field), a
  `config` (farming, ~3 s, xp), `needsTool` sickle, a Field block (stand-ins
  `t_farmland` / `t_garden`), a "Field" tag.
- **Wheat crop recipe** (Made at Field): 1 Wheat Seed; Wheat 1–2 plus a 40 %
  seed; `crop: { growMs: 3600000, load: 10, ripeSprite: t_field_wheat }`.
- **Herb Garden** (kind Herb Garden) with herb crops (new herb and herb-seed
  items; `t_field_lavender` as a ripe stand-in).
- **Wild Wheat Patch** (starts ripe with Wheat) for brief 240's maps and the
  Starter Camp (owner: a ready-planted Field).
- **Well**: Grow Time −X % to Fields. **Composter**: Crop Load +2 to Fields.
- **Beehive**: a Farming node; Honey (new) plus Beeswax Comb; a refill rest; a
  Double Item Chance on wheat to Fields; Fields speed its refill.
- **Windmill**: a station of kind Windmill with a flour recipe.
- Move "Plant Wheat Field" to Construction. Keep `token_wheat_sprout` and
  `token_ripe_wheat` so old ones finish and leave.

## Fishing (S5, S5b)

- Keep `token_coast` as the sea: drop `turns`, a Fishing work cycle and catch
  pools; decide its −5 % Coast rule and placement limit. New River and Lake.
- Shrimp Coast: keep the type, remove it from the Shop.
- First pools: rod no bait; rod with bait (owner's example 50 Trout / 40 Salmon
  / 10 Dolphin); trap with or without bait. Every tool used needs a no-bait pool
  (or its fish stay unpriced orphans).
- Items: fish (Trout, Salmon icons exist), bait as Consumables (from Raw Shrimp;
  worms from Farming), **a Trap** (`item_trap`, type tool, hand,
  `tool: { kind: 'fishing_trap', tier: 1, starter: true }`, sprite
  `i_fish_trap`; owner: a starter tool, probably no net item), better rods with a
  Catch Weight effect.
- A Dock effect (Work Time to the water) and a Dock Token on a Foundation.

## Work consumables (S6b)

- **Birdwatcher** potion (Consumable): "On Forestry Work Start: applies
  Birdwatcher to the hero for the cycle"; Birdwatcher: "Grants 1 Bird Nest,
  25 %". A Bird Nest item (`i_nest_bird` exists); an Alchemy Table recipe.
- **Coffee** (new drink): Work Time −10 % for the cycle; a Brewery recipe.
- **Beer** (`item_beer`): XP Bonus +10 % for the cycle.
- **Owner 2026-10-25: Water, the juices and every drink get a small work buff.**

## Art

Every needed picture is in `docs/active/owner_art_list.md` §"Skill loops";
stand-ins are named there.
