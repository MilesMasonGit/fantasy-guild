# Concept — real offline progress

**Status:** decisions locked by the owner, 2026-10-07. No roadmap or code yet;
a crunch track. Replaces the Time Bank (ruled 2026-10-06).

## The idea

When the player returns to a closed game, the game **simulates the time they
were away exactly**, as if they had watched: work cycles, spawns, growth and
turns, upkeep, fights and wounds. A loading bar shows it happening, then a
"While you were away" summary shows what changed.

## Locked decisions

| | Decision |
|---|---|
| Method | **Exact simulation, sped up**: the real engine in a fast catch-up mode, not an estimate from rates (an estimate would ignore the living mat). |
| Cap | **24 hours** of time away; anything beyond is dropped. |
| Speed | **A full 24 h catches up in under 30 seconds** on the owner's PC. |
| While it runs | A **loading bar or other visuals**, so the game never looks frozen. |
| On return | A **"While you were away" summary**: time away, items gained and spent, level-ups, Tokens depleted, heroes wounded. Level-up bubbles also wait on the hero bar. |
| Danger | **Same rules as playing**: fights, wounds and running out of seeds all happen offline. |
| What counts | **A closed game, and a sleeping PC** (lid shut; owner, 2026-10-07). A minimised or background window just runs (slowly); it doesn't get a catch-up or summary. |
| Time Bank | Retired: its banking, speed-up presets and hidden widget go. |

## What's known today

- The engine ticks 10 times a game-second; a realistic mat costs ~0.3 ms per
  tick (`docs/reference/PERFORMANCE.md`). Running today's ticks exactly takes
  ~11 s per hour away, **~4–5 minutes for 24 h**: about 10× too slow for the
  30-second target.
- A live tick is clamped to 1 s (`MAX_TICK_DELTA_MS`); longer gaps are
  published as `TIME_OVERFLOW` and banked by the Time Bank today.
- Hero walking already snaps to its destination on a very long tick.
- `TimeBankManager.accrueOffline` already measures time away on load
  (`now − savedAt`).

## Open engineering questions (for the roadmap, not the owner)

1. **How to reach 10× speed while staying exact.** Candidates: larger catch-up
   steps where systems handle them correctly (cycles, clocks and spawns already
   advance by `delta`), skipping drawing and UI events entirely during
   catch-up, running in a Web Worker so the loading bar stays smooth. Prove
   "exact" with the bench's same-work fingerprint: a catch-up must end in the
   same state as running the same time live.
2. **Saving during catch-up**: the save happens once at the end; a crash
   mid-catch-up must not lose the pre-catch-up save.
3. ⚠️ **Background windows.** Browsers throttle background timers hard (Chrome
   can wake a background tab about once a minute after a few minutes), so
   "runs slowly" may mean "nearly paused". Measure what the desktop app
   (Tauri webview) does when minimised before building; if a minimised game
   effectively stops, bring the choice back to the owner.
4. **What the summary counts**: the engine already publishes the events
   (cycle complete, level-up, depleted, wounded); catch-up collects them
   instead of showing toasts and bubbles.
