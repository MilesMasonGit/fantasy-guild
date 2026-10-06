# R-3 — The Bank Drawer Becomes a Side Drawer: Intent Spec

**Status: COMPLETE — all six slices done and verified.** Decisions
settled with the owner on 2026-08-11. Numbering continues from D-237. Style follows
[`playmat_decisions.md`](playmat_decisions.md).

**Owner's words:** *"Currently our Item bank is a drawer that comes out of the
bottom of the screen. Instead, I want it to come out of the side… It should be
underneath the nav bar, and overtop/covering the notifications and the playmat.
I like the existing item bank UI, and our Token bank should look like that, with
[tabs] and such."*

---

## The decisions

### D-238 — The bank drawer comes from the side, not the bottom.

It slides from the nav's edge, sits **under the nav bar** in z-order, and
**covers the notifications column and the playmat**. It **stops before the
Tray**.

*Why the Tray is excluded, and it is not cosmetic:* D-107 makes the Tray
load-bearing **because** an open Bank covers the board — the only route from
storage to a tile is **Bank → Tray → Board**. Cover the Tray and there is
nowhere to drag a Token to, and storage → board stops working entirely.

⚠️ **This constrains whatever replaces the Tray's contents while a drawer is
open.** The owner has plans for that space; they must leave a drop target for
Tokens, or the flow above needs replacing first.

*Extent:* roughly 1150px at the current layout (notifications 256 + playmat 896).

---

### D-239 — One pane at a time.

Opening the Bank closes the Token Vault, and vice versa.

*Why:* a side drawer has a fixed width. Splitting it three ways gives each pane
about a third of the playmat, and the Bank's grid is 96px cells — roughly three
columns per pane. The existing maximise button exists precisely because
side-by-side got cramped in the bottom drawer.

*Cost, accepted:* no side-by-side comparison — checking the Vault while the
Cartographer is open is no longer possible.

*Consequence:* `drawer.panes` (an array) collapses to a single active pane, and
**maximise loses its meaning** — a lone pane already fills the drawer.

---

### D-240 — The inspection panel leaves the drawer and moves over the Tray, now.

*Why now rather than later:* `InspectionPanel` is the **only** route to Token
detail from the Vault, the Cartographer, the Tray *and* the board. D-145 is
explicit that planning happens before placement — a player must never have to
spend a tile and a hero to discover what something does. Removing it without a
replacement switches D-145 off rather than deferring it.

*Cost:* it commits the Tray's space before the owner has designed what else goes
there, and may need moving again.

---

### D-241 — The Token Vault becomes a grid of icons, like the Bank.

One cell per Token type, with a copy count — **not one cell per copy**. D-137
caps *distinct types*, so a grid of copies would show forty cells for forty
Oakwood Groves and misrepresent what is actually capped.

⚠️ **Partial charges lose their line of text.** A Vault row currently reads
`3 part-used (400, 200 left)`; a cell has room for an icon and a count badge and
no more. **Partials must survive in inspection**, which D-240 keeps alive — and
they matter mechanically, because a Manager restocking from the Vault draws the
fullest copy first (D-77). A cell marker for "contains a part-used copy" is the
minimum; the detail lives in inspection.

*Rejected:* keeping the list of rows and only adding tabs (smallest change,
keeps the charge line, but the owner wants the two banks to read as siblings);
and dropping partial-charge detail entirely.

---

### D-242 — Vault tabs mirror the Bank's: system-owned, and the player files into them.

Drag Tokens between tabs to file them.

⚠️ **Corrected 2026-08-11.** This decision was taken on my description of the
Bank as offering create/rename/reorder. **It does not.** `BankTabStrip` calls
them *"the fixed, system-owned bank tabs… No player create/rename/delete"*, and
`GuildUpgradeManager._ensureBankTabs` pads the list as ranks are bought. Mirroring
the Bank therefore means **filing only** — which tab a Token lives in is the
player's, and how many tabs exist is the Guild Hall's.

⚠️ **Scope is tabs and filing only** (owner decision 2026-08-11). The Vault keeps
its per-row Sell and does **not** gain the Bank's search, type filter,
multi-select or bulk sell — most of `BankTab.jsx`'s 579 lines are that
machinery, and a Vault capped at distinct types (D-137) may never hold enough to
need searching.

⚠️ **This is the largest piece of work in the refinement register so far, and the
reason is not the UI.** `InventoryGroupManager` is item-specific end to end —
`getItemGroupId(itemId)`, `itemOverrides`, `groupDefs`, `groupOrder`, all stored
on the inventory. There is no entity-agnostic version. So this needs:

* a **parallel grouping model for Tokens**,
* **new saved state** on the token bank (`groupOrder`, `groupDefs`, overrides),
* and a **save migration** — or a read-time backfill, which is how the Tray's
  positions avoided a schema break (D-226) and is the preferred route.

*Rejected:* **derived tabs** (grouping by `theme` / `tokenType`, which already
exist in the data — no new state, no migration, but the game chooses the
organisation rather than the player); and **refactoring the grouping model to be
entity-agnostic** (one system for both, correct long-term, but it rewrites a
working load-bearing system the Bank depends on).

---

### D-243 — The Vault gets its own tab cap and its own Guild Hall upgrade track.

**5 free + 15 purchased, matching the Bank's numbers** but counted separately
(owner decision 2026-08-11), so organising Tokens is its own investment.

*Why:* organising Tokens becomes its own investment, and **D-163's Economy track
is noted in the roadmap as thin** — leaning mostly on sell rates. This gives it
something to sell.

*Cost:* two upgrade lines that do the same thing, and a player who buys the
wrong one.

---

### D-244 — Taking something out of a drawer is a drag to the Tray. The buttons stay.

One gesture across every pane: drag a Token out of the Vault, drag a Map off the
Cartographer, drop it on the Tray. The existing **"→ Tray"** and **Buy** controls
remain alongside it.

*Why the Tray is reachable at all:* D-238 stops the drawer before it, precisely
so there is somewhere to drop.

*Why keep the buttons:* they are the fallback when a drag is awkward — and,
given D-246, **they are the only thing that can explain why something refuses to
move.** They also remain the affordance that tells the player dragging is
possible at all, on surfaces where D-234 left Tokens with no visual cue.

*Not the item Bank.* Items have no destination — Tokens auto-pull them (D-24) —
so dragging an item to the Tray would mean nothing.

*Consequences, already settled elsewhere:* a dropped Token lands **where it was
dropped** (D-227), and a withdrawal takes the **fullest copy first** (D-77), so a
cell showing ×7 hands over the healthiest one.

---

### D-245 — Dragging a Map to the Tray buys it outright. No confirmation.

*Why:* the drag **is** the deliberate act — it takes an 8px pull, not a stray
click — and a dialog mid-drag is exactly the "results dialog" feel D-142 wants
Map-buying to avoid.

⚠️ *Accepted cost:* Maps are the main gold sink (D-96) and prices step by an
order of magnitude between themes (D-166), so a misdrag can cost 2,000g with no
undo.

*Rejected:* confirming above a price threshold; always confirming.

---

### D-246 — A Map that cannot be bought cannot be dragged.

Draggability is `canBuy()` evaluated live, which already covers all three
refusals: **not enough gold**, **short on materials**, and **no room in the
Tray**.

*Why:* no false affordance — nothing lifts that cannot land.

⚠️ **This is why D-244 matters.** With the drag disabled, the *reason* has
nowhere to appear during the gesture. The Buy button's disabled state must carry
`canBuy`'s message, or "unaffordable" and "broken" look identical. D-99
deliberately keeps unaffordable Maps visible with their price rather than greying
them out, for the same reason.

*Rejected:* draggable with the Tray refusing it and giving the reason on release;
showing the reason on the drag ghost (new chrome on the carried object, which
R-1 spent effort removing).

---

### D-247 — Maps can never go back. Ordinary Tokens can.

**A purchased Map must be opened.** It cannot be put away, returned or stored.

**Owner's words:** *"Making the player open maps is important, and I don't want
to give them a choice to do anything otherwise."*

*Already guaranteed structurally:* `TokenBank.deposit` refuses anything carrying
a `mapId` (D-156), enforced in the Vault rather than at the call sites *"so no
future path can quietly stockpile them."* A Map cannot be stored however it is
dragged — the UI restriction and the data rule agree.

**Any other Token may be dragged from the Tray back into the Vault.**

*Why the split:* the reasoning above is about Maps specifically. It does not
apply to a spare Bramble Patch — and without a way back, **there is no UI path
from the Tray to the Vault at all.** A Map burst can leave the Tray holding
Tokens the player never chose, and the only remedies would be placing them on the
board or selling at D-146's deliberately poor rate. D-168 makes the Tray roomy
enough that this will happen regularly.

*Consequence:* the drawer becomes a drop target as well as a drag source, and
the refusal for Maps needs to read as a rule rather than a bug — the Vault should
say so rather than silently rejecting the drop.

---

## Slices

| # | Slice | Status / depends on |
| :--- | :--- | :--- |
| **1** | The side drawer: geometry, z-order, one pane at a time, inspection relocated over the Tray | **✅ Done** (D-238/239/240) |
| **2** | **Drag-out to the Tray** — Vault withdrawal and Map purchase (D-244…D-247) | **✅ Done** |
| **3** | Token grouping model + saved state + read-time backfill | **✅ Done** — `TokenGroups.js` |
| **4** | The Vault as a grid with tabs, and the partial-charge marker | **✅ Done** |
| **5** | Vault tab cap + Guild Hall upgrade track (D-243) | **✅ Done** — `token_bank_tabs` |
| **6** | Docs: register, roadmap, `CHANGELOG.md` | **✅ Done** |

**Slice 2 is deliberately ahead of the Vault rework.** Dragging out works on the
Vault's *current* list rows as readily as on a future grid, so it can be built,
felt and judged before committing to the much larger grouping work — and if the
gesture turns out wrong, nothing in slices 3–5 has been spent on it.

### Slice 2, concretely

* The Tray's `accepts()` gains two payload shapes alongside `from.tile` and
  `from.traySlot`: a Vault withdrawal and a Cartographer purchase.
* `useEntityDrag` on Vault cells and Cartographer entries, **disabled** when
  `canBuy()` refuses (D-246) or the Vault row cannot be withdrawn.
* On drop: `TokenBank.withdraw(typeId)` or `Cartographer.buyMap(mapId)`, then
  place at the drop point (D-227).
* ⚠️ **Both already refuse cleanly and say why** — `canBuy()` returns a readable
  reason and `buyMap()` takes gold and materials only after every check passes,
  *"for the same reason `completeCycle` decides the whole exchange before any of
  it happens: a half-paid purchase destroys items for nothing."* The drag must
  route through them, never around them.
* **The reverse (D-247):** a Tray Token dragged into an open Vault deposits it.
  Maps are refused, with a reason rather than a silent rejection.
* The drawer is `data-dnd-surface="drawer"` and the Tray is a `DND_SURFACE.DRAWER`
  drop target, so both sit on the same surface — worth checking the surface
  logic does not treat drawer→Tray as an internal no-op.

**Out of scope, flagged not folded in:**

* **The Cartographer.** It is a shop, not storage, and R-3's own Q3.4 asks
  whether it belongs alongside two storage panes at all. It rides the same
  drawer for now; its future is a separate decision.
* **Whatever fills the Tray's space while a drawer is open.** Owner's, later —
  but see D-238's ⚠️.
* **The Bank's own presentation.** The owner likes it; it is the model, not the
  subject.

---

## Open questions

**Q1 — settled 2026-08-11.** Only Maps are pinned; ordinary Tokens may be
returned to the Vault. Folded into D-247.

**Q2 — settled 2026-08-11.** 5 free + 15 purchased, matching the Bank. Folded
into D-243.

**None outstanding.**
