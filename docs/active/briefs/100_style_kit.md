# Brief 100 — The style kit

First of the UI work from the owner's refinement pass (queue order ruled
2026-10-14: foundations first). Every later brief (110–170) copies its pieces
from this one, so it runs first.

**Source of truth:** [`UI_STYLE.md`](../../reference/UI_STYLE.md) (owner
interview 2026-10-13). Not a concept doc: the style guide itself is the
approval.

**Branch:** `crunch/style-kit`. **Eye-check:** yes, once, at the end: the owner
reviews the whole kit on the style sheet page.

## K1 — The style sheet page (T-159, builder)

- **Read:** UI_STYLE.md whole, T-159.
- **Change:** a Dev Tools screen showing every standard piece live, built from
  the shared pieces that exist; a section for *new, unapproved* pieces. The
  five colours become shared CSS variables.
- **Done when:** every piece UI_STYLE lists appears on the page; tests and
  build green; screenshot in the report.

## K2 — One arrow-bar scroll list (T-160, builder)

- **Read:** UI_STYLE "Lists and scrolling", T-160.
- **Change:** one shared component replacing the four hand copies named in
  the ticket; it joins the style sheet page.
- **Done when:** all four screens use it and scroll as before in the running
  game (click, hold, wheel, dimmed ends).

## K3 — Text sizes and the shared tooltip (T-161, T-038, T-030, builder-lite each)

- **T-161 + T-038:** the three text sizes and the display size as shared
  classes the Text size setting scales; correct the written sizes to what
  renders (no visible change). Panels move onto them as later briefs touch
  them; don't sweep every panel here.
- **T-030:** one shared tooltip that follows the cursor, flips at screen edges.
- **Done when:** both appear on the style sheet page; tooltips across the Bank,
  Shop and hero panel use the shared one.

## Ride-alongs for every later brief

T-162 (pixel sprites replace vector icons) and T-036 (one panel header) are
done screen by screen as briefs 110–170 touch each screen, not here.

## Owner to-do

- Look over the style sheet page and give verdicts (eye-check file).
- No CMS work.
