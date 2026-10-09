# Brief 40 — Real offline progress

**Source of truth:** [`concept_offline_progress.md`](../concept_offline_progress.md)
(decisions locked 2026-10-07): exact simulation of time away, sped up; cap
24 h; a full 24 h catches up in **under 30 s** on the owner's PC; a loading
bar while it runs; a "While you were away" summary; same rules as live play;
only a closed game counts; the Time Bank retires.

**Branch:** `crunch/offline`. **Tier:** engineer for O1–O2, builder for O3–O4.
**Eye-check:** O3 (the loading bar and summary).

## O1 — Measure first (engineer, read-only + bench)

- Time a 24 h catch-up with today's ticks (expected ~4–5 min); find where the
  time goes (`npm run bench -- --cpu-prof` on a long-idle scenario).
- **Measure the desktop app minimised**: does the Tauri webview keep ticking,
  throttle, or stop? If a minimised game effectively stops, write it as one
  question for the owner (the concept's open question 3).
- Write the catch-up plan into the concept doc: step size per system, what is
  skipped during catch-up (drawing, UI events, sounds), Web Worker or not.

## O2 — Catch-up mode (engineer)

- A catch-up mode that runs the real engine at ~10× today's speed, with no
  drawing and no UI events, collecting what the summary needs.
- **Exactness gate:** the bench's fingerprint of a catch-up must equal the
  fingerprint of running the same time live (add a bench scenario for it).
- Cap 24 h; time beyond is dropped. Save once at the end; a crash mid-catch-up
  leaves the pre-catch-up save intact.

## O3 — Loading bar and summary (builder)

- A loading bar (or other visuals) while catch-up runs, so the game never
  looks frozen.
- **"While you were away"**: time away, items gained and spent, level-ups,
  Tokens depleted, heroes wounded. Level-up bubbles also wait on the hero bar
  (brief 30). Follows UI_STYLE.

## O4 — Retire the Time Bank (builder)

Remove `TimeBankManager`, the hidden widget, its presets and save fields
(old saves are refused until 1.0, so no migration). Ticket T-080 closes.
**A sleeping PC counts as closed** (owner): `TIME_OVERFLOW` from the live loop
(lid-shut gaps) goes through the same catch-up, bar and summary, up to 24 h.

**Done when:** a save closed for 24 h (simulated by editing `savedAt` on a
test slot) catches up in under 30 s with the bar, ends identical to a live run
of the same time, and shows the summary.

## Owner eye-check B (2026-10-09): fixes on `crunch/offline` before merging

O1–O4 as built were seen. **Functionally approved**; the changes are visual
plus one option:

- The summary doesn't fit the game's style. **Item rows must look as item
  rows do elsewhere in the game** (the Bank / Token Summary row style), not a
  bespoke two-column list.
- **Smoother entrance**: the summary's rows fade in and slide in from the
  side (cheap: opacity and transform only; log the cost).
- **Reject the offline time**: the summary gets a second button, **Load as I
  left it**, which discards the catch-up and reloads the untouched
  pre-catch-up save (the backup the crash-safe save keeps). The catch-up
  still always runs first (owner ruling: undo on the summary, not a prompt
  before).

**Second look (owner, same day):** definitely an improvement; remaining
rulings:
- **Item Bars.** Items are shown with the Token inspection panel's **Item
  Bar** (the Outputs design): the item sprite with its hover zoom, the count
  abbreviated by default (`5.9k`) and switching to the exact number on
  hover (`5,900`). Wider here than in the inspection panel. Not a bespoke row.
- **Simpler wording.** "Items produced" instead of "Made, waiting on the
  mat"; the other headings simplified in the same spirit (e.g. "Items
  banked", "Items spent"). Button: **"Return to the Guild"**.
- **Buttons stacked**, one above the other (side by side pushed out of the
  window): "Return to the Guild" first as the primary choice, "Load as I
  left it" below it, **with a confirmation** before it discards the catch-up.

