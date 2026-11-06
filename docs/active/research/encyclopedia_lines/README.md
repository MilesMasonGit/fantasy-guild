# Encyclopedia: what a line means (brief 470 E1)

Status: the owner picked **C** (2026-11-06); built in brief 470 E2. Pictures of the built chart are in
[`built/`](built/) (`<page>_<width>.png`; `_lit` the pointer resting on a box, `_tip` a word's hover): the four pages
above and a large chart (`large_left`, `large_right`) at 1366 and 1920 wide; the other kinds (forest: beside, built on;
stump: leaves, grows; ironfurnace: makes; trout: catch; birdnest: bonus; wheatseed and guildhall: the Hall's gives;
recipe: a recipe's makes; farmland: builds) at 1920. Made by `_tools/built.mjs` on the server of
`_tools/vite.e2.config.mjs`; `built/checks.json` holds every page's checks at both widths (no word over a box, mark,
tab or another word; every word in capitals with no outline; its letters inside the room the layout kept; the chart
clear of the progress bars).

The owner (2026-11-04): "the Iron Woodaxe chains into the trees, which is accurate but it's different than an Oak Tree
producing Oak Wood." Today every line on the chart is the same solid ink line with an arrow, whatever it means.

**Pick from [`contact_lines.png`](contact_lines.png)**: a close-up of the owner's own example at true size, then four
real chart pages (Iron Woodaxe, Oak Wood, Iron Ingot, the Smoking Crater Map as a rare drop) with the four looks side
by side. Full-size pictures: `<page>_<letter>.png` (`woodaxe_`, `oakwood_`, `ingot_`, `raredrop_`).

## Every relationship the chart draws today

Counted over the whole encyclopedia from the game's content (`_tools/census.mjs`, one line per pair of boxes). "Left"
is a box's ways in, "right" its uses. **Today every row is drawn the same**: a 2 px solid ink line, an arrowhead where
it reaches a box, twice as thick on the hovered path. The things on a line are the skill mark (icon and level), the
grow or regrow mark with its time, the drop odds on the dropping box, the "or" bands, and the "‹N"/"›N" tabs.

| Relationship | Example | Lines | Family in B, C, D | Word in C |
|---|---|---|---|---|
| Ingredient used up in a recipe | Iron Ore → Iron Ingot | 365 left, 175 right | used up | (none) |
| Station where it is made (one station, or a station type of several) | Smithing Station → Iron Ingot | 241 left, 136 right | needed, kept | made at / makes |
| Foundation a building is built on | Farmland → Oak Forest | 51 right (inside the 241 left) | needed, kept | built on / builds |
| Tool a Token needs, kept | Iron Woodaxe → Oak Tree | 88 right | needed, kept | tool for |
| Token another needs standing nearby | Oak Forest → Oak Tree | 2 right | needed, kept | beside |
| A worked Token gives an item (veins, trees, wells) | Oak Tree → Oak Wood | 65 each side | comes out of | gives |
| A chest opened gives an item (same rule as working) | Iron Chest → Iron Ingot | (inside the 65) | comes out of | opens |
| Fishing spot gives a catch | Lake → Trout | 11 each side | comes out of | catch |
| Enemy drop | Fire Elemental Chief → Smoking Crater Map | 63 each side | comes out of | drops |
| Bonus drop from an effect | Birdwatcher → Bird Nest | 1 each side | comes out of | bonus |
| A Token spawns a Token or enemy | Goblin Camp → Goblin, Oak Forest → Oak Tree | 26 left, 21 right | comes out of | spawns |
| Growing stage grows into the next (folded into a grow mark) | Oak Sapling → Oak Tree | 16 right | comes out of | grows |
| A chopped Token leaves a stump (regrow) | Oak Tree → Oak Stump | 14 left | comes out of | leaves |
| Seed or seedling planted (spent by a spawn, grow or regrow) | Oak Seedling → Oak Tree | 27 | used up | (none) |
| Bait used up catching | Worm Bait → Lake | 6 | used up | (none) |
| Shop price used up buying | Oak Wood → Farmland | 7 each side | used up | (none) |
| Guild Hall gives (Passive Production, an upgrade) | Guild Hall → Wheat Seed | 4 | comes out of | gives |
| A recipe's page to what it makes | Search a Bird Nest → its finds | 124 right | comes out of | makes |
| Station type opened to its stations | Smithing Station → Furnace | when opened | needed, kept | one of |
| Found on world cells (words, no box) | "Trees ring 1, settled on the world map" | 88 | unchanged | (none) |

The shared stretch of a way into its box (from the join to the arrow) is drawn "used up" when anything along it is
used up (a recipe, a planting), else as its one source (a drop is doubled all the way). A chest is the same rule as
working a Token in the content; only its word differs.

## The options

| Letter | What it is | Drawn by | Cost |
|---|---|---|---|
| **A** | **Today**: every line solid ink with an arrow. | code | none; the owner's complaint stays |
| **B** | **Line styles, ink only**: used up stays today's solid line; needed and kept is **dashed with a hollow arrow** (nothing flows along it); comes out of is a **doubled line** (two 2 px strokes, the page between). A small key in the chart window's bottom-right corner. | code (SVG strokes), no art | no extra width or words on the chart; the key takes a corner (bottom-right, clear of E3's bars bottom-left); doubled lines are 6 px wide, so the hovered path needs its own thickening rule; ⚠️ the inner stroke must take the band's tone on a band |
| **C** | **Words on the line**: today's lines, plus a small ink word on every line that is not used up: made at, tool for, gives, drops, spawns, opens, beside. | code | the most explicit, the most clutter: at today's 200 px gap a word only fits beside a one-digit skill mark, so most "tool for" words had to sit over the mark (see the Iron Woodaxe page); doing it properly needs the gap between columns about 60 px wider. Words go in `en.json` and must read in All caps |
| **D** | **Styles in colour**: B, with **blue ink** for needed and kept and **green ink** for comes out of. | code | the clearest at a glance; ⚠️ UI_STYLE gives green the meaning "ready, enough", so a green line is a new use of a meaning colour and needs the owner's OK; blue is new to the book |

In every option, resting the pointer on a line could name it in a sentence ("Iron Woodaxe: the tool for chopping an
Oak Tree, kept"): that is E2's hover, not pictured. No option changes boxes, folding, the glide, "or" bands or the
lit path.

**Considered and not mocked up**: tools and stations in their own lane or entering a box from its top. It moves boxes
out of the "or" bands they belong to (the station belongs to one way of making the ingot, not to the others), and the
chart's layout would be rebuilt rather than restyled.

## Recommendation

**B**, with E2's hover sentence on each line. It answers the owner's example on sight (the axe's lines to the trees
are dashed, the Oak Tree's line to Oak Wood is doubled), adds nothing to the page but a small key, uses no new colour
meaning, and keeps the columns as they are. C reads best word by word but crowds the skill marks; D is B plus a colour
question for the owner.

## How the pictures are made

`_tools/` (throwaway): `vite.e1.config.mjs` runs the game on port 5409 with its own cache; `capture.mjs` starts a New
Game in a headless browser, adds one hero at 15 in every skill, opens each page with the encyclopedia's own look-up,
clicks the boxes named, pans with the chart's own wheel, and evaluates `inject.js`, which works out each drawn line's
relationship from the chart's own code and restyles it per option; `contact.mjs` builds the comparison page;
`census.mjs` counts the relationships. `raw/` is regenerated and not kept.
