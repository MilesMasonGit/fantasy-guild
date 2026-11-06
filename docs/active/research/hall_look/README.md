# Guild Hall look: mock-ups to pick from (brief 390 G1)

*2026-11-05. Pictures only: nothing in the game has changed. Made from the running game (real sky,
real stars from `data/hallStars.json`, real panel), with the screen changed in place by a throwaway
script (`_tools/inject.js`). A guild some way in: Forestry and the Hearth well along, a few stars
of each state.*

**Pick one letter from each picture.** Today's look is always one of the options.

## Stars: `contact_stars.png`

| | What | Art | Cost to build (G2) |
|---|---|---|---|
| **A** | Plain star, as today | none | nothing |
| **B** | The item's outline, big (3x) and faint, **behind** the star, coloured by the star's state | code-drawn from item sprites already in the game | small: one picture per star, made once when the sky opens; plus which item each star shows (see below) |
| **C** | The item's outline drawn **bright over** the star, with a dark edge | code-drawn, as B | as B |
| **D** | The outline as a **ring of dots** (3x), like a constellation figure | code-drawn, as B | as B |

All four are shown at the new spacing (titles under the star, rank numbers only with the pointer on
a star). Which item each star shows is my suggestion: the skill's tool for speed stars, its product
for yield, a quill for every lore (XP) star, a torch for every camp-reach star, the Well's own items.
The list is in `_tools/inject.js` (`ITEM`).

**Background**: the October sky look (`concept_guild_hall.md`, "Stars, not icons") replaced item
sprites on the stars because they cluttered the sky. B and D stay fainter than the star for that reason.

## The star panel: `contact_panel.png`

| | What | Art | Cost |
|---|---|---|---|
| **E** | The standard bronze studs frame, as today | none | nothing |
| **F** | The same frame shape drawn in purple | code-drawn (a 7x7 frame like the game's gold and red frames) | tiny: one CSS class |
| **G** | A purple "night" panel: double purple edge, deep purple fill | code-drawn, as F | tiny: one CSS class |

Only the two outer frames change; the Upgrade button and the words are G3's. Full screens:
`panel_E.png`, `panel_F.png`, `panel_G.png`.

## The whole sky: `contact_sky.png`

| | What |
|---|---|
| **H** | Today: today's spacing, titles beside the star, rank numbers always on |
| **I** | New spacing: 1.4 times as spread out, titles under every star, no rank numbers until hover, plain stars |
| I + B, I + C, I + D | I with each star look, to judge clutter across the whole sky |

The spacing is a scale in code (no change to star places, no CMS pack). Measured: at 1.4 no title
touches another title, a star or a constellation name; today 7 do (1.25 is also clear, by a smaller
margin). The cost: the sky is bigger, so more of it is reached by dragging (the dashed box is one
1920 x 1080 screen). Full size: `sky_H_today.png`, `sky_I.png`, `sky_I_B.png`, `sky_I_C.png`, `sky_I_D.png`.

## Remaking the pictures

`npx vite --config docs/active/research/hall_look/_tools/vite.g1.config.mjs` (port 5405), then in
`_tools/`: `node capture.mjs panel`, `node capture.mjs sky 1.4`, `node contact.mjs`.
