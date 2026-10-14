# Brief 130 — The recipe list

**Source of truth:** [`concept_recipe_list.md`](../concept_recipe_list.md)
(approved 2026-10-14). Ticket **T-169**, which absorbs T-142.

**Needs:** brief 120's card (C3). If the card is late, it may ship on today's
inspect pop-up, as long as it opens in place and never as a modal.

**Branch:** `crunch/recipe-list`. **Tier:** builder. **Eye-check:** yes.

## R1 — The list logic

- **Change:** `RecipeBands.bandStationRecipes` becomes a level-sorted list
  plus each hero's level in the skill; the next two locked recipes as
  silhouettes; search over inputs and outputs that never matches a silhouette.
  Pure functions, tested as now.

## R2 — The list on screen

- **Change:** Change recipe flips the card to the list and back; rows as the
  concept draws them; hero-face dividers replace the bands, threshold markers
  and the yellow helper banner; opens scrolled to the current recipe; brief
  100's arrow-bar list; nothing truncated. Foundations use the same component.
- **Done when:** a station and a Foundation both used in the running game,
  including a search and choosing a recipe.

## Owner to-do

- Eye-check. No CMS work.
