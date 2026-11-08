# Brief 510 — Code review round 4: the P2 fixes

*Written 2026-11-07 by the planning agent from the round-4 triage
([triage record](../review/triage_2026-11-07.md)). No concept doc: these are fixes, not features.*

**What the player gets.** The owner's content can no longer be overwritten by a stale CMS tab; a game left
in a background tab stops piling up hidden page elements; a Token dragged onto a copy of itself no longer
leaves a ghost with no charges behind; the working hero's gear is no longer re-read from scratch every
tick (a faster catch-up); the screen's little timers stop running while the game is hidden or minimised;
and one luck-dependent test stops being a coin toss.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the area each phase touches),
and for each phase its finding in `docs/active/review/` (search the CR4 id: Where, What, Evidence, Fix
sketch and "Must not change" are written there with `path:line`, checked at the review's commits; verify
against the code, the code wins).

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| F1 | T-339 (CR4-078) | **The CMS Sync guard.** In `cms/gameData.js` `writeSync` and `cms/src/engine/syncGuard.js`: send the workspace revision with the Sync and refuse a body made from a revision older than the disk workspace's (the check `cms/workspaceFile.js` already has for workspace writes); compare content, not ids, and list changed entries beside removed ones in the 409 the author confirms; write every file to a temp name and rename them all at the end (reuse `writeAtomically`); before committing, read the checked-out branch: the browser's Sync **refuses** when it is not `main`, with a message naming the branch (the owner's rule, 2026-10-13); the command-line `sync` warns instead. Must not change: the files' formatting (`JSON.stringify(content, null, 2)`), the command-line sync's reading of the disk workspace. Test each refusal; then run one real Sync on a scratch branch in a worktree and reset nothing on `main`. | builder |
| F2 | T-340 (CR4-087) | **The luck-dependent farming test.** `src/tests/FarmingHarvest.test.js:185-200` fails under `FG_TEST_SEED=b`. Read the harvest roll (`src/systems/board/Fields.js`): if the amount is meant to vary, pin the roll for that cycle or assert a range; if the design says it is fixed, **stop and report** (the engine would be wrong, a design question). Then run the whole suite under `FG_TEST_SEED=b` and report every failure. | builder-lite |
| F3 | T-333 (CR4-046, CR4-092), T-341 (CR4-047) | **A hidden page stops piling up effects.** Gate the one-shot effect watchers on `isDrawingPaused()` (`fx/matFx.js` `watchMatFx`, `fx/fightFloats.js`, `TokenHitArt.jsx`'s three handlers and `later`), and add a timer fallback beside `onfinish` in `playAt` and `playIn` (`HallCamera.jsx:17-22,128-137` is the pattern). Loot flights booked while drawing is paused land at once with no particle (`ParticleOverlay.jsx` `spawnCollected`), and the board is measured once per batch. Must not change: how any effect looks while visible. Comment fixes in the touched files (CR4-056's list). Ready for the soak (brief 520 M5). | builder |
| F4 | T-342 (CR4-027) | **The zero-charge ghost.** In `Placement.js` `restock`, when the decision is `absorbed` and the moving Token is already on the mat, take it off (the depleted-Token path: remove, forget its cycle, release its hero's claim, `TILE_CHANGED { typeId: null }` for its old point, `ADJACENCY_DIRTY` for both); in `moveTokenTo`, publish "vacated" only when it actually left. Add the mat-to-mat test beside `MatPlacement.test.js:262`. Must not change: the hand-drop top-up, the leftover path. Bench work check (S4 especially). In the running game: drag a half-used Forest onto another half-used Forest; one Forest remains, with the summed charges, and no red mark. | builder |
| F5 | T-078 (CR4-033) | **The loadout rebuilt per tick.** Memoise `HeroEffects.loadoutStatements(hero)` per hero on what it reads: the gear grid, the skill levels (perks), and a Bank version counter for `slotBacked` (bump it in the inventory store on any quantity change). `heroContributions` then filters a cached array. Keep live potions live (or version them on change). Must not change: the answer (the bench fingerprint, `heroXp`, `tokensHash`), the Bank-stock rule, perks earned mid-catch-up. Report a catch-up CPU profile's self time in `loadoutStatements`, `statementsFromEntry`, `effectTitle` and `lendingEntries` before and after (the director runs the timing in a bench window, brief 520 M1 gives the before). | engineer |
| F6 | T-343 (CR4-050) | **One poll clock that pauses.** An `onPoll(fn, everyMs)` in `src/ui/components/board/frameClock.js` on a single timer that honours the drawing pause; move the fifteen game pollers onto it (the list is in CR4-050); `MatUpkeepBadge` and `UpkeepSummaryPanel` recompute only when the summary's signature changes (as `MatCapBadge` does) and keep either the events or the poll, not both; `TokenCard`'s `ArtWindow` layout effect gets its dependencies. Must not change: what each readout shows and how fast it updates. After F3 (both touch the pause). | builder |
| F7 | T-344 (CR4-098) | **A minimised desktop app goes quiet.** Needs brief 520 M7's before-number. Under `fg-window-minimised`, the drawing pause also sets `data-paused` on the body so a CSS rule pauses the infinite animations, pauses the poll clock (F6), and skips per-tick React commits until restore, reading once then. Engine ticks and saves keep running. Measure again minimised, the same way as M7, and report both numbers. In the desktop app: minimise for a minute, restore, everything current. | builder |

**Order and parallel work.** F1 (CMS), F2 (tests) and F4 (board engine) touch different files and may run
in parallel, two code agents at a time. F3 then F6, then F7 after brief 520's M7. F5 after brief 520's M1
(so the profile has a before), or before it if the window is far off: then the profile is taken at F5's
merge and its parent.

## Done when

- Gate green (`TESTING.md`) for every phase; bench work check on every merge: **same work expected for
  all phases** (F5 must be bit-identical; F4's fingerprint should not move, explain it if it does).
- F2: the suite passes under the default seed and under `FG_TEST_SEED=b`.
- F3: the soak's hidden slopes for nodes and listeners near 0 (brief 520 M5), and T-333 closes.
- In the running game, named as verified: F3 (switch to another tab for two minutes while fights run,
  come back: no burst, effects current), F4 (the drag above), F6 (the upkeep badge and a hero's bubble
  timer still update), F7 (desktop, above).
- Tickets closed into `docs/archive/tickets_done.md`; the review's finding states stay as they are (the
  reviewer re-reads closed CR4 tickets at the end of the round).

**Eye-check: no.** Nothing changes how the game looks or plays; one line each in STATUS. F1 changes what the
CMS says when it refuses a Sync: tell the owner in STATUS in one line ("the CMS now refuses a Sync from a
stale tab or off `main`, and says why").

## Owner to-do

None. After F1 lands, the owner Syncs as usual on `main`.
