# Research: pixel-style UI borders

*Read-only research, 2026-10-09, for the "Pixel-style UI borders" item in
[`ideas.md`](../ideas.md) (Stage A). Nothing in the game was changed. The demo
is [`pixel_borders_demo.html`](pixel_borders_demo.html): open it from this
folder in any browser.*

## For the owner, in short

- Today's panels look like a web page because of three things: **smooth
  rounded corners**, **see-through hairline edges**, and **soft blurred
  shadows**. None of them exist in pixel art.
- The pixel version is: an edge exactly **one art pixel** thick (2 screen
  pixels, the size of one pixel of a Token on the mat), **solid colour**,
  **square or stepped corners**, and the **hard shadow** a carried Token
  already has (solid black, 2 art pixels down and right). That is still one
  thin frame per panel, as `UI_STYLE.md` asks.
- **Recommended: A2, "notched corners", done in code.** No art needed, any
  colour, one element per panel, cheaper to draw than today's blurred shadows.
  If you later want ornate corners, approach B (a tiny picture you draw) can
  replace it panel by panel.

## What "the hard-pixel style" is

It is the owner's look from the review-v3 shadow spike
([`SPIKE_shadows.md`](../../archive/review_v3/SPIKE_shadows.md)), now live on
sprites:

- **Hard shadow**: a solid black copy of the shape, 2 art pixels down and to
  the right, no blur (`src/config/spriteFx.js:5-7`, `:97-100`).
- **Sharp coloured outline** instead of a glow: one art pixel, on the art's
  own grid, touching edge to edge only (`src/config/spriteFx.js:33-45`;
  `src/ui/components/base/TokenSprite.jsx:110-122`).
- Both are pictures, never live CSS filters, because filters were the mat's
  biggest graphics cost (`src/tailwind.css:467-473`).

T-013 (`docs/reference/TICKETS.md:41`) asks whether the remaining glows and
label text-shadows should follow. A pixel frame is the same idea applied to
panels: solid edge, hard offset shadow, no blur.

## How frames are drawn today

**No shared panel component.** Each panel writes its own Tailwind classes;
the only shared constant is the pop-out sidebars' `PANEL_CLS`. Across
`src/ui` there are about 160 `border`, 100 `rounded*` and 70 `shadow*`
classes.

| Surface | Frame today | Evidence |
|---|---|---|
| Tooltips (bubble, top bar, quest) and Token Summary | `rounded-lg`, `bg-black/90`, 1 px `border-gi-gold/40`, blurred `shadow-[0_10px_30px_...]` | `board/Bubble.jsx:17`, `board/TopBarTip.jsx:16`, `board/QuestTooltip.jsx:61`, `board/MatCapBadge.jsx:181` |
| Pop-out sidebars (bin, etc.) | `rounded-lg`, 1 px `border-gi-border/40`, `shadow-[0_0_24px_...]` | `board/PopOutSidebars.jsx:111` |
| Hero panel (Bank side) | `bg-[#140e0b]`, one side edge `border-white/10`, blurred shadow | `dock/BankHeroPanel.jsx:126-128` |
| Work rules drawer | `rounded-t-lg`, `border-white/10`, `shadow-[0_0_24px_...]` | `dock/WorkRulesDrawer.jsx:146-147` |
| Token inspect popup | `rounded-md`, `border-yellow-500/70`, `shadow-lg`, a rotated square as its arrow | `board/TokenInspectPopup.jsx:182`, `:226` |
| Shop and Bank drawers | one side edge `border-gi-primary/30`, `shadow-[0_0_40px_...]` | `drawer/ShopDrawer.jsx:115`, `drawer/BankDrawer.jsx:67-72` |
| Modals | `rounded-lg`, `border-gi-border`, `gi-shadow-deep` (30 px blur) | `base/GIModal.jsx:54-55`, `src/tailwind.css:209-211` |
| Mat top bar | wood gradient, `border-b-2 border-[#2a1d15]`, blurred shadow | `board/MatTopBar.jsx:23` |
| Toasts | `rounded-md`, `border-white/10`, `shadow-xl`; crisis adds a glow | `base/Toast.jsx:57-60` |
| Drag-over highlight | white edge plus a 15-30 px glow | `src/tailwind.css:264-267` |

(Paths under `src/ui/components/`.)

Colours come from `@theme` in `src/tailwind.css:42-128` (`--color-gi-border`
is `rgba(255,255,255,.15)`) and `:root` in `src/styles/main.css:160-177`.
Radius tokens are 4-12 px (`src/tailwind.css:158-162`).

Rows are still boxed in places, against `UI_STYLE.md`: the Token inspection's
rows (`drawer/TokenInspection.jsx:132`, `:147`, `:221`), Shop rows
(`drawer/ShopDrawer.jsx:299`) and the skill sheet's rows
(`hero/HeroSkillSheet.jsx:93`, `:123`). A frame restyle should not copy the
frame onto those; they lose their boxes instead.

## Existing pixel UI art

- **No frame, 9-slice or corner pictures exist** in `public/assets/` or
  `raw_assets/` (searched for frame, border, slice, corner, panel, window,
  tooltip, button).
- The one UI chrome picture is `public/assets/ui/ui_bar.png` (32 x 32, a dark
  strip with studs down one edge), tiled down the side menus
  (`nav/BubbleMenu.jsx:92-96`). ⚠️ It is stretched to the menu's width
  (`backgroundSize: '100% auto'`, at least 80 or 150 px wide), so 2.5x, about
  4.7x: not whole-pixel, so its pixels are uneven. Worth a ticket.
- `public/assets/ui/` otherwise holds icons (alerts, orbs, coins, flags), not
  chrome.

## The scale a pixel frame must match

- **Art pixel = 2 screen px** in most of the UI: Token art is 64 px drawn at
  2x (`src/config/matGeometry.js:73-75`), and 16 px skill icons sit at 32 px.
  The Bank and inspection draw Tokens at 1x (`base/TokenSprite.jsx:45-53`), so
  there an art pixel is 1 px; 2 px still reads as "one pixel" next to text.
- **The DOM UI is not scaled by the game.** Only the mat is fitted with a CSS
  transform (`board/MatFitContext.jsx:4-15`); panels are plain CSS pixels.
  The real multiplier is Windows display scaling (devicePixelRatio). Benches
  run at DPR 1 (`docs/reference/PERFORMANCE.md:15`); the owner's own setting
  is not recorded anywhere. At 125 % or 150 % a 2 px edge becomes 2.5 or 3
  device pixels, so plain solid edges degrade best (see the demo's zoom
  buttons).
- **Font**: SilkPixel (Pixelify Sans letters, Silkscreen digits), smoothing
  off, sizes snapped to 12/16/20/24/32 px (`src/tailwind.css:139-145`,
  `:712-735`; body 16 px). Every text also gets a hard 1 px black outline
  with no blur (`src/tailwind.css:749-751`, `src/styles/main.css:176`), which
  already matches the hard-pixel style. The older `.gi-text-outline` adds a
  4 px blur (`src/tailwind.css:246-256`): a T-013 candidate.

## The approaches

All of these keep **one thin frame per panel**; none adds a frame inside a
frame. "Cost" is graphics work: a frame is painted once when a panel opens and
then reused, so none costs anything per frame while nothing moves.

### A1. Square hard edge (CSS only)
- **Look**: solid 2 px edge, square corners, hard black shadow.
- **Crisp at scale**: yes; solid lines just get a device pixel thicker.
- **Art**: none. Colour from a CSS variable.
- **Effort**: smallest; a class swap per panel.
- **Cost**: lower than today: a hard shadow has no blur, today's 24-40 px
  blurs are the most expensive part of these panels to paint.
- **Weakness**: square corners alone read as "flat web box" more than pixel
  art.

### A2. Notched corners (CSS only), recommended
- **Look**: A1 with each corner pixel left out, the classic pixel-art box. The
  shadow has the same notched shape.
- **How**: four hard box-shadows, one art pixel up, down, left and right of
  the box, make the edge; four black ones make the shadow. One element, no
  extra markup.
- **Crisp at scale**: yes at 100 % and 200 %; at 125 %/150 % the notch is 2-3
  device pixels, still even because it is solid colour.
- **Art**: none.
- **Effort**: small. One shared class (say `.gi-pixel-frame`, with the colour
  as a variable) in `src/tailwind.css`, then swapped into each panel.
- **Cost**: as A1 (8 hard shadows, no blur; still cheaper than one blur).
- **Watch**: the edge sits outside the box, so the box needs 2 px of room;
  `overflow-hidden` on a parent can clip it.

### B. Nine-slice picture (`border-image`, owner art)
- **Look**: anything the owner draws: chamfered corners, studs like
  `ui_bar.png`, a two-tone bevel. The demo uses 7 x 7 placeholders.
- **How**: the picture is cut into 3 x 3 corners, 1 px edges and a centre;
  the browser stretches the edges and keeps the corners. Hard shadow: a black
  copy of the same picture behind it (as the sprites' silhouettes).
- **Crisp at scale**: yes at whole scales with `image-rendering: pixelated`;
  at 125 %/150 % corner pixels go uneven (2 then 3 px), like any pixel art at
  those settings. Edges must be plain lines so stretching them is invisible.
- **Art the owner draws**: one PNG per frame style, **7 x 7 px** (3 px
  corners, 1 px edge, 1 px centre), drawn at 1 px = 1 art pixel. If a corner
  needs more detail, 9 x 9 (4 px corners). Colour is baked in, so gold
  tooltips and neutral panels need one picture each (2-4 pictures total).
- **Effort**: medium: the shared class plus a pseudo-element for the shadow;
  pictures go in `public/assets/ui/`.
- **Cost**: one tiny image; painted once like a border.
- **Watch**: a 3 art-pixel corner makes the frame band 6 px; keep the drawn
  line itself 1 pixel or it breaks "no thick borders".

### C. Stepped corners cut with `clip-path`
- **Look**: rounder pixel corners (two or more steps).
- **How**: the frame colour and the panel are two layers, each cut to a
  stepped outline; a third black layer is the shadow, since `clip-path` also
  cuts off box-shadows.
- **Crisp at scale**: yes, as A2.
- **Art**: none.
- **Effort**: medium-high: three layers per panel, and it clips anything that
  pokes out (the inspect popup's arrow, badges, a scrollbar).
- **Cost**: small for still panels; more than A2 when a clipped panel slides
  or fades, because the clip travels with it.

### D. Drawn on a canvas
- **Look**: same as A2 or B.
- **Effort**: high: a canvas per panel that must be redrawn on every resize,
  zoom and content change.
- **Cost**: the highest: script work plus an extra layer per panel. No look it
  can make that A2 or B cannot. **Not recommended.**

## Recommendation

**A2 now, B as an optional upgrade.**

1. Add one shared frame class (A2) with two colour variables: a neutral edge
   for panels and drawers, gold for tooltips. Remove `rounded-*`, the blurred
   `shadow-[...]` and the see-through edge where it goes.
2. First components, the ones that already share one look:
   - **Tooltips**: `board/Bubble.jsx:17`, `board/TopBarTip.jsx:16`,
     `board/QuestTooltip.jsx:61` and the Token Summary
     `board/MatCapBadge.jsx:181` (identical classes, one change).
   - **Pop-out sidebars**: `PANEL_CLS`, `board/PopOutSidebars.jsx:111`.
   - **Token inspect popup**: `board/TokenInspectPopup.jsx:182`; its rotated
     arrow (`:226`) becomes a small stepped triangle.
3. Then the drawers and side panels (Shop, Bank, hero panel, work rules), the
   modal (`base/GIModal.jsx:54`) and toasts.
4. Rows inside panels lose their boxes rather than gaining pixel frames
   (`UI_STYLE.md`, "Rows are never boxed").
5. If, after seeing A2 in the game, the owner wants ornate corners: draw one
   **7 x 7** PNG per frame colour (gold tooltip, neutral panel) and switch
   the shared class to B. Only the class changes, not the panels.

Measure with `npm run bench:draw -- --compare` and add a cost-log line
(`docs/reference/PERFORMANCE.md`, "UI rework cost log"); expect no change or a
small gain, since hard shadows replace blurred ones. It changes how the game
looks, so it waits for the owner's eye-check.

## Owner questions to park

- **Q1. Which frame?** (a) A2 notched, code only (recommended); (b) A1
  square; (c) B with owner-drawn corners now; (d) keep today's look.
- **Q2. Shadow?** (a) hard 2-art-pixel shadow under every panel, matching a
  carried Token (recommended); (b) no shadow at all; (c) shadow on floating
  things only (tooltips, popups), none on docked drawers.
- **Q3. Edge colours?** (a) gold for tooltips, neutral for panels
  (recommended); (b) one colour everywhere.
