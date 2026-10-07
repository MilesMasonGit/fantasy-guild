# Brief 00 — quick fixes before the UI rework

Two small bugs, fixed first (owner, 2026-10-07) so they don't confuse testing
of the UI rework. One branch, `fix/pre-crunch`, two commits. No eye-check
needed (they restore intended behaviour), but both are verified in the game.

## Q1 — T-104: a closed hero sheet catches drops (builder)

**Problem.** `BottomHeroDock.jsx` hides the hero sheet with opacity 0 but keeps
it mounted while a hero is still selected (`displayedHeroId`), so its
equipment-slot drop targets (`dock-slot-drop-<hero>-<slot>`,
`DockEquipmentGrid.jsx` `useEntityDrop`) stay registered. dnd-kit ignores
`pointer-events`; any mat drop inside the sheet's box is refused. Found by
`npm run bench:drag`; confirmed in code.

**Fix direction.** Drop targets of a closed sheet must not exist: disable the
droppables while the sheet is closed (dnd-kit `disabled`), or unmount the
sheet's contents after its closing animation. Check the Bank-side
`BankHeroPanel` for the same pattern.

**Done when.**
- A red-first test: after a hero sheet is opened and closed, no
  `dock-slot-drop-*` target is registered (or all are disabled).
- `npm run bench:drag`: the overlays pass no longer reports
  `dock-slot-drop-…` under any failed drop; paste the per-kind table. (Other
  drag failures, T-105–T-107, are expected to remain.)
- In the game: equip an item via the sheet, close it, drag a Token and a flag
  across the mat's centre: both land.

## Q2 — T-101: binned Tokens let a spawner exceed its cap (builder)

**Problem.** A spawner's family cap (`SpawnerSystem.js`, family count) doesn't
count its spawned Tokens sitting in the discard bin, so binning them lets the
spawner make more. The owner ruled: binned Tokens count toward spawner caps
and Token counts.

**Fix direction.** Count binned instances of the family in the spawner's
census (the bin lives in `state.board.bin`, `DiscardBin.js`). The Token cap
(`MatCap.js`) already counts binned placed Tokens; check it stays right.

**Done when.**
- A red-first test: a spawner at cap with one of its Tokens binned does not
  spawn; taking that Token out of the bin and discarding it frees the slot.
- Engine bench: `npm run bench -- --compare` — if WORK CHANGED, check whether
  a scenario has binned spawned Tokens; accept only with the ticket
  (`--accept-work-change=T-101`) and say why.
- In the game: a forest at cap, bin one of its saplings, wait past its
  interval: no new spawn.

Close T-104 and T-101 in the ticket log.
