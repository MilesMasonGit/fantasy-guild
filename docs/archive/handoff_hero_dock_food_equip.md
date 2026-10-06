# Handoff: Hero Dock — can't equip a food item by drag-and-drop

## Read first

This is Fantasy Guild (Tauri desktop app, React + Vite). Read `CLAUDE.md` before
touching anything — the owner doesn't code, wants design decisions asked as
multiple choice, wants `npm test` + a browser check before anything is called
done, and wants you to stay in scope. `game_refinement_and_alignment_plan.md`
is the active audit-pass tracking doc; the Hero Dock work lives under its
section 5, "Hero 9-Slot Flexible Loadout Grid."

The owner has explicitly said: **don't simulate drag-and-drop interactions
yourself** (`computer` click-drag, synthetic pointer sequences, etc.) — it's
unreliable to simulate and they'd rather do the hands-on check themselves.
Verify what you can through code reading, direct API calls, and non-drag DOM/
event checks, then hand it back for the owner to actually test by hand.

## The problem

The owner cannot equip a food item onto a hero by dragging it from the Bank
onto a Hero Dock card. Expected: dragging any equippable item (weapon,
potion, food, drink, trinket, etc.) from the Bank onto a hero's Hero Dock
card should equip it to that hero, the same way the game's other
drag-to-equip flows work.

Reported three times across this session, after two different fixes were
made and verified — and it is **still not working** after both. Take that
seriously: whatever has been checked so far (see below) has not actually
exercised the real failure mode, or the real failure mode is something else
entirely. Do not repeat the same verification approach and declare success
again without getting the owner to confirm it actually works by hand.

## Open unknowns — nail these down before doing anything else

- **Which build is the owner actually testing?** Every verification so far
  (mine) happened against a browser dev-server preview
  (`mcp__Claude_Browser__preview_start` / mcp Browser pane). The owner may be
  testing the packaged/dev Tauri desktop window instead, which is a
  different runtime and would not pick up source changes the same way (or at
  all, if it's a stale build). Confirm this before assuming the code is even
  what's running when the owner tests.
- **What exactly happens when the owner drags and drops?** Not established:
  does the drag not even start, does the item's ghost snap back like an
  invalid drop, does it show a reject cue first, does anything change in the
  Bank or on the hero at all? This has never been pinned down — get a
  precise description or a recording/screenshot from the owner if possible.
- **Which specific interaction is being attempted?** Dragging onto a
  *collapsed* hero tab in the dock strip vs dragging onto an *opened
  (pinned)* hero card's equipment grid are two different drop targets in the
  code, with different history in this session. Confirm which one (or both)
  the owner is trying.

## What's already been tried this session (did not resolve it)

1. Added a drop target to the pinned hero card's body
   (`src/ui/components/dock/HeroDockCard.jsx`) — previously only the
   collapsed header strip (`HeroDockTab.jsx`) had one, so opening a card and
   dropping onto its equipment grid had nothing to receive the drop.
2. Changed `src/ui/components/dock/HeroDock.jsx`'s "click outside closes the
   pinned card" listener from firing on `pointerdown` to firing on
   `pointerup`, because a drag gesture's first event is also a pointerdown,
   and the old binding meant starting *any* drag from outside the dock (e.g.
   picking up a Bank item) closed the open card — and its drop target —
   before the drag arrived.

Both changes were verified via `npm test` (559/559 passing both times, no
regressions) and via targeted checks: calling `EquipmentManager.equipItem`
directly from the console (works — a hero's `equipment` array updates
correctly for a food item, e.g. `apple`), and dispatching synthetic
`pointerdown`/`pointerup` events to confirm the listener change behaves as
intended in isolation. **None of this constitutes proof the real,
owner-performed drag gesture succeeds** — it's all either bypassing the drag
entirely (direct API call) or exercising one event handler in isolation, not
the full dnd-kit pointer-sensor → collision-detection → drop-resolution
pipeline as a real user's mouse movement would drive it.

## Relevant code map (orientation, not a diagnosis)

- `src/ui/dnd/DndKit.jsx` — the shared drag-and-drop system. `DeckDndProvider`
  wraps the whole app; `useEntityDrag`/`useEntityDrop` are the hooks
  individual components use; collision detection is `smallestWithin` (pointer
  containment, smallest-area target wins); `PointerSensor` activation
  threshold is 8px of movement before a pointerdown counts as a drag.
- `src/ui/components/drawer/BankTab.jsx` — where a Bank item's drag source is
  set up (`ItemTile`, `useEntityDrag`).
- `src/ui/components/dock/HeroDock.jsx` — the dock strip: roster order,
  overlap/hover/pin state, Small Mode, the recall drop zone, and the
  outside-click-closes-pinned-card listener touched in fix #2 above.
- `src/ui/components/dock/HeroDockTab.jsx` — one hero's collapsed header; its
  own `useEntityDrop` is the original (pre-existing) equip target.
- `src/ui/components/dock/HeroDockCard.jsx` — wraps the header + the pinned
  body (equipment grid + skills grid); the body's drop target from fix #1
  above lives here.
- `src/ui/components/dock/DockEquipmentGrid.jsx` — the 3×3 equipment slot
  grid rendered inside a pinned card. Individual slots are drag sources
  (`useEntityDrag`, for pulling an item back out) but are **not** drop
  targets themselves — by design, since `EquipmentManager.equipItem` always
  resolves its own destination slot from the item's category rather than
  taking a target slot as input.
- `src/systems/equipment/EquipmentManager.js` /
  `EquipmentValidator.js` — the actual equip logic. Confirmed working
  correctly when called directly, for at least one food item.

## How to verify without simulating the drag yourself

- `window.Game` / `window.GameState` are exposed globals in the browser
  console for direct inspection (`window.GameState.state.heroes`,
  `window.Game.EquipmentManager.equipItem(heroId, itemId)`, etc.).
- `screenshot` reliably times out in the Claude Browser pane — the game's
  particle overlay runs continuously at 60fps and the renderer never goes
  idle. Use `read_page`, `read_console_messages`, and `javascript_tool`
  (computed styles, `getBoundingClientRect`, dispatching *individual* events
  to test one handler) instead.
- If you need to observe a real drag end-to-end and the owner is not
  available to do it live, ask them explicitly before simulating one — don't
  default to it silently given their stated preference.

## What to report back

A precise description of what you found and what (if anything) you changed,
plus explicit confirmation of what you could and couldn't verify yourself.
If you fix something, say clearly that it needs the owner's own hands-on
confirmation before it's considered actually resolved — that trust has
already been spent twice this session.
