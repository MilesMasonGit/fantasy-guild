# UI presentation style

**Locked by the owner, 2026-10-07; extended 2026-10-13 (style guide interview).** Applies to every panel and overlay: the
hero bar and hero panel, Token inspection, the Shop, the Bank, the Token
Summary, tooltips. Layouts and positions are decided per feature in
[`docs/active/ui_rework_list.md`](../active/ui_rework_list.md); this page is
how information *reads* inside them.

The owner's complaint that started it: thick borders, boxes inside boxes, and
clunky labels like "LVL 03" where "3/99" says it better.

## Numbers

- **Levels read `3/99`.** Never "Lv. 3", "LVL 03" or "Level: 3".
- **No zero-padding** (`3`, not `03`) and **no word labels** ("Level:",
  "Charges:", "HP:") where an icon or the position already says it.
- **XP is a thin bar**; the exact number (`1,154 / 1,500 XP`) shows on hover.
- **HP is a bar**; the exact number shows on hover, except in the hero panel,
  where the bar shows its numbers beside it (owner, eye-check A, 2026-10-09).
- Times read `0:34` / `4:05`; thousands get separators (`1,154`).

## Frames

- **One frame per panel**: a single thin edge around the whole panel.
- **Rows are never boxed.** Inside a panel, separate sections with spacing or a
  faint divider line, not borders.
- No thick borders, no frames inside frames.
- **Pixel frames: nine-slice pictures** (owner, 2026-10-09; research in
  `docs/active/research/pixel_borders.md`, demo approach B). A tiny 7×7
  picture (3 px corners, 1 px edge, 1 px centre, 1 px = 1 art pixel) drawn
  with `border-image` and `image-rendering: pixelated`. **Two styles**:
  **studs** on big docked panels (drawers such as Bank and Shop, the hero
  panel, sidebars) and **chamfer** on small floating ones (tooltips, info
  pop-ups, Token inspect, toasts). **One colour everywhere.** A **hard shadow
  under every panel**: a solid black copy 2 art pixels down-right, like a
  carried Token's. The demo's chamfer and stud pictures are the shipping art,
  not placeholders (owner). The drawn line stays 1 pixel (no thick borders).

```
+--------------------------+
| Aela          Fighter    |
| HP ====------            |
|--------------------------|
| [pick] Mining      25/99 |
| [axe]  Logging     12/99 |
| [fish] Fishing      3/99 |
+--------------------------+
```

## Labels

- **Icon + name + number**: `[pickaxe] Mining 25/99`. The icon is for
  scanning, the name so nobody has to guess.
- Icons are drawn crisp at whole-pixel scales (the owner noticed fuzzy skill
  icons in the Token inspection).

## Density

- **Tight and game-like**: one line per skill or stat, small but readable
  text, panels only as big as their content. Nothing stretched to fill space.
- Remember the owner's **All caps** setting: write labels so they still read
  well in capitals.
- **New UI keeps its words in the strings file**, `src/i18n/en.json`, read with
  `t('screen.key')`, never typed into the component, so the game can be
  translated: [`TEXT.md`](TEXT.md).

## Text sizes

- **Three sizes** in panels and menus: **title**, **body**, **small** (counts,
  hints). No in-between sizes; the Text size setting scales all three.
- Celebrations on the mat (a level-up number, a Region name reveal) may use
  one extra **display** size, and only there.
- **The Region name in the mat's top bar** uses the display size too
  (`ui-text-bar-name`, owner 2026-10-23), over its banner with a hard 2 px
  black outline; nothing else in the bar does.

## Colours

Five meanings, used the same way everywhere. Everything else is the panel's
normal text colour; a new meaning needs the owner's OK.

| Colour | Means |
|---|---|
| Red | short, can't, danger |
| Green | ready, enough |
| Gold | alert, attention, upgrade, the selected tab |
| White | hover, selection |
| Muted grey | locked, unavailable |

- **Hover is a 1-art-pixel white outline**; **attention is a gold one**
  (look here: a quest ready, a level-up, a notification's highlight), which
  may pulse its colour between two golds but never move or resize; **a
  problem (stuck, no input) is a red one** (owner, 2026-10-19). No glows,
  no bobbing, no scaling (T-147, T-153).
- **Item tiles are tinted by the item's kind** (owner, 2026-10-23): Bank
  tiles and filled loadout slots sit on a dark surface tinted by the item's
  `type` (material, tool, food, drink, potion, map; `itemTint.js`), and hover
  mixes in a little white. The tint names a kind, not a state, so it never
  stands in for the five meanings above.

## The work plate (owner, 2026-10-24)

- **While a hero works a Token, one plate on the seam between them**, just below their feet:
  chamfer frame, hard shadow, over any loot at their feet. At rest it shows **what is being made**
  with the **cycle filling along its foot** in whole art pixels, and the **charges** left; while
  the Token waits, **exactly what is missing** as a red have/need pill, the frame gold (red when
  it can't go on) and the cycle held grey.
- **Resting the pointer** on the hero, the Token or the plate opens the full line: skill, output,
  charges, time to the next one, each with its tooltip. Names drop below it. Pressing it grabs
  the Token.
- It **replaces** the worked Token's work bar, "!" and charges ring; a Token nobody works keeps
  its own "!" and hover rings. No floating "-1": the plate counts down.
- A fight's link (both styles, the elixirs) will sit in the same place; HP bars stay above.

## Sprites and icons

- **Every sprite draws at a whole multiple of its art size** (1×, 2×, 3×),
  never in between, never stretched. The box is sized to the sprite, never the
  sprite to the box.
  **One exception**: an enemy sprite on a quest poster draws at exactly half
  size, to match the items there (owner, 2026-10-13).
- **Sprites on the mat stay sharp while things move.** An animation that plays
  among the resting Tokens carries `will-change: contents` (the browser then
  draws it itself rather than on a separate layer), and anything hidden on the
  mat is `invisible`, not just transparent, when it carries a soft shadow or
  blur: otherwise the Tokens in front go soft and jump a pixel (T-145;
  `npm run bench:crisp` checks it). Not on the whole mat: that cost a third
  more frame work.
- **Pixel sprites only.** No vector icon sets. Where no sprite exists yet, use
  a placeholder sprite and add the icon to
  [`owner_art_list.md`](../active/owner_art_list.md). Vector icons go as each
  screen is touched.

## Item references

An item *named* (in a recipe, a price, a drop table, an upgrade cost), not an
item held.

- **Ribbon row** (sprite, name, count: the shared `EntityRibbon`) wherever
  items are listed with room: recipes, drops, the Shop, inspection.
- **Pill** (sprite and count, name on hover) only where space is tight: inside
  buttons, the top bar, tooltips.
- **Costs read have/need**: `3/10`, the count **red** when short, normal when
  enough. Same in the Shop, upgrades and recipes.

```
[oak] Oak Log          3/10    <- ribbon, short: 3/10 in red
[Upgrade  [oak]3/10 [stone]5/5]  <- pills inside a button
```

## Panel headers

- **Title on the left** (with an optional sprite), **the red pixel close X at
  the top right**: `ui_cancel_red.png` (16 px) at 2×. Same on every panel,
  drawer and modal. Small floating pop-ups (tooltips) have no header and no X.

## Buttons

Two kinds, nothing else:

- **Main action** (Upgrade, Settle, Craft): chamfer pixel frame, gold text.
  When it can't be used it greys out and the reason shows underneath.
- **Icon button**: the bare sprite, white outline on hover.

## Tabs

- A row of **sprite + word** tabs. The open one has a 1-art-pixel **gold line**
  under it and bright text; the others are muted. Tabs are never boxed.

## Lists and scrolling

- Panels **grow tall first**, using the screen's height, then scroll. Text is
  **never cut off with "…"**: it wraps.
- **No scrollbars.** A scrolling list has an **arrow bar above and below**: one
  shared piece, not a copy per panel.
  - The arrow is a small pixel triangle drawn in code at whole-pixel scale.
  - At the end of the list that arrow **dims but keeps its space**, so the list
    never jumps.
  - **A click scrolls about two rows**, smoothly; **holding** keeps scrolling;
    the **mouse wheel** works as normal.

## Helper text

- **No banners.** Explanations go on hover, or at most one short muted line.
- **Don't repeat what the layout shows** ("Apple Juice makes 1 Apple Juice").
- Only a **blocking reason** shows inline, in red: `Needs Fishing 20/99`.

## The style sheet page

- A **Dev Tools screen shows every standard piece live** (text sizes, colours,
  outlines, ribbon, pill, header and X, both buttons, tabs, arrow bars,
  frames, bars, the tooltip). Builders copy from it; the owner eye-checks the
  whole kit there.
- **A piece the guide doesn't cover**: the builder builds it, adds it to the
  style sheet page marked *new, unapproved*, and lists it in the eye-check.
  The owner approves it into this page or asks for a change; work doesn't stop.
