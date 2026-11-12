# Brief 610 — Select and right-click: RTS-style controls

*Written 2026-11-11 by the planning agent from the owner's interview of the same day. Source:
[concept_rts_controls.md](../concept_rts_controls.md) (the design, approved). Code pointers are a first look; verify
them.*

**What the owner wants.** A second way to give orders, beside drag and drop, both working at once. Single click
selects a hero or a movable Token (gold outline); right-click on the mat sends it there, by **exactly the rules a
drop uses**; double-click inspects. Right-clicking a hero onto the job they already have stops them.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the concept doc, GDD "Orders: how heroes
get work", and GDD's placement rules (`MatPlacement.js`).

Code to start from (verify):
- **Presses on the mat**: `src/ui/components/board/pressRouting.js` (click, dblclick and contextmenu already routed),
  `MatToken.jsx` (`handleContextMenu`: today's right-click send-home), `MatHero.jsx` (`onContextMenu`),
  `MatBoard.jsx` (`handleRecallHero`, `onInspectToken`, the hover lights `lightHeroJob`).
- **Orders**: `src/systems/board/Orders.js` (`aimAt`, `canOrderOnto`, `orderAt`, `sendHome`, `refusalText`,
  `jobTokenOf`); `Flags.js`.
- **Drag**: `src/ui/dnd/` (`DndKit.jsx`, `DragGhost.jsx`, `pickupFlight.js`), the drag hints (brief 490), the reach
  ring and dots (brief 560).
- **The hero bar**: `src/ui/components/dock/BottomHeroDock.jsx`; the Hero drawer (brief 570).

⚠️ **One set of rules.** A right-click order must go through the same functions a drop does (`Orders`, the
placement checks), never a copy, so the two controls can't drift apart. If a drop's rules live in UI code that a
right-click can't reach, move them where both can, and say so.

## Needs

Brief 570 (the Hero drawer, the hero bar on every screen) should be merged first: S1 opens the drawer by
double-click. Touches the same drag code as 580 (the Shop strip) and 490's hints: not side by side with those.

## Phases

| Phase | What | Tier |
|---|---|---|
| S1 | **Selecting.** One selection (a hero or a movable Token: one you could drag today). **Single click** selects, from the mat or the hero bar; **double-click** inspects (Token card; Hero drawer) and selects. A **gold outline** on the selected one, on the mat and on the hero's bar card, at the white hover outline's size (UI_STYLE); a selected hero's job lights as on hover. **Unmovable Tokens** (enemies, landmarks): a single click only clears the selection; a double-click inspects. **Clears** on a click on blank mat, Escape, a new pick, leaving the mat (World Map, Guild Hall, travel) or entering a map mode (Demolish); the Bank and Shop opening keep it. **An open Token card or Hero drawer closes** on a single click of something else. Today's single-click-opens-the-card and the hero bar's click-opens-the-drawer become double-click everywhere; check other single-click uses on a Token (the recipe gear, bubbles, the problem mark) still work. Selection is UI state, not saved. | builder |
| S2 | **Hero orders.** With a hero selected, a right-click on the mat gives **the same order a drop there gives** (work, fight, hunt from a camp, home on the Guild Hall, wait on bare ground with the flag), with the drop's refusals in the same red bubble. A right-click on the **Token they already work or the enemy they already fight stops them**: they wait where they stand with the yellow "needs a job" mark, progress reset as a recall resets it. With **nothing selected**, a right-click on a working hero or the Token they work also stops them; **today's right-click send-home goes** (home is a right-click on the Guild Hall, or a drag). If leaving a fight mid-combat already has a rule (a recall today), use it and say what it is. Orders land on the mat only: a right-click on the Bank or Shop panels is not an order. **While a hero is selected**, the pointer shows the drag's hints: workable Tokens glow, the drag hints over the Token under the pointer, the dashed gold line from the hero. The selection stays after the order. | engineer |
| S3 | **Token moves.** With a movable Token selected, a right-click on the mat moves it there through **the same placement checks a drop uses**; a refused spot gives the drag's reason and the Token stays. It flies in a **short arc, like flying loot** (about half a second) and lands with a small settle; a hero working it walks after it, as after a drag. While a Token is selected, the pointer shows its **ghost and reach ring** (with the in-range dots, brief 560). The selection stays after the move. | builder |

Order: S1, then S2 and S3 (both touch the pointer hints: one at a time, or say how they share it).

## Done when

- Gate green (`TESTING.md`). **Engine work same**: the bench's play doesn't use the new controls. If anything in
  `Orders` moved, the work check proves it.
- **Benches**: the drag bench and one `bench:draw --compare` (hover and pointer code change; a selected hero's hints
  must not cost more each frame than a drag's).
- **Tests**: a right-click order and a drop onto the same target give the same result, for each kind (Token,
  enemy, camp, Guild Hall, bare ground, a refusal); stop on the current job; stop with nothing selected; a refused
  move; selection clearing on each trigger.
- **In the running game, named as verified**:
  - click a hero on the mat, then on the hero bar: gold outline in both places, job lit;
  - right-click a vein, an enemy, bare ground, the Guild Hall; a refusal ("Needs Pickaxe");
  - right-click the hero's own job: they stop and wait with the mark;
  - with nothing selected, right-click a working hero: they stop;
  - select a Token, right-click a free spot: it arcs there, its hero follows; a blocked spot: refused, stays;
  - double-click a Token and a hero (mat and bar): the card and the drawer open; single-click another: the panel
    closes and the new one is selected;
  - blank mat, Escape, the World Map, Demolish mode: the selection clears; the Bank opening keeps it;
  - drag and drop still work exactly as before, with something selected too.
- GDD "Orders" updated (the right-click rules, send-home's retirement, select and double-click); changelog entry.

**Eye-check: yes**, one look after S3 (a new interaction).

## Not in this brief

- Selecting several at once (a later ticket if the owner wants it).
- Orders on the World Map.
- Keyboard shortcuts beyond Escape.

## Owner to-do

The eye-check. No CMS steps.
