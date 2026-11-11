# Brief 580 — Foundations go back to the Shop, the Shop strip, rings end at the mat's edge

*Written 2026-11-10 by the director from the owner's request the same day (the owner's choices are quoted as
rulings below; no concept doc: the request was specific). Code facts were gathered by a read-only agent and spot-checked
by the director. Read first: `CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the
GDD sections on Foundations and the Shop.*

## What the owner wants

1. **Refunds.** Any Foundation that has not yet been built into a permanent structure can be dragged back into the
   Shop for a refund, including one bought earlier and already on the mat.
2. **The Shop strip.** While a Token from the Shop is carried above the open Shop, the Shop drops (this already
   happens). It should drop to a thin strip sitting on **top of the hero bar**, not off the screen, and rise again
   only when the player hovers that strip, so a Foundation can go anywhere on the mat and the Shop can be reopened
   without a click.
3. **Rings end at the mat's edge.** The reach ring (and its dots) is clipped to the mat; today it runs over the edge.

## Rulings (owner, 2026-11-10)

- **Full price back**: every item the Foundation cost returns to the Bank.
- **Materials: checked at the start, taken at the end** (owner): "The item cost should only be checked twice: to see
  if there is enough to start, and then at the end, when it is collected... All of our tasks should work this way."
  Work cycles, builds included, already do this (`WorkCheck` checks inputs to start; `BoardRunner.completeCycle`
  pays at the end, `BoardRunner.js:256`). So a Foundation part-way through a build has taken nothing, and its refund
  is its Shop price only; the hero working it is sent off it (as when its Token leaves the mat). Fields that take
  their seed when sown are the one known exception: ticket T-399, not this brief.
- **Shop closed**: picking up any unbuilt Foundation on the mat shows the Shop strip on top of the hero bar, so a
  refund target is always there; the strip goes away on the drop (unless the Shop was open).
- **After a drop the Shop rises again**, as today. The strip is a during-the-drag state; hovering it during the drag
  raises the Shop.

## Code facts (paths under `src/`)

- The Shop is `ui/components/drawer/ShopPanel.jsx` (mounted at `ui/ReactRoot.jsx:375`). Its state is
  `shopPanelState(isOpen, activePayload, surface)` (`ShopPanel.jsx:75-79`): `'closed'`, `'open'`, or `'lip'` while a
  Shop card is carried outside a drawer region. The lip is `translateY(calc(100% - (SHOP_LIP_PX + foot)px))`
  (`:86-90`, `SHOP_LIP_PX = 28`), i.e. today's lip sits at the very bottom, behind the hero bar. `foot` =
  `DOCK_STRIP_PX` (64, `dock/dockHeroView.js:15`) + the bar's label overhang (`ShopPanel.jsx:127`). The unused
  `under` option of `shopPanelTransform` (`:86-90`) may help.
- "Outside the drawer" is a rect test on `[data-dnd-region]` elements snapshotted at drag start
  (`ui/dnd/DndKit.jsx:178-201, 404-422`); the hero bar is a drawer region too (`dock/BottomHeroDock.jsx:79`). ⚠️ The
  snapshot is taken with the Shop fully up; once it drops, the old rect would still count as "inside": the strip's
  hover must be judged against the strip itself, not the stale snapshot.
- Only Shop cards lower the Shop today (`isShopPayload`, `ShopPanel.jsx:67`). A Shop card dropped over the panel is a
  plain cancel (`Board.jsx:74`, `pointerOverShopPanel` `ShopPanel.jsx:59-65`); the panel is deliberately not a
  droppable (`:55-57`).
- Buying: `Shop.buyAt` / `Shop.purchase` (`systems/board/Shop.js:140-177`) places the Token, then
  `InputAllocator.consumeInputs(price)`; publishes `ENGINE_EVENTS.TOKEN_PURCHASED`. Prices are static
  (`priceOf` = `def.shop.price`, `Shop.js:63-65`); items only, gold is retired. **Nothing sells or refunds today**,
  and a bought Token does not record what it cost (`BoardState.createTokenInstance`, `BoardState.js:118-128`).
- A Foundation is a Token with `def.foundation` (`Foundations.isFoundation`, `systems/board/Foundations.js:18-20`);
  once built it becomes another Token (`buildInPlace`, `:57-84`), which is no longer a Foundation and can never be
  refunded.
- The ring: `ReachRing` (`ui/components/board/CampReachRing.jsx:35-62`) is an `overflow-visible` SVG the mat's size,
  inside the mat root (`MatBoard.jsx:493-498`), unclipped. `TerrainGridOverlay.jsx:94-100` already clips to the mat
  with its rounded corners (`MAT_EDGE.radius`): follow that.

## Phases

| Phase | What | Tier |
|---|---|---|
| S1 | **Refund engine.** `Shop.refund(instanceId)`: only an unbuilt Foundation (`isFoundation` on its current type) that was placed (not spawned); gives back `priceOf(typeId)` in full to the Bank (whatever the Bank's room: say what happens when it is full; the floor-loot path is the likely answer), removes the Token, frees its hero (as any Token leaving the mat), publishes an event (`TOKEN_REFUNDED`) and logs. A Foundation mid-build is refundable and has paid nothing for the build (checked at the start, paid at the end: test that the build's inputs are untouched by the refund). Refuses anything else with a reason. Save-safe: nothing new is stored. Tests: price back exactly, a spawned or built Token refused, mid-build hero freed, cap count drops, a quest counting purchases is not un-counted (say what it does). **Engine work same** on the bench (no scenario refunds). | builder |
| S2 | **The strip and the drop target.** (a) The Shop's dropped state is a strip on **top of the hero bar** (its labels and HP bars included): the Shop header or a thin bar with the Shop's title, high enough to hover easily; it rises to full open when hovered during a drag and drops again when the pointer leaves it upward. After the drop the Shop rises again as today. (b) Picking up an **unbuilt Foundation already on the mat** shows the same strip, also when the Shop is closed (it goes away on the drop unless the Shop was open). (c) Dropping a Foundation from the mat onto the strip or the open Shop refunds it (S1), with the Shop's purchase sound or a fitting one and a short bubble naming what came back; a Shop card dropped there still cancels. Anything else carried over the Shop behaves as today. ⚠️ Judge the hover and the drop against the strip's live rect, not the drag-start snapshot. Tests for the state machine (`shopPanelState` grows a Foundation-from-mat case). In the game: buy, place, carry it back, refund; refund with the Shop closed; a mid-build refund; the strip hovered and the Shop rising; small and maximised windows, menu on each side. **Ready for the drag bench.** | builder |
| S3 | **Rings end at the mat's edge.** Clip `ReachRing` (ring and dots) to the mat with its rounded corners, as `TerrainGridOverlay` does; check the hero-lit camp ring too. A one-file look fix. | builder-lite |

S1 before S2 (S2 calls it); S3 any time, on its own branch.

## Done when

- Gate green (`TESTING.md`); engine work same; the drag bench after S2.
- In the running game, named as verified: each check in S2's list; a ring at each mat edge and corner clipped.
- GDD: Foundations (refund), the Shop (strip). CHANGELOG entries.
- **Eye-check: yes**, one look after S2 and S3 together.

## Not in this brief

- Fields taking their seed when sown (T-399), and any other task that pays at the start.
- Refunding anything that is not an unbuilt Foundation; selling items.

## Owner to-do

The eye-check. No CMS steps.
