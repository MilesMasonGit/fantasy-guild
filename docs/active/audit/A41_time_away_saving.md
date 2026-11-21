# A41: Time away and saving
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

The game plays on while you're away. On loading a save, or when the game
finds it missed time (a sleeping PC), it replays the gap second by second,
up to 24 hours, behind a "Catching up on 3h away" bar, then shows **While you
were away**: what changed in the Bank and on the mat, and the news (events,
knock-outs, broken gear, full Bank, recipes, finds, level-ups, Tokens used up,
kills). You can accept it or **Load as I left it**. Gaps under two minutes
play silently with no summary, loads included. It saves every 10 minutes (a
setting), on closing the window and on demand, into three slots with one
backup each. Your ruling (every time away opens the summary, a minimised game
plays live) isn't built yet.

## What the player sees and does

- **Coming back** after 2 minutes or more: a dimmed screen with a progress
  bar, then the summary with two buttons, Return to the Guild or Load as I
  left it (each asks first). Close the game with the summary open and it is
  offered again next time.
- **Away past 24 hours**: the extra is dropped and the summary says so.
- **Saving**: autosave every 10 minutes (or 60, or off, in Settings), on
  closing the window, Save Game Now in Settings. Three slots; a damaged save
  loads its backup with a "Save Restored" banner. The title screen can open
  the saves folder.

## What really happens underneath

- **How a gap is found**: the game measures each tick; time beyond a second
  piles up. Two minutes or more stops the game and runs the full catch-up
  with the summary. One second to two minutes plays at once, silently, with
  no save. A closed game catches up from the save's time when loaded.
- **Minimised**: only drawing pauses; the game ticks on (relying on the
  desktop window not slowing its timers, which the code assumes but wasn't
  checked). A sleeping PC is caught only if the PC's clock counts sleep
  (unconfirmed on Windows).
- **The catch-up plays everything the live game does**, one second a step, in
  short slices; only the current Region runs. Sounds and notices are muted
  meanwhile and saving waits.
- **A kill shows twice in the summary**: each kill uses up its enemy, so the
  same enemy is listed under "Tokens used up" and under kills. With every
  enemy one use (T-545) this will happen every time.
- **The summary's news order** starts with events, then knock-outs; the GDD
  leaves events and full stacks out of its list.
- **A reload loses** a few things held only in memory: a spawner's no-room
  alert, the 2 s rest between enemies and swing progress, the item and XP
  rate windows. Floor loot and an enemy's hurt health are kept.
- **Saves from another version are refused** outright; there are no
  migrations between versions.
- **Unused**: save export and import (no button), a dev time-skip (tests
  only, and it doesn't move effect clocks), a 16-slot limit on the desktop
  side against the 3 used.

## What the owner controls in the CMS

Nothing here is in the CMS. The player sets the autosave interval. Fixed in
code: the 24-hour cap, the 2-minute summary threshold, the 1 s step, three
slots, one backup, the 5 s wait on closing.

## What it touches, and where it overlaps another system

- **Telling the player** (ready to brief): the away summary told once
  (T-506, which drops the 2-minute line); away news order (T-560: defeats
  first).
- **Regions** (A40): another Region's mat stands still.
- **Every system with a clock**: the catch-up replays them all.
- **Enemies** (A32): one use each, so the double count.

## Where it differs from the GDD

- GDD's news list leaves out events and full stacks; the code shows events
  first.
- The 2-minute threshold also applies to loads (the GDD describes it only for
  gaps in play).

## Try this (in the tagged build)

1. **Play a few minutes**, save, close the game, wait three minutes, open it:
   the catch-up bar, then the summary.
2. **Close and reopen within a minute**: no summary.
3. **With a hero fighting a camp**, close for a few minutes: look for the same
   enemy under "Tokens used up" and under kills.
4. **Minimise the game** for a few minutes and come back: it kept playing,
   no summary.
5. Ask yourself: what should always be in the summary, and should a short
   gap get a small one?

## Owner feedback (2026-11-20)

Interviewed without playing first.

- **Short gaps**: "We need to give the player the option to reject or accept
  the time that has passed, that's why I want to always give the summary. For
  less than a minute, it should just automatically resume with the game as it
  was before the exit."
- **The 24-hour cap**: keep, on the tuning page.
- **Kills twice**: kills only.
- **Old saves**: refuse until 1.0, then migrate.
- Leftovers filed without asking (export and import retired, the saves
  folder covers it).

## What it became

- **T-618** (director): under a minute resumes as left; from a minute the summary always opens.
- **T-619** (director): a kill counts once in the away summary.
- **T-620** (director): saving leftovers.
- **T-621** (planning agent): GDD §10, and the 1.0 migration note.
- T-253 now lists the 24-hour cap.
- Fine as is: three slots and a backup; autosave every 10 minutes by default.

All four tickets blocked on the living mat group, which is now ready to brief.

## Evidence

- Tick 100 ms, gaps over 1 s pile up → `src/systems/core/GameLoop.js:34, 66-71`, `src/systems/core/TimeManager.js:43-53`, `src/config/loopConstants.js:7, 23, 31, 36, 38, 43`
- Gap handling, 2 minutes, silent short gaps → `src/systems/core/CatchUp.js:182-203`; loads too → `:410-422`; from the save's time → `src/systems/core/EngineBootstrap.js:230-243`
- Minimised pauses drawing only → `src-tauri/src/lib.rs:47-61`, `src/ui/drawingPause.js:37-51`
- Catch-up plays the live handlers, muted, no save → `CatchUp.js:355-368, 451-458, 488-500`; overlay → `src/ui/components/hud/CatchUpOverlay.jsx:43-48, 131-140, 314-482`
- Kill shown twice → `CatchUp.js:294-312`, `src/systems/board/BoardCombat.js:507, 537`, `src/systems/board/Charges.js:138`
- Saving: interval, close, slots, backup → `src/systems/core/SettingsManager.js:16-21, 66`, `src/systems/core/SaveManager.js:230-307, 321, 542-558`, `src-tauri/src/saves.rs:16-19, 69-111, 156-162, 253-273`
- Lost on reload → `src/systems/board/SpawnerSystem.js:70-74`, `BoardCombat.js:51`, `SaveManager.js:30-33`
- No migrations → `src/systems/core/SaveMigration.js:28-34`
- Unused → `SaveManager.js:405-440` (export, import), `src/systems/core/DevTools.js:83-115`
- GDD → `docs/reference/GDD.md:1848+`
