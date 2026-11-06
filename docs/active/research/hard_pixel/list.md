# Soft glows and shadows in the game (brief 460, P1)

Counted 2026-11-06 on `main` 56f91e97: `src/` CSS, Tailwind classes, inline styles and canvas code
(`drop-shadow`, `text-shadow`, `box-shadow`, `shadow-*`, `blur`, `filter`, `shadowBlur`, `ctx.filter`,
`radial-gradient`), judged by what each one draws. Picture: [`sheet_before_after.png`](sheet_before_after.png)
(one page, before and after side by side), and each row on its own as `pair_*.png`.

## What was found

| Kind | Live and soft (to change) | Soft but never shows | Soft CSS nobody uses | Dev pages (out of scope) |
|---|---|---|---|---|
| Drop shadow (filter) | 9 | 0 | 0 | 0 |
| Box shadow / glow | 4 | 0 | 15 (variables, classes, one keyframe) | about 11 |
| Text shadow | 0 | 4 | 1 | 0 |
| Blur | 0 | 0 | 1 | 2 |
| Canvas `shadowBlur` / `ctx.filter` | 0 | 0 | 0 | 0 |

**The big change since T-013**: the ~105 label text shadows and ~65 alert-icon glows it counted are gone.
What is left is **13 soft effects actually drawn**, nearly all on the mat's small marks.

⚠️ **The game's global text outline wins over every inline text shadow.** `tailwind.css` gives every
element `text-shadow: var(--text-outline-dark) !important` (a hard 1 px black outline). An inline
`style={{ textShadow }}` has no `!important`, so it never shows: checked in the running game
(`getComputedStyle` on the dock name and the work plate's number both read the global 1 px outline).
That makes the four soft text shadows harmless dead code, **and** it also silently drops seven *hard*
outlines builders wrote on purpose (the plate's number, the fighters' HP numbers, the fight panel's
words; table 3). Side finding, not soft: worth a ticket.

## 1. Live soft effects (P2 changes these)

Proposed hard versions use only what `UI_STYLE.md` already has: the hard black copy down-right (panels,
the problem mark), the 1-art-pixel outline in a meaning colour (white hover, gold attention, red problem),
the 2 px hard black text outline (`ui-text-outline-2`, the Region name).

| # | Where | What it draws | Soft today | Proposed hard version | Job? | On the sheet |
|---|---|---|---|---|---|---|
| 1 | `src/ui/components/board/TokenBadges.jsx:140` (`TokenNameBadge`) | A Token's or hero's name under the pointer, on the mat | `drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]`: a dark smudge under the letters (and a drawing layer while shown) | **B**: the 2 px hard black outline (`ui-text-outline-2`). A (filter just removed) leaves only the global 1 px outline | **Legibility**: on light grass at 1366 the 1 px outline alone is weak; 2 px reads better than today | rows 1, 2 |
| 2 | `TokenBadges.jsx:89` (`TokenChargeDeltaFloater`) | The −1 / +50 charge number | same soft drop shadow | same as #1 (B) | **Legibility** (amber on light green) | rows 2, 3 |
| 3 | `TokenBadges.jsx:219` (`StationGearBadge`) | The recipe gear on a station or Foundation (gold outline while unset) | `drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]` | `drop-shadow(2px 2px 0 #000)`: a black copy one mark-pixel down-right, as `ProblemMark` has | no: the gold outline does the separating | row 4 |
| 4 | `TokenBadges.jsx:265` (`DisallowBadge`) | The red disallow mark on a Token heroes may not work | same as #3 | same as #3 | no | row 4 |
| 5 | `TokenBadges.jsx:285` (`MarkedBadge`) | The Construction icon on a Token marked for demolition | same as #3 (on a round black disc) | same as #3 | no | row 4 |
| 6 | `src/styles/components.css:85` (`[data-summary-highlight]`) | Every Token of the type hovered in the Token Summary | yellow haze, `drop-shadow(0 0 2px) drop-shadow(0 0 6px)` | the gold attention outline: four `drop-shadow(±2px 0 0 #facc15)` copies, as `[data-banner-outline="gold"]` | it says "these ones": the hard gold outline says it more clearly | row 5 |
| 7 | `src/ui/components/nav/BubbleMenu.jsx:66` | The white icon on each nav orb | `drop-shadow(0 2px 2px rgba(0,0,0,0.75))` | `drop-shadow(0 4px 0 rgba(0,0,0,0.75))`: one orb pixel straight down (2 px below md) | small: the icon is white on bright glass; the hard copy keeps that | row 6 |
| 8 | `BubbleMenu.jsx:45` | A bubble that would take the item being carried (Bank) | `ring-4` plus `shadow-[0_0_15px_rgba(34,197,94,0.6)]` green haze | the ring alone (drop the `shadow-[…]` class) | no: the ring says it | row 6 |
| 9 | `src/ui/dnd/DragGhost.jsx:65` | The refusal mark on a Guild Hall carried off the mat | `drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]` red glow, and `animate-bounce` | `drop-shadow(2px 2px 0 #000)`, and still (UI_STYLE: no bobbing) | no | row 7 |
| 10 | `src/ui/components/base/EntityRibbon.jsx:191` | An item in a ribbon (Shop, Token card, Upkeep, Atlas) grown 2x on hover | `drop-shadow-[0_6px_14px_rgba(0,0,0,0.95)]`, nearly invisible on the dark panel | none: just drop it (or `drop-shadow(1px 1px 0 #000)`, 2 px after the 2x) | no | row 8 |
| 11 | `EntityRibbon.jsx:188` | The dark box behind a ribbon's item | `shadow-inner` (soft inner shadow) on a `rounded-md` box | drop `shadow-inner`: a flat dark well (UI_STYLE "empty slots are dark wells") | no | not shown (two dark tones, no visible change) |
| 12 | `src/ui/components/board/QuestTooltip.jsx:81` | A reward pill in a quest Token's tooltip | `shadow-inner` | drop it | no | not shown |
| 13 | `src/ui/components/board/MatBoard.jsx:527`, `groundScreen.js:55` (`MAT_EDGE_CSS.insetShadow`) | The mat's darkened edge, **only while the ground picture is off**; with the ground on, the edge is drawn in ground pixels already | `inset 0 0 90px rgba(0,0,0,0.4)` | drop it and keep the 2 px light edge, or a hard dark band like the ground's rim. **Owner question** | a frame for the mat when the ground is off | not shown |

## 2. Soft text shadows that never show (remove; no visible change)

All lose to the global `!important` outline (see the warning above).

| Where | What |
|---|---|
| `TokenBadges.jsx:21` `NAME_STYLE` | `0 1px 2px #000, 0 0 3px #000, 0 0 1px #000` on the name label (#1) |
| `TokenBadges.jsx:22` `FLOATER_STYLE` | the same on the −1 (#2) |
| `src/ui/components/board/RingBadge.jsx:125` | the same on a ring's number |
| `src/ui/components/dock/DockHeroFigure.jsx:328` | `0 1px 3px #000, 0 0 4px #000` on the hero dock's name |

## 3. Hard outlines that never show either (side finding, not soft)

Same cause: inline `textShadow` without `!important`. What players see is the global 1 px outline.

| Where | Meant to draw |
|---|---|
| `src/ui/components/board/WorkPlateLayer.jsx:66` | the plate's numbers, a hard copy 2 art px down-right |
| `src/ui/components/board/HealthBar.jsx:61` | the fighters' HP numbers, an 8-way outline one unit thick |
| `src/ui/components/combat/FightPanel.jsx:126` (`EDGE`) | the fight window's words, an 8-way 2 px outline |
| `src/ui/components/base/VitalBar.jsx:47` (`NUMBER_EDGE`) | the hero bar's HP numbers, 8-way 1 px (the global one is 4 diagonals) |
| `src/ui/components/board/GuildHallBoard.jsx:358, 392, 454` (`OUTLINE`) | Guild Hall star words, 8-way 1 px |
| `DockHeroFigure.jsx:463` | the hero bar's page arrows, `2px 2px 0 #000` |

## 4. Soft CSS nobody uses (P2 deletes)

| Where | What |
|---|---|
| `src/styles/main.css:257-261` | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-glow` |
| `src/tailwind.css:181-185` (`@theme`) | `--shadow-glow`, `--shadow-rim`, `--shadow-bevel`, `--shadow-progress-rim`, `--shadow-progress-glow` (no `shadow-glow` etc. class is used) |
| `tailwind.css:287` | `.gi-shadow-deep` |
| `tailwind.css:291, 307` | `.progress-fill--yellow-chroma`, `.progress-fill--red-chroma` (triple glow); their only reference is `alertFillClass` in `boardConstants.js:116`, which nothing calls |
| `tailwind.css:324` | `.gi-text-outline` (hard 2 px plus a soft `0 2px 4px`) |
| `tailwind.css:890` | `.bubble` (`blur-[1px]`) and its `bubble-float` keyframes |
| `tailwind.css:933` | `@keyframes bloom` (animated glow) |
| `src/styles/components.css:24-28` | `.action-btn:hover` `box-shadow: var(--shadow-sm)` (the class is used nowhere) |

## 5. Already hard (no change), and not shadows

- **Hard already**: the global 1 px text outline; `ui-text-outline-2`; the level-up float's outlines
  (`gi-lvl-*`); the mat fx words (`--fx-px`); `[data-banner-outline]`; the Atlas hover outline;
  the Encyclopedia glyph outline; `ProblemMark`; the carried hero's and Token's 2-art-pixel shadow;
  the dock's alert mark, equipment grid and tab; `.gi-used`; the pixel frames' shadow layers; the Hall
  star outlines and the gold gear and orb outlines (masked copies); the work plate and speech frames.
- **Colour filters, not soft** (out of scope): `.gi-token-resting`, `.gi-token-held`,
  `.gi-token-protected`, the limp hero (`MatHero.jsx:14`), the Atlas world dimming (`WorldPage.jsx:207`),
  the recipe list's black silhouette (`RecipeList.jsx:146`).
- **Comment only**: `DockHeroFigure.jsx:237` says "a soft glow" over a drop cue that is a flat tint with
  a hard white outline.
- **Canvas**: no `shadowBlur`, `shadowColor` or `ctx.filter` anywhere; `MAT_EDGE.shadowBlur` is a number
  the ground picture uses for its own per-pixel shading.
- **Dev pages** (out of scope): `AnimationStudioModal.jsx` (glows, `shadow-*`, `backdrop-blur-md`),
  `DevSpawnItemModal.jsx` (`backdrop-blur-sm`), `TestDashboard.jsx`, `FPSCounter.jsx`, `StyleSheetPage.jsx`,
  `CombatKit.jsx`, `WorkPlateDemo.jsx`.

## How the pictures were made

The real game on a throwaway server (`_tools/vite.hp.config.mjs`, port 5408, own Vite cache), headless
Chrome, game loop stopped so before and after are the same moment. `_tools/inject.js` adds one `<style>`
holding the hard versions above; `_tools/capture.mjs` shoots each screen with it off and on, and
`_tools/contact.mjs` builds the sheet. Scenes: a new game (Elderfield) at 1920 and 1366, the S2 stress
board at 1920 and 1366, the Shop, and a real drag of the Guild Hall off the mat.

Three things the starter camp cannot show were drawn with **their own markup from `TokenBadges.jsx`**
on a real Token: the −1 (switched off in the game, `CHARGE_FLOATERS = false`), the demolition mark (the
starter camp's Tokens cannot be demolished) and the gold gear (no station there has a recipe to pick).
The disallow mark, the name labels, the summary highlight, the nav bubbles, the drag ghost and the Shop
hover are the game's own. The "item over the Bank" ring was switched on by adding its classes.
