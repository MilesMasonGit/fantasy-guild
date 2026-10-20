# Eye-check: the Atlas rework (tabs, Region rows, Cartography)

**Open:** http://localhost:5198/ (served by the director from branch
`crunch/atlas-rework` at fbbd1253; your folder stays on `main`). Reload.
**Save slot:** a New Game in an empty slot. Then **QA → Atlas → Grant test
maps** (the branch uses the code's test maps with placeholder sprites; your
real map items arrive when you accept the change pack and Sync on `main`).

Write `ok` or what to change after each `Verdict:`.

## The book and Regions

1. The section tabs run down the book's left side, like page tabs coming out
   from between the pages; the open one sticks out further. Click between
   them (the page turn plays).
   Verdict:
2. Settle a few Regions (below), then Regions: each row is only the banner,
   the names, Travel and "…"; the Region you're in shows the hero flag. The
   flag is the plain grey-brown one and reads weakly on pale banners: keep,
   colour it like a hero, or a dark plate behind it?
   Verdict:
3. "…" on the last row of a full page hangs a little below the row; ok?
   Tabs take ~170 px of the left page on a small window; ok?
   Verdict:

## Cartography

4. Left page: your maps as a grid of map sprites with counts. Hover one: its
   name, kind and what it adds. A map whose copies are all slotted goes grey.
   Verdict:
5. Right page: four slots (dashed map outlines when empty). Click a map, or
   drag it onto a slot; drag between slots (swap); drag a map off its slot to
   empty it (there's no Cancel button: closing the Atlas also clears the
   slots). Ok without a Clear button?
   Verdict:
6. The preview is a tiny real map of the Region (its ground, water and mini
   Tokens) lying on the Region's banner; under it, what it will hold as
   Token sprites with counts (hover names them). Settle it, Travel there:
   the mat should look like the preview.
   Verdict:
7. Each slot change or Reroll takes about a tenth of a second to redraw the
   preview (a quick burst of clicks draws once). Do you feel a hitch? If so,
   the fix is a cheaper ground plan, which needs the terrain director.
   Verdict:
8. At a large window there's a lot of empty parchment under Reroll and
   Settle. Bigger preview, bigger contents sprites (64 px), or fine?
   Verdict:
9. The placeholder sprite each test map shows: ok for now (your real map
   items pick theirs in the CMS)?
   Verdict:
