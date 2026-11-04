# Brief 470 — Detail pass: the encyclopedia

*Written 2026-11-04 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "9. Encyclopedia": read its list first; the item numbers
below are that list's, and the owner's wish is what counts. The rest of the chart: looked at, no change. The book stays
as it is: the world map leaves it (brief 380).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, [concept_knowledge.md](../concept_knowledge.md),
`docs/active/research/encyclopedia_display/plan.md` (the choices of 1 November: don't undo them), GDD §14.

Code to start from (verify): `src/ui/components/encyclopedia/` (`encyclopediaModel.js`, `encyclopediaChart.js`,
`EncyclopediaChartView.jsx`, `EncyclopediaScreen.jsx`, `encyclopediaLink.js`), `src/ui/components/board/RecipeList.jsx`,
`src/systems/progression/RegistryManager.js`.

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **Mock-ups of what a line means** (no game code; item 1). The owner: "the Iron Woodaxe chains into the trees, which is accurate but it's different than an Oak Tree producing Oak Wood. We should examine a better way to display these relationships." First list every kind of relationship the chart draws today: an ingredient consumed, a tool or weapon required but kept, a station where it's made, a Token that yields an item, an enemy's drop, a chest, a seed planted, a building built. Then two or three ways to tell them apart, on real charts (Iron Woodaxe, Oak Wood, Iron Ingot and a rare drop): for example separate lines or marks per kind, requirements in their own group, or a different side of the box. Name what each costs in clutter, since skill marks, amounts and "or" bands already sit on those lines. Saved under `docs/active/research/encyclopedia_lines/`. | builder |
| E2 | **The pick, built** (item 1). What the owner picked from E1, in the chart and its hover, for every kind on the list. Clicking, folding, the view's glide, "or" bands and the lit path on hover work as they do. | engineer |
| E3 | **Progress and links** (items 2, 3). **In the book's bottom left corner, counts and small progress bars**, one per kind (items, Tokens, enemies, recipes), for this run, from the ticks; read when the book opens, never per frame. ⚠️ Say exactly what counts: `Planned` entries and content nothing can reach must not leave a bar that can never fill, and half-authored content isn't a bug. Hard-pixel bars from our kit, and clear of the chart when it runs across both pages. **A recipe's ingredients link to their pages**, in a Token's recipe list. Recipe rows keep their own clicks and drags: say how a click on an ingredient is told apart, and how the player gets back. | builder |

E1 first; E2 waits for the owner's pick; E3 may run at any time, on its own branch.

## Done when

- Gate green (`TESTING.md`). Engine work **same**.
- In the running game, named as verified: **E2** each kind of relationship on a real chart, at 1366 and 1920, with a large
  chart; **E3** the bars on a new run and an advanced one, with a chart behind them; a new tick moving a count; an
  ingredient's link from a recipe list, with the recipe still choosable.
- `concept_knowledge.md` and GDD §14 updated.
- `bench:draw --compare` once for the eye-check batch.
- **Eye-checks**: the mock-ups' pick after E1 (no game change); one look after E2 and E3.

## Not in this brief

The Bank's link (brief 400 B3). A separate list of everything found: the owner's October verdict on long lists stands,
and the owner asked for counts and bars only. Any new book art.

## Owner to-do

Pick from the mock-ups; the look. No CMS work and no new art.
