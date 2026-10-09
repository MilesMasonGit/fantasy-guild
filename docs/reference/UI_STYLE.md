# UI presentation style

**Locked by the owner, 2026-10-07.** Applies to every panel and overlay: the
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
