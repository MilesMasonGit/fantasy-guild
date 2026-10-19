Status: briefed 2026-10-14 (approved 2026-10-14; brief 130)

# The recipe list

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Recipe Presentation & Inspection Overhaul"). Owner interview, 2026-10-13,
three rounds; **done** (owner closed it). Replaces the station recipe picker
(`StationRecipeModal.jsx`, banded by `RecipeBands.js`); opened from the Token
card's **Change recipe** button ([concept_info_layers.md](concept_info_layers.md)).
The look follows [UI_STYLE.md](../reference/UI_STYLE.md). Build ticket:
**T-169**; absorbs T-142.*

## Where it opens

- **Inside the Token card**: Change recipe flips the card to the list, on the
  same art backdrop; choosing a recipe flips it back. No separate modal over
  the mat.
- **The card grows to whatever size the list needs** (owner, 2026-10-19), so
  a row stays on one line as drawn below. The art is scaled up by whole
  multiples to cover the card and is simply cut off where it overflows.
- **Foundations use the same list** for choosing what to build: Construction
  level, materials → the building. One component for both.

## The list

- **One row per recipe, sorted strictly by required level** (ascending; ties
  keep the content's order). No favourites.
- **Opens scrolled to the current recipe**, which is highlighted gold.
- **Grows tall, then scrolls** with the arrow bars; nothing is ever cut off
  with "…" (fixes T-142).
- **One click on a row chooses it** and flips back to the card.
- **Hover**: the row gets the white outline; hovering a single item names it
  and shows have/need. No big preview.

## A row

```
20  [3 Lemon][1 Water] [hollow: Juicer]  →  [1 Lemonade] [Lemon Seed 25%]   +35 XP  [clock] 6s
```

- **The level it needs.**
- **Inputs**: item pills with **have/need**, red when short.
- **Extra requirements** (a tool, a Foundation tier, a station upgrade): the
  **hollow, outlined bar** from the Token card, beside the inputs, **red when
  unmet**.
- **Outputs**: the main output is the row's headline. **Byproducts and rare
  outputs follow it, smaller and muted, with their chance.**
- **Named once**: the main output names the recipe. No "Apple Juice makes 1
  Apple Juice", no repeated labels.
- **XP per craft** and **time per craft**, small and muted at the end.
- **No helper banners**: the yellow "a more skilled guild member can run this"
  line goes. The hero dividers say it.

## Who can run what: hero dividers

- **Between rows, at each hero's level in this skill, a thin line with that
  hero's small face.** Every recipe above a hero's face is one they can run.
- **Only heroes whose Work Permissions allow this skill** get a face (owner,
  2026-10-19); the station's current worker's face has a gold ring.
- They replace today's two threshold markers (worker and guild) and the three
  bands.
- Faces of permitted heroes who can't reach any recipe in the list are left out.

## Locked recipes: spoiler hints

- **The next two recipes nobody can run yet** show as **"???" silhouettes with
  their level**; the rest are hidden. This matches the encyclopedia's "a step
  or two ahead" rule ([concept_knowledge.md](concept_knowledge.md)). They
  can't be chosen.

## Search

- **A search box at the top of every list.** It matches **inputs and outputs**
  by name ("oak" finds every recipe that uses or makes something Oak);
  non-matching rows hide, and the hero dividers stay.
- Spoiler silhouettes don't match a search, so it can't reveal a hidden
  recipe.

## Notes for the director

- Builder tier, after the Token card exists (concept_info_layers step 4); it
  can ship on today's inspect pop-up first if the card is late, as long as it
  opens in place rather than as a modal.
- `RecipeBands.bandStationRecipes` becomes a level-sorted list plus each
  hero's level in the skill; keep the logic pure and tested as it is now.
- Changes the look: owner eye-check.
