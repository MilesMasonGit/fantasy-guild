# Brief 440 — Detail pass: the away summary, and away time on save slots

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "12. While-you-were-away summary": read its
list first; the item numbers below are that list's, and the owner's wish is what counts.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, GDD §10 and the combat screen's note on
"While you were away", [brief 430](430_notifications_detail.md).

Code to start from (verify): `src/ui/components/hud/CatchUpOverlay.jsx`, `catchUpSummary.js`,
`src/systems/core/CatchUp.js` (the summary's counts), `src/ui/modals/SlotSelectionModal.jsx`,
`src/systems/core/SaveManager.js`, `src/config/loopConstants.js` (`CATCH_UP.CAP_MS`),
`src/ui/components/base/ArrowScrollList.jsx`, `src/utils/Formatters.js`.

## Needs

Brief 430 N1, which adds new recipes, first finds and items lost to the summary. Run this after it, or say where
those sections would land and leave them to it.

## Phases

| Phase | What | Tier |
|---|---|---|
| A1 | **The panel** (items 1, 2, 3, 4, 5). **Two columns**, wider, still fitting a 1366 screen. **Left, item changes**, in today's rows, one list: each item once with its **net** amount, green + or red −, gained and spent on hover. Items still waiting on the mat keep a small mark and say so on hover; explain how a mat item and a banked one combine, and check against `net` and `floor` in `CatchUp.js`. **Right, the news**, in this order: knock-outs and items lost, new recipes, first finds, level-ups, Tokens used up, then **fights: only each enemy with its kill count**. Won and lost, used and drops go from the panel. A section with nothing is left out; say what the right column shows when it's empty. **Heading centred**: "While you were away" and "You were away 32 min". **Scrolling**: our arrow buttons per column, no scroll bar. **A second confirm box on both buttons**: Return to the Guild (no loss, so plain wording) and Load as I left it (keeps today's warning that everything from the time away is lost). Esc asks the same as Return. Banners from brief 430 appear after that confirm. Keep the entrance animation only if it stays cheap with both columns. | builder |
| A2 | **Save slots show away time** (item 6). Each slot on the start screen shows how much time away has built up since it was saved, in the summary's own wording (`formatAway`), read from the slot's save time. ⚠️ Only 24 hours are ever played, so past that it reads "24 h (max)" and matches what the player gets. "Last saved" may be replaced or stay: show which reads better and say. An empty or damaged slot shows nothing. The start screen's other changes (T-293, section 11) are not part of this. | builder-lite |

Either order, one branch each or together.

## Done when

- Gate green (`TESTING.md`). Engine work **same**; only what the panel draws changes, and the summary's counts for
  anything else still work (tests moved, not dropped).
- In the running game, named as verified, using the time-away tools (TESTING): a short absence and a long one at
  1366 and 1920; an item both gained and spent, with its hover; an item waiting on the mat; a return with no news;
  each news section; many enemy kinds; arrows when a column overflows; both confirms, cancelling back and going on;
  Esc; a slot under 24 hours and a slot over it, and that loading it plays what it said. This also confirms time
  away with the game fully closed, which the owner asked about.
- GDD §10 and the combat note updated.
- **One short eye-check** after A1 and A2 together; the owner judges whether Return's confirm earns its click.

## Not in this brief

XP per skill: offered, not taken. The rest of the start screen: section 11, not yet walked.

## Owner to-do

The eye-check. No CMS work and no new art.
