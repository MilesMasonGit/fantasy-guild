# Brief 350 — Detail pass: Tokens on the mat and the Token card

*Written 2026-11-02 by the planning agent from the owner's walkthrough of the
same day. Concept: [concept_detail_pass.md](../concept_detail_pass.md), "1. The
mat and Tokens": read its list first; the item numbers below are that list's,
and the owner's wish is what counts. Items 1, 5, 12, 13 and 14 are not here (see
the end).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (the work
plate, speech, pixel frames, sprites at whole-pixel scales), GDD §3 and §14,
[concept_skill_loops.md](../concept_skill_loops.md) ("Fishing").

Code to start from (verify; nobody has seen this section in the running game for
this brief): `src/config/matTuning.js`, `src/systems/board/MatPlacement.js`,
`src/systems/atlas/layoutInputs.js`, `src/ui/components/board/matLayers.js`,
`MatToken.jsx`, `MatHero.jsx`, `TokenCard.jsx`, `tokenCard.js`,
`TokenInspectPopup.jsx`, `RecipeList.jsx`,
`src/ui/components/base/ArrowScrollList.jsx`.

## Phases

| Phase | What | Tier |
|---|---|---|
| T1 | **The stack and the spacing** (items 2, 3, 4). **Heroes always on top**: ⚠️ today a working hero holds a place inside the Token stack (`matLayers.js`: a Token's art, the hero working it, its badges, sorted by where they stand), so a Token lower on the mat draws in front of them. Heroes move above every Token; say what happens to plates, names, flags and bubbles relative to them. **Hover no longer lifts a Token to the top** (the owner said "I think we may not want" this: build it so it is a one-line switch, and they judge at the look). **Tokens a little more spaced out**: raise the allowed gap (`overlapPct`, `hitboxPct`; 40 % overlap today), with the Mat Tuner for the owner to pick the number at the look. ⚠️ This reads into placement and the world's layout (`layoutInputs.js`), so expect WORK CHANGED: report which scenarios moved and why, and check a full mat of 128 still fits and every world still generates (the ledger's checks F). | builder (engineer if the stack needs engine work) |
| T2 | **The Token card** (items 6, 7, 8, 9, 10, 11). Less cluttered and more stylish. **The name is more of a header; the basic information is a stat block.** **Events like regrowing get their own section** (`LifecycleBlock` is the start). **A requirements section**, for things like tools and consumption. **The background art is displayed larger**, at whole-pixel scales only (`CARD_ART_PX`, `coverScale`). **Scroll arrows only when there is more to scroll to** (⚠️ `ArrowScrollList` is shared, brief 340 H3 and others use it: run T2's change to it so both agree). **Long output lists (fishing)**: show the output it will produce, with the others in a collapsed section; take "will produce" from what the engine knows about this Token and the hero's tool and bait, and stop and report if it can't say. Show two or three looks of the card's layout in the running game for the owner to pick (owner directs the art). Enemies' cards and station recipe lists use the same layout; a card with nothing for a section omits it. | builder |

T1 and T2 touch different files and may run in parallel.

## Done when

- Gate green (`TESTING.md`). T1's WORK CHANGED explained scenario by scenario and
  accepted by the director; T2's engine work **same**.
- In the running game, named as verified: a hero below and above a Token both draw
  over it; hovering a Token leaves the stack alone; a mat at 128 Tokens fits at the
  new spacing; cards for a tree, a vein, a station with recipes, a fishing spot and
  an enemy all read correctly; a card that fits shows no arrows.
- `bench:draw --compare` once for the eye-check batch, for the cost log.
- GDD §3 and §9 and `UI_STYLE.md` updated where they describe what changed.
- **One eye-check after T1 and T2**, with the spacing number, hover on or off, and
  the card's layout to pick. Fresh games only: old saves may sit closer than the new
  spacing, which needs no fixing.

## Not in this brief

Terrain and water (item 1): a design round first, "Terrain round" in the concept.
Fights moving to open space, damage numbers and effect procs (items 5, 13, 14): the
combat section. The loot arc (item 12): T-295.

## Owner to-do

No CMS work.
