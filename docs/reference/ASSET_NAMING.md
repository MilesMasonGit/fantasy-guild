Status: approved 2026-10-16 (owner interview with the director)

# Asset names and folders

How every picture under `public/assets/` is named and filed. New art follows
it; the art reorganisation renames the existing files to it once. Decided by
the owner, 2026-10-16.

## The name

`<prefix>_<category>_<type>_<variant>.png`, lower case, words joined by `_`,
general to specific:

- **prefix**: one letter for the top-level kind (below). It names the kind
  only: a pick is a tool, a tool is an item, so a pick is `i_`.
- **category**: the group, the same word as the sprite's folder. It repeats
  the folder on purpose, so a name read on its own (in the CMS list) still
  says what it is.
- **type**: what the thing is, then its state or shape if it has one.
- **variant** last: material, colour, or another distinguishing word. Recolours
  of one drawing therefore sit side by side (`…_pick_copper`, `…_pick_iron`).

No pixel sizes in names (every sprite is drawn at its game size), no frame
numbers, no `final`, `new`, `v2` or dates.

| Prefix | Kind | Top folder | Example |
|---|---|---|---|
| `t_` | Token | `tokens/` | `tokens/forest/t_forest_tree_oak.png` |
| `i_` | item: materials, tools, gear, food, drink, potions | `items/` | `items/tool/i_tool_pick_copper.png` |
| `h_` | hero portrait: class, then `f`, `m` or `n` (female, male, neutral) last | `heroes/` | `heroes/h_bard_f.png`, `heroes/h_bard_m.png` |
| `e_` | enemy | `enemies/` | `enemies/goblin/e_goblin_archer.png` |
| `p_` | prop: scatter on the ground | `playmat/props/` | `playmat/props/p_flower_red.png` |
| `g_` | ground sheet | `playmat/terrain/` | `playmat/terrain/g_grass.png` |
| `u_` | UI and icons | `ui/` | `ui/u_star_gold.png` |
| `b_` | background, card and banner art | `backgrounds/` | `backgrounds/cards/b_cards_guild_hall.png` |
| `s_` | skill icon | `skills/` | `skills/s_cooking.png` |

Nine letters, none reused. Tools, gear, food and potions are items (`i_`);
only Tokens use `t_`.

## Folders

**Kind, then one group, two levels at most** (`tokens/forest/`,
`items/potion/`, `enemies/goblin/`). The groups follow the game's own
categories; the exact list is drafted with the rename list and approved by
the owner. Today's deeper folders (the 20 potion folders) flatten into their
group. Where a kind has few files (heroes, skills, UI) there is no group level, and its names have no category word either.

## Spritesheets

An animation is one spritesheet, never loose frames. The sheet takes the
still sprite's name plus `_sheet` and sits in the same folder:
`enemies/animal/e_animal_cow.png` and `enemies/animal/e_animal_cow_sheet.png`.
A sprite with several animations names each: `…_sheet_walk`, `…_sheet_attack`.
Source sheets that are cut into separate sprites (the props) live in a
`sheets/` folder beside them.

## What leaves the project

The `waste`, `maybe`, `unused` and `archive` folders, loose animation frames
(`_0001` files from processing sheets) and `_raw` processing copies are
deleted. Git history and the owner's desktop backup keep them. Anything the
game still uses is moved into the right folder first (2026-10-16: 14 sprites
in `unused` and `maybe`, among them the class portraits).

## Sprite names in the game data

The name the game data uses for a sprite (the `sprite` field of a Token or
item in the CMS) is the file name without `.png`. Renaming a file renames its
sprite name too; the CMS applies the change to `data/` (a one-click "apply
renames" action, run by the owner on `main`, then Sync), so the CMS stays the
only writer of game data.
