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
