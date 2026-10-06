# The Tray as Loose Objects: Intent Spec

**Status: awaiting approval.** No code has been written. This document records what
the owner decided across four interview rounds on 2026-08-07, in the style of
[`playmat_decisions.md`](playmat_decisions.md). Numbering continues from D-222
(the last entry of [`token_object_intent.md`](token_object_intent.md)).

**Owner's words:** *"It's currently a grid, but I want it to just be free/loose
objects that can be moved around by the player at will. The player can stack them
up or move them around as they wish."*

**Relationship to R-1.** This is a **new mechanic**, not part of R-1. R-1 changes how
a Token is *drawn*; this changes what the Tray *is*. They share `Tray.jsx` and they
agree with each other — a loose surface is the natural home for objects that no
longer sit in boxes (D-219) — but they are separately approvable and separately
revertible. **R-1's slice 3 should land before this**, so the Tray is already
drawing 64px frameless Tokens when the surface underneath it changes.

---

## The one-sentence version

The Tray becomes a **free 256px-wide surface** where Tokens sit wherever they are
put, may overlap freely, are scattered into open space when they arrive on their
own, and **stay exactly where you left them between sessions**.

---

## The decisions

### D-223 — The Tray is a free surface, not a grid of slots.

Tokens sit at arbitrary positions. Nothing snaps, nothing reflows, nothing is
ordered. A Token dropped somewhere is there until it is moved or used.

*Why:* it is the owner's stated intent, and it is consistent with D-143's *"solid
objects resting on a surface"* and with D-219's removal of the slot frame. A rack of
snapped cells is the last place in the Token's life that still reads as a
spreadsheet.

*Chosen against:* a **workbench** (rejected: functionally similar, but it implies the
player must place everything, and the owner wanted arrivals to just land); a
**physics box** with gravity and heaping (rejected: buried Tokens, a simulation
running in a 256px column, and — decisively — pixel art will not rotate cleanly at
anything but 90°, so a tray of tumbling objects cannot be drawn); and the **existing
grid** (rejected: it is the thing being replaced).

⚠️ *Accepted cost:* the grid was doing real work. A grid makes a narrow column
scannable for free. Without it, a full Tray is harder to read, which is what D-227
and D-229 exist to mitigate.

---

### D-224 — Stacking is visual overlap only. Nothing merges.

Tokens may sit on top of one another. There are no piles, no counts, no
consolidation. Any Token can be dragged out from anywhere in an overlap.

*Why:* it is the only reading that keeps a Token an **object**. A merged pile is a
container, and containers are what this whole line of work is removing.

*And a merged pile cannot be drawn honestly.* Every Tray Token carries its own
`usesRemaining`. Three half-spent Oakwood Groves have three different charge values
and there is no single number that describes them. D-77 solved exactly this in the
Bank by **consolidating charges** — doing that in the Tray would silently alter the
player's Tokens as a side effect of tidying, which is not a trade the player agreed
to.

*Chosen against:* **same-type merging with a count** (rejected on the charge problem
above); and **snap-to-merge on precise overlap** (rejected: one gesture with two
outcomes depending on aim, plus the same charge problem).

---

### D-225 — The Tray stays 256px wide.

No layout change. The BubbleMenu (150px) and the board (896px, locked by D-171)
are untouched, so the play area still needs 1302px and no more.

*Why:* R-4 is going to rearrange these columns and has no direction yet. Widening
the Tray now would spend board width against a layout that is about to move.

⚠️ *Accepted cost, and it is the largest one here.* At 256px a 64px Token fits three
across with 20px spare, so "move them anywhere" is mostly freedom to move them **up
and down**. Scatter is the option that most needs width, and this is the width where
it looks worst. **The owner chose this having seen 256, 384 and 512 side by side with
all 18 Tokens in each.** If the loose Tray feels cramped in play, widening is one
Tailwind class and belongs to R-4.

*Chosen against:* **384px** (six across, real two-dimensional room, 128px off the
play area); **512px** (a genuine desk, needs a 1600px window); and **deferring the
whole feature to R-4**.

---

### D-226 — Positions persist between sessions, stored as a fraction of the surface.

Each Tray Token carries its own position, saved with the game. Positions are stored
as **proportions** (`0…1`) of the Tray's width and height, not as pixels.

*Why proportions:* the Tray body is `flex-1` — its height is whatever the window
leaves it, and it shrinks sharply whenever a bottom drawer opens. Absolute pixels
would preserve the arrangement perfectly and then hide part of it below the fold,
which matters because **D-156 makes the Tray the only place an unopened Map can
live**. With proportions the arrangement squashes and stretches, nothing ever leaves
the surface, no scrolling is needed, and all 18 Tokens stay visible so the `18 / 18`
count keeps describing something the player can see.

⚠️ *Accepted cost:* spacing is not preserved, only ordering and rough layout. A
deliberate gap between two groups can close up on a short window.

*Chosen against:* **absolute pixels with a scrolling Tray** (rejected: Tokens below
the fold, and a Tray that looks half-empty while being full); **absolute pixels
nudged back in bounds** (rejected: nudging is lossy, so the arrangement quietly
degrades every time a drawer opens).

**Two things this does *not* require, corrected from an earlier reading:**

* **No Token id is needed for persistence.** Position lives on the instance, so
  `takeFromTray()`'s splice cannot disturb it — each Token carries its position with
  it. *(An id is still worth adding for stable React keys during a drag; that is a
  rendering nicety, not a data requirement, and it should be justified as such.)*
* **No save-schema break.** `migrateState()` refuses any save whose version is not an
  exact match, and every rework so far has broken compatibility deliberately. This
  change does not need that: a Token loaded **without** a position is simply
  scattered on read, exactly as a fresh arrival would be. Schema stays **0.6.0**.

---

### D-227 — Arrivals the player did not place seek the emptiest part of the Tray.

A Token arriving on its own — a Map bursting (D-158), a purchased Map (D-156), a
Vault withdrawal, a Token pulled back off a tile, a floor sprite clicked to the Tray
— lands at a random position **biased toward open space**. Overlap begins only once
the Tray genuinely runs out of room.

**When the player drags a Token in themselves, it lands where they dropped it.** No
correction, no snapping. Anything else would fight "moved around at will".

*Why:* uniform randomness does not read as physical, it reads as broken — Tokens
bury each other while obvious free space sits unused next to them. Real objects
tipped onto a real surface spread out. Seeking space is *more* physical than
uniform randomness, and it costs a few lines of arithmetic. It also keeps a
half-full Tray readable, which is the common case.

*Chosen against:* **pure uniform random** (rejected on the sorting test — finding a
specific Token took visibly longer, and a six-item burst can drop three things on
one spot); **a fixed entry point** where everything piles in at the top (rejected:
truest to "tossed in a tray", and new arrivals are trivially easy to spot, but a
Map burst arrives as one heap that must be cleared before it can be read).

---

### D-228 — Capacity stays a count of 18. It does not become an area.

`TRAY_CAPACITY = 18`, `addToTray()` keeps refusing at 18, and D-158's overflow chain
— Tray, then Token Bank, then the Token simply stays on the board as a sprite
(D-138) — is untouched.

*Why this is forced rather than chosen:* D-224 allows unlimited overlap, so "full"
can never be a spatial fact. If things can stack forever, an area-based capacity has
no meaning. Recorded explicitly because capacity is load-bearing in three places —
D-156 (Maps live only in the Tray), D-158 (the overflow trigger) and D-168 (Tray
size is a Guild Upgrade) — and a later reader could reasonably assume a free surface
implies free capacity.

⚠️ *Accepted cost:* fullness stops being **visible**. A grid at 18/18 looks full; a
scattered surface at 18/18 does not necessarily. The header count becomes the only
signal, and D-227's space-seeking is what keeps it roughly honest.

---

### D-229 — Hover raises the Token under the cursor. A tidy-up button re-lays the Tray.

Hovering brings the Token under the pointer to the front for as long as the pointer
is over it — purely visual, not saved. A **Tidy** control in the Tray header re-lays
every Token loosely so nothing overlaps, from which the player rearranges.

*Why:* both cost **nothing when not used**, which is the only kind of addition Risk 7
permits — and Risk 7 (visual clutter killed the previous spatial playmat) is the
standing objection to everything in this document. Hover-raise means the player can
always identify what they are pointing at; Tidy is the escape hatch for a Tray that
has been made a mess of, which D-225's 256px width makes likely.

*Chosen against:* **hover-raise alone** (no way back from a bad pile); **Tidy alone**
(a buried Token stays unidentifiable until the button is pressed); **neither**
(purest, and unusable at 18 Tokens in a 256px column).

*Note:* Tray hover currently does nothing but show a browser tooltip, so hover-raise
is free. It does **not** touch D-88's three-way hover conflict, which is a board
behaviour.

---

## Blast radius

| Area | What changes |
| :--- | :--- |
| `Tray.jsx` | The `grid grid-cols-3` body becomes a positioned surface; `TraySlot` loses its frame and gains a position and a within-Tray drag. |
| `BoardState.js` | `createTokenInstance` gains `x`/`y`; `addToTray` assigns a space-seeking position; a read-time backfill scatters any Token that loads without one. |
| `Placement.js` | `returnTokenToTray` must place at a position — drop point when dragged, space-seeking when not. |
| The Tray as a drop target | Currently accepts only `p.from?.tile != null`. Must also accept a Token already **in** the Tray, which is what makes repositioning work. |
| Tests | Five test files reference tray slots. `addToTray`/`takeFromTray` signatures are unchanged, so they should be unaffected — to be confirmed, not assumed. |

**Explicitly unchanged:** capacity and overflow (D-228), click-to-inspect,
double-click-to-burst (D-142), and the drag-out-to-a-tile gesture. Tray *width* is
R-4's (D-225).

---

## Implementation slices

| # | Slice | Verifies by |
| :--- | :--- | :--- |
| **1** | Positions on the instance: `x`/`y` as fractions, space-seeking placement, read-time backfill. No visual change yet. | Tests, plus a save/reload round-trip showing positions survive. |
| **2** | The surface: `Tray.jsx` becomes positioned, Tokens draggable within it, drops landing at the drop point. | Dragging a Token around the Tray, reloading, and finding it where it was left. |
| **3** | Hover-raise and Tidy (D-229). | Burying a Token under two others and recovering it both ways. |
| **4** | Docs — a new register entry in `playmat_refinement_briefs.md`, Phase 10's status table, `CHANGELOG.md`. | — |

**Verification standard:** `npm test`, then run the game and actually exercise it —
burst a Map into the Tray, drag Tokens around, reload, resize the window, open a
bottom drawer. Known traps: screenshots time out (probe `window.Game` /
`window.GameState`), and `requestAnimationFrame` does not fire in a non-compositing
tab.

---

## Open questions for the owner

None. **Approve and slice 1 begins** — though see the note at the top: R-1's slice 3
should land first, so this changes a Tray that is already drawing frameless 64px
Tokens.
