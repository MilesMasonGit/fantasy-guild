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
- **A hero's HP on the hero bar and sheet: the numbers over a stepped pixel bar**
  (`VitalBar`; owner, 2026-11-02): a smooth fill on a plain black edge, no ticks
  (owner's pick, 2026-11-05).
- **HP elsewhere is a bar**; the exact number shows on hover, except on the mat, where a fighter's bar is a small
  edition of the hero bar's, the same tones on a stepped black edge, its numbers written on it, `17/30` (owner's pick F,
  2026-11-05).
- Times read `0:34` / `4:05`; thousands get separators (`1,154`).

## Frames

- **One frame per panel**: a single thin edge around the whole panel.
- **Rows are never boxed.** Inside a panel, separate sections with spacing or a
  faint divider line, not borders.
- No thick borders, no frames inside frames.
- **Full panels have a coloured pixel backdrop** (owner, 2026-11-05; brief 400): the Bank,
  Shop, the Hall's star panel, world panels, Settings, the hero sheet, fight windows and the
  away summary. Hard bands from the panel's colour at the top down to the frame's dark fill,
  each step dithered in whole art pixels, never a smooth gradient; text keeps its contrast on
  every band. Each starts from its nav bubble's colour: Bank gold, Shop green, Atlas and world
  blue, Settings red, Hall purple; the hero sheet teal, fight windows rust, the away summary
  indigo. One shared piece: `PixelFrame`'s `backdrop` (colours in `panelBackdrop.js`).
  Tooltips, the Token card, the top bar, bubbles and buttons have none.
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
  **One exception**: the Guild Hall's own panel and its Return button wear the same two shapes
  **drawn in purple** (`ui-frame-studs-purple`, `ui-frame-chamfer-purple`; owner's pick F,
  2026-11-06), so the night sky's screen reads as its own place.

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
  **One exception**: the hero sheet's skills are icon and level, two side by
  side, with the name in the hover tip (owner, 2026-11-02). In a narrow window
  there the level drops its `/99`, which the tip keeps.
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
  black outline; nothing else in the bar does. The banner is drawn at 3× and
  runs on under the bar's middle, fading out; the badges there keep their own
  dark fill.

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
- **Hard pixel, everywhere** (owner, 2026-11-04 and 2026-11-06): no soft
  glow, soft shadow or blur anywhere in the game (dev pages aside). A shadow
  is a hard black copy down-right (panels, the problem mark, the state
  badges on a Token, the drag refusal mark); an outline is hard, in a
  meaning colour (the Token Summary lights a type with the gold one). Words
  wear the game's global **1 px** black outline, the mat's words included (a
  name under the pointer, the −1); the 2 px outline stays only on the Region
  name banner. An inline `textShadow` loses to the global outline, so none is
  written. `HardPixelShadows.test.js` checks `src/ui` and the style sheets.
- **Item tiles are tinted by the item's kind** (owner, 2026-10-23): Bank
  tiles and filled loadout slots sit on a dark surface tinted by the item's
  `type` (material, tool, food, drink, potion, map; `itemTint.js`), and hover
  mixes in a little white. The tint names a kind, not a state, so it never
  stands in for the five meanings above.
- **Small pieces in the kit** (owner, 2026-10-24, pixel frames round two):
  item tiles and filled slots are square with a 2 px line in the frames'
  bronze (`--color-ui-frame`), white on hover; empty slots are dark wells;
  buttons are `KitButton` (the chamfer frame with its hard shadow) in three
  tones: main (gold words, the shine), plain (muted words, white on hover) and
  danger (red words); switches are `PixelSwitch`/`PixelToggle` (square track
  and knob, a meaning colour when on); sliders are `ui-range` (flat, square
  thumb). No rounded corners, soft shadows or glows on any of them.
- **Speech on the mat** (owner, 2026-10-24): hero speech, the hero bar's
  level-up alerts and hover status and every callout use one `SpeechFrame`: the chamfer frame
  with its hard shadow and a stepped pixel tail, white words; the frame is
  bronze for news, gold for attention, red for "can't". They rise and fade
  but never scale.

## The work plate (owner, 2026-10-24)

- **While a hero works a Token, one plate on the seam between them**, just below their feet:
  chamfer frame, hard shadow, over any loot at their feet. It never shows **what is being made**
  (the Token's art says that; owner 2026-10-27). At rest: the **cycle filling along its foot** in
  whole art pixels and the **charges** left; while the Token waits, **exactly what is missing** as
  a red have/need pill, the frame gold (red when it can't go on) and the cycle held grey; with
  neither, the **skill icon**, so every plate keeps one shape.
- **Resting the pointer** on the hero, the Token or the plate opens the full line: skill, the
  problem, charges, time to the next one, each with its tooltip. Pressing it grabs the Token.
- **A Token's name sits over its art's bottom edge**, on the plate's top line, so it reads just
  above any plate and never moves when one comes or goes (owner, 2026-10-29). A small Token's
  plate stands where a full-size Token's would, so its name sits under the small art, on the
  same line. Heroes' names still drop below their plate.
- **The hovered Token's name and gear draw over everything but the plates** (owner's list,
  2026-11-02): its art stays where it stands, behind whatever is in front of it, and heroes are
  always over Tokens, so without this a hover could bring up a name nobody can read. A hero's
  name and health bar stand with their figure, over every Token. A plate is over heroes' feet.
- **One gear size on a Token** (owner, 2026-10-29): the gear is drawn the size of the "!" mark
  (its 16 px sprite at the Token's art pixel), on a Foundation, a station with nothing chosen
  and a station with a recipe alike. A choice waiting shows the yellow "!" at rest; the moment
  the pointer reaches the Token, the "!" becomes the gear in its spot, with no rest delay.
- **A Token nobody works**, once the pointer rests on it, gets the **same plate under itself**
  (owner 2026-10-27): its problem, charges, the time to its refill, growth, ripening or turn, a
  quest's progress, a spawner's count, as apply; nothing to say, no plate. Its "!" stays on the
  Token at rest. Enemies get none (name and HP only). **No round rings on the mat**; the Token
  inspection keeps its own. No floating "-1": the plate counts down.
- **A fight has no plate** (owner's pick F, 2026-11-05): its **fight button**, the crossed swords in the
  chamfer frame with no shadow (owner), stands **between the two fighters' health bars**, its middle on
  theirs, and opens the fight's detail view. An enemy's special move (it lands an effect or does not
  hit; a plain hit, named or not, never bubbles on the mat) or a status landing is said in the
  speech frame over the bar of the fighter it is about; floats rise over the fighter, under the bar.

## Fight windows (owner, 2026-11-05)

- **A window, "like an operating system's"**: the chamfer frame and hard shadow, a title bar
  ("Kira vs Goblin", "vs" muted) that drags it, then a **minimize** button (a gold bar at its
  foot, drawn in code, the X's size) beside the red close X. Several open at once; the one pressed
  is on top; Escape closes the top one.
- **One narrow column** (pick B): the battle with the fighters at 2×, the hero's `VitalBar` with
  its numbers over each fighter; the stat block as one shared column (owner, 2026-11-05): a row a
  stat, its icon in a 20 px middle column (the hero's style, Hit, a clock, a shield), the hero's
  value right-aligned to its left and the enemy's left-aligned to its right, body type, bold
  numbers, no captions (the icon's tooltip names the row); the enemy's attacks in small type tiles, the last
  gold-edged and "just used"; effects in two columns; elixirs and the Log button at the foot.
- **A minimized window is a tab** (pick D): faces at 1× cropped to 44 px, both names, two small
  `VitalBar`s. Tabs stand in a strip along the mat's foot above the hero bar, from the left.

## The world map (owner's picks C and D, 2026-11-06; brief 380)

- **The view pans down from the mat** to the map, as the Guild Hall's glides up; no book. The
  top bar leaves with the mat; the hero bar and the nav stay.
- **A painted world beneath** (pick D): a colour field per kind of land, wobbly borders, a
  darker ink line where lands meet, sand on shores, tiny pixel symbols; past the rings shown it
  fades into fog. **No hexes past the third ring** unless the guild can reach into a wild ring.
- **Cells are board tiles** (pick C) at 2x: the top in the land's colours, the side in its
  earth, a hard shadow on the world; the place's commonest Token stands on it at 1x (a big one
  at half), its first three outputs in a dark plate below the middle, "+N" for the rest.
- **Ring lines** are a rope with a knot at each corner, along every edge where rings meet; no
  numbers anywhere.
- **Cell looks**: settled and settle-able in full colour; **can be settled now**: a 2-art-pixel
  gold outline pulsing between two golds (steady under reduced motion); on the frontier but too
  dear, or behind a ring star: darkened; further out: black and white. The pointer over any cell
  shows it in full colour with the 1-art-pixel white outline; the chosen cell keeps it.
- **The guild's place** carries the hero job flag (`FlagMark`), drawn at 48 px, on the map and
  in the panel's header; no "the guild is here" words.
- **The hover tip**: the place's name as its title, its land and line under it, then the price
  as pills (sprite, have/need in the 9.9k shorthand, red when short). No ring, no yields. A cell
  behind a ring star adds one small line naming the Guild Hall star ("Light the Guild Hall's
  Charted Roads star to settle here"), never the ring's number (brief 380 M4).
- **The inspection panel**: one studs frame, thin (336 px), over the map's right edge: the name
  (a rename once settled), the land and line, the close X; then what it yields as ribbons, its
  price as rows, and a large main **Settle** across the panel's width (greyed with what is short
  under it, or with the ring star's line when its ring waits for one), or, once settled, its mat
  drawn small, its facts and a large **Travel**.

## The Guild Hall's upgrade ceremony (brief 390 G4)

- **Hard pixels, held frames**: a burst is rays of square art pixels (the sky's 2×) thrown out
  past the star in four held frames of 70 ms, white, white, gold, dark gold; a finished
  constellation's has six frames and sixteen rays. Light along a line is a six-art-pixel dash that
  hops whole steps (`steps()`), never a glide. No glow, blur or scaling.
- **Reduced motion**: one burst frame and the whole line lit, held still, then gone.
- **Once, while the sky is open**: never on load, after time away or for a rank bought while the
  Hall was closed.

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
- **The icon rule** (owner, 2026-11-02; audit in
  [`icon_audit_2026-10-29.md`](../active/research/icon_audit_2026-10-29.md)):
  - **Pixel** for anything that is a thing in the world: items, Tokens, skills,
    heroes, enemies, statuses, hearts, locks. Where no sprite exists yet, use a
    placeholder sprite and add the icon to
    [`owner_art_list.md`](../active/owner_art_list.md).
  - **Lucide** for meta marks and the app's own controls: nav bubbles, Settings,
    the start screen, small panel buttons (search, select, edit, expand), and on
    the mat the hero's job flag (`FlagMark`) and the gear slot icons.
  - **No emoji** anywhere a player can see.
  - Where a panel already has pixel art for the same idea (the close X, a lock),
    the pixel version wins.
  - **An item not found yet** is the pixel "?" (`PixelGlyph` `unknown`) wherever its
    sprite would be; **a locked Bank tab** shows the pixel lock (`lock`): both code
    placeholders on the art list. The loadout's slot marks are Lucide (`slotIcons.js`).
  - **A skill with no icon yet** draws the one shared placeholder, a plain pixel
    stone (`SkillIcon`); a skill never falls back to its emoji.

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

## The item tooltip and the Bank's window (brief 400)

- **The item tooltip**: the name as its header, the count right under it, then the type
  lines (type, what it equips as, its tool) and the tags. Where there is no inspection window
  (the Encyclopedia's card) the details follow; in the Bank they are the window's.
- **The Bank's inspection window** sits along the Bank's foot under a divider (part of the
  panel, not a frame inside it): the sprite at 4× on its kind's tile surface, name, count,
  kind, details, collected this run, then the book and the X at its top right. The tile it
  shows has the white selection line. *New, unapproved.*

## The title screen (brief 450)

- **The game's name in the display size over a picture, the slots beneath** in one chamfer
  window (`ui-text-title` heading, rows unboxed). Stand-ins until the owner's art exists: the
  name written out with the hard 2 px outline, and the `b_guild_hall` banner. The owner's files
  replace them with no code change: **`public/assets/ui/u_title_logo.png`** (the logo, drawn at
  the largest whole multiple that fits the slots' width and 240 px) and
  **`public/assets/backgrounds/title/b_title_painting.png`** (the painting, covering its box at a
  whole multiple). Three looks are built (`TITLE_LOOK` in `titleArt.js`): **framed** (the
  picture in a studs frame the slots' width, the name on a plate at its foot; the default
  until the owner picks), **backdrop** (the picture fills the screen) and **strip** (a band at
  3× fading at its sides). *New, unapproved.*
- A slot's stats are Lucide: heroes, playtime, and the time away (an hourglass; `24 h (max)` past
  the cap), whose tip gives the last save (`AWAY_REPLACES_LAST_SAVED`; false shows both). A slot whose save can't be read
  says **Damaged** in red, and keeps Load and delete.

## Panel headers

- **Title on the left** (with an optional sprite), **the red pixel close X at
  the top right**: `ui_cancel_red.png` (16 px) at 2×. Same on every panel,
  drawer and modal. Small floating pop-ups (tooltips) have no header and no X.
  **One exception**: the hero sheet's close and edit stand in the side space
  beside it, where the Bank's hero column stands (owner, 2026-11-02). In that
  column a hero's name sits on a dark stepped plate over the portrait's foot
  (owner's pick, 2026-11-05).

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
- **No scrollbars.** A list with more to scroll to has an **arrow bar above and
  below**: one shared piece, not a copy per panel. **A list that fits has no
  bars**, and no space kept for them (owner, 2026-11-02).
  - The arrow is a small pixel triangle drawn in code at whole-pixel scale.
  - At the end of a list that scrolls, that arrow **dims but keeps its space**,
    so the list does not jump while it is scrolled.
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
