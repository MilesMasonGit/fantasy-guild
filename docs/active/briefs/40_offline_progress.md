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
`TIME_OVERFLOW` from the live loop (lid-shut gaps) is handled by the same
catch-up path *(director default; confirm against "only a closed game counts")*.

**Done when:** a save closed for 24 h (simulated by editing `savedAt` on a
test slot) catches up in under 30 s with the bar, ends identical to a live run
of the same time, and shows the summary.
