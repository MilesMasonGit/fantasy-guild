Status: briefed 2026-10-14 (approved 2026-10-14; brief 110)

# Map tool modes: Disallow and Demolish

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Map Controls Overhaul"). Owner interview, 2026-10-13; **done** (owner
closed it). Builds on the top bar's Disallow mode (`MatDisallowControls.jsx`)
and Atlas A3b's demolition (`Demolition.js`). Build tickets: **T-165**
(Starter Camp fixtures), **T-166** (the modes).*

## Why

Marking a Token for demolition or disallowing it today means opening its
inspection first: slow when clearing several. Map modes let the player click
Tokens directly. Once they ship, **Disallow and Demolish leave the Token
card** ([concept_info_layers.md](concept_info_layers.md)).

## The modes

- **Two labelled toggles side by side on the top bar**: **Disallow** (exists
  today) and **Demolish** (new). **One mode at a time**; turning one on turns
  the other off. Esc or a second press ends it, as today.
- **A plain-text banner on the top bar** while a mode is on, saying what a
  click does:
  - Disallow: "Disallow mode: click a Token so heroes won't work it. Click
    again to allow."
  - Demolish (red): "Demolish mode: click Tokens to mark them. A Construction
    hero takes them down. Nothing is refunded."
- **Demolish warns once, on entering** (the banner); after that clicks mark and
  unmark freely, because a mark can be cancelled until the hero finishes.
- **Dragging pauses** in both modes (as Disallow does today).
- **The hover outline takes the mode's colour**: muted grey for Disallow, red
  for Demolish (UI_STYLE colours: unavailable, danger), with a matching
  cursor. Disallowed and marked Tokens keep their usual icons.
- **In Demolish mode, protected Tokens dim**, so the player sees at a glance
  what can go; clicking one shows the engine's reason (e.g. "Map nodes stay:
  reroll before settling to make room").

## Batch controls (in the banner)

- **Disallow: Allow All** (exists today, no confirm).
- **Disallow: shift-click a Token** to disallow every Token of that type on the
  mat; shift-click a disallowed one to allow them all again.
- **Demolish: Cancel all marks**: every Token marked for demolition is
  unmarked at once.

## What can't be demolished

Today `Demolition.refusalOf` protects the Guild Hall, landmarks, map-written
nodes (fixtures), quests and enemies. **Added**: **every Token the Starter
Camp layout places** becomes a fixture like a map's nodes: protected from
demolition **and fixed in place** (no dragging, never pushed). The camp is the
player's permanent safety net and endgame home, so it can't be broken. What
the player builds or buys there stays movable and demolishable as usual. The
Starter Camp also can't be abandoned (already true, Atlas A7).

The Guild Hall stays protected from demolition but is movable (T-148).

## The top bar around the modes

*Owner interview, 2026-10-13 (refinement pass §2, "Top Bar"); build ticket
**T-170**.* The bar keeps its place and slim height; everything else is
redone to the style guide.

- **Look**: the slim strip drawn with UI_STYLE's **studded pixel frame** and
  hard shadow (the wood texture goes).
- **Left, information**, each in the **item bar style** (UI_STYLE "Item
  references"):
  - **Region name** first; **clicking it opens the Atlas** (a second way in
    besides the bubble).
  - **Tokens 45/128** with the Token icon; the count turns **red at the cap**,
    and nothing else happens (spawners at the cap already show the red problem
    mark).
  - **Upkeep 2/min** with an upkeep icon, the **summed rate** in place of a
    quantity; **hovering lists one item bar per item with its rate** (today's
    Upkeep Summary, restyled).
- **Centre**: empty, except the **mode banner** while a mode is on.
- **Right**: the **Disallow** and **Demolish** toggles.
- The notification **log button** sits at the screen's top right, beside the
  bar ([concept_notifications.md](concept_notifications.md)).

## Notes for the director

- **T-165 first** (engine): the Starter Camp's placed Tokens get the fixture
  mark when the camp is laid down. No old-save conversion: the owner plays
  fresh saves (2026-10-13). Engineer; tests for a new game.
- **T-166** (builder): the Demolish toggle, the banners, mode outlines and
  cursor, dimming, the batch controls. Then the Token card drops its Disallow
  switch and Demolish buttons (with the info-layers card work, or as a small
  follow-up if that lands first).
- Both change what players see: owner eye-check.
