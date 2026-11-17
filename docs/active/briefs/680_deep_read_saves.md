# Brief 680 — Deep read: saves and time away

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md); D3 rulings in
[review/STATUS.md](../review/STATUS.md)). Runs after briefs 650 and 660. CR4-170 and CR4-174 wait for
the owner's desktop try and may join later.*

**What the player gets.** Closing the game while it catches up after a PC sleep keeps what was done
before the sleep; settling and starting a new game can no longer be cut in half by a crash; an
unanswered "While you were away" summary is offered again on the next start; banners that were waiting
come back after a reload or travel; pinned item trackers count time away; only one copy of the desktop
game runs at a time; a failed save on closing is shown, not hidden; "Save Game Now" says it saved; and a
set of small save and settings faults.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (saves, the tick, catch-up,
the desktop shell), and each phase's finding in `docs/active/review/D3_saves_and_time_away.md` (or D1
for CR4-121, CR4-123). Saves must **never lose data** (brief 450's rule): every phase that writes a save
is tested with the backup roll in mind. **Stop and report** where the code disagrees.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| S1 | T-443 (CR4-144), T-447 (CR4-149), T-448 (CR4-151), T-426 (CR4-123) | **Catch-up edges.** Before a catch-up that starts from the live game (no `before`, a slot open, `save` true) suspends saving, write the game as it stands, stamped with the gap's start (not `Date.now()`, or the next load would skip the sleep). Guard `startSlot` against a second call (return the promise in flight). "Load as I left it" clears its undo only once the write succeeded; on failure the summary stays open with the button live. A second absence while the summary is open adds to the summary (or it says "since" the first save) so the undo and the page agree. | engineer |
| S2 | T-424 (CR4-121, CR4-150) | **Settle and new game save once.** Take the save out of `Atlas.settle` when `settleCell` calls it and save once at the very end, after `Arrival.occupy`; `newGame` claims the slot in memory and writes only the finished opening. A new game never overwrites a file copied into the slot (`EngineBootstrap.js:310-313`). | builder |
| S3 | T-458 (CR4-164) | **An unanswered summary is offered again** (owner, 2026-11-16). Keep the pre-catch-up save and an "unanswered" mark somewhere that survives the page until the player presses one of the two buttons; the next load shows the summary and both choices again. Closing is not a choice. Answering "Return to the Guild" discards the copy. | engineer |
| S4 | T-445 (CR4-146, CR4-147, CR4-113) | **Banners come back** (owner, 2026-11-16, 2026-11-17). On `GAME_LOADED`, `CATCH_UP_FINISHED` and a return by travel, raise the event banner for an event Token on the mat if none is up; an event's banner comes down when the guild leaves its Region. Unclicked knock-out and problem banners are saved (as the pins are) and shown again at the next start; one event banner per Token. | builder |
| S5 | T-449 (CR4-152), T-450 (CR4-153) | **The desktop window.** The single-instance plugin: a second launch brings the open window forward (owner, 2026-11-17). On closing, a failed save cancels the close once and shows the banner; a second close goes through. The Rust side needs a small command to reset `CLOSING` and stop the 5 s grace thread (`saves.rs:221-233`); a hung page still closes after `CLOSE_GRACE`. Verify in a desktop test build. | builder |
| S6 | T-446 (CR4-148), T-453 (CR4-156), T-459 (CR4-166), T-444 (CR4-145) | **Records that last.** Pinned stubs add the catch-up's gained and spent and save the pins (owner: count time away). A Token type on a Region's board counts as had for the Encyclopedia once the guild holds it, for good (owner, 2026-11-17). A slot whose main file is missing or empty but whose backup is good shows as damaged, so Load restores from the backup. The browser build registers the close save when a slot opens, whatever the auto-save setting (dev builds). | builder |
| S7 | T-451 (CR4-154), T-452 (CR4-155), T-454 (CR4-157), T-457 (CR4-161) | **Small save and settings faults.** "Save Game Now" shows "Saved" from the write's result. The master-volume marker is set whenever settings load with nothing stored. The browser storage-full banner says what the player can do (delete a slot). A star held at a rank the CMS removed reads as at most the star's top rank, without rewriting the saved number. | builder-lite |

**Order and parallel work.** S1 and S3 both touch the catch-up and the undo: S1 first. S2 (settle,
new game) and S5 (desktop shell) may run beside them. S4, S6 and S7 after S1 (they touch the catch-up's
end). Two code agents at a time.

## Done when

- Gate green; bench work check: **same work** for every phase (the bench runs with `save: false`).
- In the running game, named as verified: S1 (desktop build: autosave, act, sleep the PC, close during
  the bar, restart: the actions are kept), S3 (close with the summary open, restart: offered again), S4
  (reload with an event on the mat: its banner is back), S5 (launch twice: one window), S6 (pin an item,
  close an hour, load: the stub moved), S7 ("Saved" shows).
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes, one short look after S3 and S4** (the summary coming back, banners coming back).
The rest one line each in STATUS.

## Owner to-do

None beyond the look. For S5 and S1 the director needs one desktop test build the owner can open.
