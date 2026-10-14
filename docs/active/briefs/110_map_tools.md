# Brief 110 — Map tool modes and the top bar

**Source of truth:** [`concept_map_tools.md`](../concept_map_tools.md)
(approved 2026-10-14), including "The top bar around the modes". Pieces come
from brief 100's style kit.

**Needs:** brief 100; T-147 (hover outline) merged, which wave 2 builds.

**Branch:** `crunch/map-tools`. **Eye-check:** yes, one batch after M3.

## M1 — Starter Camp Tokens become fixtures (T-165, engineer)

- **Change:** every Token the camp layout places is marked fixture when the
  camp is laid down: can't be demolished, dragged or pushed. Player-built and
  bought Tokens there stay movable. The Guild Hall stays movable (T-148) and
  undemolishable.
- **No old-save conversion** (owner, 2026-10-13: fresh saves).
- **Done when:** tests on a new game prove it; in the running game a camp
  Token refuses a drag and a bought one doesn't.

## M2 — Demolish mode beside Disallow mode (T-166, builder)

- **Change:** as the concept doc says: one mode at a time, the banners and
  their exact wording, mode-coloured hover outline and cursor, protected
  Tokens dim with the engine's reason on click, the batch controls (Allow
  All, shift-click a type, Cancel all marks).
- **Then** the Token card's Disallow switch and Demolish buttons go. If brief
  120's card isn't built yet, remove them from today's inspect pop-up.
- **Done when:** each mode exercised in the running game, including
  shift-click and Cancel all marks; Escape ends a mode.

## M3 — Top bar restyle (T-170, builder)

- **Change:** the studded pixel frame; Region name (click opens the Atlas),
  Tokens 45/128 (red at the cap) and Upkeep per minute (hover lists each
  item's rate) in the item bar style; the mode banner centre; the two toggles
  right.
- **Done when:** seen in the running game at the cap and below it.
  `bench:draw --compare` cost-log line.

## Owner to-do

- Eye-check the batch. No CMS work.
