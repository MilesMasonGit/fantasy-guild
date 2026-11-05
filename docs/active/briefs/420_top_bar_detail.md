# Brief 420 — Detail pass: the top bar, and Disallow retires

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "2. Top bar": read its list first; the
item numbers below are that list's, and the owner's wish is what counts. The gold coin, the Upkeep
number and the Demolish message: looked at, no change.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (the icon rule, the Region name),
GDD §1, §3 and §9, `ui_rework_list.md` ("Token Summary"; amended by this brief).

Code to start from (verify): `src/ui/components/board/MatTopBar.jsx`, `MatRegionName.jsx`,
`MatCapBadge.jsx`, `MatUpkeepBadge.jsx`, `MatModeControls.jsx`, `mapModeCursor.js`,
`src/ui/hooks/useMapMode.js`, `src/systems/board/Flags.js`, `Orders.js`, `Hostiles.js`, `MatSummary.js`.

## Phases

| Phase | What | Tier |
|---|---|---|
| T1 | **The bar** (items 1, 2, 3). **The banner**: larger, so it goes further across the bar. A whole-number scale so its pixels stay whole; try 3x and 4x, and show both at the look with a few places' banners, since a short bar shows a narrower slice of a larger picture. **Hover**: the Token Summary opens on hover as the Upkeep Summary does, staying long enough for the pointer to cross into it, so its rows still hover and light the mat. Esc still closes it. The short tooltip that said "Click for the list" goes. **Demolish**: the pixel X from its cursor (`mapModeCursor.js`) beside its word. | builder |
| T2 | **Disallow goes, the whole mechanic** (item 4). The button, the mode, its banner, cursor, badges and tooltips, Shift-click, its clear button, the Token Summary's count, `isDisallowed` and every rule that reads it (start from `Flags.js`, `Orders.js`, `Hostiles.js`, and search the rest: about 27 game files and 23 test files name it). ⚠️ This is how heroes choose their work: remove only the mark's check, so a hero chooses exactly as it does today for an unmarked Token. ⚠️ **The same word means something else**: `severity: 'disallow'` in `Placement.js`, `MatResize.js` and `dropOnMat.js` is a refused drop or placement, and the drag ghost and sprite effects may use it too; those stay. As far as the planning agent could see only `useMapMode.js` sets the mark: verify, and stop and report if anything else does. Tests that exist only for Disallow go; tests that used it to set up another case get another way. Art it used may stay in `public/assets/`. **Engine work should stay same**; if a scenario uses a mark, explain the WORK CHANGED. | engineer |

T1 and T2 may run in either order, one branch each; T1 touches `MatModeControls.jsx`, so not side by side.

## Done when

- Gate green (`TESTING.md`). Engine work **same**, or T2's change explained and accepted by the director.
- In the running game, named as verified: the banner on a few places at 1366 and 1920, with the name and
  numbers readable; each summary opening on hover and staying while the pointer crosses into it; a Token
  Summary row lighting the mat; Demolish on, a mark, Cancel All Marks and Esc; no trace of Disallow in the
  bar, on a Token or in a tooltip.
- No search hit for the mark left in `src/` or `cms/src/`; refused drops still look as they do.
- `bench:draw --compare` once for the eye-check batch.
- GDD §1, §3 and §9 and `ui_rework_list.md` updated; T-293 closes its top bar half.
- **One eye-check after T1**, with the banner sizes to pick. T2 needs no look beyond one line in STATUS.

## Not in this brief

The start screen's half of T-293.

## Owner to-do

Pick the banner size at the look. No CMS work and no new art.
