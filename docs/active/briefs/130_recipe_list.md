# Brief 130 — The recipe list

**Source of truth:** [`concept_recipe_list.md`](../concept_recipe_list.md)
(approved 2026-10-14). Ticket **T-169**, which absorbs T-142.

**Needs:** brief 120's card (C3). If the card is late, it may ship on today's
inspect pop-up, as long as it opens in place and never as a modal.

**Branch:** `crunch/recipe-list`. **Tier:** builder. **Eye-check:** yes.

## R1 — The list logic

- **Change:** `RecipeBands.bandStationRecipes` becomes a level-sorted list
  plus the level in the skill of each hero whose Work Permissions allow it
  (and which hero is the current worker); the next two locked recipes as
  silhouettes; search over inputs and outputs that never matches a silhouette.
  Pure functions, tested as now.

## R2 — The list on screen

- **Change:** Change recipe flips the card to the list and back; rows as the
  concept draws them; hero-face dividers replace the bands, threshold markers
  and the yellow helper banner; opens scrolled to the current recipe; brief
  100's arrow-bar list; nothing truncated. The card grows to the size the
  list needs (one line per row), its art scaled by whole multiples to cover
  it and cropped where it overflows; the worker's face has a gold ring
  (owner, 2026-10-19). Foundations use the same component.
- **Done when:** a station and a Foundation both used in the running game,
  including a search and choosing a recipe.

## Owner to-do

- Eye-check. No CMS work.
